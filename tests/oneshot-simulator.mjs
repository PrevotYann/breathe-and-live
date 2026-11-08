// Encounter simulator for "Les Lanternes de Hotaru". It drives the real rules engine (actions,
// chat cards, reactions, round hooks) with seeded dice and the tactics printed in the GM guide.
import fs from "node:fs";
import { NS, fire, gm, documents, chatMessages, setProperty } from "./foundry-mocks.mjs";
import { rollBasicAttack, runRecoveryBreath, runDemonHeal, useMedicalItem, setConditionState,
  runReloadWeapon } from "../module/rules/action-engine.mjs";
import { spendCombatAction } from "../module/rules/combat-actions.mjs";
import { getTechniqueChargeState, isTechniqueChargeReady } from "../module/rules/technique-utils.mjs";
import { executeCardRequest, enqueueCardAction } from "../module/chat/persistent-cards.mjs";
import { useTechnique } from "../module/chat/use-technique.mjs";

await import("../module/breathe-and-live.mjs");
await fire("init");

const root = new URL("../", import.meta.url);
const manifest = JSON.parse(fs.readFileSync(new URL("system.json", root), "utf8"));
const packPath = manifest.packs.find(entry => entry.name === "oneshot-lanternes-hotaru").path;
export const adventure = JSON.parse(fs.readFileSync(new URL(packPath, root), "utf8").trim().split(/\r?\n/)[0]);

