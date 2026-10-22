/* Service worker de Mon QG : l'app s'ouvre même sans réseau, et affiche les notifications.
 * Il ne met en cache QUE les fichiers de l'app (même origine). Les appels à Google (données, connexion)
 * ne passent jamais par ce cache : ils vont directement au réseau. */
const VERSION = "mon-qg-v7";
const FICHIERS = ["/", "/index.html", "/styles.css", "/google.js", "/app.js", "/alertes.js", "/verrou.js", "/installer.js", "/manifest.webmanifest",
  "/icones/icone.svg", "/icones/icone-180.png", "/icones/icone-192.png", "/icones/icone-512.png", "/icones/icone-masquable-512.png",
  "/polices/bricolage.woff2", "/polices/plex-sans.woff2", "/polices/plex-mono-500.woff2", "/polices/plex-mono-600.woff2"];

self.addEventListener("install", e => { e.waitUntil(caches.open(VERSION).then(c => c.addAll(FICHIERS)).then(() => self.skipWaiting())); });
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(k => Promise.all(k.filter(n => n !== VERSION).map(n => caches.delete(n)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return; // Google et le relais : jamais en cache
  if (e.request.mode === "navigate") {
    // Réseau d'abord (version à jour), l'app gardée en secours hors ligne. L'adresse de retour de Google n'est jamais gardée.
    e.respondWith(fetch(e.request).catch(() => caches.match("/index.html")));
    return;
  }
  // Fichiers de l'app : réseau d'abord (jamais de version périmée), copie gardée pour le hors ligne.
  e.respondWith(fetch(e.request).then(rep => {
    if (rep.ok && FICHIERS.includes(url.pathname)) { const copie = rep.clone(); caches.open(VERSION).then(c => c.put(e.request, copie)); }
    return rep;
  }).catch(() => caches.match(e.request)));
});

/* Notifications « app fermée » : le relais envoie un message chiffré (titre, texte, page à ouvrir). */
self.addEventListener("push", e => {
  let m = {};
  try { m = e.data ? e.data.json() : {}; } catch (err) {}
  const url = /^\/#[\w.~%-]*$/.test(m.url || "") ? m.url : "/#decisions";
  e.waitUntil(self.registration.showNotification(String(m.titre || "Une décision vous attend").slice(0, 80), {
    body: String(m.texte || "Ouvrez Mon QG pour la voir.").slice(0, 240), tag: String(m.tag || "qg-decision"),
    icon: "/icones/icone-192.png", badge: "/icones/icone-192.png", data: {url}, requireInteraction: !!m.urgent, renotify: !!m.urgent,
  }));
});
/* Toucher une notification ouvre l'app sur la bonne page (ou la ramène devant si elle est déjà ouverte). */
self.addEventListener("notificationclick", e => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || "/#decisions";
  e.waitUntil(self.clients.matchAll({type: "window", includeUncontrolled: true}).then(fen => {
    const f = fen.find(c => new URL(c.url).origin === self.location.origin);
    if (f) { f.postMessage({ouvrir: url}); return f.focus(); } // l'app change de page elle-même (alertes.js)
    return self.clients.openWindow(url);
  }));
});
