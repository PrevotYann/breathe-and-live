import {
  BREATH_SPECIAL_ALIASES,
  DEMON_RANK_LEVELS,
  SYSTEM_ID,
} from "../config/rule-data.mjs";
import { applyEffectsList } from "./effects-engine.mjs";
import {
  buildFormulaWithActorStats,
  normalizeBreathName,
} from "./technique-utils.mjs";
import { getEffectiveBaseStats } from "./poison-utils.mjs";

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

function currentCombatId() {
  return String(game.combat?.id || "free");
}

function currentRoundNumber() {
  return Number(game.combat?.round ?? 0) || 0;
}

function currentDayIndex() {
  return Math.floor(Number(game.time?.worldTime ?? 0) / 86400);
}

function toNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function isActorAlone(attackerToken) {
  if (!attackerToken || !canvas?.tokens?.placeables) return true;
  const disposition = attackerToken.document?.disposition;
  return !canvas.tokens.placeables.some((token) => {
    if (!token?.actor || token.id === attackerToken.id || token.document?.hidden) return false;
    return token.document?.disposition === disposition;
  });
}

function getFlowerFocusState(actor) {
  const state = FU.duplicate(actor?.getFlag(SYSTEM_ID, "flowerFocus") || {});
  if (state.combatId !== currentCombatId()) {
    return { combatId: currentCombatId(), targetId: "", stack: 0 };
  }
  return {
    combatId: currentCombatId(),
    targetId: String(state.targetId || ""),
    stack: Math.max(0, toNumber(state.stack, 0)),
  };
}

function getDemonRankLevel(actor) {
  if (!actor) return 0;
  const rank = String(actor.system?.class?.rank || "");
  const mapped = toNumber(DEMON_RANK_LEVELS?.[rank], 0);
  return mapped || Math.max(1, toNumber(actor.system?.class?.level, 1));
}

async function promptYesNo({
  title,
  content,
  yesLabel = "Oui",
  noLabel = "Non",
  defaultYes = false,
}) {
  return new Promise((resolve) => {
    new Dialog(
      {
        title,
        content,
        buttons: {
          yes: { label: yesLabel, callback: () => resolve(true) },
          no: { label: noLabel, callback: () => resolve(false) },
        },
        default: defaultYes ? "yes" : "no",
        close: () => resolve(false),
      },
      { width: 420 }
    ).render(true);
  });
}

async function ensureSoundTempoState(attacker, targetActor) {
  if (!game.combat || !targetActor || !isDemonLike(targetActor)) return null;

  const combatId = currentCombatId();
  const round = currentRoundNumber();
  const store = FU.duplicate(attacker.getFlag(SYSTEM_ID, "soundTempo") || {});
  const key = String(targetActor.id || "");
  let state = store[key];

  if (!state || state.combatId !== combatId) {
    const rankLevel = Math.max(1, getDemonRankLevel(targetActor));
    const intellect = Math.max(0, toNumber(getEffectiveBaseStats(attacker).intellect, 0));
    const countdownRoll = await new Roll(`${rankLevel}d4`).evaluate({ async: true });
    const countdown = Math.max(0, toNumber(countdownRoll.total, 0) - intellect);
    state = {
      combatId,
      targetId: key,
      startedRound: round,
      countdown,
      initialRoll: toNumber(countdownRoll.total, 0),
    };
    store[key] = state;
    await attacker.setFlag(SYSTEM_ID, "soundTempo", store);
  }

  return state;
}

