-- ELO — Motor de Avaliação / Destaque do Mês V0.8
create extension if not exists pgcrypto;

create table if not exists public.destaque_criterios (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  weight numeric(5,2) not null default 10 check (weight > 0 and weight <= 100),
  source text not null default 'ia' check (source in ('ia','sistema','manual')),
  min_score numeric(4,2) not null default 0 check (min_score >= 0 and min_score <= 10),
  required boolean not null default true,
  active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.destaque_ciclos (
  id uuid primary key default gen_random_uuid(),
  period_key text not null unique,
  period_start date not null,
  period_end date not null,
  team_name text not null default 'Equipe',
  status text not null default 'em_avaliacao' check (status in ('em_avaliacao','em_validacao','finalizado','cancelado')),
  winner_id uuid references public.profiles(id) on delete set null,
  winner_score numeric(6,2),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.destaque_avaliacoes (
  id uuid primary key default gen_random_uuid(),
  cycle_id uuid not null references public.destaque_ciclos(id) on delete cascade,
  employee_id uuid not null references public.profiles(id) on delete restrict,
  final_score numeric(6,2),
  eligible boolean not null default true,
  ineligibility_reason text,
  status text not null default 'em_avaliacao' check (status in ('em_avaliacao','validada','finalizada')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(cycle_id, employee_id)
);

create table if not exists public.destaque_avaliacao_itens (
  id uuid primary key default gen_random_uuid(),
  evaluation_id uuid not null references public.destaque_avaliacoes(id) on delete cascade,
  criterion_id uuid references public.destaque_criterios(id) on delete set null,
  criterion_name_snapshot text not null,
  weight_snapshot numeric(5,2) not null,
  source_snapshot text not null,
  score numeric(4,2) check (score >= 0 and score <= 10),
  justification text,
  evidence jsonb not null default '[]'::jsonb,
  reviewed_score numeric(4,2) check (reviewed_score >= 0 and reviewed_score <= 10),
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  unique(evaluation_id, criterion_id)
);

create table if not exists public.destaque_atendimentos (
  id uuid primary key default gen_random_uuid(),
  cycle_id uuid not null references public.destaque_ciclos(id) on delete cascade,
  employee_id uuid not null references public.profiles(id) on delete restrict,
  storage_path text not null,
  file_name text not null,
  status text not null default 'aguardando_analise' check (status in ('aguardando_analise','analisando','analisado','erro','revisado')),
  analysis jsonb,
  analyzed_at timestamptz,
  error_message text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_destaque_criterios_active on public.destaque_criterios(active);
create index if not exists idx_destaque_avaliacoes_cycle on public.destaque_avaliacoes(cycle_id);
create index if not exists idx_destaque_atendimentos_cycle on public.destaque_atendimentos(cycle_id);
create index if not exists idx_destaque_atendimentos_employee on public.destaque_atendimentos(employee_id);

alter table public.destaque_criterios enable row level security;
alter table public.destaque_ciclos enable row level security;
alter table public.destaque_avaliacoes enable row level security;
alter table public.destaque_avaliacao_itens enable row level security;
alter table public.destaque_atendimentos enable row level security;

drop policy if exists destaque_criterios_select on public.destaque_criterios;
create policy destaque_criterios_select on public.destaque_criterios for select to authenticated using (public.has_permission('destaques','view'));
drop policy if exists destaque_criterios_insert on public.destaque_criterios;
create policy destaque_criterios_insert on public.destaque_criterios for insert to authenticated with check (public.has_permission('destaques','create'));
drop policy if exists destaque_criterios_update on public.destaque_criterios;
create policy destaque_criterios_update on public.destaque_criterios for update to authenticated using (public.has_permission('destaques','edit')) with check (public.has_permission('destaques','edit'));
drop policy if exists destaque_criterios_delete on public.destaque_criterios;
create policy destaque_criterios_delete on public.destaque_criterios for delete to authenticated using (public.has_permission('destaques','delete'));

drop policy if exists destaque_ciclos_select on public.destaque_ciclos;
create policy destaque_ciclos_select on public.destaque_ciclos for select to authenticated using (public.has_permission('destaques','view'));
drop policy if exists destaque_ciclos_insert on public.destaque_ciclos;
create policy destaque_ciclos_insert on public.destaque_ciclos for insert to authenticated with check (public.has_permission('destaques','create'));
drop policy if exists destaque_ciclos_update on public.destaque_ciclos;
create policy destaque_ciclos_update on public.destaque_ciclos for update to authenticated using (public.has_permission('destaques','edit')) with check (public.has_permission('destaques','edit'));

drop policy if exists destaque_avaliacoes_select on public.destaque_avaliacoes;
create policy destaque_avaliacoes_select on public.destaque_avaliacoes for select to authenticated using (public.has_permission('destaques','view'));
drop policy if exists destaque_avaliacoes_write on public.destaque_avaliacoes;
create policy destaque_avaliacoes_write on public.destaque_avaliacoes for all to authenticated using (public.has_permission('destaques','edit')) with check (public.has_permission('destaques','edit'));

drop policy if exists destaque_itens_select on public.destaque_avaliacao_itens;
create policy destaque_itens_select on public.destaque_avaliacao_itens for select to authenticated using (public.has_permission('destaques','view'));
drop policy if exists destaque_itens_write on public.destaque_avaliacao_itens;
create policy destaque_itens_write on public.destaque_avaliacao_itens for all to authenticated using (public.has_permission('destaques','edit')) with check (public.has_permission('destaques','edit'));

drop policy if exists destaque_atendimentos_select on public.destaque_atendimentos;
create policy destaque_atendimentos_select on public.destaque_atendimentos for select to authenticated using (public.has_permission('destaques','view'));
drop policy if exists destaque_atendimentos_insert on public.destaque_atendimentos;
create policy destaque_atendimentos_insert on public.destaque_atendimentos for insert to authenticated with check (public.has_permission('destaques','create') and created_by = auth.uid());
drop policy if exists destaque_atendimentos_update on public.destaque_atendimentos;
create policy destaque_atendimentos_update on public.destaque_atendimentos for update to authenticated using (public.has_permission('destaques','edit')) with check (public.has_permission('destaques','edit'));
drop policy if exists destaque_atendimentos_delete on public.destaque_atendimentos;
create policy destaque_atendimentos_delete on public.destaque_atendimentos for delete to authenticated using (public.has_permission('destaques','delete'));

grant select, insert, update, delete on public.destaque_criterios to authenticated;
grant select, insert, update, delete on public.destaque_ciclos to authenticated;
grant select, insert, update, delete on public.destaque_avaliacoes to authenticated;
grant select, insert, update, delete on public.destaque_avaliacao_itens to authenticated;
grant select, insert, update, delete on public.destaque_atendimentos to authenticated;

-- Bucket privado para PDFs de atendimento.
insert into storage.buckets (id, name, public)
values ('destaque-atendimentos','destaque-atendimentos',false)
on conflict (id) do update set public=false;

drop policy if exists destaque_storage_select on storage.objects;
create policy destaque_storage_select on storage.objects for select to authenticated
using (bucket_id='destaque-atendimentos' and public.has_permission('destaques','view'));
drop policy if exists destaque_storage_insert on storage.objects;
create policy destaque_storage_insert on storage.objects for insert to authenticated
with check (bucket_id='destaque-atendimentos' and public.has_permission('destaques','create') and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists destaque_storage_delete on storage.objects;
create policy destaque_storage_delete on storage.objects for delete to authenticated
using (bucket_id='destaque-atendimentos' and public.has_permission('destaques','delete'));

-- ELO V0.8.2 — Equipe avaliada independente dos usuários do ELO
create table if not exists public.destaque_colaboradores (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  sector text not null default 'Atendimento',
  status text not null default 'ativo' check (status in ('ativo','inativo')),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Migração de segurança: colaboradores que já estavam cadastrados como usuários
-- são copiados para a equipe avaliada usando o mesmo UUID. Novos colaboradores
-- podem ser cadastrados sem possuir conta de acesso ao ELO.
insert into public.destaque_colaboradores (id, full_name, sector, status, created_by)
select p.id, p.full_name, coalesce(nullif(p.job_title,''),'Atendimento'), 'ativo', p.id
from public.profiles p
where not exists (select 1 from public.destaque_colaboradores d where d.id=p.id);

-- As avaliações e os PDFs passam a apontar para a equipe avaliada.
alter table public.destaque_avaliacoes drop constraint if exists destaque_avaliacoes_employee_id_fkey;
alter table public.destaque_atendimentos drop constraint if exists destaque_atendimentos_employee_id_fkey;
alter table public.destaque_avaliacoes
  add constraint destaque_avaliacoes_employee_id_fkey
  foreign key (employee_id) references public.destaque_colaboradores(id) on delete restrict;
alter table public.destaque_atendimentos
  add constraint destaque_atendimentos_employee_id_fkey
  foreign key (employee_id) references public.destaque_colaboradores(id) on delete restrict;

create index if not exists idx_destaque_colaboradores_status on public.destaque_colaboradores(status);
create index if not exists idx_destaque_colaboradores_name on public.destaque_colaboradores(full_name);

alter table public.destaque_colaboradores enable row level security;
drop policy if exists destaque_colaboradores_select on public.destaque_colaboradores;
create policy destaque_colaboradores_select on public.destaque_colaboradores
for select to authenticated using (public.has_permission('destaques','view'));
drop policy if exists destaque_colaboradores_insert on public.destaque_colaboradores;
create policy destaque_colaboradores_insert on public.destaque_colaboradores
for insert to authenticated with check (public.has_permission('destaques','create'));
drop policy if exists destaque_colaboradores_update on public.destaque_colaboradores;
create policy destaque_colaboradores_update on public.destaque_colaboradores
for update to authenticated using (public.has_permission('destaques','edit')) with check (public.has_permission('destaques','edit'));
drop policy if exists destaque_colaboradores_delete on public.destaque_colaboradores;
create policy destaque_colaboradores_delete on public.destaque_colaboradores
for delete to authenticated using (public.has_permission('destaques','delete'));

grant select, insert, update, delete on public.destaque_colaboradores to authenticated;
