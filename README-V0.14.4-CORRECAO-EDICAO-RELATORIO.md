# ELO V0.14.4 — Correção da edição do relatório

## Correção
- Corrigido o comportamento em que o cursor perdia o foco e o campo parecia subir/reiniciar ao digitar ou inserir quebras de linha no editor de relatórios.
- Causa: o componente de visualização/edição do relatório era declarado dentro de `RelatoriosManager` e renderizado como componente React separado. Cada atualização de estado recriava o tipo do componente, desmontando e montando novamente os campos.
- Solução: o documento é renderizado como função sem estado próprio, mantendo os campos de edição montados durante as atualizações do rascunho.
- Preservados a logo do Grupo System Saúde e os recursos de edição/salvamento já incluídos na V0.14.3.

## Publicação
1. Extraia o ZIP e publique o projeto na Vercel.
2. Não é necessário executar SQL adicional para esta correção.
3. Não é necessário atualizar a Edge Function `generate-report`.
4. Teste edição do título e de cada campo de texto, incluindo pressionar Enter para criar novas linhas.

Observação: o pacote foi corrigido no código-fonte; valide a compilação e o comportamento no ambiente publicado antes de considerar concluído.