async function maybeActivateFlameHeart(attacker) {
  const state = FU.duplicate(attacker.getFlag(SYSTEM_ID, "flameHeart") || {});
  const dayIndex = currentDayIndex();
  const combatId = currentCombatId();
  const round = currentRoundNumber();

  if (
    state.dayIndex === dayIndex &&
    state.activeCombatId === combatId &&
    state.activeRound === round
  ) {
    return { active: true, newlyActivated: false };
  }

  if (state.dayIndex === dayIndex) {
    return { active: false, newlyActivated: false };
  }

  if (!(game.user?.isGM || attacker?.isOwner)) {
    return { active: false, newlyActivated: false };
  }

  const confirmed = await promptYesNo({
    title: "Coeur flamboyant",
    content:
      "<p>Activer <strong>Coeur flamboyant</strong> pour ce round ? Toutes les attaques de ce round seront doublees. Utilisation 1 fois par jour.</p>",
    yesLabel: "Activer",
    noLabel: "Pas maintenant",
  });

  if (!confirmed) {
    return { active: false, newlyActivated: false };
  }

  await attacker.setFlag(SYSTEM_ID, "flameHeart", {
    dayIndex,
    activeCombatId: combatId,
    activeRound: round,
  });
  return { active: true, newlyActivated: true };
}

