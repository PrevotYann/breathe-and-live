// module/breathe-and-live.mjs

import { BLSlayerSheet } from "./sheets/actor-slayer-sheet.mjs";
import { BLTechniqueSheet } from "./item/sheets/technique-sheet.mjs";
import { BLWeaponSheet } from "./item/sheets/weapon-sheet.mjs";
import { BLVehicleSheet } from "./item/sheets/vehicle-sheet.mjs";
import { BLBaseItemSheet } from "./item/sheets/base-item-sheet.mjs";
import { BLBreathSheet } from "./sheets/item-breath-sheet.mjs";
import { useTechnique } from "./chat/use-technique.mjs";

const SYSTEM_ID = "breathe-and-live";
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
  });
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

/* =============== AUTOMATE "E = 0" — repos forcé / KO =============== */

const BL_FLAGS = SYSTEM_ID;

// Mémorise la dernière valeur d'E (sert à détecter une récupération au cours du round)
Hooks.on("updateActor", (actor) => {
  const curE =
    Number(FU.getProperty(actor, "system.resources.e.value") ?? 0) || 0;
  actor.setFlag(BL_FLAGS, "lastE", curE).catch(() => {});
});

// Au changement de tour/round : gère mustRest + KO si 2 rounds consécutifs à 0E sans récup
Hooks.on("updateCombat", async (combat, changed) => {
  if (!("turn" in changed) && !("round" in changed)) return;

  for (const c of combat.combatants) {
    const token = c.token?.object ?? canvas.tokens.get(c.tokenId);
    const actor = c.actor;
    if (!actor) continue;

    const eVal =
      Number(FU.getProperty(actor, "system.resources.e.value") ?? 0) || 0;

    // Si E>0 : on reset tous les marqueurs "0E"
    if (eVal > 0) {
      await actor.unsetFlag(BL_FLAGS, "mustRest").catch(() => {});
      await actor.unsetFlag(BL_FLAGS, "e0Rounds").catch(() => {});
      await actor.unsetFlag(BL_FLAGS, "recoveredThisRound").catch(() => {});
      continue;
    }

    // E == 0 → obligation de repos ce round
    await actor.setFlag(BL_FLAGS, "mustRest", true).catch(() => {});

    // A-t-il récupéré pendant le round (E > 0 à un moment) ?
    const lastE = Number(actor.getFlag(BL_FLAGS, "lastE") ?? 0);
    const recovered = lastE > 0;
    if (recovered) {
      await actor.setFlag(BL_FLAGS, "recoveredThisRound", true).catch(() => {});
      await actor.setFlag(BL_FLAGS, "e0Rounds", 0).catch(() => {});
      continue;
    }

    // Sinon on incrémente la durée à 0E
    const prev = Number(actor.getFlag(BL_FLAGS, "e0Rounds") ?? 0) || 0;
    const now = prev + 1;
    await actor.setFlag(BL_FLAGS, "e0Rounds", now).catch(() => {});

    // Au 2e round consécutif sans récup → Inconscient
    if (now >= 2) {
      const st = CONFIG.statusEffects?.find(
        (e) => e.id === "unconscious" || /unconscious/i.test(e?.id ?? "")
      );
      if (st && token?.actor) {
        try {
          await token.actor.toggleStatusEffect(st, { active: true });
          ui.notifications.info(
            `${actor.name} tombe inconscient (0E prolongé).`
          );
        } catch (e) {
          console.warn("BL unconscious toggle failed:", e);
        }
      }
    }
  }

  // À chaque nouveau round : on efface recoveredThisRound
  if ("round" in changed) {
    for (const c of combat.combatants) {
      const actor = c.actor;
      if (!actor) continue;
      await actor.unsetFlag(BL_FLAGS, "recoveredThisRound").catch(() => {});
    }
  }
});
