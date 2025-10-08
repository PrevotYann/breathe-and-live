import { BLBaseItemSheet } from "./base-item-sheet.mjs";

export class BLTechniqueSheet extends BLBaseItemSheet {
  get template() {
    return "systems/breathe-and-live/templates/item/item-technique.hbs";
  }
}
