# Mon QG (l'app)

Le QG de l'Usine sur le téléphone : plein écran, hors ligne, avec votre compte Google, et une notification quand une
décision vous attend. C'est le QG validé de l'Usine (`usine-a-projets/app-qg`), déplacé ici et amélioré.

## Ce qu'elle fait (V1, et déjà une partie de la V2)

| | |
|---|---|
| Installable | icône sur l'écran d'accueil, plein écran, s'ouvre sans réseau |
| Le cockpit | comme le modèle : verdict, ① À décider, 💬 parler à l'Usine, ② Argent (courbe à toucher, 0 € honnête en Réel), ③ Projets, ④ La machine (Agents, Fiches, Sécurité, Réglages) ; « Réel » (tableau TEST) ou « Simulation » |
| Décisions | date, analyse, problèmes, coût et estimation, recommandation ; choisir une option en deux touchers, ou demander des corrections |
| Agir | chaque fenêtre voit et agit : ordres à l'Usine en deux touchers (pause, pousser en réel, vidéo, valider une fiche, budget, cerveaux IA) ; le réel reste votre décision |
| Verrou | Face ID, empreinte ou code du téléphone à l'ouverture (Réglages) ; l'app ne voit jamais votre visage ni votre code |
| Notifications | app ouverte ou en arrière-plan : une notification par nouvelle décision ou problème grave, pastille sur l'icône |
| Notifications app fermée | prêtes, mais demandent la mise en ligne (Cloudflare) et le petit script Google du tableau |
| Navigation | un toucher = un niveau ; chaque fenêtre a « ‹ Retour » ; clair ou sombre |

## Comment c'est construit

- `public/` : toute l'app, en HTML, CSS et JavaScript simples. Aucune bibliothèque, aucune police, aucun script extérieur.
- `public/alertes.js` : les notifications et la pastille. Le téléphone ne garde qu'une empreinte de 8 caractères par décision déjà annoncée.
- `relais/` et `functions/` : le relais des notifications « app fermée » (Cloudflare Pages Functions, à la même adresse que l'app).
  Il chiffre chaque message pour votre téléphone (norme Web Push), sans bibliothèque extérieure.
- `relais/script-google/` : le petit script à coller dans le tableau TEST. Toutes les 15 minutes, il prévient le relais
  des nouvelles décisions. Il tourne chez Google, avec votre compte.

```
Tableau TEST ──(script Google, toutes les 15 min)──▶ relais /api/signal ──(Web Push chiffré)──▶ téléphone
téléphone ──(connexion Google, 1 h)──▶ API Google Sheets / Drive (lire le QG, répondre aux décisions)
```

## Sécurité

- **Vous seul** : l'app lit le tableau avec votre connexion Google. Le relais accepte seulement le compte Google
  du premier abonnement (il le vérifie auprès de Google), puis refuse tous les autres.
- **Aucun secret, aucun e-mail** dans le code ni dans le dépôt. Les clés de notification sont créées par le relais
  lui-même et restent dans son stockage Cloudflare. L'ID client Google n'est pas un secret ; vous le collez une fois.
- **Le jeton Google reste en mémoire** (fermer l'app = se reconnecter) et seul `google.js` le touche.
- **Seul l'environnement TEST** est ouvert (le tableau dont le nom commence par « TEST »).
- En-têtes de sécurité stricts (`public/_headers`), même règle dans la page, cache hors ligne limité aux fichiers de l'app.
- **Données protégées** : un texte piégé écrit dans le tableau s'affiche comme du texte, jamais comme du code ;
  rien de vos données ne reste sur le téléphone (ni stockage, ni cache) ; l'app ne parle qu'à Google.
- Vérifié à chaque envoi (GitHub Actions) par `tests/test_securite.py` (règles du code) et `tests/test_ecrans.py`
  (texte piégé sur chaque écran, connexions autorisées, rien gardé sur le téléphone, jeton jamais enregistré).

## Ce que vous devez faire vous-même (l'app le rappelle dans Réglages, « Mise en route »)

1. **Créer un compte Cloudflare** (gratuit, sans carte) sur dash.cloudflare.com. Dites-moi « c'est fait ».
2. **Me dire « oui » pour la mise en ligne.** Je relie alors ce dépôt à Cloudflare Pages
   (dossier `app`, sortie `public`, aucune commande de build) et je crée le stockage `QG_RELAIS`.
3. **Donner l'autorisation Google** : dans Google Cloud, client « Client Web 1 », ajouter l'adresse de l'app
   (origine et adresse de retour, avec la barre finale), puis coller l'ID client dans l'app et se connecter.
4. **Installer l'app** : iPhone, Safari, Partager, « Sur l'écran d'accueil ». Android, Chrome, ⋮, « Installer l'application ».
5. **Activer les notifications** dans Réglages (sur iPhone, depuis l'app installée).
6. Facultatif, **notifications app fermée** : dans le tableau TEST, Extensions, Apps Script, coller
   `relais/script-google/Code.gs` (et `appsscript.json`), mettre l'adresse de l'app, lancer `installer`, accepter.
   Puis, dans l'app, « Activer les notifications app fermée ».

À vérifier lors de la mise en ligne : que Google donne bien le numéro de compte pour le jeton du script (sinon, le relais
refuse poliment et je change de méthode). Rien de cela ne coûte d'argent.

Plus tard (parké) : une vraie app iPhone (App Store, compte Apple ~99 €/an), seulement sur votre décision.
Le code étant du HTML/JS simple, il pourra être emballé tel quel.

## Lancer les tests

```
cd app && npm ci && npm test                     # relais : chiffrement vérifié par une bibliothèque indépendante
pip install playwright==1.63.0 pytest==9.1.1 && python -m playwright install chromium
pytest app/tests                                 # sécurité + chaque écran en tailles iPhone 13 et Pixel 7
```
