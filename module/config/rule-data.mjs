export const SYSTEM_ID = "breathe-and-live";
const BREATH_ICON_ROOT = "systems/breathe-and-live/resources/icons/breaths";

export const BREATH_KEYS = [
  {
    key: "sun",
    label: "Souffle du Soleil",
    optionLabel: "sun (Soleil)",
    color: "#d98a1f",
    img: `${BREATH_ICON_ROOT}/soleil.png`,
    prereq: { sense: "Aucun", stats: "Genie", weapons: "Katana Nichirin" },
    specials: {
      elu: {
        label: "Elu",
        hint:
          "Cout d'endurance divise par 2. En Marque, les degats du souffle sont triples.",
      },
    },
  },
  {
    key: "moon",
    label: "Souffle de la Lune",
    optionLabel: "moon (Lune)",
    color: "#6b79b8",
    img: `${BREATH_ICON_ROOT}/lune.png`,
    prereq: { sense: "Aucun", stats: "Aucun", weapons: "Katana Nichirin" },
    specials: {
      bonusSolo: {
        label: "Bonus solitaire",
        hint:
          "Le livre ne nomme pas cette competence speciale. En combat contre des demons, le pratiquant gagne 1 de de degats supplementaire lorsqu'il combat seul.",
      },
    },
  },
  {
    key: "flame",
    label: "Souffle de la Flamme",
    optionLabel: "flame (Flamme)",
    color: "#ba4a2f",
    img: `${BREATH_ICON_ROOT}/flamme.png`,
    prereq: { sense: "Aucun", stats: "Esprit", weapons: "Nichirin Katana" },
    specials: {
      coeurFlamboyant: {
        label: "Coeur flamboyant",
        hint:
          "Une fois par jour, double les degats de toutes les attaques pendant un round choisi.",
      },
    },
  },
  {
    key: "water",
    label: "Souffle de l'Eau",
    optionLabel: "water (Eau)",
    color: "#3977b8",
    img: `${BREATH_ICON_ROOT}/eau.png`,
    prereq: { sense: "Aucun", stats: "Aucun", weapons: "Nichirin Katana" },
    specials: {
      devierVagues: {
        label: "Devier les vagues",
        hint:
          "Reaction Devier : deplace une attaque a distance au corps a corps de chaque cote de l'utilisateur ou la devie vers une direction cible dans sa portee.",
      },
    },
  },
  {
    key: "wind",
    label: "Souffle du Vent",
    optionLabel: "wind (Vent)",
    color: "#5d8c72",
    img: `${BREATH_ICON_ROOT}/vent.png`,
    prereq: { sense: "Aucun", stats: "Aucun", weapons: "Nichirin Katana" },
    specials: {
      ventsDeGuerre: {
        label: "Vents de guerre",
        hint: "Recupere 1d2 RP en decapitant un demon.",
      },
    },
  },
  {
    key: "thunder",
    label: "Souffle de la Foudre",
    optionLabel: "thunder (Foudre)",
    color: "#c6a437",
    img: `${BREATH_ICON_ROOT}/foudre.png`,
    prereq: { sense: "Aucun", stats: "Aucun", weapons: "Nichirin Katana" },
    specials: {
      vitesseLumiere: {
        label: "Vitesse de la lumiere",
        hint: "Reaction Dash : deplacement immediat de 6 m dans n'importe quelle direction.",
      },
    },
  },
  {
    key: "stone",
    label: "Souffle de la Pierre",
    optionLabel: "stone (Pierre)",
    color: "#766657",
    img: `${BREATH_ICON_ROOT}/pierre.png`,
    prereq: { sense: "Aucun", stats: "Aucun", weapons: "Nichirin Maul" },
    specials: {
      machoireHache: {
        label: "Machoire et hache",
        hint:
          "Permute librement entre masse et hache. Masse: Force + 6, pas de decapitation. Hache: Finesse + 2, decapitation possible.",
      },
    },
  },
  {
    key: "flower",
    label: "Souffle de la Fleur",
    optionLabel: "flower (Fleur)",
    color: "#ba6b93",
    img: `${BREATH_ICON_ROOT}/fleur.png`,
    prereq: { sense: "Aucun", stats: "Aucun", weapons: "Nichirin Katana" },
    specials: {
      concentrationFlorissante: {
        label: "Concentration Florissante",
        hint:
          "En attaquant continuellement une cible unique, gagne un bonus cumulable de +2 aux degats et a l'esquive lies a cette cible.",
      },
    },
  },
  {
    key: "mist",
    label: "Souffle de la Brume",
    optionLabel: "mist (Brume)",
    color: "#8793ac",
    img: `${BREATH_ICON_ROOT}/brume.png`,
    prereq: { sense: "Aucun", stats: "Aucun", weapons: "Nichirin Katana" },
    specials: {
      nuagesTrainants: {
        label: "Nuages trainants",
        hint:
          "Chaque technique couvre les cases traversees d'un voile brumeux. Les pratiquants de la Brume peuvent s'y cacher pour doubler leur bonus de CA.",
      },
    },
  },
  {
    key: "serpent",
    label: "Souffle du Serpent",
    optionLabel: "serpent (Serpent)",
    color: "#6d8b47",
    img: `${BREATH_ICON_ROOT}/serpent.png`,
    prereq: { sense: "Aucun", stats: "Aucun", weapons: "Katana torsade Nichirin" },
    specials: {
      formeLibre: {
        label: "Forme libre",
        hint:
          "Ignore les terrains difficiles, grappins et ralentissements. Une telle tentative permet une riposte gratuite par attaque ou esquive.",
      },
    },
  },
  {
    key: "sound",
    label: "Souffle du Son",
    optionLabel: "sound (Son)",
    color: "#8c6d56",
    img: `${BREATH_ICON_ROOT}/son.png`,
    prereq: {
      sense: "Ouie",
      stats: "Flexibilite",
      weapons: "Epee tronconneuse double Nichirin",
    },
    specials: {
      scoreDeCombat: {
        label: "Score de combat",
        hint:
          "Au debut du combat: 1d4 par rang du demon moins Intellect en rounds. Desavantage sur attaques et degats pendant ces rounds, puis avantage ensuite. L'effet reste renseigne comme aide de jeu tant que l'automatisation contextuelle n'est pas terminee.",
      },
    },
  },
  {
    key: "insect",
    label: "Souffle de l'Insecte",
    optionLabel: "insect (Insecte)",
    color: "#7573c2",
    img: `${BREATH_ICON_ROOT}/insecte.png`,
    prereq: { sense: "Aucun", stats: "Aucun", weapons: "Pointe d'Aiguille Nichirin" },
    specials: {
      ecraserSousLePied: {
        label: "Ecraser sous le pied",
        hint:
          "Les attaques contre des cibles empoisonnees ont l'avantage au toucher et aux degats. Les esquives contre des cibles empoisonnees sont aussi doublees.",
      },
    },
  },
  {
    key: "love",
    label: "Souffle de l'Amour",
    optionLabel: "love (Amour)",
    color: "#cf6d86",
    img: `${BREATH_ICON_ROOT}/amour.png`,
    prereq: {
      sense: "Aucun",
      stats: "Muscles a 8 plis, Corps flexible",
      weapons: "Lame-fouet Nichirin",
    },
    specials: {
      balancementsAmoureux: {
        label: "Balancements Amoureux",
        hint:
          "Les attaques creent une sphere tranchante dans la portee de l'utilisateur sans affecter les allies. Pas de tirs amis accidentels avec cette arme.",
      },
    },
  },
  {
    key: "beast",
    label: "Souffle de la Bete",
    optionLabel: "beast (Bete)",
    color: "#6f5540",
    img: `${BREATH_ICON_ROOT}/bete.png`,
    prereq: {
      sense: "Toucher",
      stats: "Corps flexible",
      weapons: "Lames dentelees Nichirin",
    },
    specials: {
      dislocation: {
        label: "Dislocation",
        hint:
          "Si un demon tente de reagir pour echapper a une attaque, le pratiquant peut disloquer un bras pour garantir l'efficacite de l'attaque. Remise en place au tour suivant via action bonus.",
      },
    },
  },
  {
    key: "ocean",
    label: "Souffle de l'Ocean",
    optionLabel: "ocean (Ocean)",
    color: "#32879b",
    img: `${BREATH_ICON_ROOT}/ocean.png`,
    prereq: { sense: "Aucun", stats: "Corps flexible", weapons: "Katana Nichirin" },
    specials: {
      jambesDeLaMer: {
        label: "Jambes de la Mer",
        hint:
          "Sur terre, les degats du souffle sont reduits de moitie. Dans l'eau, ils passent a x1.5. L'arbitre doit encore indiquer manuellement si la scene compte comme aquatique.",
      },
    },
  },
  {
    key: "west",
    label: "Souffle de l'Ouest",
    optionLabel: "west (Ouest)",
    color: "#9d613f",
    img: `${BREATH_ICON_ROOT}/ouest.png`,
    prereq: {
      sense: "Aucun",
      stats: "Corps Fort",
      weapons: "Katana Nichirin, pistolet de cote",
    },
    specials: {
      sixCoups: {
        label: "Six-coups",
        hint:
          "Apres chaque attaque avec une forme de respiration, le pratiquant peut aussi tirer au pistolet comme attaque gratuite. Cette attaque n'est pas automatique.",
      },
    },
  },
  {
    key: "snow",
    label: "Souffle de la Neige",
    optionLabel: "snow (Neige)",
    color: "#9ab3d4",
    img: `${BREATH_ICON_ROOT}/neige.png`,
    prereq: { sense: "Aucun", stats: "Aucun", weapons: "Katana Nichirin" },
    specials: {
      dentsDeKatana: {
        label: "Dents de Katana",
        hint: "Sur touche, la cible perd temporairement 1d4 CA jusqu'a la fin du round.",
      },
    },
  },
  {
    key: "custom",
    label: "Souffle Original",
    optionLabel: "custom (Original)",
    color: "#8a6e52",
    img: `${BREATH_ICON_ROOT}/original.png`,
    prereq: { sense: "Selon creation", stats: "Selon creation", weapons: "Selon creation" },
    specials: {
      customPassive: {
        label: "Passif personnalise",
        hint: "Reserve aux souffles crees via les regles homebrew du livre.",
      },
    },
  },
];

