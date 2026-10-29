// Re-encode selected image_gen outputs, preserve alpha, and check shipped art.
// No image generation happens here; prompts live alongside the scenario sources.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const out = path.join(root, "assets/oneshot/lanternes-hotaru");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "resources/oneshot/lanternes-hotaru/art-manifest.json"), "utf8"));
const sourceArg = process.argv.find(arg => arg.startsWith("--sources="));
const sources = sourceArg ? JSON.parse(fs.readFileSync(path.resolve(root, sourceArg.slice(10)), "utf8")) : {};
const partial = process.argv.includes("--partial");
const browser = await chromium.launch({ headless: true });
const report = [];
try {
  const page = await browser.newPage();
  for (const asset of manifest.assets) {
    const dest = path.join(out, asset.file);
    if (partial && !sources[asset.id]) continue;
    const input = sources[asset.id] ? path.resolve(root, sources[asset.id]) : dest;
    if (!fs.existsSync(input)) throw new Error(`Missing final art: ${asset.id} (${input})`);
    const mime = input.endsWith(".webp") ? "image/webp" : "image/png";
    const result = await page.evaluate(async ({ data, width, height, transparent, encode }) => {
      const img = new Image();
      img.src = data;
      await img.decode();
      if (!encode && (img.naturalWidth !== width || img.naturalHeight !== height)) {
        throw new Error(`Expected ${width}x${height}, got ${img.naturalWidth}x${img.naturalHeight}`);
      }
      const canvas = document.createElement("canvas");
      canvas.width = width; canvas.height = height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, width, height);
      const corners = [[0, 0], [width - 1, 0], [0, height - 1], [width - 1, height - 1]];
      if (transparent && corners.some(([x, y]) => ctx.getImageData(x, y, 1, 1).data[3] !== 0)) {
        throw new Error("Token corners must retain generated transparency");
      }
      const encoded = encode ? canvas.toDataURL("image/webp", 0.92) : null;
      // Always derive thumbnails from the shipped WebP, including on first import.
      if (encoded) {
        const exported = new Image();
        exported.src = encoded;
        await exported.decode();
        ctx.clearRect(0, 0, width, height);
        ctx.drawImage(exported, 0, 0);
      }
      const thumb = document.createElement("canvas");
      thumb.width = 400; thumb.height = Math.round(400 * height / width);
      thumb.getContext("2d").drawImage(canvas, 0, 0, thumb.width, thumb.height);
      return {
        data: encoded ? encoded.split(",")[1] : null,
        thumb: thumb.toDataURL("image/webp", 0.82).split(",")[1],
        sourceWidth: img.naturalWidth, sourceHeight: img.naturalHeight,
      };
    }, {
      data: `data:${mime};base64,${fs.readFileSync(input).toString("base64")}`,
      width: asset.width, height: asset.height, transparent: !!asset.transparent, encode: !!sources[asset.id],
    });
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    if (result.data) fs.writeFileSync(dest, Buffer.from(result.data, "base64"));
    if (asset.file.startsWith("maps/")) {
      const thumb = path.join(out, "maps/thumbs", path.basename(asset.file));
      fs.mkdirSync(path.dirname(thumb), { recursive: true });
      fs.writeFileSync(thumb, Buffer.from(result.thumb, "base64"));
    }
    report.push({ id: asset.id, file: asset.file, width: asset.width, height: asset.height, bytes: fs.statSync(dest).size });
    console.log(`${sources[asset.id] ? "Prepared" : "Verified"} ${asset.file} (${asset.width}x${asset.height})`);
  }
} finally {
  await browser.close();
}
if (!partial) {
  fs.writeFileSync(path.join(out, "art-credits.json"), `${JSON.stringify({
    scenario: manifest.scenario, generatedOn: manifest.generatedOn, generator: manifest.generator,
    style: manifest.style, assets: report,
  }, null, 2)}\n`);
}
console.log(`${report.length} final images ${partial ? "prepared" : "validated"}.`);
