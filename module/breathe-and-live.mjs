import {
  ADVANCED_STATES,
  BREATH_KEYS,
  CONDITION_DEFINITIONS,
  DEMON_BODY_OPTIONS,
  DEMON_DANGER_OPTIONS,
  DEMONIST_RANK_PROGRESSION,
  DEMON_MOVEMENT_OPTIONS,
  DEMON_RANK_PACKAGES,
  DEMON_SHARED_ACTIONS,
  DEMONIST_RANKS,
  DEMON_RANKS,
  HUMAN_RANK_LEVELS,
  LIMB_DEFINITIONS,
  NPC_RANKS,
  SLAYER_RANK_PROGRESSION,
  SLAYER_RANKS,
  SYSTEM_ID,
} from "./config/rule-data.mjs";
import { BLSlayerSheet } from "./sheets/actor-slayer-sheet.mjs";
import { BLTechniqueSheet } from "./item/sheets/technique-sheet.mjs";
import { BLWeaponSheet } from "./item/sheets/weapon-sheet.mjs";
import { BLVehicleSheet } from "./item/sheets/vehicle-sheet.mjs";
import { BLBaseItemSheet } from "./item/sheets/base-item-sheet.mjs";
import { BLBreathSheet } from "./sheets/item-breath-sheet.mjs";
import { useTechnique } from "./chat/use-technique.mjs";
import { registerEffectHooks } from "./rules/effects-engine.mjs";
import { normalizeTechniqueItemData, validateTechniqueOwnership } from "./rules/technique-utils.mjs";
import {
  registerActionHooks,
  rollBasicAttack,
  runRecoveryBreath,
  runRestRefresh,
  runSprint,
  runWait,
  setConditionState,
  setLimbState,
  useMedicalItem,
} from "./rules/action-engine.mjs";

const BL_NS = SYSTEM_ID;
const FU = foundry.utils;

export const BL_DERIVED_GROUPS = {
  force: ["athletisme", "puissanceBrute"],
  finesse: ["dexterite", "equilibre", "precision"],
  courage: ["mithridatisme", "endurance", "tolerance"],
  vitesse: ["reflexes", "agilite", "rapidite", "ruse"],
  social: ["tromperie", "performance", "intimidation", "perception", "intuition"],
  intellect: ["medecine", "nature", "sciences", "enquete", "survie"],
};

export const BL_DERIVED_LABELS = {
  athletisme: "Athletisme",
  puissanceBrute: "Puissance Brute",
  dexterite: "Dexterite",
  equilibre: "Equilibre",
  precision: "Precision",
  mithridatisme: "Mithridatisme",
  endurance: "Endurance",
  tolerance: "Tolerance",
  reflexes: "Reflexes",
  agilite: "Agilite",
  rapidite: "Rapidite",
  ruse: "Ruse",
  tromperie: "Tromperie",
  performance: "Performance",
  intimidation: "Intimidation",
  perception: "Perception",
  intuition: "Intuition",
  medecine: "Medecine",
  nature: "Nature",
  sciences: "Sciences",
  enquete: "Enquete",
  survie: "Survie",
};

CONFIG.breatheAndLive ??= {};
CONFIG.breatheAndLive.DERIVED_GROUPS = BL_DERIVED_GROUPS;
CONFIG.breatheAndLive.DERIVED_LABELS = BL_DERIVED_LABELS;
CONFIG.breatheAndLive.CONDITIONS = CONDITION_DEFINITIONS;
CONFIG.breatheAndLive.LIMBS = LIMB_DEFINITIONS;
CONFIG.breatheAndLive.BREATH_KEYS = BREATH_KEYS;
CONFIG.breatheAndLive.ADVANCED_STATES = ADVANCED_STATES;
CONFIG.breatheAndLive.DEMON_BODY_OPTIONS = DEMON_BODY_OPTIONS;
CONFIG.breatheAndLive.DEMON_MOVEMENT_OPTIONS = DEMON_MOVEMENT_OPTIONS;
CONFIG.breatheAndLive.DEMON_DANGER_OPTIONS = DEMON_DANGER_OPTIONS;
CONFIG.breatheAndLive.DEMON_RANK_PACKAGES = DEMON_RANK_PACKAGES;
CONFIG.breatheAndLive.DEMON_SHARED_ACTIONS = DEMON_SHARED_ACTIONS;
CONFIG.breatheAndLive.RANKS = {
  slayer: SLAYER_RANKS,
  demonist: DEMONIST_RANKS,
  demon: DEMON_RANKS,
  npc: NPC_RANKS,
};
CONFIG.breatheAndLive.HUMAN_RANK_LEVELS = HUMAN_RANK_LEVELS;
CONFIG.breatheAndLive.SLAYER_RANK_PROGRESSION = SLAYER_RANK_PROGRESSION;
CONFIG.breatheAndLive.DEMONIST_RANK_PROGRESSION = DEMONIST_RANK_PROGRESSION;

