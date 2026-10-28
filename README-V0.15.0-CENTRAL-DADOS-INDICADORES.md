# ELO V0.15.0 — Central de Dados e Indicadores Operacionais

## O que esta versão inclui

- Dashboard conectado a contagens reais do Supabase; remove os números demonstrativos fixos.
- Módulos operacionais com persistência no Supabase: Ideias, Projetos, Arquivos (registro/link), Agenda e Reuniões.
- Central de Indicadores com cadastro manual de registros, importação CSV e metas mensais por indicador/setor.
- Histórico de importações CSV e origem identificada (manual ou CSV).
- Correção do módulo Solicitações para usar as colunas reais em português (`titulo`, `descricao`, `categoria`, `prioridade`, `observacoes`) e geração sequencial do `codigo` quando ele não for identity.
- Migração aditiva com RLS e policies usando o mecanismo `public.has_permission` já utilizado pelo ELO.

## Implantação segura

1. Faça download e guarde uma cópia do projeto atual antes de publicar.
2. No Supabase correto do ELO, abra **SQL Editor → New query**.
3. Abra o arquivo `supabase/elo-v0150-central-dados-indicadores.sql`, copie todo o conteúdo e execute.
4. Confira a mensagem de sucesso. O SQL cria apenas tabelas novas ausentes e configura políticas; não apaga registros, funções, critérios, avaliações ou relatórios existentes.
5. Na aba **Usuários** do ELO, confira as permissões dos perfis que devem usar Demandas, Ideias, Projetos, Arquivos, Agenda, Reuniões e Indicadores. O SQL não concede permissões extras automaticamente.
6. Publique a pasta do projeto no Vercel, mantendo as mesmas variáveis `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`.
7. Teste login, criação/edição e leitura em cada módulo, depois teste uma importação CSV pequena antes de importar uma planilha grande.

## CSV de indicadores

Cabeçalho mínimo obrigatório: `indicador;valor`.

Campos aceitos: `data`, `setor`, `colaborador`, `indicador`, `valor`, `unidade`, `observacao`.

Exemplo:

```csv
data;setor;colaborador;indicador;valor;unidade;observacao
2026-10-01;Atendimento;Ana;Atendimentos concluídos;84;quantidade;Fechamento diário
2026-10-01;Atendimento;Bruno;Tempo médio de resposta;6.4;minutos;Planilha operacional
```

Use CSV UTF-8. Esta versão importa linhas como novos registros; não faz deduplicação automática nem interpreta todos os formatos de aspas do CSV. Em caso de falha durante um arquivo grande, verifique os registros inseridos antes de repetir a importação.

## Limites conhecidos / transparência

- O painel não inventa dados de faltas, atrasos, jornada, satisfação ou tempo de atendimento. Esses indicadores precisam ser cadastrados/importados ou receber integração com a fonte oficial.
- Os valores do dashboard representam contagens do banco e média dos campos de qualidade disponíveis; ainda não são um sistema completo de integração com folha de ponto/telefonia/CRM.
- Os registros do módulo Arquivos são metadados e links; esta versão não faz upload binário para Storage.
- O módulo Relatórios e a pontuação oficial do Destaque do Mês foram preservados. Não foram incluídas alterações nas Edge Functions de análise ou geração de relatórios.

## Validação

O arquivo JSX foi verificado por transpilação sintática com o compilador TypeScript disponível no ambiente. A compilação Vite completa não pôde ser executada aqui porque as dependências npm não estavam disponíveis e a instalação não concluiu. Portanto, faça o build no ambiente com dependências instaladas antes de publicar.
