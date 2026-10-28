-- ELO | Módulo Relatórios V0.14.0
-- Execute no SQL Editor do Supabase. Seguro para rodar mais de uma vez.

create table if not exists public.relatorio_observacoes (
  id uuid primary key default gen_random_uuid(),
  obs_date date not null default current_date,
  category text not null default 'Geral',
  title text not null,
  content text,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_relatorio_obs_date on public.relatorio_observacoes(obs_date);
create index if not exists idx_relatorio_obs_category on public.relatorio_observacoes(category);

create table if not exists public.relatorios (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('semanal','mensal','personalizado')),
  title text not null,
  period_start date not null,
  period_end date not null,
  observation_count integer not null default 0,
  content jsonb not null default '{}'::jsonb,
  generated_by_ai boolean not null default true,
  model text,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  check (period_end >= period_start)
);
create index if not exists idx_relatorios_period on public.relatorios(period_start, period_end);
create index if not exists idx_relatorios_created on public.relatorios(created_at desc);

drop trigger if exists relatorio_obs_set_updated_at on public.relatorio_observacoes;
create trigger relatorio_obs_set_updated_at
before update on public.relatorio_observacoes
for each row execute function public.set_updated_at();

alter table public.relatorio_observacoes enable row level security;
alter table public.relatorios enable row level security;

-- Observações
drop policy if exists "relatorios view obs" on public.relatorio_observacoes;
create policy "relatorios view obs" on public.relatorio_observacoes for select
  using (public.has_permission('relatorios','view'));
drop policy if exists "relatorios create obs" on public.relatorio_observacoes;
create policy "relatorios create obs" on public.relatorio_observacoes for insert
  with check (public.has_permission('relatorios','create') and created_by = auth.uid());
drop policy if exists "relatorios edit obs" on public.relatorio_observacoes;
create policy "relatorios edit obs" on public.relatorio_observacoes for update
  using (public.has_permission('relatorios','edit')) with check (public.has_permission('relatorios','edit'));
drop policy if exists "relatorios delete obs" on public.relatorio_observacoes;
create policy "relatorios delete obs" on public.relatorio_observacoes for delete
  using (public.has_permission('relatorios','delete'));

-- Relatórios gerados (inseridos pela Edge Function; o usuário só lê e exclui)
drop policy if exists "relatorios view reports" on public.relatorios;
create policy "relatorios view reports" on public.relatorios for select
  using (public.has_permission('relatorios','view'));
drop policy if exists "relatorios delete reports" on public.relatorios;
create policy "relatorios delete reports" on public.relatorios for delete
  using (public.has_permission('relatorios','delete'));

grant select, insert, update, delete on public.relatorio_observacoes to authenticated;
grant select, delete on public.relatorios to authenticated;

notify pgrst, 'reload schema';
