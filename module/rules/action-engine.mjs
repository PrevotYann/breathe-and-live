import { cardFlags, registerCardType } from "../chat/persistent-cards.mjs";
import { isAutomationAuthority, isCombatTurnStart, combatActors, registerCombatAutomation } from "./automation-authority.mjs";
import {
  CONDITION_DEFINITIONS,
  DEMON_RANK_PACKAGES,
  DEMON_RANKS,
  LIMB_DEFINITIONS,
  SLAYER_RANKS,
  SYSTEM_ID,
} from "../config/rule-data.mjs";
import {
  buildFormulaWithActorStats,
  noteActorDamageTaken,
  getTechniqueChargeState,
  isTechniqueChargeReady,
  startTechniqueCharge,
  clearTechniqueCharge,
} from "./technique-utils.mjs";
import { applyEffectsList, consumeEffectsByOrigin } from "./effects-engine.mjs";
import { applyPreHit, applyOnHit, initializeCombatBreaths, getActiveBreaths } from "./breath-effects.mjs";
import { canHealActor, lockRedBladeHealing } from "./combat-state.mjs";
import { applyHpDamage, spendResourceCosts } from "./resource-costs.mjs";
import { refreshCombatActions, spendCombatAction } from "./combat-actions.mjs";
import { subclassAttackModifiers, onBasicAttackResolved, onSubclassWeaponHit, beginSubclassTurn, noteSubclassMovement } from "./subclass-passives.mjs";
import { sourceTrait, perceptionContext, reinforcedDamageReduction } from "./character-capabilities.mjs";
import { resolveSourceComboDamage } from "./source-technique-workflows.mjs";
import { getWeaponLoadout, loadedAmmunition } from "./weapon-loadout.mjs";
import { attachSourceReactions } from "./source-reactions.mjs";
import { promptRegenerationDuration, startRegeneration, tickRegeneration, restoreLimbs } from "./regeneration.mjs";
import {
  buildPoisonApplicationUpdate,
  describePoisonState,
  getEffectiveBaseStats,
  reducePoisonStacks,
  resolvePoisonRuntime,
} from "./poison-utils.mjs";
import {
  conditionAutoFailDerived,
  getConditionActionRestriction,
} from "./condition-utils.mjs";
import {
  clamp,
  normalizeBaseStatKey,
  normalizeDerivedStatKey,
  toNumber as formulaToNumber,
} from "./actor-derived-formulas.mjs";
import {
  buildReactionTargetRow,
  canInteractWithToken,
  consumeDeflectStance,
  resolveCanvasToken,
} from "../chat/reaction-card.mjs";

const FU = foundry.utils;
const METERS_PER_SQUARE = 1.5;

function toNumber(value, fallback = 0) {
  return formulaToNumber(value, fallback);
}

function getCondition(actor, key) {
  return FU.getProperty(actor, `system.conditions.${key}`) ?? {};
}

function actorSpeaker(actor) {
  return ChatMessage.getSpeaker({ actor });
}

function getRankTier(actor) {
  const rank = String(actor.system?.class?.rank ?? "");
  if (SLAYER_RANKS.includes(rank)) return SLAYER_RANKS.indexOf(rank) + 1;
  if (DEMON_RANKS.includes(rank)) return DEMON_RANKS.indexOf(rank) + 1;
  return Math.max(1, toNumber(actor.system?.class?.level, 1));
}

function distMetersChebyshev(aToken, bToken) {
  const gs = canvas?.grid?.size || 100;
  const dx = Math.abs((aToken?.center?.x ?? 0) - (bToken?.center?.x ?? 0)) / gs;
  const dy = Math.abs((aToken?.center?.y ?? 0) - (bToken?.center?.y ?? 0)) / gs;
  return Math.max(dx, dy) * METERS_PER_SQUARE;
}

function getPrimaryToken(actor) {
  return (
    actor?.getActiveTokens?.()[0] ||
    canvas?.tokens?.controlled?.find((t) => t.actor?.id === actor.id) ||
    canvas?.tokens?.placeables?.find((t) => t.actor?.id === actor.id) ||
    null
  );
}

async function pickTargetToken({ excludeTokenId = null } = {}) {
  const targets = Array.from(game.user.targets ?? []);
  if (targets.length === 1) return targets[0];

  const tokens = (canvas?.tokens?.placeables ?? []).filter(
    (token) => token.id !== excludeTokenId && !token.document.hidden
  );
  if (!tokens.length) {
    ui.notifications.warn("Aucune cible disponible.");
    return null;
  }

  const options = tokens
    .map((token) => `<option value="${token.id}">${token.name}</option>`)
    .join("");

  return new Promise((resolve) => {
    new Dialog(
      {
        title: "Choisir une cible",
        content: `
          <div class="form-group">
            <label>Cible</label>
            <select id="bl-action-target">${options}</select>
          </div>
        `,
        buttons: {
          ok: {
            label: "Valider",
            callback: (html) =>
              resolve(canvas.tokens.get(html.find("#bl-action-target").val())),
          },
          cancel: {
            label: "Annuler",
            callback: () => resolve(null),
          },
        },
        default: "ok",
      },
      { width: 360 }
    ).render(true);
  });
}

function replaceStats(expr, actor, fallback = "1") {
  let out = buildFormulaWithActorStats(String(expr || fallback), actor);
  out = out.replace(/max\(([^)]+)\)/gi, (_match, inner) => {
    const values = inner
      .split(",")
      .map((entry) => replaceStats(entry.trim(), actor, "0"))
      .map((entry) => toNumber(entry, 0));
    return String(Math.max(...values, 0));
  });
  return out;
}

function firstDieMatch(expr) {
  return String(expr || "").match(/(\d+)d(\d+)/i);
}

function increaseFirstDieCount(expr, extraDice = 0) {
  const extra = Math.max(0, toNumber(extraDice, 0));
  if (!extra) return String(expr || "");
  let replaced = false;
  const next = String(expr || "").replace(/(\d+)d(\d+)/i, (_match, count, faces) => {
    replaced = true;
    return `${Math.max(1, toNumber(count, 1)) + extra}d${toNumber(faces, 6)}`;
  });
  return replaced ? next : `${extra + 1}d6${expr ? ` + (${expr})` : ""}`;
}

function replaceFirstDie(expr, replacement) {
  if (!replacement) return String(expr || "");
  let replaced = false;
  const next = String(expr || "").replace(/(\d+)d(\d+)/i, () => {
    replaced = true;
    return replacement;
  });
  return replaced ? next : `${replacement}${expr ? ` + (${expr})` : ""}`;
}

function appendFlatModifier(expr, mod) {
  const value = toNumber(mod, 0);
  if (!value) return String(expr || "");
  return `(${expr}) ${value >= 0 ? "+" : "-"} ${Math.abs(value)}`;
}

function repeatedActionFlagPath(actor) {
  const combatId = game.combat?.id || "free";
  return `flags.${SYSTEM_ID}.repeatedAction.${combatId}`;
}

async function resetRepeatedAction(actor) {
  await actor.update({
    [repeatedActionFlagPath(actor)]: {
      stack: 0,
      lastRound: null,
      lastTurn: null,
    },
  });
}

async function getRepeatedActionBonus(actor) {
  const baseIncrement = Math.max(
    1,
    toNumber(actor.system?.progression?.bonuses?.repeatedAction, 0)
  );
  const combatId = game.combat?.id || "free";
  const round = game.combat?.round ?? 0;
  const turn = game.combat?.turn ?? 0;
  const current =
    FU.getProperty(actor, repeatedActionFlagPath(actor)) ?? {
      stack: 0,
      lastRound: null,
      lastTurn: null,
    };

  const isConsecutiveCombatUse =
    game.combat &&
    current?.lastRound !== null &&
    current?.lastTurn !== null &&
    current.lastRound === round - 1;

  const nextStack = game.combat && current.lastRound === round ? Math.max(baseIncrement, toNumber(current.stack, 0)) : isConsecutiveCombatUse
    ? Math.max(0, toNumber(current.stack, 0)) + baseIncrement
    : baseIncrement;

  await actor.update({
    [repeatedActionFlagPath(actor)]: {
      stack: nextStack,
      lastRound: round,
      lastTurn: turn,
      combatId,
    },
  });

  return nextStack;
}

const DEMON_FLESH_BDP = {
  "Rang faible": "1d4 + 1",
  "Rang eleve": "2d4 + 2",
  "Disciple de Lune inferieure": "1d10 + 3",
  "Lune inferieure": "2d6 + 4",
  "Disciple de Lune superieure": "3d6 + 5",
  "Lune superieure": "1d20 + 8",
};

const DEMON_HEALING_BY_RANK = {
  "Demon faible": "1d10",
  "Demon eleve": "2d10",
  "Disciple de Lune inferieure": "1d20",
  "Lune inferieure": "1d20",
  "Disciple de Lune superieure": "1d100",
  "Lune superieure": "1d100",
};

const DEMONIST_FLESH_TO_DEMON_RANK = {
  "Rang faible": "Demon faible",
  "Rang eleve": "Demon eleve",
  "Disciple de Lune inferieure": "Disciple de Lune inferieure",
  "Lune inferieure": "Lune inferieure",
  "Disciple de Lune superieure": "Disciple de Lune superieure",
  "Lune superieure": "Lune superieure",
};

const DEMONIST_POWER_DEMONISATION = [
  {
    pattern: /(force|puissance)\s+demoniaque/i,
    gain: 1,
  },
  {
    pattern: /vitesse\s+demoniaque/i,
    gain: 1,
  },
  {
    pattern: /(soin|guerison)\s+demoniaque|regeneration\s+par\s+chair/i,
    gain: 2,
  },
  {
    pattern: /regeneration\s+de\s+membre|repousse/i,
    gain: 2,
  },
  {
    pattern: /art\s+de\s+sang\s+demoniaque\s*-\s*petit|bda\s*-\s*petit/i,
    gain: 3,
  },
  {
    pattern: /art\s+de\s+sang\s+demoniaque\s*-\s*grand|bda\s*-\s*grand/i,
    gain: 4,
  },
  {
    pattern: /stockage\s+d.?art\s+demoniaque/i,
    gain: 5,
  },
];

function normalizeDamageExpr(expr, fallback = "1") {
  const text = String(expr || "").trim();
  if (!text) return fallback;
  const compact = text.replace(/\s+/g, "");
  if (/^\d+$/.test(compact)) return compact;
  const rangeMatch = compact.match(/^(\d+)-(\d+)$/);
  if (rangeMatch) {
    const low = toNumber(rangeMatch[1], 1);
    const high = toNumber(rangeMatch[2], low);
    if (high <= low) return String(low);
    return `1d${high - low + 1} + ${low - 1}`;
  }
  return text;
}

export async function spendRp(actor, cost, reason = "") {
  const restriction = getConditionActionRestriction(actor, "rp");
  if (restriction.blocked) {
    ui.notifications.warn(`${actor.name} ne peut pas depenser de RP. ${restriction.reason}`);
    return false;
  }
  const path = "system.resources.rp.value";
  const current = toNumber(FU.getProperty(actor, path), 0);
  if (current < cost) {
    ui.notifications.warn(
      `${actor.name} n'a pas assez de RP (${cost} requis, ${current} disponibles).`
    );
    return false;
  }
  if (!(await spendResourceCosts(actor, [{ path, cost, label: "RP" }]))) return false;
  if (reason) {
    await ChatMessage.create({
      speaker: actorSpeaker(actor),
      content: `<em>${actor.name} depense ${cost} RP pour ${reason}.</em>`,
    });
  }
  return true;
}

async function spendBdp(actor, cost, reason = "") {
  const path = "system.resources.bdp.value";
  const current = toNumber(FU.getProperty(actor, path), 0);
  if (current < cost) {
    ui.notifications.warn(
      `${actor.name} n'a pas assez de BDP (${cost} requis, ${current} disponibles).`
    );
    return false;
  }
  await actor.update({ [path]: current - cost });
  if (reason) {
    await ChatMessage.create({
      speaker: actorSpeaker(actor),
      content: `<em>${actor.name} depense ${cost} BDP pour ${reason}.</em>`,
    });
  }
  return true;
}

export async function rollBaseCheck(actor, statKey, label = "") {
  if (!actor || !statKey) return null;
  const key = normalizeBaseStatKey(statKey);
  const base = getEffectiveBaseStats(actor);
  const mod = toNumber(base[key], 0) - 1;
  const roll = await new Roll(`1d20 + ${mod}`).evaluate();
  await roll.toMessage({
    speaker: actorSpeaker(actor),
    flavor: label || `Test ${key}`,
  });
  return roll;
}

export async function rollDerivedCheck(actor, derivedKey, label = "") {
  if (!actor || !derivedKey) return null;
  const key = normalizeDerivedStatKey(derivedKey);
  const context = await perceptionContext(actor, key, label);
  if (!context) return null;
  label = context.label;
  const autoFailures = conditionAutoFailDerived(actor, key, label);
  if (autoFailures.length) {
    return ChatMessage.create({
      speaker: actorSpeaker(actor),
      content: `<em>${actor.name} echoue automatiquement le test ${label || key} (${autoFailures.join(", ")}).</em>`,
    });
  }
  const derived = actor.system?.stats?.effectiveDerived || actor.system?.stats?.derived || {};
  const mod = toNumber(derived[key], 0) + context.bonus;
  const roll = await new Roll(`1d20 + ${mod}`).evaluate();
  await roll.toMessage({
    speaker: actorSpeaker(actor),
    flavor: label || `Test ${key}`,
  });
  return roll;
}

function normalizeRuleText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function normalizeRollFormulaText(value, fallback = "0") {
  let formula = String(value || "")
    .replace(/\b(endurance|temporaire|temporary|ressource|resource|pv|hp|e)\b/gi, " ")
    .replace(/[,;]/g, " ")
    .trim();
  if (!formula) return fallback;
  if (/^[+-]/.test(formula)) formula = `0 ${formula}`;
  return formula;
}

function itemGrantsTemporaryEndurance(item) {
  const sys = item?.system || {};
  if (sys.temporaryEndurance || sys.enduranceTemporary) return true;
  const haystack = normalizeRuleText(
    [
      item?.name,
      sys.sourceSection,
      sys.resourceRestore,
      sys.moodBonus,
      sys.usageNote,
      ...(Array.isArray(sys.tags) ? sys.tags : []),
    ].join(" ")
  );
  return (
    haystack.includes("endurance temporaire") ||
    haystack.includes("temporary endurance") ||
    haystack.includes("temp endurance") ||
    haystack.includes("endurance temp")
  );
}

async function applyEnduranceGain(actor, item, { maximize = false } = {}) {
  if (!actor || !item || !item.system?.enduranceGain) return null;
  const temporary = itemGrantsTemporaryEndurance(item);
  const expr = normalizeRollFormulaText(replaceStats(item.system.enduranceGain, actor, "0"), "0");
  const roll = await new Roll(expr).evaluate();
  const amount = maximize
    ? maxFormulaTotal(expr)
    : Math.max(0, toNumber(roll.total, 0));
  if (amount <= 0) return { amount: 0, temporary };

  const eValue = toNumber(actor.system?.resources?.e?.value, 0);
  const eMax = toNumber(actor.system?.resources?.e?.max, eValue);
  const eTemporary = toNumber(actor.system?.resources?.e?.temporary, 0);
  const nextTemporary = temporary ? eTemporary + amount : eTemporary;
  const nextValue = clamp(eValue + amount, 0, eMax + nextTemporary);

  const update = { "system.resources.e.value": nextValue };
  if (temporary) update["system.resources.e.temporary"] = nextTemporary;
  await actor.update(update);

  await ChatMessage.create({
    speaker: actorSpeaker(actor),
    content: temporary
      ? `<em>${actor.name} consomme ${item.name} et gagne ${amount} E temporaire (${eValue} -> ${nextValue}).</em>`
      : `<em>${actor.name} consomme ${item.name} et recupere ${nextValue - eValue} E (${eValue} -> ${nextValue}).</em>`,
  });

  return { amount: nextValue - eValue, temporary };
}

function inferDemonistDemonisationGain(item) {
  if (!item) return 0;
  const explicit = toNumber(item.system?.demonisationGain, 0);
  if (explicit > 0) return explicit;

  const haystack = normalizeRuleText(
    [
      item.name,
      item.system?.sourceSection,
      item.system?.usageNote,
      ...(Array.isArray(item.system?.tags) ? item.system.tags : []),
    ].join(" ")
  );
  const inferred = DEMONIST_POWER_DEMONISATION.find((entry) =>
    entry.pattern.test(haystack)
  );
  return inferred?.gain || 0;
}

