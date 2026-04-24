import {
  ADVANCED_STATES,
  BREATH_KEYS,
  BREATH_SPECIAL_ALIASES,
  CONDITION_DEFINITIONS,
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
} from "../config/rule-data.mjs";
import { useTechnique } from "../chat/use-technique.mjs";
import { getActiveBreaths } from "../rules/breath-effects.mjs";
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
  rollBasicAttack,
  runDemonSharedAction,
  runRecoveryBreath,
  runRestRefresh,
  runSprint,
  runWait,
  useMedicalItem,
} from "../rules/action-engine.mjs";
import {
  describePoisonState,
  getPoisonProfileLabel,
} from "../rules/poison-utils.mjs";

const BASE_STAT_OPTIONS = [
  { key: "force", label: "Force" },
  { key: "finesse", label: "Finesse" },
  { key: "courage", label: "Courage" },
  { key: "vitesse", label: "Vitesse" },
  { key: "social", label: "Social" },
  { key: "intellect", label: "Intellect" },
];

const DEMON_STAT_KEYS = [
  ["force", "Force"],
  ["finesse", "Finesse"],
  ["courage", "Courage"],
  ["vitesse", "Vitesse"],
  ["intellect", "Intellect"],
  ["social", "Social"],
];

function progressionConfigFor(actorType) {
  if (actorType === "demonist") return DEMONIST_RANK_PROGRESSION;
  if (actorType === "slayer") return SLAYER_RANK_PROGRESSION;
  return null;
}

function isDemonActorType(actorType) {
  return ["demon", "npcDemon"].includes(String(actorType || ""));
}

function getDemonRankLevel(rank) {
  return Number(DEMON_RANK_LEVELS?.[rank] || 0) || Math.max(1, DEMON_RANKS.indexOf(rank) + 1);
}

function getDemonRankPackage(rank) {
  return DEMON_RANK_PACKAGES?.[rank] || null;
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
    automatable: ["heal", "regrow", "purify", "infect", "sos", "execute"].includes(action.key),
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
    const groups = CONFIG.breatheAndLive?.DERIVED_GROUPS || {};
    const base = sys.stats?.base || {};
    const derived = sys.stats?.derived || {};
    const remaining = {
      force: 0,
      finesse: 0,
      courage: 0,
      vitesse: 0,
      social: 0,
      intellect: 0,
    };

    for (const [baseKey, entries] of Object.entries(groups)) {
      const spent = (entries || []).reduce(
        (sum, entry) => sum + (Number(derived[entry] ?? 0) || 0),
        0
      );
      remaining[baseKey] = (Number(base[baseKey] ?? 0) || 0) - spent;
    }
    return remaining;
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
        hp: { value: 20, max: 20, healableMax: 20, base: 20 },
        e: { value: 0, max: 0 },
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
          lostLimbs: "",
          conditions: "",
          limbs: {},
          brokenBones: false,
          mutilationNotes: "",
        },
        basicAttack: {
          autoHitMelee: false,
          autoHitFirearm: false,
          unarmedDamage: "1d4 + Force",
        },
      },
      creation: {
        trainerBackground: "",
        partnerBackground: "",
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

    data.canEdit = !!(game.user?.isGM || this.actor.isOwner);

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
    data.itemsWeapons = allItems.filter((i) => ["weapon", "firearm"].includes(i.type));
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
    data.itemsInventory = allItems.filter(
      (i) =>
        !["technique", "subclassTechnique", "bda", "demonAbility", "breath", "poison"].includes(i.type)
    );
    data.itemsOtherInventory = data.itemsInventory.filter(
      (i) => !["weapon", "firearm", "medical", "consumable", "food", "poison"].includes(i.type)
    );

    data.derived = {
      groups: CONFIG.breatheAndLive?.DERIVED_GROUPS || {},
      labels: CONFIG.breatheAndLive?.DERIVED_LABELS || {},
    };
    data.system.stats.remaining = this._computeRemaining(data.system);
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
    data.demonBodyOptions = DEMON_BODY_OPTIONS;
    data.demonMovementOptions = DEMON_MOVEMENT_OPTIONS;
    data.demonDangerOptions = DEMON_DANGER_OPTIONS;
    data.demonBloodlineOptions = DEMON_BLOODLINE_VARIANTS;
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
    data.limbEntries = LIMB_DEFINITIONS.map((entry) => ({
      ...entry,
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

    const previousHpMax = baseHpChoice + 5 * currentForce;
    const nextHpMax = baseHpChoice + 5 * nextBase.force;
    const previousBdpMax = 10 * currentCourage;
    const nextBdpMax = 10 * nextBase.courage;
    const previousRpMax = Math.max(0, Math.floor((5 + currentVitesse + currentIntellect) / 2));
    const nextRpMax = Math.max(0, Math.floor((5 + nextBase.vitesse + nextBase.intellect) / 2));
    const nextCa = 10 + nextBase.vitesse;

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

  activateListeners(html) {
    super.activateListeners(html);
    const canEdit = game.user?.isGM || this.actor.isOwner;

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

    for (const entry of entries) {
      const validation = validateTechniqueOwnership(this.actor, entry);
      if (!validation.ok) {
        ui.notifications.warn(validation.message);
        continue;
      }
      allowed.push(entry);
    }

    if (!allowed.length) return [];
    const results = [];
    for (const entry of allowed) {
      results.push(await super._onDropItemCreate(entry));
    }
    return results.flat();
  }
}
