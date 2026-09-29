import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = new URL("../", import.meta.url);
const read = name => JSON.parse(fs.readFileSync(new URL(name, root), "utf8"));
const manifest = read("system.json");
const template = read("template.json");

test("V14 declares every existing actor and item type without changing saved schemas", () => {
  for (const kind of ["Actor", "Item"]) {
    assert.deepEqual(Object.keys(manifest.documentTypes[kind]).sort(), [...template[kind].types].sort());
  }
});

function checkDocuments(documents, label) {
  const ids = new Set();
  for (const document of documents) {
    assert.match(document._id ?? "", /^[a-zA-Z0-9]{16}$/, `${label}: ${document.name}`);
    assert.ok(!ids.has(document._id), `${label}: duplicate ${document._id}`);
    ids.add(document._id);
    if (document._key) assert.equal(document._key.split("!").at(-1), document._id, `${label}: database key mismatch`);
    for (const key of ["items", "effects"]) checkDocuments(document[key] ?? [], `${label}/${document.name}/${key}`);
  }
}

for (const pack of manifest.packs.filter(pack => pack.path.endsWith(".db"))) {
  test(`${pack.name}: V14 document IDs and embedded items are importable`, () => {
    const documents = fs.readFileSync(new URL(pack.path, root), "utf8").trim().split(/\r?\n/).map(JSON.parse);
    assert.ok(documents.length);
    checkDocuments(documents, pack.name);
    for (const document of documents) assert.ok(manifest.documentTypes[pack.type][document.type]);
  });
}

test("all breathing forms and their folders have valid stable V14 IDs", () => {
  const source = new URL("packs/_source/techniques-breaths/", root);
  const documents = fs.readdirSync(source, { recursive: true }).filter(file => file.endsWith(".json"))
    .map(file => JSON.parse(fs.readFileSync(new URL(file.split(path.sep).join("/"), source), "utf8")));
  assert.ok(documents.length >= 140);
  checkDocuments(documents, "techniques-breaths");
  const folderIds = new Set(documents.filter(doc => doc._key?.startsWith("!folders!")).map(doc => doc._id));
  for (const doc of documents) if (doc.folder) assert.ok(folderIds.has(doc.folder), doc.name);
});
