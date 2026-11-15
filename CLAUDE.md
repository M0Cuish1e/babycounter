# Babycounter : contexte pour Claude

Outil personnel pour une étudiante sage-femme : noter les bébés qu'elle a accouchés et voir des stats. Développé par Guillaume (M0Cuish1e), qui n'est pas l'utilisatrice finale.

## Décisions prises

- **Format** : PWA statique, sans build ni dépendance. HTML, CSS et JS écrits à la main, un fichier chacun. Ne pas introduire de framework ni d'étape de compilation sans en parler.
- **Données** : uniquement sur l'appareil (`localStorage`, clé `babycounter:donnees`). Aucun serveur, aucun appel réseau, aucune ressource externe (polices et icônes sont dans le repo).
- **Confidentialité** : ce sont des données de naissance couvertes par le secret professionnel. Pas de synchronisation en ligne, pas de télémétrie, pas de champ sur la mère ou la maternité.
- **Hébergement** : GitHub Pages depuis `main`. Tous les chemins sont relatifs pour fonctionner sous `/babycounter/`.
- **Design** : piste « Bracelets de naissance ». Chaque bébé est un bracelet rose ou bleu, prénom en écriture manuscrite (Caveat), reste de l'interface épuré en DM Sans, encre indigo `#23254A` sur fond `#FBFBFD`. Les couleurs sont des variables CSS en tête de `style.css`.
- **Accueil** : sélecteur Semaine / Mois / Année, calendrier, puis liste des bracelets de la période affichée. Toucher un jour filtre la liste sur ce jour.
- **Vue Semaine** : noms des jours en haut comme en vue Mois ; chaque jour est une colonne de 0 h à 24 h où les bébés sont placés à leur heure (`placerFrises()`), les bébés sans heure dans une bande « ? » en bas.
- **Ordinateur** : trois colonnes (menu, calendrier, liste de 340 px). Une liste sous le calendrier a été maquettée puis écartée. Un prénom trop long ne doit jamais élargir la colonne : sa police est réduite (`ajusterPrenoms()` dans `app.js`).
- **Navigation** : sur téléphone, barre du bas Accueil, Naissances, +, Stats, Records (le + au milieu) et Réglages dans l'en-tête ; sur ordinateur (à partir de 900 px), menu latéral Accueil, Naissances, Stats, Records, Réglages. Les anciens onglets Prénoms et Carte ont été fusionnés dans Stats.
- **Naissances** : liste complète triée par date, du plus récent au plus ancien (pas d'autre tri). Recherche sur le prénom et la note, sans tenir compte des accents ni des majuscules. Filtres : période du/au, sexe, mode (dont « non renseigné »), poids min. et max. Les filtres ne sont pas mémorisés d'une ouverture à l'autre de l'appli.
- **Stats** : chaque bloc a son propre sélecteur de période (`blocStats()` dans `app.js`), gardé tant que l'appli est ouverte. Blocs et périodes possibles : chiffres clés : total, poids moyen, filles / garçons, répartitions du travail, de la péridurale et du mode (mois, année, tout), naissances par mois (année, ou tout en cumulant chaque mois de toutes les années), jour de la semaine (mois, année, tout), heure de naissance en horloge 24 h (mois, année, tout), accouchement : travail, péridurale et mode, avec croisements dans le détail (mois, année, tout), carte de l'année (année, ou tout en cumulant toutes les années jour par jour avec la liste des anniversaires les plus fréquents ; Tous / Filles / Garçons), nuage des prénoms (mois, année, tout, filtrable par sexe). Graphiques en HTML/SVG écrits à la main, sans bibliothèque. Toucher un élément affiche le détail ; un lien « Voir ces naissances » ouvre l'onglet Naissances filtré, sauf pour le jour de la semaine, l'heure et les cumuls « Tout » par mois et sur la carte, que les filtres de Naissances ne savent pas exprimer (choix assumé).
- **Records** : onglet à part (mois, année, tout, filtrable par sexe) : journée la plus chargée, plus lourd, plus léger, prénom le plus donné, égalités signalées. Toucher un bébé ouvre sa fiche.
- **Couleurs des critères** : mode `--mode-naturel` (indigo) / `--mode-instru` (ocre), péridurale `--peri-avec` / `--peri-sans` (vert foncé / clair), travail `--travail-declenche` / `--travail-spontane` (violet foncé / clair), « non renseigné » en gris ; le rose et le bleu restent réservés aux filles et aux garçons.
- **Champs d'une fiche** : prénom, sexe, date, heure, poids (grammes), travail (`travail` : `spontane`, `declenche`), péridurale (`peridurale` : `avec`, `sans`), mode d'accouchement (`mode` : `naturel`, `instrumente`), note. Seuls le sexe et la date sont obligatoires ; les trois choix facultatifs peuvent rester « non renseigné ». Retirés à la demande de l'utilisatrice : le champ « rôle », la taille (une taille déjà enregistrée reste dans la fiche comme champ inconnu) et la césarienne, qui ne sera plus notée (convertie par `normaliser()` en mode non renseigné, avec `modeInitial`).

## Conventions

- Tout est en français : interface, noms de variables et de fonctions, commentaires, messages de commit.
- Les textes d'interface sont à l'infinitif (« Ajouter un bébé », « Exporter »), sans tutoiement ni vouvoiement.
- Ne jamais insérer une donnée saisie avec `innerHTML` : passer par `el()` et `textContent` dans `app.js`.
- `normaliser()` dans `app.js` est le point d'entrée unique du format des fiches. Tout nouveau champ s'y ajoute avec une valeur par défaut, pour que les fiches et les sauvegardes existantes restent lisibles. Les champs inconnus sont conservés.
- Tester en téléphone (390 px) et en ordinateur (1280 px) avant de pousser.
- Si un fichier est ajouté, l'ajouter aussi à la liste `FICHIERS` de `sw.js`, sinon il manquera hors ligne.
- Guillaume préfère, pour une petite modification, recevoir seulement les lignes à changer et leur emplacement plutôt que le fichier entier.

## État

Fait : stockage, accueil, vue Naissances avec recherche, Stats, Records, ajout, modification, suppression, export et import JSON (l'import fusionne par identifiant), mise en page téléphone et ordinateur, manifeste, service worker, rappel de sauvegarde après un mois.

À faire :

- Vérifier l'installation et l'usage hors ligne sur un vrai téléphone, en particulier Safari sur iPhone, jamais testé (GitHub Pages est actif).
- Sauvegarde : à rediscuter avec Guillaume (rappel, fréquence, autres moyens que l'export manuel).
- Champs supplémentaires encore possibles, à confirmer avec l'utilisatrice : terme, présentation, périnée, jumeaux.

## Lancer en local

```
python3 -m http.server 8000
```

Le service worker ne fonctionne pas en ouvrant `index.html` directement.
