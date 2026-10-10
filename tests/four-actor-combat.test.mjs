import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { NS, fire, gm, documents, chatMessages, tokenFor, makeCombat, setProperty } from "./foundry-mocks.mjs";
import { rollBasicAttack, runWait, runSprint, runRecoveryBreath, runRestRefresh, runDemonHeal,
  runDemonistHealingReaction, useMedicalItem, setConditionState, setLimbState, queueDemonPendingEffect,
  runReloadWeapon, applyTargetedLimbDamage } from "../module/rules/action-engine.mjs";
import { applyEffectsList } from "../module/rules/effects-engine.mjs";
import { applyHpDamage } from "../module/rules/resource-costs.mjs";
import { lockRedBladeHealing } from "../module/rules/combat-state.mjs";
import { startRegeneration } from "../module/rules/regeneration.mjs";
import { startTechniqueCharge, isTechniqueChargeReady, getTechniqueChargeState, noteActorDamageTaken } from "../module/rules/technique-utils.mjs";
import { executeCardRequest, enqueueCardAction } from "../module/chat/persistent-cards.mjs";
import { useTechnique } from "../module/chat/use-technique.mjs";
await import("../module/breathe-and-live.mjs");
await fire("init");

// Predictable dice retain the actual formula, including bonuses, penalties and multipliers.
class SimulationRoll {
  constructor(formula) { this.formula = formula; }
  async evaluate({ maximize = false } = {}) {
    const expression = this.formula.replace(/(\d+)d(\d+)(kh|kl)?/gi, (_, count, faces, keep) => {
      const value = maximize || Number(faces) === 20 ? Number(faces) : Math.ceil(Number(faces) / 2);
      return String(value * (keep ? 1 : Number(count)));
    });
    assert.match(expression, /^[\d\s.+\-*/()]+$/, `Unsupported simulation formula: ${this.formula}`);
    this.total = Function(`"use strict"; return (${expression});`)();
    return this;
  }
  async toMessage(data) { return ChatMessage.create({ ...data, total: this.total }); }
}
const pack = name => fs.readFileSync(new URL(`../packs/${name}.db`, import.meta.url), "utf8").trim().split("\n").map(JSON.parse);
function equip(actor, data) {
  const item = { ...structuredClone(data), id: data._id, uuid: `${actor.uuid}.Item.${data._id}`, actor,
    async update(patch) { for (const [key, value] of Object.entries(patch)) setProperty(this, key, value); return this; } };
  actor.items.push(item); documents.set(item.uuid, item); return item;
}
function actorFrom(packName, index) {
  const data = pack(packName)[index];
  const actor = new CONFIG.Actor.documentClass(data._id, data.system, data.type);
  actor.name = data.name;
  actor.items.contents = actor.items;
  actor.items.get = id => actor.items.find(item => item.id === id);
  for (const item of data.items) equip(actor, item);
  actor.refresh();
  const token = tokenFor(actor);
  token.document = { disposition: actor.type === "demon" ? -1 : 1, hidden: false };
  actor.getActiveTokens = () => [token];
  return actor;
}
let team;
beforeEach(async () => {
  globalThis.Roll = SimulationRoll;
  globalThis.Dialog = class {
    constructor(options) { this.options = options; }
    render() { const buttons = this.options.buttons; (buttons.no ?? buttons.cancel)?.callback?.($('<div>')); return this; }
    static async confirm() { return false; }
  };
  game.user = gm; game.users.activeGM = gm; game.user.targets = new Set();
  game.combat = null; game.time = { worldTime: 0 };
  game.messages.clear(); documents.clear(); canvas.tokens.clear(); chatMessages.length = 0;
  ui.notifications.info = () => {};
  team = [actorFrom("actors-slayers", 0), actorFrom("actors-slayers", 2), actorFrom("actors-demonists", 1), actorFrom("actors-demons", 3)];
  game.actors.contents = team; canvas.tokens.placeables = team.map(actor => actor.getActiveTokens()[0]);
  game.combat = makeCombat(team); game.combat.round = 1;
  game.combat.previous = { round: 0, turn: null };
  for (const actor of team) await actor.update({ "system.resources.hp.value": actor.system.resources.hp.max,
    ...(actor.system.resources.e ? { "system.resources.e.value": actor.system.resources.e.max } : {}), "system.resources.rp.value": actor.system.resources.rp.max,
    ...(actor.system.resources.bdp ? { "system.resources.bdp.value": actor.system.resources.bdp.max } : {}) });
  await fire("updateCombat", game.combat, { round: 1 }, {}, gm.id);
});
async function advance() {
  const combat = game.combat;
  combat.previous = { round: combat.round, turn: combat.turn, combatantId: combat.combatant.id };
  combat.turn = (combat.turn + 1) % team.length;
  const change = { turn: combat.turn };
  if (combat.turn === 0) change.round = ++combat.round;
  combat.combatant = combat.turns[combat.turn];
  await fire("updateCombat", combat, change, {}, gm.id);
}
async function resolveCard(data, selector, { repeat = false } = {}) {
  const id = `simulation-${game.messages.size}`;
  const message = { ...data, id, getFlag: (namespace, key) => data.flags?.[namespace]?.[key],
    async update(patch) { Object.assign(this, patch); } };
  game.messages.set(id, message);
  const html = $("<div>").html(message.flavor ?? message.content);
  const buttonIndex = html.find(".bl-card button").index(html.find(selector).first());
  assert.ok(buttonIndex >= 0, `Missing card action ${selector}`);
  await enqueueCardAction(id, () => executeCardRequest({ messageId: id, buttonIndex, userId: gm.id }));
  if (repeat) await enqueueCardAction(id, () => executeCardRequest({ messageId: id, buttonIndex, userId: gm.id }));
  return message;
}

