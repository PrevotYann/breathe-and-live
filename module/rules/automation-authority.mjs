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

const combatProcessors = [];
const combatQueues = new WeakMap();
let combatHookRegistered = false;

// Foundry dispatches hooks without awaiting them. Snapshot the transition and
// serialize its writers, including rapid clicks on Next Turn.
export function registerCombatAutomation(priority, process) {
  combatProcessors.push({ priority, process });
  combatProcessors.sort((a, b) => a.priority - b.priority);
  if (combatHookRegistered) return;
  combatHookRegistered = true;
  Hooks.on("updateCombat", (combat, change, options, userId) => {
    if (!isAutomationAuthority(userId) || !isCombatTurnStart(combat, change)) return;
    const snapshot = {
      id: combat.id, round: combat.round, turn: combat.turn,
      previous: combat.previous ? { ...combat.previous } : null,
      combatants: combat.combatants, turns: [...(combat.turns ?? [])],
      combatant: combat.combatant,
    };
    const queue = combatQueues.get(combat) ?? Promise.resolve();
    const next = queue.catch(error => console.error("BL | Combat automation", error)).then(async () => {
      for (const handler of combatProcessors) await handler.process(snapshot, { ...change }, options, userId);
    });
    combatQueues.set(combat, next);
    return next;
  });
}
