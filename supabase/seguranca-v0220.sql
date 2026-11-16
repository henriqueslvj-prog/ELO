-- =====================================================================
-- ELO V0.22 | Endurecimento de segurança do banco
-- Execute no SQL Editor do Supabase. Seguro para repetir. NÃO apaga dados.
-- Antes: confirme o backup/PITR e publique a Edge Function admin-create-user atualizada.
-- =====================================================================
begin;

-- 1) SESSÃO VÁLIDA: usuário ATIVO e, se tiver 2FA, sessão com 2FA concluído (aal2) --------------
create or replace function public.elo_session_ok()
returns boolean language sql stable security definer set search_path = public, auth, pg_temp as $$
  select
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.status = 'ativo')
    and (
      not exists (select 1 from auth.mfa_factors f where f.user_id = auth.uid() and f.status = 'verified')
      or coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
    );
$$;
revoke all on function public.elo_session_ok() from public, anon;
grant execute on function public.elo_session_ok() to authenticated, service_role;

-- 2) NOVAS TABELAS -------------------------------------------------------------------------------
create table if not exists public.termos_aceites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  version text not null,
  accepted_at timestamptz not null default now(),
  user_agent text,
  unique (user_id, version)
);
alter table public.termos_aceites enable row level security;
drop policy if exists "termos: ver proprio ou admin" on public.termos_aceites;
create policy "termos: ver proprio ou admin" on public.termos_aceites for select to authenticated
  using (user_id = auth.uid() or public.is_admin());
drop policy if exists "termos: aceitar proprio" on public.termos_aceites;
create policy "termos: aceitar proprio" on public.termos_aceites for insert to authenticated
  with check (user_id = auth.uid());
revoke all on public.termos_aceites from anon, authenticated;
grant select, insert on public.termos_aceites to authenticated;

create table if not exists public.audit_log (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  actor uuid,
  actor_name text,
  action text not null,
  table_name text not null,
  record_id text,
  old_data jsonb,
  new_data jsonb
);
create index if not exists idx_audit_log_at on public.audit_log (at desc);
create index if not exists idx_audit_log_table on public.audit_log (table_name, at desc);
alter table public.audit_log enable row level security;
drop policy if exists "audit: somente admin le" on public.audit_log;
create policy "audit: somente admin le" on public.audit_log for select to authenticated using (public.is_admin());
revoke all on public.audit_log from anon, authenticated;
grant select on public.audit_log to authenticated;

create table if not exists public.api_rate_limits (
  user_id uuid not null,
  bucket text not null,
  window_start timestamptz not null,
  hits integer not null default 1,
  primary key (user_id, bucket, window_start)
);
alter table public.api_rate_limits enable row level security;   -- sem políticas: só o servidor (service_role) acessa
revoke all on public.api_rate_limits from anon, authenticated;

-- 3) LIMITE DE REQUISIÇÕES (janela fixa) — usado pelas Edge Functions -----------------------------
create or replace function public.check_rate_limit(p_user uuid, p_bucket text, p_limit integer, p_window_seconds integer)
returns boolean language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_start timestamptz := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  v_hits integer;
begin
  insert into public.api_rate_limits (user_id, bucket, window_start, hits)
  values (p_user, p_bucket, v_start, 1)
  on conflict (user_id, bucket, window_start) do update set hits = public.api_rate_limits.hits + 1
  returning hits into v_hits;
  if random() < 0.02 then
    delete from public.api_rate_limits where window_start < now() - interval '2 days';
  end if;
  return v_hits <= p_limit;
end $$;
revoke all on function public.check_rate_limit(uuid, text, integer, integer) from public, anon, authenticated;
grant execute on function public.check_rate_limit(uuid, text, integer, integer) to service_role;

-- 4) TRILHA DE AUDITORIA ------------------------------------------------------------------------
create or replace function public.elo_audit()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare v_old jsonb; v_new jsonb; v_id text;
begin
  if tg_op in ('UPDATE', 'DELETE') then v_old := to_jsonb(old); end if;
  if tg_op in ('INSERT', 'UPDATE') then v_new := to_jsonb(new); end if;
  v_id := coalesce(v_new ->> 'id', v_old ->> 'id', v_new ->> 'user_id', v_old ->> 'user_id');
  if tg_table_name = 'relatorios' then v_old := v_old - 'content'; v_new := v_new - 'content'; end if;
  insert into public.audit_log (actor, actor_name, action, table_name, record_id, old_data, new_data)
  values (auth.uid(), (select full_name from public.profiles where id = auth.uid()), tg_op, tg_table_name, v_id, v_old, v_new);
  return coalesce(new, old);
end $$;
revoke all on function public.elo_audit() from public, anon, authenticated;

do $$
declare r record;
begin
  for r in select * from (values
    ('profiles',                 'insert or update or delete'),
    ('user_permissions',         'insert or update or delete'),
    ('destaque_criterios',       'insert or update or delete'),
    ('destaque_colaboradores',   'insert or update or delete'),
    ('relatorios',               'delete'),
    ('relatorio_observacoes',    'delete'),
    ('demandas',                 'delete'),
    ('solicitacoes',             'delete'),
    ('destaque_atendimentos',    'delete')
  ) as t(tbl, ev) loop
    if to_regclass('public.' || r.tbl) is not null then
      execute format('drop trigger if exists elo_audit_trg on public.%I', r.tbl);
      execute format('create trigger elo_audit_trg after %s on public.%I for each row execute function public.elo_audit()', r.ev, r.tbl);
    end if;
  end loop;
  -- notas lançadas pelo gestor/revisor: registra remoções e alterações de valor
  if to_regclass('public.destaque_avaliacao_itens') is not null then
    drop trigger if exists elo_audit_trg_del on public.destaque_avaliacao_itens;
    drop trigger if exists elo_audit_trg_upd on public.destaque_avaliacao_itens;
    create trigger elo_audit_trg_del after delete on public.destaque_avaliacao_itens
      for each row execute function public.elo_audit();
    create trigger elo_audit_trg_upd after update on public.destaque_avaliacao_itens
      for each row when (old.manual_score is distinct from new.manual_score or old.reviewed_score is distinct from new.reviewed_score)
      execute function public.elo_audit();
  end if;
