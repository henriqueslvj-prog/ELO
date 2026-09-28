-- ELO | Módulo Demandas V0.6
-- Execute depois do schema.sql V0.5

create extension if not exists "pgcrypto";

create table if not exists public.demandas (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  category text not null default 'Operacional',
  priority text not null default 'media' check (priority in ('baixa','media','alta','urgente')),
  status text not null default 'nova' check (status in ('nova','em_analise','em_andamento','aguardando','concluida','cancelada')),
  responsible_id uuid references public.profiles(id) on delete set null,
  created_by uuid not null references public.profiles(id) on delete restrict,
  due_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists demandas_status_idx on public.demandas(status);
create index if not exists demandas_priority_idx on public.demandas(priority);
create index if not exists demandas_responsible_idx on public.demandas(responsible_id);
create index if not exists demandas_due_date_idx on public.demandas(due_date);
create index if not exists demandas_created_by_idx on public.demandas(created_by);

 drop trigger if exists demandas_set_updated_at on public.demandas;
 create trigger demandas_set_updated_at
 before update on public.demandas
 for each row execute function public.set_updated_at();

alter table public.demandas enable row level security;

drop policy if exists "active users can view demandas" on public.demandas;
create policy "active users can view demandas"
on public.demandas for select
using (public.has_permission('demandas','view'));

drop policy if exists "authorized users can create demandas" on public.demandas;
create policy "authorized users can create demandas"
on public.demandas for insert
with check (public.has_permission('demandas','create') and created_by = auth.uid());

drop policy if exists "authorized users can update demandas" on public.demandas;
create policy "authorized users can update demandas"
on public.demandas for update
using (public.has_permission('demandas','edit'))
with check (public.has_permission('demandas','edit'));

drop policy if exists "authorized users can delete demandas" on public.demandas;
create policy "authorized users can delete demandas"
on public.demandas for delete
using (public.has_permission('demandas','delete'));

grant select, insert, update, delete on public.demandas to authenticated;

-- Lista segura de membros ativos para exibição em módulos operacionais.
-- Não expõe e-mail ou telefone.
create or replace function public.get_active_team_members()
returns table (id uuid, full_name text, role text)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.full_name, p.role
  from public.profiles p
  where p.status = 'ativo'
    and public.is_active_user();
$$;

grant execute on function public.get_active_team_members() to authenticated;
