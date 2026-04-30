import {
  POISON_APPLICATION_OPTIONS,
  POISON_PROFILE_OPTIONS,
} from "../../rules/poison-utils.mjs";
import { SYSTEM_ID } from "../../config/rule-data.mjs";

function inferSupplement1934Content(item, sys = {}) {
  if (sys.supplement1934?.enabled) return true;
  const tags = Array.isArray(sys.tags) ? sys.tags : [];
  const marker = [item?.name, sys.sourceSection, sys.usageNote, ...tags]
    .join(" ")
    .toLowerCase();
  return marker.includes("1934") || marker.includes("supplement 1934");
}

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
    data.isModification = this.item.type === "modification";
    data.isClothing = ["outfit", "clothing"].includes(this.item.type);
    data.isFeature = this.item.type === "feature";
    data.isCrafting =
      this.item.type === "craftingRecipe" ||
      this.item.type === "craftingComponent" ||
      !!sys.crafting?.enabled;
    data.supplement1934Global = !!game.settings.get(SYSTEM_ID, "enableSupplement1934");
    data.isSupplement1934Content = inferSupplement1934Content(this.item, sys);
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
    html.on("change", '[name="system.traitsText"]', (ev) => {
      const txt = ev.currentTarget.value ?? "";
      const traits = txt
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
      this.item.update({ "system.traits": traits });
    });
  }
}
