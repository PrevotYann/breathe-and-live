# Versions

## 0.9.0 — 8 novembre 2026 — rencontres du one-shot testées et équilibrées

- **Simulateur de rencontres** (`tests/oneshot-simulator.mjs`, `npm run sim:oneshot`) : le pont et l'atelier des « Lanternes de Hotaru » sont joués de bout en bout par le moteur du système (attaques, formes de Souffle, cartes de réaction, esquives, états, tours de combat), avec des dés tirés et les tactiques du Guide du MJ. Nouveau test `tests/oneshot-encounters.test.mjs`.
- **Constat avant correction** : 100 % de victoires, chaque combat terminé en 2 rounds, moins de 1 PV perdu par les joueurs contre Tomoshibi ; le boss mourait avant d'avoir joué son plan.
- **Rôdeurs des lanternes** : caractéristiques redistribuées (Social 7 inutile → Vitesse et Force) : 40 PV, CA 14 (repère « démon faible » du livre), 5 PR, 30 BDP. Toujours tableau (0,1,2,3,3,5) + set de rang faible.
- **Tomoshibi** : corps « Monstrueux » (2 points de construction démoniaque, 60 PV de base) + danger anormal (1 point), caractéristiques alignées sur le repère « démon de rang élevé » : 90 PV, CA 16, 8 PR, 30 BDP, 2 actions. **Feu follet bleu** (valeurs propres au scénario) touche jusqu'à 3 cibles désignées à 9 m, un jet de toucher et une esquive par cible, 4 BDP ; sa Brûlure dure 3 tours (comme le lance-flammes du livre) au lieu d'être permanente.
- **Résultat** (100 parties par configuration) : avec 5 joueurs, pont en 2-3 rounds et atelier en ~4 rounds, victoire dans tous les cas ; 4 joueurs ~4,6 rounds ; 3 joueurs ~7 rounds, ~5,5 avec le réglage conseillé. Le Guide du MJ (Actes 2-3, Tactiques, « Régler la difficulté ») donne les nouvelles valeurs et des réglages testés.
- **Correctif — charges entre deux combats** : une forme en charge (Coup de tonnerre et éclair, Pluie miséricordieuse...) ou en recharge restait mémorisée après la fin du combat et bloquait toutes les formes au combat suivant. Les charges et recharges sont désormais liées au combat et effacées à sa fin (ainsi que le repos forcé à 0 E).
- **Correctif — Brûlure et charge** : chaque dégât de Brûlure, Saignement ou Poison annulait la charge en cours ; un pourfendeur qui brûlait ne pouvait plus jamais lancer une forme à charge. Le livre dit « Être attaqué interrompt la charge » : seuls les dégâts d'une attaque l'interrompent.
- **Décapitation** : une attaque de base à la lame Nichirin visant la tête d'un démon, dont les dégâts atteignent ses PV restants, annonce la décapitation sur la carte (tête sectionnée, état Mort) au lieu de « à confirmer par le MJ ».
- Le script du one-shot gère le choix de corps démoniaque (20 / 40 / 60 PV de base) ; le test vérifie la décomposition tableau + set de rang et les 3 points de construction.
- Migration 0.9.0 : les charges et recharges enregistrées par les versions précédentes sont effacées (sauf pour un acteur dans un combat en cours).
- Mondes ayant déjà importé l'aventure : leurs démons gardent les anciennes valeurs ; réimporter l'aventure (ou recopier les fiches de Tomoshibi et du Rôdeur) pour profiter de l'équilibrage.

Validation : 125 tests automatisés (dont 7 de rencontres), lint, vérification du livre et validation des 14 compendiums réussis.

## 0.8.0 — 7 novembre 2026 — audit complet des règles

