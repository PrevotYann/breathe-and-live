import { SYSTEM_ID } from "../config/rule-data.mjs";

export const normalizeRuleName = value => String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[’‘]/g, "'").replace(/[–—]/g, "-").toLowerCase().trim();
const daily = new Set(["tsunami", "briseur d'os", "charge frenetique", "dents invisibles", "attaque des huit crocs", "charge souterraine", "danse perforante", "coup de foudre", "coup de hache en arc de cercle", "execution coordonnee", "laceration enchainee", "elegance lunaire", "typhon tourbillonnant", "fureur sanguinaire"]);
const encounter = new Set(["coupe-pierre", "flammes etourdissantes", "double-tap"]);
export function sourceUseLimit(item) {
  const name = normalizeRuleName(item.name);
  if (daily.has(name)) return { period: "day", max: 1 };
  if (encounter.has(name)) return { period: "combat", max: 1 };
  if (name === "vents de guerre") return { period: "day", max: 3 };
  return item.system?.useLimit || null;
}
export function techniqueUsage(actor, item) {
  const limit = sourceUseLimit(item);
  if (!limit) return { limit: null, available: true };
  const periodKey = limit.period === "day" ? Math.floor(Number(game.time?.worldTime || 0) / 86400) : game.combat?.id;
  const key = normalizeRuleName(item.name), all = actor.getFlag(SYSTEM_ID, "techniqueUses") || {};
  const used = all[key]?.periodKey === periodKey ? Number(all[key].used) || 0 : 0;
  return { limit, key, periodKey, used, available: periodKey !== undefined && used < limit.max };
}
export function checkTechniqueUses(actor, item) {
  const state = techniqueUsage(actor, item);
  if (!state.available) ui.notifications.warn(`${item.name} : limite ${state.limit.max}/${state.limit.period === "day" ? "jour" : "rencontre"} atteinte, ou combat absent.`);
  return state.available;
}
export async function consumeTechniqueUse(actor, item) {
  const state = techniqueUsage(actor, item);
  if (!state.limit || !state.available) return;
  await actor.setFlag(SYSTEM_ID, "techniqueUses", { ...(actor.getFlag(SYSTEM_ID, "techniqueUses") || {}),
    [state.key]: { periodKey: state.periodKey, used: state.used + 1 } });
}
