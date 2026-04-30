import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..", "..");
const PACKS_DIR = path.join(ROOT, "packs");

function readJsonLines(filePath) {
  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  const docs = [];
  for (let index = 0; index < lines.length; index += 1) {
    const raw = lines[index].trim();
    if (!raw) continue;
    try {
      docs.push({ doc: JSON.parse(raw), line: index + 1 });
    } catch (error) {
      docs.push({ parseError: error, line: index + 1 });
    }
  }
  return docs;
}

function hasSourceSection(entity) {
  return !!String(entity?.system?.sourceSection || "").trim();
}

function validatePack(filePath) {
  const errors = [];
  for (const entry of readJsonLines(filePath)) {
    if (entry.parseError) {
      errors.push(`${path.basename(filePath)}:${entry.line} JSON invalide: ${entry.parseError.message}`);
      continue;
    }

    const doc = entry.doc;
    if (doc.type && doc.system && doc.items === undefined && !hasSourceSection(doc)) {
      errors.push(`${path.basename(filePath)}:${entry.line} item "${doc.name}" sans system.sourceSection`);
    }

    if (Array.isArray(doc.items)) {
      for (const item of doc.items) {
        if (!item?.system) continue;
        if (!hasSourceSection(item)) {
          errors.push(
            `${path.basename(filePath)}:${entry.line} acteur "${doc.name}" item embarque "${item.name}" sans system.sourceSection`
          );
        }
      }
    }
  }
  return errors;
}

const packFiles = fs
  .readdirSync(PACKS_DIR)
  .filter((file) => file.endsWith(".db"))
  .map((file) => path.join(PACKS_DIR, file));

const errors = packFiles.flatMap((filePath) => validatePack(filePath));

if (errors.length) {
  console.error(`Validation des packs echouee (${errors.length} probleme(s)):\n`);
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  console.log(`Validation des packs OK (${packFiles.length} pack(s)).`);
}
