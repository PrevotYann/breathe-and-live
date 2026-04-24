import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { BREATH_KEYS, SYSTEM_ID } from "../../module/config/rule-data.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..", "..");
const LEGACY_SOURCE_DB = path.join(ROOT, "packs", "techniques-breaths.db");
const CURRENT_SOURCE_PACK = path.join(ROOT, "packs", "_source", "techniques-breaths");
const DEST_PACK = CURRENT_SOURCE_PACK;
const systemJson = JSON.parse(fs.readFileSync(path.join(ROOT, "system.json"), "utf8"));
const SYSTEM_VERSION = systemJson.version || "0.1.0";
const CORE_VERSION = systemJson.compatibility?.verified || "12.343";

function assertWorkspaceTarget(targetPath) {
  const resolvedRoot = path.resolve(ROOT);
  const resolvedTarget = path.resolve(targetPath);
  if (!resolvedTarget.startsWith(resolvedRoot)) {
    throw new Error(`Unsafe target path outside workspace: ${resolvedTarget}`);
  }
}

function slugify(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function normalizeKey(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function makeFolderId(breathKey) {
  return `blf${normalizeKey(breathKey)}fldr`.padEnd(16, "0").slice(0, 16);
}

function createStats() {
  return {
    duplicateSource: null,
    coreVersion: CORE_VERSION,
    systemId: SYSTEM_ID,
    systemVersion: SYSTEM_VERSION,
    createdTime: null,
    modifiedTime: null,
    lastModifiedBy: null,
  };
}

function ensureDocumentShape(doc, folderId, sort, breathImg) {
  const clean = structuredClone(doc);
  clean.folder = folderId;
  clean.sort = sort;
  if (breathImg) clean.img = breathImg;
  clean.flags ??= {};
  clean.ownership ??= { default: 0 };
  clean._stats ??= createStats();
  clean._key = `!items!${clean._id}`;
  return clean;
}

function readDocsFromSourcePack(sourceRoot) {
  const docs = [];
  const stack = [sourceRoot];

  while (stack.length) {
    const current = stack.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(fullPath);
        continue;
      }
      if (!entry.name.endsWith(".json")) continue;
      if (["_folder.json", "_container.json"].includes(entry.name)) continue;
      docs.push(JSON.parse(fs.readFileSync(fullPath, "utf8")));
    }
  }

  return docs;
}

const breathEntries = new Map(BREATH_KEYS.map((entry, index) => [entry.key, { ...entry, order: index }]));

const docs = fs.existsSync(LEGACY_SOURCE_DB)
  ? fs
      .readFileSync(LEGACY_SOURCE_DB, "utf8")
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => JSON.parse(line))
  : readDocsFromSourcePack(CURRENT_SOURCE_PACK);

const deduped = new Map();
for (const doc of docs) {
  const key = [
    normalizeKey(doc.name),
    normalizeKey(doc.system?.breathKey || doc.system?.breath || ""),
    String(doc.system?.form ?? ""),
  ].join("::");

  const current = deduped.get(key);
  if (!current || JSON.stringify(doc).length > JSON.stringify(current).length) {
    deduped.set(key, doc);
  }
}

const cleanedDocs = Array.from(deduped.values()).sort((a, b) => {
  const breathA = breathEntries.get(a.system?.breathKey)?.order ?? 999;
  const breathB = breathEntries.get(b.system?.breathKey)?.order ?? 999;
  if (breathA !== breathB) return breathA - breathB;
  const formA = Number(a.system?.form ?? 0);
  const formB = Number(b.system?.form ?? 0);
  if (formA !== formB) return formA - formB;
  return String(a.name).localeCompare(String(b.name), "fr");
});

assertWorkspaceTarget(DEST_PACK);
fs.rmSync(DEST_PACK, { recursive: true, force: true });
fs.mkdirSync(DEST_PACK, { recursive: true });

const folderIds = new Map();
const countsByBreath = new Map();

for (const doc of cleanedDocs) {
  const breathKey = doc.system?.breathKey || "custom";
  const breath = breathEntries.get(breathKey) || {
    key: breathKey,
    label: doc.system?.breathLabel || doc.system?.breath || breathKey,
    color: "#8a6e52",
    order: 999,
  };

  if (!folderIds.has(breathKey)) {
    const folderId = makeFolderId(breathKey);
    folderIds.set(breathKey, folderId);

    const folderDir = path.join(DEST_PACK, `${String(breath.order).padStart(2, "0")}-${slugify(breath.label)}`);
    fs.mkdirSync(folderDir, { recursive: true });

    const folderDoc = {
      name: breath.label,
      sorting: "a",
      folder: null,
      type: "Item",
      _id: folderId,
      description: `Formes et techniques du ${breath.label}.`,
      sort: (breath.order + 1) * 100000,
      color: breath.color || "#8a6e52",
      flags: {},
      _stats: createStats(),
      _key: `!folders!${folderId}`,
    };

    fs.writeFileSync(
      path.join(folderDir, "_folder.json"),
      `${JSON.stringify(folderDoc, null, 2)}\n`,
      "utf8"
    );
  }

  const folderId = folderIds.get(breathKey);
  const nextIndex = (countsByBreath.get(breathKey) ?? 0) + 1;
  countsByBreath.set(breathKey, nextIndex);

  const breathMeta = breathEntries.get(breathKey) || {
    label: doc.system?.breathLabel || doc.system?.breath || breathKey,
    order: 999,
  };
  const folderDir = path.join(
    DEST_PACK,
    `${String(breathMeta.order).padStart(2, "0")}-${slugify(breathMeta.label)}`
  );
  const filename = `${String(doc.system?.form ?? nextIndex).padStart(2, "0")}-${slugify(doc.name)}.json`;
  const shaped = ensureDocumentShape(doc, folderId, nextIndex * 100000, breathMeta.img);

  fs.writeFileSync(path.join(folderDir, filename), `${JSON.stringify(shaped, null, 2)}\n`, "utf8");
}

console.log(
  JSON.stringify(
    {
      sourceCount: docs.length,
      dedupedCount: cleanedDocs.length,
      duplicateCount: docs.length - cleanedDocs.length,
      folders: Array.from(folderIds.keys()).length,
      output: path.relative(ROOT, DEST_PACK),
    },
    null,
    2
  )
);
