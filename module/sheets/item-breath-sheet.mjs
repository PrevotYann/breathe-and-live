import { BREATH_KEYS, BREATH_SPECIAL_ALIASES, SYSTEM_ID } from "../config/rule-data.mjs";

function getBreathDefinition(key) {
  return BREATH_KEYS.find((entry) => entry.key === key) || null;
}

function normalizeSpecialKey(breathKey, specialKey) {
  return BREATH_SPECIAL_ALIASES?.[breathKey]?.[specialKey] || specialKey;
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

export class BLBreathSheet extends ItemSheet {
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

    const normalizedSpecials = {};
    for (const [specialKey, enabled] of Object.entries(sys.specials || {})) {
      normalizedSpecials[normalizeSpecialKey(key, specialKey)] = !!enabled;
    }
    for (const specialKey of Object.keys(definition?.specials || {})) {
      normalizedSpecials[specialKey] = !!normalizedSpecials[specialKey];
    }
    sys.specials = normalizedSpecials;

    const specialsDisplay = {};
    for (const [specialKey, meta] of Object.entries(definition?.specials || {})) {
      specialsDisplay[specialKey] = {
        label: meta.label || specialKey,
        hint: meta.hint || "",
        enabled: !!sys.specials[specialKey],
      };
    }

    data.system = {
      ...sys,
      specialsDisplay,
    };
    data.hasSpecials = Object.keys(specialsDisplay).length > 0;
    data.keyOptions = BREATH_KEYS.map((entry) => ({
      value: entry.key,
      label: entry.optionLabel || entry.label,
    }));
    data.resolvedImg = resolveBreathImage(key, this.item.img);
    data.supplement1934Global = !!game.settings.get(SYSTEM_ID, "enableSupplement1934");
    data.isSupplement1934Content = inferSupplement1934Content(this.item, sys);

    return data;
  }

  async _updateObject(event, formData) {
    const FU = foundry.utils;
    const expanded = FU.expandObject(formData);
    const currentSystem = FU.duplicate(this.item.system ?? {});
    const key = String(expanded.system?.key || currentSystem.key || "");
    const definition = getBreathDefinition(key);

    const nextSpecials = {};
    for (const [specialKey, enabled] of Object.entries(currentSystem.specials || {})) {
      nextSpecials[normalizeSpecialKey(key, specialKey)] = !!enabled;
    }
    for (const [specialKey, enabled] of Object.entries(expanded.system?.specials || {})) {
      nextSpecials[normalizeSpecialKey(key, specialKey)] = !!enabled;
    }
    for (const specialKey of Object.keys(definition?.specials || {})) {
      nextSpecials[specialKey] = !!nextSpecials[specialKey];
    }

    const nextSystem = FU.mergeObject(currentSystem, expanded.system || {}, {
      inplace: false,
      overwrite: true,
    });
    nextSystem.key = key;
    nextSystem.enabled = !!nextSystem.enabled;
    nextSystem.prereq = FU.duplicate(
      definition?.prereq || nextSystem.prereq || { sense: "", stats: "", weapons: "" }
    );
    nextSystem.specials = nextSpecials;

    const nextImg = resolveBreathImage(
      key,
      String(expanded.img || this.item.img || "")
    );

    await this.item.update({
      name: expanded.name ?? this.item.name,
      img: nextImg,
      system: nextSystem,
    });

    const actor = this.item.actor;
    if (!actor || !key) return;

    await actor.update({
      [`system.breaths.${key}.enabled`]: !!nextSystem.enabled,
      [`system.breaths.${key}.specials`]: nextSpecials,
    });
  }
}
