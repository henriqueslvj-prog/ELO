# ELO V0.19.0 — Ranking com todas as pontuações + correção do recálculo

## Correções
1. **Erro "Could not find the function public.recalculate_destaque_evaluation(p_evaluation_id)".** A migração v0136 havia renomeado o parâmetro da função para `target_evaluation_id`, mas o frontend e as Edge Functions chamam `p_evaluation_id`. A nova migração recria a função com o nome correto e recarrega o cache da API.
2. **Ranking soma tudo.** Antes, só aparecia pontuação (e posição) quando TODOS os critérios estavam preenchidos. Agora o ranking soma todas as pontuações já lançadas — as da IA (Qualidade e Script) e as do gestor (critérios manuais) — e ordena por esse total.
   - Nota usada por critério: revisada > gestor > IA.
   - Quem tem apenas parte dos critérios aparece com **"Pontuação parcial"** e o aviso "Parcial: X de Y critérios pontuados".
   - Cada linha mostra a divisão **IA x Gestor** e o total sobre o máximo configurado (ex.: 62.5 / 100), em vez do "/ 15" fixo.
   - O total é calculado direto das pontuações, então o ranking continua correto mesmo se um recálculo falhar.

## Publicação
1. SQL Editor do Supabase: execute `supabase/destaques-v0190-ranking-todas-pontuacoes.sql` (seguro para repetir; não apaga dados; recalcula as avaliações existentes).
2. Envie o frontend ao GitHub (Vercel). As Edge Functions não mudaram.
3. Abra Destaques → Ranking do mês, escolha a competência e confira os totais (a consulta ao final do SQL mostra o mesmo resultado).

## Observações
- Elegibilidade para vencedor continua exigindo avaliação completa e notas mínimas; o ranking, porém, lista e ordena todos que têm alguma pontuação.
- Se algum critério ativo for criado/desativado, o máximo e a contagem de critérios do ranking acompanham automaticamente.
