/* Le relais des notifications « app fermée » (Cloudflare Pages Functions, sur la même adresse que l'app).
 *
 *   GET  /api/cle      la clé publique du relais (le téléphone en a besoin pour s'abonner)
 *   POST /api/abonner  le téléphone s'abonne (avec la connexion Google du propriétaire)
 *   POST /api/signal   le petit script Google du tableau TEST annonce une décision ou un problème grave
 *
 * Qui peut entrer : seulement le compte Google du propriétaire. Le relais demande à Google « à qui est ce jeton ? »
 * et garde le numéro de compte (« sub ») du premier abonnement ; ensuite, tout autre compte est refusé.
 * Aucun secret à recopier : ni mot de passe, ni e-mail, ni clé dans l'app ou dans le dépôt.
 * Le relais ne lit jamais le tableau : il ne fait que transmettre, chiffrés, les messages du script Google. */

import {abonnementValide, clesVapid, envoyer} from "./webpush.js";

const MAX_APPAREILS = 5, MAX_MESSAGES = 10, MAX_CORPS = 16000;

const json = (donnees, statut = 200) => new Response(JSON.stringify(donnees), {
  status: statut, headers: {"Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store"},
});

/* « À qui est ce jeton Google ? » Renvoie le numéro de compte, ou null. */
export async function compteGoogle(request, fetchImpl = fetch) {
  const m = /^Bearer ([\w.\-~+/]+=*)$/.exec(request.headers.get("Authorization") || "");
  if (!m) return null;
  const r = await fetchImpl("https://oauth2.googleapis.com/tokeninfo?access_token=" + encodeURIComponent(m[1]));
  if (!r.ok) return null;
  const info = await r.json().catch(() => ({}));
  return info.sub && Number(info.expires_in) > 0 ? String(info.sub) : null;
}

async function lireJson(request) {
  const texte = await request.text();
  if (texte.length > MAX_CORPS) return null;
  try { return JSON.parse(texte); } catch (e) { return null; }
}

const court = (s, n) => String(s ?? "").replace(/\s+/g, " ").trim().slice(0, n);
const lienInterne = u => /^\/#[\w.~%-]*$/.test(String(u || "")) ? u : "/#decisions";

export async function traiter(request, env, opts = {}) {
  const f = opts.fetch || fetch, kv = env && env.QG_RELAIS;
  const url = new URL(request.url), chemin = url.pathname.replace(/\/+$/, "");
  if (!kv) return json({erreur: "Le relais n'est pas encore branché (stockage Cloudflare « QG_RELAIS » absent)."}, 503);
  const sujet = url.origin; // VAPID : l'adresse de l'app sert d'identité (pas d'e-mail)

  if (chemin === "/api/cle" && request.method === "GET") return json({cle: (await clesVapid(kv)).publique});

  if (chemin === "/api/abonner" && request.method === "POST") {
    const sub = await compteGoogle(request, f);
    if (!sub) return json({erreur: "Connexion Google refusée."}, 401);
    const proprio = await kv.get("proprietaire");
    if (proprio && proprio !== sub) return json({erreur: "Ce relais appartient à un autre compte."}, 403);
    const corps = await lireJson(request);
    const ab = corps && corps.abonnement;
    if (!ab || !abonnementValide(ab)) return json({erreur: "Abonnement invalide."}, 400);
    if (!proprio) await kv.put("proprietaire", sub);
    const liste = ((await kv.get("abonnements", "json")) || []).filter(x => x.endpoint !== ab.endpoint);
    liste.push({endpoint: ab.endpoint, keys: {p256dh: ab.keys.p256dh, auth: ab.keys.auth}});
    await kv.put("abonnements", JSON.stringify(liste.slice(-MAX_APPAREILS)));
    const cles = await clesVapid(kv);
    const statut = await envoyer(ab, {titre: "Notifications prêtes", texte: "Vous serez prévenu ici quand une décision vous attend.", url: "/#alertes", tag: "qg-bienvenue"}, cles, sujet, {fetch: f});
    return json({ok: true, appareils: Math.min(liste.length, MAX_APPAREILS), test: statut});
  }

  if (chemin === "/api/signal" && request.method === "POST") {
    const sub = await compteGoogle(request, f), proprio = await kv.get("proprietaire");
    if (!sub || !proprio || sub !== proprio) return json({erreur: "Refusé."}, 403);
    const corps = await lireJson(request);
    const messages = (corps && Array.isArray(corps.notifications) ? corps.notifications : []).slice(0, MAX_MESSAGES).map(n => ({
      titre: court(n.titre, 80) || "Une décision vous attend", texte: court(n.texte, 240), url: lienInterne(n.url),
      tag: "qg-" + court(n.tag, 40).replace(/[^\w-]/g, ""), urgent: !!n.urgent,
    }));
    let liste = (await kv.get("abonnements", "json")) || [];
    if (!messages.length || !liste.length) return json({ok: true, envoyes: 0, appareils: liste.length});
    const cles = await clesVapid(kv), morts = new Set();
    let envoyes = 0;
    for (const ab of liste) for (const m of messages) {
      if (morts.has(ab.endpoint)) continue;
      const s = await envoyer(ab, m, cles, sujet, {fetch: f, urgent: m.urgent}).catch(() => 0);
      if (s === 404 || s === 410) morts.add(ab.endpoint); else if (s >= 200 && s < 300) envoyes++;
    }
    if (morts.size) { liste = liste.filter(x => !morts.has(x.endpoint)); await kv.put("abonnements", JSON.stringify(liste)); }
    return json({ok: true, envoyes, appareils: liste.length});
  }

  return json({erreur: "Inconnu."}, 404);
}
