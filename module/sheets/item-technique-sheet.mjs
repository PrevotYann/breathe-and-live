export class BreatheItemTechniqueSheet extends ItemSheet {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["breathe-and-live", "sheet", "item", "technique"],
      template: "systems/breathe-and-live/templates/item/item-technique.hbs",
      width: 640,
      height: 520,
    });
  }
}
