# ELO V0.13 — Avaliação Especialista de Atendimento

## O que mudou

### IA especialista
A avaliação de atendimento passou a usar 5 critérios de 0 a 3 pontos:

1. Acolhimento e cordialidade
2. Tempo e responsividade
3. Clareza e qualidade da resposta
4. Resolução da solicitação
5. Condução e profissionalismo

Com pesos padrão de 20% cada, a nota máxima por atendimento e por avaliação mensal é **15 pontos**.

A IA também retorna:
- solicitação do cliente;
- status da resolução;
- primeira resposta e maior intervalo relevante, quando identificáveis;
- parecer técnico do especialista;
- evidências e pontos de atenção por critério.

### Exclusão de avaliação
O botão **Excluir avaliação** usa a Edge Function `delete-attendance-evaluation`.
A exclusão é lógica: remove a análise e a pontuação do cálculo, mas preserva o PDF para histórico técnico.

### Consolidação mensal
A média dos atendimentos do mesmo colaborador e competência é recalculada automaticamente. A pontuação mensal é ponderada e convertida para escala de 0 a 15.

## Ordem de implantação

1. Execute no Supabase SQL Editor:
   `supabase/destaques-v013-avaliacao-especialista.sql`
2. Publique a Edge Function:
   `analyze-attendance`
3. Publique a Edge Function:
   `delete-attendance-evaluation`
4. Faça o deploy do frontend desta versão.

## Observação sobre dados antigos
Os critérios antigos de IA são desativados. As notas antigas desses critérios são retiradas da consolidação para que a nova escala não misture avaliações de 0–10 com avaliações de 0–3. Os registros históricos dos atendimentos continuam armazenados.

## Segurança
A exclusão usa autenticação do usuário e verifica a permissão `destaques/delete`. A alteração privilegiada do registro é feita no servidor; nenhuma chave Service Role/Secret deve ser colocada no frontend.
