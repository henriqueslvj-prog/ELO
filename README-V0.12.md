# ELO V0.12 — Avaliação Mensal + Competência Automática + Ranking

## Atualizações

- A data do atendimento é extraída automaticamente do texto do PDF.
- `DD/MM/AAAA` define a competência: `09/09/2026` → `2026-09`.
- O atendimento é movido automaticamente para o ciclo mensal correspondente.
- O ciclo mensal é criado automaticamente quando ainda não existe.
- A IA consolida os critérios de fonte `ia` a partir de todos os atendimentos analisados daquele colaborador no mês.
- O gestor continua responsável pelos critérios manuais/sistema.
- Ao salvar notas manuais, o ELO recalcula a avaliação mensal.
- O `final_score` só é preenchido quando todos os critérios ativos possuem nota.
- Critérios obrigatórios e suas notas mínimas participam da elegibilidade.
- Nova aba **Ranking do mês** mostra todos os colaboradores e suas pontuações consolidadas.
- Avaliações incompletas aparecem como “Em andamento” e não recebem posição numérica final.

## SQL

Execute no Supabase SQL Editor:

`supabase/destaques-v012-ranking.sql`

## Edge Function

Depois de atualizar `supabase/functions/analyze-attendance/index.ts`:

```bash
supabase functions deploy analyze-attendance
```

O Secret `GEMINI_API_KEY` continua no Supabase.

## Fluxo

PDF → extração de texto → data do atendimento → competência mensal → IA → critérios IA → notas do gestor → consolidação → ranking.
