// Builds packs/oneshot-lanternes-hotaru.db: one Foundry Adventure document
// holding the actors, items, journals and scenes of the one-shot. Rules items
// are copied from the system compendiums so the adventure stays in sync with
// the rule data; ids are stable so @UUID links survive the import.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { documentDefaults, withDefaults } from "../../module/data/system-models.mjs";
import { ASSETS, SLUG, docId } from "../oneshot/lanternes-hotaru/ids.mjs";
import { DEMONS, NPC_HUMANS, PREGENS } from "../oneshot/lanternes-hotaru/actors.mjs";
import { KAKUSHI_DELIVERY, PLOT_ITEMS, SOURCE_SECTION, TOMOSHIBI_ARTS } from "../oneshot/lanternes-hotaru/items.mjs";
import { GM_PAGES } from "../oneshot/lanternes-hotaru/journal-gm.mjs";
import { FORM_SUMMARIES, HANDOUT_PAGES, PREGEN_TEXT, PREGENS_INTRO, RULES_FOR_PLAYERS } from "../oneshot/lanternes-hotaru/journal-players.mjs";
import { SCENES } from "../oneshot/lanternes-hotaru/scenes.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, "system.json"), "utf8"));
const PACK_NAME = `oneshot-${SLUG}`;
const OUTPUT = path.join(ROOT, "packs", `${PACK_NAME}.db`);
const SYSTEM_ID = manifest.id;
const OWNER = 3, OBSERVER = 2, NONE = 0, INHERIT = -1;

const stats = (compendiumSource = null) => ({
  compendiumSource, duplicateSource: null, exportSource: null, coreVersion: manifest.compatibility.verified,
  systemId: SYSTEM_ID, systemVersion: manifest.version, createdTime: null, modifiedTime: null, lastModifiedBy: null,
});

// ---------------------------------------------------------------------------
// Rule sources from the system compendiums.
const sources = new Map();
for (const pack of manifest.packs) {
  if (pack.type !== "Item") continue;
  const file = path.join(ROOT, pack.path);
  const docs = pack.path.endsWith(".db")
    ? fs.readFileSync(file, "utf8").split(/\r?\n/).filter(Boolean).map(JSON.parse)
    : fs.readdirSync(path.join(ROOT, "packs/_source", pack.name), { recursive: true })
      .filter(name => name.endsWith(".json") && !path.basename(name).startsWith("_"))
      .map(name => JSON.parse(fs.readFileSync(path.join(ROOT, "packs/_source", pack.name, name), "utf8")));
  for (const doc of docs) if (!sources.has(doc._id)) sources.set(doc._id, { doc, pack: pack.name });
}

function copyItem(sourceId, idKey, overrides = {}) {
  const entry = sources.get(sourceId);
  if (!entry) throw new Error(`Objet source introuvable dans les compendiums : ${sourceId}`);
  const item = structuredClone(entry.doc);
  for (const key of ["_key", "folder", "sort", "ownership"]) delete item[key];
  item._id = docId(idKey);
  item.flags ??= {};
  item.effects ??= [];
  item._stats = stats(`Compendium.${SYSTEM_ID}.${entry.pack}.Item.${sourceId}`);
  item.system = withDefaults(item.system, overrides.system ?? {});
  if (overrides.name) item.name = overrides.name;
  return item;
}

function newItem(def, idKey) {
  return {
    _id: docId(idKey), name: def.name, type: def.type, img: def.img,
    system: withDefaults(documentDefaults("Item", def.type), def.system), effects: [], flags: {}, _stats: stats(),
  };
}

// Mirrors the bonus part of ActorSheet#_applyFeatureAcquisition: features dropped on
// a sheet write their bonuses once, so pre-built actors must carry the result.
function applyFeatureBonuses(system, item) {
  const bonuses = item.system?.bonuses ?? {};
  system.progression.bonuses.derivedStats ??= {};
  system.progression.bonuses.baseStats ??= {};
  for (const [key, amount] of Object.entries(bonuses.derivedStats ?? {})) {
    system.progression.bonuses.derivedStats[key] = (system.progression.bonuses.derivedStats[key] ?? 0) + amount;
  }
  for (const [key, amount] of Object.entries(bonuses.baseStats ?? {})) {
    system.progression.bonuses.baseStats[key] = (system.progression.bonuses.baseStats[key] ?? 0) + amount;
  }
  if (bonuses.subclass) system.class.subclass = bonuses.subclass;
}

