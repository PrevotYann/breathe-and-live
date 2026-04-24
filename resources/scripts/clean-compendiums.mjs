import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..", "..");
const PACKS_DIR = path.join(ROOT, "packs");
const TEMPLATE_PATH = path.join(ROOT, "template.json");
const SYSTEM_PATH = path.join(ROOT, "system.json");

const templateData = JSON.parse(fs.readFileSync(TEMPLATE_PATH, "utf8"));
const systemData = JSON.parse(fs.readFileSync(SYSTEM_PATH, "utf8"));
const SYSTEM_ID = systemData.id || "breathe-and-live";
const SYSTEM_VERSION = systemData.version || "0.1.0";
const CORE_VERSION = systemData.compatibility?.verified || "12.343";

function deepClone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function mergeObjects(base, override) {
  if (Array.isArray(base) || Array.isArray(override)) {
    return deepClone(override ?? base);
  }
  if (base && typeof base === "object" && override && typeof override === "object") {
    const merged = { ...deepClone(base) };
    for (const [key, value] of Object.entries(override)) {
      merged[key] = key in merged ? mergeObjects(merged[key], value) : deepClone(value);
    }
    return merged;
  }
  return deepClone(override ?? base);
}

function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function makeId(prefix, seed) {
  const digest = crypto.createHash("sha1").update(String(seed || "")).digest("hex");
  return `${prefix}${digest}`.slice(0, 16);
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

function shapeTopLevelDoc(doc) {
  const clean = deepClone(doc);
  clean.flags ??= {};
  clean.ownership ??= { default: 0 };
  clean._stats ??= createStats();
  return clean;
}

function actorTemplate(type) {
  const actorTemplates = templateData.Actor || {};
  const commonTemplates = actorTemplates.templates || {};
  const common = deepClone(commonTemplates.common || {});
  const actorType = actorTemplates[type] || {};
  return mergeObjects(common, actorType);
}

function itemTemplate(type) {
  const itemTemplates = templateData.Item || {};
  const commonTemplates = itemTemplates.templates || {};
  const common = deepClone(commonTemplates.commonItem || {});
  const itemType = itemTemplates[type] || {};
  return mergeObjects(common, itemType);
}

function normalizeEmbeddedItem(item, actorId, index) {
  const type = String(item?.type || "gear");
  const name = String(item?.name || `Objet ${index + 1}`);
  const normalized = {
    ...deepClone(item),
    _id: item?._id || makeId("ei", `${actorId}:${type}:${name}:${index}`),
    name,
    type,
    img: item?.img || "icons/svg/item-bag.svg",
    system: mergeObjects(itemTemplate(type), item?.system || {}),
    flags: item?.flags || {},
  };
  return normalized;
}

function normalizeActorDoc(doc) {
  const type = String(doc.type || "npc");
  const actorId = doc._id || makeId("ac", `${type}:${doc.name}`);
  const clean = shapeTopLevelDoc({
    ...deepClone(doc),
    _id: actorId,
    type,
    name: String(doc.name || actorId),
    img: doc.img || "icons/svg/mystery-man.svg",
  });

  clean.system = mergeObjects(actorTemplate(type), clean.system || {});
  clean.items = Array.isArray(doc.items)
    ? doc.items.map((item, index) => normalizeEmbeddedItem(item, actorId, index))
    : [];
  clean.effects = Array.isArray(doc.effects) ? deepClone(doc.effects) : [];
  clean.folder ??= null;
  clean.sort ??= 0;
  return clean;
}

function normalizeItemDoc(doc) {
  const type = String(doc.type || "gear");
  const itemId = doc._id || makeId("it", `${type}:${doc.name}`);
  const clean = shapeTopLevelDoc({
    ...deepClone(doc),
    _id: itemId,
    type,
    name: String(doc.name || itemId),
    img: doc.img || "icons/svg/item-bag.svg",
  });

  clean.system = mergeObjects(itemTemplate(type), clean.system || {});
  clean.effects = Array.isArray(doc.effects) ? deepClone(doc.effects) : clean.effects;
  clean.folder ??= null;
  clean.sort ??= 0;
  return clean;
}

function parseJsonLines(filePath) {
  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/).filter(Boolean);
  const docs = [];
  const parseErrors = [];
  for (let index = 0; index < lines.length; index += 1) {
    try {
      docs.push(JSON.parse(lines[index]));
    } catch (error) {
      parseErrors.push({ line: index + 1, error: String(error) });
    }
  }
  return { docs, parseErrors };
}

