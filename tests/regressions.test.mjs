import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  NS, MockActor, fire, gm, player, observer, documents, sockets, emitted,
  chatMessages, tokenFor, makeCombat,
} from "./foundry-mocks.mjs";
import { spendResourceCosts } from "../module/rules/resource-costs.mjs";
import { isAutomationAuthority } from "../module/rules/automation-authority.mjs";
import { applyEffectsList, purgeExpiredEffects, registerEffectHooks } from "../module/rules/effects-engine.mjs";
import { registerActionHooks } from "../module/rules/action-engine.mjs";
import { useTechnique } from "../module/chat/use-technique.mjs";
import { cardFlags, registerPersistentCardHooks, executeCardRequest, enqueueCardAction } from "../module/chat/persistent-cards.mjs";
await import("../module/breathe-and-live.mjs");
await fire("setup");
registerEffectHooks();
registerActionHooks();
registerPersistentCardHooks();

beforeEach(() => {
  game.user = gm;
  game.users.activeGM = gm;
  game.combat = null;
  game.actors.contents = [];
  game.messages.clear();
  canvas.tokens.clear();
  canvas.scene.id = "scene";
  documents.clear();
  emitted.length = 0;
  chatMessages.length = 0;
});

const resources = () => ({ resources: { e: { value: 10 }, rp: { value: 2 }, bdp: { value: 1 }, hp: { value: 20 } } });
const costs = [
  { path: "system.resources.e.value", cost: 4, label: "E" },
  { path: "system.resources.rp.value", cost: 1, label: "RP" },
  { path: "system.resources.bdp.value", cost: 2, label: "BDP" },
];

test("insufficient BDP does not consume E or RP", async () => {
  const actor = new MockActor("payer", resources());
  assert.equal(await spendResourceCosts(actor, costs), null);
  assert.deepEqual(actor.system, resources());
  assert.equal(actor.updates.length, 0);
});

test("insufficient RP leaves every resource untouched", async () => {
  const actor = new MockActor("payer", resources());
  assert.equal(await spendResourceCosts(actor, [costs[0], { ...costs[1], cost: 3 }]), null);
  assert.equal(actor.updates.length, 0);
});

test("successful costs use one update and reject negative costs", async () => {
  const actor = new MockActor("payer", resources());
  assert.deepEqual(await spendResourceCosts(actor, costs.slice(0, 2)), ["E -4", "RP -1"]);
  assert.equal(actor.updates.length, 1);
  assert.equal(actor.system.resources.e.value, 6);
  assert.equal(actor.system.resources.rp.value, 1);
  assert.equal(await spendResourceCosts(actor, [{ ...costs[0], cost: -5 }]), null);
  assert.equal(actor.system.resources.e.value, 6);
});

test("actual summon technique aborts without partial spending", async () => {
  const actor = new MockActor("summoner", resources(), "demon");
  const token = tokenFor(actor);
  const item = { id: "summon", name: "Invocation", type: "demonAbility", system: {
    costE: 4, costRp: 1, costBdp: 2, automation: { summonFormula: "1d4" },
  } };
  await useTechnique(actor, item, { controlledToken: token });
  assert.deepEqual(actor.system, resources());
  assert.equal(actor.updates.length, 0);
  assert.equal(chatMessages.length, 0);
});

test("one writer is elected, with initiating user fallback when no GM is active", () => {
  for (const user of [gm, player, observer]) {
    game.user = user;
    assert.equal(isAutomationAuthority(player.id), user === gm);
  }
  game.users.activeGM = null;
  game.user = player;
  assert.equal(isAutomationAuthority(player.id), true);
  game.user = observer;
  assert.equal(isAutomationAuthority(player.id), false);
});

test("condition damage and TCB recovery occur once across three clients", async () => {
  const actor = new MockActor("burning", { ...resources(), conditions: { burn: { active: true } }, states: { tcbPermanent: true } });
  actor._source.system.resources.e.max = 20;
  actor.refresh();
  const combat = makeCombat([actor]);
  game.combat = combat;
  for (const user of [gm, player, observer]) {
    game.user = user;
    await fire("updateCombat", combat, { round: 2 }, {}, player.id);
  }
  assert.equal(actor.system.resources.hp.value, 19);
  assert.equal(actor.system.resources.e.value, 11);
  assert.equal(chatMessages.length, 1);
});

test("world time decay runs once and preserves fractional-hour carry", async () => {
  const actor = new MockActor("demonist", { resources: { demonisation: 10 } }, "demonist");
  game.actors.contents = [actor];
  for (const user of [gm, player, observer]) {
    game.user = user;
    await fire("updateWorldTime", 5400, 5400, {}, player.id);
  }
  assert.equal(actor.system.resources.demonisation, 8);
  assert.equal(actor.getFlag(NS, "demonisationDecaySeconds"), 1800);
});

