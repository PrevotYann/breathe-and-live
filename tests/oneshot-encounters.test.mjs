// Encounter tests for "Les Lanternes de Hotaru": full fights driven through the real engine,
// plus regressions found while balancing them (charge leaks, burn vs charge, multi-target arts).
import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";
import { NS, fire, gm, chatMessages } from "./foundry-mocks.mjs";
import { simulateOneShot, resetWorld, makeActor, fillResources, Encounter, resolveCard, seed, IDS, PREGENS } from "./oneshot-simulator.mjs";
import { useTechnique } from "../module/chat/use-technique.mjs";
import { getTechniqueChargeState, startTechniqueCharge, setTechniqueCooldown, getTechniqueCooldown, noteActorDamageTaken } from "../module/rules/technique-utils.mjs";
import { setConditionState, rollBasicAttack, processConditionTurnStart } from "../module/rules/action-engine.mjs";

/** Every d20 rolls 20 and every damage die its average, so hits are certain and totals predictable. */
class CertainRoll {
  constructor(formula) { this.formula = String(formula); }
  async evaluate({ maximize = false } = {}) {
    const expression = this.formula.replace(/(\d*)d(\d+)(kh|kl)?/gi, (_, count, faces, keep) => {
      const value = maximize || Number(faces) === 20 ? Number(faces) : Math.ceil(Number(faces) / 2);
      return String(value * (keep ? 1 : Number(count || 1)));
    });
    this.total = Math.floor(Function(`"use strict"; return (${expression});`)());
    return this;
  }
  async toMessage(data) { return ChatMessage.create({ ...data, total: this.total }); }
}

async function fight(pcIds, demonIds) {
  const pcs = pcIds.map(id => makeActor(id));
  const demons = demonIds.map((id, index) => makeActor(id, { suffix: `t${index}` }));
  for (const actor of [...pcs, ...demons]) await fillResources(actor);
  const encounter = new Encounter({ pcs, demons });
  await encounter.start();
  return { encounter, pcs, demons };
}

beforeEach(() => { seed(42); resetWorld(); });

test("both one-shot fights run through the engine without errors and the pregens win", async () => {
  const runs = [];
  for (let index = 1; index <= 8; index++) runs.push(await simulateOneShot(index * 7919));
  for (const run of runs) {
    assert.equal(run.act2, "victory");
    assert.equal(run.act3, "victory");
    assert.deepEqual([...(run.act2Stats.errors ?? []), ...(run.act3Stats.errors ?? [])], []);
    assert.ok(run.act3Pcs.every(pc => pc.hp > 0), "nobody dies against Tomoshibi with the five pregens");
  }
  const average = key => runs.reduce((sum, run) => sum + run[key].rounds, 0) / runs.length;
  assert.ok(average("act2Stats") >= 2, "the bridge fight lasts long enough to teach the rules");
  assert.ok(average("act3Stats") >= 3, "Tomoshibi survives long enough to play his round-by-round plan");
});

test("a three-player table still wins the full adventure", async () => {
  for (let index = 1; index <= 4; index++) {
    const run = await simulateOneShot(index * 104729, { party: PREGENS.slice(0, 3) });
    assert.equal(run.act2, "victory");
    assert.equal(run.act3, "victory");
  }
});

test("a technique charged or on cooldown in one fight does not block the next fight", async () => {
  const { pcs: [kenta] } = await fight([IDS.kenta], [IDS.prowler]);
  const thunder = kenta.items.find(item => item.name === "Coup de tonnerre et éclair");
  await startTechniqueCharge(kenta, thunder, 1);
  await setTechniqueCooldown(kenta, thunder, 3);
  assert.ok(await getTechniqueChargeState(kenta));
  assert.ok(getTechniqueCooldown(kenta, thunder) > 0);
  await fire("deleteCombat", game.combat, {}, gm.id);
  assert.equal(kenta.getFlag(NS, "techniqueCharge"), undefined, "combat end clears the charge");
  assert.equal(kenta.getFlag(NS, "techniqueCooldowns"), undefined, "combat end clears cooldowns");

  // State saved before this fix (no cleanup) is ignored once another combat is running.
  await kenta.setFlag(NS, "techniqueCharge", { itemId: thunder.id, itemName: thunder.name, readyRound: 2, combatId: "old-fight" });
  await kenta.setFlag(NS, "techniqueCooldowns", { [thunder.id]: 9, combatId: "old-fight" });
  const next = new Encounter({ pcs: [kenta], demons: [makeActor(IDS.prowler, { suffix: "n" })] });
  await next.start();
  assert.equal(await getTechniqueChargeState(kenta), null);
  assert.equal(getTechniqueCooldown(kenta, thunder), 0);
  const beforeE = kenta.system.resources.e.value;
  game.user.targets = new Set([next.demons[0].getActiveTokens()[0]]);
  while (game.combat.combatant.actor !== kenta) await next.advance();
  await useTechnique(kenta, thunder, { controlledToken: kenta.getActiveTokens()[0] });
  assert.equal((await getTechniqueChargeState(kenta))?.itemId, thunder.id, "a fresh charge starts in the new fight");
  assert.equal(kenta.system.resources.e.value, beforeE, "Endurance is only spent when the charged form is released");
});

