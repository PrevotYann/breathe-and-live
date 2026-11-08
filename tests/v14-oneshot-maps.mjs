// Imports the adventure only into the disposable bl-v14-qa world.
import assert from "node:assert/strict";
import fs from "node:fs";
import { chromium } from "playwright";
import { SCENES } from "../resources/oneshot/lanternes-hotaru/scenes.mjs";
import { docId } from "../resources/oneshot/lanternes-hotaru/ids.mjs";

const browser = await chromium.launch({ headless: true,
  ...(process.env.FOUNDRY_QA_BROWSER ? { executablePath: process.env.FOUNDRY_QA_BROWSER }
    : process.platform === "win32" ? { channel: "msedge" } : {}),
  args: ["--enable-unsafe-swiftshader"],
});
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
const errors = [];
page.on("pageerror", error => errors.push(error.message));
const output = "tmp/oneshot-map-previews";
fs.mkdirSync(output, { recursive: true });
try {
  await page.goto(process.env.FOUNDRY_QA_URL || "http://127.0.0.1:30144");
  await page.waitForFunction(() => globalThis.game?.world);
  assert.equal(await page.evaluate(() => game.world.id), "bl-v14-qa", "Refusing to modify a campaign world");
  await page.waitForFunction(() => game.ready || document.querySelector("input[name=username]"));
  if (!await page.evaluate(() => game.ready)) {
    await page.locator("input[name=username]").fill("Gamemaster");
    await page.locator("button[name=join]").click();
  }
  await page.waitForFunction(() => game.ready && game.system.api);
  assert.equal(await page.evaluate(() => game.version), "14.368");
  const imported = await page.evaluate(async () => {
    const pack = game.packs.get("breathe-and-live.oneshot-lanternes-hotaru");
    const [adventure] = await pack.getDocuments();
    if (pack.invalidDocumentIds.size) throw new Error("Invalid adventure data");
    const result = await adventure.import({ dialog: false });
    return [...result.created.Scene ?? [], ...result.updated.Scene ?? []].length;
  });
  assert.equal(imported, 3);
  // Keep screenshots reviewable; this changes only the QA client's presentation.
  await page.addStyleTag({ content: "#pause, #notifications { display: none !important; }" });
  const report = [];
  for (const def of SCENES) {
    const sceneId = docId(`scene:${def.key}`);
    const result = await page.evaluate(async sceneId => {
      const scene = game.scenes.get(sceneId);
      await scene.view();
      canvas.notes.activate();
      canvas.notes.highlightObjects = true;
      const d = scene.dimensions;
      canvas.pan({ x: d.width / 2, y: d.height / 2, scale: Math.min(1400 / d.width, 850 / d.height) });
      return {
        origin: [d.sceneX, d.sceneY], initial: scene.initial,
        notes: scene.notes.map(note => ({ x: note.x - d.sceneX, y: note.y - d.sceneY, text: note.text,
          linked: !!note.entry?.pages.get(note.pageId), levels: Array.from(note.levels) })),
        tokens: scene.tokens.map(token => ({ actorId: token.actorId, x: token.x - d.sceneX, y: token.y - d.sceneY })),
        level: scene.initialLevel.id ?? scene.initialLevel,
        renderedNotes: canvas.notes.placeables.length, renderedTokens: canvas.tokens.placeables.length,
      };
    }, sceneId);
    assert.equal(result.notes.length, def.notes.length);
    assert.equal(result.renderedNotes, def.notes.length);
    assert.equal(result.renderedTokens, def.tokens.length);
    assert.deepEqual(result.notes.map(note => [note.text, note.x, note.y]), def.notes.map(note => [note.text, note.x, note.y]));
    assert.ok(result.notes.every(note => note.linked && note.levels.includes(result.level)));
    assert.deepEqual(result.tokens.map(token => [token.actorId, token.x, token.y]), def.tokens.map(token => [docId(`actor:${token.actor}`), token.x, token.y]));
    assert.equal(result.initial.x - result.origin[0], def.width / 2);
    assert.equal(result.initial.y - result.origin[1], def.height / 2);
    await page.waitForFunction(() => canvas.ready && !canvas.loading);
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await page.screenshot({ path: `${output}/${def.key}.png` });
    report.push({ scene: def.key, ...result });
  }
  const icons = await page.evaluate(async () => {
    const pack = game.packs.get("breathe-and-live.items-medical-utility");
    const docs = await pack.getDocuments();
    const generated = docs.filter(doc => doc.img.startsWith("systems/breathe-and-live/assets/icons/items/"));
    await Promise.all(generated.map(async doc => {
      if (!doc.img.endsWith(".webp")) throw new Error(`Unreplaced pictogram: ${doc.name}`);
      const image = new Image(); image.src = doc.img; await image.decode();
      if (image.naturalWidth !== 512) throw new Error(`Wrong icon dimensions: ${doc.name}`);
    }));
    return generated.length;
  });
  assert.ok(icons > 20);
  assert.deepEqual(errors, []);
  fs.writeFileSync(`${output}/report.json`, `${JSON.stringify({ version: "14.368", icons, scenes: report }, null, 2)}\n`);
  console.log(`PASS: v14.368 adventure import, all 13 pins and 17 tokens, camera centers and ${icons} compendium illustrations. Previews: ${output}`);
} finally {
  await browser.close();
}
