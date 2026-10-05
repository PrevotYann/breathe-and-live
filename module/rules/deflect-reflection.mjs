import { getDeflectStance, consumeDeflectStance } from "../chat/reaction-card.mjs";
import { applyHpDamage } from "./resource-costs.mjs";
import { noteActorDamageTaken } from "./technique-utils.mjs";

export async function resolveDeflectStance(actor, damage) {
  const stance = getDeflectStance(actor);
  if (!stance) return null;
  if (!stance.reflectAllRound) {
    await consumeDeflectStance(actor);
    return "Posture défensive consommée : dégâts annulés.";
  }
  const candidates = canvas.tokens.placeables.filter(t => t.actor && t.actor.uuid !== actor.uuid);
  const targetId = await new Promise(resolve => new Dialog({ title: "Ondulation de la Flamme — renvoi des dégâts",
    content: `<p>Choisissez la cible recevant ${damage} dégâts. La posture reste active pendant ce round.</p><select name="target">${candidates.map(t => `<option value="${t.id}">${t.name}</option>`).join("")}</select>`,
    buttons: { apply: { label: "Dévier", callback: html => resolve(html.find('[name="target"]').val()) }, cancel: { label: "Annuler", callback: () => resolve(null) } }, close: () => resolve(null),
  }).render(true));
  const target = canvas.tokens.get(targetId);
  if (!target?.actor) return null;
  await applyHpDamage(target.actor, damage);
  await noteActorDamageTaken(target.actor, damage, { attackerUuid: actor.uuid });
  return `${damage} dégâts déviés vers ${target.name}. Posture maintenue jusqu'à la fin du round.`;
}
