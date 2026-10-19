"""Mon QG : les règles de sécurité du propriétaire, vérifiées à chaque envoi de code (sans navigateur).

Moi seul peux entrer, aucun secret dans l'app, mon e-mail jamais écrit dedans, seul l'environnement TEST est ouvert."""

import json
import re
from pathlib import Path

APP = Path(__file__).resolve().parents[1]
PUBLIC = APP / "public"
SUFFIXES = {".html", ".js", ".css", ".webmanifest", ".svg", ".txt", ".gs", ".json", ".md", ""}
FICHIERS = [p for p in APP.rglob("*") if p.is_file() and p.suffix in SUFFIXES and "node_modules" not in p.parts and "tests" not in p.parts and not any(x.startswith(".") for x in p.parts)
            and p.name != "package-lock.json"]
TEXTES = {str(p.relative_to(APP)): p.read_text(encoding="utf-8") for p in FICHIERS}
APP_TEXTES = {p.name: p.read_text(encoding="utf-8") for p in PUBLIC.rglob("*") if p.is_file() and p.suffix in SUFFIXES}
CODE = "\n".join(t for n, t in TEXTES.items() if not n.startswith("public/polices/OFL"))  # les licences des polices citent leurs auteurs, ce n'est pas du code

# Les seuls services que l'app et son relais contactent (connexion) ou citent (lien).
LISTE_BLANCHE = {
    "sheets.googleapis.com", "www.googleapis.com", "oauth2.googleapis.com", "accounts.google.com",  # Google, avec votre compte
    "web.push.apple.com", "fcm.googleapis.com", "updates.push.services.mozilla.com", "notify.windows.com",  # services de notification
    "docs.google.com", "myaccount.google.com", "dash.cloudflare.com", "pages.dev",  # liens seulement
}


def test_aucune_adresse_e_mail_ni_id_google():
    for nom, texte in TEXTES.items():
        assert not re.search(r"[\w.+-]+@[\w-]+\.[a-z]{2,}", texte), nom  # aucune adresse e-mail
        assert not re.search(r"\b1[\w-]{32,}\b", texte), nom  # aucun ID de tableau ou de dossier Drive
        assert not re.search(r"\d{6,}-[a-z0-9]{20,}\.apps\.googleusercontent\.com", texte), nom  # l'ID client est collé dans l'app


def test_aucun_secret():
    for mot in ("client_secret", "refresh_token", "GOCSPX", "AIza", "BEGIN PRIVATE KEY", "mailto:"):
        assert mot not in CODE, mot
    assert not re.search(r"\bsk-[\w-]{20,}", CODE)  # clé d'API


def test_le_jeton_google_reste_en_memoire_et_dans_google_js():
    g = APP_TEXTES["google.js"]
    ecritures = re.findall(r"ecrire\((localStorage|sessionStorage), ([A-Z_]+)", g)
    assert set(ecritures) <= {("localStorage", "CLE_CLIENT"), ("sessionStorage", "CLE_ETAT")}, ecritures
    assert "setItem" not in g.replace("stock.setItem(cle, v)", "")
    for f in ("app.js", "alertes.js", "installer.js", "sw.js"):
        assert "Bearer" not in APP_TEXTES[f] and "access_token" not in APP_TEXTES[f], f  # seul google.js tient le jeton
    export = g[g.index("window.QG_GOOGLE = Object.freeze({"):]
    assert "jeton" not in export  # aucune fonction ne le donne au reste de l'app
    assert "indexedDB" not in CODE and "document.cookie" not in CODE
    # le jeton ne part que vers Google et vers le relais de l'app (même adresse)
    assert set(re.findall(r'fetch\("(/[^"]*)"', g)) == {"/api/abonner"}


def test_seul_l_environnement_test_est_ouvert():
    g = APP_TEXTES["google.js"]
    assert 'NOM_TABLEAU = "TEST – Tableau de suivi – Usine à projets"' in g and "/^TEST\\b/.test(x.name)" in g
    assert "/^TEST\\b/.test(classeur.getName())" in TEXTES["relais/script-google/Code.gs"]


def test_scripts_locaux_seulement_et_en_tetes_de_securite():
    html = APP_TEXTES["index.html"]
    assert re.findall(r"<script src=\"([^\"]+)\"", html) == ["/google.js", "/alertes.js", "/verrou.js", "/app.js", "/installer.js"]
    assert "<script>" not in html and not re.search(r"\son[a-z]+=", html)
    entetes = APP_TEXTES["_headers"]
    for e in ("Content-Security-Policy: default-src 'none'; script-src 'self';", "Strict-Transport-Security", "X-Content-Type-Options: nosniff",
              "X-Frame-Options: DENY", "Referrer-Policy: no-referrer", "frame-ancestors 'none'", "Permissions-Policy"):
        assert e in entetes, e
    assert "script-src 'self';" in html
    sw = APP_TEXTES["sw.js"]
    for f in re.findall(r'<script src="([^"]+)"', html):
        assert f'"{f}"' in sw, f"{f} manque dans le cache hors ligne"


def test_services_contactes_sur_la_liste_blanche():
    hotes = set(re.findall(r"https://([a-z0-9.-]+\.[a-z]{2,})", CODE))
    hotes = {h for h in hotes if not any(h == b or h.endswith("." + b) for b in LISTE_BLANCHE)}
    hotes -= {"VOTRE-APP.pages.dev".lower()}
    assert not hotes, hotes


def test_le_relais_n_accepte_que_le_proprietaire():
    r = TEXTES["relais/relais.js"]
    assert 'proprio && proprio !== sub' in r and 'sub !== proprio' in r
    assert "tokeninfo" in r


def test_manifeste_installable():
    m = json.loads(APP_TEXTES["manifest.webmanifest"])
    assert m["display"] == "standalone" and m["name"] == "Mon QG"
    assert {"192x192", "512x512"} <= {i["sizes"] for i in m["icons"]}
    assert any(i.get("purpose") == "maskable" for i in m["icons"])


def test_pages_cachees_des_moteurs_et_relais_jamais_en_cache():
    assert 'content="noindex, nofollow"' in APP_TEXTES["index.html"]
    assert "Disallow: /" in APP_TEXTES["robots.txt"]
    assert "/api/*\n  Cache-Control: no-store" in APP_TEXTES["_headers"]
    assert '"Cache-Control": "no-store"' in TEXTES["relais/relais.js"]
    sw = APP_TEXTES["sw.js"]
    assert 'url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return' in sw  # Google et relais : jamais en cache


def test_aucune_dependance_dans_l_app_publiee():
    # l'app livrée au téléphone n'emploie aucune bibliothèque ; http_ece ne sert qu'aux tests du relais
    paquet = json.loads((APP / "package.json").read_text(encoding="utf-8"))
    assert not paquet.get("dependencies"), paquet.get("dependencies")
    assert set(paquet.get("devDependencies", {})) <= {"http_ece"}
    for f in ("relais/relais.js", "relais/webpush.js"):
        assert not re.search(r'from\s+"(?!\./)', TEXTES[f]), f  # seulement des fichiers locaux