async function resolveOceanEnvironment(attacker) {
  const defaultLabel = game.combat ? "Sur terre" : "Terre";
  const aquatic = await new Promise((resolve) => {
    new Dialog(
      {
        title: "Jambes de la Mer",
        content:
          "<p>Le scene actuelle compte-t-elle comme aquatique pour cette technique ?</p>",
        buttons: {
          land: { label: defaultLabel, callback: () => resolve(false) },
          water: { label: "Dans l'eau", callback: () => resolve(true) },
        },
        default: "land",
        close: () => resolve(false),
      },
      { width: 420 }
    ).render(true);
  });

  void attacker;
  return aquatic;
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

export async function applyPreHit(attacker, targetToken, item, ctx = {}) {
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

  const ui = {
    canDash: false,
    canMist: false,
    canQuickShot: false,
    canDislocate: false,
  };
  const rollEdge = { damage: 0 };

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
    const focus = getFlowerFocusState(attacker);
    const isFocusedTarget = focus.targetId && focus.targetId === String(targetToken?.actor?.id || "");
    const flowerBonus = isFocusedTarget ? focus.stack * 2 : 0;
    if (flowerBonus > 0) {
      damageExpr = appendFlatModifier(damageExpr, flowerBonus);
      notes.push(`Fleur - Concentration florissante : +${flowerBonus} degats sur la cible suivie`);
    } else {
      notes.push("Fleur - Concentration florissante : la prochaine touche sur cette cible lancera le cumul");
    }
  }

  if (itemBreathKey === "flame" && breaths.flame?.enabled && breaths.flame.specials?.coeurFlamboyant) {
    const flameHeart = await maybeActivateFlameHeart(attacker);
    if (flameHeart.active) {
      damageMultiplier *= 2;
      notes.push(
        flameHeart.newlyActivated
          ? "Flamme - Coeur flamboyant active : degats doubles ce round"
          : "Flamme - Coeur flamboyant deja active : degats doubles"
      );
    } else {
      notes.push("Flamme - Coeur flamboyant disponible (1/jour) mais non active");
    }
  }

  if (itemBreathKey === "wind" && breaths.wind?.enabled && breaths.wind.specials?.ventsDeGuerre) {
    notes.push("Vent - Vents de guerre : +1d2 RP si demon acheve");
  }

  if (itemBreathKey === "stone" && breaths.stone?.enabled && breaths.stone.specials?.machoireHache) {
    notes.push("Pierre - Machoire et hache active");
  }

  if (itemBreathKey === "serpent" && breaths.serpent?.enabled && breaths.serpent.specials?.formeLibre) {
    const ignored = [];
    if (FU.getProperty(attacker, "system.conditions.slowed.active")) ignored.push("ralentissement");
    if (FU.getProperty(attacker, "system.conditions.imprisoned.active")) ignored.push("entrave");
    if (ignored.length) {
      notes.push(`Serpent - Forme libre : ignore ${ignored.join(" et ")} pour cette technique`);
    } else {
      notes.push("Serpent - Forme libre : ignore terrains difficiles et entraves");
    }
  }

  if (itemBreathKey === "sound" && breaths.sound?.enabled && breaths.sound.specials?.scoreDeCombat) {
    const state = await ensureSoundTempoState(attacker, targetToken?.actor);
    if (state) {
      const elapsedRounds = Math.max(0, currentRoundNumber() - toNumber(state.startedRound, currentRoundNumber()));
      if (elapsedRounds < toNumber(state.countdown, 0)) {
        rollEdge.damage -= 1;
        notes.push(
          `Son - Score de combat : desavantage aux degats (${Math.max(0, state.countdown - elapsedRounds)} round(s) restant(s))`
        );
      } else {
        rollEdge.damage += 1;
        notes.push("Son - Score de combat : avantage aux degats");
      }
    } else {
      notes.push("Son - Score de combat : effet neutre hors combat ou contre cible non demoniaque");
    }
  }

  if (itemBreathKey === "insect" && breaths.insect?.enabled && breaths.insect.specials?.ecraserSousLePied) {
    if (FU.getProperty(targetToken, "actor.system.conditions.poisoned.active")) {
      rollEdge.damage += 1;
      notes.push("Insecte - Ecraser sous le pied : avantage aux degats contre cible empoisonnee");
    } else {
      notes.push("Insecte - Ecraser sous le pied : en attente d'une cible empoisonnee");
    }
  }

  if (
    itemBreathKey === "love" &&
    breaths.love?.enabled &&
    breaths.love.specials?.balancementsAmoureux
  ) {
    notes.push("Amour - Balancements amoureux : allies exclus de la zone");
  }

  if (
    itemBreathKey === "beast" &&
    breaths.beast?.enabled &&
    breaths.beast.specials?.dislocation
  ) {
    ui.canDislocate = isDemonLike(targetToken?.actor);
    notes.push("Bete - Dislocation : possibilite de forcer l'impact sur un demon");
  }

  if (itemBreathKey === "ocean" && breaths.ocean?.enabled && breaths.ocean.specials?.jambesDeLaMer) {
    const inWater = await resolveOceanEnvironment(attacker);
    damageMultiplier *= inWater ? 1.5 : 0.5;
    notes.push(
      inWater
        ? "Ocean - Jambes de la Mer : scene aquatique, degats x1.5"
        : "Ocean - Jambes de la Mer : scene terrestre, degats x0.5"
    );
  }

  if (itemBreathKey === "west" && breaths.west?.enabled && breaths.west.specials?.sixCoups) {
    ui.canQuickShot = attacker.items?.some((owned) => owned.type === "firearm");
    notes.push(
      ui.canQuickShot
        ? "Ouest - Six-coups : tir gratuit disponible apres la forme"
        : "Ouest - Six-coups : aucun pistolet equipe pour le tir gratuit"
    );
  }

  if (
    itemBreathKey === "moon" &&
    breaths.moon?.enabled &&
    breaths.moon.specials?.bonusSolo &&
    isDemonLike(targetToken?.actor) &&
    isActorAlone(ctx.attackerToken)
  ) {
    damageExpr = `${damageExpr} + 1d6`;
    notes.push("Lune - Bonus solitaire : +1d6 contre demon en solitaire");
  } else if (
    itemBreathKey === "moon" &&
    breaths.moon?.enabled &&
    breaths.moon.specials?.bonusSolo &&
    isDemonLike(targetToken?.actor)
  ) {
    notes.push("Lune - Bonus solitaire inactif : allies detectes sur la scene");
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

  return { cost, dmgExpr: damageExpr, ui, notes, rollEdge };
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

  if (
    itemBreathKey === "flower" &&
    breaths.flower?.enabled &&
    breaths.flower?.specials?.concentrationFlorissante
  ) {
    const current = getFlowerFocusState(attacker);
    const targetId = String(targetToken?.actor?.id || "");
    const next =
      current.targetId === targetId
        ? { combatId: currentCombatId(), targetId, stack: current.stack + 1 }
        : { combatId: currentCombatId(), targetId, stack: 1 };
    await attacker.setFlag(SYSTEM_ID, "flowerFocus", next);
  }

  void ctx;
}

export const BreathFX = { applyPreHit, applyOnHit };
