const BASE_STAT_KEYS = ["force", "finesse", "courage", "vitesse", "social", "intellect"];

export const POISON_PROFILE_OPTIONS = [
  { value: "generic", label: "Generique" },
  { value: "weakening", label: "Affaiblissant" },
  { value: "harmful", label: "Nuisible" },
  { value: "glycineWeakening", label: "Glycine affaiblissante" },
  { value: "glycineDamaging", label: "Glycine endommageante" },
];

export const POISON_APPLICATION_OPTIONS = [
  { value: "action", label: "Action - enduire une arme" },
  { value: "reaction", label: "Reaction" },
  { value: "ingestion", label: "Ingestion" },
  { value: "inhalation", label: "Inhalation" },
  { value: "contact", label: "Contact" },
];

const POISON_PROFILE_LABELS = Object.fromEntries(
  POISON_PROFILE_OPTIONS.map((entry) => [entry.value, entry.label])
);
const POISON_APPLICATION_LABELS = Object.fromEntries(
  POISON_APPLICATION_OPTIONS.map((entry) => [entry.value, entry.label])
);

function toNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function blankPenaltyMap() {
  return Object.fromEntries(BASE_STAT_KEYS.map((key) => [key, 0]));
}

function blankPoisonStacks() {
  return Object.fromEntries(POISON_PROFILE_OPTIONS.map((entry) => [entry.value, 0]));
}

function normalizePoisonStacks(state = {}) {
  const stacks = blankPoisonStacks();
  const sourceStacks = state.stacks && typeof state.stacks === "object" ? state.stacks : {};
  for (const key of Object.keys(stacks)) {
    stacks[key] = Math.max(0, toNumber(sourceStacks[key], 0));
  }

  if (!Object.values(stacks).some((value) => value > 0)) {
    const legacyProfile = String(state.profile || "generic");
    if (Object.prototype.hasOwnProperty.call(stacks, legacyProfile)) {
      stacks[legacyProfile] = Math.max(0, toNumber(state.intensity, 0));
    }
  }

  return stacks;
}

function sumPoisonStacks(stacks = {}) {
  return Object.values(stacks).reduce((sum, value) => sum + Math.max(0, toNumber(value, 0)), 0);
}

function activePoisonProfiles(stacks = {}) {
  return Object.entries(stacks)
    .filter(([, value]) => Math.max(0, toNumber(value, 0)) > 0)
    .map(([key]) => key);
}

function isDemonActorType(type) {
  return ["demon", "npcDemon"].includes(String(type || ""));
}

function isMoonRank(rank) {
  return /lune/i.test(String(rank || ""));
}

export function getPoisonProfileLabel(profile) {
  if (String(profile || "") === "mixed") return "Poison mixte";
  return POISON_PROFILE_LABELS[String(profile || "generic")] || "Generique";
}

export function getPoisonApplicationLabel(application) {
  return POISON_APPLICATION_LABELS[String(application || "action")] || "Action - enduire une arme";
}

export function getEffectiveBaseStats(actor) {
  return actor?.system?.stats?.effectiveBase || actor?.system?.stats?.base || {};
}

export function ensurePoisonStateDefaults(state = {}) {
  const stacks = normalizePoisonStacks(state);
  return {
    active: false,
    intensity: sumPoisonStacks(stacks),
    duration: 0,
    notes: "",
    profile: "generic",
    stacks,
    damageFormula: "",
    demonOnly: false,
    ignoreMoonDemons: false,
    ...state,
    intensity: sumPoisonStacks(stacks),
    stacks,
  };
}