export async function applyDemonisationGain(actor, item, { reason = "" } = {}) {
  if (!actor || actor.type !== "demonist") return 0;
  const baseGain = inferDemonistDemonisationGain(item);
  if (baseGain <= 0) return 0;

  const gain = actor.system?.support?.activeDemonistMedicine
    ? baseGain / 2
    : baseGain;
  const current = toNumber(actor.system?.resources?.demonisation, 0);
  const max = toNumber(actor.system?.resources?.demonisationMax, 10);
  const next = Math.max(0, current + gain);
  await actor.update({ "system.resources.demonisation": next });

  const medicineLine = actor.system?.support?.activeDemonistMedicine
    ? " Medecine active: accumulation reduite de 50 %."
    : "";
  await ChatMessage.create({
    speaker: actorSpeaker(actor),
    content: `<em>${actor.name} gagne ${gain} point(s) de demonisation${reason ? ` (${reason})` : ""}.${medicineLine}</em>`,
  });
  if (next >= max) {
    await ChatMessage.create({
      speaker: actorSpeaker(actor),
      content: `<strong>${actor.name} atteint ou depasse son seuil de demonisation (${next}/${max}).</strong>`,
    });
  }
  return gain;
}

function maxFormulaTotal(formula) {
  let total = 0;
  let matched = false;
  const withoutDice = String(formula || "0").replace(/(\d*)d(\d+)/gi, (_match, count, faces) => {
    matched = true;
    total += Math.max(1, toNumber(count || 1, 1)) * Math.max(1, toNumber(faces, 1));
    return "0";
  });
  const flat = withoutDice
    .split(/(?=[+-])/)
    .map((part) => toNumber(part.replace(/\s+/g, ""), 0))
    .reduce((sum, value) => sum + value, 0);
  return Math.max(0, total + flat || (matched ? total : toNumber(formula, 0)));
}

async function promptDemonFleshRank(actor, title = "Rang de sang demon consomme") {
  const stored = String(actor.system?.support?.recentDemonFleshRank || "");
  const options = Object.keys(DEMON_HEALING_BY_RANK)
    .map(
      (rank) =>
        `<option value="${rank}" ${rank === stored ? "selected" : ""}>${rank}</option>`
    )
    .join("");
  return new Promise((resolve) => {
    new Dialog(
      {
        title,
        content: `
          <div class="form-group">
            <label>Rang recent</label>
            <select id="bl-demonist-rank">${options}</select>
          </div>
        `,
        buttons: {
          ok: {
            label: "Valider",
            callback: (html) => resolve(String(html.find("#bl-demonist-rank").val() || "")),
          },
          cancel: {
            label: "Annuler",
            callback: () => resolve(""),
          },
        },
        default: "ok",
      },
      { width: 420 }
    ).render(true);
  });
}

async function getRecentDemonistRank(actor) {
  const stored = String(actor.system?.support?.recentDemonFleshRank || "");
  if (DEMON_HEALING_BY_RANK[stored]) return stored;
  const selected = await promptDemonFleshRank(actor);
  if (selected) {
    await actor.update({ "system.support.recentDemonFleshRank": selected });
  }
  return selected;
}

export async function runDemonistHealingReaction(actor, { maximize = false } = {}) {
  if (!actor || actor.type !== "demonist") return null;
  if (!actor.system?.support?.demonistHealingReaction) {
    ui.notifications.warn("La reaction de soin demoniste n'est pas debloquee sur cette fiche.");
    return null;
  }
  const rank = actor.system?.support?.highestDemonFleshRank || await getRecentDemonistRank(actor);
  if (!rank) return null;

  const rpCost = maximize ? 2 : 1;
  const ok = await spendRp(actor, rpCost, maximize ? "reaction de soin demoniste maximale" : "reaction de soin demoniste");
  if (!ok) return null;

  const formula = DEMON_HEALING_BY_RANK[rank] || "1d10";
  const amount = maximize
    ? maxFormulaTotal(formula)
    : toNumber((await new Roll(formula).evaluate()).total, 0);
  const hpValue = toNumber(actor.system?.resources?.hp?.value, 0);
  const healableMax = toNumber(actor.system?.resources?.hp?.healableMax, actor.system?.resources?.hp?.max ?? hpValue);
  const healed = Math.max(0, Math.min(healableMax - hpValue, amount));
  const next = clamp(hpValue + healed, 0, healableMax);
  await actor.update({ "system.resources.hp.value": next });

  await ChatMessage.create({
    speaker: actorSpeaker(actor),
    content: `<em>${actor.name} utilise sa reaction de soin demoniste (${rank}) et recupere ${healed} PV (${hpValue} -> ${next}).</em>`,
  });
  return healed;
}

async function promptDemonistEnhancementMode() {
  return new Promise((resolve) => {
    new Dialog(
      {
        title: "Reaction d'amelioration demoniste",
        content: "<p>Choisis l'amelioration liee au demon recemment devore.</p>",
        buttons: {
          force: { label: "Force (1 RP)", callback: () => resolve("force") },
          vitesse: { label: "Vitesse (1 RP)", callback: () => resolve("vitesse") },
          both: { label: "Force + Vitesse (2 RP)", callback: () => resolve("both") },
          cancel: { label: "Annuler", callback: () => resolve("") },
        },
        default: "force",
      },
      { width: 440 }
    ).render(true);
  });
}

export async function runDemonistEnhancementReaction(actor) {
  if (!actor || actor.type !== "demonist") return null;
  const rank = await getRecentDemonistRank(actor);
  if (!rank) return null;
  const mode = await promptDemonistEnhancementMode();
  if (!mode) return null;

  const cost = mode === "both" ? 2 : 1;
  const ok = await spendRp(actor, cost, "reaction d'amelioration demoniste");
  if (!ok) return null;

  const benchmarkRank = DEMONIST_FLESH_TO_DEMON_RANK[rank] || rank;
  const benchmark = DEMON_RANK_PACKAGES[benchmarkRank]?.benchmark || {};
  const stats = mode === "both" ? ["force", "vitesse"] : [mode];
  const effects = [];
  for (const stat of stats) {
    const targetValue = toNumber(benchmark[stat], 0);
    const currentValue = toNumber(actor.system?.stats?.base?.[stat], 0);
    if (targetValue > currentValue) {
      effects.push({
        target: "self",
        path: `system.stats.base.${stat}`,
        mode: "set",
        value: targetValue,
        duration: "roundEnd",
        label: `Amelioration demoniste - ${stat}`,
      });
    }
  }

  // TODO-RULEBOOK-AMBIGUITY: the PDF states the enhancement reaction matches the
  // recently eaten demon, but does not specify duration. Round-end is reversible
  // and keeps the reaction tactical without permanently rewriting base stats.
  if (effects.length) {
    await applyEffectsList({ source: actor, target: actor, effects, origin: "Reaction demoniste" });
  }
  await ChatMessage.create({
    speaker: actorSpeaker(actor),
    content: `<em>${actor.name} utilise une amelioration demoniste (${rank}) : ${stats.join(" + ")}.</em>`,
  });
  return effects;
}

async function applyDirectDamage(actor, amount, flavor) {
  const hpValue = toNumber(actor.system?.resources?.hp?.value, 0);
  const { nextHp: newHp } = await applyHpDamage(actor, amount);
  await noteActorDamageTaken(actor, Math.max(0, amount));
  await ChatMessage.create({
    speaker: actorSpeaker(actor),
    content: `<em>${flavor} ${amount} degats (${hpValue} -> ${newHp} PV).</em>`,
  });
  return newHp;
}

function isDemonActor(actor) {
  const type = String(actor?.type ?? "");
  return ["demon", "npcDemon"].includes(type);
}

function getDemonPendingEffects(actor) {
  return FU.duplicate(actor?.getFlag(SYSTEM_ID, "pendingDemonEffects") || []);
}

async function setDemonPendingEffects(actor, effects) {
  await actor.setFlag(SYSTEM_ID, "pendingDemonEffects", effects);
}

export async function queueDemonPendingEffect(actor, effect) {
  const effects = getDemonPendingEffects(actor);
  effects.push({
    id: randomID(),
    dueRound: Number(game.combat?.round ?? 0) + Math.max(1, toNumber(effect?.delayedRounds, 1)),
    formula: String(effect?.formula || "0"),
    label: String(effect?.label || "Effet demoniaque"),
    sourceName: String(effect?.sourceName || "Demon"),
    afflictionCondition: String(effect?.afflictionCondition || ""),
    afflictionIntensity: Math.max(0, toNumber(effect?.afflictionIntensity, 0)),
    markAsh: !!effect?.markAsh,
  });
  await setDemonPendingEffects(actor, effects);
}

function normalizeActivePoison(state = {}) {
  return {
    active: false,
    itemId: "",
    itemName: "",
    weaponId: "",
    weaponName: "",
    potency: 1,
    profile: "generic",
    damageFormula: "",
    demonOnly: false,
    ignoreMoonDemons: false,
    application: "action",
    notes: "",
    appliedRound: 0,
    ...FU.duplicate(state || {}),
  };
}

export function getActivePoisonCoating(actor) {
  const coating = normalizeActivePoison(FU.getProperty(actor, "system.combat.activePoison"));
  return coating.active ? coating : null;
}

export async function clearActivePoisonCoating(actor) {
  if (!actor) return normalizeActivePoison();
  const cleared = normalizeActivePoison();
  await actor.update({ "system.combat.activePoison": cleared });
  return cleared;
}

function getPoisonDoseAvailability(item) {
  if (!item) return { available: 0, path: "", mode: "none", label: "dose" };
  const usesMax = toNumber(item.system?.uses?.max, 0);
  const usesValue = toNumber(item.system?.uses?.value, 0);
  if (usesMax > 0 || usesValue > 0) {
    return {
      available: usesValue,
      path: "system.uses.value",
      mode: "uses",
      label: "dose(s)",
    };
  }

  return {
    available: toNumber(item.system?.quantity, 0),
    path: "system.quantity",
    mode: "quantity",
    label: "unite(s)",
  };
}

function isPoisonCoatableWeapon(item) {
  if (!item) return false;
  return ["weapon", "firearm", "projectile"].includes(String(item.type || ""));
}

async function promptPoisonWeapon(actor) {
  const weapons = Array.from(actor?.items ?? []).filter((item) => isPoisonCoatableWeapon(item));
  if (!weapons.length) {
    ui.notifications.warn("Aucune arme valide a enduire de poison.");
    return null;
  }
  if (weapons.length === 1) return weapons[0];

  const options = weapons
    .map((item) => `<option value="${item.id}">${item.name}</option>`)
    .join("");

  return new Promise((resolve) => {
    new Dialog(
      {
        title: "Choisir une arme a enduire",
        content: `
          <div class="form-group">
            <label>Arme</label>
            <select id="bl-poison-weapon">${options}</select>
          </div>
        `,
        buttons: {
          ok: {
            label: "Enduire",
            callback: (html) => resolve(actor.items.get(String(html.find("#bl-poison-weapon").val() || ""))),
          },
          cancel: {
            label: "Annuler",
            callback: () => resolve(null),
          },
        },
        default: "ok",
      },
      { width: 420 }
    ).render(true);
  });
}

async function spendPoisonDose(item) {
  const availability = getPoisonDoseAvailability(item);
  if (availability.available <= 0 || !availability.path) {
    ui.notifications.warn(`${item?.name || "Ce poison"} n'a plus de doses disponibles.`);
    return false;
  }
  await item.update({ [availability.path]: Math.max(0, availability.available - 1) });
  return true;
}

function buildPoisonApplicationResult(targetActor, payload = {}) {
  const current = FU.getProperty(targetActor, "system.conditions.poisoned") || {};
  const next = buildPoisonApplicationUpdate(current, {
    addStacks: Math.max(1, toNumber(payload.potency ?? payload.addStacks, 1)),
    duration: payload.duration,
    notes: payload.notes,
    profile: payload.profile,
    damageFormula: payload.damageFormula,
    demonOnly: payload.demonOnly,
    ignoreMoonDemons: payload.ignoreMoonDemons,
    sourceRank: payload.sourceRank,
  });
  const runtime = resolvePoisonRuntime(next, targetActor);
  const blockedReason = runtime.moonImmune
    ? "moonImmune"
    : runtime.blockedByTargetType
      ? "blockedByTargetType"
      : "";

  return {
    next,
    runtime,
    blockedReason,
    summary: describePoisonState(next, targetActor),
  };
}

function buildPoisonChatLine(result) {
  if (!result?.summary) return "Effet de poison applique.";
  const summary = result.summary;
  const extra = [summary.effectSummary, summary.restrictionSummary]
    .filter(Boolean)
    .join(" ");
  return `${summary.profileLabel} ${summary.intensity > 0 ? `(niveau ${summary.intensity})` : ""}${extra ? ` - ${extra}` : ""}`.trim();
}

async function createPoisonStatusChat(actor, summary, intro) {
  if (!actor || !summary) return null;
  const details = summary.detailLines?.length
    ? `<div><small>${summary.detailLines.join(" | ")}</small></div>`
    : "";
  const purifyButton = isDemonActor(actor) && summary.runtime?.active
    ? `<button type="button" class="bl-poison-purify" data-actor-id="${actor.id}">Purification</button>`
    : "";

  const message = await ChatMessage.create({
    flags: cardFlags("purify", { actorUuid: actor.uuid, field: "content" }),
    speaker: actorSpeaker(actor),
    content: `
      <div class="bl-card" style="display:grid; gap:.35rem;">
        <div><strong>${actor.name}</strong> - ${intro}</div>
        <div><small>${summary.profileLabel} | Intensite ${summary.intensity}${summary.duration ? ` | Duree ${summary.duration}` : ""}</small></div>
        <div>${summary.effectSummary}${summary.restrictionSummary ? ` <small>${summary.restrictionSummary}</small>` : ""}</div>
        ${details}
        ${purifyButton}
      </div>
    `,
  });



  return message;
}

export async function applyPoisonDoseToTarget(
  sourceActor,
  targetActor,
  payload = {},
  { sourceLabel = "Poison" } = {}
) {
  if (!targetActor) return null;
  const result = buildPoisonApplicationResult(targetActor, payload);

  if (!result.blockedReason) {
    await targetActor.update({ "system.conditions.poisoned": result.next });
  }

  const blockedText =
    result.blockedReason === "moonImmune"
      ? "Le poison n'affecte pas les demons de rang Lune."
      : result.blockedReason === "blockedByTargetType"
        ? "Le poison n'affecte pas cette cible."
        : "";

  await ChatMessage.create({
    speaker: actorSpeaker(sourceActor || targetActor),
    content: `<em>${sourceLabel} sur ${targetActor.name} : ${blockedText || buildPoisonChatLine(result)}.</em>`,
  });

  return {
    ...result,
    applied: !result.blockedReason,
  };
}

export async function coatWeaponWithPoison(actor, poisonItem) {
  if (!actor || !poisonItem || poisonItem.type !== "poison") return null;

  const weapon = await promptPoisonWeapon(actor);
  if (!weapon) return null;

  const spent = await spendPoisonDose(poisonItem);
  if (!spent) return null;

  const previous = getActivePoisonCoating(actor);
  const coating = normalizeActivePoison({
    active: true,
    itemId: poisonItem.id,
    itemName: poisonItem.name,
    weaponId: weapon.id,
    weaponName: weapon.name,
    potency: Math.max(1, toNumber(poisonItem.system?.potency, 1)),
    profile: String(poisonItem.system?.profile || "generic"),
    damageFormula: String(poisonItem.system?.damageFormula || ""),
    sourceRank: poisonItem.system?.sourceRank ?? "",
    demonOnly: !!poisonItem.system?.demonOnly,
    ignoreMoonDemons: !!poisonItem.system?.ignoreMoonDemons,
    application: String(poisonItem.system?.application || "action"),
    notes: String(poisonItem.system?.usageNote || ""),
    appliedRound: Number(game.combat?.round ?? 0) || 0,
  });
  await actor.update({ "system.combat.activePoison": coating });

  const replacedText = previous?.active
    ? ` La dose precedente sur ${previous.weaponName || "une arme"} est remplacee.`
    : "";
  await ChatMessage.create({
    speaker: actorSpeaker(actor),
    content: `<em>${actor.name} enduit ${weapon.name} avec ${poisonItem.name}.${replacedText}</em>`,
  });
  return coating;
}

