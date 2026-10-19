/* TV Studio service worker: works offline after the first visit.
   Bump VER when you upload a new index.html so devices drop the old copy. */
const VER = 'tvstudio-v11';
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


const idb=id=>new Promise(res=>{const o=indexedDB.open('tvstudio',1);o.onsuccess=()=>{try{const q=o.result.transaction('files').objectStore('files').get(id);q.onsuccess=()=>res(q.result||null);q.onerror=()=>res(null);}catch(e){res(null);}};o.onerror=()=>res(null);});
async function media(r,id){const b=await idb(id);if(!b)return new Response('',{status:404});const h={'Content-Type':new URL(r.url).searchParams.get('s')?'text/plain; charset=utf-8':(b.type||'video/mp4'),'Accept-Ranges':'bytes','Access-Control-Allow-Origin':'*'},m=/bytes=(\d*)-(\d*)/.exec(r.headers.get('range')||'');if(!m)return new Response(b,{headers:{...h,'Content-Length':b.size}});let s=m[1]?+m[1]:0,e=m[2]?Math.min(+m[2],b.size-1):b.size-1;if(!m[1]&&m[2]){s=b.size-+m[2];e=b.size-1;}return new Response(b.slice(s,e+1),{status:206,headers:{...h,'Content-Range':`bytes ${s}-${e}/${b.size}`,'Content-Length':e-s+1}});}

self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method !== 'GET') return;
  const u = new URL(r.url);
  const isFont = u.hostname === 'fonts.googleapis.com' || u.hostname === 'fonts.gstatic.com';
  if (u.origin !== self.location.origin && !isFont) return;
  const mm=u.origin===self.location.origin&&/\/m3u\/(media\/)?([^/]+)$/.exec(u.pathname);   // playlist links + the videos they point to
  if(mm){e.respondWith(mm[1]?media(r,decodeURIComponent(mm[2])):caches.open('m3u-cache').then(c=>c.match(u.origin+u.pathname)).then(x=>x||new Response('',{status:404})));return;}

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
