import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
globalThis.foundry ??= { utils: { getProperty: (o, p) => p.split(".").reduce((v, k) => v?.[k], o), duplicate: structuredClone } };
const { normalizeTechniqueItemData, normalizeBreathName } = await import("../../module/rules/technique-utils.mjs");
const source = JSON.parse(fs.readFileSync(path.join(root, "resources/rules/spreadsheet-techniques-2026-10-05.json"), "utf8"));
const rows = new Map(source.map(row => [`${normalizeBreathName(row.sheet)}:${Number(row.form)}`, row]));
const report = { sourceDate: "2026-10-05", forms: [], embeddedForms: [], packs: [] };
const apply = process.argv.includes("--apply");
function walk(folder) {
  return fs.readdirSync(folder, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(folder, e.name)) : [path.join(folder, e.name)]);
}
function reviewForm(doc) {
  const row = rows.get(`${doc.system?.breathKey}:${Number(doc.system?.form)}`);
  if (!row) return;
  const missingFields = [
    ...(!row.cost || !Number.isFinite(Number(row.cost)) ? ["coût d'endurance"] : []),
    ...(!row.damage.trim() ? ["dégâts"] : []),
    ...(!row.range.trim() ? ["portée"] : []),
  ];
  const expected = normalizeTechniqueItemData({ ...row, damageText: row.damage, damage: undefined });
  const differences = ["costE", "range", "damage"].filter(key => {
    if (key === "costE" && missingFields.includes("coût d'endurance")) return false;
    if (key === "range" && missingFields.includes("portée")) return false;
    if (key === "damage" && missingFields.includes("dégâts")) return false;
    return JSON.stringify(doc.system[key]) !== JSON.stringify(expected[key]);
  });
  if (apply) {
    for (const key of differences) doc.system[key] = expected[key];
    doc.system.ruleSource = { url: "https://docs.google.com/spreadsheets/d/1v1y8eU4frpKhp4zP40G7VzfwJngzwh03hXMGTFEQeo8/edit",
      checkedAt: report.sourceDate, missingFields, approved: doc.system.ruleSource?.approved ?? false };
    if (missingFields.length) {
      const note = `TODO-RULEBOOK-AMBIGUITY: valeurs absentes du tableur : ${missingFields.join(", ")}. Les anciennes valeurs restent éditables et nécessitent une validation MJ sur la fiche.`;
      if (!doc.system.usageNote?.includes("valeurs absentes du tableur")) doc.system.usageNote = [doc.system.usageNote, note].filter(Boolean).join("\n");
    }
  }
  return { id: doc._id, name: doc.name, breath: doc.system.breathKey, form: doc.system.form, missingFields, differences };
}
for (const file of walk(path.join(root, "packs/_source/techniques-breaths")).filter(f => f.endsWith(".json") && !path.basename(f).startsWith("_"))) {
  const doc = JSON.parse(fs.readFileSync(file, "utf8"));
  const entry = reviewForm(doc);
  if (entry) report.forms.push(entry);
  if (apply) fs.writeFileSync(file, JSON.stringify(doc, null, 2) + "\n");
}
for (const pack of JSON.parse(fs.readFileSync(path.join(root, "system.json"), "utf8")).packs.filter(p => p.path.endsWith(".db"))) {
  const file = path.join(root, pack.path);
  const docs = fs.readFileSync(file, "utf8").trim().split(/\r?\n/).map(JSON.parse);
  for (const doc of docs) {
    if (doc.type === "technique") {
      const entry = reviewForm(doc); if (entry) report.embeddedForms.push({ ...entry, pack: pack.name });
    }
    for (const item of doc.items ?? []) if (item.type === "technique") {
      const entry = reviewForm(item); if (entry) report.embeddedForms.push({ ...entry, pack: pack.name, actor: doc.name });
    }
  }
  if (apply) fs.writeFileSync(file, docs.map(d => JSON.stringify(d)).join("\n") + "\n");
  report.packs.push({ name: pack.name, count: docs.length, items: docs.map(d => ({ name: d.name, type: d.type, bonuses: d.system?.bonuses, flags: d.system?.flags })) });
}
report.forms.sort((a, b) => a.breath.localeCompare(b.breath) || a.form - b.form);
fs.writeFileSync(path.join(root, "resources/rules/rulebook-audit-data.json"), JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify({ forms: report.forms.length,
  incomplete: report.forms.filter(f => f.missingFields.length).length,
  numericDifferences: [...report.forms, ...report.embeddedForms].filter(f => f.differences.length),
  packs: report.packs.map(({ name, count }) => ({ name, count })) }, null, 2));
