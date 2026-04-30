import { BREATH_KEYS, SYSTEM_ID } from "../config/rule-data.mjs";
import { getEffectiveBaseStats } from "./poison-utils.mjs";
import { calculateHealableMax } from "./actor-derived-formulas.mjs";

const FU = foundry.utils;

const BREATH_KEYWORDS = [
  ["sun", /(soleil|sun)/i],
  ["moon", /(lune|moon)/i],
  ["flame", /(flamme|flame)/i],
  ["water", /(eau|water)/i],
  ["wind", /(vent|wind)/i],
  ["thunder", /(foudre|tonnerre|thunder)/i],
  ["stone", /(pierre|stone)/i],
  ["flower", /(fleur|flower)/i],
  ["mist", /(brume|mist)/i],
  ["serpent", /(serpent)/i],
  ["sound", /(son|sound)/i],
  ["insect", /(insecte|insect)/i],
  ["love", /(amour|love)/i],
  ["beast", /(bete|bête|beast)/i],
  ["ocean", /(ocean|océan)/i],
  ["west", /(ouest|west)/i],
  ["snow", /(neige|snow)/i],
  ["custom", /(original|custom|homebrew)/i],
];

const DERIVED_LABELS = {
  athletisme: "Athletisme",
  puissanceBrute: "Puissance Brute",
  dexterite: "Dexterite",
  equilibre: "Equilibre",
  precision: "Precision",
  mithridatisme: "Mithridatisme",
  endurance: "Endurance",
  tolerance: "Tolerance",
  reflexes: "Reflexes",
  agilite: "Agilite",
  rapidite: "Rapidite",
  ruse: "Ruse",
  tromperie: "Tromperie",
  performance: "Performance",
  intimidation: "Intimidation",
  perception: "Perception",
  intuition: "Intuition",
  medecine: "Medecine",
  nature: "Nature",
  sciences: "Sciences",
  enquete: "Enquete",
  survie: "Survie",
};

