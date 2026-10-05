import { BLBaseItemSheet } from "./base-item-sheet.mjs";

export class BLWeaponSheet extends BLBaseItemSheet {
  get template() {
    return "systems/breathe-and-live/templates/item/item-weapon.hbs";
  }

  async getData(options) {
    const data = await super.getData(options);
    data.isProjectile = this.item.type === "projectile";
    data.isExplosive = this.item.type === "explosive";
    data.modificationOptions = Array.from(this.item.parent?.items ?? []).filter(i => i.type === "modification").map(i => ({ id: i.id, name: i.name, selected: !!this.item.system?.attachedModifications?.[i.id] }));
    data.ammunitionOptions = Array.from(this.item.parent?.items ?? []).filter(i => i.type === "ammunition").map(i => ({ id: i.id, name: i.name, selected: this.item.system?.ammunitionId === i.id }));
    return data;
  }
}