test("four compendium actors: melee, breath auto-hit/dodge, firearm ammo, delayed damage, medicine, regrowth and rest", async () => {
  const [flame, water, shooter, demon] = team;
  const targetToken = demon.getActiveTokens()[0];
  const hp = demon.system.resources.hp.value;
  await applyEffectsList({ target: demon, effects: [{ path: "system.resources.ca", value: -2, duration: "roundEnd" }] });
  assert.equal(demon.system.resources.ca, 10 + demon.system.stats.base.vitesse - 2);
  const melee = await rollBasicAttack(flame, { item: flame.items.find(i => i.type === "weapon"), targetToken, attackMode: "force", targetLimb: "" });
  assert.equal(melee.hit, true);
  assert.equal(demon.system.resources.hp.value, hp, "damage waits for defender resolution");
  await resolveCard(melee.chatMessage, ".bl-takedmg", { repeat: true });
  assert.equal(demon.system.resources.hp.value, hp - melee.damageRoll.total);
  await advance();
  game.user.targets = new Set([targetToken]);
  const form = water.items.find(i => i.type === "technique");
  const oldE = water.system.resources.e.value;
  const rp = demon.system.resources.rp.value, beforeBreath = demon.system.resources.hp.value;
  await useTechnique(water, form, { controlledToken: water.getActiveTokens()[0] });
  assert.ok(water.system.resources.e.value < oldE);
  const breathCard = chatMessages.findLast(m => m.flags?.[NS]?.card?.kind === "technique");
  assert.ok(breathCard, "breath publishes a persistent reaction card");
  await resolveCard(breathCard, ".bl-dodge");
  assert.equal(demon.system.resources.rp.value, rp - 1);
  assert.equal(demon.system.resources.hp.value, beforeBreath);
  await advance();
  const gun = shooter.items.find(i => i.type === "firearm");
  const ammunition = gun.system.ammo.value;
  const shot = await rollBasicAttack(shooter, { item: gun, targetToken, targetLimb: "" });
  assert.equal(shot.hit, true);
  assert.equal(gun.system.ammo.value, ammunition - 1);
  await resolveCard(shot.chatMessage, ".bl-takedmg");
  await setConditionState(water, "bleed", { active: true, duration: 2 });
  const bandage = water.items.find(i => i.type === "medical");
  const doses = bandage.system.quantity;
  await shooter.update({ "system.support.medicalTraining": true, "system.resources.rp.value": 4 });
  await applyHpDamage(water, 10);
  const wounded = water.system.resources.hp.value;
  const medicine = await useMedicalItem(shooter, bandage, { targetActor: water, reaction: true, maximize: true });
  assert.equal(water.system.resources.hp.value, wounded + medicine);
  assert.equal(shooter.system.resources.rp.value, 2);
  assert.equal(bandage.system.quantity, doses - 1);
  await queueDemonPendingEffect(water, { formula: "4", delayedRounds: 1, sourceName: demon.name, label: "QA delayed hit" });
  await setLimbState(demon, "leftArm", { severed: true });
  await startRegeneration(demon, { limbs: ["leftArm"], turns: 2 });
  await advance();
  assert.equal(demon.system.combat.injuries.limbs.leftArm.severed, true);
  await advance();
  assert.equal(demon.system.resources.ca, 10 + demon.system.stats.base.vitesse);
  const beforeDelay = water.system.resources.hp.value;
  await advance();
  assert.ok(water.system.resources.hp.value <= beforeDelay - 4);
  assert.equal(water.getFlag(NS, "pendingDemonEffects").length, 0);
  await advance(); await advance();
  assert.equal(demon.system.combat.injuries.limbs.leftArm.severed, false);
  await fire("deleteCombat", game.combat, {}, gm.id); game.combat = null;
  for (const actor of team) {
    const spentRp = actor.system.resources.rp.value;
    await runRestRefresh(actor, { full: false, hours: 1 });
    assert.equal(actor.system.resources.rp.value, spentRp);
    await runRestRefresh(actor, { full: true, hours: 8 });
    assert.equal(actor.system.resources.rp.value, actor.system.resources.rp.max);
  }
});

