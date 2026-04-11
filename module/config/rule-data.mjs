export const SYSTEM_ID = "breathe-and-live";

export const BREATH_KEYS = [
  {
    key: "sun",
    label: "Souffle du Soleil",
    optionLabel: "sun (Soleil)",
    img: "icons/magic/fire/projectile-meteor-salvo-light-orange.webp",
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
    img: "systems/breathe-and-live/assets/icons/souffles/lune.png",
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
    img: "systems/breathe-and-live/assets/icons/souffles/flamme.png",
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
    img: "icons/skills/water/wave-foam-blue.webp",
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
    img: "icons/magic/air/wind-swirl-gray-blue.webp",
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
    img: "icons/magic/light/projectile-lightning-blue.webp",
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
    img: "icons/weapons/hammers/hammer-war-rounding.webp",
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
    img: "icons/consumables/plants/lily-pad-stalk-white.webp",
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
    img: "icons/magic/air/fog-gas-smoke-gray.webp",
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
    img: "icons/creatures/reptiles/snake-green.webp",
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
    img: "icons/tools/instruments/megaphone.webp",
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
    img: "icons/creatures/invertebrates/butterfly-blue.webp",
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
    img: "icons/magic/control/debuff-chains-ropes-red.webp",
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
    img: "icons/skills/melee/claws-black.webp",
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
    img: "icons/magic/water/wave-water-blue.webp",
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
    img: "icons/weapons/guns/gun-pistol-flintlock-metal.webp",
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
    img: "icons/magic/water/barrier-ice-wall-blue.webp",
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
    img: "icons/svg/book.svg",
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

export const HUMAN_RANK_LEVELS = Object.fromEntries(
  SLAYER_RANKS.map((rank, index) => [rank, index + 1])
);

export const SLAYER_RANK_PROGRESSION = {
  Mizunoe: { level: 2, statChoices: [1], hpBonus: 3, studySlots: 1, enduranceBonus: 5 },
  Kanoto: { level: 3, statChoices: [1], hpBonus: 3, weaponDieSteps: 1, enduranceBonus: 5 },
  Kanoe: { level: 4, statChoices: [1], hpBonus: 3, studySlots: 1, enduranceBonus: 5 },
  Tsuchinoto: { level: 5, statChoices: [1], hpBonus: 3, weaponDieSteps: 1, enduranceBonus: 5 },
  Tsuchinoe: { level: 6, statChoices: [1], hpBonus: 3, studySlots: 1, enduranceBonus: 5 },
  Hinoto: { level: 7, statChoices: [1], hpBonus: 3, weaponDieSteps: 1, enduranceBonus: 5 },
  Hinoe: { level: 8, statChoices: [1], hpBonus: 3, studySlots: 1, enduranceBonus: 5 },
  Kinoto: { level: 9, statChoices: [1], hpBonus: 3, weaponDieSteps: 1, enduranceBonus: 5 },
  Kinoe: { level: 10, statChoices: [5], hpBonus: 3, studySlots: 1, enduranceBonus: 5 },
  Hashira: { level: 11, hpBonus: 3, reactionBonus: 10, breathFormBonus: 2, enduranceBonus: 15 },
};

export const DEMONIST_RANKS = [
  "Initie",
  "Mizunoe",
  "Kanoe",
  "Hinoto",
  "Kinoe",
];

export const DEMONIST_RANK_PROGRESSION = {
  Mizunoe: { level: 2, statChoices: [1], hpBonus: 3, studySlots: 1, demonFleshBonus: 2 },
  Kanoto: { level: 3, statChoices: [1], hpBonus: 3, repeatedActionBonus: 2, nichirinDamageBonus: 3 },
  Kanoe: { level: 4, statChoices: [1], hpBonus: 3, studySlots: 1, demonFleshBonus: 4 },
  Tsuchinoto: { level: 5, statChoices: [1], hpBonus: 3, repeatedActionBonus: 3, nichirinDamageDie: "2d6" },
  Tsuchinoe: { level: 6, statChoices: [1], hpBonus: 3, studySlots: 1, demonFleshBonus: 4 },
  Hinoto: { level: 7, statChoices: [1], hpBonus: 3, repeatedActionBonus: 4, nichirinDamageDie: "3d6" },
  Hinoe: { level: 8, statChoices: [1], hpBonus: 3, studySlots: 1, demonFleshBonus: 6 },
  Kinoto: { level: 9, statChoices: [1], hpBonus: 3, repeatedActionBonus: 5, nichirinDamageDie: "4d6" },
  Kinoe: { level: 10, statChoices: [5], hpBonus: 3, studySlots: 1, demonFleshBonus: 8 },
  Hashira: { level: 11, hpBonus: 3, reactionBonus: 10, breathFormBonus: 1, repeatedActionBonus: 6 },
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
  "Le detail numerique absent du livre exporte reste annote comme note de verification.";
