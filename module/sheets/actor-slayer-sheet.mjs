import {
  ADVANCED_STATES,
  BREATH_KEYS,
  CONDITION_DEFINITIONS,
  DEMON_BODY_OPTIONS,
  DEMON_DANGER_OPTIONS,
  DEMON_MOVEMENT_OPTIONS,
  DEMON_RANK_PACKAGES,
  DEMON_SHARED_ACTIONS,
  DEMONIST_RANKS,
  DEMON_RANKS,
  LIMB_DEFINITIONS,
  NPC_RANKS,
  SLAYER_RANKS,
} from "../config/rule-data.mjs";
import { useTechnique } from "../chat/use-technique.mjs";
import {
  rollBasicAttack,
  runRecoveryBreath,
  runRestRefresh,
  runSprint,
  runWait,
  useMedicalItem,
} from "../rules/action-engine.mjs";

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
    data.itemsTech = allItems.filter((i) =>
      ["technique", "subclassTechnique", "bda", "demonAbility"].includes(i.type)
    );
    data.itemsBreaths = allItems.filter((i) => i.type === "breath");
    data.itemsWeapons = allItems.filter((i) => ["weapon", "firearm"].includes(i.type));
    data.itemsMedical = allItems.filter((i) => ["medical", "consumable", "food"].includes(i.type));
    data.itemsInventory = allItems.filter(
      (i) =>
        !["technique", "subclassTechnique", "bda", "demonAbility", "breath"].includes(i.type)
    );

    data.derived = {
      groups: CONFIG.breatheAndLive?.DERIVED_GROUPS || {},
      labels: CONFIG.breatheAndLive?.DERIVED_LABELS || {},
    };
    data.system.stats.remaining = this._computeRemaining(data.system);
    data.ownedBreathItems = data.itemsBreaths.map((item) => {
      const prereq = item.system?.prereq || {};
      const activeBreath = data.system.breaths?.[item.system?.key] || {};
      const enabledSpecials = Object.entries(item.system?.specials || {})
        .filter(([, enabled]) => !!enabled)
        .map(([key]) => key);

      return {
        id: item.id,
        name: item.name,
        img: item.img,
        key: item.system?.key || "",
        sourceSection: item.system?.sourceSection || "",
        description: item.system?.description || "",
        prereqText: [prereq.sense, prereq.stats, prereq.weapons].filter(Boolean).join(" / "),
        itemSpecials: enabledSpecials,
        actorEnabled: !!activeBreath.enabled,
      };
    });

    data.breathEntries = BREATH_KEYS.map((entry) => ({
      ...entry,
      enabled: !!data.system.breaths?.[entry.key]?.enabled,
      specials: data.system.breaths?.[entry.key]?.specials || {},
    }));
    data.advancedStateEntries = ADVANCED_STATES.map((entry) => ({
      ...entry,
      active: !!data.system.states?.[entry.key],
    }));
    data.demonBodyOptions = DEMON_BODY_OPTIONS;
    data.demonMovementOptions = DEMON_MOVEMENT_OPTIONS;
    data.demonDangerOptions = DEMON_DANGER_OPTIONS;
    data.demonSharedActions = DEMON_SHARED_ACTIONS;
    data.demonRankPackage = DEMON_RANK_PACKAGES[data.system.class.rank] || null;
    data.demonRankPackageLabels = data.demonRankPackage
      ? [
          { label: "Puissance", value: data.demonRankPackage.addedStats?.[0] ?? 0 },
          { label: "Finesse", value: data.demonRankPackage.addedStats?.[1] ?? 0 },
          { label: "Courage", value: data.demonRankPackage.addedStats?.[2] ?? 0 },
          { label: "Vitesse", value: data.demonRankPackage.addedStats?.[3] ?? 0 },
          { label: "Intellect", value: data.demonRankPackage.addedStats?.[4] ?? 0 },
          { label: "Social", value: data.demonRankPackage.addedStats?.[5] ?? 0 },
        ]
      : [];
    data.demonBenchmarkRows = [
      { label: "Puissance", value: data.system.demonology?.benchmark?.force ?? 0 },
      { label: "Finesse", value: data.system.demonology?.benchmark?.finesse ?? 0 },
      { label: "Courage", value: data.system.demonology?.benchmark?.courage ?? 0 },
      { label: "Vitesse", value: data.system.demonology?.benchmark?.vitesse ?? 0 },
      { label: "Intellect", value: data.system.demonology?.benchmark?.intellect ?? 0 },
      { label: "Social", value: data.system.demonology?.benchmark?.social ?? 0 },
    ];
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
    data.deathStates = [
      { value: "alive", label: "Vivant" },
      { value: "critical", label: "Critique" },
      { value: "dying", label: "Agonisant" },
      { value: "dead", label: "Mort" },
    ];

    data.isSlayer = this.actor.type === "slayer";
    data.isDemon = this.actor.type === "demon";
    data.isDemonist = this.actor.type === "demonist";
    data.isNpc = ["npc", "npcHuman", "npcDemon", "companion"].includes(this.actor.type);
    data.isCompanion = this.actor.type === "companion";
    data.hasDerivedStats = !data.isCompanion;

    return data;
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

    html.on("click", ".bl-use-medical", async (event) => {
      event.preventDefault();
      const li = event.currentTarget.closest(".item");
      const item = li ? this.actor.items.get(li.dataset.itemId) : null;
      if (!item) return;
      await useMedicalItem(this.actor, item, { reaction: false });
    });

    html.find(".bl-action-basic-attack").on("click", async (event) => {
      event.preventDefault();
      await rollBasicAttack(this.actor);
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
  }
}