export const BREATH_SPECIAL_ALIASES = {
  moon: { combatSolitaire: "bonusSolo" },
  sound: { partitionFulgurante: "scoreDeCombat" },
  insect: { veninLent: "ecraserSousLePied" },
  love: { coeurPassionne: "balancementsAmoureux" },
  beast: { instinctSauvage: "dislocation" },
  ocean: { courantMobile: "jambesDeLaMer" },
  west: { tirParfait: "sixCoups" },
};

export const ADVANCED_STATES = [
  {
    key: "tcbActive",
    label: "TCB actif",
    note: "Concentration totale en cours; le Souffle de recuperation est interdit tant que cet etat est actif.",
  },
  {
    key: "tcbPermanent",
    label: "TCB : Constant",
    note: "Recupere 1 Endurance par tour tant qu'actif.",
  },
  {
    key: "marque",
    label: "Forme Marquee",
    note: "Les degats de souffle sont lances avec avantage; souffle de recuperation x2.",
  },
  {
    key: "mondeTransparent",
    label: "Monde Transparent",
    note: "Les attaques non-basees sur le souffle deviennent critiques sur reussite.",
  },
  {
    key: "lameRouge",
    label: "Lame Rouge",
    note: "Double les degats contre les demons et bloque leur regeneration jusqu'a la fin du tour.",
  },
];