// ---------------------------------------------------------------------------
// Actors.
const DERIVED_GROUPS = {
  force: ["athletisme", "puissanceBrute"],
  finesse: ["dexterite", "equilibre", "precision"],
  courage: ["mithridatisme", "endurance", "tolerance"],
  vitesse: ["reflexes", "agilite", "rapidite", "ruse"],
  social: ["tromperie", "performance", "intimidation", "perception", "intuition"],
  intellect: ["medecine", "nature", "sciences", "enquete", "survie"],
};

function prototypeToken(name, img, { linked, disposition, bar2 }) {
  return {
    name, actorLink: linked, disposition, width: 1, height: 1,
    texture: { src: img }, displayName: 30, displayBars: 40,
    bar1: { attribute: "resources.hp" }, bar2: { attribute: bar2 ?? null },
    sight: { enabled: false },
  };
}

function actorDoc({ key, name, type, img, system, items, folder, linked = true, disposition = 1, bar2, ownership = NONE }) {
  return {
    _id: docId(`actor:${key}`), name, type, img, system, items, effects: [], folder, sort: 0,
    ownership: { default: ownership }, flags: { [SYSTEM_ID]: { oneshot: SLUG } },
    prototypeToken: prototypeToken(name, img, { linked, disposition, bar2 }), _stats: stats(),
  };
}

