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

// module/breathe-live.mjs (ou ta classe Actor dédiée)
class BLActor extends Actor {
  prepareDerivedData() {
    const b = this.system?.stats?.base ?? {};
    if (this.type !== "demon") {
      this.system.resources.e.max = 20 + (b.courage ?? 0); // E = 20 + Courage
      this.system.resources.ca = 10 + (b.vitesse ?? 0); // CA = 10 + Vitesse
      const rp = 5 + (b.vitesse ?? 0) + (b.intellect ?? 0); // RP = 5 + Vit + Int
      this.system.resources.rp.max = rp;
      if ((this.system.resources.rp.value ?? 0) === 0)
        this.system.resources.rp.value = rp;
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
