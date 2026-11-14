// Service worker do app (PWA): guarda uma cópia dos arquivos do site (HTML, css/, js/, fontes, ícones) para o app
// abrir mais rápido e mesmo com a internet ruim. Sempre tenta a rede primeiro, então quem está on-line recebe a versão
// nova na hora; a cópia só é usada quando a rede falha. Os dados (Supabase) e o versao.json nunca passam por aqui.
// Produção (/App-Treino/) e desenvolvimento (/App-Treino/dev/) têm cada um o seu, com caches separados.
const ESCOPO = new URL(self.registration.scope).pathname;
const CACHE = `arquivos:${ESCOPO}`;

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => {
  // Apaga caches de versões antigas deste mesmo escopo (o nome muda se o formato mudar).
  e.waitUntil(caches.keys()
    .then((nomes) => Promise.all(nomes.filter((n) => n.endsWith(`:${ESCOPO}`) && n !== CACHE).map((n) => caches.delete(n))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // Só os arquivos do próprio site (a biblioteca do Supabase fica em js/vendor/), dentro do escopo. O /dev/ tem o seu próprio service worker.
  if (url.origin !== location.origin || !url.pathname.startsWith(ESCOPO)) return;
  if (url.pathname.startsWith(`${ESCOPO}dev/`)) return;
  if (url.pathname.endsWith('/versao.json') || url.pathname.endsWith('/sw.js')) return;
  const navegacao = req.mode === 'navigate';
  e.respondWith(fetch(req).then((resp) => {
    // Volta do login (?code=...) e respostas com erro não ficam guardadas.
    if (resp.ok && resp.type === 'basic' && !url.search.includes('code=')) {
      const copia = resp.clone();
      caches.open(CACHE).then((c) => c.put(navegacao ? new Request(url.origin + url.pathname) : req, copia)).catch(() => {});
    }
    return resp;
  }).catch(() => caches.open(CACHE).then(async (c) => (
    navegacao
      ? (await c.match(url.origin + url.pathname)) || (await c.match(url.origin + ESCOPO)) || (await c.match(url.origin + ESCOPO + 'index.html'))
      : await c.match(req)
  ) || Response.error())));
});