function buildPregen(def, folder) {
  const system = documentDefaults("Actor", def.type);
  const { force, finesse, courage, vitesse, intellect } = def.stats;
  system.class = { type: def.type === "demonist" ? "Demoniste" : "Pourfendeur", rank: "Mizunoto", level: 1, subclass: "", era: "taisho" };
  system.stats.base = { ...def.stats };
  system.stats.derived = { ...def.derived };
  system.stats.remaining = Object.fromEntries(Object.entries(DERIVED_GROUPS).map(([base, keys]) => {
    const spent = keys.reduce((sum, k) => sum + (def.derived[k] ?? 0), 0);
    if (spent > def.stats[base]) throw new Error(`${def.name}: ${spent} points dérivés en ${base} pour ${def.stats[base]}`);
    return [base, def.stats[base] - spent];
  }));
  const endurance = 20 + courage, reactions = 5 + vitesse + intellect;
  void force; void finesse;
  Object.assign(system.resources, {
    hp: { value: 20, max: 20, healableMax: 20, base: 20, temporary: 0 },
    e: { value: endurance, max: endurance, temporary: 0 },
    rp: { value: reactions, max: reactions },
    ca: 10 + vitesse,
  });
  if (def.type === "demonist") {
    Object.assign(system.resources, { bdp: { value: def.bdp, max: 10 + courage }, demonisation: 0, demonisationMax: 10 + courage });
    system.support.recentDemonFleshRank = def.recentFlesh;
    system.support.demonistHealingReaction = true;
  }
  const equipment = def.gear.map(g => `${g.quantity > 1 ? `${g.quantity}x ` : ""}${sources.get(g.source).doc.name}`).join(", ");
  Object.assign(system.creation, {
    statMethod: "array", statArrayApplied: true,
    trainerBackground: def.trainerContext, trainerPoints: def.trainer,
    partnerBackground: def.crow.context, partnerPoints: { axis1: def.crow.opinion, axis2: 0, axis3: 0 },
    kasugaiType: def.crow.bird, kasugaiPoints: { axis1: def.crow.type, axis2: 0, axis3: 0 }, kasugaiCommands: def.crow.commands,
    sensePoints: def.points.sense, superhumanPoints: def.points.superhuman, breathFormPoints: def.points.forms,
    startingEquipment: equipment,
    notes: `Prétiré du one-shot « Les Lanternes de Hotaru ». 15 points de départ : ${def.points.sense} (sens) + ${def.points.superhuman} (traits) + ${def.points.forms} (formes).`,
  });
  Object.assign(system.profile, {
    combatStyle: def.combatStyle, trainerContext: def.trainerContext, partnerContext: def.crow.context,
    kasugaiCrow: def.crow.name, primaryWeapon: def.primaryWeapon, favoredBreath: def.favoredBreath ?? "",
    age: def.age, sex: def.sex, yen: def.yen, bag: def.bag,
  });

  const owner = `pregen:${def.key}`;
  const items = [];
  if (def.breath) {
    system.breaths[def.breath].enabled = true;
    Object.assign(system.breaths[def.breath].specials, def.specials ?? {});
    items.push(copyItem(def.breathItem, `${owner}:${def.breathItem}`));
    for (const form of def.forms) items.push(copyItem(form, `${owner}:${form}`));
  }
  for (const id of [...def.senses, ...def.traits]) {
    const reinforced = id === "ee5aa92764bbd563";
    items.push(copyItem(id, `${owner}:${id}`, reinforced ? { system: { reinforcedLimb: def.reinforcedLimb } } : {}));
  }
  if (def.subclass.feature) {
    const feature = copyItem(def.subclass.feature, `${owner}:${def.subclass.feature}`);
    applyFeatureBonuses(system, feature);
    items.push(feature);
  }
  if (def.subclass.name) system.class.subclass = def.subclass.name;
  for (const [key, amount] of Object.entries(def.subclass.derivedBonus ?? {})) {
    system.progression.bonuses.derivedStats ??= {};
    system.progression.bonuses.derivedStats[key] = (system.progression.bonuses.derivedStats[key] ?? 0) + amount;
  }
  items.push(copyItem(def.subclass.technique, `${owner}:${def.subclass.technique}`));
  for (const id of def.abilities ?? []) items.push(copyItem(id, `${owner}:${id}`));

  const gear = def.gear.map(g => copyItem(g.source, `${owner}:${g.source}`, {
    system: { ...(g.quantity ? { quantity: g.quantity } : {}), ...(g.equipped ? { equipped: true } : {}), ...(g.notes ? { notes: g.notes } : {}) },
  }));
  // Load each firearm with the matching ammunition carried by the character.
  const ammo = gear.filter(i => i.type === "ammunition");
  for (const weapon of gear.filter(i => i.type === "firearm")) {
    const match = ammo.find(a => weapon.system.ammoType && new RegExp(weapon.system.ammoType.slice(0, 6), "i").test(a.name)) ?? ammo[0];
    if (match) weapon.system.loadedAmmoId = match._id;
  }
  items.push(...gear);

  return actorDoc({ key: def.key, name: def.name, type: def.type, img: `${ASSETS}/tokens/${def.key}.webp`, system, items, folder,
    bar2: def.type === "demonist" ? "resources.bdp" : "resources.e" });
}

function buildNpc(def, folder) {
  const system = withDefaults(documentDefaults("Actor", "npcHuman"), def.system);
  system.profile.characterType = "npc-human";
  return actorDoc({ key: def.key, name: def.name, type: "npcHuman", img: def.img, system, items: [], folder, disposition: 0 });
}

function buildDemon(def, folder) {
  const system = documentDefaults("Actor", "npcDemon");
  const { force, courage, vitesse, intellect } = def.stats;
  const hp = 20 + 5 * force, rp = Math.floor((5 + vitesse + intellect) / 2), bdp = 10 * courage;
  system.class = { type: "Demon", rank: def.rank, level: 1, subclass: "", era: "taisho" };
  system.stats.base = { ...def.stats };
  Object.assign(system.resources, {
    hp: { value: hp, max: hp, healableMax: hp, base: 20, temporary: 0 },
    rp: { value: rp, max: rp }, ca: 10 + vitesse, bdp: { value: bdp, max: bdp },
  });
  Object.assign(system.demonology, { bodyType: "humanoid", baseHpChoice: 20, dangerLevel: def.danger, basicDamage: def.basicDamage, rankPackage: def.rank });
  system.npc = { ...def.npc };
  system.progression.notes = def.notes;
  const owner = `demon:${def.key}`;
  const items = def.abilities.map(id => copyItem(id, `${owner}:${id}`));
  if (def.arts) items.unshift(...TOMOSHIBI_ARTS.map(art => newItem(art, `${owner}:${art.key}`)));
  return actorDoc({ key: def.key, name: def.name, type: "npcDemon", img: def.img, system, items, folder,
    linked: def.linked, disposition: -1, bar2: "resources.bdp" });
}

