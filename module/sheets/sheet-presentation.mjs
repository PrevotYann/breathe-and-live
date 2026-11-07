import { BREATH_KEYS, SYSTEM_ID } from "../config/rule-data.mjs";
import { UNAVAILABLE_CORE_ICONS } from "../config/unavailable-core-icons.mjs";
import { normalizeBreathName } from "../rules/technique-utils.mjs";

const ICON_ROOT = `systems/${SYSTEM_ID}/assets/icons/items`;
const ITEM_ICONS = {
  weapon: "weapon", firearm: "firearm", projectile: "ammunition", ammunition: "ammunition",
  explosive: "explosive", modification: "tools", technique: "technique",
  subclassTechnique: "technique", breath: "breath", bda: "blood", demonAbility: "blood",
  medical: "medical", poison: "poison", food: "food", consumable: "food",
  outfit: "clothing", clothing: "clothing", vehicle: "transport", transport: "transport",
  craftingComponent: "tools", craftingRecipe: "tools", feature: "feature", sense: "sense",
  gear: "gear", utility: "gear",
};

export function getItemFallbackImage(item = {}) {
  const sys = item.system || {};
  const breathKey = sys.key || sys.breathKey || normalizeBreathName(sys.breath);
  if (["breath", "technique"].includes(item.type)) {
    const breath = BREATH_KEYS.find(entry => entry.key === breathKey);
    if (breath?.img) return breath.img;
  }
  return `${ICON_ROOT}/${ITEM_ICONS[item.type] || "gear"}.svg`;
}

export function resolveItemImage(item = {}) {
  const img = String(item.img || "").trim();
  return !img || /^icons\/svg\//.test(img) || UNAVAILABLE_CORE_ICONS.has(img) ? getItemFallbackImage(item) : img;
}

export function resolveActorImage(actor = {}) {
  const img = String(actor.img || "").trim();
  return !img || UNAVAILABLE_CORE_ICONS.has(img) ? "icons/svg/mystery-man.svg" : img;
}

/** Display each style once; a preferred but inactive style must stay visibly inactive. */
export function buildBreathSummary(favoredBreath, entries = [], ownedBreaths = []) {
  const preferredKey = normalizeBreathName(favoredBreath) || String(favoredBreath || "").trim();
  const styles = entries.filter(entry => entry.enabled).map(entry => ({ ...entry, active: true }));
  if (preferredKey && !styles.some(entry => entry.key === preferredKey)) {
    const definition = BREATH_KEYS.find(entry => entry.key === preferredKey);
    styles.push({ key: preferredKey, label: definition?.label || favoredBreath, active: false });
  }
  return styles.map(entry => {
    const item = ownedBreaths.find(item => item.key === entry.key);
    return {
      key: entry.key, label: entry.label, active: entry.active,
      preferred: entry.key === preferredKey, itemId: item?.id,
      img: item?.img || getItemFallbackImage({ type: "breath", system: { key: entry.key } }),
    };
  });
}

/** Repair unavailable images for this render only, preserving saved and custom artwork. */
export function activateSheetImages(sheet, html) {
  const root = html[0] ?? html;
  root.querySelectorAll("img").forEach(img => {
    const itemId = img.closest("[data-item-id]")?.dataset.itemId;
    const item = itemId ? sheet.actor?.items?.get(itemId) : sheet.item;
    if (!item && !sheet.actor) return;
    const fallback = item ? getItemFallbackImage(item) : "icons/svg/mystery-man.svg";
    const recover = () => {
      if (img.getAttribute("src") !== fallback) img.setAttribute("src", fallback);
    };
    img.addEventListener("error", recover, { once: true });
    // Cached failures can finish before Foundry attaches the sheet listeners.
    if (img.complete && !img.naturalWidth) recover();
  });
}
