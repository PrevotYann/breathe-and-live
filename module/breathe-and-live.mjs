// module/breathe-and-live.mjs

import { BLSlayerSheet } from "./sheets/actor-slayer-sheet.mjs";
import { BLTechniqueSheet } from "./item/sheets/technique-sheet.mjs";
import { BLWeaponSheet } from "./item/sheets/weapon-sheet.mjs";
import { BLVehicleSheet } from "./item/sheets/vehicle-sheet.mjs";
import { BLBaseItemSheet } from "./item/sheets/base-item-sheet.mjs";
import { BLBreathSheet } from "./sheets/item-breath-sheet.mjs";
import { useTechnique } from "./chat/use-technique.mjs";
import { registerEffectHooks } from "./rules/effects-engine.mjs";
import { registerRoundEngineHooks } from "./rules/round-engine.mjs";

const SYSTEM_ID = "breathe-and-live";
const BL_NS = "breathe-and-live";
const FU = foundry.utils;

/* ========================= INIT ========================= */

Hooks.once("init", () => {
  console.log("Breathe & Live | init");

  // Précharger les templates
  loadTemplates([
    "systems/breathe-and-live/templates/actor/actor-slayer.hbs",
    "systems/breathe-and-live/templates/item/item-technique.hbs",
    "systems/breathe-and-live/templates/item/item-weapon.hbs",
    "systems/breathe-and-live/templates/item/item-vehicle.hbs",
    "systems/breathe-and-live/templates/item/item-generic.hbs",
    "systems/breathe-and-live/templates/item/item-breath.hbs",
  ]);

  // Helpers pour les templates
  Handlebars.registerHelper("eq", (a, b) => a === b);
  Handlebars.registerHelper("join", (arr, sep) =>
    Array.isArray(arr) ? arr.join(sep ?? ", ") : arr
  );

  // Actor sheets
  Actors.registerSheet(SYSTEM_ID, BLSlayerSheet, {
    types: ["slayer"],
    makeDefault: true,
    label: "Pourfendeur",
  });

  // Item sheets
  Items.registerSheet(SYSTEM_ID, BLTechniqueSheet, {
    types: ["technique"],
    makeDefault: true,
    label: "Technique",
  });
  Items.registerSheet(SYSTEM_ID, BLWeaponSheet, {
    types: ["weapon"],
    makeDefault: true,
    label: "Arme",
  });
  Items.registerSheet(SYSTEM_ID, BLVehicleSheet, {
    types: ["vehicle"],
    makeDefault: true,
    label: "Véhicule",
  });
  Items.registerSheet(SYSTEM_ID, BLBaseItemSheet, {
    types: [
      "gear",
      "medical",
      "poison",
      "food",
      "outfit",
      "sense",
      "feature",
      "bda",
    ],
    makeDefault: true,
    label: "Objet (générique)",
  });
  Items.registerSheet(SYSTEM_ID, BLBreathSheet, {
    types: ["breath"],
    makeDefault: true,
    label: "Souffle",
  });

  registerEffectHooks();
});

/* ========================= ACTOR DOC ========================= */

class BLActor extends Actor {
  prepareDerivedData() {
    super.prepareDerivedData();

    const sys = this.system ?? {};
    const b = sys?.stats?.base ?? {};

    // Par défaut pour tous
    sys.resources ??= {};

    if (this.type !== "demon") {
      sys.resources.e ??= { value: 0, max: 0 };
      sys.resources.rp ??= { value: 0, max: 0 };
      sys.resources.hp ??= { value: 20, max: 20 };
      if (!Number.isFinite(sys.resources.hp.value))
        sys.resources.hp.value = sys.resources.hp.max;

      // Max/CA calculés (source of truth)
      sys.resources.e.max = 20 + (Number(b.courage) || 0); // E = 20 + Courage
      sys.resources.ca = 10 + (Number(b.vitesse) || 0); // CA = 10 + Vitesse
      const rpMax = 5 + (Number(b.vitesse) || 0) + (Number(b.intellect) || 0);
      sys.resources.rp.max = rpMax;

      // Remplissage safe si value invalide
      if (!Number.isFinite(sys.resources.e.value) || sys.resources.e.value <= 0)
        sys.resources.e.value = sys.resources.e.max;
      if (
        !Number.isFinite(sys.resources.rp.value) ||
        sys.resources.rp.value <= 0
      )
        sys.resources.rp.value = rpMax;
      if (
        !Number.isFinite(sys.resources.hp.value) ||
        sys.resources.hp.value <= 0
      )
        sys.resources.hp.value = sys.resources.hp.max;
    } else {
      // Branche Démon (en te basant sur ce que tu avais déjà)
      const baseHP = Number(sys.resources?.hp?.base ?? 0) || 0;
      sys.resources.hp ??= { value: 0, max: 0, base: baseHP };
      sys.resources.hp.max = baseHP + 5 * (Number(b.force) || 0);
      if (
        !Number.isFinite(sys.resources.hp.value) ||
        sys.resources.hp.value <= 0
      )
        sys.resources.hp.value = sys.resources.hp.max;

      sys.resources.bdp ??= { value: 0, max: 0 };
      sys.resources.bdp.max = 10 * (Number(b.courage) || 0);

      // Actions par tour pour les démons (si c'est bien ce que tu veux)
      sys.actions = 1 + Math.floor((Number(b.vitesse) || 0) / 5);
    }
  }
}

