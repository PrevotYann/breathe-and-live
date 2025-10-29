export class BLBreathSheet extends ItemSheet {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["breathe-and-live", "sheet", "item", "breath"],
      width: 560,
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
    const FU = foundry.utils;

    // Système courant (copie défensive)
    const sys = FU.duplicate(this.item.system ?? {});
    sys.specials ||= {};
    sys.prereq ||= { sense: "", stats: "", weapons: "" };

    // Capacités connues par souffle (labels + hints). Celles-ci doivent coller à breath-effects.mjs
    const SPECIALS_BY_KEY = {
      sun: {
        elu: {
          label: "Élu",
          hint: "Réduit le coût des techniques (et synergies avec Marque).",
        },
      },
      moon: {
        bonusSolo: {
          label: "Frappe de Lune",
          hint: "+1 dé aux dégâts contre les démons.",
        },
      },
      flame: {
        coeurFlamboyant: {
          label: "Cœur flamboyant",
          hint: "Puissance accrue un round (géré par flag round).",
        },
      },
      flower: {
        concentrationFlorissante: {
          label: "Concentration florissante",
          hint: "Dégâts progressifs sur la même cible (stacks).",
        },
      },
      snow: {
        dentsDeKatana: {
          label: "Dents de Katana",
          hint: "Sur touche : CA -1d4 jusqu’à la fin du round.",
        },
      },
      water: {
        devierVagues: {
          label: "Dévier les vagues",
          hint: "Réaction : annule/redirige une attaque à distance (1 RP).",
        },
      },
      thunder: {
        vitesseLumiere: {
          label: "Vitesse de la lumière",
          hint: "Réaction : Dash 6 m.",
        },
      },
      stone: {
        machoireHache: {
          label: "Mâchoire & Hache",
          hint: "Choix Masse/Hache à l’utilisation (modifie les dégâts).",
        },
      },
      mist: {
        nuagesTrainants: {
          label: "Nuages traînants",
          hint: "Pose une zone de brume (3 m).",
        },
      },
      wind: {
        ventsDeGuerre: {
          label: "Vents de guerre",
          hint: "RP +1d2 si tu achèves un démon.",
        },
      },
      // TODO : serpent, sound, insect, love, beast... (ajoute ici et dans breath-effects.mjs)
      serpent: {},
      sound: {},
      insect: {},
      love: {},
      beast: {},
    };

    // Fabrique l’affichage en fonction de la clé de souffle
    const key = sys.key ?? "";
    const knownForKey = SPECIALS_BY_KEY[key] ?? {};
    const specialsDisplay = {};
    for (const [specKey, meta] of Object.entries(knownForKey)) {
      specialsDisplay[specKey] = {
        label: meta.label,
        hint: meta.hint ?? "",
        enabled: !!sys.specials[specKey],
      };
    }

    // Injecte dans data pour le template
    data.system = {
      ...sys,
      specialsDisplay,
    };

    return data;
  }
}
