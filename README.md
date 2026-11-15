# Babycounter

Carnet personnel des naissances pour une étudiante sage-femme : un bracelet par bébé, un calendrier (semaine, mois, année), une liste complète avec recherche, des stats en graphiques et des records.

**Utiliser l'appli : https://m0cuish1e.github.io/babycounter/**

Pour l'installer sur un iPhone, voir [Installation et mises à jour sur iPhone](#installation-et-mises-à-jour-sur-iphone) : le dépôt n'est public que le temps d'une installation ou d'une mise à jour, l'appli installée fonctionne ensuite sans réseau.

- **Rien à installer** : c'est une page web, installable comme une appli (PWA) et utilisable hors ligne.
- **Données sur l'appareil uniquement** : tout est stocké dans le navigateur (`localStorage`). Aucun serveur, aucun envoi réseau.
- **Sauvegarde** : les bébés sont enregistrés automatiquement sur l'appareil. Pour une copie ailleurs, « Réglages et sauvegarde » > « Exporter mes données » : sur iPhone, le menu Partager s'ouvre, choisir « Enregistrer dans Fichiers » puis iCloud Drive. Un rappel apparaît tous les 10 bébés ajoutés depuis le dernier export. L'import recharge un fichier exporté.
- **Données d'essai** : des fichiers fictifs à importer pour tester sont dans [`exemples/`](exemples/) ([étudiante, le plus réaliste](https://m0cuish1e.github.io/babycounter/exemples/essai-etudiante.json), [petit](https://m0cuish1e.github.io/babycounter/exemples/essai-petit.json), [deux ans](https://m0cuish1e.github.io/babycounter/exemples/essai-deux-ans.json), [cas limites](https://m0cuish1e.github.io/babycounter/exemples/essai-limites.json)). « Tout effacer » les retire.

## Installation et mises à jour sur iPhone

L'appli installée garde sa propre copie de tous ses fichiers. Elle s'ouvre depuis cette copie, sans jamais avoir besoin du réseau, même quand le site n'est plus publié (dépôt privé, GitHub Pages renvoie 404). Les bébés sont enregistrés dans l'appli elle-même.

Deux règles :

- **Toujours la même adresse** : `https://m0cuish1e.github.io/babycounter/`. Les données sont liées à l'adresse : une autre adresse (autre nom de dépôt, autre compte, domaine personnalisé) démarrerait une appli vide.
- **Tout saisir dans l'appli installée**, jamais dans Safari : sur iPhone, Safari et l'appli installée ont des données séparées. Dans Safari, un écran d'aide le rappelle et donne les étapes d'installation.

### Première installation

1. Sur GitHub, dépôt `babycounter` : **Settings** > **General** > tout en bas, **Change repository visibility** > **Make public**.
2. **Settings** > **Pages** : Source **Deploy from a branch**, branche `main`, dossier `/ (root)`, **Save**. Attendre que la page indique « Your site is live » (une à deux minutes), puis vérifier que l'adresse s'ouvre depuis un ordinateur.
3. Sur l'iPhone, avec du réseau, ouvrir l'adresse dans **Safari** (pas dans une autre appli). L'écran « Installer Babycounter » s'affiche :
   - toucher **Partager** (si le bouton n'est pas visible, toucher d'abord **…** en bas de l'écran) ;
   - choisir **Sur l'écran d'accueil** (faire défiler ou toucher **Afficher plus** si besoin) ;
   - laisser **Ouvrir comme app web** activé, vérifier le nom « Babycounter », toucher **Ajouter**.
4. Ouvrir Babycounter **depuis son icône**, avec du réseau, et attendre quelques secondes. Dans **Réglages** (en haut à droite), la dernière ligne doit indiquer « Version … · disponible hors ligne ». Si elle indique « Pas encore disponible hors ligne », fermer l'appli et la rouvrir avec du réseau.
5. **Vérifier en mode avion** : activer le mode avion, fermer complètement l'appli (balayer vers le haut depuis le sélecteur d'applis), la rouvrir depuis l'icône. Elle doit s'afficher normalement, avec les polices manuscrites. Ajouter un bébé d'essai, fermer, rouvrir : il est toujours là. Le supprimer, puis couper le mode avion.
6. Repasser le dépôt en privé : **Settings** > **General** > **Change repository visibility** > **Make private**. GitHub Pages est alors dépublié, l'appli installée continue de fonctionner.
7. Facultatif : supprimer de Safari l'onglet ouvert à l'étape 3.

### Mise à jour

