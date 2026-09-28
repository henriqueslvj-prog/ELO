# ELO — Gestão, Organização, Resultados

Fundação do sistema privado ELO, com autenticação via Supabase.

## Configuração local

1. Copie `.env.example` para `.env`.
2. Preencha:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
3. Execute `npm install`.
4. Execute `npm run dev`.

## Supabase

O `supabase/schema.sql` cria a tabela `profiles`, RLS, função de administrador e trigger de perfil.

Para criar o primeiro acesso:
- Supabase → Authentication → Users → Add user.
- Confirme o usuário.
- No SQL Editor, altere o `role` para `administrador` e `status` para `ativo`.

A tela de login não possui cadastro público. O frontend valida também se existe um perfil ativo para o usuário autenticado.

## Criação interna de usuários

A função `supabase/functions/admin-create-user/index.ts` deve ser publicada como Edge Function `admin-create-user` e receber `SUPABASE_SERVICE_ROLE_KEY` como secret. A Service Role Key nunca deve ser colocada no frontend.