export const CUSTOM_BREATH_COST_TABLES = {
  damage: [
    { key: "1d6", label: "1d6", endurance: -1 },
    { key: "1d8", label: "1d8", endurance: 0 },
    { key: "1d10", label: "1d10", endurance: 1 },
    { key: "1d12", label: "1d12", endurance: 2 },
    { key: "2d8", label: "2d8", endurance: 3 },
    { key: "3d6", label: "3d6", endurance: 5 },
    { key: "1d20", label: "1d20", endurance: 6 },
    { key: "3d8", label: "3d8", endurance: 9 },
    { key: "4d8", label: "4d8", endurance: 12 },
    { key: "2d20", label: "2d20", endurance: 13 },
    { key: "3d20", label: "3d20", endurance: 16 },
  ],
  range: [
    { key: "melee", label: "1.5m / Cac", meters: 1.5, endurance: -3 },
    { key: "3m", label: "3m", meters: 3, endurance: 1 },
    { key: "4.5m", label: "4.5m", meters: 4.5, endurance: 2 },
    { key: "6m", label: "6m", meters: 6, endurance: 3 },
    { key: "7.5m", label: "7.5m", meters: 7.5, endurance: 4 },
    { key: "9m", label: "9m", meters: 9, endurance: 5 },
  ],
  effects: [
    { key: "direct", label: "Direct", endurance: -3 },
    { key: "charge", label: "Temps de Charge", endurance: -5 },
    { key: "ranged", label: "A distance", endurance: 3 },
    { key: "regenerator", label: "Regenerateur", endurance: 3 },
    { key: "deflect", label: "Deflecteur / Negateur", endurance: 4 },
    { key: "affliction", label: "Affliction", endurance: 3 },
    { key: "pursuer", label: "Poursuivant", endurance: 3 },
    { key: "sweep", label: "Fauchage", endurance: 2 },
  ],
};

