/* Hors ligne : le « service worker » garde seulement les fichiers de l'app (jamais vos données ni la connexion). */
if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "127.0.0.1")) { // 127.0.0.1 : tests
  window.addEventListener("load", () => { navigator.serviceWorker.register("/sw.js", {scope: "/"}).catch(() => {}); });
}