function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function buildStatusEffects() {
  const existing = Array.isArray(CONFIG.statusEffects) ? CONFIG.statusEffects : [];
  const mapped = CONDITION_DEFINITIONS.map((definition) => ({
    id: `bl-${definition.key}`,
    name: definition.label,
    img: "icons/svg/aura.svg",
  }));

  const byId = new Map(existing.map((entry) => [entry.id, entry]));
  for (const entry of mapped) {
    if (!byId.has(entry.id)) byId.set(entry.id, entry);
  }
  CONFIG.statusEffects = Array.from(byId.values());
}

function ensureConditionData(sys) {
  sys.conditions ??= {};
  for (const definition of CONDITION_DEFINITIONS) {
    sys.conditions[definition.key] ??= {
      active: false,
      intensity: definition.trackIntensity ? 1 : 0,
      duration: 0,
      notes: "",
    };
  }
}

function ensureLimbData(sys) {
  sys.combat ??= {};
  sys.combat.injuries ??= {};
  sys.combat.injuries.limbs ??= {};
  for (const limb of LIMB_DEFINITIONS) {
    sys.combat.injuries.limbs[limb.key] ??= {
      injured: false,
      severed: false,
      broken: false,
      notes: "",
    };
  }
}

function defaultClassForType(type) {
  const normalized = String(type || "slayer");
  if (normalized === "demonist") {
    return { type: "Demoniste", rank: DEMONIST_RANKS[0] || "Initie" };
  }
  if (["demon", "npcDemon"].includes(normalized)) {
    return { type: "Demon", rank: DEMON_RANKS[0] || "Demon faible" };
  }
  if (normalized === "companion") {
    return { type: "Compagnon", rank: "Soutien" };
  }
  if (["npc", "npcHuman"].includes(normalized)) {
    return { type: "PNJ", rank: NPC_RANKS[0] || "Civil" };
  }
  return { type: "Pourfendeur", rank: SLAYER_RANKS[0] || "Mizunoto" };
}

function calculateRemaining(sys) {
  sys.stats ??= {};
  sys.stats.base ??= {};
  sys.stats.derived ??= {};
  sys.stats.remaining ??= {};

  for (const [key, entries] of Object.entries(BL_DERIVED_GROUPS)) {
    const baseValue = toNumber(sys.stats.base[key], 0);
    const spent = entries.reduce(
      (sum, derivedKey) => sum + toNumber(sys.stats.derived[derivedKey], 0),
      0
    );
    sys.stats.remaining[key] = Math.max(0, baseValue - spent);
  }
}