export async function applyActivePoisonCoating(
  attacker,
  targetActor,
  { weapon = null, sourceLabel = "Attaque", consume = true } = {}
) {
  const coating = getActivePoisonCoating(attacker);
  if (!coating || !targetActor) return null;
  if (weapon?.id && coating.weaponId && weapon.id !== coating.weaponId) return null;

  const result = await applyPoisonDoseToTarget(
    attacker,
    targetActor,
    {
      potency: coating.potency,
      profile: coating.profile,
      damageFormula: coating.damageFormula,
      sourceRank: coating.sourceRank,
      demonOnly: coating.demonOnly,
      ignoreMoonDemons: coating.ignoreMoonDemons,
      notes: coating.notes,
    },
    {
      sourceLabel: `${sourceLabel} - ${coating.itemName}`,
    }
  );

  if (consume) {
    await clearActivePoisonCoating(attacker);
  }

  return result;
}

async function applyConditionStacks(actor, key, stacks = 1) {
  if (!actor || !key) return null;
  const existing = FU.getProperty(actor, `system.conditions.${key}`) || {};
  const next = Math.max(1, toNumber(existing.intensity, 0) + Math.max(1, toNumber(stacks, 1)));
  await actor.update({
    [`system.conditions.${key}.active`]: true,
    [`system.conditions.${key}.intensity`]: next,
  });
  return next;
}

function demonAttackBonus(value) {
  return Math.floor(Math.max(0, toNumber(value, 0)) / 2);
}

function stripStatTermsFromDamageExpr(expr) {
  return String(expr || "1")
    .replace(
      /\b(force|finesse|courage|vitesse|social|intellect|athletisme|puissanceBrute|dexterite|equilibre|precision|mithridatisme|endurance|tolerance|reflexes|agilite|rapidite|ruse|tromperie|performance|intimidation|perception|intuition|medecine|nature|sciences|enquete|survie)\b/gi,
      "0"
    )
    .replace(/\+\s*0\b/g, "+ 0");
}

function weaponUsesAmmo(weapon) {
  return !!weapon && (!!weapon.system?.usesAmmo || weapon.type === "firearm" || weapon.system?.weaponFamily === "firearm");
}

function actorHasDisabledArms(actor) {
  const limbs = actor?.system?.combat?.injuries?.limbs || {};
  const disabled = (key) => !!limbs[key]?.severed || !!limbs[key]?.broken;
  return {
    left: disabled("leftArm"),
    right: disabled("rightArm"),
    both: disabled("leftArm") && disabled("rightArm"),
    any: disabled("leftArm") || disabled("rightArm"),
  };
}

async function spendWeaponAmmo(weapon) {
  if (!weaponUsesAmmo(weapon)) return true;
  const current = toNumber(weapon.system?.ammo?.value, 0);
  if (current <= 0) {
    ui.notifications.warn(`${weapon.name} n'a plus de munitions chargees.`);
    return false;
  }
  await weapon.update({ "system.ammo.value": Math.max(0, current - 1) });
  return true;
}

export async function runReloadWeapon(actor, weapon) {
  if (!actor || !weapon || !weaponUsesAmmo(weapon)) return null;
  const loadout = getWeaponLoadout(actor, weapon);
  if (!loadout.valid) { ui.notifications.warn(`Cette arme peut recevoir ${loadout.max} modification(s).`); return null; }
  const max = toNumber(weapon.system?.ammo?.max, 0) + loadout.capacityBonus;
  if (max <= 0) {
    ui.notifications.warn(`${weapon.name} n'a pas de charge max configuree.`);
    return null;
  }
  const current = toNumber(weapon.system?.ammo?.value, 0);
  if (current >= max) return 0;
  const reserve = actor.items.find(i => i.type === "ammunition" && i.id === weapon.system?.ammunitionId);
  const refill = reserve ? Math.min(max - current, Math.max(0, Number(reserve.system?.quantity) || 0)) : max - current;
  if (!refill) { ui.notifications.warn("La réserve de munitions est vide."); return null; }
  if (!(await spendCombatAction(actor))) return null;
  if (reserve) await reserve.update({ "system.quantity": reserve.system.quantity - refill });
  await weapon.update({ "system.ammo.value": current + refill, "system.loadedAmmoId": reserve?.id || "" });
  await ChatMessage.create({
    speaker: actorSpeaker(actor),
    content: `<em>${actor.name} recharge ${weapon.name} (${current} -> ${max}).</em>`,
  });
  return refill;
}

async function promptBasicAttackMode(actor, { force = 0, finesse = 0 } = {}) {
  const defaultMode = finesse > force ? "finesse" : "force";
  return new Promise((resolve) => {
    new Dialog(
      {
        title: "Attaque de base",
        content: `
          <p>Choisis le bonus utilise pour toucher. L'autre caracteristique sera ajoutee aux degats.</p>
          <div class="form-group">
            <label>Mode</label>
            <select id="bl-basic-attack-mode">
              <option value="force" ${defaultMode === "force" ? "selected" : ""}>Force au toucher, Finesse aux degats (${force}/${finesse})</option>
              <option value="finesse" ${defaultMode === "finesse" ? "selected" : ""}>Finesse au toucher, Force aux degats (${finesse}/${force})</option>
            </select>
          </div>
        `,
        buttons: {
          ok: {
            label: "Attaquer",
            callback: (html) => resolve(String(html.find("#bl-basic-attack-mode").val() || defaultMode)),
          },
          cancel: {
            label: "Annuler",
            callback: () => resolve(""),
          },
        },
        default: "ok",
      },
      { width: 460 }
    ).render(true);
  });
}

async function promptTargetLimb(targetActor) {
  if (!targetActor || !LIMB_DEFINITIONS.length) return null;
  const options = [
    `<option value="">Aucun ciblage particulier</option>`,
    ...LIMB_DEFINITIONS.map((entry) => `<option value="${entry.key}">${entry.label}</option>`),
  ].join("");
  return new Promise((resolve) => {
    new Dialog(
      {
        title: "Ciblage de membre",
        content: `
          <p>Choisis un membre vise pour suivre les degats de mutilation.</p>
          <div class="form-group">
            <label>Membre</label>
            <select id="bl-target-limb">${options}</select>
          </div>
        `,
        buttons: {
          ok: {
            label: "Continuer",
            callback: (html) => resolve(String(html.find("#bl-target-limb").val() || "")),
          },
          cancel: {
            label: "Annuler",
            callback: () => resolve(null),
          },
        },
        default: "ok",
      },
      { width: 420 }
    ).render(true);
  });
}

async function rollNoRpEvade(actor, attackTotal, attacker = null) {
  const base = getEffectiveBaseStats(actor);
  let mod = toNumber(base.finesse, 0) - 1;
  const breaths = getActiveBreaths(actor);
  const flower = actor.getFlag(SYSTEM_ID, "flowerFocus");
  if (breaths.flower?.enabled && breaths.flower.specials?.concentrationFlorissante && flower?.combatId === game.combat?.id && flower.targetId === attacker?.uuid) mod += toNumber(flower.stack, 0) * 2;
  if (breaths.insect?.enabled && breaths.insect.specials?.ecraserSousLePied && attacker?.system?.conditions?.poisoned?.active) mod *= 2;
  const roll = await new Roll(`1d20 + ${mod}`).evaluate();
  const total = toNumber(roll.total, 0);
  await roll.toMessage({
    speaker: actorSpeaker(actor),
    flavor: `Eviter sans RP contre ${attackTotal}`,
  });
  return { roll, total, success: total > toNumber(attackTotal, 0) };
}

export async function applyTargetedLimbDamage(actor, limbKey, damage) {
  if (!actor || !limbKey || damage <= 0) return null;
  const definition = LIMB_DEFINITIONS.find((entry) => entry.key === limbKey);
  if (!definition) return null;
  if (definition.category === "vital") {
    // TODO-RULEBOOK-AMBIGUITY: p.30 gives thresholds for limbs, not head/torso.
    await actor.update({ [`system.combat.injuries.limbs.${limbKey}.injured`]: true });
    await ChatMessage.create({ speaker: actorSpeaker(actor), content: `<em>${definition.label} ciblé : ${damage} dégâts. Décapitation et conséquences vitales à confirmer par le MJ ; aucun seuil chiffré fourni.</em>` });
    return { limbKey, damage, accumulated: damage, threshold: null, severed: false };
  }

  const hpMax = toNumber(actor.system?.resources?.hp?.max, 1);
  const thresholdRatio = toNumber(definition.thresholdRatio, 0.2);
  const threshold = Math.max(1, Math.ceil(hpMax * thresholdRatio));
  const demonTarget = isDemonActor(actor);
  const current = toNumber(FU.getProperty(actor, `system.combat.injuries.targetedDamage.${limbKey}`), 0);
  const accumulated = demonTarget ? damage : current + damage;
  const severed = accumulated >= threshold;
  const updates = {
    [`system.combat.injuries.targetedDamage.${limbKey}`]: demonTarget ? current : accumulated,
    [`system.combat.injuries.limbs.${limbKey}.injured`]: true,
  };
  if (severed) {
    updates[`system.combat.injuries.limbs.${limbKey}.severed`] = true;
    const consequence = [];
    if (definition.category === "leg") consequence.push("deplacement /2 tant que la jambe est inutilisable");
    if (definition.noFlight) consequence.push("vol impossible");
    if (definition.movementFlatPenalty) consequence.push(`deplacement -${definition.movementFlatPenalty} m`);
    if (definition.movementPenaltyRatio) consequence.push(`deplacement -${Math.round(definition.movementPenaltyRatio * 100)}%`);
    updates[`system.combat.injuries.limbs.${limbKey}.notes`] = [
      demonTarget
      ? `Seuil atteint en une seule attaque (${damage}/${threshold}).`
      : `Seuil cumulatif atteint (${accumulated}/${threshold}).`,
      consequence.join(", "),
    ].filter(Boolean).join(" ");
  }

  await actor.update(updates);
  await ChatMessage.create({
    speaker: actorSpeaker(actor),
    content: severed
      ? `<strong>${definition.label} de ${actor.name}: seuil de mutilation atteint (${demonTarget ? damage : accumulated}/${threshold}).</strong>`
      : `<em>${definition.label} de ${actor.name}: ${demonTarget ? damage : accumulated}/${threshold} degats de ciblage.</em>`,
  });
  return { limbKey, damage, accumulated, threshold, severed };
}

async function applyBasicAttackDamage({
  attacker,
  targetToken,
  damageRoll,
  weapon = null,
  isFirearm = false,
  targetLimb = "",
}) {
  const targetActor = targetToken?.actor;
  if (!targetActor || !damageRoll) return null;

  const currentHp = toNumber(targetActor.system?.resources?.hp?.value, 0);
  const damage = Math.max(0, toNumber(damageRoll.total, 0) - reinforcedDamageReduction(targetActor, targetLimb));
  const nextHp = Math.max(0, currentHp - damage);

  const result = await applyHpDamage(targetActor, damage);
  await noteActorDamageTaken(targetActor, damage);
  await targetActor.setFlag(SYSTEM_ID, "lastIncomingAttack", {
    attackerUuid: attacker.uuid, damage, melee: !isFirearm && Number(weapon?.system?.range || 1.5) <= 1.5,
    combatId: game.combat?.id || "", round: game.combat?.round, turn: game.combat?.turn,
  });
  await applyTargetedLimbDamage(targetActor, targetLimb, damage);
  const reactivatePoison = await onSubclassWeaponHit(attacker, targetActor, damage);
  if (reactivatePoison && targetActor.system?.conditions?.poisoned?.active) {
    const poison = resolvePoisonRuntime(targetActor.system.conditions.poisoned, targetActor);
    if (poison.turnDamage?.kind === "flat") await applyDirectDamage(targetActor, poison.turnDamage.value, "Guêpe en essaim :");
    if (poison.turnDamage?.kind === "formula") await applyDirectDamage(targetActor, (await new Roll(poison.turnDamage.formula).evaluate()).total, "Guêpe en essaim :");
  }
  if (attacker.system?.states?.lameRouge && weapon?.system?.isNichirin && isDemonActor(targetActor)) {
    await lockRedBladeHealing(targetActor);
  }

  const targetHasBurningSkin = targetActor.items?.some(
    (item) =>
      item.type === "demonAbility" &&
      /peau brulante/i.test(String(item.name || ""))
  );
  const naturalMelee =
    !isFirearm &&
    (!weapon || ["natural", ""].includes(String(weapon.system?.weaponFamily || "")) || ["demonAbility"].includes(String(weapon.type || "")));
  if (targetHasBurningSkin && naturalMelee) {
    await applyConditionStacks(attacker, "burn", 1);
    await ChatMessage.create({
      speaker: actorSpeaker(targetActor),
      content: `<em>Peau brulante : ${attacker.name} subit Brulure au contact de ${targetActor.name}.</em>`,
    });
  }

  const poisonResult = await applyActivePoisonCoating(attacker, targetActor, {
    weapon,
    sourceLabel: weapon?.name || "Attaque de base",
  });
  await applyOnHit(attacker, targetToken, weapon ?? { system: {} },
    { decapitated: targetLimb === "head" && damage >= currentHp && !!weapon?.system?.isNichirin },
    { tookDamage: damage > 0, wasKilled: result.nextHp === 0 });

  return { currentHp, nextHp: result.nextHp, damage, poisonResult };
}

export async function setConditionState(actor, key, patch = {}) {
  const existing = getCondition(actor, key);
  const next = {
    active: false,
    intensity: 1,
    duration: 0,
    notes: "",
    ...existing,
    ...patch,
  };
  if (next.active && toNumber(next.intensity, 0) <= 0) next.intensity = 1;
  if (next.active && !existing.active && game.combat?.round > 0) {
    next.appliedBoundary = { combatId: game.combat.id, round: game.combat.round, turn: game.combat.turn };
  }
  if (next.active && !existing.active && key === "freeze" && !next.duration) {
    next.duration = Math.max(1, Number((await new Roll("1d4").evaluate()).total));
  }
  if (next.active && key === "offBalance" && !next.duration) next.expiry = "currentTurnEnd";
  if (!next.active) {
    next.duration = 0;
    next.intensity = 0;
    next.expiry = "";
    next.turnFormula = "";
    next.appliedBoundary = null;
    if (key === "poisoned") next.stacks = {};
  }
  await actor.update({ [`system.conditions.${key}`]: next });
  return next;
}

export async function setLimbState(actor, key, patch = {}) {
  const current =
    FU.getProperty(actor, `system.combat.injuries.limbs.${key}`) ?? {};
  const next = {
    injured: false,
    severed: false,
    broken: false,
    notes: "",
    ...current,
    ...patch,
  };
  await actor.update({ [`system.combat.injuries.limbs.${key}`]: next });
  return next;
}

async function rollAreaWeaponAttack(actor, weapon, attackerToken, target) {
  const cone = weapon.system?.area === "cone";
  const radius = Number(weapon.system?.radius) || 0;
  const targets = cone ? Array.from(game.user.targets ?? []).filter(t => t.actor && distMetersChebyshev(attackerToken, t) <= weapon.system.range) :
    (canvas.tokens.placeables ?? []).filter(t => t.actor && distMetersChebyshev(target, t) <= radius);
  if (!targets.length) { ui.notifications.warn("Sélectionnez les cibles du cône ou placez une cible au centre de l'explosion."); return null; }
  if (weapon.type === "explosive" && Number(weapon.system.quantity) <= 0) { ui.notifications.warn("Aucun explosif disponible."); return null; }
  if (weaponUsesAmmo(weapon) && Number(weapon.system.ammo?.value) <= 0) { ui.notifications.warn("Réservoir vide."); return null; }
  if (!(await spendCombatAction(actor))) return null;
  if (!(await spendWeaponAmmo(weapon))) return null;
  if (weapon.type === "explosive") await weapon.update({ "system.quantity": Math.max(0, Number(weapon.system.quantity) - 1) });
  const roll = await new Roll(weapon.system.damage || "0").evaluate();
  const rows = targets.map(targetToken => buildReactionTargetRow({ attackerToken, targetToken, damageTotal: roll.total })).join("");
  return roll.toMessage({ speaker: actorSpeaker(actor), flags: cardFlags("basicAttack", {
    actorUuid: actor.uuid, weaponUuid: weapon.uuid, sceneId: canvas.scene.id, damageTotal: roll.total,
    areaWeapon: true, isFirearm: cone, targetLimb: "",
  }), flavor: `<div class="bl-card"><strong>${actor.name} utilise ${weapon.name} : ${roll.total} dégâts de zone.</strong>${rows}</div>` });
}

