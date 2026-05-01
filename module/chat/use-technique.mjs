import { applyPreHit, applyOnHit, getActiveBreaths } from "../rules/breath-effects.mjs";
import { applyEffectsList } from "../rules/effects-engine.mjs";
import {
  buildReactionTargetRow,
  canInteractWithToken,
  consumeDeflectStance,
  resolveCanvasToken,
} from "./reaction-card.mjs";
import {
  actorHasBreath,
  buildFormulaWithActorStats,
  clearTechniqueCharge,
  getPreviousRoundDamageTaken,
  getTechniqueChargeState,
  getTechniqueCooldown,
  isTechniqueChargeReady,
  normalizeBreathName,
  noteActorDamageTaken,
  setTechniqueCooldown,
  startTechniqueCharge,
} from "../rules/technique-utils.mjs";
import {
  applyActivePoisonCoating,
  applyDemonisationGain,
  getActivePoisonCoating,
  queueDemonPendingEffect,
  rollBasicAttack,
} from "../rules/action-engine.mjs";
import {
  buildPoisonApplicationUpdate,
  inferPoisonApplication,
} from "../rules/poison-utils.mjs";
import { getConditionActionRestriction } from "../rules/condition-utils.mjs";
import { LIMB_DEFINITIONS } from "../config/rule-data.mjs";

const FU = foundry.utils;
const SYSTEM_ID = "breathe-and-live";
const METERS_PER_SQUARE = 1.5;

const DEMONIST_HEALING_BY_FLESH_RANK = {
  "Rang faible": "1d10",
  "Rang eleve": "2d10",
  "Disciple de Lune inferieure": "1d20",
  "Lune inferieure": "1d20",
  "Disciple de Lune superieure": "1d100",
  "Lune superieure": "1d100",
  "Demon faible": "1d10",
  "Demon eleve": "2d10",
};

const DEMON_HEALING_BY_RANK = {
  "Demon faible": "1d10",
  "Demon eleve": "2d10",
  "Disciple de Lune inferieure": "1d20",
  "Lune inferieure": "1d20",
  "Disciple de Lune superieure": "1d100",
  "Lune superieure": "1d100",
};

function toNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function normalizeRuleText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function itemRuleText(item) {
  return normalizeRuleText(
    [
      item?.name,
      item?.system?.sourceSection,
      item?.system?.usageNote,
      ...(Array.isArray(item?.system?.tags) ? item.system.tags : []),
    ].join(" ")
  );
}

function distMetersChebyshev(aToken, bToken) {
  if (!aToken?.center || !bToken?.center) return Number.POSITIVE_INFINITY;
  const gs = canvas.grid.size || 100;
  const dx = Math.abs(aToken.center.x - bToken.center.x) / gs;
  const dy = Math.abs(aToken.center.y - bToken.center.y) / gs;
  return Math.max(dx, dy) * METERS_PER_SQUARE;
}

