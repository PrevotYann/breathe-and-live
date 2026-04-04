// module/rules/breath-effects.mjs
import { applyEffectsList } from "./effects-engine.mjs";

const FU = foundry.utils;
const METERS_PER_SQUARE = 1.5;

/* ------------------ Utils ------------------ */

function injectStatsInDamage(expr, attacker) {
  if (!expr || typeof expr !== "string") return "1d8";
  let out = expr.trim();

  function statVal(k) {
    const v = Number(FU.getProperty(attacker, `system.stats.base.${k}`) ?? 0);
    return Number.isFinite(v) ? v : 0;
  }

  if (/force\s*ou\s*finesse/i.test(out) || /finesse\s*ou\s*force/i.test(out)) {
    const best = Math.max(statVal("force"), statVal("finesse"));
    out = out
      .replace(/force\s*ou\s*finesse/gi, String(best))
      .replace(/finesse\s*ou\s*force/gi, String(best));
  }

  out = out.replace(/\bForce\b/gi, String(statVal("force")));
  out = out.replace(/\bFinesse\b/gi, String(statVal("finesse")));
  return out;
}

function appendFlatModifier(expr, mod) {
  const n = Number(mod) || 0;
  if (!n) return expr;
  const sign = n >= 0 ? "+" : "-";
  return `${expr} ${sign} ${Math.abs(n)}`;
}

function normalizeBreathName(raw) {
  const s = String(raw || "").trim().toLowerCase();
  if (/(soleil|sun)/.test(s)) return "sun";
  if (/(eau|water)/.test(s)) return "water";
  if (/(flamme|flame)/.test(s)) return "flame";
  if (/(vent|wind)/.test(s)) return "wind";
  if (/(foudre|tonnerre|thunder)/.test(s)) return "thunder";
  if (/(pierre|stone)/.test(s)) return "stone";
  if (/(brume|mist)/.test(s)) return "mist";
  if (/(serpent)/.test(s)) return "serpent";
  if (/(neige|snow)/.test(s)) return "snow";
  if (/(fleur|flower)/.test(s)) return "flower";
  if (/(son|sound)/.test(s)) return "sound";
  if (/(insecte|insect)/.test(s)) return "insect";
  if (/(amour|love)/.test(s)) return "love";
  if (/(bete|bête|beast)/.test(s)) return "beast";
  if (/(ocean|oc[eé]an)/.test(s)) return "ocean";
  if (/(ouest|west)/.test(s)) return "west";
  if (/(original|custom|homebrew)/.test(s)) return "custom";
  if (/(lune|moon)/.test(s)) return "moon";
  return "";
}

/** Merge actor toggles + equipped breath items */
function getActiveBreaths(actor) {
  const res = {};
  const b = FU.getProperty(actor, "system.breaths") || {};

  for (const [k, v] of Object.entries(b)) {
    if (!res[k]) res[k] = { enabled: false, specials: {} };
    if (v?.enabled) res[k].enabled = true;
    if (v?.specials && typeof v.specials === "object") {
      for (const [sk, on] of Object.entries(v.specials)) {
        res[k].specials[sk] = !!on;
      }
    }
  }

  for (const it of actor.items ?? []) {
    if (it.type !== "breath") continue;
    const key = it.system?.key ? String(it.system.key) : "";
    if (!key) continue;
    if (!res[key]) res[key] = { enabled: false, specials: {} };
    if (it.system?.enabled) res[key].enabled = true;
    const sp = it.system?.specials || {};
    for (const [sk, on] of Object.entries(sp)) res[key].specials[sk] = !!on;
  }

  return res;
}

function isMeleeRange(attackerToken, targetToken) {
  try {
    if (!attackerToken?.center || !targetToken?.center || !canvas?.grid?.size)
      return false;
    const gs = canvas.grid.size || 100;
    const dx = Math.abs(attackerToken.center.x - targetToken.center.x) / gs;
    const dy = Math.abs(attackerToken.center.y - targetToken.center.y) / gs;
    return Math.max(dx, dy) * METERS_PER_SQUARE <= METERS_PER_SQUARE;
  } catch {
    return false;
  }
}

/* ------------------ Breath effects ------------------ */

