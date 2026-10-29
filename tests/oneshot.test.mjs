import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const root = new URL("../", import.meta.url);
const manifest = JSON.parse(fs.readFileSync(new URL("system.json", root), "utf8"));
const pack = manifest.packs.find(entry => entry.name === "oneshot-lanternes-hotaru");
const [adventure] = fs.readFileSync(new URL(pack.path, root), "utf8").trim().split(/\r?\n/).map(JSON.parse);
const byId = collection => new Map(adventure[collection].map(doc => [doc._id, doc]));
const actors = byId("actors"), items = byId("items"), journals = byId("journal"), scenes = byId("scenes");
const pregens = adventure.actors.filter(actor => ["slayer", "demonist"].includes(actor.type));
const DERIVED_GROUPS = {
  force: ["athletisme", "puissanceBrute"], finesse: ["dexterite", "equilibre", "precision"],
  courage: ["mithridatisme", "endurance", "tolerance"], vitesse: ["reflexes", "agilite", "rapidite", "ruse"],
  social: ["tromperie", "performance", "intimidation", "perception", "intuition"],
  intellect: ["medecine", "nature", "sciences", "enquete", "survie"],
};

test("one-shot ships as a single Adventure with five pregens, demons, journals and scenes", () => {
  assert.equal(pack.type, "Adventure");
  assert.equal(pregens.length, 5);
  assert.ok(pregens.some(actor => actor.type === "demonist"));
  assert.ok(adventure.actors.filter(actor => actor.type === "npcDemon").length >= 2);
  assert.equal(adventure.journal.length, 3);
  assert.equal(adventure.scenes.length, 3);
});

test("pregens follow the book's level 1 creation rules", () => {
  for (const actor of pregens) {
    const { base, derived } = actor.system.stats;
    assert.deepEqual(Object.values(base).sort(), [0, 1, 2, 3, 4, 5], `${actor.name}: tableau (0..5)`);
    for (const [group, keys] of Object.entries(DERIVED_GROUPS)) {
      assert.ok(keys.reduce((sum, key) => sum + (derived[key] ?? 0), 0) <= base[group], `${actor.name}: ${group}`);
    }
    const { hp, e, rp, ca } = actor.system.resources;
    assert.equal(hp.max, 20, actor.name);
    assert.equal(e.max, 20 + base.courage, actor.name);
    assert.equal(rp.max, 5 + base.vitesse + base.intellect, actor.name);
    assert.equal(ca, 10 + base.vitesse, actor.name);
    const { sensePoints, superhumanPoints, breathFormPoints } = actor.system.creation;
    assert.equal(sensePoints + superhumanPoints + breathFormPoints, 15, `${actor.name}: 15 points de départ`);
    const forms = actor.items.filter(item => item.type === "technique");
    assert.equal(forms.length, breathFormPoints, `${actor.name}: une forme par point`);
    assert.equal(actor.items.filter(item => item.type === "sense").length * 3, sensePoints, actor.name);
    for (const form of forms) assert.ok(actor.system.breaths[form.system.breathKey]?.enabled, `${actor.name}: ${form.name}`);
    if (actor.type === "slayer") {
      assert.ok(actor.items.some(item => item.type === "weapon" && item.system.isNichirin), `${actor.name}: arme de souffle`);
      assert.ok(actor.items.some(item => item.type === "firearm"), `${actor.name}: pistolet`);
      assert.ok(actor.items.some(item => item.name === "Bandage" && item.system.quantity === 2), `${actor.name}: 2 bandages`);
    } else {
      assert.ok(actor.items.some(item => item.name === "Fusil de tranchee"), `${actor.name}: fusil`);
      assert.ok(actor.items.some(item => item.name === "Wakizashi Nichirin"), `${actor.name}: wakizashi`);
      assert.ok(actor.system.resources.bdp.value <= actor.system.resources.bdp.max);
    }
  }
});

test("demons use the creation array plus their rank package", () => {
  const packages = { "Demon faible": [4, 3, 2, 1, 1, 1], "Demon eleve": [4, 4, 3, 3, 2, 1] };
  const total = values => values.reduce((sum, value) => sum + value, 0);
  for (const actor of adventure.actors.filter(doc => doc.type === "npcDemon")) {
    const base = actor.system.stats.base;
    assert.equal(total(Object.values(base)), total([0, 1, 2, 3, 3, 5]) + total(packages[actor.system.class.rank]), actor.name);
    assert.equal(actor.system.resources.hp.max, 20 + 5 * base.force, actor.name);
    assert.equal(actor.system.resources.bdp.max, 10 * base.courage, actor.name);
    assert.equal(actor.system.resources.rp.max, Math.floor((5 + base.vitesse + base.intellect) / 2), actor.name);
  }
});

test("journal links, notes and tokens point to documents of the adventure", () => {
  const pages = new Map(adventure.journal.flatMap(entry => entry.pages.map(page => [`${entry._id}.${page._id}`, page])));
  const html = adventure.journal.flatMap(entry => entry.pages.map(page => page.text?.content ?? "")).join("\n") + adventure.description;
  for (const [, type, id, rest] of html.matchAll(/@UUID\[(\w+)\.([a-z0-9]{16})(?:\.JournalEntryPage\.([a-z0-9]{16}))?\]/g)) {
    if (type === "JournalEntry") assert.ok(pages.has(`${id}.${rest}`), `page ${id}.${rest}`);
    else assert.ok({ Actor: actors, Item: items, Scene: scenes }[type]?.has(id), `${type}.${id}`);
  }
  for (const scene of adventure.scenes) {
    const level = scene.levels[0]._id;
    assert.equal(scene.initialLevel, level);
    for (const note of scene.notes) assert.ok(pages.has(`${note.entryId}.${note.pageId}`), `${scene.name}: ${note.text}`);
    for (const token of scene.tokens) {
      assert.ok(actors.has(token.actorId), `${scene.name}: ${token.name}`);
      assert.equal(token.level, level);
    }
    assert.ok(journals.has(scene.journal));
  }
});

test("every system asset referenced by the adventure exists", () => {
  const paths = new Set(JSON.stringify(adventure).match(/systems\/breathe-and-live\/[^"'\s)]+\.(?:webp|png|svg|jpg)/g));
  assert.ok(paths.size > 10);
  for (const asset of paths) assert.ok(fs.existsSync(new URL(asset.replace("systems/breathe-and-live/", ""), root)), asset);
  const art = JSON.parse(fs.readFileSync(new URL("resources/oneshot/lanternes-hotaru/art-manifest.json", root), "utf8"));
  for (const asset of art.assets) {
    assert.ok(paths.has(`systems/breathe-and-live/assets/oneshot/lanternes-hotaru/${asset.file}`), `${asset.id}: final art is used by the adventure`);
  }
  const bridge = adventure.scenes.find(scene => scene.name.startsWith("2."));
  const prowlers = bridge.tokens.filter(token => token.name.startsWith("Rôdeur"));
  assert.equal(prowlers.length, 2);
  assert.notEqual(prowlers[0].texture.src, prowlers[1].texture.src, "the two prowlers have distinct final portraits");
});

test("folders referenced by adventure documents are included", () => {
  const folders = byId("folders");
  for (const key of ["actors", "items", "journal", "scenes"]) {
    for (const doc of adventure[key]) assert.ok(!doc.folder || folders.has(doc.folder), `${key}: ${doc.name}`);
  }
  for (const folder of adventure.folders) assert.ok(!folder.folder || folders.has(folder.folder), folder.name);
});
