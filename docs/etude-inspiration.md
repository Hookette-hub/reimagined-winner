# Étude d'inspiration pour le QG

Date : 19 octobre 2026. Objectif : regarder de bonnes applis de « pilotage », puis faire mieux pour le QG.

**Règles respectées :** on a seulement regardé des pages publiques (fiches Google Play, sites de démonstration).
Aucune appli n'a été décompilée. Aucun code, aucune image ni aucune icône n'a été copié : on a repris des idées, pas des fichiers.
Pour l'open source, on a lu uniquement des projets sous licence MIT (licence vérifiée dans leur fichier LICENSE).

## Sources étudiées

| Source | Type | Note / licence | Ce qu'elle met en avant |
|---|---|---|---|
| Stripe Dashboard | Fiche Play Store | 4,3 étoiles (33,8 k avis) | Chiffres du jour, comparaison avec le passé, résumé quotidien et alerte à chaque paiement |
| Shopify | Fiche Play Store | 4,4 étoiles (73,9 k avis) | Ventes en temps réel, alerte à chaque commande, assistant IA « Sidekick » |
| Google Analytics | Fiche Play Store | 4,0 étoiles (133 k avis) | Temps réel, comparaison de périodes, « insights » rédigés automatiquement par l'IA |
| Todoist | Fiche Play Store | 4,7 étoiles (306 k avis) | Boîte de réception, « Aujourd'hui », ajout à la voix, widgets |
| Notion | Fiche Play Store | 4,7 étoiles (400 k avis) | Tout au même endroit, l'IA résume l'avancement des projets |
| Revolut Business | Fiche Play Store | 4,8 étoiles (47,3 k avis) | Gros solde au centre, boutons d'action ronds, circuits d'approbation des dépenses, thème sombre |
| Linear | Fiche Play Store | Pas trouvée sur Play Store | — |
| Tabler (tabler.io) | Kit de tableau de bord HTML | **Licence MIT** | Cartes de chiffres avec flèche ↑/↓ et %, message d'accueil « Vous avez 5 nouveaux messages » |
| shadcn/ui (ui.shadcn.com) | Système de design | **Licence MIT** | Modèle de tableau de bord « dashboard-01 », bascule clair/sombre, interface sobre |

## Ce qu'on a observé

- **Un grand chiffre en haut.** Revolut affiche le solde en très gros, Stripe affiche « Volume, Paiements, Clients » sur une seule ligne. On comprend l'essentiel en une seconde.
- **Une petite flèche verte ou rouge avec un %.** Shopify, Tabler et Analytics montrent tout de suite si un chiffre monte ou baisse.
- **Des courbes simples.** Une mini-courbe à côté de chaque chiffre, et une courbe « cette période / période d'avant » en pointillés (Stripe, Analytics).
- **Des onglets de période** : 1 S, 4 S, 1 A, Tout (Stripe). Un seul toucher suffit pour changer de vue.
- **Des boutons d'action ronds sous le chiffre principal** : Ajouter, Déplacer, Plus (Revolut).
- **Une « boîte de réception » et une vue « Aujourd'hui »** (Todoist). Ce qui demande une action est rangé à part.
- **Des notifications utiles** : un résumé chaque jour et une alerte immédiate pour ce qui compte (Stripe, Shopify).
- **Des cartes rédigées par l'IA** (Analytics) : « Tel chiffre a baissé », avec un lien « Voir ».
- **Des étiquettes de statut colorées** : « Payé » en vert (Stripe).
- **Un mode sombre élégant** (Revolut). Le mode clair reste très aéré (Todoist, Stripe).
- **La navigation :** menu latéral (Analytics, Todoist) ou petite barre d'onglets en bas (Shopify). Sur téléphone, la barre en bas est plus facile à atteindre avec le pouce.
- **Ce qui manque souvent :** aucune de ces applis ne montre sur l'accueil un endroit clair « Décisions à prendre » où l'on répond en un toucher. Chez Revolut, les approbations existent, mais elles sont cachées dans les dépenses. **C'est là que le QG peut faire mieux.**

## Ce qu'on reprend (en mieux) pour le QG

Par ordre de priorité :

1. **Une barre d'onglets en bas** avec 4 onglets : Accueil, Décisions, Projets, Équipe. On y ajoute une **pastille rouge** qui donne le nombre de décisions en attente.
2. **Une boîte « Décisions »** en haut de l'accueil. Chaque décision tient sur une carte avec 2 ou 3 gros boutons de réponse (Oui, Non, Plus tard). On peut aussi **glisser la carte** : à droite pour valider, à gauche pour reporter. Quand la boîte est vide, un message rassurant s'affiche : « Rien à décider, tout roule ».
3. **Une notification quand une décision attend.** Elle passe par une notification push de la PWA et, en plus, par la pastille sur l'icône de l'appli (Badging API). On ajoute un **résumé du jour** à heure fixe, comme Stripe.
4. **Un grand chiffre « argent »** en haut, avec une flèche ↑/↓ et le % par rapport au mois dernier, puis une mini-courbe. Des onglets de période : 7 j, 30 j, 1 an.
5. **Des cartes de chiffres en grille de 2** : projets actifs, agents au travail, dépenses, revenus. Chaque carte a sa flèche de tendance.
6. **Des cartes « résumé IA » en français simple**, par exemple : « Le projet X avance bien, 2 tâches finies hier », avec un bouton « Voir ».
7. **Des statuts en couleur** sur les projets et les agents : vert (ça avance), orange (en attente de toi), rouge (bloqué). Chaque couleur est toujours accompagnée d'un mot, pour rester lisible par tous.
8. **Le mode sombre automatique**, qui suit le réglage du téléphone, avec un bouton pour forcer le clair ou le sombre.
9. **Des blocs gris animés pendant le chargement** (« squelettes »), plutôt qu'un écran blanc. On ajoute aussi le **tirer vers le bas pour actualiser**, avec l'heure de la dernière mise à jour.
10. **Des boutons d'action ronds** sous le chiffre principal (Nouveau projet, Demander à un agent, Voir tout). Tous les éléments à toucher font au moins 44 px de haut.

Tout cela se fait en HTML, CSS et JavaScript simples, sans bibliothèque obligatoire.

## Sources

Les fiches publiques ont été consultées avec Playwright. Les captures ont été regardées pour l'analyse, puis gardées uniquement dans le dossier de travail temporaire : elles ne sont pas publiées.
