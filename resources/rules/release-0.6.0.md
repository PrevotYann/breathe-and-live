# Breathe and Live v0.6.0 — refonte « fiche papier »

Compatible avec **Foundry VTT 14.368**.

- **Thème encre et washi** calqué sur la fiche de personnage du livre (p. 136-137) : en-tête à bord déchiré, lignes Nom / Sexe / Âge / Rang / Joueur, ensō peints, cadres au pinceau. Polices Cinzel, IM Fell English SC et EB Garamond incluses (licence OFL).
- **Fiche** (page 1 du livre) : caractéristiques en ensō, compétences dérivées dans des ovales et points restants dans la bulle ; anneaux PV / CA / E / RP avec jauge ; ellipse Souffle (Pourfendeur) ou Sang (BDP, démonisation) ; armes principale et secondaire ; tableau des techniques avec coût, dégâts et utilisation en un clic.
- **Dossier et Progression** (page 2) : portrait, les trois questions de l'entraîneur (p. 14) en choix 0 / 1 / 2 pts, corbeau Kasugai, ¥ et Sac ; Sens aiguisé, Niveau, Études, Caractéristiques surhumaines et avancées.
- **PNJ** présentés comme les blocs du bestiaire (p. 112-113, 119) : PV, CA, six caractéristiques, Attaques, Points de réaction, Capacités.
- **Santé** : silhouette indiquant l'état de chaque membre, conditions, mort et blessures graves pour tous les acteurs.
- Libellés français accentués pour les compétences, conditions, membres et maîtrises avancées.

**Validation : 95 tests automatisés réussis**, lint et build réussis ; sur Foundry **14.368**, rendu des 32 types de fiches, 258 vérifications d'onglets et de largeurs (dont 560 px), contrastes, navigation clavier, sauvegarde des champs et scénarios de combat.

Nouveaux champs de profil `age`, `sex`, `player`, `yen` et `bag` avec valeurs par défaut : aucune migration nécessaire. Mettre à jour le système, recharger le monde puis rouvrir les fiches.
