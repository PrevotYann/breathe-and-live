# Illustrations d'objets

Les 16 illustrations originales sont livrées dans `assets/icons/items/*.webp`
(512 × 512). Elles ont été générées individuellement avec l'outil intégré
`image_gen`, puis redimensionnées et encodées en WebP sans recadrage. Le
[manifeste](manifest.json) conserve les prompts exacts. La
[galerie](gallery.html) présente toute la série.

Direction artistique : matériaux japonais de l'ère Taishō peints, contours à
l'encre, ombres indigo et lumière ambrée, cohérents avec les illustrations des
Lanternes de Hotaru. Les catégories d'équipement, de techniques, de sens et de
maîtrises ont chacune leur illustration. Les badges de souffles existants et
les illustrations personnalisées restent prioritaires.

`npm run assets:items` vérifie que chaque export se décode en 512 × 512. Pour
intégrer de nouvelles sorties, utiliser
`npm run assets:items -- --sources=tmp/item-art-sources.json` avec un objet JSON
associant chaque identifiant du manifeste à son PNG généré. La commande n'appelle
aucune API de génération.

`npm run sync:art` remplace les pictogrammes génériques et les icônes Foundry
connues comme absentes dans les sources de compendiums, y compris les objets
embarqués. Elle ne change ni les identifiants ni les règles. Relancer cette
commande après toute reconstruction externe des packs. `sync:rules` et
`build:oneshot` l'exécutent déjà. Les anciens SVG locaux restent disponibles
pour les références historiques ; les fiches résolvent ces anciennes références
vers les WebP sans écraser les choix d'illustrations du monde.

Pour distribuer les modifications : `npm run build:oneshot`, puis `npm run build`.
Les listes de compendium et les nouvelles importations utilisent les références
d'images actualisées. Les copies existantes avec une ancienne icône générique
bénéficient du remplacement dans les fiches ; leurs données persistantes ne
sont pas modifiées automatiquement.