Hooks.once("init", () => {
  console.log("Breathe & Live | init");

  buildStatusEffects();

  loadTemplates([
    "systems/breathe-and-live/templates/actor/actor-slayer.hbs",
    "systems/breathe-and-live/templates/actor/actor-demonist.hbs",
    "systems/breathe-and-live/templates/actor/actor-demon.hbs",
    "systems/breathe-and-live/templates/actor/actor-npc.hbs",
    "systems/breathe-and-live/templates/item/item-technique.hbs",
    "systems/breathe-and-live/templates/item/item-weapon.hbs",
    "systems/breathe-and-live/templates/item/item-vehicle.hbs",
    "systems/breathe-and-live/templates/item/item-generic.hbs",
    "systems/breathe-and-live/templates/item/item-breath.hbs",
  ]);

  Handlebars.registerHelper("eq", (a, b) => a === b);
  Handlebars.registerHelper("join", (arr, sep) =>
    Array.isArray(arr) ? arr.join(sep ?? ", ") : arr
  );
  Handlebars.registerHelper("contains", (arr, value) =>
    Array.isArray(arr) ? arr.includes(value) : false
  );

  game.settings.register(SYSTEM_ID, "enableSupplement1934", {
    name: "Activer le supplement 1934",
    hint: "Expose les options et packs lies au supplement 1934.",
    scope: "world",
    config: true,
    type: Boolean,
    default: false,
  });

  Actors.registerSheet(SYSTEM_ID, BLSlayerSheet, {
    types: ["slayer", "demonist", "demon", "npc", "npcHuman", "npcDemon", "companion"],
    makeDefault: true,
    label: "Breathe & Live Actor",
  });

  Items.registerSheet(SYSTEM_ID, BLTechniqueSheet, {
    types: ["technique", "subclassTechnique", "bda", "demonAbility"],
    makeDefault: true,
    label: "Technique",
  });
  Items.registerSheet(SYSTEM_ID, BLWeaponSheet, {
    types: ["weapon", "firearm"],
    makeDefault: true,
    label: "Arme",
  });
  Items.registerSheet(SYSTEM_ID, BLVehicleSheet, {
    types: ["vehicle", "transport"],
    makeDefault: true,
    label: "Transport",
  });
  Items.registerSheet(SYSTEM_ID, BLBaseItemSheet, {
    types: [
      "gear",
      "utility",
      "medical",
      "poison",
      "food",
      "consumable",
      "outfit",
      "clothing",
      "sense",
      "feature",
      "ammunition",
    ],
    makeDefault: true,
    label: "Objet",
  });
  Items.registerSheet(SYSTEM_ID, BLBreathSheet, {
    types: ["breath"],
    makeDefault: true,
    label: "Souffle",
  });

  registerEffectHooks();
  registerActionHooks();
});

