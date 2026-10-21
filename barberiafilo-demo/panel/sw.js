// App del panel: abre rápido y sigue mostrándose si se corta la conexión un momento.
const CACHE = "filo-panel-v2";
const SHELL = ["./", "./index.html", "./manifest.webmanifest", "../config.js", "../store.js", "../icons/panel-192.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== "GET") return;
  if (url.hostname.endsWith("supabase.co")) return;          // datos siempre en vivo
  const sameOrigin = url.origin === location.origin;
  const isLib = url.hostname === "cdn.jsdelivr.net" || url.hostname.startsWith("fonts.");
  if (!sameOrigin && !isLib) return;
  // primero la red (así siempre ves la última versión); si no hay conexión, lo guardado
  e.respondWith(
    fetch(req).then(res => {
      if (res.ok || res.type === "opaque") { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req).then(r => r || (req.mode === "navigate" ? caches.match("./index.html") : Response.error())))
  );
});
