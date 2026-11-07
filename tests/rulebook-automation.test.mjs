import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { MockActor, gm, player, fire, hooks, makeCombat, NS, chatMessages, tokenFor } from "./foundry-mocks.mjs";
import { setConditionState, processConditionTurnStart, processConditionTurnEnd, registerActionHooks, useMedicalItem, runRestRefresh, runDemonHeal, runDemonistHealingReaction, applyExecutionSkill } from "../module/rules/action-engine.mjs";
import { sourceAllyReactionButtons } from "../module/rules/source-reactions.mjs";
import { spendResourceCosts, applyHpDamage, restoreHp } from "../module/rules/resource-costs.mjs";
import { drivingBonus, envelopingAttackPenalty } from "../module/rules/character-capabilities.mjs";
import { getDeflectStance, consumeDeflectStance } from "../module/chat/reaction-card.mjs";
import { refreshCombatActions, spendCombatAction } from "../module/rules/combat-actions.mjs";
import { startRegeneration, tickRegeneration } from "../module/rules/regeneration.mjs";
import { lockRedBladeHealing, healingIsBlocked } from "../module/rules/combat-state.mjs";
import { applyPreHit, applyOnHit, getActiveBreaths, BREATH_FORM_COUNTS } from "../module/rules/breath-effects.mjs";
import { actorHasBreath, buildFormulaWithActorStats } from "../module/rules/technique-utils.mjs";
import { getDemonFleshRank } from "../module/config/rule-data.mjs";
import { conditionAutoFailDerived, getConditionDerivedPenalties } from "../module/rules/condition-utils.mjs";
import { useTechnique } from "../module/chat/use-technique.mjs";
import { DEMON_RANK_PACKAGES } from "../module/config/rule-data.mjs";
import { BLSlayerSheet } from "../module/sheets/actor-slayer-sheet.mjs";
import { techniqueUsage, checkTechniqueUses, consumeTechniqueUse } from "../module/rules/technique-limits.mjs";
import { applyEffectsList, purgeExpiredEffects } from "../module/rules/effects-engine.mjs";
import { calculateCustomBreathCost } from "../module/rules/custom-breath-builder.mjs";
import { prepareSubclassPassives, onSubclassWeaponHit } from "../module/rules/subclass-passives.mjs";
import { getEffectiveBaseStats, resolvePoisonRuntime } from "../module/rules/poison-utils.mjs";
import { getConditionActionRestriction } from "../module/rules/condition-utils.mjs";

Roll.prototype.toMessage = async function(data) { return ChatMessage.create({ ...data, total: this.total }); };
registerActionHooks();
beforeEach(() => {
  game.user = gm; game.users.activeGM = gm; game.combat = null;
  game.user.targets = new Set(); game.time = { worldTime: 0 };
  game.actors.contents = []; canvas.tokens.placeables = []; chatMessages.length = 0;
});
const character = (type = "slayer") => new MockActor("test", {
  class: { rank: "Mizunoto", level: 1 }, stats: { base: { force: 4, finesse: 3, courage: 4, intellect: 2, vitesse: 2 }, derived: { medecine: 2 } },
  resources: { hp: { value: 10, max: 40, healableMax: 40, temporary: 0 }, e: { value: 10, max: 20, temporary: 0 }, rp: { value: 4, max: 9 }, bdp: { value: 10, max: 20 }, demonisation: 0 },
  combat: { actionEconomy: { actionsPerTurn: 2, bonusActions: 0 } }, conditions: {}, support: {},
}, type);
function item(name, system) {
  return { name, type: "medical", system: { quantity: 2, ...system }, async update(patch) {
    for (const [key, value] of Object.entries(patch)) this.system[key.replace(/^system\./, "")] = value;
  } };
}

