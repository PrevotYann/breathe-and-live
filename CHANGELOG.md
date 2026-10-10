# Versions

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
