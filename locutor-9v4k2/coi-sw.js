// Service worker de Locutor: agrega los encabezados que permiten usar varios núcleos
// (SharedArrayBuffer) en GitHub Pages, que no deja configurar encabezados propios.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.mode !== 'navigate') return;
  // Siempre consulta la versión más nueva de la página (sin esperar el caché de 10 minutos).
  e.respondWith(fetch(req.url, { cache: 'no-cache', credentials: 'same-origin' }).then(res => {
    if (!res || res.status === 0) return res;
    const headers = new Headers(res.headers);
    headers.set('Cross-Origin-Opener-Policy', 'same-origin');
    headers.set('Cross-Origin-Embedder-Policy', 'credentialless');
    return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
  }).catch(() => fetch(req)));
});
