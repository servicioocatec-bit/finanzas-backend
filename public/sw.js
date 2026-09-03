/* Control Finanzas Studio — Service Worker v1 */
const CACHE = 'cfs-v1';
const SHELL = ['/app/', '/app/index.html', '/app/manifest.json', '/app/icons/icon-192.png', '/app/icons/icon-512.png'];
const CDN_HOSTS = ['cdn.jsdelivr.net', 'cdnjs.cloudflare.com', 'fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  /* API backend → siempre network, sin caché */
  if (url.pathname.startsWith('/api/')) { e.respondWith(fetch(e.request)); return; }
  /* CDN → stale-while-revalidate */
  if (CDN_HOSTS.includes(url.hostname)) {
    e.respondWith(caches.open(CACHE).then(c => c.match(e.request).then(cached => {
      const net = fetch(e.request).then(r => { if (r.ok) c.put(e.request, r.clone()); return r; });
      return cached || net;
    })));
    return;
  }
  /* Shell local → cache-first */
  if (url.origin === self.location.origin) {
    e.respondWith(caches.match(e.request).then(cached => cached || fetch(e.request).then(r => {
      caches.open(CACHE).then(c => c.put(e.request, r.clone())); return r;
    })));
    return;
  }
  e.respondWith(fetch(e.request));
});
