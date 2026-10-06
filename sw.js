const CACHE = 'lt-words-v0.1.6';
const CORE = ['/', '/index.html', '/styles.css?v=0.1.6', '/js/app.js?v=0.1.6', '/js/theme.js?v=0.1.3', '/js/core.js', '/data/words.json', '/manifest.webmanifest', '/icon.svg', '/icons/icon-192.png', '/icons/icon-512.png'];
// Activate only after the complete new offline bundle has been cached.
self.addEventListener('install', event => { event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(CORE)).then(() => self.skipWaiting())); });
self.addEventListener('activate', event => { event.waitUntil(Promise.all([caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('lt-words-') && key !== CACHE).map(key => caches.delete(key)))), self.clients.claim()])); });
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    // Online navigation must see the latest HTML and its versioned scripts.
    if (event.request.mode === 'navigate') {
      try {
        const response = await fetch(event.request, { cache: 'no-store' });
        if (response.ok) return response;
      } catch { /* Fall back to the installed offline page. */ }
      return (await cache.match('/index.html')) || Response.error();
    }
    const cached = await cache.match(event.request, { ignoreSearch: event.request.mode === 'navigate' });
    if (cached) return cached;
    try {
      const response = await fetch(event.request);
      if (response.ok && (event.request.destination === 'image' || event.request.destination === 'audio')) cache.put(event.request, response.clone()).catch(() => {});
      return response;
    } catch {
      if (event.request.mode === 'navigate') return cache.match('/index.html');
      return Response.error();
    }
  })());
});