Hooks.once("setup", () => {
  CONFIG.Actor.documentClass = BLActor;
});

/* ========================= API PUBLIQUE ========================= */

Hooks.once("ready", () => {
  const mod = game.modules.get(SYSTEM_ID);
  if (mod) {
    mod.api = {
      useTechnique,
      rollBaseCheck, // exposé pour réutilisation éventuelle
    };
  }
  registerRoundEngineHooks();
});

/* ========================= ROLLS UTILES ========================= */

// Jet de base d20 + (stat - 1)
export async function rollBaseCheck(actor, statKey, label = "") {
  const b = actor.system?.stats?.base ?? {};
  const mod = (Number(b[statKey]) || 0) - 1;
  const r = await new Roll(`1d20 + ${mod}`).roll({ async: true });
  return r.toMessage({
    speaker: ChatMessage.getSpeaker({ actor }),
    flavor: label || `Test ${statKey}`,
  });
}

/* =============== AUTOMATE "E = 0" — repos forcé / Inconscient (v12.343) =============== */
/** Applique l’état “unconscious” si possible + message chat explicite */
async function blSetUnconscious(actor, tokenOrCombatant) {
  const tokenObj =
    tokenOrCombatant?.object ??
    tokenOrCombatant?.token?.object ??
    actor?.getActiveTokens?.()[0];

  // 1) Toggle status (core) si dispo
  let ok = false;
  try {
    const effect =
      CONFIG.statusEffects?.find(
        (e) => e.id === "unconscious" || /unconscious/i.test(e?.id ?? "")
      )?.id || "unconscious";
    if (tokenObj?.actor?.toggleStatusEffect) {
      await tokenObj.actor.toggleStatusEffect(effect, { active: true });
      ok = true;
    }
  } catch (e) {
    console.warn("BL | toggleStatusEffect failed:", e);
  }

  // 2) Fallback: au moins un message chat
  const txt = ok
    ? `${actor.name} <b>tombe inconscient</b> (E=0 prolongé).`
    : `${actor.name} <b>devrait être inconscient</b> (E=0 prolongé), mais aucun status 'unconscious' n’a pu être appliqué.`;
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<em>${txt}</em>`,
  });
}

/**
 * À chaque début de tour d’un combattant:
 *  - Si E > 0 → reset des flags 0E
 *  - Si E = 0 → mustRest=true, incrémente une “streak” par combat
 *  - Si streak >= 2 → applique Inconscient + message chat
 */
Hooks.on("updateCombat", async (combat, changed) => {
  // On ne traite que les changements de tour (début du tour du nouveau combattant)
  if (changed.turn === undefined) return;

  const cbt = combat.combatant; // combattant dont le tour COMMENCE
  const actor = cbt?.actor;
  if (!actor) return;

  const eVal =
    Number(FU.getProperty(actor, "system.resources.e.value") ?? 0) || 0;
  const combatId = combat.id;

  // Flags “scopés” au combat en cours (évite les fuites entre combats)
  const pathBase = `flags.${BL_NS}.zeroStreakByCombat.${combatId}`;

  if (eVal > 0) {
    // Récupéré → reset total
    await actor.update({
      [`flags.${BL_NS}.mustRest`]: false,
      [`flags.${BL_NS}.mustRestAnnouncedAt`]: null,
      [`${pathBase}`]: 0,
    });
    return;
  }

  // E == 0 → repos obligatoire ce round
  await actor.setFlag(BL_NS, "mustRest", true).catch(() => {});

  // Annonce “doit se reposer” (1 fois / round)
  const roundNow = combat.round ?? 0;
  const lastAnn = Number(actor.getFlag(BL_NS, "mustRestAnnouncedAt") ?? 0) || 0;
  if (roundNow !== lastAnn) {
    await actor.setFlag(BL_NS, "mustRestAnnouncedAt", roundNow).catch(() => {});
    ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      content: `<em>${actor.name} doit se reposer ce round (Endurance = 0).</em>`,
    });
  }

  // Incrémente la streak pour CE combat
  const prev = Number(FU.getProperty(actor, pathBase) ?? 0) || 0;
  const streak = prev + 1;
  await actor.update({ [pathBase]: streak });

  // Au 2e tour d’affilée à 0E → Inconscient
  if (streak >= 2) {
    await blSetUnconscious(actor, cbt);
  }
});

/**
 * Optionnel : au changement de round, on remet à zéro l’annonce (mais pas la streak).
 * (La streak se remet déjà à zéro quand E>0 au début d’un tour)
 */
Hooks.on("updateCombat", async (combat, changed) => {
  if (changed.round === undefined) return;
  for (const c of combat.combatants) {
    const a = c.actor;
    if (!a) continue;
    await a.unsetFlag(BL_NS, "mustRestAnnouncedAt").catch(() => {});
  }
});
