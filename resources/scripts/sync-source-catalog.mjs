import fs from "node:fs";
import crypto from "node:crypto";

const packFile = new URL("../../packs/items-medical-utility.db", import.meta.url);
const featureFile = new URL("../../packs/progression-features.db", import.meta.url);
const read = file => fs.readFileSync(file, "utf8").trim().split(/\r?\n/).map(JSON.parse);
const inventory = read(packFile), features = read(featureFile);
const sourceUrl = "https://docs.google.com/presentation/d/1v8MuzzgndlBA5djtzvsO1-m5RMda2pf02qQ9LYE4N9E/edit";
function add(collection, name, type, page, text, data = {}) {
  if (collection.some(d => d.name === name)) return;
  collection.push({ _id: crypto.createHash("sha256").update(`rulebook:${name}:${type}`).digest("hex").slice(0, 16), name, type,
    img: type === "food" ? "icons/consumables/food/bowl-rice-brown.webp" : "icons/svg/book.svg", system: {
      description: text, usageNote: text, sourceSection: `Livre français — diapositive ${page}`,
      tags: ["rulebook", type], activation: ["feature", "sense"].includes(type) ? "passive" : "action",
      quantity: 1, prerequisites: {}, ruleSource: { url: sourceUrl, checkedAt: "2026-10-05", missingFields: [], approved: false }, ...data,
    }, flags: {}, ownership: { default: 0 }, folder: null, sort: 0 });
}
for (const name of ["Sushi", "Nigiri Sushi", "Makis-Sushis", "Sushi Temaki"]) add(inventory, name, "food", 104, "Restaure 5 Endurance, sans dépasser le maximum.", { enduranceGain: "5", temporaryEndurance: false });
for (const name of ["Boîte à bento", "Riz au curry", "Yakitori", "Don Buri"]) add(inventory, name, "food", 104, "Restaure 10 Endurance, sans dépasser le maximum. Seul le bento est un repas de récupération transportable.", { enduranceGain: "10", temporaryEndurance: false, portable: name === "Boîte à bento" });
for (const name of ["Ramen", "Tonkotsu Ramen", "Miso Ramen", "Tsukemen"]) add(inventory, name, "food", 104, "Ajoute 10 Endurance temporaire, consommée en premier lors des dépenses.", { enduranceGain: "10", temporaryEndurance: true });
for (const [name, price] of [["Dango",4],["Manju",5],["Senbei",3],["Taiyaki",8],["Okonomiyaki",10],["Takoyaki (6)",10]]) add(inventory, name, "food", 105, "Collation sans bonus mécanique ; les préférences des PNJ sont arbitrées par le MJ.", { price, enduranceGain: "" });
for (const [name, price, price1934, vehicleBonus] of [["Datsun Type 10",1200,40000,{dexterite:2}],["Mitsubishi modèle A",3000,100000,{all:1}]]) add(inventory, name, "vehicle", 102, "Bonus aux tests pendant la conduite. Prix distinct pour le supplément 1934.", { price, price1934, vehicleBonus });
add(inventory, "Injecteur de jet de sang démoniaque", "medical", 100, "Soins complets instantanés, sans test de Médecine. Au-delà de trois injections, effets secondaires non chiffrés à arbitrer.", { maxHeal: true, activation: "free", quantity: 1 });
for (const name of ["Vêtements civils", "Vêtements élégants", "Vêtements flashy", "Vêtements de nuit", "Vêtements agricoles", "Uniforme de garde", "Uniforme des artistes"]) add(inventory, name, "clothing", 103, "Camouflage social dans un contexte approprié ; le PNJ doit réussir un test d'Intuition pour démasquer le porteur.", { equipped: false, armorBonus: 0 });
for (const [senseType, label] of [["odorat","Sens olfactif"],["ouie","Sens auditif"],["vue","Vision"],["gout","Goût"],["toucher","Toucher"]]) for (let rank = 1; rank <= 3; rank++) add(inventory, `${label} — niveau ${rank}`, "sense", 18,
  `Perception liée à ce sens : +${rank+2}. ${rank >= 2 ? `Détection des démons à ${rank === 2 ? 9 : 18} m.` : ""} Acquisition : 3 points au niveau 1, puis étude pour les niveaux 2 et 3.`,
  { senseType, rank, perceptionBonus: rank + 2, detectionRange: rank === 1 ? 0 : rank === 2 ? 9 : 18, startingPointCost: rank === 1 ? 3 : 0, studyCost: rank > 1 ? 1 : 0 });
