/* Notifications « app fermée » (Web Push), écrites à la main avec WebCrypto : aucune bibliothèque extérieure.
 *
 * - Chiffrement du message pour le téléphone : RFC 8291 (« aes128gcm », RFC 8188). Le service de notification
 *   d'Apple ou de Google transporte le message sans pouvoir le lire.
 * - Signature du relais auprès de ce service : VAPID (RFC 8292), une clé ECDSA P-256 créée par le relais
 *   lui-même au premier usage et gardée dans son stockage Cloudflare (KV), jamais dans l'app ni dans le dépôt.
 * Fonctionne dans Cloudflare (Pages Functions) et dans Node 20+ (tests). */

const te = new TextEncoder();
const subtle = () => globalThis.crypto.subtle;

export function b64uEnc(buf) {
  const o = buf instanceof ArrayBuffer ? new Uint8Array(buf) : buf;
  let s = ""; for (const b of o) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
export function b64uDec(str) {
  const s = atob(String(str).replace(/-/g, "+").replace(/_/g, "/") + "===".slice((String(str).length + 3) % 4));
  return Uint8Array.from(s, c => c.charCodeAt(0));
}
const concat = (...parts) => { const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0)); let i = 0; for (const p of parts) { out.set(p, i); i += p.length; } return out; };

async function hkdf(salt, ikm, info, octets) {
  const cle = await subtle().importKey("raw", ikm, "HKDF", false, ["deriveBits"]);
  return new Uint8Array(await subtle().deriveBits({name: "HKDF", hash: "SHA-256", salt, info}, cle, octets * 8));
}

/* Les clés VAPID du relais : créées une seule fois, puis relues. */
export async function clesVapid(kv) {
  const deja = await kv.get("vapid", "json");
  if (deja && deja.publique && deja.privee) return deja;
  const paire = await subtle().generateKey({name: "ECDSA", namedCurve: "P-256"}, true, ["sign", "verify"]);
  const cles = {
    publique: b64uEnc(await subtle().exportKey("raw", paire.publicKey)),
    privee: await subtle().exportKey("jwk", paire.privateKey),
  };
  await kv.put("vapid", JSON.stringify(cles));
  return cles;
}

/* Le jeton VAPID : « c'est bien ce relais qui envoie », valable 12 heures, pour un seul service de notification. */
export async function jetonVapid(endpoint, cles, sujet, maintenant = Date.now()) {
  const enTete = b64uEnc(te.encode(JSON.stringify({typ: "JWT", alg: "ES256"})));
  const corps = b64uEnc(te.encode(JSON.stringify({aud: new URL(endpoint).origin, exp: Math.floor(maintenant / 1000) + 12 * 3600, sub: sujet})));
  const privee = await subtle().importKey("jwk", cles.privee, {name: "ECDSA", namedCurve: "P-256"}, false, ["sign"]);
  const sig = await subtle().sign({name: "ECDSA", hash: "SHA-256"}, privee, te.encode(enTete + "." + corps));
  return `${enTete}.${corps}.${b64uEnc(sig)}`;
}

/* Chiffre le message pour un abonnement (clés p256dh et auth données par le navigateur du téléphone). */
export async function chiffrer(abonnement, texte, aleas = {}) {
  const uaPublic = b64uDec(abonnement.keys.p256dh), auth = b64uDec(abonnement.keys.auth);
  if (uaPublic.length !== 65 || auth.length !== 16) throw new Error("abonnement invalide");
  const paire = aleas.paire || await subtle().generateKey({name: "ECDH", namedCurve: "P-256"}, true, ["deriveBits"]);
  const asPublic = new Uint8Array(await subtle().exportKey("raw", paire.publicKey));
  const cleUa = await subtle().importKey("raw", uaPublic, {name: "ECDH", namedCurve: "P-256"}, false, []);
  const secret = new Uint8Array(await subtle().deriveBits({name: "ECDH", public: cleUa}, paire.privateKey, 256));
  const ikm = await hkdf(auth, secret, concat(te.encode("WebPush: info\0"), uaPublic, asPublic), 32);
  const sel = aleas.sel || globalThis.crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(sel, ikm, te.encode("Content-Encoding: aes128gcm\0"), 16);
  const nonce = await hkdf(sel, ikm, te.encode("Content-Encoding: nonce\0"), 12);
  const cle = await subtle().importKey("raw", cek, "AES-GCM", false, ["encrypt"]);
  const clair = concat(te.encode(texte), new Uint8Array([2])); // 2 = dernier (et seul) morceau
  if (clair.length > 3800) throw new Error("message trop long");
  const chiffre = new Uint8Array(await subtle().encrypt({name: "AES-GCM", iv: nonce}, cle, clair));
  const rs = new Uint8Array([0, 0, 0x10, 0]); // taille de morceau : 4096
  return concat(sel, rs, new Uint8Array([asPublic.length]), asPublic, chiffre);
}

/* Les seuls services de notification acceptés (Apple, Google, Mozilla, Microsoft) : le relais ne parle à personne d'autre. */
const SERVICES = [/^web\.push\.apple\.com$/, /^fcm\.googleapis\.com$/, /^updates\.push\.services\.mozilla\.com$/, /^[a-z0-9-]+\.notify\.windows\.com$/];
export function abonnementValide(a) {
  try {
    const u = new URL(a.endpoint);
    return u.protocol === "https:" && SERVICES.some(r => r.test(u.hostname)) && b64uDec(a.keys.p256dh).length === 65 && b64uDec(a.keys.auth).length === 16;
  } catch (e) { return false; }
}

/* Envoie un message à un téléphone. Renvoie le code HTTP du service (201 = remis ; 404/410 = abonnement mort). */
export async function envoyer(abonnement, donnees, cles, sujet, opts = {}) {
  const corps = await chiffrer(abonnement, JSON.stringify(donnees));
  const jwt = await jetonVapid(abonnement.endpoint, cles, sujet);
  const r = await (opts.fetch || fetch)(abonnement.endpoint, {
    method: "POST",
    headers: {
      Authorization: `vapid t=${jwt}, k=${cles.publique}`,
      "Content-Encoding": "aes128gcm", "Content-Type": "application/octet-stream",
      TTL: String(opts.ttl || 86400), Urgency: opts.urgent ? "high" : "normal",
    },
    body: corps,
  });
  return r.status;
}
