import { LIMB_DEFINITIONS, SYSTEM_ID } from "./config/rule-data.mjs";
import { normalizeDerivedStats } from "./rules/actor-derived-formulas.mjs";

const FU = foundry.utils;
const MIGRATION_VERSION = "0.1.6";

function ensureActorUpdate(actor) {
  const update = {};
  const setIfMissing = (path, value) => {
    if (!FU.hasProperty(actor, path)) update[path] = value;
  };

  setIfMissing("system.resources.hp.temporary", 0);
  if (FU.hasProperty(actor, "system.resources.e")) {
    setIfMissing("system.resources.e.temporary", 0);
  }
  setIfMissing("system.combat.actionEconomy.effectiveMovementMeters", actor.system?.combat?.actionEconomy?.movementMeters ?? 9);
  setIfMissing("system.combat.injuries.nearDeathWounds", 0);
  setIfMissing("system.combat.injuries.targetedDamage", {});
  setIfMissing("system.combat.injuries.limbEffectSummary", []);
  setIfMissing("system.combat.injuries.noFlight", false);
  setIfMissing("system.states.tcbActive", false);
  setIfMissing("system.progression.bonuses.demonFleshExtraDice", 0);
  setIfMissing("system.progression.bonuses.socialExternal", 0);
  setIfMissing("system.progression.bonuses.executionHpBaseLimit", 0);
  setIfMissing("system.progression.bonuses.stealthDamageBonus", "");
  setIfMissing("system.progression.bonuses.firearmModsMax", 0);
  setIfMissing("system.progression.flags.drivingLicense", false);
  setIfMissing("system.progression.flags.poisonSpecialist", false);
  setIfMissing("system.progression.flags.dualWield", false);
  setIfMissing("system.progression.flags.sniperTraining", false);
  setIfMissing("system.progression.flags.senseTraining", false);

  const derivedStats = actor.system?.stats?.derived;
  if (derivedStats && typeof derivedStats === "object") {
    const normalized = normalizeDerivedStats(derivedStats);
    if (JSON.stringify(normalized) !== JSON.stringify(derivedStats)) {
      update["system.stats.derived"] = normalized;
    }
  }

  setIfMissing("system.creation.statMethod", "manual");
  setIfMissing("system.creation.statRolls", "");
  setIfMissing("system.creation.statArrayApplied", false);
  setIfMissing("system.creation.trainerPoints", { axis1: 0, axis2: 0, axis3: 0 });
  setIfMissing("system.creation.partnerPoints", { axis1: 0, axis2: 0, axis3: 0 });
  setIfMissing("system.creation.kasugaiPoints", { axis1: 0, axis2: 0, axis3: 0 });
  setIfMissing("system.support.companionActorId", "");
  setIfMissing("system.support.companionName", "");
  setIfMissing("system.support.companionRole", "");

  for (const limb of LIMB_DEFINITIONS) {
    setIfMissing(`system.combat.injuries.limbs.${limb.key}`, {
      injured: false,
      severed: false,
      broken: false,
      notes: "",
    });
    setIfMissing(`system.combat.injuries.targetedDamage.${limb.key}`, 0);
  }

  return update;
}

