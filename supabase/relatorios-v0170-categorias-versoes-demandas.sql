-- ELO V0.17+ | Relatórios: categorias editáveis, versões de edição, vínculo solução→demanda e duplicação.
-- Execute no SQL Editor do Supabase. Seguro para rodar mais de uma vez. Não apaga dados.

-- 1) CATEGORIAS EDITÁVEIS ---------------------------------------------------
create table if not exists public.relatorio_categorias (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists relatorio_categorias_name_uq on public.relatorio_categorias (lower(name));

insert into public.relatorio_categorias (name, sort_order)
select v.name, v.ord from (values
  ('Geral',10),('Atendimento',20),('Equipe',30),('Operacional',40),('Resultado',50),('Ocorrência',60),('Treinamento',70)
) as v(name, ord)
where not exists (select 1 from public.relatorio_categorias c where lower(c.name) = lower(v.name));

-- Categorias já usadas em observações antigas também entram no cadastro.
insert into public.relatorio_categorias (name, sort_order)
select distinct o.category, 100 from public.relatorio_observacoes o
where o.category is not null and btrim(o.category) <> ''
  and not exists (select 1 from public.relatorio_categorias c where lower(c.name) = lower(o.category));

drop trigger if exists relatorio_categorias_set_updated_at on public.relatorio_categorias;
create trigger relatorio_categorias_set_updated_at before update on public.relatorio_categorias
for each row execute function public.set_updated_at();

alter table public.relatorio_categorias enable row level security;
drop policy if exists "relatorios view categorias" on public.relatorio_categorias;
create policy "relatorios view categorias" on public.relatorio_categorias for select using (public.has_permission('relatorios','view'));
drop policy if exists "relatorios create categorias" on public.relatorio_categorias;
create policy "relatorios create categorias" on public.relatorio_categorias for insert with check (public.has_permission('relatorios','edit'));
drop policy if exists "relatorios edit categorias" on public.relatorio_categorias;
create policy "relatorios edit categorias" on public.relatorio_categorias for update using (public.has_permission('relatorios','edit')) with check (public.has_permission('relatorios','edit'));
drop policy if exists "relatorios delete categorias" on public.relatorio_categorias;
create policy "relatorios delete categorias" on public.relatorio_categorias for delete using (public.has_permission('relatorios','edit'));
grant select, insert, update, delete on public.relatorio_categorias to authenticated;

-- Renomeia a categoria e atualiza as observações existentes na mesma transação.
create or replace function public.relatorio_renomear_categoria(p_id uuid, p_novo text)
returns void language plpgsql as $$
declare v_old text; v_new text := btrim(coalesce(p_novo, ''));
begin
  if not public.has_permission('relatorios','edit') then raise exception 'Você não tem permissão para renomear categorias.'; end if;
  if v_new = '' then raise exception 'Informe o nome da categoria.'; end if;
  select name into v_old from public.relatorio_categorias where id = p_id;
  if not found then raise exception 'Categoria não encontrada.'; end if;
  if exists (select 1 from public.relatorio_categorias where lower(name) = lower(v_new) and id <> p_id) then
    raise exception 'Já existe uma categoria com este nome.';
  end if;
  update public.relatorio_categorias set name = v_new where id = p_id;
  update public.relatorio_observacoes set category = v_new where category = v_old;
end $$;
grant execute on function public.relatorio_renomear_categoria(uuid, text) to authenticated;

-- 2) DUPLICAR RELATÓRIOS (usuário com permissão de criar pode inserir cópia) ---
grant insert on public.relatorios to authenticated;
drop policy if exists "relatorios insert reports" on public.relatorios;
create policy "relatorios insert reports" on public.relatorios for insert
  with check (public.has_permission('relatorios','create') and created_by = auth.uid());

-- 3) VERSÕES AO EDITAR -------------------------------------------------------
create table if not exists public.relatorio_versoes (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.relatorios(id) on delete cascade,
  version_no integer not null,
  title text not null,
  content jsonb not null default '{}'::jsonb,
  replaced_by uuid references public.profiles(id) on delete set null,
  replaced_by_name text,
  created_at timestamptz not null default now(),
  unique (report_id, version_no)
);
create index if not exists idx_relatorio_versoes_report on public.relatorio_versoes(report_id, version_no desc);

alter table public.relatorio_versoes enable row level security;
drop policy if exists "relatorios view versoes" on public.relatorio_versoes;
create policy "relatorios view versoes" on public.relatorio_versoes for select using (public.has_permission('relatorios','view'));
grant select on public.relatorio_versoes to authenticated;

-- Guarda o estado ANTERIOR sempre que título ou conteúdo mudam (edição, soluções, restauração).
-- A versão 1 é o estado inicial gerado; mantém a versão 1 e as 30 mais recentes.
create or replace function public.relatorios_guardar_versao()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_no integer; v_name text;
begin
  if old.title is distinct from new.title or old.content is distinct from new.content then
    select coalesce(max(version_no), 0) + 1 into v_no from public.relatorio_versoes where report_id = old.id;
    select full_name into v_name from public.profiles where id = auth.uid();
    insert into public.relatorio_versoes (report_id, version_no, title, content, replaced_by, replaced_by_name)
    values (old.id, v_no, old.title, old.content, auth.uid(), v_name);
    delete from public.relatorio_versoes where report_id = old.id and version_no > 1 and version_no <= v_no - 30;
  end if;
  return new;
end $$;

drop trigger if exists relatorios_guardar_versao_trg on public.relatorios;
create trigger relatorios_guardar_versao_trg before update on public.relatorios
for each row execute function public.relatorios_guardar_versao();

-- 4) VÍNCULO SOLUÇÃO → DEMANDA ----------------------------------------------
create table if not exists public.relatorio_solucao_demandas (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.relatorios(id) on delete cascade,
  problema text not null,
  solucao text not null,
  demanda_id uuid references public.demandas(id) on delete set null,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now()
);
create index if not exists idx_relatorio_sol_dem_report on public.relatorio_solucao_demandas(report_id);
create index if not exists idx_relatorio_sol_dem_demanda on public.relatorio_solucao_demandas(demanda_id);

alter table public.relatorio_solucao_demandas enable row level security;
drop policy if exists "relatorios view sol_dem" on public.relatorio_solucao_demandas;
create policy "relatorios view sol_dem" on public.relatorio_solucao_demandas for select using (public.has_permission('relatorios','view'));
drop policy if exists "relatorios create sol_dem" on public.relatorio_solucao_demandas;
create policy "relatorios create sol_dem" on public.relatorio_solucao_demandas for insert
  with check (public.has_permission('relatorios','create') and created_by = auth.uid());
drop policy if exists "relatorios delete sol_dem" on public.relatorio_solucao_demandas;
create policy "relatorios delete sol_dem" on public.relatorio_solucao_demandas for delete using (public.has_permission('relatorios','edit'));
grant select, insert, delete on public.relatorio_solucao_demandas to authenticated;

notify pgrst, 'reload schema';