export function resolvePoisonRuntime(state = {}, actor = null) {
  const poison = ensurePoisonStateDefaults(state);
  const stacks = normalizePoisonStacks(poison);
  const intensity = sumPoisonStacks(stacks);
  const profiles = activePoisonProfiles(stacks);
  const actorType = String(actor?.type || "");
  const demonLike = isDemonActorType(actorType);
  const moonImmune = !!poison.ignoreMoonDemons && isMoonRank(actor?.system?.class?.rank);
  const glycineOnly = profiles.length > 0 && profiles.every((profile) => profile.startsWith("glycine"));
  const blockedByTargetType = (!!poison.demonOnly || glycineOnly) && !demonLike;
  const active = !!poison.active && intensity > 0 && !moonImmune && !blockedByTargetType;

  const runtime = {
    active,
    intensity,
    stacks,
    profiles,
    profile: profiles.length === 1 ? profiles[0] : profiles.length > 1 ? "mixed" : String(poison.profile || "generic"),
    blockedByTargetType,
    moonImmune,
    statPenalty: blankPenaltyMap(),
    turnDamage: { kind: "none", value: 0, formula: "", parts: [] },
  };

  if (!active) return runtime;

  const damageParts = [];
  const generic = Math.max(0, toNumber(stacks.generic, 0));
  const weakening = Math.max(0, toNumber(stacks.weakening, 0));
  const harmful = Math.max(0, toNumber(stacks.harmful, 0));
  const glycineWeakening = Math.max(0, toNumber(stacks.glycineWeakening, 0));
  const glycineDamaging = Math.max(0, toNumber(stacks.glycineDamaging, 0));

  if (generic) damageParts.push({ kind: "flat", value: generic, formula: "", label: "Generique" });
  if (weakening) {
    for (const key of BASE_STAT_KEYS) runtime.statPenalty[key] += weakening;
  }
  if (harmful) {
    damageParts.push({ kind: "formula", value: harmful, formula: `${harmful}d10`, label: "Nuisible" });
  }
  if (glycineWeakening) {
    runtime.statPenalty.force += glycineWeakening;
    runtime.statPenalty.finesse += glycineWeakening;
  }
  if (glycineDamaging) {
    damageParts.push({
      kind: "percentMax",
      value: 0.1 * glycineDamaging,
      formula: "",
      label: "Glycine endommageante",
    });
  }

  if (poison.damageFormula) {
    damageParts.push({
      kind: "formula",
      value: intensity,
      formula: String(poison.damageFormula),
      label: "Formule personnalisee",
    });
  }

  if (damageParts.length === 1) {
    runtime.turnDamage = { ...damageParts[0], parts: damageParts };
  } else if (damageParts.length > 1) {
    runtime.turnDamage = {
      kind: "mixed",
      value: 0,
      formula: damageParts.map((part) => part.formula || part.value).join(" + "),
      parts: damageParts,
    };
  }

  return runtime;
}

export function describePoisonState(state = {}, actor = null) {
  const poison = ensurePoisonStateDefaults(state);
  const runtime = resolvePoisonRuntime(poison, actor);
  const detailLines = [];
  let effectSummary = "Aucun effet actif.";
  let restrictionSummary = "";

  if (runtime.active) {
    const damageParts = runtime.turnDamage.parts || [];
    if (runtime.turnDamage.kind === "mixed" && damageParts.length) {
      effectSummary = damageParts
        .map((part) => {
          if (part.kind === "flat") return `${part.value} degat(s)`;
          if (part.kind === "formula") return `${part.formula} degats`;
          if (part.kind === "percentMax") return `${Math.round(toNumber(part.value, 0) * 100)}% PV max`;
          return "";
        })
        .filter(Boolean)
        .join(" + ");
      effectSummary = `${effectSummary} par tour.`;
    } else {
      switch (runtime.turnDamage.kind) {
        case "flat":
          effectSummary = `${Math.max(0, runtime.turnDamage.value)} degat(s) par tour.`;
          break;
        case "formula":
          effectSummary = `${runtime.turnDamage.formula} degats par tour.`;
          break;
        case "percentMax":
          effectSummary = `${Math.round(toNumber(runtime.turnDamage.value, 0) * 100)}% des PV max par tour.`;
          break;
        default:
          effectSummary = "Penalites actives sur les caracteristiques.";
          break;
      }
    }

    const penalties = Object.entries(runtime.statPenalty || {})
      .filter(([, value]) => toNumber(value, 0) > 0)
      .map(([key, value]) => `-${value} ${key}`);
    if (penalties.length) {
      detailLines.push(`Penalites: ${penalties.join(", ")}`);
      if (runtime.turnDamage.kind === "none") {
        effectSummary = penalties.join(", ");
      }
    }
  } else if (poison.active && poison.intensity > 0) {
    if (runtime.moonImmune) {
      restrictionSummary = "Sans effet sur les demons de rang Lune.";
    } else if (runtime.blockedByTargetType) {
      restrictionSummary = "Sans effet sur les cibles non demoniaques.";
    } else {
      restrictionSummary = "Condition posee mais actuellement inactive.";
    }
  }

  if (poison.notes) {
    detailLines.push(poison.notes);
  }
  const stackLines = Object.entries(runtime.stacks || {})
    .filter(([, value]) => toNumber(value, 0) > 0)
    .map(([key, value]) => `${getPoisonProfileLabel(key)} ${value}`);
  if (stackLines.length) {
    detailLines.unshift(`Accumulation: ${stackLines.join(", ")}`);
  }

  return {
    poison,
    runtime,
    profileLabel: getPoisonProfileLabel(poison.profile),
    applicationLabel: getPoisonApplicationLabel(poison.application),
    intensity: Math.max(0, toNumber(poison.intensity, 0)),
    duration: Math.max(0, toNumber(poison.duration, 0)),
    effectSummary,
    restrictionSummary,
    detailLines,
  };
}

