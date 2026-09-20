export async function spendResourceCosts(actor, costs) {
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
    notes.push(`${label} -${amount}`);
  }
  if (Object.keys(update).length) await actor.update(update);
  return notes;
}
