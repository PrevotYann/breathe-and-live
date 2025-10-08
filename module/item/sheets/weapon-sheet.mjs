import { BLBaseItemSheet } from "./base-item-sheet.mjs";

export class BLWeaponSheet extends BLBaseItemSheet {
  get template() {
    return "systems/breathe-and-live/templates/item/item-weapon.hbs";
  }
}
