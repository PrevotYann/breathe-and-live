import { isAutomationAuthority, isCombatTurnStart, combatActors } from "./automation-authority.mjs";
// Moteur d'effets temporaires (Foundry v12.343)
// - Mémorise la valeur "base" des champs persistés au 1er effet
// - La CA est modifiée pendant prepareDerivedData, sans figer sa base
// - Recalcule: base -> apply effets (ordre d'application: add/mul/set selon l'effet)
// - Expire les effets : "turnEnd" | "roundEnd" | "custom:N"
// - Restaure la base quand plus aucun effet ne touche un chemin
// - Expose: registerEffectHooks(), applyEffectsList()

const NS = "breathe-and-live";
const FU = foundry.utils;

/* --------------------- Helpers get/set --------------------- */
function fuGet(obj, path, d = undefined) {
  return FU.getProperty(obj, path) ?? d;
}
function _uuid() {
  return globalThis.foundry?.utils?.randomID?.() || Math.random().toString(36).slice(2);
}

/* --------------------- Lecture/écriture flags --------------------- */
// flags.breathe-and-live.effects : tableau d'effets
// flags.breathe-and-live.base    : objet { [path]: baseValue } pour restaurer

function _getEffects(actor) {
  return structuredClone(fuGet(actor, `flags.${NS}.effects`) ?? []);
}
async function _setEffects(actor, list) {
  await actor.setFlag(NS, "effects", list);
}

function _getBaseMap(actor) {
  return structuredClone(fuGet(actor, `flags.${NS}.base`) ?? {});
}
async function _setBaseMap(actor, baseMap) {
  await actor.setFlag(NS, "base", baseMap);
}

/* --------------------- Normalisation cible -> Actor --------------------- */
function _getActorFromTarget(target) {
  // target peut être un Token, un Actor, ou une structure {actor, token}
  if (!target) return null;
  if (target.actor) return target.actor; // Token
  if (target.isOwner !== undefined && target.update) return target; // Actor
  if (target.actor?.update) return target.actor;
  return null;
}

/* --------------------- Gestion de la "base" --------------------- */
async function _ensureBase(actor, path) {
  if (path === "system.resources.ca") return;
  const baseMap = _getBaseMap(actor);
  if (Object.prototype.hasOwnProperty.call(baseMap, path)) return;
  // mémorise la valeur actuelle comme base
  const current = fuGet(actor, path);
  baseMap[path] = Number.isFinite(current) ? current : current;
  await _setBaseMap(actor, baseMap);
}

async function _clearBaseIfUnused(actor, path) {
  // Si plus aucun effet ne touche ce path, on restaure la base et on retire l'entrée
  const list = _getEffects(actor);
  const stillUsed = list.some((e) => e.path === path);
  if (stillUsed) return;

  const baseMap = _getBaseMap(actor);
  if (!Object.prototype.hasOwnProperty.call(baseMap, path)) return;

  const baseVal = baseMap[path];
  if (path !== "system.resources.ca") await actor.update({ [path]: baseVal });

  delete baseMap[path];
  await actor.unsetFlag(NS, "base");
  if (Object.keys(baseMap).length) await _setBaseMap(actor, baseMap);
}

/* --------------------- Recalcul d’un chemin --------------------- */
async function _recomputePath(actor, path) {
  if (path === "system.resources.ca") return;
  const baseMap = _getBaseMap(actor);
  const baseKnown = Object.prototype.hasOwnProperty.call(baseMap, path);
  const baseVal = baseKnown ? baseMap[path] : fuGet(actor, path);

  const val = applyTemporaryModifiers(actor, path, baseVal);

  // Applique la valeur finale
  await actor.update({ [path]: val });
}

/* --------------------- Application d’un effet --------------------- */
/**
 * Effet attendu (exemples) :
 * { target:"target|self", path:"system.resources.ca", mode:"add|set|mul",
 *   value: -1, roll:"1d4" (option), duration:"roundEnd|turnEnd|custom:N",
 *   label:"CA -1", origin:item.uuid }
 *
 * On pousse dans flags + recalcule le path (après avoir figé la base au besoin).
 */