test("finite burns deal damage on exactly two owner turns and then deactivate", async () => {
  const actor = character(); await setConditionState(actor, "burn", { active: true, duration: 2 });
  await processConditionTurnStart(actor); assert.equal(actor.system.resources.hp.value, 9);
  await processConditionTurnEnd(actor); assert.equal(actor.system.conditions.burn.duration, 1);
  await processConditionTurnStart(actor); assert.equal(actor.system.resources.hp.value, 8);
  await processConditionTurnEnd(actor); assert.equal(actor.system.conditions.burn.active, false);
  await processConditionTurnStart(actor); assert.equal(actor.system.resources.hp.value, 8);
});
test("freeze rolls its duration once and remains active through its final turn", async () => {
  const actor = character(); await setConditionState(actor, "freeze", { active: true });
  assert.equal(actor.system.conditions.freeze.duration, 3);
  for (let i = 0; i < 3; i++) { await processConditionTurnStart(actor); assert.equal(actor.system.conditions.freeze.active, true); await processConditionTurnEnd(actor); }
  assert.equal(actor.system.conditions.freeze.active, false);
});
test("new condition does not lose a full duration on the turn it was applied", async () => {
  const actor = character(); game.combat = makeCombat([actor]);
  await setConditionState(actor, "bleed", { active: true, duration: 1 });
  const end = { ...game.combat, previous: { round: 2, turn: 0 } };
  await processConditionTurnEnd(actor, end); assert.equal(actor.system.conditions.bleed.duration, 1);
  await processConditionTurnEnd(actor, { ...end, previous: { round: 3, turn: 0 } });
  assert.equal(actor.system.conditions.bleed.active, false);
});
test("off-balance expires at the end of the actual current turn, even on another actor", async () => {
  const first = character(), target = new MockActor("target", { conditions: { offBalance: { active: true, duration: 0 } } });
  const combat = makeCombat([first, target]); game.combat = combat;
  await fire("updateCombat", combat, { round: 2, turn: 0 }, {}, gm.id);
  assert.equal(target.system.conditions.offBalance.active, false);
  assert.equal(first.system.combat.actionEconomy.remainingActions, 2);
});
test("rapid asynchronous combat updates keep both outgoing countdowns", async () => {
  const a = character(), b = new MockActor("b", structuredClone(a.system));
  await setConditionState(a, "freeze", { active: true, duration: 2 });
  await setConditionState(b, "freeze", { active: true, duration: 2 });
  const combat = makeCombat([a, b]); game.combat = combat;
  const callback = hooks.get("updateCombat")[0];
  const first = callback(combat, { round: 2, turn: 0 }, {}, gm.id);
  Object.assign(combat, { round: 2, turn: 1, previous: { round: 2, turn: 0, combatantId: "c0" }, combatant: combat.combatants[1] });
  const second = callback(combat, { turn: 1 }, {}, gm.id);
  await Promise.all([first, second]);
  assert.equal(a.system.conditions.freeze.duration, 1); assert.equal(b.system.conditions.freeze.duration, 1);
});
test("concurrent resource payments cannot overspend or overwrite each other", async () => {
  const actor = character(); const costs = [{ path: "system.resources.bdp.value", cost: 6, label: "BDP" }];
  const results = await Promise.all([spendResourceCosts(actor, costs), spendResourceCosts(actor, costs)]);
  assert.equal(results.filter(Boolean).length, 1); assert.equal(actor.system.resources.bdp.value, 4);
});
test("temporary endurance is consumed first and cannot refill its old ceiling", async () => {
  const actor = character(); await actor.update({ "system.resources.e.value": 25, "system.resources.e.temporary": 10 });
  await spendResourceCosts(actor, [{ path: "system.resources.e.value", cost: 7, label: "E" }]);
  assert.equal(actor.system.resources.e.value, 18); assert.equal(actor.system.resources.e.temporary, 3);
});
test("temporary HP absorb simultaneous incoming damage before real HP", async () => {
  const actor = character(); await actor.update({ "system.resources.hp.temporary": 5 });
  await Promise.all([applyHpDamage(actor, 4), applyHpDamage(actor, 4)]);
  assert.equal(actor.system.resources.hp.temporary, 0); assert.equal(actor.system.resources.hp.value, 7);
});
test("actions refresh, exhaust, and do not reset RP", async () => {
  const actor = character(); game.combat = makeCombat([actor]);
  await refreshCombatActions(actor); assert.ok(await spendCombatAction(actor)); assert.ok(await spendCombatAction(actor));
  assert.equal(await spendCombatAction(actor), null); assert.equal(actor.system.resources.rp.value, 4);
  await refreshCombatActions(actor); assert.equal(actor.system.combat.actionEconomy.remainingActions, 2);
});
test("reaction costs RP atomically without consuming an action", async () => {
  const actor = character(); game.combat = makeCombat([actor]); await refreshCombatActions(actor);
  assert.ok(await spendCombatAction(actor, { reaction: true, costs: [{ path: "system.resources.rp.value", cost: 2, label: "RP" }] }));
  assert.equal(actor.system.combat.actionEconomy.remainingActions, 2); assert.equal(actor.system.resources.rp.value, 2);
});
test("short rest preserves RP; eight hours refresh them", async () => {
  const actor = character(); await runRestRefresh(actor, { full: false, hours: 1 });
  assert.equal(actor.system.resources.rp.value, 4); await runRestRefresh(actor, { hours: 8 }); assert.equal(actor.system.resources.rp.value, 9);
});
test("red blade blocks demon healing and BDP spending only for the struck turn", async () => {
  const actor = character("demon"); await actor.update({ "system.class.rank": "Demon faible" });
  game.combat = makeCombat([actor]); await lockRedBladeHealing(actor); assert.ok(healingIsBlocked(actor));
  assert.equal(await runDemonHeal(actor), null); assert.equal(actor.system.resources.bdp.value, 10);
  game.combat.turn++; assert.equal(healingIsBlocked(actor), false);
});
test("scheduled limb regeneration survives serialization and restores all injury fields", async () => {
  const actor = character("demon"); await actor.update({ "system.combat.injuries.limbs.leftArm": { severed: true, broken: true }, "system.combat.injuries.targetedDamage.leftArm": 20 });
  await startRegeneration(actor, { limbs: ["leftArm"], turns: 2 }); await tickRegeneration(actor);
  const restored = new MockActor("test", structuredClone(actor.system), "demon"); await tickRegeneration(restored);
  assert.equal(restored.system.combat.regeneration.active, false); assert.equal(restored.system.combat.injuries.limbs.leftArm.severed, false); assert.equal(restored.system.combat.injuries.targetedDamage.leftArm, 0);
});
test("active medicine halves per-turn demonisation during regrowth", async () => {
  const actor = character("demonist"); await actor.update({ "system.support.activeDemonistMedicine": true });
  await startRegeneration(actor, { limbs: ["leftArm"], turns: 2, demonisationPerTurn: 1 }); await tickRegeneration(actor);
  assert.equal(actor.system.resources.demonisation, 0.5);
});
test("maximized medical reaction includes every die, flat bonus and Medicine, and consumes one dose", async () => {
  const actor = character(); await actor.update({ "system.support.medicalTraining": true }); const gear = item("Bandage", { healing: "2d4 + 1" });
  assert.equal(await useMedicalItem(actor, gear, { reaction: true, maximize: true }), 11);
  assert.equal(actor.system.resources.hp.value, 21); assert.equal(actor.system.resources.rp.value, 2); assert.equal(gear.system.quantity, 1);
});
test("splint stabilizes broken bones without fabricated healing", async () => {
  const actor = character(); await actor.update({ "system.combat.injuries.limbs.leftLeg": { broken: true } });
  await useMedicalItem(actor, item("Attelle", {})); assert.equal(actor.system.resources.hp.value, 10);
  assert.equal(actor.system.combat.injuries.limbs.leftLeg.stabilized, true);
});
test("analgesics grant one-hour temporary HP and expiry removes the remainder", async () => {
  const actor = character(); game.actors.contents = [actor]; await useMedicalItem(actor, item("Analgésiques", {}));
  assert.equal(actor.system.resources.hp.temporary, 10); assert.equal(actor.system.resources.hp.value, 10);
  await applyHpDamage(actor, 4); game.time.worldTime = 3600;
  await fire("updateWorldTime", 3600, 3600, {}, gm.id); assert.equal(actor.system.resources.hp.temporary, 0);
  assert.equal(actor.system.resources.hp.value, 6);
});
test("blindness does not disable auditory Perception; paresthesia does not invent a precision penalty", () => {
  const actor = character(); actor.system.conditions = { blinded: { active: true }, paresthesia: { active: true } };
  assert.deepEqual(conditionAutoFailDerived(actor, "perception", "ouïe"), []);
  assert.deepEqual(conditionAutoFailDerived(actor, "perception", "vue"), ["Aveugle"]);
  assert.deepEqual(getConditionDerivedPenalties(actor), {});
});
const breathItem = (key, system = {}) => ({ type: "breath", name: key, system: { key, ...system } });
const formItem = (key, form) => ({ type: "technique", name: `${key} ${form}`, system: { breathKey: key, form } });
test("moon mastery adds the matching die to another breathing style", async () => {
  const actor = character(); actor.items.push(breathItem("moon", { masteryGranted: true }));
  const demon = character("demon"); const token = tokenFor(actor); token.document = { disposition: 1 }; canvas.tokens.placeables = [token];
  const pre = await applyPreHit(actor, { actor: demon }, { system: { breathKey: "water", damage: "2d8", costE: 4 } }, { attackerToken: token });
  assert.equal(pre.dmgExpr, "2d8 + 1d8");
});
test("snow mastery applies AC effects on ordinary weapon hits", async () => {
  const actor = character(); actor.items.push(breathItem("snow"), ...Array.from({ length: 8 }, (_, i) => formItem("snow", i + 1)));
  const target = character("demon"); await applyOnHit(actor, { actor: target }, { system: {}, uuid: "Item.weapon" }, {}, { tookDamage: true });
  assert.equal(target.getFlag(NS, "effects")[0].duration, "roundEnd");
});
test("incomplete forms cannot silently execute default numeric placeholders", async () => {
  globalThis.Dialog = { confirm: async () => false };
  const actor = character(); const gear = { name: "Forme incomplète", system: { ruleSource: { missingFields: ["damage"], approved: false }, costE: 5 } };
  await useTechnique(actor, gear); assert.equal(actor.system.resources.e.value, 10); assert.equal(actor.updates.length, 0);
  game.user = player; let asked = false; globalThis.Dialog = { confirm: async () => { asked = true; return true; } };
  actor.owners = new Set([player.id]);
  await useTechnique(actor, gear); assert.equal(asked, false, "players cannot arbitrate missing rule values");
});
test("GM arbitration at use time persists approval for blood arts with missing book values", async () => {
  globalThis.Dialog = { confirm: async () => true };
  const art = { name: "Art de sang", type: "bda", system: { activation: "passive", ruleSource: { missingFields: ["coût BDP"], approved: false } },
    async update(patch) { this.system.ruleSource.approved = patch["system.ruleSource.approved"]; } };
  await useTechnique(character("npcDemon"), art);
  assert.equal(art.system.ruleSource.approved, true);
});
test("breath specials need the owned style and every form; legacy toggles grant nothing", () => {
  const actor = character();
  actor.system.breaths = { mist: { enabled: true, specials: { nuagesTrainants: true } } };
  assert.equal(getActiveBreaths(actor).mist, undefined, "a toggle without the breath item is not a practised breath");
  assert.equal(actorHasBreath(actor, "mist"), false);
  actor.items.push(breathItem("mist", { specials: { nuagesTrainants: true } }), formItem("mist", 1), formItem("mist", 2));
  assert.equal(getActiveBreaths(actor).mist.enabled, true);
  assert.equal(getActiveBreaths(actor).mist.specials.nuagesTrainants, false, "2/6 forms: special stays locked");
  actor.items.push(...[3, 4, 5, 6].map(n => formItem("mist", n)));
  assert.equal(getActiveBreaths(actor).mist.specials.nuagesTrainants, true);
  assert.deepEqual(Object.keys(getActiveBreaths(actor)), ["mist"], "no other breath leaks in");
});
test("every breath special is gated by mastery of its own style only", () => {
  for (const [key, total] of Object.entries(BREATH_FORM_COUNTS)) {
    const actor = character(); actor.items.push(breathItem(key));
    for (let n = 1; n < total; n++) actor.items.push(formItem(key, n));
    const partial = getActiveBreaths(actor)[key];
    assert.ok(Object.values(partial.specials).every(v => v === false), `${key}: locked before last form`);
    actor.items.push(formItem(key, total));
    assert.ok(Object.values(getActiveBreaths(actor)[key].specials).every(v => v === true), `${key}: unlocked when mastered`);
  }
});
test("rank-up grants usable study slots and preserves chosen statistics", async () => {
  const actor = character(); actor.system.progression = { studySlots: { value: 0, max: 0 }, skillSlots: { value: 0, max: 0 }, bonuses: {} };
  actor._source.system.progression = structuredClone(actor.system.progression);
  const sheet = Object.create(BLSlayerSheet.prototype); sheet.actor = actor; sheet.render = () => {};
  sheet._promptRankAdvancement = async () => ({ hpBonus: 3, enduranceBonus: 5, studySlots: 1, skillSlots: 1, chosenStats: [{ stat: "force", amount: 1 }] });
  ui.notifications.info = () => {};
  await sheet._handleRankChange({ preventDefault() {}, stopPropagation() {}, currentTarget: { value: "Mizunoe" } });
  assert.equal(actor.system.progression.studySlots.value, 1); assert.equal(actor.system.stats.base.force, 5);
});
test("demon benchmark RP agree with all six explicit stat blocks", () => {
  assert.deepEqual(Object.values(DEMON_RANK_PACKAGES).map(p => p.benchmark.rp), [4, 9, 14, 25, 32, 50]);
});

