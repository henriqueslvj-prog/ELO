# ELO V0.20.1 — Temas claro/escuro, PDF e painel

## Temas
- **Modo escuro:** a paleta deixou de ser "verde escuro" e passou a grafite neutro (fundo, painéis, menu e bordas). O verde ficou restrito à cor de destaque (botões, item ativo, indicadores, brilho sutil no topo). Textos pequenos e esmaecidos foram clareados até contraste mínimo de 4,6:1.
- **Modo claro:** gerado a partir do tema escuro, com fundo cinza-azulado suave, cartões brancos, bordas discretas e **todos os textos com contraste mínimo de 4,6:1 sobre branco** (antes, vários textos — como os valores da análise de atendimento — ficavam cinza-claro sobre branco e quase ilegíveis).
- O bloco final de `src/styles.css` (entre `ELO-GEN-LIGHT-START` e `ELO-GEN-LIGHT-END`) é gerado automaticamente; para ajustar o modo claro, altere a regra equivalente do tema escuro.

## PDF do relatório (republicar `report-pdf`)
- Removidos: "TABELA 1 – Observações por categoria", "GRÁFICO 1 – Distribuição das observações por categoria" e a seção "REGISTROS CONSIDERADOS".
- Removida a frase "Sugestões elaboradas por IA a partir dos problemas registrados nas observações. Devem ser validadas pela gestão antes da aplicação." em Possíveis soluções.
- Cada problema de solução agora só inicia na página se houver espaço para o conteúdo (evita o marcador dourado isolado no fim da página).
- (V0.20.0) Removidas as frases "Relatório elaborado pelo sistema ELO…" e "Emitido em … • N observações analisadas".

## Painel Executivo
- Data com inicial maiúscula ("Quarta-feira, 4 de novembro de 2026").
- Quando uma fonte falha, o painel agora mostra o motivo real do erro (ex.: solicitações), em vez de uma mensagem genérica; o resumo do topo não exibe mais "—".
- Painéis alinhados ao topo (sem espaço vazio esticado).

## Publicação
1. Envie o frontend ao GitHub (Vercel).
2. Republique a Edge Function `report-pdf`.
3. Sem SQL novo.
