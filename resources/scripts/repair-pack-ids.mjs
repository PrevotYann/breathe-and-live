import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "system.json"), "utf8"));
const replacements = new Map();
const packs = manifest.packs.filter(pack => pack.path.endsWith(".db")).map(pack => ({
  ...pack,
  documents: fs.readFileSync(path.join(root, pack.path), "utf8").trim().split(/\r?\n/).map(JSON.parse),
}));
const sourceRoot = path.join(root, "packs/_source");
const sources = fs.readdirSync(sourceRoot, { recursive: true }).filter(file => file.endsWith(".json"))
  .map(file => ({ file: path.join(sourceRoot, file), document: JSON.parse(fs.readFileSync(path.join(sourceRoot, file), "utf8")) }));

// Keep valid UUIDs stable. Older hand-authored IDs were not always 16 characters.
function repair(document, seed) {
  const oldId = document._id;
  if (!/^[a-zA-Z0-9]{16}$/.test(oldId ?? "")) {
    const id = crypto.createHash("sha256").update(`${manifest.id}:${oldId || seed}`).digest("hex").slice(0, 16);
    document._id = id;
    if (oldId) replacements.set(oldId, id);
  }
  if (document._key) document._key = document._key.slice(0, document._key.lastIndexOf("!") + 1) + document._id;
  for (const key of ["items", "effects"]) {
    for (const [index, child] of (document[key] ?? []).entries()) repair(child, `${seed}.${key}.${index}`);
  }
}

for (const pack of packs) {
  for (const [index, document] of pack.documents.entries()) repair(document, `${pack.name}.${index}`);
}
for (const source of sources) repair(source.document, source.file);

function repairReferences(value) {
  if (typeof value === "string") {
    if (replacements.has(value)) return replacements.get(value);
    if (value.startsWith("!")) return value.replace(/[a-zA-Z0-9]+/g, id => replacements.get(id) ?? id);
    return value.replace(/(Compendium\.breathe-and-live\.[\w-]+\.(?:Actor\.|Item\.)?)([a-zA-Z0-9]+)/g,
      (_, prefix, id) => prefix + (replacements.get(id) ?? id));
  }
  if (Array.isArray(value)) return value.map(repairReferences);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, repairReferences(child)]));
  }
  return value;
}

for (const pack of packs) {
  const documents = pack.documents.map(repairReferences);
  const ids = documents.map(document => document._id);
  if (new Set(ids).size !== ids.length) throw new Error(`Duplicate IDs in ${pack.name}`);
  const output = documents.map(JSON.stringify).join("\n") + "\n";
  const target = path.join(root, pack.path);
  if (fs.readFileSync(target, "utf8").replace(/\r\n/g, "\n") !== output) fs.writeFileSync(target, output);
}
for (const source of sources) {
  const output = JSON.stringify(repairReferences(source.document), null, 2) + "\n";
  if (fs.readFileSync(source.file, "utf8").replace(/\r\n/g, "\n") !== output) fs.writeFileSync(source.file, output);
}
console.log(`Repaired ${replacements.size} distinct legacy compendium IDs; valid IDs retained.`);
