import { BREATH_SPECIAL_ALIASES } from "../config/rule-data.mjs";
import { applyEffectsList } from "./effects-engine.mjs";
import {
  buildFormulaWithActorStats,
  normalizeBreathName,
} from "./technique-utils.mjs";

const FU = foundry.utils;
const METERS_PER_SQUARE = 1.5;

function appendFlatModifier(expr, mod) {
  const value = Number(mod) || 0;
  if (!value) return expr;
  return `${expr} ${value >= 0 ? "+" : "-"} ${Math.abs(value)}`;
}

function appendMatchingDice(expr, bonusDice = 0) {
  const extra = Math.max(0, Number(bonusDice) || 0);
  if (!extra) return expr;
  const match = String(expr || "").match(/(\d+)d(\d+)/i);
  if (!match) return expr;
  return `${expr} + ${extra}d${match[2]}`;
}

function normalizeSpecialKey(breathKey, specialKey) {
  const key = String(breathKey || "");
  const special = String(specialKey || "");
  return BREATH_SPECIAL_ALIASES?.[key]?.[special] || special;
}

export function getActiveBreaths(actor) {
  const result = {};
  const toggles = FU.getProperty(actor, "system.breaths") || {};

  for (const [key, value] of Object.entries(toggles)) {
    result[key] ??= { enabled: false, specials: {} };
    if (value?.enabled) result[key].enabled = true;
    for (const [specialKey, enabled] of Object.entries(value?.specials || {})) {
      result[key].specials[normalizeSpecialKey(key, specialKey)] = !!enabled;
    }
  }

  for (const item of actor.items ?? []) {
    if (item.type !== "breath") continue;
    const key = String(item.system?.key || "");
    if (!key) continue;

    result[key] ??= { enabled: false, specials: {} };
    if (item.system?.enabled) result[key].enabled = true;
    for (const [specialKey, enabled] of Object.entries(item.system?.specials || {})) {
      result[key].specials[normalizeSpecialKey(key, specialKey)] = !!enabled;
    }
  }

  return result;
}

function isDemonLike(actor) {
  return ["demon", "npcdemon"].includes(String(actor?.type || "").toLowerCase());
}

