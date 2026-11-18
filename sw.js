// Uygulama kabuğunu önbellekler. Supabase istekleri her zaman ağdan gider.
// Siteyi güncellediğinde VERSION'u bir artır.
const VERSION = 'ekalpr-v5';
const SHELL = [
  './', './index.html', './css/style.css', './manifest.webmanifest',
  './js/app.js', './js/api.js', './js/config.js', './js/dualar.js', './js/icons.js',
  './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('message', e => { if (e.data === 'skip') self.skipWaiting(); });

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.hostname.endsWith('supabase.co')) return;
  if (url.origin === location.origin) {
    // Sayfa: önce ağ, yoksa önbellek. Diğer dosyalar: önce önbellek.
    if (e.request.mode === 'navigate') {
      e.respondWith(fetch(e.request).catch(() => caches.match('./index.html')));
    } else {
      e.respondWith(caches.match(e.request).then(r => r || fetch(e.request)));
    }
    return;
  }
  // Fontlar ve supabase-js kütüphanesi: önbellekte tut
  if (/fonts\.(googleapis|gstatic)\.com|cdn\.jsdelivr\.net/.test(url.hostname)) {
    e.respondWith(caches.open(VERSION).then(async c => {
      const hit = await c.match(e.request);
      if (hit) return hit;
      const res = await fetch(e.request);
      if (res.ok || res.type === 'opaque') c.put(e.request, res.clone());
      return res;
    }));
  }
});
