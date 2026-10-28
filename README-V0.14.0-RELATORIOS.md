# ELO V0.14.0 — Módulo Relatórios

## Como funciona
1. **Observações**: registre fatos do dia a dia (data, categoria, título e detalhes).
2. **Gerar relatório**: escolha **Semanal** (qualquer dia da semana → segunda a domingo), **Mensal** ou **Personalizado** (de/até). O sistema mostra quantas observações existem no período.
3. A IA agrupa as observações e escreve: resumo executivo, destaques, pontos de atenção, resumo por categoria e próximos passos.
4. **Relatórios gerados**: histórico salvo, com visualização, copiar texto e imprimir / salvar em PDF.

Se a IA estiver indisponível, o relatório é gerado sem IA (agrupado por categoria) e o aviso aparece na tela.

## Publicação
1. SQL Editor do Supabase: execute `supabase/relatorios-v0140.sql`.
2. Edge Functions: crie `generate-report` com o conteúdo de `supabase/functions/generate-report/index.ts` e faça o deploy. Usa os mesmos secrets da análise de atendimentos (`GEMINI_API_KEY`, opcional `GEMINI_MODEL`).
3. Faça push do frontend no GitHub.
4. Em **Usuários → Permissões**, libere o módulo **Relatórios** (ver/criar/editar/excluir) para quem for usar.
