# ELO V0.14.3 — Logo oficial e edição de relatórios

## Alterações
- Substituída a imagem borrada pela PNG original Grupo System enviada.
- Adicionado o botão **Editar relatório** no relatório já gerado.
- Gestor pode editar título, resumo executivo, destaques, pontos de atenção, análise por categoria e plano de ação.
- Alterações são salvas no registro existente em `public.relatorios`; não é criado um novo relatório.
- Inclusa migração SQL separada para conceder atualização somente a usuários com `public.has_permission('relatorios','edit')`.

## Implantação
1. Publique o código do projeto na Vercel.
2. No Supabase SQL Editor, confira se a função `public.has_permission(text,text)` está disponível e execute `supabase/relatorios-v0143-edicao-gestor.sql`.
3. Não é necessário atualizar/recriar a Edge Function `generate-report` para habilitar a edição dos campos já gerados.
4. Entre com um usuário que tenha permissão `relatorios/edit`, abra um relatório gerado, clique em **Editar relatório**, faça uma alteração e salve.

## Observação de segurança
A edição depende da permissão `relatorios/edit` já usada pelo módulo. Usuários sem essa permissão não poderão gravar alterações no banco.