Côté développement, avant de pousser une nouvelle version : changer `VERSION` en tête de `sw.js` (par exemple `2026-12-02.1`). Sans ce changement, l'iPhone garde l'ancienne version, même si les autres fichiers ont changé. Si un fichier a été ajouté à l'appli, l'ajouter aussi à `FICHIERS` dans `sw.js`.

1. Repasser le dépôt en public, puis réactiver Pages (`main`, `/ (root)`) comme aux étapes 1 et 2 de l'installation. Vérifier depuis un ordinateur que l'adresse s'ouvre et que `https://m0cuish1e.github.io/babycounter/sw.js` contient la nouvelle `VERSION`.
2. Sur l'iPhone, avec du réseau, ouvrir l'appli **depuis son icône** (pas dans Safari). Elle télécharge la nouvelle version en entier en arrière-plan, puis se recharge d'elle-même au bout de quelques secondes. Si une fiche ou les réglages sont ouverts à ce moment-là, la nouvelle version s'affiche à l'ouverture suivante : fermer complètement l'appli et la rouvrir.
3. Vérifier dans **Réglages** que la version affichée est la nouvelle, et que les bébés sont toujours là.
4. Repasser le dépôt en privé.

Si le téléchargement de la nouvelle version échoue en cours de route (réseau coupé, fichier manquant), rien n'est remplacé : l'ancienne version reste en place, complète, et la mise à jour sera retentée à la prochaine ouverture avec du réseau tant que le site est public.

### Si l'appli disparaît ou perd ses données

- **Icône supprimée** : iOS efface avec elle la copie de l'appli **et tous les bébés**. Il faut réinstaller (dépôt public, Pages, Safari, Sur l'écran d'accueil), puis restaurer un export.
- **Données effacées par iOS** : iOS peut, rarement, effacer les données d'une appli web, par exemple quand le téléphone manque de place, ou si les données de sites sont effacées dans **Réglages** > **Safari** / **Applications** > **Safari** > **Effacer historique et données de sites**. L'appli demande à iOS de garder ses données, sans garantie. Si l'appli ne s'ouvre plus (page d'erreur 404 de GitHub) ou s'ouvre vide, réinstaller comme pour une première installation, puis restaurer un export.
- **Changement d'iPhone** : la sauvegarde iCloud ne transfère pas toujours les données des applis web. Faire un export juste avant, réinstaller sur le nouveau téléphone, puis importer.

**Restaurer à partir d'un export** : dans l'appli installée, **Réglages** > **Importer une sauvegarde**, choisir le fichier `.json` (dans Fichiers, iCloud Drive ou une pièce jointe enregistrée). L'import ajoute les bébés du fichier à ceux déjà présents, sans créer de doublons. Seuls les bébés présents dans le dernier export sont récupérés : d'où le rappel d'export tous les 10 bébés ajoutés.

## Fichiers

| Fichier | Rôle |
|---|---|
| `index.html` | Structure de la page et des fenêtres (fiche, réglages) |
| `style.css` | Mise en forme, téléphone par défaut puis ordinateur à partir de 900 px |
| `app.js` | Stockage, calendrier, liste, fiche, export/import |
| `sw.js` | Service worker : cache versionné pour le hors-ligne (`VERSION` à changer à chaque publication) |
| `manifest.webmanifest`, `icons/` | Installation comme appli |
| `fonts/` | Polices DM Sans et Caveat (licence OFL), embarquées pour le hors-ligne |
| `exemples/` | Jeux de données fictifs à importer pour tester (hors du cache hors ligne, volontairement) |

## Lancer en local

Le service worker ne fonctionne pas en ouvrant `index.html` directement. Servir le dossier :

```
python3 -m http.server 8000
```

puis ouvrir http://localhost:8000.

## Format d'une fiche

```json
{
  "id": "…", "prenom": "Inaya", "sexe": "F",
  "date": "2026-11-12", "heure": "03:14",
  "poids": 3420,
  "travail": "spontane", "peridurale": "avec", "mode": "naturel",
  "note": "",
  "cree": "…", "modifie": "…"
}
```

`poids` en grammes. `travail` parmi `spontane`, `declenche` ; `peridurale` parmi `avec`, `sans` ; `mode` parmi `naturel`, `instrumente`. Chacun peut être vide (non renseigné). Les champs inconnus d'un fichier importé sont conservés.

Anciennes fiches : la taille n'est plus saisie (une valeur déjà enregistrée reste dans la fiche) ; `voie-basse` devient `naturel`, `instrumentale` devient `instrumente`, `cesarienne` devient vide avec `"modeInitial": "cesarienne"`.
