-- ELO V0.11 — Avaliação mensal por colaborador
-- IA consolida critérios de fonte IA; gestor registra os demais critérios manualmente.

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

create index if not exists idx_destaque_avaliacao_itens_evaluation
  on public.destaque_avaliacao_itens(evaluation_id);

create index if not exists idx_destaque_avaliacoes_employee_cycle
  on public.destaque_avaliacoes(employee_id, cycle_id);

-- Garante que o vencedor do ciclo também use o cadastro da equipe avaliada.
alter table public.destaque_ciclos
  drop constraint if exists destaque_ciclos_winner_id_fkey;

alter table public.destaque_ciclos
  add constraint destaque_ciclos_winner_id_fkey
  foreign key (winner_id)
  references public.destaque_colaboradores(id)
  on delete set null;

-- Diagnóstico opcional.
select
  ai.column_name,
  ai.data_type
from information_schema.columns ai
where ai.table_schema = 'public'
  and ai.table_name = 'destaque_avaliacao_itens'
  and ai.column_name in ('score','manual_score','manual_justification','manual_by','manual_at','ai_samples','ai_updated_at')
order by ai.ordinal_position;
