import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { documentDefaults, withDefaults } from "../module/data/system-models.mjs";

test("default merging preserves saved values, arrays and homebrew fields", () => {
  const saved = { resources: { hp: { value: 0 }, extra: 7 }, custom: { damage: "2d6" }, tags: [] };
  const initial = { resources: { hp: { value: 20, max: 20 } }, tags: ["default"] };
  const merged = withDefaults(initial, saved);
  assert.deepEqual(merged, { resources: { hp: { value: 0, max: 20 }, extra: 7 }, custom: { damage: "2d6" }, tags: [] });
  merged.resources.hp.value = 10;
  assert.equal(saved.resources.hp.value, 0);
});

test("all declared document types receive independent defaults without template metadata", () => {
  const manifest = JSON.parse(fs.readFileSync(new URL("../system.json", import.meta.url), "utf8"));
  assert.equal("system" in manifest, false);
  assert.equal("dependencies" in manifest, false);
  assert.equal(fs.existsSync(new URL("../template.json", import.meta.url)), false);
  for (const [kind, types] of Object.entries(manifest.documentTypes)) {
    for (const type of Object.keys(types)) {
      const defaults = documentDefaults(kind, type);
      assert.ok(Object.keys(defaults).length, `${kind}.${type}`);
      assert.equal("templates" in defaults, false);
      assert.deepEqual(defaults, documentDefaults(kind, type));
      if (kind === "Actor") {
        defaults.resources.hp.value = -99;
        assert.notEqual(documentDefaults(kind, type).resources.hp.value, -99);
      }
    }
  }
});
