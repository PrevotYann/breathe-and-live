// Runs only in the disposable bl-v14-qa world on a licensed v14.368 server.
import assert from "node:assert/strict";
import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true,
  ...(process.env.FOUNDRY_QA_BROWSER ? { executablePath: process.env.FOUNDRY_QA_BROWSER }
    : process.platform === "win32" ? { channel: "msedge" } : {}),
  args: ["--enable-unsafe-swiftshader"],
});
const page = await browser.newPage();
const errors = [];
page.on("pageerror", error => errors.push(error.message));
let created;
async function nextTurn() {
  await page.evaluate(() => game.combat.nextTurn());
  // Foundry hooks dispatch without awaiting asynchronous document updates.
  await page.waitForTimeout(500);
}
async function resolve(messageId, selector, actorId, expected) {
  await page.locator(`[data-message-id="${messageId}"] ${selector}`).first().evaluate(button => button.click());
  await page.waitForFunction(({ actorId, expected }) => game.actors.get(actorId).system.resources.hp.value === expected, { actorId, expected });
  await page.waitForFunction(id => game.messages.get(id).flavor.includes("disabled"), messageId);
}
try {
  await page.goto(process.env.FOUNDRY_QA_URL || "http://127.0.0.1:30144");
  await page.waitForFunction(() => globalThis.game?.world);
  assert.equal(await page.evaluate(() => game.world.id), "bl-v14-qa", "Refusing to modify a campaign world");
  await page.waitForFunction(() => game.ready || document.querySelector("input[name=username]"));
  if (await page.locator("input[name=username]").count()) {
    await page.locator("input[name=username]").fill("Gamemaster");
    await page.locator("button[name=join]").click();
  }
  await page.waitForFunction(() => game.ready && game.system.api);
  assert.equal(await page.evaluate(() => game.version), "14.368");
  assert.equal(await page.evaluate(() => !!game.combat), false, "Finish the previous QA fight first");
  const sceneId = await page.evaluate(async () => {
    const scene = await Scene.create({ name: "QA four-actor fights", width: 1800, height: 1200,
      grid: { size: 100, distance: 1.5, units: "m" }, levels: [{ name: "Sol" }] });
    await scene.activate(); return scene.id;
  });
  created = { sceneId, actorIds: [] };
  await page.waitForFunction(id => canvas.ready && canvas.scene.id === id, sceneId);
  created.actorIds = await page.evaluate(async () => {
    const choices = [["actors-slayers", "Renjiro - Hashira de la Flamme"], ["actors-slayers", "Aoi Mizunoe - Eau"],
      ["actors-demonists", "Mika - Tireuse demoniste"], ["actors-demons", "Shiori - Demon jouable Patchwork"]];
    const actors = [];
    for (const [pack, name] of choices) {
      const source = (await game.packs.get(`breathe-and-live.${pack}`).getDocuments()).find(actor => actor.name === name);
      if (!source) throw new Error(`Missing ${name}`);
      const data = source.toObject(); delete data._id; data.folder = null; data.name = `QA fight: ${name}`;
      const actor = await Actor.create(data); actors.push(actor);
      await game.system.api.runRestRefresh(actor);
      if (actor.system.resources.bdp) await actor.update({ "system.resources.bdp.value": actor.system.resources.bdp.max });
    }
    await actors[0].setFlag("breathe-and-live", "flameHeart", { dayIndex: Math.floor(game.time.worldTime / 86400) });
    await canvas.scene.createEmbeddedDocuments("Token", await Promise.all(actors.map(async (actor, index) => {
      const data = (await actor.getTokenDocument({ x: 500 + (index % 2) * 100, y: 500 + Math.floor(index / 2) * 100, actorLink: true })).toObject();
      data.level = canvas.scene.levels.contents[0].id; return data;
    })));
    return actors.map(actor => actor.id);
  });
  await page.waitForFunction(ids => ids.every(id => game.actors.get(id).getActiveTokens()[0]?.center), created.actorIds);
  const fight = await page.evaluate(async ids => {
    const combat = await Combat.create({ scene: canvas.scene.id, active: true });
    await combat.createEmbeddedDocuments("Combatant", ids.map((actorId, index) => ({ actorId,
      tokenId: game.actors.get(actorId).getActiveTokens()[0].id, initiative: 40 - index * 10 })));
    await combat.startCombat(); return combat.id;
  }, created.actorIds);
  created.combatId = fight;
  await page.waitForFunction(id => game.actors.get(id).system.combat.actionEconomy.remainingActions > 0, created.actorIds[0]);
  const melee = await page.evaluate(async ids => {
    const actor = game.actors.get(ids[0]), target = game.actors.get(ids[3]);
    const before = target.system.resources.hp.value;
    const attack = await game.system.api.rollBasicAttack(actor, { item: actor.items.find(i => i.type === "weapon"),
      targetToken: target.getActiveTokens()[0], targetLimb: "", attackMode: "force", forceAutoHit: true });
    if (await game.system.api.runRestRefresh(actor) !== null) throw new Error("Rest allowed in combat");
    return { messageId: attack.chatMessage.id, expected: Math.max(0, before - attack.damageRoll.total) };
  }, created.actorIds);
  await resolve(melee.messageId, ".bl-takedmg", created.actorIds[3], melee.expected);
  console.log("PASS: native four-actor fight, melee damage and combat rest restriction");
  await nextTurn();
  const breath = await page.evaluate(async ids => {
    const actor = game.actors.get(ids[1]), target = game.actors.get(ids[3]);
    target.getActiveTokens()[0].setTarget(true, { releaseOthers: true });
    const before = { hp: target.system.resources.hp.value, rp: target.system.resources.rp.value, e: actor.system.resources.e.value };
    await game.system.api.useTechnique(actor, actor.items.find(i => i.type === "technique" && i.system.form === 1), { controlledToken: actor.getActiveTokens()[0] });
    if (!(actor.system.resources.e.value < before.e)) throw new Error("Breath cost missing");
    return { messageId: game.messages.contents.findLast(m => m.getFlag("breathe-and-live", "card")?.kind === "technique").id, ...before };
  }, created.actorIds);
  await resolve(breath.messageId, ".bl-dodge", created.actorIds[3], breath.hp);
  assert.equal(await page.evaluate(id => game.actors.get(id).system.resources.rp.value, created.actorIds[3]), breath.rp - 1);
  await nextTurn();
  const shot = await page.evaluate(async ids => {
    const actor = game.actors.get(ids[2]), target = game.actors.get(ids[3]), gun = actor.items.find(i => i.type === "firearm");
    const before = { hp: target.system.resources.hp.value, ammo: gun.system.ammo.value };
    const attack = await game.system.api.rollBasicAttack(actor, { item: gun, targetToken: target.getActiveTokens()[0], targetLimb: "", forceAutoHit: true });
    if (gun.system.ammo.value !== before.ammo - 1) throw new Error("Firearm did not spend ammunition");
    return { messageId: attack.chatMessage.id, expected: Math.max(0, before.hp - attack.damageRoll.total) };
  }, created.actorIds);
  await resolve(shot.messageId, ".bl-takedmg", created.actorIds[3], shot.expected);
  console.log("PASS: native breath auto-hit/dodge, RP cost and firearm ammunition/damage");
  await nextTurn();
  await page.evaluate(async ids => {
    const demon = game.actors.get(ids[3]), water = game.actors.get(ids[1]);
    await game.system.api.setLimbState(demon, "leftArm", { severed: true });
    await game.system.api.startRegeneration(demon, { limbs: ["leftArm"], turns: 1 });
    await game.system.api.setConditionState(water, "burn", { active: true, duration: 1 });
    const source = (await game.packs.get("breathe-and-live.abilities-demons").getDocuments())
      .find(item => item.system.automation?.delayedDamageRounds > 0);
    const data = source.toObject(); delete data._id; data.folder = null;
    const [delayed] = await demon.createEmbeddedDocuments("Item", [data]);
    water.getActiveTokens()[0].setTarget(true, { releaseOthers: true });
    await game.system.api.useTechnique(demon, delayed, { controlledToken: demon.getActiveTokens()[0] });
    if (!water.getFlag("breathe-and-live", "pendingDemonEffects")?.length) throw new Error("Delayed BDA not scheduled");
  }, created.actorIds);
  await nextTurn(); await nextTurn(); await nextTurn(); await nextTurn();
  assert.equal(await page.evaluate(id => game.actors.get(id).system.combat.injuries.limbs.leftArm.severed, created.actorIds[3]), false);
  assert.equal(await page.evaluate(id => game.actors.get(id).system.conditions.burn.active, created.actorIds[1]), false);
  assert.equal(await page.evaluate(id => game.actors.get(id).getFlag("breathe-and-live", "pendingDemonEffects").length, created.actorIds[1]), 0);
  await page.evaluate(async ({ combatId, actorIds }) => {
    await game.combats.get(combatId).delete();
    for (const id of actorIds) {
      const actor = game.actors.get(id), rp = actor.system.resources.rp.value;
      await game.system.api.runRestRefresh(actor, { full: false, hours: 1 });
      if (actor.system.resources.rp.value !== rp) throw new Error("Short rest restored RP");
      await game.system.api.runRestRefresh(actor, { hours: 8 });
      if (actor.system.resources.rp.value !== actor.system.resources.rp.max) throw new Error("Long rest failed to restore RP");
    }
    const dead = game.actors.get(actorIds[0]);
    await dead.update({ "system.resources.hp.value": 0, "system.death.state": "dead" });
    if (await game.system.api.runRestRefresh(dead) !== null || dead.system.resources.hp.value !== 0) throw new Error("Rest revived a dead actor");
  }, created);
  console.log("PASS: native delayed BDA, owner-turn conditions, scheduled limb regrowth and short/long rests");
  assert.deepEqual(errors, [], "Browser runtime errors");
} finally {
  if (created && await page.evaluate(() => !!globalThis.game?.ready).catch(() => false)) {
    await page.evaluate(async ({ combatId, sceneId, actorIds }) => {
      if (game.combats.has(combatId)) await game.combats.get(combatId).delete();
      if (game.scenes.has(sceneId)) await game.scenes.get(sceneId).delete();
      await Actor.deleteDocuments(actorIds.filter(id => game.actors.has(id)));
    }, created);
  }
  await browser.close();
}
