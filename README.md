# Babycounter

Carnet personnel des naissances pour une étudiante sage-femme : un bracelet par bébé, un calendrier (semaine, mois, année) et quelques stats.

- **Rien à installer** : c'est une page web, installable comme une appli (PWA) et utilisable hors ligne.
- **Données sur l'appareil uniquement** : tout est stocké dans le navigateur (`localStorage`). Aucun serveur, aucun envoi réseau.
- **Sauvegarde** : export et import d'un fichier JSON depuis « Réglages et sauvegarde ».

## Fichiers

| Fichier | Rôle |
|---|---|
| `index.html` | Structure de la page et des fenêtres (fiche, réglages) |
| `style.css` | Mise en forme, téléphone par défaut puis ordinateur à partir de 900 px |
| `app.js` | Stockage, calendrier, liste, fiche, export/import |
| `sw.js` | Service worker : cache pour le hors-ligne |
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
  "poids": 3420, "taille": 50,
  "mode": "voie-basse", "note": "",
  "cree": "…", "modifie": "…"
}
```

`poids` en grammes, `taille` en centimètres, `mode` parmi `voie-basse`, `instrumentale`, `cesarienne` ou vide. Les champs inconnus d'un fichier importé sont conservés.
