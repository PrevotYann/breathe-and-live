# Illustrations des Lanternes de Hotaru

Les 27 images définitives sont dans `assets/oneshot/lanternes-hotaru/` : couverture, trois cartes, dix-sept jetons (dont les deux Rôdeurs distincts), dessin de Mii, trois indices et deux pouvoirs. Trois miniatures de carte complètent les fichiers destinés à Foundry.

Ouvrir [la galerie](art-gallery.html) pour voir l'ensemble. Elle révèle les adversaires et les indices : elle est destinée au MJ. [Le manifeste](art-manifest.json) conserve les prompts exacts, dimensions, transparence attendue et références de composition. Les images ont été produites avec l'outil intégré `image_gen`, puis redimensionnées et encodées en WebP. Le manifeste de crédits livré avec les images indique leurs dimensions d'export, sans prétendre qu'elles sont leurs résolutions natives de génération.

Les personnages et lieux sont originaux, inspirés du style de l'anime Demon Slayer : contours nets, ombres en aplats, matières japonaises peintes, lanternes ambrées et lueurs cyan. Aucun texte de règle n'est incorporé aux images. Le dessin de Mii reste volontairement un dessin d'enfant pour conserver sa fonction d'indice.

## Entretien

- `npm run assets:oneshot` décode chaque image, vérifie les dimensions et les coins transparents des jetons, puis reconstruit les miniatures et `art-credits.json`. Cette commande ne génère pas de nouvelles illustrations.
- Pour intégrer de nouvelles sorties de `image_gen`, fournir un fichier JSON local associant les identifiants du manifeste aux chemins des PNG : `node resources/scripts/prepare-oneshot-assets.mjs --sources=tmp/hotaru-art-sources.json`. Le script ne recadre pas les compositions et conserve le canal alpha. `--partial` permet d'intégrer une sélection pendant la génération.
- `npm run assets:oneshot:layouts` recrée les anciens schémas uniquement dans `tmp/oneshot-layouts/`. Ils servent de références de géométrie ; ils n'écrasent jamais les images finales.
- `npm run build:oneshot` reconstruit l'Aventure, puis `npm run build` l'intègre au système distribuable avec tous ses fichiers.

## Import Foundry

Les cartes conservent les dimensions 4000 × 2800, 3000 × 2000 et 3000 × 2200, avec une grille Foundry de 100 px / 1,5 m ajoutée par le logiciel. Les jetons sont exportés en 512 × 512, à coins transparents.

Les chemins des images existantes restent stables. Le Rôdeur long cou dispose d'une texture propre sur la scène du pont. Les nouveaux indices et pouvoirs pointent vers leur illustration dans l'Aventure reconstruite. Pour un monde ayant déjà importé le scénario, sauvegarder avant de réimporter ou de mettre à jour ses documents ; les modifications de la scène et des références d'objets ne sont pas appliquées automatiquement aux copies présentes dans un monde.

## Placement des épingles et des jetons

`scenes.mjs` conserve des coordonnées en pixels de l'image finale. Les épingles
utilisent leur point central et les jetons leur coin supérieur gauche. Le
constructeur de l'aventure les convertit une seule fois en coordonnées du
canvas avec `coordinates.mjs` : Foundry v14 arrondit chaque marge à la case
supérieure. Avec 10 % de marge et une grille de 100 px, les origines des cartes
dans le canvas sont (400, 300), (300, 200) et (300, 300). Le cadrage initial
emploie la même conversion. Les notes sont liées au niveau « Carte ».

Les repères ont été vérifiés sur les WebP définitifs, en particulier le chemin
de la colline, le four et la stèle. Oume se tient devant son atelier ; Sota,
Fumi et Jirō sont centrés sur les trois cocons peints. Ne pas ajouter la marge
dans les définitions de `scenes.mjs` : elle serait appliquée deux fois.

`npm run test:oneshot:v14` importe et affiche les trois cartes dans le monde
jetable `bl-v14-qa`, vérifie les positions par rapport à `scene.dimensions`,
les liens vers les pages du journal et les illustrations du compendium de
soins. `FOUNDRY_QA_URL` permet de choisir le serveur de test. Les captures et
le rapport sont écrits dans `tmp/oneshot-map-previews/`.

Dans un monde où le scénario a déjà été importé, les nouvelles coordonnées
nécessitent de mettre à jour ou réimporter les scènes depuis l'Aventure.
L'import peut remplacer les documents correspondants : préserver les scènes
personnalisées avant de le faire. Installer les nouveaux fichiers du système
seul ne repositionne pas les documents du monde.
