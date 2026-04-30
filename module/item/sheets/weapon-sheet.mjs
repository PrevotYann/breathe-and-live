import { BLBaseItemSheet } from "./base-item-sheet.mjs";

export class BLWeaponSheet extends BLBaseItemSheet {
  get template() {
    return "systems/breathe-and-live/templates/item/item-weapon.hbs";
  }

  async getData(options) {
    const data = await super.getData(options);
    data.isProjectile = this.item.type === "projectile";
    data.isExplosive = this.item.type === "explosive";
    return data;
  }
}