test("limited subclass combos share their daily counter and reset only the next day", async () => {
  const actor = character(), first = { name: "Vents de Guerre" }, copy = { name: "Vents de Guerre" };
  for (let i = 0; i < 3; i++) { assert.ok(checkTechniqueUses(actor, copy)); await consumeTechniqueUse(actor, first); }
  assert.equal(checkTechniqueUses(actor, copy), false);
  game.time.worldTime = 86399; assert.equal(techniqueUsage(actor, copy).available, false);
  game.time.worldTime = 86400; assert.equal(techniqueUsage(actor, copy).available, true);
});
test("encounter limits reset for a new combat, not at a new round", async () => {
  const actor = character(), ability = { name: "Coupe-Pierre" }; game.combat = makeCombat([actor]);
  await consumeTechniqueUse(actor, ability); game.combat.round++;
  assert.equal(techniqueUsage(actor, ability).available, false);
  game.combat.id = "next"; assert.equal(techniqueUsage(actor, ability).available, true);
});
test("custom breath range is free within a ranged Nichirin weapon's natural reach", () => {
  assert.equal(calculateCustomBreathCost({ damageKey: "1d12", rangeKey: "6m", effectKey: "ranged", weaponRange: 9 }).rawCost, 5);
  assert.equal(calculateCustomBreathCost({ damageKey: "1d12", rangeKey: "6m", effectKey: "ranged", weaponRange: 3 }).rawCost, 8);
});
test("continuous regeneration also restores future injuries and keeps ticking demonisation", async () => {
  const actor = character("demonist"); await startRegeneration(actor, { limbs: [], turns: 1, continuous: true, demonisationPerTurn: 1 });
  await tickRegeneration(actor); assert.equal(actor.system.combat.regeneration.active, true);
  await actor.update({ "system.combat.injuries.limbs.rightArm.severed": true });
  await tickRegeneration(actor); assert.equal(actor.system.combat.injuries.limbs.rightArm.severed, false);
  assert.equal(actor.system.resources.demonisation, 2);
});
test("temporary flags restore zero after expiry instead of leaving a permanent stun", async () => {
  const actor = character();
  await applyEffectsList({ source: actor, target: actor, effects: [{ path: "system.combat.sourceStunned", mode: "set", value: 1, duration: "currentTurnEnd" }] });
  assert.equal(getConditionActionRestriction(actor, "technique").blocked, true);
  await purgeExpiredEffects({ when: "currentTurnEnd", actors: [actor] });
  assert.equal(getConditionActionRestriction(actor, "technique").blocked, false);
});
test("combat cleanup removes finite multi-round effects entirely", async () => {
  const actor = character(); await applyEffectsList({ source: actor, target: actor, effects: [{ path: "system.combat.sourceImmobilized", mode: "set", value: 1, duration: "custom:4" }] });
  await purgeExpiredEffects({ when: "combatEnd", actors: [actor] });
  assert.equal(actor.system.combat.sourceImmobilized, 0); assert.equal(actor.getFlag(NS, "effects").length, 0);
});
test("bear stance grants half actual hit damage as temporary HP", async () => {
  const actor = character(); await actor.update({ "system.combat.subclassStance": "bear" });
  await onSubclassWeaponHit(actor, character("demon"), 9); assert.equal(actor.system.resources.hp.temporary, 4);
});
test("morning star permanent armor penalty and water movement penalty prepare correctly", () => {
  const actor = character(); actor.system.resources.ca = 14; actor.system.class.subclass = "Étoile du Matin";
  actor.system.combat.subclassStance = "water"; actor.system.combat.actionEconomy.effectiveMovementMeters = 9;
  prepareSubclassPassives(actor); assert.equal(actor.system.resources.ca, 12); assert.equal(actor.system.combat.actionEconomy.effectiveMovementMeters, 6);
});
test("superhuman physical bonuses apply in combat and glycine progressively weakens Force and Dexterity", () => {
  const actor = character(); actor.items.push({ name: "Force physique accrue", system: { traitKey: "strength" } });
  assert.equal(getEffectiveBaseStats(actor).force, 4); game.combat = makeCombat([actor]); assert.equal(getEffectiveBaseStats(actor).force, 7);
  const runtime = resolvePoisonRuntime({ active: true, intensity: 1, profile: "glycineWeakening", stacks: { glycineWeakening: 1 }, elapsedTurns: 3 }, character("demon"));
  assert.equal(runtime.statPenalty.force, 3); assert.equal(runtime.derivedPenalty.dexterite, 3); assert.equal(runtime.statPenalty.finesse, 0);
});
test("medical help clears analgesic damage debt, without removing other temporary HP at expiry", async () => {
  const actor = character(); game.actors.contents = [actor]; await useMedicalItem(actor, item("Analgésiques", {}));
  await applyHpDamage(actor, 4); await useMedicalItem(actor, item("Bandage", { healing: "1" }));
  const hp = actor.system.resources.hp.value;
  await actor.update({ "system.resources.hp.temporary": actor.system.resources.hp.temporary + 3 });
  await fire("updateWorldTime", 3600, 3600, {}, gm.id);
  assert.equal(actor.system.resources.hp.value, hp); assert.equal(actor.system.resources.hp.temporary, 3);
});

