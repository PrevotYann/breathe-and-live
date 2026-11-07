// One-off data repair (v0.7.3): breath special skills now require mastering every form,
// and reaction unlocks must match the progression skills a character can have at its rank.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const PACKS = ["actors-slayers.db", "actors-demonists.db", "supplement-1934-actors.db"];

// Skill tiers (p.80-82): Entraînement au combat is a Kanoe skill (level 4+);
// Changement d'arme rapide and Formation médicale are Tsuchinoe skills (level 6+).
const REACTION_MIN_LEVEL = { counterAttack: 4, draw: 6, medical: 6 };

for (const name of PACKS) {
  const file = path.join(ROOT, "packs", name);
  if (!fs.existsSync(file)) continue;
  const lines = fs.readFileSync(file, "utf8").split(/\r?\n/).filter(Boolean).map(line => {
    const doc = JSON.parse(line);
    if (!["slayer", "demonist", "npcHuman"].includes(doc.type)) return JSON.stringify(doc);
    const level = Number(doc.system?.class?.level) || 1;
    const hashira = doc.system?.class?.rank === "Hashira";
    for (const item of doc.items ?? []) {
      if (item.type !== "breath") continue;
      item.system.masteryGranted = hashira;
      item.system.specials = {};
    }
    if (doc.system?.breaths) {
      for (const entry of Object.values(doc.system.breaths)) { entry.enabled = false; entry.specials = {}; }
    }
    const reactions = doc.system?.combat?.reactions;
    if (reactions && doc.type !== "npcHuman") {
      for (const [key, min] of Object.entries(REACTION_MIN_LEVEL)) if (level < min) reactions[key] = false;
      if (level < REACTION_MIN_LEVEL.medical && doc.system.support) doc.system.support.medicalTraining = false;
    }
    return JSON.stringify(doc);
  });
  fs.writeFileSync(file, lines.join("\n") + "\n");
  console.log(`Repaired ${name}`);
}
