/**
 * Fiche de personnage custom pour Breathe and Live
 */
export class BreatheActorSheet extends ActorSheet {
  /** @override */
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["breathe-and-live", "sheet", "actor"],
      template: "systems/breathe-and-live/templates/actor/breathe-sheet.html",
      width: 900,
      height: 750,
      resizable: true,
      tabs: [
        {
          navSelector: ".sheet-tabs",
          contentSelector: ".sheet-body",
          initial: "stats",
        },
      ],
    });
  }

  /**
   * Permission helper:
   * Allow GM, or explicit Owner of the Actor, or the user assigned to this Actor (their character).
   * NOTE: This intentionally ignores default world ownership.
   */
  _canActOnSheet() {
    if (game.user.isGM) return true;

    // Explicit ownership (from the document's own ownership map only)
    const explicitLevel = this.actor.getUserLevel?.(game.user) ?? 0;
    const isExplicitOwner =
      explicitLevel >= CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER;

    // Assigned character (effective owner via User.character)
    const isAssigned = game.user.character?.id === this.actor.id;

    return isExplicitOwner || isAssigned;
  }

  /** @override */
  getData() {
    const context = super.getData();
    const actorData = this.actor.system ?? {};

    // Données système
    context.system = actorData;
    context.statsBase = actorData.statsBase || {};
    context.statsDerivees = actorData.statsDerivees || {};
    context.attributes = actorData.attributes || {};
    context.details = actorData.details || {};

    // Types d'acteur
    context.isCharacter = this.actor.type === "character";
    context.isDemoniste = this.actor.type === "demoniste";
    context.isDemon = this.actor.type === "demon";
    context.isNpc = this.actor.type === "npc";

    // Items
    context.items = this.actor.items.map((i) => i.toObject());
    context.armes = context.items.filter((i) => i.type === "arme");
    context.souffles = context.items.filter((i) => i.type === "souffle");
    context.techniques = context.items.filter((i) => i.type === "technique");
    context.capacites = context.items.filter((i) => i.type === "capacite");
    context.objets = context.items.filter((i) => i.type === "objet");

    // Souffles + formes (pour affichage)
    context.soufflesForms = context.souffles.map((s) => ({
      _id: s._id,
      name: s.name,
      coutParDefaut: Number(s.system?.coutEndurance ?? 0) || 0,
      formes: Array.isArray(s.system?.formes) ? s.system.formes : [],
    }));

    // Permissions (GM or explicit owner or assigned character)
    const canAct = this._canActOnSheet();
    context.canRollStats = canAct;
    context.canUseForms = canAct;

    return context;
  }

  /** @override */
  activateListeners(html) {
    super.activateListeners(html);

    // ====== RESSOURCES (PV, Endurance, etc.) ======
    html.find(".resource-input").on("change", (ev) => {
      if (!this._canActOnSheet()) {
        ui.notifications.warn("Pas de permission d’édition.");
        return;
      }
      const el = ev.currentTarget;
      const field = el.dataset.field; // ex: "system.attributes.endurance.value"
      const value = Number(el.value) || 0;
      this.actor.update({ [field]: value });
    });

    // ====== JETS DE CARACTÉRISTIQUE ======
    html.find(".roll-stat").on("click", async (ev) => {
      ev.preventDefault();
      if (!this._canActOnSheet()) {
        ui.notifications.warn(
          "Tu n'as pas la permission de lancer pour cet acteur."
        );
        return;
      }
      const stat = ev.currentTarget.dataset.stat;
      const base = Number(this.actor.system?.statsBase?.[stat] ?? 0) || 0;
      const r = new Roll(`1d20 + ${base}`);
      await r.evaluate();
      await ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor: this.actor }),
        flavor: `Jet de ${stat}`,
        rolls: [r],
        type: CONST.CHAT_MESSAGE_TYPES.ROLL,
      });
    });

    // Visual disable if not allowed (purement cosmétique)
    if (!this._canActOnSheet()) {
      html
        .find(".roll-stat")
        .addClass("disabled")
        .attr({ disabled: true, tabindex: -1, "aria-disabled": "true" })
        .css("pointer-events", "none");
    }

    // ====== ITEMS : éditer / supprimer / créer ======
    html.on("click", ".item-edit", (ev) => {
      ev.preventDefault();
      const li = ev.currentTarget.closest("[data-item-id]");
      const id = li?.dataset?.itemId;
      const item = this.actor.items.get(id);
      if (item) item.sheet.render(true);
    });

    html.on("click", ".item-delete", async (ev) => {
      ev.preventDefault();
      const li = ev.currentTarget.closest("[data-item-id]");
      const id = li?.dataset?.itemId;
      if (!id) return;
      await this.actor.deleteEmbeddedDocuments("Item", [id]);
    });

    html.on("click", ".item-create", async (ev) => {
      ev.preventDefault();
      const type = ev.currentTarget.dataset.type || "objet";
      await this.actor.createEmbeddedDocuments("Item", [
        { name: `Nouvel ${type}`, type },
      ]);
    });

    // ====== SOUFFLES : Utiliser une Forme (consomme Endurance + jet dégâts) ======
    html.on("click", ".forme-use", async (ev) => {
      ev.preventDefault();

      if (!this._canActOnSheet()) {
        ui.notifications.warn(
          "Tu n'as pas la permission d'utiliser cette forme."
        );
        return;
      }

      const btn = ev.currentTarget;
      const itemId = btn.dataset.itemId;
      const formeId = btn.dataset.formeId;

      const item = this.actor.items.get(itemId);
      if (!item) {
        ui.notifications.error("Souffle introuvable (ID manquant).");
        return;
      }

      const sys = item.system ?? {};
      const forme = (sys.formes || []).find((f) => f.id === formeId);
      if (!forme) {
        ui.notifications.warn("Forme introuvable sur ce Souffle.");
        return;
      }

      const cost = Number(forme.cout ?? sys.coutEndurance ?? 0) || 0;
      const dmgFormula = forme.degats?.trim() || "1d6";

      // Endurance
      const curE =
        Number(this.actor.system?.attributes?.endurance?.value ?? 0) || 0;
      if (cost > curE) {
        ui.notifications.warn(
          `Endurance insuffisante (${curE}/${cost}) pour ${forme.nom}.`
        );
        return;
      }

      await this.actor.update({
        "system.attributes.endurance.value": Math.max(0, curE - cost),
      });

      // Jet de dégâts
      const r = new Roll(dmgFormula, this._getRollData());
      await r.evaluate();
      await ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor: this.actor }),
        flavor: `${item.name} — ${forme.nom} (−${cost} Endurance)`,
        rolls: [r],
        type: CONST.CHAT_MESSAGE_TYPES.ROLL,
      });
    });
  }

  /**
   * Helper de jet par stat (si tu veux l'appeler ailleurs)
   */
  async _onRollStat(stat) {
    const base = Number(this.actor.system?.statsBase?.[stat] ?? 0) || 0;
    const r = new Roll(`1d20 + ${base}`);
    await r.evaluate();
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      flavor: `Jet de ${stat}`,
      rolls: [r],
      type: CONST.CHAT_MESSAGE_TYPES.ROLL,
    });
  }

  _getRollData() {
    const sys = this.actor.system ?? {};
    return {
      statsBase: sys.statsBase ?? {},
      statsDerivees: sys.statsDerivees ?? {},
      attributes: sys.attributes ?? {},
      details: sys.details ?? {},
    };
  }
}