export const CONDITION_DEFINITIONS = [
  {
    key: "burn",
    label: "Brulure",
    note: "1 degat de feu par tour.",
    turnFormula: "1",
  },
  {
    key: "bleed",
    label: "Saignement",
    note: "1d4 degats par tour jusqu'a soin ou souffle de recuperation.",
    turnFormula: "1d4",
  },
  {
    key: "freeze",
    label: "Gel",
    note: "Un membre ou le corps devient inutilisable pendant 1d4 tours.",
  },
  {
    key: "fury",
    label: "Fureur",
    note: "Attaque toute cible a portee avec des attaques de base.",
  },
  {
    key: "slowed",
    label: "Ralenti",
    note: "Une action tous les deux tours.",
  },
  {
    key: "sadness",
    label: "Triste",
    note: "Doit reussir un test d'endurance DD 15.",
  },
  {
    key: "imprisoned",
    label: "Emprisonne",
    note: "Ne peut pas bouger tant que la technique tient.",
  },
  {
    key: "offBalance",
    label: "Desequilibre",
    note: "Ouverture immediate; la cible est destabilisee.",
  },
  {
    key: "paralyzed",
    label: "Paralyse",
    note: "Ne peut pas agir normalement.",
  },
  {
    key: "controlled",
    label: "Controle",
    note: "Sous l'effet d'une contrainte externe.",
  },
  {
    key: "poisoned",
    label: "Empoisonne",
    note: "Subit une penalite ou des degats egaux a la puissance du poison.",
  },
  {
    key: "charmed",
    label: "Charme",
    note: "Ne peut pas attaquer son charmeur et traite ses ennemis comme siens.",
  },
  {
    key: "blinded",
    label: "Aveugle",
    note: "Echec auto aux tests lies a la vue.",
  },
  {
    key: "deafened",
    label: "Assourdi",
    note: "Echec auto aux tests lies a l'ouie.",
  },
  {
    key: "anosmia",
    label: "Anosmie",
    note: "Echec auto aux tests lies a l'odorat.",
  },
  {
    key: "paresthesia",
    label: "Paresthesie",
    note: "Le toucher et la precision sont perturbes.",
  },
  {
    key: "ageusia",
    label: "Ageusie",
    note: "Echec auto aux tests lies au gout.",
  },
  {
    key: "smoked",
    label: "Enfume",
    note: "Perd 1 Endurance par tour et par niveau. A 10 niveaux, inconscience.",
    trackIntensity: true,
  },
  {
    key: "cursed",
    label: "Maudit",
    note: "Effet persistant jusqu'a levee de la malediction ou mort.",
  },
];

