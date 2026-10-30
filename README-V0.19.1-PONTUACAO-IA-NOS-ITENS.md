# ELO V0.19.1 — Pontuação da IA entra na composição e total máximo de 100

## Problema
As médias da IA (Qualidade 0–100 e Script 0–10) ficavam apenas em colunas da avaliação (`quality_avg_100`, `script_avg_10`) e nunca eram gravadas como itens de pontuação. Por isso a "Composição da pontuação" mostrava "—" para os critérios de IA e a soma considerava só as notas do gestor. A tela ainda exibia "/ 15" na pontuação final.

## Correções
- **Banco:** nova função `_sync_destaque_ai_scores` consolida os atendimentos analisados e grava Qualidade e Script como itens:
  - Qualidade: média 0–100 → pontos proporcionais ao peso (90,4 → 13,6 de 15).
  - Script e Processos: média 0–10 → pontos proporcionais ao peso (8,5 → 8,5 de 10).
  - `recalculate_destaque_evaluation` passa a sincronizar a IA antes de somar. Isso vale também após analisar um atendimento, **excluir** uma avaliação (antes as médias ficavam desatualizadas) e salvar notas do gestor.
- **Tela (Pontuação mensal):** composição mostra as notas da IA; pontuação final é **X / 100** (soma dos pesos ativos); rótulos "/ 3" trocados pelo máximo de cada critério; o cartão de Qualidade usa os pontos consolidados; o botão **Atualizar** recalcula e recarrega composição e ranking.
- **Edge Function `analyze-attendance`:** deixa de apagar os itens de Qualidade/Script (agora consolidados no banco). Republicar é recomendado, mas o sistema também funciona sem republicar.

## Publicação
1. Execute `destaques-v0190-ranking-todas-pontuacoes.sql` (se ainda não executou) e depois `destaques-v0191-pontuacao-ia-nos-itens.sql`. O segundo corrige as avaliações existentes.
2. Envie o frontend ao GitHub (Vercel).
3. (Recomendado) Republique `analyze-attendance`.
4. Em Pontuação mensal, selecione o colaborador e clique em **Atualizar**.

## Exemplo (Biancka, período da captura)
Gestor 68,0 + Qualidade 13,6 + Script 8,5 = **90,1 / 100**.
