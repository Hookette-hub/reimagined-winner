/* Connexion Google de Mon QG (venu du « QG Usine ») : le compte du Président, directement depuis son téléphone.
 *
 * Règles (mission « QG Usine », §D) :
 * - le jeton d'accès reste dans une variable de cette page : jamais dans le stockage du navigateur, jamais sur disque ;
 * - aucun secret ici : l'ID du client OAuth n'est pas un secret, et le Président le colle une fois dans l'app ;
 * - aucune adresse e-mail, aucun ID de tableau dans le code : le tableau TEST est retrouvé par son nom après la connexion ;
 * - seul l'environnement TEST est ouvert : un tableau dont le nom ne commence pas par « TEST » est refusé.
 *
 * Le reste de l'app parle à cette connexion comme le QG de claude.ai parlait à ses connecteurs
 * (callTool / watchTool / invalidate), pour garder le même code d'écrans. */
(function () {
  "use strict";
  const NOM_TABLEAU = "TEST – Tableau de suivi – Usine à projets";
  const NOM_A_INTEGRER = "À intégrer (TEST)";
  const SCOPES = [
    "https://www.googleapis.com/auth/spreadsheets",   // lire et écrire le tableau
    "https://www.googleapis.com/auth/drive.readonly", // retrouver le tableau, lire les résumés d'une page
    "https://www.googleapis.com/auth/drive.file",     // créer un document « à intégrer » (ne peut rien supprimer d'autre)
  ].join(" ");
  const SHEETS = "https://sheets.googleapis.com/v4/spreadsheets/";
  const DRIVE = "https://www.googleapis.com/drive/v3/files";
  const UPLOAD = "https://www.googleapis.com/upload/drive/v3/files";
  const CLE_CLIENT = "qg-usine-client-id";
  const CLE_ETAT = "qg-usine-oauth-etat";

  let jeton = null, expire = 0;          // en mémoire seulement
  let tableau = null, dossierAIntegrer;   // IDs retrouvés après la connexion (en mémoire)
  let retourErreur = "";

  const lire = (stock, cle) => { try { return stock.getItem(cle) || ""; } catch (e) { return ""; } };
  const ecrire = (stock, cle, v) => { try { v ? stock.setItem(cle, v) : stock.removeItem(cle); } catch (e) {} };
  const idClient = () => lire(localStorage, CLE_CLIENT);
  const idClientValide = v => /^[0-9]+-[0-9a-z]+\.apps\.googleusercontent\.com$/.test(v);

  /* Retour de Google : le jeton arrive dans l'adresse (#access_token=…). On le prend, puis on l'efface tout de suite. */
  (function lireRetour() {
    const h = location.hash.slice(1);
    if (!/(^|&)(access_token|error)=/.test(h)) return;
    const p = new URLSearchParams(h), attendu = lire(sessionStorage, CLE_ETAT);
    ecrire(sessionStorage, CLE_ETAT, "");
    history.replaceState(null, "", "/#accueil");
    if (!attendu || p.get("state") !== attendu) { retourErreur = "La connexion n'a pas pu être vérifiée. Réessayez."; return; }
    if (p.get("error")) { retourErreur = p.get("error") === "access_denied" ? "Connexion annulée." : "Google a refusé la connexion (" + p.get("error") + ")."; return; }
    const accordes = (p.get("scope") || "").split(" ");
    if (!accordes.includes("https://www.googleapis.com/auth/spreadsheets")) { retourErreur = "Cochez l'accès au tableau quand Google le demande, sinon le QG ne peut rien lire."; return; }
    jeton = p.get("access_token");
    expire = Date.now() + (parseInt(p.get("expires_in"), 10) || 3600) * 1000 - 60000;
  })();

  function seConnecter() {
    const client = idClient();
    if (!idClientValide(client)) return false;
    const etat = Array.from(crypto.getRandomValues(new Uint8Array(16)), b => b.toString(16).padStart(2, "0")).join("");
    ecrire(sessionStorage, CLE_ETAT, etat);
    const q = new URLSearchParams({
      client_id: client, redirect_uri: location.origin + "/", response_type: "token",
      scope: SCOPES, state: etat, include_granted_scopes: "true", prompt: "select_account",
    });
    location.assign("https://accounts.google.com/o/oauth2/v2/auth?" + q);
    return true;
  }
  function seDeconnecter() {
    const t = jeton; jeton = null; expire = 0; tableau = null; dossierAIntegrer = undefined;
    if (t) fetch("https://oauth2.googleapis.com/revoke?token=" + encodeURIComponent(t), {method: "POST", mode: "no-cors"}).catch(() => {});
  }
  const connecte = () => !!jeton && Date.now() < expire;

  /* Erreurs traduites dans les codes que les écrans connaissent déjà. */
  function erreur(code, message, retryable) { const e = new Error(message || code); e.code = code; e.retryable = !!retryable; return e; }
  async function appel(url, options = {}) {
    if (!connecte()) throw erreur("needs_reauth", "Connexion expirée");
    let r;
    try {
      r = await fetch(url, Object.assign({}, options, {
        headers: Object.assign({Authorization: "Bearer " + jeton}, options.headers || {}),
        cache: "no-store", credentials: "omit", referrerPolicy: "no-referrer",
      }));
    } catch (e) { throw erreur(navigator.onLine === false ? "offline" : "server_unavailable", "Pas de réseau", true); }
    if (r.ok) return r.status === 204 ? {} : (options.texte ? r.text() : r.json());
    let msg = ""; try { msg = ((await r.json()).error || {}).message || ""; } catch (e) {}
    if (r.status === 401) { jeton = null; throw erreur("needs_reauth", msg); }
    if (r.status === 403) throw erreur(/insufficient|scope/i.test(msg) ? "not_granted" : "tool_error", msg);
    if (r.status === 429) throw erreur("rate_limited", msg, true);
    if (r.status >= 500) throw erreur("upstream_error", msg, true);
    throw erreur("tool_error", msg);
  }
  const q = s => "'" + s.replace(/\\/g, "\\\\").replace(/'/g, "\\'") + "'";

  async function trouverTableau() {
    if (tableau) return tableau;
    const params = new URLSearchParams({
      q: `name = ${q(NOM_TABLEAU)} and mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false`,
      fields: "files(id,name)", pageSize: "5", spaces: "drive",
    });
    const res = await appel(DRIVE + "?" + params);
    const f = (res.files || []).filter(x => x.name === NOM_TABLEAU && /^TEST\b/.test(x.name));
    if (!f.length) throw erreur("no_sheet", "Tableau TEST introuvable avec ce compte Google.");
    if (f.length > 1) throw erreur("many_sheets", "Plusieurs tableaux portent le nom du tableau TEST.");
    return (tableau = f[0].id);
  }
  async function trouverAIntegrer() {
    if (dossierAIntegrer !== undefined) return dossierAIntegrer;
    const params = new URLSearchParams({
      q: `name = ${q(NOM_A_INTEGRER)} and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
      fields: "files(id,name)", pageSize: "5", spaces: "drive",
    });
    const res = await appel(DRIVE + "?" + params);
    const f = (res.files || []).filter(x => x.name === NOM_A_INTEGRER);
    return (dossierAIntegrer = f.length === 1 ? f[0].id : null);
  }

  /* Les outils que les écrans utilisent. */
  async function outil(serveur, nom, args) {
    if (serveur === "Google Sheets") {
      const id = await trouverTableau(), plage = encodeURIComponent(args.range);
      if (nom === "get_values") return {payload: await appel(`${SHEETS}${id}/values/${plage}?majorDimension=ROWS`)};
      const corps = {method: nom === "append_values" ? "POST" : "PUT", headers: {"Content-Type": "application/json"}, body: JSON.stringify({values: args.values})};
      if (nom === "append_values") return {payload: await appel(`${SHEETS}${id}/values/${plage}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`, corps)};
      if (nom === "update_values") return {payload: await appel(`${SHEETS}${id}/values/${plage}?valueInputOption=RAW`, corps)};
    }
    if (serveur === "Google Drive" && nom === "read_file_content") {
      if (!/^[\w-]{10,}$/.test(args.fileId)) throw erreur("tool_error", "Document inconnu");
      return {payload: {fileContent: await appel(`${DRIVE}/${args.fileId}/export?mimeType=text%2Fplain`, {texte: true})}};
    }
    throw erreur("tool_error", "Action inconnue : " + nom);
  }

  /* Créer un Google Doc dans « À intégrer (TEST) » : la Bibliothécaire le lit à son prochain passage. */
  async function deposerDocument(titre, texte) {
    const dossier = await trouverAIntegrer();
    const meta = {name: titre, mimeType: "application/vnd.google-apps.document"};
    const envoyer = parents => {
      const limite = "qg" + Array.from(crypto.getRandomValues(new Uint8Array(12)), b => b.toString(16)).join("");
      const corps = `--${limite}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(Object.assign({}, meta, parents ? {parents} : {}))}\r\n` +
        `--${limite}\r\nContent-Type: text/plain; charset=UTF-8\r\n\r\n${texte}\r\n--${limite}--`;
      return appel(`${UPLOAD}?uploadType=multipart&fields=id,webViewLink`, {method: "POST", headers: {"Content-Type": "multipart/related; boundary=" + limite}, body: corps});
    };
    if (dossier) {
      try { return Object.assign({dansLeDossier: true}, await envoyer([dossier])); }
      catch (e) { if (e.code === "needs_reauth" || e.retryable) throw e; } // Google peut refuser un dossier que l'app n'a pas créé
    }
    return Object.assign({dansLeDossier: false}, await envoyer(null));
  }

  /* watchTool : relit une plage toutes les N millisecondes et prévient l'écran. */
  const veilles = new Set();
  function watchTool(serveur, nom, args, rappel, opts = {}) {
    const v = {actif: true, timer: 0};
    const tour = async () => {
      if (!v.actif) return;
      try { const res = await outil(serveur, nom, args); if (v.actif) rappel({type: "data", result: Object.assign(res, {cache: {storedAt: Date.now()}})}); }
      catch (e) { if (v.actif) rappel({type: "error", error: {code: e.code, message: e.message, retryable: e.retryable}}); }
      if (v.actif && opts.refetchInterval) v.timer = setTimeout(tour, opts.refetchInterval);
    };
    v.relire = () => { clearTimeout(v.timer); tour(); };
    veilles.add(v); tour();
    return () => { v.actif = false; clearTimeout(v.timer); veilles.delete(v); };
  }
  const invalidate = async () => { veilles.forEach(v => v.relire()); };
  const callTool = (serveur, nom, args) => outil(serveur, nom, args);

  /* Notifications « app fermée » : le téléphone s'abonne auprès du relais de l'app (même adresse, /api/abonner).
   * Le jeton part seulement vers ce relais, qui demande à Google à quel compte il appartient : seul le vôtre est accepté. */
  async function abonnerNotifications(abonnement) {
    if (!connecte()) throw erreur("needs_reauth", "Connexion expirée");
    let r;
    try {
      r = await fetch("/api/abonner", {method: "POST", cache: "no-store", credentials: "omit", referrerPolicy: "no-referrer",
        headers: {Authorization: "Bearer " + jeton, "Content-Type": "application/json"}, body: JSON.stringify({abonnement})});
    } catch (e) { throw erreur("offline", "Pas de réseau", true); }
    const res = await r.json().catch(() => ({}));
    if (!r.ok) throw erreur(r.status === 503 || r.status === 404 ? "no_relay" : r.status === 403 ? "other_owner" : "tool_error", res.erreur || "");
    return res;
  }

  window.QG_GOOGLE = Object.freeze({
    seConnecter, seDeconnecter, connecte, idClientValide,
    idClient, enregistrerIdClient: v => ecrire(localStorage, CLE_CLIENT, v.trim()),
    erreurRetour: () => { const e = retourErreur; retourErreur = ""; return e; },
    mcp: Object.freeze({callTool, watchTool, invalidate}), deposerDocument, abonnerNotifications,
  });
})();
