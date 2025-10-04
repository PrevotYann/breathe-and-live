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
