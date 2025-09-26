/**
 * Items et Feuilles d'Item pour Breathe and Live
 * - BreatheItem : classe Item custom
 * - BreatheSouffleSheet : feuille pour l'item "souffle" (styles + formes)
 */

export class BreatheItem extends Item {
  /** @override */
  prepareData() {
    super.prepareData();
    const sys = this.system ?? {};

    // Valeurs par défaut robustes pour les Souffles
    if (this.type === "souffle") {
      sys.nom ||= this.name ?? "";
      sys.prerequis ||= { sens: "", caracteristiques: "", armes: "" };
      sys.special ||= { nom: "", description: "" };
      sys.coutEndurance ||= 0;
      sys.effet ||= "";
      sys.formes ||= [];

      // Normaliser chaque forme
      sys.formes = (sys.formes || []).map((f) => ({
        id: f.id ?? crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`,
        nom: f.nom ?? "",
        description: f.description ?? "",
        stat: f.stat ?? "finesse", // force|finesse|courage|vitesse|social|intellect
        cout: Number(f.cout ?? 0), // coût Endurance
        portee: f.portee ?? "1.5 m",
        degats: f.degats ?? "—",
      }));
    }

    this.system = sys;
  }
}

/* -----------------------------
 * Feuille d’Item : Souffle
 * ----------------------------- */
export class BreatheSouffleSheet extends ItemSheet {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["breathe-and-live", "sheet", "item", "souffle"],
      template: "systems/breathe-and-live/templates/item/souffle-sheet.html",
      width: 720,
      height: 720,
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
    ctx.system = this.item.system ?? {};
    ctx.isEditable = this.isEditable;

    // Liste des stats utilisables pour une Forme (clé => label)
    ctx.statsList = {
      force: game.i18n.localize("BREATHE.statsBase.force") || "Force",
      finesse: game.i18n.localize("BREATHE.statsBase.finesse") || "Finesse",
      courage: game.i18n.localize("BREATHE.statsBase.courage") || "Courage",
      vitesse: game.i18n.localize("BREATHE.statsBase.vitesse") || "Vitesse",
      social: game.i18n.localize("BREATHE.statsBase.social") || "Social",
      intellect:
        game.i18n.localize("BREATHE.statsBase.intellect") || "Intellect",
    };

    return ctx;
  }

  /** @override */
  activateListeners(html) {
    super.activateListeners(html);
    if (!this.isEditable) return;

    // Ajout d’une Forme
    html.find(".forme-add").on("click", (ev) => {
      ev.preventDefault();
      const sys = foundry.utils.duplicate(this.item.system);
      sys.formes ||= [];
      sys.formes.push({
        id: crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`,
        nom: "",
        description: "",
        stat: "finesse",
        cout: 0,
        portee: "1.5 m",
        degats: "—",
      });
      this.item.update({ system: sys });
    });

    // Suppression d’une Forme
    html.find(".forme-delete").on("click", (ev) => {
      ev.preventDefault();
      const li = ev.currentTarget.closest("[data-forme-id]");
      const id = li?.dataset?.formeId;
      const sys = foundry.utils.duplicate(this.item.system);
      sys.formes = (sys.formes || []).filter((f) => f.id !== id);
      this.item.update({ system: sys });
    });

    // Edition inline d’un champ de Forme
    html.find(".forme-field").on("change", (ev) => {
      const el = ev.currentTarget;
      const li = el.closest("[data-forme-id]");
      const id = li?.dataset?.formeId;
      const path = el.dataset?.path; // ex: "nom", "description", "stat", "cout", "portee", "degats"
      if (!id || !path) return;

      const value = el.type === "number" ? Number(el.value || 0) : el.value;
      const sys = foundry.utils.duplicate(this.item.system);
      const idx = (sys.formes || []).findIndex((f) => f.id === id);
      if (idx >= 0) {
        sys.formes[idx][path] = value;
        this.item.update({ system: sys });
      }
    });
  }
}
