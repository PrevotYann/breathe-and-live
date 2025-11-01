// Moteur d'effets temporaires (Foundry v12.343)
// - Mémorise la valeur "base" par chemin (ex: system.resources.ca) au 1er effet
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
function fuSet(obj, path, val) {
  return FU.setProperty(obj, path, val);
}
function _uuid() {
  return randomID?.() || Math.random().toString(36).slice(2);
}

/* --------------------- Lecture/écriture flags --------------------- */
// flags.breathe-and-live.effects : tableau d'effets
// flags.breathe-and-live.base    : objet { [path]: baseValue } pour restaurer

function _getEffects(actor) {
  return fuGet(actor, `flags.${NS}.effects`) ?? [];
}
async function _setEffects(actor, list) {
  await actor.setFlag(NS, "effects", list);
}

function _getBaseMap(actor) {
  return fuGet(actor, `flags.${NS}.base`) ?? {};
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
  await actor.update({ [path]: baseVal });

  delete baseMap[path];
  await _setBaseMap(actor, baseMap);
}

/* --------------------- Recalcul d’un chemin --------------------- */
async function _recomputePath(actor, path) {
  const baseMap = _getBaseMap(actor);
  const baseKnown = Object.prototype.hasOwnProperty.call(baseMap, path);
  const baseVal = baseKnown ? baseMap[path] : fuGet(actor, path);

  // On ne touche pas aux non-nombres : si la base est non-numérique, on tente "set" seulement
  let val = baseVal;

  // Tous les effets actifs sur ce path
  const effects = _getEffects(actor).filter((e) => e.path === path);

  // Application dans l'ordre d'enregistrement
  for (const e of effects) {
    const mode = String(e.mode ?? "add").toLowerCase();
    const delta = Number(e.value ?? 0) || 0;

    if (mode === "add") {
      if (typeof val === "number") val = Number(val) + delta;
    } else if (mode === "mul") {
      if (typeof val === "number") val = Number(val) * Number(delta || 1);
    } else if (mode === "set") {
      val = delta; // remplace la valeur courante
    }
  }

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
async function purgeExpiredEffects({ when }) {
  // when = "turnEnd" | "roundEnd" | "manual"
  const touched = new Map(); // actor.id -> Set(paths)

  for (const actor of game.actors.contents) {
    const list = _getEffects(actor);
    if (!list.length) continue;

    const keep = [];
    for (const e of list) {
      let expire = false;

      if (when === "turnEnd" && e.duration === "turnEnd") expire = true;

      if (when === "roundEnd") {
        if (e.duration === "roundEnd") expire = true;
        else if (
          typeof e.duration === "string" &&
          /^custom:(\d+)$/i.test(e.duration)
        ) {
          const m = e.duration.match(/^custom:(\d+)$/i);
          const left = Math.max(0, Number(m?.[1] || 0) - 1);
          e.duration = left > 0 ? `custom:${left}` : "expired";
          expire = e.duration === "expired";
        }
      }

      if (!expire) keep.push(e);
      else {
        if (!touched.has(actor.id)) touched.set(actor.id, new Set());
        touched.get(actor.id).add(e.path);
      }
    }

    if (keep.length !== list.length) {
      await _setEffects(actor, keep);
    }
  }

  // Recompute chaque path modifié; si plus d’effet sur un path → restore base & clear
  for (const [actorId, paths] of touched.entries()) {
    const actor = game.actors.get(actorId);
    if (!actor) continue;
    for (const p of paths) {
      const still = _getEffects(actor).some((e) => e.path === p);
      if (still) {
        await _recomputePath(actor, p);
      } else {
        await _clearBaseIfUnused(actor, p);
      }
    }
  }
}

/* --------------------- Hooks Combat --------------------- */
export function registerEffectHooks() {
  // Fin de tour → purge turnEnd
  Hooks.on("updateCombat", async (combat, change) => {
    if (change.turn !== undefined) {
      await purgeExpiredEffects({ when: "turnEnd" });
    }
    // Fin de round → purge roundEnd + custom:N (décrément)
    if (change.round !== undefined) {
      await purgeExpiredEffects({ when: "roundEnd" });
    }
  });

  // Fin de combat → comme fin de round
  Hooks.on("deleteCombat", async () => {
    await purgeExpiredEffects({ when: "roundEnd" });
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
