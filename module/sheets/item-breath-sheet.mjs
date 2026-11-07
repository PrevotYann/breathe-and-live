import { BREATH_KEYS, SYSTEM_ID } from "../config/rule-data.mjs";
import { BREATH_FORM_COUNTS, getBreathMastery } from "../rules/breath-effects.mjs";
import { activateSheetNavigation } from "./sheet-navigation.mjs";
import { activateSheetImages, resolveItemImage } from "./sheet-presentation.mjs";

function getBreathDefinition(key) {
  return BREATH_KEYS.find((entry) => entry.key === key) || null;
}

function resolveBreathImage(key, currentImg = "") {
  const definition = getBreathDefinition(key);
  if (!definition?.img) return currentImg;
  return !currentImg || /^icons\/svg\//.test(String(currentImg || "")) ? definition.img : currentImg;
}

function inferSupplement1934Content(item, sys = {}) {
  if (sys.supplement1934?.enabled) return true;
  const tags = Array.isArray(sys.tags) ? sys.tags : [];
  const marker = [item?.name, sys.sourceSection, sys.usageNote, ...tags]
    .join(" ")
    .toLowerCase();
  return marker.includes("1934") || marker.includes("supplement 1934");
}

export class BLBreathSheet extends foundry.appv1.sheets.ItemSheet {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["breathe-and-live", "sheet", "item", "breath"],
      width: 840,
      height: 760,
      tabs: [
        {
          navSelector: ".sheet-tabs",
          contentSelector: ".sheet-body",
          initial: "specials",
        },
      ],
    });
  }

  get template() {
    return "systems/breathe-and-live/templates/item/item-breath.hbs";
  }

  async getData(options) {
    const data = await super.getData(options);
    const FU = foundry.utils;

    const sys = FU.duplicate(this.item.system ?? {});
    const key = String(sys.key || "");
    const definition = getBreathDefinition(key);

    sys.prereq = FU.duplicate(
      definition?.prereq || sys.prereq || { sense: "", stats: "", weapons: "" }
    );

    const owner = this.item.actor;
    const mastery = owner ? getBreathMastery(owner, key) : null;
    const mastered = mastery ? mastery.mastered : !!sys.masteryGranted;
    const specialsDisplay = {};
    for (const [specialKey, meta] of Object.entries(definition?.specials || {})) {
      specialsDisplay[specialKey] = { label: meta.label || specialKey, hint: meta.hint || "", enabled: mastered };
    }
    data.mastery = {
      known: mastery?.known ?? 0,
      total: mastery?.total ?? (BREATH_FORM_COUNTS[key] || 0),
      mastered,
      granted: !!sys.masteryGranted,
      hasActor: !!owner,
    };
    data.isGM = !!game.user?.isGM;

    data.system = {
      ...sys,
      specialsDisplay,
    };
    data.hasSpecials = Object.keys(specialsDisplay).length > 0;
    data.keyOptions = BREATH_KEYS.map((entry) => ({
      value: entry.key,
      label: entry.optionLabel || entry.label,
    }));
    data.resolvedImg = resolveItemImage(this.item);
    data.supplement1934Global = !!game.settings.get(SYSTEM_ID, "enableSupplement1934");
    data.isSupplement1934Content = inferSupplement1934Content(this.item, sys);

    return data;
  }

  activateListeners(html) {
    super.activateListeners(html);
    activateSheetNavigation(this, html);
    activateSheetImages(this, html);
  }

  async _updateObject(event, formData) {
    const FU = foundry.utils;
    const expanded = FU.expandObject(formData);
    const key = String(expanded.system?.key || this.item.system?.key || "");
    const definition = getBreathDefinition(key);
    const nextSystem = expanded.system || {};
    nextSystem.key = key;
    // Special skills come from mastering every form (p.35), never from a free toggle.
    delete nextSystem.specials;
    delete nextSystem.enabled;
    if (!game.user?.isGM) delete nextSystem.masteryGranted;
    nextSystem.prereq = FU.duplicate(
      definition?.prereq || nextSystem.prereq || this.item.system?.prereq || { sense: "", stats: "", weapons: "" }
    );
    await this.item.update({
      name: expanded.name ?? this.item.name,
      img: resolveBreathImage(key, String(expanded.img || this.item.img || "")),
      system: nextSystem,
    });
  }
}
