/* Service worker for the TV Studio web app.
   Keeps the app shell available offline without caching live streams or recordings. */
'use strict';

const CACHE_NAME = 'tv-studio-shell-v2';
const APP_SHELL = ['./', './index.html'];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    for (const url of APP_SHELL) {
      try {
        const response = await fetch(url, { cache: 'reload' });
        if (response.ok && response.type === 'basic') await cache.put(url, response);
      } catch (_) {
        // The shell may be hosted at a path that does not expose both aliases.
      }
    }
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith('tv-studio-shell-') && key !== CACHE_NAME)
      .map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Never cache live streams, media segments, or generated recording files.
  if (/\.(m3u8|m3u|ts|m4s|mp4|webm|mp3|aac|wav|ogg)(?:$|\?)/i.test(url.pathname + url.search)) return;
  if (request.headers.has('range')) return;

  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      try {
        const response = await fetch(request);
        if (response.ok) {
          const key = new URL('./', self.registration.scope).href;
          await cache.put(key, response.clone());
        }
        return response;
      } catch (_) {
        return (await cache.match(request)) || (await cache.match('./')) || Response.error();
      }
    })());
    return;
  }

  // Same-origin app resources: use cached copies offline and refresh them in the background.
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(request);
    const network = fetch(request).then(response => {
      if (response.ok && response.type === 'basic') cache.put(request, response.clone());
      return response;
    }).catch(() => null);
    if (cached) {
      event.waitUntil(network);
      return cached;
    }
    return (await network) || Response.error();
  })());
});