class BLActor extends Actor {
  prepareDerivedData() {
    super.prepareDerivedData();

    const sys = this.system ?? {};
    sys.resources ??= {};
    sys.class ??= { type: "", rank: "", level: 1 };
    sys.stats ??= {};
    sys.stats.base ??= {};
    sys.stats.derived ??= {};
    sys.profile ??= {};
    sys.progression ??= {};
    sys.progression.studySlots ??= { value: 0, max: 0 };
    sys.progression.skillSlots ??= { value: 0, max: 0 };
    sys.progression.bonuses ??= {};
    sys.support ??= {};
    sys.demonology ??= {};
    sys.states ??= {};
    sys.creation ??= {};
    sys.supplement1934 ??= {};
    sys.combat ??= {};
    sys.combat.basicAttack ??= {};
    sys.combat.actionEconomy ??= {};
    sys.combat.reactions ??= {};
    sys.combat.injuries ??= {};
    sys.resources.hp ??= { value: 20, max: 20, base: 20, healableMax: 20 };
    sys.resources.e ??= { value: 0, max: 0 };
    sys.resources.rp ??= { value: 0, max: 0 };
    sys.resources.bdp ??= { value: 0, max: 0 };

    const defaults = defaultClassForType(this.type);
    sys.class.type ||= defaults.type;
    sys.class.rank ||= defaults.rank;
    const mappedHumanLevel = HUMAN_RANK_LEVELS[sys.class.rank];
    sys.class.level = Math.max(
      1,
      toNumber(
        ["slayer", "demonist"].includes(this.type) && mappedHumanLevel
          ? mappedHumanLevel
          : sys.class.level,
        1
      )
    );

    sys.progression.bonuses.endurance = toNumber(sys.progression.bonuses.endurance, 0);
    sys.progression.bonuses.reactions = toNumber(sys.progression.bonuses.reactions, 0);
    sys.progression.bonuses.weaponDieSteps = toNumber(sys.progression.bonuses.weaponDieSteps, 0);
    sys.progression.bonuses.breathFormBonus = toNumber(sys.progression.bonuses.breathFormBonus, 0);
    sys.progression.bonuses.repeatedAction = toNumber(sys.progression.bonuses.repeatedAction, 0);
    sys.progression.bonuses.demonFleshBonus = toNumber(sys.progression.bonuses.demonFleshBonus, 0);
    sys.progression.bonuses.nichirinDamageBonus = toNumber(sys.progression.bonuses.nichirinDamageBonus, 0);
    sys.progression.bonuses.nichirinDamageDie ||= "";

    ensureConditionData(sys);
    ensureLimbData(sys);
    calculateRemaining(sys);

    sys.demonology.bodyType ||= "humanoid";
    sys.demonology.baseHpChoice = Math.max(
      1,
      toNumber(
        sys.demonology.baseHpChoice,
        DEMON_BODY_OPTIONS.find((entry) => entry.key === sys.demonology.bodyType)?.baseHp ?? 20
      )
    );
    sys.demonology.movementType ||= "biped";
    sys.demonology.movementBase = Math.max(
      0,
      toNumber(
        sys.demonology.movementBase,
        DEMON_MOVEMENT_OPTIONS.find((entry) => entry.key === sys.demonology.movementType)?.movement ?? 9
      )
    );
    sys.demonology.dangerLevel ||= "moderate";
    sys.demonology.basicDamage ||=
      DEMON_DANGER_OPTIONS.find((entry) => entry.key === sys.demonology.dangerLevel)?.baseDamage ??
      "1d4";
    sys.demonology.rankPackage ||= sys.class.rank;
    sys.demonology.benchmark ??= {};

    const base = {
      force: toNumber(sys.stats.base.force, 0),
      finesse: toNumber(sys.stats.base.finesse, 0),
      courage: toNumber(sys.stats.base.courage, 0),
      vitesse: toNumber(sys.stats.base.vitesse, 0),
      social: toNumber(sys.stats.base.social, 0),
      intellect: toNumber(sys.stats.base.intellect, 0),
    };

    sys.combat.damageFlat = toNumber(sys.combat.damageFlat, 0);
    sys.combat.actionEconomy.actionsPerTurn = Math.max(
      1,
      1 + Math.floor(base.vitesse / 5)
    );
    sys.combat.actionEconomy.bonusActions = toNumber(
      sys.combat.actionEconomy.bonusActions,
      0
    );
    sys.combat.actionEconomy.movementMeters = Math.max(
      0,
      toNumber(sys.combat.actionEconomy.movementMeters, 9)
    );
    sys.combat.actionEconomy.recoveryBreathRounds = Math.max(
      0,
      toNumber(sys.combat.actionEconomy.recoveryBreathRounds, 2)
    );

    sys.resources.ca = 10 + base.vitesse;
    sys.resources.rp.max = Math.max(
      0,
      5 + base.vitesse + base.intellect + toNumber(sys.progression.bonuses.reactions, 0)
    );
    sys.resources.rp.value = clamp(toNumber(sys.resources.rp.value, sys.resources.rp.max), 0, sys.resources.rp.max);

    if (["demon", "npcDemon"].includes(this.type)) {
      const benchmark = DEMON_RANK_PACKAGES[sys.class.rank]?.benchmark ?? {};
      const hpBase = Math.max(
        1,
        toNumber(sys.resources.hp.base, sys.demonology.baseHpChoice || sys.resources.hp.max || 20)
      );
      sys.resources.hp.base = hpBase;
      sys.resources.hp.max = hpBase + 5 * base.force;
      sys.resources.hp.healableMax = sys.resources.hp.max;
      sys.resources.hp.value = clamp(
        toNumber(sys.resources.hp.value, sys.resources.hp.max),
        0,
        sys.resources.hp.max
      );
      sys.resources.bdp.max = Math.max(0, 10 * base.courage);
      sys.resources.bdp.value = clamp(toNumber(sys.resources.bdp.value, 0), 0, sys.resources.bdp.max);
      sys.resources.demonisation = Math.max(0, toNumber(sys.resources.demonisation, 0));
      sys.resources.rp.max = Math.max(
        0,
        Math.floor((5 + base.vitesse + base.intellect) / 2)
      );
      sys.resources.rp.value = clamp(
        toNumber(sys.resources.rp.value, sys.resources.rp.max),
        0,
        sys.resources.rp.max
      );
      sys.combat.actionEconomy.movementMeters = Math.max(
        sys.combat.actionEconomy.movementMeters,
        toNumber(sys.demonology.movementBase, 9)
      );
      sys.combat.basicAttack.unarmedDamage = `${sys.demonology.basicDamage} + Force`;
      sys.demonology.canInfect = [
        "Lune inferieure",
        "Lune superieure",
      ].includes(sys.class.rank);
      sys.demonology.canExecute = [
        "Disciple de Lune inferieure",
        "Lune inferieure",
        "Disciple de Lune superieure",
        "Lune superieure",
      ].includes(sys.class.rank);
      sys.demonology.halfReactionRule = true;
      sys.demonology.halfDamageStatRule = true;
      sys.demonology.benchmark = {
        force: toNumber(sys.demonology.benchmark.force, benchmark.force ?? 0),
        finesse: toNumber(sys.demonology.benchmark.finesse, benchmark.finesse ?? 0),
        courage: toNumber(sys.demonology.benchmark.courage, benchmark.courage ?? 0),
        vitesse: toNumber(sys.demonology.benchmark.vitesse, benchmark.vitesse ?? 0),
        intellect: toNumber(sys.demonology.benchmark.intellect, benchmark.intellect ?? 0),
        social: toNumber(sys.demonology.benchmark.social, benchmark.social ?? 0),
        hp: toNumber(sys.demonology.benchmark.hp, benchmark.hp ?? 0),
        ca: toNumber(sys.demonology.benchmark.ca, benchmark.ca ?? 0),
        bite: sys.demonology.benchmark.bite || benchmark.bite || "",
        claw: sys.demonology.benchmark.claw || benchmark.claw || "",
        bda: sys.demonology.benchmark.bda || benchmark.bda || "",
        rp: toNumber(sys.demonology.benchmark.rp, benchmark.rp ?? sys.resources.rp.max),
      };
      delete sys.resources.e;
    } else {
      sys.resources.e.max = Math.max(
        0,
        20 + base.courage + toNumber(sys.progression.bonuses.endurance, 0)
      );
      sys.resources.e.value = clamp(toNumber(sys.resources.e.value, sys.resources.e.max), 0, sys.resources.e.max);
      sys.resources.hp.max = Math.max(1, toNumber(sys.resources.hp.max, 20));
      const severePenalty = Math.min(
        0.9,
        Math.max(0, toNumber(sys.combat.injuries.severeWounds, 0)) * 0.1
      );
      sys.resources.hp.healableMax = Math.max(
        1,
        Math.floor(sys.resources.hp.max * (1 - severePenalty))
      );
      sys.resources.hp.value = clamp(
        toNumber(sys.resources.hp.value, sys.resources.hp.healableMax),
        0,
        sys.resources.hp.max
      );

      if (this.type === "demonist") {
        sys.resources.bdp.max = Math.max(0, 10 * base.courage);
        sys.resources.bdp.value = clamp(toNumber(sys.resources.bdp.value, 0), 0, sys.resources.bdp.max);
        sys.resources.demonisation = Math.max(0, Math.floor(toNumber(sys.resources.demonisation, 0)));
        sys.resources.demonisationMax = 10 + base.courage;

        if (sys.support.activeDemonistMedicine) {
          sys.resources.demonisationMax = Math.max(
            1,
            Math.floor(sys.resources.demonisationMax * 1.5)
          );
        }
      } else {
        sys.resources.bdp = { value: 0, max: 0 };
        sys.resources.demonisation = 0;
        sys.resources.demonisationMax = 0;
      }
    }

    if (this.type === "companion") {
      sys.resources.hp.max = 1;
      sys.resources.hp.healableMax = 1;
      sys.resources.hp.value = clamp(toNumber(sys.resources.hp.value, 1), 0, 1);
      sys.resources.ca = 3;
      sys.resources.rp.max = 0;
      sys.resources.rp.value = 0;
    }

    sys.progression.studySlots.value = clamp(
      toNumber(sys.progression.studySlots.value, 0),
      0,
      Math.max(0, toNumber(sys.progression.studySlots.max, 0))
    );
    sys.progression.skillSlots.value = clamp(
      toNumber(sys.progression.skillSlots.value, 0),
      0,
      Math.max(0, toNumber(sys.progression.skillSlots.max, 0))
    );
    sys.profile.supplement1934Enabled =
      !!sys.supplement1934.enabled || !!game.settings.get(SYSTEM_ID, "enableSupplement1934");
  }
}

