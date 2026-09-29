-- ELO | Módulo Solicitações V0.7
create extension if not exists "pgcrypto";

create table if not exists public.solicitacoes (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  category text not null default 'Operacional',
  priority text not null default 'media' check (priority in ('baixa','media','alta','urgente')),
  status text not null default 'nova' check (status in ('nova','em_analise','aprovada','recusada','demanda_gerada')),
  solicitante_id uuid not null references public.profiles(id) on delete restrict,
  responsavel_id uuid references public.profiles(id) on delete set null,
  prazo_desejado date,
  observacoes text,
  demanda_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.solicitacoes add column if not exists title text;
alter table public.solicitacoes add column if not exists description text;
alter table public.solicitacoes add column if not exists category text default 'Operacional';
alter table public.solicitacoes add column if not exists priority text default 'media';
alter table public.solicitacoes add column if not exists status text default 'nova';
alter table public.solicitacoes add column if not exists solicitante_id uuid;
alter table public.solicitacoes add column if not exists responsavel_id uuid;
alter table public.solicitacoes add column if not exists prazo_desejado date;
alter table public.solicitacoes add column if not exists observacoes text;
alter table public.solicitacoes add column if not exists demanda_id uuid;
alter table public.solicitacoes add column if not exists created_at timestamptz default now();
alter table public.solicitacoes add column if not exists updated_at timestamptz default now();

create index if not exists solicitacoes_status_idx on public.solicitacoes(status);
create index if not exists solicitacoes_priority_idx on public.solicitacoes(priority);
create index if not exists solicitacoes_solicitante_idx on public.solicitacoes(solicitante_id);
create index if not exists solicitacoes_responsavel_idx on public.solicitacoes(responsavel_id);

alter table public.solicitacoes enable row level security;
drop policy if exists "authorized users can view solicitacoes" on public.solicitacoes;
create policy "authorized users can view solicitacoes" on public.solicitacoes for select using (public.has_permission('solicitacoes','view'));
drop policy if exists "authorized users can create solicitacoes" on public.solicitacoes;
create policy "authorized users can create solicitacoes" on public.solicitacoes for insert with check (public.has_permission('solicitacoes','create') and solicitante_id = auth.uid());
drop policy if exists "authorized users can update solicitacoes" on public.solicitacoes;
create policy "authorized users can update solicitacoes" on public.solicitacoes for update using (public.has_permission('solicitacoes','edit')) with check (public.has_permission('solicitacoes','edit'));
drop policy if exists "authorized users can delete solicitacoes" on public.solicitacoes;
create policy "authorized users can delete solicitacoes" on public.solicitacoes for delete using (public.has_permission('solicitacoes','delete'));
grant select, insert, update, delete on public.solicitacoes to authenticated;

-- Relação opcional com Demandas já existentes.
do $$ begin
  if to_regclass('public.demandas') is not null then
    alter table public.demandas add column if not exists solicitacao_id uuid;
    create index if not exists demandas_solicitacao_idx on public.demandas(solicitacao_id);
    begin
      alter table public.demandas add constraint demandas_solicitacao_fk foreign key (solicitacao_id) references public.solicitacoes(id) on delete set null;
    exception when duplicate_object then null; end;
  end if;
end $$;
