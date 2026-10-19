/* Notifications de Mon QG : « une décision vous attend » et « problème grave ».
 *
 * 1. App ouverte ou en arrière-plan : à chaque relecture du tableau (toutes les 3 minutes), une notification pour
 *    chaque NOUVELLE décision, et la pastille sur l'icône de l'app (le nombre de décisions qui attendent).
 * 2. App fermée : le téléphone s'abonne au relais de l'app (voir relais/), que le petit script Google du tableau
 *    prévient. Rien de tout cela ne marche avant la mise en ligne (Cloudflare) : l'écran « Notifications » le dit.
 *
 * Rien de vos données n'est gardé sur le téléphone : seulement une empreinte (un code de 8 caractères) de chaque
 * décision déjà annoncée, pour ne pas l'annoncer deux fois. */
(function () {
  "use strict";
  const CLE_VUES = "qg-notifiees", CLE_PUSH = "qg-push-actif";
  const lire = k => { try { return localStorage.getItem(k) || ""; } catch (e) { return ""; } };
  const ecrire = (k, v) => { try { v ? localStorage.setItem(k, v) : localStorage.removeItem(k); } catch (e) {} };

  const ua = navigator.userAgent || "";
  const ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  const installee = () => (window.matchMedia && matchMedia("(display-mode: standalone)").matches) || navigator.standalone === true;
  const support = () => "Notification" in window && "serviceWorker" in navigator;
  const permission = () => support() ? Notification.permission : "absent";
  const pushPossible = () => support() && "PushManager" in window;

  /* Empreinte courte et non réversible d'une décision (date + texte). */
  function empreinte(d) {
    let h = 0x811c9dc5; const s = (d.date || "") + "|" + (d.texte || d.titre || "");
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
    return (h >>> 0).toString(16).padStart(8, "0");
  }

  async function montrer(titre, texte, url, tag, urgent) {
    const reg = await navigator.serviceWorker.getRegistration("/").catch(() => null);
    const opts = {body: texte, tag, icon: "/icones/icone-192.png", badge: "/icones/icone-192.png", data: {url}, requireInteraction: !!urgent};
    if (reg && reg.showNotification) return reg.showNotification(titre, opts);
    const n = new Notification(titre, opts); n.onclick = () => { window.focus(); location.hash = url.replace(/^\/#/, ""); n.close(); };
  }

  function pastille(n) {
    try { if (n > 0 && navigator.setAppBadge) navigator.setAppBadge(n).catch(() => {}); else if (navigator.clearAppBadge) navigator.clearAppBadge().catch(() => {}); } catch (e) {}
  }

  /* Appelé par l'app à chaque affichage des vraies données. */
  let derniere = "";
  function verifier(decisions) {
    const liste = decisions || [];
    const cles = liste.map(empreinte), signature = cles.join(",");
    pastille(liste.length);
    if (signature === derniere) return;
    derniere = signature;
    const deja = new Set(lire(CLE_VUES).split(",").filter(Boolean));
    const nouvelles = liste.filter((d, i) => !deja.has(cles[i]));
    if (permission() === "granted") {
      nouvelles.slice(0, 3).forEach(d => {
        const grave = d.cat === 5;
        montrer(grave ? "Problème grave : à regarder" : "Une décision vous attend", d.titre + (d.texte ? " · " + d.texte.slice(0, 160) : ""),
          "/#decisions." + d.n, "qg-" + empreinte(d), grave).catch(() => {});
      });
      if (nouvelles.length > 3) montrer(`${nouvelles.length} décisions vous attendent`, "Ouvrez Mon QG pour les voir.", "/#decisions", "qg-plusieurs").catch(() => {});
      ecrire(CLE_VUES, cles.join(",")); // on oublie les décisions réglées
    }
  }

  async function activer() {
    if (!support()) return permission();
    const p = await Notification.requestPermission();
    if (p === "granted") { derniere = ""; ecrire(CLE_VUES, ""); } // annoncer ce qui attend déjà
    return p;
  }

  function tester() {
    return montrer("Test : une décision vous attend", "Voilà à quoi ressemblera une notification de Mon QG.", "/#alertes", "qg-test");
  }

  /* App fermée : abonnement au relais (il faut être connecté avec Google, l'app en ligne et le relais branché). */
  async function activerAppFermee() {
    if (!pushPossible()) { const e = new Error("push"); e.code = "no_push"; throw e; }
    if (permission() !== "granted" && await activer() !== "granted") { const e = new Error("refus"); e.code = "denied"; throw e; }
    let cle;
    try {
      const r = await fetch("/api/cle", {cache: "no-store", credentials: "omit"});
      if (!r.ok) throw new Error(String(r.status));
      cle = (await r.json()).cle;
    } catch (err) { const e = new Error("relais"); e.code = "no_relay"; throw e; }
    const reg = await navigator.serviceWorker.ready;
    const brut = Uint8Array.from(atob(cle.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((cle.length + 3) % 4)), c => c.charCodeAt(0));
    let ab = await reg.pushManager.getSubscription();
    if (ab && ab.options && ab.options.applicationServerKey && new Uint8Array(ab.options.applicationServerKey).join() !== brut.join()) { await ab.unsubscribe(); ab = null; }
    ab = ab || await reg.pushManager.subscribe({userVisibleOnly: true, applicationServerKey: brut});
    const res = await window.QG_GOOGLE.abonnerNotifications(ab.toJSON());
    ecrire(CLE_PUSH, "1");
    return res;
  }

  async function arreterAppFermee() {
    const reg = await navigator.serviceWorker.getRegistration("/").catch(() => null);
    const ab = reg && reg.pushManager ? await reg.pushManager.getSubscription() : null;
    if (ab) await ab.unsubscribe(); // le relais l'oublie au prochain envoi (le service répond « disparu »)
    ecrire(CLE_PUSH, "");
  }

  /* Une notification touchée alors que l'app est ouverte : aller à la bonne page. */
  if ("serviceWorker" in navigator) navigator.serviceWorker.addEventListener("message", e => {
    const u = e.data && e.data.ouvrir;
    if (typeof u === "string" && /^\/#[\w.~%-]*$/.test(u)) location.hash = u.slice(2);
  });

  window.QG_ALERTES = Object.freeze({
    verifier, activer, tester, activerAppFermee, arreterAppFermee,
    etat: () => ({support: support(), permission: permission(), ios, installee: installee(), push: pushPossible(), appFermee: lire(CLE_PUSH) === "1"}),
  });
})();