export async function rollBasicAttack(
  actor,
  {
    item = null,
    targetToken = null,
    repeatedAction = false,
    attackMode: requestedAttackMode = "",
    forceAutoHit = false,
    reactionRpCost = 0,
    free = false,
    sourceOptions = {},
    targetLimb: requestedLimb = undefined,
  } = {}
) {
  if (!actor) return null;
  if (item?.system?.ruleSource?.missingFields?.length && !item.system.ruleSource.approved) {
    ui.notifications.warn(`${item.name} : compléter et valider les valeurs absentes du livre sur sa fiche.`); return null;
  }
  if (actor.getFlag(SYSTEM_ID, "mustRest")) { ui.notifications.warn("À 0 Endurance, utilisez le Souffle de récupération avant d'attaquer."); return null; }
  const actionRestriction = getConditionActionRestriction(actor, "basicAttack");
  if (actionRestriction.blocked) {
    ui.notifications.warn(`${actor.name} ne peut pas attaquer. ${actionRestriction.reason}`);
    return null;
  }

  const attackerToken = resolveCanvasToken(getPrimaryToken(actor), actor);
  const target = targetToken || (await pickTargetToken({ excludeTokenId: attackerToken?.id }));
  if (!target?.actor) return null;

  const weapon =
    item ??
    (repeatedAction
      ? actor.items.find((entry) => entry.type === "weapon")
      : actor.items.find((entry) => ["weapon", "firearm"].includes(entry.type)));
  const isFirearm = ["firearm"].includes(weapon?.type) || weapon?.system?.weaponFamily === "firearm";
  const progressionBonuses = actor.system?.progression?.bonuses ?? {};
  const loadout = getWeaponLoadout(actor, weapon);
  if (!loadout.valid) { ui.notifications.warn(`Cette arme peut recevoir ${loadout.max} modification(s).`); return null; }

  const range = (weapon?.system?.rangeFormula ? Number((await new Roll(replaceStats(weapon.system.rangeFormula, actor)).evaluate()).total) :
    toNumber(weapon?.system?.range, isFirearm ? 30 : 1.5)) * loadout.rangeMultiplier + toNumber(weapon?.system?.rangeBonus, 0);
  if (attackerToken && distMetersChebyshev(attackerToken, target) > range) {
    ui.notifications.warn(`La cible est hors portee (${range} m).`);
    return null;
  }
  if (weapon?.type === "explosive" || weapon?.system?.area === "cone") return rollAreaWeaponAttack(actor, weapon, attackerToken, target);
  if (weapon?.system?.chargeTurns) {
    if (!(game.combat?.round > 0)) { ui.notifications.warn("Cette arme exige un temps de charge : démarrez le combat."); return null; }
    const charge = await getTechniqueChargeState(actor);
    if (charge?.itemId !== weapon.id) {
      if (!(await spendCombatAction(actor))) return null;
      await startTechniqueCharge(actor, weapon, weapon.system.chargeTurns);
      await ChatMessage.create({ speaker: actorSpeaker(actor), content: `<em>${weapon.name} : charge commencée, attaque disponible au prochain tour du porteur.</em>` });
      return null;
    }
    if (!isTechniqueChargeReady(charge)) { ui.notifications.warn("L'arme n'a pas terminé sa charge."); return null; }
  }

  const base = getEffectiveBaseStats(actor);
  const derived = actor.system?.stats?.effectiveDerived ?? actor.system?.stats?.derived ?? {};
  const force = toNumber(base.force);
  const finesse = toNumber(base.finesse);
  const precision = toNumber(derived.precision) + loadout.precisionBonus;

  let attackBonus = 0;
  let damageBonus = 0;
  let attackMode = "force";
  let autoHit = false;
  const useHalfDemonBonus = !!actor.system?.demonology?.halfDamageStatRule && isDemonActor(actor);
  let repeatedActionDamage = 0;

  if (repeatedAction && actor.type !== "demonist") {
    ui.notifications.warn("L'action repetee est reservee aux demonistes.");
    return null;
  }
  if (repeatedAction && isFirearm) {
    ui.notifications.warn("L'action repetee s'applique aux attaques de melee.");
    return null;
  }

  const arms = actorHasDisabledArms(actor);
  const naturalWeapon = !weapon || ["natural", ""].includes(String(weapon.system?.weaponFamily || "")) || ["demonAbility"].includes(String(weapon.type || ""));
  if (arms.both && !naturalWeapon) {
    ui.notifications.warn(`${actor.name} ne peut pas manier cette arme: les deux bras sont inutilisables.`);
    return null;
  }

  const targetLimb = requestedLimb === undefined ? await promptTargetLimb(target.actor) : requestedLimb;
  if (targetLimb === null) return null;

  if (weapon?.type === "projectile") {
    attackBonus = toNumber(derived.dexterite, 0); damageBonus = precision; attackMode = "dexterite";
  } else if (isFirearm) {
    attackBonus = game.combat?.round > 0 ? (useHalfDemonBonus ? demonAttackBonus(finesse) : finesse - 1) : precision;
    damageBonus = precision;
    attackMode = "finesse";
    const spentRp = target.actor.getFlag(SYSTEM_ID, "rpSpentBoundary");
    const rpUsed = spentRp?.combatId === game.combat?.id && spentRp.round === game.combat?.round && spentRp.turn === game.combat?.turn;
    autoHit = forceAutoHit || !!actor.system?.combat?.basicAttack?.autoHitFirearm || !!(sourceTrait(actor, "firearm") && game.combat?.combatant?.actor?.uuid === actor.uuid && !rpUsed);
  } else {
    const chosenMode = ["force", "finesse"].includes(requestedAttackMode)
      ? requestedAttackMode
      : await promptBasicAttackMode(actor, { force, finesse });
    if (!chosenMode) return null;

    if (chosenMode === "finesse") {
      attackBonus = useHalfDemonBonus ? demonAttackBonus(finesse) : finesse - 1;
      damageBonus = useHalfDemonBonus ? demonAttackBonus(force) : force - 1;
      attackMode = "finesse";
    } else {
      attackBonus = useHalfDemonBonus ? demonAttackBonus(force) : force - 1;
      damageBonus = useHalfDemonBonus ? demonAttackBonus(finesse) : finesse - 1;
      attackMode = "force";
    }
    autoHit = forceAutoHit || !!actor.system?.combat?.basicAttack?.autoHitMelee;
  }

  if (!sourceOptions.noAmmoCost && weaponUsesAmmo(weapon) && toNumber(weapon.system?.ammo?.value, 0) <= 0) {
    ui.notifications.warn("Cette arme n'a plus de munitions."); return null;
  }
  const subclassPassive = subclassAttackModifiers(actor, target.actor);
  const costs = reactionRpCost ? [{ path: "system.resources.rp.value", cost: reactionRpCost, label: "RP" }] : [];
  if (reactionRpCost && getConditionActionRestriction(actor, "rp").blocked) return null;
  if (!(await spendCombatAction(actor, { free: free || subclassPassive.free, reaction: reactionRpCost > 0, costs }))) return null;
  if (!sourceOptions.noAmmoCost && !(await spendWeaponAmmo(weapon))) return null;
  if (weapon?.system?.chargeTurns) await clearTechniqueCharge(actor);

  if (!weapon) damageBonus = useHalfDemonBonus ? demonAttackBonus(force) : force;
  if (repeatedAction) damageBonus = force;

  attackBonus += toNumber(weapon?.system?.attackMod, 0);
  if (isFirearm && game.combat?.round > 0) attackBonus += loadout.attackBonus;
  damageBonus += toNumber(weapon?.system?.damageMod, 0);
  if (isFirearm) damageBonus += Number(loadedAmmunition(actor, weapon)?.system?.damageBonus) || 0;
  attackBonus += subclassPassive.attackBonus;
  const movementBonus = actor.getFlag(SYSTEM_ID, "nextAttackMovementBonus");
  if (movementBonus) { attackBonus += Number(movementBonus.value) || 0; await actor.unsetFlag(SYSTEM_ID, "nextAttackMovementBonus"); }
  damageBonus += subclassPassive.damageBonus;

  let stableShotLine = "";
  const stableShot = actor.getFlag?.(SYSTEM_ID, "stableShot") || {};
  if (isFirearm && stableShot?.attackBonus) {
    const bonus = toNumber(stableShot.attackBonus, 0);
    attackBonus += bonus;
    stableShotLine = `<div>Tir en position stable : +${bonus} au toucher.</div>`;
    await actor.unsetFlag?.(SYSTEM_ID, "stableShot");
  }

  if (repeatedAction) {
    repeatedActionDamage = await getRepeatedActionBonus(actor);
  } else if (actor.type === "demonist") {
    await resetRepeatedAction(actor);
  }

  const targetCa = toNumber(target.actor.system?.resources?.ca, 10) + (reinforcedDamageReduction(target.actor, targetLimb) ? 2 : 0);
  const subclassAttack = actor.getFlag?.(SYSTEM_ID, "subclassBasicAttack") || {};
  const subclassAttackBonus = toNumber(subclassAttack.attackBonus, 0);
  const subclassDamageBonus = toNumber(subclassAttack.damageBonus, 0);
  let subclassLine = "";
  if (subclassAttackBonus) attackBonus += subclassAttackBonus;
  if (
    subclassAttack.autoHitIfTargetCaBelowSelf &&
    targetCa < toNumber(actor.system?.resources?.ca, 10)
  ) {
    autoHit = true;
  }
  const passive = await applyPreHit(actor, target, { system: { damage: "BL_DAMAGE", costE: 0 } }, { attackerToken, basicAttack: true, weapon });
  const sniper = isFirearm && actor.system?.progression?.flags?.sniperTraining &&
    /fusil|rifle/i.test(weapon.name) && loadout.modifications.some(i => normalizeRuleText(i.name) === "lunette");
  let attackRoll = null;
  let attackTotal = targetCa;

  if (sourceOptions.replay) {
    attackTotal = sourceOptions.replay.attackTotal;
    autoHit = !!sourceOptions.replay.autoHit;
  } else if (!autoHit) {
    const edge = passive.rollEdge.attack + subclassPassive.edge + (sniper ? 1 : 0) - (target.actor.system?.states?.mondeTransparent ? 1 : 0);
    const die = edge > 0 ? "2d20kh" : edge < 0 ? "2d20kl" : "1d20";
    attackRoll = await new Roll(`${die} + ${attackBonus}`).evaluate();
    attackTotal = toNumber(attackRoll.total, 0);
  }

  const hit = autoHit || attackTotal >= targetCa;
  await consumeEffectsByOrigin(target.actor, "rideau-de-fer");
  let rawDamageExpr =
    weapon?.system?.damage || actor.system?.combat?.basicAttack?.unarmedDamage || "1d4 + Force";
  if (weapon) {
    rawDamageExpr = normalizeDamageExpr(rawDamageExpr, "1");
    rawDamageExpr = increaseFirstDieCount(
      rawDamageExpr,
      toNumber(progressionBonuses.weaponDieSteps, 0) + toNumber(weapon.system?.extraDamageDice, 0)
    );
  }
  if (weapon?.system?.isNichirin && progressionBonuses.nichirinDamageDie) {
    rawDamageExpr = replaceFirstDie(rawDamageExpr, progressionBonuses.nichirinDamageDie);
  }

  const baseDamageExpr = replaceStats(stripStatTermsFromDamageExpr(rawDamageExpr), actor, "1d4 + 0");
  let damageExpr = `${baseDamageExpr} + ${damageBonus}`;
  if (weapon?.system?.isNichirin) {
    damageExpr = appendFlatModifier(
      damageExpr,
      toNumber(progressionBonuses.nichirinDamageBonus, 0)
    );
  }
  if (repeatedActionDamage) {
    damageExpr = appendFlatModifier(damageExpr, repeatedActionDamage);
  }
  if (subclassDamageBonus) {
    damageExpr = appendFlatModifier(damageExpr, subclassDamageBonus);
  }
  damageExpr = appendFlatModifier(damageExpr, Number(sourceOptions.bonusDamage) || 0);
  if (sourceOptions.bonusFormula) damageExpr = `${damageExpr} + (${sourceOptions.bonusFormula})`;
  if (sourceOptions.multiplier > 1) damageExpr = `(${damageExpr}) * ${sourceOptions.multiplier}`;
  if (subclassAttack.damageStatDice) {
    const stat = String(subclassAttack.damageStatDice.stat || "");
    const faces = Math.max(1, toNumber(subclassAttack.damageStatDice.faces, 6));
    const baseStats = getEffectiveBaseStats(actor);
    const derivedStats = actor.system?.stats?.effectiveDerived ?? actor.system?.stats?.derived ?? {};
    const dice = Math.max(0, toNumber(baseStats[stat] ?? derivedStats[stat], 0));
    if (dice) damageExpr = `${damageExpr} + ${dice}d${faces}`;
  }
  if (subclassAttack.damageMultiplier) {
    damageExpr = `(${damageExpr}) * ${Math.max(1, toNumber(subclassAttack.damageMultiplier, 1))}`;
  }
  if (subclassAttack.itemName) {
    subclassLine = `<div>${subclassAttack.itemName}: ${[
      subclassAttackBonus ? `+${subclassAttackBonus} toucher` : "",
      subclassDamageBonus ? `+${subclassDamageBonus} degats` : "",
      subclassAttack.autoHitIfTargetCaBelowSelf ? "auto-hit si CA cible inferieure" : "",
      subclassAttack.damageStatDice ? "des bonus selon stat" : "",
      subclassAttack.damageMultiplier ? `degats x${subclassAttack.damageMultiplier}` : "",
    ].filter(Boolean).join(", ")}.</div>`;
  }

  let bloodFuryLine = "";
  const bloodFury = actor.getFlag?.(SYSTEM_ID, "bloodFury") || {};
  const bloodFuryUses = toNumber(bloodFury?.uses, 0);
  const targetHp = toNumber(target.actor.system?.resources?.hp?.value, 0);
  const targetHpMax = toNumber(target.actor.system?.resources?.hp?.max, targetHp);
  const targetBleeding = !!target.actor.system?.conditions?.bleed?.active;
  const targetUnderHalf = targetHpMax > 0 && targetHp < targetHpMax / 2;
  if (hit && actor.type === "demonist" && bloodFuryUses > 0 && (targetBleeding || targetUnderHalf)) {
    const furyDamage = String(bloodFury.damage || "1d6");
    damageExpr = `${damageExpr} + (${furyDamage})`;
    const remaining = Math.max(0, bloodFuryUses - 1);
    if (remaining > 0) {
      await actor.setFlag(SYSTEM_ID, "bloodFury", {
        ...bloodFury,
        uses: remaining,
      });
    } else {
      await actor.unsetFlag?.(SYSTEM_ID, "bloodFury");
    }
    bloodFuryLine = `<div>Fureur sanguinaire : +${furyDamage}, ${remaining} charge(s) restante(s).</div>`;
  }

  if (actor.system?.states?.mondeTransparent) {
    damageExpr = `(${damageExpr}) * 2`;
  }
  damageExpr = passive.dmgExpr.replaceAll("BL_DAMAGE", `(${damageExpr})`);
  if (subclassPassive.damageMultiplier !== 1) damageExpr = `(${damageExpr}) * ${subclassPassive.damageMultiplier}`;
  if (isDemonActor(actor) && arms.any && /griffe|bras|claw/i.test(String(weapon?.name || weapon?.system?.weaponFamily || ""))) {
    damageExpr = `(${damageExpr}) / 2`;
  }

  let damageRoll = hit ? await new Roll(sourceOptions.replay ? String(sourceOptions.replay.damageTotal) : damageExpr).evaluate({ maximize: !!sourceOptions.maximize }) : null;
  const damageEdge = sourceOptions.replay ? 0 : passive.rollEdge.damage + (sniper ? 1 : 0);
  if (hit && damageEdge) {
    const alternate = await new Roll(damageExpr).evaluate();
    if (damageEdge > 0 ? alternate.total > damageRoll.total : alternate.total < damageRoll.total) damageRoll = alternate;
  }

  if (subclassAttack.consumeOnAttack) {
    await actor.unsetFlag?.(SYSTEM_ID, "subclassBasicAttack");
  }
  if (subclassAttack.selfEffectAfterAttack) {
    await applyEffectsList({
      source: actor,
      target: actor,
      effects: [subclassAttack.selfEffectAfterAttack],
      origin: subclassAttack.itemName || "Sous-classe",
    });
  }

  const attackLine = autoHit
    // Passive state changes are persisted below before publishing the attack.
    ? "Attaque de base auto-reussie."
    : `Jet d'attaque (${attackMode}) : ${attackTotal} contre CA ${targetCa}.`;
  const damageMode = isFirearm ? "precision" : attackMode === "force" ? "finesse" : "force";
  await onBasicAttackResolved(actor, target.actor, { hit });
  if (isFirearm) await actor.setFlag(SYSTEM_ID, "lastShotSilent", loadout.stealthBonus > 0);
  if (!sourceOptions.areaChild) await actor.setFlag(SYSTEM_ID, "lastBasicAttack", {
    weaponId: weapon?.id || "", targetTokenId: target.id, sceneId: canvas.scene.id, hit, isFirearm,
    attackMode, attackTotal, autoHit, targetLimb, damageTotal: Number(damageRoll?.total) || 0, damageExpr, combatId: game.combat?.id || "",
  });
  const statLine = `<div><small>Toucher: ${attackMode}. Degats: ${damageMode}${weaponUsesAmmo(weapon) ? `. Munitions: ${toNumber(weapon.system?.ammo?.value, 0)} / ${toNumber(weapon.system?.ammo?.max, 0)}` : ""}.</small></div>`;
  const modeLine = repeatedAction
    ? `<div>Action repetee : bonus actuel +${repeatedActionDamage}.</div>`
    : "";
  const activeCoating = getActivePoisonCoating(actor);
  const targetLimbLabel = targetLimb
    ? LIMB_DEFINITIONS.find((entry) => entry.key === targetLimb)?.label || targetLimb
    : "";
  const poisonNote =
    activeCoating && (!weapon?.id || !activeCoating.weaponId || activeCoating.weaponId === weapon.id)
      ? `<div><small>Poison prepare: ${activeCoating.itemName} sur ${activeCoating.weaponName || weapon?.name || "l'arme"}.</small></div>`
      : "";
  const limbNote = targetLimbLabel ? `<div><small>Ciblage: ${targetLimbLabel}.</small></div>` : "";
  const targetRow = hit
    ? buildReactionTargetRow({
        attackerToken,
        targetToken: target,
        damageTotal: damageRoll?.total ?? 0,
        allowDodge: reactionRpCost < 2,
        allowReactions: reactionRpCost < 2,
        allowWaterDeflect: reactionRpCost < 2 && (isFirearm || range > METERS_PER_SQUARE),
        extraButtonsHtml:
          !autoHit && attackRoll
            ? `<button class="bl-evade-no-rp" data-target-token="${target.id}" data-attack-total="${attackTotal}">Eviter sans RP</button>`
            : "",
      })
    : "";

  let attackMessage = null;
  if (!autoHit && attackRoll) {
    attackMessage = await attackRoll.toMessage({
      speaker: actorSpeaker(actor),
      flavor: `
        <div class="bl-card" style="display:grid; gap:.35rem;">
          <div><strong>${actor.name}</strong> attaque <strong>${target.name}</strong> avec <strong>${weapon?.name || "attaque a mains nues"}</strong>.</div>
          ${modeLine}
          ${stableShotLine}
          ${bloodFuryLine}
          ${subclassLine}
          ${statLine}
          ${limbNote}
          <div><small>Jet d'attaque (${attackMode}) contre CA ${targetCa}.</small></div>
          <div>${hit ? "L'attaque touche." : "L'attaque manque sa cible."}</div>
        </div>
      `,
    });
  }
  const love = getActiveBreaths(actor).love;
  if (!sourceOptions.areaChild && attackerToken && love?.enabled && love.specials?.balancementsAmoureux) {
    for (const other of canvas.tokens.placeables.filter(t => t.actor && t.id !== attackerToken.id && t.id !== target.id &&
      t.document.disposition !== attackerToken.document.disposition && distMetersChebyshev(attackerToken, t) <= range)) {
      await rollBasicAttack(actor, { item: weapon, targetToken: other, attackMode, targetLimb: "", free: true,
        forceAutoHit, reactionRpCost: 0, sourceOptions: { ...sourceOptions, areaChild: true, noAmmoCost: true } });
    }
  }

  if (!hit) {
    return { hit, attackRoll, damageRoll: null, attackMessage, chatMessage: null };
  }

  const chatMessage = await damageRoll.toMessage({
    flags: cardFlags("basicAttack", {
      actorUuid: actor.uuid, weaponUuid: weapon?.uuid ?? null,
      sceneId: canvas.scene.id, damageTotal: damageRoll.total, isFirearm, targetLimb,
      attackTotal,
      comboId: sourceOptions.comboId || "", comboIndex: sourceOptions.comboIndex ?? 0,
    }),
    speaker: actorSpeaker(actor),
    flavor: `
      <div class="bl-card" style="display:grid; gap:.35rem;">
        <div><strong>${actor.name}</strong> attaque <strong>${target.name}</strong> avec <strong>${weapon?.name || "attaque a mains nues"}</strong>.</div>
        ${modeLine}
        ${stableShotLine}
        ${bloodFuryLine}
        ${subclassLine}
        ${statLine}
        ${limbNote}
        ${poisonNote}
        <div><small>${autoHit ? `${attackLine} ` : ""}La cible peut reagir avant l'application des degats.</small></div>
        <div><b>Degats potentiels:</b> ${damageRoll.total} <small>(${damageExpr})</small></div>
        ${targetRow}
      </div>
    `,
  });



  return { hit, attackRoll, damageRoll, attackMessage, chatMessage };
}

