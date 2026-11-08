// Persist the same image repair used by sheets, so compendium lists and imported
// documents display the generated art too. IDs and mechanics remain untouched.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { resolveItemImage } from "../../module/sheets/sheet-presentation.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "system.json"), "utf8"));
let changed = 0;
function repair(doc, isItem = false) {
  if (isItem) {
    const img = resolveItemImage(doc);
    if (img !== doc.img) { doc.img = img; changed++; }
  }
  for (const item of doc.items ?? []) repair(item, true);
  for (const actor of doc.actors ?? []) repair(actor);
}

for (const pack of manifest.packs) {
  if (pack.path.endsWith(".db")) {
    const file = path.join(root, pack.path);
    const docs = fs.readFileSync(file, "utf8").split(/\r?\n/).filter(Boolean).map(JSON.parse);
    const before = changed;
    for (const doc of docs) repair(doc, pack.type === "Item");
    if (changed !== before) fs.writeFileSync(file, `${docs.map(doc => JSON.stringify(doc)).join("\n")}\n`);
  }
  // Source JSON is the authority for compiled packs and may also back a NeDB pack.
  const source = path.join(root, "packs/_source", pack.name);
  if (!fs.existsSync(source)) continue;
  for (const name of fs.readdirSync(source, { recursive: true })) {
    if (!name.endsWith(".json") || path.basename(name).startsWith("_")) continue;
    const file = path.join(source, name);
    const doc = JSON.parse(fs.readFileSync(file, "utf8"));
    const before = changed;
    repair(doc, pack.type === "Item");
    if (changed !== before) fs.writeFileSync(file, `${JSON.stringify(doc, null, 2)}\n`);
  }
}
console.log(`Updated ${changed} item image references (including embedded copies).`);
