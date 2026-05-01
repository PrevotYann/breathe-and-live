import {
  ADVANCED_STATES,
  BREATH_KEYS,
  BREATH_SPECIAL_ALIASES,
  CONDITION_DEFINITIONS,
  DEMON_BLOODLINE_DETAILS,
  DEMON_BLOODLINE_VARIANTS,
  DEMON_BODY_OPTIONS,
  DEMON_DANGER_OPTIONS,
  DEMONIST_RANK_PROGRESSION,
  DEMON_MOVEMENT_OPTIONS,
  DEMON_RANK_PACKAGES,
  DEMON_RANK_LEVELS,
  DEMON_SHARED_ACTIONS,
  DEMONIST_RANKS,
  DEMON_RANKS,
  HUMAN_RANK_LEVELS,
  LIMB_DEFINITIONS,
  NPC_RANKS,
  SLAYER_RANK_PROGRESSION,
  SLAYER_RANKS,
  SYSTEM_ID,
} from "../config/rule-data.mjs";
import { useTechnique } from "../chat/use-technique.mjs";
import { getActiveBreaths } from "../rules/breath-effects.mjs";
import { openCustomBreathBuilder } from "../rules/custom-breath-builder.mjs";
import {
  actorHasBreath,
  getBreathLabel,
  normalizeBreathName,
  validateTechniqueOwnership,
} from "../rules/technique-utils.mjs";
import {
  clearActivePoisonCoating,
  coatWeaponWithPoison,
  getActivePoisonCoating,
  gainDemonFleshBdp,
  runCraftingCheck,
  rollBaseCheck,
  rollBasicAttack,
  rollDerivedCheck,
  runAssistanceRequest,
  runCounterAttackReaction,
  runDemonSharedAction,
  runDemonistEnhancementReaction,
  runDemonistHealingReaction,
  runDrawReaction,
  runKakushiSupplyRequest,
  runReloadWeapon,
  runRecoveryBreath,
  runRestRefresh,
  runSprint,
  runTransportDriveCheck,
  runWait,
  useMedicalItem,
} from "../rules/action-engine.mjs";
import {
  describePoisonState,
  getPoisonProfileLabel,
} from "../rules/poison-utils.mjs";
import {
  calculateArmorClass,
  calculateDemonActionCount,
  calculateDemonBdpMax,
  calculateDemonHpMax,
  calculateDemonReactionMax,
  normalizeBaseStatKey,
  normalizeDerivedStatKey,
  normalizeDerivedStats,
} from "../rules/actor-derived-formulas.mjs";

const BASE_STAT_OPTIONS = [
  { key: "force", label: "Force" },
  { key: "finesse", label: "Finesse" },
  { key: "courage", label: "Courage" },
  { key: "vitesse", label: "Vitesse" },
  { key: "social", label: "Social" },
  { key: "intellect", label: "Intellect" },
];

const CREATION_STANDARD_ARRAY = [0, 1, 2, 3, 4, 5];
const CREATION_STARTING_POINT_BUDGET = 15;
const CREATION_CONTEXT_POINT_BUDGET = 3;

const HUMAN_CREATION_PRESETS = {
  slayer: {
    classType: "Pourfendeur",
    rank: "Mizunoto",
    level: 1,
    statMethod: "assistant-slayer",
    statRolls: "5 Vitesse, 4 Finesse, 3 Force, 2 Courage, 1 Intellect, 0 Social",
    base: { force: 3, finesse: 4, courage: 2, vitesse: 5, social: 0, intellect: 1 },
    derived: {
      puissanceBrute: 2,
      dexterite: 2,
      precision: 2,
      endurance: 1,
      agilite: 2,
      rapidite: 2,
      perception: 1,
    },
    creation: {
      sensePoints: 5,
      superhumanPoints: 5,
      breathFormPoints: 5,
      trainerPoints: { axis1: 1, axis2: 1, axis3: 1 },
      partnerPoints: { axis1: 1, axis2: 1, axis3: 1 },
      kasugaiPoints: { axis1: 1, axis2: 1, axis3: 1 },
    },
    profile: {
      characterType: "slayer",
      combatStyle: "Creation rapide : souffle, mobilite et reactions",
      favoredBreath: "water",
      primaryWeapon: "Katana Nichirin standard",
      trainerContext: "Entraineur cree via assistant.",
      partnerContext: "Partenaire cree via assistant.",
      kasugaiCrow: "Kasugai a nommer",
    },
    resources: { endurance: 22, rp: 11, bdp: 0 },
  },
  demonist: {
    classType: "Demoniste",
    rank: "Mizunoto",
    level: 1,
    statMethod: "assistant-demonist",
    statRolls: "5 Courage, 4 Intellect, 3 Finesse, 2 Vitesse, 1 Force, 0 Social",
    base: { force: 1, finesse: 3, courage: 5, vitesse: 2, social: 0, intellect: 4 },
    derived: {
      precision: 2,
      mithridatisme: 2,
      endurance: 2,
      tolerance: 1,
      reflexes: 1,
      medecine: 2,
      sciences: 1,
      survie: 1,
    },
    creation: {
      sensePoints: 4,
      superhumanPoints: 5,
      breathFormPoints: 6,
      trainerPoints: { axis1: 1, axis2: 1, axis3: 1 },
      partnerPoints: { axis1: 1, axis2: 1, axis3: 1 },
      kasugaiPoints: { axis1: 0, axis2: 0, axis3: 0 },
    },
    profile: {
      characterType: "demonist",
      combatStyle: "Creation rapide : medecine, chair demoniaque et arme a feu",
      favoredBreath: "west",
      primaryWeapon: "Fusil de tranchee",
      trainerContext: "Instructeur demoniste cree via assistant.",
      partnerContext: "Cellule de chasse creee via assistant.",
      kasugaiCrow: "",
    },
    resources: { endurance: 25, rp: 11, bdp: 15 },
  },
};

const DEMON_STAT_KEYS = [
  ["force", "Force"],
  ["finesse", "Finesse"],
  ["courage", "Courage"],
  ["vitesse", "Vitesse"],
  ["intellect", "Intellect"],
  ["social", "Social"],
];
const DEMON_CREATION_BASE_SPREAD = [0, 1, 2, 3, 3, 5];
const DEMON_CREATION_POINT_BUDGET = 3;

const ADVANCED_FEATURE_UNLOCKS = {
  tcbConstantUnlocked: { level: 3, label: "TCB : Constant" },
  markedUnlocked: { level: 6, label: "Forme Marquee" },
  transparentWorldUnlocked: { level: 8, label: "Monde Transparent" },
  redBladeUnlocked: { level: 10, label: "Lame Rouge" },
};

function progressionConfigFor(actorType) {
  if (actorType === "demonist") return DEMONIST_RANK_PROGRESSION;
  if (actorType === "slayer") return SLAYER_RANK_PROGRESSION;
  return null;
}

function isDemonActorType(actorType) {
  return ["demon", "npcDemon"].includes(String(actorType || ""));
}

function normalizeSheetText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function getDemonRankLevel(rank) {
  return Number(DEMON_RANK_LEVELS?.[rank] || 0) || Math.max(1, DEMON_RANKS.indexOf(rank) + 1);
}

function getHumanRankLevel(rank) {
  return Number(HUMAN_RANK_LEVELS?.[rank] || 0) || Math.max(1, SLAYER_RANKS.indexOf(rank) + 1);
}

function rankMeetsRequirement(actorType, currentRank, requiredRank) {
  const rank = String(requiredRank || "").trim();
  if (!rank || ["Tous", "Tous niveaux", "Aucun"].includes(rank)) return true;
  if (isDemonActorType(actorType)) {
    return getDemonRankLevel(currentRank) >= getDemonRankLevel(rank);
  }
  return getHumanRankLevel(currentRank) >= getHumanRankLevel(rank);
}

function getDemonRankPackage(rank) {
  return DEMON_RANK_PACKAGES?.[rank] || null;
}

function getOptionByKey(options, key) {
  return options.find((entry) => entry.key === key) || options[0] || {};
}

function getDemonPackageStats(rank) {
  return Array.from(getDemonRankPackage(rank)?.addedStats || [0, 0, 0, 0, 0, 0]);
}

function getDemonRankUnlocks(rank) {
  return {
    infect: ["Lune inferieure", "Lune superieure"].includes(rank),
    execute: [
      "Disciple de Lune inferieure",
      "Lune inferieure",
      "Disciple de Lune superieure",
      "Lune superieure",
    ].includes(rank),
  };
}

function buildDemonQuickAttackEntries(actor, allItems, benchmark = {}) {
  const naturalItems = allItems.filter((item) => item.type === "demonAbility");
  const byName = (needle) =>
    naturalItems.find((item) => String(item.name || "").toLowerCase().includes(needle));

  const biteItem = byName("morsure");
  const clawItem = byName("griffure");
  const fallbackRange = 1.5;

  const bite = biteItem
    ? {
        key: "bite",
        itemId: biteItem.id,
        name: biteItem.name,
        damage: biteItem.system?.damage || benchmark?.bite || "",
        range: biteItem.system?.range ?? fallbackRange,
      }
    : {
        key: "bite",
        itemId: "",
        name: "Morsure",
        damage: benchmark?.bite || "",
        range: fallbackRange,
      };

  const claw = clawItem
    ? {
        key: "claw",
        itemId: clawItem.id,
        name: clawItem.name,
        damage: clawItem.system?.damage || benchmark?.claw || "",
        range: clawItem.system?.range ?? fallbackRange,
      }
    : {
        key: "claw",
        itemId: "",
        name: "Griffure",
        damage: benchmark?.claw || "",
        range: fallbackRange,
      };

  return [bite, claw].filter((entry) => String(entry.damage || "").trim().length);
}

function buildDemonSharedActionEntries(rank) {
  const unlocks = getDemonRankUnlocks(rank);
  return DEMON_SHARED_ACTIONS.map((action) => ({
    ...action,
    automatable: ["heal", "regrow", "purify", "infect", "sos", "execute", "block", "dodge"].includes(action.key),
    available:
      (action.key !== "infect" || unlocks.infect) &&
      (action.key !== "execute" || unlocks.execute),
  }));
}

function sortedProgressionEntries(config) {
  return Object.entries(config || {}).sort(
    (a, b) => Number(a[1]?.level || 0) - Number(b[1]?.level || 0)
  );
}

function getBreathDefinition(key) {
  return BREATH_KEYS.find((entry) => entry.key === key) || null;
}

function normalizeBreathSpecialKey(breathKey, specialKey) {
  return BREATH_SPECIAL_ALIASES?.[breathKey]?.[specialKey] || specialKey;
}

function mapBreathSpecialEntries(breathKey, specials = {}) {
  const definition = getBreathDefinition(breathKey);
  const known = definition?.specials || {};
  const entries = [];

  for (const [specialKey, meta] of Object.entries(known)) {
    entries.push({
      key: specialKey,
      label: meta.label || specialKey,
      hint: meta.hint || "",
      enabled: !!specials[specialKey],
    });
  }

    for (const [specialKey, enabled] of Object.entries(specials || {})) {
      const normalizedKey = normalizeBreathSpecialKey(breathKey, specialKey);
      if (entries.some((entry) => entry.key === normalizedKey)) continue;
      entries.push({
        key: normalizedKey,
        label: normalizedKey,
        hint: "Speciale presente sur l'acteur mais non repertoriee dans la definition locale du souffle.",
        enabled: !!enabled,
      });
    }

  return entries;
}