Hooks.once("setup", () => {
  CONFIG.Actor.documentClass = BLActor;
});

Hooks.once("ready", () => {
  const api = {
    useTechnique,
    normalizeTechniqueItemData,
    validateTechniqueOwnership,
    rollBaseCheck,
    rollBasicAttack,
    runRecoveryBreath,
    runSprint,
    runWait,
    runRestRefresh,
    setConditionState,
    setLimbState,
    useMedicalItem,
  };

  const mod = game.modules.get(SYSTEM_ID);
  if (mod) {
    mod.api = api;
  }

  game.breatheAndLive = api;
  if (game.system?.id === SYSTEM_ID) {
    game.system.api = api;
  }
});

export async function rollBaseCheck(actor, statKey, label = "") {
  const b = actor.system?.stats?.base ?? {};
  const mod = toNumber(b[statKey], 0) - 1;
  const r = await new Roll(`1d20 + ${mod}`).roll({ async: true });
  return r.toMessage({
    speaker: ChatMessage.getSpeaker({ actor }),
    flavor: label || `Test ${statKey}`,
  });
}

async function blSetUnconscious(actor, tokenOrCombatant) {
  const tokenObj =
    tokenOrCombatant?.object ??
    tokenOrCombatant?.token?.object ??
    actor?.getActiveTokens?.()[0];

  let ok = false;
  try {
    const effect =
      CONFIG.statusEffects?.find((entry) => entry.id === "unconscious")?.id || "unconscious";
    if (tokenObj?.actor?.toggleStatusEffect) {
      await tokenObj.actor.toggleStatusEffect(effect, { active: true });
      ok = true;
    }
  } catch (error) {
    console.warn("BL | toggleStatusEffect failed:", error);
  }

  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: ok
      ? `<em>${actor.name} tombe inconscient (E = 0 prolonge).</em>`
      : `<em>${actor.name} devrait etre inconscient (E = 0 prolonge), mais aucun statut Foundry n'a pu etre applique.</em>`,
  });
}