function choosePreferredDoc(current, candidate) {
  if (!current) return candidate;
  return JSON.stringify(candidate).length > JSON.stringify(current).length ? candidate : current;
}

function dedupeDocs(docs, dedupeKeyFn) {
  const deduped = new Map();
  for (const doc of docs) {
    if (!doc?._id || !doc?.name || !doc?.type) continue;
    const key = dedupeKeyFn(doc);
    deduped.set(key, choosePreferredDoc(deduped.get(key), doc));
  }
  return Array.from(deduped.values());
}

function writeJsonLines(filePath, docs) {
  const output = docs.map((doc) => JSON.stringify(doc)).join("\n");
  fs.writeFileSync(filePath, `${output}${output ? "\n" : ""}`, "utf8");
}

function packCollectionType(packName) {
  const configured = (systemData.packs || []).find(
    (entry) => path.basename(entry.path) === packName || entry.name === packName.replace(/\.db$/, "")
  );
  if (configured) return configured.type;
  return packName.startsWith("actors-") ? "Actor" : "Item";
}

function cleanupDbPack(fileName) {
  const filePath = path.join(PACKS_DIR, fileName);
  const collectionType = packCollectionType(fileName);
  const { docs, parseErrors } = parseJsonLines(filePath);
  const normalized = docs
    .filter((doc) => doc && typeof doc === "object")
    .map((doc) => (collectionType === "Actor" ? normalizeActorDoc(doc) : normalizeItemDoc(doc)));

  const dedupedById = dedupeDocs(normalized, (doc) => `id::${doc._id}`);
  const dedupedByName = dedupeDocs(
    dedupedById,
    (doc) => `name::${doc.type}::${normalizeText(doc.name)}`
  );

  writeJsonLines(filePath, dedupedByName);

  return {
    pack: fileName,
    collectionType,
    originalCount: docs.length,
    parseErrors: parseErrors.length,
    removedInvalid: docs.length - normalized.length,
    removedDuplicates: normalized.length - dedupedByName.length,
    finalCount: dedupedByName.length,
  };
}

function cleanupTechniqueSourcePack() {
  const sourceRoot = path.join(PACKS_DIR, "_source", "techniques-breaths");
  if (!fs.existsSync(sourceRoot)) {
    return { pack: "techniques-breaths(source)", originalCount: 0, removedDuplicates: 0, finalCount: 0 };
  }

  const docs = [];
  const fileMap = new Map();

  for (const dirent of fs.readdirSync(sourceRoot, { withFileTypes: true })) {
    if (!dirent.isDirectory()) continue;
    const dirPath = path.join(sourceRoot, dirent.name);
    for (const fileName of fs.readdirSync(dirPath)) {
      if (!fileName.endsWith(".json") || fileName.startsWith("_")) continue;
      const filePath = path.join(dirPath, fileName);
      const doc = JSON.parse(fs.readFileSync(filePath, "utf8"));
      const normalized = normalizeItemDoc(doc);
      docs.push({ doc: normalized, filePath });
      fileMap.set(normalized._id, filePath);
    }
  }

  const dedupedById = dedupeDocs(
    docs.map((entry) => entry.doc),
    (doc) => `id::${doc._id}`
  );
  const dedupedByKey = dedupeDocs(
    dedupedById,
    (doc) =>
      `technique::${doc.type}::${normalizeText(doc.system?.breathKey || doc.system?.breath || "")}::${doc.system?.form ?? ""}::${normalizeText(doc.name)}`
  );

  const keptIds = new Set(dedupedByKey.map((doc) => doc._id));
  for (const { doc, filePath } of docs) {
    if (!keptIds.has(doc._id)) {
      fs.rmSync(filePath, { force: true });
      continue;
    }
    fs.writeFileSync(filePath, `${JSON.stringify(doc, null, 2)}\n`, "utf8");
  }

  return {
    pack: "techniques-breaths(source)",
    originalCount: docs.length,
    removedDuplicates: docs.length - dedupedByKey.length,
    finalCount: dedupedByKey.length,
  };
}

const dbReports = fs
  .readdirSync(PACKS_DIR, { withFileTypes: true })
  .filter((entry) => entry.isFile() && entry.name.endsWith(".db"))
  .map((entry) => cleanupDbPack(entry.name));

const techniqueSourceReport = cleanupTechniqueSourcePack();

console.log(
  JSON.stringify(
    {
      packs: dbReports,
      source: techniqueSourceReport,
    },
    null,
    2
  )
);