async function promptTargetActor(actor, title = "Choisir une cible") {
  const token = await pickTargetToken({ excludeTokenId: getPrimaryToken(actor)?.id });
  return token?.actor ? token : null;
}

export async function runDemonHeal(actor) {
  if (!actor || !isDemonActor(actor)) return null;
  if (!canHealActor(actor)) return null;
  const formula = DEMON_HEALING_BY_RANK[String(actor.system?.class?.rank || "")];
  if (!formula) {
    ui.notifications.warn("Aucune formule de guerison demoniaque connue pour ce rang.");
    return null;
  }

  const hpPath = "system.resources.hp.value";
  const hpValue = toNumber(FU.getProperty(actor, hpPath), 0);
  const hpMax = toNumber(actor.system?.resources?.hp?.max, hpValue);
  if (hpValue >= hpMax) {
    ui.notifications.info(`${actor.name} est deja a son maximum de PV.`);
    return 0;
  }

  const ok = await spendCombatAction(actor, { costs: [{ path: "system.resources.bdp.value", cost: 2, label: "BDP" }] });
  if (!ok) return null;

  const roll = await new Roll(formula).evaluate();
  const healed = Math.max(0, Math.min(hpMax - hpValue, toNumber(roll.total, 0)));
  const next = clamp(hpValue + healed, 0, hpMax);
  await actor.update({ [hpPath]: next });

  await ChatMessage.create({
    speaker: actorSpeaker(actor),
    content: `<em>${actor.name} utilise Guerison et recupere ${healed} PV (${hpValue} -> ${next}).</em>`,
  });
  return healed;
}

export async function runDemonPurify(actor) {
  if (!actor || !isDemonActor(actor)) return null;
  const poison = FU.getProperty(actor, "system.conditions.poisoned") || {};
  const intensity = Math.max(0, toNumber(poison.intensity, 0));
  if (!poison.active || intensity <= 0) {
    ui.notifications.info(`${actor.name} n'a pas de poison actif a purifier.`);
    return 0;
  }

  const removed = Math.min(intensity, getRankTier(actor));
  if (!(await spendCombatAction(actor))) return null;
  const nextState = reducePoisonStacks(poison, removed);
  await actor.update({ "system.conditions.poisoned": nextState });
  await ChatMessage.create({
    speaker: actorSpeaker(actor),
    content: `<em>${actor.name} utilise Purification et retire ${removed} niveau(x) de poison.</em>`,
  });
  return removed;
}

export async function runDemonRegrow(actor, { turns = null } = {}) {
  if (!actor || !isDemonActor(actor)) return null;
  if (!canHealActor(actor)) return null;
  const limbStates = FU.getProperty(actor, "system.combat.injuries.limbs") || {};
  const affected = Object.entries(limbStates)
    .filter(([, state]) => state?.severed || state?.broken || state?.injured)
    .map(([key, state]) => `${key}${state.severed ? " (sectionne)" : state.broken ? " (casse)" : " (blesse)"}`);
  if (!affected.length) {
    ui.notifications.info(`${actor.name} n'a aucun membre coche pour Repousse.`);
    return [];
  }

  const duration = turns ?? await promptRegenerationDuration();
  if (duration === null) return null;
  const ok = await spendCombatAction(actor, { costs: [{ path: "system.resources.bdp.value", cost: 4, label: "BDP" }] });
  if (!ok) return null;

  const limbs = Object.keys(limbStates).filter(key => limbStates[key]?.severed || limbStates[key]?.broken || limbStates[key]?.injured);
  await startRegeneration(actor, { limbs, turns: duration });

  await ChatMessage.create({
    speaker: actorSpeaker(actor),
    content: `<em>${actor.name} utilise Repousse sur ${affected.join(", ")} : ${duration ? `${duration} tour(s), durée choisie par le MJ` : "immédiatement, choix du MJ"}.</em>`,
  });
  return affected;
}

export async function runDemonInfect(actor) {
  if (!actor || !isDemonActor(actor)) return null;
  if (!["Lune inferieure", "Lune superieure"].includes(String(actor.system?.class?.rank || ""))) {
    ui.notifications.warn("Seules les Lunes inferieures et superieures peuvent infecter.");
    return null;
  }

  const targetToken = await promptTargetActor(actor, "Choisir un humain a infecter");
  const targetActor = targetToken?.actor;
  if (!targetActor) return null;
  if (isDemonActor(targetActor) || targetActor.type === "demonist") {
    ui.notifications.warn("La cible doit etre un humain non demoniaque.");
    return null;
  }

  const donorRankIndex = DEMON_RANKS.indexOf(String(actor.system?.class?.rank || ""));
  const nextRank = DEMON_RANKS[Math.max(0, donorRankIndex - 4)] || DEMON_RANKS[0];
  await targetActor.setFlag(SYSTEM_ID, "pendingDemonInfection", {
    donorActorId: actor.id,
    donorName: actor.name,
    donorRank: actor.system?.class?.rank || "",
    resultingRank: nextRank,
    bloodline: actor.system?.demonology?.sharedBloodline || "",
    timestamp: Date.now(),
  });
  await ChatMessage.create({
    speaker: actorSpeaker(actor),
    content: `<em>${actor.name} infecte ${targetActor.name}. Si la transformation aboutit, la cible devient un demon de rang ${nextRank}.</em>`,
  });
  return nextRank;
}

export async function runDemonSos(actor) {
  if (!actor || !isDemonActor(actor)) return null;
  const bloodline = String(actor.system?.demonology?.sharedBloodline || "").trim() || "sans lignee precisee";
  await ChatMessage.create({
    speaker: actorSpeaker(actor),
    content: `<em>${actor.name} lance un SOS demoniaque a la branche ${bloodline}. Les demons d'autres lignees ne repondent pas.</em>`,
  });
  return bloodline;
}

export async function runDemonExecute(actor) {
  if (!actor || !isDemonActor(actor)) return null;
  if (![
    "Disciple de Lune inferieure",
    "Lune inferieure",
    "Disciple de Lune superieure",
    "Lune superieure",
  ].includes(String(actor.system?.class?.rank || ""))) {
    ui.notifications.warn("Ce rang demoniaque ne peut pas Executer.");
    return null;
  }

  const attackerToken = resolveCanvasToken(getPrimaryToken(actor), actor);
  const targetToken = await promptTargetActor(actor, "Choisir une cible a executer");
  const targetActor = targetToken?.actor;
  if (!targetActor) return null;
  if (isDemonActor(targetActor) || targetActor.type === "demonist") {
    ui.notifications.warn("Executer cible un humain, pas une creature demoniaque.");
    return null;
  }

  const hp = toNumber(targetActor.system?.resources?.hp?.value, 0);
  if (hp > 5) {
    ui.notifications.warn("Executer ne fonctionne que sur une cible humaine a 5 PV ou moins.");
    return null;
  }

  const targetRow = buildReactionTargetRow({
    attackerToken,
    targetToken,
    damageTotal: hp,
    allowDodge: false,
    allowReactions: true,
    allowWaterDeflect: false,
    takeDamageLabel: "Executer",
  });

  const chatMessage = await ChatMessage.create({
    flags: cardFlags("execution", { actorUuid: actor.uuid, sceneId: canvas.scene.id, field: "content" }),
    speaker: actorSpeaker(actor),
    content: `
      <div class="bl-card" style="display:grid; gap:.35rem;">
        <div><strong>${actor.name}</strong> tente d'executer <strong>${targetToken.name}</strong>.</div>
        <div><small>L'execution ne peut pas etre esquivee, mais des reactions restent possibles.</small></div>
        <div class="bl-target-list" style="display:grid; gap:.5rem;">${targetRow}</div>
      </div>
    `,
  });



  return true;
}

async function runDemonPreparedDefense(actor, { mode = "block", label = "Defense demoniaque" } = {}) {
  if (!actor || !isDemonActor(actor)) return null;

  // TODO-RULEBOOK-AMBIGUITY: the PDF lists demon block/dodge as reaction options,
  // but does not give a Foundry-sized mitigation formula. We spend 1 RP and reuse
  // the existing defensive-stance hook so the next incoming attack card can be
  // cancelled explicitly by the defender.
  const ok = await spendRp(actor, 1, label);
  if (!ok) return null;

  await actor.setFlag(SYSTEM_ID, "deflectStance", {
    itemName: label,
    actionLabel: mode === "dodge" ? "Esquive preparee" : "Blocage prepare",
    source: "demon-defense",
    mode,
    mode,
    round: game.combat?.round ?? null,
    created: Date.now(),
  });
  await ChatMessage.create({
    speaker: actorSpeaker(actor),
    content: `<em>${actor.name} prepare ${label}. La prochaine carte d'attaque peut consommer cette defense pour annuler les degats.</em>`,
  });
  return true;
}

export async function runDemonBlock(actor) {
  return runDemonPreparedDefense(actor, {
    mode: "block",
    label: "Bloquer demoniaque",
  });
}

export async function runDemonDodge(actor) {
  return runDemonPreparedDefense(actor, {
    mode: "dodge",
    label: "Esquive demoniaque",
  });
}

export async function runDemonSharedAction(actor, key) {
  switch (String(key || "")) {
    case "heal":
      return runDemonHeal(actor);
    case "regrow":
      return runDemonRegrow(actor);
    case "purify":
      return runDemonPurify(actor);
    case "infect":
      return runDemonInfect(actor);
    case "sos":
      return runDemonSos(actor);
    case "execute":
      return runDemonExecute(actor);
    case "block":
      return runDemonBlock(actor);
    case "dodge":
      return runDemonDodge(actor);
    default:
      return null;
  }
}

export async function runRecoveryBreath(actor) {
  if (!actor) return null;
  if (actor.system?.states?.tcbActive) {
    ui.notifications.warn("Le Souffle de recuperation est interdit pendant le TCB actif.");
    await ChatMessage.create({
      speaker: actorSpeaker(actor),
      content: `<em>${actor.name} ne peut pas utiliser le Souffle de recuperation pendant le TCB actif.</em>`,
    });
    return null;
  }
  if (!(await spendCombatAction(actor))) return null;
  const tier = getRankTier(actor);
  const multiplier = actor.system?.states?.marque ? 2 : 1;
  const roll = await new Roll(`${tier}d8`).evaluate();
  const amount = toNumber(roll.total, 0) * multiplier;
  const eMax = toNumber(actor.system?.resources?.e?.max, 0);
  const eValue = toNumber(actor.system?.resources?.e?.value, 0);
  const next = clamp(eValue + amount, 0, eMax);

  const update = {
    "system.resources.e.value": next,
    [`flags.${SYSTEM_ID}.mustRest`]: false,
    [`flags.${SYSTEM_ID}.zeroStreakByCombat.${game.combat?.id}`]: 0,
  };

  const stoppedBleeding = !!(actor.system?.states?.tcbPermanent && getCondition(actor, "bleed")?.active);
  if (stoppedBleeding) {
    update["system.conditions.bleed.active"] = false;
    update["system.conditions.bleed.intensity"] = 0;
    update["system.conditions.bleed.duration"] = 0;
  }

  await actor.update(update);

  await ChatMessage.create({
    speaker: actorSpeaker(actor),
    content: `<em>${actor.name} utilise le Souffle de recuperation et regagne ${amount} E (${eValue} -> ${next}).${stoppedBleeding ? " Le saignement est stoppe par le TCB Constant." : ""}</em>`,
  });

  return amount;
}

