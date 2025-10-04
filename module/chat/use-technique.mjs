// Consumes Endurance, checks cost, rolls damage, posts chat
export async function useTechnique(actor, item) {
  const cost = Number(item.system?.costE ?? 0) || 0;
  const ePath = "system.resources.e.value";
  const eVal = getProperty(actor, ePath) ?? 0;

  if (eVal < cost) {
    ui.notifications.warn(
      `Pas assez d'Endurance (E). Requis: ${cost}, actuel: ${eVal}`
    );
    return;
  }
  await actor.update({ [ePath]: eVal - cost });

  const dmg = item.system?.damage || "1d8";
  const roll = await new Roll(dmg).roll({ async: true });
  await roll.toMessage({
    speaker: ChatMessage.getSpeaker({ actor }),
    flavor: `Technique : ${item.name} — E -${cost}`,
  });
}