Hooks.on("updateCombat", async (combat, changed) => {
  if (changed.turn === undefined) return;

  const combatant = combat.combatant;
  const actor = combatant?.actor;
  if (!actor || ["demon", "npcDemon"].includes(String(actor.type).toLowerCase())) return;
  if (!FU.hasProperty(actor, "system.resources.e.value")) return;

  const eValue = toNumber(FU.getProperty(actor, "system.resources.e.value"), 0);
  const combatId = combat.id;
  const streakPath = `flags.${BL_NS}.zeroStreakByCombat.${combatId}`;

  if (eValue > 0) {
    await actor.update({
      [`flags.${BL_NS}.mustRest`]: false,
      [`flags.${BL_NS}.mustRestAnnouncedAt`]: null,
      [streakPath]: 0,
    });
    return;
  }

  await actor.setFlag(BL_NS, "mustRest", true).catch(() => {});

  const roundNow = combat.round ?? 0;
  const lastAnnouncement = toNumber(actor.getFlag(BL_NS, "mustRestAnnouncedAt"), 0);
  if (roundNow !== lastAnnouncement) {
    await actor.setFlag(BL_NS, "mustRestAnnouncedAt", roundNow).catch(() => {});
    ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      content: `<em>${actor.name} doit se reposer ce round (Endurance = 0).</em>`,
    });
  }

  const streak = toNumber(FU.getProperty(actor, streakPath), 0) + 1;
  await actor.update({ [streakPath]: streak });
  if (streak >= 2) {
    await blSetUnconscious(actor, combatant);
  }
});

Hooks.on("updateCombat", async (combat, changed) => {
  if (changed.round === undefined) return;
  for (const combatant of combat.combatants) {
    const actor = combatant.actor;
    if (!actor) continue;
    await actor.unsetFlag(BL_NS, "mustRestAnnouncedAt").catch(() => {});
  }
});