// ---------------------------------------------------------------------------
// Folders.
const folders = [];
function folder(type, key, name, parent = null, color = "#2c4a6b", sort = 0) {
  const doc = { _id: docId(`folder:${type}:${key}`), name, type, folder: parent, sorting: "m", sort, color, description: "", flags: {}, _stats: stats() };
  folders.push(doc);
  return doc._id;
}
const ROOT_NAME = "Les Lanternes de Hotaru";
const actorRoot = folder("Actor", "root", ROOT_NAME);
const fPregens = folder("Actor", "pregens", "Prétirés", actorRoot, "#365e8d", 100);
const fNpcs = folder("Actor", "npcs", "PNJ", actorRoot, "#895812", 200);
const fDemons = folder("Actor", "demons", "Démons", actorRoot, "#a32e46", 300);
const itemRoot = folder("Item", "root", ROOT_NAME);
const fClues = folder("Item", "clues", "Indices", itemRoot, "#895812", 100);
const fDelivery = folder("Item", "delivery", "Livraison Kakushi", itemRoot, "#176b63", 200);
const fJournal = folder("JournalEntry", "root", ROOT_NAME);
const fScenes = folder("Scene", "root", ROOT_NAME);

const actors = [
  ...PREGENS.map(def => buildPregen(def, fPregens)),
  ...NPC_HUMANS.map(def => buildNpc(def, fNpcs)),
  ...DEMONS.map(def => buildDemon(def, fDemons)),
];
actors.forEach((actor, index) => { actor.sort = (index + 1) * 100; });

const items = [
  ...PLOT_ITEMS.map(def => ({ ...newItem(def, `item:${def.key}`), folder: fClues })),
  ...KAKUSHI_DELIVERY.map(({ source, note }) => {
    const item = copyItem(source, `item:kakushi-${source}`);
    if (note) item.system.usageNote = [item.system.usageNote, note].filter(Boolean).join(" ");
    return { ...item, folder: fDelivery, ownership: { default: NONE } };
  }),
];
items.forEach((item, index) => { item.sort = (index + 1) * 100; item.ownership ??= { default: NONE }; });

// ---------------------------------------------------------------------------
// Journals.
function page(journal, def, sort) {
  const base = {
    _id: docId(`page:${journal}:${def.key}`), name: def.name, sort, ownership: { default: INHERIT }, flags: {},
    title: { show: true, level: 1 }, system: {}, _stats: stats(),
  };
  if (def.type === "image") return { ...base, type: "image", src: def.src, image: { caption: def.caption } };
  return { ...base, type: "text", text: { content: def.content.trim(), format: 1 } };
}

function journal(key, name, pages, ownership, sort) {
  return {
    _id: docId(`journal:${key}`), name, folder: fJournal, sort, ownership: { default: ownership }, flags: {}, categories: [],
    pages: pages.map((def, index) => page(key, def, (index + 1) * 100)), _stats: stats(),
  };
}

