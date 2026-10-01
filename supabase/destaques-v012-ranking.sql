-- ELO V0.12 — Avaliação mensal, competência automática e Ranking do Mês
-- Seguro para execução incremental: não apaga dados existentes.

-- 1) Campos da pontuação manual / IA
alter table public.destaque_avaliacao_itens
  add column if not exists manual_score numeric(4,2),
  add column if not exists manual_justification text,
  add column if not exists manual_by uuid references public.profiles(id) on delete set null,
  add column if not exists manual_at timestamptz,
  add column if not exists ai_samples integer not null default 0,
  add column if not exists ai_updated_at timestamptz;

alter table public.destaque_avaliacao_itens
  drop constraint if exists destaque_avaliacao_itens_manual_score_check;

alter table public.destaque_avaliacao_itens
  add constraint destaque_avaliacao_itens_manual_score_check
  check (manual_score is null or (manual_score >= 0 and manual_score <= 10));

-- 2) Competência automática do atendimento
alter table public.destaque_atendimentos
  add column if not exists attendance_date date,
  add column if not exists period_key text;

create index if not exists idx_destaque_atendimentos_employee_period
  on public.destaque_atendimentos(employee_id, period_key);

create index if not exists idx_destaque_atendimentos_attendance_date
  on public.destaque_atendimentos(attendance_date);

alter table public.destaque_atendimentos
  drop constraint if exists destaque_atendimentos_period_key_check;

alter table public.destaque_atendimentos
  add constraint destaque_atendimentos_period_key_check
  check (
    period_key is null
    or period_key ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'
  );

create index if not exists idx_destaque_avaliacao_itens_evaluation
  on public.destaque_avaliacao_itens(evaluation_id);

create index if not exists idx_destaque_avaliacoes_employee_cycle
  on public.destaque_avaliacoes(employee_id, cycle_id);

-- 3) Consolidação da avaliação mensal
-- A nota efetiva é: revisão > IA > manual.
-- O final_score somente é preenchido quando todos os critérios ativos têm nota.
-- Critérios obrigatórios também precisam respeitar sua nota mínima.
create or replace function public.recalculate_destaque_evaluation(p_evaluation_id uuid)
returns public.destaque_avaliacoes
language plpgsql
security definer
set search_path = public
as $$
declare
  v_eval public.destaque_avaliacoes;
  v_weighted numeric := 0;
  v_missing_required text[] := '{}';
  v_below_minimum text[] := '{}';
  v_item record;
  v_score numeric;
  v_complete boolean := true;
  v_eligible boolean := true;
  v_reason text;
begin
  if not public.has_permission('destaques','edit') then
    raise exception 'Sem permissão para consolidar avaliação.';
  end if;

  select * into v_eval
  from public.destaque_avaliacoes
  where id = p_evaluation_id;

  if not found then
    raise exception 'Avaliação mensal não encontrada.';
  end if;

  for v_item in
    select
      c.id,
      c.name,
      c.weight,
      c.required,
      c.min_score,
      i.score,
      i.manual_score,
      i.reviewed_score
    from public.destaque_criterios c
    left join public.destaque_avaliacao_itens i
      on i.evaluation_id = p_evaluation_id
     and i.criterion_id = c.id
    where c.active = true
  loop
    v_score := coalesce(v_item.reviewed_score, v_item.score, v_item.manual_score);

    if v_score is null then
      v_complete := false;
      if v_item.required then
        v_missing_required := array_append(v_missing_required, v_item.name);
      end if;
    else
      v_weighted := v_weighted + (v_score * coalesce(v_item.weight, 0) / 100.0);

      if v_item.required and v_score < coalesce(v_item.min_score, 0) then
        v_eligible := false;
        v_below_minimum := array_append(v_below_minimum, v_item.name);
      end if;
    end if;
  end loop;

  if not v_complete then
    v_eligible := false;
  end if;

  if not v_eligible then
    v_reason := concat_ws(
      ' ',
      case when array_length(v_missing_required, 1) > 0
        then 'Critérios obrigatórios sem nota: ' || array_to_string(v_missing_required, ', ') || '.'
        else null end,
      case when array_length(v_below_minimum, 1) > 0
        then 'Critérios abaixo da nota mínima: ' || array_to_string(v_below_minimum, ', ') || '.'
        else null end
    );
  else
    v_reason := null;
  end if;

  update public.destaque_avaliacoes
  set
    final_score = case when v_complete then round(v_weighted, 2) else null end,
    eligible = v_eligible,
    ineligibility_reason = v_reason,
    status = case when v_complete then 'validada' else 'em_avaliacao' end,
    updated_at = now()
  where id = p_evaluation_id
  returning * into v_eval;

  return v_eval;
end;
$$;

grant execute on function public.recalculate_destaque_evaluation(uuid) to authenticated;

-- 4) Ranking mensal
-- security_invoker mantém as políticas/RLS das tabelas de origem.
drop view if exists public.vw_destaque_ranking_mensal;

create view public.vw_destaque_ranking_mensal
with (security_invoker = true)
as
select
  da.id as evaluation_id,
  da.cycle_id,
  dc.period_key,
  da.employee_id,
  col.full_name,
  col.sector,
  da.final_score,
  da.eligible,
  da.ineligibility_reason,
  da.status,
  coalesce(att.atendimentos_analisados, 0)::integer as atendimentos_analisados,
  rank() over (
    partition by dc.period_key
    order by da.final_score desc nulls last
  ) as position
from public.destaque_avaliacoes da
join public.destaque_ciclos dc
  on dc.id = da.cycle_id
join public.destaque_colaboradores col
  on col.id = da.employee_id
left join (
  select
    cycle_id,
    employee_id,
    count(*) filter (where status = 'analisado') as atendimentos_analisados
  from public.destaque_atendimentos
  group by cycle_id, employee_id
) att
  on att.cycle_id = da.cycle_id
 and att.employee_id = da.employee_id;

grant select on public.vw_destaque_ranking_mensal to authenticated;

-- 5) Garante que o vencedor futuro do ciclo aponte para o cadastro da equipe avaliada.
alter table public.destaque_ciclos
  drop constraint if exists destaque_ciclos_winner_id_fkey;

alter table public.destaque_ciclos
  add constraint destaque_ciclos_winner_id_fkey
  foreign key (winner_id)
  references public.destaque_colaboradores(id)
  on delete set null;

-- 6) Diagnóstico
select
  period_key,
  employee_id,
  full_name,
  final_score,
  eligible,
  status,
  atendimentos_analisados,
  position
from public.vw_destaque_ranking_mensal
order by period_key desc, position asc, full_name asc;
