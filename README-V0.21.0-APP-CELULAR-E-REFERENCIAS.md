# ELO V0.21.0 — App instalável (iPhone e Android) + referências visuais

## 1. Aplicativo no celular (PWA)
O ELO agora pode ser instalado na tela inicial como aplicativo, em tela cheia.
- **Ícone profissional** (marca do ELO sobre grafite com brilho verde) em todos os tamanhos: `public/icons/` (192, 512, maskable 512, Apple Touch 180, favicon 32/48).
- **Tela de abertura (splash)** do iPhone para 10 modelos (`public/splash/`), sem "flash" branco ao abrir.
- `manifest.webmanifest` (nome, cores, ícones e atalhos: Demandas, Solicitações, Relatórios), `sw.js` (service worker) e `vercel.json` (cabeçalhos corretos).
- **Funcionamento sem rede:** o app abre e mostra a estrutura; dados do Supabase nunca ficam em cache (sempre online). Quando offline aparece um aviso no topo.
- **Banner de instalação** no celular (Android: botão "Instalar"; iPhone: instrução "Adicionar à Tela de Início"). Também há "Instalar aplicativo" no menu e na busca (Ctrl/⌘ + K).
- Barra de status/entalhe respeitados (safe-area), campos com 16 px (sem zoom automático no iPhone), alvos de toque de 44 px, janelas viram "folha" inferior no celular.
- O tema (claro/escuro) e a preferência do menu ficam salvos no aparelho.

### Como instalar
- **iPhone (Safari):** abrir o endereço do ELO → botão Compartilhar → "Adicionar à Tela de Início" → Adicionar.
- **Android (Chrome):** abrir o endereço → botão "Instalar" do banner (ou menu ⋮ → "Instalar app").
- Requer HTTPS (a Vercel já fornece). Se o ícone antigo aparecer no iPhone, remova o atalho e adicione de novo.

## 2. Menu fixo ou oculto
Botão no topo do menu (ícone de painel) para **ocultar** o menu lateral; quando oculto, o conteúdo ocupa toda a largura e o botão ☰ da barra superior abre o menu sobre a tela, com o botão de **fixar** (alfinete) para voltar ao modo fixo. A escolha fica salva.

## 3. Melhores ideias das referências aplicadas
- **Busca global** na barra superior com atalho Ctrl/⌘ + K: ir para qualquer módulo, buscar demandas, solicitações, reuniões e relatórios pelo título, alternar tema, instalar app.
- **Painel Executivo:** cartões com mini-gráfico e variação semanal (▲/▼), **gráfico de área** de fluxo de demandas (30 dias), **rosca** de demandas por status, **atividade recente** e ranking com **anéis de pontuação**.
- **Anéis de pontuação** (cores por faixa) também no Ranking de Destaques.
- **Etiquetas de status com contorno**, abas e botões padronizados.
- **Cartão de progresso** no menu: avaliação da competência (colaboradores com pontuação completa).
- **Barra de navegação inferior** no celular (Painel, Demandas, Solicitações, Destaques, Mais).

## Publicação
1. Envie o projeto ao GitHub (Vercel). A pasta `public/` e o `vercel.json` precisam ir junto.
2. Não há SQL novo nem Edge Function nova.
3. Abra no celular e instale conforme o item 1.
