export class BreatheActorSheet extends ActorSheet {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["breathe-and-live", "sheet", "actor"],
      template: "systems/breathe-and-live/templates/actor/actor-slayer.hbs",
      width: 700,
      height: 680,
      tabs: [
        {
          navSelector: ".sheet-tabs",
          contentSelector: ".sheet-body",
          initial: "ressources",
        },
      ],
    });
  }

  /** NORMALISATION DES DONNÉES POUR LE TEMPLATE **/
  async getData(options) {
    const data = await super.getData(options);

    // Certaines bases "worldbuilding" plus anciennes exposent encore les valeurs dans data.data
    const rawSys =
      this.actor.system && Object.keys(this.actor.system).length
        ? this.actor.system
        : this.actor.data?.data ?? {}; // compat

    // Valeurs par défaut minimales attendues par le .hbs
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
      },
      resources: {
        hp: { value: 20, max: 20 },
        e: { value: 0, max: 0 },
        rp: { value: 0, max: 0 },
        ca: 10,
      },
    };

    // On injecte les défauts SANS écraser les vraies valeurs si elles existent
    data.system = foundry.utils.mergeObject(defaults, rawSys, {
      inplace: false,
      insertKeys: true,
      overwrite: false,
    });
    return data;
  }

  activateListeners(html) {
    super.activateListeners(html);
    if (!this.isEditable) return;

    html.find(".item-delete").on("click", (ev) => {
      const li = ev.currentTarget.closest(".item");
      const id = li?.dataset.itemId;
      if (id) this.actor.deleteEmbeddedDocuments("Item", [id]);
    });

    html.find(".item-chat, .bl-use-technique").on("click", async (ev) => {
      const li = ev.currentTarget.closest(".item");
      const item = li
        ? this.actor.items.get(li.dataset.itemId)
        : this.actor.items.getName(this.object.name);
      const tech = item ?? null;
      if (!tech) return;
      // Message simple pour l’instant
      const r = await new Roll(tech.system.damage ?? "1d8").roll({
        async: true,
      });
      await r.toMessage({
        speaker: ChatMessage.getSpeaker({ actor: this.actor }),
        flavor: `Technique : ${tech.name} — dégâts potentiels`,
      });
    });
  }
}
