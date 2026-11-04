# ELO V0.20.0 — Layout profissional, novo Painel Executivo e módulos enxutos

## Correções
1. **Pontuação do gestor individual por colaborador.** O rascunho digitado ficava na tela ao trocar de colaborador e podia ser salvo em outra pessoa (a avaliação carregada também podia ser a do colaborador anterior). Agora:
   - o rascunho e a avaliação são limpos ao trocar colaborador ou competência;
   - respostas antigas de carregamento são descartadas (sem "corrida" entre colaboradores);
   - ao salvar, a avaliação é sempre buscada/criada para o colaborador e o período selecionados;
   - após salvar, o rascunho é limpo e os valores vêm do banco.
2. **PDF do relatório:** removidas as linhas "Relatório elaborado pelo sistema ELO — Grupo System Saúde." e "Emitido em … • N observações analisadas" (capa). Republique `report-pdf`.

## Módulos removidos
Ideias, Projetos, Agenda, Indicadores e Arquivos saíram do menu, das rotas, da tela de permissões e do Painel Executivo. Permanecem: Painel Executivo, Demandas, Solicitações, Reuniões, Destaques e Relatórios.
As tabelas desses módulos no Supabase **não foram apagadas** (nenhum dado é perdido). Se quiser removê-las depois, faça backup antes.

## Novo layout
- Menu lateral fixo em telas grandes (gaveta no celular/tablet), com grupos (Visão geral, Operação, Pessoas e resultados), ícones vetoriais e item ativo destacado.
- Barra superior com trilha de navegação, tema claro/escuro e perfil; botões e sino sem função foram removidos.
- Tipografia Inter, escala de tamanhos mais legível, botões/campos/abas/tabelas/modais padronizados, foco acessível, rolagem discreta e animações suaves.

## Novo Painel Executivo
- Saudação e resumo do dia (demandas abertas/vencidas e solicitações pendentes).
- Duas visões: **Visão estratégica** (taxa de conclusão, concluídas no mês, média do ranking, relatórios, demandas e solicitações por status, ranking Top 5) e **Controle operacional** (vencidas, vencem em 7 dias, reuniões próximas, demandas abertas por prioridade, solicitações, soluções sem demanda).
- Indicadores calculados dos dados reais; fonte indisponível não vira zero.

## Publicação
1. Envie o frontend ao GitHub (Vercel).
2. Republique a Edge Function `report-pdf`.
3. Não há SQL novo. (Para o Top 5 do ranking, mantenha as migrações v0190/v0191 aplicadas.)