export function applyPreHit(attacker, targetToken, item, ctx = {}) {
  const breaths = getActiveBreaths(attacker);
  const itemBreathKey = normalizeBreathName(item.system?.breath);
  const notes = [];

  const baseCost = Number(item.system?.costE ?? 0) || 0;
  let cost = baseCost;
  let dmgExpr = injectStatsInDamage(item.system?.damage || "1d8", attacker);
  let damageMultiplier = 1;

  // Generic temporary damage modifier path (used by effects engine)
  const attackerFlatDamage =
    Number(FU.getProperty(attacker, "system.combat.damageFlat") ?? 0) || 0;
  dmgExpr = appendFlatModifier(dmgExpr, attackerFlatDamage);

  const ui = { canDeflect: false, canDash: false, canMist: false };

  // Soleil - Elu : half E cost, but never below 1 when base >= 1
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
    dmgExpr = `${dmgExpr} + 1`;
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

  if (itemBreathKey === "sound" && breaths.sound?.enabled && breaths.sound.specials?.partitionFulgurante) {
    notes.push("Son - Partition fulgurante : CA -1 cible fin de round");
  }

  if (itemBreathKey === "insect" && breaths.insect?.enabled && breaths.insect.specials?.veninLent) {
    notes.push("Insecte - Venin lent : degats cibles -1 fin de round");
  }

  if (
    itemBreathKey === "love" &&
    breaths.love?.enabled &&
    breaths.love.specials?.coeurPassionne &&
    isMeleeRange(ctx?.attackerToken, targetToken)
  ) {
    dmgExpr = `${dmgExpr} + 1`;
    notes.push("Amour - Coeur passionne : +1 degats melee");
  }

  if (
    itemBreathKey === "beast" &&
    breaths.beast?.enabled &&
    breaths.beast.specials?.instinctSauvage &&
    isMeleeRange(ctx?.attackerToken, targetToken)
  ) {
    cost = Math.max(baseCost >= 1 ? 1 : 0, cost - 1);
    notes.push("Bete - Instinct sauvage : cout E -1 en melee");
  }

  if (
    itemBreathKey === "moon" &&
    breaths.moon?.enabled &&
    breaths.moon.specials?.bonusSolo &&
    ["demon", "demonist", "npcdemon"].includes(String(targetToken?.actor?.type || "").toLowerCase())
  ) {
    dmgExpr = `${dmgExpr} + 1d6`;
    notes.push("Lune - Frappe de lune : +1d6 vs demon");
  }

  if (
    attacker.system?.states?.lameRouge &&
    ["demon", "npcdemon"].includes(String(targetToken?.actor?.type || "").toLowerCase())
  ) {
    damageMultiplier *= 2;
    notes.push("Lame Rouge : degats x2 contre demon");
  }

  if (attacker.system?.states?.marque) {
    notes.push("Forme Marquee : degats avec avantage");
    if (
      itemBreathKey === "sun" &&
      breaths.sun?.enabled &&
      breaths.sun?.specials?.elu
    ) {
      damageMultiplier *= 3;
      notes.push("Soleil - Elu : degats x3 en Marque");
    }
  }

  if (damageMultiplier !== 1) {
    dmgExpr = `(${dmgExpr}) * ${damageMultiplier}`;
  }

  return { cost, dmgExpr, ui, notes };
}

export async function applyOnHit(
  attacker,
  targetToken,
  item,
  ctx = {},
  { tookDamage = false, wasKilled = false } = {}
) {
  if (!tookDamage) return;

  const itemBreathKey = normalizeBreathName(item.system?.breath);
  const breaths = getActiveBreaths(attacker);

  // Neige : CA -1d4 until round end
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

  // Son : CA -1 until round end
  if (
    itemBreathKey === "sound" &&
    breaths.sound?.enabled &&
    breaths.sound?.specials?.partitionFulgurante
  ) {
    await applyEffectsList({
      source: attacker,
      target: targetToken,
      origin: item.uuid,
      effects: [
        {
          target: "target",
          path: "system.resources.ca",
          mode: "add",
          value: -1,
          duration: "roundEnd",
          label: "Son - Partition fulgurante : CA -1",
        },
      ],
    });
  }

  // Insecte : target damage -1 until round end
  if (
    itemBreathKey === "insect" &&
    breaths.insect?.enabled &&
    breaths.insect?.specials?.veninLent
  ) {
    await applyEffectsList({
      source: attacker,
      target: targetToken,
      origin: item.uuid,
      effects: [
        {
          target: "target",
          path: "system.combat.damageFlat",
          mode: "add",
          value: -1,
          duration: "roundEnd",
          label: "Insecte - Venin lent : degats -1",
        },
      ],
    });
  }

  // Vent : +1d2 RP when killing a demon target
  if (
    itemBreathKey === "wind" &&
    wasKilled &&
    breaths.wind?.enabled &&
    breaths.wind?.specials?.ventsDeGuerre &&
    String(targetToken?.actor?.type || "").toLowerCase() === "demon"
  ) {
    const rpPath = "system.resources.rp.value";
    const rpMaxPath = "system.resources.rp.max";
    const curRp = Number(FU.getProperty(attacker, rpPath) ?? 0) || 0;
    const rpMax = Number(FU.getProperty(attacker, rpMaxPath) ?? curRp) || curRp;

    const gainRoll = await new Roll("1d2").evaluate({ async: true });
    const gain = Math.max(1, Number(gainRoll.total) || 1);
    const newRp = Math.min(rpMax, curRp + gain);
    await attacker.update({ [rpPath]: newRp });

    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: attacker }),
      content: `<em>Vents de guerre : ${attacker.name} recupere ${gain} RP (${curRp} -> ${newRp}).</em>`,
    });
  }
}

export const BreathFX = { applyPreHit, applyOnHit };
