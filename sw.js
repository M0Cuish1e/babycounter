/* Service worker : rend l'application utilisable hors ligne, indéfiniment.

   Principe : un cache par version. L'appli répond toujours depuis le cache de la
   version installée et n'y écrit jamais rien en cours d'utilisation : ni une
   réponse 404, ni une panne réseau, ni une page inattendue ne peuvent remplacer
   un fichier de l'appli.

   Mise à jour : le navigateur compare sw.js à chaque ouverture avec du réseau.
   Si VERSION a changé, la nouvelle version télécharge tous ses fichiers dans un
   nouveau cache, vérifie chacun, et ne prend la place de l'ancienne que si tout
   est complet. Sinon l'ancienne reste en place, intacte. Quand le site n'est
   plus publié (404), sw.js ne peut pas être relu : la version installée continue.

   Pour publier une mise à jour : changer VERSION (par exemple la date du jour).
   Si un fichier est ajouté à l'appli, l'ajouter aussi à FICHIERS. */
var VERSION = '2026-11-15.1';
var PREFIXE = 'babycounter-';
var CACHE = PREFIXE + VERSION;
var FICHIERS = [
  './', 'index.html', 'style.css', 'app.js', 'manifest.webmanifest',
  'fonts/dm-sans-latin-wght-normal.woff2', 'fonts/dm-sans-latin-ext-wght-normal.woff2',
  'fonts/caveat-latin-700-normal.woff2', 'fonts/caveat-latin-ext-700-normal.woff2',
  'icons/icon.svg', 'icons/icon-180.png', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png'
];

/* Type attendu pour chaque fichier : une page HTML servie à la place d'une police
   ou du script (page d'erreur, autre site à la même adresse) est refusée. */
function typeAttendu(chemin) {
  if (chemin === './' || /\.html$/.test(chemin)) return 'text/html';
  if (/\.css$/.test(chemin)) return 'text/css';
  if (/\.js$/.test(chemin)) return 'javascript';
  if (/\.webmanifest$/.test(chemin)) return 'json';
  if (/\.woff2$/.test(chemin)) return 'font/woff2';
  if (/\.svg$/.test(chemin)) return 'image/svg+xml';
  if (/\.png$/.test(chemin)) return 'image/png';
  return '';
}
function telecharger(chemin) {
  /* cache: 'reload' contourne le cache HTTP du navigateur pour avoir la version publiée. */
  return fetch(new Request(chemin, { cache: 'reload' })).then(function (rep) {
    var type = rep.headers.get('Content-Type') || '';
    if (!rep.ok || rep.status !== 200 || rep.type !== 'basic') throw new Error(chemin + ' : réponse ' + rep.status);
    if (type.indexOf(typeAttendu(chemin)) < 0) throw new Error(chemin + ' : type inattendu ' + type);
    return rep;
  });
}

/* Installation : tout télécharger d'abord, n'écrire dans le cache qu'une fois
   tous les fichiers reçus et vérifiés. Un seul échec et l'installation échoue :
   la version déjà installée continue de servir l'appli. */
self.addEventListener('install', function (ev) {
  ev.waitUntil(
    Promise.all(FICHIERS.map(telecharger)).then(function (reps) {
      return caches.open(CACHE).then(function (cache) {
        return Promise.all(reps.map(function (rep, i) { return cache.put(FICHIERS[i], rep); }));
      });
    }).then(function () {
      return self.skipWaiting();
    }).catch(function (err) {
      return caches.delete(CACHE).then(function () { throw err; });
    })
  );
});

/* Activation : la nouvelle version est complète, on retire les anciennes. */
self.addEventListener('activate', function (ev) {
  ev.waitUntil(caches.keys().then(function (cles) {
    return Promise.all(cles.filter(function (k) { return k.indexOf(PREFIXE) === 0 && k !== CACHE; })
      .map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

/* Le cache d'abord, toujours. Le réseau ne sert qu'aux fichiers hors de l'appli
   (les jeux d'essai de exemples/ par exemple), et n'écrit jamais dans le cache. */
self.addEventListener('fetch', function (ev) {
  var req = ev.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  ev.respondWith(caches.open(CACHE).then(function (cache) {
    return cache.match(req, { ignoreSearch: true }).then(function (enCache) {
      if (enCache) return enCache;
      if (req.mode === 'navigate' && /\/$/.test(new URL(req.url).pathname)) return cache.match('index.html');
      return fetch(req).catch(function () {
        return req.mode === 'navigate' ? cache.match('index.html') : Response.error();
      });
    });
  }));
});

/* L'appli demande la version installée pour l'afficher dans les réglages. */
self.addEventListener('message', function (ev) {
  if (ev.data === 'version' && ev.ports[0]) ev.ports[0].postMessage(VERSION);
});