function ensureItemUpdate(item) {
  const update = {};
  if (["food", "consumable"].includes(item.type) && !FU.hasProperty(item, "system.temporaryEndurance")) {
    update["system.temporaryEndurance"] = false;
  }
  if (["outfit", "clothing"].includes(item.type)) {
    if (!FU.hasProperty(item, "system.equipped")) update["system.equipped"] = false;
    if (!FU.hasProperty(item, "system.armorBonus")) update["system.armorBonus"] = 0;
    if (!FU.hasProperty(item, "system.access")) update["system.access"] = "";
    if (!FU.hasProperty(item, "system.camouflageDc")) update["system.camouflageDc"] = 0;
  }
  if (["vehicle", "transport"].includes(item.type)) {
    if (!FU.hasProperty(item, "system.drive.relaxedDc")) update["system.drive.relaxedDc"] = 10;
    if (!FU.hasProperty(item, "system.drive.dangerDc")) update["system.drive.dangerDc"] = 15;
    if (!FU.hasProperty(item, "system.drive.notes")) update["system.drive.notes"] = "";
  }
  if (item.type === "craftingRecipe" || item.system?.crafting?.enabled) {
    if (!FU.hasProperty(item, "system.crafting.enabled")) update["system.crafting.enabled"] = item.type === "craftingRecipe";
    if (!FU.hasProperty(item, "system.crafting.componentCount")) update["system.crafting.componentCount"] = 1;
    if (!FU.hasProperty(item, "system.crafting.dc")) update["system.crafting.dc"] = 4;
    if (!FU.hasProperty(item, "system.crafting.stat")) update["system.crafting.stat"] = "sciences";
    if (!FU.hasProperty(item, "system.crafting.resultItemName")) update["system.crafting.resultItemName"] = "";
    if (!FU.hasProperty(item, "system.crafting.consumedOnFailure")) update["system.crafting.consumedOnFailure"] = false;
    if (!FU.hasProperty(item, "system.crafting.notes")) update["system.crafting.notes"] = "";
  }
  if (["technique", "subclassTechnique", "bda", "demonAbility"].includes(item.type)) {
    if (!FU.hasProperty(item, "system.prerequisites.sense")) update["system.prerequisites.sense"] = "";
  }
  if (!FU.hasProperty(item, "system.supplement1934.enabled")) {
    const tags = Array.isArray(item.system?.tags) ? item.system.tags : [];
    const marker = [item.name, item.system?.sourceSection, item.system?.usageNote, ...tags]
      .join(" ")
      .toLowerCase();
    update["system.supplement1934.enabled"] =
      marker.includes("1934") || marker.includes("supplement 1934");
  }
  if (!FU.hasProperty(item, "system.supplement1934.notes")) update["system.supplement1934.notes"] = "";
  if (item.type === "technique") {
    if (!FU.hasProperty(item, "system.automation.afflictionCondition")) update["system.automation.afflictionCondition"] = "";
    if (!FU.hasProperty(item, "system.automation.pursuer")) update["system.automation.pursuer"] = false;
    if (!FU.hasProperty(item, "system.automation.sweep")) update["system.automation.sweep"] = false;
    if (!FU.hasProperty(item, "system.automation.regenerator")) update["system.automation.regenerator"] = false;
    if (!FU.hasProperty(item, "system.customBreath.enabled")) update["system.customBreath.enabled"] = false;
    if (!FU.hasProperty(item, "system.customBreath.damageKey")) update["system.customBreath.damageKey"] = "";
    if (!FU.hasProperty(item, "system.customBreath.rangeKey")) update["system.customBreath.rangeKey"] = "";
    if (!FU.hasProperty(item, "system.customBreath.effectKey")) update["system.customBreath.effectKey"] = "";
    if (!FU.hasProperty(item, "system.customBreath.rawCost")) update["system.customBreath.rawCost"] = 0;
  }
  return update;
}

export function registerMigrationSetting() {
  game.settings.register(SYSTEM_ID, "schemaVersion", {
    name: "Version de schema Breathe and Live",
    scope: "world",
    config: false,
    type: String,
    default: "0.0.0",
  });
}

export async function runSystemMigrations() {
  if (!game.user?.isGM) return;
  const current = String(game.settings.get(SYSTEM_ID, "schemaVersion") || "0.0.0");
  if (current === MIGRATION_VERSION) return;

  let actorCount = 0;
  let itemCount = 0;
  for (const actor of game.actors?.contents ?? []) {
    const update = ensureActorUpdate(actor);
    if (Object.keys(update).length) {
      await actor.update(update);
      actorCount += 1;
    }
  }

  for (const item of game.items?.contents ?? []) {
    const update = ensureItemUpdate(item);
    if (Object.keys(update).length) {
      await item.update(update);
      itemCount += 1;
    }
  }

  await game.settings.set(SYSTEM_ID, "schemaVersion", MIGRATION_VERSION);
  if (actorCount || itemCount) {
    ui.notifications.info(`Breathe and Live: migrations ${MIGRATION_VERSION} appliquees (${actorCount} acteur(s), ${itemCount} item(s)).`);
  }
}
