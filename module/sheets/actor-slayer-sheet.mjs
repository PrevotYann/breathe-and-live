// module/sheets/actor-slayer-sheet.mjs
import { useTechnique } from "../chat/use-technique.mjs";

export class BLSlayerSheet extends ActorSheet {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["breathe-and-live", "sheet", "actor", "slayer"],
      width: 720,
      height: 680,
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
    };
    return (
      byType[String(this.actor?.type || "").toLowerCase()] ||
      "systems/breathe-and-live/templates/actor/actor-slayer.hbs"
    );
  }

  _sheetDefaultsByType(type) {
    const key = String(type || "slayer").toLowerCase();
    const base = {
      slayer: {
        class: { type: "Pourfendeur", rank: "Mizunoto", level: 1 },
        profile: { characterType: "slayer", combatStyle: "breath" },
      },
      demonist: {
        class: { type: "Démoniste", rank: "Initié", level: 1 },
        profile: { characterType: "demonist", combatStyle: "demonist" },
      },
      demon: {
        class: { type: "Démon", rank: "Inférieur", level: 1 },
        profile: { characterType: "demon", combatStyle: "bda" },
      },
      npc: {
        class: { type: "PNJ", rank: "-", level: 1 },
        profile: { characterType: "npc", combatStyle: "variable" },
      },
    };
    return base[key] ?? base.slayer;
  }

  /** Construit un lookup "derivedKey -> baseKey" à partir des groupes CONFIG */
  _derivedToBaseMap() {
    const G =
      (CONFIG.breatheAndLive && CONFIG.breatheAndLive.DERIVED_GROUPS) || {};
    const map = {};
    for (const [baseKey, arr] of Object.entries(G)) {
      for (const dk of arr) map[dk] = baseKey;
    }
    return map;
  }

  /** Calcule les “restants” pour chaque base = base - somme(derived du groupe) */
  _computeRemaining(sys) {
    const G =
      (CONFIG.breatheAndLive && CONFIG.breatheAndLive.DERIVED_GROUPS) || {};
    const base = sys.stats?.base || {};
    const der = sys.stats?.derived || {};
    const remaining = {
      force: 0,
      finesse: 0,
      courage: 0,
      vitesse: 0,
      social: 0,
      intellect: 0,
    };

    for (const [baseKey, list] of Object.entries(G)) {
      const sum = (list || []).reduce(
        (acc, dk) => acc + (Number(der[dk] ?? 0) || 0),
        0
      );
      remaining[baseKey] = (Number(base[baseKey] ?? 0) || 0) - sum;
    }
    return remaining;
  }

  /** NORMALISATION DES DONNÉES POUR LE TEMPLATE **/
  async getData(options) {
    const data = await super.getData(options);

    // Source brute (system) ou compat (data.data)
    const rawSys =
      (this.actor.system && Object.keys(this.actor.system).length
        ? this.actor.system
        : this.actor.data?.data ?? {}) || {};

    // Défauts attendus par le template
    const defaults = {
      class: { type: "Pourfendeur", rank: "Mizunoto", level: 1 },
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
        remaining: {
          force: 0,
          finesse: 0,
          courage: 0,
          vitesse: 0,
          social: 0,
          intellect: 0,
        },
      },
      resources: {
        hp: { value: 20, max: 20 },
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
      },
      combat: {
        damageFlat: 0,
        actionEconomy: {
          actionsPerTurn: 1,
          bonusActions: 0,
          movementMeters: 9,
          recoveryBreathRounds: 2,
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
        },
      },
      progression: {
        xp: { value: 0, next: 100 },
        training: 0,
        rankPoints: 0,
        notes: "",
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
    };

    // Fusion : on laisse PRÉVALOIR les vraies données (rawSys)
    data.system = foundry.utils.mergeObject(
      foundry.utils.duplicate(defaults),
      rawSys,
      { inplace: false, insertKeys: true, overwrite: true }
    );

    // Seul GM ou Owner peut éditer (et donc utiliser/supprimer des items)
    const canEdit = game.user?.isGM || this.actor.isOwner;
    data.canEdit = !!canEdit;

    // Items pour les listes
    const allItems = Array.from(this.actor.items ?? []);
    data.itemsTech = allItems.filter((i) => i.type === "technique");
    data.itemsOther = allItems.filter((i) => i.type !== "technique");

    // Injecte groupes+labels dérivés dans le scope du template
    const G =
      (CONFIG.breatheAndLive && CONFIG.breatheAndLive.DERIVED_GROUPS) || {};
    const L =
      (CONFIG.breatheAndLive && CONFIG.breatheAndLive.DERIVED_LABELS) || {};
    data.derived = { groups: G, labels: L };

    // Calcule les “restants” à afficher
    data.system.stats.remaining = this._computeRemaining(data.system);

    data.deathStates = [
      { value: "alive", label: "Vivant" },
      { value: "critical", label: "Critique" },
      { value: "dying", label: "Agonisant" },
      { value: "dead", label: "Mort" },
    ];

    data.isSlayer = this.actor.type === "slayer";
    data.isDemon = this.actor.type === "demon";
    data.isDemonist = this.actor.type === "demonist";
    data.isNpc = this.actor.type === "npc";

    return data;
  }

  activateListeners(html) {
    super.activateListeners(html);
    const canEdit = game.user?.isGM || this.actor.isOwner;

    // Si pas d’édition, on bloque les actions destructrices/modificatrices
    if (!canEdit) return;

    // --- Gestion des dérivés : clamp + anti-dépassement et re-render ---
    const map = this._derivedToBaseMap();
    html.on("change", 'input[name^="system.stats.derived."]', async (ev) => {
      const input = ev.currentTarget;
      const path = input.name; // ex: system.stats.derived.athletisme
      const dKey = path.split(".").pop(); // athletisme
      const baseKey = map[dKey]; // force | finesse | ...
      if (!baseKey) return;

      let v = Number(input.value);
      if (!Number.isFinite(v) || v < 0) v = 0;

      // Récupère état courant
      const sys = this.actor.system;
      const G =
        (CONFIG.breatheAndLive && CONFIG.breatheAndLive.DERIVED_GROUPS) || {};
      const list = G[baseKey] || [];

      // somme des autres (hors celui qu'on édite)
      let sumOthers = 0;
      for (const k of list) {
        if (k === dKey) continue;
        sumOthers +=
          Number(foundry.utils.getProperty(sys, `stats.derived.${k}`) ?? 0) ||
          0;
      }

      const baseVal =
        Number(foundry.utils.getProperty(sys, `stats.base.${baseKey}`) ?? 0) ||
        0;
      const maxForThis = Math.max(0, baseVal - sumOthers);

      // Clamp pour ne pas dépasser la base
      if (v > maxForThis) v = maxForThis;

      // Applique et re-rend
      input.value = String(v);
      await this.actor.update({ [path]: v });
      this.render(false);
    });

    // Supprimer un item
    html.find(".item-delete").on("click", (ev) => {
      const li = ev.currentTarget.closest(".item");
      const id = li?.dataset.itemId;
      if (id) this.actor.deleteEmbeddedDocuments("Item", [id]);
    });

    // Ouvrir la fiche de l'item
    html.find(".item-edit").on("click", (ev) => {
      const li = ev.currentTarget.closest(".item");
      const item = li ? this.actor.items.get(li.dataset.itemId) : null;
      if (item) item.sheet?.render(true);
    });

    // Utiliser une Technique (chat roll + E consumption + souffles)
    html.on("click", ".item-chat, .bl-use-technique", async (ev) => {
      ev.preventDefault();

      const li = ev.currentTarget.closest(".item");
      const item = li ? this.actor.items.get(li.dataset.itemId) : null;
      if (!item) return;

      if (item.type === "technique") {
        return useTechnique(this.actor, item, {
          controlledToken: this.actor?.token,
        });
      }

      // Fallback simple pour d'autres items à coût E + dégâts
      const FU = foundry.utils;
      const cost = Number(item.system?.costE ?? 0) || 0;
      const ePath = "system.resources.e.value";
      const eVal = Number(FU.getProperty(this.actor, ePath) ?? 0) || 0;

      if (eVal < cost) {
        ui.notifications.warn(
          `Pas assez d'Endurance (E). Requis: ${cost}, actuel: ${eVal}`
        );
        return;
      }

      await this.actor.update({ [ePath]: eVal - cost });

      const dmg = item.system?.damage || "1d8";
      const roll = new Roll(dmg);
      await roll.evaluate({ async: true });

      await roll.toMessage({
        speaker: ChatMessage.getSpeaker({ actor: this.actor }),
        flavor: `Utilisation : ${item.name} — E -${cost}`,
      });

      this.render(false);
    });
  }
}