test("effect expiry reaches independent unlinked tokens sharing a base actor id", async () => {
  const unrelated = new MockActor("base", { value: 10 });
  const first = new MockActor("base", { value: 10 });
  const second = new MockActor("base", { value: 20 });
  game.actors.contents = [unrelated];
  for (const actor of [unrelated, first, second]) {
    await applyEffectsList({ target: actor, effects: [{ path: "system.value", value: 2, duration: "roundEnd" }] });
  }
  const combat = makeCombat([first, second]);
  // Run only effect expiration directly: no condition resource data needed.
  await purgeExpiredEffects({ when: "roundEnd", actors: combat.combatants.map(entry => entry.actor) });
  assert.equal(unrelated.system.value, 12);
  assert.equal(first.system.value, 10);
  assert.equal(second.system.value, 20);
  assert.equal(first.getFlag(NS, "effects").length, 0);
});

test("turnEnd expires on the outgoing combatant only; round counters persist", async () => {
  const first = new MockActor("first", resources());
  const second = new MockActor("second", resources());
  for (const actor of [first, second]) {
    await applyEffectsList({ target: actor, effects: [{ path: "system.bonus", mode: "set", value: 2, duration: "turnEnd" }] });
  }
  await applyEffectsList({ target: second, effects: [{ path: "system.custom", mode: "set", value: 3, duration: "custom:3" }] });
  const combat = makeCombat([first, second]);
  combat.previous = { round: 1, turn: 0, combatantId: "c0" };
  combat.round = 1; combat.turn = 1; combat.combatant = combat.combatants[1];
  await fire("updateCombat", combat, { turn: 1 }, {}, gm.id);
  assert.equal(first.getFlag(NS, "effects").length, 0);
  assert.equal(second.getFlag(NS, "effects").length, 2);
  await purgeExpiredEffects({ when: "roundEnd", actors: [second] });
  assert.equal(second._source.flags[NS].effects[1].duration, "custom:2");
  second.refresh();
  await purgeExpiredEffects({ when: "roundEnd", actors: [second] });
  assert.equal(second.getFlag(NS, "effects")[1].duration, "custom:1");
  await purgeExpiredEffects({ when: "roundEnd", actors: [second] });
  assert.equal(second.getFlag(NS, "effects").length, 1);
});

test("starting or rewinding combat does not expire round effects", async () => {
  const actor = new MockActor("target", resources());
  await applyEffectsList({ target: actor, effects: [{ path: "system.bonus", mode: "set", value: 2, duration: "roundEnd" }] });
  const combat = makeCombat([actor]);
  combat.previous.round = 0; combat.round = 1;
  await fire("updateCombat", combat, { round: 1 }, {}, gm.id);
  assert.equal(actor.getFlag(NS, "effects").length, 1);
  combat.previous.round = 2;
  await fire("updateCombat", combat, { round: 1 }, {}, gm.id);
  assert.equal(actor.getFlag(NS, "effects").length, 1);
});

test("real actor preparation retains AC penalties, adapts to speed changes, and restores current AC", async () => {
  const actor = new CONFIG.Actor.documentClass("slayer", { stats: { base: { vitesse: 5 } } });
  assert.equal(actor.system.resources.ca, 15);
  await applyEffectsList({ target: actor, effects: [{ path: "system.resources.ca", value: -3, duration: "roundEnd" }] });
  assert.equal(actor.system.resources.ca, 12);
  await actor.update({ "system.stats.base.vitesse": 7 });
  assert.equal(actor.system.resources.ca, 14);
  actor.refresh();
  assert.equal(actor.system.resources.ca, 14);
  await purgeExpiredEffects({ when: "roundEnd", actors: [actor] });
  assert.equal(actor.system.resources.ca, 17);
  assert.equal(actor._source.system.resources?.ca, undefined);
});

test("AC supports stacked add/multiply/set, including a zero multiplier", async () => {
  const actor = new CONFIG.Actor.documentClass("slayer", { stats: { base: { vitesse: 5 } } });
  await applyEffectsList({ target: actor, effects: [
    { path: "system.resources.ca", value: -2, duration: "roundEnd" },
    { path: "system.resources.ca", value: 2, mode: "mul", duration: "turnEnd" },
  ] });
  assert.equal(actor.system.resources.ca, 26);
  await purgeExpiredEffects({ when: "turnEnd", actors: [actor] });
  assert.equal(actor.system.resources.ca, 13);
  await applyEffectsList({ target: actor, effects: [{ path: "system.resources.ca", value: 0, mode: "mul", duration: "turnEnd" }] });
  assert.equal(actor.system.resources.ca, 0);
  await applyEffectsList({ target: actor, effects: [{ path: "system.resources.ca", value: 8, mode: "set", duration: "roundEnd" }] });
  assert.equal(actor.system.resources.ca, 8);
});

