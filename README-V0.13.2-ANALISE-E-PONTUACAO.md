# ELO V0.13.2 — Correção da análise de atendimento

## Alterações
- A Edge Function valida a sessão e a permissão do usuário antes de executar operações privilegiadas.
- Operações de análise e gravação usam `SUPABASE_SERVICE_ROLE_KEY` somente no servidor; nunca inserir essa chave no frontend.
- A análise individual é salva antes da consolidação mensal. Se a consolidação falhar, o histórico individual continua salvo como `analisado` e a função retorna `monthly_warning`.
- Corrigida a validação de ciclo no upload para usar o ciclo recém-criado (`activeCycle.id`), não um estado React antigo.
- A tela mostra a nota bruta de Qualidade (0–100), conversão para 15 pontos e nota independente de Script e Processos (0–10), com evidências para os sete itens oficiais.

## Pontuação oficial
1. Qualidade do Atendimento: a IA atribui 0–100 por atendimento. Para a categoria mensal, calcule a média de até 10 atendimentos selecionados e converta para 15 pontos: `Math.round(media * 0.15)`. Exemplo: média 94,5 => 14 pontos.
2. Utilização do Script e Processos: nota independente de 0–10 por atendimento, considerando: uso correto do script; identificação correta do cliente; conferência de informações; registro no sistema; encaminhamento correto; encerramento correto; cumprimento dos procedimentos.
3. O PDF não comprova necessariamente registros internos. A IA deve marcar `não_evidenciado` quando não houver prova e não inventar a execução do item.

## Secrets obrigatórios
No Supabase Edge Functions > Secrets, configure:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `GEMINI_API_KEY`

A chave `SUPABASE_SERVICE_ROLE_KEY` deve permanecer somente nos secrets da Edge Function. Nunca usar `VITE_` para essa chave.

## Publicação
1. Faça deploy do frontend.
2. Publique `supabase/functions/analyze-attendance/index.ts` como Edge Function `analyze-attendance`.
3. Confirme que os quatro secrets estão configurados.
4. Teste com um PDF com texto selecionável e confira o registro em `public.destaque_atendimentos`: `status='analisado'`, `analysis` preenchido, `analyzed_at` preenchido, `attendance_date` e `period_key` preenchidos.
5. Se a análise estiver salva mas a consolidação mensal falhar, a resposta retorna `monthly_warning` e o histórico individual continua disponível.

## Migração SQL
Execute `supabase/destaques-v0132-pontuacao-oficial.sql` antes de publicar a Edge Function. Ela cria colunas para armazenar média de qualidade (0–100), conversão mensal para 0–15, média de script (0–10) e quantidade de atendimentos analisados.

## Como implantar sem perder histórico
1. Baixe e extraia o ZIP.
2. No Supabase SQL Editor, execute `supabase/destaques-v0132-pontuacao-oficial.sql`.
3. Em Supabase > Edge Functions > Secrets, confirme os quatro secrets descritos acima.
4. Publique `supabase/functions/analyze-attendance/index.ts` como `analyze-attendance`.
5. Publique o frontend atualizado na Vercel.
6. Faça upload de um PDF de teste. Abra o registro e confirme nota de Qualidade (0–100), nota de Script (0–10) e os sete itens com evidências.
7. Na aba Pontuação mensal, confirme que aparecem a média mensal de qualidade, a conversão para 15 pontos, a média do script e a quantidade de atendimentos consolidados.

A supervisão deve selecionar os 10 atendimentos aleatórios do colaborador e enviá-los para análise. O ELO calcula a média dos atendimentos analisados daquele colaborador e período; não envia arquivos ou chaves para o navegador além da sessão autenticada.