test("simultaneous healing and damage preserve both operations and the wound cap", async () => {
  const actor = character(); await actor.update({ "system.resources.hp.healableMax": 12 });
  const [healing] = await Promise.all([restoreHp(actor, 9), applyHpDamage(actor, 4)]);
  assert.equal(healing.healed, 2); assert.equal(actor.system.resources.hp.value, 8);
  await Promise.all([restoreHp(actor, 1), restoreHp(actor, 1)]);
  assert.equal(actor.system.resources.hp.value, 10);
});
test("two clicks cannot consume or heal twice with a single remaining bandage", async () => {
  const actor = character(), bandage = item("Bandage", { quantity: 1, healing: "1" });
  const results = await Promise.all([useMedicalItem(actor, bandage), useMedicalItem(actor, bandage)]);
  assert.equal(actor.system.resources.hp.value, 13); assert.equal(bandage.system.quantity, 0);
  assert.equal(results.filter(v => v !== null).length, 1);
});
test("snacks do not heal, resurrect or remove conditions", async () => {
  const actor = character(); await actor.update({ "system.resources.hp.value": 0, "system.death.state": "dead" });
  await useMedicalItem(actor, item("Dango", { healing: "", enduranceGain: "", type: "food" }));
  assert.equal(actor.system.resources.hp.value, 0); assert.equal(actor.system.death.state, "dead");
});
test("vehicle bonuses apply only while that owned vehicle is being driven", async () => {
  const actor = character(); actor.items.push({ id: "car", system: { vehicleBonus: { all: 1, dexterite: 2 } } });
  assert.equal(drivingBonus(actor, "dexterite"), 0);
  await actor.setFlag(NS, "drivingVehicleId", "car");
  assert.equal(drivingBonus(actor, "dexterite"), 3); assert.equal(drivingBonus(actor, "finesse"), 1);
  await actor.unsetFlag(NS, "drivingVehicleId"); assert.equal(drivingBonus(actor, "dexterite"), 0);
});
test("Flame's fourth form remains usable for the round but never leaks into a new encounter", async () => {
  const actor = character(); game.combat = makeCombat([actor]);
  await actor.setFlag(NS, "deflectStance", { combatId: game.combat.id, round: game.combat.round, reflectAllRound: true });
  await consumeDeflectStance(actor); assert.ok(getDeflectStance(actor));
  game.combat.round++; assert.equal(getDeflectStance(actor), null);
  game.combat.round--; game.combat.id = "next-combat"; assert.equal(getDeflectStance(actor), null);
});
test("enveloping attacks apply disadvantage within nine meters and clear with the chosen rounds", async () => {
  const defender = character(), attacker = new MockActor("enemy", character().system);
  const first = tokenFor(defender), second = tokenFor(attacker); attacker.getActiveTokens = () => [second];
  canvas.tokens.placeables = [first,second]; second.center.x = 500;
  game.combat = makeCombat([defender,attacker]);
  await applyEffectsList({ source: defender, target: defender, effects: [{ path: "flags.breathe-and-live.envelopingAttack", mode: "set", value: 1, duration: "custom:1" }] });
  assert.equal(envelopingAttackPenalty(attacker), 1); second.center.x = 600; assert.equal(envelopingAttackPenalty(attacker), 0);
  second.center.x = 500; await purgeExpiredEffects({ when: "roundEnd", actors: [defender] });
  assert.equal(envelopingAttackPenalty(attacker), 0);
});
test("healing never damages an actor whose HP is already above a reduced healing cap", async () => {
  const actor = character(); await actor.update({ "system.resources.hp.healableMax": 8 });
  const result = await restoreHp(actor, 4); assert.equal(result.healed, 0); assert.equal(actor.system.resources.hp.value, 10);
});
test("antidotes with zero healing remove poison without adding the Medicine stat to HP", async () => {
  const actor = character(); await setConditionState(actor,"poisoned",{active:true,intensity:1});
  await useMedicalItem(actor,item("Antidote",{healing:"0",removeConditions:["poisoned"]}));
  assert.equal(actor.system.resources.hp.value,10); assert.equal(actor.system.conditions.poisoned.active,false);
});
test("physical combat traits do not boost actors absent from the active encounter", () => {
  const actor = character(); actor.items.push({name:"Force physique accrue",system:{traitKey:"strength"}});
  game.combat = makeCombat([new MockActor("other",character().system)]);
  assert.equal(getEffectiveBaseStats(actor).force,4);
});