export const LIMB_DEFINITIONS = [
  { key: "head", label: "Tete", thresholdRatio: 0.2, category: "vital" },
  { key: "torso", label: "Torse", thresholdRatio: 0.2, category: "vital" },
  { key: "leftArm", label: "Bras gauche", thresholdRatio: 0.2, category: "arm" },
  { key: "rightArm", label: "Bras droit", thresholdRatio: 0.2, category: "arm" },
  { key: "leftLeg", label: "Jambe gauche", thresholdRatio: 0.2, category: "leg", movementMultiplier: 0.5 },
  { key: "rightLeg", label: "Jambe droite", thresholdRatio: 0.2, category: "leg", movementMultiplier: 0.5 },
  { key: "wings", label: "Ailes", thresholdRatio: 0.1, category: "appendage", demonOnly: true, noFlight: true },
  { key: "tail", label: "Queue", thresholdRatio: 0.1, category: "appendage", demonOnly: true, movementFlatPenalty: 3 },
  { key: "tentacle1", label: "Tentacule 1", thresholdRatio: 0.1, category: "appendage", demonOnly: true, movementPenaltyRatio: 0.1 },
  { key: "tentacle2", label: "Tentacule 2", thresholdRatio: 0.1, category: "appendage", demonOnly: true, movementPenaltyRatio: 0.1 },
  { key: "tentacle3", label: "Tentacule 3", thresholdRatio: 0.1, category: "appendage", demonOnly: true, movementPenaltyRatio: 0.1 },
  { key: "tentacle4", label: "Tentacule 4", thresholdRatio: 0.1, category: "appendage", demonOnly: true, movementPenaltyRatio: 0.1 },
];

export const SLAYER_RANKS = [
  "Mizunoto",
  "Mizunoe",
  "Kanoto",
  "Kanoe",
  "Tsuchinoto",
  "Tsuchinoe",
  "Hinoto",
  "Hinoe",
  "Kinoto",
  "Kinoe",
  "Hashira",
];

export const HUMAN_RANK_LEVELS = Object.fromEntries(
  SLAYER_RANKS.map((rank, index) => [rank, index + 1])
);

export const SLAYER_RANK_PROGRESSION = {
  Mizunoe: { level: 2, statChoices: [1], hpBonus: 3, studySlots: 1, skillSlots: 1, enduranceBonus: 5 },
  Kanoto: { level: 3, statChoices: [1], hpBonus: 3, skillSlots: 1, weaponDieSteps: 1, enduranceBonus: 5 },
  Kanoe: { level: 4, statChoices: [1], hpBonus: 3, studySlots: 1, skillSlots: 1, enduranceBonus: 5 },
  Tsuchinoto: { level: 5, statChoices: [1], hpBonus: 3, skillSlots: 1, weaponDieSteps: 1, enduranceBonus: 5 },
  Tsuchinoe: { level: 6, statChoices: [1], hpBonus: 3, studySlots: 1, skillSlots: 1, enduranceBonus: 5 },
  Hinoto: { level: 7, statChoices: [1], hpBonus: 3, skillSlots: 1, weaponDieSteps: 1, enduranceBonus: 5 },
  Hinoe: { level: 8, statChoices: [1], hpBonus: 3, studySlots: 1, skillSlots: 1, enduranceBonus: 5 },
  Kinoto: { level: 9, statChoices: [1], hpBonus: 3, skillSlots: 1, weaponDieSteps: 1, enduranceBonus: 5 },
  Kinoe: { level: 10, statChoices: [5], hpBonus: 3, studySlots: 1, skillSlots: 1, enduranceBonus: 5 },
  Hashira: { level: 11, hpBonus: 3, reactionBonus: 10, breathFormBonus: 2, skillSlots: 1, enduranceBonus: 15 },
};

