// Elect one writer for document hooks; prefer a GM, then the initiating user.
export function isAutomationAuthority(userId) {
  const gm = game.users?.activeGM;
  return game.user?.id === (gm?.id ?? userId);
}

export function combatActors(combat) {
  return [...new Set(Array.from(combat?.combatants ?? [], entry => entry.actor).filter(Boolean))];
}

export function isCombatTurnStart(combat, change) {
  if (change.turn === undefined && change.round === undefined) return false;
  if (!(combat.round > 0) || combat.turn == null) return false;
  const previous = combat.previous;
  return !previous || previous.round < combat.round ||
    (previous.round === combat.round && (previous.turn == null || previous.turn < combat.turn));
}
