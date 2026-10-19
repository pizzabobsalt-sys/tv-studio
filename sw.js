/* TV Studio service worker: works offline after the first visit.
   Bump VER when you upload a new index.html so devices drop the old copy. */
const VER = 'tvstudio-v1';
const SHELL = ['./', './index.html', './manifest.webmanifest', './icon-180.png', './icon-192.png', './icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VER).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith('tvstudio-') && k !== VER).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method !== 'GET') return;
  const u = new URL(r.url);
  const isFont = u.hostname === 'fonts.googleapis.com' || u.hostname === 'fonts.gstatic.com';
  if (u.origin !== self.location.origin && !isFont) return;

  if (isFont) {                       // cache fonts after first load
    e.respondWith(caches.open(VER).then(async c => {
      const hit = await c.match(r);
      const net = fetch(r).then(res => { try { c.put(r, res.clone()); } catch (_) {} return res; }).catch(() => hit);
      return hit || net;
    }));
    return;
  }

  if (r.mode === 'navigate') {        // page: network first, cached copy when offline
    e.respondWith(
      fetch(r).then(res => {
        if (res.ok) { const copy = res.clone(); caches.open(VER).then(c => c.put('./index.html', copy)); }
        return res;
      }).catch(() => caches.match('./index.html'))
    );
    return;
  }

  e.respondWith(caches.match(r).then(hit => hit || fetch(r)));
});