const escape = text => String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;");
function pregenPage(def, actor) {
  const text = PREGEN_TEXT[def.key];
  const forms = actor.items.filter(i => i.type === "technique").sort((a, b) => a.system.form - b.system.form);
  const rows = forms.map(f => `<tr><td>${f.system.form}</td><td><strong>${escape(f.name)}</strong></td><td>${f.system.costE}</td><td>${escape(f.system.damage)}</td><td>${escape(f.system.rangeText || `${f.system.range} m`)}</td><td>${FORM_SUMMARIES[f._stats.compendiumSource.split(".").at(-1)] ?? ""}</td></tr>`).join("");
  const sys = actor.system;
  const table = forms.length
    ? `<h2>Tes formes de Souffle</h2><p>Elles <strong>touchent automatiquement</strong> (sauf si l'ennemi dépense un PR pour esquiver) et coûtent de l'Endurance (E).</p><table><tr><th>Forme</th><th>Nom</th><th>E</th><th>Dégâts</th><th>Portée</th><th>En clair</th></tr>${rows}</table>`
    : `<h2>Tes armes et pouvoirs</h2><ul><li><strong>Fusil de tranchée</strong> : 3d6 + Précision, portée 15 m, 5 cartouches.</li><li><strong>Wakizashi Nichirin</strong> : lame courte pour achever les démons (vise la tête).</li><li><strong>Soin démoniaque</strong> : 4 BDP, une action, te soigne selon la chair de démon mangée récemment.</li><li><strong>Réaction de soin</strong> : 1 PR pour te soigner pendant le tour d'un autre.</li></ul>`;
  return {
    key: def.key,
    name: def.name,
    content: `
<p><img src="${ASSETS}/tokens/${def.key}.webp" width="160" height="160" alt="Portrait de ${escape(def.name)}" style="float:right;margin-left:1em" /></p>
<h2>${escape(def.name)}, ${escape(def.age)}</h2>
<p><em>${text.tagline}</em> — fiche : @UUID[Actor.${actor._id}]{${escape(def.name)}}</p>
<h2>Qui tu es</h2><p>${text.who}</p>
<h2>Ta personnalité</h2><ul>${text.personality.map(p => `<li>${p}</li>`).join("")}</ul>
<h2>Ton rôle dans le groupe</h2><p>${text.role}</p>
<p><strong>PV</strong> ${sys.resources.hp.max} · <strong>CA</strong> ${sys.resources.ca} · <strong>Endurance</strong> ${sys.resources.e.max} · <strong>PR</strong> ${sys.resources.rp.max}${def.type === "demonist" ? ` · <strong>BDP</strong> ${sys.resources.bdp.value}/${sys.resources.bdp.max}` : ""}</p>
<h2>Trois conseils</h2><ul>${text.tips.map(t => `<li>${t}</li>`).join("")}</ul>
${table}
<h2>Ton corbeau</h2><p>${escape(def.crow.context)}</p>
<h2>Tes liens</h2><p>${text.links}</p>
<h2>Ton petit objectif secret</h2><p>${text.goal}</p>
<h2>Pour commencer</h2><blockquote><p>${text.line}</p></blockquote>`,
  };
}

const journals = [
  journal("gm", "Les Lanternes de Hotaru — Guide du MJ", GM_PAGES, NONE, 100),
  journal("players", "Les Lanternes de Hotaru — Aides de jeu", HANDOUT_PAGES, NONE, 200),
  journal("pregens", "Les Lanternes de Hotaru — Prétirés", [
    { key: "presentation", name: "Les cinq pourfendeurs", content: PREGENS_INTRO },
    { key: "regles-joueurs", name: "Règles express pour les joueurs", content: RULES_FOR_PLAYERS },
    ...PREGENS.map(def => pregenPage(def, actors.find(a => a._id === docId(`actor:${def.key}`)))),
  ], OBSERVER, 300),
];

