-- ELO V0.13.6 — Escala oficial de 100 pontos
-- Execute UMA ÚNICA VEZ no SQL Editor do Supabase. Não apaga avaliações.
begin;

-- Sincroniza os pesos com o máximo de pontos de cada critério oficial.
update public.destaque_criterios set weight = case
  when lower(name) like '%produtividade%' then 25
  when lower(name) like '%experiência do cliente%' or lower(name) like '%experiencia do cliente%' then 20
  when lower(name) like '%qualidade do atendimento%' then 15
  when lower(name) like '%tempo de espera%' or lower(name) like '%agilidade%' or lower(name) like '%tempo de atendimento%' then 10
  when lower(name) like '%utilização do script%' or lower(name) like '%utilizacao do script%' or lower(name) like '%script e processos%' then 10
  when lower(name) like '%pontualidade%' or lower(name) like '%assiduidade%' then 10
  when lower(name) like '%comportamento%' or lower(name) like '%trabalho em equipe%' then 5
  when lower(name) like '%evolução individual%' or lower(name) like '%evolucao individual%' then 5
  else weight end,
  updated_at = now()
where active = true;

-- Os dois critérios automatizados são os únicos de origem IA.
update public.destaque_criterios
set source = case
  when lower(name) like '%qualidade do atendimento%' then 'ia'
  when lower(name) like '%utilização do script%' or lower(name) like '%utilizacao do script%' or lower(name) like '%script e processos%' then 'ia'
  else 'manual'
end,
updated_at = now()
where active = true
  and (
    lower(name) like '%produtividade%' or
    lower(name) like '%experiência do cliente%' or lower(name) like '%experiencia do cliente%' or
    lower(name) like '%qualidade do atendimento%' or
    lower(name) like '%tempo de espera%' or lower(name) like '%agilidade%' or lower(name) like '%tempo de atendimento%' or
    lower(name) like '%utilização do script%' or lower(name) like '%utilizacao do script%' or lower(name) like '%script e processos%' or
    lower(name) like '%pontualidade%' or lower(name) like '%assiduidade%' or
    lower(name) like '%comportamento%' or lower(name) like '%trabalho em equipe%' or
    lower(name) like '%evolução individual%' or lower(name) like '%evolucao individual%'
  );

alter table public.destaque_avaliacao_itens
  drop constraint if exists destaque_avaliacao_itens_score_check;
alter table public.destaque_avaliacao_itens
  add constraint destaque_avaliacao_itens_score_check
  check (score is null or (score >= 0 and score <= 25));

alter table public.destaque_avaliacao_itens
  drop constraint if exists destaque_avaliacao_itens_manual_score_check;
alter table public.destaque_avaliacao_itens
  add constraint destaque_avaliacao_itens_manual_score_check
  check (manual_score is null or (manual_score >= 0 and manual_score <= 25));

-- Converte pontuações históricas da escala 0–3 para a escala oficial proporcional ao máximo do critério.
-- Esta etapa é intencionalmente parte da migração única.
update public.destaque_avaliacao_itens i
set score = round((i.score / 3.0) * c.weight, 1)
from public.destaque_criterios c
where c.id = i.criterion_id and i.score is not null and i.score <= 3;

update public.destaque_avaliacao_itens i
set manual_score = round((i.manual_score / 3.0) * c.weight, 1)
from public.destaque_criterios c
where c.id = i.criterion_id and i.manual_score is not null and i.manual_score <= 3;

create or replace function public.recalculate_destaque_evaluation(target_evaluation_id uuid)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v_eval public.destaque_avaliacoes;
  v_total numeric := 0;
  v_max_points numeric := 0;
  v_missing_required text[] := '{}';
  v_below_minimum text[] := '{}';
  v_item record;
  v_score numeric;
  v_complete boolean := true;
  v_eligible boolean := true;
  v_reason text;
begin
  if auth.role() <> 'service_role' and not (public.has_permission('destaques','edit') or public.has_permission('destaques','delete')) then
    raise exception 'Sem permissão para consolidar avaliação.';
  end if;

  select * into v_eval from public.destaque_avaliacoes where id = target_evaluation_id;
  if not found then raise exception 'Avaliação mensal não encontrada.'; end if;

  for v_item in
    select c.id,c.name,c.weight,c.required,c.min_score,i.score,i.manual_score,i.reviewed_score
    from public.destaque_criterios c
    left join public.destaque_avaliacao_itens i
      on i.evaluation_id = target_evaluation_id and i.criterion_id = c.id
    where c.active = true
  loop
    v_max_points := v_max_points + coalesce(v_item.weight,0);
    v_score := coalesce(v_item.reviewed_score,v_item.manual_score,v_item.score);
    if v_score is null then
      v_complete := false;
      if v_item.required then v_missing_required := array_append(v_missing_required,v_item.name); end if;
    else
      v_total := v_total + v_score;
      if v_item.required and v_score < coalesce(v_item.min_score,0) then
        v_eligible := false;
        v_below_minimum := array_append(v_below_minimum,v_item.name);
      end if;
    end if;
  end loop;

  if v_max_points <= 0 then v_complete := false; v_eligible := false; end if;
  if not v_complete then v_eligible := false; end if;
  if not v_eligible then
    v_reason := concat_ws(' ',
      case when array_length(v_missing_required,1)>0 then 'Critérios obrigatórios sem nota: '||array_to_string(v_missing_required,', ')||'.' else null end,
      case when array_length(v_below_minimum,1)>0 then 'Critérios abaixo da nota mínima: '||array_to_string(v_below_minimum,', ')||'.' else null end,
      case when v_max_points<=0 then 'Não há pontuação máxima válida configurada.' else null end);
  else v_reason := null;
  end if;

  update public.destaque_avaliacoes
  set final_score = case when v_complete and v_max_points>0 then round(v_total,2) else null end,
      eligible = v_eligible,
      ineligibility_reason = v_reason,
      status = case when v_complete then 'validada' else 'em_avaliacao' end,
      updated_at = now()
  where id = target_evaluation_id
  returning * into v_eval;
  return v_eval.final_score;
end;
$$;

grant execute on function public.recalculate_destaque_evaluation(uuid) to authenticated;
commit;
