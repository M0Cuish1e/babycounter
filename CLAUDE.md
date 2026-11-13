# Babycounter : contexte pour Claude

Outil personnel pour une étudiante sage-femme : noter les bébés qu'elle a accouchés et voir des stats. Développé par Guillaume (M0Cuish1e), qui n'est pas l'utilisatrice finale.

## Décisions prises

- **Format** : PWA statique, sans build ni dépendance. HTML, CSS et JS écrits à la main, un fichier chacun. Ne pas introduire de framework ni d'étape de compilation sans en parler.
- **Données** : uniquement sur l'appareil (`localStorage`, clé `babycounter:donnees`). Aucun serveur, aucun appel réseau, aucune ressource externe (polices et icônes sont dans le repo).
- **Confidentialité** : ce sont des données de naissance couvertes par le secret professionnel. Pas de synchronisation en ligne, pas de télémétrie, pas de champ sur la mère ou la maternité.
- **Hébergement** : GitHub Pages depuis `main`. Tous les chemins sont relatifs pour fonctionner sous `/babycounter/`.
- **Design** : piste « Bracelets de naissance ». Chaque bébé est un bracelet rose ou bleu, prénom en écriture manuscrite (Caveat), reste de l'interface épuré en DM Sans, encre indigo `#23254A` sur fond `#FBFBFD`. Les couleurs sont des variables CSS en tête de `style.css`.
- **Accueil** : sélecteur Semaine / Mois / Année, calendrier, puis liste des bracelets de la période affichée. Toucher un jour filtre la liste sur ce jour.
- **Navigation** : Accueil, bouton +, Stats. En bas sur téléphone, menu latéral sur ordinateur (à partir de 900 px). Les anciens onglets Records, Prénoms et Carte ont été écartés ou fusionnés dans Stats.
- **Champs d'une fiche** : prénom, sexe, date, heure, poids (grammes), taille (cm), mode d'accouchement (`voie-basse`, `instrumentale`, `cesarienne`), note. Seuls le sexe et la date sont obligatoires. Le champ « rôle » a été explicitement retiré.

## Conventions

- Tout est en français : interface, noms de variables et de fonctions, commentaires, messages de commit.
- Les textes d'interface sont à l'infinitif (« Ajouter un bébé », « Exporter »), sans tutoiement ni vouvoiement.
- Ne jamais insérer une donnée saisie avec `innerHTML` : passer par `el()` et `textContent` dans `app.js`.
- `normaliser()` dans `app.js` est le point d'entrée unique du format des fiches. Tout nouveau champ s'y ajoute avec une valeur par défaut, pour que les fiches et les sauvegardes existantes restent lisibles. Les champs inconnus sont conservés.
- Tester en téléphone (390 px) et en ordinateur (1280 px) avant de pousser.
- Si un fichier est ajouté, l'ajouter aussi à la liste `FICHIERS` de `sw.js`, sinon il manquera hors ligne.
- Guillaume préfère, pour une petite modification, recevoir seulement les lignes à changer et leur emplacement plutôt que le fichier entier.

## État

Fait : stockage, accueil, ajout, modification, suppression, export et import JSON (l'import fusionne par identifiant), mise en page téléphone et ordinateur, manifeste, service worker, rappel de sauvegarde après un mois.

À faire :

- Activer GitHub Pages, puis vérifier l'installation sur un vrai téléphone, en particulier Safari sur iPhone, jamais testé.
- Onglet Stats : il ne contient qu'un premier jet (filles, garçons, poids et taille moyens, répartition par mode). Son contenu reste à définir avec Guillaume, ainsi que l'éventuel découpage en plusieurs onglets.
- Champs supplémentaires en attente de la réponse de l'utilisatrice : terme, présentation, péridurale, périnée, jumeaux.

## Lancer en local

```
python3 -m http.server 8000
```

Le service worker ne fonctionne pas en ouvrant `index.html` directement.
