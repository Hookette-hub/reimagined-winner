/* Tests du relais des notifications : chiffrement vérifié par une bibliothèque indépendante (http_ece, MIT),
 * signature VAPID vérifiée, et les règles d'accès (seul le compte Google du propriétaire). Rien n'est envoyé :
 * Google et les services de notification sont simulés ici. Lancer : cd app && npm install && npm test */
import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import ece from "http_ece";
import {b64uDec, b64uEnc, chiffrer, jetonVapid, clesVapid, abonnementValide} from "../webpush.js";
import {traiter} from "../relais.js";

function telephone(endpoint = "https://fcm.googleapis.com/fcm/send/abc123") {
  const ecdh = crypto.createECDH("prime256v1"); ecdh.generateKeys();
  const auth = crypto.randomBytes(16);
  return {ecdh, auth, abonnement: {endpoint, keys: {p256dh: b64uEnc(ecdh.getPublicKey()), auth: b64uEnc(auth)}}};
}
const dechiffrer = (tel, corps) => ece.decrypt(Buffer.from(corps), {version: "aes128gcm", privateKey: tel.ecdh, authSecret: b64uEnc(tel.auth)}).toString("utf8");

class KV { constructor() { this.m = new Map(); } async get(k, t) { const v = this.m.get(k); return v == null ? null : t === "json" ? JSON.parse(v) : v; } async put(k, v) { this.m.set(k, v); } }

function monde({comptes = {"jeton-proprio": "111", "jeton-autre": "222"}, statutService = 201} = {}) {
  const envois = [];
  const fetch = async (url, opts = {}) => {
    const u = new URL(url);
    if (u.hostname === "oauth2.googleapis.com") {
      const sub = comptes[u.searchParams.get("access_token")];
      return new Response(JSON.stringify(sub ? {sub, expires_in: "3000"} : {error: "invalid_token"}), {status: sub ? 200 : 400});
    }
    envois.push({url, opts});
    return new Response("", {status: typeof statutService === "function" ? statutService(url) : statutService});
  };
  return {kv: new KV(), envois, fetch};
}
const req = (chemin, {methode = "GET", jeton, corps} = {}) => new Request("https://mon-qg.pages.dev" + chemin, {
  method: methode, headers: jeton ? {Authorization: "Bearer " + jeton} : {}, body: corps ? JSON.stringify(corps) : undefined,
});

test("le message chiffré se déchiffre avec une bibliothèque indépendante (RFC 8291)", async () => {
  const tel = telephone();
  const corps = await chiffrer(tel.abonnement, JSON.stringify({titre: "Une décision vous attend", texte: "Valider le projet Écho"}));
  assert.deepEqual(JSON.parse(dechiffrer(tel, corps)), {titre: "Une décision vous attend", texte: "Valider le projet Écho"});
  // deux envois du même texte ne se ressemblent pas (sel et clé éphémère nouveaux à chaque fois)
  assert.notDeepEqual(corps, await chiffrer(tel.abonnement, JSON.stringify({titre: "Une décision vous attend", texte: "Valider le projet Écho"})));
});

test("le jeton VAPID est signé par la clé du relais et visé pour un seul service", async () => {
  const kv = new KV(), cles = await clesVapid(kv);
  assert.deepEqual(await clesVapid(kv), cles, "les clés sont créées une seule fois");
  const jwt = await jetonVapid("https://web.push.apple.com/QWERTY", cles, "https://mon-qg.pages.dev", 1_800_000_000_000);
  const [h, c, s] = jwt.split(".");
  const pub = await crypto.webcrypto.subtle.importKey("raw", b64uDec(cles.publique), {name: "ECDSA", namedCurve: "P-256"}, false, ["verify"]);
  assert.ok(await crypto.webcrypto.subtle.verify({name: "ECDSA", hash: "SHA-256"}, pub, b64uDec(s), new TextEncoder().encode(h + "." + c)));
  const claims = JSON.parse(new TextDecoder().decode(b64uDec(c)));
  assert.equal(claims.aud, "https://web.push.apple.com");
  assert.equal(claims.sub, "https://mon-qg.pages.dev");
  assert.equal(claims.exp, 1_800_000_000 + 12 * 3600);
  assert.ok(!JSON.stringify(cles).includes("@"));
});

test("seuls les vrais services de notification sont acceptés", () => {
  assert.ok(abonnementValide(telephone("https://web.push.apple.com/abc").abonnement));
  assert.ok(abonnementValide(telephone("https://wns2-par02p.notify.windows.com/w/?token=x").abonnement));
  for (const e of ["https://evil.example/push", "http://fcm.googleapis.com/x", "https://fcm.googleapis.com.evil.example/x", "javascript:alert(1)"])
    assert.ok(!abonnementValide(telephone(e).abonnement), e);
  assert.ok(!abonnementValide({endpoint: "https://fcm.googleapis.com/x", keys: {p256dh: "abc", auth: "def"}}));
});