async function _applySingleEffect({ actor, eff }) {
  const path = eff.path;
  if (!path || typeof path !== "string") return;

  // évaluer la valeur si "roll"
  if (eff.roll && typeof eff.roll === "string") {
    const r = new Roll(eff.roll);
    await r.evaluate({ async: true });
    eff._computed = Number(r.total ?? 0) || 0;
    eff.value = eff._computed;
  }

  // 1) Mémoriser la base au premier effet sur ce path
  await _ensureBase(actor, path);

  // 2) Stocket l'effet
  const list = _getEffects(actor);
  const entry = {
    _uuid: _uuid(),
    path: path,
    mode: String(eff.mode ?? "add").toLowerCase(),
    value: Number(eff.value ?? 0) || 0,
    duration: String(eff.duration ?? "roundEnd"),
    label: eff.label ?? "Effet",
    origin: eff.origin ?? null,
    _appliedAt: Date.now(),
  };
  list.push(entry);
  await _setEffects(actor, list);

  // 3) Recompute path
  await _recomputePath(actor, path);

  return entry._uuid;
}

/* --------------------- Purge des effets expirés --------------------- */
export function applyTemporaryModifiers(actor, path, baseValue) {
  return _getEffects(actor).filter(e => e.path === path).reduce((value, effect) => {
    const delta = Number(effect.value ?? 0);
    if (!Number.isFinite(delta)) return value;
    if (effect.mode === "set") return delta;
    if (typeof value !== "number") return value;
    if (effect.mode === "mul") return value * delta;
    return value + delta;
  }, baseValue);
}

export async function purgeExpiredEffects({ when, actors }) {
  for (const actor of new Set(actors)) {
    const list = _getEffects(actor);
    const touched = new Set();
    let changed = false;
    const keep = list.filter(effect => {
      let expire = effect.duration === when;
      if (when === "roundEnd" && /^custom:(\d+)$/i.test(effect.duration)) {
        const left = Math.max(0, Number(effect.duration.split(":")[1]) - 1);
        effect.duration = `custom:${left}`;
        expire = left === 0;
        changed = true;
      }
      if (expire) {
        changed = true;
        touched.add(effect.path);
      }
      return !expire;
    });
    if (!changed) continue;
    await _setEffects(actor, keep);
    for (const path of touched) {
      if (keep.some(effect => effect.path === path)) await _recomputePath(actor, path);
      else await _clearBaseIfUnused(actor, path);
    }
  }
}

export function registerEffectHooks() {
  Hooks.on("updateCombat", async (combat, change, options, userId) => {
    if (!isAutomationAuthority(userId)) return;
    if (!isCombatTurnStart(combat, change)) return;
    const previous = combat.previous;
    if (!previous || previous.round < 1) return;
    const advanced = combat.round > previous.round ||
      (combat.round === previous.round && combat.turn > previous.turn);
    if (!advanced) return;
    const outgoing = combat.combatants.get(previous.combatantId)?.actor ??
      combat.turns?.[previous.turn]?.actor;
    if (outgoing) await purgeExpiredEffects({ when: "turnEnd", actors: [outgoing] });
    if (change.round !== undefined && combat.round > previous.round) {
      await purgeExpiredEffects({ when: "roundEnd", actors: combatActors(combat) });
    }
  });
  Hooks.on("deleteCombat", async (combat, options, userId) => {
    if (!isAutomationAuthority(userId)) return;
    const actors = combatActors(combat);
    await purgeExpiredEffects({ when: "turnEnd", actors });
    await purgeExpiredEffects({ when: "roundEnd", actors });
  });
}

/* --------------------- API: appliquer une liste d’effets --------------------- */
export async function applyEffectsList({ source, target, effects, origin }) {
  const actor = _getActorFromTarget(target);
  if (!actor) return;

  const srcName = _getActorFromTarget(source)?.name ?? source?.name ?? "Source";

  for (const eff of effects ?? []) {
    const e = { ...eff, origin: eff.origin || origin || srcName };
    try {
      await _applySingleEffect({ actor, eff: e });
    } catch (err) {
      console.error("BL | applyEffectsList error:", err, e);
    }
  }
}
