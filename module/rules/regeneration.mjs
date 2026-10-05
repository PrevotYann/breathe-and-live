import { SYSTEM_ID } from "../config/rule-data.mjs";
import { canHealActor } from "./combat-state.mjs";

// TODO-RULEBOOK-AMBIGUITY: p. 72/111 describes slow/rank-dependent regrowth
// without a numeric duration. The GM supplies it; there is no invented rate.
export async function promptRegenerationDuration({ continuous = false } = {}) {
  return new Promise(resolve => new Dialog({
    title: "Durée de repousse — arbitrage MJ",
    content: `<p>Le livre ne chiffre pas cette durée. Indiquez le nombre de tours du porteur avant la repousse${continuous ? " (au moins 1)" : " ; 0 signifie immédiate"}.</p><input name="regrowTurns" type="number" min="${continuous ? 1 : 0}" placeholder="Tours" />`,
    buttons: { apply: { label: "Appliquer", callback: html => {
      const raw = String(html.find('[name="regrowTurns"]').val() ?? "").trim();
      const turns = Number(raw);
      resolve(raw && Number.isInteger(turns) && turns >= (continuous ? 1 : 0) ? turns : null);
    } }, cancel: { label: "Annuler", callback: () => resolve(null) } },
    close: () => resolve(null),
  }).render(true));
}

export async function restoreLimbs(actor, limbs) {
  const update = {};
  for (const limb of limbs) {
    for (const key of ["injured", "severed", "broken"]) update[`system.combat.injuries.limbs.${limb}.${key}`] = false;
    update[`system.combat.injuries.limbs.${limb}.notes`] = "";
    update[`system.combat.injuries.targetedDamage.${limb}`] = 0;
  }
  if (Object.keys(update).length) await actor.update(update);
}

export async function startRegeneration(actor, { limbs, turns, continuous = false, demonisationPerTurn = 0, sourceName = "Repousse" }) {
  if (!canHealActor(actor)) return null;
  if (!Number.isInteger(turns) || turns < 0 || (!limbs.length && !continuous)) return null;
  if (!turns) { await restoreLimbs(actor, limbs); return limbs; }
  await actor.update({ "system.combat.regeneration": {
    active: true, limbs, remainingTurns: turns, cycleTurns: turns, continuous, demonisationPerTurn, sourceName,
  } });
  return limbs;
}

export async function tickRegeneration(actor) {
  const state = actor.system?.combat?.regeneration;
  if (!state?.active || !canHealActor(actor)) return;
  const left = Math.max(0, Number(state.remainingTurns) - 1);
  const gain = actor.type === "demonist" ? Number(state.demonisationPerTurn) || 0 : 0;
  const update = { "system.combat.regeneration.remainingTurns": left };
  if (gain) update["system.resources.demonisation"] = (Number(actor.system?.resources?.demonisation) || 0) +
    gain * (actor.system?.support?.activeDemonistMedicine ? 0.5 : 1);
  if (!left) {
    if (state.continuous) {
      update["system.combat.regeneration.remainingTurns"] = Math.max(1, Number(state.cycleTurns) || 1);
    } else update["system.combat.regeneration.active"] = false;
  }
  await actor.update(update);
  if (!left) {
    const limbs = state.continuous ? Object.entries(actor.system?.combat?.injuries?.limbs ?? {})
      .filter(([, part]) => part.severed || part.broken || part.injured).map(([key]) => key) : state.limbs;
    await restoreLimbs(actor, limbs);
  }
  await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }),
    content: `<em>${actor.name} — ${state.sourceName} : ${left ? `${left} tour(s) restant(s)` : "repousse terminée"}${gain ? ` ; démonisation +${gain * (actor.system?.support?.activeDemonistMedicine ? 0.5 : 1)}` : ""}.</em>` });
}