test("demonist healing reaction uses the strongest recent flesh row (Rang élevé heals 2d10, not 1d10)", async () => {
  const actor = character("demonist");
  actor.system.support = { demonistHealingReaction: true, highestDemonFleshRank: "Rang eleve", recentDemonFleshRank: "Rang faible" };
  const healed = await runDemonistHealingReaction(actor, { maximize: true });
  assert.equal(healed, 20, "maximised 2d10");
  assert.equal(getDemonFleshRank("Demon élevé").flesh, "Rang eleve", "demon rank and flesh labels resolve to one row");
});
test("a long rest clears demonisation and the 'recently eaten' flesh rank", async () => {
  const actor = character("demonist");
  actor.system.resources.demonisation = 6;
  actor.system.support = { recentDemonFleshRank: "Lune inferieure", highestDemonFleshRank: "Lune inferieure" };
  await runRestRefresh(actor, { hours: 8 });
  assert.equal(actor.system.resources.demonisation, 0);
  assert.equal(actor.system.support.recentDemonFleshRank, "");
  assert.equal(actor.system.support.highestDemonFleshRank, "");
});
test("demons add half of Puissance/Finesse to blood art damage (p.112)", () => {
  const demon = character("npcDemon"); demon.system.stats.base.finesse = 8; demon.system.demonology = { halfDamageStatRule: true };
  assert.equal(buildFormulaWithActorStats("1d6 + Finesse", demon), "1d6 + 4");
  const human = character(); human.system.stats.base.finesse = 8;
  assert.equal(buildFormulaWithActorStats("1d6 + Finesse", human), "1d6 + 8", "humans unchanged");
});
test("continuous limb regeneration is listed as passive but can be switched on", async () => {
  const actor = character("demonist"); globalThis.Dialog = class { constructor(d) { this.d = d; } render() { this.d.buttons.apply.callback({ find: () => ({ val: () => "2" }) }); } };
  actor.system.combat.injuries = { limbs: { leftArm: { severed: true } } };
  const regen = { id: "r", name: "Regeneration continue des membres", type: "demonAbility", system: { activation: "passive", costBdp: 0 } };
  await useTechnique(actor, regen);
  assert.equal(actor.system.combat.regeneration?.active, true);
  assert.equal(actor.system.combat.regeneration?.continuous, true);
});

