import { SYSTEM_ID, LIMB_DEFINITIONS } from "../config/rule-data.mjs";
import { rollBasicAttack, rollBaseCheck, rollDerivedCheck, setLimbState } from "./action-engine.mjs";
import { applyHpDamage } from "./resource-costs.mjs";
import { spendCombatAction } from "./combat-actions.mjs";
import { noteActorDamageTaken } from "./technique-utils.mjs";
import { applyEffectsList } from "./effects-engine.mjs";
import { normalizeRuleName, consumeTechniqueUse } from "./technique-limits.mjs";
import { resolveCanvasToken } from "../chat/reaction-card.mjs";
import { runSourceMovement, publishFixedDamage, promptSourceMovement } from "./source-movement.mjs";

const attacks = {
  tsunami: { repeat: true }, "attaque des huit crocs": { count: 4, save: "Force de volonté", stun: true },
  "laceration enchainee": { count: 2, limb: true }, "elegance lunaire": { count: 2, bonus: 3, save: "Force de volonté", limb: true },
  "execution coordonnee": { count: 1, multiplier: 2, free: true }, "danse perforante": { count: 3, different: true },
  "coup de hache en arc de cercle": { count: 3, different: true, maximize: true },
  "briseur d'os": { count: 1, save: "Endurance", immobilize: true },
  "charge frenetique": { count: 1, bonusFormula: "1d8", prone: true, movement: 6 },
  "dents invisibles": { count: 1, retreat: true },
  suppression: { count: 1, limb: true, free: true },
  "flammes etourdissantes": { count: 1, opposed: "finesse", stun: true },
  "coupe-pierre": { count: 1, lowerArmor: true },
  "vents de guerre": { count: 1, initiative: true },
};
const areas = {
  "coup de meteore": { range: "weapon", save: "Finesse", dc: 16, damage: "12" },
  "coup de foudre": { range: 6, save: "Force", stun: true },
  "typhon tourbillonnant": { range: 3, save: "Vigueur", damage: "2d8", prone: true },
};
const comboQueues = new WeakMap();
function updateCombo(actor, id, edit) {
  const next = (comboQueues.get(actor) ?? Promise.resolve()).catch(error => console.error("BL | Combo", error)).then(async () => {
    const all = structuredClone(actor.getFlag(SYSTEM_ID, "sourceCombos") || {});
    const result = await edit(all);
    await actor.setFlag(SYSTEM_ID, "sourceCombos", all);
    return result;
  });
  comboQueues.set(actor, next);
  return next;
}
async function runPreviousAttack(actor, item, name) {
  const previous = actor.getFlag(SYSTEM_ID, "lastBasicAttack");
  if (!previous?.isFirearm || previous.sceneId !== canvas.scene?.id || previous.combatId !== (game.combat?.id || "") || (name === "correction" && previous.hit)) {
    ui.notifications.warn("Cette capacité nécessite un précédent tir dans ce combat ; Correction exige un tir manqué."); return null;
  }
  const weapon = actor.items.get(previous.weaponId), target = canvas.tokens.get(previous.targetTokenId);
  if (!weapon || !target) return null;
  if (name === "double-tap" && !(await Dialog.confirm({ title: item.name, content: "<p>Reproduire le jet et les dégâts du précédent tir sur la même cible, en dépensant une munition ? Le livre ne précise pas la gestion des munitions ou d'un changement de cible ; ce choix reste un arbitrage MJ.</p>" }))) return null;
  const result = await rollBasicAttack(actor, { item: weapon, targetToken: target, attackMode: previous.attackMode,
    targetLimb: previous.targetLimb || "", free: name === "correction", reactionRpCost: Number(item.system.costRp) || 0,
    sourceOptions: name === "correction" ? { noAmmoCost: true } : { replay: previous },
  });
  if (result) await consumeTechniqueUse(actor, item);
  return result;
}
async function askSave(actor, label, givenDc) {
  const knownBase = { Finesse: "finesse", Force: "force" }, knownDerived = { Endurance: "endurance" };
  let key = knownBase[label] || knownDerived[label], dc = givenDc;
  if (dc === undefined || !key) {
    // TODO-RULEBOOK-AMBIGUITY: these saves have no DC, or no stat mapping, in p.61-66.
    const answer = await new Promise(resolve => new Dialog({ title: `${label} — arbitrage MJ`,
      content: `<p>${actor.name} : le livre ne précise pas ${!key ? "la statistique associée et " : ""}la difficulté de ce test.</p>${!key ? `<label>Statistique</label><select name="stat">${Object.entries(CONFIG.breatheAndLive?.DERIVED_LABELS || {}).map(([key, text]) => `<option value="${key}">${text}</option>`).join("")}</select>` : ""}<label>Difficulté</label><input name="dc" type="number" placeholder="DD" />`,
      buttons: { roll: { label: "Tester", callback: html => {
        const raw = String(html.find('[name="dc"]').val() ?? "").trim();
        resolve(raw && Number.isFinite(Number(raw)) ? { key: key || html.find('[name="stat"]').val(), dc: Number(raw) } : null);
      } }, cancel: { label: "Annuler", callback: () => resolve(null) } }, close: () => resolve(null),
    }).render(true));
    if (!answer) return null;
    ({ key, dc } = answer);
  }
  const roll = knownBase[label] ? await rollBaseCheck(actor, key) : await rollDerivedCheck(actor, key, label);
  return roll ? roll.total >= dc : null;
}
async function consequence(actor, item, rule, limb, attacker) {
  if (rule.opposed) {
    const own = await rollBaseCheck(attacker, rule.opposed, item.name), opposing = await rollBaseCheck(actor, rule.opposed, item.name);
    if (!own || !opposing || own.total <= opposing.total) return;
  }
  if (rule.save) {
    const saved = await askSave(actor, rule.save, rule.dc);
    if (saved === null || saved) return;
  }
  if (rule.limb && limb) await setLimbState(actor, limb, { severed: true });
  if (rule.immobilize) await applyEffectsList({ source: actor, target: actor, effects: [{ path: "system.combat.sourceImmobilized", mode: "set", value: 1, duration: "roundEnd", label: "Briseur d'Os : déplacement nul un round" }] });
  if (rule.prone) await actor.setFlag(SYSTEM_ID, "prone", { source: item.name, note: "À terre ; le livre ne chiffre pas de malus supplémentaire." });
  if (rule.stun) {
    const duration = normalizeRuleName(item.name) === "attaque des huit crocs" ? "ownerTurns:1" : "currentTurnEnd";
    await applyEffectsList({ source: actor, target: actor, effects: [{ path: "system.combat.sourceStunned", mode: "set", value: 1, duration, label: `${item.name} : assommé` }] });
  }
}
export async function resolveSourceComboDamage(attacker, target, card) {
  if (!card.comboId) return;
  await updateCombo(attacker, card.comboId, async all => {
    const group = all[card.comboId];
    if (!group || group.targetUuid !== target.uuid || group.completed) return;
    group.accepted = [...new Set([...(group.accepted || []), card.comboIndex])];
    if (group.prepared && group.accepted.length === group.required) {
      group.completed = true;
      await consequence(target, { name: group.name }, group.rule, group.limb, attacker);
    }
  });
}

