// Encode selected image_gen outputs without cropping or changing their artwork.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "resources/art/items/manifest.json"), "utf8"));
const sourceArg = process.argv.find(arg => arg.startsWith("--sources="));
const sources = sourceArg ? JSON.parse(fs.readFileSync(path.resolve(root, sourceArg.slice(10)), "utf8")) : {};
const output = path.join(root, "assets/icons/items");
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  for (const asset of manifest.assets) {
    const dest = path.join(output, asset.file);
    const source = sources[asset.id];
    const input = source ? path.resolve(root, source) : dest;
    const data = fs.readFileSync(input).toString("base64");
    const result = await page.evaluate(async ({ data, mime, width, height, encode }) => {
      const img = new Image();
      img.src = `data:${mime};base64,${data}`;
      await img.decode();
      if (!encode) {
        if (img.naturalWidth !== width || img.naturalHeight !== height) throw new Error("Unexpected export dimensions");
        return null;
      }
      const canvas = document.createElement("canvas");
      canvas.width = width; canvas.height = height;
      canvas.getContext("2d").drawImage(img, 0, 0, width, height);
      return canvas.toDataURL("image/webp", 0.92).split(",")[1];
    }, { data, mime: input.endsWith(".webp") ? "image/webp" : "image/png", width: asset.width, height: asset.height, encode: !!source });
    if (result) fs.writeFileSync(dest, Buffer.from(result, "base64"));
    console.log(`${source ? "Prepared" : "Verified"} ${asset.file}`);
  }
} finally {
  await browser.close();
}
fs.writeFileSync(path.join(output, "art-credits.json"), `${JSON.stringify(manifest, null, 2)}\n`);
