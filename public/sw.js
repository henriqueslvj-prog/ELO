/* ELO — Service Worker (V0.21)
   Objetivo: abrir o app rápido e mostrar a estrutura mesmo sem conexão.
   Regras:
   - Dados do Supabase e qualquer outra origem NUNCA passam pelo cache (sempre rede).
   - Navegação: rede primeiro; sem rede, usa a última versão do app salva.
   - Arquivos estáticos do próprio site (JS/CSS/imagens): usa o cache e atualiza em segundo plano.
   - Fontes do Google: cache de longa duração. */
const VERSION = 'elo-v0.21.0';
const STATIC = `${VERSION}-static`;
const FONTS = `${VERSION}-fonts`;
const SHELL = ['/', '/manifest.webmanifest', '/icons/icon-192.png', '/icons/icon-512.png', '/icons/apple-touch-icon.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(STATIC).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Fontes (Google Fonts): cache primeiro
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(
      caches.open(FONTS).then((cache) =>
        cache.match(req).then((hit) => hit || fetch(req).then((res) => { if (res.ok || res.type === 'opaque') cache.put(req, res.clone()); return res; }))
      )
    );
    return;
  }

  // Qualquer outra origem (Supabase, APIs): sempre rede, sem cache
  if (url.origin !== self.location.origin) return;

  // Navegação: rede primeiro, com a última versão como reserva
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => { const copy = res.clone(); caches.open(STATIC).then((c) => c.put('/', copy)); return res; })
        .catch(() => caches.match('/'))
    );
    return;
  }

  // Estáticos do próprio site: cache + atualização em segundo plano
  event.respondWith(
    caches.match(req).then((hit) => {
      const network = fetch(req)
        .then((res) => { if (res.ok && res.type === 'basic') { const copy = res.clone(); caches.open(STATIC).then((c) => c.put(req, copy)); } return res; })
        .catch(() => hit);
      return hit || network;
    })
  );
});
