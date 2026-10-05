import { SYSTEM_ID } from "../config/rule-data.mjs";
import { applyEffectsList } from "./effects-engine.mjs";
import { applyHpDamage } from "./resource-costs.mjs";
import { noteActorDamageTaken } from "./technique-utils.mjs";

const normalize = value => String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const identity = actor => actor?.uuid || actor?.id;
const combatId = () => game.combat?.id || "free";
const stanceNames = new Map([
  ["posture de l'eau ecrasante", "water"], ["position sculpture de la pierre", "stone"],
  ["position vent perce", "wind"], ["position du feu protecteur", "flame"],
  ["posture ursine", "bear"], ["posture suidae", "boar"],
  ["position de combat mysterieuse", "tsuchinoko"], ["position des huit tetes", "orochi"],
  ["atlas impavide", "beetle"], ["guepe en essaim", "wasp"],
  ["arret cardiaque", "gifts"], ["plaisir de servir", "service"],
  ["gracieux", "nihon"], ["puissance", "kabuki"],
]);

export function getSubclassStance(actor) { return actor.system?.combat?.subclassStance || ""; }
export async function activateSubclassStance(actor, item) {
  if (["etoile du matin", "grande epee"].includes(normalize(item.name))) {
    if (item.system?.subclass) await actor.update({ "system.class.subclass": item.system.subclass });
    await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }), content: `<em>${item.name} : passif permanent actif.</em>` });
    return true;
  }
  const stance = stanceNames.get(normalize(item.name));
  if (!stance) return false;
  const active = getSubclassStance(actor) === stance;
  // TODO-RULEBOOK-AMBIGUITY: posture activation/expiry is not specified.
  // One persistent toggle is reversible; no unlisted action or RP cost is added.
  await actor.update({ "system.combat.subclassStance": active ? "" : stance });
  await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }), content: `<em>${actor.name} ${active ? "quitte" : "adopte"} ${item.name}.</em>` });
  return true;
}
export function prepareSubclassPassives(actor) {
  const sys = actor.system, stance = getSubclassStance(actor);
  const subclass = normalize(sys.class?.subclass), state = actor.getFlag(SYSTEM_ID, "subclassTurn") || {};
  let armor = 0;
  if (/etoile du matin/.test(subclass)) armor -= 2;
  if (stance === "flame" && state.flameDefense) armor += 4;
  if (stance === "beetle" && !state.moved && game.combat?.combatant?.actor?.uuid === actor.uuid) armor += 4;
  if (stance === "nihon" && game.combat?.round === 1) armor += 2;
  sys.resources.ca += armor;
  if (stance === "water") sys.combat.actionEconomy.effectiveMovementMeters = Math.max(0, sys.combat.actionEconomy.effectiveMovementMeters - 3);
  if (stance === "boar") sys.combat.actionEconomy.actionsPerTurn = Math.max(2, sys.combat.actionEconomy.actionsPerTurn);
  if (actor.getFlag(SYSTEM_ID, "stableShot")) sys.combat.actionEconomy.effectiveMovementMeters = 0;
}
export function subclassAttackModifiers(actor, target) {
  const stance = getSubclassStance(actor), subclass = normalize(actor.system?.class?.subclass);
  const state = actor.getFlag(SYSTEM_ID, "subclassTurn") || {}, encounter = actor.getFlag(SYSTEM_ID, "subclassEncounter") || {};
  const result = { attackBonus: 0, damageBonus: 0, damageMultiplier: 1, edge: 0, free: false };
  if (stance === "water") { result.attackBonus += 2; result.damageBonus += 4; }
  if (/etoile du matin/.test(subclass)) result.damageBonus += 4;
  if (/grande epee/.test(subclass)) {
    result.attackBonus += 2;
    if (Number(target.system?.stats?.effectiveBase?.force ?? target.system?.stats?.base?.force) < Number(actor.system?.stats?.effectiveBase?.force ?? actor.system?.stats?.base?.force)) result.damageBonus += 4;
  }
  if (stance === "tsuchinoko" && (encounter.combatId !== combatId() || !encounter.firstAttackUsed)) result.damageMultiplier *= 2;
  if (stance === "orochi" && state.nextAdvantage) result.edge++;
  if (stance === "gifts" && state.advantageAgainst === identity(target)) result.edge++;
  if (stance === "wind" && state.freeAttackAgainst === identity(target)) result.free = true;
  if (stance === "kabuki") {
    const bonus = Math.min(6, new Set(state.hitTargets || []).size * 2);
    result.attackBonus += bonus; result.damageBonus += bonus;
  }
  if (getSubclassStance(target) === "boar") result.attackBonus += 3;
  return result;
}
export async function onBasicAttackResolved(actor, target, { hit }) {
  const stance = getSubclassStance(actor), state = structuredClone(actor.getFlag(SYSTEM_ID, "subclassTurn") || {});
  if (stance === "flame") state.flameDefense = true;
  if (stance === "orochi") state.nextAdvantage = !hit;
  if (state.freeAttackAgainst === identity(target)) delete state.freeAttackAgainst;
  if (state.advantageAgainst === identity(target)) delete state.advantageAgainst;
  if (stance === "kabuki" && hit) state.hitTargets = [...new Set([...(state.hitTargets || []), identity(target)])];
  await actor.setFlag(SYSTEM_ID, "subclassTurn", state);
  if (stance === "tsuchinoko") await actor.setFlag(SYSTEM_ID, "subclassEncounter", { combatId: combatId(), firstAttackUsed: true });
  if (hit) return;
  const defenderStance = getSubclassStance(target), defenderState = structuredClone(target.getFlag(SYSTEM_ID, "subclassTurn") || {});
  if (defenderStance === "wind") defenderState.freeAttackAgainst = identity(actor);
  if (defenderStance === "gifts") defenderState.advantageAgainst = identity(actor);
  await target.setFlag(SYSTEM_ID, "subclassTurn", defenderState);
  if (defenderStance === "nihon" && game.combat?.round === 1) {
    const roll = await new Roll("1d6").evaluate();
    await applyHpDamage(actor, roll.total); await noteActorDamageTaken(actor, roll.total);
    await roll.toMessage({ speaker: ChatMessage.getSpeaker({ actor: target }), flavor: "Gracieux : dégâts à l'attaquant qui a raté." });
  }
}
export async function onSubclassWeaponHit(actor, target, damage) {
  const stance = getSubclassStance(actor);
  if (stance === "stone") await applyEffectsList({ source: actor, target, effects: [{ path: "system.resources.ca", mode: "add", value: -2, duration: "combatEnd", label: "Sculpture de la Pierre : CA -2 (cumulatif)" }] });
  if (stance === "bear") await actor.update({ "system.resources.hp.temporary": (Number(actor.system?.resources?.hp?.temporary) || 0) + Math.floor(damage / 2) });
  return stance === "wasp";
}
export async function beginSubclassTurn(actor) {
  const previous = actor.getFlag(SYSTEM_ID, "subclassTurn") || {};
  await actor.setFlag(SYSTEM_ID, "subclassTurn", { ...previous, moved: false, hitTargets: [], flameDefense: false });
}
export async function noteSubclassMovement(token, change) {
  if (change.x === undefined && change.y === undefined) return;
  const actor = token.actor; if (!actor) return;
  const state = structuredClone(actor.getFlag(SYSTEM_ID, "subclassTurn") || {}); state.moved = true;
  await actor.setFlag(SYSTEM_ID, "subclassTurn", state);
  if (actor.getFlag(SYSTEM_ID, "stableShot")) await actor.unsetFlag(SYSTEM_ID, "stableShot");
}