const traits = [
  ["Parties du corps renforcées", "reinforced",2,"Zone choisie : +2 CA et réduction de 8 dégâts ciblés. Choisir le membre sur la fiche."],
  ["Force physique accrue","strength",3,"Force en combat +3 ; Puissance brute permanente +6."],
  ["Agilité et souplesse accrues","agility",3,"Finesse en combat +3 ; Dextérité permanente +6."],
  ["Intelligence supérieure","intellect",3,"Intellect en combat +3 ; toutes les statistiques dérivées +3."],
  ["Connaissances médicales","medicine",3,"Avec du matériel médical, soin automatique de 1d6+2 PV."],
  ["Maîtrise des armes à feu","firearm",3,"Pendant votre tour, touche automatique contre une cible qui n'a pas dépensé de RP."],
  ["Esprit","spirit",1,"Une fois par combat, une forme ultime peut être utilisée sans l'Endurance requise."],
  ["Sang résistant","blood",5,"Immunité aux poisons d'un disciple de rang inférieur ou égal ; préciser le rang du poison."],
  ["Génie","genius",6,"Apprentissage deux niveaux plus tôt ; accès au Souffle du Soleil."],
  ["Estomac d'acier","stomach",4,"Démoniste : un dé supplémentaire lors de la consommation de chair."],
];
for (const [name, traitKey, startingPointCost, text] of traits) add(features, name, "feature", 19, text,
  { family: "superhuman", traitKey, startingPointCost, slotCost: 0, bonuses: {}, reinforcedLimb: traitKey === "reinforced" ? "torso" : "" });
add(features, "Augmentation des statistiques de base", "feature", 82, "Répartir 5 points dans les statistiques de base. Choix demandé lors de l'acquisition.", { rank: "Tsuchinoe", family: "progression", slotCost: 1, bonuses: {}, statChoicePoints: 5 });
add(features, "Entraînement à la flexibilité", "feature", 82, "Se référer aux caractéristiques surhumaines. Le livre ne précise pas le coût ni le trait accordé ; arbitrage MJ requis.", { rank: "Tsuchinoe", family: "progression", slotCost: 1, bonuses: {}, ruleSource: { url: sourceUrl, checkedAt: "2026-10-05", missingFields: ["trait accordé par la flexibilité"], approved: false } });
const featureRanks = {
  "unarmed-training": ["Mizunoe",80], "weapon-mods": ["Mizunoe",80], "health-boost": ["Mizunoe",80],
  "endurance-training": ["Mizunoe",80], "dual-wield": ["Mizunoe",80], "sense-training": ["Mizunoe",80],
  "combat-training": ["Kanoe",81], "cardio-training": ["Kanoe",81], "driving-license": ["Kanoe",81],
  "poison-specialist": ["Kanoe",81], "sniper-training": ["Kanoe",81], "social-mastery": ["Kanoe",81],
  "quick-weapon-swap": ["Tsuchinoe",82], "medical-training": ["Tsuchinoe",82],
  "perfect-handling": ["Hinoe",83], "firearm-training": ["Hinoe",83], "executioner": ["Hinoe",83],
  "guillotine": ["Kinoe",84], "death-shadow": ["Kinoe",84],
};
function correctFeature(doc) {
  const row = featureRanks[doc.system?.featureKey];
  if (row) {
    doc.system.rank = row[0]; doc.system.prerequisites ??= {}; doc.system.prerequisites.rank = row[0];
    doc.system.sourceSection = `Livre français — diapositive ${row[1]}`;
  }
  if (doc.system?.featureKey === "secondary-breath") {
    delete doc.system.bonuses.studySlots;
    doc.system.bonuses.secondaryBreathTraining = true;
    doc.system.usageNote = "Choisir un souffle secondaire ; acquérir une forme après chaque mission réussie. Le bouton de récompense de mission vérifie les doublons et la limite d'une forme par mission.";
  }
}
for (const doc of features) correctFeature(doc);
for (const file of [new URL("../../packs/actors-slayers.db", import.meta.url), new URL("../../packs/actors-demonists.db", import.meta.url)]) {
  const docs = read(file); for (const doc of docs) for (const item of doc.items ?? []) if (item.type === "feature") correctFeature(item);
  fs.writeFileSync(file, docs.map(d => JSON.stringify(d)).join("\n") + "\n");
}
for (const [file, docs] of [[packFile, inventory], [featureFile, features]]) fs.writeFileSync(file, docs.map(d => JSON.stringify(d)).join("\n") + "\n");
console.log(JSON.stringify({ inventory: inventory.length, features: features.length }));
