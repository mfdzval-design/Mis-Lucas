// Mis Lucas · service worker: funciona sin internet una vez abierta.
const CACHE = "mislucas-1-0-0-beta";
const CORE = ["./", "./index.html", "./manifest.webmanifest", "./icons/icon-192.png", "./icons/icon-512.png", "./icons/apple-touch-icon.png", "./vendor/xlsx.full.min.js",
  "./fonts/plus-jakarta-sans-400.woff2", "./fonts/plus-jakarta-sans-500.woff2", "./fonts/plus-jakarta-sans-600.woff2", "./fonts/plus-jakarta-sans-700.woff2", "./fonts/plus-jakarta-sans-800.woff2", "./fonts/ibm-plex-mono-400.woff2", "./fonts/ibm-plex-mono-500.woff2"];
self.addEventListener("install", e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting())); });
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", e => {
  const req = e.request; if (req.method !== "GET") return;
  // Red primero (para recibir actualizaciones); si no hay internet, usa la copia guardada.
  e.respondWith(fetch(req).then(res => { const copy = res.clone(); if (res.ok || res.type === "opaque") caches.open(CACHE).then(c => c.put(req, copy)); return res; })
    .catch(() => caches.match(req).then(r => r || (req.mode === "navigate" ? caches.match("./index.html") : undefined))));
});
