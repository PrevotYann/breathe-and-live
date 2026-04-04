import { BLBaseItemSheet } from "./base-item-sheet.mjs";

export class BLTechniqueSheet extends BLBaseItemSheet {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      width: 820,
      height: 760,
    });
  }

  get template() {
    return "systems/breathe-and-live/templates/item/item-technique.hbs";
  }
}
