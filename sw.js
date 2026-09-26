const CACHE = 'lt-words-v0.1.1';
const CORE = ['/', '/index.html', '/styles.css', '/js/app.js', '/js/core.js', '/data/words.json', '/manifest.webmanifest', '/icon.svg', '/icons/icon-192.png', '/icons/icon-512.png'];
self.addEventListener('install', event => { event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(CORE))); });
self.addEventListener('activate', event => { event.waitUntil(Promise.all([caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('lt-words-') && key !== CACHE).map(key => caches.delete(key)))), self.clients.claim()])); });
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
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