export const DEMONIST_RANKS = [...SLAYER_RANKS];

export const DEMONIST_RANK_PROGRESSION = {
  Mizunoe: { level: 2, statChoices: [1], hpBonus: 3, studySlots: 1, skillSlots: 1, demonFleshBonus: 2 },
  Kanoto: { level: 3, statChoices: [1], hpBonus: 3, skillSlots: 1, repeatedActionBonus: 2, nichirinDamageBonus: 3 },
  Kanoe: { level: 4, statChoices: [1], hpBonus: 3, studySlots: 1, skillSlots: 1, demonFleshBonus: 4 },
  Tsuchinoto: { level: 5, statChoices: [1], hpBonus: 3, skillSlots: 1, repeatedActionBonus: 3, nichirinDamageDie: "2d6" },
  Tsuchinoe: { level: 6, statChoices: [1], hpBonus: 3, studySlots: 1, skillSlots: 1, demonFleshBonus: 4 },
  Hinoto: { level: 7, statChoices: [1], hpBonus: 3, skillSlots: 1, repeatedActionBonus: 4, nichirinDamageDie: "3d6" },
  Hinoe: { level: 8, statChoices: [1], hpBonus: 3, studySlots: 1, skillSlots: 1, demonFleshBonus: 6 },
  Kinoto: { level: 9, statChoices: [1], hpBonus: 3, skillSlots: 1, repeatedActionBonus: 5, nichirinDamageDie: "4d6" },
  Kinoe: { level: 10, statChoices: [5], hpBonus: 3, studySlots: 1, skillSlots: 1, demonFleshBonus: 8 },
  Hashira: { level: 11, hpBonus: 3, reactionBonus: 10, breathFormBonus: 1, skillSlots: 1, repeatedActionBonus: 6 },
};

export const DEMON_RANKS = [
  "Demon faible",
  "Demon eleve",
  "Disciple de Lune inferieure",
  "Lune inferieure",
  "Disciple de Lune superieure",
  "Lune superieure",
];

export const DEMON_RANK_LEVELS = Object.fromEntries(
  DEMON_RANKS.map((rank, index) => [rank, index + 1])
);

export const DEMON_BLOODLINE_VARIANTS = [
  "Lune d'Or",
  "Lune Brulante",
  "Lune Enragee",
  "Lune Mecanique",
  "Lune Ancienne",
  "Lune Miroir",
  "Lune Ombree",
  "Lune Endeuillee",
  "Lune Jardin",
  "Lune Artisane",
  "Lune Submergee",
  "Lune Patchwork",
];

export const DEMON_BODY_OPTIONS = [
  {
    key: "humanoid",
    label: "Principalement humain",
    baseHp: 20,
    points: 0,
  },
  {
    key: "bestial",
    label: "Ressemblant a un animal",
    baseHp: 40,
    points: 1,
  },
  {
    key: "monstrous",
    label: "Monstrueux",
    baseHp: 60,
    points: 2,
  },
];

export const DEMON_MOVEMENT_OPTIONS = [
  {
    key: "biped",
    label: "Sur deux jambes",
    movement: 9,
    points: 0,
  },
  {
    key: "quadruped",
    label: "A quatre pattes",
    movement: 13.5,
    points: 1,
  },
  {
    key: "other",
    label: "Autre morphologie",
    movement: 18,
    points: 2,
  },
];

export const DEMON_DANGER_OPTIONS = [
  {
    key: "moderate",
    label: "Moderement dangereux",
    baseDamage: "1d4",
    points: 0,
  },
  {
    key: "abnormal",
    label: "Anormalement dangereux",
    baseDamage: "1d6",
    points: 1,
  },
  {
    key: "incredible",
    label: "Incroyablement dangereux",
    baseDamage: "1d8",
    points: 2,
  },
];

