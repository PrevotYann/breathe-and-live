// Run only against the disposable licensed V14 world used by v14-smoke.mjs.
import assert from "node:assert/strict";
import fs from "node:fs";
import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true,
  ...(process.env.FOUNDRY_QA_BROWSER ? { executablePath: process.env.FOUNDRY_QA_BROWSER }
    : process.platform === "win32" ? { channel: "msedge" } : {}),
});
const page = await browser.newPage({ viewport: { width: 1500, height: 1000 } });
const errors = [];
page.on("pageerror", error => errors.push(error.message));
const output = "tmp/sheet-previews";
fs.mkdirSync(output, { recursive: true });
const report = [];
try {
  await page.goto(process.env.FOUNDRY_QA_URL || "http://127.0.0.1:30144");
  await page.waitForFunction(() => globalThis.game?.world);
  assert.equal(await page.evaluate(() => game.world.id), "bl-v14-qa", "Refusing to modify a campaign world");
  await page.waitForFunction(() => game.ready || document.querySelector("input[name=username]"));
  if (!await page.evaluate(() => game.ready)) {
    await page.locator("input[name=username]").fill("Gamemaster");
    await page.locator("button[name=join]").click();
  }
  await page.waitForFunction(() => game.ready);
  const types = await page.evaluate(() => Object.entries(game.system.documentTypes)
    .filter(([kind]) => ["Actor", "Item"].includes(kind))
    .flatMap(([kind, types]) => Object.keys(types).map(type => ({ kind, type }))));
  for (const { kind, type } of types) {
    const id = await page.evaluate(async ({ kind, type }) => {
      const packs = { slayer: "actors-slayers", demonist: "actors-demonists", demon: "actors-demons" };
      let data = { type };
      if (packs[type]) {
        const pack = game.packs.get(`breathe-and-live.${packs[type]}`);
        data = game.actors.fromCompendium((await pack.getDocuments())[0]);
      }
      const doc = await getDocumentClass(kind).create({ ...data, name: `QA interface ${type}` });
      globalThis.qaSheetDoc = doc;
      await doc.sheet._render(true);
      doc.sheet.setPosition({ left: 100, top: 50 });
      return doc.sheet.id;
    }, { kind, type });
    const sheet = page.locator(`[id="${id}"]`);
    await page.waitForFunction(id => getComputedStyle(document.getElementById(id)).opacity === "1", id);
    const tabs = await sheet.locator(".sheet-tabs [data-tab]").evaluateAll(els => els.map(el => el.dataset.tab));
    assert.ok(tabs.length >= 2, `${type}: missing navigation`);
    for (const width of [kind === "Actor" ? 1040 : 780, 560]) {
      await page.evaluate(width => qaSheetDoc.sheet.setPosition({ width, height: 800 }), width);
      for (const tab of tabs) {
        await sheet.locator(`.sheet-tabs [data-tab="${tab}"]`).click();
        const result = await sheet.evaluate((el, { type, tab, width }) => {
          const body = el.querySelector(".sheet-body");
          const active = [...body.querySelectorAll(":scope > .tab.active")];
          const current = el.querySelector('.sheet-tabs [aria-selected="true"]');
          const controls = [...el.querySelectorAll("input, select, textarea, label, button, a, small, summary, h2, h3, .tag, .sheet-badge, .eyebrow")]
            .filter(el => el.checkVisibility() && (el.value || el.textContent.trim() || el.placeholder));
          // Composite translucent surfaces over ancestors before computing WCAG contrast.
          const rgba = value => (value.match(/[\d.]+/g) || []).map(Number);
          const background = el => {
            const c = rgba(getComputedStyle(el).backgroundColor), alpha = c[3] ?? 1;
            const parent = el.parentElement ? background(el.parentElement) : [255, 255, 255];
            return c.slice(0, 3).map((value, i) => value * alpha + parent[i] * (1 - alpha));
          };
          const luminance = c => c.slice(0, 3).map(v => v / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4)
            .reduce((sum, v, i) => sum + v * [.2126, .7152, .0722][i], 0);
          const contrast = controls.filter(el => el.type !== "checkbox").map(el => {
            const fg = luminance(rgba(getComputedStyle(el).color)), bg = luminance(background(el));
            return (Math.max(fg, bg) + .05) / (Math.min(fg, bg) + .05);
          });
          return { type, tab, width, active: active.length, key: active[0]?.dataset.tab,
            selected: current?.dataset.tab, overflow: body.scrollWidth - body.clientWidth,
            contrast: contrast.length ? Math.min(...contrast) : null };
        }, { type, tab, width });
        assert.equal(result.active, 1, `${type}/${tab}: one visible panel`);
        assert.equal(result.key, tab);
        assert.equal(result.selected, tab);
        assert.ok(result.overflow <= 1, `${type}/${tab}/${width}: horizontal overflow ${result.overflow}`);
        assert.ok(result.contrast === null || result.contrast >= 4.5, `${type}/${tab}: text contrast ${result.contrast}`);
        report.push(result);
      }
      await sheet.locator(`.sheet-tabs [data-tab="${tabs[0]}"]`).click();
      if (["slayer", "demonist", "demon", "weapon", "technique", "breath"].includes(type)) {
        await sheet.screenshot({ path: `${output}/${type}-${width}.png` });
      }
    }
    // Keyboard selection uses Foundry's real controller, including wrapped tab rails.
    const first = sheet.locator(`.sheet-tabs [data-tab="${tabs[0]}"]`);
    await first.focus();
    await first.press("ArrowRight");
    assert.equal(await sheet.locator('.sheet-tabs [aria-selected="true"]').getAttribute("data-tab"), tabs[1]);
    await sheet.locator('.sheet-tabs [aria-selected="true"]').press("End");
    assert.equal(await sheet.locator('.sheet-tabs [aria-selected="true"]').getAttribute("data-tab"), tabs.at(-1));

    if (["slayer", "demonist", "demon"].includes(type)) {
      const before = await page.evaluate(() => ({ hp: qaSheetDoc.system.resources.hp.value,
        items: qaSheetDoc.items.map(item => item.id), context: qaSheetDoc.system.profile.trainerContext }));
      await first.click();
      await sheet.locator('[name="system.resources.hp.value"]').fill("7");
      await sheet.locator('[name="system.resources.hp.value"]').press("Tab");
      await page.waitForFunction(() => qaSheetDoc.system.resources.hp.value === 7);
      assert.deepEqual(await page.evaluate(() => qaSheetDoc.items.map(item => item.id)), before.items);
      assert.equal(await page.evaluate(() => qaSheetDoc.system.profile.trainerContext), before.context);
      // Opening a drawer and changing a resource must preserve its expanded state.
      await sheet.locator(".bl-action-drawer summary").click();
      await sheet.locator('[name="system.resources.hp.value"]').fill("8");
      await sheet.locator('[name="system.resources.hp.value"]').press("Tab");
      await page.waitForFunction(() => qaSheetDoc.system.resources.hp.value === 8);
      await page.waitForFunction(() => qaSheetDoc.sheet.element[0].querySelector(".bl-action-drawer").open);
    }
    if (kind === "Item" && tabs.includes("tags")) {
      await sheet.locator('.sheet-tabs [data-tab="tags"]').click();
      await sheet.locator('[name="system.sourceSection"]').fill("QA référence sauvegardée");
      await sheet.locator('[name="system.sourceSection"]').press("Tab");
      await page.waitForFunction(() => qaSheetDoc.system.sourceSection === "QA référence sauvegardée");
    }
    await page.evaluate(async () => { await qaSheetDoc.sheet.close(); await qaSheetDoc.delete(); });
    console.log(`PASS: ${kind}.${type} navigation, narrow layout, contrast and form persistence`);
  }
  assert.deepEqual(errors, []);
  fs.writeFileSync(`${output}/verified-layout.json`, JSON.stringify(report, null, 2));
  console.log(`PASS: ${types.length} sheet types, ${report.length} tab/width checks; screenshots in ${output}`);
} finally {
  await browser.close();
}
