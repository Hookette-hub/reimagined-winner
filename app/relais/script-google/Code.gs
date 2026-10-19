/* Mon QG — le petit script Google qui prévient le téléphone (notifications « app fermée »).
 *
 * Il vit DANS le tableau TEST (Extensions > Apps Script) et tourne avec votre compte Google, chez Google.
 * Toutes les 15 minutes, il regarde l'onglet « Décisions & Questions » : pour chaque nouvelle décision qui vous
 * attend (ou problème grave), il demande au relais de Mon QG d'envoyer une notification à votre téléphone.
 * Aucun mot de passe, aucune clé : le relais vérifie auprès de Google que c'est bien votre compte.
 *
 * Mise en route (une seule fois) : collez ce fichier, remplacez l'adresse ci-dessous par celle de votre app,
 * puis lancez la fonction « installer » (bouton ▶) et acceptez les autorisations. */

var ADRESSE_APP = "https://VOTRE-APP.pages.dev"; // ← l'adresse de Mon QG (Cloudflare Pages)

var ONGLET = "Décisions & Questions";
var MOTS_GRAVES = /instruction cach[ée]e|fuite de|fuite d.|secret|piratage|intrusion|l[ée]gal|juridique|rgpd|plainte|perte de donn[ée]es|donn[ée]es perdues|action interdite|sauvegarde/i;

/* Les 5 sortes de décisions qui reviennent au patron (mêmes règles que l'app). */
function sorte_(type, desc) {
  var d = String(desc || "").toLowerCase();
  if (/valider le projet/.test(d)) return "Valider le projet";
  if (/approuver l.aper[cç]u|valider l.aper[cç]u/.test(d)) return "Valider l'aperçu";
  if (/d[ée]cision apr[eè]s le test|revue trimestrielle/.test(d)) return "Décider après le test";
  if (/alerte budget|acheter le nom de domaine|cr[ée]er les comptes communs|au-del[aà] du budget/.test(d)) return "Dépense réelle";
  var sans = d.replace(/«[^»]*»/g, "");
  if ((type === "Urgence" || type === "Problème") && MOTS_GRAVES.test(sans) && !/d[ée]pense anormale|acc[eè]s refus[ée] par un service|rien depuis/.test(d)) return "GRAVE";
  return null;
}

function empreinte_(texte) {
  var o = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, texte, Utilities.Charset.UTF_8);
  return o.slice(0, 8).map(function (b) { return ((b + 256) % 256).toString(16); }).join("");
}

function verifier() {
  var classeur = SpreadsheetApp.getActive();
  if (!/^TEST\b/.test(classeur.getName())) throw new Error("Ce script ne marche que dans le tableau TEST.");
  if (/VOTRE-APP/.test(ADRESSE_APP)) throw new Error("Remplacez d'abord ADRESSE_APP par l'adresse de votre app.");
  var lignes = classeur.getSheetByName(ONGLET).getDataRange().getDisplayValues();
  var tete = lignes[0], col = function (debut) { for (var i = 0; i < tete.length; i++) if (String(tete[i]).indexOf(debut) === 0) return i; return -1; };
  var cType = col("Type"), cDesc = col("Description"), cRep = col("RÉPONSE DU PRÉSIDENT"), cStat = col("Statut"), cDate = col("Date");

  var props = PropertiesService.getScriptProperties();
  var deja = JSON.parse(props.getProperty("deja") || "[]"), vus = [], nouvelles = [];
  for (var n = 1; n < lignes.length; n++) {
    var r = lignes[n];
    if (!/attente/i.test(r[cStat]) || String(r[cRep]).trim()) continue;
    var sorte = sorte_(r[cType], r[cDesc]);
    if (!sorte) continue;
    var cle = empreinte_(r[cDate] + "|" + r[cDesc]);
    vus.push(cle);
    if (deja.indexOf(cle) >= 0) continue;
    var grave = sorte === "GRAVE";
    nouvelles.push({
      titre: grave ? "Problème grave : à regarder" : "Une décision vous attend",
      texte: (grave ? "" : sorte + " · ") + String(r[cDesc]).replace(/https?:\/\/\S+/g, "").slice(0, 200),
      url: "/#decisions." + (n + 1), tag: cle, urgent: grave,
    });
  }
  if (nouvelles.length) {
    var rep = UrlFetchApp.fetch(ADRESSE_APP.replace(/\/+$/, "") + "/api/signal", {
      method: "post", contentType: "application/json", muteHttpExceptions: true,
      headers: {Authorization: "Bearer " + ScriptApp.getOAuthToken()},
      payload: JSON.stringify({notifications: nouvelles.slice(0, 10)}),
    });
    if (rep.getResponseCode() !== 200) throw new Error("Le relais a répondu " + rep.getResponseCode() + " : " + rep.getContentText().slice(0, 200));
  }
  props.setProperty("deja", JSON.stringify(vus)); // on oublie les décisions réglées
}

/* À lancer une fois : vérifie tout de suite, puis toutes les 15 minutes. */
function installer() {
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === "verifier") ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger("verifier").timeBased().everyMinutes(15).create();
  verifier();
}

/* Pour tout arrêter. */
function arreter() {
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === "verifier") ScriptApp.deleteTrigger(t); });
}
