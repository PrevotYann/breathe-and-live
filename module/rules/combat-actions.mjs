import { spendResourceCosts } from "./resource-costs.mjs";
import { getConditionActionRestriction } from "./condition-utils.mjs";

export function inCombat(actor) {
  return game.combat?.round > 0 && Array.from(game.combat.combatants ?? []).some(c => c.actor === actor || c.actor?.uuid === actor.uuid);
}

export function canWaitForAction(actor) {
  if (!inCombat(actor)) return true;
  const current = game.combat.combatant?.actor;
  if ((current !== actor && current?.uuid !== actor.uuid) || !(actor.system?.combat?.actionEconomy?.remainingActions > 0)) {
    ui.notifications.warn("Attendre nécessite votre tour et une action disponible.");
    return false;
  }
  return true;
}

export async function refreshCombatActions(actor) {
  const total = Math.max(0, Number(actor.system?.combat?.actionEconomy?.actionsPerTurn) || 1) +
    Math.max(0, Number(actor.system?.combat?.actionEconomy?.bonusActions) || 0);
  await actor.update({ "system.combat.actionEconomy.remainingActions": total,
    "system.combat.actionEconomy.waiting": false });
}

export async function spendCombatAction(actor, { free = false, reaction = false, costs = [] } = {}) {
  const restriction = getConditionActionRestriction(actor, reaction ? "rp" : "action");
  if (restriction.blocked) {
    ui.notifications.warn(`${actor.name} : ${restriction.reason}`);
    return null;
  }
  const entries = [...costs];
  if (!free && !reaction && inCombat(actor)) {
    const current = game.combat.combatant?.actor;
    if (current !== actor && current?.uuid !== actor.uuid && !actor.system?.combat?.actionEconomy?.waiting) {
      ui.notifications.warn("Cette action nécessite votre tour, ou une action conservée avec Attendre.");
      return null;
    }
    entries.push({ path: "system.combat.actionEconomy.remainingActions", cost: 1, label: "action" });
  }
  return spendResourceCosts(actor, entries);
}
