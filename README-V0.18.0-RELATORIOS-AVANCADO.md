# ELO V0.18.0 — Relatórios: demandas, categorias, PDF, histórico, versões e painel

## O que mudou
1. **Solução → Demanda.** Cada solução sugerida tem o botão **＋ Criar demanda** (título, descrição, categoria, prioridade, responsável e prazo editáveis). A demanda nasce como “Nova”, com a origem do relatório na descrição, e a solução passa a exibir “✓ Demanda criada · status”.
2. **Categorias editáveis.** Nova aba **Categorias**: adicionar, renomear (as observações existentes acompanham), ativar/desativar e excluir categorias sem uso.
3. **PDF no servidor.** Botão **⬇ Baixar PDF** (Edge Function `report-pdf`): capa com logo e período, cabeçalho, rodapé com “Página x de y”, tabela e gráfico por categoria, destaques, pontos de atenção, soluções, plano de ação, registros considerados e assinatura. O botão Imprimir continua disponível.
4. **Histórico.** Busca pelo nome, filtro por tipo e por período, paginação (“Carregar mais”) e **Duplicar** relatório.
5. **Versões.** Toda alteração (edição, soluções, restauração) guarda a versão anterior automaticamente. Botão **↶ Versões** lista e restaura qualquer uma; a restauração também pode ser desfeita. Mantém a versão inicial e as 30 mais recentes.
6. **Painel Executivo.** Novo bloco “Relatórios e problemas em aberto”: observações do mês, relatórios do mês, demandas de relatórios ainda abertas e soluções sem demanda (90 dias).

## Publicação (nesta ordem)
1. SQL Editor do Supabase: execute `supabase/relatorios-v0170-categorias-versoes-demandas.sql` (seguro para repetir; não apaga dados).
2. Edge Functions: faça o deploy da **nova** função `report-pdf` (arquivo único `index.ts`, com a logo embutida; pode ser colado direto no editor do painel). Se `generate-report` ainda não estiver na V0.17, publique-a também.
3. Envie o frontend ao GitHub (Vercel).
4. Permissões: `relatorios/create` cria demandas a partir de soluções, duplica relatórios e gera PDF/relatórios; `relatorios/edit` gerencia categorias e restaura versões. Criar demanda também exige `demandas/create`.

## Observações
- Relatórios gerados antes desta versão continuam funcionando; o PDF usa os dados já salvos neles.
- Renomear categoria não altera o texto de relatórios já gerados (são registros históricos).
- O PDF usa fontes padrão (Helvetica): caracteres fora do alfabeto latino são omitidos.

## V0.18.2
- Capa do PDF refeita conforme o modelo do Grupo System Saúde: fundo cinza com as ondas originais, logo transparente (sem caixa branca), título em caixa escura com borda dourada e faixa do período. As imagens foram extraídas do PDF modelo e estão embutidas em `report-pdf/index.ts` (arquivo único, ~150 KB).
- Logo transparente também no cabeçalho das demais páginas.