function attackMessage(kind = "basicAttack") {
  const attacker = new MockActor("attacker", resources());
  const defender = new MockActor("defender", resources());
  tokenFor(attacker); tokenFor(defender);
  const item = { uuid: "Actor.attacker.Item.technique", id: "technique", name: "Technique", system: {} };
  documents.set(item.uuid, item);
  const flags = cardFlags(kind, {
    actorUuid: attacker.uuid, itemUuid: item.uuid, attackerTokenId: attacker.id,
    firstTargetId: defender.id, context: {}, sceneId: "scene", damageTotal: 5,
  });
  const message = {
    id: "message", author: player, flags,
    flavor: '<div class="bl-card"><div class="bl-target-row" data-target-token="defender"><button class="bl-dodge" data-target-token="defender">Dodge</button><button class="bl-takedmg" data-target-token="defender" data-damage="5">Damage</button><div class="bl-target-result"></div></div></div>',
    getFlag: (namespace, key) => flags[namespace]?.[key],
    async update(update) { Object.assign(this, structuredClone(update)); },
  };
  game.messages.set(message.id, message);
  return { message, attacker, defender };
}

test("defender receives a working persistent listener on initial render and reload", async () => {
  const { message, defender } = attackMessage();
  game.user = player;
  for (let render = 0; render < 2; render++) {
    const html = $("<div>").html(message.flavor);
    await fire("renderChatMessage", message, html);
    html.find(".bl-dodge").trigger("click");
    assert.equal(emitted.length, render + 1);
  }
  game.user = gm;
  const requests = emitted.map(entry => entry.payload);
  await Promise.all(requests.map(request => enqueueCardAction(message.id, () => executeCardRequest(request))));
  assert.equal(defender.system.resources.rp.value, 1);
  const reloaded = $("<div>").html(message.flavor);
  assert.equal(reloaded.find("button:disabled").length, 2);
  assert.match(reloaded.find(".bl-target-result").text(), /Esquive reussie/);
});

test("basic damage can only resolve once, even for simultaneous requests", async () => {
  const { message, defender } = attackMessage();
  const request = { messageId: message.id, userId: player.id, buttonIndex: 1 };
  await Promise.all([1, 2].map(() => enqueueCardAction(message.id, () => executeCardRequest(request))));
  assert.equal(defender.system.resources.hp.value, 15);
  assert.match(message.flavor, /PV 20 -&gt; 15/);
});

test("technique context can be reconstructed on another client for damage and dodge", async () => {
  let fixture = attackMessage("technique");
  await executeCardRequest({ messageId: fixture.message.id, userId: player.id, buttonIndex: 1 });
  assert.equal(fixture.defender.system.resources.hp.value, 15);
  fixture = attackMessage("technique");
  await executeCardRequest({ messageId: fixture.message.id, userId: player.id, buttonIndex: 0 });
  assert.equal(fixture.defender.system.resources.rp.value, 1);
  assert.equal(fixture.defender.system.resources.hp.value, 20);
});

test("unowned target requests are rejected; non-authority clients do not execute requests", async () => {
  const { message, defender } = attackMessage();
  await executeCardRequest({ messageId: message.id, userId: observer.id, buttonIndex: 1 });
  assert.equal(defender.system.resources.hp.value, 20);
  game.user = player;
  await executeCardRequest({ messageId: message.id, userId: player.id, buttonIndex: 1 });
  assert.equal(defender.system.resources.hp.value, 20);
  assert.ok(sockets.has(`system.${NS}`));
});

test("missing technique context fails without spending the defender's resources", async () => {
  const { message, defender } = attackMessage("technique");
  documents.delete("Actor.attacker.Item.technique");
  await assert.rejects(executeCardRequest({ messageId: message.id, userId: player.id, buttonIndex: 0 }), /introuvable/);
  assert.equal(defender.system.resources.rp.value, 2);
});

test("socket delivery executes only on the authority and persists the result", async () => {
  const { message, defender } = attackMessage();
  const callback = sockets.get(`system.${NS}`);
  const request = { type: "cardAction", messageId: message.id, userId: player.id, buttonIndex: 1 };
  for (const user of [player, observer, gm]) {
    game.user = user;
    await callback(request);
  }
  assert.equal(defender.system.resources.hp.value, 15);
  assert.equal($("<div>").html(message.flavor).find("button:disabled").length, 2);
});

test("insufficient reaction points keep the card actionable without damage", async () => {
  const { message, defender } = attackMessage();
  await defender.update({ "system.resources.rp.value": 0 });
  await executeCardRequest({ messageId: message.id, userId: player.id, buttonIndex: 0 });
  assert.equal(defender.system.resources.hp.value, 20);
  assert.equal($("<div>").html(message.flavor).find("button:disabled").length, 0);
});

test("scene mismatch reports an error without spending resources", async () => {
  const { message, defender } = attackMessage();
  canvas.scene.id = "different-scene";
  await assert.rejects(executeCardRequest({ messageId: message.id, userId: player.id, buttonIndex: 0 }), /scene/);
  assert.equal(defender.system.resources.rp.value, 2);
});

test("combat metadata edits do not tick an outstanding outgoing-turn effect", async () => {
  const actor = new MockActor("actor", resources());
  await applyEffectsList({ target: actor, effects: [{ path: "system.bonus", mode: "set", value: 2, duration: "turnEnd" }] });
  const combat = makeCombat([actor]);
  await fire("updateCombat", combat, { name: "Renamed" }, {}, gm.id);
  assert.equal(actor.getFlag(NS, "effects").length, 1);
});
