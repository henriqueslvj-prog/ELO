-- ELO V0.15.0 | Central de Dados, módulos operacionais e indicadores
-- Migração aditiva: não apaga tabelas, registros, funções ou regras do Destaque do Mês/Relatórios.
-- Revise o SQL antes de executar no projeto Supabase correto.

create extension if not exists pgcrypto;

-- Corrige o identificador sequencial de solicitações existentes sem modificar registros atuais.
-- A tabela real utiliza nomes em português (titulo, descricao, categoria, prioridade).
create sequence if not exists public.solicitacoes_codigo_seq;
select setval(
  'public.solicitacoes_codigo_seq',
  greatest(coalesce((select max(codigo) from public.solicitacoes), 0) + 1, 1),
  false
);
do $$
declare identity_mode text;
begin
  select is_identity into identity_mode
  from information_schema.columns
  where table_schema = 'public' and table_name = 'solicitacoes' and column_name = 'codigo';
  if coalesce(identity_mode, 'NO') = 'NO' then
    execute 'alter table public.solicitacoes alter column codigo set default nextval(''public.solicitacoes_codigo_seq'')';
  end if;
end $$;

-- Demandas: criada apenas se ainda não existir.
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
  solicitacao_id uuid references public.solicitacoes(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists demandas_status_idx on public.demandas(status);
create index if not exists demandas_priority_idx on public.demandas(priority);
create index if not exists demandas_responsible_idx on public.demandas(responsible_id);
create index if not exists demandas_due_date_idx on public.demandas(due_date);

create table if not exists public.ideias (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  impact text not null default 'medio' check (impact in ('baixo','medio','alto')),
  status text not null default 'nova' check (status in ('nova','em_analise','aprovada','em_desenvolvimento','implementada','recusada')),
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.projetos (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  responsible_id uuid references public.profiles(id) on delete set null,
  priority text not null default 'media' check (priority in ('baixa','media','alta','urgente')),
  status text not null default 'planejamento' check (status in ('planejamento','em_andamento','pausado','concluido','cancelado')),
  start_date date,
  due_date date,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.arquivos_registros (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  category text not null default 'Geral',
  file_url text,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.agenda_eventos (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  event_date date not null,
  start_time time,
  end_time time,
  participants text,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.reunioes (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  meeting_date timestamptz not null,
  participants text,
  minutes text,
  status text not null default 'agendada' check (status in ('agendada','realizada','cancelada')),
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Central de dados: uma linha por indicador, data e recorte opcional.
create table if not exists public.indicadores_registros (
  id uuid primary key default gen_random_uuid(),
  metric_date date not null default current_date,
  sector text,
  collaborator_name text,
  indicator_name text not null,
  value numeric not null,
  unit text not null default 'quantidade',
  source text not null default 'manual' check (source in ('manual','csv','integracao')),
  notes text,
  import_batch uuid,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now()
);
create index if not exists indicadores_registros_date_idx on public.indicadores_registros(metric_date desc);
create index if not exists indicadores_registros_name_idx on public.indicadores_registros(indicator_name);
create index if not exists indicadores_registros_batch_idx on public.indicadores_registros(import_batch);

create table if not exists public.indicadores_metas (
  id uuid primary key default gen_random_uuid(),
  indicator_name text not null,
  period_key text not null,
  sector text not null default '',
  target_value numeric not null,
  unit text not null default 'quantidade',
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint indicadores_metas_period_format check (period_key ~ '^\d{4}-\d{2}$')
);
create unique index if not exists indicadores_metas_unique_idx
  on public.indicadores_metas(indicator_name, period_key, sector);

create table if not exists public.indicadores_importacoes (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null unique,
  file_name text not null,
  rows_imported integer not null default 0,
  status text not null default 'concluida',
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now()
);

-- RLS habilitada para todas as novas tabelas operacionais.
do $$
declare t text;
begin
  foreach t in array array['demandas','ideias','projetos','arquivos_registros','agenda_eventos','reunioes','indicadores_registros','indicadores_metas','indicadores_importacoes'] loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- Policies baseadas nas permissões já usadas pelo ELO. Não altera user_permissions existentes.
do $$
declare
  t text;
  module_key text;
begin
  foreach t in array array['demandas','ideias','projetos','arquivos_registros','agenda_eventos','reunioes','indicadores_registros','indicadores_metas','indicadores_importacoes'] loop
    module_key := case
      when t = 'arquivos_registros' then 'arquivos'
      when t = 'agenda_eventos' then 'agenda'
      when t like 'indicadores_%' then 'indicadores'
      else t
    end;
    execute format('drop policy if exists %I on public.%I', 'elo_select_'||t, t);
    execute format('create policy %I on public.%I for select to authenticated using (public.has_permission(%L,''view''))', 'elo_select_'||t, t, module_key);
    execute format('drop policy if exists %I on public.%I', 'elo_insert_'||t, t);
    execute format('create policy %I on public.%I for insert to authenticated with check (public.has_permission(%L,''create'') and created_by = auth.uid())', 'elo_insert_'||t, t, module_key);
    execute format('drop policy if exists %I on public.%I', 'elo_update_'||t, t);
    execute format('create policy %I on public.%I for update to authenticated using (public.has_permission(%L,''edit'')) with check (public.has_permission(%L,''edit''))', 'elo_update_'||t, t, module_key, module_key);
    execute format('drop policy if exists %I on public.%I', 'elo_delete_'||t, t);
    execute format('create policy %I on public.%I for delete to authenticated using (public.has_permission(%L,''delete''))', 'elo_delete_'||t, t, module_key);
  end loop;
end $$;

grant select, insert, update, delete on public.demandas, public.ideias, public.projetos,
  public.arquivos_registros, public.agenda_eventos, public.reunioes,
  public.indicadores_registros, public.indicadores_metas, public.indicadores_importacoes
  to authenticated;
grant usage, select on sequence public.solicitacoes_codigo_seq to authenticated;

-- Permissões iniciais de leitura/criação/edição para administradores e supervisores
-- devem ser atribuídas pelo painel de Usuários do ELO conforme a política da organização.
-- Nenhum usuário recebe permissões adicionais automaticamente por esta migração.
