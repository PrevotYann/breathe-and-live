// module/rules/breath-effects.mjs
import { applyEffectsList } from "./effects-engine.mjs";

const FU = foundry.utils;
const SYSTEM_ID = "breathe-and-live";
const METERS_PER_SQUARE = 1.5;

/* ------------------ Utils - parsing et stats ------------------ */

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

function normalizeBreathName(raw) {
  const s = String(raw || "")
    .trim()
    .toLowerCase();
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
  if (/(bête|beast)/.test(s)) return "beast";
  if (/(lune|moon)/.test(s)) return "moon";
  return "";
}

/** Fusionne toggles d’acteur + items “breath” équipés */
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

/* ------------------ Effets de Souffles (pré-hit et on-hit) ------------------ */

export function applyPreHit(attacker, targetToken, item, ctx = {}) {
  const breaths = getActiveBreaths(attacker);
  const itemBreathKey = normalizeBreathName(item.system?.breath);
  const notes = [];

  // Base
  const baseCost = Number(item.system?.costE ?? 0) || 0;
  let cost = baseCost;
  let dmgExpr = injectStatsInDamage(item.system?.damage || "1d8", attacker);

  const ui = { canDeflect: false, canDash: false, canMist: false };

  /* === ÉLU (Soleil) — s'applique à TOUTES les techniques ===
     - si coût de base > 1 ⇒ floor(base/2)
     - si coût de base = 1 ⇒ reste 1 (jamais 0)
     - si coût de base = 0 ⇒ reste 0
  */
  if (breaths.sun?.enabled && breaths.sun?.specials?.elu) {
    if (baseCost > 1) {
      cost = Math.floor(baseCost / 2);
      notes.push("Soleil — Élu : coût ÷2");
    } else if (baseCost === 1) {
      cost = 1;
      notes.push("Soleil — Élu : coût reste 1");
    } // 0 reste 0
  }

  // Sécurité : si le coût de base était ≥1, on ne permet jamais <1 après modifs
  if (baseCost >= 1) cost = Math.max(1, Number.isFinite(cost) ? cost : 1);
  else cost = Math.max(0, Number.isFinite(cost) ? cost : 0);

  // Eau
  if (itemBreathKey === "water" && breaths.water?.enabled) {
    if (breaths.water.specials?.devierVagues) {
      ui.canDeflect = true;
      notes.push("Eau — Dévier les vagues : réaction possible");
    }
  }
  // Foudre
  if (itemBreathKey === "thunder" && breaths.thunder?.enabled) {
    if (breaths.thunder.specials?.vitesseLumiere) {
      ui.canDash = true;
      notes.push("Foudre — Vitesse de la lumière : Dash 6 m");
    }
  }
  // Brume
  if (itemBreathKey === "mist" && breaths.mist?.enabled) {
    if (breaths.mist.specials?.nuagesTrainants) {
      ui.canMist = true;
      notes.push("Brume — Nuages traînants : zone 3 m");
    }
  }
  // Neige
  if (itemBreathKey === "snow" && breaths.snow?.enabled) {
    notes.push("Neige — pénalité de CA (appliquée si dégâts subis)");
  }
  // Fleur
  if (itemBreathKey === "flower" && breaths.flower?.enabled) {
    if (breaths.flower.specials?.concentrationFlorissante) {
      dmgExpr = `${dmgExpr} + 1`;
      notes.push("Fleur — Concentration florissante : +1 aux dégâts");
    }
  }
  // Flamme
  if (itemBreathKey === "flame" && breaths.flame?.enabled) {
    if (breaths.flame.specials?.coeurFlamboyant) {
      notes.push("Flamme — Cœur flamboyant (interactions fin de round)");
    }
  }

  // Placeholders
  if (itemBreathKey === "wind" && breaths.wind?.enabled)
    notes.push("Vent — (placeholder)");
  if (itemBreathKey === "stone" && breaths.stone?.enabled)
    notes.push("Pierre — (placeholder)");
  if (itemBreathKey === "serpent" && breaths.serpent?.enabled)
    notes.push("Serpent — (placeholder)");
  if (itemBreathKey === "sound" && breaths.sound?.enabled)
    notes.push("Son — (placeholder)");
  if (itemBreathKey === "insect" && breaths.insect?.enabled)
    notes.push("Insecte — (placeholder)");
  if (itemBreathKey === "love" && breaths.love?.enabled)
    notes.push("Amour — (placeholder)");
  if (itemBreathKey === "beast" && breaths.beast?.enabled)
    notes.push("Bête — (placeholder)");
  if (itemBreathKey === "moon" && breaths.moon?.enabled)
    notes.push("Lune — (placeholder : bonus vs Démons)");

  return { cost, dmgExpr, ui, notes };
}

export async function applyOnHit(
  attacker,
  targetToken,
  item,
  ctx = {},
  { tookDamage = false } = {}
) {
  const itemBreathKey = normalizeBreathName(item.system?.breath);
  if (!tookDamage) return;

  // Neige : CA -1d4 fin du round
  if (itemBreathKey === "snow") {
    await applyEffectsList({
      source: attacker,
      target: targetToken,
      origin: item.uuid,
      effects: [
        {
          target: "target",
          path: "system.resources.ca",
          mode: "add",
          roll: "1d4",
          value: -1, // fallback
          duration: "roundEnd",
          label: "Neige — CA -1d4 (jusqu'à fin du round)",
        },
      ],
    });
  }

  // Fleur : exemple buff court (optionnel) — laissé commenté
  /*
  if (itemBreathKey === "flower") {
    await applyEffectsList({
      source: attacker,
      target: attacker,
      origin: item.uuid,
      effects: [{
        target: "self",
        path: "system.bonuses.damageFlat",
        mode: "add",
        value: 1,
        duration: "custom:2",
        label: "Fleur — Concentration (+1 dmg, 2 tours)"
      }]
    });
  }
  */
}

export const BreathFX = { applyPreHit, applyOnHit };
