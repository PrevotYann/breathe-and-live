import { spendResourceCosts } from "./resource-costs.mjs";

function inCombat(actor) {
  return game.combat?.round > 0 && Array.from(game.combat.combatants ?? []).some(c => c.actor === actor || c.actor?.uuid === actor.uuid);
}

export async function refreshCombatActions(actor) {
  const total = Math.max(0, Number(actor.system?.combat?.actionEconomy?.actionsPerTurn) || 1) +
    Math.max(0, Number(actor.system?.combat?.actionEconomy?.bonusActions) || 0);
  await actor.update({ "system.combat.actionEconomy.remainingActions": total,
    "system.combat.actionEconomy.waiting": false });
}

export async function spendCombatAction(actor, { free = false, reaction = false, costs = [] } = {}) {
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
