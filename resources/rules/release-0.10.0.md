# Breathe and Live v0.10.0 — Cartes corrigées et illustrations d'objets

Compatible avec **Foundry VTT 14.368**.

Les épingles des « Lanternes de Hotaru » s'alignent désormais sur les lieux
peints des cartes. Les objets et les compendiums bénéficient d'une nouvelle
série d'illustrations cohérente avec l'art du scénario.

## Cartes du one-shot

- Correction du décalage des 13 épingles de journal et des 17 jetons sur les
  trois cartes : les coordonnées tiennent compte des marges de canvas arrondies
  à la grille par Foundry v14.
- Le cadrage initial utilise le même repère ; les notes sont liées au niveau
  « Carte » et ouvrent leurs pages du Guide du MJ.
- Ajustement du chemin de la colline et du four sur les illustrations finales.
  Oume se tient devant son atelier ; Sota, Fumi et Jirō sont centrés sur les
  trois cocons du repaire.

## Illustrations d'objets

- 16 illustrations originales générées avec `image_gen`, exportées en WebP
  512 × 512 : armes, armes à feu, munitions, explosifs, soins, poisons,
  nourriture, vêtements, transport, outils, équipement, techniques, souffles,
  arts de sang, sens et maîtrises.
- Palette indigo et ambre, matériaux japonais peints et contours à l'encre,
  en accord avec les illustrations des Lanternes de Hotaru.
- 218 références d'images actualisées dans les compendiums et les objets
  embarqués. Les listes et les nouvelles importations affichent directement
  les images corrigées.
- Les fiches affichent aussi les nouvelles images pour les anciens
  pictogrammes génériques, en conservant les illustrations personnalisées et
  les badges des souffles. Les identifiants et les mécaniques restent inchangés.

## Mise à jour

Mettre à jour le système, puis recharger le client Foundry. **Les scènes déjà
importées conservent leurs positions enregistrées** : mettre à jour ou
réimporter les scènes depuis l'Aventure pour recevoir la correction. Préserver
les scènes personnalisées avant toute réimportation, qui peut remplacer les
documents correspondants.

Les copies d'objets existantes ne sont pas modifiées automatiquement ; leurs
anciennes icônes génériques sont remplacées à l'affichage des fiches.

## Validation

- 128 tests automatisés réussis, lint, vérification du livre, validation des
  compendiums et construction de production.
- Import et affichage de l'Aventure dans un monde de test Foundry 14.368 :
  positions des 13 épingles et 17 jetons, liens des journaux et cadrages vérifiés.
- Chargement des 56 illustrations corrigées du compendium de soins et utilitaires
  dans Foundry ; décodage des 16 WebP en 512 × 512 vérifié.

Manifest d'installation et de mise à jour :

https://github.com/PrevotYann/breathe-and-live/releases/latest/download/manifest.json
