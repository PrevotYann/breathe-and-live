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
} from "./technique-utils.mjs";
import { applyEffectsList } from "./effects-engine.mjs";
import {
  buildPoisonApplicationUpdate,
  describePoisonState,
  getEffectiveBaseStats,
  resolvePoisonRuntime,
} from "./poison-utils.mjs";
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

  const nextStack = isConsecutiveCombatUse
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

async function spendRp(actor, cost, reason = "") {
  const path = "system.resources.rp.value";
  const current = toNumber(FU.getProperty(actor, path), 0);
  if (current < cost) {
    ui.notifications.warn(
      `${actor.name} n'a pas assez de RP (${cost} requis, ${current} disponibles).`
    );
    return false;
  }
  await actor.update({ [path]: current - cost });
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
  const roll = await new Roll(`1d20 + ${mod}`).evaluate({ async: true });
  return roll.toMessage({
    speaker: actorSpeaker(actor),
    flavor: label || `Test ${key}`,
  });
}

export async function rollDerivedCheck(actor, derivedKey, label = "") {
  if (!actor || !derivedKey) return null;
  const key = normalizeDerivedStatKey(derivedKey);
  const mod = toNumber(actor.system?.stats?.derived?.[key], 0);
  const roll = await new Roll(`1d20 + ${mod}`).evaluate({ async: true });
  return roll.toMessage({
    speaker: actorSpeaker(actor),
    flavor: label || `Test ${key}`,
  });
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
  const roll = await new Roll(expr).evaluate({ async: true });
  const amount = maximize
    ? Math.max(toNumber(roll.terms?.[0]?.faces, toNumber(roll.total, 0)), toNumber(roll.total, 0))
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
  const rank = await getRecentDemonistRank(actor);
  if (!rank) return null;

  const rpCost = maximize ? 2 : 1;
  const ok = await spendRp(actor, rpCost, maximize ? "reaction de soin demoniste maximale" : "reaction de soin demoniste");
  if (!ok) return null;

  const formula = DEMON_HEALING_BY_RANK[rank] || "1d10";
  const amount = maximize
    ? maxFormulaTotal(formula)
    : toNumber((await new Roll(formula).evaluate({ async: true })).total, 0);
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
  const newHp = Math.max(0, hpValue - Math.max(0, amount));
  await actor.update({ "system.resources.hp.value": newHp });
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
  return ["weapon", "firearm"].includes(String(item.type || ""));
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
    ? `<div><small>${summary.detailLines.join(" • ")}</small></div>`
    : "";
  const purifyButton = isDemonActor(actor) && summary.runtime?.active
    ? `<button type="button" class="bl-poison-purify" data-actor-id="${actor.id}">Purification</button>`
    : "";

  const message = await ChatMessage.create({
    speaker: actorSpeaker(actor),
    content: `
      <div class="bl-card" style="display:grid; gap:.35rem;">
        <div><strong>${actor.name}</strong> - ${intro}</div>
        <div><small>${summary.profileLabel} • Intensite ${summary.intensity}${summary.duration ? ` • Duree ${summary.duration}` : ""}</small></div>
        <div>${summary.effectSummary}${summary.restrictionSummary ? ` <small>${summary.restrictionSummary}</small>` : ""}</div>
        ${details}
        ${purifyButton}
      </div>
    `,
  });

  if (purifyButton) {
    Hooks.once("renderChatMessage", (chat, html) => {
      if (chat.id !== message.id) return;
      html.find(".bl-poison-purify").on("click", async (event) => {
        const button = $(event.currentTarget);
        button.prop("disabled", true);
        await runDemonPurify(actor);
      });
    });
  }

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
  const max = toNumber(weapon.system?.ammo?.max, 0);
  if (max <= 0) {
    ui.notifications.warn(`${weapon.name} n'a pas de charge max configuree.`);
    return null;
  }
  const current = toNumber(weapon.system?.ammo?.value, 0);
  await weapon.update({ "system.ammo.value": max });
  await ChatMessage.create({
    speaker: actorSpeaker(actor),
    content: `<em>${actor.name} recharge ${weapon.name} (${current} -> ${max}).</em>`,
  });
  return max - current;
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

async function rollNoRpEvade(actor, attackTotal) {
  const base = getEffectiveBaseStats(actor);
  const mod = toNumber(base.finesse, 0) - 1;
  const roll = await new Roll(`1d20 + ${mod}`).evaluate({ async: true });
  const total = toNumber(roll.total, 0);
  await roll.toMessage({
    speaker: actorSpeaker(actor),
    flavor: `Eviter sans RP contre ${attackTotal}`,
  });
  return { roll, total, success: total >= toNumber(attackTotal, 0) };
}

async function applyTargetedLimbDamage(actor, limbKey, damage) {
  if (!actor || !limbKey || damage <= 0) return null;
  const definition = LIMB_DEFINITIONS.find((entry) => entry.key === limbKey);
  if (!definition) return null;

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
  const damage = Math.max(0, toNumber(damageRoll.total, 0));
  const nextHp = Math.max(0, currentHp - damage);

  await targetActor.update({ "system.resources.hp.value": nextHp });
  await noteActorDamageTaken(targetActor, damage);
  await applyTargetedLimbDamage(targetActor, targetLimb, damage);
  if (attacker.system?.states?.lameRouge && isDemonActor(targetActor)) {
    await targetActor.setFlag(SYSTEM_ID, "redBladeLockRound", game.combat?.round ?? 0);
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

  return { currentHp, nextHp, damage, poisonResult };
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

export async function rollBasicAttack(
  actor,
  {
    item = null,
    targetToken = null,
    repeatedAction = false,
    attackMode: requestedAttackMode = "",
    forceAutoHit = false,
  } = {}
) {
  if (!actor) return null;

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

  const range = toNumber(weapon?.system?.range, isFirearm ? 30 : 1.5);
  if (attackerToken && distMetersChebyshev(attackerToken, target) > range) {
    ui.notifications.warn(`La cible est hors portee (${range} m).`);
    return null;
  }

  const base = getEffectiveBaseStats(actor);
  const derived = actor.system?.stats?.derived ?? {};
  const force = toNumber(base.force);
  const finesse = toNumber(base.finesse);
  const precision = toNumber(derived.precision);

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

  const targetLimb = await promptTargetLimb(target.actor);
  if (targetLimb === null) return null;

  if (!(await spendWeaponAmmo(weapon))) return null;

  if (isFirearm) {
    attackBonus = useHalfDemonBonus ? demonAttackBonus(finesse) : finesse;
    damageBonus = precision;
    attackMode = "finesse";
    autoHit = forceAutoHit || !!actor.system?.combat?.basicAttack?.autoHitFirearm;
  } else {
    const chosenMode = ["force", "finesse"].includes(requestedAttackMode)
      ? requestedAttackMode
      : await promptBasicAttackMode(actor, { force, finesse });
    if (!chosenMode) return null;

    if (chosenMode === "finesse") {
      attackBonus = useHalfDemonBonus ? demonAttackBonus(finesse) : finesse;
      damageBonus = useHalfDemonBonus ? demonAttackBonus(force) : force;
      attackMode = "finesse";
    } else {
      attackBonus = useHalfDemonBonus ? demonAttackBonus(force) : force;
      damageBonus = useHalfDemonBonus ? demonAttackBonus(finesse) : finesse;
      attackMode = "force";
    }
    autoHit = forceAutoHit || !!actor.system?.combat?.basicAttack?.autoHitMelee;
  }

  attackBonus += toNumber(weapon?.system?.attackMod, 0);
  damageBonus += toNumber(weapon?.system?.damageMod, 0);

  if (repeatedAction) {
    repeatedActionDamage = await getRepeatedActionBonus(actor);
  } else if (actor.type === "demonist") {
    await resetRepeatedAction(actor);
  }

  const targetCa = toNumber(target.actor.system?.resources?.ca, 10);
  let attackRoll = null;
  let attackTotal = targetCa;

  if (!autoHit) {
    attackRoll = await new Roll(`1d20 + ${attackBonus}`).evaluate({ async: true });
    attackTotal = toNumber(attackRoll.total, 0);
  }

  const hit = autoHit || attackTotal >= targetCa;
  let rawDamageExpr =
    weapon?.system?.damage || actor.system?.combat?.basicAttack?.unarmedDamage || "1d4 + Force";
  if (weapon) {
    rawDamageExpr = normalizeDamageExpr(rawDamageExpr, "1");
    rawDamageExpr = increaseFirstDieCount(
      rawDamageExpr,
      toNumber(progressionBonuses.weaponDieSteps, 0)
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

  if (actor.system?.states?.mondeTransparent) {
    damageExpr = `(${damageExpr}) * 2`;
  }
  if (actor.system?.states?.lameRouge && isDemonActor(target.actor)) {
    damageExpr = `(${damageExpr}) * 2`;
  }
  if (isDemonActor(actor) && arms.any && /griffe|bras|claw/i.test(String(weapon?.name || weapon?.system?.weaponFamily || ""))) {
    damageExpr = `(${damageExpr}) / 2`;
  }

  const damageRoll = hit
    ? await new Roll(damageExpr).evaluate({ async: true })
    : null;

  const attackLine = autoHit
    ? "Attaque de base auto-reussie."
    : `Jet d'attaque (${attackMode}) : ${attackRoll.total} contre CA ${targetCa}.`;
  const damageMode = isFirearm ? "precision" : attackMode === "force" ? "finesse" : "force";
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
        allowWaterDeflect: isFirearm || range > METERS_PER_SQUARE,
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
          ${statLine}
          ${limbNote}
          <div><small>Jet d'attaque (${attackMode}) contre CA ${targetCa}.</small></div>
          <div>${hit ? "L'attaque touche." : "L'attaque manque sa cible."}</div>
        </div>
      `,
    });
  }

  if (!hit) {
    return { hit, attackRoll, damageRoll: null, attackMessage, chatMessage: null };
  }

  const chatMessage = await damageRoll.toMessage({
    speaker: actorSpeaker(actor),
    flavor: `
      <div class="bl-card" style="display:grid; gap:.35rem;">
        <div><strong>${actor.name}</strong> attaque <strong>${target.name}</strong> avec <strong>${weapon?.name || "attaque a mains nues"}</strong>.</div>
        ${modeLine}
        ${statLine}
        ${limbNote}
        ${poisonNote}
        <div><small>${autoHit ? `${attackLine} ` : ""}La cible peut reagir avant l'application des degats.</small></div>
        <div><b>Degats potentiels:</b> ${damageRoll.total} <small>(${damageExpr})</small></div>
        ${targetRow}
      </div>
    `,
  });

  Hooks.once("renderChatMessage", (message, html) => {
    if (message.id !== chatMessage.id) return;

    const disableTargetButtons = (tokenId) => {
      html.find(`button[data-target-token="${tokenId}"]`).prop("disabled", true);
    };
    const disableRpButtons = (tokenId) => {
      html
        .find(`.bl-target-row[data-target-token="${tokenId}"] .bl-dodge, .bl-target-row[data-target-token="${tokenId}"] .bl-deflect, .bl-target-row[data-target-token="${tokenId}"] .bl-stance-deflect`)
        .prop("disabled", true);
    };

    html.find(".bl-evade-no-rp").on("click", async (event) => {
      const button = $(event.currentTarget);
      const token = canvas.tokens.get(String(button.attr("data-target-token")));
      const targetActor = token?.actor;
      if (!targetActor || !canInteractWithToken(token)) return;

      const attackTarget = toNumber(button.attr("data-attack-total"), 0);
      const result = await rollNoRpEvade(targetActor, attackTarget);
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

    html.find(".bl-dodge").on("click", async (event) => {
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

    html.find(".bl-deflect").on("click", async (event) => {
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

    html.find(".bl-stance-deflect").on("click", async (event) => {
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

    html.find(".bl-takedmg").on("click", async (event) => {
      const button = $(event.currentTarget);
      const token = canvas.tokens.get(String(button.attr("data-target-token")));
      if (!token?.actor || !canInteractWithToken(token)) return;

      const result = await applyBasicAttackDamage({
        attacker: actor,
        targetToken: token,
        damageRoll,
        weapon,
        isFirearm,
        targetLimb,
      });
      if (!result) return;

      html
        .find(`.bl-target-row[data-target-token="${token.id}"] .bl-target-result`)
        .html(
          `<em>${token.actor.name} prend <b>${result.damage}</b> degats (PV ${result.currentHp} -> ${result.nextHp}).${result.poisonResult ? ` ${buildPoisonChatLine(result.poisonResult)}.` : ""}</em>`
        );
      disableTargetButtons(token.id);
    });
  });

  return { hit, attackRoll, damageRoll, attackMessage, chatMessage };
}

async function promptTargetActor(actor, title = "Choisir une cible") {
  const token = await pickTargetToken({ excludeTokenId: getPrimaryToken(actor)?.id });
  return token?.actor ? token : null;
}

export async function runDemonHeal(actor) {
  if (!actor || !isDemonActor(actor)) return null;
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

  const ok = await spendBdp(actor, 2, "Guerison");
  if (!ok) return null;

  const roll = await new Roll(formula).evaluate({ async: true });
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
  const next = Math.max(0, intensity - removed);
  await actor.update({
    "system.conditions.poisoned.intensity": next,
    "system.conditions.poisoned.active": next > 0,
  });
  await ChatMessage.create({
    speaker: actorSpeaker(actor),
    content: `<em>${actor.name} utilise Purification et retire ${removed} niveau(x) de poison.</em>`,
  });
  return removed;
}

export async function runDemonRegrow(actor) {
  if (!actor || !isDemonActor(actor)) return null;
  const limbStates = FU.getProperty(actor, "system.combat.injuries.limbs") || {};
  const affected = Object.entries(limbStates)
    .filter(([, state]) => state?.severed || state?.broken || state?.injured)
    .map(([key, state]) => `${key}${state.severed ? " (sectionne)" : state.broken ? " (casse)" : " (blesse)"}`);
  if (!affected.length) {
    ui.notifications.info(`${actor.name} n'a aucun membre coche pour Repousse.`);
    return [];
  }

  const ok = await spendBdp(actor, 4, "Repousse");
  if (!ok) return null;

  const updates = {};
  for (const [key] of Object.entries(limbStates)) {
    updates[`system.combat.injuries.limbs.${key}.injured`] = false;
    updates[`system.combat.injuries.limbs.${key}.broken`] = false;
    updates[`system.combat.injuries.limbs.${key}.severed`] = false;
    updates[`system.combat.injuries.limbs.${key}.notes`] = "";
    updates[`system.combat.injuries.targetedDamage.${key}`] = 0;
  }
  await actor.update(updates);

  await ChatMessage.create({
    speaker: actorSpeaker(actor),
    content: `<em>${actor.name} utilise Repousse et regenere immediatement les membres touches: ${affected.join(", ")}.</em>`,
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
    speaker: actorSpeaker(actor),
    content: `
      <div class="bl-card" style="display:grid; gap:.35rem;">
        <div><strong>${actor.name}</strong> tente d'executer <strong>${targetToken.name}</strong>.</div>
        <div><small>L'execution ne peut pas etre esquivee, mais des reactions restent possibles.</small></div>
        <div class="bl-target-list" style="display:grid; gap:.5rem;">${targetRow}</div>
      </div>
    `,
  });

  Hooks.once("renderChatMessage", (message, html) => {
    if (message.id !== chatMessage.id) return;
    const disableTargetButtons = (tokenId) => {
      html.find(`button[data-target-token="${tokenId}"]`).prop("disabled", true);
    };

    html.find(".bl-deflect, .bl-stance-deflect").on("click", async (event) => {
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

    html.find(".bl-takedmg").on("click", async (event) => {
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
  const tier = getRankTier(actor);
  const multiplier = actor.system?.states?.marque ? 2 : 1;
  const roll = await new Roll(`${tier}d8`).evaluate({ async: true });
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
  const roll = await new Roll(`1d20 + ${mod}`).evaluate({ async: true });
  const success = toNumber(roll.total, 0) >= options.dc;
  const resultName = String(item.system?.crafting?.resultItemName || item.name || "objet").trim();

  // TODO-RULEBOOK-AMBIGUITY: the PDF gives component-count DCs but does not bind
  // crafting to one exact stat. The sheet lets the GM choose the derived stat.
  await ChatMessage.create({
    speaker: actorSpeaker(actor),
    content: `
      <div class="bl-card" style="display:grid; gap:.35rem;">
        <strong>Fabrication - ${resultName}</strong>
        <div>${actor.name} lance ${derivedStatLabel(options.stat)} contre DD ${options.dc} (${options.componentCount} composant(s)).</div>
        <div>Jet: <b>${roll.total}</b> - ${success ? "reussite" : "echec"}.</div>
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
  const options = await promptDriveOptions(item, mode);
  if (!options) return null;

  const dangerous = mode === "danger";
  const mod = dangerous
    ? toNumber(actor.system?.stats?.derived?.reflexes, 0)
    : toNumber(actor.system?.stats?.base?.finesse, 0) - 1;
  const roll = await new Roll(`1d20 + ${mod}`).evaluate({ async: true });
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
  const cost = assured ? 2 : 1;
  const ok = await spendRp(actor, cost, assured ? "une attaque de reaction assuree" : "une attaque de reaction");
  if (!ok) return null;
  await ChatMessage.create({
    speaker: actorSpeaker(actor),
    content: assured
      ? `<em>${actor.name} depense 2 RP pour une attaque de reaction assuree.</em>`
      : `<em>${actor.name} depense 1 RP pour attaquer hors tour.</em>`,
  });
  return rollBasicAttack(actor, { forceAutoHit: assured });
}

export async function runDrawReaction(actor, { attackAndReturn = false } = {}) {
  if (!actor) return null;
  const cost = attackAndReturn ? 2 : 1;
  const ok = await spendRp(actor, cost, attackAndReturn ? "degainage attaque" : "degainage");
  if (!ok) return null;
  await ChatMessage.create({
    speaker: actorSpeaker(actor),
    content: attackAndReturn
      ? `<em>${actor.name} degaine, attaque, puis revient a son arme precedente. Choisis l'arme a utiliser.</em>`
      : `<em>${actor.name} change d'arme sans depenser d'action.</em>`,
  });
  if (attackAndReturn) {
    return rollBasicAttack(actor);
  }
  return true;
}

export async function runRestRefresh(actor, { full = true } = {}) {
  if (!actor) return null;
  const updates = {};
  if (FU.hasProperty(actor, "system.resources.e.max")) {
    updates["system.resources.e.value"] = toNumber(actor.system.resources.e.max, 0);
  }
  if (FU.hasProperty(actor, "system.resources.rp.max")) {
    updates["system.resources.rp.value"] = toNumber(actor.system.resources.rp.max, 0);
  }
  if (full && FU.hasProperty(actor, "system.resources.hp.healableMax")) {
    updates["system.resources.hp.value"] = toNumber(actor.system.resources.hp.healableMax, 0);
  }
  if (actor.type === "demonist") {
    updates["system.resources.demonisation"] = 0;
    updates["system.support.activeDemonistMedicine"] = false;
    updates["system.support.demonistMedicineActiveCombatId"] = "";
  }
  await actor.update(updates);
  await resetRepeatedAction(actor);
  await ChatMessage.create({
    speaker: actorSpeaker(actor),
    content: `<em>${actor.name} recupere ses ressources lors d'un repos.</em>`,
  });
  return true;
}

export async function useMedicalItem(
  actor,
  item,
  { targetActor = null, reaction = false, maximize = false } = {}
) {
  if (!actor || !item) return null;

  const itemKey = normalizeRuleText(`${item.name} ${item.system?.sourceSection} ${item.system?.usageNote}`);
  if (actor.type === "demonist" && itemKey.includes("medecine active demoniste")) {
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
    const current = toNumber(actor.system?.resources?.demonisation, 0);
    const next = Math.max(0, current / 2);
    await actor.update({ "system.resources.demonisation": next });
    await ChatMessage.create({
      speaker: actorSpeaker(actor),
      content: `<em>${actor.name} utilise la Medecine de Reparation Demoniste et reduit sa demonisation (${current} -> ${next}).</em>`,
    });
    return current - next;
  }

  if (reaction) {
    const cost = maximize ? 2 : 1;
    const ok = await spendRp(actor, cost, "une reaction medicale");
    if (!ok) return null;
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

  if (item.system?.maxHeal) {
    if (itemKey.includes("chirurg") || itemKey.includes("medecin")) {
      const hpMax = toNumber(target.system?.resources?.hp?.max, healableMax);
      await target.update({
        "system.combat.injuries.severeWounds": 0,
        "system.combat.injuries.nearDeathWounds": 0,
        "system.resources.hp.healableMax": hpMax,
        "system.resources.hp.value": hpMax,
      });
      await ChatMessage.create({
        speaker: actorSpeaker(actor),
        content: `<em>${actor.name} traite les blessures graves de ${target.name} avec ${item.name}; le cap de soin est restaure.</em>`,
      });
      return hpMax - hpValue;
    }
    await target.update({ "system.resources.hp.value": healableMax });
    await ChatMessage.create({
      speaker: actorSpeaker(actor),
      content: `<em>${actor.name} soigne completement ${target.name} avec ${item.name}.</em>`,
    });
    return healableMax - hpValue;
  }

  const medBonus = reaction ? 0 : toNumber(actor.system?.stats?.derived?.medecine, 0);
  const healExpr = replaceStats(item.system?.healing || "1", actor, "1");
  const roll = await new Roll(healExpr).evaluate({ async: true });
  const amount = maximize ? Math.max(toNumber(roll.terms?.[0]?.faces, toNumber(roll.total, 0)), toNumber(roll.total, 0)) : toNumber(roll.total, 0);
  const next = clamp(hpValue + amount + medBonus, 0, healableMax);

  const update = { "system.resources.hp.value": next };
  for (const conditionKey of item.system?.removeConditions ?? []) {
    update[`system.conditions.${conditionKey}.active`] = false;
    update[`system.conditions.${conditionKey}.intensity`] = 0;
    update[`system.conditions.${conditionKey}.duration`] = 0;
    if (conditionKey === "poisoned") {
      update["system.conditions.poisoned.notes"] = "";
    }
  }
  await target.update(update);

  await ChatMessage.create({
    speaker: actorSpeaker(actor),
    content: `<em>${actor.name} utilise ${item.name} sur ${target.name} et restaure ${next - hpValue} PV.</em>`,
  });

  return next - hpValue;
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
  const extraDice = toNumber(actor.system?.progression?.bonuses?.demonFleshExtraDice, 0);
  const rollExpr = increaseFirstDieCount(expr, extraDice);
  const roll = await new Roll(rollExpr).evaluate({ async: true });
  const gain = Math.max(0, toNumber(roll.total, 0) + flatBonus);
  const current = toNumber(actor.system?.resources?.bdp?.value, 0);
  const max = toNumber(actor.system?.resources?.bdp?.max, current);
  const next = clamp(current + gain, 0, max);

  await actor.update({
    "system.resources.bdp.value": next,
    "system.support.recentDemonFleshRank": selected,
  });
  await ChatMessage.create({
    speaker: actorSpeaker(actor),
    content: `<em>${actor.name} consomme de la chair demoniaque (${selected}) et gagne ${next - current} BDP (${current} -> ${next}).${extraDice ? ` Palais raffine: +${extraDice} de(s) sur ${expr}.` : ""}</em>`,
  });
  return next - current;
}

async function processConditionTurnStart(actor) {
  const pending = getDemonPendingEffects(actor);
  if (pending.length) {
    const round = Number(game.combat?.round ?? 0) || 0;
    const keep = [];
    for (const effect of pending) {
      if (Number(effect.dueRound || 0) > round) {
        keep.push(effect);
        continue;
      }

      const roll = await new Roll(String(effect.formula || "0")).evaluate({ async: true });
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
  for (const definition of CONDITION_DEFINITIONS) {
    const state = conditionMap[definition.key];
    if (!state?.active) continue;

    if (definition.turnFormula) {
      const roll = await new Roll(definition.turnFormula).evaluate({ async: true });
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
      await actor.update({ "system.resources.e.value": next });
      if (intensity >= 10) {
        await actor.setFlag(SYSTEM_ID, "mustRest", true);
      }
      await ChatMessage.create({
        speaker: actorSpeaker(actor),
        content: `<em>Fumee : ${actor.name} perd ${intensity} Endurance (${eValue} -> ${next}).</em>`,
      });
    }

    if (definition.key === "poisoned") {
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
        const roll = await new Roll(String(runtime.turnDamage.formula)).evaluate({ async: true });
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
      } else {
        await createPoisonStatusChat(actor, summary, "Le poison affaiblit la cible");
      }
    }

    if (toNumber(state.duration, 0) > 0) {
      const nextDuration = Math.max(0, toNumber(state.duration, 0) - 1);
      const durationUpdate = {
        [`system.conditions.${definition.key}.duration`]: Math.max(
          0,
          toNumber(state.duration, 0) - 1
        ),
      };
      if (nextDuration === 0 && definition.key === "poisoned" && toNumber(state.intensity, 0) <= 0) {
        durationUpdate["system.conditions.poisoned.active"] = false;
      }
      await actor.update(durationUpdate);
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

export function registerActionHooks() {
  Hooks.on("updateCombat", async (combat, changed) => {
    if (changed.turn === undefined) return;
    const actor = combat.combatant?.actor;
    if (!actor) return;
    await processConditionTurnStart(actor);
  });

  Hooks.on("deleteCombat", async (combat) => {
    const updates = [];
    for (const actor of game.actors?.contents ?? []) {
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

  Hooks.on("updateWorldTime", async (_worldTime, dt = 0) => {
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
  gainDemonFleshBdp,
  applyDemonisationGain,
  spendBdp,
  spendRp,
  setConditionState,
  setLimbState,
  useMedicalItem,
};
