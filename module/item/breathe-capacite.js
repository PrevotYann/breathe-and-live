/**
 * Feuille d’Item : Capacité (extrasensorielle, surnaturelle, humaine)
 * - extrasensorielle : sens (odorat/ouïe/vue/goût/toucher), niveau 1–3, effets
 * - surnaturelle : coût en points (créa perso), bonus/effets permanents
 * - humaine : actions génériques, utilitaires, rappel de règles
 */

export class BreatheCapaciteSheet extends ItemSheet {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["breathe-and-live", "sheet", "item", "capacite"],
      template: "systems/breathe-and-live/templates/item/capacite-sheet.html",
      width: 640,
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

    // Valeurs par défaut solides
    sys.famille ??= "extrasensorielle"; // "extrasensorielle" | "surnaturelle" | "humaine"
    sys.resume ??= "";
    sys.effet ??= "";

    // Extrasensorielles
    sys.sens ??= "odorat"; // odorat|ouie|vue|gout|toucher
    sys.niveau ??= 1; // 1..3
    sys.bonus ??= { perception: 0, detection: "", special: "" };

    // Surnaturelles
    sys.pointsCout ??= 0; // coût en points à la création
    sys.bonusPassifs ??= []; // tableau libre de bonus { cle: "", valeur: "" }
    sys.conditions ??= ""; // prérequis éventuels
    sys.automatiser ??= false; // futur : si tu veux que ça applique auto (macro/system hook)

    // Humaines
    sys.typeHumaine ??= "action"; // action|reaction|passive
    sys.noteRegle ??= "";

    ctx.system = sys;

    ctx.familleList = {
      extrasensorielle: "Extrasensorielle",
      surnaturelle: "Surnaturelle",
      humaine: "Humaine",
    };

    ctx.sensList = {
      odorat: "Odorat",
      ouie: "Ouïe",
      vue: "Vision",
      gout: "Goût",
      toucher: "Toucher",
    };

    ctx.typeHumaineList = {
      action: "Action",
      reaction: "Réaction",
      passive: "Passive",
    };

    return ctx;
  }

  /** @override */
  activateListeners(html) {
    super.activateListeners(html);
    if (!this.isEditable) return;

    // Gestion dynamique des lignes de bonus passifs (surnaturelles)
    html.find(".bonus-add").on("click", (ev) => {
      ev.preventDefault();
      const sys = foundry.utils.duplicate(this.item.system ?? {});
      sys.bonusPassifs ||= [];
      sys.bonusPassifs.push({ cle: "", valeur: "" });
      this.item.update({ system: sys });
    });

    html.find(".bonus-del").on("click", (ev) => {
      ev.preventDefault();
      const li = ev.currentTarget.closest("[data-idx]");
      const idx = Number(li?.dataset?.idx ?? -1);
      if (idx < 0) return;
      const sys = foundry.utils.duplicate(this.item.system ?? {});
      sys.bonusPassifs.splice(idx, 1);
      this.item.update({ system: sys });
    });

    html.find(".bonus-field").on("change", (ev) => {
      const el = ev.currentTarget;
      const li = el.closest("[data-idx]");
      const idx = Number(li?.dataset?.idx ?? -1);
      const path = el.dataset?.path; // "cle" | "valeur"
      if (idx < 0 || !path) return;
      const sys = foundry.utils.duplicate(this.item.system ?? {});
      sys.bonusPassifs[idx][path] = el.value;
      this.item.update({ system: sys });
    });
  }
}
