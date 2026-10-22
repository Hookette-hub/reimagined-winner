"""Mon QG (venu du QG Usine) : chaque écran et chaque bouton qui écrit, testés avec Playwright (tailles iPhone et Android).

Google est simulé : aucune vraie connexion, aucune vraie donnée (tout est inventé ici, marqué TEST).
Lancer : pip install playwright==1.63.0 pytest && python -m playwright install chromium && pytest app/tests
"""

import json
import os
import re
import socket
import subprocess
import sys
import time
from pathlib import Path
from urllib.parse import parse_qs, unquote, urlparse

import pytest

sync_api = pytest.importorskip("playwright.sync_api")

PUBLIC = Path(__file__).resolve().parents[1] / "public"
NAVIGATEUR = os.environ.get("QG_CHROMIUM")  # ex. /opt/pw-browsers/chromium ; sinon celui de Playwright
APPAREILS = ["iPhone 13", "Pixel 7"]
NOM_TABLEAU = "TEST – Tableau de suivi – Usine à projets"
ID_CLIENT = "123456789012-abcdefghijklmnopqrstuvwxyz123456.apps.googleusercontent.com"  # faux, format seulement

ENTETES = {
    "État du moteur": ["Rubrique", "Nom", "État", "Détail", "Date"],
    "Décisions & Questions": ["Date", "Agent", "Projet (ID)", "Type (Question / Problème / Validation / Préparation / Urgence)",
                              "Description", "Options possibles", "Recommandation de l'agent", "RÉPONSE DU PRÉSIDENT",
                              "Statut (En attente / Répondu / Traité)", "Date de traitement"],
    "Projets": ["ID", "Date création", "Nom du projet", "Type", "Niche / cible", "Problème résolu (valeur client)",
                "Valeur client /5", "Demande /5", "Concurrence /5", "Rentabilité /5", "Coût & risque /5", "Long terme /5",
                "Synergie /5", "Note totale /35", "Décision (GO / À CREUSER / NON)", "Statut", "Lien du plan",
                "Prochaine action", "Validation requise de ta part", "Notes", "Originalité /5 (min. 4 pour GO)",
                "Concept unique (« le seul à … pour … »)"],
    "Parler à l'Usine": ["Date", "Message", "Type", "Réponse", "Statut"],
    "Données du QG": ["Rubrique", "Clé", "Période", "Données", "Date"],
}
LIGNES = {
    "État du moteur": [
        ["Agent", "Veille & Stratégie", "OK", "3 exécution(s), 0 échec(s), 1 tâche(s) en attente · chaque jour", "2026-10-18"],
        ["Moteur", "Coût IA du mois", "0.42", "", "2026-10-18"],
        ["Plan", "Projets actifs", "1", "Pour 1 000 € par mois dans 18 mois.", "2026-10-18"],
    ],
    "Projets": [["TEST-P900", "2026-10-10", "Projet Exemple", "SaaS", "freelances", "Un problème inventé pour le test.",
                 "4", "4", "3", "4", "4", "4", "3", "26", "GO", "Étude de marché", "", "Écrire l'étude", "", "", "4", ""]],
    "Décisions & Questions": [["2026-10-18", "Chef de produit", "TEST-P900", "Validation",
                               "Valider le projet TEST-P900. Résumé d'une page : https://docs.google.com/document/d/DOCEXEMPLE1234567/edit",
                               "1) Valider / 2) Corriger", "Valider", "", "En attente", ""]],
    "Parler à l'Usine": [["2026-10-18 09:00", "Où en est Projet Exemple ? (projet TEST-P900, Projet Exemple)", "Question", "L'étude avance.", "Répondu"]],
    "Données du QG": [["Projet mois", "TEST-P900", "2026-10", json.dumps({"visiteurs": 0, "revenus": 0, "depenses": 3}), "2026-10-18"]],
}
ABSENTS = {"Lacunes"}  # un onglet optionnel qui n'existe pas encore : l'app doit le supporter


def onglet_de(plage):
    m = re.match(r"^'((?:[^']|'')+)'!|^([^!]+)!", plage)
    return (m.group(1) or m.group(2)).replace("''", "'")