export function applyPreHit(attacker, targetToken, item, ctx = {}) {
  const breaths = getActiveBreaths(attacker);
  const itemBreathKey = item.system?.breathKey || normalizeBreathName(item.system?.breath);
  const itemAutomation = FU.duplicate(item.system?.automation || {});
  const itemFlags = FU.duplicate(item.system?.flags || {});
  const notes = [];

  const baseCost = Number(item.system?.costE ?? 0) || 0;
  let cost = baseCost;
  let damageExpr = buildFormulaWithActorStats(item.system?.damage || "1d8", attacker, ctx);
  let damageMultiplier = 1;
  const breathFormBonus =
    Number(FU.getProperty(attacker, "system.progression.bonuses.breathFormBonus") ?? 0) || 0;

  const attackerFlatDamage =
    Number(FU.getProperty(attacker, "system.combat.damageFlat") ?? 0) || 0;
  damageExpr = appendFlatModifier(damageExpr, attackerFlatDamage);

  if (itemBreathKey && breathFormBonus > 0) {
    damageExpr = appendMatchingDice(damageExpr, breathFormBonus);
    notes.push(`Progression : +${breathFormBonus} de degats aux formes de souffle`);
  }

  const ui = { canDeflect: false, canDash: false, canMist: false };

  if (itemAutomation.area === "allInRange" || itemFlags.aoe) {
    notes.push("Technique de zone : toutes les cibles valides a portee");
  }
  if (itemAutomation.area === "cone") {
    notes.push("Technique en cone : utilisez de preference plusieurs cibles selectionnees");
  }
  if (itemAutomation.lineOnly) {
    notes.push("Trajectoire en ligne droite requise");
  }
  if (itemAutomation.unlimitedRange) {
    ctx.overrideRange = 9999;
    notes.push("Portee illimitee");
  }
  if (itemAutomation.cannotBeDodged) {
    notes.push("La cible ne peut pas esquiver cette technique");
  }
  if (itemAutomation.cannotBeReactedTo) {
    notes.push("La cible ne peut pas reagir a cette technique");
  }

  if (breaths.sun?.enabled && breaths.sun?.specials?.elu) {
    if (baseCost > 1) {
      cost = Math.floor(baseCost / 2);
      notes.push("Soleil - Elu : cout divise par 2");
    } else if (baseCost === 1) {
      cost = 1;
      notes.push("Soleil - Elu : cout minimum conserve");
    }
  }

  if (baseCost >= 1) cost = Math.max(1, Number.isFinite(cost) ? cost : 1);
  else cost = Math.max(0, Number.isFinite(cost) ? cost : 0);

  if (itemBreathKey === "water" && breaths.water?.enabled && breaths.water.specials?.devierVagues) {
    ui.canDeflect = true;
    notes.push("Eau - Devier les vagues : reaction possible");
  }

  if (itemBreathKey === "thunder" && breaths.thunder?.enabled && breaths.thunder.specials?.vitesseLumiere) {
    ui.canDash = true;
    notes.push("Foudre - Vitesse de la lumiere : Dash 6m");
  }

  if (itemBreathKey === "mist" && breaths.mist?.enabled && breaths.mist.specials?.nuagesTrainants) {
    ui.canMist = true;
    notes.push("Brume - Nuages trainants : zone 3m");
  }

  if (itemBreathKey === "snow" && breaths.snow?.enabled && breaths.snow.specials?.dentsDeKatana) {
    notes.push("Neige - Dents de Katana : malus de CA a l'impact");
  }

  if (itemBreathKey === "flower" && breaths.flower?.enabled && breaths.flower.specials?.concentrationFlorissante) {
    damageExpr = `${damageExpr} + 1`;
    notes.push("Fleur - Concentration : +1 degats");
  }

  if (itemBreathKey === "flame" && breaths.flame?.enabled && breaths.flame.specials?.coeurFlamboyant) {
    notes.push("Flamme - Coeur flamboyant actif");
  }

  if (itemBreathKey === "wind" && breaths.wind?.enabled && breaths.wind.specials?.ventsDeGuerre) {
    notes.push("Vent - Vents de guerre : +1d2 RP si demon acheve");
  }

  if (itemBreathKey === "stone" && breaths.stone?.enabled && breaths.stone.specials?.machoireHache) {
    notes.push("Pierre - Machoire et hache active");
  }

  if (itemBreathKey === "serpent" && breaths.serpent?.enabled && breaths.serpent.specials?.formeLibre) {
    const range = Number(item.system?.range ?? METERS_PER_SQUARE) || METERS_PER_SQUARE;
    const boosted = Number((range + METERS_PER_SQUARE).toFixed(1));
    ctx.overrideRange = boosted;
    notes.push(`Serpent - Forme libre : portee ${range}m -> ${boosted}m`);
  }

  if (itemBreathKey === "sound" && breaths.sound?.enabled && breaths.sound.specials?.scoreDeCombat) {
    notes.push("Son - Score de combat : suivi manuel du tempo requis");
  }

  if (itemBreathKey === "insect" && breaths.insect?.enabled && breaths.insect.specials?.ecraserSousLePied) {
    notes.push("Insecte - Ecraser sous le pied : bonus contre cibles empoisonnees");
  }

  if (
    itemBreathKey === "love" &&
    breaths.love?.enabled &&
    breaths.love.specials?.balancementsAmoureux
  ) {
    notes.push("Amour - Balancements amoureux : pas de tir ami accidentel");
  }

  if (
    itemBreathKey === "beast" &&
    breaths.beast?.enabled &&
    breaths.beast.specials?.dislocation
  ) {
    notes.push("Bete - Dislocation : reaction d'evasion demoniaque a gerer a la table");
  }

  if (itemBreathKey === "ocean" && breaths.ocean?.enabled && breaths.ocean.specials?.jambesDeLaMer) {
    notes.push("Ocean - Jambes de la Mer : degats x0.5 sur terre, x1.5 dans l'eau");
  }

  if (itemBreathKey === "west" && breaths.west?.enabled && breaths.west.specials?.sixCoups) {
    notes.push("Ouest - Six-coups : tir gratuit apres la forme de souffle");
  }

  if (
    itemBreathKey === "moon" &&
    breaths.moon?.enabled &&
    breaths.moon.specials?.bonusSolo &&
    isDemonLike(targetToken?.actor)
  ) {
    damageExpr = `${damageExpr} + 1d6`;
    notes.push("Lune - Frappe de lune : +1d6 vs demon");
  }

  if (attacker.system?.states?.lameRouge && isDemonLike(targetToken?.actor)) {
    damageMultiplier *= 2;
    notes.push("Lame Rouge : degats x2 contre demon");
  }

  if (attacker.system?.states?.marque) {
    notes.push("Forme Marquee : degats avec avantage");
    if (itemBreathKey === "sun" && breaths.sun?.enabled && breaths.sun?.specials?.elu) {
      damageMultiplier *= 3;
      notes.push("Soleil - Elu : degats x3 en Marque");
    }
  }

  if (damageMultiplier !== 1) {
    damageExpr = `(${damageExpr}) * ${damageMultiplier}`;
  }

  return { cost, dmgExpr: damageExpr, ui, notes };
}

export async function applyOnHit(
  attacker,
  targetToken,
  item,
  ctx = {},
  { tookDamage = false, wasKilled = false } = {}
) {
  if (!tookDamage) return;

  const itemBreathKey = item.system?.breathKey || normalizeBreathName(item.system?.breath);
  const breaths = getActiveBreaths(attacker);

  if (
    itemBreathKey === "snow" &&
    breaths.snow?.enabled &&
    breaths.snow?.specials?.dentsDeKatana
  ) {
    const caLossRoll = await new Roll("1d4").evaluate({ async: true });
    const loss = Math.max(1, Number(caLossRoll.total) || 1);
    await applyEffectsList({
      source: attacker,
      target: targetToken,
      origin: item.uuid,
      effects: [
        {
          target: "target",
          path: "system.resources.ca",
          mode: "add",
          value: -loss,
          duration: "roundEnd",
          label: `Neige - CA -${loss} (fin de round)`,
        },
      ],
    });
  }

  if (
    itemBreathKey === "wind" &&
    wasKilled &&
    breaths.wind?.enabled &&
    breaths.wind?.specials?.ventsDeGuerre &&
    isDemonLike(targetToken?.actor)
  ) {
    const rpPath = "system.resources.rp.value";
    const rpMaxPath = "system.resources.rp.max";
    const curRp = Number(FU.getProperty(attacker, rpPath) ?? 0) || 0;
    const rpMax = Number(FU.getProperty(attacker, rpMaxPath) ?? curRp) || curRp;

    const gainRoll = await new Roll("1d2").evaluate({ async: true });
    const gain = Math.max(1, Number(gainRoll.total) || 1);
    const nextRp = Math.min(rpMax, curRp + gain);
    await attacker.update({ [rpPath]: nextRp });

    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: attacker }),
      content: `<em>Vents de guerre : ${attacker.name} recupere ${gain} RP (${curRp} -> ${nextRp}).</em>`,
    });
  }

  void ctx;
}

export const BreathFX = { applyPreHit, applyOnHit };
