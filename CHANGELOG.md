# Versions

## 0.7.0 — 29 octobre 2026 — « Les Lanternes de Hotaru »

- Nouveau compendium **Aventure** `oneshot-lanternes-hotaru` (dossier « Scénarios ») : un one-shot d'initiation de 3 à 4 h, importable en un clic dans un monde.
- 5 prétirés non canoniques de rang Mizunoto (Eau, Foudre, Flamme, Vent, Démoniste) construits selon les règles de création du livre : tableau (0-5), points dérivés, 15 points de départ, équipement de classe, sous-classe de départ.
- 2 démons (rang faible et rang élevé) bâtis avec le tableau démon + set de rang ; 3 arts de sang propres au scénario, marqués comme valeurs de MJ.
- 8 PNJ, objets d'indice, « Livraison Kakushi » (règle de demande d'objets), guide du MJ pas à pas, aides de jeu et pages de présentation des prétirés.
- Illustrations définitives inspirées de l'anime Demon Slayer : couverture, 3 cartes (grille Foundry 1,5 m), 17 jetons à fond extérieur transparent, dessin de Mii, 3 indices et 2 pouvoirs. Épingles et positions conservées ; miniatures reconstruites par `npm run assets:oneshot`, pack par `npm run build:oneshot`.
- Validation : import réel testé sur Foundry 14.368 (fiches, pages et scènes rendues sans erreur), nouveau test `tests/oneshot.test.mjs`.

## 0.6.0 — refonte « fiche papier »

- Nouveau thème encre et washi calqué sur la fiche de personnage du livre (p. 136-137) : en-tête gris à bord déchiré, lignes « Nom / Sexe / Âge / Rang / Joueur », ensō peints, cadres au pinceau, polices Cinzel, IM Fell English SC et EB Garamond (OFL, incluses).
- Onglet **Fiche** = page 1 du livre : colonne Stats avec ensō par caractéristique, compétences dérivées dans des ovales et points restants dans la bulle ; anneaux PV / CA / E / RP avec jauge ; ellipse Souffle (Pourfendeur) ou Sang (BDP, démonisation) ; Armes principale / secondaire ; tableau Techniques (coût, dégâts, utilisation en un clic) ; actions.
- Onglets **Dossier** et **Progression** = page 2 : portrait, les trois questions de l'entraîneur (p. 14) en choix 0/1/2 pts, corbeau Kasugai, ¥ et Sac ; Sens aiguisé, Niveau, Études, Caractéristiques surhumaines et avancées.
- PNJ présentés comme les blocs du bestiaire (p. 112-113, 119) : PV, CA, six caractéristiques, Attaques, Points de réaction, Capacités.
- Santé : silhouette avec l'état de chaque membre, conditions accentuées, mort et blessures graves pour tous les acteurs.
- Nouveaux champs de profil `age`, `sex`, `player`, `yen`, `bag` (valeurs par défaut, aucune migration nécessaire). Libellés français accentués pour compétences, conditions, membres et maîtrises avancées.
- Modèles d'acteur factorisés en sections partagées (`templates/actor/parts/`) ; illustrations vectorielles régénérables via `npm run assets:ink`.

## 0.5.2 — 10 octobre 2026

- Simulations reproductibles de combats avec quatre acteurs : deux Pourfendeurs, une Démoniste équipée d'un fusil et un Démon jouable.
- Attendre exige le tour du personnage et une action disponible ; les restrictions de conditions s'appliquent aussi aux actions de récupération, de soin et de recharge.
- La réaction de soin Démoniste respecte la Lame Rouge ; les soins sérialisés préservent les dégâts simultanés et les PV au-dessus du plafond de blessures.
- Les effets différés utilisent l'utilitaire Foundry v14 ; le repos exige une durée valide entre les combats et ne ressuscite pas les morts.
- Rapport de combat inclus dans le système et commande `npm run test:combat:v14` pour la QA native.

Validation : 95 tests automatisés, lint, build et scénarios natifs sur Foundry VTT 14.368 réussis. Aucun changement de schéma ; les données de règles manquantes restent explicitement signalées.

## 0.3.0 — 30 septembre 2026

- Nouveau thème commun : navigation latérale avec icônes, en-tête compact, panneaux clairs et accents par archétype.
- Organisation des acteurs : combat, caractéristiques, techniques, inventaire, santé, progression, création et références selon la classe.
- Fiches objets, armes, souffles, techniques et véhicules harmonisées ; coûts des techniques regroupés, sources et tags dans Références.
- Détails de règles, construction de souffle maison, poisons et historiques de création dépliables.
- Mise en page adaptée à la largeur de chaque fenêtre, navigation clavier, champs et menus contrastés, sections ouvertes conservées lors d'une modification.
- Tous les champs, objets et règles existants conservés. Aucun changement de schéma ni migration supplémentaire.

Validation sur Foundry VTT 14.368 : 39 tests automatisés, import des 14 compendiums, 32 types de fiches, 258 vérifications d'onglets/largeurs, contrastes, sauvegardes et scénarios de combat.