export async function runSprint(actor) {
  if (!actor) return null;
  const restriction = getConditionActionRestriction(actor, "sprint");
  if (restriction.blocked) {
    ui.notifications.warn(`${actor.name} ne peut pas sprinter. ${restriction.reason}`);
    return null;
  }
  if (!(await spendCombatAction(actor))) return null;
  const movement = toNumber(actor.system?.combat?.actionEconomy?.movementMeters, 0);
  const effectiveMovement = toNumber(
    actor.system?.combat?.actionEconomy?.effectiveMovementMeters,
    movement
  );
  const extra = Number((effectiveMovement * 1.5).toFixed(1));
  await ChatMessage.create({
    speaker: actorSpeaker(actor),
    content: `<em>${actor.name} sprinte et peut parcourir jusqu'a ${extra} m supplementaires ce tour.</em>`,
  });
  return extra;
}

export async function runWait(actor) {
  if (!actor) return null;
  const restriction = getConditionActionRestriction(actor, "wait");
  if (restriction.blocked) {
    ui.notifications.warn(`${actor.name} ne peut pas attendre comme action. ${restriction.reason}`);
    return null;
  }
  await actor.update({ "system.combat.actionEconomy.waiting": true });
  await ChatMessage.create({
    speaker: actorSpeaker(actor),
    content: `<em>${actor.name} attend et garde son action pour plus tard.</em>`,
  });
  return true;
}

function dialogValue(html, selector) {
  return String(html.find(selector).val() || "").trim();
}

const CRAFTING_DC_BY_COMPONENTS = new Map([
  [1, 4],
  [2, 6],
  [3, 8],
  [4, 10],
  [5, 12],
  [6, 14],
]);

function craftingDcForComponents(count, fallback = 4) {
  const normalized = clamp(Math.round(toNumber(count, 1)), 1, 6);
  return CRAFTING_DC_BY_COMPONENTS.get(normalized) ?? fallback;
}

function derivedStatLabel(key) {
  return CONFIG.breatheAndLive?.DERIVED_LABELS?.[key] || key;
}

async function promptCraftingOptions(item) {
  const crafting = item?.system?.crafting || {};
  const componentCount = clamp(toNumber(crafting.componentCount, 1), 1, 6);
  const defaultDc = toNumber(crafting.dc, 0) || craftingDcForComponents(componentCount);
  const stat = String(crafting.stat || "sciences");
  const statOptions = Object.entries(CONFIG.breatheAndLive?.DERIVED_LABELS || {})
    .map(
      ([key, label]) =>
        `<option value="${key}" ${key === stat ? "selected" : ""}>${label}</option>`
    )
    .join("");

  return new Promise((resolve) => {
    new Dialog(
      {
        title: "Fabrication",
        content: `
          <div class="form-group">
            <label>Composants</label>
            <input id="bl-craft-components" type="number" min="1" max="6" value="${componentCount}" />
          </div>
          <div class="form-group">
            <label>DD</label>
            <input id="bl-craft-dc" type="number" min="0" value="${defaultDc}" />
          </div>
          <div class="form-group">
            <label>Competence</label>
            <select id="bl-craft-stat">${statOptions}</select>
          </div>
          <p class="hint">Le PDF fixe le DD par nombre de composants. La competence exacte reste au choix du MJ.</p>
        `,
        buttons: {
          ok: {
            label: "Fabriquer",
            callback: (html) =>
              resolve({
                componentCount: clamp(toNumber(dialogValue(html, "#bl-craft-components"), 1), 1, 6),
                dc: Math.max(0, toNumber(dialogValue(html, "#bl-craft-dc"), defaultDc)),
                stat: dialogValue(html, "#bl-craft-stat") || stat,
              }),
          },
          cancel: { label: "Annuler", callback: () => resolve(null) },
        },
        default: "ok",
      },
      { width: 420 }
    ).render(true);
  });
}

export async function runCraftingCheck(actor, item) {
  if (!actor || !item) return null;
  const options = await promptCraftingOptions(item);
  if (!options) return null;

  const mod = toNumber(actor.system?.stats?.derived?.[options.stat], 0);
  const automatic = actor.system?.progression?.flags?.poisonSpecialist && /kit/i.test(item.name) && /poison|antidote|remede/.test(normalizeRuleText(item.name)) &&
    await Dialog.confirm({ title: "Spécialiste des poisons", content: "<p>Fabriquer un poison simple ou un antidote avec ce kit, sans test ?</p>" });
  const roll = automatic ? null : await new Roll(`1d20 + ${mod}`).evaluate();
  const success = automatic || toNumber(roll?.total, 0) >= options.dc;
  const resultName = String(item.system?.crafting?.resultItemName || item.name || "objet").trim();

  // TODO-RULEBOOK-AMBIGUITY: the PDF gives component-count DCs but does not bind
  // crafting to one exact stat. The sheet lets the GM choose the derived stat.
  await ChatMessage.create({
    speaker: actorSpeaker(actor),
    content: `
      <div class="bl-card" style="display:grid; gap:.35rem;">
        <strong>Fabrication - ${resultName}</strong>
        <div>${actor.name} lance ${derivedStatLabel(options.stat)} contre DD ${options.dc} (${options.componentCount} composant(s)).</div>
        <div>${automatic ? "Spécialiste des poisons : réussite sans test." : `Jet: <b>${roll.total}</b> - ${success ? "reussite" : "echec"}.`}</div>
        ${item.system?.crafting?.notes ? `<small>${item.system.crafting.notes}</small>` : ""}
      </div>
    `,
  });
  return { roll, success, dc: options.dc, stat: options.stat };
}

async function promptDriveOptions(item, mode) {
  const dangerous = mode === "danger";
  const defaultDc = toNumber(
    dangerous ? item.system?.drive?.dangerDc : item.system?.drive?.relaxedDc,
    dangerous ? 15 : 10
  );
  return new Promise((resolve) => {
    new Dialog(
      {
        title: dangerous ? "Conduite dangereuse" : "Conduite detendue",
        content: `
          <div class="form-group">
            <label>DD</label>
            <input id="bl-drive-dc" type="number" min="0" value="${defaultDc}" />
          </div>
          <p class="hint">${dangerous ? "Route dangereuse: test de Reflexes." : "Conduite detendue: test de Finesse."} Le DD varie selon route, meteo et visibilite.</p>
        `,
        buttons: {
          ok: {
            label: "Conduire",
            callback: (html) =>
              resolve({
                dc: Math.max(0, toNumber(dialogValue(html, "#bl-drive-dc"), defaultDc)),
              }),
          },
          cancel: { label: "Annuler", callback: () => resolve(null) },
        },
        default: "ok",
      },
      { width: 380 }
    ).render(true);
  });
}

export async function runTransportDriveCheck(actor, item, { mode = "relaxed" } = {}) {
  if (!actor || !item) return null;
  if (!["vehicle", "transport"].includes(item.type)) {
    ui.notifications.warn("Cet item n'est pas un transport.");
    return null;
  }
  if (mode !== "danger" && actor.system?.progression?.flags?.drivingLicense) {
    await ChatMessage.create({ speaker: actorSpeaker(actor), content: `<em>Permis de conduire : ${actor.name} conduit ${item.name} sans test en situation normale.</em>` });
    return { roll: null, success: true, mode };
  }
  const options = await promptDriveOptions(item, mode);
  if (!options) return null;

  const dangerous = mode === "danger";
  const mod = dangerous
    ? toNumber(actor.system?.stats?.derived?.reflexes, 0)
    : toNumber(actor.system?.stats?.base?.finesse, 0) - 1;
  const roll = await new Roll(`1d20 + ${mod}`).evaluate();
  const success = toNumber(roll.total, 0) >= options.dc;
  await ChatMessage.create({
    speaker: actorSpeaker(actor),
    content: `
      <div class="bl-card" style="display:grid; gap:.35rem;">
        <strong>${dangerous ? "Conduite dangereuse" : "Conduite detendue"} - ${item.name}</strong>
        <div>${dangerous ? "Reflexes" : "Finesse"} contre DD ${options.dc}.</div>
        <div>Jet: <b>${roll.total}</b> - ${success ? "trajet maitrise" : "complication de conduite"}.</div>
        ${item.system?.drive?.notes ? `<small>${item.system.drive.notes}</small>` : ""}
      </div>
    `,
  });
  return { roll, success, dc: options.dc, mode };
}

export async function runAssistanceRequest(actor) {
  if (!actor) return null;
  const request = await new Promise((resolve) => {
    new Dialog(
      {
        title: "Demande d'assistance",
        content: `
          <div class="form-group">
            <label>Niveau de menace</label>
            <input id="bl-assist-threat" type="text" placeholder="ex: Lune inferieure, demon trop puissant..." />
          </div>
          <div class="form-group">
            <label>Message</label>
            <textarea id="bl-assist-message" rows="4" placeholder="Situation, localisation, blesses, urgence..."></textarea>
          </div>
        `,
        buttons: {
          ok: {
            label: "Envoyer",
            callback: (html) =>
              resolve({
                threat: dialogValue(html, "#bl-assist-threat"),
                message: dialogValue(html, "#bl-assist-message"),
              }),
          },
          cancel: { label: "Annuler", callback: () => resolve(null) },
        },
        default: "ok",
      },
      { width: 480 }
    ).render(true);
  });
  if (!request) return null;

  await ChatMessage.create({
    speaker: actorSpeaker(actor),
    content: `
      <div class="bl-card" style="display:grid; gap:.35rem;">
        <strong>Demande d'assistance - ${actor.name}</strong>
        <div><b>Menace:</b> ${request.threat || "non precisee"}</div>
        <div>${request.message || "Aucun detail fourni."}</div>
        <small>Action de support: le MJ determine le delai et la reponse des pourfendeurs/Kakushi disponibles.</small>
      </div>
    `,
  });
  return request;
}

export async function runKakushiSupplyRequest(actor) {
  if (!actor) return null;
  const request = await new Promise((resolve) => {
    new Dialog(
      {
        title: "Demande d'objet Kakushi",
        content: `
          <div class="form-group">
            <label>Objet demande</label>
            <input id="bl-kakushi-item" type="text" placeholder="ex: bandages, munitions, transport..." />
          </div>
          <div class="form-group">
            <label>Quantite</label>
            <input id="bl-kakushi-qty" type="number" min="1" value="1" />
          </div>
          <div class="form-group">
            <label>Lieu / consigne</label>
            <textarea id="bl-kakushi-note" rows="3"></textarea>
          </div>
        `,
        buttons: {
          ok: {
            label: "Demander",
            callback: (html) =>
              resolve({
                item: dialogValue(html, "#bl-kakushi-item"),
                quantity: Math.max(1, toNumber(dialogValue(html, "#bl-kakushi-qty"), 1)),
                note: dialogValue(html, "#bl-kakushi-note"),
              }),
          },
          cancel: { label: "Annuler", callback: () => resolve(null) },
        },
        default: "ok",
      },
      { width: 480 }
    ).render(true);
  });
  if (!request) return null;

  await ChatMessage.create({
    speaker: actorSpeaker(actor),
    content: `
      <div class="bl-card" style="display:grid; gap:.35rem;">
        <strong>Requete Kakushi - ${actor.name}</strong>
        <div><b>Objet:</b> ${request.item || "non precise"} x${request.quantity}</div>
        <div>${request.note || "Aucune consigne."}</div>
        <small>Le MJ valide disponibilite, cout et delai de livraison.</small>
      </div>
    `,
  });
  return request;
}

export async function runCounterAttackReaction(actor, { assured = false } = {}) {
  if (!actor) return null;
  if (!isDemonActor(actor) && !actor.system?.combat?.reactions?.counterAttack) {
    ui.notifications.warn("La réaction d'attaque nécessite Entraînement au combat.");
    return null;
  }
  const cost = assured ? 2 : 1;
  return rollBasicAttack(actor, { forceAutoHit: assured, reactionRpCost: cost });
}

export async function runDrawReaction(actor, { attackAndReturn = false } = {}) {
  if (!actor) return null;
  if (!actor.system?.combat?.reactions?.draw) {
    ui.notifications.warn("La réaction de dégainage nécessite Changement d'arme rapide.");
    return null;
  }
  const cost = attackAndReturn ? 2 : 1;
  if (attackAndReturn) return rollBasicAttack(actor, { reactionRpCost: cost });
  const ok = await spendRp(actor, cost, attackAndReturn ? "degainage attaque" : "degainage");
  if (!ok) return null;
  await ChatMessage.create({
    speaker: actorSpeaker(actor),
    content: attackAndReturn
      ? `<em>${actor.name} degaine, attaque, puis revient a son arme precedente. Choisis l'arme a utiliser.</em>`
      : `<em>${actor.name} change d'arme sans depenser d'action.</em>`,
  });
  return true;
}

export async function runRestRefresh(actor, { full = true, hours = full ? 8 : 1 } = {}) {
  if (!actor) return null;
  const updates = {};
  if (FU.hasProperty(actor, "system.resources.e.max")) {
    updates["system.resources.e.value"] = toNumber(actor.system.resources.e.max, 0);
  }
  if (hours >= 8 && FU.hasProperty(actor, "system.resources.rp.max")) {
    updates["system.resources.rp.value"] = toNumber(actor.system.resources.rp.max, 0);
  }
  if (full && FU.hasProperty(actor, "system.resources.hp.healableMax")) {
    updates["system.resources.hp.value"] = toNumber(actor.system.resources.hp.healableMax, 0);
  }
  if (full && hours >= 8 && actor.type === "demonist") {
    updates["system.resources.demonisation"] = 0;
    updates["system.support.activeDemonistMedicine"] = false;
    updates["system.support.demonistMedicineActiveCombatId"] = "";
  }
  await actor.update(updates);
  await resetRepeatedAction(actor);
  if (full && hours >= 8) await actor.setFlag(SYSTEM_ID, "demonisationDecaySeconds", 0);
  await actor.unsetFlag(SYSTEM_ID, "mustRest");
  await ChatMessage.create({
    speaker: actorSpeaker(actor),
    content: `<em>${actor.name} se repose ${hours} heure(s) et récupère son endurance${hours >= 8 ? " et ses RP" : ""}.</em>`,
  });
  return true;
}

