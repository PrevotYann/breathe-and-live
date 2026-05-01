import { SYSTEM_ID } from "../config/rule-data.mjs";
import { normalizeDerivedStatKey, toNumber as formulaToNumber } from "./actor-derived-formulas.mjs";

function toNumber(value, fallback = 0) {
  return formulaToNumber(value, fallback);
}

function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function getSystem(source) {
  return source?.system ?? source ?? {};
}

function getConditionState(source, key) {
  return getSystem(source)?.conditions?.[key] ?? {};
}

export function isConditionActive(source, key) {
  return !!getConditionState(source, key)?.active;
}

export function conditionIntensity(source, key, fallback = 1) {
  const state = getConditionState(source, key);
  return Math.max(1, toNumber(state?.intensity, fallback));
}

function freezeBlocksMovement(source) {
  const state = getConditionState(source, "freeze");
  if (!state?.active) return false;
  const notes = normalizeText(state.notes);
  return /\b(corps|body|jambe|jambes|leg|legs|pied|pieds|deplacement|mouvement)\b/.test(notes);
}

export function getConditionDerivedPenalties(source) {
  const penalties = {};
  if (isConditionActive(source, "paresthesia")) {
    penalties.precision = conditionIntensity(source, "paresthesia");
  }
  return penalties;
}

export function getConditionAutomationSummary(source) {
  const actorFlags =
    typeof source?.getFlag === "function" ? source.getFlag(SYSTEM_ID, "conditionTurns") ?? {} : {};
  const movementBlocked =
    isConditionActive(source, "imprisoned") ||
    isConditionActive(source, "paralyzed") ||
    freezeBlocksMovement(source);
  const rpBlocked = isConditionActive(source, "offBalance");
  const controlled = isConditionActive(source, "controlled");
  const fury = isConditionActive(source, "fury");
  const slowed = isConditionActive(source, "slowed");
  const slowedCanAct = !slowed || actorFlags?.slowedCanAct !== false;
  const sensoryFailures = [];

  if (isConditionActive(source, "blinded")) sensoryFailures.push("vue");
  if (isConditionActive(source, "deafened")) sensoryFailures.push("ouie");
  if (isConditionActive(source, "anosmia")) sensoryFailures.push("odorat");
  if (isConditionActive(source, "ageusia")) sensoryFailures.push("gout");
  if (isConditionActive(source, "paresthesia")) sensoryFailures.push("toucher");

  return {
    movementBlocked,
    rpBlocked,
    controlled,
    fury,
    slowed,
    slowedCanAct,
    sensoryFailures,
    freezeBlocksMovement: freezeBlocksMovement(source),
  };
}

export function getConditionActionRestriction(actor, kind = "action") {
  const summary = getConditionAutomationSummary(actor);
  const actionKinds = new Set(["action", "basicAttack", "technique", "wait"]);
  const movementKinds = new Set(["movement", "sprint"]);

  if (kind === "rp" && summary.rpBlocked) {
    return {
      blocked: true,
      reason: "Desequilibre : les points de reaction sont indisponibles jusqu'a la fin du tour.",
    };
  }

  if (movementKinds.has(kind) && summary.movementBlocked) {
    return {
      blocked: true,
      reason: "Deplacement impossible avec l'etat actuel (emprisonne, paralyse ou membre gele bloquant).",
    };
  }

  if (actionKinds.has(kind) && summary.controlled) {
    return {
      blocked: true,
      reason: "Controle : le corps est sous contrainte externe.",
    };
  }

  if (kind === "technique" && summary.fury) {
    return {
      blocked: true,
      reason: "Fureur : seules les attaques de base contre une cible a portee sont autorisees.",
    };
  }

  if (actionKinds.has(kind) && summary.slowed && !summary.slowedCanAct) {
    return {
      blocked: true,
      reason: "Ralenti : cet acteur ne peut agir qu'un tour sur deux.",
    };
  }

  return { blocked: false, reason: "" };
}

export function conditionAutoFailDerived(source, derivedKey, label = "") {
  const key = normalizeDerivedStatKey(derivedKey);
  const text = normalizeText(`${label} ${key}`);
  const failures = [];

  if (isConditionActive(source, "blinded") && (text.includes("vue") || key === "perception")) {
    failures.push("Aveugle");
  }
  if (isConditionActive(source, "deafened") && (text.includes("ouie") || text.includes("son") || key === "perception")) {
    failures.push("Assourdi");
  }
  if (isConditionActive(source, "anosmia") && (text.includes("odorat") || text.includes("odeur") || key === "perception")) {
    failures.push("Anosmie");
  }
  if (isConditionActive(source, "ageusia") && (text.includes("gout") || key === "perception")) {
    failures.push("Ageusie");
  }
  if (isConditionActive(source, "paresthesia") && text.includes("toucher")) {
    failures.push("Paresthesie");
  }

  return failures;
}

export function buildConditionAutomationNotes(source) {
  const summary = getConditionAutomationSummary(source);
  const notes = [];
  if (summary.movementBlocked) notes.push("Deplacement bloque");
  if (summary.rpBlocked) notes.push("RP indisponibles");
  if (summary.controlled) notes.push("Actions controlees");
  if (summary.fury) notes.push("Attaque de base forcee");
  if (summary.slowed) notes.push(summary.slowedCanAct ? "Ralenti : peut agir ce tour" : "Ralenti : tour sans action");
  if (summary.sensoryFailures.length) notes.push(`Echecs sensoriels: ${summary.sensoryFailures.join(", ")}`);
  return notes;
}