function getItemChargeLabel(item) {
  const usesMax = Number(item?.system?.uses?.max || 0) || 0;
  const usesValue = Number(item?.system?.uses?.value || 0) || 0;
  if (usesMax > 0 || usesValue > 0) {
    return `${usesValue}/${usesMax || "?"} dose(s)`;
  }
  return `${Number(item?.system?.quantity || 0) || 0} dose(s)`;
}

function buildActivePoisonSummary(actor) {
  const coating = getActivePoisonCoating(actor);
  if (!coating) {
    return {
      active: false,
      title: "Aucun poison actif",
      lines: ["Aucune arme n'est actuellement enduite."],
    };
  }

  return {
    active: true,
    title: coating.itemName || "Poison actif",
    lines: [
      `Arme: ${coating.weaponName || "non precisee"}`,
      `Profil: ${getPoisonProfileLabel(coating.profile)}`,
      `Puissance: ${Number(coating.potency || 1) || 1}`,
    ].filter(Boolean),
  };
}

export class BLSlayerSheet extends ActorSheet {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["breathe-and-live", "sheet", "actor", "slayer"],
      width: 1180,
      height: 900,
      tabs: [
        {
          navSelector: ".sheet-tabs",
          contentSelector: ".sheet-body",
          initial: "sheet",
        },
      ],
    });
  }

  get template() {
    const byType = {
      slayer: "systems/breathe-and-live/templates/actor/actor-slayer.hbs",
      demonist: "systems/breathe-and-live/templates/actor/actor-demonist.hbs",
      demon: "systems/breathe-and-live/templates/actor/actor-demon.hbs",
      npc: "systems/breathe-and-live/templates/actor/actor-npc.hbs",
      npcHuman: "systems/breathe-and-live/templates/actor/actor-npc.hbs",
      npcDemon: "systems/breathe-and-live/templates/actor/actor-npc.hbs",
      companion: "systems/breathe-and-live/templates/actor/actor-npc.hbs",
    };
    return (
      byType[String(this.actor?.type || "")] ||
      "systems/breathe-and-live/templates/actor/actor-slayer.hbs"
    );
  }

  _sheetDefaultsByType(type) {
    const key = String(type || "slayer");
    return {
      slayer: {
        class: { type: "Pourfendeur", rank: SLAYER_RANKS[0], level: 1 },
        profile: { characterType: "slayer", combatStyle: "breath" },
      },
      demonist: {
        class: { type: "Demoniste", rank: DEMONIST_RANKS[0], level: 1 },
        profile: { characterType: "demonist", combatStyle: "demonist" },
      },
      demon: {
        class: { type: "Demon", rank: DEMON_RANKS[0], level: 1 },
        profile: { characterType: "demon", combatStyle: "bda" },
      },
      npc: {
        class: { type: "PNJ", rank: NPC_RANKS[0], level: 1 },
        profile: { characterType: "npc", combatStyle: "variable" },
      },
      npcHuman: {
        class: { type: "PNJ humain", rank: NPC_RANKS[0], level: 1 },
        profile: { characterType: "npc-human", combatStyle: "variable" },
      },
      npcDemon: {
        class: { type: "PNJ demon", rank: DEMON_RANKS[0], level: 1 },
        profile: { characterType: "npc-demon", combatStyle: "bda" },
      },
      companion: {
        class: { type: "Compagnon", rank: "Soutien", level: 1 },
        profile: { characterType: "companion", combatStyle: "support" },
      },
    }[key] ?? {
      class: { type: "Pourfendeur", rank: SLAYER_RANKS[0], level: 1 },
      profile: { characterType: "slayer", combatStyle: "breath" },
    };
  }

  _derivedToBaseMap() {
    const groups = CONFIG.breatheAndLive?.DERIVED_GROUPS || {};
    const map = {};
    for (const [baseKey, entries] of Object.entries(groups)) {
      for (const entry of entries) map[entry] = baseKey;
    }
    return map;
  }

  _computeRemaining(sys) {
    const budget = this._computeDerivedBudget(sys);
    return Object.fromEntries(
      Object.entries(budget).map(([key, entry]) => [key, entry.remainingSigned])
    );
  }

  _computeDerivedBudget(sys) {
    const groups = CONFIG.breatheAndLive?.DERIVED_GROUPS || {};
    const base = sys.stats?.base || {};
    const derived = normalizeDerivedStats(sys.stats?.derived || {});
    const budget = {};

    for (const [baseKey, entries] of Object.entries(groups)) {
      const spent = (entries || []).reduce(
        (sum, entry) => sum + (Number(derived[entry] ?? 0) || 0),
        0
      );
      const baseValue = Number(base[baseKey] ?? 0) || 0;
      budget[baseKey] = {
        base: baseValue,
        spent,
        remaining: Math.max(0, baseValue - spent),
        remainingSigned: baseValue - spent,
        over: Math.max(0, spent - baseValue),
      };
    }
    return budget;
  }

  _rankOptions() {
    if (this.actor.type === "demonist") return DEMONIST_RANKS;
    if (["demon", "npcDemon"].includes(this.actor.type)) return DEMON_RANKS;
    if (["npc", "npcHuman", "companion"].includes(this.actor.type)) return NPC_RANKS;
    return SLAYER_RANKS;
  }

  async getData(options) {
    const data = await super.getData(options);
    const rawSys =
      (this.actor.system && Object.keys(this.actor.system).length
        ? this.actor.system
        : this.actor.data?.data ?? {}) || {};

    const defaults = {
      class: { ...this._sheetDefaultsByType(this.actor?.type).class, subclass: "" },
      stats: {
        base: {
          force: 0,
          finesse: 0,
          courage: 0,
          vitesse: 0,
          social: 0,
          intellect: 0,
        },
        derived: {},
        remaining: {},
      },
      resources: {
        hp: { value: 20, max: 20, healableMax: 20, base: 20, temporary: 0 },
        e: { value: 0, max: 0, temporary: 0 },
        rp: { value: 0, max: 0 },
        bdp: { value: 0, max: 0 },
        demonisation: 0,
        demonisationMax: 0,
        ca: 10,
      },
      profile: {
        ...this._sheetDefaultsByType(this.actor?.type).profile,
        trainerContext: "",
        partnerContext: "",
        kasugaiCrow: "",
        primaryWeapon: "",
        favoredBreath: "",
        supplement1934Enabled: false,
      },
      combat: {
        damageFlat: 0,
        activePoison: {
          active: false,
          itemId: "",
          itemName: "",
          weaponId: "",
          weaponName: "",
          potency: 1,
          profile: "generic",
          damageFormula: "",
          demonOnly: false,
          ignoreMoonDemons: false,
          application: "action",
          notes: "",
          appliedRound: 0,
        },
        actionEconomy: {
          actionsPerTurn: 1,
          bonusActions: 0,
          movementMeters: 9,
          effectiveMovementMeters: 9,
          recoveryBreathRounds: 2,
          waitEnabled: true,
        },
        reactions: {
          dodge: true,
          counterAttack: true,
          draw: true,
          medical: true,
          special: "",
        },
        injuries: {
          severeWounds: 0,
          nearDeathWounds: 0,
          lostLimbs: "",
          conditions: "",
          limbs: {},
          brokenBones: false,
          targetedDamage: {},
          mutilationNotes: "",
        },
        basicAttack: {
          autoHitMelee: false,
          autoHitFirearm: false,
          unarmedDamage: "1d4 + Force",
        },
      },
      creation: {
        statMethod: "manual",
        statRolls: "",
        statArrayApplied: false,
        trainerBackground: "",
        trainerPoints: { axis1: 0, axis2: 0, axis3: 0 },
        partnerBackground: "",
        partnerPoints: { axis1: 0, axis2: 0, axis3: 0 },
        kasugaiType: "",
        kasugaiPoints: { axis1: 0, axis2: 0, axis3: 0 },
        kasugaiCommands: "",
        sensePoints: 0,
        superhumanPoints: 0,
        breathFormPoints: 0,
      },
      progression: {
        xp: { value: 0, next: 100 },
        training: 0,
        rankPoints: 0,
        notes: "",
        studySlots: { value: 0, max: 0 },
        skillSlots: { value: 0, max: 0 },
        bonuses: {
          endurance: 0,
          reactions: 0,
          weaponDieSteps: 0,
          breathFormBonus: 0,
          repeatedAction: 0,
          demonFleshBonus: 0,
          nichirinDamageBonus: 0,
          nichirinDamageDie: "",
        },
      },
      support: {
        medicalTraining: false,
        demonistHealingReaction: false,
        activeDemonistMedicine: false,
        recentDemonFleshRank: "",
        demonistMedicineActiveCombatId: "",
        companionActorId: "",
        companionName: "",
        companionRole: "",
      },
      demonology: {
        bodyType: "humanoid",
        baseHpChoice: 20,
        movementType: "biped",
        movementBase: 9,
        dangerLevel: "moderate",
        basicDamage: "1d4",
        halfReactionRule: false,
        halfDamageStatRule: false,
        benchmark: {
          force: 0,
          finesse: 0,
          courage: 0,
          vitesse: 0,
          intellect: 0,
          social: 0,
          hp: 0,
          ca: 0,
          bite: "",
          claw: "",
          bda: "",
          rp: 0,
        },
      },
      death: {
        state: "alive",
        standingDeath: false,
        deathNotes: "",
      },
      npc: {
        role: "",
        threat: "",
        behavior: "",
        loot: "",
      },
      states: {},
      breaths: {},
      conditions: {},
      supplement1934: { enabled: false, notes: "" },
    };

    data.system = foundry.utils.mergeObject(
      foundry.utils.duplicate(defaults),
      rawSys,
      { inplace: false, insertKeys: true, overwrite: true }
    );
    data.system.stats.derived = normalizeDerivedStats(data.system.stats.derived);

    data.canEdit = !!(game.user?.isGM || this.actor.isOwner);
    data.supplement1934Global = !!game.settings.get(SYSTEM_ID, "enableSupplement1934");
    data.supplement1934Active =
      data.supplement1934Global || !!data.system.supplement1934?.enabled;

    const allItems = Array.from(this.actor.items ?? []);
    const activeBreaths = getActiveBreaths(this.actor);
    data.itemsTech = allItems
      .filter((i) => ["technique", "subclassTechnique", "bda", "demonAbility"].includes(i.type))
      .map((item) => {
        const breathKey = item.system?.breathKey || normalizeBreathName(item.system?.breath);
        const requiresBreath =
          item.type === "technique" && item.system?.automation?.requiresBreath !== false && !!breathKey;
        const hasRequiredBreath = !requiresBreath || actorHasBreath(this.actor, breathKey);
        const activation = String(item.system?.activation || "").toLowerCase();
        const automation = item.system?.automation || {};
        const hasActionableAutomation =
          !!automation?.noDamage ||
          !!automation?.teleportToBurned ||
          !!automation?.summonFormula ||
          !!automation?.afflictionCondition ||
          Number(automation?.delayedDamageRounds || 0) > 0;
        const hasDamage = !!String(item.system?.damage || "").trim();
        return {
          id: item.id,
          name: item.name,
          type: item.type,
          img: item.img,
          system: {
            ...item.system,
            breathDisplay: item.system?.breathLabel || getBreathLabel(breathKey, item.system?.breath || ""),
          },
          blMissingBreath: requiresBreath && !hasRequiredBreath,
          blUsable:
            activation !== "passive" &&
            (hasDamage ||
              hasActionableAutomation ||
              ["action", "bonus", "reaction", "free", "rest"].includes(activation)),
        };
      });
    data.itemsBreaths = allItems.filter((i) => i.type === "breath");
    data.itemsWeapons = allItems.filter((i) =>
      ["weapon", "firearm", "projectile", "explosive"].includes(i.type)
    );
    data.itemsPoisons = allItems
      .filter((i) => i.type === "poison")
      .map((item) => ({
        id: item.id,
        name: item.name,
        type: item.type,
        img: item.img,
        system: item.system,
        blChargeLabel: getItemChargeLabel(item),
        blProfileLabel: getPoisonProfileLabel(item.system?.profile),
      }));
    data.itemsMedical = allItems.filter((i) => ["medical", "consumable", "food"].includes(i.type));
    data.itemsProgression = allItems.filter((i) => i.type === "feature");
    data.itemsInventory = allItems.filter(
      (i) =>
        !["technique", "subclassTechnique", "bda", "demonAbility", "breath", "poison", "feature"].includes(i.type)
    );
    data.itemsOtherInventory = data.itemsInventory.filter(
      (i) =>
        ![
          "weapon",
          "firearm",
          "projectile",
          "explosive",
          "medical",
          "consumable",
          "food",
          "poison",
        ].includes(i.type)
    );
    data.itemsCrafting = allItems.filter(
      (i) => i.type === "craftingRecipe" || i.system?.crafting?.enabled
    );

    data.derived = {
      groups: CONFIG.breatheAndLive?.DERIVED_GROUPS || {},
      labels: CONFIG.breatheAndLive?.DERIVED_LABELS || {},
    };
    data.derivedBudget = this._computeDerivedBudget(data.system);
    data.system.stats.remaining = this._computeRemaining(data.system);
    const creation = data.system.creation || {};
    data.creationBudget = {
      starting: this._sumCreationStartingPoints(creation),
      trainer: this._sumCreationContextPoints(creation.trainerPoints),
      partner: this._sumCreationContextPoints(creation.partnerPoints),
      kasugai: this._sumCreationContextPoints(creation.kasugaiPoints),
      startingMax: CREATION_STARTING_POINT_BUDGET,
      contextMax: CREATION_CONTEXT_POINT_BUDGET,
    };
    data.creationBudget.startingRemaining =
      CREATION_STARTING_POINT_BUDGET - data.creationBudget.starting;
    data.creationBudget.trainerRemaining =
      CREATION_CONTEXT_POINT_BUDGET - data.creationBudget.trainer;
    data.creationBudget.partnerRemaining =
      CREATION_CONTEXT_POINT_BUDGET - data.creationBudget.partner;
    data.creationBudget.kasugaiRemaining =
      CREATION_CONTEXT_POINT_BUDGET - data.creationBudget.kasugai;
    data.ownedBreathItems = data.itemsBreaths.map((item) => {
      const breathKey = item.system?.key || "";
      const definition = getBreathDefinition(breathKey);
      const prereq = foundry.utils.duplicate(
        definition?.prereq || item.system?.prereq || { sense: "", stats: "", weapons: "" }
      );
      const activeBreath = activeBreaths?.[breathKey] || {};
      const enabledSpecials = mapBreathSpecialEntries(breathKey, activeBreath.specials || {})
        .filter((entry) => !!entry.enabled)
        .map((entry) => entry.label);
      const breathImg =
        /^icons\/svg\//.test(String(item.img || "")) && definition?.img ? definition.img : item.img;

      return {
        id: item.id,
        name: item.name,
        img: breathImg,
        key: breathKey,
        sourceSection: item.system?.sourceSection || "",
        description: item.system?.description || "",
        prereqText: [prereq.sense, prereq.stats, prereq.weapons].filter(Boolean).join(" / "),
        itemSpecials: enabledSpecials,
        actorEnabled: !!activeBreath.enabled,
      };
    });

    data.breathEntries = BREATH_KEYS.map((entry) => ({
      ...entry,
      enabled: !!activeBreaths?.[entry.key]?.enabled,
      specialEntries: mapBreathSpecialEntries(
        entry.key,
        activeBreaths?.[entry.key]?.specials || {}
      ),
    }));
    data.advancedStateEntries = ADVANCED_STATES.map((entry) => ({
      ...entry,
      active: !!data.system.states?.[entry.key],
    }));
    const actorLevel = Number(data.system.class?.level || 1) || 1;
    data.advancedFeatureUnlocks = Object.entries(ADVANCED_FEATURE_UNLOCKS).map(
      ([key, meta]) => ({
        key,
        label: meta.label,
        level: meta.level,
        unlocked: !!data.system.progression?.[key] || actorLevel >= meta.level,
      })
    );
    data.demonBodyOptions = DEMON_BODY_OPTIONS;
    data.demonMovementOptions = DEMON_MOVEMENT_OPTIONS;
    data.demonDangerOptions = DEMON_DANGER_OPTIONS;
    const demonBodyChoice = getOptionByKey(DEMON_BODY_OPTIONS, data.system.demonology?.bodyType);
    const demonMovementChoice = getOptionByKey(
      DEMON_MOVEMENT_OPTIONS,
      data.system.demonology?.movementType
    );
    const demonDangerChoice = getOptionByKey(
      DEMON_DANGER_OPTIONS,
      data.system.demonology?.dangerLevel
    );
    const demonCreationSpent =
      Number(demonBodyChoice.points || 0) +
      Number(demonMovementChoice.points || 0) +
      Number(demonDangerChoice.points || 0);
    data.demonCreationBudget = {
      spent: demonCreationSpent,
      max: DEMON_CREATION_POINT_BUDGET,
      remaining: DEMON_CREATION_POINT_BUDGET - demonCreationSpent,
      valid: demonCreationSpent <= DEMON_CREATION_POINT_BUDGET,
      body: demonBodyChoice,
      movement: demonMovementChoice,
      danger: demonDangerChoice,
    };
    data.demonBloodlineOptions = DEMON_BLOODLINE_VARIANTS;
    data.demonBloodlineDetails = DEMON_BLOODLINE_DETAILS;
    data.demonBloodlineDetail = this._getDemonBloodlineDetail(
      data.system.demonology?.sharedBloodline
    );
    data.demonBloodlineDataLabel =
      data.demonBloodlineDetail?.availableData === "mechanics-extracted"
        ? "Pouvoirs extraits disponibles"
        : "Traits seulement";
    data.demonSharedActions = buildDemonSharedActionEntries(data.system.class.rank);
    data.demonRankPackage = DEMON_RANK_PACKAGES[data.system.class.rank] || null;
    data.demonRankBenchmark = foundry.utils.duplicate(data.demonRankPackage?.benchmark || {});
    data.demonRankPackageLabels = data.demonRankPackage
      ? [
          { label: "Force", value: data.demonRankPackage.addedStats?.[0] ?? 0 },
          { label: "Finesse", value: data.demonRankPackage.addedStats?.[1] ?? 0 },
          { label: "Courage", value: data.demonRankPackage.addedStats?.[2] ?? 0 },
          { label: "Vitesse", value: data.demonRankPackage.addedStats?.[3] ?? 0 },
          { label: "Intellect", value: data.demonRankPackage.addedStats?.[4] ?? 0 },
          { label: "Social", value: data.demonRankPackage.addedStats?.[5] ?? 0 },
        ]
      : [];
    data.demonBenchmarkRows = [
      { label: "Force", value: data.demonRankBenchmark?.force ?? 0 },
      { label: "Finesse", value: data.demonRankBenchmark?.finesse ?? 0 },
      { label: "Courage", value: data.demonRankBenchmark?.courage ?? 0 },
      { label: "Vitesse", value: data.demonRankBenchmark?.vitesse ?? 0 },
      { label: "Intellect", value: data.demonRankBenchmark?.intellect ?? 0 },
      { label: "Social", value: data.demonRankBenchmark?.social ?? 0 },
    ];
    data.demonQuickAttacks = buildDemonQuickAttackEntries(this.actor, allItems, data.demonRankBenchmark);
    data.activePoisonSummary = buildActivePoisonSummary(this.actor);
    data.poisonStateSummary = describePoisonState(
      data.system.conditions?.poisoned || {},
      this.actor
    );
    data.conditionEntries = CONDITION_DEFINITIONS.map((entry) => ({
      ...entry,
      state: data.system.conditions?.[entry.key] || {
        active: false,
        intensity: 0,
        duration: 0,
        notes: "",
      },
    }));
    data.conditionAutomationNotes = data.system.conditions?.automation?.notes || [];
    data.limbEntries = LIMB_DEFINITIONS
      .filter((entry) => !entry.demonOnly || isDemonActorType(this.actor.type))
      .map((entry) => ({
        ...entry,
        thresholdPercent: Math.round(Number(entry.thresholdRatio || 0.2) * 100),
        targetedDamage: data.system.combat?.injuries?.targetedDamage?.[entry.key] || 0,
        state: data.system.combat?.injuries?.limbs?.[entry.key] || {
          injured: false,
          severed: false,
          broken: false,
          notes: "",
        },
      }));

    data.rankOptions = this._rankOptions();
    data.rankLevelAuto =
      (!!HUMAN_RANK_LEVELS[data.system.class.rank] && ["slayer", "demonist"].includes(this.actor.type)) ||
      (!!DEMON_RANK_LEVELS[data.system.class.rank] && isDemonActorType(this.actor.type));
    data.deathStates = [
      { value: "alive", label: "Vivant" },
      { value: "critical", label: "Critique" },
      { value: "dying", label: "Agonisant" },
      { value: "dead", label: "Mort" },
    ];

    data.isSlayer = this.actor.type === "slayer";
    data.isDemon = this.actor.type === "demon";
    data.isDemonist = this.actor.type === "demonist";
    data.isNpcDemon = this.actor.type === "npcDemon";
    data.isNpc = ["npc", "npcHuman", "npcDemon", "companion"].includes(this.actor.type);
    data.isCompanion = this.actor.type === "companion";
    data.hasDerivedStats = !data.isCompanion;

    return data;
  }

  async _promptRankAdvancement(stepEntries) {
    const statChoices = stepEntries.flatMap(([, step]) => step.statChoices || []);
    const summaryItems = [];
    let hpBonus = 0;
    let enduranceBonus = 0;
    let reactionBonus = 0;
    let studySlots = 0;
    let skillSlots = 0;
    let weaponDieSteps = 0;
    let breathFormBonus = 0;
    let repeatedActionBonus = 0;
    let demonFleshBonus = 0;
    let nichirinDamageBonus = 0;
    let nichirinDamageDie = "";

    for (const [, step] of stepEntries) {
      hpBonus += Number(step.hpBonus || 0);
      enduranceBonus += Number(step.enduranceBonus || 0);
      reactionBonus += Number(step.reactionBonus || 0);
      studySlots += Number(step.studySlots || 0);
      skillSlots += Number(step.skillSlots || 0);
      weaponDieSteps += Number(step.weaponDieSteps || 0);
      breathFormBonus += Number(step.breathFormBonus || 0);
      repeatedActionBonus += Number(step.repeatedActionBonus || 0);
      demonFleshBonus += Number(step.demonFleshBonus || 0);
      nichirinDamageBonus += Number(step.nichirinDamageBonus || 0);
      if (step.nichirinDamageDie) nichirinDamageDie = step.nichirinDamageDie;
    }

    if (hpBonus) summaryItems.push(`PV permanents: +${hpBonus}`);
    if (enduranceBonus) summaryItems.push(`Endurance permanente: +${enduranceBonus}`);
    if (reactionBonus) summaryItems.push(`Reactions permanentes: +${reactionBonus}`);
    if (studySlots) summaryItems.push(`Slots d'etude: +${studySlots}`);
    if (skillSlots) summaryItems.push(`Slots de competence: +${skillSlots}`);
    if (weaponDieSteps) summaryItems.push(`Degats d'armes: +${weaponDieSteps} de`);
    if (breathFormBonus) summaryItems.push(`Formes de souffle: +${breathFormBonus} de degats`);
    if (repeatedActionBonus) summaryItems.push(`Action repetee: +${repeatedActionBonus}`);
    if (demonFleshBonus) summaryItems.push(`BDP gagnes via chair: +${demonFleshBonus}`);
    if (nichirinDamageBonus) summaryItems.push(`Degats Nichirin: +${nichirinDamageBonus}`);
    if (nichirinDamageDie) summaryItems.push(`Degats Nichirin definis a ${nichirinDamageDie}`);

    const choiceFields = statChoices
      .map(
        (amount, index) => `
          <div class="form-group">
            <label>Choix de stat ${index + 1} (+${amount})</label>
            <select name="stat-${index}">
              ${BASE_STAT_OPTIONS.map(
                (option) => `<option value="${option.key}">${option.label}</option>`
              ).join("")}
            </select>
          </div>`
      )
      .join("");

    const content = `
      <form class="bl-rank-dialog">
        <p>Cette montee de rang applique les bonus du livre.</p>
        <ul>${summaryItems.map((item) => `<li>${item}</li>`).join("")}</ul>
        ${choiceFields}
      </form>`;

    return await new Promise((resolve) => {
      new Dialog({
        title: "Montee de rang",
        content,
        buttons: {
          apply: {
            label: "Appliquer",
            callback: (html) => {
              const chosenStats = statChoices.map((amount, index) => ({
                amount,
                stat: html.find(`[name="stat-${index}"]`).val(),
              }));
              resolve({
                chosenStats,
                hpBonus,
                enduranceBonus,
                reactionBonus,
                studySlots,
                skillSlots,
                weaponDieSteps,
                breathFormBonus,
                repeatedActionBonus,
                demonFleshBonus,
                nichirinDamageBonus,
                nichirinDamageDie,
              });
            },
          },
          cancel: {
            label: "Annuler",
            callback: () => resolve(null),
          },
        },
        default: "apply",
        close: () => resolve(null),
      }).render(true);
    });
  }

  async _promptDemonRankAdvancement({
    previousRank,
    nextRank,
    nextLevel,
    statDelta,
    unlocks,
    benchmark,
    projected,
  }) {
    const statRows = DEMON_STAT_KEYS.map(([key, label]) => ({
      label,
      delta: Number(statDelta?.[key] || 0),
    })).filter((row) => row.delta !== 0);

    const reminders = [
      "Les PV, la CA, les RP et les BDP seront recalcules automatiquement depuis les nouvelles statistiques.",
      "Les demons gardent la regle de demi-RP et l'ajout Force/Finesse a moitie aux degats.",
    ];

    if (unlocks.infect) reminders.push("Le rang choisi debloque Infecter.");
    if (unlocks.execute) reminders.push("Le rang choisi debloque Executer.");

    const content = `
      <form class="bl-rank-dialog">
        <p>Le demon passe de <b>${previousRank}</b> a <b>${nextRank}</b> (niveau ${nextLevel}).</p>
        <p>Le rang applique un paquet fixe de statistiques. Le corps de base choisi ne change pas avec le rang.</p>
        <h3>Gains de statistiques</h3>
        <ul>${statRows.map((row) => `<li>${row.label} +${row.delta}</li>`).join("") || "<li>Aucun changement detecte.</li>"}</ul>
        <h3>Valeurs recalculees sur la fiche</h3>
        <ul>
          <li>PV de la fiche : ${projected.hp} (= ${projected.baseHpChoice} de corps + 5 x Force)</li>
          <li>CA de la fiche : ${projected.ca} (= 10 + Vitesse)</li>
          <li>BDP max : ${projected.bdp} (= 10 x Courage)</li>
          <li>RP max : ${projected.rp} (regle demon, valeur divisee par 2)</li>
        </ul>
        <h3>Repere du rang</h3>
        <p><small>Repere du livre pour un profil demon de reference. Ce bloc n'ecrase pas automatiquement les formules de la fiche.</small></p>
        <ul>
          <li>PV / CA : ${benchmark.hp} / ${benchmark.ca}</li>
          <li>Morsure : ${benchmark.bite || "-"}</li>
          <li>Griffure : ${benchmark.claw || "-"}</li>
          <li>BDA : ${benchmark.bda || "-"}</li>
          <li>RP repere : ${benchmark.rp}</li>
        </ul>
        <h3>Rappels</h3>
        <ul>${reminders.map((row) => `<li>${row}</li>`).join("")}</ul>
      </form>`;

    return await new Promise((resolve) => {
      new Dialog({
        title: "Montee de rang demoniaque",
        content,
        buttons: {
          apply: {
            label: "Appliquer",
            callback: () => resolve(true),
          },
          cancel: {
            label: "Annuler",
            callback: () => resolve(false),
          },
        },
        default: "apply",
        close: () => resolve(false),
      }).render(true);
    });
  }

  async _handleDemonRankChange(select, previousRank, nextRank) {
    const actorDoc =
      (!this.actor?.isToken && game.actors?.get?.(this.actor?.id)) || this.actor;
    const previousIndex = DEMON_RANKS.indexOf(previousRank);
    const nextIndex = DEMON_RANKS.indexOf(nextRank);
    if (previousIndex === -1 || nextIndex === -1 || previousRank === nextRank) return;

    const nextLevel = getDemonRankLevel(nextRank);
    const nextPackage = getDemonRankPackage(nextRank);
    const nextBenchmark = foundry.utils.duplicate(nextPackage?.benchmark || {});

    if (nextIndex <= previousIndex) {
      await actorDoc.update({
        system: {
          class: {
            rank: nextRank,
          },
        },
      });
      if (nextIndex < previousIndex) {
        ui.notifications.warn(
          "Le changement vers un rang inferieur ne retire pas automatiquement les bonus demoniaques deja appliques."
        );
      }
      this.render(false);
      return;
    }

    const previousStats = getDemonPackageStats(previousRank);
    const nextStats = getDemonPackageStats(nextRank);
    const statDelta = Object.fromEntries(
      DEMON_STAT_KEYS.map(([key], index) => [key, Math.max(0, Number(nextStats[index] || 0) - Number(previousStats[index] || 0))])
    );
    const currentBase = actorDoc.system.stats?.base || {};
    const baseHpChoice = Number(actorDoc.system.demonology?.baseHpChoice || 20) || 20;
    const currentForce = Number(currentBase.force || 0);
    const currentCourage = Number(currentBase.courage || 0);
    const currentVitesse = Number(currentBase.vitesse || 0);
    const currentIntellect = Number(currentBase.intellect || 0);

    const nextBase = {
      force: currentForce + Number(statDelta.force || 0),
      finesse: Number(currentBase.finesse || 0) + Number(statDelta.finesse || 0),
      courage: currentCourage + Number(statDelta.courage || 0),
      vitesse: currentVitesse + Number(statDelta.vitesse || 0),
      intellect: currentIntellect + Number(statDelta.intellect || 0),
      social: Number(currentBase.social || 0) + Number(statDelta.social || 0),
    };

    const previousHpMax = calculateDemonHpMax(baseHpChoice, { force: currentForce });
    const nextHpMax = calculateDemonHpMax(baseHpChoice, nextBase);
    const previousBdpMax = calculateDemonBdpMax({ courage: currentCourage });
    const nextBdpMax = calculateDemonBdpMax(nextBase);
    const previousRpMax = calculateDemonReactionMax({
      vitesse: currentVitesse,
      intellect: currentIntellect,
    });
    const nextRpMax = calculateDemonReactionMax(nextBase);
    const nextCa = calculateArmorClass(nextBase);

    const confirmed = await this._promptDemonRankAdvancement({
      previousRank,
      nextRank,
      nextLevel,
      statDelta,
      unlocks: getDemonRankUnlocks(nextRank),
      benchmark: {
        hp: Number(nextBenchmark.hp || 0),
        ca: Number(nextBenchmark.ca || 0),
        bite: nextBenchmark.bite || "",
        claw: nextBenchmark.claw || "",
        bda: nextBenchmark.bda || "",
        rp: Number(nextBenchmark.rp || 0),
      },
      projected: {
        hp: nextHpMax,
        ca: nextCa,
        bdp: nextBdpMax,
        rp: nextRpMax,
        baseHpChoice,
      },
    });

    if (!confirmed) {
      select.value = previousRank;
      return;
    }

    const nextHpValue =
      Number(actorDoc.system.resources?.hp?.value || 0) + Math.max(0, nextHpMax - previousHpMax);
    const nextBdpValue =
      Number(actorDoc.system.resources?.bdp?.value || 0) + Math.max(0, nextBdpMax - previousBdpMax);
    const nextRpValue =
      Number(actorDoc.system.resources?.rp?.value || 0) + Math.max(0, nextRpMax - previousRpMax);

    const rankUpdate = {
      system: {
        class: {
          rank: nextRank,
        },
        stats: {
          base: {
            force: nextBase.force,
            finesse: nextBase.finesse,
            courage: nextBase.courage,
            vitesse: nextBase.vitesse,
            intellect: nextBase.intellect,
            social: nextBase.social,
          },
        },
        resources: {
          hp: {
            value: nextHpValue,
          },
          bdp: {
            value: nextBdpValue,
          },
          rp: {
            value: nextRpValue,
          },
        },
      },
    };

    try {
      await actorDoc.update(rankUpdate);
    } catch (error) {
      console.error("BL | Demon rank grouped update failed, retrying in smaller patches.", error);
      await actorDoc.update({
        system: {
          class: {
            rank: nextRank,
          },
        },
      });
      await actorDoc.update({
        system: {
          stats: {
            base: {
              force: nextBase.force,
              finesse: nextBase.finesse,
              courage: nextBase.courage,
              vitesse: nextBase.vitesse,
              intellect: nextBase.intellect,
              social: nextBase.social,
            },
          },
        },
      });
      await actorDoc.update({
        system: {
          resources: {
            hp: {
              value: nextHpValue,
            },
            bdp: {
              value: nextBdpValue,
            },
            rp: {
              value: nextRpValue,
            },
          },
        },
      });
    }

    const unlockedRows = [];
    const nextUnlocks = getDemonRankUnlocks(nextRank);
    const previousUnlocks = getDemonRankUnlocks(previousRank);
    if (nextUnlocks.infect && !previousUnlocks.infect) unlockedRows.push("Infecter");
    if (nextUnlocks.execute && !previousUnlocks.execute) unlockedRows.push("Executer");

    if (unlockedRows.length) {
      ui.notifications.info(
        `Montee de rang appliquee. Nouvelles actions debloquees: ${unlockedRows.join(", ")}.`
      );
    } else {
      ui.notifications.info("Montee de rang demoniaque appliquee.");
    }

    this.render(false);
  }

  async _handleRankChange(event) {
    event.preventDefault();
    event.stopPropagation();
    const select = event.currentTarget;
    const previousRank = this.actor.system.class.rank;
    const nextRank = String(select.value || "");
    if (isDemonActorType(this.actor.type)) {
      await this._handleDemonRankChange(select, previousRank, nextRank);
      return;
    }

    const config = progressionConfigFor(this.actor.type);

    if (!config || nextRank === previousRank) return;

    const previousLevel = HUMAN_RANK_LEVELS[previousRank] || Number(this.actor.system.class.level) || 1;
    const nextLevel = HUMAN_RANK_LEVELS[nextRank] || config[nextRank]?.level || previousLevel;

    if (nextLevel <= previousLevel) {
      await this.actor.update({
        "system.class.rank": nextRank,
        "system.class.level": nextLevel,
      });
      if (nextLevel < previousLevel) {
        ui.notifications.warn("Le changement vers un rang inferieur ne retire pas automatiquement les bonus deja appliques.");
      }
      this.render(false);
      return;
    }

    const stepEntries = sortedProgressionEntries(config).filter(
      ([, step]) => step.level > previousLevel && step.level <= nextLevel
    );
    const advancement = await this._promptRankAdvancement(stepEntries);

    if (!advancement) {
      select.value = previousRank;
      return;
    }

    const update = {
      "system.class.rank": nextRank,
      "system.class.level": nextLevel,
      "system.resources.hp.max":
        Number(this.actor.system.resources?.hp?.max || 0) + Number(advancement.hpBonus || 0),
      "system.resources.hp.value":
        Number(this.actor.system.resources?.hp?.value || 0) + Number(advancement.hpBonus || 0),
      "system.resources.e.value":
        Number(this.actor.system.resources?.e?.value || 0) + Number(advancement.enduranceBonus || 0),
      "system.resources.rp.value":
        Number(this.actor.system.resources?.rp?.value || 0) + Number(advancement.reactionBonus || 0),
      "system.progression.studySlots.max":
        Number(this.actor.system.progression?.studySlots?.max || 0) + Number(advancement.studySlots || 0),
      "system.progression.skillSlots.max":
        Number(this.actor.system.progression?.skillSlots?.max || 0) + Number(advancement.skillSlots || 0),
      "system.progression.skillSlots.value":
        Number(this.actor.system.progression?.skillSlots?.value || 0) + Number(advancement.skillSlots || 0),
      "system.progression.bonuses.endurance":
        Number(this.actor.system.progression?.bonuses?.endurance || 0) + Number(advancement.enduranceBonus || 0),
      "system.progression.bonuses.reactions":
        Number(this.actor.system.progression?.bonuses?.reactions || 0) + Number(advancement.reactionBonus || 0),
      "system.progression.bonuses.weaponDieSteps":
        Number(this.actor.system.progression?.bonuses?.weaponDieSteps || 0) + Number(advancement.weaponDieSteps || 0),
      "system.progression.bonuses.breathFormBonus":
        Number(this.actor.system.progression?.bonuses?.breathFormBonus || 0) + Number(advancement.breathFormBonus || 0),
      "system.progression.bonuses.repeatedAction":
        Number(this.actor.system.progression?.bonuses?.repeatedAction || 0) + Number(advancement.repeatedActionBonus || 0),
      "system.progression.bonuses.demonFleshBonus":
        Number(this.actor.system.progression?.bonuses?.demonFleshBonus || 0) + Number(advancement.demonFleshBonus || 0),
      "system.progression.bonuses.nichirinDamageBonus":
        Number(this.actor.system.progression?.bonuses?.nichirinDamageBonus || 0) + Number(advancement.nichirinDamageBonus || 0),
      "system.progression.bonuses.nichirinDamageDie":
        advancement.nichirinDamageDie || this.actor.system.progression?.bonuses?.nichirinDamageDie || "",
    };

    const statTotals = {};
    for (const choice of advancement.chosenStats || []) {
      if (!choice?.stat) continue;
      statTotals[choice.stat] = Number(statTotals[choice.stat] || 0) + Number(choice.amount || 0);
    }
    for (const [statKey, amount] of Object.entries(statTotals)) {
      update[`system.stats.base.${statKey}`] =
        Number(this.actor.system.stats?.base?.[statKey] || 0) + Number(amount || 0);
    }

    await this.actor.update(update);

    const followUps = [];
    if (advancement.weaponDieSteps) followUps.push(`degats d'armes +${advancement.weaponDieSteps} de`);
    if (advancement.breathFormBonus) followUps.push(`formes de souffle +${advancement.breathFormBonus} de`);
    if (advancement.repeatedActionBonus) followUps.push(`action repetee +${advancement.repeatedActionBonus}`);
    if (advancement.demonFleshBonus) followUps.push(`BDP sur chair +${advancement.demonFleshBonus}`);
    if (advancement.nichirinDamageBonus) followUps.push(`degats Nichirin +${advancement.nichirinDamageBonus}`);
    if (advancement.nichirinDamageDie) followUps.push(`Nichirin ${advancement.nichirinDamageDie}`);

    if (followUps.length) {
      ui.notifications.info(`Montee de rang appliquee. Penses aussi aux effets de combat suivants: ${followUps.join(", ")}.`);
    } else {
      ui.notifications.info("Montee de rang appliquee.");
    }

    this.render(false);
  }

  _sumCreationStartingPoints(creation = {}) {
    return (
      Number(creation.sensePoints || 0) +
      Number(creation.superhumanPoints || 0) +
      Number(creation.breathFormPoints || 0)
    );
  }

  _sumCreationContextPoints(points = {}) {
    return (
      Number(points.axis1 || 0) +
      Number(points.axis2 || 0) +
      Number(points.axis3 || 0)
    );
  }

  async _applyCreationStandardArray() {
    const update = {
      "system.creation.statMethod": "array",
      "system.creation.statRolls": CREATION_STANDARD_ARRAY.join(", "),
      "system.creation.statArrayApplied": true,
    };
    BASE_STAT_OPTIONS.forEach((stat, index) => {
      update[`system.stats.base.${stat.key}`] = CREATION_STANDARD_ARRAY[index] ?? 0;
    });
    await this.actor.update(update);
    ui.notifications.info("Table de stats 0,1,2,3,4,5 appliquee dans l'ordre de la fiche. Tu peux rearranger manuellement.");
    this.render(false);
  }

  async _rollCreationStats() {
    const rolls = [];
    for (let i = 0; i < 6; i += 1) {
      const roll = await new Roll("1d6").evaluate({ async: true });
      rolls.push(Number(roll.total || 0));
    }
    await this.actor.update({
      "system.creation.statMethod": "roll",
      "system.creation.statRolls": rolls.join(", "),
      "system.creation.statArrayApplied": false,
    });
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content: `<em>${this.actor.name} tire ses statistiques de creation : ${rolls.join(", ")}.</em>`,
    });
    this.render(false);
  }

  async _applyHumanCreationAssistant() {
    const preset = HUMAN_CREATION_PRESETS[this.actor.type];
    if (!preset) {
      ui.notifications.warn("Assistant de creation rapide reserve aux Pourfendeurs et Demonistes.");
      return;
    }

    const confirmed = await Dialog.confirm({
      title: "Assistant de creation",
      content: `<p>Appliquer le profil de depart ${preset.classType} sur ${this.actor.name} ? Les statistiques, points de creation et contextes seront remplaces.</p>`,
      yes: () => true,
      no: () => false,
      defaultYes: true,
    });
    if (!confirmed) return;

    const derived = normalizeDerivedStats(preset.derived);
    const update = {
      "system.class.type": preset.classType,
      "system.class.rank": preset.rank,
      "system.class.level": preset.level,
      "system.creation.statMethod": preset.statMethod,
      "system.creation.statRolls": preset.statRolls,
      "system.creation.statArrayApplied": true,
      "system.creation.sensePoints": preset.creation.sensePoints,
      "system.creation.superhumanPoints": preset.creation.superhumanPoints,
      "system.creation.breathFormPoints": preset.creation.breathFormPoints,
      "system.creation.trainerPoints": preset.creation.trainerPoints,
      "system.creation.partnerPoints": preset.creation.partnerPoints,
      "system.creation.kasugaiPoints": preset.creation.kasugaiPoints,
      "system.creation.trainerBackground": preset.profile.trainerContext,
      "system.creation.partnerBackground": preset.profile.partnerContext,
      "system.creation.notes": "Assistant de creation rapide applique; ajuster les choix fins selon la table.",
      "system.profile.characterType": preset.profile.characterType,
      "system.profile.combatStyle": preset.profile.combatStyle,
      "system.profile.trainerContext": preset.profile.trainerContext,
      "system.profile.partnerContext": preset.profile.partnerContext,
      "system.profile.kasugaiCrow": preset.profile.kasugaiCrow,
      "system.profile.primaryWeapon": preset.profile.primaryWeapon,
      "system.profile.favoredBreath": preset.profile.favoredBreath,
      "system.resources.hp.base": 20,
      "system.resources.hp.max": 20,
      "system.resources.hp.value": 20,
      "system.resources.hp.healableMax": 20,
      "system.resources.e.value": preset.resources.endurance,
      "system.resources.e.max": preset.resources.endurance,
      "system.resources.rp.value": preset.resources.rp,
      "system.resources.rp.max": preset.resources.rp,
      "system.progression.studySlots.value": 0,
      "system.progression.studySlots.max": 0,
      "system.progression.skillSlots.value": 0,
      "system.progression.skillSlots.max": 0,
    };

    for (const [key, value] of Object.entries(preset.base)) {
      update[`system.stats.base.${key}`] = value;
    }
    for (const [key, value] of Object.entries(derived)) {
      update[`system.stats.derived.${key}`] = value;
    }

    if (this.actor.type === "demonist") {
      update["system.support.demonistHealingReaction"] = true;
      update["system.resources.bdp.value"] = preset.resources.bdp;
      update["system.resources.bdp.max"] = preset.resources.bdp;
      update["system.resources.demonisation"] = 0;
    }

    await this.actor.update(update);
    await this._addStartingEquipment();
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content: `<em>Assistant de creation ${preset.classType} applique a ${this.actor.name}. Verifie ensuite le souffle, les traits et les choix narratifs fins.</em>`,
    });
    this.render(false);
  }

  async _promptDemonCreationStats() {
    const rows = DEMON_STAT_KEYS.map(
      ([key, label], index) => `
        <div class="form-group">
          <label>${label}</label>
          <select name="${key}">
            ${DEMON_CREATION_BASE_SPREAD.map((value, optionIndex) => `<option value="${value}" ${optionIndex === index ? "selected" : ""}>${value}</option>`).join("")}
          </select>
        </div>`
    ).join("");

    const content = `
      <form class="bl-demon-creation-dialog">
        <p>Assigne la base demoniaque <b>0, 1, 2, 3, 3, 5</b>. Le paquet de rang sera ajoute automatiquement ensuite.</p>
        ${rows}
      </form>`;

    return new Promise((resolve) => {
      new Dialog(
        {
          title: "Creation demon - statistiques de base",
          content,
          buttons: {
            apply: {
              label: "Appliquer",
              callback: (html) => {
                const assignment = {};
                for (const [key] of DEMON_STAT_KEYS) {
                  assignment[key] = Number(html.find(`[name="${key}"]`).val() || 0) || 0;
                }
                resolve(assignment);
              },
            },
            cancel: {
              label: "Annuler",
              callback: () => resolve(null),
            },
          },
          default: "apply",
          close: () => resolve(null),
        },
        { width: 480 }
      ).render(true);
    });
  }

  async _applyDemonCreationAssistant({ bodyType = "", movementType = "", dangerLevel = "" } = {}) {
    if (!isDemonActorType(this.actor.type)) {
      ui.notifications.warn("L'assistant demon est reserve aux demons jouables ou PNJ demons.");
      return null;
    }

    const body = getOptionByKey(DEMON_BODY_OPTIONS, bodyType || this.actor.system?.demonology?.bodyType);
    const movement = getOptionByKey(
      DEMON_MOVEMENT_OPTIONS,
      movementType || this.actor.system?.demonology?.movementType
    );
    const danger = getOptionByKey(
      DEMON_DANGER_OPTIONS,
      dangerLevel || this.actor.system?.demonology?.dangerLevel
    );
    const spent =
      Number(body.points || 0) +
      Number(movement.points || 0) +
      Number(danger.points || 0);

    if (spent > DEMON_CREATION_POINT_BUDGET) {
      ui.notifications.warn(
        `Budget de creation demon depasse (${spent}/${DEMON_CREATION_POINT_BUDGET}).`
      );
      return null;
    }

    const baseAssignment = await this._promptDemonCreationStats();
    if (!baseAssignment) return null;

    const sorted = Object.values(baseAssignment).sort((a, b) => a - b).join(",");
    if (sorted !== DEMON_CREATION_BASE_SPREAD.slice().sort((a, b) => a - b).join(",")) {
      ui.notifications.warn("La base demoniaque doit utiliser exactement 0, 1, 2, 3, 3, 5.");
      return null;
    }

    const rank = String(this.actor.system?.class?.rank || DEMON_RANKS[0]);
    const packageStats = getDemonPackageStats(rank);
    const nextBase = {};
    DEMON_STAT_KEYS.forEach(([key], index) => {
      nextBase[key] = Number(baseAssignment[key] || 0) + Number(packageStats[index] || 0);
    });

    const hpMax = calculateDemonHpMax(body.baseHp, nextBase);
    const bdpMax = calculateDemonBdpMax(nextBase);
    const rpMax = calculateDemonReactionMax(nextBase);
    const ca = calculateArmorClass(nextBase);
    const actionsPerTurn = calculateDemonActionCount(nextBase);
    const unlocks = getDemonRankUnlocks(rank);

    await this.actor.update({
      "system.creation.statMethod": "demon-assistant",
      "system.creation.statRolls": DEMON_STAT_KEYS.map(
        ([key, label]) => `${label} ${baseAssignment[key]}`
      ).join(", "),
      "system.creation.statArrayApplied": true,
      "system.demonology.bodyType": body.key,
      "system.demonology.baseHpChoice": Number(body.baseHp || 20),
      "system.demonology.movementType": movement.key,
      "system.demonology.movementBase": Number(movement.movement || 9),
      "system.demonology.dangerLevel": danger.key,
      "system.demonology.basicDamage": danger.baseDamage || "1d4",
      "system.demonology.rankPackage": rank,
      "system.demonology.canInfect": unlocks.infect,
      "system.demonology.canExecute": unlocks.execute,
      "system.demonology.halfReactionRule": true,
      "system.demonology.halfDamageStatRule": true,
      "system.stats.base.force": nextBase.force,
      "system.stats.base.finesse": nextBase.finesse,
      "system.stats.base.courage": nextBase.courage,
      "system.stats.base.vitesse": nextBase.vitesse,
      "system.stats.base.intellect": nextBase.intellect,
      "system.stats.base.social": nextBase.social,
      "system.resources.hp.base": Number(body.baseHp || 20),
      "system.resources.hp.max": hpMax,
      "system.resources.hp.value": hpMax,
      "system.resources.hp.healableMax": hpMax,
      "system.resources.e.value": 0,
      "system.resources.e.max": 0,
      "system.resources.rp.max": rpMax,
      "system.resources.rp.value": rpMax,
      "system.resources.bdp.max": bdpMax,
      "system.resources.bdp.value": bdpMax,
      "system.resources.ca": ca,
      "system.combat.actionEconomy.actionsPerTurn": actionsPerTurn,
      "system.combat.actionEconomy.movementMeters": Number(movement.movement || 9),
      "system.combat.actionEconomy.effectiveMovementMeters": Number(movement.movement || 9),
      "system.combat.basicAttack.unarmedDamage": `${danger.baseDamage || "1d4"} + Force`,
    });

    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content: `<em>Creation demon appliquee pour ${this.actor.name}: ${body.label}, ${movement.label}, ${danger.label} (${spent}/${DEMON_CREATION_POINT_BUDGET} points), rang ${rank}.</em>`,
    });
    ui.notifications.info("Creation demon appliquee.");
    this.render(false);
    return nextBase;
  }

  async _createKasugaiCompanion() {
    if (!this.actor || this.actor.type !== "slayer") {
      ui.notifications.warn("La creation de Kasugai est reservee aux fiches de Pourfendeur.");
      return null;
    }

    const linkedId = String(this.actor.system?.support?.companionActorId || "");
    const linkedActor = linkedId ? game.actors?.get(linkedId) : null;
    if (linkedActor) {
      linkedActor.sheet?.render(true);
      return linkedActor;
    }

    const profileName = String(this.actor.system?.profile?.kasugaiCrow || "").trim();
    const birdType = String(this.actor.system?.creation?.kasugaiType || "").trim();
    const commands = String(this.actor.system?.creation?.kasugaiCommands || "").trim();
    const name = profileName || `Kasugai de ${this.actor.name}`;
    const role = birdType || "Corbeau Kasugai";

    const companion = await Actor.create({
      name,
      type: "companion",
      img: "icons/creatures/birds/corvid-flying-black.webp",
      system: {
        class: { type: "Compagnon", rank: "Soutien", level: 1 },
        profile: {
          characterType: "companion",
          combatStyle: "support",
          trainerContext: "",
          partnerContext: `Lie a ${this.actor.name}`,
          kasugaiCrow: name,
          primaryWeapon: "",
          favoredBreath: "",
        },
        creation: {
          kasugaiType: role,
          kasugaiCommands: commands,
          kasugaiPoints: foundry.utils.duplicate(
            this.actor.system?.creation?.kasugaiPoints || { axis1: 0, axis2: 0, axis3: 0 }
          ),
        },
        support: {
          companionName: name,
          companionRole: role,
        },
        npc: {
          role,
          threat: "Soutien",
          behavior: commands,
          loot: "",
        },
      },
    });

    await this.actor.update({
      "system.support.companionActorId": companion.id,
      "system.support.companionName": companion.name,
      "system.support.companionRole": role,
    });

    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content: `<em>${this.actor.name} cree le compagnon Kasugai <strong>${companion.name}</strong>${commands ? ` avec les commandes: ${commands}.` : "."}</em>`,
    });
    ui.notifications.info(`${companion.name} cree et lie a ${this.actor.name}.`);
    this.render(false);
    return companion;
  }

  async _findCompendiumItem(packName, itemName) {
    const pack =
      game.packs?.get(`${SYSTEM_ID}.${packName}`) ||
      game.packs?.get(packName);
    if (!pack) return null;
    const index = await pack.getIndex({ fields: ["name", "type", "img", "system"] });
    const entry = index.find((candidate) => candidate.name === itemName);
    if (!entry?._id) return null;
    return pack.getDocument(entry._id);
  }

  _getDemonBloodlineDetail(value) {
    const normalized = normalizeSheetText(value);
    if (!normalized) return null;
    return (
      DEMON_BLOODLINE_DETAILS.find(
        (entry) =>
          normalizeSheetText(entry.name) === normalized ||
          normalizeSheetText(entry.key) === normalized
      ) || null
    );
  }

  async _importDemonBloodlineAbilities() {
    if (!isDemonActorType(this.actor.type)) {
      ui.notifications.warn("Les lignages demoniaques ne s'importent que sur une fiche demon.");
      return [];
    }

    const detail = this._getDemonBloodlineDetail(
      this.actor.system?.demonology?.sharedBloodline
    );
    if (!detail) {
      ui.notifications.warn("Choisis une lignee demoniaque connue avant l'import.");
      return [];
    }

    const pack =
      game.packs?.get(`${SYSTEM_ID}.abilities-demons`) ||
      game.packs?.get("abilities-demons");
    if (!pack) {
      ui.notifications.warn("Pack abilities-demons introuvable.");
      return [];
    }

    const index = await pack.getIndex({ fields: ["name", "type", "img", "system"] });
    const existingNames = new Set(
      Array.from(this.actor.items ?? []).map((item) => String(item.name || ""))
    );
    const currentRank = this.actor.system?.class?.rank || "";
    const tagSet = new Set([normalizeSheetText(detail.key)]);
    const candidates = index.filter((entry) => {
      const tags = Array.isArray(entry.system?.tags) ? entry.system.tags : [];
      const normalizedTags = tags.map((tag) => normalizeSheetText(tag));
      const matchesBloodline = normalizedTags.some((tag) => tagSet.has(tag));
      if (!matchesBloodline || existingNames.has(entry.name)) return false;
      const requiredRank = entry.system?.prerequisites?.rank || "";
      return rankMeetsRequirement(this.actor.type, currentRank, requiredRank);
    });

    const documents = [];
    for (const entry of candidates) {
      const document = await pack.getDocument(entry._id);
      if (!document) continue;
      const data = document.toObject();
      delete data._id;
      documents.push(data);
    }

    const created = documents.length
      ? await this.actor.createEmbeddedDocuments("Item", documents)
      : [];
    const importedNames = created.map((item) => item.name);
    const skippedByName = index
      .filter((entry) => {
        const tags = Array.isArray(entry.system?.tags) ? entry.system.tags : [];
        return (
          tags.map((tag) => normalizeSheetText(tag)).some((tag) => tagSet.has(tag)) &&
          existingNames.has(entry.name)
        );
      })
      .map((entry) => entry.name);

    const noteParts = [];
    if (importedNames.length) noteParts.push(`Importes: ${importedNames.join(", ")}`);
    if (skippedByName.length) noteParts.push(`Deja presents: ${skippedByName.join(", ")}`);
    if (!noteParts.length) {
      noteParts.push(
        "Aucun pouvoir importable pour ce rang avec les donnees locales disponibles."
      );
    }

    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content: `<em>Lignee ${detail.name} pour ${this.actor.name}. ${noteParts.join(" | ")}</em>`,
    });
    ui.notifications.info(`Import de lignee termine: ${importedNames.length} ajout(s).`);
    this.render(false);
    return created;
  }

  async _addStartingEquipment() {
    const kits = {
      // TODO-RULEBOOK-AMBIGUITY: the book says "pistolet au choix" for Slayers;
      // this imports the current representative pistol from the local pack until
      // a dedicated chooser exists.
      slayer: [
        ["items-weapons", "Katana Nichirin standard"],
        ["items-weapons", "Pistolet standard"],
        ["items-medical-utility", "Bandage"],
        ["items-medical-utility", "Pansement compressif"],
        ["items-medical-utility", "Sifflet Kasugai"],
      ],
      demonist: [
        ["items-weapons", "Fusil de tranchee"],
        ["items-weapons", "Wakizashi Nichirin"],
        ["items-medical-utility", "Bandage"],
      ],
    };

    const kit = kits[this.actor.type];
    if (!kit) {
      ui.notifications.warn("Aucun equipement initial automatique n'est configure pour ce type d'acteur.");
      return [];
    }

    const existingNames = new Set(
      Array.from(this.actor.items ?? []).map((item) => String(item.name || ""))
    );
    const itemData = [];
    const missing = [];
    const skipped = [];

    for (const [packName, itemName] of kit) {
      if (existingNames.has(itemName)) {
        skipped.push(itemName);
        continue;
      }
      const document = await this._findCompendiumItem(packName, itemName);
      if (!document) {
        missing.push(`${itemName} (${packName})`);
        continue;
      }
      const data = document.toObject();
      delete data._id;
      itemData.push(data);
    }

    const created = itemData.length
      ? await this.actor.createEmbeddedDocuments("Item", itemData)
      : [];
    const createdNames = created.map((item) => item.name);
    const noteParts = [];
    if (createdNames.length) noteParts.push(`Ajoutes: ${createdNames.join(", ")}`);
    if (skipped.length) noteParts.push(`Deja presents: ${skipped.join(", ")}`);
    if (missing.length) noteParts.push(`Manquants: ${missing.join(", ")}`);

    await this.actor.update({
      "system.creation.startingEquipment": noteParts.join(" | "),
    });
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content: `<em>Equipement initial de ${this.actor.name}: ${noteParts.join(" | ") || "aucun changement"}.</em>`,
    });
    if (missing.length) {
      ui.notifications.warn(`Equipement initial incomplet: ${missing.join(", ")}.`);
    } else {
      ui.notifications.info("Equipement initial ajoute depuis les compendiums.");
    }
    this.render(false);
    return created;
  }

  _validateFeatureAcquisition(itemData) {
    if (!itemData || itemData.type !== "feature") return { ok: true, slotCost: 0 };
    const sys = itemData.system || {};
    const featureKey = String(sys.featureKey || itemData.name || "").trim();
    const repeatable = !!sys.repeatable;

    if (!repeatable) {
      const alreadyOwned = Array.from(this.actor.items ?? []).some((item) => {
        if (item.type !== "feature") return false;
        const ownedKey = String(item.system?.featureKey || item.name || "").trim();
        return ownedKey && ownedKey === featureKey;
      });
      if (alreadyOwned) {
        return { ok: false, message: `${this.actor.name} possede deja ${itemData.name}.` };
      }
    }

    const requiredRank = sys.rank || sys.prerequisites?.rank || "";
    if (!rankMeetsRequirement(this.actor.type, this.actor.system?.class?.rank, requiredRank)) {
      return {
        ok: false,
        message: `${itemData.name} requiert le rang ${requiredRank}.`,
      };
    }

    const requiredClass = String(sys.prerequisites?.class || "").trim();
    if (requiredClass) {
      const actorClass = String(this.actor.system?.class?.type || this.actor.type || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();
      const normalizedRequired = requiredClass
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();
      const classMatches =
        actorClass.includes(normalizedRequired) ||
        (normalizedRequired.includes("pourfendeur") && this.actor.type === "slayer") ||
        (normalizedRequired.includes("demoniste") && this.actor.type === "demonist") ||
        (normalizedRequired.includes("demon") && isDemonActorType(this.actor.type));
      if (!classMatches) {
        return {
          ok: false,
          message: `${itemData.name} requiert la classe ${requiredClass}.`,
        };
      }
    }

    const slotCost = Math.max(0, Number(sys.slotCost ?? 0) || 0);
    const slots = Number(this.actor.system?.progression?.skillSlots?.value || 0) || 0;
    if (slotCost > slots) {
      return {
        ok: false,
        message: `${itemData.name} requiert ${slotCost} emplacement(s) de competence; ${slots} disponible(s).`,
      };
    }

    return { ok: true, slotCost };
  }

  _addNumericFeatureUpdate(update, path, amount) {
    const value = Number(amount || 0) || 0;
    if (!value) return;
    const current = Number(foundry.utils.getProperty(this.actor, path) || 0) || 0;
    update[path] = current + value;
  }

  async _applyFeatureAcquisition(item, slotCost = 0) {
    if (!item || item.type !== "feature") return;
    const sys = item.system || {};
    const bonuses = sys.bonuses || {};
    const update = {};

    if (slotCost > 0) {
      update["system.progression.skillSlots.value"] = Math.max(
        0,
        (Number(this.actor.system?.progression?.skillSlots?.value || 0) || 0) - slotCost
      );
    }

    if (sys.unlockFlag) update[`system.progression.${sys.unlockFlag}`] = true;
    if (sys.stateKey && sys.grantsState) update[`system.states.${sys.stateKey}`] = true;

    if (bonuses.hpMax) {
      this._addNumericFeatureUpdate(update, "system.resources.hp.max", bonuses.hpMax);
      this._addNumericFeatureUpdate(update, "system.resources.hp.value", bonuses.hpMax);
      this._addNumericFeatureUpdate(update, "system.resources.hp.base", bonuses.hpMax);
    }
    if (bonuses.endurance) {
      this._addNumericFeatureUpdate(update, "system.progression.bonuses.endurance", bonuses.endurance);
      this._addNumericFeatureUpdate(update, "system.resources.e.value", bonuses.endurance);
    }
    if (bonuses.movement) {
      this._addNumericFeatureUpdate(update, "system.combat.actionEconomy.movementMeters", bonuses.movement);
    }
    if (bonuses.studySlots) {
      this._addNumericFeatureUpdate(update, "system.progression.studySlots.max", bonuses.studySlots);
      this._addNumericFeatureUpdate(update, "system.progression.studySlots.value", bonuses.studySlots);
    }
    if (bonuses.skillSlots) {
      this._addNumericFeatureUpdate(update, "system.progression.skillSlots.max", bonuses.skillSlots);
      this._addNumericFeatureUpdate(update, "system.progression.skillSlots.value", bonuses.skillSlots);
    }
    if (bonuses.breathFormBonus) {
      this._addNumericFeatureUpdate(update, "system.progression.bonuses.breathFormBonus", bonuses.breathFormBonus);
    }
    if (bonuses.demonFleshExtraDice) {
      this._addNumericFeatureUpdate(update, "system.progression.bonuses.demonFleshExtraDice", bonuses.demonFleshExtraDice);
    }
    if (bonuses.socialExternal) {
      this._addNumericFeatureUpdate(update, "system.progression.bonuses.socialExternal", bonuses.socialExternal);
    }
    if (bonuses.executionHpBaseLimit) {
      update["system.progression.bonuses.executionHpBaseLimit"] = Math.max(
        Number(this.actor.system?.progression?.bonuses?.executionHpBaseLimit || 0) || 0,
        Number(bonuses.executionHpBaseLimit || 0) || 0
      );
    }
    if (bonuses.stealthDamageBonus) {
      update["system.progression.bonuses.stealthDamageBonus"] = bonuses.stealthDamageBonus;
    }
    if (bonuses.firearmModsMax) {
      update["system.progression.bonuses.firearmModsMax"] = Math.max(
        Number(this.actor.system?.progression?.bonuses?.firearmModsMax || 0) || 0,
        Number(bonuses.firearmModsMax || 0) || 0
      );
    }
    for (const [key, amount] of Object.entries(bonuses.baseStats || {})) {
      const statKey = normalizeBaseStatKey(key);
      this._addNumericFeatureUpdate(
        update,
        `system.progression.bonuses.baseStats.${statKey}`,
        amount
      );
    }
    for (const [key, amount] of Object.entries(bonuses.derivedStats || {})) {
      const statKey = normalizeDerivedStatKey(key);
      this._addNumericFeatureUpdate(
        update,
        `system.progression.bonuses.derivedStats.${statKey}`,
        amount
      );
    }
    if (bonuses.subclass) update["system.class.subclass"] = bonuses.subclass;
    if (bonuses.unarmedDamage) update["system.combat.basicAttack.unarmedDamage"] = bonuses.unarmedDamage;
    if (bonuses.autoHitMelee !== undefined) update["system.combat.basicAttack.autoHitMelee"] = !!bonuses.autoHitMelee;
    if (bonuses.autoHitFirearm !== undefined) update["system.combat.basicAttack.autoHitFirearm"] = !!bonuses.autoHitFirearm;
    if (bonuses.medicalReaction !== undefined) update["system.support.medicalTraining"] = !!bonuses.medicalReaction;
    if (bonuses.demonistHealingReaction !== undefined) {
      update["system.support.demonistHealingReaction"] = !!bonuses.demonistHealingReaction;
    }
    for (const flag of ["drivingLicense", "poisonSpecialist", "dualWield", "sniperTraining", "senseTraining"]) {
      if (bonuses[flag] !== undefined) update[`system.progression.flags.${flag}`] = !!bonuses[flag];
    }

    if (Object.keys(update).length) await this.actor.update(update);
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content: `<em>${this.actor.name} acquiert la competence ${item.name}${slotCost ? ` (${slotCost} slot)` : ""}.</em>`,
    });
  }

  activateListeners(html) {
    super.activateListeners(html);
    const canEdit = game.user?.isGM || this.actor.isOwner;
    const canRoll =
      canEdit || this.actor.testUserPermission?.(game.user, "OBSERVER") || false;

    if (canRoll) {
      html.on("click", ".bl-roll-base", async (event) => {
        event.preventDefault();
        const statKey = String(event.currentTarget.dataset.stat || "");
        const label = String(event.currentTarget.dataset.label || statKey);
        await rollBaseCheck(this.actor, statKey, `Test ${label}`);
      });

      html.on("click", ".bl-roll-derived", async (event) => {
        event.preventDefault();
        const derivedKey = String(event.currentTarget.dataset.derived || "");
        const label = String(event.currentTarget.dataset.label || derivedKey);
        await rollDerivedCheck(this.actor, derivedKey, `Test ${label}`);
      });
    }

    if (!canEdit) return;

    const map = this._derivedToBaseMap();
    html.on("change", 'input[name^="system.stats.derived."]', async (event) => {
      const input = event.currentTarget;
      const path = input.name;
      const derivedKey = path.split(".").pop();
      const baseKey = map[derivedKey];
      if (!baseKey) return;

      let value = Number(input.value);
      if (!Number.isFinite(value) || value < 0) value = 0;

      const sys = this.actor.system;
      const list = (CONFIG.breatheAndLive?.DERIVED_GROUPS || {})[baseKey] || [];
      let spentByOthers = 0;
      for (const entry of list) {
        if (entry === derivedKey) continue;
        spentByOthers +=
          Number(foundry.utils.getProperty(sys, `stats.derived.${entry}`) ?? 0) || 0;
      }

      const baseValue =
        Number(foundry.utils.getProperty(sys, `stats.base.${baseKey}`) ?? 0) || 0;
      value = Math.min(value, Math.max(0, baseValue - spentByOthers));

      input.value = String(value);
      await this.actor.update({ [path]: value });
      this.render(false);
    });

    html.on("click", ".bl-custom-breath-builder", async (event) => {
      event.preventDefault();
      await openCustomBreathBuilder(this.actor);
      this.render(false);
    });

    html.on("click", ".bl-creation-standard-array", async (event) => {
      event.preventDefault();
      await this._applyCreationStandardArray();
    });

    html.on("click", ".bl-creation-roll-stats", async (event) => {
      event.preventDefault();
      await this._rollCreationStats();
    });

    html.on("click", ".bl-apply-human-creation", async (event) => {
      event.preventDefault();
      await this._applyHumanCreationAssistant();
    });

    html.on("click", ".bl-create-kasugai", async (event) => {
      event.preventDefault();
      await this._createKasugaiCompanion();
    });

    html.on("click", ".bl-apply-demon-creation", async (event) => {
      event.preventDefault();
      await this._applyDemonCreationAssistant({
        bodyType: String(html.find('[name="system.demonology.bodyType"]').val() || ""),
        movementType: String(html.find('[name="system.demonology.movementType"]').val() || ""),
        dangerLevel: String(html.find('[name="system.demonology.dangerLevel"]').val() || ""),
      });
    });

    html.on("click", ".bl-import-demon-bloodline", async (event) => {
      event.preventDefault();
      await this._importDemonBloodlineAbilities();
    });

    html.on("click", ".bl-starting-equipment", async (event) => {
      event.preventDefault();
      await this._addStartingEquipment();
    });

    html.on("change", ".bl-creation-budget-input", async (event) => {
      const input = event.currentTarget;
      const group = input.dataset.creationGroup || "";
      const max = group === "starting" ? CREATION_STARTING_POINT_BUDGET : CREATION_CONTEXT_POINT_BUDGET;
      const selector =
        group === "starting"
          ? ".bl-creation-budget-input[data-creation-group='starting']"
          : `.bl-creation-budget-input[data-creation-group='${group}']`;
      const total = Array.from(html.find(selector)).reduce(
        (sum, entry) => sum + (Number(entry.value || 0) || 0),
        0
      );
      if (total > max) {
        ui.notifications.warn(`Budget de creation depasse (${total}/${max}).`);
      }
    });

    html.find(".item-delete").on("click", (event) => {
      const li = event.currentTarget.closest(".item");
      const id = li?.dataset.itemId;
      if (id) this.actor.deleteEmbeddedDocuments("Item", [id]);
    });

    html.find(".item-edit").on("click", (event) => {
      const li = event.currentTarget.closest(".item");
      const item = li ? this.actor.items.get(li.dataset.itemId) : null;
      if (item) item.sheet?.render(true);
    });

    html.on("click", ".item-chat, .bl-use-technique", async (event) => {
      event.preventDefault();
      const li = event.currentTarget.closest(".item");
      const item = li ? this.actor.items.get(li.dataset.itemId) : null;
      if (!item) return;

      if (["technique", "subclassTechnique", "bda", "demonAbility"].includes(item.type)) {
        await useTechnique(this.actor, item, { controlledToken: this.actor?.token });
        return;
      }
    });

    html.on("click", ".bl-weapon-attack", async (event) => {
      event.preventDefault();
      const li = event.currentTarget.closest(".item");
      const item = li ? this.actor.items.get(li.dataset.itemId) : null;
      if (!item) return;
      await rollBasicAttack(this.actor, { item });
    });

    html.on("click", ".bl-weapon-reload", async (event) => {
      event.preventDefault();
      const li = event.currentTarget.closest(".item");
      const item = li ? this.actor.items.get(li.dataset.itemId) : null;
      if (!item) return;
      await runReloadWeapon(this.actor, item);
      this.render(false);
    });

    html.on("click", ".bl-drive-relaxed", async (event) => {
      event.preventDefault();
      const li = event.currentTarget.closest(".item");
      const item = li ? this.actor.items.get(li.dataset.itemId) : null;
      if (!item) return;
      await runTransportDriveCheck(this.actor, item, { mode: "relaxed" });
    });

    html.on("click", ".bl-drive-danger", async (event) => {
      event.preventDefault();
      const li = event.currentTarget.closest(".item");
      const item = li ? this.actor.items.get(li.dataset.itemId) : null;
      if (!item) return;
      await runTransportDriveCheck(this.actor, item, { mode: "danger" });
    });

    html.on("click", ".bl-crafting-check", async (event) => {
      event.preventDefault();
      const li = event.currentTarget.closest(".item");
      const item = li ? this.actor.items.get(li.dataset.itemId) : null;
      if (!item) return;
      await runCraftingCheck(this.actor, item);
    });

    html.on("click", ".bl-demon-basic-attack", async (event) => {
      event.preventDefault();
      const itemId = event.currentTarget.dataset.itemId;
      let item = itemId ? this.actor.items.get(itemId) : null;
      if (!item) {
        item = {
          name: String(event.currentTarget.dataset.attackName || "Attaque demoniaque"),
          type: "demonAbility",
          system: {
            damage: String(event.currentTarget.dataset.attackDamage || this.actor.system?.combat?.basicAttack?.unarmedDamage || "1"),
            range: Number(event.currentTarget.dataset.attackRange || 1.5) || 1.5,
            weaponFamily: "natural",
          },
        };
      }
      if (!item) return;
      await rollBasicAttack(this.actor, { item });
    });

    html.on("click", ".bl-demon-shared-action", async (event) => {
      event.preventDefault();
      const actionKey = String(event.currentTarget.dataset.actionKey || "");
      if (!actionKey) return;
      await runDemonSharedAction(this.actor, actionKey);
      this.render(false);
    });

    html.on("click", ".bl-use-medical", async (event) => {
      event.preventDefault();
      const li = event.currentTarget.closest(".item");
      const item = li ? this.actor.items.get(li.dataset.itemId) : null;
      if (!item) return;
      await useMedicalItem(this.actor, item, { reaction: false });
      this.render(false);
    });

    html.on("click", ".bl-apply-poison", async (event) => {
      event.preventDefault();
      const li = event.currentTarget.closest(".item");
      const item = li ? this.actor.items.get(li.dataset.itemId) : null;
      if (!item) return;
      await coatWeaponWithPoison(this.actor, item);
      this.render(false);
    });

    html.on("click", ".bl-clear-poison", async (event) => {
      event.preventDefault();
      await clearActivePoisonCoating(this.actor);
      this.render(false);
    });

    html.find(".bl-action-basic-attack").on("click", async (event) => {
      event.preventDefault();
      await rollBasicAttack(this.actor);
    });
    html.find(".bl-action-repeated-attack").on("click", async (event) => {
      event.preventDefault();
      await rollBasicAttack(this.actor, { repeatedAction: true });
    });
    html.find(".bl-action-demon-flesh").on("click", async (event) => {
      event.preventDefault();
      await gainDemonFleshBdp(this.actor);
      this.render(false);
    });
    html.find(".bl-action-demonist-heal").on("click", async (event) => {
      event.preventDefault();
      await runDemonistHealingReaction(this.actor, { maximize: false });
      this.render(false);
    });
    html.find(".bl-action-demonist-heal-max").on("click", async (event) => {
      event.preventDefault();
      await runDemonistHealingReaction(this.actor, { maximize: true });
      this.render(false);
    });
    html.find(".bl-action-demonist-enhance").on("click", async (event) => {
      event.preventDefault();
      await runDemonistEnhancementReaction(this.actor);
      this.render(false);
    });
    html.find(".bl-action-recovery").on("click", async (event) => {
      event.preventDefault();
      await runRecoveryBreath(this.actor);
      this.render(false);
    });
    html.find(".bl-action-sprint").on("click", async (event) => {
      event.preventDefault();
      await runSprint(this.actor);
    });
    html.find(".bl-action-wait").on("click", async (event) => {
      event.preventDefault();
      await runWait(this.actor);
    });
    html.find(".bl-action-assistance").on("click", async (event) => {
      event.preventDefault();
      await runAssistanceRequest(this.actor);
    });
    html.find(".bl-action-kakushi").on("click", async (event) => {
      event.preventDefault();
      await runKakushiSupplyRequest(this.actor);
    });
    html.find(".bl-action-counter").on("click", async (event) => {
      event.preventDefault();
      await runCounterAttackReaction(this.actor, { assured: false });
      this.render(false);
    });
    html.find(".bl-action-counter-assured").on("click", async (event) => {
      event.preventDefault();
      await runCounterAttackReaction(this.actor, { assured: true });
      this.render(false);
    });
    html.find(".bl-action-draw").on("click", async (event) => {
      event.preventDefault();
      await runDrawReaction(this.actor, { attackAndReturn: false });
      this.render(false);
    });
    html.find(".bl-action-draw-attack").on("click", async (event) => {
      event.preventDefault();
      await runDrawReaction(this.actor, { attackAndReturn: true });
      this.render(false);
    });
    html.find(".bl-action-rest").on("click", async (event) => {
      event.preventDefault();
      await runRestRefresh(this.actor);
      this.render(false);
    });

    html.find("[data-tech-filter]").on("input", (event) => {
      const query = String(event.currentTarget.value || "").trim().toLowerCase();
      html.find(".technique-item").each((_index, el) => {
        const haystack = String(el.dataset.search || "").toLowerCase();
        el.style.display = !query || haystack.includes(query) ? "" : "none";
      });
    });

    html.find('[name="system.class.rank"]').on("change", async (event) => {
      if (event.__blRankHandled) return;
      event.__blRankHandled = true;
      await this._handleRankChange(event);
    });
  }

  async _onChangeInput(event) {
    const element = event.currentTarget;
    if (element?.name === "system.class.rank") {
      if (event.__blRankHandled) return;
      event.__blRankHandled = true;
      await this._handleRankChange(event);
      return;
    }
    return super._onChangeInput(event);
  }

  async _onDropItemCreate(itemData) {
    const entries = Array.isArray(itemData) ? itemData : [itemData];
    const allowed = [];
    const featureSlots = new Map();

    for (const entry of entries) {
      const validation = validateTechniqueOwnership(this.actor, entry);
      if (!validation.ok) {
        ui.notifications.warn(validation.message);
        continue;
      }
      const featureValidation = this._validateFeatureAcquisition(entry);
      if (!featureValidation.ok) {
        ui.notifications.warn(featureValidation.message);
        continue;
      }
      if (entry?.type === "feature") {
        featureSlots.set(entry, featureValidation.slotCost || 0);
      }
      allowed.push(entry);
    }

    if (!allowed.length) return [];
    const results = [];
    for (const entry of allowed) {
      const created = await super._onDropItemCreate(entry);
      const createdDocs = (Array.isArray(created) ? created : [created]).filter(Boolean);
      for (const document of createdDocs) {
        await this._applyFeatureAcquisition(document, featureSlots.get(entry) || 0);
      }
      results.push(...createdDocs);
    }
    return results;
  }
}
