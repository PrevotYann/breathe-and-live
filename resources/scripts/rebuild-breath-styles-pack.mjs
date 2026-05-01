import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { BREATH_KEYS, SYSTEM_ID } from "../../module/config/rule-data.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..", "..");
const DEST_PACK = path.join(ROOT, "packs", "breaths-styles.db");
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

function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 12);
}

function makeId(key) {
  return `br${normalizeText(key)}000000000000`.slice(0, 16);
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

function specialSummary(specials = {}) {
  return Object.values(specials)
    .map((entry) => `${entry.label}: ${entry.hint}`)
    .join("\n");
}

function sourceSectionFor(entry) {
  if (["ocean", "west", "snow"].includes(entry.key)) return "Souffles originaux";
  if (entry.key === "custom") return "Creer votre propre technique de Souffle";
  return entry.label;
}

const docs = BREATH_KEYS.map((entry, index) => {
  const specials = Object.fromEntries(
    Object.keys(entry.specials || {}).map((specialKey) => [specialKey, true])
  );
  const description = specialSummary(entry.specials) || "Structure de souffle personnalisable.";
  return {
    _id: makeId(entry.key),
    name: entry.label,
    type: "breath",
    img: entry.img || "icons/svg/aura.svg",
    system: {
      tags: ["breath", entry.key],
      description,
      sourceSection: sourceSectionFor(entry),
      activation: "passive",
      quantity: 1,
      usageNote: description,
      prerequisites: {
        class: "",
        rank: "",
        breath: "",
        sense: entry.prereq?.sense || "",
        weapon: entry.prereq?.weapons || "",
        trait: entry.prereq?.stats || "",
      },
      uses: { value: 0, max: 0, per: "" },
      effects: [],
      selfEffects: [],
      templates: ["commonItem"],
      key: entry.key,
      enabled: false,
      specials,
      prereq: {
        sense: entry.prereq?.sense || "",
        stats: entry.prereq?.stats || "",
        weapons: entry.prereq?.weapons || "",
      },
    },
    flags: {},
    ownership: { default: 0 },
    _stats: createStats(),
    folder: null,
    sort: (index + 1) * 100000,
  };
});

assertWorkspaceTarget(DEST_PACK);
fs.writeFileSync(DEST_PACK, `${docs.map((doc) => JSON.stringify(doc)).join("\n")}\n`, "utf8");

console.log(
  JSON.stringify(
    {
      output: path.relative(ROOT, DEST_PACK),
      count: docs.length,
      keys: docs.map((doc) => doc.system.key),
    },
    null,
    2
  )
);
