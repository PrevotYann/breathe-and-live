import fs from "node:fs";
import crypto from "node:crypto";
const root = new URL("../../", import.meta.url);
const file = new URL("packs/items-weapons.db", root);
const docs = fs.readFileSync(file, "utf8").trim().split(/\r?\n/).map(JSON.parse);
const known = {
  "Katana Nichirin standard": ["1d6",1.5,23], "Lame courbee Nichirin": ["1d8",1.5,23],
  "Wakizashi Nichirin": ["1d4",1.5,23], "Pointe d'aiguille Nichirin": ["1d4",1.5,23],
  "Lames dentelees Nichirin": ["2d6",1.5,23], "Masse Nichirin": ["1d12",9,23],
  "Masse et chaine Nichirin": ["1d12",9,23], "Fouet Nichirin": ["1d10",9,23],
  "Double epee-chaine Nichirin": ["2d10",3,23], "Katana torsade Nichirin": ["1d8",1.5,62],
  "Odachi Nichirin": ["1d12",3,90], "Fusil de tranchee": ["3d6 + Precision",15,23],
  "Pistolet standard": ["1d8 + Precision",18,91], "Mauser C96": ["1d8 + Precision",18,91],
  "Nambu Type 14": ["1d8 + Precision",18,91], "Colt M1911": ["1d8 + Precision",18,91],
  "Type 38 Arisaka": ["1d12 + Precision",36,91], "Winchester 1895": ["1d12 + Precision",36,91],
  "Mauser 98k": ["1d12 + Precision",36,91], "Arc": ["1d8 + Precision",12,95],
  "Arbalete": ["1d12 + Precision",18,95], "Shuriken": ["1d4 + Precision",9,95],
  "Kunai": ["1d6 + Precision",1.5,95], "Kunai de glycine": ["1d6 + Precision",1.5,94],
  "Lance-flammes": ["3d6",6,94], "Molotov": ["1d8",9,94], "Grenade": ["20",12,94],
};
const source = (page, missingFields = []) => ({ url: "https://docs.google.com/presentation/d/1v8MuzzgndlBA5djtzvsO1-m5RMda2pf02qQ9LYE4N9E/edit", checkedAt: "2026-10-05", missingFields, approved: false, page });
function apply(doc) {
  if (doc.type === "modification") {
    doc.system.attackMod = 0; doc.system.damageMod = 0; doc.system.rangeMod = 0;
    doc.system.ruleSource = source(93);
    if (doc.name === "Lunette") { doc.system.rangeMultiplier = 1.5; doc.system.aimedFinesseBonus = 1; doc.system.rulesText = "Portée +50 %, Finesse +1 lors d'un tir visé."; }
    if (doc.name === "Crosse renforcee") { doc.system.precisionBonus = 1; doc.system.rulesText = "Précision +1 avec cette arme."; }
    if (doc.name === "Silencieux") { doc.system.stealthBonus = 2; doc.system.rulesText = "Discrétion +2 avec cette arme."; }
    if (doc.name === "Baionnette") { doc.system.meleeDamage = "1d8"; doc.system.rulesText = "Attaque de mêlée : 1d8 dégâts."; }
    if (doc.name === "Chargeur etendu") { doc.system.capacityMod = 0; doc.system.capacityMultiplier = 2; doc.system.rulesText = "Double la capacité du chargeur."; }
  }
  if (doc.name === "Munitions pointe creuse") { doc.system.damageBonus = "3"; doc.system.description = "Ajoute 3 dégâts. Choisir cette réserve sur l'arme, puis recharger."; doc.system.ruleSource = source(93); }
  const values = known[doc.name];
  if (values) {
    Object.assign(doc.system, { damage: values[0], range: values[1], attackMod: 0, damageMod: 0, sourceSection: `Livre français — diapositive ${values[2]}`, ruleSource: source(values[2]) });
    if (/Kunai/.test(doc.name)) { doc.type = "projectile"; doc.system.rangeFormula = "1.5 * Force"; }
    if (doc.name === "Kunai de glycine") doc.system.poisonProfile = "glycineWeakening";
    if (doc.name === "Odachi Nichirin") { doc.system.extraDamageDice = 1; doc.system.chargeTurns = 1; doc.system.rangeBonus = 1.5; }
    if (doc.name === "Molotov") { doc.system.radius = 4.5; doc.system.periodicDamage = "1d8"; doc.system.periodicTurns = 3; doc.system.saveDc = 0; doc.system.ruleSource = source(94, ["portée de lancer"]); }
    if (doc.name === "Grenade") { doc.system.radius = 3; doc.system.saveDc = 0; doc.system.usageNote = "Grenade Type-97 : 20 dégâts, rayon 3 m. La portée du lancer est à fixer par le MJ."; doc.system.ruleSource = source(94, ["portée de lancer"]); }
    if (doc.name === "Lance-flammes") { Object.assign(doc.system, { area: "cone", saveDerived: "dexterite", saveDc: 14, burnFormula: "1d6", burnDuration: 3 }); doc.system.ammo = { value: 10, max: 10, reload: "Remplir le réservoir." }; }
    if (doc.name === "Double epee-chaine Nichirin") doc.system.usageNote = "TODO-RULEBOOK-AMBIGUITY: portée 3 m p.23, contre 1,5 m p.66. La table générale p.23 est conservée et éditable.";
  }
  if (["Naginata Nichirin", "Cimeterre Nichirin", "Patta Nichirin", "Epee crochet Nichirin"].includes(doc.name)) {
    doc.system.ruleSource = source(90, ["dégâts et avantages/inconvénients (TBD)"]);
    doc.system.usageNote = "TODO-RULEBOOK-AMBIGUITY: arme marquée TBD dans le livre ; les anciennes valeurs requièrent validation MJ.";
  }
  if (doc.name === "Bombe") {
    Object.assign(doc.system, { activation: "bonus", damageDiceFormula: "1d10 + Dexterite", saveDc: 0, damage: "1d4", ruleSource: source(94, ["difficulté d'allumage", "portée et rayon de la bombe"]) });
  }
}
docs.forEach(apply);
if (!docs.some(d => d.name === "Grenade US MK2")) {
  const doc = structuredClone(docs.find(d => d.name === "Grenade"));
  doc._id = crypto.createHash("sha256").update("rulebook:Grenade US MK2").digest("hex").slice(0,16);
  doc.name = "Grenade US MK2"; doc.system.damage = "25"; doc.system.usageNote = "Grenade US MK2 : 25 dégâts, rayon 3 m. Portée du lancer à arbitrer.";
  docs.push(doc);
}
fs.writeFileSync(file, docs.map(d => JSON.stringify(d)).join("\n") + "\n");
const manifest = JSON.parse(fs.readFileSync(new URL("system.json",root), "utf8"));
for (const pack of manifest.packs.filter(p => p.type === "Actor")) {
  const filename = new URL(pack.path,root);
  const actors = fs.readFileSync(filename,"utf8").trim().split(/\r?\n/).map(JSON.parse);
  for (const actor of actors) (actor.items ?? []).forEach(apply);
  fs.writeFileSync(filename,actors.map(d=>JSON.stringify(d)).join("\n")+"\n");
}
console.log(`Source weapons synchronized: ${docs.length}`);