end $$;

-- 5) NÃO PERMITIR REMOVER/REBAIXAR O ÚLTIMO ADMINISTRADOR ATIVO -----------------------------------
create or replace function public.elo_protect_last_admin()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare v_others integer;
begin
  if old.role = 'administrador' and old.status = 'ativo' then
    select count(*) into v_others from public.profiles where role = 'administrador' and status = 'ativo' and id <> old.id;
    if v_others = 0 and (tg_op = 'DELETE' or new.role <> 'administrador' or new.status <> 'ativo') then
      raise exception 'Não é possível remover, rebaixar ou desativar o último administrador ativo.';
    end if;
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end $$;
revoke all on function public.elo_protect_last_admin() from public, anon, authenticated;
drop trigger if exists elo_protect_last_admin_trg on public.profiles;
create trigger elo_protect_last_admin_trg before update or delete on public.profiles
  for each row execute function public.elo_protect_last_admin();

-- 6) NOVAS CONTAS NASCEM SEM ACESSO (caso o cadastro público esteja aberto no Auth) ----------------
-- A Edge Function admin-create-user define status/perfil explicitamente.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  insert into public.profiles (id, full_name, email, role, status)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', 'Usuário'), new.email, 'colaborador', 'inativo')
  on conflict (id) do nothing;
  return new;
end $$;

-- 7) RLS RESTRITIVA EM TODAS AS TABELAS: usuário ativo + 2FA quando existir ---------------------------
do $$
declare t record;
begin
  for t in select tablename from pg_tables
           where schemaname = 'public' and tableowner = current_user
             and tablename not in ('profiles', 'user_permissions', 'termos_aceites', 'audit_log', 'api_rate_limits')
  loop
    begin
      execute format('alter table public.%I enable row level security', t.tablename);
      execute format('drop policy if exists "elo_sessao_valida" on public.%I', t.tablename);
      execute format('create policy "elo_sessao_valida" on public.%I as restrictive for all to authenticated using ((select public.elo_session_ok())) with check ((select public.elo_session_ok()))', t.tablename);
    exception when others then
      raise notice 'Tabela % ignorada: %', t.tablename, sqlerrm;
    end;
  end loop;
end $$;

-- 8) ARMAZENAMENTO (atendimentos): privado, tamanho e tipos limitados, mesma exigência de sessão -------
do $$
begin
  update storage.buckets
     set public = false, file_size_limit = 15728640, allowed_mime_types = array['application/pdf', 'text/plain']
   where id = 'destaque-atendimentos';
  drop policy if exists "elo_sessao_valida_destaque_atendimentos" on storage.objects;
  create policy "elo_sessao_valida_destaque_atendimentos" on storage.objects as restrictive for all to authenticated
    using (bucket_id <> 'destaque-atendimentos' or (select public.elo_session_ok()))
    with check (bucket_id <> 'destaque-atendimentos' or (select public.elo_session_ok()));
exception when insufficient_privilege then
  raise notice 'Sem privilégio para ajustar o storage por SQL. Faça pelo painel: Storage > destaque-atendimentos > Edit bucket (privado, 15 MB, application/pdf e text/plain).';
end $$;

-- 9) FUNÇÕES: search_path fixo nas SECURITY DEFINER e execução somente por usuários logados ----------
do $$
declare f record;
begin
  for f in select p.oid::regprocedure as sig, p.proname, p.prosecdef, p.proconfig
           from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.prokind = 'f'
  loop
    if f.prosecdef and not coalesce(array_to_string(f.proconfig, ',') like '%search_path%', false) then
      execute format('alter function %s set search_path = public, extensions, pg_temp', f.sig);
    end if;
    execute format('revoke all on function %s from public, anon', f.sig);
    if f.proname like '\_%' or f.proname in ('check_rate_limit', 'elo_audit', 'elo_protect_last_admin') then
      execute format('revoke all on function %s from authenticated', f.sig);
      execute format('grant execute on function %s to service_role', f.sig);
    else
      execute format('grant execute on function %s to authenticated, service_role', f.sig);
    end if;
  end loop;
end $$;

-- 10) VISITANTE (anon) NÃO ACESSA NADA DO SCHEMA PUBLIC -------------------------------------------
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke all on sequences from anon;
alter default privileges in schema public revoke execute on functions from anon, public;

commit;
notify pgrst, 'reload schema';

-- CONFERÊNCIAS (esperado: nenhuma linha em nenhuma das três consultas) -----------------------------
select 'tabela sem RLS' as alerta, tablename from pg_tables where schemaname = 'public' and not rowsecurity;
select 'função executável por anon' as alerta, p.oid::regprocedure::text as funcao
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and has_function_privilege('anon', p.oid, 'execute');
select 'tabela acessível por anon' as alerta, table_name
from information_schema.role_table_grants where grantee = 'anon' and table_schema = 'public' group by table_name;
