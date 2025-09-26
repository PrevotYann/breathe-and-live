import { BreatheActor } from "./actor/breathe-actor.js";
import { BreatheActorSheet } from "./actor/breathe-sheet.js";

import { BreatheItem, BreatheSouffleSheet } from "./item/breathe-item.js";
import { BreatheTechniqueSheet } from "./item/breathe-technique.js";
import { BreatheCapaciteSheet } from "./item/breathe-capacite.js";
import { BreatheWeaponSheet } from "./item/breathe-weapon.js";

Hooks.once("init", async function () {
  console.log("Breathe and Live | Initialisation du système Demon Slayer");

  // Actor (inchangé)
  CONFIG.Actor.documentClass = BreatheActor;
  Actors.unregisterSheet("core", ActorSheet);
  Actors.registerSheet("breathe-and-live", BreatheActorSheet, {
    types: ["character", "demoniste", "demon", "npc"],
    makeDefault: true,
  });

  // Item
  CONFIG.Item.documentClass = BreatheItem;
  Items.unregisterSheet("core", ItemSheet);

  Items.registerSheet("breathe-and-live", BreatheSouffleSheet, {
    types: ["souffle"],
    makeDefault: true,
  });
  Items.registerSheet("breathe-and-live", BreatheTechniqueSheet, {
    types: ["technique"],
    makeDefault: true,
  });
  Items.registerSheet("breathe-and-live", BreatheCapaciteSheet, {
    types: ["capacite"],
    makeDefault: true,
  });
  Items.registerSheet("breathe-and-live", BreatheWeaponSheet, {
    types: ["arme"],
    makeDefault: true,
  });

  await loadTemplates([
    "systems/breathe-and-live/templates/actor/breathe-sheet.html",
    "systems/breathe-and-live/templates/item/souffle-sheet.html",
    "systems/breathe-and-live/templates/item/technique-sheet.html",
    "systems/breathe-and-live/templates/item/capacite-sheet.html",
    "systems/breathe-and-live/templates/item/weapon-sheet.html",
  ]);

  Handlebars.registerHelper("eq", (a, b) => a === b);
  Handlebars.registerHelper("concat", function () {
    return Array.from(arguments).slice(0, -1).join("");
  });
  Handlebars.registerHelper("checked", (v) => !!v);
  Handlebars.registerHelper("join", (arr, sep) =>
    Array.isArray(arr) ? arr.join(sep) : ""
  );
});
