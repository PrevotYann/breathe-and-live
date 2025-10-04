import { BreatheActorSheet } from "./sheets/actor-slayer-sheet.mjs";
import { BreatheItemTechniqueSheet } from "./sheets/item-technique-sheet.mjs";

Hooks.once("init", () => {
  console.log("Breathe & Live | init");
  // Actor
  Actors.unregisterSheet("core", ActorSheet);
  Actors.registerSheet("breathe-and-live", BreatheActorSheet, {
    types: ["slayer", "demonist", "demon", "npc"],
    makeDefault: true,
  });

  // Item Technique (tu peux laisser les autres types sur la sheet core)
  Items.registerSheet("breathe-and-live", BreatheItemTechniqueSheet, {
    types: ["technique"],
    makeDefault: true,
  });
});

class BLActor extends Actor {
  prepareDerivedData() {
    const b = this.system?.stats?.base ?? {};
    if (this.type !== "demon") {
      // E = 20 + Courage ; CA = 10 + Vitesse ; RP = 5 + Vitesse + Intellect
      this.system.resources.e.max = 20 + (b.courage ?? 0);
      this.system.resources.ca = 10 + (b.vitesse ?? 0);
      const rp = 5 + (b.vitesse ?? 0) + (b.intellect ?? 0);
      this.system.resources.rp.max = rp;
      this.system.resources.rp.value ??= rp;
    } else {
      // Démons : pas d’Endurance ; PV/BDP/Actions dérivés
      const baseHP = this.system.resources.hp?.base ?? 0;
      this.system.resources.hp.max = baseHP + 5 * (b.force ?? 0);
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