@pytest.fixture(scope="session")
def serveur():
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        port = s.getsockname()[1]
    proc = subprocess.Popen([sys.executable, "-m", "http.server", str(port), "--bind", "127.0.0.1", "-d", str(PUBLIC)],
                            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    for _ in range(50):
        try:
            socket.create_connection(("127.0.0.1", port), 0.2).close()
            break
        except OSError:
            time.sleep(0.1)
    yield f"http://127.0.0.1:{port}"
    proc.terminate()


@pytest.fixture(scope="session")
def pw():
    with sync_api.sync_playwright() as p:
        yield p


@pytest.fixture(scope="session")
def navigateur(pw):
    b = pw.chromium.launch(executable_path=NAVIGATEUR) if NAVIGATEUR else pw.chromium.launch()
    yield b
    b.close()


class FauxGoogle:
    """Simule la connexion Google et les API Sheets / Drive, et note chaque écriture."""

    def __init__(self, page, serveur):
        self.ecritures, self.lignes = [], {k: [list(r) for r in v] for k, v in LIGNES.items()}
        page.route("https://accounts.google.com/**", self.connexion)
        page.route("https://sheets.googleapis.com/**", self.sheets)
        page.route("https://www.googleapis.com/**", self.drive)
        page.route("https://oauth2.googleapis.com/**", lambda r: r.fulfill(status=200, body=""))

    def connexion(self, route):
        q = parse_qs(urlparse(route.request.url).query)
        assert q["response_type"] == ["token"] and q["client_id"] == [ID_CLIENT]
        assert "https://www.googleapis.com/auth/drive" not in q["scope"][0].split()  # jamais le Drive complet
        frag = f"access_token=FAUX-JETON-123&token_type=Bearer&expires_in=3599&state={q['state'][0]}" \
               f"&scope={q['scope'][0].replace(' ', '%20')}"
        route.fulfill(status=302, headers={"Location": q["redirect_uri"][0] + "#" + frag})

    def _jeton(self, route):
        assert route.request.headers.get("authorization") == "Bearer FAUX-JETON-123"

    def sheets(self, route):
        self._jeton(route)
        url, methode = route.request.url, route.request.method
        assert "/spreadsheets/ID-TABLEAU-TEST/values/" in url
        plage = unquote(url.split("/values/")[1].split("?")[0].split(":append")[0])
        onglet = onglet_de(plage)
        if methode == "GET":
            if onglet in ABSENTS:
                return route.fulfill(status=400, json={"error": {"message": f"Unable to parse range: {plage}"}})
            return route.fulfill(json={"range": plage, "values": [ENTETES.get(onglet, ["A"])] + self.lignes.get(onglet, [])})
        corps = json.loads(route.request.post_data)
        self.ecritures.append({"methode": methode, "plage": plage, "valeurs": corps["values"], "url": url})
        if methode == "PUT" and onglet == "Décisions & Questions":  # la réponse disparaît des décisions en attente
            n = int(re.search(r"H(\d+)", plage).group(1))
            ligne = self.lignes[onglet][n - 2]
            ligne[7], ligne[8] = corps["values"][0]
        if methode == "POST" and onglet == "Parler à l'Usine":
            self.lignes[onglet].append(corps["values"][0])
        route.fulfill(json={"updates": {"updatedRows": 1}})

    def drive(self, route):
        self._jeton(route)
        url = route.request.url
        if "/upload/drive/v3/files" in url:
            self.ecritures.append({"methode": "POST", "plage": "Drive", "corps": route.request.post_data, "url": url})
            return route.fulfill(json={"id": "DOC-NOUVEAU", "webViewLink": "https://docs.google.com/document/d/DOC-NOUVEAU"})
        if "/drive/v3/files?" in url:
            q = parse_qs(urlparse(url).query)["q"][0]
            if "spreadsheet" in q:
                return route.fulfill(json={"files": [{"id": "ID-TABLEAU-TEST", "name": NOM_TABLEAU}]})
            return route.fulfill(json={"files": [{"id": "ID-DOSSIER-A-INTEGRER", "name": "À intégrer (TEST)"}]})
        if "/export?" in url:
            return route.fulfill(body="# Projet Exemple\n**Quoi :** un résumé inventé pour le test.\n- point un\n- point deux",
                                 content_type="text/plain")
        route.fulfill(status=404, json={"error": {"message": "inconnu"}})


def ouvrir(pw, navigateur, serveur, appareil):
    ctx = navigateur.new_context(**pw.devices[appareil], locale="fr-FR")
    page = ctx.new_page()
    page.erreurs = []
    page.on("pageerror", lambda e: page.erreurs.append(str(e)))
    # l'onglet absent (400) est voulu par le test : le navigateur l'affiche, ce n'est pas une erreur de l'app
    page.on("console", lambda m: m.type == "error" and "status of 400" not in m.text and page.erreurs.append(m.text))
    return ctx, page


def connecter(page, serveur, avant=None):
    google = FauxGoogle(page, serveur)
    if avant:
        avant(google)
    page.goto(serveur + "/")
    page.fill("#client-id", ID_CLIENT)
    page.click("#client-ok")
    page.wait_for_selector(".machine", timeout=15000)  # les vraies données sont lues
    return google


def verifier_ecran(page, h):
    page.evaluate("h => { location.hash = h; }", h)
    page.wait_for_timeout(60)
    texte = page.inner_text("#view")
    assert "n'a pas pu s'afficher" not in texte, h
    assert texte.strip(), h
    largeur = page.evaluate("[document.documentElement.scrollWidth, window.innerWidth]")
    assert largeur[0] <= largeur[1] + 1, f"{h} : défilement horizontal {largeur}"


def parcourir(page, depart="accueil", limite=250):
    vus, file = set(), [depart]
    while file and len(vus) < limite:
        h = file.pop(0)
        if h in vus:
            continue
        vus.add(h)
        verifier_ecran(page, h)
        for lien in page.eval_on_selector_all("a[href^='#']", "els => els.map(e => e.getAttribute('href').slice(1))"):
            if lien and lien not in vus:
                file.append(lien)
    return vus


@pytest.mark.parametrize("appareil", APPAREILS)
def test_chaque_ecran_simulation(pw, navigateur, serveur, appareil):
    ctx, page = ouvrir(pw, navigateur, serveur, appareil)
    page.goto(serveur + "/")
    page.click("#view button[data-mode=sim] >> nth=0")
    page.wait_for_selector("text=Centre de pilotage")
    vus = parcourir(page)
    assert len(vus) > 40, len(vus)  # tous les niveaux : projets, équipe, argent, Bibliothèque, Usine…
    assert not page.erreurs, page.erreurs
    ctx.close()


@pytest.mark.parametrize("appareil", APPAREILS)
def test_chaque_ecran_reel_avec_google_simule(pw, navigateur, serveur, appareil):
    ctx, page = ouvrir(pw, navigateur, serveur, appareil)
    connecter(page, serveur)
    assert "access_token" not in page.url  # le jeton est retiré de l'adresse aussitôt
    vus = parcourir(page)
    assert len(vus) > 25, len(vus)
    assert not page.erreurs, page.erreurs
    ctx.close()


def test_jeton_jamais_enregistre(pw, navigateur, serveur):
    ctx, page = ouvrir(pw, navigateur, serveur, "iPhone 13")
    connecter(page, serveur)
    stock = page.evaluate("() => JSON.stringify([Object.entries(localStorage), Object.entries(sessionStorage), document.cookie])")
    assert "FAUX-JETON" not in stock, stock
    assert "ID-TABLEAU-TEST" not in stock  # l'ID du tableau non plus
    page.reload()  # après un redémarrage de l'app, il faut se reconnecter
    page.wait_for_selector("#connexion")
    ctx.close()


def test_boutons_qui_ecrivent(pw, navigateur, serveur):
    ctx, page = ouvrir(pw, navigateur, serveur, "Pixel 7")
    google = connecter(page, serveur)
    ecr = google.ecritures

    # 1. Message dans « Parler de ce projet »
    page.evaluate("location.hash = 'projets.TEST-P900.messages'")
    page.fill("#cm", "Peux-tu résumer l'étude ?")
    page.click("form[data-sujet] button")
    page.wait_for_selector("text=Message envoyé")
    assert ecr[-1]["methode"] == "POST" and ecr[-1]["plage"].startswith("'Parler à l''Usine'")
    assert ecr[-1]["valeurs"][0][1] == "Peux-tu résumer l'étude ? (projet TEST-P900, Projet Exemple)"
    assert page.input_value("#cm") == ""  # un message bien envoyé ne reste pas dans la case

    # 2. Contrat d'un employé : modèle, prénom, remplaçant
    page.evaluate("location.hash = 'equipe.veille_strategie.contrat'")
    page.click("button[data-modele=standard]")
    page.wait_for_selector("text=La demande est envoyée")
    assert ecr[-1]["valeurs"][0][1] == "Change le modèle de « Veille & Stratégie » : standard"
    page.fill("#np", "Yara")
    page.click("form[data-renommer] button")
    page.wait_for_selector("text=s'appellera Yara")
    assert ecr[-1]["valeurs"][0][1] == "Change le prénom de « Veille & Stratégie » en Yara"
    page.click("button[data-remplacer]")
    page.wait_for_selector("text=proposera un remplaçant")
    assert ecr[-1]["valeurs"][0][1] == "Change « Veille & Stratégie » : demander un remplaçant"

    # 3. Objectif
    page.evaluate("location.hash = 'argent.objectif'")
    page.fill("#obj-eur", "1000")
    page.fill("#obj-mois", "18")
    page.evaluate("window.QG_GOOGLE.mcp.invalidate()")  # les données se relisent pendant la saisie
    page.wait_for_timeout(300)
    assert page.input_value("#obj-eur") == "1000" and page.input_value("#obj-mois") == "18"  # rien n'est effacé
    page.click("form[data-objectif] button")
    page.wait_for_selector("text=Objectif envoyé")
    assert ecr[-1]["valeurs"][0][1] == "Change l'objectif : 1000 € par mois dans 18 mois"

    # 4. Déposer un document dans le Drive (« À intégrer »)
    page.evaluate("location.hash = 'biblio.deposer'")
    page.fill("#dep-titre", "Bonne pratique de test")
    page.fill("#dep-texte", "Un texte inventé pour le test.")
    page.click("form[data-deposer] button")
    page.wait_for_selector("text=est dans « À intégrer »")
    assert ecr[-1]["plage"] == "Drive" and "ID-DOSSIER-A-INTEGRER" in ecr[-1]["corps"]
    assert '"mimeType":"application/vnd.google-apps.document"' in ecr[-1]["corps"]

    # 5. Décision : le résumé d'une page se lit dans Drive, puis « Demander des corrections » et « Valider »
    page.evaluate("location.hash = 'decisions.2'")
    page.click("details.rep summary")
    page.wait_for_selector("text=un résumé inventé pour le test")
    page.click("button[data-corriger]")
    page.fill("#fixt-2", "Ajoute les prix des concurrents.")
    page.click("form[data-fix] button")
    page.wait_for_selector("text=Vos corrections sont envoyées")
    assert ecr[-1]["methode"] == "PUT" and ecr[-1]["plage"] == "'Décisions & Questions'!H2:I2"
    assert ecr[-1]["valeurs"] == [["Demander des corrections : Ajoute les prix des concurrents.", "Répondu"]]

    # 6. Le chat de l'accueil : un ordre écrit dans « Parler à l'Usine »
    page.evaluate("location.hash = 'accueil'")
    page.click("button[data-chip^='Ajoute cette vidéo']")
    assert page.input_value("#chat-in").startswith("Ajoute cette vidéo à la Bibliothèque")
    page.fill("#chat-in", "Lance un test pour Projet Exemple")
    page.click("form[data-chat] button")
    page.wait_for_selector("text=Envoyé à l'Usine")
    assert ecr[-1]["methode"] == "POST" and ecr[-1]["valeurs"][0][1] == "Lance un test pour Projet Exemple"
    assert page.input_value("#chat-in") == ""

    # 7. Agir : mettre un projet en pause (2 touchers), ajouter une vidéo, budget IA
    page.evaluate("location.hash = 'projets.TEST-P900'")
    n = len(ecr)
    page.click("button[data-ordre^='Change, mets en pause']")
    page.wait_for_selector("text=Touchez encore pour confirmer")
    assert len(ecr) == n  # un seul toucher n'écrit rien
    page.click("button[data-ordre^='Change, mets en pause']")
    page.wait_for_selector("text=sera mis en pause")
    assert ecr[-1]["valeurs"][0][1] == "Change, mets en pause le projet TEST-P900 (Projet Exemple)"
    page.evaluate("location.hash = 'biblio'")
    page.fill("#video-url", "https://www.youtube.com/watch?v=exemple")
    page.click("form[data-video] button")
    page.wait_for_selector("text=Vidéo envoyée")
    assert ecr[-1]["valeurs"][0][1] == "Ajoute cette vidéo à la Bibliothèque : https://www.youtube.com/watch?v=exemple"
    page.evaluate("location.hash = 'reglages'")
    page.fill("#budget-jour", "2")
    page.click("form[data-budget] button")
    page.wait_for_selector("text=budget IA de 2,00 $ par jour")
    assert ecr[-1]["valeurs"][0][1] == "Change le budget IA par jour : 2 $"

    # 8. Chaque page a son chat : celui d'un agent, et celui d'une décision
    page.evaluate("location.hash = 'equipe.veille_strategie'")
    page.fill("#cm", "Que cherches-tu cette semaine ?")
    page.click("form[data-sujet] button")
    page.wait_for_selector("text=Message envoyé")
    assert ecr[-1]["valeurs"][0][1] == "Que cherches-tu cette semaine ? (agent « Veille & Stratégie »)"
    page.wait_for_selector("#thread >> text=Que cherches-tu cette semaine ?")  # il apparaît dans le chat de l'agent
    assert not page.erreurs, page.erreurs
    ctx.close()


def test_valider_une_decision(pw, navigateur, serveur):
    ctx, page = ouvrir(pw, navigateur, serveur, "iPhone 13")
    google = connecter(page, serveur)
    page.evaluate("location.hash = 'decisions.2'")
    page.wait_for_selector("text=L'analyse")
    page.click("button[data-opt='1']")
    page.wait_for_selector("text=Touchez encore pour confirmer")
    assert google.ecritures == []  # un seul toucher n'écrit rien
    page.click("button[data-opt='1']")
    page.wait_for_selector("text=C'est noté")
    assert google.ecritures[-1]["plage"] == "'Décisions & Questions'!H2:I2"
    assert google.ecritures[-1]["valeurs"] == [["1", "Répondu"]]
    assert not page.erreurs, page.erreurs
    ctx.close()


def test_simulation_n_envoie_rien(pw, navigateur, serveur):
    ctx, page = ouvrir(pw, navigateur, serveur, "Pixel 7")
    appels = []
    page.route(re.compile(r"https://.*google.*"), lambda r: (appels.append(r.request.url), r.abort()))
    page.goto(serveur + "/")
    page.click("#view button[data-mode=sim] >> nth=0")
    page.evaluate("location.hash = 'biblio.deposer'")
    page.fill("#dep-titre", "Essai")
    page.fill("#dep-texte", "Essai")
    page.click("form[data-deposer] button")
    page.wait_for_selector("text=Simulation : « Essai »")
    page.evaluate("location.hash = 'decisions'")
    page.click(".rowl >> nth=0")
    page.click("button[data-opt='1']")
    page.click("button[data-opt='1']")
    page.wait_for_selector("text=C'est noté")
    assert page.evaluate("location.hash") == "#decisions"  # on revient à l'onglet d'où l'on vient
    page.click("#tabs [data-tab=chat]")
    page.fill("#chat-in", "Où en est PDF Sans Fuite ?")
    page.click("form[data-chat] button")
    page.wait_for_selector("text=phase « Suivi »")
    assert appels == []
    ctx.close()


def test_hors_ligne(pw, navigateur, serveur):
    """L'app s'ouvre sans réseau (fichiers de l'app gardés par le service worker) et la Simulation marche."""
    ctx, page = ouvrir(pw, navigateur, serveur, "iPhone 13")
    page.goto(serveur + "/")
    page.wait_for_function("navigator.serviceWorker.controller !== null || navigator.serviceWorker.ready.then(() => true)")
    page.evaluate("navigator.serviceWorker.ready")
    page.reload()
    page.wait_for_function("navigator.serviceWorker.controller !== null")
    ctx.set_offline(True)
    page.reload()
    page.click("#view button[data-mode=sim] >> nth=0")
    page.wait_for_selector("text=Centre de pilotage")
    page.evaluate("location.hash = 'projets'")
    page.wait_for_selector("text=Mes projets")
    ctx.close()


def test_mauvais_retour_de_connexion_refuse(pw, navigateur, serveur):
    ctx, page = ouvrir(pw, navigateur, serveur, "iPhone 13")
    page.goto(serveur + "/#access_token=VOLE&state=inconnu&scope=https://www.googleapis.com/auth/spreadsheets")
    page.wait_for_selector("text=n'a pas pu être vérifiée")
    assert "VOLE" not in page.url
    ctx.close()


ESPION_NOTIFICATIONS = """
window.__notifs = []; window.__badges = [];
const garder = (t, o) => { window.__notifs.push({titre: t, texte: (o || {}).body || "", url: ((o || {}).data || {}).url || ""}); return Promise.resolve(); };
ServiceWorkerRegistration.prototype.showNotification = function (t, o) { return garder(t, o); };
window.Notification = class extends EventTarget { static get permission() { return "granted"; } static requestPermission() { return Promise.resolve("granted"); }
  constructor(t, o) { super(); garder(t, o); } close() {} };
navigator.setAppBadge = n => { window.__badges.push(n); return Promise.resolve(); };
navigator.clearAppBadge = () => { window.__badges.push(0); return Promise.resolve(); };
"""


def test_notification_quand_une_decision_attend(pw, navigateur, serveur):
    ctx, page = ouvrir(pw, navigateur, serveur, "Pixel 7")
    ctx.add_init_script(ESPION_NOTIFICATIONS)
    google = connecter(page, serveur)
    page.wait_for_function("() => window.__notifs.length >= 1")
    n = page.evaluate("window.__notifs")
    assert n == [{"titre": "Une décision vous attend", "texte": n[0]["texte"], "url": "/#decisions.2"}]
    assert n[0]["texte"].startswith("Valider le projet Projet Exemple")
    assert page.evaluate("window.__badges.at(-1)") == 1  # la pastille sur l'icône
    assert "1 décision vous attend" in page.inner_text(".verdict2")  # et sur l'accueil

    # relire le tableau ne réannonce pas la même décision
    page.evaluate("window.QG_GOOGLE.mcp.invalidate()")
    page.wait_for_timeout(500)
    assert page.evaluate("window.__notifs.length") == 1

    # une nouvelle décision (problème grave) arrive : une seule nouvelle notification, marquée grave
    google.lignes["Décisions & Questions"].append(["2026-10-19", "Maintenance", "", "Urgence",
                                                   "Fuite de données suspectée sur le site de test.", "1) Couper / 2) Attendre", "Couper", "", "En attente", ""])
    page.evaluate("window.QG_GOOGLE.mcp.invalidate()")
    page.wait_for_function("() => window.__notifs.length >= 2")
    page.wait_for_timeout(300)
    n = page.evaluate("window.__notifs")
    assert len(n) == 2 and n[1]["titre"] == "Problème grave : à regarder" and n[1]["url"] == "/#decisions.3"
    assert page.evaluate("window.__badges.at(-1)") == 2

    # le téléphone ne garde que des empreintes, jamais le texte des décisions
    stock = page.evaluate("() => JSON.stringify(Object.entries(localStorage))")
    assert "Fuite" not in stock and "Valider" not in stock
    assert re.search(r'"qg-notifiees","[0-9a-f]{8},[0-9a-f]{8}"', stock), stock
    assert not page.erreurs, page.erreurs
    ctx.close()


def test_accueil_resume_puis_fenetre_decision(pw, navigateur, serveur):
    """Un toucher = un niveau : l'accueil résume, la fenêtre montre tout, « Retour » ramène, décider = 2 touchers."""
    ctx, page = ouvrir(pw, navigateur, serveur, "iPhone 13")
    google = connecter(page, serveur)
    page.wait_for_selector(".dec2")
    assert "Valider le projet Projet Exemple" in page.inner_text(".dec2")
    page.click("text=Ouvrir la décision")
    page.wait_for_selector("#view >> text=Le coût et l'estimation")
    page.click("#navbar .back")
    page.wait_for_selector(".dec2")
    page.click("text=Ouvrir la décision")
    page.click("button[data-opt='1']")
    assert google.ecritures == []
    page.click("button[data-opt='1']")
    page.wait_for_selector("text=Rien à décider")
    assert google.ecritures[-1]["valeurs"] == [["1", "Répondu"]]
    assert page.evaluate("location.hash") == "#accueil"
    assert "0 €" in page.inner_text(".money")  # Réel : un 0 € honnête
    assert not page.erreurs, page.erreurs
    ctx.close()


def test_la_machine_et_les_reglages(pw, navigateur, serveur):
    ctx, page = ouvrir(pw, navigateur, serveur, "iPhone 13")
    page.goto(serveur + "/")
    page.click("#view button[data-mode=sim] >> nth=0")
    for tuile, titre in (("equipe", "Le Superviseur"), ("biblio", "La Bibliothèque"), ("securite", "Tout est vert"), ("reglages", "Données affichées")):
        page.click(f".mtile[href='#{tuile}']")
        page.wait_for_selector(f"#view >> text={titre}")
        page.click("#navbar .back")
        page.wait_for_selector(".machine")
    page.click(".mtile[href='#reglages']")
    page.click("a[href='#demarrage']")
    page.wait_for_selector("text=Ce que vous devez faire vous-même")
    page.click("#navbar .back")  # Retour = un niveau plus haut : Réglages
    page.wait_for_selector("text=Données affichées")
    page.click("button[data-theme-choix=dark]")
    assert page.evaluate("document.documentElement.dataset.theme") == "dark"
    page.click("button[data-theme-choix=auto]")
    assert page.evaluate("document.documentElement.dataset.theme") is None
    page.click("#navbar .back")
    page.click(".toggle button[data-mode=reel]")  # revenir aux vraies données
    page.wait_for_selector("#client-id")
    assert not page.erreurs, page.erreurs
    ctx.close()


def test_notifications_app_fermee_sans_relais(pw, navigateur, serveur):
    """Avant la mise en ligne, il n'y a pas de relais : l'app le dit simplement, sans erreur."""
    ctx, page = ouvrir(pw, navigateur, serveur, "Pixel 7")
    ctx.grant_permissions(["notifications"], origin=serveur)
    page.goto(serveur + "/#reglages")
    page.click("#view button[data-mode=sim] >> nth=0")
    page.evaluate("location.hash = 'reglages'")
    page.click("#notif-push")
    page.wait_for_selector("text=Le relais n'est pas encore en ligne")
    ctx.close()


def test_projet_bibliotheque_agents_en_detail(pw, navigateur, serveur):
    """Chaque page : je vois (avancement, construction, qui fait, résultat, déroulement), je contrôle, son chat."""
    ctx, page = ouvrir(pw, navigateur, serveur, "Pixel 7")
    page.goto(serveur + "/")
    page.click("#view button[data-mode=sim] >> nth=0")
    page.evaluate("location.hash = 'projets.P001'")
    texte = page.inner_text("#view")
    for mot in ("Avancement", "En construction", "Qui le fait", "Résultat", "Déroulement", "Je contrôle", "Parler de ce projet", "MESURÉ"):
        assert mot.lower() in texte.lower(), mot
    page.fill("#cm", "Où en est PDF Sans Fuite ?")
    page.click("form[data-sujet] button")
    page.wait_for_selector("#thread >> text=phase « Suivi »")
    page.evaluate("location.hash = 'biblio'")
    texte = page.inner_text("#view")
    for mot in ("La porte", "L'aile manuelle", "L'aile système", "🟢", "Ajouter une vidéo"):
        assert mot.lower() in texte.lower(), mot
    page.click("button[data-ordre='Change, valide la fiche S3']")
    page.click("button[data-ordre='Change, valide la fiche S3']")
    page.wait_for_selector("text=entre dans la Bibliothèque")
    page.evaluate("location.hash = 'equipe'")
    assert "Le Superviseur" in page.inner_text("#view")
    page.evaluate("location.hash = 'equipe.sami'")
    texte = page.inner_text("#view")
    for mot in ("Son métier", "Avancement", "Sa note", "🟡", "Mettre en pause", "Parler avec Sami"):
        assert mot.lower() in texte.lower(), mot
    assert not page.erreurs, page.erreurs
    ctx.close()


def test_projet_en_5_phases(pw, navigateur, serveur):
    """Le QG d'un projet : les 5 phases ; Construction = vos choix d'abord, puis 3 pistes de design ; le lancement est dans Publier."""
    ctx, page = ouvrir(pw, navigateur, serveur, "iPhone 13")
    page.goto(serveur + "/")
    page.click("#view button[data-mode=sim] >> nth=0")
    page.click("#tabs [data-tab=projets]")
    page.wait_for_selector("#view >> text=Rangés par phase")
    texte = page.inner_text("#view")
    for mot in ("Phase 1 · Idée", "Phase 2 · Construction", "Phase 3 · Publier", "Phase 4 · Suivi", "Phase 5 · Mort"):
        assert mot.lower() in texte.lower(), mot
    page.click("text=Juste Prix Freelance")
    page.wait_for_selector("#view >> text=Les 5 phases")
    page.click("#view a[href='#projets.P004.phase2']")
    page.wait_for_selector("#view >> text=Avancement de la construction")
    texte = page.inner_text("#view")
    for mot in ("Porte 2", "L'aperçu du site est prêt", "étape 1", "domaine, branding, logo", "justeprix-freelance.fr",
                "le design", "3 pistes de design", "Calme pro", "Énergie", "Papier"):
        assert mot.lower() in texte.lower(), mot
    assert "se faire connaître" not in texte.lower()  # la stratégie de lancement se choisit dans Publier
    assert "étape 2" not in texte.lower()
    b = "#view button[data-ordre*='« Calme pro »']"
    page.click(b)
    page.click(b)
    page.wait_for_selector("text=Choix envoyé")
    page.click("#navbar .back")
    page.wait_for_selector("#view >> text=Les 5 phases")
    page.evaluate("location.hash = 'projets.P004.phase3'")
    page.wait_for_selector("#view >> text=La stratégie de lancement")
    texte = page.inner_text("#view")
    for mot in ("Acheter le domaine", "justeprix-freelance.fr", "L'Usine le fait", "Le minimum pour vous"):
        assert mot.lower() in texte.lower(), mot
    for n in (1, 4, 5):
        page.evaluate("n => { location.hash = 'projets.P004.phase' + n; }", n)
        page.wait_for_selector(f"#view >> text=phase {n} sur 5")
    assert not page.erreurs, page.erreurs
    ctx.close()


def test_verrou_face_id_ou_code(pw, navigateur, serveur):
    """Seul vous pouvez entrer : avec le verrou, l'app demande le déverrouillage du téléphone (simulé par un appareil virtuel)."""
    ctx, page = ouvrir(pw, navigateur, serveur, "iPhone 13")
    cdp = ctx.new_cdp_session(page)
    cdp.send("WebAuthn.enable")
    auth = cdp.send("WebAuthn.addVirtualAuthenticator", {"options": {"protocol": "ctap2", "transport": "internal", "hasResidentKey": True,
                                                                      "hasUserVerification": True, "isUserVerified": True, "automaticPresenceSimulation": True}})["authenticatorId"]
    page.goto(serveur.replace("127.0.0.1", "localhost") + "/")  # une clé d'accès exige un nom de domaine
    page.click("#view button[data-mode=sim] >> nth=0")
    page.evaluate("location.hash = 'reglages'")
    page.click("#verrou-on")
    page.wait_for_selector("text=Verrou activé")
    stock = page.evaluate("() => JSON.stringify(Object.entries(localStorage))")
    assert "qg-verrou" in stock and "@" not in stock  # seulement le numéro de la clé
    page.reload()
    page.wait_for_selector(".verrou")
    assert page.get_attribute("#view", "aria-hidden") == "true"
    cdp.send("WebAuthn.setUserVerified", {"authenticatorId": auth, "isUserVerified": False})  # visage ou code refusé
    page.click("#deverrouiller")
    page.wait_for_selector("#verrou-msg:not(:empty)")
    assert page.is_visible(".verrou")
    cdp.send("WebAuthn.setUserVerified", {"authenticatorId": auth, "isUserVerified": True})
    page.click("#deverrouiller")
    page.wait_for_selector(".verrou", state="detached")
    page.evaluate("location.hash = 'reglages'")
    page.click("#verrou-off")
    page.click("#verrou-off")
    page.wait_for_selector("text=Verrou retiré")
    page.reload()
    page.wait_for_selector("text=Activer le verrou")
    assert not page.is_visible(".verrou")
    assert not page.erreurs, page.erreurs
    ctx.close()


PIEGE = '<img src=x onerror="window.__xss=1"><script>window.__xss=2</script>'


def test_un_texte_piege_dans_le_tableau_n_est_jamais_execute(pw, navigateur, serveur):
    """Données protégées : un texte malveillant écrit dans le tableau s'affiche comme du texte, jamais comme du code."""
    ctx, page = ouvrir(pw, navigateur, serveur, "iPhone 13")

    def pieger(g):
        texte = {"Décisions & Questions": [1, 4, 5, 6], "Projets": [2, 3, 4, 5, 17, 19, 21], "Parler à l'Usine": [1, 3], "État du moteur": [3]}
        for onglet, cols in texte.items():
            for ligne in g.lignes[onglet]:
                for c in cols:
                    ligne[c] = ligne[c] + PIEGE
        g.lignes["Projets"][0][2] = "Projet <b>Gras</b>" + PIEGE
    connecter(page, serveur, pieger)
    vus, file = set(), ["accueil"]
    while file and len(vus) < 200:  # chaque écran atteignable
        h = file.pop(0)
        if h in vus:
            continue
        vus.add(h)
        verifier_ecran(page, h)
        injecte = page.evaluate("[...document.querySelectorAll('#view img[src=x], #view script, #view b')].filter(e => e.tagName !== 'B' || e.textContent === 'Gras').map(e => e.outerHTML.slice(0, 120))")
        assert injecte == [], (h, injecte)
        file += [l for l in page.eval_on_selector_all("a[href^='#']", "els => els.map(e => e.getAttribute('href').slice(1))") if l and l not in vus]
    assert len(vus) > 25, len(vus)
    assert page.evaluate("window.__xss") is None
    ctx.close()


def test_l_app_ne_parle_qu_a_google(pw, navigateur, serveur):
    """Aucune connexion vers un autre service : l'app elle-même, et les API Google avec votre compte."""
    ctx, page = ouvrir(pw, navigateur, serveur, "Pixel 7")
    hotes = set()
    page.on("request", lambda r: hotes.add(urlparse(r.url).hostname))
    connecter(page, serveur)
    parcourir(page, limite=60)
    autorises = {"127.0.0.1", "accounts.google.com", "sheets.googleapis.com", "www.googleapis.com", "oauth2.googleapis.com"}
    assert hotes <= autorises, hotes - autorises
    ctx.close()


def test_rien_de_vos_donnees_ne_reste_sur_le_telephone(pw, navigateur, serveur):
    ctx, page = ouvrir(pw, navigateur, serveur, "iPhone 13")
    page.goto(serveur + "/")
    page.evaluate("navigator.serviceWorker.ready")
    connecter(page, serveur)
    parcourir(page, limite=40)
    page.wait_for_timeout(500)
    stock = page.evaluate("""async () => {
        const caches_ = [];
        for (const k of await caches.keys()) for (const r of await (await caches.open(k)).keys()) caches_.push(r.url);
        return {local: Object.entries(localStorage), session: Object.entries(sessionStorage), caches: caches_};
    }""")
    texte = json.dumps(stock, ensure_ascii=False)
    for donnee in ("Projet Exemple", "TEST-P900", "Valider", "L'étude avance", "FAUX-JETON", "ID-TABLEAU-TEST", "Veille"):
        assert donnee not in texte, donnee
    assert stock["caches"], "le cache hors ligne garde les fichiers de l'app"
    for url in stock["caches"]:  # seulement les fichiers de l'app, jamais une réponse de Google
        assert url.startswith(serveur + "/") and not re.search(r"googleapis|/api/", url), url
    ctx.close()


def test_captures(pw, navigateur, serveur):
    """Captures pour le rapport (simulation), dans un dossier choisi par QG_CAPTURES."""
    dossier = os.environ.get("QG_CAPTURES")
    if not dossier:
        pytest.skip("QG_CAPTURES non défini")
    for appareil in APPAREILS:
        ctx, page = ouvrir(pw, navigateur, serveur, appareil)
        page.goto(serveur + "/")
        page.click("#view button[data-mode=sim] >> nth=0")
        for h in ("accueil", "decisions.s2", "chat", "securite", "reglages", "projets", "projets.P004", "projets.P004.phase2", "projets.P004.phase3"):
            page.evaluate("h => { location.hash = h; }", h)
            page.wait_for_timeout(150)
            page.screenshot(path=f"{dossier}/{appareil.replace(' ', '-')}-{h}.png")
        ctx.close()
