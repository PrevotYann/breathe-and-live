const resourceQueues = new WeakMap();
function serializeResources(actor, operation) {
  const previous = resourceQueues.get(actor) ?? Promise.resolve();
  const next = previous.catch(() => {}).then(operation);
  resourceQueues.set(actor, next);
  return next;
}

export function spendResourceCosts(actor, costs) {
  return serializeResources(actor, () => resolveResourceCosts(actor, costs));
}

async function resolveResourceCosts(actor, costs) {
  const update = {};
  const notes = [];
  for (const { path, cost, label } of costs) {
    const amount = Number(cost ?? 0);
    if (!Number.isFinite(amount) || amount < 0) {
      ui.notifications.warn(`Cout invalide : ${label}.`);
      return null;
    }
    if (!amount) continue;
    const current = update[path] ?? Number(foundry.utils.getProperty(actor, path) ?? 0);
    if (current < amount) {
      ui.notifications.warn(`Pas assez de ${label}. Requis: ${amount}, actuel: ${current}`);
      return null;
    }
    update[path] = current - amount;
    if (path === "system.resources.rp.value" && game.combat?.round > 0) update["flags.breathe-and-live.rpSpentBoundary"] = {
      combatId: game.combat.id, round: game.combat.round, turn: game.combat.turn,
    };
    if (path === "system.resources.e.value") {
      const temporaryPath = "system.resources.e.temporary";
      const temporary = update[temporaryPath] ?? Number(foundry.utils.getProperty(actor, temporaryPath) ?? 0);
      if (temporary > 0) update[temporaryPath] = Math.max(0, temporary - amount);
    }
    notes.push(`${label} -${amount}`);
  }
  if (Object.keys(update).length) await actor.update(update);
  return notes;
}

export function applyHpDamage(actor, amount) {
  return serializeResources(actor, () => resolveHpDamage(actor, amount));
}

async function resolveHpDamage(actor, amount) {
  const damage = Math.max(0, Number(amount) || 0);
  const hp = actor.system?.resources?.hp ?? {};
  const temporary = Math.max(0, Number(hp.temporary) || 0);
  const absorbed = Math.min(temporary, damage);
  const analgesic = actor.getFlag?.("breathe-and-live", "analgesicExpiry");
  const extra = {};
  if (analgesic) {
    const remaining = Math.max(0, Number(analgesic.remaining ?? analgesic.amount) || 0);
    const absorbedAnalgesic = Math.max(0, absorbed - Math.max(0, temporary - remaining));
    if (absorbedAnalgesic) extra["flags.breathe-and-live.analgesicExpiry"] = {
      ...analgesic, remaining: Math.max(0, remaining - absorbedAnalgesic), deferredDamage: (Number(analgesic.deferredDamage) || 0) + absorbedAnalgesic,
    };
  }
  const nextHp = Math.max(0, (Number(hp.value) || 0) - damage + absorbed);
  await actor.update({ "system.resources.hp.value": nextHp,
    ...(absorbed ? { "system.resources.hp.temporary": temporary - absorbed } : {}), ...extra });
  return { damage, absorbed, nextHp };
}
