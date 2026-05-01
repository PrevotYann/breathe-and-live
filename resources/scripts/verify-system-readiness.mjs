import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..", "..");

const REQUIRED_ACTOR_TEMPLATES = [
  "templates/actor/actor-slayer.hbs",
  "templates/actor/actor-demonist.hbs",
  "templates/actor/actor-demon.hbs",
  "templates/actor/actor-npc.hbs",
];

const REQUIRED_ITEM_TEMPLATES = [
  "templates/item/item-breath.hbs",
  "templates/item/item-generic.hbs",
  "templates/item/item-technique.hbs",
  "templates/item/item-vehicle.hbs",
  "templates/item/item-weapon.hbs",
];

const REQUIRED_SCRIPTS = [
  "resources/scripts/rebuild-breath-styles-pack.mjs",
  "resources/scripts/rebuild-breath-techniques-pack.mjs",
  "resources/scripts/rebuild-items-weapons-pack.mjs",
  "resources/scripts/rebuild-supplement-1934-packs.mjs",
  "resources/scripts/validate-packs.mjs",
];

function readJson(relativePath) {
  const fullPath = path.join(ROOT, relativePath);
  return JSON.parse(fs.readFileSync(fullPath, "utf8"));
}

function exists(relativePath) {
  return fs.existsSync(path.join(ROOT, relativePath));
}

function readJsonLines(relativePath) {
  const fullPath = path.join(ROOT, relativePath);
  return fs
    .readFileSync(fullPath, "utf8")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      try {
        return JSON.parse(line);
      } catch (error) {
        throw new Error(`${relativePath}:${index + 1} JSON invalide: ${error.message}`);
      }
    });
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function validateManifest() {
  const manifest = readJson("system.json");
  assert(manifest.compatibility?.verified === "12.343", "system.json doit verifier Foundry 12.343");
  assert(Array.isArray(manifest.esmodules) && manifest.esmodules.includes("module/breathe-and-live.mjs"), "Module principal manquant");
  assert(Array.isArray(manifest.styles) && manifest.styles.includes("styles/system.css"), "Feuille CSS principale manquante");

  const packNames = new Set();
  for (const pack of manifest.packs || []) {
    assert(pack.name && !packNames.has(pack.name), `Pack duplique ou sans nom: ${pack.name}`);
    packNames.add(pack.name);
    assert(pack.path && exists(pack.path), `Chemin de pack introuvable: ${pack.name} -> ${pack.path}`);
    assert(["Actor", "Item"].includes(pack.type), `Type de pack non supporte: ${pack.name} -> ${pack.type}`);
  }

  for (const packName of [
    "actors-slayers",
    "actors-demonists",
    "actors-demons",
    "items-weapons",
    "items-medical-utility",
    "breaths-styles",
    "techniques-breaths",
    "techniques-subclasses",
    "progression-features",
    "abilities-demons",
    "supplement-1934-actors",
    "supplement-1934",
    "supplement-1934-breaths",
    "supplement-1934-techniques",
  ]) {
    assert(packNames.has(packName), `Pack obligatoire absent du manifeste: ${packName}`);
  }
}

function validateDbPack(relativePath, minCount = 1) {
  const docs = readJsonLines(relativePath);
  assert(docs.length >= minCount, `${relativePath} doit contenir au moins ${minCount} entree(s)`);
  for (const doc of docs) {
    assert(doc._id, `${relativePath}: document sans _id`);
    assert(doc.name, `${relativePath}: document sans name`);
    assert(doc.type, `${relativePath}: document "${doc.name}" sans type`);
    if (doc.system && !Array.isArray(doc.items)) {
      assert(doc.system.sourceSection, `${relativePath}: item "${doc.name}" sans sourceSection`);
    }
  }
  return docs.length;
}

function validateTemplates() {
  for (const templatePath of [...REQUIRED_ACTOR_TEMPLATES, ...REQUIRED_ITEM_TEMPLATES]) {
    assert(exists(templatePath), `Template introuvable: ${templatePath}`);
    const text = fs.readFileSync(path.join(ROOT, templatePath), "utf8");
    assert(text.includes("sheet-header"), `${templatePath}: header de fiche manquant`);
    assert(text.includes("sheet-body"), `${templatePath}: body de fiche manquant`);
  }

  for (const templatePath of REQUIRED_ACTOR_TEMPLATES) {
    const text = fs.readFileSync(path.join(ROOT, templatePath), "utf8");
    assert(text.includes("sheet-badge-row"), `${templatePath}: badges d'en-tete manquants`);
  }
}

function validateScripts() {
  for (const script of REQUIRED_SCRIPTS) {
    assert(exists(script), `Script obligatoire introuvable: ${script}`);
  }
}

validateManifest();
validateTemplates();
validateScripts();

const packCounts = {
  "actors-slayers.db": validateDbPack("packs/actors-slayers.db", 3),
  "actors-demonists.db": validateDbPack("packs/actors-demonists.db", 2),
  "actors-demons.db": validateDbPack("packs/actors-demons.db", 4),
  "items-weapons.db": validateDbPack("packs/items-weapons.db", 40),
  "items-medical-utility.db": validateDbPack("packs/items-medical-utility.db", 10),
  "breaths-styles.db": validateDbPack("packs/breaths-styles.db", 18),
  "techniques-subclasses.db": validateDbPack("packs/techniques-subclasses.db", 16),
  "abilities-demons.db": validateDbPack("packs/abilities-demons.db", 10),
  "supplement-1934-actors.db": validateDbPack("packs/supplement-1934-actors.db", 4),
  "supplement-1934.db": validateDbPack("packs/supplement-1934.db", 1),
  "supplement-1934-breaths.db": validateDbPack("packs/supplement-1934-breaths.db", 1),
  "supplement-1934-techniques.db": validateDbPack("packs/supplement-1934-techniques.db", 1),
};

const techniquesBreathsDir = path.join(ROOT, "packs", "techniques-breaths");
assert(fs.existsSync(techniquesBreathsDir), "Pack LevelDB techniques-breaths introuvable");

console.log("System readiness OK:");
for (const [pack, count] of Object.entries(packCounts)) {
  console.log(`- ${pack}: ${count} entree(s)`);
}
