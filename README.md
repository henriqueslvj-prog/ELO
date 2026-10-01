# ELO V0.10 — Motor de Avaliação com Base de Referência

## Nova arquitetura

O módulo de Destaque do Mês passa a trabalhar em quatro camadas:

```text
PDF do atendimento
      ↓
Extração de texto (PDF.js)
      ↓
Texto da conversa
      ↓
IA (Gemini)
      ↓
Critérios + referências oficiais vinculadas
      ↓
Notas + evidências + pontos de atenção
      ↓
Motor do ELO
      ↓
Peso / elegibilidade / resultado
```

A IA não escolhe o Destaque do Mês e não compara colaboradores.

## Base oficial do atendimento

Foi criada a tabela `public.destaque_referencias_ia` para armazenar materiais oficiais usados como base de avaliação.

Também foi criada `public.destaque_criterio_referencias`, que permite vincular uma ou mais referências a cada critério.

O roteiro fornecido pela System Saúde foi cadastrado como:

- `Roteiro de Atendimento — System Saúde`
- versão `1.0`
- tipo `script_atendimento`
- slug `system-saude-roteiro-atendimento`

O SQL tenta vinculá-lo automaticamente ao critério:

`Qualidade do Atendimento`

## Como a IA avaliará o roteiro

Para o critério vinculado ao roteiro, a IA receberá:

1. a regra do critério;
2. o roteiro oficial;
3. o texto extraído do atendimento.

Ela deverá avaliar aderência ao processo e à intenção das etapas, sem exigir repetição literal das frases.

Etapas não aplicáveis ao caso não devem ser penalizadas.

A IA também diferencia:

- falha de execução;
- etapa não aplicável;
- evidência insuficiente;
- variação natural de linguagem.

## Banco de dados

Execute no Supabase SQL Editor, nesta ordem:

1. `supabase/destaques.sql` — caso ainda não tenha sido executado.
2. `supabase/destaques-fix.sql` — caso sua base utilize a correção de integridade da equipe avaliada.
3. `supabase/destaques-referencias.sql` — NOVA ARQUITETURA V0.10.

Se o critério `Qualidade do Atendimento` já existir, o terceiro SQL fará o vínculo automaticamente.

## Edge Function

Arquivo:

`supabase/functions/analyze-attendance/index.ts`

Ela agora:

- baixa o PDF do Storage privado;
- extrai texto com PDF.js;
- não envia o PDF para o Gemini;
- carrega as referências vinculadas aos critérios;
- envia texto + critérios + referências ao Gemini;
- salva método de extração e referências utilizadas na análise.

Deploy:

```bash
supabase functions deploy analyze-attendance
```

Secret necessário:

```text
GEMINI_API_KEY
```

## Interface

Foi adicionada a aba `Base da IA` dentro de `Destaques` para visualizar as referências cadastradas e o roteiro oficial utilizado pela avaliação.

## Próxima evolução prevista

Se houver PDF sem camada de texto, o ELO poderá encaminhar o arquivo para uma segunda etapa de OCR, mantendo o mesmo motor de avaliação. Isso evita alterar a lógica dos critérios quando a origem do texto mudar.

## V0.11 — Avaliação mensal por colaborador

- Atendimentos ficam filtrados por colaborador e ciclo mensal.
- A aba **Pontuação mensal** mostra a composição da avaliação de uma pessoa em um período.
- Critérios `ia` são consolidados automaticamente pela Edge Function a partir dos atendimentos analisados no ciclo.
- Critérios `manual` e `sistema` podem receber nota do gestor de 0 a 10 e observação.
- As notas manuais ficam registradas em `destaque_avaliacao_itens` com usuário e data de lançamento.
- A avaliação mensal é armazenada em `destaque_avaliacoes` e seus critérios em `destaque_avaliacao_itens`.
- Execute `supabase/destaques-avaliacao-mensal.sql` antes de usar a nova pontuação mensal.
