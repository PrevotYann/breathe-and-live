import { BreatheActorSheet } from "./sheets/actor-slayer-sheet.mjs";
import { BreatheItemTechniqueSheet } from "./sheets/item-technique-sheet.mjs";
// --- Item Sheets registration ---
import { BLTechniqueSheet } from "./item/sheets/technique-sheet.mjs";
import { BLWeaponSheet } from "./item/sheets/weapon-sheet.mjs";
import { BLVehicleSheet } from "./item/sheets/vehicle-sheet.mjs";
import { BLBaseItemSheet } from "./item/sheets/base-item-sheet.mjs";

Hooks.once("init", () => {
  console.log("Breathe & Live | init");
  // Précharger les templates
  loadTemplates([
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

  // Actor
  Actors.unregisterSheet("core", ActorSheet);
  Actors.registerSheet("breathe-and-live", BreatheActorSheet, {
    types: ["slayer", "demonist", "demon", "npc"],
    makeDefault: true,
  });

  // On peut laisser les feuilles Core pour certains types, mais on définit les nôtres
  Items.unregisterSheet("core", ItemSheet);

  Items.registerSheet("breathe-and-live", BLTechniqueSheet, {
    types: ["technique"],
    makeDefault: true,
    label: "Technique",
  });

  Items.registerSheet("breathe-and-live", BLWeaponSheet, {
    types: ["weapon"],
    makeDefault: true,
    label: "Arme",
  });

  Items.registerSheet("breathe-and-live", BLVehicleSheet, {
    types: ["vehicle"],
    makeDefault: true,
    label: "Véhicule",
  });

  // Fallback générique pour les autres types (gear, outfit, food, medical, poison, sense, feature, bda...)
  Items.registerSheet("breathe-and-live", BLBaseItemSheet, {
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
});

// module/breathe-live.mjs (ou ta classe Actor dédiée)
class BLActor extends Actor {
  prepareDerivedData() {
    const b = this.system?.stats?.base ?? {};

    if (this.type !== "demon") {
      this.system.resources.e ??= { value: 0, max: 0 };
      this.system.resources.rp ??= { value: 0, max: 0 };
      this.system.resources.hp ??= { value: 20, max: 20 };
      this.system.resources.ca ??= 10;

      // Max calculés
      this.system.resources.e.max = 20 + (b.courage ?? 0); // E = 20 + Courage
      this.system.resources.ca = 10 + (b.vitesse ?? 0); // CA = 10 + Vitesse
      const rpMax = 5 + (b.vitesse ?? 0) + (b.intellect ?? 0); // RP = 5 + Vit + Int
      this.system.resources.rp.max = rpMax;

      // Remplissage "safe" si value invalide (0 ou > max) — utile à l'import/création
      if (
        !Number.isFinite(this.system.resources.e.value) ||
        this.system.resources.e.value <= 0
      )
        this.system.resources.e.value = this.system.resources.e.max;

      if (
        !Number.isFinite(this.system.resources.rp.value) ||
        this.system.resources.rp.value <= 0
      )
        this.system.resources.rp.value = rpMax;

      if (
        !Number.isFinite(this.system.resources.hp.value) ||
        this.system.resources.hp.value <= 0
      )
        this.system.resources.hp.value = this.system.resources.hp.max;
    } else {
      const baseHP = this.system.resources.hp?.base ?? 0;
      this.system.resources.hp.max = baseHP + 5 * (b.force ?? 0);
      this.system.resources.bdp ??= { value: 0, max: 0 };
      this.system.resources.bdp.max = 10 * (b.courage ?? 0);
      this.system.actions = 1 + Math.floor((b.vitesse ?? 0) / 5);
    }
  }
}

Hooks.once("setup", () => {
  CONFIG.Actor.documentClass = BLActor;
});

// Jet de base d20 + (stat - 1)
export async function rollBaseCheck(actor, statKey, label = "") {
  const b = actor.system?.stats?.base ?? {};
  const mod = (b[statKey] ?? 0) - 1;
  const r = await new Roll(`1d20 + ${mod}`).roll({ async: true });
  return r.toMessage({
    speaker: ChatMessage.getSpeaker({ actor }),
    flavor: label || `Test ${statKey}`,
  });
}
