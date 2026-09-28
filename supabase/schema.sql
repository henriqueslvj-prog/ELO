-- ELO | Fundação de autenticação e perfis
-- Execute no SQL Editor do projeto Supabase.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  email text not null,
  role text not null default 'colaborador' check (role in ('administrador','gestor','supervisor','colaborador')),
  status text not null default 'ativo' check (status in ('ativo','inativo')),
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.profiles where id=auth.uid() and role='administrador' and status='ativo');
$$;

create policy "users can read own profile" on public.profiles
for select using (id=auth.uid() or public.is_admin());

create policy "admins can insert profiles" on public.profiles
for insert with check (public.is_admin());

create policy "admins can update profiles" on public.profiles
for update using (public.is_admin()) with check (public.is_admin());

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  insert into public.profiles(id,full_name,email) values (new.id, coalesce(new.raw_user_meta_data->>'full_name','Usuário'), new.email);
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();
