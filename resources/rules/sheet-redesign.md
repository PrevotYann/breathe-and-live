# Refonte des fiches — 0.3.0

## Plan et périmètre

1. Conserver les schémas `system.*`, les documents, les calculs et les actions existants.
2. Réorganiser les templates Actor : navigation persistante avec icônes, combat compact, progression distincte de la création, santé distincte des références.
3. Remplacer les styles accumulés par un thème commun aux Actors et aux Items, avec champs contrastés et adaptation à la largeur de la fenêtre Foundry.
4. Vérifier navigation, sauvegarde des champs, actions, fenêtres étroites et tous les types de fiches dans Foundry 14.368 ; publier le tag et les fichiers installables.

## Correspondance règles / interface

| Domaine du livre | Interface | Logique conservée |
| --- | --- | --- |
| Ressources, attaques et réactions | Combat | `actor-derived-formulas.mjs`, `action-engine.mjs` |
| Statistiques et compétences | Caractéristiques | `actor-slayer-sheet.mjs` et modèles Actor |
| Création, entraîneur, Kasugai | Création / Corps | Assistant de création existant |
| Rangs, XP, emplacements | Progression | Tables et calculs de progression existants |
| Souffles, passifs, maîtrises | Souffles / Techniques | `use-technique.mjs`, `breath-effects.mjs` |
| Conditions, mutilations, mort | Santé | `condition-utils.mjs`, `effects-engine.mjs` |
| Armes, soins, transport, objets | Inventaire / fiches Item | Actions et modèles Item existants |
| Bestiaire, règles avancées, supplément 1934 | Références et sections dédiées | Données et réglage 1934 existants |

Aucune migration de données ni modification des valeurs du livre. Les sections repliées conservent leurs champs dans le formulaire. Les illustrations existantes restent disponibles ; cette refonte privilégie une interface sobre sans nouveaux fonds décoratifs.

## Validation et mise à jour

- Comparaison des neuf templates avec 0.2.2 : tous les noms et le nombre de champs sont conservés.
- Tests de règles, lint, validation des compendiums, contrôle de complétude et build installable.
- `npm run test:v14` : import des 14 compendiums, rendu des 32 types de documents, attaques, coûts de souffle, esquive, soins, blessures, repos et persistance sur Foundry 14.368.
- `npm run test:sheets` : 258 combinaisons onglet/largeur sur les 32 types, absence de débordement horizontal, contraste minimal 4,5:1, navigation clavier, modification des PV sans perte des autres champs ni des objets, sauvegarde des références déplacées, conservation des sections ouvertes après actualisation.
- Captures de contrôle : `tmp/sheet-previews/`. Les contrôles portent sur le monde isolé `bl-v14-qa`, avec les personnages fournis par les compendiums ; aucun monde de campagne n'est modifié.

La mise à jour utilise le manifeste existant. Fermer puis rouvrir les fiches après rechargement du client pour prendre en compte le nouveau thème. La largeur d'une fenêtre déjà mémorisée par Foundry peut être ajustée avec sa poignée habituelle.
