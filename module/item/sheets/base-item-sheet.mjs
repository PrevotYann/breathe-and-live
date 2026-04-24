import {
  POISON_APPLICATION_OPTIONS,
  POISON_PROFILE_OPTIONS,
} from "../../rules/poison-utils.mjs";

export class BLBaseItemSheet extends ItemSheet {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["breathe-and-live", "sheet", "item"],
      width: 760,
      height: 720,
      tabs: [
        {
          navSelector: ".sheet-tabs",
          contentSelector: ".sheet-body",
          initial: "stats",
        },
      ],
    });
  }

  get template() {
    // Fallback générique si pas surchargé
    return "systems/breathe-and-live/templates/item/item-generic.hbs";
  }

  /** Inject helpers fields (ex: tagsText) */
  async getData(options) {
    const data = await super.getData(options);
    const sys = this.item.system ?? {};
    data.system = sys;
    data.join = (arr, sep = ", ") => (Array.isArray(arr) ? arr.join(sep) : "");
    data.isPoison = this.item.type === "poison";
    data.poisonProfileOptions = POISON_PROFILE_OPTIONS;
    data.poisonApplicationOptions = POISON_APPLICATION_OPTIONS;
    return data;
  }

  activateListeners(html) {
    super.activateListeners(html);

    // Synchronise tagsText <-> system.tags
    html.on("change", '[name="system.tagsText"]', (ev) => {
      const txt = ev.currentTarget.value ?? "";
      const tags = txt
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
      this.item.update({ "system.tags": tags });
    });
    // Synchronise propertiesText <-> system.properties
    html.on("change", '[name="system.propertiesText"]', (ev) => {
      const txt = ev.currentTarget.value ?? "";
      const properties = txt
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
      this.item.update({ "system.properties": properties });
    });
  }
}
