import fs from "node:fs";
import crypto from "node:crypto";
const root = new URL("../../", import.meta.url);
const filename = new URL("packs/abilities-demons.db", root);
const docs = fs.readFileSync(filename,"utf8").trim().split(/\r?\n/).map(JSON.parse);
const url = "https://docs.google.com/presentation/d/1v8MuzzgndlBA5djtzvsO1-m5RMda2pf02qQ9LYE4N9E/edit";
for (const [name,rank,page] of [
  ["Enveloppe Noire","Demon faible",130], ["Enveloppe Rose","Demon eleve",130],
  ["Enveloppe Bleue","Disciple de Lune inferieure",130], ["Enveloppe Rouge","Lune inferieure",130],
  ["Bouquet","Disciple de Lune superieure",130], ["Anneau","Lune superieure",130],
  ["Incinération","Disciple de Lune superieure",124], ["Crémation","Lune superieure",124],
]) {
  const label = `Lune ${page === 130 ? "Endeuillée" : "Brûlante"} — ${name} (à compléter)`;
  if (docs.some(d => d.name === label)) continue;
  docs.push({ _id: crypto.createHash("sha256").update(label).digest("hex").slice(0,16), name: label, type: "bda", img: "icons/svg/book.svg",
    system: { description: `Attaque nommée ${name}, rang ${rank}. Le livre laisse cette entrée vide : ses effets, coûts, dégâts et portée doivent être renseignés par le MJ.`,
      sourceSection: `Livre français — diapositive ${page}`, tags: ["1934","rulebook","incomplete"], activation: "action", damage: "", range: 0, costBdp: 0,
      prerequisites: { class: "Demon", rank }, ruleSource: { url, checkedAt: "2026-10-05", missingFields: ["effets", "coûts", "dégâts", "portée"], approved: false },
      usageNote: "Données absentes de la source ; cette entrée est explicitement incomplète et ne peut pas infliger des dégâts par défaut." },
    flags: {}, ownership: { default: 0 }, folder: null, sort: 0 });
}
function annotate(doc) {
  const name = doc.name || "", system = doc.system;
  if (!system) return;
  let missingFields;
  if (/Art de Sang Demoniaque - (Petit|Grand)/.test(name)) {
    missingFields = ["profil de l'art sanguinaire (valeurs d'exemple, non chiffrées par le livre)"];
    system.usageNote = "TODO-RULEBOOK-AMBIGUITY: Petit/Grand sont des exemples personnalisables. Le livre n'impose pas leurs dégâts ou portée. Choisir un art, renseigner les valeurs et valider avec le MJ.";
  } else if (/Lune Brulante - (Brulure|Flamme ardente|Embrasement)/.test(name)) missingFields = ["portée non chiffrée dans le livre"];
  if (missingFields) system.ruleSource = { url, checkedAt: "2026-10-05", missingFields, approved: system.ruleSource?.approved || false };
}
docs.forEach(annotate);
fs.writeFileSync(filename, docs.map(d=>JSON.stringify(d)).join("\n")+"\n");
const manifest = JSON.parse(fs.readFileSync(new URL("system.json",root),"utf8"));
for (const pack of manifest.packs.filter(p=>p.type === "Actor" || p.name === "supplement-1934-techniques")) {
  const file = new URL(pack.path,root), entries = fs.readFileSync(file,"utf8").trim().split(/\r?\n/).map(JSON.parse);
  for (const doc of entries) { annotate(doc); for (const item of doc.items || []) annotate(item); }
  fs.writeFileSync(file,entries.map(d=>JSON.stringify(d)).join("\n")+"\n");
}
console.log(`Source abilities synchronized: ${docs.length}`);

// The only complete named Hashira stat block in the current supplement.
const actorFile = new URL("packs/supplement-1934-actors.db",root);
const actors = fs.readFileSync(actorFile,"utf8").trim().split(/\r?\n/).map(JSON.parse);
if (!actors.some(d=>d.name === "Yosuke Wōkuo — Hashira de l’Océan")) {
  const actorId = crypto.createHash("sha256").update("rulebook:Yosuke p119").digest("hex").slice(0,16);
  const style = JSON.parse(fs.readFileSync(new URL("packs/breaths-styles.db",root),"utf8").trim().split(/\r?\n/).find(line=>JSON.parse(line).system.key === "ocean"));
  const formRoot = new URL("packs/_source/techniques-breaths/",root);
  const forms = fs.readdirSync(formRoot,{recursive:true}).filter(f=>f.endsWith(".json") && !f.split(/[\\/]/).at(-1).startsWith("_"))
    .map(f=>JSON.parse(fs.readFileSync(new URL(f.replaceAll("\\","/"),formRoot),"utf8"))).filter(d=>d.system?.breathKey === "ocean");
  const weapon = { _id: "yosukeBasicSlash", name: "Basic Slash — Yosuke", type: "weapon", img: "icons/svg/sword.svg",
    system: { damage: "7d6", range: 1.5, isNichirin: true, weaponFamily: "katana", attackProfiles: { force: { hit: 9, damage: 9 }, finesse: { hit: 12, damage: 12 } },
      sourceSection: "Livre français — diapositive 119", description: "Bloc spécifique : +9/+12 au toucher et 7d6 +9/+12 dégâts ; ces profils fixes remplacent les bonus génériques de statistiques.", ruleSource: { url, checkedAt: "2026-10-05", missingFields: [], approved: false } }, flags: {} };
  actors.push({ _id: actorId, name: "Yosuke Wōkuo — Hashira de l’Océan", type: "npcHuman", img: "icons/svg/mystery-man.svg",
    system: { class: { type: "PNJ", rank: "Hashira", level: 11, era: "1934" }, profile: { background: "Hashira de l’Océan ; bloc source p.119. Maîtrise des mers : dégâts à distance divisés par deux sur terre, dégâts multipliés par 1,5 dans l’eau." },
      stats: { base: { force: 9, finesse: 13, courage: 7, vitesse: 12, intellect: 8, social: 4 }, derived: {} },
      resources: { hp: { value: 100, max: 100, base: 100 }, e: { value: 120, max: 120, overrideMax: 120 }, rp: { value: 25, max: 25 } },
      progression: { bonuses: {} }, combat: { oceanNpcVariant: true }, supplement1934: { enabled: true } },
    items: [weapon,style,...forms], effects: [], flags: {}, ownership: { default: 0 }, folder: null, sort: 5000 });
  fs.writeFileSync(actorFile,actors.map(d=>JSON.stringify(d)).join("\n")+"\n");
}