async function resolveMedicalItem(
  actor,
  item,
  { targetActor = null, reaction = false, maximize = false, testDc = null, medicalKnowledge = false } = {}
) {
  if (!actor || !item) return null;

  const itemKey = normalizeRuleText(`${item.name} ${item.system?.sourceSection} ${item.system?.usageNote}`);
  if (actor.type === "demonist" && itemKey.includes("medecine active demoniste")) {
    if (!(await spendCombatAction(actor))) return null;
    await actor.update({
      "system.support.activeDemonistMedicine": true,
      "system.support.demonistMedicineActiveCombatId": game.combat?.id || "",
    });
    await ChatMessage.create({
      speaker: actorSpeaker(actor),
      content: `<em>${actor.name} active la Medecine Active Demoniste: la demonisation gagnee est reduite de 50 % jusqu'a la fin du combat.</em>`,
    });
    return true;
  }

  if (actor.type === "demonist" && itemKey.includes("medecine de reparation demoniste")) {
    if (!(await spendCombatAction(actor))) return null;
    const current = toNumber(actor.system?.resources?.demonisation, 0);
    const next = Math.max(0, current / 2);
    await actor.update({ "system.resources.demonisation": next });
    await ChatMessage.create({
      speaker: actorSpeaker(actor),
      content: `<em>${actor.name} utilise la Medecine de Reparation Demoniste et reduit sa demonisation (${current} -> ${next}).</em>`,
    });
    return current - next;
  }

  const medicalTarget = targetActor || actor;
  const surgery = itemKey.includes("chirurg");
  const injection = /seringue|injecteur/.test(itemKey);
  const jet = itemKey.includes("jet");
  if (reaction && !(await spendRp(actor, maximize ? 2 : 1, "une réaction médicale"))) return null;
  if (!reaction && !jet && !(await spendCombatAction(actor))) return null;
  if (!reaction && (surgery || (injection && !jet))) {
    // TODO-RULEBOOK-AMBIGUITY: p.99-100 requires Medicine but supplies no DC.
    const dc = testDc ?? await new Promise(resolve => new Dialog({
      title: "Difficulté médicale — arbitrage MJ",
      content: "<p>Indiquez la difficulté de Médecine ; elle n'est pas chiffrée dans le livre.</p><input name='medicalDc' type='number' placeholder='Difficulté' />",
      buttons: { roll: { label: "Tester", callback: html => {
        const raw = String(html.find('[name="medicalDc"]').val() ?? "").trim();
        resolve(raw && Number.isFinite(Number(raw)) ? Number(raw) : null);
      } }, cancel: { label: "Annuler", callback: () => resolve(null) } }, close: () => resolve(null),
    }).render(true));
    if (dc === null) return null;
    const roll = await rollDerivedCheck(actor, "medecine", `Médecine : ${item.name}`);
    const criticalFailure = surgery && roll?.dice?.[0]?.total === 1;
    // p.99 says a critical failure may cause death; leave that consequence to the GM.
    const fatal = criticalFailure && await Dialog.confirm({ title: "Échec critique chirurgical", content: "<p>Le livre indique que cet échec peut entraîner la mort. Le MJ confirme-t-il cette conséquence pour le patient ?</p>" });
    if (fatal) await medicalTarget.update({ "system.resources.hp.value": 0, "system.death.state": "dead" });
    if (!roll || criticalFailure || roll.total < dc) {
      await ChatMessage.create({ speaker: actorSpeaker(actor), content: `<em>${item.name} : échec du soin${fatal ? "; le MJ confirme la mort du patient" : criticalFailure ? "; échec critique, conséquences à arbitrer" : ""}.</em>` });
      return false;
    }
  }
  if (/attelle/.test(itemKey)) {
    for (const [key, state] of Object.entries(medicalTarget.system?.combat?.injuries?.limbs ?? {})) {
      if (state.broken) await setLimbState(medicalTarget, key, { stabilized: true });
    }
    await ChatMessage.create({ speaker: actorSpeaker(actor), content: `<em>${item.name} stabilise les os brisés de ${medicalTarget.name}, sans restaurer de PV.</em>` });
    return true;
  }

  const hasEnduranceGain = !!String(item.system?.enduranceGain || "").trim();
  const hasHpHealing = !!item.system?.maxHeal || !!String(item.system?.healing || "").trim();
  if (hasEnduranceGain) {
    const enduranceResult = await applyEnduranceGain(actor, item, { maximize });
    if (!hasHpHealing) return enduranceResult;
  }

  const selectedTargetActor =
    Array.from(game.user.targets ?? [])
      .map((token) => token?.actor)
      .find((candidate) => candidate && candidate.id !== actor.id) || null;
  const target = targetActor || selectedTargetActor || actor;

  const healableMax = toNumber(target.system?.resources?.hp?.healableMax, target.system?.resources?.hp?.max ?? 0);
  const hpValue = toNumber(target.system?.resources?.hp?.value, 0);

  if (item.system?.maxHeal || injection) {
    if (surgery || injection || itemKey.includes("medecin")) {
      const hpMax = toNumber(target.system?.resources?.hp?.max, healableMax);
      await target.update({
        "system.combat.injuries.severeWounds": 0,
        "system.combat.injuries.nearDeathWounds": 0,
        "system.resources.hp.healableMax": hpMax,
        "system.resources.hp.value": hpMax,
        "system.death.state": "alive",
      });
      await restoreLimbs(target, Object.entries(target.system?.combat?.injuries?.limbs ?? {})
        .filter(([, state]) => state.broken && !state.severed).map(([key]) => key));
      if (injection) {
        const count = toNumber(target.getFlag(SYSTEM_ID, "bloodHealingUses"), 0) + 1;
        await target.setFlag(SYSTEM_ID, "bloodHealingUses", count);
        if (count > 3) ui.notifications.warn("Plus de trois injections : effets secondaires à arbitrer (valeurs absentes du livre).");
      }
      await ChatMessage.create({
        speaker: actorSpeaker(actor),
        content: `<em>${actor.name} traite les blessures graves de ${target.name} avec ${item.name}; le cap de soin est restaure.</em>`,
      });
      return hpMax - hpValue;
    }
    const update = { "system.resources.hp.value": healableMax };
    if (healableMax > 0) update["system.death.state"] = "alive";
    await target.update(update);
    await ChatMessage.create({
      speaker: actorSpeaker(actor),
      content: `<em>${actor.name} soigne completement ${target.name} avec ${item.name}.</em>`,
    });
    return healableMax - hpValue;
  }

  const medBonus = toNumber(actor.system?.stats?.effectiveDerived?.medecine ?? actor.system?.stats?.derived?.medecine, 0);
  const healExpr = medicalKnowledge && sourceTrait(actor, "medicine") && hasHpHealing ? "1d6 + 2" : replaceStats(item.system?.healing || "0", actor, "0");
  const roll = await new Roll(healExpr).evaluate();
  const amount = maximize ? maxFormulaTotal(healExpr) : toNumber(roll.total, 0);
  const next = clamp(hpValue + amount + (hasHpHealing && !medicalKnowledge ? medBonus : 0), 0, healableMax);

  const update = { "system.resources.hp.value": next };
  const deathState = String(target.system?.death?.state || "alive");
  if (item.system?.stabilizes && hpValue <= 0 && next <= 0) {
    update["system.death.state"] = "critical";
  } else if (next > 0 && ["critical", "dying", "dead"].includes(deathState)) {
    update["system.death.state"] = "alive";
  }
  for (const conditionKey of item.system?.removeConditions ?? []) {
    update[`system.conditions.${conditionKey}.active`] = false;
    update[`system.conditions.${conditionKey}.intensity`] = 0;
    update[`system.conditions.${conditionKey}.duration`] = 0;
    if (conditionKey === "poisoned") {
      update["system.conditions.poisoned.notes"] = "";
      update["system.conditions.poisoned.stacks"] = {};
      update["system.conditions.poisoned.profile"] = "generic";
    }
  }
  await target.update(update);

  await ChatMessage.create({
    speaker: actorSpeaker(actor),
    content: `<em>${actor.name} utilise ${item.name} sur ${target.name} et restaure ${next - hpValue} PV.</em>`,
  });

  return next - hpValue;
}

export async function useMedicalItem(actor, item, options = {}) {
  if (!actor || !item) return null;
  const quantity = toNumber(item.system?.quantity, 1);
  const charges = item.system?.uses;
  if (quantity <= 0 || (charges?.max > 0 && charges.value <= 0)) {
    ui.notifications.warn(`${item.name} est épuisé.`);
    return null;
  }
  if (options.reaction && !actor.system?.combat?.reactions?.medical && !actor.system?.support?.medicalTraining) {
    ui.notifications.warn("La réaction médicale nécessite Formation médicale.");
    return null;
  }
  const target = options.targetActor ?? Array.from(game.user.targets ?? []).find(t => t.actor)?.actor ?? actor;
  if (!canHealActor(target)) return null;
  let result;
  if (/analgesique/.test(normalizeRuleText(item.name))) {
    if (options.reaction ? !(await spendRp(actor, options.maximize ? 2 : 1, "analgésique")) : !(await spendCombatAction(actor))) return null;
    const amount = Math.floor(toNumber(target.system?.resources?.hp?.max, 0) / 4);
    await target.update({ "system.resources.hp.temporary": toNumber(target.system?.resources?.hp?.temporary, 0) + amount });
    await target.setFlag(SYSTEM_ID, "analgesicExpiry", {
      expiresAt: toNumber(game.time?.worldTime, 0) + 3600,
      amount: toNumber(target.getFlag(SYSTEM_ID, "analgesicExpiry")?.amount, 0) + amount,
      remaining: toNumber(target.getFlag(SYSTEM_ID, "analgesicExpiry")?.remaining, 0) + amount,
      deferredDamage: toNumber(target.getFlag(SYSTEM_ID, "analgesicExpiry")?.deferredDamage, 0),
    });
    await ChatMessage.create({ speaker: actorSpeaker(actor),
      content: `<em>${target.name} gagne ${amount} PV temporaires pendant une heure grâce à ${item.name}.</em>` });
    result = amount;
  } else {
    result = await resolveMedicalItem(actor, item, { ...options, targetActor: target });
  }
  if (result !== null && result !== undefined && item.update) {
    if (item.type === "medical" && result !== false && !/analgesique/.test(normalizeRuleText(item.name))) {
      const analgesic = target.getFlag(SYSTEM_ID, "analgesicExpiry");
      if (analgesic) await target.setFlag(SYSTEM_ID, "analgesicExpiry", { ...analgesic, deferredDamage: 0 });
    }
    const reusable = item.system?.reusable || /chirurg|culture|kit.*remede/.test(normalizeRuleText(item.name));
    if (charges?.max > 0) await item.update({ "system.uses.value": Math.max(0, charges.value - 1) });
    else if (!reusable) await item.update({ "system.quantity": quantity - 1 });
  }
  return result;
}

export async function gainDemonFleshBdp(actor) {
  if (!actor || actor.type !== "demonist") return null;

  const options = Object.entries(DEMON_FLESH_BDP)
    .map(([label, expr]) => `<option value="${label}">${label} (${expr})</option>`)
    .join("");

  const selected = await new Promise((resolve) => {
    new Dialog(
      {
        title: "Consommer de la chair demoniaque",
        content: `
          <div class="form-group">
            <label>Rang du demon consomme</label>
            <select id="bl-demon-flesh-rank">${options}</select>
          </div>
        `,
        buttons: {
          ok: {
            label: "Consommer",
            callback: (html) => resolve(String(html.find("#bl-demon-flesh-rank").val() || "")),
          },
          cancel: {
            label: "Annuler",
            callback: () => resolve(""),
          },
        },
        default: "ok",
      },
      { width: 420 }
    ).render(true);
  });

  if (!selected) return null;

  const expr = DEMON_FLESH_BDP[selected];
  const flatBonus = toNumber(actor.system?.progression?.bonuses?.demonFleshBonus, 0);
  const extraDice = toNumber(actor.system?.progression?.bonuses?.demonFleshExtraDice, 0) + (sourceTrait(actor, "stomach") ? 1 : 0);
  const rollExpr = increaseFirstDieCount(expr, extraDice);
  const roll = await new Roll(rollExpr).evaluate();
  const gain = Math.max(0, toNumber(roll.total, 0) + flatBonus);
  const current = toNumber(actor.system?.resources?.bdp?.value, 0);
  const max = toNumber(actor.system?.resources?.bdp?.max, current);
  const next = clamp(current + gain, 0, max);

  await actor.update({
    "system.resources.bdp.value": next,
    "system.support.recentDemonFleshRank": selected,
    "system.support.highestDemonFleshRank": Object.keys(DEMON_FLESH_BDP).indexOf(selected) > Object.keys(DEMON_FLESH_BDP).indexOf(actor.system?.support?.highestDemonFleshRank || "") ? selected : actor.system.support.highestDemonFleshRank,
  });
  await ChatMessage.create({
    speaker: actorSpeaker(actor),
    content: `<em>${actor.name} consomme de la chair demoniaque (${selected}) et gagne ${next - current} BDP (${current} -> ${next}).${extraDice ? ` Palais raffine: +${extraDice} de(s) sur ${expr}.` : ""}</em>`,
  });
  return next - current;
}

export async function processConditionTurnStart(actor, combat = game.combat) {
  const pending = getDemonPendingEffects(actor);
  if (pending.length) {
    const round = Number(combat?.round ?? 0) || 0;
    const keep = [];
    for (const effect of pending) {
      if (Number(effect.dueRound || 0) > round) {
        keep.push(effect);
        continue;
      }

      const roll = await new Roll(String(effect.formula || "0")).evaluate();
      const amount = Math.max(0, toNumber(roll.total, 0));
      await applyDirectDamage(actor, amount, `${effect.sourceName} - ${effect.label} :`);
      if (effect.afflictionCondition) {
        await applyConditionStacks(actor, effect.afflictionCondition, effect.afflictionIntensity || 1);
      }
      if (effect.markAsh) {
        await actor.setFlag(SYSTEM_ID, "burnMoonAsh", true);
      }
    }
    await setDemonPendingEffects(actor, keep);
  }

  const conditionMap = actor.system?.conditions ?? {};
  const conditionTurns = actor.getFlag(SYSTEM_ID, "conditionTurns") ?? {};
  const nextConditionTurns = { ...conditionTurns };
  const turnReminders = [];

  if (conditionMap.slowed?.active) {
    nextConditionTurns.slowedCanAct =
      conditionTurns.slowedCanAct === undefined ? true : !conditionTurns.slowedCanAct;
    turnReminders.push(
      nextConditionTurns.slowedCanAct
        ? "Ralenti : peut agir ce tour, puis devra sauter sa prochaine action."
        : "Ralenti : ne peut pas agir ce tour."
    );
  } else if (conditionTurns.slowedCanAct !== undefined) {
    delete nextConditionTurns.slowedCanAct;
  }

  if (conditionMap.fury?.active) {
    turnReminders.push("Fureur : doit utiliser des attaques de base contre une cible a portee.");
  }
  if (conditionMap.imprisoned?.active) {
    turnReminders.push("Emprisonne : deplacement impossible jusqu'a liberation.");
  }
  if (conditionMap.paralyzed?.active) {
    turnReminders.push("Paralyse : deplacement impossible, parole conservee.");
  }
  if (conditionMap.controlled?.active) {
    turnReminders.push("Controle : actions sous contrainte externe.");
  }
  if (conditionMap.charmed?.active) {
    turnReminders.push("Charme : ne peut pas blesser son charmeur et partage ses ennemis.");
  }
  if (conditionMap.cursed?.active) {
    turnReminders.push("Maudit : appliquer l'effet specifique note par le MJ.");
  }
  if (conditionMap.sadness?.active) {
    const endurance = toNumber(
      actor.system?.stats?.effectiveDerived?.endurance ?? actor.system?.stats?.derived?.endurance,
      0
    );
    const roll = await new Roll(`1d20 + ${endurance}`).evaluate();
    const passed = toNumber(roll.total, 0) >= 15;
    turnReminders.push(
      `Triste : test d'endurance DD 15 ${passed ? "reussi" : "echoue"} (${roll.total}).`
    );
    // TODO-RULEBOOK-AMBIGUITY: la consequence exacte de l'echec n'est pas precisee dans l'extrait de condition.
  }

  await actor.setFlag(SYSTEM_ID, "conditionTurns", nextConditionTurns).catch(() => {});
  if (turnReminders.length) {
    await ChatMessage.create({
      speaker: actorSpeaker(actor),
      content: `<div><strong>Conditions de ${actor.name}</strong></div><ul>${turnReminders
        .map((line) => `<li>${line}</li>`)
        .join("")}</ul>`,
    });
  }

  for (const definition of CONDITION_DEFINITIONS) {
    const state = conditionMap[definition.key];
    if (!state?.active) continue;

    if (definition.turnFormula || state.turnFormula) {
      const roll = await new Roll(state.turnFormula || definition.turnFormula).evaluate();
      await applyDirectDamage(
        actor,
        toNumber(roll.total, 0),
        `${definition.label} affecte ${actor.name} :`
      );
    }

    if (definition.key === "smoked") {
      const intensity = Math.max(1, toNumber(state.intensity, 1));
      const eValue = toNumber(actor.system?.resources?.e?.value, 0);
      const next = Math.max(0, eValue - intensity);
      await actor.update({ "system.resources.e.value": next,
        "system.resources.e.temporary": Math.max(0, toNumber(actor.system?.resources?.e?.temporary, 0) - intensity) });
      if (intensity >= 10) {
        await actor.toggleStatusEffect?.("unconscious", { active: true });
        await actor.setFlag(SYSTEM_ID, "smokeUnconscious", true);
      }
      await ChatMessage.create({
        speaker: actorSpeaker(actor),
        content: `<em>Fumee : ${actor.name} perd ${intensity} Endurance (${eValue} -> ${next}).</em>`,
      });
    }

    if (definition.key === "poisoned") {
      if (state.stacks?.glycineWeakening || state.profile === "glycineWeakening") {
        state.elapsedTurns = Math.max(0, toNumber(state.elapsedTurns, 0)) + 1;
        await actor.update({ "system.conditions.poisoned.elapsedTurns": state.elapsedTurns });
      }
      const runtime = resolvePoisonRuntime(state, actor);
      const summary = describePoisonState(state, actor);
      if (!runtime.active) {
        await actor.update({
          "system.conditions.poisoned.active": false,
        });
        if (Math.max(0, toNumber(state.intensity, 0)) > 0) {
          await createPoisonStatusChat(actor, summary, "Le poison n'a aucun effet ce tour");
        }
      } else if (runtime.turnDamage.kind === "flat") {
        await applyDirectDamage(
          actor,
          Math.max(0, toNumber(runtime.turnDamage.value, 0)),
          `Poison (${runtime.profile}) affecte ${actor.name} :`
        );
        await createPoisonStatusChat(actor, summary, "Le poison agit");
      } else if (runtime.turnDamage.kind === "formula" && runtime.turnDamage.formula) {
        const roll = await new Roll(String(runtime.turnDamage.formula)).evaluate();
        await applyDirectDamage(
          actor,
          Math.max(0, toNumber(roll.total, 0)),
          `Poison (${runtime.profile}) affecte ${actor.name} :`
        );
        await createPoisonStatusChat(actor, summary, "Le poison agit");
      } else if (runtime.turnDamage.kind === "percentMax") {
        const hpMax = toNumber(actor.system?.resources?.hp?.max, 0);
        const amount = Math.max(0, Math.ceil(hpMax * toNumber(runtime.turnDamage.value, 0)));
        await applyDirectDamage(
          actor,
          amount,
          `Poison (${runtime.profile}) affecte ${actor.name} :`
        );
        await createPoisonStatusChat(actor, summary, "Le poison agit");
      } else if (runtime.turnDamage.kind === "mixed") {
        let amount = 0;
        const hpMax = toNumber(actor.system?.resources?.hp?.max, 0);
        for (const part of runtime.turnDamage.parts || []) {
          if (part.kind === "flat") {
            amount += Math.max(0, toNumber(part.value, 0));
          } else if (part.kind === "formula" && part.formula) {
            const roll = await new Roll(String(part.formula)).evaluate();
            amount += Math.max(0, toNumber(roll.total, 0));
          } else if (part.kind === "percentMax") {
            amount += Math.max(0, Math.ceil(hpMax * toNumber(part.value, 0)));
          }
        }
        if (amount > 0) {
          await applyDirectDamage(
            actor,
            amount,
            `Poison (${runtime.profile}) affecte ${actor.name} :`
          );
        }
        await createPoisonStatusChat(actor, summary, "Le poison agit");
      } else {
        await createPoisonStatusChat(actor, summary, "Le poison affaiblit la cible");
      }
    }

    if (definition.key === "freeze" && !state.duration) {
      await setConditionState(actor, "freeze", { duration: Math.max(1, Number((await new Roll("1d4").evaluate()).total)) });
    }
  }

  if (actor.system?.states?.tcbPermanent && FU.hasProperty(actor, "system.resources.e.value")) {
    const eValue = toNumber(actor.system?.resources?.e?.value, 0);
    const eMax = toNumber(actor.system?.resources?.e?.max, 0);
    if (eValue < eMax) {
      await actor.update({
        "system.resources.e.value": Math.min(eMax, eValue + 1),
      });
    }
  }
}

