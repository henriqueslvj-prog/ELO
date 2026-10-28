-- ELO V0.14.3 — Permite que gestores autorizados editem relatórios já gerados.
-- Não apaga tabelas nem registros. Execute no SQL Editor do Supabase.

grant update on public.relatorios to authenticated;

drop policy if exists "relatorios edit reports" on public.relatorios;
create policy "relatorios edit reports"
  on public.relatorios
  for update
  to authenticated
  using (public.has_permission('relatorios','edit'))
  with check (public.has_permission('relatorios','edit'));

notify pgrst, 'reload schema';
