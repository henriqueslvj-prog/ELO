-- ELO V0.19.0 | Ranking com todas as pontuações (IA + gestor) e correção do recálculo
-- Execute no SQL Editor do Supabase. Seguro para repetir. Não apaga avaliações nem pontuações.
begin;

-- 1) FUNÇÃO DE RECÁLCULO ------------------------------------------------------
-- A migração v0136 renomeou o parâmetro para target_evaluation_id, mas o sistema chama p_evaluation_id
-- (erro "Could not find the function ... (p_evaluation_id) in the schema cache"). Recria com o nome correto.
drop function if exists public.recalculate_destaque_evaluation(uuid);
drop function if exists public._recalc_destaque_evaluation(uuid);

-- Cálculo interno (sem checagem de permissão; não exposto à API).
create function public._recalc_destaque_evaluation(p_evaluation_id uuid)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v_eval public.destaque_avaliacoes;
  v_item record;
  v_score numeric;
  v_total numeric := 0;
  v_count integer := 0;
  v_scored integer := 0;
  v_missing text[] := '{}';
  v_below text[] := '{}';
  v_complete boolean;
  v_eligible boolean;
  v_reason text;
begin
  select * into v_eval from public.destaque_avaliacoes where id = p_evaluation_id;
  if not found then raise exception 'Avaliação mensal não encontrada.'; end if;

  for v_item in
    select c.id, c.name, c.weight, c.required, c.min_score, i.score, i.manual_score, i.reviewed_score
    from public.destaque_criterios c
    left join public.destaque_avaliacao_itens i
      on i.evaluation_id = p_evaluation_id and i.criterion_id = c.id
    where c.active = true
  loop
    v_count := v_count + 1;
    -- Nota usada: revisada > manual (gestor) > IA.
    v_score := coalesce(v_item.reviewed_score, v_item.manual_score, v_item.score);
    if v_score is null then
      v_missing := array_append(v_missing, v_item.name);
    else
      v_scored := v_scored + 1;
      v_total := v_total + v_score;
      if v_item.required and v_score < coalesce(v_item.min_score, 0) then
        v_below := array_append(v_below, v_item.name);
      end if;
    end if;
  end loop;

  v_complete := v_count > 0 and v_scored = v_count;
  v_eligible := v_complete and cardinality(v_below) = 0;
  v_reason := nullif(concat_ws(' ',
    case when cardinality(v_missing) > 0 then 'Faltam pontuar: ' || array_to_string(v_missing, ', ') || '.' end,
    case when cardinality(v_below) > 0 then 'Critérios abaixo da nota mínima: ' || array_to_string(v_below, ', ') || '.' end
  ), '');

  -- A pontuação final soma TUDO que já foi pontuado (IA + gestor), mesmo que a avaliação ainda esteja parcial.
  update public.destaque_avaliacoes
  set final_score = case when v_scored > 0 then round(v_total, 2) else null end,
      eligible = v_eligible,
      ineligibility_reason = v_reason,
      status = case when v_complete then 'validada' else 'em_avaliacao' end,
      updated_at = now()
  where id = p_evaluation_id
  returning * into v_eval;

  return v_eval.final_score;
end;
$$;
revoke all on function public._recalc_destaque_evaluation(uuid) from public, anon, authenticated;

-- Função pública usada pelo sistema (frontend e Edge Functions).
create function public.recalculate_destaque_evaluation(p_evaluation_id uuid)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role'
     and not (public.has_permission('destaques','edit') or public.has_permission('destaques','delete')) then
    raise exception 'Sem permissão para consolidar avaliação.';
  end if;
  return public._recalc_destaque_evaluation(p_evaluation_id);
end;
$$;
grant execute on function public.recalculate_destaque_evaluation(uuid) to authenticated, service_role;

-- 2) RANKING: soma das pontuações da IA e do gestor, calculada direto dos itens ----------
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
  case when s.scored_criteria > 0 then round(s.points, 2) else null end as final_score,
  s.max_points,
  s.scored_criteria,
  s.total_criteria,
  round(s.ai_points, 2) as ai_points,
  round(s.manual_points, 2) as manual_points,
  (s.total_criteria > 0 and s.scored_criteria = s.total_criteria) as complete,
  da.eligible,
  da.ineligibility_reason,
  da.status,
  coalesce(att.atendimentos_analisados, 0)::integer as atendimentos_analisados,
  rank() over (
    partition by dc.period_key
    order by (case when s.scored_criteria > 0 then s.points end) desc nulls last
  ) as position
from public.destaque_avaliacoes da
join public.destaque_ciclos dc on dc.id = da.cycle_id
join public.destaque_colaboradores col on col.id = da.employee_id
cross join lateral (
  select
    count(*) filter (where v.val is not null) as scored_criteria,
    count(*) as total_criteria,
    coalesce(sum(c.weight), 0) as max_points,
    coalesce(sum(v.val), 0) as points,
    coalesce(sum(v.val) filter (where i.reviewed_score is null and i.manual_score is null), 0) as ai_points,
    coalesce(sum(v.val) filter (where i.reviewed_score is not null or i.manual_score is not null), 0) as manual_points
  from public.destaque_criterios c
  left join public.destaque_avaliacao_itens i
    on i.evaluation_id = da.id and i.criterion_id = c.id
  cross join lateral (select coalesce(i.reviewed_score, i.manual_score, i.score) as val) v
  where c.active = true
) s
left join (
  select cycle_id, employee_id, count(*) filter (where status = 'analisado' and evaluation_deleted_at is null) as atendimentos_analisados
  from public.destaque_atendimentos
  group by cycle_id, employee_id
) att on att.cycle_id = da.cycle_id and att.employee_id = da.employee_id;

grant select on public.vw_destaque_ranking_mensal to authenticated;

-- 3) Recalcula as avaliações existentes com a regra nova (somente leitura de itens; atualiza total/status).
select public._recalc_destaque_evaluation(id) from public.destaque_avaliacoes;

commit;
notify pgrst, 'reload schema';

-- Conferência: pontuação de cada colaborador no ranking.
select period_key, position, full_name, final_score, max_points, ai_points, manual_points, scored_criteria, total_criteria
from public.vw_destaque_ranking_mensal
order by period_key desc, position;
