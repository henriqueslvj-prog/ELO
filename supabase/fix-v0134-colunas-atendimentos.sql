-- Garante as colunas usadas pela Edge Function analyze-attendance (seguro rodar mais de uma vez).
alter table public.destaque_atendimentos
  add column if not exists attendance_date date,
  add column if not exists period_key text,
  add column if not exists evaluation_deleted_at timestamptz,
  add column if not exists evaluation_deleted_by uuid references public.profiles(id) on delete set null;

create index if not exists idx_destaque_atendimentos_active_evaluation
  on public.destaque_atendimentos(employee_id, period_key)
  where evaluation_deleted_at is null;

-- Pede ao PostgREST para recarregar o schema.
notify pgrst, 'reload schema';

-- Conferência:
select column_name from information_schema.columns
where table_schema='public' and table_name='destaque_atendimentos'
order by ordinal_position;
