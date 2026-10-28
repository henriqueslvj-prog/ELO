# ELO V0.16.0 — Painel Executivo

## Objetivo

Adicionar ao ELO um Painel Executivo com duas perspectivas de leitura: **Supervisão** (controle operacional) e **Diretoria** (visão estratégica consolidada), reutilizando as tabelas já existentes na V0.15.0.

## O que mudou

- O item inicial do menu agora se chama **Painel Executivo**.
- Foram adicionadas duas visões selecionáveis no próprio painel:
  - **Supervisão:** demandas por status, solicitações por status, contagem de demandas vencidas e total de avaliações com nota.
  - **Diretoria:** projetos por status, ideias por status, total de registros da Central de Dados e total de metas cadastradas.
- Os cartões e os quadros de status consultam o Supabase. Erros de consulta aparecem como indisponibilidade, e não como zero.
- Foi adicionado botão para atualizar os dados manualmente e indicação do horário da última consulta.
- O painel identifica os estados conhecidos nos módulos e não apresenta dados demonstrativos.
- O visual é responsivo para desktop e dispositivos móveis e acompanha os temas escuro/claro existentes.

## Fontes usadas

- `demandas`: contagem, status e prazo (`due_date`).
- `solicitacoes`: contagem e status.
- `projetos`: contagem e status.
- `ideias`: contagem e status.
- `indicadores_registros`: total de registros da Central de Dados.
- `indicadores_metas`: total de metas cadastradas.
- `destaque_avaliacoes`: quantidade de avaliações com `quality_avg_100` preenchido.

## Cuidados metodológicos

- A quantidade de registros não deve ser interpretada automaticamente como produtividade.
- A contagem de avaliações com nota não é uma nota média; a tela direciona ao módulo Destaques para consulta detalhada.
- O painel ainda não calcula evolução mensal nem realizado versus meta. Esses cálculos exigem regras confirmadas de período, unidade, setor e agregação; não foram inventados nesta versão.
- A contagem de demandas vencidas considera `due_date` anterior à data local do navegador e exclui status `concluida` e `cancelada`.
- A alternância entre Supervisão e Diretoria muda a perspectiva apresentada, não substitui a autorização. A proteção dos dados continua dependendo das permissões e políticas RLS já configuradas no Supabase.
- O CSV continua sendo ingerido pela Central de Dados. Nenhuma integração externa nova foi configurada.

## Banco de dados

**Não há migração SQL obrigatória nesta versão.** O painel utiliza tabelas e colunas já presentes na base da V0.15.0. Não execute arquivos SQL antigos como parte desta atualização.

## Publicação segura

1. Guarde uma cópia do ZIP funcional V0.15.0.
2. Extraia o ZIP V0.16.0 em uma pasta separada.
3. Preserve as mesmas variáveis de ambiente já usadas no Vercel: `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`.
4. Instale as dependências no ambiente de desenvolvimento e execute `npm run build`.
5. Teste com uma conta supervisora e uma conta de diretoria/gestor, confirmando as permissões configuradas no painel de Usuários.
6. Teste também as contas que não têm acesso a todos os módulos: fontes sem permissão devem aparecer como indisponíveis.
7. Só publique após validar o Dashboard, Demandas, Solicitações, Destaques e Relatórios.

## Validação realizada nesta entrega

- `src/main.jsx` passou por transpilação sintática JSX/TypeScript sem diagnósticos.
- O build completo do Vite não foi validado neste ambiente, pois as dependências locais não estão instaladas. Execute `npm install` e `npm run build` antes da publicação.
- Não foram alteradas tabelas, registros, funções Edge, regras de pontuação, histórico do Destaque do Mês ou lógica de Relatórios.
