import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { JSDOM } from "jsdom";
import "./foundry-mocks.mjs";
import {
  activateSheetImages, buildBreathSummary, getItemFallbackImage, resolveActorImage, resolveItemImage,
} from "../module/sheets/sheet-presentation.mjs";
import { BREATH_KEYS } from "../module/config/rule-data.mjs";

test("breath summary shows an active preferred style once and retains secondary styles", () => {
  const styles = BREATH_KEYS.map(entry => ({ ...entry, enabled: ["water", "flame"].includes(entry.key) }));
  const rows = buildBreathSummary("Souffle de l’Eau", styles, [{ key: "water", id: "waterStyle", img: "custom-water.webp" }]);
  assert.deepEqual(rows.map(row => row.key), ["flame", "water"]);
  assert.equal(rows.find(row => row.key === "water").itemId, "waterStyle");
  assert.equal(rows.find(row => row.key === "water").img, "custom-water.webp");
  assert.ok(rows.every(row => row.active));
});

test("preferred inactive and custom styles stay visible without implying active mechanics", () => {
  const rows = buildBreathSummary("water", []);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].active, false);
  assert.equal(rows[0].preferred, true);
  assert.equal(buildBreathSummary("Souffle des lucioles", [])[0].label, "Souffle des lucioles");
  assert.deepEqual(buildBreathSummary("", []), []);
});

test("every document type and breath has a bundled fallback; custom art is preserved", () => {
  const manifest = JSON.parse(fs.readFileSync(new URL("../system.json", import.meta.url)));
  for (const type of Object.keys(manifest.documentTypes.Item)) {
    const item = { type, img: "icons/svg/item-bag.svg" };
    const path = resolveItemImage(item).replace("systems/breathe-and-live/", "../");
    assert.ok(fs.existsSync(new URL(path, import.meta.url)), type);
    assert.equal(resolveItemImage({ ...item, img: "worlds/campaign/custom.webp" }), "worlds/campaign/custom.webp");
  }
  for (const breath of BREATH_KEYS) {
    const img = getItemFallbackImage({ type: "technique", system: { breathKey: breath.key } });
    assert.equal(img, breath.img);
    assert.ok(fs.existsSync(new URL(img.replace("systems/breathe-and-live/", "../"), import.meta.url)));
  }
});

test("failed item art recovers once without changing the saved document", () => {
  const dom = new JSDOM('<div class="item" data-item-id="gun"><img src="missing.webp"></div>');
  const item = { type: "firearm", img: "missing.webp" };
  const img = dom.window.document.querySelector("img");
  activateSheetImages({ actor: { items: new Map([["gun", item]]) } }, dom.window.document.body);
  img.dispatchEvent(new dom.window.Event("error"));
  assert.equal(img.getAttribute("src"), getItemFallbackImage(item));
  img.setAttribute("src", "another.webp");
  img.dispatchEvent(new dom.window.Event("error"));
  assert.equal(img.getAttribute("src"), "another.webp", "error listener must not loop");
  assert.equal(item.img, "missing.webp");
});

test("cached image failures recover even when the load error preceded listeners", () => {
  const dom = new JSDOM('<img src="missing.webp">');
  const img = dom.window.document.querySelector("img");
  Object.defineProperty(img, "complete", { value: true });
  activateSheetImages({ item: { type: "medical" } }, dom.window.document.body);
  assert.match(img.getAttribute("src"), /medical\.webp$/);
});

test("legacy demon portraits and firearm icons resolve without requesting missing core files", () => {
  assert.equal(resolveActorImage({ img: "icons/svg/monster.svg" }), "icons/svg/mystery-man.svg");
  assert.equal(resolveActorImage({ img: "worlds/campaign/portrait.webp" }), "worlds/campaign/portrait.webp");
  assert.match(resolveItemImage({ type: "firearm", img: "icons/weapons/guns/gun-pistol.webp" }), /firearm\.webp$/);
});

test("legacy system pictograms use painted art while custom SVGs are preserved", () => {
  assert.match(resolveItemImage({ type: "medical", img: "systems/breathe-and-live/assets/icons/items/medical.svg" }), /medical\.webp$/);
  assert.equal(resolveItemImage({ type: "medical", img: "worlds/campaign/custom.svg" }), "worlds/campaign/custom.svg");
});

test("compendium item records persist usable art outside the sheet renderer", () => {
  const root = new URL("../", import.meta.url);
  const manifest = JSON.parse(fs.readFileSync(new URL("system.json", root)));
  let illustrated = 0;
  function inspect(doc, isItem = false) {
    if (isItem) {
      assert.equal(doc.img, resolveItemImage(doc), doc.name);
      if (doc.img.startsWith("systems/breathe-and-live/")) {
        assert.ok(fs.existsSync(new URL(doc.img.slice("systems/breathe-and-live/".length), root)), doc.name);
        illustrated++;
      }
    }
    for (const item of doc.items ?? []) inspect(item, true);
    for (const actor of doc.actors ?? []) inspect(actor);
  }
  for (const pack of manifest.packs) {
    const docs = pack.path.endsWith(".db")
      ? fs.readFileSync(new URL(pack.path, root), "utf8").trim().split(/\r?\n/).map(JSON.parse)
      : fs.readdirSync(new URL(`packs/_source/${pack.name}/`, root), { recursive: true })
        .filter(name => name.endsWith(".json") && !name.split(/[\\/]/).at(-1).startsWith("_"))
        .map(name => JSON.parse(fs.readFileSync(new URL(`packs/_source/${pack.name}/${name.replaceAll("\\", "/")}`, root))));
    for (const doc of docs) inspect(doc, pack.type === "Item");
  }
  assert.ok(illustrated > 100);
});