test("Bourreau kills a demon of 50 base HP or less on hit; stronger demons are untouched", async () => {
  const slayer = character(); slayer.system.progression = { bonuses: { executionHpBaseLimit: 50 } };
  const weak = character("npcDemon"); weak.system.resources.hp = { value: 30, max: 50 };
  assert.equal(await applyExecutionSkill(slayer, weak), true);
  assert.equal(weak.system.resources.hp.value, 0);
  const strong = character("npcDemon"); strong.system.resources.hp = { value: 30, max: 80 };
  assert.equal(await applyExecutionSkill(slayer, strong), false);
  assert.equal(strong.system.resources.hp.value, 30);
  assert.equal(await applyExecutionSkill(slayer, character()), false, "humans are never executed");
});
test("Tir en position stable immobilises the shooter until the shot", async () => {
  const actor = character("demonist");
  await actor.setFlag(NS, "stableShot", { attackBonus: 8 });
  assert.equal(getConditionActionRestriction(actor, "movement").blocked, true);
  assert.equal(getConditionActionRestriction(actor, "action").blocked, false);
});
test("an ally with 2 RP can pull a dodgeable target to safety; never against undodgeable attacks", () => {
  const target = character(), ally = character();
  const tTok = tokenFor(target, "t"), aTok = tokenFor(ally, "a");
  tTok.document = { disposition: 1 }; aTok.document = { disposition: 1 };
  ally.system.resources.rp.value = 2; canvas.tokens.placeables = [tTok, aTok];
  assert.match(sourceAllyReactionButtons(target, "t"), /bl-dodge-pull/);
  assert.doesNotMatch(sourceAllyReactionButtons(target, "t", { canDodge: false }), /bl-dodge-pull/);
  ally.system.resources.rp.value = 1;
  assert.doesNotMatch(sourceAllyReactionButtons(target, "t"), /bl-dodge-pull/);
});
