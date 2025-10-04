export class BreatheItemTechniqueSheet extends ItemSheet {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["breathe-and-live", "sheet", "item", "technique"],
      template: "systems/breathe-and-live/templates/item/item-technique.hbs",
      width: 640,
      height: 520,
    });
  }

  async getData(options) {
    const data = await super.getData(options);
    data.canEdit = !!(game.user?.isGM || this.item.isOwner);
    return data;
  }

  activateListeners(html) {
    super.activateListeners(html);
    if (!(game.user?.isGM || this.item.isOwner)) return;
    // listeners d’édition si besoin
  }
}