// ---------------------------------------------------------------------------
// Scenes.
function scene(def, index) {
  const levelId = docId(`level:${def.key}`);
  const tokenCounts = {};
  return {
    _id: docId(`scene:${def.key}`), name: def.name, navName: def.navName, active: false, navigation: true, navOrder: index,
    thumb: def.thumb, width: def.width, height: def.height, padding: 0.1, shiftX: 0, shiftY: 0,
    initial: { x: Math.round(def.width / 2), y: Math.round(def.height / 2), scale: 0.4 }, initialLevel: levelId,
    grid: { type: 1, size: 100, style: "solidLines", thickness: 1, color: "#000000", alpha: 0.15, distance: 1.5, units: "m" },
    tokenVision: false, fog: { mode: 0 },
    environment: { darknessLevel: def.darkness, darknessLock: false, globalLight: { enabled: false } },
    levels: [{
      _id: levelId, name: "Carte", elevation: { bottom: 0, top: 6 },
      background: { src: def.src, color: "#000000", tint: "#ffffff", alphaThreshold: 0.75 },
      foreground: { src: null, tint: "#ffffff", alphaThreshold: 0.75 }, fog: { src: null },
      textures: { anchorX: 0.5, anchorY: 0.5, offsetX: 0, offsetY: 0, fit: "fill", scaleX: 1, scaleY: 1, rotation: 0 },
      visibility: { levels: [] }, sort: 0, flags: {},
    }],
    notes: def.notes.map((note, i) => ({
      _id: docId(`note:${def.key}:${i}`), entryId: docId("journal:gm"), pageId: docId(`page:gm:${note.page}`),
      x: note.x, y: note.y, elevation: 0, levels: [], sort: i, locked: false,
      texture: { src: "icons/svg/book.svg", tint: "#f2c94c", anchorX: 0.5, anchorY: 0.5, fit: "contain" },
      iconSize: 48, text: note.text, fontFamily: "", fontSize: 28, textAnchor: 1, textColor: "#ffffff", global: false, flags: {},
    })),
    tokens: def.tokens.map(token => {
      const actor = actors.find(a => a._id === docId(`actor:${token.actor}`));
      if (!actor) throw new Error(`Scène ${def.key} : acteur inconnu ${token.actor}`);
      tokenCounts[token.actor] = (tokenCounts[token.actor] ?? 0) + 1;
      return {
        ...structuredClone(actor.prototypeToken),
        _id: docId(`token:${def.key}:${token.actor}:${tokenCounts[token.actor]}`), name: token.name ?? actor.name, actorId: actor._id,
        ...(token.img ? { texture: { ...actor.prototypeToken.texture, src: token.img } } : {}),
        x: token.x, y: token.y, elevation: 0, level: levelId, hidden: !!token.hidden, locked: false, sort: 0, flags: {},
      };
    }),
    drawings: [], lights: [], sounds: [], regions: [], tiles: [], walls: [],
    journal: docId("journal:gm"), journalEntryPage: docId(`page:gm:${def.notes[0].page}`), weather: "",
    folder: fScenes, sort: (index + 1) * 100, ownership: { default: NONE }, flags: {}, _stats: stats(),
  };
}
const scenes = SCENES.map(scene);

// ---------------------------------------------------------------------------
const adventure = {
  _id: docId("adventure"),
  name: "Les Lanternes de Hotaru — one-shot d'initiation",
  img: `${ASSETS}/cover.webp`,
  caption: "<p>Un one-shot d'initiation pour 3 à 5 joueurs débutants (3 à 4 heures), avec 5 prétirés de rang Mizunoto.</p>",
  description: `<p>Dans le village de montagne de Hotaru-mura, des gens disparaissent la nuit en suivant une lumière bleue. Ce soir, c'est la fête des lanternes. Cinq jeunes pourfendeurs sont envoyés pour enquêter, sauver les disparus et affronter le Lanternier.</p>
<p><strong>Contenu :</strong> guide du MJ pas à pas, aides de jeu, 5 prétirés, 8 PNJ, 2 démons, 3 cartes avec épingles, objets d'indice et livraison Kakushi.</p>
<p><strong>Import :</strong> cliquez sur « Importer l'aventure ». Tout est rangé dans des dossiers « ${ROOT_NAME} ». Commencez par le journal « Guide du MJ ».</p>
<p><em>Illustrations originales générées par IA, inspirées de l'animation japonaise. Source : ${SOURCE_SECTION}.</em></p>`,
  actors, items, journal: journals, scenes,
  combats: [], tables: [], macros: [], cards: [], playlists: [], folders,
  folder: null, sort: 0, flags: { [SYSTEM_ID]: { oneshot: SLUG } }, _stats: stats(),
};

fs.writeFileSync(OUTPUT, `${JSON.stringify(adventure)}\n`, "utf8");
console.log(`Wrote ${path.relative(ROOT, OUTPUT)} — ${actors.length} acteurs, ${items.length} objets, ${journals.length} journaux (${journals.reduce((n, j) => n + j.pages.length, 0)} pages), ${scenes.length} scènes.`);
