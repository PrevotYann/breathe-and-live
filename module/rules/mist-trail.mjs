import { SYSTEM_ID } from "../config/rule-data.mjs";
import { getActiveBreaths } from "./breath-effects.mjs";
import { currentCombatBoundary, isSameCombatBoundary } from "./combat-state.mjs";
import { isAutomationAuthority } from "./automation-authority.mjs";

export async function beginMistTrail(actor) {
  const mist = getActiveBreaths(actor).mist;
  if (mist?.enabled && mist.specials?.nuagesTrainants) await actor.setFlag(SYSTEM_ID, "mistTrail", currentCombatBoundary());
}
export function mistContainsToken(actor, token) {
  return !!token && canvas.scene?.regions?.some(region => region.flags[SYSTEM_ID]?.kind === "mistTrail" &&
    region.shapes.some(s => token.center.x >= s.x && token.center.x <= s.x + s.width && token.center.y >= s.y && token.center.y <= s.y + s.height) &&
    (!region.flags[SYSTEM_ID].combatId || region.flags[SYSTEM_ID].combatId === game.combat?.id));
}
export async function toggleMistCover(actor) {
  const mist = getActiveBreaths(actor).mist;
  if (!mist?.enabled || !mist.specials?.nuagesTrainants) { ui.notifications.warn("Cette capacité nécessite la maîtrise du Souffle de la Brume."); return; }
  const token = actor.getActiveTokens?.()[0];
  if (!mistContainsToken(actor, token)) { ui.notifications.warn("Le personnage doit se trouver dans un voile de brume."); return; }
  const hidden = !actor.getFlag(SYSTEM_ID, "mistHidden");
  await actor.setFlag(SYSTEM_ID, "mistHidden", hidden);
  await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }), content: `<em>${actor.name} ${hidden ? "se cache dans la brume : bonus de CA doublé" : "quitte sa cachette dans la brume"}.</em>` });
}
export function registerMistHooks() {
  Hooks.on("preUpdateToken", (token, change, options) => {
    if (change.x !== undefined || change.y !== undefined) options.blMistOrigin = { x: token.x, y: token.y };
  });
  Hooks.on("updateToken", async (token, change, options, userId) => {
    if (!isAutomationAuthority(userId) || !token.actor || !options.blMistOrigin || !canvas.scene) return;
    const actor = token.actor;
    if (isSameCombatBoundary(actor.getFlag(SYSTEM_ID, "mistTrail"))) {
      const origin = options.blMistOrigin, size = canvas.grid.size;
      // V14 can animate movement while updateToken still exposes the origin.
      // The update payload contains the destination, independent of animation.
      const dx = Number(change.x ?? token.x) - origin.x, dy = Number(change.y ?? token.y) - origin.y;
      const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / size));
      const cells = new Map();
      for (let i = 0; i <= steps; i++) {
        const x = Math.floor((origin.x + dx * i / steps) / size) * size;
        const y = Math.floor((origin.y + dy * i / steps) / size) * size;
        cells.set(`${x},${y}`, { type: "rectangle", x, y, width: size, height: size, rotation: 0 });
      }
      const data = { name: `Brume — ${actor.name}`, color: "#8097af", shapes: [...cells.values()],
        levels: token.level ? [token.level] : [], visibility: CONST.REGION_VISIBILITY.ALWAYS,
        flags: { [SYSTEM_ID]: { kind: "mistTrail", combatId: game.combat.id, actorUuid: actor.uuid } } };
      await canvas.scene.createEmbeddedDocuments("Region", [data]);
    }
    if (actor.getFlag(SYSTEM_ID, "mistHidden") && !mistContainsToken(actor, token.object)) await actor.unsetFlag(SYSTEM_ID, "mistHidden");
  });
  Hooks.on("deleteCombat", async (combat, options, userId) => {
    if (!isAutomationAuthority(userId)) return;
    for (const scene of game.scenes ?? []) {
      const ids = scene.regions.filter(r => ["mistTrail", "mist"].includes(r.flags[SYSTEM_ID]?.kind) && (!r.flags[SYSTEM_ID]?.combatId || r.flags[SYSTEM_ID].combatId === combat.id)).map(r => r.id);
      if (ids.length) await scene.deleteEmbeddedDocuments("Region", ids);
    }
    for (const actor of new Set(Array.from(combat.combatants ?? [], c => c.actor).filter(Boolean))) {
      await actor.unsetFlag(SYSTEM_ID, "mistTrail"); await actor.unsetFlag(SYSTEM_ID, "mistHidden");
    }
  });
}
