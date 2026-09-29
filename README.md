# ELO — Solicitações V0.7

Fluxo:
NOVA → EM ANÁLISE → APROVADA / RECUSADA → DEMANDA GERADA

O módulo registra solicitante, responsável pela análise, título, descrição,
categoria, prioridade, prazo desejado, status e observações.

Também cria o vínculo `solicitacao_id` em Demandas quando a tabela já existir,
permitindo rastrear a origem de uma demanda.

Execute `solicitacoes_v0_7.sql` no SQL Editor do Supabase.
