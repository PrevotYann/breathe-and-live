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

function collectJsonFiles(root) {
  if (!fs.existsSync(root)) return [];
  const files = [];
  const stack = [root];
  while (stack.length) {
    const current = stack.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(fullPath);
        continue;
      }
      if (entry.name.endsWith(".json") && !entry.name.startsWith("_")) {
        files.push(fullPath);
      }
    }
  }
  return files;
}

function validateSourceJsonPack(root) {
  const errors = [];
  const files = collectJsonFiles(root);
  for (const filePath of files) {
    let doc;
    try {
      doc = JSON.parse(fs.readFileSync(filePath, "utf8"));
    } catch (error) {
      errors.push(`${path.relative(PACKS_DIR, filePath)} JSON invalide: ${error.message}`);
      continue;
    }
    if (doc.type && doc.system && !hasSourceSection(doc)) {
      errors.push(`${path.relative(PACKS_DIR, filePath)} item "${doc.name}" sans system.sourceSection`);
    }
  }
  return { errors, count: files.length };
}

const packFiles = fs
  .readdirSync(PACKS_DIR)
  .filter((file) => file.endsWith(".db"))
  .map((file) => path.join(PACKS_DIR, file));

const sourceTechniqueReport = validateSourceJsonPack(
  path.join(PACKS_DIR, "_source", "techniques-breaths")
);
const errors = [
  ...packFiles.flatMap((filePath) => validatePack(filePath)),
  ...sourceTechniqueReport.errors,
];

if (errors.length) {
  console.error(`Validation des packs echouee (${errors.length} probleme(s)):\n`);
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  console.log(
    `Validation des packs OK (${packFiles.length} pack(s), ${sourceTechniqueReport.count} source technique(s)).`
  );
}
