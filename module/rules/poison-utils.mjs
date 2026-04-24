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

function isDemonActorType(type) {
  return ["demon", "npcDemon"].includes(String(type || ""));
}

function isMoonRank(rank) {
  return /lune/i.test(String(rank || ""));
}

export function getPoisonProfileLabel(profile) {
  return POISON_PROFILE_LABELS[String(profile || "generic")] || "Generique";
}

export function getPoisonApplicationLabel(application) {
  return POISON_APPLICATION_LABELS[String(application || "action")] || "Action - enduire une arme";
}

export function getEffectiveBaseStats(actor) {
  return actor?.system?.stats?.effectiveBase || actor?.system?.stats?.base || {};
}

export function ensurePoisonStateDefaults(state = {}) {
  return {
    active: false,
    intensity: 0,
    duration: 0,
    notes: "",
    profile: "generic",
    damageFormula: "",
    demonOnly: false,
    ignoreMoonDemons: false,
    ...state,
  };
}

export function resolvePoisonRuntime(state = {}, actor = null) {
  const poison = ensurePoisonStateDefaults(state);
  const intensity = Math.max(0, toNumber(poison.intensity, 0));
  const actorType = String(actor?.type || "");
  const demonLike = isDemonActorType(actorType);
  const moonImmune = !!poison.ignoreMoonDemons && isMoonRank(actor?.system?.class?.rank);
  const blockedByTargetType = !!poison.demonOnly && !demonLike;
  const active = !!poison.active && intensity > 0 && !moonImmune && !blockedByTargetType;

  const runtime = {
    active,
    intensity,
    profile: String(poison.profile || "generic"),
    blockedByTargetType,
    moonImmune,
    statPenalty: blankPenaltyMap(),
    turnDamage: { kind: "none", value: 0, formula: "" },
  };

  if (!active) return runtime;

  switch (runtime.profile) {
    case "weakening":
      for (const key of BASE_STAT_KEYS) runtime.statPenalty[key] = intensity;
      break;
    case "harmful":
      runtime.turnDamage = { kind: "formula", value: intensity, formula: `${intensity}d10` };
      break;
    case "glycineWeakening":
      runtime.statPenalty.force = intensity;
      runtime.statPenalty.finesse = intensity;
      break;
    case "glycineDamaging":
      runtime.turnDamage = { kind: "percentMax", value: 0.1 * intensity, formula: "" };
      break;
    case "generic":
    default:
      runtime.turnDamage = { kind: "flat", value: intensity, formula: "" };
      break;
  }

  if (poison.damageFormula) {
    runtime.turnDamage = {
      kind: "formula",
      value: intensity,
      formula: String(poison.damageFormula),
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
  const nextIntensity = Math.max(1, toNumber(current.intensity, 0) + addedStacks);

  return {
    active: true,
    intensity: nextIntensity,
    duration: Math.max(0, toNumber(patch.duration, current.duration)),
    notes: patch.notes ?? current.notes ?? "",
    profile: patch.profile || current.profile || "generic",
    damageFormula: patch.damageFormula ?? current.damageFormula ?? "",
    demonOnly:
      patch.demonOnly !== undefined ? !!patch.demonOnly : !!current.demonOnly,
    ignoreMoonDemons:
      patch.ignoreMoonDemons !== undefined
        ? !!patch.ignoreMoonDemons
        : !!current.ignoreMoonDemons,
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
      demonOnly: !!item.system?.demonOnly,
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
