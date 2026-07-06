// Emberbrook service worker — network-first for app files so updates land
// immediately; cached copies serve as the offline fallback.
const CACHE = 'emberbrook-v2.6.0'; // bump on every release
const APP_FILES = ['/', '/game.js', '/manifest.json', '/icon-192.png', '/icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(APP_FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return;
  if (url.pathname.startsWith('/api/')) return; // sync calls: network only
  e.respondWith(
    // no-store so an online client always gets the newest build (true
    // network-first); the SW cache below is only the offline fallback.
    fetch(e.request, {cache: 'no-store'})
      .then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy));
        return res;
      })
      .catch(() => caches.match(e.request, {ignoreSearch: true}))
  );
});