test("waiting cannot be declared outside your turn to bypass initiative", async () => {
  const [, water] = team;
  assert.equal(await runWait(water), null);
  assert.equal(!!water.system.combat.actionEconomy.waiting, false);
  await advance();
  const actions = water.system.combat.actionEconomy.remainingActions;
  assert.equal(await runWait(water), true);
  await advance();
  assert.ok(await runSprint(water));
  assert.equal(water.system.combat.actionEconomy.remainingActions, actions - 1);
});

test("controlled actors cannot bypass action restrictions through recovery or medicine", async () => {
  const [flame] = team;
  await setConditionState(flame, "controlled", { active: true });
  const actions = flame.system.combat.actionEconomy.remainingActions;
  assert.equal(await runRecoveryBreath(flame), null);
  assert.equal(flame.system.combat.actionEconomy.remainingActions, actions);
  const medicine = flame.items.find(item => item.type === "medical");
  const doses = medicine.system.quantity;
  assert.equal(await useMedicalItem(flame, medicine), null);
  assert.equal(medicine.system.quantity, doses);
  assert.equal(flame.system.combat.actionEconomy.remainingActions, actions);
});

test("healing reactions respect Red Blade and never lower HP above a wound cap", async () => {
  const [, , shooter] = team;
  await shooter.update({ "system.support.demonistHealingReaction": true, "system.support.highestDemonFleshRank": "Demon faible" });
  await lockRedBladeHealing(shooter);
  const rp = shooter.system.resources.rp.value;
  assert.equal(await runDemonistHealingReaction(shooter), null);
  assert.equal(shooter.system.resources.rp.value, rp);
  await advance();
  await shooter.update({ "system.combat.injuries.severeWounds": 2 });
  const hp = shooter.system.resources.hp.value;
  assert.ok(hp > shooter.system.resources.hp.healableMax);
  assert.equal(await runDemonistHealingReaction(shooter), 0);
  assert.equal(shooter.system.resources.hp.value, hp);
  game.combat = null;
  await runRestRefresh(shooter);
  assert.equal(shooter.system.resources.hp.value, hp);
});

test("concurrent demon healing and damage preserve both results", async () => {
  const demon = team[3];
  while (game.combat.turn !== 3) await advance();
  await demon.update({ "system.resources.hp.value": 20 });
  await Promise.all([runDemonHeal(demon), applyHpDamage(demon, 7)]);
  assert.equal(demon.system.resources.hp.value, 23, "2d10 deterministic healing adds 10 and incoming damage subtracts 7");
});