export const DEMON_RANK_PACKAGES = {
  "Demon faible": {
    addedStats: [4, 3, 2, 1, 1, 1],
    benchmark: {
      force: 4,
      finesse: 6,
      courage: 5,
      vitesse: 4,
      intellect: 6,
      social: 2,
      hp: 20,
      ca: 14,
      bite: "1d4+2",
      claw: "3",
      bda: "",
      rp: 4,
    },
  },
  "Demon eleve": {
    addedStats: [4, 4, 3, 3, 2, 1],
    benchmark: {
      force: 6,
      finesse: 8,
      courage: 7,
      vitesse: 6,
      intellect: 8,
      social: 4,
      hp: 50,
      ca: 16,
      bite: "1d4+3",
      claw: "4",
      bda: "1d6+3",
      rp: 4,
    },
  },
  "Disciple de Lune inferieure": {
    addedStats: [5, 5, 4, 3, 3, 2],
    benchmark: {
      force: 8,
      finesse: 10,
      courage: 9,
      vitesse: 8,
      intellect: 10,
      social: 6,
      hp: 80,
      ca: 18,
      bite: "1d6+4",
      claw: "5-8",
      bda: "1d8+4",
      rp: 9,
    },
  },
  "Lune inferieure": {
    addedStats: [6, 6, 5, 5, 4, 4],
    benchmark: {
      force: 12,
      finesse: 14,
      courage: 11,
      vitesse: 10,
      intellect: 13,
      social: 9,
      hp: 200,
      ca: 20,
      bite: "1d8+6",
      claw: "7-11",
      bda: "1d12+6",
      rp: 14,
    },
  },
  "Disciple de Lune superieure": {
    addedStats: [9, 7, 6, 6, 6, 5],
    benchmark: {
      force: 14,
      finesse: 16,
      courage: 13,
      vitesse: 12,
      intellect: 15,
      social: 12,
      hp: 350,
      ca: 25,
      bite: "1d10+8",
      claw: "10-15",
      bda: "1d20",
      rp: 25,
    },
  },
  "Lune superieure": {
    addedStats: [10, 10, 10, 9, 9, 8],
    benchmark: {
      force: 18,
      finesse: 18,
      courage: 16,
      vitesse: 16,
      intellect: 18,
      social: 16,
      hp: 600,
      ca: 30,
      bite: "1d20+10",
      claw: "13-20",
      bda: "2d12",
      rp: 50,
    },
  },
};

export const DEMON_SHARED_ACTIONS = [
  {
    key: "heal",
    label: "Guerison",
    cost: "2 BDP",
    note: "Utilise une action pour recuperer une importante quantite de PV selon le rang.",
  },
  {
    key: "regrow",
    label: "Repousse",
    cost: "4 BDP",
    note: "Fait repousser des membres ou appendices retires.",
  },
  {
    key: "purify",
    label: "Purification",
    cost: "Action",
    note: "Retire 1 stack de poison par niveau de rang.",
  },
  {
    key: "infect",
    label: "Infecter",
    cost: "Action",
    note: "Les Lunes inferieures/superieures peuvent demoniser un humain a 4 rangs de moins.",
  },
  {
    key: "sos",
    label: "SOS",
    cost: "Action",
    note: "Appelle les demons voisins de la meme branche.",
  },
  {
    key: "execute",
    label: "Executer",
    cost: "Action",
    note: "Disciple de Lune inferieure ou plus: execute un humain a 5 PV ou moins; impossible a esquiver.",
  },
  {
    key: "block",
    label: "Bloquer",
    cost: "1 RP",
    note: "Prepare une defense demoniaque consommable sur la prochaine attaque.",
  },
  {
    key: "dodge",
    label: "Esquiver",
    cost: "1 RP",
    note: "Prepare une esquive demoniaque consommable sur la prochaine attaque.",
  },
];

export const NPC_RANKS = ["Civil", "Kakushi", "Soutien", "Adversaire", "Boss"];

export const ITEM_ACTIVATIONS = [
  "passive",
  "action",
  "bonus",
  "reaction",
  "free",
  "rest",
];

export const COMPENDIUM_SOURCE_NOTE =
  "Le detail numerique absent du livre exporte reste annote comme note de verification.";
