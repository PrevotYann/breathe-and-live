export class BLBreathSheet extends ItemSheet {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["bl", "sheet", "item", "breath"],
      width: 600,
      height: 520,
      tabs: [
        {
          navSelector: ".sheet-tabs",
          contentSelector: ".sheet-body",
          initial: "specials",
        },
      ],
    });
  }

  get template() {
    return "systems/breathe-and-live/templates/item/item-breath.hbs";
  }

  async getData(options) {
    const data = await super.getData(options);
    // Normaliser les specials en liste affichable (label auto en fonction de la clé)
    const specials = this.item.system.specials ?? {};
    const labelsByKey = {
      elu: "Élu (Soleil)",
      devierVagues: "Dévier les vagues (Eau)",
      ventsDeGuerre: "Vents de guerre (Vent)",
      vitesseLumiere: "Vitesse de la lumière (Foudre)",
      machoireHache: "Mâchoire & Hache (Pierre)",
      formeLibre: "Forme libre (Serpent)",
      dentsDeKatana: "Dents de Katana (Neige)",
      concentrationFlorissante: "Concentration Florissante (Fleur)",
      balancementsAmoureux: "Balancements Amoureux (Amour)",
      dislocation: "Dislocation (Bête)",
      bonusSolo: "Bonus en solitaire (Lune)",
    };
    const specialsDisplay = {};
    for (const key of Object.keys(labelsByKey)) {
      specialsDisplay[key] = {
        enabled: !!specials[key],
        label: labelsByKey[key],
      };
    }
    data.system.specialsDisplay = specialsDisplay;

    // Prérequis: valeurs par défaut
    data.system.prereq = foundry.utils.mergeObject(
      { sense: "", stats: "", weapons: "" },
      data.system.prereq ?? {},
      { inplace: false }
    );
    return data;
  }
}
