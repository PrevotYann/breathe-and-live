import { normalizeRuleName } from "./technique-limits.mjs";

export function getWeaponLoadout(actor, weapon) {
  const selected = weapon?.system?.attachedModifications || {};
  const modifications = Array.from(actor?.items ?? []).filter(i => i.type === "modification" && selected[i.id]);
  const max = Math.max(1, Number(actor?.system?.progression?.bonuses?.firearmModsMax) || 1);
  const result = { valid: modifications.length <= max, max, modifications, rangeMultiplier: 1,
    attackBonus: 0, precisionBonus: 0, capacityBonus: 0, stealthBonus: 0, bayonet: false };
  for (const item of modifications) {
    const name = normalizeRuleName(item.name);
    if (name === "lunette") { result.rangeMultiplier *= 1.5; if (weapon.system?.aimed) result.attackBonus += 1; }
    else if (name === "crosse renforcee") result.precisionBonus += 1;
    else if (name === "silencieux") result.stealthBonus += 2;
    else if (name === "baionnette") result.bayonet = true;
    else if (name === "chargeur etendu") result.capacityBonus += Number(weapon.system?.ammo?.max) || 0;
  }
  return result;
}

export function loadedAmmunition(actor, weapon) {
  return actor?.items?.find(i => i.id === weapon?.system?.loadedAmmoId && i.type === "ammunition");
}
