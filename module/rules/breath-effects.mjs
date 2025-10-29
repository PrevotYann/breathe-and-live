// Moteur d’effets passifs & "on hit" des Souffles (Foundry v12)

const FU = foundry.utils;
const MOD_ID = "breathe-and-live";

/** Récupère les codes de souffles actifs (par items "breath" ou toggles system.breaths.<key>.enabled) */
function getActiveBreaths(actor) {
  const fromItems = actor.items
    .filter((i) => i.type === "breath" && i.system?.key)
    .map((i) => i.system.key);
  const fromToggles = Object.entries(
    FU.getProperty(actor, "system.breaths") ?? {}
  )
    .filter(([, v]) => v?.enabled)
    .map(([k]) => k);
  const set = new Set([...fromItems, ...fromToggles]);
  return [...set];
}

// === helpers =================================================================
/** Normalise une chaîne en clé de souffle canonique. */
export function canonicalizeBreathKey(str) {
  if (!str) return "";
  const s = String(str)
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim();
  const map = [
    { k: "sun", rx: /^(sun|soleil|souffle du soleil)/ },
    { k: "moon", rx: /^(moon|lune|souffle de la lune)/ },
    { k: "water", rx: /^(water|eau|souffle de l[’']eau)/ },
    { k: "flame", rx: /^(flame|flamme|souffle de la flamme)/ },
    { k: "wind", rx: /^(wind|vent|souffle du vent)/ },
    { k: "thunder", rx: /^(thunder|foudre|souffle de la foudre)/ },
    { k: "stone", rx: /^(stone|pierre|souffle de la pierre)/ },
    { k: "mist", rx: /^(mist|brume|souffle de la brume)/ },
    { k: "snow", rx: /^(snow|neige|souffle de la neige)/ },
    { k: "flower", rx: /^(flower|fleur|souffle de la fleur)/ },
    { k: "serpent", rx: /^(serpent|souffle du serpent)/ },
    { k: "sound", rx: /^(sound|son|souffle du son)/ },
    { k: "insect", rx: /^(insect|insecte|souffle de l[’']insecte)/ },
    { k: "love", rx: /^(love|amour|souffle de l[’']amour)/ },
    {
      k: "beast",
      rx: /^(beast|bete|bête|souffle de la bete|souffle de la bête)/,
    },
  ];
  for (const { k, rx } of map) if (rx.test(s)) return k;
  // Tente aussi si l’item stocke déjà la clé
  const short = s.replace(/^souffle\s+(du|de la|de l’|de l'|de)\s+/, "");
  for (const { k } of map) if (short === k) return k;
  return s; // en dernier recours, renvoie tel quel
}

/** Un souffle est-il activé pour cet acteur (toggle ou Item breath coché) ? */
export function isBreathEnabled(actor, breathKey) {
  const fromToggles = !!FU.getProperty(
    actor,
    `system.breaths.${breathKey}.enabled`
  );
  const fromItem = actor.items.some(
    (i) =>
      i.type === "breath" &&
      i.system?.key === breathKey &&
      (i.system?.enabled ?? true)
  );
  return fromToggles || fromItem;
}

/** La capacité spéciale d’un souffle est-elle active ? */
export function hasSpecial(actor, breathKey, specKey) {
  const fromToggles = !!FU.getProperty(
    actor,
    `system.breaths.${breathKey}.specials.${specKey}`
  );
  const item = actor.items.find(
    (i) => i.type === "breath" && i.system?.key === breathKey
  );
  const fromItem = !!item?.system?.specials?.[specKey];
  return fromToggles || fromItem;
}

/** Petit utilitaire : clamp >= 0, entier. */
function clampInt(n) {
  return Math.max(0, Math.round(Number(n) || 0));
}

// === PRE-HIT: calcul coût & dégâts AVANT jet/roll =================================

/**
 * Calcule le coût final, l’expression de dégâts et les notes, en appliquant
 * uniquement les effets du SOUFFLE de la technique (pas des autres).
 *
 * @returns { cost:number, dmgExpr:string, notes:string[] }
 */
export function applyPreHit(attacker, target, item, ctx = {}) {
  const s = item.system ?? {};
  const notes = [];

  // base
  let cost = clampInt(s.costE ?? 0);
  let dmgExp = (s.damage || "1d8").toString();

  // 1) Identifie le souffle de la technique (canonique)
  const techBreath = canonicalizeBreathKey(
    s.breath || s.breathKey || item.name
  );
  if (!techBreath) {
    return { cost, dmgExpr: dmgExp, notes }; // technique sans souffle → rien à appliquer
  }

  // 2) Le souffle de la technique est-il activé sur l’acteur ?
  if (!isBreathEnabled(attacker, techBreath)) {
    return { cost, dmgExpr: dmgExp, notes }; // souffle non actif → aucun effet
  }

  // 3) Applique les effets PROPRES à ce souffle uniquement
  switch (techBreath) {
    case "sun": {
      // Soleil — Élu : coût ÷2 (arrondi inférieur) si actif
      if (hasSpecial(attacker, "sun", "elu")) {
        const old = cost;
        cost = Math.floor(cost / 2);
        if (old !== cost) notes.push("Soleil — Élu : coût ÷2");
      }
      // (autres effets Soleil spécifiques ici si besoin)
      break;
    }

    case "water": {
      // Eau — Dévier les vagues : effet de RÉACTION (pas de modif pré-hit)
      if (hasSpecial(attacker, "water", "devierVagues")) {
        notes.push(
          "Eau — Dévier les vagues : réaction dispo (annulation/redirection)"
        );
      }
      break;
    }

    case "snow": {
      // Neige — Dents de Katana : effet POST-HIT (réduit CA si cible prend dégâts)
      if (hasSpecial(attacker, "snow", "dentsDeKatana")) {
        notes.push("Neige — Dents de Katana : CA -1d4 (si dégâts pris)");
      }
      break;
    }

    case "flower": {
      if (hasSpecial(attacker, "flower", "concentrationFlorissante")) {
        notes.push(
          "Fleur — Concentration florissante : bonus progressif (même cible)."
        );
        // (le cumul est géré ailleurs via flags si tu l’as implémenté)
      }
      break;
    }

    case "thunder": {
      if (hasSpecial(attacker, "thunder", "vitesseLumiere")) {
        notes.push("Foudre — Vitesse de la lumière : Dash 6 m (réaction).");
      }
      break;
    }

    case "stone": {
      if (hasSpecial(attacker, "stone", "machoireHache")) {
        notes.push("Pierre — Mâchoire & Hache : variante à choisir (dégâts).");
        // (si tu gères la variante ici, modifie dmgExp selon le choix)
      }
      break;
    }

    case "mist": {
      if (hasSpecial(attacker, "mist", "nuagesTrainants")) {
        notes.push("Brume — Nuages traînants : zone 3 m (réaction/bonus).");
      }
      break;
    }

    case "wind": {
      if (hasSpecial(attacker, "wind", "ventsDeGuerre")) {
        notes.push("Vent — Vents de guerre : RP +1d2 si tu achèves un démon.");
      }
      break;
    }

    // Ajoute ici d’autres souffles/effets si tu les branches
    default:
      break;
  }

  return { cost, dmgExpr: dmgExp, notes };
}

/** Applique les effets APRÈS résolution (sur touche non esquivée) */
export async function applyOnHit(
  attacker,
  targetToken,
  tech,
  ctx = {},
  outcome = {}
) {
  const target = targetToken?.actor;
  if (!target) return;
  const breaths = getActiveBreaths(attacker);

  // FLEUR — valider/incrémenter le stack seulement si les dégâts sont pris
  if (ctx._flowerNextStack && outcome.tookDamage) {
    await attacker.setFlag(MOD_ID, "flowerStacks", {
      tid: ctx._flowerNextStack.tid,
      n: ctx._flowerNextStack.n,
    });
  }

  // NEIGE — Dents de Katana : -1d4 CA (fin du round)
  if (ctx._snowDebuffCA && outcome.tookDamage) {
    const pen = new Roll("1d4");
    await pen.evaluate({ async: true });
    const caPath = "system.resources.ca";
    const curCA = Number(FU.getProperty(target, caPath) ?? 10) || 10;
    const newCA = Math.max(0, curCA - pen.total);
    await target.update({ [caPath]: newCA });
    ChatMessage.create({
      content: `<small>Neige — Dents de Katana : CA de ${target.name} ${curCA} → ${newCA} (fin du round).</small>`,
    });

    if (game.combat) {
      const thisRound = game.combat.round;
      const restore = async () => {
        if (game.combat?.round && game.combat.round > thisRound) {
          Hooks.off("updateCombat", restore);
          await target.update({ [caPath]: curCA });
          ChatMessage.create({
            content: `<small>Neige — Dents de Katana : CA de ${target.name} restaurée (${curCA}).</small>`,
          });
        }
      };
      Hooks.on("updateCombat", restore);
    }
  }

  // VENT — Vents de guerre : si démon tombe à 0 PV → attaquant regagne 1d2 RP
  if (ctx._windRegenOnDemonKill && outcome.tookDamage) {
    const isDem = target.type === "demon" || /demon/i.test(target?.type ?? "");
    const hp =
      Number(FU.getProperty(target, "system.resources.hp.value") ?? 0) || 0;
    if (isDem && hp <= 0) {
      const regen = new Roll("1d2");
      await regen.evaluate({ async: true });
      const rpPathAtk = "system.resources.rp.value";
      const curAtkRP = Number(FU.getProperty(attacker, rpPathAtk) ?? 0) || 0;
      await attacker.update({ [rpPathAtk]: curAtkRP + regen.total });
      ChatMessage.create({
        content: `<small>Vent — Vents de guerre : ${attacker.name} regagne ${regen.total} RP.</small>`,
      });
    }
  }
}

export const BreathFX = {
  applyPreHit,
  applyOnHit,
};
