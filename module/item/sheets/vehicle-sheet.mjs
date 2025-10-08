import { BLBaseItemSheet } from "./base-item-sheet.mjs";

export class BLVehicleSheet extends BLBaseItemSheet {
  get template() {
    return "systems/breathe-and-live/templates/item/item-vehicle.hbs";
  }
}