export async function processConditionTurnEnd(actor, combat = game.combat) {
  const expired = [];
  const updates = {};
  for (const definition of CONDITION_DEFINITIONS) {
    const state = getCondition(actor, definition.key);
    if (!state.active || !(state.duration > 0)) continue;
    const applied = state.appliedBoundary;
    if (applied && combat && applied.combatId === combat.id && applied.round === combat.previous?.round && applied.turn === combat.previous?.turn) continue;
    const left = Math.max(0, Number(state.duration) - 1);
    updates[`system.conditions.${definition.key}.duration`] = left;
    if (left !== 0) continue;
    updates[`system.conditions.${definition.key}.active`] = false;
    updates[`system.conditions.${definition.key}.intensity`] = 0;
    updates[`system.conditions.${definition.key}.turnFormula`] = "";
    updates[`system.conditions.${definition.key}.appliedBoundary`] = null;
    if (definition.key === "poisoned") updates["system.conditions.poisoned.stacks"] = {};
    expired.push(definition.label);
  }
  if (Object.keys(updates).length) await actor.update(updates);
  if (expired.length) await ChatMessage.create({ speaker: actorSpeaker(actor),
    content: `<em>${actor.name} : fin des effets ${expired.join(", ")}.</em>` });
}

export function registerActionHooks() {
  Hooks.on("updateToken", (token, change, options, userId) => {
    if (isAutomationAuthority(userId)) return noteSubclassMovement(token, change);
  });
  registerCombatAutomation(20, async combat => {
    if (!(combat.previous?.round > 0)) return;
    const outgoing = combat.combatants.get(combat.previous.combatantId)?.actor ?? combat.turns[combat.previous.turn]?.actor;
    if (outgoing) await processConditionTurnEnd(outgoing, combat);
    for (const actor of combatActors(combat)) {
      const offBalance = getCondition(actor, "offBalance");
      if (offBalance.active && (!offBalance.duration || offBalance.expiry === "currentTurnEnd")) {
        await setConditionState(actor, "offBalance", { active: false });
      }
    }
  });
  registerCombatAutomation(30, async (combat, changed, options, userId) => {
    if (!isAutomationAuthority(userId)) return;
    if (!isCombatTurnStart(combat, changed)) return;
    if (!(combat.previous?.round > 0)) await initializeCombatBreaths(combat);
    const actor = combat.combatant?.actor;
    if (!actor) return;
    const dislocation = actor.getFlag(SYSTEM_ID, "beastDislocation");
    if (dislocation && (!dislocation.combatId || dislocation.combatId === combat.id)) {
      const limb = actor.system?.combat?.injuries?.limbs?.[dislocation.armKey];
      if (!limb?.severed && !limb?.broken) await actor.update({
        [`system.combat.injuries.limbs.${dislocation.armKey}.injured`]: !!dislocation.before.injured,
        [`system.combat.injuries.limbs.${dislocation.armKey}.notes`]: dislocation.before.notes || "",
      });
      await actor.unsetFlag(SYSTEM_ID, "beastDislocation");
    }
    await beginSubclassTurn(actor);
    await refreshCombatActions(actor);
    await tickRegeneration(actor);
    await processConditionTurnStart(actor, combat);
  });

  Hooks.on("deleteCombat", async (combat, options, userId) => {
    if (!isAutomationAuthority(userId)) return;
    const updates = [];
    for (const actor of new Set([...(game.actors?.contents ?? []), ...combatActors(combat)])) {
      if (actor.type !== "demonist") continue;
      const activeCombatId = String(actor.system?.support?.demonistMedicineActiveCombatId || "");
      if (!actor.system?.support?.activeDemonistMedicine) continue;
      if (activeCombatId && activeCombatId !== combat.id) continue;
      updates.push(
        actor.update({
          "system.support.activeDemonistMedicine": false,
          "system.support.demonistMedicineActiveCombatId": "",
        })
      );
    }
    await Promise.all(updates);
  });

  Hooks.on("updateWorldTime", async (_worldTime, dt = 0, options, userId) => {
    if (!isAutomationAuthority(userId)) return;
    const actors = new Set([...(game.actors?.contents ?? []), ...combatActors(game.combat)]);
    for (const actor of actors) {
      const expiry = actor.getFlag(SYSTEM_ID, "analgesicExpiry");
      if (!expiry || _worldTime < expiry.expiresAt) continue;
      await actor.update({ "system.resources.hp.temporary": Math.max(0,
        toNumber(actor.system?.resources?.hp?.temporary, 0) - toNumber(expiry.remaining, expiry.amount)),
        "system.resources.hp.value": Math.max(0, toNumber(actor.system?.resources?.hp?.value, 0) - toNumber(expiry.deferredDamage, 0)),
      });
      if (actor.system.resources.hp.value <= 0) await actor.update({ "system.death.state": "dead" });
      await actor.unsetFlag(SYSTEM_ID, "analgesicExpiry");
    }
    const elapsed = Math.max(0, toNumber(dt, 0));
    if (!elapsed) return;
    for (const actor of game.actors?.contents ?? []) {
      if (actor.type !== "demonist") continue;
      const previousCarry = toNumber(actor.getFlag(SYSTEM_ID, "demonisationDecaySeconds"), 0);
      const total = previousCarry + elapsed;
      const hours = Math.floor(total / 3600);
      const remainder = total % 3600;
      if (hours <= 0) {
        await actor.setFlag(SYSTEM_ID, "demonisationDecaySeconds", remainder);
        continue;
      }
      const current = toNumber(actor.system?.resources?.demonisation, 0);
      await actor.update({
        "system.resources.demonisation": Math.max(0, current - hours * 2),
      });
      await actor.setFlag(SYSTEM_ID, "demonisationDecaySeconds", remainder);
    }
  });
}

export const ActionEngine = {
  registerActionHooks,
  getActivePoisonCoating,
  clearActivePoisonCoating,
  coatWeaponWithPoison,
  applyPoisonDoseToTarget,
  applyActivePoisonCoating,
  rollBasicAttack,
  runRecoveryBreath,
  runSprint,
  runWait,
  runRestRefresh,
  runDemonSharedAction,
  runDemonHeal,
  runDemonRegrow,
  runDemonPurify,
  runDemonInfect,
  runDemonSos,
  runDemonExecute,
  runDemonBlock,
  runDemonDodge,
  runDemonistHealingReaction,
  runDemonistEnhancementReaction,
  runReloadWeapon,
  runCounterAttackReaction,
  runDrawReaction,
  runAssistanceRequest,
  runKakushiSupplyRequest,
  runCraftingCheck,
  runTransportDriveCheck,
  rollBaseCheck,
  rollDerivedCheck,
  queueDemonPendingEffect,
  startRegeneration,
  gainDemonFleshBdp,
  applyDemonisationGain,
  spendBdp,
  spendRp,
  setConditionState,
  setLimbState,
  useMedicalItem,
};

registerCardType("basicAttack", async (card, html, on) => {
  const actor = await fromUuid(card.actorUuid);
  const weapon = card.weaponUuid ? await fromUuid(card.weaponUuid) : null;
  if (!actor) throw new Error("Attaquant introuvable.");
  attachSourceReactions(card, html, on, actor);
  const damageRoll = { total: card.damageTotal };
  const { isFirearm, targetLimb } = card;
  const disableTargetButtons = (tokenId) => {
    html.find(`button[data-target-token="${tokenId}"]`).prop("disabled", true);
  };
  const disableRpButtons = (tokenId) => {
    html
      .find(`.bl-target-row[data-target-token="${tokenId}"] .bl-dodge, .bl-target-row[data-target-token="${tokenId}"] .bl-deflect, .bl-target-row[data-target-token="${tokenId}"] .bl-stance-deflect`)
      .prop("disabled", true);
  };

  on(".bl-evade-no-rp", async (event) => {
    const button = $(event.currentTarget);
    const token = canvas.tokens.get(String(button.attr("data-target-token")));
    const targetActor = token?.actor;
    if (!targetActor || !canInteractWithToken(token)) return;

    const attackTarget = toNumber(button.attr("data-attack-total"), 0);
    const result = await rollNoRpEvade(targetActor, attackTarget, actor);
    if (result.success) {
      html
        .find(`.bl-target-row[data-target-token="${token.id}"] .bl-target-result`)
        .html(`<em>Eviter sans RP reussi (${result.total} contre ${attackTarget}) : degats annules.</em>`);
      disableTargetButtons(token.id);
    } else {
      html
        .find(`.bl-target-row[data-target-token="${token.id}"] .bl-target-result`)
        .html(`<em>Eviter sans RP echoue (${result.total} contre ${attackTarget}) : reactions RP interdites contre cette attaque.</em>`);
      button.prop("disabled", true);
      disableRpButtons(token.id);
    }
  });

  on(".bl-dodge", async (event) => {
    const button = $(event.currentTarget);
    const token = canvas.tokens.get(String(button.attr("data-target-token")));
    const targetActor = token?.actor;
    if (!targetActor || !canInteractWithToken(token)) return;

    const ok = await spendRp(targetActor, 1);
    if (!ok) return;

    html
      .find(`.bl-target-row[data-target-token="${token.id}"] .bl-target-result`)
      .html("<em>Esquive reussie : degats annules.</em>");
    disableTargetButtons(token.id);
  });

  on(".bl-deflect", async (event) => {
    const button = $(event.currentTarget);
    const token = canvas.tokens.get(String(button.attr("data-target-token")));
    const targetActor = token?.actor;
    if (!targetActor || !canInteractWithToken(token)) return;

    const ok = await spendRp(targetActor, 1);
    if (!ok) return;

    html
      .find(`.bl-target-row[data-target-token="${token.id}"] .bl-target-result`)
      .html("<em>Deviation reussie : degats annules. Redirection manuelle.</em>");
    disableTargetButtons(token.id);
  });

  on(".bl-stance-deflect", async (event) => {
    const button = $(event.currentTarget);
    const token = canvas.tokens.get(String(button.attr("data-target-token")));
    const targetActor = token?.actor;
    if (!targetActor || !canInteractWithToken(token)) return;

    await consumeDeflectStance(targetActor);
    html
      .find(`.bl-target-row[data-target-token="${token.id}"] .bl-target-result`)
      .html("<em>Posture defensive consommee : degats annules.</em>");
    disableTargetButtons(token.id);
  });

  on(".bl-takedmg", async (event) => {
    const button = $(event.currentTarget);
    const token = canvas.tokens.get(String(button.attr("data-target-token")));
    if (!token?.actor || !canInteractWithToken(token)) return;

    const result = await applyBasicAttackDamage({
      attacker: actor,
      targetToken: token,
      damageRoll: { total: Number(button.attr("data-damage")) || 0 },
      weapon,
      isFirearm,
      targetLimb,
    });
    if (!result) return;
    await resolveSourceComboDamage(actor, token.actor, card);
    if (card.areaWeapon && weapon?.system) {
      const rules = weapon.system;
      if (rules.periodicTurns) await setConditionState(token.actor, "burn", { active: true, intensity: 1, duration: rules.periodicTurns, turnFormula: rules.periodicDamage });
      if (rules.burnFormula) {
        const save = await rollDerivedCheck(token.actor, "dexterite", `Éviter la brûlure de ${weapon.name}`);
        if (save?.total < rules.saveDc) await setConditionState(token.actor, "burn", { active: true, intensity: 1, duration: rules.burnDuration, turnFormula: rules.burnFormula });
      }
    }

    html
      .find(`.bl-target-row[data-target-token="${token.id}"] .bl-target-result`)
      .html(
        `<em>${token.actor.name} prend <b>${result.damage}</b> degats (PV ${result.currentHp} -> ${result.nextHp}).${result.poisonResult ? ` ${buildPoisonChatLine(result.poisonResult)}.` : ""}</em>`
      );
    disableTargetButtons(token.id);
  });
});
registerCardType("execution", async (card, html, on) => {
  const actor = await fromUuid(card.actorUuid);
  if (!actor) throw new Error("Attaquant introuvable.");
  const disableTargetButtons = (tokenId) => {
    html.find(`button[data-target-token="${tokenId}"]`).prop("disabled", true);
  };

  on(".bl-deflect, .bl-stance-deflect", async (event) => {
    const button = $(event.currentTarget);
    const token = canvas.tokens.get(String(button.attr("data-target-token")));
    const defended = token?.actor;
    if (!defended || !canInteractWithToken(token)) return;

    if (button.hasClass("bl-deflect")) {
      const ok = await spendRp(defended, 1);
      if (!ok) return;
    } else {
      await consumeDeflectStance(defended);
    }

    html
      .find(`.bl-target-row[data-target-token="${token.id}"] .bl-target-result`)
      .html("<em>Execution contrecarree par reaction.</em>");
    disableTargetButtons(token.id);
  });

  on(".bl-takedmg", async (event) => {
    const button = $(event.currentTarget);
    const token = canvas.tokens.get(String(button.attr("data-target-token")));
    const target = token?.actor;
    if (!target || !canInteractWithToken(token)) return;

    const currentHp = toNumber(target.system?.resources?.hp?.value, 0);
    await target.update({ "system.resources.hp.value": 0 });
    await noteActorDamageTaken(target, currentHp);
    await ChatMessage.create({
      speaker: actorSpeaker(actor),
      content: `<em>${actor.name} execute ${target.name} (${currentHp} -> 0 PV).</em>`,
    });
    disableTargetButtons(token.id);
  });
});
registerCardType("purify", async (card, html, on) => {
  const actor = await fromUuid(card.actorUuid);
  on(".bl-poison-purify", async event => {
  if (!actor?.isOwner) return;
  await runDemonPurify(actor);
  $(event.currentTarget).prop("disabled", true);
  });
});
