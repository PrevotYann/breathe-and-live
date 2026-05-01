import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..", "..");
const PACKS = path.join(ROOT, "packs");
const ACTOR_PACKS = ["actors-slayers.db", "actors-demonists.db", "actors-demons.db"];
const OUT_ACTORS = path.join(PACKS, "supplement-1934-actors.db");

function readJsonLines(filePath) {
  if (!fs.existsSync(filePath)) return [];
  return fs
    .readFileSync(filePath, "utf8")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function isSupplement1934Actor(doc) {
  const sys = doc?.system || {};
  if (sys.supplement1934?.enabled) return true;
  if (String(sys.class?.era || "").includes("1934")) return true;
  if (String(doc?.name || "").includes("1934")) return true;
  return false;
}

function normalizeActorForSupplement(doc, index) {
  return {
    ...doc,
    system: {
      ...doc.system,
      supplement1934: {
        enabled: true,
        notes: doc.system?.supplement1934?.notes || "Entree du pack supplement 1934.",
      },
      profile: {
        ...doc.system?.profile,
        supplement1934Enabled: true,
      },
    },
    sort: index * 1000,
  };
}

const actors = ACTOR_PACKS.flatMap((file) => readJsonLines(path.join(PACKS, file)))
  .filter(isSupplement1934Actor)
  .map(normalizeActorForSupplement);

if (!actors.length) {
  throw new Error("Aucun acteur 1934 trouve dans les packs d'acteurs sources.");
}

fs.writeFileSync(OUT_ACTORS, `${actors.map((doc) => JSON.stringify(doc)).join("\n")}\n`, "utf8");
console.log(`Rebuilt ${path.relative(ROOT, OUT_ACTORS)} (${actors.length} actor(s)).`);