test("sans stockage Cloudflare, le relais dit qu'il n'est pas branché", async () => {
  const r = await traiter(req("/api/cle"), {});
  assert.equal(r.status, 503);
});

test("abonnement : seul le premier compte Google devient propriétaire, et reçoit un message de bienvenue", async () => {
  const w = monde(), env = {QG_RELAIS: w.kv}, tel = telephone();
  const cle = await (await traiter(req("/api/cle"), env, w)).json();
  assert.equal(b64uDec(cle.cle).length, 65);

  assert.equal((await traiter(req("/api/abonner", {methode: "POST", corps: {abonnement: tel.abonnement}}), env, w)).status, 401);
  assert.equal((await traiter(req("/api/abonner", {methode: "POST", jeton: "faux", corps: {abonnement: tel.abonnement}}), env, w)).status, 401);
  assert.equal((await traiter(req("/api/abonner", {methode: "POST", jeton: "jeton-proprio", corps: {abonnement: {endpoint: "https://evil.example/x", keys: tel.abonnement.keys}}}), env, w)).status, 400);
  assert.equal(await w.kv.get("proprietaire"), null, "un abonnement refusé ne fixe pas le propriétaire");

  const r = await traiter(req("/api/abonner", {methode: "POST", jeton: "jeton-proprio", corps: {abonnement: tel.abonnement}}), env, w);
  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), {ok: true, appareils: 1, test: 201});
  assert.equal(await w.kv.get("proprietaire"), "111");
  assert.equal(w.envois.length, 1);
  const e = w.envois[0];
  assert.equal(e.url, tel.abonnement.endpoint);
  assert.match(e.opts.headers.Authorization, /^vapid t=[\w-]+\.[\w-]+\.[\w-]+, k=[\w-]{87}$/);
  assert.equal(e.opts.headers["Content-Encoding"], "aes128gcm");
  assert.equal(JSON.parse(dechiffrer(tel, e.opts.body)).titre, "Notifications prêtes");

  const autre = telephone();
  assert.equal((await traiter(req("/api/abonner", {methode: "POST", jeton: "jeton-autre", corps: {abonnement: autre.abonnement}}), env, w)).status, 403);
  assert.equal((await w.kv.get("abonnements", "json")).length, 1);
});

test("signal : le script Google du propriétaire déclenche les notifications ; les autres sont refusés", async () => {
  const w = monde({statutService: url => url.includes("mort") ? 410 : 201}), env = {QG_RELAIS: w.kv};
  const tel = telephone(), mort = telephone("https://fcm.googleapis.com/fcm/send/mort");
  await traiter(req("/api/abonner", {methode: "POST", jeton: "jeton-proprio", corps: {abonnement: tel.abonnement}}), env, w);
  await traiter(req("/api/abonner", {methode: "POST", jeton: "jeton-proprio", corps: {abonnement: mort.abonnement}}), env, w);
  w.envois.length = 0;

  const msg = {notifications: [
    {titre: "Une décision vous attend", texte: "Valider le projet Écho", url: "/#decisions.12", tag: "12"},
    {titre: "Problème grave", texte: "Fuite de données suspectée", url: "javascript:alert(1)", tag: "<x>", urgent: true},
  ]};
  assert.equal((await traiter(req("/api/signal", {methode: "POST", corps: msg}), env, w)).status, 403);
  assert.equal((await traiter(req("/api/signal", {methode: "POST", jeton: "jeton-autre", corps: msg}), env, w)).status, 403);
  assert.equal(w.envois.length, 0);

  const r = await (await traiter(req("/api/signal", {methode: "POST", jeton: "jeton-proprio", corps: msg}), env, w)).json();
  assert.deepEqual(r, {ok: true, envoyes: 2, appareils: 1}, "l'appareil disparu (410) est retiré");
  const recus = w.envois.filter(e => e.url === tel.abonnement.endpoint).map(e => ({...JSON.parse(dechiffrer(tel, e.opts.body)), urgence: e.opts.headers.Urgency}));
  assert.deepEqual(recus, [
    {titre: "Une décision vous attend", texte: "Valider le projet Écho", url: "/#decisions.12", tag: "qg-12", urgent: false, urgence: "normal"},
    {titre: "Problème grave", texte: "Fuite de données suspectée", url: "/#decisions", tag: "qg-x", urgent: true, urgence: "high"},
  ]);
  assert.deepEqual((await w.kv.get("abonnements", "json")).map(a => a.endpoint), [tel.abonnement.endpoint]);
});

test("adresses inconnues et corps trop gros refusés", async () => {
  const w = monde(), env = {QG_RELAIS: w.kv};
  assert.equal((await traiter(req("/api/autre"), env, w)).status, 404);
  assert.equal((await traiter(req("/api/cle", {methode: "POST"}), env, w)).status, 404);
  const gros = {abonnement: {...telephone().abonnement, bourrage: "x".repeat(20000)}};
  assert.equal((await traiter(req("/api/abonner", {methode: "POST", jeton: "jeton-proprio", corps: gros}), env, w)).status, 400);
});
