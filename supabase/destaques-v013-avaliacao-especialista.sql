-- ELO V0.13 — Avaliação especialista de atendimento (0 a 15)
-- 5 critérios de IA x 3 pontos. A nota mensal é a média ponderada dos critérios, escalada para 0–15.
-- Não apaga avaliações existentes; apenas desativa critérios antigos de IA.

begin;

-- 1) A nova escala é controlada pelo motor em 0–3 por critério.
-- Mantemos as constraints históricas 0–10 do banco para não invalidar avaliações antigas.
-- Os cinco novos critérios e a nova função passam a trabalhar exclusivamente em 0–3.

-- 2) Arquiva os critérios antigos de IA para impedir que continuem interferindo na nota.
update public.destaque_criterios
set active = false,
    updated_at = now()
where source = 'ia'
  and active = true;

-- As avaliações antigas ligadas aos critérios de IA arquivados deixam de participar da nova escala.
update public.destaque_avaliacao_itens i
set score = null,
    reviewed_score = null,
    ai_samples = 0,
    ai_updated_at = null
where i.criterion_id in (
  select id from public.destaque_criterios where source = 'ia' and active = false
);

-- 3) Cria o novo conjunto oficial de critérios.
insert into public.destaque_criterios
  (name, description, weight, source, min_score, required, active)
select * from (values
  (
    'Acolhimento e cordialidade',
    'Avalia se o cliente foi tratado com respeito, educação, cordialidade e acolhimento. Diferencie objetividade de frieza, secura ou grosseria. Não use emojis como prova isolada de cordialidade.',
    20::numeric, 'ia', 0::numeric, true, true
  ),
  (
    'Tempo e responsividade',
    'Avalia o tempo de resposta do atendente humano e a capacidade de dar retorno ao cliente. Considere horários e contexto do atendimento. Não penalize bot, fila, transferência automática ou atraso causado por terceiros.',
    20::numeric, 'ia', 0::numeric, true, true
  ),
  (
    'Clareza e qualidade da resposta',
    'Avalia se a resposta foi clara, objetiva, correta, completa e adequada à necessidade apresentada pelo cliente.',
    20::numeric, 'ia', 0::numeric, true, true
  ),
  (
    'Resolução da solicitação',
    'Avalia se a necessidade do cliente foi efetivamente resolvida, parcialmente resolvida, ficou pendente ou não pôde ser concluída. Não considere uma intenção como confirmação de resolução.',
    20::numeric, 'ia', 0::numeric, true, true
  ),
  (
    'Condução e profissionalismo',
    'Avalia compreensão da necessidade, organização da condução, domínio do processo, aderência ao roteiro aplicável, encaminhamentos e fechamento profissional.',
    20::numeric, 'ia', 0::numeric, true, true
  )
) as v(name, description, weight, source, min_score, required, active)
where not exists (
  select 1 from public.destaque_criterios c where c.name = v.name
);

-- 4) Vincula o roteiro oficial aos cinco critérios, caso ele exista.
insert into public.destaque_criterio_referencias (criterion_id, reference_id, priority)
select c.id, r.id, 1
from public.destaque_criterios c
cross join public.destaque_referencias_ia r
where c.source = 'ia'
  and c.active = true
  and r.slug = 'system-saude-roteiro-atendimento'
  and r.active = true
on conflict (criterion_id, reference_id) do nothing;

-- 5) Consolida a avaliação mensal em 0–15.
-- Cada critério vale de 0 a 3. Os pesos continuam configuráveis e a média ponderada é escalada para 15.
create or replace function public.recalculate_destaque_evaluation(p_evaluation_id uuid)
returns public.destaque_avaliacoes
language plpgsql
security definer
set search_path = public
as $$
declare
  v_eval public.destaque_avaliacoes;
  v_weighted numeric := 0;
  v_total_weight numeric := 0;
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
    v_total_weight := v_total_weight + coalesce(v_item.weight, 0);
    v_score := coalesce(v_item.reviewed_score, v_item.manual_score, v_item.score);

    if v_score is null then
      v_complete := false;
      if v_item.required then
        v_missing_required := array_append(v_missing_required, v_item.name);
      end if;
    else
      v_weighted := v_weighted + (v_score * coalesce(v_item.weight, 0));

      if v_item.required and v_score < coalesce(v_item.min_score, 0) then
        v_eligible := false;
        v_below_minimum := array_append(v_below_minimum, v_item.name);
      end if;
    end if;
  end loop;

  if v_total_weight <= 0 then
    v_complete := false;
    v_eligible := false;
  end if;

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
        else null end,
      case when v_total_weight <= 0
        then 'Não há peso válido configurado.'
        else null end
    );
  else
    v_reason := null;
  end if;

  update public.destaque_avaliacoes
  set
    final_score = case when v_complete and v_total_weight > 0 then round(((v_weighted / v_total_weight) * 5), 2) else null end,
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

-- 6) Histórico de exclusão lógica das avaliações de PDF.
alter table public.destaque_atendimentos
  add column if not exists evaluation_deleted_at timestamptz,
  add column if not exists evaluation_deleted_by uuid references public.profiles(id) on delete set null;

create index if not exists idx_destaque_atendimentos_active_evaluation
  on public.destaque_atendimentos(employee_id, period_key)
  where evaluation_deleted_at is null;

commit;

-- Conferência dos cinco critérios ativos:
select id, name, weight, source, min_score, required, active
from public.destaque_criterios
where source = 'ia'
order by created_at;
