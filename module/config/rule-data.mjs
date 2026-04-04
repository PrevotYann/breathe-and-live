export const SYSTEM_ID = "breathe-and-live";

export const BREATH_KEYS = [
  { key: "sun", label: "Souffle du Soleil" },
  { key: "moon", label: "Souffle de la Lune" },
  { key: "flame", label: "Souffle de la Flamme" },
  { key: "water", label: "Souffle de l'Eau" },
  { key: "wind", label: "Souffle du Vent" },
  { key: "thunder", label: "Souffle de la Foudre" },
  { key: "stone", label: "Souffle de la Pierre" },
  { key: "flower", label: "Souffle de la Fleur" },
  { key: "mist", label: "Souffle de la Brume" },
  { key: "serpent", label: "Souffle du Serpent" },
  { key: "sound", label: "Souffle du Son" },
  { key: "insect", label: "Souffle de l'Insecte" },
  { key: "love", label: "Souffle de l'Amour" },
  { key: "beast", label: "Souffle de la Bete" },
  { key: "ocean", label: "Souffle de l'Ocean" },
  { key: "west", label: "Souffle de l'Ouest" },
  { key: "snow", label: "Souffle de la Neige" },
  { key: "custom", label: "Souffle Original" },
];

export const ADVANCED_STATES = [
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
  { key: "head", label: "Tete" },
  { key: "torso", label: "Torse" },
  { key: "leftArm", label: "Bras gauche" },
  { key: "rightArm", label: "Bras droit" },
  { key: "leftLeg", label: "Jambe gauche" },
  { key: "rightLeg", label: "Jambe droite" },
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

export const DEMONIST_RANKS = [
  "Initie",
  "Mizunoe",
  "Kanoe",
  "Hinoto",
  "Kinoe",
];

export const DEMON_RANKS = [
  "Demon faible",
  "Demon eleve",
  "Disciple de Lune inferieure",
  "Lune inferieure",
  "Disciple de Lune superieure",
  "Lune superieure",
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
    cost: "Reaction",
    note: "Se prepare a encaisser ou intercepter une attaque.",
  },
  {
    key: "dodge",
    label: "Esquiver",
    cost: "Reaction",
    note: "Peut eviter les attaques avec ses points de reaction.",
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
  "Le detail numerique absent du livre exporte reste annote avec TODO-RULEBOOK-AMBIGUITY.";
