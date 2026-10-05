import { SYSTEM_ID } from "../config/rule-data.mjs";

export function currentCombatBoundary(combat = game.combat) {
  if (!combat || !(combat.round > 0) || combat.turn == null) return null;
  return { combatId: combat.id, round: combat.round, turn: combat.turn };
}

export function isSameCombatBoundary(left, right = currentCombatBoundary()) {
  return !!left && !!right && left.combatId === right.combatId &&
    left.round === right.round && left.turn === right.turn;
}

export async function lockRedBladeHealing(actor, combat = game.combat) {
  const boundary = currentCombatBoundary(combat);
  if (boundary) await actor.setFlag(SYSTEM_ID, "redBladeHealingLock", boundary);
}

export function healingIsBlocked(actor) {
  return isSameCombatBoundary(actor?.getFlag?.(SYSTEM_ID, "redBladeHealingLock"));
}

export function canHealActor(actor) {
  if (!healingIsBlocked(actor)) return true;
  ui.notifications.warn("Lame Rouge : les soins et la repousse sont interdits jusqu'à la fin du tour en cours.");
  return false;
}
