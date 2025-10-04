/**
 * Feuille d’Item : Technique (Breathe and Live)
 *
 * Gère :
 * - Activation : action / réaction / passive
 * - Coûts : Endurance, Points de Réaction, autres ressources
 * - Jets : formule (ex. "2d6+@statsBase.finesse")
 * - Conditions : prérequis, état requis (Marque, Monde Transparent, etc.)
 * - Usages : par jour, par combat, recharges
 */

export class BreatheTechniqueSheet extends ItemSheet {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["breathe-and-live", "sheet", "item", "technique"],
      template: "systems/breathe-and-live/templates/item/technique-sheet.html",
      width: 680,
      height: 700,
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
    sys.categorie ??= "générale"; // "tcb" | "marque" | "mondeTransparent" | "lameRouge" | "demonist" | "générale"
    sys.activation ??= "passive"; // "action" | "reaction" | "passive"
    sys.couts ??= { endurance: 0, reactions: 0, autre: "" };
    sys.jets ??= { formule: "", portee: "", cibles: "1", degats: "" };
    sys.conditions ??= { prerequis: "", etatRequis: "" };
    sys.usages ??= { par: "combat", max: 0, restant: 0, recharge: "" };
    sys.effet ??= "";
    sys.resume ??= "";

    // Listes pour les selects
    ctx.categorieList = {
      generale: "Générale",
      tcb: "Souffle de Concentration Intégral",
      marque: "Forme Marquée",
      mondeTransparent: "Monde Transparent",
      lameRouge: "Lame Rouge",
      demonist: "Technique de Démoniste",
    };

    ctx.activationList = {
      action: "Action",
      reaction: "Réaction",
      passive: "Passive",
    };

    ctx.usageParList = {
      combat: "Par combat",
      jour: "Par jour",
      rencontre: "Par rencontre",
      scene: "Par scène",
    };

    ctx.system = sys;
    return ctx;
  }

  /** @override */
  activateListeners(html) {
    super.activateListeners(html);
    if (!this.isEditable) return;

    // Bouton de test de "jet" (si tu veux déclencher un Roll depuis la feuille)
    html.find(".technique-roll").on("click", async (ev) => {
      if (!canRoll)
        return ui.notifications.warn(
          "Pas de permission pour lancer cette technique."
        );
      ev.preventDefault();
      const sys = this.item.system ?? {};
      const formule = sys?.jets?.formule || "1d20";
      try {
        const r = new Roll(formule, this._getRollData());
        await r.evaluate(); // v12 async
        await ChatMessage.create({
          speaker: ChatMessage.getSpeaker(),
          flavor: `${this.item.name} — Jet`,
          rolls: [r],
          type: CONST.CHAT_MESSAGE_TYPES.ROLL,
        });
      } catch (e) {
        ui.notifications.warn(`Formule invalide : ${formule}`);
        console.error(e);
      }
    });

    // Réinitialiser les usages (remettre "restant" à "max")
    html.find(".technique-reset-uses").on("click", (ev) => {
      ev.preventDefault();
      const sys = foundry.utils.duplicate(this.item.system ?? {});
      if (sys.usages?.max != null) {
        sys.usages.restant = Number(sys.usages.max) || 0;
        this.item.update({ system: sys });
      }
    });
  }

  /**
   * Données utilisables dans les formules de jets :
   * - @statsBase.force / finesse / courage / vitesse / social / intellect
   * - @statsDerivees.* (si tu veux aller plus loin)
   * - @attributes.* (pv, endurance, reactions, ca)
   */
  _getRollData() {
    const actor = this.item?.actor;
    if (!actor) return {};
    const sys = actor.system ?? {};
    return {
      statsBase: sys.statsBase ?? {},
      statsDerivees: sys.statsDerivees ?? {},
      attributes: sys.attributes ?? {},
      details: sys.details ?? {},
    };
  }
}
