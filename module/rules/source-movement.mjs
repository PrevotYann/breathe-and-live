import { SYSTEM_ID } from "../config/rule-data.mjs";
import { getConditionActionRestriction } from "./condition-utils.mjs";
import { normalizeRuleName, consumeTechniqueUse } from "./technique-limits.mjs";
import { spendCombatAction } from "./combat-actions.mjs";
import { rollBasicAttack, spendRp } from "./action-engine.mjs";
import { applyHpDamage } from "./resource-costs.mjs";
import { noteActorDamageTaken } from "./technique-utils.mjs";
import { applyEffectsList } from "./effects-engine.mjs";
import { cardFlags, registerCardType } from "../chat/persistent-cards.mjs";
import { buildReactionTargetRow, canInteractWithToken, consumeDeflectStance } from "../chat/reaction-card.mjs";
import { attachSourceReactions } from "./source-reactions.mjs";

const movementRules = {
  "vents froids": { half: true, damage: true }, "ruee sauvage": { distance: 6, attacks: true },
  "evasion rythmique": { distance: 9, modifiers: true }, "charge souterraine": { distance: 6, firstProne: true },
};
export async function publishFixedDamage(actor, targets, damage, label) {
  const token = actor.getActiveTokens?.()[0];
  return ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }), flags: cardFlags("sourceDamage", {
    actorUuid: actor.uuid, sceneId: canvas.scene.id,
  }), flavor: `<div class="bl-card"><strong>${label} : ${damage} dégâts.</strong>${targets.map(targetToken => buildReactionTargetRow({ attackerToken: token, targetToken, damageTotal: damage })).join("")}</div>` });
}
registerCardType("sourceDamage", async (card, html, on) => {
  const attacker = await fromUuid(card.actorUuid);
  if (!attacker) throw Error("Source de dégâts introuvable.");
  attachSourceReactions(card, html, on, attacker);
  const resolve = async (event, mode) => {
    const button = $(event.currentTarget), token = canvas.tokens.get(String(button.attr("data-target-token")));
    if (!token?.actor || !canInteractWithToken(token)) return;
    let text;
    if (mode === "dodge") { if (!(await spendRp(token.actor, 1))) return; text = "Esquive : dégâts annulés."; }
    else if (mode === "stance") { await consumeDeflectStance(token.actor); text = "Posture consommée : dégâts annulés."; }
    else {
      const damage = Math.max(0, Number(button.attr("data-damage")) || 0);
      await applyHpDamage(token.actor, damage); await noteActorDamageTaken(token.actor, damage);
      text = `${token.name} subit ${damage} dégâts.`;
    }
    const row = html.find(`.bl-target-row[data-target-token="${token.id}"]`);
    row.find("button").prop("disabled", true); row.find(".bl-target-result").text(text);
  };
  on(".bl-dodge", event => resolve(event, "dodge"));
  on(".bl-stance-deflect", event => resolve(event, "stance"));
  on(".bl-takedmg", event => resolve(event, "damage"));
});

export async function promptSourceMovement(actor, maximum) {
  if (getConditionActionRestriction(actor, "movement").blocked) return null;
  const token = actor.getActiveTokens?.()[0]; if (!token) return null;
  const size = canvas.grid.size;
  const destination = await new Promise(resolve => new Dialog({ title: `Déplacement — maximum ${maximum} m`,
    content: `<p>Indiquez la case de destination (colonne et ligne, origine 0). Confirmez avec le MJ les obstacles et les créatures réellement traversées.</p><label>Colonne</label><input name="x" type="number" value="${token.document.x / size}" /><label>Ligne</label><input name="y" type="number" value="${token.document.y / size}" />`,
    buttons: { move: { label: "Déplacer", callback: html => resolve({ x: Number(html.find('[name="x"]').val()) * size, y: Number(html.find('[name="y"]').val()) * size }) }, cancel: { label: "Annuler", callback: () => resolve(null) } }, close: () => resolve(null),
  }).render(true));
  if (!destination || !Number.isFinite(destination.x + destination.y)) return null;
  const origin = { x: token.document.x, y: token.document.y }, dx = destination.x - origin.x, dy = destination.y - origin.y;
  if (Math.max(Math.abs(dx), Math.abs(dy)) / size * (canvas.scene.grid.distance || 1.5) > maximum) {
    ui.notifications.warn("La destination dépasse la distance autorisée."); return null;
  }
  const length2 = dx * dx + dy * dy;
  const crossed = canvas.tokens.placeables.filter(t => {
    if (!t.actor || t.id === token.id || !length2) return false;
    const x = t.document.x - origin.x, y = t.document.y - origin.y;
    const progress = (x * dx + y * dy) / length2;
    return progress >= 0 && progress <= 1 && Math.max(Math.abs(x-progress*dx),Math.abs(y-progress*dy)) <= size/2;
  }).sort((a,b) => Math.hypot(a.document.x-origin.x,a.document.y-origin.y)-Math.hypot(b.document.x-origin.x,b.document.y-origin.y));
  return { token, destination, crossed };
}
export async function runSourceMovement(actor, item) {
  const name = normalizeRuleName(item.name), rule = movementRules[name];
  if (!rule && name !== "exploit") return undefined;
  const token = actor.getActiveTokens?.()[0]; if (!token) return null;
  let move, ally;
  if (name === "exploit") {
    ally = Array.from(game.user.targets ?? []).find(t => t.actor && t.id !== token.id && t.document.disposition === token.document.disposition);
    if (!ally || Math.max(Math.abs(ally.document.x-token.document.x),Math.abs(ally.document.y-token.document.y)) / canvas.grid.size * 1.5 > 4.5) {
      ui.notifications.warn("Exploit exige un allié ciblé à 4,5 m maximum."); return null;
    }
  } else move = await promptSourceMovement(actor, rule.half ? Number(actor.system.combat.actionEconomy.effectiveMovementMeters)/2 : rule.distance);
  if (!ally && !move) return null;
  if (!(await spendCombatAction(actor, { reaction: item.system.activation === "reaction", costs: [{ path: "system.resources.rp.value", cost: Number(item.system.costRp) || 0, label: "RP" }] }))) return null;
  await consumeTechniqueUse(actor, item);
  if (ally) {
    const before = { x: token.document.x, y: token.document.y };
    await canvas.scene.updateEmbeddedDocuments("Token", [{ _id: token.id, x: ally.document.x, y: ally.document.y }, { _id: ally.id, ...before }], { animate: false });
    await rollBasicAttack(actor, { free: true }); return true;
  }
  await token.document.update(move.destination, { animate: false });
  const enemies = move.crossed.filter(t => t.document.disposition !== token.document.disposition);
  if (rule.damage && enemies.length) await publishFixedDamage(actor, enemies, Number(actor.system.stats.effectiveBase?.vitesse ?? actor.system.stats.base.vitesse) || 0, item.name);
  if (rule.attacks) for (const target of enemies) await rollBasicAttack(actor, { targetToken: target, free: true, targetLimb: "" });
  if (rule.modifiers) for (const target of move.crossed) await target.actor.setFlag(SYSTEM_ID, "nextAttackMovementBonus", { value: target.document.disposition === token.document.disposition ? 2 : -2, source: item.name });
  if (rule.firstProne && enemies[0]) await applyEffectsList({ source: actor, target: enemies[0], effects: [{ path: "flags.breathe-and-live.prone", mode: "set", value: 1, duration: "ownerTurns:1", label: "Charge souterraine : à terre jusqu'au prochain tour" }] });
  return true;
}
