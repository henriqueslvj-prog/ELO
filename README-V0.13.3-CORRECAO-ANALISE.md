# ELO V0.13.3 — Correção da análise e persistência

## Correção principal

A versão corrigida de `supabase/functions/analyze-attendance/index.ts`:

- valida sessão e permissão antes de executar operações administrativas;
- usa `SUPABASE_SERVICE_ROLE_KEY` somente no servidor para operações protegidas por RLS;
- mantém a análise individual salva mesmo se a consolidação mensal falhar;
- valida as notas oficiais (Qualidade 0–100 e Script/Processos 0–10);
- registra os sete critérios oficiais de Script e Processos em ordem fixa;
- conta somente análises com notas válidas para calcular médias mensais;
- chama `recalculate_destaque_evaluation` usando o parâmetro `p_evaluation_id`, conforme a função SQL incluída no projeto.

## Publicação

1. No Supabase, abra Edge Functions → `analyze-attendance`.
2. Substitua o conteúdo pelo arquivo `supabase/functions/analyze-attendance/index.ts` deste pacote e publique/deploy.
3. Confirme que os secrets padrão `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` estão disponíveis e que `GEMINI_API_KEY` está cadastrado em Custom secrets.
4. Não compartilhe nem coloque `SUPABASE_SERVICE_ROLE_KEY` no frontend.
5. Faça o teste com um PDF e confira a resposta da função e a tabela `destaque_atendimentos`.

## Comportamento esperado

Se a IA terminar mas a consolidação mensal falhar, o atendimento deve continuar com status `analisado`; a resposta inclui `monthly_warning` para informar a falha da consolidação. A mensagem de erro não deve apagar a análise individual.

## Pontuação oficial

- Qualidade do Atendimento: nota individual de 0 a 100. Média mensal convertida para 15 pontos com `round(média * 0.15)`.
- Utilização do Script e Processos: nota individual de 0 a 10, com sete verificações documentadas.

Observação: execute previamente `supabase/destaques-v0132-pontuacao-oficial.sql` se as quatro colunas de consolidação mensal ainda não existirem. Não execute novamente se já tiver sido aplicada; o script é idempotente para essas colunas.
