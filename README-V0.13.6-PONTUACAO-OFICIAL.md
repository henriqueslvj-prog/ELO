# ELO V0.13.6 — Correção da pontuação oficial

## O que foi alterado
- Campos manuais passam a aceitar até o máximo de pontos do critério (25, 20, 10 ou 5).
- A IA recebe instruções para pontuar cada critério até o máximo configurado.
- A consolidação passa a somar pontos diretamente, com máximo de 100.
- O SQL de migração atualiza pesos/origem dos oito critérios oficiais, ajusta constraints e converte notas antigas de 0–3 proporcionalmente.

## Aplicação
1. Faça backup/exportação do projeto Supabase antes de alterar o banco.
2. No Supabase SQL Editor, execute `supabase/destaques-v0136-escala-oficial-100-pontos.sql` **uma única vez**. Não execute novamente, pois a conversão de notas históricas é uma migração única.
3. Publique o conteúdo de `supabase/functions/analyze-attendance/index.ts` na função existente `analyze-attendance` (não apague nem recrie a função).
4. Publique o frontend na Vercel.
5. Teste um colaborador e confirme que a soma máxima é 100.

## Importante
O SQL não exclui avaliações. A conversão de notas antigas mantém a proporção em relação ao máximo de cada critério. Confira os nomes dos critérios no banco antes de executar: os nomes oficiais são usados para identificar peso e origem.
