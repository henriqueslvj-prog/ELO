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


## Solicitações V0.7
Execute `supabase/solicitacoes.sql` depois da fundação e do módulo Demandas. A interface já está integrada ao frontend e grava no Supabase.

## ELO V0.8 — Motor de Avaliação / Destaque do Mês

### 1. Banco de dados
Execute no Supabase:
`supabase/destaques.sql`

Esse script cria os ciclos de avaliação, critérios, avaliações, itens, atendimentos e o bucket privado para PDFs.

### 2. Permissões
O módulo usa o módulo `destaques` do sistema de permissões. Para o administrador, conceda ao menos `view/create/edit`; para análise e manutenção completa, `delete` também.

### 3. IA para análise de PDF
A versão inclui a Edge Function:
`supabase/functions/analyze-attendance/index.ts`

Ela usa a Gemini API no servidor. Configure o secret da função:
`GEMINI_API_KEY`

A chave não deve ser colocada no frontend/Vercel como variável pública.

Depois faça o deploy da função `analyze-attendance` pelo Supabase CLI/dashboard.

O fluxo é:
PDF → Storage privado → Edge Function → Gemini → JSON estruturado → `destaque_atendimentos.analysis`.

### 4. Modelo utilizado
A função está preparada para `gemini-2.5-flash`. A disponibilidade de nível sem custo e os limites de uso devem ser conferidos na documentação atual do Google antes de colocar a rotina em produção.
