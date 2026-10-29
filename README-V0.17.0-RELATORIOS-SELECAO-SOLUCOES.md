# ELO V0.17.0 — Relatórios: seleção de observações e soluções

## Novidades
1. **Observações selecionáveis.** Na aba *Gerar relatório*, após escolher o período, todas as observações do intervalo aparecem com caixa de seleção (todas marcadas por padrão). É possível filtrar por categoria e usar *Marcar visíveis* / *Desmarcar visíveis*. Só as marcadas entram no relatório; assim dá para gerar vários relatórios distintos sobre o mesmo período (ex.: um só de Ocorrências, outro só de Treinamento).
2. **Nome do relatório (opcional)** para diferenciar relatórios do mesmo período.
3. **Possíveis soluções (opcional).** Caixa *Incluir possíveis soluções no relatório* na geração, ou o botão **✦ Incluir soluções** dentro de um relatório já gerado (e **Remover soluções**). A IA propõe 1 a 4 soluções por problema identificado, com prioridade, sempre identificadas como sugestões a validar. A seção é editável em *Editar relatório* (formato: `Problema | solução 1 ; solução 2 | prioridade`).
4. **Registros considerados**: o relatório passa a listar quais observações o compõem (data, categoria, título).
5. Cópia de texto inclui as soluções.

## Publicação
1. Publique o frontend (GitHub → Vercel).
2. **Publique novamente a Edge Function `generate-report`** (`supabase/functions/generate-report/index.ts`).
3. Nenhuma migração SQL é necessária. Remover soluções e editar usam a permissão `relatorios/edit` já existente; *Incluir soluções* num relatório gerado exige a mesma permissão.

## Observações
- Relatórios gerados antes desta versão não guardam a lista de observações; ao incluir soluções neles, a IA usa todas as observações do período.
- Limite de 500 observações por relatório.
