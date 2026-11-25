const CACHE = 'zenix-club-v3', ASSETS = ['./', './index.html', './css/app.css', './js/app.js', './js/store.js', './js/seed.js', './js/util.js', './js/qr.js', './manifest.webmanifest', './icon.svg', './icon-192.png', './icon-512.png'];
self.addEventListener('install', e => e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting())));
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x !== CACHE).map(x => caches.delete(x)))).then(() => self.clients.claim())));
// la API nunca se cachea; el resto va primero a la red y si no hay conexión usa la copia
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin || u.pathname.includes('/api/')) return;
  const page = e.request.mode === 'navigate';
  e.respondWith(fetch(e.request).then(r => { if (r.ok && !page) { const c = r.clone(); caches.open(CACHE).then(x => x.put(e.request, c)); } return r; })
    .catch(() => caches.match(e.request, { ignoreSearch: true }).then(r => r || (page ? caches.match(new URL('index.html', self.registration.scope).href) : Response.error()))));
});
