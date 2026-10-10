import { cardFlags, registerCardType } from "./persistent-cards.mjs";
import { spendResourceCosts, applyHpDamage, restoreHp } from "../rules/resource-costs.mjs";
import { spendCombatAction } from "../rules/combat-actions.mjs";
import { activateSubclassStance } from "../rules/subclass-passives.mjs";
import { checkTechniqueUses, consumeTechniqueUse } from "../rules/technique-limits.mjs";
import { runSourceTechnique } from "../rules/source-technique-workflows.mjs";
import { beginMistTrail } from "../rules/mist-trail.mjs";
import { promptSourceMovement } from "../rules/source-movement.mjs";
import { attachSourceReactions, permitAvoidanceCounter } from "../rules/source-reactions.mjs";
import { sourceTrait, envelopingAttackPenalty } from "../rules/character-capabilities.mjs";
import { resolveDeflectStance } from "../rules/deflect-reflection.mjs";
import { applyPreHit, applyOnHit, getActiveBreaths } from "../rules/breath-effects.mjs";
import { applyEffectsList } from "../rules/effects-engine.mjs";
import { canHealActor, lockRedBladeHealing } from "../rules/combat-state.mjs";
import { promptRegenerationDuration, startRegeneration } from "../rules/regeneration.mjs";
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
  applyTargetedLimbDamage,
  setConditionState,
  spendRp,
} from "../rules/action-engine.mjs";
import {
  buildPoisonApplicationUpdate,
  inferPoisonApplication,
  getEffectiveBaseStats,
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
  const radius = await new Promise(resolve => new Dialog({ title: "Nuage manuel — arbitrage MJ",
    content: "<p>La Brume automatique couvre les cases traversées. Pour ce nuage supplémentaire, le MJ fixe le rayon en mètres.</p><input name='mistRadius' type='number' min='0.1' step='0.1' placeholder='Rayon en mètres' />",
    buttons: { apply: { label: "Placer", callback: html => { const value = Number(html.find('[name="mistRadius"]').val()); resolve(Number.isFinite(value) && value > 0 ? value : null); } }, cancel: { label: "Annuler", callback: () => resolve(null) } }, close: () => resolve(null),
  }).render(true));
  if (!radius) return;
  await canvas.scene.createEmbeddedDocuments("Region", [
    {
      name: "Brume",
      color: "#7da0ff",
      shapes: [{
        type: "circle",
        x: targetToken.center.x,
        y: targetToken.center.y,
        radius: radius * (canvas.grid.size || 100) / METERS_PER_SQUARE,
      }],
      levels: targetToken.document?.level ? [targetToken.document.level] : [],
      visibility: CONST.REGION_VISIBILITY.ALWAYS,
      ownership: { [game.user.id]: CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER },
      hidden: false,
      flags: {
        [SYSTEM_ID]: { kind: "mist", combatId: game.combat?.id || null },
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

async function spendTechniqueUtilityCosts(actor, item, enduranceCost = item.system?.costE) {
  let spirit = false;
  if (Number(enduranceCost) > Number(actor.system?.resources?.e?.value) && item.system?.flags?.ultimate && sourceTrait(actor, "spirit") && game.combat?.round > 0 && actor.getFlag(SYSTEM_ID, "spiritUseCombat") !== game.combat.id) {
    spirit = await Dialog.confirm({ title: "Esprit", content: "<p>Utiliser cette forme ultime malgré le manque d'Endurance ? Esprit ne peut servir qu'une fois par combat.</p>" });
    if (spirit) enduranceCost = 0;
  }
  const costs = [
    { path: "system.resources.e.value", cost: enduranceCost, label: "E" },
    { path: "system.resources.rp.value", cost: item.system?.costRp, label: "RP" },
    { path: "system.resources.bdp.value", cost: item.system?.costBdp, label: "BDP" },
  ];
  if (Number(item.system?.costRp) > 0 && getConditionActionRestriction(actor, "rp").blocked) return null;
  const notes = await spendCombatAction(actor, { reaction: item.system?.activation === "reaction", costs });
  if (!notes) return null;
  if (spirit) await actor.setFlag(SYSTEM_ID, "spiritUseCombat", game.combat.id);
  await consumeTechniqueUse(actor, item);
  const continuousRegeneration = /regeneration continue/.test(itemRuleText(item));
  const gain = continuousRegeneration ? 0 : await applyDemonisationGain(actor, item, { reason: item.name });
  if (gain) notes.push(`Demonisation +${gain}`);
  return notes;
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
  if (!canHealActor(actor)) return null;
  const continuous = itemRuleText(item).includes("regeneration continue des membres");
  if (continuous && actor.system?.combat?.regeneration?.active) {
    await actor.update({ "system.combat.regeneration.active": false });
    return [];
  }
  const candidates = getDamagedLimbs(actor);
  if (!candidates.length && !continuous) {
    ui.notifications.info(`${actor.name} n'a aucun membre coche a regenerer.`);
    return null;
  }

  const selectedKeys =
    actor.type === "demonist" && !continuous
      ? [await promptRegrowLimb(actor, candidates)].filter(Boolean)
      : candidates.map((entry) => entry.key);
  if (!selectedKeys.length && !continuous) return null;
  const turns = continuous || actor.type !== "demonist"
    ? await promptRegenerationDuration({ continuous }) : 0;
  if (turns === null) return null;

  const spentNotes = await spendTechniqueUtilityCosts(actor, item);
  if (!spentNotes) return null;

  await startRegeneration(actor, { limbs: selectedKeys, turns, continuous,
    demonisationPerTurn: continuous ? 1 : 0, sourceName: item.name });

  const labels = selectedKeys.map(getLimbLabel).join(", ");
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<div class="bl-card"><b>${actor.name}</b> utilise <b>${item.name}</b> sur ${labels}${turns ? ` ; repousse dans ${turns} tour(s), durée choisie par le MJ` : " ; repousse immédiate"}. <small>${spentNotes.join(" • ") || "Sans cout"}</small></div>`,
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
  if (!canHealActor(actor)) return null;
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

  const roll = await new Roll(formula).evaluate();
  const { healed, nextHp: next } = await restoreHp(actor, toNumber(roll.total, 0));
  const hpValue = next - healed;

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
  if (!(await spendResourceCosts(actor, [{ path: bdpPath, cost, label: "BDP" }]))) return null;
  if (game.combat?.started) await actor.update({
    "system.combat.actionEconomy.remainingActions": toNumber(actor.system?.combat?.actionEconomy?.remainingActions, 0) + 1,
  });
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
  await consumeTechniqueUse(actor, item);
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
  if (await activateSubclassStance(actor, item)) return true;
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
  const first = await new Roll(expr).evaluate();
  if (!normalized) {
    return { roll: first, altRoll: null, mode: "normal" };
  }

  const second = await new Roll(expr).evaluate();
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
  await attacker.setFlag(SYSTEM_ID, "beastDislocation", { armKey, before: structuredClone(limbs[armKey] || {}), combatId: game.combat?.id || "" });
  await attacker.update({
    [`system.combat.injuries.limbs.${armKey}.injured`]: true,
    [`system.combat.injuries.limbs.${armKey}.notes`]: [currentNotes, "Dislocation du Souffle de la Bête — remise en place au prochain tour via action bonus."]
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

function getAoETargets(attackerToken, rangeM, { antiFriendlyFire = false, allInRange = false } = {}) {
  const selected = getSelectedTargets(attackerToken).filter(
    (target) =>
      distMetersChebyshev(attackerToken, target) <= rangeM &&
      (!antiFriendlyFire || target.document.disposition !== attackerToken.document.disposition)
  );
  if (selected.length && !allInRange) return selected;

  return canvas.tokens.placeables.filter((token) => {
    if (!token?.actor || token.id === attackerToken?.id || token.document.hidden) return false;
    if (distMetersChebyshev(attackerToken, token) > rangeM) return false;
    if (!antiFriendlyFire) return true;
    return token.document.disposition !== attackerToken.document.disposition;
  });
}

async function resolveTechniqueTargets(attacker, attackerToken, item, ctx = {}) {
  const rangeM = getTechniqueRange(item, ctx);
  const area = hasLoveFriendlyFireProtection(attacker, item) ? "allInRange" :
    item.system?.automation?.area || (item.system?.flags?.aoe ? "allInRange" : "single");
  const antiFriendlyFire =
    !!item.system?.flags?.antiFriendlyFire || hasLoveFriendlyFireProtection(attacker, item);
  if (area === "allInRange" || area === "cone") {
    const targets = getAoETargets(attackerToken, rangeM, {
      antiFriendlyFire,
      allInRange: area === "allInRange",
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
  if (item.system?.automation?.alternativeMode !== "deflect" && !(normalizeBreathName(item.system?.breathKey) === "flame" && Number(item.system?.form) === 4)) return "attack";
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
    combatId: game.combat?.id,
    reflectAllRound: normalizeBreathName(item.system?.breathKey) === "flame" && Number(item.system?.form) === 4,
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
  const appliedDamage = await applyHpDamage(actor, damage);
  await noteActorDamageTaken(actor, damage, { attackerUuid: attacker.uuid, melee: !item.system?.ranged && Number(item.system?.range ?? 1.5) <= 1.5 });
  if (ctx.targetLimb) await applyTargetedLimbDamage(actor, ctx.targetLimb, damage);
  if (damage > 0 && ["technique", "subclassTechnique"].includes(item.type) && attacker.system?.states?.lameRouge && ["demon", "npcDemon"].includes(actor.type)) {
    await lockRedBladeHealing(actor);
  }

  await applyOnHit(attacker, targetToken, item, ctx, {
    tookDamage: true,
    wasKilled: appliedDamage.nextHp === 0,
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
    await setConditionState(actor, conditionKey, {
      active: true,
      intensity: Math.max(1, currentIntensity + Math.max(1, conditionStacks || 1)),
      duration: Number(item.system?.automation?.afflictionDuration ?? currentState.duration ?? 0),
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

  return { currentHp, nextHp: appliedDamage.nextHp, coatedPoisonResult };
}

const techniqueQueues = new WeakMap();
export function useTechnique(attacker, item, options = {}) {
  if (!attacker) return Promise.resolve();
  const next = (techniqueQueues.get(attacker) ?? Promise.resolve()).catch(error => console.error("BL | Technique", error))
    .then(() => executeTechnique(attacker, item, options));
  techniqueQueues.set(attacker, next);
  return next;
}
async function executeTechnique(attacker, item, { controlledToken = null } = {}) {
  if (!attacker || !item) return;
  if (item.system?.ruleSource?.missingFields?.length && !item.system.ruleSource.approved) {
    return ui.notifications.warn(`${item.name} : données absentes du livre (${item.system.ruleSource.missingFields.join(", ")}). Renseignez et validez les valeurs sur la fiche de technique.`);
  }

  if (!(game.user.isGM || attacker.isOwner)) {
    return ui.notifications.warn("Tu n'es pas autorise a utiliser les techniques de cet acteur.");
  }
  if (item.system?.activation === "passive") {
    return ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor: attacker }), content: `<strong>${item.name}</strong><p>${item.system.description || item.system.usageNote || "Passif : consulter la fiche."}</p>` });
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
  if (!checkTechniqueUses(attacker, item)) return;
  if (Number(item.system?.costRp) > 0 && getConditionActionRestriction(attacker, "rp").blocked) return;
  const sourceResult = await runSourceTechnique(attacker, item, { controlledToken });
  if (sourceResult !== undefined) return sourceResult;

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
  if (!String(item.system?.damage || "").trim() && !item.system?.automation?.noDamage && !item.system?.automation?.summonFormula && !item.system?.automation?.teleportToBurned && !item.system?.automation?.alternativeMode) {
    return ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor: attacker }), content: `<div class="bl-card"><strong>${item.name}</strong><p>${item.system?.usageNote || item.system?.description || "Données mécaniques à renseigner par le MJ."}</p><small>Réaction contextuelle : utiliser cette capacité depuis la carte de l'attaque entrante ou résoudre le contexte avec le MJ. Aucun dégât par défaut n'est ajouté.</small></div>` });
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
    if (!(await spendCombatAction(attacker))) return;
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
    if (!(game.combat?.round > 0)) return ui.notifications.warn("Démarrez un combat pour suivre cette posture jusqu'à la fin du round.");
    if (!(await spendTechniqueUtilityCosts(attacker, item))) return;
    await activateDeflectStance(attacker, item);
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: attacker }),
      content: `<div class="bl-card"><b>${attacker.name}</b> adopte la posture <b>${item.name}</b> jusqu'à la fin du round. ${attacker.getFlag(SYSTEM_ID,"deflectStance")?.reflectAllRound ? "Tous les dégâts peuvent être renvoyés vers une cible choisie." : "La prochaine attaque peut être annulée."}</div>`,
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
    const destination = await promptBurnedTarget(attacker);
    if (!destination) return;
    const spentNotes = await spendTechniqueUtilityCosts(attacker, item);
    if (!spentNotes) return;

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
    const spentNotes = await spendTechniqueUtilityCosts(attacker, item);
    if (!spentNotes) return;

    const summonRoll = await new Roll(String(automation.summonFormula)).evaluate();
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

  const spentNotes = await spendTechniqueUtilityCosts(attacker, item, pre.cost ?? item.system?.costE);
  if (!spentNotes) return;
  if (breathKey) await beginMistTrail(attacker);

  if (!breathKey && !item.system?.autoHit && !automation.noDamage) {
    const stat = String(item.system?.attackStat || "finesse");
    const base = getEffectiveBaseStats(attacker);
    const derived = attacker.system?.stats?.effectiveDerived || attacker.system?.stats?.derived || {};
    const bonus = stat in base ? Number(base[stat]) - 1 : Number(derived[stat] || 0);
    const hits = [];
    for (const target of targetTokens) {
      const edge = Number(pre.rollEdge?.attack || 0) - (target.actor.system?.states?.mondeTransparent ? 1 : 0) - envelopingAttackPenalty(attacker);
      const roll = await new Roll(`${edge > 0 ? "2d20kh" : edge < 0 ? "2d20kl" : "1d20"} + ${bonus}`).evaluate();
      await roll.toMessage({ speaker: ChatMessage.getSpeaker({ actor: attacker }), flavor: `${item.name} : toucher ${target.name}, CA ${target.actor.system.resources.ca}` });
      if (roll.total >= Number(target.actor.system.resources.ca)) hits.push(target);
    }
    targetTokens = hits;
    if (!targetTokens.length) return null;
  }

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
      await setConditionState(targetActor, automation.afflictionCondition, { active: true, intensity: Math.max(1, nextIntensity), duration: Number(automation.afflictionDuration || 0) });
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

  const damageEdge = (Number(pre.rollEdge?.damage ?? 0) || 0) + (breathKey && attacker.system?.states?.marque ? 1 : 0);
  if (!breathKey && attacker.system?.states?.mondeTransparent && !(item.system?.ranged && attacker.system?.progression?.flags?.firearmTraining)) pre.dmgExpr = `(${pre.dmgExpr}) * 2`;
  const damageEval = await evaluateTechniqueDamageRoll(
    buildFormulaWithActorStats(pre.dmgExpr || "1d8", attacker, ctx),
    damageEdge
  );
  const damageRoll = damageEval.roll;
  const activeCoating = getActivePoisonCoating(attacker);

  const noteEntries = [...(pre.notes || []), ...(item.system?.specialLines || []), item.system?.description].filter(Boolean);
  if (damageEval.altRoll) {
    noteEntries.push(
      `${damageEval.mode === "advantage" ? "Jet secondaire favorable" : "Jet secondaire defavorable"} : ${damageEval.altRoll.total}`
    );
  }

  const targetRows = targetTokens
    .map((targetToken) => {
      const extraButtons = [
        pre.ui?.canDislocate && String(targetToken?.actor?.type || "").toLowerCase().includes("demon")
          ? `<button class="bl-dislocate" data-target-token="${targetToken.id}" data-damage="${damageRoll.total}" disabled>Dislocation après réaction</button>`
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
          ? `<button class="bl-mist" data-target-token="${firstTarget.id}">Nuage manuel (MJ)</button>`
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

  const { attackerToken: ignoredToken, ...cardContext } = ctx;
  const chatMessage = await damageRoll.toMessage({
    flags: cardFlags("technique", {
      actorUuid: attacker.uuid, itemUuid: item.uuid,
      sceneId: canvas.scene.id, attackerTokenId: attackerToken.id,
      firstTargetId: firstTarget.id, context: cardContext,
      ranged: isTechniqueRanged(item, rangeM),
    }),
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
  return chatMessage;
}

registerCardType("technique", async (card, html, on) => {
  const attacker = await fromUuid(card.actorUuid);
  const item = await fromUuid(card.itemUuid);
  if (!attacker || !item) throw new Error("Acteur ou technique introuvable.");
  attachSourceReactions(card, html, on, attacker);
  const attackerToken = canvas.tokens.get(card.attackerTokenId);
  const firstTarget = canvas.tokens.get(card.firstTargetId);
  const ctx = { ...card.context, attackerToken };
  const disableTargetButtons = (tokenId) => {
    html.find(`button[data-target-token="${tokenId}"]`).prop("disabled", true);
  };
  const permitBeastDislocation = tokenId => html.find(`.bl-dislocate[data-target-token="${tokenId}"]`).prop("disabled", false).attr("data-reaction-used", "true");

  on(".bl-dodge", async (event) => {
    const button = $(event.currentTarget);
    const token = canvas.tokens.get(String(button.attr("data-target-token")));
    const actor = token?.actor;
    if (!actor || !canInteractWithToken(token)) return;

    if (!(await spendRp(actor, 1, "esquive de technique"))) return;
    html
      .find(`.bl-target-row[data-target-token="${token.id}"] .bl-target-result`)
      .html("<em>Esquive reussie : degats annules.</em>");
    await applyOnHit(attacker, token, item, ctx, { tookDamage: false });
    disableTargetButtons(token.id);
    permitBeastDislocation(token.id);
    permitAvoidanceCounter(html, token.id);
  });

  on(".bl-deflect", async (event) => {
    const button = $(event.currentTarget);
    const token = canvas.tokens.get(String(button.attr("data-target-token")));
    const actor = token?.actor;
    if (!actor || !canInteractWithToken(token)) return;

    if (!(await spendRp(actor, 1, "déviation de technique"))) return;
    html
      .find(`.bl-target-row[data-target-token="${token.id}"] .bl-target-result`)
      .html("<em>Deviation reussie : degats annules. Redirection manuelle.</em>");
    await applyOnHit(attacker, token, item, ctx, { tookDamage: false });
    disableTargetButtons(token.id);
    permitBeastDislocation(token.id);
    permitAvoidanceCounter(html, token.id);
  });

  on(".bl-stance-deflect", async (event) => {
    const button = $(event.currentTarget);
    const token = canvas.tokens.get(String(button.attr("data-target-token")));
    const actor = token?.actor;
    if (!actor || !canInteractWithToken(token)) return;
    const result = await resolveDeflectStance(actor, Number(html.find(`.bl-target-row[data-target-token="${token.id}"] .bl-takedmg`).attr("data-damage")) || 0);
    if (!result) return;
    html
      .find(`.bl-target-row[data-target-token="${token.id}"] .bl-target-result`)
      .text(result);
    disableTargetButtons(token.id);
  });

  on(".bl-dash", async () => {
    const tokenId = String(html.find(".bl-dash").attr("data-attacker-token"));
    const token = canvas.tokens.get(tokenId);
    if (!token || !canInteractWithToken(token)) return;
    if (getConditionActionRestriction(attacker, "rp").blocked) return;
    const movement = await promptSourceMovement(attacker, 6);
    if (!movement) return;
    if (!(await spendResourceCosts(attacker, [{ path: "system.resources.rp.value", cost: 1, label: "RP" }]))) return;
    await token.document.update(movement.destination, { animate: false });
  });

  on(".bl-mist", async () => {
    await placeMistTemplate(firstTarget);
  });

  on(".bl-quickshot", async () => {
    const weapon = getQuickShotWeapon(attacker);
    if (!weapon) {
      ui.notifications.warn("Aucun pistolet disponible pour Six-coups.");
      return;
    }
    html.find(".bl-quickshot").prop("disabled", true);
    await rollBasicAttack(attacker, { item: weapon, free: true, sourceOptions: { noAutoHit: true } });
  });

  on(".bl-dislocate", async (event) => {
    const button = $(event.currentTarget);
    const token = canvas.tokens.get(String(button.attr("data-target-token")));
    if (!token?.actor || !canInteractWithToken(attackerToken) || button.attr("data-reaction-used") !== "true") return;

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

  on(".bl-takedmg-poison", async (event) => {
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

  on(".bl-takedmg", async (event) => {
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
