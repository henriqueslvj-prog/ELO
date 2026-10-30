-- ELO V0.19.1 | Pontuação da IA (Qualidade e Script) passa a compor a pontuação final
-- Pré-requisito: destaques-v0190-ranking-todas-pontuacoes.sql já executado.
-- Execute no SQL Editor do Supabase. Seguro para repetir. Não apaga avaliações nem notas do gestor.
begin;

do $$ begin
  if to_regprocedure('public._recalc_destaque_evaluation(uuid)') is null then
    raise exception 'Execute antes o arquivo destaques-v0190-ranking-todas-pontuacoes.sql.';
  end if;
end $$;

-- 1) Consolida as médias de IA a partir dos atendimentos analisados e grava como itens de pontuação.
--    Qualidade: média (0–100) convertida para o peso do critério (ex.: 90,4 -> 13,6 de 15).
--    Script e Processos: média (0–10) convertida para o peso do critério (ex.: 8,5 -> 8,5 de 10).
create or replace function public._sync_destaque_ai_scores(p_evaluation_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_eval public.destaque_avaliacoes;
  v_q numeric; v_s numeric; v_n integer;
  c record;
  v_is_quality boolean; v_avg numeric; v_scale numeric; v_points numeric;
begin
  select * into v_eval from public.destaque_avaliacoes where id = p_evaluation_id;
  if not found then return; end if;

  select round(avg(t.q), 1), round(avg(t.s), 1), count(*)
    into v_q, v_s, v_n
  from (
    select
      case when jsonb_typeof(a.analysis->'quality_score_100') = 'number' then (a.analysis->>'quality_score_100')::numeric
           when jsonb_typeof(a.analysis->'quality_score_100') = 'string' and (a.analysis->>'quality_score_100') ~ '^[0-9]+(\.[0-9]+)?$' then (a.analysis->>'quality_score_100')::numeric end as q,
      case when jsonb_typeof(a.analysis->'script_score_10') = 'number' then (a.analysis->>'script_score_10')::numeric
           when jsonb_typeof(a.analysis->'script_score_10') = 'string' and (a.analysis->>'script_score_10') ~ '^[0-9]+(\.[0-9]+)?$' then (a.analysis->>'script_score_10')::numeric end as s
    from public.destaque_atendimentos a
    where a.cycle_id = v_eval.cycle_id
      and a.employee_id = v_eval.employee_id
      and a.status = 'analisado'
      and a.evaluation_deleted_at is null
      and a.analysis is not null
  ) t
  where t.q between 0 and 100 and t.s between 0 and 10;

  update public.destaque_avaliacoes
  set quality_avg_100 = v_q,
      quality_points_15 = case when v_q is null then null else round(v_q * 0.15)::integer end,
      script_avg_10 = v_s,
      ai_attendance_count = coalesce(v_n, 0),
      updated_at = now()
  where id = p_evaluation_id;

  for c in
    select id, name, weight, source from public.destaque_criterios
    where active = true and (
      lower(name) like '%qualidade do atendimento%' or
      lower(name) like '%utilização do script%' or lower(name) like '%utilizacao do script%' or lower(name) like '%script e processos%'
    )
  loop
    v_is_quality := lower(c.name) like '%qualidade do atendimento%';
    v_avg := case when v_is_quality then v_q else v_s end;
    v_scale := case when v_is_quality then 100 else 10 end;

    if coalesce(v_n, 0) = 0 or v_avg is null then
      -- Sem atendimentos válidos: remove só a parte da IA (preserva nota do gestor, se houver).
      update public.destaque_avaliacao_itens
        set score = null, ai_samples = 0, ai_updated_at = now()
        where evaluation_id = p_evaluation_id and criterion_id = c.id;
      delete from public.destaque_avaliacao_itens
        where evaluation_id = p_evaluation_id and criterion_id = c.id
          and score is null and manual_score is null and reviewed_score is null;
    else
      v_points := least(coalesce(c.weight, 0), round(v_avg / v_scale * coalesce(c.weight, 0), 1));
      insert into public.destaque_avaliacao_itens
        (evaluation_id, criterion_id, criterion_name_snapshot, weight_snapshot, source_snapshot,
         score, justification, evidence, ai_samples, ai_updated_at)
      values
        (p_evaluation_id, c.id, c.name, coalesce(c.weight, 0), c.source,
         v_points,
         'Média consolidada automaticamente a partir de ' || v_n || ' atendimento(s) analisado(s) no período.',
         jsonb_build_object('samples', v_n, 'average', v_avg, 'scale', v_scale),
         v_n, now())
      on conflict (evaluation_id, criterion_id) do update
        set score = excluded.score,
            justification = excluded.justification,
            evidence = excluded.evidence,
            ai_samples = excluded.ai_samples,
            ai_updated_at = now(),
            criterion_name_snapshot = excluded.criterion_name_snapshot,
            weight_snapshot = excluded.weight_snapshot,
            source_snapshot = excluded.source_snapshot;
    end if;
  end loop;
end;
$$;
revoke all on function public._sync_destaque_ai_scores(uuid) from public, anon, authenticated;
grant execute on function public._sync_destaque_ai_scores(uuid) to service_role;

-- 2) O recálculo agora sempre atualiza antes as notas da IA (após analisar, excluir avaliação ou salvar notas do gestor).
create or replace function public.recalculate_destaque_evaluation(p_evaluation_id uuid)
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
  perform public._sync_destaque_ai_scores(p_evaluation_id);
  return public._recalc_destaque_evaluation(p_evaluation_id);
end;
$$;
grant execute on function public.recalculate_destaque_evaluation(uuid) to authenticated, service_role;

-- 3) Corrige as avaliações já existentes (inclui as 5 análises da Biancka e as 9 da Ana).
do $$
declare r record;
begin
  for r in select id from public.destaque_avaliacoes loop
    perform public._sync_destaque_ai_scores(r.id);
    perform public._recalc_destaque_evaluation(r.id);
  end loop;
end $$;

commit;
notify pgrst, 'reload schema';

-- Conferência: IA + Gestor = total (máximo 100).
select period_key, position, full_name, final_score, max_points, ai_points, manual_points, scored_criteria, total_criteria
from public.vw_destaque_ranking_mensal
order by period_key desc, position;
