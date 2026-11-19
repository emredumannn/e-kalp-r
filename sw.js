// Uygulama kabuğunu önbellekler. Supabase istekleri her zaman ağdan gider.
// Siteyi güncellediğinde VERSION'u bir artır.
const VERSION = 'ekalpr-v15';
const SHELL = [
  './', './index.html', './css/style.css', './manifest.webmanifest',
  './js/app.js', './js/api.js', './js/config.js', './js/dualar.js', './js/icons.js', './js/oyunlar.js', './css/sohbet-oyun.css', './css/gece.css', './css/ozet-kilit.css', './css/temalar.css', './js/sorular.js', './js/yildiz.js', './js/cizim.js', './js/bahce.js', './js/dunya.js', './css/yaratici.css', './data/gok.json',
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

// ---------------------------------------------------------------- telefon bildirimleri
self.addEventListener('push', e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = { body: e.data && e.data.text() }; }
  e.waitUntil((async () => {
    await self.registration.showNotification(d.title || 'E ❤ R', {
      body: d.body || '',
      icon: './icons/icon-192.png',
      badge: './icons/icon-192.png',
      tag: d.tag || undefined,
      renotify: !!d.tag,
      data: { url: d.url || './' },
    });
    try { await self.navigator.setAppBadge?.(1); } catch {}
  })());
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = new URL(e.notification.data?.url || './', self.registration.scope).href;
  e.waitUntil((async () => {
    const wins = await clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of wins) {
      if (c.url.startsWith(self.registration.scope)) {
        c.postMessage({ nav: new URL(url).hash || '#/' });
        return c.focus();
      }
    }
    return clients.openWindow(url);
  })());
});