const SPECIAL_PATTERNS = [
  {
    pattern: /fendre|coupé destructif/i,
    apply: (automation, flags, tags) => {
      automation.area = "allInRange";
      flags.aoe = true;
      tags.add("aoe");
    },
  },
  {
    pattern: /déflecteur\s*\/\s*(neutralisateur|annulateur)|deflect/i,
    apply: (automation, flags, tags) => {
      automation.deflect = true;
      flags.deflect = true;
      tags.add("deflect");
    },
  },
  {
    pattern: /annule les dégâts subis/i,
    apply: (automation) => {
      automation.negateIncomingDamage = true;
    },
  },
  {
    pattern: /en ligne droite|mouvement direct/i,
    apply: (automation, flags) => {
      automation.lineOnly = true;
      flags.mobility = true;
    },
  },
  {
    pattern: /temps de charge/i,
    apply: (automation, flags, tags) => {
      automation.chargeTurns = Math.max(automation.chargeTurns, 1);
      flags.charge = Math.max(flags.charge || 0, 1);
      tags.add("charge");
    },
  },
  {
    pattern: /tour pour se charger/i,
    apply: (automation, flags, tags) => {
      automation.chargeTurns = Math.max(automation.chargeTurns, 1);
      flags.charge = Math.max(flags.charge || 0, 1);
      tags.add("charge");
    },
  },
  {
    pattern: /temps de recharge/i,
    apply: (automation, _flags, tags) => {
      automation.cooldownTurns = Math.max(automation.cooldownTurns, 1);
      tags.add("cooldown");
    },
  },
  {
    pattern: /tour pour se recharger/i,
    apply: (automation, _flags, tags) => {
      automation.cooldownTurns = Math.max(automation.cooldownTurns, 1);
      tags.add("cooldown");
    },
  },
  {
    pattern: /à distance|distance autorisée/i,
    apply: (automation, _flags, tags) => {
      automation.ranged = true;
      tags.add("ranged");
    },
  },
  {
    pattern: /pas de limite/i,
    apply: (automation, _flags, tags) => {
      automation.unlimitedRange = true;
      tags.add("unlimited-range");
    },
  },
  {
    pattern: /impossible (d'y )?(réagir|de réagir|à contrer)|impossible à contrer/i,
    apply: (automation) => {
      automation.cannotBeReactedTo = true;
    },
  },
  {
    pattern: /impossible (d'y )?(éviter|de l'éviter|à esquiver)|impossible à esquiver/i,
    apply: (automation) => {
      automation.cannotBeDodged = true;
    },
  },
  {
    pattern: /affliction/i,
    apply: (automation, _flags, tags, special) => {
      automation.afflictionStacks = /^3x/i.test(String(special || "").trim()) ? 3 : Math.max(automation.afflictionStacks, 1);
      tags.add("affliction");
      tags.add("poison");
    },
  },
  {
    pattern: /régénérateur/i,
    apply: (automation, _flags, tags) => {
      if (automation.enduranceRestore === "none") automation.enduranceRestore = "damageDealt";
      tags.add("regeneration");
    },
  },
  {
    pattern: /régénère de l'endurance/i,
    apply: (automation) => {
      automation.enduranceRestore = "previousDamageTaken";
    },
  },
  {
    pattern: /régénère l'endurance/i,
    apply: (automation) => {
      if (automation.enduranceRestore === "none") automation.enduranceRestore = "damageDealt";
    },
  },
  {
    pattern: /forme de cône|forme de cone/i,
    apply: (automation, flags, tags) => {
      automation.area = "cone";
      flags.aoe = true;
      tags.add("cone");
    },
  },
  {
    pattern: /ou$/i,
    apply: (automation) => {
      automation.alternativeMode = "deflect";
    },
  },
];

function normalizeText(value) {
  return String(value ?? "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function toNumber(value, fallback = 0) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const text = String(value ?? "").trim().replace(",", ".");
  if (!text || /^x$/i.test(text)) return fallback;
  const number = Number(text);
  return Number.isFinite(number) ? number : fallback;
}

function baseStatLabelMap() {
  return {
    force: "Force",
    finesse: "Finesse",
    courage: "Courage",
    vitesse: "Vitesse",
    social: "Social",
    intellect: "Intellect",
  };
}

function derivedLabelMap() {
  return CONFIG.breatheAndLive?.DERIVED_LABELS || DERIVED_LABELS;
}

function makeTagList(tags = []) {
  const list = new Set();
  for (const tag of tags) {
    const value = String(tag || "").trim();
    if (value) list.add(value);
  }
  return list;
}

export function normalizeBreathName(raw) {
  const text = String(raw ?? "").trim();
  if (!text) return "";
  for (const [key, pattern] of BREATH_KEYWORDS) {
    if (pattern.test(text)) return key;
  }
  return "";
}

export function getBreathDefinition(key) {
  return BREATH_KEYS.find((entry) => entry.key === key) || null;
}

export function getBreathLabel(raw, fallback = "") {
  const key = normalizeBreathName(raw) || String(raw || "");
  return getBreathDefinition(key)?.label || fallback || String(raw || "");
}

export function parseTechniqueRange(raw) {
  const text = String(raw ?? "").trim();
  const normalized = normalizeText(text);

  if (!text) return { range: 1.5, rangeText: "", unlimited: false };
  if (normalized.includes("pas de limite")) {
    return { range: 9999, rangeText: text, unlimited: true };
  }

  const meterMatch = normalized.match(/(\d+(?:[.,]\d+)?)\s*m/);
  if (meterMatch) {
    return {
      range: Number(meterMatch[1].replace(",", ".")) || 1.5,
      rangeText: text,
      unlimited: false,
    };
  }

  if (normalized.includes("cac") || normalized.includes("c a c")) {
    return { range: 1.5, rangeText: text, unlimited: false };
  }

  const feetMatch = normalized.match(/(\d+(?:[.,]\d+)?)\s*ft/);
  if (feetMatch) {
    const feet = Number(feetMatch[1].replace(",", ".")) || 5;
    return { range: Number((feet * 0.3048).toFixed(1)), rangeText: text, unlimited: false };
  }

  return { range: 1.5, rangeText: text, unlimited: false };
}

export function parseTechniqueDamageData(rawDamage) {
  const rawText = String(rawDamage ?? "").replace(/\r/g, "").trim();
  const lines = rawText
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const primaryFormula = lines.find((line) => /\d+d\d+/i.test(line)) || "1d8";
  const specialLines = lines.filter((line) => line !== primaryFormula);
  const flags = {
    aoe: false,
    antiFriendlyFire: false,
    mobility: false,
    decapitation: false,
    charge: 0,
    deflect: false,
  };
  const automation = {
    requiresBreath: true,
    area: "single",
    alternativeMode: "",
    lineOnly: false,
    ranged: false,
    unlimitedRange: false,
    chargeTurns: 0,
    cooldownTurns: 0,
    cannotBeDodged: false,
    cannotBeReactedTo: false,
    deflect: false,
    negateIncomingDamage: false,
    afflictionStacks: 0,
    enduranceRestore: "none",
  };
  const tags = makeTagList();

  for (const special of specialLines) {
    for (const entry of SPECIAL_PATTERNS) {
      if (entry.pattern.test(special)) {
        entry.apply(automation, flags, tags, special);
      }
    }
  }

  return {
    damage: primaryFormula,
    damageText: rawText,
    specialLines,
    flags,
    automation,
    tags: Array.from(tags),
  };
}

export function attackStatFromModifier(rawModifier = "") {
  const text = normalizeText(rawModifier);
  if (!text) return "";
  if (text.includes("force") && text.includes("finesse")) return "force-or-finesse";
  if (text.includes("force")) return "force";
  if (text.includes("finesse")) return "finesse";
  if (text.includes("precision")) return "precision";
  if (text.includes("performance")) return "performance";
  if (text.includes("medecine")) return "medecine";
  if (text.includes("vitesse")) return "vitesse";
  if (text.includes("intellect")) return "intellect";
  if (text.includes("social")) return "social";
  if (text.includes("courage")) return "courage";
  return "";
}

function statTokenMap(actor, context = {}) {
  const baseMap = baseStatLabelMap();
  const derivedMap = derivedLabelMap();
  const tokens = {};
  const effectiveBase = getEffectiveBaseStats(actor);

  for (const [key, label] of Object.entries(baseMap)) {
    tokens[normalizeText(key)] = Number(effectiveBase[key] ?? FU.getProperty(actor, `system.stats.base.${key}`) ?? 0) || 0;
    tokens[normalizeText(label)] = tokens[normalizeText(key)];
  }

  tokens[normalizeText("Puissance")] = tokens[normalizeText("Force")] ?? 0;

  for (const [key, label] of Object.entries(derivedMap)) {
    tokens[normalizeText(key)] = Number(FU.getProperty(actor, `system.stats.derived.${key}`) ?? 0) || 0;
    tokens[normalizeText(label)] = tokens[normalizeText(key)];
  }

  if (context.headWeaponMode === "axe") {
    tokens[normalizeText("Tête de Hache")] = tokens[normalizeText("Finesse")] + 2;
  } else if (context.headWeaponMode === "maul") {
    tokens[normalizeText("Tête de Hache")] = tokens[normalizeText("Force")] + 6;
  } else {
    tokens[normalizeText("Tête de Hache")] = Math.max(
      tokens[normalizeText("Force")] + 6,
      tokens[normalizeText("Finesse")] + 2
    );
  }

  return tokens;
}

export function buildFormulaWithActorStats(expr, actor, context = {}) {
  let output = String(expr || "1d8").trim();
  if (!actor) return output;
  output = output.replace(/(\d+d\d+)\s+Puissance\b/gi, "$1 + Puissance");

  output = output.replace(/(\d+d\d+)\s+(Force|Finesse|Courage|Vitesse|Social|Intellect|Precision|Performance|Medecine|Tête de Hache)\b/gi, "$1 + $2");

  const tokens = statTokenMap(actor, context);
  const chooseBest = (a, b) => Math.max(tokens[normalizeText(a)] ?? 0, tokens[normalizeText(b)] ?? 0);

  output = output.replace(/Force\s*(?:\/|ou)\s*Finesse/gi, String(chooseBest("Force", "Finesse")));
  output = output.replace(/Finesse\s*(?:\/|ou)\s*Force/gi, String(chooseBest("Force", "Finesse")));
  output = output.replace(/Puissance\s*(?:\/|ou)\s*Finesse/gi, String(chooseBest("Puissance", "Finesse")));
  output = output.replace(/Finesse\s*(?:\/|ou)\s*Puissance/gi, String(chooseBest("Puissance", "Finesse")));

  const orderedTokens = Object.keys(tokens).sort((a, b) => b.length - a.length);
  for (const token of orderedTokens) {
    const value = tokens[token];
    const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    output = output.replace(new RegExp(`\\b${escaped}\\b`, "gi"), String(value));
  }

  return output;
}

export function actorHasBreath(actor, breathKey) {
  const key = normalizeBreathName(breathKey);
  if (!actor || !key) return true;
  const actorToggle = !!FU.getProperty(actor, `system.breaths.${key}.enabled`);
  const actorItem = actor.items?.some((item) => item.type === "breath" && item.system?.key === key);
  return actorToggle || !!actorItem;
}

function isConcretePrerequisite(value) {
  const text = normalizeText(value);
  return !!text && !["aucun", "none", "seloncreation", "variable", "libre"].includes(text);
}

function actorHasSense(actor, senseName) {
  if (!actor || !isConcretePrerequisite(senseName)) return true;
  const wanted = normalizeText(senseName);
  return actor.items?.some((item) => {
    if (item.type !== "sense") return false;
    return (
      normalizeText(item.system?.senseType).includes(wanted) ||
      normalizeText(item.name).includes(wanted)
    );
  });
}

function actorHasTrait(actor, traitName) {
  if (!actor || !isConcretePrerequisite(traitName)) return true;
  const wanted = normalizeText(traitName);
  return actor.items?.some((item) => {
    if (!["feature", "sense"].includes(item.type)) return false;
    const tags = Array.isArray(item.system?.tags) ? item.system.tags.join(" ") : "";
    return (
      normalizeText(item.name).includes(wanted) ||
      normalizeText(item.system?.family).includes(wanted) ||
      normalizeText(tags).includes(wanted)
    );
  });
}

function actorHasWeaponPrereq(actor, weaponName) {
  if (!actor || !isConcretePrerequisite(weaponName)) return true;
  const wanted = normalizeText(weaponName);
  return actor.items?.some((item) => {
    if (!["weapon", "firearm"].includes(item.type)) return false;
    const tags = [
      item.name,
      item.system?.weaponFamily,
      item.system?.category,
      ...(Array.isArray(item.system?.tags) ? item.system.tags : []),
      ...(Array.isArray(item.system?.properties) ? item.system.properties : []),
    ].join(" ");
    const haystack = normalizeText(tags);
    return haystack.includes(wanted) || wanted.includes(haystack);
  });
}

export function validateTechniqueOwnership(actor, itemData) {
  const type = String(itemData?.type || "");
  if (type !== "technique") return { ok: true, breathKey: "" };

  const breathKey =
    String(itemData?.system?.breathKey || "") ||
    normalizeBreathName(itemData?.system?.breath) ||
    normalizeBreathName(itemData?.name);

  const requiresBreath = itemData?.system?.automation?.requiresBreath !== false && !!breathKey;
  if (requiresBreath && !actorHasBreath(actor, breathKey)) {
    return {
      ok: false,
      breathKey,
      message: `${actor.name} doit posseder ${getBreathLabel(breathKey, breathKey)} pour ajouter ${itemData?.name || "cette technique"}.`,
    };
  }

  const prereq = itemData?.system?.prerequisites || {};
  if (!actorHasSense(actor, prereq.sense)) {
    return {
      ok: false,
      breathKey,
      message: `${actor.name} doit posseder le sens requis (${prereq.sense}) pour ajouter ${itemData?.name || "cette technique"}.`,
    };
  }
  if (!actorHasTrait(actor, prereq.trait)) {
    return {
      ok: false,
      breathKey,
      message: `${actor.name} doit posseder le trait requis (${prereq.trait}) pour ajouter ${itemData?.name || "cette technique"}.`,
    };
  }
  if (!actorHasWeaponPrereq(actor, prereq.weapon)) {
    return {
      ok: false,
      breathKey,
      message: `${actor.name} doit posseder l'arme requise (${prereq.weapon}) pour ajouter ${itemData?.name || "cette technique"}.`,
    };
  }

  return { ok: true, breathKey };
}

export function normalizeTechniqueItemData(row = {}) {
  const breathKey = normalizeBreathName(row.breathKey || row.breath || row.sheet || "");
  const breathLabel = getBreathLabel(breathKey, row.breath || row.sheet || "");
  const rangeData = parseTechniqueRange(row.rangeText || row.range || "");
  const damageData = parseTechniqueDamageData(row.damageText || row.damage || "");
  const tags = makeTagList([
    "breath",
    breathKey,
    ...(Array.isArray(row.tags) ? row.tags : []),
    ...damageData.tags,
  ]);

  return {
    breath: breathLabel,
    breathKey,
    breathLabel,
    form: toNumber(row.form, 1),
    costE: toNumber(row.costE ?? row.cost, 0),
    costRp: toNumber(row.costRp, 0),
    costBdp: toNumber(row.costBdp, 0),
    damage: row.damage || damageData.damage,
    damageText: row.damageText || row.damage || "",
    range: rangeData.range,
    rangeText: rangeData.rangeText,
    modifierText: row.modifierText || row.modifier || "",
    attackStat: row.attackStat || attackStatFromModifier(row.modifierText || row.modifier || ""),
    autoHit: row.autoHit !== false,
    isBreath: row.isBreath !== false,
    sourceSection: row.sourceSection || breathLabel || row.sheet || "",
    description: row.description || "",
    usageNote: row.usageNote || "",
    prerequisites: {
      class: "",
      rank: "",
      sense: "",
      weapon: "",
      trait: "",
      ...(row.prerequisites || {}),
    },
    tags: Array.from(tags).filter(Boolean),
    specialLines: row.specialLines || damageData.specialLines,
    flags: {
      aoe: false,
      antiFriendlyFire: false,
      mobility: false,
      decapitation: false,
      charge: 0,
      deflect: false,
      ...(row.flags || {}),
      ...damageData.flags,
    },
    automation: {
      requiresBreath: true,
      area: "single",
      alternativeMode: "",
      lineOnly: false,
      ranged: false,
      unlimitedRange: false,
      chargeTurns: 0,
      cooldownTurns: 0,
      cannotBeDodged: false,
      cannotBeReactedTo: false,
      deflect: false,
      negateIncomingDamage: false,
      afflictionStacks: 0,
      enduranceRestore: "none",
      ...(row.automation || {}),
      ...damageData.automation,
    },
  };
}

function currentCombatRound() {
  return Number(game.combat?.round ?? 0) || 0;
}

export async function getTechniqueChargeState(actor) {
  return actor?.getFlag(SYSTEM_ID, "techniqueCharge") || null;
}

export async function clearTechniqueCharge(actor) {
  if (!actor) return;
  await actor.unsetFlag(SYSTEM_ID, "techniqueCharge").catch(() => {});
}

export async function startTechniqueCharge(actor, item, turns = 1) {
  if (!actor || !item || !game.combat) return null;
  const state = {
    itemId: item.id,
    itemName: item.name,
    readyRound: currentCombatRound() + Math.max(1, toNumber(turns, 1)),
  };
  await actor.setFlag(SYSTEM_ID, "techniqueCharge", state);
  return state;
}

export function isTechniqueChargeReady(state) {
  if (!state) return false;
  return currentCombatRound() >= Number(state.readyRound || 0);
}

export function getTechniqueCooldowns(actor) {
  return actor?.getFlag(SYSTEM_ID, "techniqueCooldowns") || {};
}

export async function setTechniqueCooldown(actor, item, turns = 0) {
  if (!actor || !item || !game.combat || turns <= 0) return;
  const cooldowns = FU.duplicate(getTechniqueCooldowns(actor));
  cooldowns[item.id] = currentCombatRound() + Math.max(1, toNumber(turns, 1)) + 1;
  await actor.setFlag(SYSTEM_ID, "techniqueCooldowns", cooldowns);
}

export function getTechniqueCooldown(actor, item) {
  const cooldowns = getTechniqueCooldowns(actor);
  return Number(cooldowns?.[item?.id] || 0) || 0;
}

export async function noteActorDamageTaken(actor, amount) {
  if (!actor || amount <= 0) return;
  const flag = FU.duplicate(actor.getFlag(SYSTEM_ID, "damageTakenByRound") || {});
  const round = currentCombatRound();
  if ((flag.round ?? round) !== round) {
    flag.previous = Number(flag.current || 0) || 0;
    flag.current = 0;
    flag.round = round;
  }
  flag.current = Number(flag.current || 0) + Math.max(0, amount);
  await actor.setFlag(SYSTEM_ID, "damageTakenByRound", flag);
  await clearTechniqueCharge(actor);

  const currentHpForDeath = toNumber(actor.system?.resources?.hp?.value, 0);
  const deathState = String(actor.system?.death?.state || "alive");
  if (currentHpForDeath <= 0 && deathState !== "dead") {
    if (actor.system?.death?.standingDeath) {
      await actor.update({ "system.death.state": "critical" });
      await ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor }),
        content: `<strong>${actor.name} tombe a 0 PV, mais Mort debout empeche la mort immediate. Etat: critique.</strong>`,
      });
    } else {
      await actor.update({ "system.death.state": "dead" });
      await ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor }),
        content: `<strong>${actor.name} tombe a 0 PV. Selon la regle de mort, l'etat passe a Mort.</strong>`,
      });
    }
  }

  const damage = Math.max(0, toNumber(amount, 0));
  if (damage < 13 || !FU.hasProperty(actor, "system.resources.hp.max")) return;

  const nearDeath = damage >= 20;
  const severePath = "system.combat.injuries.severeWounds";
  const nearDeathPath = "system.combat.injuries.nearDeathWounds";
  const severe = toNumber(FU.getProperty(actor, severePath), 0);
  const nearDeathWounds = toNumber(FU.getProperty(actor, nearDeathPath), 0);
  const nextSevere = severe + (nearDeath ? 0 : 1);
  const nextNearDeath = nearDeathWounds + (nearDeath ? 1 : 0);
  const hpMax = toNumber(actor.system?.resources?.hp?.max, 1);
  const healableMax = calculateHealableMax(hpMax, nextSevere + nextNearDeath);
  const hpValue = toNumber(actor.system?.resources?.hp?.value, 0);

  await actor.update({
    [severePath]: nextSevere,
    [nearDeathPath]: nextNearDeath,
    "system.resources.hp.healableMax": healableMax,
    "system.resources.hp.value": Math.min(hpValue, healableMax),
  });

  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: nearDeath
      ? `<strong>${actor.name} subit une blessure quasi mortelle. Cap de soin: ${healableMax} PV.</strong>`
      : `<strong>${actor.name} subit une blessure grave. Cap de soin: ${healableMax} PV.</strong>`,
  });
}

export function getPreviousRoundDamageTaken(actor) {
  const flag = actor?.getFlag(SYSTEM_ID, "damageTakenByRound") || {};
  const currentRound = Number(game.combat?.round ?? 0) || 0;
  if ((flag.round ?? currentRound) < currentRound) {
    return Number(flag.current || 0) || 0;
  }
  return Number(flag.previous || 0) || 0;
}
