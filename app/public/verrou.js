/* Verrou de Mon QG : Face ID, empreinte ou code du téléphone, avant d'ouvrir l'app.
 *
 * Il utilise le déverrouillage du téléphone lui-même (WebAuthn, « clé d'accès » liée à cet appareil) :
 * l'app ne voit jamais votre visage, votre empreinte ni votre code. Elle garde seulement, sur ce téléphone,
 * le numéro de la clé créée (ce n'est pas un secret : sans le téléphone déverrouillé, il ne sert à rien).
 * Aucun nom ni e-mail n'est donné : la clé s'appelle « Mon QG ».
 * Le verrou protège l'écran ; vos données restent en plus derrière la connexion Google. */
(function () {
  "use strict";
  const CLE = "qg-verrou", RELOCK_MS = 5 * 60 * 1000;
  const lire = () => { try { return localStorage.getItem(CLE) || ""; } catch (e) { return ""; } };
  const ecrire = v => { try { v ? localStorage.setItem(CLE, v) : localStorage.removeItem(CLE); } catch (e) {} };
  const b64 = u8 => btoa(String.fromCharCode(...new Uint8Array(u8))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const deb64 = s => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4)), c => c.charCodeAt(0));
  const hasard = n => crypto.getRandomValues(new Uint8Array(n));

  async function possible() {
    try { return !!(window.PublicKeyCredential && await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()); } catch (e) { return false; }
  }

  async function verifier() {
    const id = lire(); if (!id) return true;
    const r = await navigator.credentials.get({publicKey: {challenge: hasard(32), allowCredentials: [{type: "public-key", id: deb64(id)}], userVerification: "required", timeout: 60000}});
    return !!(r && b64(r.rawId) === id && r.response && (new Uint8Array(r.response.authenticatorData)[32] & 0x04)); // drapeau « utilisateur vérifié »
  }

  async function activer() {
    const c = await navigator.credentials.create({publicKey: {
      challenge: hasard(32), rp: {name: "Mon QG"}, user: {id: hasard(16), name: "Mon QG", displayName: "Mon QG"},
      pubKeyCredParams: [{type: "public-key", alg: -7}, {type: "public-key", alg: -257}],
      authenticatorSelection: {authenticatorAttachment: "platform", userVerification: "required", residentKey: "discouraged"},
      attestation: "none", timeout: 60000}});
    if (!c) throw new Error("annulé");
    ecrire(b64(c.rawId));
  }

  async function retirer() { if (await verifier()) ecrire(""); else throw new Error("refus"); }

  /* L'écran verrouillé, posé avant que l'app ne s'affiche. */
  let ecran = null, cache = 0;
  function verrouiller() {
    if (!lire() || ecran) return;
    ecran = document.createElement("div");
    ecran.className = "verrou"; ecran.setAttribute("role", "dialog"); ecran.setAttribute("aria-modal", "true"); ecran.setAttribute("aria-label", "Mon QG est verrouillé");
    ecran.innerHTML = '<div class="boite"><span class="av">Q</span><h1>Mon QG</h1><p class="sub" style="margin:0">Seul vous pouvez entrer : Face ID, empreinte ou code du téléphone.</p>' +
      '<button class="btn primary" id="deverrouiller">Déverrouiller</button><p class="sub" id="verrou-msg" role="status" style="margin:0"></p></div>';
    document.body.appendChild(ecran);
    const vue = document.getElementById("view"); if (vue) vue.setAttribute("aria-hidden", "true");
    ecran.querySelector("#deverrouiller").addEventListener("click", ouvrir);
  }
  async function ouvrir() {
    const msg = ecran && ecran.querySelector("#verrou-msg");
    try {
      if (await verifier()) {
        ecran.remove(); ecran = null;
        const vue = document.getElementById("view"); if (vue) vue.removeAttribute("aria-hidden");
        return;
      }
      if (msg) msg.textContent = "Pas reconnu. Réessayez.";
    } catch (e) { if (msg) msg.textContent = "Déverrouillage annulé. Touchez « Déverrouiller » pour réessayer."; }
  }
  verrouiller();
  // De retour dans l'app après plus de 5 minutes : on reverrouille.
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) cache = Date.now();
    else if (cache && Date.now() - cache > RELOCK_MS) verrouiller();
  });

  window.QG_VERROU = Object.freeze({possible, actif: () => !!lire(), activer, retirer, verrouille: () => !!ecran});
})();