export async function runSourceTechnique(actor, item, context = {}) {
  const name = normalizeRuleName(item.name);
  const movement = await runSourceMovement(actor, item);
  if (movement !== undefined) return movement;
  if (name === "reflux brutal") {
    const incoming = actor.getFlag(SYSTEM_ID, "lastIncomingAttack"), target = Array.from(game.user.targets ?? []).find(t => t.actor);
    const token = actor.getActiveTokens?.()[0], range = Number(actor.items.find(i => i.type === "weapon")?.system?.range || 1.5);
    if (!incoming?.damage || incoming.combatId !== (game.combat?.id || "") || incoming.round !== game.combat?.round || incoming.turn !== game.combat?.turn || !token || !target || Math.max(Math.abs(token.center.x-target.center.x),Math.abs(token.center.y-target.center.y))/canvas.grid.size*1.5 > range) {
      ui.notifications.warn("Reflux Brutal exige des dégâts reçus pendant ce tour et une cible à portée de l'arme."); return null;
    }
    if (!(await spendCombatAction(actor, { reaction: true, costs: [{ path: "system.resources.rp.value", cost: item.system.costRp || 0, label: "RP" }] }))) return null;
    return publishFixedDamage(actor, [target], incoming.damage / 2, item.name);
  }
  if (name === "rideau de fer") {
    const target = Array.from(game.user.targets ?? []).find(t => t.actor && t.actor.uuid !== actor.uuid);
    if (!target || !(await Dialog.confirm({ title: item.name, content: `<p>${target.name} est-il un allié situé à portée visuelle ?</p>` }))) return null;
    if (!(await spendCombatAction(actor, { reaction: true, costs: [{ path: "system.resources.rp.value", cost: item.system.costRp || 0, label: "RP" }] }))) return null;
    await applyEffectsList({ source: actor, target, effects: [{ path: "system.resources.ca", mode: "add", value: 10, duration: "currentTurnEnd", origin: "rideau-de-fer", label: "Rideau de fer : +10 CA jusqu'à la fin du tour ou la première attaque" }] });
    return true;
  }
  if (["correction", "double-tap"].includes(name)) return runPreviousAttack(actor, item, name);
  if (name === "chasseur vorace") {
    const incoming = actor.getFlag(SYSTEM_ID, "lastIncomingAttack");
    if (!incoming?.melee || incoming.damage <= 0 || incoming.combatId !== (game.combat?.id || "") || incoming.round !== game.combat?.round || incoming.turn !== game.combat?.turn) {
      ui.notifications.warn("Chasseur vorace exige des dégâts de mêlée reçus pendant le tour en cours."); return null;
    }
    const target = canvas.tokens.placeables.find(t => t.actor?.uuid === incoming.attackerUuid);
    if (!target) return null;
    const result = await rollBasicAttack(actor, { targetToken: target, free: true });
    if (result) await actor.unsetFlag(SYSTEM_ID, "lastIncomingAttack");
    return result;
  }
  const rule = attacks[name] || areas[name];
  if (!rule) return undefined;
  const token = resolveCanvasToken(context.controlledToken, actor);
  const targets = Array.from(game.user.targets ?? []).filter(t => t.actor && t.id !== token?.id);
  if (!token || (!areas[name] && !targets.length)) { ui.notifications.warn("Sélectionnez votre token et les cibles de cette technique."); return null; }
  if (rule.lowerArmor && Number(targets[0].actor.system.resources.ca) >= Number(actor.system.resources.ca)) {
    ui.notifications.warn("Coupe-Pierre exige une CA ennemie inférieure à votre CA."); return null;
  }
  if (rule.initiative && !(game.combat?.turns?.findIndex(c => c.actor?.uuid === targets[0].actor.uuid) > game.combat?.turns?.findIndex(c => c.actor?.uuid === actor.uuid))) {
    ui.notifications.warn("Vents de Guerre exige un adversaire placé après vous dans l'ordre d'initiative."); return null;
  }
  if (rule.different && new Set(targets.map(t => t.id)).size < (name === "coup de hache en arc de cercle" ? 1 : 3)) {
    ui.notifications.warn("Danse perforante nécessite trois cibles différentes."); return null;
  }
  let limb = "";
  if (rule.limb) limb = await new Promise(resolve => new Dialog({ title: "Membre à arracher",
    content: `<select name="limb">${LIMB_DEFINITIONS.filter(l => l.category !== "vital").map(l => `<option value="${l.key}">${l.label}</option>`).join("")}</select>`,
    buttons: { apply: { label: "Choisir", callback: html => resolve(html.find('[name="limb"]').val()) }, cancel: { label: "Annuler", callback: () => resolve(null) } }, close: () => resolve(null),
  }).render(true));
  if (limb === null) return null;
  const chargeMovement = rule.movement ? await promptSourceMovement(actor, rule.movement) : null;
  if (rule.movement && !chargeMovement) return null;
  if (!(await spendCombatAction(actor, { free: !!rule.free, reaction: item.system?.activation === "reaction",
    costs: [{ path: "system.resources.rp.value", cost: item.system?.costRp || 0, label: "RP" }] }))) return null;
  await consumeTechniqueUse(actor, item);
  if (chargeMovement) await chargeMovement.token.document.update(chargeMovement.destination, { animate: false });
  if (areas[name]) {
    const weapon = actor.items.find(i => i.type === "weapon");
    const range = rule.range === "weapon" ? Number(weapon?.system?.range || 1.5) : rule.range;
    const eligible = canvas.tokens.placeables.filter(t => t.actor && t.id !== token.id &&
      Math.max(Math.abs(t.center.x - token.center.x), Math.abs(t.center.y - token.center.y)) / canvas.grid.size * 1.5 <= range);
    for (const target of eligible) {
      const saved = await askSave(target.actor, rule.save, rule.dc);
      if (saved === null || saved) continue;
      if (rule.damage) { const roll = await new Roll(rule.damage).evaluate(); await applyHpDamage(target.actor, roll.total); await noteActorDamageTaken(target.actor, roll.total); await roll.toMessage({ speaker: ChatMessage.getSpeaker({ actor }), flavor: `${item.name} : ${target.name}` }); }
      await consequence(target.actor, item, { ...rule, save: null }, limb);
    }
  } else {
    const comboId = foundry.utils.randomID(), messages = [];
    if (rule.limb || rule.stun || rule.immobilize || rule.prone) await updateCombo(actor, comboId, all => {
      all[comboId] = { targetUuid: targets[0].actor.uuid, required: rule.count, prepared: false, accepted: [], rule, limb, name: item.name };
    });
    let index = 0, allHit = true;
    do {
      const target = rule.different ? targets[index] : targets[0];
      if (!target) break;
      const weapon = actor.items.find(i => i.type === "weapon"), face = String(weapon?.system?.damage || "1d4").match(/d(\d+)/)?.[1] || "4";
      const result = await rollBasicAttack(actor, { targetToken: target, free: true, forceAutoHit: !!rule.lowerArmor, sourceOptions: {
        bonusDamage: rule.bonus || 0, bonusFormula: rule.initiative ? `${Number(actor.system.stats?.effectiveBase?.vitesse ?? actor.system.stats?.base?.vitesse) || 0}d${face}` : rule.bonusFormula, multiplier: rule.multiplier || 1,
        maximize: !!rule.maximize, comboId, comboIndex: index,
      } });
      if (!result?.hit) allHit = false;
      if (result?.chatMessage) messages.push(result.chatMessage.id);
      index++;
      if (rule.repeat && !allHit) break;
      if (rule.repeat && !(await Dialog.confirm({ title: "Tsunami", content: "<p>L'attaque touche. Effectuer l'attaque suivante ?</p>" }))) break;
    } while (rule.repeat || index < rule.count);
    if (rule.limb || rule.stun || rule.immobilize || rule.prone) await updateCombo(actor, comboId, async all => {
      if (!allHit || messages.length !== rule.count) { delete all[comboId]; return; }
      const group = all[comboId]; group.prepared = true;
      if (group.accepted.length === group.required) { group.completed = true; await consequence(targets[0].actor, item, rule, limb, actor); }
    });
    if (rule.retreat || rule.movement) await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }), content: `<em>${item.name} : ${rule.retreat ? "rejoignez le couvert le plus proche ; position et visibilité à confirmer sur la scène" : `déplacez le token jusqu'à ${rule.movement} m en ligne droite avant la frappe`}.</em>` });
  }
  return true;
}