async function pickTarget(excludeTokenId = null) {
  const targets = Array.from(game.user.targets ?? []);
  if (targets.length === 1) return targets[0];

  const others = canvas.tokens.placeables.filter(
    (token) => token.id !== excludeTokenId && !token.document.hidden && token.actor
  );
  if (!others.length) {
    ui.notifications.warn("Aucune cible disponible.");
    return null;
  }

  const options = others
    .map((token) => `<option value="${token.id}">${token.name}</option>`)
    .join("");

  return new Promise((resolve) => {
    new Dialog(
      {
        title: "Choisir une cible",
        content: `
          <div class="form-group">
            <label>Cible</label>
            <select id="bl-target">${options}</select>
          </div>
        `,
        buttons: {
          ok: {
            label: "Valider",
            callback: (html) => resolve(canvas.tokens.get(html.find("#bl-target").val())),
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

async function placeMistTemplate(targetToken) {
  if (!canvas.scene) return;
  await canvas.scene.createEmbeddedDocuments("MeasuredTemplate", [
    {
      t: "circle",
      user: game.user.id,
      x: targetToken.center.x,
      y: targetToken.center.y,
      distance: 3,
      fillColor: "#7da0ff",
      borderColor: "#7da0ff",
      hidden: false,
      flags: {
        [SYSTEM_ID]: { kind: "mist", expireRound: game.combat?.round ?? null },
      },
    },
  ]);
}

async function simpleDash(attackerToken, distanceMeters = 6) {
  const target = Array.from(game.user.targets ?? [])[0];
  if (!target) return;
  const dx = target.center.x - attackerToken.center.x;
  const dy = target.center.y - attackerToken.center.y;
  const len = Math.hypot(dx, dy) || 1;
  const nx = dx / len;
  const ny = dy / len;
  const gs = canvas.grid.size || 100;
  const maxSquares = distanceMeters / METERS_PER_SQUARE;
  const px = attackerToken.center.x + nx * maxSquares * gs;
  const py = attackerToken.center.y + ny * maxSquares * gs;
  await attackerToken.document.update({
    x: px - attackerToken.w / 2,
    y: py - attackerToken.h / 2,
  });
}

async function spendResource(actor, path, cost, label, { sourceItem = null } = {}) {
  if (!cost) return { ok: true, note: null };
  const current = Number(FU.getProperty(actor, path) ?? 0) || 0;
  if (current < cost) {
    ui.notifications.warn(`Pas assez de ${label}. Requis: ${cost}, actuel: ${current}`);
    return { ok: false, note: null };
  }
  await actor.update({ [path]: current - cost });
  const demonisationGain =
    path === "system.resources.bdp.value"
      ? await applyDemonisationGain(actor, sourceItem, { reason: sourceItem?.name || label })
      : 0;
  const demonisationNote = demonisationGain ? `, Demonisation +${demonisationGain}` : "";
  return { ok: true, note: `${label} -${cost}${demonisationNote}` };
}

function getTechniqueRange(item, ctx = {}) {
  if (item.system?.automation?.unlimitedRange) return 9999;
  return Number(ctx.overrideRange ?? item.system?.range ?? METERS_PER_SQUARE) || METERS_PER_SQUARE;
}

function getTechniqueBreathKey(item) {
  return item.system?.breathKey || normalizeBreathName(item.system?.breath);
}

function isTechniqueRanged(item, rangeM) {
  const automation = item.system?.automation || {};
  if (automation.unlimitedRange) return true;
  if (automation.ranged) return true;
  return Number(rangeM ?? item.system?.range ?? 0) > METERS_PER_SQUARE;
}

function hasLoveFriendlyFireProtection(actor, item) {
  const breathKey = getTechniqueBreathKey(item);
  if (breathKey !== "love") return false;
  const breaths = getActiveBreaths(actor);
  return !!(breaths.love?.enabled && breaths.love?.specials?.balancementsAmoureux);
}

function isExpulsionItem(item) {
  return itemRuleText(item).includes("expulsion");
}

async function useExpulsion(attacker, item) {
  const hpBase = Math.max(
    1,
    Number(attacker.system?.resources?.hp?.base || attacker.system?.resources?.hp?.max || 1) || 1
  );
  const hpCost = Math.ceil(hpBase / 2);
  const hpValue = Number(attacker.system?.resources?.hp?.value || 0) || 0;
  const currentDemonisation = Number(attacker.system?.resources?.demonisation || 0) || 0;
  const nextHp = Math.max(0, hpValue - hpCost);
  const nextDemonisation = Math.max(0, Math.floor(currentDemonisation / 2));

  // TODO-RULEBOOK-AMBIGUITY: the extracted table says Expulsion removes all
  // demonisation, then lists "removes half total demonisation". The reversible
  // implementation follows the table value and halves current demonisation.
  await attacker.update({
    "system.resources.hp.value": nextHp,
    "system.resources.demonisation": nextDemonisation,
  });
  await noteActorDamageTaken(attacker, hpCost);
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: attacker }),
    content: `
      <div class="bl-card" style="display:grid; gap:.35rem;">
        <strong>${item.name}</strong>
        <div>${attacker.name} paie ${hpCost} PV, soit la moitie de ses PV de base.</div>
        <div>Demonisation: ${currentDemonisation} -> ${nextDemonisation}.</div>
      </div>
    `,
  });
  return { hpCost, previousDemonisation: currentDemonisation, nextDemonisation };
}

function getDemonistUtilityKind(item) {
  const haystack = itemRuleText(item);
  if (haystack.includes("expulsion")) return "expulsion";
  if (/regeneration\s+(de\s+)?membre|repousse|regeneration\s+continue\s+des\s+membres/.test(haystack)) {
    return "regrow";
  }
  if (/soin\s+demoniaque|guerison\s+demoniaque|regeneration\s+par\s+chair/.test(haystack)) {
    return "heal";
  }
  if (/stockage\s+d['’]?art\s+demoniaque|stockage\s+bda/.test(haystack)) return "storeBda";
  if (/(force|vitesse)\s+demoniaque/.test(haystack)) return "selfBoost";
  if (/concentration\s+demoniaque/.test(haystack)) return "demonFocus";
  if (/fureur\s+sanguinaire/.test(haystack)) return "bloodFury";
  if (/tir\s+en\s+position\s+stable/.test(haystack)) return "stableShot";
  if (item.type === "subclassTechnique" && item.system?.flags?.subclassUtility) {
    return "subclassUtility";
  }
  if (/correction|double-?tap|chasseur\s+vorace/.test(haystack)) return "utility";
  return "";
}

async function spendTechniqueUtilityCosts(actor, item) {
  const spentNotes = [];
  const eSpend = await spendResource(
    actor,
    "system.resources.e.value",
    toNumber(item.system?.costE, 0),
    "E"
  );
  if (!eSpend.ok) return null;
  if (eSpend.note) spentNotes.push(eSpend.note);

  const rpSpend = await spendResource(
    actor,
    "system.resources.rp.value",
    toNumber(item.system?.costRp, 0),
    "RP"
  );
  if (!rpSpend.ok) return null;
  if (rpSpend.note) spentNotes.push(rpSpend.note);

  const bdpSpend = await spendResource(
    actor,
    "system.resources.bdp.value",
    toNumber(item.system?.costBdp, 0),
    "BDP",
    { sourceItem: item }
  );
  if (!bdpSpend.ok) return null;
  if (bdpSpend.note) spentNotes.push(bdpSpend.note);

  if (!toNumber(item.system?.costBdp, 0)) {
    const demonisationGain = await applyDemonisationGain(actor, item, {
      reason: item.name,
    });
    if (demonisationGain) spentNotes.push(`Demonisation +${demonisationGain}`);
  }
  return spentNotes;
}

function getLimbLabel(key) {
  return LIMB_DEFINITIONS.find((entry) => entry.key === key)?.label || key;
}

function getDamagedLimbs(actor) {
  const limbStates = FU.getProperty(actor, "system.combat.injuries.limbs") || {};
  return Object.entries(limbStates)
    .filter(([, state]) => state?.severed || state?.broken || state?.injured)
    .map(([key, state]) => ({
      key,
      label: `${getLimbLabel(key)}${state.severed ? " (sectionne)" : state.broken ? " (casse)" : " (blesse)"}`,
    }));
}

async function promptRegrowLimb(actor, candidates) {
  if (candidates.length <= 1) return candidates[0]?.key || "";
  const options = candidates
    .map((entry) => `<option value="${entry.key}">${entry.label}</option>`)
    .join("");
  return new Promise((resolve) => {
    new Dialog(
      {
        title: "Regeneration de membre",
        content: `
          <div class="form-group">
            <label>Membre a regenerer</label>
            <select id="bl-regrow-limb">${options}</select>
          </div>
        `,
        buttons: {
          ok: {
            label: "Regenerer",
            callback: (html) => resolve(String(html.find("#bl-regrow-limb").val() || "")),
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

async function useRegrowPower(actor, item) {
  const candidates = getDamagedLimbs(actor);
  if (!candidates.length) {
    ui.notifications.info(`${actor.name} n'a aucun membre coche a regenerer.`);
    return null;
  }

  const continuous = itemRuleText(item).includes("regeneration continue des membres");
  const selectedKeys =
    actor.type === "demonist" && !continuous
      ? [await promptRegrowLimb(actor, candidates)].filter(Boolean)
      : candidates.map((entry) => entry.key);
  if (!selectedKeys.length) return null;

  const spentNotes = await spendTechniqueUtilityCosts(actor, item);
  if (!spentNotes) return null;

  const updates = {};
  for (const key of selectedKeys) {
    updates[`system.combat.injuries.limbs.${key}.injured`] = false;
    updates[`system.combat.injuries.limbs.${key}.broken`] = false;
    updates[`system.combat.injuries.limbs.${key}.severed`] = false;
    updates[`system.combat.injuries.limbs.${key}.notes`] = "";
    updates[`system.combat.injuries.targetedDamage.${key}`] = 0;
  }
  await actor.update(updates);

  const labels = selectedKeys.map(getLimbLabel).join(", ");
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<div class="bl-card"><b>${actor.name}</b> utilise <b>${item.name}</b> et regenere: ${labels}. <small>${spentNotes.join(" • ") || "Sans cout"}</small></div>`,
  });
  return selectedKeys;
}

async function promptDemonistHealingRank(actor) {
  const stored = String(actor.system?.support?.recentDemonFleshRank || "");
  if (DEMONIST_HEALING_BY_FLESH_RANK[stored]) return stored;
  const options = Object.keys(DEMONIST_HEALING_BY_FLESH_RANK)
    .map((rank) => `<option value="${rank}">${rank}</option>`)
    .join("");
  return new Promise((resolve) => {
    new Dialog(
      {
        title: "Rang de chair demoniaque recente",
        content: `
          <div class="form-group">
            <label>Rang</label>
            <select id="bl-healing-rank">${options}</select>
          </div>
        `,
        buttons: {
          ok: {
            label: "Valider",
            callback: (html) => resolve(String(html.find("#bl-healing-rank").val() || "")),
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

async function useHealingPower(actor, item) {
  let rank = String(actor.system?.class?.rank || "");
  let formula = DEMON_HEALING_BY_RANK[rank];
  if (actor.type === "demonist") {
    rank = await promptDemonistHealingRank(actor);
    if (!rank) return null;
    if (String(actor.system?.support?.recentDemonFleshRank || "") !== rank) {
      await actor.update({ "system.support.recentDemonFleshRank": rank });
    }
    formula = DEMONIST_HEALING_BY_FLESH_RANK[rank];
  }
  if (!formula) {
    ui.notifications.warn("Aucune formule de soin connue pour ce rang.");
    return null;
  }

  const spentNotes = await spendTechniqueUtilityCosts(actor, item);
  if (!spentNotes) return null;

  const roll = await new Roll(formula).evaluate({ async: true });
  const hpValue = toNumber(actor.system?.resources?.hp?.value, 0);
  const hpMax = toNumber(
    actor.type === "demonist"
      ? actor.system?.resources?.hp?.healableMax
      : actor.system?.resources?.hp?.max,
    hpValue
  );
  const healed = Math.max(0, Math.min(hpMax - hpValue, toNumber(roll.total, 0)));
  const next = Math.max(0, Math.min(hpMax, hpValue + healed));
  await actor.update({ "system.resources.hp.value": next });

  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<div class="bl-card"><b>${actor.name}</b> utilise <b>${item.name}</b> (${rank}) et recupere ${healed} PV (${hpValue} -> ${next}). <small>${spentNotes.join(" • ") || "Sans cout"}</small></div>`,
  });
  return healed;
}

async function useStoreBdaPower(actor, item) {
  const spentNotes = await spendTechniqueUtilityCosts(actor, item);
  if (!spentNotes) return null;

  await actor.setFlag(SYSTEM_ID, "storedDemonicArt", {
    itemId: item.id,
    itemName: item.name,
    combatId: game.combat?.id || "",
    round: game.combat?.round ?? null,
    timestamp: Date.now(),
  });
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<div class="bl-card"><b>${actor.name}</b> stocke un Art Demoniaque pour un combat futur. <small>${spentNotes.join(" • ") || "Sans cout"}</small></div>`,
  });
  return true;
}

async function useDemonFocus(actor, item) {
  const bdpPath = "system.resources.bdp.value";
  const current = toNumber(FU.getProperty(actor, bdpPath), 0);
  const cost = Math.ceil(current / 2);
  if (cost <= 0) {
    ui.notifications.warn(`${actor.name} n'a pas assez de BDP pour Concentration demoniaque.`);
    return null;
  }
  await actor.update({ [bdpPath]: Math.max(0, current - cost) });
  await actor.setFlag(SYSTEM_ID, "demonFocusExtraAction", {
    itemId: item.id,
    itemName: item.name,
    cost,
    combatId: game.combat?.id || "",
    round: game.combat?.round ?? null,
    timestamp: Date.now(),
  });
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<div class="bl-card"><b>${actor.name}</b> utilise <b>${item.name}</b> : BDP ${current} -> ${current - cost}, action supplementaire disponible ce tour.</div>`,
  });
  return true;
}

async function useBloodFury(actor, item) {
  await actor.setFlag(SYSTEM_ID, "bloodFury", {
    itemId: item.id,
    itemName: item.name,
    uses: Math.max(1, toNumber(item.system?.flags?.bloodFuryCharges, 3) || 3),
    damage: item.system?.damage || "1d6",
    combatId: game.combat?.id || "",
    round: game.combat?.round ?? null,
    timestamp: Date.now(),
  });
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<div class="bl-card"><b>${actor.name}</b> active <b>${item.name}</b>. Les 3 prochaines attaques eligibles gagnent +${item.system?.damage || "1d6"}.</div>`,
  });
  return true;
}

async function useStableShot(actor, item) {
  await actor.setFlag(SYSTEM_ID, "stableShot", {
    itemId: item.id,
    itemName: item.name,
    attackBonus: 8,
    combatId: game.combat?.id || "",
    round: game.combat?.round ?? null,
    timestamp: Date.now(),
  });
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<div class="bl-card"><b>${actor.name}</b> prend une <b>position stable</b>. La prochaine attaque a distance gagne +8 au toucher; le deplacement est a gerer comme immobilise.</div>`,
  });
  return true;
}

async function useSubclassUtility(actor, item) {
  const spentNotes = await spendTechniqueUtilityCosts(actor, item);
  if (!spentNotes) return null;

  const flags = item.system?.flags || {};
  if (flags.basicAttackMod) {
    await actor.setFlag(SYSTEM_ID, "subclassBasicAttack", {
      ...flags.basicAttackMod,
      itemId: item.id,
      itemName: item.name,
      combatId: game.combat?.id || "",
      round: game.combat?.round ?? null,
      timestamp: Date.now(),
    });
  }

  const selfEffects = FU.getProperty(item, "system.selfEffects") || [];
  if (Array.isArray(selfEffects) && selfEffects.length) {
    await applyEffectsList({
      source: actor,
      target: actor,
      effects: selfEffects,
      origin: item.uuid,
    });
  }

  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<div class="bl-card"><b>${actor.name}</b> utilise <b>${item.name}</b>. <small>${item.system?.usageNote || ""}</small>${spentNotes.length ? `<small>${spentNotes.join(" • ")}</small>` : ""}</div>`,
  });
  return true;
}

async function useSelfUtility(actor, item) {
  const spentNotes = await spendTechniqueUtilityCosts(actor, item);
  if (!spentNotes) return null;

  const selfEffects = FU.getProperty(item, "system.selfEffects") || [];
  if (Array.isArray(selfEffects) && selfEffects.length) {
    await applyEffectsList({
      source: actor,
      target: actor,
      effects: selfEffects,
      origin: item.uuid,
    });
  }

  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<div class="bl-card"><b>${actor.name}</b> utilise <b>${item.name}</b>. <small>${spentNotes.join(" • ") || "Sans cout"}</small></div>`,
  });
  return true;
}

async function useDemonistUtility(attacker, item, kind) {
  switch (kind) {
    case "expulsion":
      return useExpulsion(attacker, item);
    case "regrow":
      return useRegrowPower(attacker, item);
    case "heal":
      return useHealingPower(attacker, item);
    case "storeBda":
      return useStoreBdaPower(attacker, item);
    case "demonFocus":
      return useDemonFocus(attacker, item);
    case "bloodFury":
      return useBloodFury(attacker, item);
    case "stableShot":
      return useStableShot(attacker, item);
    case "subclassUtility":
      return useSubclassUtility(attacker, item);
    case "selfBoost":
    case "utility":
      return useSelfUtility(attacker, item);
    default:
      return null;
  }
}

function getQuickShotWeapon(actor) {
  return actor.items?.find((owned) => owned.type === "firearm") || null;
}

async function evaluateTechniqueDamageRoll(expr, edge = 0) {
  const normalized = Math.sign(Number(edge) || 0);
  const first = await new Roll(expr).evaluate({ async: true });
  if (!normalized) {
    return { roll: first, altRoll: null, mode: "normal" };
  }

  const second = await new Roll(expr).evaluate({ async: true });
  const best =
    normalized > 0
      ? (Number(second.total) || 0) > (Number(first.total) || 0)
      : (Number(second.total) || 0) < (Number(first.total) || 0);

  return {
    roll: best ? second : first,
    altRoll: best ? first : second,
    mode: normalized > 0 ? "advantage" : "disadvantage",
  };
}

async function applyBeastDislocation(attacker) {
  if (!attacker) return null;
  const limbs = FU.getProperty(attacker, "system.combat.injuries.limbs") || {};
  const armKey =
    !limbs.rightArm?.injured && !limbs.rightArm?.broken && !limbs.rightArm?.severed
      ? "rightArm"
      : "leftArm";
  const currentNotes = String(FU.getProperty(attacker, `system.combat.injuries.limbs.${armKey}.notes`) || "");
  await attacker.update({
    [`system.combat.injuries.limbs.${armKey}.injured`]: true,
    [`system.combat.injuries.limbs.${armKey}.notes`]: [currentNotes, "Dislocation du Souffle de la Bete - remise en place manuelle requise."]
      .filter(Boolean)
      .join(" "),
  });
  return armKey;
}

function getSelectedTargets(attackerToken) {
  return Array.from(game.user.targets ?? []).filter(
    (target) => target.id !== attackerToken?.id && target.actor
  );
}

function getTechniqueTargetCap(attacker, item) {
  const automation = item.system?.automation || {};
  const base = Number(automation.targetCapBase ?? 0) || 0;
  const scale = Number(automation.targetCapScalePerLevel ?? 0) || 0;
  const rankLevel = Number(attacker.system?.class?.level ?? 1) || 1;
  if (!base) return 0;
  return Math.max(1, base + Math.max(0, rankLevel - 2) * scale);
}

function limitTargetsForTechnique(attacker, item, targets) {
  const cap = getTechniqueTargetCap(attacker, item);
  if (!cap || targets.length <= cap) return targets;
  ui.notifications.info(`La technique ${item.name} ne peut affecter que ${cap} cible(s) avec le rang actuel.`);
  return targets.slice(0, cap);
}

function getBurnedTargets(excludeActorId = null) {
  return (canvas?.tokens?.placeables ?? []).filter((token) => {
    if (!token?.actor || token.document.hidden) return false;
    if (token.actor.id === excludeActorId) return false;
    return !!token.actor.getFlag(SYSTEM_ID, "burnMoonAsh") || !!token.actor.system?.conditions?.burn?.active;
  });
}

async function promptBurnedTarget(attacker) {
  const options = getBurnedTargets(attacker?.id);
  if (!options.length) {
    ui.notifications.warn("Aucune cible marquee par les cendres n'est disponible.");
    return null;
  }

  const htmlOptions = options
    .map((token) => `<option value="${token.id}">${token.name}</option>`)
    .join("");

  return new Promise((resolve) => {
    new Dialog(
      {
        title: "Choisir une destination de cendres",
        content: `
          <div class="form-group">
            <label>Cible marquee</label>
            <select id="bl-burned-target">${htmlOptions}</select>
          </div>
        `,
        buttons: {
          ok: {
            label: "Se deplacer",
            callback: (html) => resolve(canvas.tokens.get(html.find("#bl-burned-target").val())),
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

function getAoETargets(attackerToken, rangeM, { antiFriendlyFire = false } = {}) {
  const selected = getSelectedTargets(attackerToken).filter(
    (target) =>
      distMetersChebyshev(attackerToken, target) <= rangeM &&
      (!antiFriendlyFire || target.document.disposition !== attackerToken.document.disposition)
  );
  if (selected.length) return selected;

  return canvas.tokens.placeables.filter((token) => {
    if (!token?.actor || token.id === attackerToken?.id || token.document.hidden) return false;
    if (distMetersChebyshev(attackerToken, token) > rangeM) return false;
    if (!antiFriendlyFire) return true;
    return token.document.disposition !== attackerToken.document.disposition;
  });
}

async function resolveTechniqueTargets(attacker, attackerToken, item, ctx = {}) {
  const rangeM = getTechniqueRange(item, ctx);
  const area = item.system?.automation?.area || (item.system?.flags?.aoe ? "allInRange" : "single");
  const antiFriendlyFire =
    !!item.system?.flags?.antiFriendlyFire || hasLoveFriendlyFireProtection(attacker, item);
  if (area === "allInRange" || area === "cone") {
    const targets = getAoETargets(attackerToken, rangeM, {
      antiFriendlyFire,
    });
    if (!targets.length) {
      ui.notifications.warn("Aucune cible valide dans la zone.");
    }
    return targets;
  }

  const target = await pickTarget(attackerToken.id);
  return target?.actor ? [target] : [];
}

async function promptStoneHeadMode(attacker, item) {
  const damageText = `${item.system?.damageText || ""}\n${item.system?.damage || ""}`;
  if (!/tête de hache/i.test(damageText)) return null;
  if (!game.user.isGM && !attacker.isOwner) return null;

  return new Promise((resolve) => {
    new Dialog(
      {
        title: "Pierre - Tete de Hache",
        content: "<p>Choisis l'extremite employee pour cette technique.</p>",
        buttons: {
          maul: {
            label: "Masse (Force + 6)",
            callback: () => resolve("maul"),
          },
          axe: {
            label: "Hache (Finesse + 2)",
            callback: () => resolve("axe"),
          },
        },
        default: "maul",
      },
      { width: 420 }
    ).render(true);
  });
}

async function promptTechniqueMode(item) {
  if (item.system?.automation?.alternativeMode !== "deflect") return "attack";
  return new Promise((resolve) => {
    new Dialog(
      {
        title: `${item.name} - Mode`,
        content: "<p>Utiliser la technique en attaque ou en posture defensible ?</p>",
        buttons: {
          attack: { label: "Attaque", callback: () => resolve("attack") },
          deflect: { label: "Deflecteur", callback: () => resolve("deflect") },
        },
        default: "attack",
      },
      { width: 420 }
    ).render(true);
  });
}

async function activateDeflectStance(actor, item) {
  const round = Number(game.combat?.round ?? 0) || null;
  await actor.setFlag(SYSTEM_ID, "deflectStance", {
    itemId: item.id,
    itemName: item.name,
    round,
  });
}

async function applyTechniqueDamage({
  attacker,
  attackerToken,
  targetToken,
  item,
  ctx,
  damage,
  totalDamage,
  applyCoatedPoison = false,
}) {
  const actor = targetToken?.actor;
  if (!actor) return;

  const hpPath = "system.resources.hp.value";
  const currentHp = Number(FU.getProperty(actor, hpPath) ?? 0) || 0;
  const nextHp = Math.max(0, currentHp - damage);
  await actor.update({ [hpPath]: nextHp });
  await noteActorDamageTaken(actor, damage);

  await applyOnHit(attacker, targetToken, item, ctx, {
    tookDamage: true,
    wasKilled: nextHp === 0,
  });

  const afflictionStacks = Number(item.system?.automation?.afflictionStacks ?? 0) || 0;
  if (afflictionStacks > 0) {
    const currentPoison = FU.getProperty(actor, "system.conditions.poisoned") || {};
    const poisonConfig = inferPoisonApplication(item, actor);
    const nextPoison = buildPoisonApplicationUpdate(currentPoison, {
      addStacks: afflictionStacks,
      ...poisonConfig,
    });
    await actor.update({
      "system.conditions.poisoned": nextPoison,
    });
  }

  const conditionKey = String(item.system?.automation?.afflictionCondition || "").trim();
  const conditionStacks = Number(item.system?.automation?.afflictionIntensity ?? 0) || 0;
  if (conditionKey) {
    const currentState = FU.getProperty(actor, `system.conditions.${conditionKey}`) || {};
    const currentIntensity = Math.max(0, Number(currentState.intensity || 0));
    await actor.update({
      [`system.conditions.${conditionKey}.active`]: true,
      [`system.conditions.${conditionKey}.intensity`]: Math.max(1, currentIntensity + Math.max(1, conditionStacks || 1)),
    });
  }

  if (item.system?.automation?.markAsh) {
    await actor.setFlag(SYSTEM_ID, "burnMoonAsh", true);
  }

  let coatedPoisonResult = null;
  if (applyCoatedPoison) {
    coatedPoisonResult = await applyActivePoisonCoating(attacker, actor, {
      sourceLabel: item.name,
    });
  }

  try {
    const techEffects = FU.getProperty(item, "system.effects") || [];
    if (Array.isArray(techEffects) && techEffects.length) {
      await applyEffectsList({
        source: attacker,
        target: targetToken,
        effects: techEffects,
        origin: item.uuid,
      });
    }
  } catch (error) {
    console.error("BL | applyEffectsList (on-hit) failed:", error);
  }

  const enduranceRestore = String(item.system?.automation?.enduranceRestore || "none");
  if (FU.hasProperty(attacker, "system.resources.e.value") && enduranceRestore !== "none") {
    const currentE = Number(FU.getProperty(attacker, "system.resources.e.value") ?? 0) || 0;
    const maxE = Number(FU.getProperty(attacker, "system.resources.e.max") ?? currentE) || currentE;
    const restore =
      enduranceRestore === "previousDamageTaken"
        ? getPreviousRoundDamageTaken(attacker)
        : totalDamage;
    const recovered = Math.max(0, Math.min(maxE - currentE, Number(restore) || 0));
    if (recovered > 0) {
      await attacker.update({ "system.resources.e.value": currentE + recovered });
      await ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor: attacker }),
        content: `<em>${attacker.name} recupere ${recovered} E grace a ${item.name}.</em>`,
      });
    }
  }

  return { currentHp, nextHp, coatedPoisonResult };
}

export async function useTechnique(attacker, item, { controlledToken = null } = {}) {
  if (!attacker || !item) return;

  if (!(game.user.isGM || attacker.isOwner)) {
    return ui.notifications.warn("Tu n'es pas autorise a utiliser les techniques de cet acteur.");
  }

  if (attacker.getFlag(SYSTEM_ID, "mustRest")) {
    return ui.notifications.warn(
      `${attacker.name} est a 0E : il doit se reposer ce round avant d'attaquer.`
    );
  }

  const restriction = getConditionActionRestriction(attacker, "technique");
  if (restriction.blocked) {
    return ui.notifications.warn(`${attacker.name} ne peut pas utiliser cette technique. ${restriction.reason}`);
  }

  const breathKey = item.system?.breathKey || normalizeBreathName(item.system?.breath);
  if (item.type === "technique" && breathKey && !actorHasBreath(attacker, breathKey)) {
    return ui.notifications.warn(
      `${attacker.name} ne possede pas le souffle requis pour ${item.name}.`
    );
  }

  const utilityKind = getDemonistUtilityKind(item);
  if (utilityKind) {
    return useDemonistUtility(attacker, item, utilityKind);
  }

  let attackerToken = resolveCanvasToken(controlledToken, attacker);
  if (!attackerToken) {
    return ui.notifications.warn("Selectionne d'abord le token de l'attaquant.");
  }

  const automation = item.system?.automation || {};
  const chargeTurns = Number(automation.chargeTurns ?? item.system?.flags?.charge ?? 0) || 0;
  const cooldownRound = getTechniqueCooldown(attacker, item);
  if (chargeTurns > 0 && !game.combat) {
    return ui.notifications.warn("Les techniques a temps de charge necessitent un combat actif.");
  }
  if (cooldownRound && game.combat && Number(game.combat.round) < cooldownRound) {
    return ui.notifications.warn(
      `${item.name} est encore en recharge jusqu'au round ${cooldownRound}.`
    );
  }

  const chargeState = await getTechniqueChargeState(attacker);
  if (chargeState?.itemId && chargeState.itemId !== item.id && !isTechniqueChargeReady(chargeState)) {
    return ui.notifications.warn(
      `${attacker.name} charge deja ${chargeState.itemName} jusqu'au round ${chargeState.readyRound}.`
    );
  }
  if (chargeTurns > 0 && (!chargeState || chargeState.itemId !== item.id)) {
    const started = await startTechniqueCharge(attacker, item, chargeTurns);
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: attacker }),
      content: `<em>${attacker.name} commence a charger ${item.name}. Disponible au round ${started.readyRound}. Une attaque subie interrompt la charge.</em>`,
    });
    return;
  }
  if (chargeState?.itemId === item.id && !isTechniqueChargeReady(chargeState)) {
    return ui.notifications.warn(
      `${item.name} n'est pas encore pret. Round requis: ${chargeState.readyRound}.`
    );
  }
  if (chargeState?.itemId === item.id && isTechniqueChargeReady(chargeState)) {
    await clearTechniqueCharge(attacker);
  }

  const mode = await promptTechniqueMode(item);
  if (mode === "deflect") {
    const eSpend = await spendResource(
      attacker,
      "system.resources.e.value",
      Number(item.system?.costE ?? 0) || 0,
      "E"
    );
    if (!eSpend.ok) return;
    await activateDeflectStance(attacker, item);
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: attacker }),
      content: `<div class="bl-card"><b>${attacker.name}</b> adopte la posture <b>${item.name}</b> jusqu'a la fin du round pour annuler une prochaine attaque.</div>`,
    });
    return;
  }

  const ctx = { attackerToken };
  const headWeaponMode = await promptStoneHeadMode(attacker, item);
  if (headWeaponMode) ctx.headWeaponMode = headWeaponMode;

  if (isExpulsionItem(item)) {
    return useExpulsion(attacker, item);
  }

  if (automation.teleportToBurned) {
    const spentNotes = [];
    const rpSpend = await spendResource(
      attacker,
      "system.resources.rp.value",
      Number(item.system?.costRp ?? 0) || 0,
      "RP"
    );
    if (!rpSpend.ok) return;
    if (rpSpend.note) spentNotes.push(rpSpend.note);

    const bdpSpend = await spendResource(
      attacker,
      "system.resources.bdp.value",
      Number(item.system?.costBdp ?? 0) || 0,
      "BDP",
      { sourceItem: item }
    );
    if (!bdpSpend.ok) return;
    if (bdpSpend.note) spentNotes.push(bdpSpend.note);

    const destination = await promptBurnedTarget(attacker);
    if (!destination) return;
    await attackerToken.document.update({
      x: destination.document.x,
      y: destination.document.y,
    });
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: attacker }),
      content: `<div class="bl-card"><b>${attacker.name}</b> utilise <b>${item.name}</b> et se teleporte aux cendres de <b>${destination.name}</b>. <small>${spentNotes.join(" • ") || "Sans cout"}</small></div>`,
    });
    return;
  }

  if (automation.summonFormula) {
    const spentNotes = [];
    const eSpend = await spendResource(
      attacker,
      "system.resources.e.value",
      Number(item.system?.costE ?? 0) || 0,
      "E"
    );
    if (!eSpend.ok) return;
    if (eSpend.note) spentNotes.push(eSpend.note);

    const rpSpend = await spendResource(
      attacker,
      "system.resources.rp.value",
      Number(item.system?.costRp ?? 0) || 0,
      "RP"
    );
    if (!rpSpend.ok) return;
    if (rpSpend.note) spentNotes.push(rpSpend.note);

    const bdpSpend = await spendResource(
      attacker,
      "system.resources.bdp.value",
      Number(item.system?.costBdp ?? 0) || 0,
      "BDP",
      { sourceItem: item }
    );
    if (!bdpSpend.ok) return;
    if (bdpSpend.note) spentNotes.push(bdpSpend.note);

    const summonRoll = await new Roll(String(automation.summonFormula)).evaluate({ async: true });
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: attacker }),
      content: `<div class="bl-card"><b>${attacker.name}</b> utilise <b>${item.name}</b> et invoque ${summonRoll.total} serviteur(s). <small>${spentNotes.join(" â€¢ ") || "Sans cout"}</small></div>`,
    });
    return;
  }

  let targetTokens = await resolveTechniqueTargets(attacker, attackerToken, item, ctx);
  targetTokens = limitTargetsForTechnique(attacker, item, targetTokens);
  if (!targetTokens.length) return;

  const firstTarget = targetTokens[0];
  const pre = await applyPreHit(attacker, firstTarget, item, ctx);
  const rangeM = getTechniqueRange(item, ctx);

  targetTokens = targetTokens.filter(
    (targetToken) =>
      item.system?.automation?.unlimitedRange ||
      distMetersChebyshev(attackerToken, targetToken) <= rangeM
  );
  if (!targetTokens.length) {
    return ui.notifications.warn(`Portee insuffisante : aucune cible dans ${rangeM} m.`);
  }

  const spentNotes = [];
  const eSpend = await spendResource(
    attacker,
    "system.resources.e.value",
    Number(pre.cost ?? item.system?.costE ?? 0) || 0,
    "E"
  );
  if (!eSpend.ok) return;
  if (eSpend.note) spentNotes.push(eSpend.note);

  const rpSpend = await spendResource(
    attacker,
    "system.resources.rp.value",
    Number(item.system?.costRp ?? 0) || 0,
    "RP"
  );
  if (!rpSpend.ok) return;
  if (rpSpend.note) spentNotes.push(rpSpend.note);

  const bdpSpend = await spendResource(
    attacker,
    "system.resources.bdp.value",
    Number(item.system?.costBdp ?? 0) || 0,
    "BDP",
    { sourceItem: item }
  );
  if (!bdpSpend.ok) return;
  if (bdpSpend.note) spentNotes.push(bdpSpend.note);

  if (automation.noDamage && Number(automation.delayedDamageRounds ?? 0) > 0) {
    const formula = String(automation.delayedDamageFormula || item.system?.damage || "0");
    for (const targetToken of targetTokens) {
      await queueDemonPendingEffect(targetToken.actor, {
        delayedRounds: Number(automation.delayedDamageRounds || 1),
        formula: buildFormulaWithActorStats(formula, attacker, ctx),
        label: item.name,
        sourceName: attacker.name,
        afflictionCondition: String(automation.afflictionCondition || ""),
        afflictionIntensity: Number(automation.afflictionIntensity || 0),
        markAsh: !!automation.markAsh,
      });
    }
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: attacker }),
      content: `<div class="bl-card"><b>${attacker.name}</b> prepare <b>${item.name}</b> sur ${targetTokens.map((token) => token.name).join(", ")}. L'effet se declenchera dans ${automation.delayedDamageRounds} round(s). <small>${spentNotes.join(" • ") || "Sans cout"}</small></div>`,
    });
    return;
  }

  if (automation.noDamage && automation.afflictionCondition) {
    for (const targetToken of targetTokens) {
      const targetActor = targetToken.actor;
      const currentState = FU.getProperty(targetActor, `system.conditions.${automation.afflictionCondition}`) || {};
      const nextIntensity =
        Math.max(0, Number(currentState.intensity || 0)) + Math.max(1, Number(automation.afflictionIntensity || 1));
      await targetActor.update({
        [`system.conditions.${automation.afflictionCondition}.active`]: true,
        [`system.conditions.${automation.afflictionCondition}.intensity`]: Math.max(1, nextIntensity),
      });
      if (automation.markAsh) {
        await targetActor.setFlag(SYSTEM_ID, "burnMoonAsh", true);
      }
    }
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: attacker }),
      content: `<div class="bl-card"><b>${attacker.name}</b> utilise <b>${item.name}</b> sur ${targetTokens.map((token) => token.name).join(", ")}. <small>${spentNotes.join(" • ") || "Sans cout"}</small></div>`,
    });
    return;
  }

  try {
    const selfEffects = FU.getProperty(item, "system.selfEffects") || [];
    if (Array.isArray(selfEffects) && selfEffects.length) {
      await applyEffectsList({
        source: attacker,
        target: attackerToken,
        effects: selfEffects,
        origin: item.uuid,
      });
    }
  } catch (error) {
    console.error("BL | applyEffectsList (self) failed:", error);
  }

  const damageEdge = (Number(pre.rollEdge?.damage ?? 0) || 0) + (attacker.system?.states?.marque ? 1 : 0);
  const damageEval = await evaluateTechniqueDamageRoll(
    buildFormulaWithActorStats(pre.dmgExpr || "1d8", attacker, ctx),
    damageEdge
  );
  const damageRoll = damageEval.roll;
  const activeCoating = getActivePoisonCoating(attacker);

  const noteEntries = [...(pre.notes || []), ...(item.system?.specialLines || [])];
  if (damageEval.altRoll) {
    noteEntries.push(
      `${damageEval.mode === "advantage" ? "Jet secondaire favorable" : "Jet secondaire defavorable"} : ${damageEval.altRoll.total}`
    );
  }

  const targetRows = targetTokens
    .map((targetToken) => {
      const extraButtons = [
        pre.ui?.canDislocate && String(targetToken?.actor?.type || "").toLowerCase().includes("demon")
          ? `<button class="bl-dislocate" data-target-token="${targetToken.id}" data-damage="${damageRoll.total}">Dislocation</button>`
          : "",
        activeCoating
          ? `<button class="bl-takedmg-poison" data-target-token="${targetToken.id}" data-damage="${damageRoll.total}">Prendre + ${activeCoating.itemName}</button>`
          : "",
      ]
        .filter(Boolean)
        .join("");

      return buildReactionTargetRow({
        attackerToken,
        targetToken,
        damageTotal: damageRoll.total,
        allowDodge:
          !item.system?.automation?.cannotBeDodged && !item.system?.automation?.cannotBeReactedTo,
        allowReactions: !item.system?.automation?.cannotBeReactedTo,
        allowWaterDeflect:
          !item.system?.automation?.cannotBeReactedTo && isTechniqueRanged(item, rangeM),
        extraButtonsHtml: extraButtons,
      });
    })
    .join("");

  const utilityButtons = `
    <div class="flexrow" style="gap:.35rem; flex-wrap:wrap;">
      ${
        pre.ui?.canDash
          ? `<button class="bl-dash" data-attacker-token="${attackerToken.id}">Dash (6 m)</button>`
          : ""
      }
      ${
        pre.ui?.canMist
          ? `<button class="bl-mist" data-target-token="${firstTarget.id}">Brume (3 m)</button>`
          : ""
      }
      ${
        pre.ui?.canQuickShot
          ? `<button class="bl-quickshot" data-attacker-token="${attackerToken.id}">Six-coups</button>`
          : ""
      }
    </div>
  `;

  const notes =
    noteEntries.length > 0
      ? `<div style="opacity:.8;"><small>${noteEntries.join(" • ")}</small></div>`
      : "";

  const poisonNote = activeCoating
    ? `<div><small>Poison prepare: ${activeCoating.itemName} sur ${activeCoating.weaponName || "l'arme"}.</small></div>`
    : "";

  const chatMessage = await damageRoll.toMessage({
    speaker: ChatMessage.getSpeaker({ actor: attacker }),
    flavor: `
      <div class="bl-card" style="display:grid; gap:.35rem;">
        <div><b>${attacker.name}</b> utilise <b>${item.name}</b></div>
        <div><small>${spentNotes.join(" • ") || "Sans cout"} • Portee: ${
          item.system?.automation?.unlimitedRange ? "illimitee" : `${rangeM} m`
        } • Cibles: ${targetTokens.map((token) => token.name).join(", ")}</small></div>
        <div><b>Degats potentiels:</b> ${damageRoll.total} <small>(${pre.dmgExpr})</small></div>
        ${poisonNote}
        ${notes}
        ${utilityButtons}
        <hr>
        <div class="bl-target-list" style="display:grid; gap:.5rem;">${targetRows}</div>
      </div>
    `,
  });

  if (Number(automation.cooldownTurns ?? 0) > 0) {
    await setTechniqueCooldown(attacker, item, Number(automation.cooldownTurns));
  }

  Hooks.once("renderChatMessage", (message, html) => {
    if (message.id !== chatMessage.id) return;

    const disableTargetButtons = (tokenId) => {
      html.find(`button[data-target-token="${tokenId}"]`).prop("disabled", true);
    };

    html.find(".bl-dodge").on("click", async (event) => {
      const button = $(event.currentTarget);
      const token = canvas.tokens.get(String(button.attr("data-target-token")));
      const actor = token?.actor;
      if (!actor || !canInteractWithToken(token)) return;

      const currentRp = Number(FU.getProperty(actor, "system.resources.rp.value") ?? 0) || 0;
      if (currentRp < 1) {
        ui.notifications.warn(`Pas assez de RP (1 requis, actuel ${currentRp}).`);
        return;
      }
      await actor.update({ "system.resources.rp.value": currentRp - 1 });
      html
        .find(`.bl-target-row[data-target-token="${token.id}"] .bl-target-result`)
        .html("<em>Esquive reussie : degats annules.</em>");
      await applyOnHit(attacker, token, item, ctx, { tookDamage: false });
      disableTargetButtons(token.id);
    });

    html.find(".bl-deflect").on("click", async (event) => {
      const button = $(event.currentTarget);
      const token = canvas.tokens.get(String(button.attr("data-target-token")));
      const actor = token?.actor;
      if (!actor || !canInteractWithToken(token)) return;

      const currentRp = Number(FU.getProperty(actor, "system.resources.rp.value") ?? 0) || 0;
      if (currentRp < 1) {
        ui.notifications.warn(`Pas assez de RP (1 requis, actuel ${currentRp}).`);
        return;
      }
      await actor.update({ "system.resources.rp.value": currentRp - 1 });
      html
        .find(`.bl-target-row[data-target-token="${token.id}"] .bl-target-result`)
        .html("<em>Deviation reussie : degats annules. Redirection manuelle.</em>");
      await applyOnHit(attacker, token, item, ctx, { tookDamage: false });
      disableTargetButtons(token.id);
    });

    html.find(".bl-stance-deflect").on("click", async (event) => {
      const button = $(event.currentTarget);
      const token = canvas.tokens.get(String(button.attr("data-target-token")));
      const actor = token?.actor;
      if (!actor || !canInteractWithToken(token)) return;
      await consumeDeflectStance(actor);
      html
        .find(`.bl-target-row[data-target-token="${token.id}"] .bl-target-result`)
        .html("<em>Posture defensive consommee : degats annules.</em>");
      disableTargetButtons(token.id);
    });

    html.find(".bl-dash").on("click", async () => {
      const tokenId = String(html.find(".bl-dash").attr("data-attacker-token"));
      const token = canvas.tokens.get(tokenId);
      if (!token || !canInteractWithToken(token)) return;
      await simpleDash(token, 6);
    });

    html.find(".bl-mist").on("click", async () => {
      await placeMistTemplate(firstTarget);
    });

    html.find(".bl-quickshot").on("click", async () => {
      const weapon = getQuickShotWeapon(attacker);
      if (!weapon) {
        ui.notifications.warn("Aucun pistolet disponible pour Six-coups.");
        return;
      }
      html.find(".bl-quickshot").prop("disabled", true);
      await rollBasicAttack(attacker, { item: weapon });
    });

    html.find(".bl-dislocate").on("click", async (event) => {
      const button = $(event.currentTarget);
      const token = canvas.tokens.get(String(button.attr("data-target-token")));
      if (!token?.actor || !canInteractWithToken(attackerToken)) return;

      const armKey = await applyBeastDislocation(attacker);
      const damage = Number(button.attr("data-damage")) || 0;
      const result = await applyTechniqueDamage({
        attacker,
        attackerToken,
        targetToken: token,
        item,
        ctx,
        damage,
        totalDamage: damage,
      });
      html
        .find(`.bl-target-row[data-target-token="${token.id}"] .bl-target-result`)
        .html(
          `<em>Dislocation (${armKey === "leftArm" ? "bras gauche" : "bras droit"}) : ${token.actor.name} prend <b>${damage}</b> degats (PV ${result.currentHp} -> ${result.nextHp}).</em>`
        );
      disableTargetButtons(token.id);
    });

    html.find(".bl-takedmg-poison").on("click", async (event) => {
      const button = $(event.currentTarget);
      const token = canvas.tokens.get(String(button.attr("data-target-token")));
      const actor = token?.actor;
      if (!actor || !canInteractWithToken(token)) return;

      const damage = Number(button.attr("data-damage")) || 0;
      const result = await applyTechniqueDamage({
        attacker,
        attackerToken,
        targetToken: token,
        item,
        ctx,
        damage,
        totalDamage: damage,
        applyCoatedPoison: true,
      });
      html
        .find(`.bl-target-row[data-target-token="${token.id}"] .bl-target-result`)
        .html(
          `<em>${actor.name} prend <b>${damage}</b> degats (PV ${result.currentHp} -> ${result.nextHp}).${result.coatedPoisonResult ? ` Poison: ${result.coatedPoisonResult.summary?.profileLabel || "dose appliquee"}.` : ""}</em>`
        );
      disableTargetButtons(token.id);
    });

    html.find(".bl-takedmg").on("click", async (event) => {
      const button = $(event.currentTarget);
      const token = canvas.tokens.get(String(button.attr("data-target-token")));
      const actor = token?.actor;
      if (!actor || !canInteractWithToken(token)) return;

      const damage = Number(button.attr("data-damage")) || 0;
      const result = await applyTechniqueDamage({
        attacker,
        attackerToken,
        targetToken: token,
        item,
        ctx,
        damage,
        totalDamage: damage,
      });
      html
        .find(`.bl-target-row[data-target-token="${token.id}"] .bl-target-result`)
        .html(
          `<em>${actor.name} prend <b>${damage}</b> degats (PV ${result.currentHp} -> ${result.nextHp}).</em>`
        );
      disableTargetButtons(token.id);
    });
  });
}
