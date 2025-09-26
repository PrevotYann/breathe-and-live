/**
 * Item Arme (Breathe and Live)
 * - Gère les armes de mêlée (Nichirin) et à distance
 * - Jet d'attaque (1d20 + mod) et jet de dégâts (formule paramétrable)
 */

export class BreatheWeaponSheet extends ItemSheet {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["breathe-and-live", "sheet", "item", "weapon"],
      template: "systems/breathe-and-live/templates/item/weapon-sheet.html",
      width: 640,
      height: 660,
      tabs: [
        {
          navSelector: ".sheet-tabs",
          contentSelector: ".sheet-body",
          initial: "resume",
        },
      ],
    });
  }

  /** @override */
  getData(options = {}) {
    const ctx = super.getData(options);
    const sys = this.item.system ?? {};

    // Valeurs par défaut robustes
    sys.categorie ??= "melee"; // "melee" | "distance"
    sys.typeArme ??= "nichirin"; // "nichirin" | "autre"
    sys.portee ??= "1.5 m"; // 1.5 m par défaut
    sys.degats ??= "1d6"; // formule de dégâts
    sys.modDegats ??= "@statsBase.force"; // stat ajoutée aux dégâts
    sys.modAttaque ??= "@statsBase.finesse"; // stat pour le jet d'attaque (katana = finesse)
    sys.proprietes ??= []; // ex: ["décapitation", "écarlate", "saignement"]
    sys.notes ??= "";

    // Ranged spécifiques
    sys.munitions ??= {
      utilise: false,
      charge: 0,
      chargeMax: 0,
      rechargement: "",
    };

    ctx.system = sys;

    ctx.categorieList = {
      melee: "Mêlée",
      distance: "Distance",
    };

    // Stats proposées pour modificateurs
    ctx.statsList = {
      "@statsBase.force": "Force",
      "@statsBase.finesse": "Finesse",
      "@statsBase.courage": "Courage",
      "@statsBase.vitesse": "Vitesse",
      "@statsBase.social": "Social",
      "@statsBase.intellect": "Intellect",
    };

    return ctx;
  }

  /** @override */
  activateListeners(html) {
    super.activateListeners(html);
    if (!this.isEditable) return;

    html.find(".weapon-roll-attack").on("click", async (ev) => {
      if (!canRoll)
        return ui.notifications.warn(
          "Pas de permission pour utiliser cette arme."
        );
      ev.preventDefault();
      const sys = this.item.system ?? {};
      const formula = `1d20 + (${sys.modAttaque || "@statsBase.finesse"})`;
      const r = new Roll(formula, this._getRollData());
      await r.evaluate();
      await ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor: this.item.actor }),
        flavor: `${this.item.name} — Jet d'attaque`,
        rolls: [r],
        type: CONST.CHAT_MESSAGE_TYPES.ROLL,
      });
    });

    html.find(".weapon-roll-damage").on("click", async (ev) => {
      if (!canRoll)
        return ui.notifications.warn(
          "Pas de permission pour utiliser cette arme."
        );
      ev.preventDefault();
      const sys = this.item.system ?? {};
      const formula = `${sys.degats || "1d6"} + (${
        sys.modDegats || "@statsBase.force"
      })`;
      const r = new Roll(formula, this._getRollData());
      await r.evaluate();
      await ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor: this.item.actor }),
        flavor: `${this.item.name} — Dégâts`,
        rolls: [r],
        type: CONST.CHAT_MESSAGE_TYPES.ROLL,
      });
    });
  }

  _getRollData() {
    const a = this.item.actor;
    if (!a) return {};
    const s = a.system ?? {};
    return {
      statsBase: s.statsBase ?? {},
      statsDerivees: s.statsDerivees ?? {},
      attributes: s.attributes ?? {},
      details: s.details ?? {},
    };
  }

  _rollAttack() {
    const sys = this.item.system ?? {};
    // 1d20 + modAttaque (ex: "@statsBase.finesse")
    const formula = `1d20 + (${sys.modAttaque || "@statsBase.finesse"})`;
    const r = new Roll(formula, this._getRollData());
    r.evaluateSync();
    ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this.item.actor }),
      flavor: `${this.item.name} — Jet d'attaque`,
      rolls: [r],
      type: CONST.CHAT_MESSAGE_TYPES.ROLL,
    });
  }

  _rollDamage() {
    const sys = this.item.system ?? {};
    // ex: "1d6 + @statsBase.force"
    const formula = `${sys.degats || "1d6"} + (${
      sys.modDegats || "@statsBase.force"
    })`;
    const r = new Roll(
      `${sys.degats || "1d6"} + (${sys.modDegats || "@statsBase.force"})`,
      this._getRollData()
    );
    r.evaluateSync();
    ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this.item.actor }),
      flavor: `${this.item.name} — Dégâts`,
      rolls: [r],
      type: CONST.CHAT_MESSAGE_TYPES.ROLL,
    });
  }
}
