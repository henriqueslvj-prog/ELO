# Identidade visual do ELO (V0.23)

## Conceito
**"Elo" é o que liga.** A marca (dois laços entrelaçados) representa **pessoas, processos e resultados conectados**. A arte das telas de acesso amplia esse símbolo em **elos de vidro esmeralda**, com uma faísca lima como assinatura.

Frase de posicionamento: *Pessoas, processos e resultados — conectados.*

## Princípios de UI/UX
1. **Clareza primeiro**: uma ação principal por tela; a ação secundária tem destaque próprio, mas nunca compete.
2. **Conexão**: telas de acesso (login, recuperação, 2FA) usam a **mesma estrutura** (`AuthShell`); navegação, dados e linguagem seguem os mesmos padrões em todo o sistema.
3. **Confiança visível**: conexão protegida, 2FA, termos e política sempre à mão.
4. **Faísca**: o **Lima Spark** aparece **no máximo uma vez por tela** para guiar o olhar.
5. **Paridade de temas**: todo componente existe em claro e escuro, com contraste mínimo de 4,5:1 no texto.

## Paleta
| Nome | Hex | Uso |
|---|---|---|
| Verde Elo | `#08804f` | Ações primárias (4,99:1 com branco) |
| Esmeralda | `#1fb575` | Destaques no escuro, indicadores, ícones ativos |
| Menta | `#34f0a8` | Foco, brilhos, estados ativos no escuro |
| Lima Spark | `#d4f542` | Faísca: ação secundária de destaque, realce de palavra-chave |
| Grafite | `#0b0e12` | Fundo escuro |
| Grafite 2 | `#11161c` | Superfícies no escuro |
| Névoa | `#f1f4f2` | Fundo claro |
| Estados | `#e0b34a` alerta · `#e5645a` erro · `#5aa9e6` info | Status e avisos |

**Não fazer:** texto lima sobre fundo claro; lima em mais de um elemento por tela; verde de ação primária com texto escuro; sombras pesadas.

## Tipografia
- **Sora** (700): títulos, números e KPIs, com espaçamento −0,02 em.
- **Inter** (400–700): textos, tabelas e formulários.
- Escala: 12 · 13 · 14 · 16 · 20 · 26 · 32 px. Entrelinha 1,5–1,7 em texto corrido.
- Ambas via Google Fonts (já liberadas na CSP do `vercel.json`).

## Forma e movimento
- Raios: **10** (campos e botões) · **14** (cartões) · **18** (janelas) · **pílula** (status).
- Grade de **4 px**. Bordas antes de sombras; sombras suaves.
- Ícones: 24 px, traço 1,8 arredondado (`src/ico.jsx`).
- Movimento: 150–260 ms; arte de acesso com flutuação lenta; respeita `prefers-reduced-motion`.

## Componentes de acesso (padrão)
- Divisão em duas colunas: **arte da marca** (esquerda) + **formulário** (direita); no celular a arte vira faixa no topo.
- Campos com **rótulo sobre a borda**, botão de **mostrar/ocultar senha** acoplado, mensagens de erro/nota com ícone de cor semântica.
- Ação primária em **Verde Elo**; ação secundária em **Lima Spark** (ex.: *Solicitar acesso*).
- Rodapé com marca, "Conexão protegida", **Termos de Uso** e **Segurança e Privacidade**.
- Tema claro/escuro com preferência salva (`elo_theme`) e compartilhada com o sistema.
- Carregamento com a marca (`BrandLoader`).

## Arquivos
- Arte: `docs/brand/elo-arte-login.svg` (vetorial) e componente `LoginArt` em `src/auth.jsx`.
- Marca transparente: `src/assets/elo-mark-alpha.png`.
- Estrutura/campos: `src/auth.jsx`; estilos: bloco "V0.23" de `src/styles.css`.

## Voz e tom
Direto, cordial e em português do Brasil, tratando a pessoa por "você". Mensagens de erro dizem **o que houve e o que fazer**. Evitar jargão e exclamações.

## Observação sobre a referência
O layout das telas de acesso foi inspirado na **estrutura** (divisão em duas colunas, campos contornados, ação primária e secundária) de uma referência fornecida. Cores, arte, marca e tipografia são **originais do ELO**.
