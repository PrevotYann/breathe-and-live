import fs from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";
const readPack = name => fs.readFileSync(new URL(`../packs/${name}.db`,import.meta.url),"utf8").trim().split(/\r?\n/).map(JSON.parse);
test("training ranks follow the source pages 80 through 84", () => {
  const ranks = {
    Mizunoe: ["unarmed-training","weapon-mods","health-boost","endurance-training","dual-wield","sense-training"],
    Kanoe: ["combat-training","cardio-training","driving-license","poison-specialist","sniper-training","social-mastery"],
    Tsuchinoe: ["quick-weapon-swap","medical-training"], Hinoe: ["perfect-handling","firearm-training","executioner"], Kinoe: ["guillotine","death-shadow"],
  }, features = readPack("progression-features");
  for (const [rank,keys] of Object.entries(ranks)) for (const key of keys) {
    const feature = features.find(d=>d.system.featureKey === key);
    assert.ok(feature,key); assert.equal(feature.system.rank,rank,key); assert.equal(feature.system.prerequisites.rank,rank,key);
  }
  assert.equal(features.find(d=>d.system.featureKey === "secondary-breath").system.bonuses.studySlots,undefined);
});
test("all eight named but unfilled supplement attacks require GM data approval", () => {
  const entries = readPack("abilities-demons").filter(d=>d.name.includes("(à compléter)"));
  assert.equal(entries.length,8);
  for (const doc of entries) { assert.equal(doc.system.damage,""); assert.equal(doc.system.ruleSource.approved,false); assert.equal(doc.system.ruleSource.missingFields.length,4); }
});
test("Yosuke preserves the special printed attack profiles and resources", () => {
  const npc = readPack("supplement-1934-actors").find(d=>d.name === "Yosuke Wōkuo — Hashira de l’Océan");
  assert.deepEqual(npc.system.stats.base,{force:9,finesse:13,courage:7,vitesse:12,intellect:8,social:4});
  assert.equal(npc.system.resources.e.overrideMax,120); assert.equal(npc.system.resources.hp.max,100);
  const weapon = npc.items.find(i=>i.type === "weapon"); assert.equal(weapon.system.damage,"7d6");
  assert.deepEqual(weapon.system.attackProfiles,{force:{hit:9,damage:9},finesse:{hit:12,damage:12}});
  assert.equal(npc.system.combat.oceanNpcVariant,true);
});
