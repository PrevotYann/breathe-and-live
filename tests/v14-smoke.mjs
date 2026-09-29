// Requires a running, licensed V14 server with the built system and a disposable
// world named bl-v14-qa. Creates test documents; never run against a campaign.
import assert from "node:assert/strict";
import fs from "node:fs";
import { chromium } from "playwright";

const manifest = JSON.parse(fs.readFileSync(new URL("../system.json", import.meta.url), "utf8"));
const browser = await chromium.launch({
  headless: true,
  ...(process.env.FOUNDRY_QA_BROWSER ? { executablePath: process.env.FOUNDRY_QA_BROWSER }
    : process.platform === "win32" ? { channel: "msedge" } : {}),
  args: ["--enable-unsafe-swiftshader"],
});
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
const errors = [];
page.on("pageerror", error => errors.push(error.message));
page.on("console", message => {
  if (message.type() === "error" && !/hardware acceleration|favicon|Failed to load resource/.test(message.text())) errors.push(message.text());
});
const ready = () => page.waitForFunction(() => game.ready && game.system.api);
const result = {};
try {
  await page.goto(process.env.FOUNDRY_QA_URL || "http://127.0.0.1:30144");
  await page.waitForFunction(() => globalThis.game?.world);
  assert.equal(await page.evaluate(() => game.world.id), "bl-v14-qa", "Refusing to modify a non-QA world");
  await page.waitForFunction(() => game.ready || document.querySelector("input[name=username]"));
  if (await page.locator("input[name=username]").count()) {
    await page.locator("input[name=username]").fill("Gamemaster");
    await page.locator("button[name=join]").click();
  }
  await ready();
  result.version = await page.evaluate(() => game.version);
  assert.equal(result.version, manifest.compatibility.verified);
  result.packs = await page.evaluate(async () => {
    const packs = [];
    for (const pack of game.packs) {
      const docs = await pack.getDocuments();
      if (pack.invalidDocumentIds.size) throw new Error(`Invalid documents: ${pack.collection}`);
      const collection = pack.documentName === "Actor" ? game.actors : game.items;
      const cls = getDocumentClass(pack.documentName);
      const imported = await cls.createDocuments(docs.map(doc => collection.fromCompendium(doc)));
      if (imported.length !== docs.length) throw new Error(`Incomplete import: ${pack.collection}`);
      packs.push({ name: pack.metadata.name, count: docs.length });
    }
    return packs;
  });
  for (const pack of manifest.packs.filter(pack => pack.path.endsWith(".db"))) {
    const count = fs.readFileSync(new URL(`../${pack.path}`, import.meta.url), "utf8").trim().split(/\r?\n/).length;
    assert.equal(result.packs.find(entry => entry.name === pack.name)?.count, count, pack.name);
  }
  assert.equal(result.packs.find(pack => pack.name === "techniques-breaths").count, 140);
  console.log("PASS: all 14 compendiums load and import without losing entries");

  result.sheets = await page.evaluate(async () => {
    const sheets = [];
    for (const [kind, types] of Object.entries(game.system.documentTypes)) {
      if (!["Actor", "Item"].includes(kind)) continue;
      for (const type of Object.keys(types)) {
        const doc = await getDocumentClass(kind).create({ name: `QA ${type}`, type });
        await doc.sheet._render(true);
        if (!doc.sheet.element.find(".sheet-body").length) throw new Error(`Missing ${type} sheet`);
        sheets.push({ kind, type, sheet: doc.sheet.constructor.name });
        await doc.sheet.close();
      }
    }
    return sheets;
  });
  assert.equal(result.sheets.length, 32);
  assert.ok(result.sheets.every(entry => entry.sheet.startsWith("BL")), "Build must preserve registered sheet class names");
  console.log("PASS: all 7 actor types and 25 item types render");

  const sceneId = await page.evaluate(async () => {
    const scene = await Scene.create({ name: "QA combat", width: 1800, height: 1200,
      grid: { size: 100, distance: 1.5, units: "m" }, levels: [{ name: "Sol" }] });
    await scene.activate();
    return scene.id;
  });
  await page.waitForFunction(id => canvas.ready && canvas.scene.id === id, sceneId);
  const actors = await page.evaluate(async () => {
    const actors = await Actor.createDocuments([{ name: "QA combat attacker", type: "slayer" }, { name: "QA combat defender", type: "slayer" }]);
    for (const actor of actors) await game.system.api.runRestRefresh(actor);
    await actors[0].createEmbeddedDocuments("Item", [
      { name: "QA weapon", type: "weapon", system: { damage: "4", range: 1.5 } },
      { name: "QA mist", type: "breath", system: { key: "mist", enabled: true, specials: { nuagesTrainants: true } } },
      { name: "QA form", type: "technique", system: { breathKey: "mist", damage: "3", costE: 2, range: 3 } },
      { name: "QA bandage", type: "medical", system: { healing: "3" } },
    ]);
    await canvas.scene.createEmbeddedDocuments("Token", await Promise.all(actors.map(async (actor, index) => {
      const data = (await actor.getTokenDocument({ x: 500 + index * 100, y: 500, actorLink: true })).toObject();
      data.level = canvas.scene.levels.contents[0].id;
      return data;
    })));
    return actors.map(actor => actor.id);
  });
  await page.waitForFunction(ids => ids.every(id => game.actors.get(id).getActiveTokens()[0]?.center), actors);
  // Reload is essential: existing actors must already use BLActor when collections initialize.
  await page.reload(); await ready();
  await page.waitForFunction(() => canvas.ready);
  assert.equal(await page.evaluate(id => game.actors.get(id).constructor.name, actors[0]), "BLActor");

  await page.evaluate(([attackerId, defenderId]) => {
    const attacker = game.actors.get(attackerId);
    globalThis.qaAttack = game.system.api.rollBasicAttack(attacker, { item: attacker.items.getName("QA weapon"),
      targetToken: game.actors.get(defenderId).getActiveTokens()[0], attackMode: "force", forceAutoHit: true });
  }, actors);
  await page.locator(".dialog button[data-button=ok]").click();
  const attack = await page.evaluate(async () => { const r = await globalThis.qaAttack; return { id: r.chatMessage.id, damage: r.damageRoll.total }; });
  assert.equal(attack.damage, 4);
  await page.locator(`[data-message-id="${attack.id}"] .bl-takedmg`).first().evaluate(button => button.click());
  await page.waitForFunction(id => game.messages.get(id).flavor.includes("disabled"), attack.id);
  assert.equal(await page.evaluate(id => game.actors.get(id).system.resources.hp.value, actors[1]), 16);

  const techniqueMessage = await page.evaluate(async ([attackerId, defenderId]) => {
    const attacker = game.actors.get(attackerId);
    const target = game.actors.get(defenderId).getActiveTokens()[0];
    target.setTarget(true, { releaseOthers: true });
    await game.system.api.useTechnique(attacker, attacker.items.getName("QA form"), { controlledToken: attacker.getActiveTokens()[0] });
    return game.messages.contents.at(-1).id;
  }, actors);
  assert.equal(await page.evaluate(id => game.actors.get(id).system.resources.e.value, actors[0]), 18);
  await page.reload(); await ready(); await page.waitForFunction(() => canvas.ready);
  await page.locator(`[data-message-id="${techniqueMessage}"] .bl-mist`).first().evaluate(button => button.click());
  await page.waitForFunction(() => canvas.scene.regions.some(region => region.flags["breathe-and-live"]?.kind === "mist"));
  assert.deepEqual(await page.evaluate(() => {
    const region = canvas.scene.regions.find(region => region.flags["breathe-and-live"]?.kind === "mist");
    return { radius: region.shapes[0].radius, level: region.levels.has(canvas.scene.levels.contents[0].id) };
  }), { radius: 200, level: true });
  await page.locator(`[data-message-id="${techniqueMessage}"] .bl-dodge`).first().evaluate(button => button.click());
  await page.waitForFunction(id => game.messages.get(id).flavor.includes("disabled"), techniqueMessage);
  assert.deepEqual(await page.evaluate(id => {
    const actor = game.actors.get(id); return [actor.system.resources.hp.value, actor.system.resources.rp.value];
  }, actors[1]), [16, 4]);
  console.log("PASS: attacks, breath costs, native mist region, damage and dodge after reload");

  result.support = await page.evaluate(async ([attackerId, defenderId]) => {
    const api = game.system.api;
    const attacker = game.actors.get(attackerId), defender = game.actors.get(defenderId);
    await api.useMedicalItem(attacker, attacker.items.getName("QA bandage"), { targetActor: defender });
    const healed = defender.system.resources.hp.value;
    await api.setConditionState(defender, "burn", { active: true, intensity: 1 });
    const condition = defender.system.conditions.burn.active;
    await api.setConditionState(defender, "burn", { active: false });
    await api.setLimbState(defender, "leftLeg", { severed: true });
    const injuredMovement = defender.system.combat.actionEconomy.effectiveMovementMeters;
    await api.setLimbState(defender, "leftLeg", { severed: false });
    const movement = defender.system.combat.actionEconomy.effectiveMovementMeters;
    await api.runRestRefresh(defender);
    await api.rollBaseCheck(attacker, "force");
    await api.rollDerivedCheck(attacker, "medecine");
    return { healed, condition, cleared: !defender.system.conditions.burn.active, injuredMovement, movement,
      hp: defender.system.resources.hp.value, rp: defender.system.resources.rp.value };
  }, actors);
  assert.equal(result.support.healed, 19);
  assert.ok(result.support.condition && result.support.cleared);
  assert.equal(result.support.injuredMovement, result.support.movement / 2);
  assert.deepEqual([result.support.hp, result.support.rp], [20, 5]);
  await page.reload(); await ready(); await page.waitForFunction(() => canvas.ready);
  assert.ok(await page.evaluate(id => game.messages.get(id).flavor.includes("disabled"), techniqueMessage));
  assert.equal(await page.evaluate(id => game.actors.get(id).system.resources.hp.value, actors[1]), 20);
  assert.deepEqual(errors, [], "Browser errors");
  console.log("PASS: medicine, conditions, limb movement, rest, stat rolls and persistence");
  console.log(JSON.stringify(result, null, 2));
} finally {
  await browser.close();
}