test("charged weapons require the next round and taking damage interrupts the charge", async () => {
  const [flame] = team;
  const weapon = flame.items.find(i => i.type === "weapon");
  await startTechniqueCharge(flame, weapon, 1);
  assert.equal(isTechniqueChargeReady(await getTechniqueChargeState(flame)), false);
  await advance(); await advance(); await advance(); await advance();
  assert.equal(isTechniqueChargeReady(await getTechniqueChargeState(flame)), true);
  await noteActorDamageTaken(flame, 1);
  assert.equal(await getTechniqueChargeState(flame), null);
});

test("rest is unavailable during a fight and invalid durations do not refresh resources", async () => {
  const [flame] = team;
  await flame.update({ "system.resources.e.value": 1, "system.resources.rp.value": 1 });
  assert.equal(await runRestRefresh(flame), null);
  assert.equal(flame.system.resources.e.value, 1);
  assert.equal(flame.system.resources.rp.value, 1);
  game.combat = null;
  for (const hours of [0, -1, Infinity, NaN]) assert.equal(await runRestRefresh(flame, { hours }), null);
  assert.equal(flame.system.resources.e.value, 1);
  await flame.update({ "system.resources.hp.value": 0, "system.death.state": "dead" });
  assert.equal(await runRestRefresh(flame), null);
  assert.equal(flame.system.resources.hp.value, 0);
  assert.equal(flame.system.death.state, "dead");
});

test("empty guns spend no action, and reloading draws only the available reserve", async () => {
  const shooter = team[2], demon = team[3];
  await advance(); await advance();
  const gun = shooter.items.find(i => i.type === "firearm");
  await gun.update({ "system.ammo.value": 0 });
  const actions = shooter.system.combat.actionEconomy.remainingActions;
  assert.equal(await rollBasicAttack(shooter, { item: gun, targetToken: demon.getActiveTokens()[0], targetLimb: "" }), null);
  assert.equal(shooter.system.combat.actionEconomy.remainingActions, actions);
  const reserve = equip(shooter, { _id: "qa-reserve", name: "QA ammunition", type: "ammunition", system: { quantity: 2 } });
  await gun.update({ "system.ammunitionId": reserve.id });
  assert.equal(await runReloadWeapon(shooter, gun), 2);
  assert.equal(reserve.system.quantity, 0);
  assert.equal(gun.system.ammo.value, 2);
  assert.equal(shooter.system.combat.actionEconomy.remainingActions, actions - 1);
});

test("human limb damage accumulates; demon limbs require the threshold in one hit", async () => {
  const human = team[1], demon = team[3];
  for (const actor of [human, demon]) {
    const threshold = Math.ceil(actor.system.resources.hp.max * 0.2);
    const part = Math.ceil(threshold / 2);
    await applyTargetedLimbDamage(actor, "leftLeg", part);
    assert.equal(!!actor.system.combat.injuries.limbs.leftLeg.severed, false);
    await applyTargetedLimbDamage(actor, "leftLeg", part);
    assert.equal(!!actor.system.combat.injuries.limbs.leftLeg.severed, actor === human);
    await applyTargetedLimbDamage(actor, "leftLeg", threshold);
    assert.equal(actor.system.combat.injuries.limbs.leftLeg.severed, true);
    assert.equal(actor.system.combat.actionEconomy.effectiveMovementMeters, actor.system.combat.actionEconomy.movementMeters / 2);
  }
});

test("Demonist healing ability uses the same wound cap and resource-safe healing as reactions", async () => {
  const shooter = team[2];
  await advance(); await advance();
  await shooter.update({ "system.support.recentDemonFleshRank": "Demon faible", "system.combat.injuries.severeWounds": 2 });
  const hp = shooter.system.resources.hp.value;
  await useTechnique(shooter, shooter.items.find(i => i.name === "Soin demoniaque"), { controlledToken: shooter.getActiveTokens()[0] });
  assert.equal(shooter.system.resources.hp.value, hp);
});
