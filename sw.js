/* Service worker : rend l'application utilisable hors ligne.
   Stratégie : on répond tout de suite depuis le cache, puis on rafraîchit
   le fichier en arrière-plan. Une mise à jour publiée apparaît donc à
   l'ouverture suivante. */
var CACHE = 'babycounter-v1';
var FICHIERS = [
  './', 'index.html', 'style.css', 'app.js', 'manifest.webmanifest',
  'fonts/dm-sans-latin-wght-normal.woff2', 'fonts/dm-sans-latin-ext-wght-normal.woff2',
  'fonts/caveat-latin-700-normal.woff2', 'fonts/caveat-latin-ext-700-normal.woff2',
  'icons/icon.svg', 'icons/icon-180.png', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png'
];

self.addEventListener('install', function (ev) {
  ev.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(FICHIERS); }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (ev) {
  ev.waitUntil(caches.keys().then(function (cles) {
    return Promise.all(cles.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener('fetch', function (ev) {
  var req = ev.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  ev.respondWith(caches.open(CACHE).then(function (cache) {
    return cache.match(req, { ignoreSearch: true }).then(function (enCache) {
      var reseau = fetch(req, { cache: 'no-cache' }).then(function (rep) {
        if (rep && rep.ok) cache.put(req, rep.clone());
        return rep;
      }).catch(function () {
        return enCache || (req.mode === 'navigate' ? cache.match('index.html') : Response.error());
      });
      if (enCache) { ev.waitUntil(reseau); return enCache; }
      return reseau;
    });
  }));
});
