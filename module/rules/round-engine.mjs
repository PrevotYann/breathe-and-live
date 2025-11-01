const FU = foundry.utils;
const SYSTEM_ID = "breathe-and-live";

/**
 * Convention d'effets attendue (posés via your effects-engine/applyEffectsList) :
 * Effet = {
 *   target: "self" | "target",
 *   path:   "system.resources.ca" | "...",
 *   mode:   "add" | "mul" | "set",
 *   value?: number,       // pour add/set
 *   roll?:  string,       // ex "1d4" (résolu lors de l'application initiale)
 *   label?: string,
 *   duration: "turnEnd" | "roundEnd" | "custom:N"
 *   // Internes/flags lors de l'application:
 *   _computed?: number,   // valeur déjà évaluée (ex. résultat de 1d4)
 *   _remaining?: number,  // pour custom:N, nombre de tours restants
 *   _uuid?: string,       // id interne
 * }
 *
 * On s'attend à ce que applyEffectsList() stocke ces effets sur l'Actor cible
 * dans une structure comme flag: game.settings flag ou actor flag:
 * actor.flags["breathe-and-live"].effects = [Effet, Effet, ...]
 */

function _getEffects(actor) {
  return FU.getProperty(actor, `flags.${SYSTEM_ID}.effects`) ?? [];
}
async function _setEffects(actor, list) {
  return actor.setFlag(SYSTEM_ID, "effects", list);
}

/** Nettoie les effets expirés et renvoie la liste conservée */
function _purgeExpired(effects = []) {
  return effects.filter((eff) => {
    if (!eff) return false;
    const d = String(eff.duration || "").toLowerCase();
    if (d === "expired") return false;
    return true;
  });
}

/** Marque comme expiré un effet donné (sans “revert” ici : le revert se fait au moment de l’expiration) */
function _expire(eff) {
  eff.duration = "expired";
  return eff;
}

/** Revert “léger” — on ne connaît pas la valeur précédente → on applique l’inverse pour add/mul/set.
 *  ⚠️ Hypothèse : applyEffectsList a appliqué l’effet à l’instant T en modifiant l’Actor.
 *  Ici, à l’expiration, on tente un revert simple.
 */
function _revertEffect(actor, eff) {
  const path = eff.path;
  if (!path || typeof path !== "string") return;
  const mode = String(eff.mode || "add").toLowerCase();
  const current = Number(FU.getProperty(actor, path) ?? 0) || 0;
  const val = Number(eff._computed ?? eff.value ?? 0) || 0;

  if (mode === "add") {
    // inverse d'un add
    const newVal = current - val;
    return actor.update({ [path]: newVal });
  } else if (mode === "mul") {
    // Pour mul on ne peut pas “diviser” proprement sans savoir l’état initial, on ignore par défaut
    // (Option : stocker eff._snapshot au moment de l’application initiale pour revert exact)
    return;
  } else if (mode === "set") {
    // Pas de snapshot => on ne peut pas savoir l’ancienne valeur : on ne revert pas
    // (Option recommandée : stocker eff._before à l’application initiale)
    return;
  }
}

/** Tick “fin de tour” (après qu’un token a joué) */
async function onTurnEnd(combat, update, options, userId) {
  // Combatant en cours (celui qui vient de finir) :
  const prev = combat.previous || {};
  const cbtId =
    prev.turn !== undefined ? combat.turns?.[prev.turn]?.actorId : null;

  // On décrémente tous les acteurs présents (plus simple) :
  const actors = game.actors?.contents ?? [];
  for (const actor of actors) {
    let list = _getEffects(actor);
    if (!Array.isArray(list) || !list.length) continue;

    const toExpire = [];
    for (const eff of list) {
      const d = String(eff.duration || "").toLowerCase();

      if (d === "turnend") {
        // expire immédiatement à la fin de ce tour (peu importe qui a joué dans cette version simple)
        toExpire.push(eff);
      } else if (d.startsWith("custom:")) {
        // custom:N => décrémente à chaque fin de tour
        const m = d.match(/^custom:(\d+)$/i);
        const rem = Number(eff._remaining ?? (m ? m[1] : 0)) || 0;
        if (rem <= 1) {
          toExpire.push(eff);
        } else {
          eff._remaining = rem - 1;
        }
      }
    }

    // Appliquer les expirations (revert simple) puis marquer expired
    for (const eff of toExpire) {
      try {
        await _revertEffect(actor, eff);
      } catch (e) {
        console.warn("BL RoundEngine revert(turnEnd) err:", e);
      }
      _expire(eff);
    }

    list = _purgeExpired(list);
    await _setEffects(actor, list);
  }
}

/** Tick “fin de round” (quand le round s’incrémente) */
async function onRoundEnd(combat, update, options, userId) {
  // A la fin du round : on expire tous les "roundEnd"
  const actors = game.actors?.contents ?? [];
  for (const actor of actors) {
    let list = _getEffects(actor);
    if (!Array.isArray(list) || !list.length) continue;

    const toExpire = list.filter(
      (eff) => String(eff.duration || "").toLowerCase() === "roundend"
    );

    for (const eff of toExpire) {
      try {
        await _revertEffect(actor, eff);
      } catch (e) {
        console.warn("BL RoundEngine revert(roundEnd) err:", e);
      }
      _expire(eff);
    }

    list = _purgeExpired(list);
    await _setEffects(actor, list);
  }
}

/** Enregistrement des hooks Foundry (v12.343 ok) */
export function registerRoundEngineHooks() {
  // Quand le combat change de tour / round
  Hooks.on("updateCombat", (combat, update, options, userId) => {
    // Fin de tour : Foundry met à jour turn/round. On compare previous vs courant.
    if (combat.previous) {
      const prev = combat.previous;
      // changement de tour -> tick turnEnd
      if (
        prev.turn !== combat.turn ||
        prev.combatantId !== combat.combatantId
      ) {
        onTurnEnd(combat, update, options, userId);
      }
      // changement de round -> tick roundEnd
      if (prev.round !== combat.round) {
        onRoundEnd(combat, update, options, userId);
      }
    }
  });

  // En cas de sortie de combat : on pourrait purger certains effets temporaires si tu le souhaites
  Hooks.on("deleteCombat", async () => {
    // Optionnel : ne rien faire (on laisse les effets persister hors combat)
  });
}
