export const BASE_STAT_KEYS = [
  "force",
  "finesse",
  "courage",
  "vitesse",
  "social",
  "intellect",
];

export const DERIVED_STAT_KEYS = [
  "athletisme",
  "puissanceBrute",
  "dexterite",
  "equilibre",
  "precision",
  "mithridatisme",
  "endurance",
  "tolerance",
  "reflexes",
  "agilite",
  "rapidite",
  "ruse",
  "tromperie",
  "performance",
  "intimidation",
  "perception",
  "intuition",
  "medecine",
  "nature",
  "sciences",
  "enquete",
  "survie",
];

const DERIVED_STAT_ALIAS_BY_COMPACT = {
  athletisme: "athletisme",
  athleticisme: "athletisme",
  puissancebrute: "puissanceBrute",
  puissance: "puissanceBrute",
  dexterite: "dexterite",
  equilibre: "equilibre",
  precision: "precision",
  mithridatisme: "mithridatisme",
  endurance: "endurance",
  tolerance: "tolerance",
  reflexe: "reflexes",
  reflexes: "reflexes",
  agilite: "agilite",
  rapidite: "rapidite",
  ruse: "ruse",
  tromperie: "tromperie",
  manipulation: "tromperie",
  manipulationtromperie: "tromperie",
  performance: "performance",
  intimidation: "intimidation",
  perception: "perception",
  intuition: "intuition",
  medecine: "medecine",
  medicine: "medecine",
  nature: "nature",
  sciences: "sciences",
  enquete: "enquete",
  investigation: "enquete",
  survie: "survie",
};

const BASE_STAT_ALIAS_BY_COMPACT = {
  force: "force",
  finesse: "finesse",
  courage: "courage",
  vitesse: "vitesse",
  social: "social",
  intellect: "intellect",
  intelligence: "intellect",
};

export function toNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

export function normalizeStatPathKey(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

export function normalizeDerivedStatKey(value) {
  const raw = String(value || "");
  const compact = normalizeStatPathKey(raw);
  return DERIVED_STAT_ALIAS_BY_COMPACT[compact] || raw;
}

export function normalizeBaseStatKey(value) {
  const raw = String(value || "");
  const compact = normalizeStatPathKey(raw);
  return BASE_STAT_ALIAS_BY_COMPACT[compact] || raw;
}

export function normalizeDerivedStats(derived = {}) {
  const source = derived && typeof derived === "object" ? derived : {};
  const normalized = {};

  for (const [key, value] of Object.entries(source)) {
    const canonical = normalizeDerivedStatKey(key);
    const numericValue = toNumber(value, 0);
    if (Object.prototype.hasOwnProperty.call(normalized, canonical)) {
      normalized[canonical] = Math.max(toNumber(normalized[canonical], 0), numericValue);
    } else {
      normalized[canonical] = numericValue;
    }
  }

  for (const key of DERIVED_STAT_KEYS) {
    normalized[key] = toNumber(normalized[key], 0);
  }

  return normalized;
}

export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function calculateArmorClass(stats = {}) {
  return 10 + toNumber(stats.vitesse, 0);
}

export function calculateHumanEnduranceMax(stats = {}, bonus = 0) {
  return Math.max(0, 20 + toNumber(stats.courage, 0) + toNumber(bonus, 0));
}

export function calculateHumanReactionMax(stats = {}, bonus = 0) {
  return Math.max(
    0,
    5 + toNumber(stats.vitesse, 0) + toNumber(stats.intellect, 0) + toNumber(bonus, 0)
  );
}

export function calculateHumanActionCount(stats = {}) {
  return Math.max(1, 1 + Math.floor(toNumber(stats.vitesse, 0) / 10));
}

export function calculateDemonActionCount(stats = {}) {
  return Math.max(1, 1 + Math.floor(toNumber(stats.vitesse, 0) / 5));
}

export function calculateDemonReactionMax(stats = {}) {
  return Math.max(
    0,
    Math.floor((5 + toNumber(stats.vitesse, 0) + toNumber(stats.intellect, 0)) / 2)
  );
}

export function calculateDemonistBdpMax(stats = {}) {
  return Math.max(0, 10 + toNumber(stats.courage, 0));
}

export function calculateDemonBdpMax(stats = {}) {
  return Math.max(0, 10 * toNumber(stats.courage, 0));
}

export function calculateDemonisationMax(stats = {}) {
  return Math.max(0, 10 + toNumber(stats.courage, 0));
}

export function calculateDemonHpMax(baseHpChoice, stats = {}) {
  return Math.max(1, toNumber(baseHpChoice, 20)) + 5 * toNumber(stats.force, 0);
}

export function calculateHealableMax(hpMax, severeWounds = 0) {
  const severePenalty = Math.min(0.9, Math.max(0, toNumber(severeWounds, 0)) * 0.1);
  return Math.max(1, Math.floor(toNumber(hpMax, 20) * (1 - severePenalty)));
}