export function buildPoisonApplicationUpdate(currentState = {}, patch = {}) {
  const current = ensurePoisonStateDefaults(currentState);
  const addedStacks = Math.max(1, toNumber(patch.addStacks, 1));
  const profile = patch.profile || current.profile || "generic";
  const stacks = normalizePoisonStacks(current);
  stacks[profile] = Math.max(0, toNumber(stacks[profile], 0)) + addedStacks;
  const nextIntensity = sumPoisonStacks(stacks);

  return {
    active: true,
    intensity: nextIntensity,
    duration: Math.max(toNumber(current.duration, 0), toNumber(patch.duration, current.duration)),
    notes: patch.notes ?? current.notes ?? "",
    profile,
    stacks,
    damageFormula: patch.damageFormula ?? current.damageFormula ?? "",
    demonOnly:
      patch.demonOnly !== undefined ? !!patch.demonOnly : !!current.demonOnly,
    ignoreMoonDemons:
      patch.ignoreMoonDemons !== undefined
        ? !!patch.ignoreMoonDemons
        : !!current.ignoreMoonDemons,
  };
}

export function reducePoisonStacks(state = {}, amount = 1) {
  const current = ensurePoisonStateDefaults(state);
  const stacks = normalizePoisonStacks(current);
  let remaining = Math.max(0, toNumber(amount, 0));
  const order = ["glycineDamaging", "harmful", "glycineWeakening", "weakening", "generic"];

  for (const profile of order) {
    if (remaining <= 0) break;
    const value = Math.max(0, toNumber(stacks[profile], 0));
    const removed = Math.min(value, remaining);
    stacks[profile] = value - removed;
    remaining -= removed;
  }

  const intensity = sumPoisonStacks(stacks);
  const profiles = activePoisonProfiles(stacks);
  return {
    ...current,
    active: intensity > 0,
    intensity,
    profile: profiles.length === 1 ? profiles[0] : profiles.length > 1 ? "mixed" : current.profile,
    stacks,
  };
}

export function inferPoisonApplication(item, targetActor = null) {
  const tags = new Set(item?.system?.tags || []);
  const breathKey = String(item?.system?.breathKey || item?.system?.breath || "").toLowerCase();
  const targetIsDemon = isDemonActorType(targetActor?.type);

  if (item?.type === "poison") {
    return {
      profile: String(item.system?.profile || "generic"),
      damageFormula: String(item.system?.damageFormula || ""),
      demonOnly: item.system?.demonOnly !== undefined ? !!item.system.demonOnly : true,
      ignoreMoonDemons: !!item.system?.ignoreMoonDemons,
    };
  }

  if (breathKey.includes("insect") || tags.has("poison")) {
    if (targetIsDemon) {
      return {
        profile: "glycineDamaging",
        damageFormula: "",
        demonOnly: false,
        ignoreMoonDemons: true,
      };
    }

    return {
      profile: "harmful",
      damageFormula: "",
      demonOnly: false,
      ignoreMoonDemons: false,
    };
  }

  return {
    profile: "generic",
    damageFormula: "",
    demonOnly: false,
    ignoreMoonDemons: false,
  };
}
