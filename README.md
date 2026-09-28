# ELO — V0.2 Fundação

Sistema privado de gestão. Esta versão adiciona a fundação de autenticação e controle interno de usuários.

## Configuração
1. Crie um projeto no Supabase.
2. Execute `supabase/schema.sql` no SQL Editor.
3. Crie `.env` a partir de `.env.example` e preencha `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`.
4. Instale dependências com `npm install` e rode `npm run dev`.
5. Publique a Edge Function `supabase/functions/admin-create-user` e configure a secret `SUPABASE_SERVICE_ROLE_KEY` no ambiente da função.

## Primeiro administrador
O primeiro administrador deve ser criado de forma controlada no Supabase Auth. Depois, insira/atualize o respectivo registro em `public.profiles` com `role='administrador'` e `status='ativo'`.

## Modelo de acesso
Não existe cadastro público. O administrador cria os demais usuários internamente. Usuários inativos continuam preservados para manter histórico.
