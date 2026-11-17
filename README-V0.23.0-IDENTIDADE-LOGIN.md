# ELO V0.23.0 — Nova identidade visual e telas de acesso

## Novidades
- **Telas de acesso redesenhadas** (login, recuperação de senha, nova senha e verificação em 2 etapas) com uma estrutura única (`AuthShell`): arte da marca à esquerda + formulário à direita, campos com rótulo sobre a borda, botão de mostrar/ocultar senha, ação primária (Verde Elo) e secundária (Lima Spark, "Solicitar acesso"), rodapé com Termos e Segurança, tema claro/escuro e versão para celular.
- **Arte original** em elos de vidro esmeralda (vetorial, animada) e **marca com fundo transparente**.
- **Carregamento com a marca** (substitui o texto simples).
- **Identidade**: paleta (Verde Elo, Esmeralda, Menta, Lima Spark, Grafite, Névoa), tipografia **Sora + Inter**, regras de forma, movimento e voz — documentadas em `docs/IDENTIDADE-VISUAL.md`.
- Menu lateral e painel passam a usar Sora nos títulos/números e a marca transparente.

## Publicação
1. Envie ao GitHub (Vercel). Não há SQL nem função nova.
2. (Opcional) variável `VITE_ACCESS_EMAIL` na Vercel: e-mail exibido em "Solicitar acesso".
3. As fontes Sora e Inter carregam do Google Fonts (já permitido na CSP).
