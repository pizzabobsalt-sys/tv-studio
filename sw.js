
/* Service worker for the TV Studio web app.
   Keeps the app shell available offline without caching live streams or recordings.
   Browser FFmpeg fallback is loaded on demand from its CDN and needs a network connection on first use. */

'use strict';

const CACHE_NAME = 'tv-studio-shell-v12';
const APP_SHELL = ['./', './index.html'];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);

    for (const url of APP_SHELL) {
      try {
        const response = await fetch(url, { cache: 'reload' });
        if (response.ok && response.type === 'basic') {
          await cache.put(url, response);
        }
      } catch (_) {
        // Either app-shell URL may be unavailable on some hosting paths.
      }
    }

    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();

    await Promise.all(
      keys
        .filter(key =>
          key.startsWith('tv-studio-shell-') &&
          key !== CACHE_NAME
        )
        .map(key => caches.delete(key))
    );

    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;

  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  if (url.origin !== self.location.origin) return;

  // Never cache video/audio files or media segments.
  if (/\.(m3u8|m3u|ts|m2ts|mts|m4s|mp4|m4v|webm|mkv|avi|mov|flv|wmv|mpg|mpeg|3gp|ogv|vob|mxf|mp3|m4a|aac|ac3|wav|ogg|mka)(?:$|\?)/i.test(url.pathname + url.search)) {
    return;
  }

  if (request.headers.has('range')) return;

  // For page navigation, prefer the network and use the cache offline.
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
        return (await cache.match(request)) ||
               (await cache.match('./')) ||
               Response.error();
      }
    })());

    return;
  }

  // App code and styles must be network-first so GitHub Pages updates appear promptly.
  // Fall back to the cached copy only when offline.
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const isAppCode = /\.(?:html?|js|mjs|css)(?:$|\?)/i.test(url.pathname + url.search) ||
      url.pathname.endsWith('/') || url.pathname.endsWith('/index');

    try {
      const response = await fetch(request, { cache: isAppCode ? 'no-store' : 'no-cache' });
      if (response.ok && response.type === 'basic') {
        await cache.put(request, response.clone());
      }
      return response;
    } catch (_) {
      return (await cache.match(request)) || Response.error();
    }
  })());
});