test("burn damage does not interrupt a charge; being attacked does", async () => {
  const { pcs: [kenta] } = await fight([IDS.kenta], [IDS.tomoshibi]);
  const thunder = kenta.items.find(item => item.name === "Coup de tonnerre et éclair");
  await startTechniqueCharge(kenta, thunder, 1);
  await setConditionState(kenta, "burn", { active: true, intensity: 1, duration: 3 });
  const hp = kenta.system.resources.hp.value;
  await processConditionTurnStart(kenta);
  assert.equal(kenta.system.resources.hp.value, hp - 1, "the burn still deals its damage");
  assert.ok(await getTechniqueChargeState(kenta), "\"Être attaqué interrompt la charge\": a burn tick is not an attack");
  await noteActorDamageTaken(kenta, 3);
  assert.equal(await getTechniqueChargeState(kenta), null, "damage from an attack interrupts the charge");
});

test("Feu follet bleu hits up to three targeted slayers, each defends separately, and its burn ends", async () => {
  globalThis.Roll = CertainRoll;
  const { encounter, pcs, demons: [boss] } = await fight(PREGENS.slice(0, 4), [IDS.tomoshibi]);
  while (game.combat.combatant.actor !== boss) await encounter.advance();
  const art = boss.items.find(item => item.name.includes("Feu follet"));
  const bdp = boss.system.resources.bdp.value;
  game.user.targets = new Set(pcs.map(pc => pc.getActiveTokens()[0]));
  await useTechnique(boss, art, { controlledToken: boss.getActiveTokens()[0] });
  assert.equal(boss.system.resources.bdp.value, bdp - 4);
  const card = chatMessages.findLast(message => message.flags?.[NS]?.card?.kind === "technique");
  const rows = $("<div>").html(card.flavor ?? card.content).find(".bl-target-row");
  assert.equal(rows.length, 3, "four targets selected, the art is capped at three");
  const [dodger, ...burned] = pcs.filter(pc => rows.filter(`[data-target-token="${pc.id}"]`).length);
  const rp = dodger.system.resources.rp.value;
  assert.equal(await resolveCard(card, [".bl-dodge"], dodger.id), ".bl-dodge");
  assert.equal(dodger.system.resources.rp.value, rp - 1);
  for (const pc of burned) {
    const hp = pc.system.resources.hp.value;
    await resolveCard(card, [".bl-takedmg"], pc.id);
    assert.equal(pc.system.resources.hp.value, hp - (3 + Math.floor(boss.system.stats.base.finesse / 2)), "1d6 (rolled 3) + half Finesse");
    assert.equal(pc.system.conditions.burn.active, true);
    assert.equal(pc.system.conditions.burn.duration, 3);
  }
  assert.equal(!!dodger.system.conditions.burn?.active, false);
  for (let turn = 0; turn < game.combat.turns.length * 4; turn++) await encounter.advance();
  for (const pc of burned) assert.equal(pc.system.conditions.burn.active, false, `${pc.name}: burn lasts 3 turns, not forever`);
});

test("a lethal Nichirin strike to the head beheads the demon on the card", async () => {
  globalThis.Roll = CertainRoll;
  const { pcs: [mizuki], demons: [prowler] } = await fight([IDS.mizuki], [IDS.prowler]);
  await prowler.update({ "system.resources.hp.value": 3 });
  const blade = mizuki.items.find(item => item.type === "weapon" && item.system.isNichirin);
  const result = await rollBasicAttack(mizuki, { item: blade, targetToken: prowler.getActiveTokens()[0], attackMode: "finesse", targetLimb: "head" });
  await resolveCard(result.chatMessage, [".bl-takedmg"], prowler.id);
  assert.equal(prowler.system.resources.hp.value, 0);
  assert.equal(prowler.system.death.state, "dead");
  assert.equal(prowler.system.combat.injuries.limbs.head.severed, true);
  assert.ok(chatMessages.some(message => /décapite .* lame Nichirin/.test(message.content ?? "")));
  assert.ok(!chatMessages.some(message => /à confirmer par le MJ/.test(message.content ?? "")));
});

test("the 0.9.0 migration drops legacy charges and cooldowns that carry no combat id", async () => {
  const { runSystemMigrations } = await import("../module/migrations.mjs");
  const kenta = makeActor(IDS.kenta), fighter = makeActor(IDS.mizuki);
  await kenta.setFlag(NS, "techniqueCharge", { itemId: "x", itemName: "Coup de tonnerre et éclair", readyRound: 2 });
  await kenta.setFlag(NS, "techniqueCooldowns", { x: 4 });
  await fighter.setFlag(NS, "techniqueCharge", { itemId: "y", itemName: "Pluie", readyRound: 3 });
  const settings = game.settings, previous = { actors: game.actors.contents, combats: game.combats, items: game.items };
  let stored = "0.8.0";
  game.settings = { get: () => stored, set: async (_scope, _key, value) => { stored = value; }, register() {} };
  game.actors.contents = [kenta, fighter];
  game.items = { contents: [] };
  game.combats = { contents: [{ started: true, combatants: [{ actor: fighter }] }] };
  try {
    await runSystemMigrations();
  } finally {
    Object.assign(game, { settings, combats: previous.combats, items: previous.items });
    game.actors.contents = previous.actors;
  }
  assert.equal(stored, "0.9.0");
  assert.equal(kenta.getFlag(NS, "techniqueCharge"), undefined);
  assert.equal(kenta.getFlag(NS, "techniqueCooldowns"), undefined);
  assert.ok(fighter.getFlag(NS, "techniqueCharge"), "a charge in a running fight is left alone");
});
