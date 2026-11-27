// Flama · service worker: permite instalar la app y guarda las fotos para que cargue rápido.
// Nunca guarda la API (/api/*): pedidos, precios y panel siempre van en vivo.
const CACHE = 'flama-img-v1';
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil((async () => {
  for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k);
  await self.clients.claim();
})()));
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin || u.pathname.includes('/api/')) return;
  if (/\/img\/[^/]+\.(webp|png)$/.test(u.pathname)) {
    e.respondWith(caches.open(CACHE).then(async c => (await c.match(e.request)) || fetch(e.request).then(r => { if (r.ok) c.put(e.request, r.clone()); return r; })));
    return;
  }
  if (e.request.mode === 'navigate') {
    e.respondWith(fetch(e.request).catch(() => new Response('<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><body style="background:#17100d;color:#fff2d8;font:18px system-ui;display:grid;place-items:center;height:100vh;text-align:center;margin:0"><div><h2>Sin conexión</h2><p>Revisá tu internet y volvé a intentar.</p></div>', { headers: { 'Content-Type': 'text/html; charset=utf-8' } })));
  }
});