- **Souffles** : un souffle n'est pratiqué que si son objet « Souffle » est sur la fiche. Sa compétence spéciale (Brume « Nuages traînants », Eau « Dévier les vagues », Lune « Bonus solitaire », etc.) ne s'active qu'après avoir appris **toutes les formes** du style (livre, « Comment lire les fiches de souffle »). Les cases libres « Activer le souffle / ses passifs » sont supprimées ; la fiche affiche « Formes connues X / N » et les compétences verrouillées. Le MJ peut accorder la maîtrise à un PNJ (case « Maîtrise complète accordée par le MJ » sur l'objet Souffle).
- Le bouton « Brume : se cacher / sortir » n'apparaît que pour un pratiquant de la Brume ayant maîtrisé le style.
- **Réactions** : Riposte / Coup assuré, Dégainage et Soin démoniste ne sont affichés que s'ils sont débloqués (Entraînement au combat, Changement d'arme rapide, Formation à la guérison). Les joueurs commencent avec l'esquive seule (livre, Points de réaction).
- **Compétences supérieures** : TCB Constant, Forme Marquée, Monde Transparent et Lame Rouge restent sans effet tant qu'elles ne sont pas acquises (Kanoto, Tsuchinoe, Hinoe, Kinoe, ou déclencheurs du Souffle du Soleil). Libellés alignés sur le livre (désavantage contre le Monde Transparent, arrêt des saignements par TCB:C).
- **Arts de sang et valeurs hors livre** : au lieu d'un refus silencieux, le MJ arbitre au moment de l'usage (« Utiliser ces valeurs et les valider ? ») ; la validation est enregistrée sur l'objet. Les arts de sang de Tomoshibi (valeurs propres au scénario) sont livrés validés.
- Compendiums : Renjiro (Hashira) reçoit la maîtrise accordée par le MJ ; Aoi (niveau 2) perd Riposte (Entraînement au combat, rang Kanoe), Dégainage et Réaction médicale (rang Tsuchinoe). Script `resources/scripts/repair-breath-mastery-packs.mjs`.
- **Démoniste** : la réaction de soin lançait toujours 1d10 hors rangs lunaires (libellés de rang incompatibles) ; elle utilise désormais la table du livre (Rang élevé 2d10…) sur le démon le plus fort mangé récemment. Une table unique `DEMON_FLESH_RANKS` remplace les trois copies. Le rang « récent » s'efface au repos prolongé.
- **Régénération continue des membres** (passif, 1 démonisation/tour) peut enfin être activée et désactivée depuis la fiche.
- **Démons** : la règle « ajout de dégâts réduits de moitié » (p.112) s'applique aussi aux arts de sang (jet de toucher et formules « + Finesse »), plus seulement aux attaques de base.
- **Équipement de départ** conforme au livre : Pourfendeur = arme du souffle préféré (masse pour la Pierre, fouet pour l'Amour…), pistolet au choix, 2 bandages, pansement compressif OU trousse de premiers secours ; Démoniste = Fusil de tranchée + Wakizashi (le bandage et le sifflet Kasugai ajoutés sans source sont retirés).
- **Réactions** : nouvelle esquive à 2 RP « tirer une cible à l'abri » pour un allié (p.22), proposée seulement contre les attaques esquivables.
- **Bourreau / Guillotine** tuent désormais un démon de 50 / 100 PV de base ou moins dès qu'il est touché ; **L'ombre de la mort** ajoute +3d10 aux attaques discrètes ; **Tir en position stable** immobilise réellement le tireur.
- **0 Endurance** : repos forcé au premier tour, inconscience seulement après deux rounds complets sans Souffle de récupération (p.5) — auparavant après un seul.
- **Objets** (p.90-103) : Odachi à 3 m de portée (1,5 m + 1,5 m, au lieu de 4,5 m) ; seringue de sang de démon = soins complets avec test et 3 usages ; analgésiques = PV temporaires (¼ des PV max, 1 h) au lieu de +5 E ; Uniforme du Corps +1 CA ; Ford modèle T +1 Dextérité et 600 ¥ ; les bonus de Dextérité des voitures s'appliquent enfin à la conduite ; tenue de police décrite selon le livre. Les entrées sans source (rations, sifflet Kasugai, kit anti-0 PV, uniforme renforcé) sont étiquetées « Hors livre ».
- **Compétences de rang** : Entraînement au combat est une compétence Kanoe (niveau 4), Changement d'arme rapide et Formation médicale sont Tsuchinoe (niveau 6) ; Mika (niveau 2) et Goro (niveau 4) ne gardent que les réactions qu'ils peuvent avoir.
- **États** : textes de Déséquilibré, Paralysé, Contrôlé, Emprisonné et Paresthésie alignés sur le livre (p.28-29).
- Migration 0.8.0 : rien n'est supprimé ; le MJ reçoit la liste des acteurs dont un souffle était coché sans objet Souffle.
- Nouvelles ambiguïtés documentées : portées des armes à feu, poisons de glycine, PV de base pour Bourreau, jambe humaine, inconscience à 0 E.
- Mondes existants : les anciennes cases d'activation sont ignorées. Un acteur qui n'a pas l'objet Souffle doit le recevoir depuis « Souffles - Styles » pour utiliser ses formes.

Validation : 118 tests automatisés, lint, vérification du livre (137 pages, 140 formes) et validation des 14 compendiums réussis.

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