let random = Math.random;
export function seed(value) {
  let state = value >>> 0;
  random = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const die = faces => 1 + Math.floor(random() * faces);

export const warnings = [];
class SeededRoll {
  constructor(formula) { this.formula = String(formula); }
  async evaluate({ maximize = false } = {}) {
    const expression = this.formula.replace(/(\d*)d(\d+)(kh|kl)?/gi, (_, count, faces, keep) => {
      const rolls = Array.from({ length: Number(count || 1) }, () => (maximize ? Number(faces) : die(Number(faces))));
      if (keep === "kh") return String(Math.max(...rolls));
      if (keep === "kl") return String(Math.min(...rolls));
      return String(rolls.reduce((sum, value) => sum + value, 0));
    });
    if (!/^[\d\s.+\-*/()]+$/.test(expression)) throw new Error(`Unsupported formula: ${this.formula}`);
    this.total = Math.floor(Function(`"use strict"; return (${expression});`)());
    return this;
  }
  async toMessage(data) { return ChatMessage.create({ ...data, total: this.total }); }
}

function equip(actor, data) {
  const item = { ...structuredClone(data), id: data._id, uuid: `${actor.uuid}.Item.${data._id}`, actor,
    async update(patch) { for (const [key, value] of Object.entries(patch)) setProperty(this, key, value); return this; } };
  actor.items.push(item); documents.set(item.uuid, item); return item;
}

const actorData = id => adventure.actors.find(actor => actor._id === id);
export const IDS = {
  mizuki: "038986a70716391b", kenta: "e4340dee3670322a", chiyo: "be1def365020ee8e", itsuki: "31438a3744a3964b",
  tamaki: "3ffc020133c5e086", prowler: "e8901bf35311befc", tomoshibi: "324fb92506721e68",
};
export const PREGENS = [IDS.mizuki, IDS.kenta, IDS.chiyo, IDS.itsuki, IDS.tamaki];

export function makeActor(id, { suffix = "", name = null, patch = null } = {}) {
  const data = structuredClone(actorData(id));
  if (patch) patch(data);
  const actorId = `${data._id}${suffix}`;
  const actor = new CONFIG.Actor.documentClass(actorId, data.system, data.type);
  actor.name = name ?? data.name;
  actor.items.contents = actor.items;
  actor.items.get = itemId => actor.items.find(item => item.id === itemId);
  for (const item of data.items) equip(actor, item);
  actor.refresh();
  const token = { id: actorId, name: actor.name, actor, center: { x: 0, y: 0 }, document: { disposition: actor.type === "npcDemon" ? -1 : 1, hidden: false } };
  canvas.tokens.set(actorId, token);
  documents.set(actor.uuid, actor);
  actor.getActiveTokens = () => [token];
  return actor;
}

async function resolveCard(message, selectors, targetId = null) {
  const html = $("<div>").html(message.flavor ?? message.content);
  const buttons = html.find(".bl-card button");
  for (const selector of selectors) {
    const scoped = targetId ? html.find(`${selector}[data-target-token="${targetId}"]`) : html.find(selector);
    const index = buttons.index(scoped.first());
    if (index < 0) continue;
    const id = `sim-${game.messages.size}-${Math.random()}`;
    const stored = { ...message, id, getFlag: (namespace, key) => message.flags?.[namespace]?.[key], async update(patch) { Object.assign(this, patch); } };
    game.messages.set(id, stored);
    await enqueueCardAction(id, () => executeCardRequest({ messageId: id, buttonIndex: index, userId: gm.id }));
    return selector;
  }
  return null;
}

const hp = actor => Number(actor.system.resources.hp.value) || 0;
const rp = actor => Number(actor.system.resources.rp.value) || 0;
const actionsLeft = actor => Number(actor.system.combat.actionEconomy.remainingActions) || 0;
const isPc = actor => ["slayer", "demonist"].includes(actor.type);
const hasCondition = (actor, key) => !!actor.system.conditions?.[key]?.active;

/** Runs one action and reports whether the engine actually consumed an action. */
async function attempt(actor, fn) {
  const before = actionsLeft(actor), cards = chatMessages.length;
  await fn();
  return { spent: actionsLeft(actor) < before, cards: chatMessages.slice(cards) };
}

const expectedDamage = (formula, actor) => {
  const base = actor.system.stats.base;
  const stat = /force ou finesse/i.test(formula) ? Math.max(base.force, base.finesse) : /finesse/i.test(formula) ? base.finesse : /force/i.test(formula) ? base.force : 0;
  let total = stat;
  for (const [, count, faces] of String(formula).matchAll(/(\d*)d(\d+)/g)) total += Number(count || 1) * (Number(faces) + 1) / 2;
  return total;
};

class Encounter {
  constructor({ pcs, demons, options = {}, log = false }) {
    this.pcs = pcs; this.demons = demons; this.options = options; this.log = log;
    this.stats = { rounds: 0, demonHeals: 0, pcDodges: 0, demonDodges: 0, breathHits: 0, breathDodged: 0, damageToDemons: 0, damageToPcs: 0,
      freedFromPrison: 0, kansuke: false, events: [] };
    this.defeated = new Set(); this.fled = new Set(); this.healsUsed = new Map(); this.downedPcs = new Set();
  }
  note(text) { if (this.log) this.stats.events.push(`R${game.combat?.round ?? 0} ${text}`); }
  livingDemons() {
    for (const demon of this.demons) if (!this.defeated.has(demon) && (demon.system.death?.state === "dead" || hp(demon) <= 0)) { this.defeated.add(demon); this.note(`${demon.name} est vaincu`); }
    return this.demons.filter(demon => !this.defeated.has(demon) && !this.fled.has(demon));
  }
  standingPcs() { return this.pcs.filter(pc => hp(pc) > 0); }

  async start() {
    const order = [...this.pcs, ...this.demons].map(actor => ({ actor, init: die(20) + Number(actor.system.stats.base.vitesse || 0) }))
      .sort((a, b) => b.init - a.init);
    if (this.options.surprise) order.sort((a, b) => Number(isPc(b.actor)) - Number(isPc(a.actor)));
    const entries = order.map(({ actor }, index) => ({ id: `c${index}`, actor }));
    entries.get = id => entries.find(entry => entry.id === id);
    game.actors.contents = [...this.pcs, ...this.demons];
    canvas.tokens.placeables = game.actors.contents.map(actor => actor.getActiveTokens()[0]);
    game.combat = { id: `combat-${Math.random()}`, round: 1, turn: 0, previous: { round: 0, turn: null }, combatants: entries, turns: entries, combatant: entries[0] };
    await fire("updateCombat", game.combat, { round: 1 }, {}, gm.id);
  }
  async advance() {
    const combat = game.combat;
    combat.previous = { round: combat.round, turn: combat.turn, combatantId: combat.combatant.id };
    combat.turn = (combat.turn + 1) % combat.turns.length;
    const change = { turn: combat.turn };
    if (combat.turn === 0) change.round = ++combat.round;
    combat.combatant = combat.turns[combat.turn];
    await fire("updateCombat", combat, change, {}, gm.id);
  }
  over() {
    if (!this.livingDemons().length) return "victory";
    if (!this.standingPcs().length) return "defeat";
    return null;
  }

  // ---- PC reactions to a demon attack card --------------------------------------------------
  async pcReact(pc, card, { dangerous = false } = {}) {
    if (!card) return;
    const damage = Number(card.flags?.[NS]?.card?.damageTotal ?? card.total) || 0;
    const lethal = damage >= hp(pc);
    const wantDodge = rp(pc) > 0 && (lethal || dangerous || (damage >= 6 && rp(pc) > 2));
    const before = hp(pc);
    const used = await resolveCard(card, wantDodge ? [".bl-dodge", ".bl-takedmg"] : [".bl-takedmg"], pc.id);
    this.note(`  -> ${pc.name} ${used} (dmg ${damage}, PV ${before}→${hp(pc)}, PR ${rp(pc)})`);
    if (used === ".bl-dodge") this.stats.pcDodges++;
    this.stats.damageToPcs += Math.max(0, before - hp(pc));
    if (hp(pc) <= 0 && !this.downedPcs.has(pc)) { this.downedPcs.add(pc); this.note(`${pc.name} tombe à 0 PV`); }
  }

  // ---- Demon reactions to a PC breath / attack card ------------------------------------------
  async demonReact(demon, card, source) {
    if (!card) return;
    const damage = Number(card.flags?.[NS]?.card?.damageTotal ?? card.total) || 0;
    const boss = demon.system.class.rank === "Demon eleve";
    const isBreath = source === "breath";
    // GM guide: weak demons dodge every breath form; Tomoshibi only the ones that hurt most.
    const wantDodge = rp(demon) > 0 && isBreath && (!boss || this.options.bossDodgesAll || damage >= 12 || damage >= hp(demon));
    const before = hp(demon);
    const used = await resolveCard(card, wantDodge ? [".bl-dodge", ".bl-takedmg"] : [".bl-takedmg"], demon.id);
    if (!used) return;
    this.note(`  -> ${demon.name} ${used} (dmg ${damage}, PV ${before}→${hp(demon)}, PR ${rp(demon)})`);
    if (used === ".bl-dodge") { this.stats.demonDodges++; if (isBreath) this.stats.breathDodged++; }
    else if (isBreath) this.stats.breathHits++;
    this.stats.damageToDemons += Math.max(0, before - hp(demon));
  }

  // ---- PC turn --------------------------------------------------------------------------------
  pickDemon() { return this.livingDemons().sort((a, b) => hp(a) - hp(b))[0]; }
  async pcTurn(pc) {
    if (hp(pc) <= 0) return;
    let guard = 0;
    while (actionsLeft(pc) > 0 && !this.over() && guard++ < 4) {
      const acted = await this.pcAction(pc);
      if (!acted) break;
    }
  }
  async pcAction(pc) {
    const ally = this.pcs.find(other => other !== pc && hp(other) > 0 && hasCondition(other, "imprisoned"));
    if (hasCondition(pc, "imprisoned")) {
      // Lanterne-prison: one action and a Force DD 13 test.
      const { spent } = await attempt(pc, () => spendCombatAction(pc));
      if (spent && die(20) + pc.system.stats.base.force - 1 >= 13) { await setConditionState(pc, "imprisoned", { active: false }); this.stats.freedFromPrison++; this.note(`${pc.name} se libère`); }
      return spent;
    }
    if (ally) {
      const { spent } = await attempt(pc, () => spendCombatAction(pc));
      if (spent) { await setConditionState(ally, "imprisoned", { active: false }); this.stats.freedFromPrison++; this.note(`${pc.name} découpe la lanterne de ${ally.name}`); }
      return spent;
    }
    if (this.options.kansuke && !this.stats.kansuke && pc.id.startsWith(IDS.tamaki) && this.demons[0].id === IDS.tomoshibi && game.combat.round >= 2) {
      const { spent } = await attempt(pc, () => spendCombatAction(pc));
      if (spent) {
        this.stats.kansuke = true;
        if (die(20) < 15) { this.demons[0].sadLostAction = true; this.note("Tomoshibi est Triste (Kansuke)"); }
        return true;
      }
    }
    const target = this.pickDemon();
    if (!target) return false;
    const targetToken = target.getActiveTokens()[0];
    game.user.targets = new Set([targetToken]);

    if (pc.getFlag(NS, "mustRest")) return (await attempt(pc, () => runRecoveryBreath(pc))).spent;

    // Personal healing when badly hurt.
    if (hp(pc) <= 6) {
      const heal = pc.type === "demonist" && pc.system.resources.bdp.value >= 4 && pc.items.find(item => item.name === "Soin demoniaque");
      if (heal) { const { spent } = await attempt(pc, () => useTechnique(pc, heal, { controlledToken: pc.getActiveTokens()[0] })); if (spent) { this.note(`${pc.name} se soigne (BDP)`); return true; } }
      const medical = pc.items.find(item => item.type === "medical" && Number(item.system.quantity) > 0 && /bandage|pansement|trousse/i.test(item.name));
      if (medical) { const before = hp(pc); const { spent } = await attempt(pc, () => useMedicalItem(pc, medical, { targetActor: pc })); if (spent) { this.note(`${pc.name} utilise ${medical.name} (+${hp(pc) - before})`); return true; } }
    }

    if (pc.type === "demonist") return this.demonistAction(pc, target, targetToken);

    // Charged forms resolve on the following turn.
    const charge = await getTechniqueChargeState(pc);
    const charged = charge && isTechniqueChargeReady(charge) ? pc.items.get(charge.itemId) : null;
    const forms = pc.items.filter(item => item.type === "technique" && String(item.system.damage || "").trim())
      .filter(item => Number(item.system.costE || 0) <= pc.system.resources.e.value)
      .filter(item => !(this.options.noCharge && Number(item.system.automation?.chargeTurns || 0) > 0))
      .sort((a, b) => expectedDamage(b.system.damage, pc) - expectedDamage(a.system.damage, pc));
    if (charged) forms.unshift(charged);
    const living = this.livingDemons().length;
    for (const form of forms) {
      if (form.system.automation?.area === "allInRange" && living < 2 && Number(form.system.costE) > 4) continue;
      const startE = pc.system.resources.e.value;
      const result = await attempt(pc, () => useTechnique(pc, form, { controlledToken: pc.getActiveTokens()[0] }));
      const card = result.cards.findLast(message => message.flags?.[NS]?.card?.kind === "technique");
      if (card) {
        for (const demon of this.livingDemons()) await this.demonReact(demon, card, "breath");
        this.note(`${pc.name} : ${form.name} (E ${startE}→${pc.system.resources.e.value})`);
        return true;
      }
      if (result.spent) { this.note(`${pc.name} : ${form.name} (charge)`); return true; }
    }
    // Out of Endurance for any form: breathe (the book forbids attacking at 0 E).
    if (pc.system.resources.e.value < pc.system.resources.e.max / 2) {
      const { spent } = await attempt(pc, () => runRecoveryBreath(pc));
      if (spent) { this.note(`${pc.name} : souffle de récupération (E ${pc.system.resources.e.value})`); return true; }
    }
    const blade = pc.items.find(item => item.type === "weapon");
    const base = pc.system.stats.base;
    const { spent, cards } = await attempt(pc, () => rollBasicAttack(pc, { item: blade, targetToken, attackMode: base.finesse >= base.force ? "finesse" : "force", targetLimb: "" }));
    const card = cards.findLast(message => message.flags?.[NS]?.card?.kind === "basicAttack");
    if (card) await this.demonReact(target, card, "melee");
    return spent;
  }

  async demonistAction(pc, target, targetToken) {
    const gun = pc.items.find(item => item.type === "firearm");
    if (gun && Number(gun.system.ammo.value) <= 0) {
      const { spent } = await attempt(pc, () => runReloadWeapon(pc, gun));
      if (spent) return true;
    }
    const weapon = gun && Number(gun.system.ammo.value) > 0 ? gun : pc.items.find(item => item.type === "weapon");
    const { spent, cards } = await attempt(pc, () => rollBasicAttack(pc, { item: weapon, targetToken, attackMode: "force", targetLimb: "" }));
    const card = cards.findLast(message => message.flags?.[NS]?.card?.kind === "basicAttack");
    if (card) await this.demonReact(target, card, "ranged");
    return spent;
  }

  // ---- Demon turn -----------------------------------------------------------------------------
  pcTargets() { return this.standingPcs(); }
  async demonTurn(demon) {
    if (!this.livingDemons().includes(demon)) return;
    let guard = 0;
    while (actionsLeft(demon) > 0 && !this.over() && guard++ < 4) {
      if (demon.sadLostAction) { demon.sadLostAction = false; await spendCombatAction(demon); continue; }
      const acted = demon.id === IDS.tomoshibi ? await this.tomoshibiAction(demon) : await this.prowlerAction(demon);
      if (!acted) break;
    }
  }
  async heal(demon) {
    if (demon.system.resources.bdp.value < 2) return false;
    const before = hp(demon);
    const { spent } = await attempt(demon, () => runDemonHeal(demon));
    if (spent) { this.stats.demonHeals++; this.healsUsed.set(demon, (this.healsUsed.get(demon) ?? 0) + 1); this.note(`${demon.name} se soigne (+${hp(demon) - before})`); }
    return spent;
  }
  async natural(demon, target, key) {
    const benchmark = demon.system.demonology.benchmark;
    const item = { name: key === "bite" ? "Morsure" : "Griffure", type: "demonAbility", system: { damage: benchmark[key], range: 1.5, weaponFamily: "natural" } };
    const base = demon.system.stats.base;
    const { spent, cards } = await attempt(demon, () => rollBasicAttack(demon, { item, targetToken: target.getActiveTokens()[0], attackMode: base.finesse >= base.force ? "finesse" : "force", targetLimb: "" }));
    const card = cards.findLast(message => message.flags?.[NS]?.card?.kind === "basicAttack");
    this.note(`${demon.name} : ${item.name} sur ${target.name} (${card ? "touche" : spent ? "rate" : "impossible"})`);
    if (card) await this.pcReact(target, card);
    return spent;
  }
  async bloodArt(demon, name, target) {
    const art = demon.items.find(item => item.name.includes(name));
    if (!art || demon.system.resources.bdp.value < Number(art.system.costBdp || 0)) return false;
    // Multi-target arts ("cone" + cap) hit the GM's selected PCs, starting with the intended target.
    const cap = art.system.automation?.area === "cone" ? Math.max(1, Number(art.system.automation.targetCapBase) || 1) : 1;
    const victims = [target, ...this.pcTargets().filter(pc => pc !== target).sort(() => random() - 0.5)].slice(0, cap);
    game.user.targets = new Set(victims.map(pc => pc.getActiveTokens()[0]));
    const { spent, cards } = await attempt(demon, () => useTechnique(demon, art, { controlledToken: demon.getActiveTokens()[0] }));
    const card = cards.findLast(message => message.flags?.[NS]?.card?.kind === "technique");
    if (card) for (const victim of victims) await this.pcReact(victim, card, { dangerous: !name.includes("Feu follet") });
    if (spent) this.note(`${demon.name} : ${art.name} sur ${victims.map(pc => pc.name).join(", ")}`);
    return spent || !!card;
  }
  async prowlerAction(demon) {
    const healLimit = this.options.prowlerHeals ?? 1;
    if (hp(demon) < 15 && (this.healsUsed.get(demon) ?? 0) < healLimit && await this.heal(demon)) return true;
    const targets = this.pcTargets();
    const target = targets[Math.floor(random() * targets.length)];
    return this.natural(demon, target, random() < 0.5 ? "bite" : "claw");
  }
  async tomoshibiAction(demon) {
    const round = game.combat.round;
    const targets = this.pcTargets();
    const strongest = [...targets].sort((a, b) => Math.max(b.system.stats.base.force, b.system.stats.base.finesse) - Math.max(a.system.stats.base.force, a.system.stats.base.finesse))[0];
    const weakest = [...targets].sort((a, b) => hp(a) - hp(b))[0];
    const healLimit = this.options.bossHeals ?? 1;
    demon.planStep = (demon.planRound === round ? demon.planStep : 0) + 1; demon.planRound = round;
    if (round === 1 && demon.planStep === 1 && !this.options.miiAlreadyFreed) { await spendCombatAction(demon); this.note("Tomoshibi dépose Mii dans une lanterne"); return true; }
    if (round === 1) return this.bloodArt(demon, "Lueur", strongest);
    if (round === 2) return demon.planStep === 1 ? this.bloodArt(demon, "Feu follet", targets[Math.floor(random() * targets.length)]) : this.bloodArt(demon, "Lanterne-prison", targets[Math.floor(random() * targets.length)]);
    if (demon.planStep === 2 && hp(demon) < (this.options.bossHealBelow ?? 25) && (this.healsUsed.get(demon) ?? 0) < healLimit && await this.heal(demon)) return true;
    if (demon.planStep === 2 && random() < 0.5 && await this.bloodArt(demon, "Lanterne-prison", targets[Math.floor(random() * targets.length)])) return true;
    if (random() < 0.5 && await this.bloodArt(demon, "Feu follet", weakest)) return true;
    return this.natural(demon, weakest, "claw");
  }

  async run({ maxRounds = 15 } = {}) {
    await this.start();
    while (!this.over() && game.combat.round <= maxRounds) {
      const actor = game.combat.combatant.actor;
      this.note(`[${actor.name}] PV ${hp(actor)} PR ${rp(actor)}${actor.system.resources.e ? ` E ${actor.system.resources.e.value}` : ` BDP ${actor.system.resources.bdp?.value}`}${Object.entries(actor.system.conditions ?? {}).filter(([, c]) => c?.active).map(([k]) => " #" + k).join("")}`);
      const warnStart = warnings.length;
      try {
        if (isPc(actor)) await this.pcTurn(actor);
        else await this.demonTurn(actor);
      } catch (error) {
        this.stats.errors = [...(this.stats.errors ?? []), `${actor.name}: ${error.message}`];
      }
      for (const warning of warnings.slice(warnStart)) this.note(`   ! ${warning}`);
      // Prowlers: when one is beheaded, the other flees (GM guide, "Tactiques des démons").
      if (this.demons.length > 1 && this.defeated.size && this.livingDemons().length === 1 && this.options.fleeOnLoss !== false) {
        const survivor = this.livingDemons()[0];
        if (hp(survivor) > 0) { this.fled.add(survivor); this.note(`${survivor.name} fuit`); }
      }
      if (this.over()) break;
      await this.advance();
    }
    this.stats.rounds = game.combat.round;
    const result = this.over() ?? "timeout";
    await fire("deleteCombat", game.combat, {}, gm.id);
    game.combat = null;
    return result;
  }
}

export function resetWorld() {
  globalThis.Roll = SeededRoll;
  globalThis.Dialog = class {
    constructor(options) { this.options = options; }
    render() { const buttons = this.options.buttons; (buttons.no ?? buttons.cancel)?.callback?.($("<div>")); return this; }
    static async confirm() { return false; }
  };
  game.user = gm; game.users.activeGM = gm; game.user.targets = new Set();
  game.combat = null; game.time = { worldTime: 0 };
  game.messages.clear(); documents.clear(); canvas.tokens.clear(); chatMessages.length = 0;
  ui.notifications.info = () => {};
  ui.notifications.warn = message => warnings.push(message);
}

async function fillResources(actor) {
  const r = actor.system.resources;
  await actor.update({ "system.resources.hp.value": r.hp.max, "system.resources.rp.value": r.rp.max,
    ...(r.e ? { "system.resources.e.value": r.e.max } : {}) });
}

/** Short rest between Act 2 and Act 3: one recovery breath, a bandage on the wounded; RP do not return. */
async function shortRest(pcs) {
  for (const pc of pcs) {
    if (hp(pc) <= 0) await pc.update({ "system.resources.hp.value": 1, "system.death.state": "alive" }); // GM guide: KO in Act 2 wakes at 1 HP
    if (pc.system.resources.e) await pc.update({ "system.resources.e.value": Math.min(pc.system.resources.e.max, pc.system.resources.e.value + die(8)) });
    await pc.unsetFlag(NS, "mustRest");
    for (const key of Object.keys(pc.system.conditions ?? {})) if (pc.system.conditions[key]?.active) await setConditionState(pc, key, { active: false });
    const bandage = pc.items.find(item => item.type === "medical" && Number(item.system.quantity) > 0);
    if (bandage && hp(pc) <= pc.system.resources.hp.max - 6) await useMedicalItem(pc, bandage, { targetActor: pc });
  }
}

/** Optional stat-block override used to test alternative demon builds: { stats, hpBase, basicDamage }. */
function statPatch(build) {
  if (!build) return null;
  return data => {
    if (build.stats) Object.assign(data.system.stats.base, build.stats);
    if (build.hpBase) { data.system.resources.hp.base = build.hpBase; data.system.demonology.baseHpChoice = build.hpBase; }
    if (build.basicDamage) data.system.demonology.basicDamage = build.basicDamage;
    for (const [name, patch] of Object.entries(build.items ?? {})) {
      const item = data.items.find(entry => entry.name.includes(name));
      if (!item) throw new Error(`No item ${name}`);
      for (const [path, value] of Object.entries(patch)) setProperty(item.system, path, value);
    }
  };
}

export async function simulateOneShot(seedValue, options = {}) {
  seed(seedValue);
  resetWorld();
  const pcs = (options.party ?? PREGENS).map(id => makeActor(id));
  for (const pc of pcs) await fillResources(pc);
  const prowlers = [makeActor(IDS.prowler, { suffix: "a", name: "Rôdeur (le bossu)", patch: statPatch(options.prowler) }), makeActor(IDS.prowler, { suffix: "b", name: "Rôdeur (le long cou)", patch: statPatch(options.prowler) })];
  for (const demon of prowlers) await fillResources(demon);
  const act2 = new Encounter({ pcs, demons: prowlers, options: options.act2 ?? {}, log: options.log });
  const act2Result = await act2.run();
  const act2Pcs = pcs.map(pc => ({ name: pc.name, hp: hp(pc), rp: rp(pc), e: pc.system.resources.e?.value }));
  if (options.onlyAct2) return { act2: act2Result, act2Stats: act2.stats, act2Pcs };
  await shortRest(pcs);
  const boss = makeActor(IDS.tomoshibi, { patch: statPatch(options.boss) });
  await fillResources(boss);
  const demons3 = [boss];
  if (options.act3?.reinforcement) { const prowler = makeActor(IDS.prowler, { suffix: "c", name: "Rôdeur (renfort)", patch: statPatch(options.prowler) }); await fillResources(prowler); demons3.push(prowler); }
  const act3 = new Encounter({ pcs, demons: demons3, options: { fleeOnLoss: false, ...(options.act3 ?? {}) }, log: options.log });
  const act3Result = await act3.run();
  return { act2: act2Result, act2Stats: act2.stats, act2Pcs, act3: act3Result, act3Stats: act3.stats,
    act3Pcs: pcs.map(pc => ({ name: pc.name, hp: hp(pc), rp: rp(pc), e: pc.system.resources.e?.value })), bossHp: hp(boss) };
}

export { Encounter, resolveCard, fillResources };
