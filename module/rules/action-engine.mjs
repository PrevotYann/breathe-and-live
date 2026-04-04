import {
  CONDITION_DEFINITIONS,
  DEMON_RANKS,
  SLAYER_RANKS,
  SYSTEM_ID,
} from "../config/rule-data.mjs";

const FU = foundry.utils;
const METERS_PER_SQUARE = 1.5;

function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function getCondition(actor, key) {
  return FU.getProperty(actor, `system.conditions.${key}`) ?? {};
}

function actorSpeaker(actor) {
  return ChatMessage.getSpeaker({ actor });
}

function getRankTier(actor) {
  const rank = String(actor.system?.class?.rank ?? "");
  if (SLAYER_RANKS.includes(rank)) return SLAYER_RANKS.indexOf(rank) + 1;
  if (DEMON_RANKS.includes(rank)) return DEMON_RANKS.indexOf(rank) + 1;
  return Math.max(1, toNumber(actor.system?.class?.level, 1));
}

function distMetersChebyshev(aToken, bToken) {
  const gs = canvas?.grid?.size || 100;
  const dx = Math.abs((aToken?.center?.x ?? 0) - (bToken?.center?.x ?? 0)) / gs;
  const dy = Math.abs((aToken?.center?.y ?? 0) - (bToken?.center?.y ?? 0)) / gs;
  return Math.max(dx, dy) * METERS_PER_SQUARE;
}

function getPrimaryToken(actor) {
  return (
    actor?.getActiveTokens?.()[0] ||
    canvas?.tokens?.controlled?.find((t) => t.actor?.id === actor.id) ||
    canvas?.tokens?.placeables?.find((t) => t.actor?.id === actor.id) ||
    null
  );
}

async function pickTargetToken({ excludeTokenId = null } = {}) {
  const targets = Array.from(game.user.targets ?? []);
  if (targets.length === 1) return targets[0];

  const tokens = (canvas?.tokens?.placeables ?? []).filter(
    (token) => token.id !== excludeTokenId && !token.document.hidden
  );
  if (!tokens.length) {
    ui.notifications.warn("Aucune cible disponible.");
    return null;
  }

  const options = tokens
    .map((token) => `<option value="${token.id}">${token.name}</option>`)
    .join("");

  return new Promise((resolve) => {
    new Dialog(
      {
        title: "Choisir une cible",
        content: `
          <div class="form-group">
            <label>Cible</label>
            <select id="bl-action-target">${options}</select>
          </div>
        `,
        buttons: {
          ok: {
            label: "Valider",
            callback: (html) =>
              resolve(canvas.tokens.get(html.find("#bl-action-target").val())),
          },
          cancel: {
            label: "Annuler",
            callback: () => resolve(null),
          },
        },
        default: "ok",
      },
      { width: 360 }
    ).render(true);
  });
}

function replaceStats(expr, actor, fallback = "1") {
  const stats = actor.system?.stats ?? {};
  const base = stats.base ?? {};
  const derived = stats.derived ?? {};
  const replacements = {
    Force: toNumber(base.force),
    Finesse: toNumber(base.finesse),
    Courage: toNumber(base.courage),
    Vitesse: toNumber(base.vitesse),
    Social: toNumber(base.social),
    Intellect: toNumber(base.intellect),
    Precision: toNumber(derived.precision),
    Medecine: toNumber(derived.medecine),
  };

  let out = String(expr || fallback);
  out = out.replace(/max\(([^)]+)\)/gi, (_match, inner) => {
    const values = inner
      .split(",")
      .map((entry) => replaceStats(entry.trim(), actor, "0"))
      .map((entry) => toNumber(entry, 0));
    return String(Math.max(...values, 0));
  });

  for (const [key, value] of Object.entries(replacements)) {
    out = out.replace(new RegExp(`\\b${key}\\b`, "gi"), String(value));
  }
  return out;
}

async function spendRp(actor, cost, reason = "") {
  const path = "system.resources.rp.value";
  const current = toNumber(FU.getProperty(actor, path), 0);
  if (current < cost) {
    ui.notifications.warn(
      `${actor.name} n'a pas assez de RP (${cost} requis, ${current} disponibles).`
    );
    return false;
  }
  await actor.update({ [path]: current - cost });
  if (reason) {
    await ChatMessage.create({
      speaker: actorSpeaker(actor),
      content: `<em>${actor.name} depense ${cost} RP pour ${reason}.</em>`,
    });
  }
  return true;
}

async function applyDirectDamage(actor, amount, flavor) {
  const hpValue = toNumber(actor.system?.resources?.hp?.value, 0);
  const newHp = Math.max(0, hpValue - Math.max(0, amount));
  await actor.update({ "system.resources.hp.value": newHp });
  await ChatMessage.create({
    speaker: actorSpeaker(actor),
    content: `<em>${flavor} ${amount} degats (${hpValue} -> ${newHp} PV).</em>`,
  });
  return newHp;
}

function isDemonActor(actor) {
  const type = String(actor?.type ?? "");
  return ["demon", "npcDemon"].includes(type);
}

function demonAttackBonus(value) {
  return Math.floor(Math.max(0, toNumber(value, 0)) / 2);
}

export async function setConditionState(actor, key, patch = {}) {
  const existing = getCondition(actor, key);
  const next = {
    active: false,
    intensity: 1,
    duration: 0,
    notes: "",
    ...existing,
    ...patch,
  };
  await actor.update({ [`system.conditions.${key}`]: next });
  return next;
}

export async function setLimbState(actor, key, patch = {}) {
  const current =
    FU.getProperty(actor, `system.combat.injuries.limbs.${key}`) ?? {};
  const next = {
    injured: false,
    severed: false,
    broken: false,
    notes: "",
    ...current,
    ...patch,
  };
  await actor.update({ [`system.combat.injuries.limbs.${key}`]: next });
  return next;
}

export async function rollBasicAttack(actor, { item = null, targetToken = null } = {}) {
  if (!actor) return null;

  const attackerToken = getPrimaryToken(actor);
  const target = targetToken || (await pickTargetToken({ excludeTokenId: attackerToken?.id }));
  if (!target?.actor) return null;

  const weapon = item ?? actor.items.find((entry) =>
    ["weapon", "firearm"].includes(entry.type)
  );
  const isFirearm = ["firearm"].includes(weapon?.type) || weapon?.system?.weaponFamily === "firearm";

  const range = toNumber(weapon?.system?.range, isFirearm ? 30 : 1.5);
  if (attackerToken && distMetersChebyshev(attackerToken, target) > range) {
    ui.notifications.warn(`La cible est hors portee (${range} m).`);
    return null;
  }

  const base = actor.system?.stats?.base ?? {};
  const derived = actor.system?.stats?.derived ?? {};
  const force = toNumber(base.force);
  const finesse = toNumber(base.finesse);
  const precision = toNumber(derived.precision);

  let attackBonus = 0;
  let damageBonus = 0;
  let attackMode = "force";
  let autoHit = false;
  const useHalfDemonBonus = !!actor.system?.demonology?.halfDamageStatRule && isDemonActor(actor);

  if (isFirearm) {
    attackBonus = useHalfDemonBonus ? demonAttackBonus(finesse) : finesse;
    damageBonus = precision;
    attackMode = "finesse";
    autoHit = !!actor.system?.combat?.basicAttack?.autoHitFirearm;
  } else {
    if (finesse > force) {
      attackBonus = useHalfDemonBonus ? demonAttackBonus(finesse) : finesse;
      damageBonus = useHalfDemonBonus ? demonAttackBonus(force) : force;
      attackMode = "finesse";
    } else {
      attackBonus = useHalfDemonBonus ? demonAttackBonus(force) : force;
      damageBonus = useHalfDemonBonus ? demonAttackBonus(finesse) : finesse;
      attackMode = "force";
    }
    autoHit = !!actor.system?.combat?.basicAttack?.autoHitMelee;
  }

  attackBonus += toNumber(weapon?.system?.attackMod, 0);
  damageBonus += toNumber(weapon?.system?.damageMod, 0);

  const targetCa = toNumber(target.actor.system?.resources?.ca, 10);
  let attackRoll = null;
  let attackTotal = targetCa;

  if (!autoHit) {
    attackRoll = await new Roll(`1d20 + ${attackBonus}`).evaluate({ async: true });
    attackTotal = toNumber(attackRoll.total, 0);
  }

  const hit = autoHit || attackTotal >= targetCa;
  const baseDamageExpr = replaceStats(
    weapon?.system?.damage || actor.system?.combat?.basicAttack?.unarmedDamage || "1d4 + Force",
    actor,
    "1d4 + 0"
  );
  let damageExpr = `${baseDamageExpr} + ${damageBonus}`;

  if (actor.system?.states?.mondeTransparent) {
    damageExpr = `(${damageExpr}) * 2`;
  }
  if (actor.system?.states?.lameRouge && isDemonActor(target.actor)) {
    damageExpr = `(${damageExpr}) * 2`;
  }

  const damageRoll = hit
    ? await new Roll(damageExpr).evaluate({ async: true })
    : null;

  let newHp = target.actor.system?.resources?.hp?.value ?? 0;
  if (damageRoll) {
    newHp = Math.max(0, toNumber(newHp) - toNumber(damageRoll.total));
    await target.actor.update({ "system.resources.hp.value": newHp });
    if (actor.system?.states?.lameRouge && isDemonActor(target.actor)) {
      await target.actor.setFlag(SYSTEM_ID, "redBladeLockRound", game.combat?.round ?? 0);
    }
  }

  const attackLine = autoHit
    ? "Attaque de base auto-reussie."
    : `Jet d'attaque (${attackMode}) : ${attackRoll.total} contre CA ${targetCa}.`;
  const damageLine = damageRoll
    ? `Degats : ${damageRoll.total} (${damageExpr}).`
    : "Aucun degat.";

  await ChatMessage.create({
    speaker: actorSpeaker(actor),
    content: `
      <div class="bl-card">
        <strong>${actor.name}</strong> attaque <strong>${target.name}</strong> avec <strong>${weapon?.name || "attaque a mains nues"}</strong>.
        <div>${attackLine}</div>
        <div>${damageLine}</div>
        <div>${hit ? `PV cible : ${newHp}` : "L'attaque manque sa cible."}</div>
      </div>
    `,
  });

  return { hit, attackRoll, damageRoll };
}

export async function runRecoveryBreath(actor) {
  if (!actor) return null;
  const tier = getRankTier(actor);
  const multiplier = actor.system?.states?.marque ? 2 : 1;
  const roll = await new Roll(`${tier}d8`).evaluate({ async: true });
  const amount = toNumber(roll.total, 0) * multiplier;
  const eMax = toNumber(actor.system?.resources?.e?.max, 0);
  const eValue = toNumber(actor.system?.resources?.e?.value, 0);
  const next = clamp(eValue + amount, 0, eMax);

  const update = {
    "system.resources.e.value": next,
    [`flags.${SYSTEM_ID}.mustRest`]: false,
    [`flags.${SYSTEM_ID}.zeroStreakByCombat.${game.combat?.id}`]: 0,
  };

  if (actor.system?.states?.tcbPermanent && getCondition(actor, "bleed")?.active) {
    update["system.conditions.bleed.active"] = false;
    update["system.conditions.bleed.intensity"] = 0;
    update["system.conditions.bleed.duration"] = 0;
  }

  await actor.update(update);

  await ChatMessage.create({
    speaker: actorSpeaker(actor),
    content: `<em>${actor.name} utilise le Souffle de recuperation et regagne ${amount} E (${eValue} -> ${next}).</em>`,
  });

  return amount;
}

export async function runSprint(actor) {
  if (!actor) return null;
  const movement = toNumber(actor.system?.combat?.actionEconomy?.movementMeters, 0);
  const extra = Number((movement * 1.5).toFixed(1));
  await ChatMessage.create({
    speaker: actorSpeaker(actor),
    content: `<em>${actor.name} sprinte et peut parcourir jusqu'a ${extra} m supplementaires ce tour.</em>`,
  });
  return extra;
}

export async function runWait(actor) {
  if (!actor) return null;
  await ChatMessage.create({
    speaker: actorSpeaker(actor),
    content: `<em>${actor.name} attend et garde son action pour plus tard.</em>`,
  });
  return true;
}

export async function runRestRefresh(actor, { full = true } = {}) {
  if (!actor) return null;
  const updates = {};
  if (FU.hasProperty(actor, "system.resources.e.max")) {
    updates["system.resources.e.value"] = toNumber(actor.system.resources.e.max, 0);
  }
  if (FU.hasProperty(actor, "system.resources.rp.max")) {
    updates["system.resources.rp.value"] = toNumber(actor.system.resources.rp.max, 0);
  }
  if (full && FU.hasProperty(actor, "system.resources.hp.healableMax")) {
    updates["system.resources.hp.value"] = toNumber(actor.system.resources.hp.healableMax, 0);
  }
  await actor.update(updates);
  await ChatMessage.create({
    speaker: actorSpeaker(actor),
    content: `<em>${actor.name} recupere ses ressources lors d'un repos.</em>`,
  });
  return true;
}

export async function useMedicalItem(
  actor,
  item,
  { targetActor = null, reaction = false, maximize = false } = {}
) {
  if (!actor || !item) return null;

  const target = targetActor || actor;
  if (reaction) {
    const cost = maximize ? 2 : 1;
    const ok = await spendRp(actor, cost, "une reaction medicale");
    if (!ok) return null;
  }

  const healableMax = toNumber(target.system?.resources?.hp?.healableMax, target.system?.resources?.hp?.max ?? 0);
  const hpValue = toNumber(target.system?.resources?.hp?.value, 0);

  if (item.system?.maxHeal) {
    await target.update({ "system.resources.hp.value": healableMax });
    await ChatMessage.create({
      speaker: actorSpeaker(actor),
      content: `<em>${actor.name} soigne completement ${target.name} avec ${item.name}.</em>`,
    });
    return healableMax - hpValue;
  }

  const medBonus = reaction ? 0 : toNumber(actor.system?.stats?.derived?.medecine, 0);
  const healExpr = replaceStats(item.system?.healing || "1", actor, "1");
  const roll = await new Roll(healExpr).evaluate({ async: true });
  const amount = maximize ? Math.max(toNumber(roll.terms?.[0]?.faces, toNumber(roll.total, 0)), toNumber(roll.total, 0)) : toNumber(roll.total, 0);
  const next = clamp(hpValue + amount + medBonus, 0, healableMax);

  const update = { "system.resources.hp.value": next };
  for (const conditionKey of item.system?.removeConditions ?? []) {
    update[`system.conditions.${conditionKey}.active`] = false;
    update[`system.conditions.${conditionKey}.intensity`] = 0;
  }
  await target.update(update);

  await ChatMessage.create({
    speaker: actorSpeaker(actor),
    content: `<em>${actor.name} utilise ${item.name} sur ${target.name} et restaure ${next - hpValue} PV.</em>`,
  });

  return next - hpValue;
}

async function processConditionTurnStart(actor) {
  const conditionMap = actor.system?.conditions ?? {};
  for (const definition of CONDITION_DEFINITIONS) {
    const state = conditionMap[definition.key];
    if (!state?.active) continue;

    if (definition.turnFormula) {
      const roll = await new Roll(definition.turnFormula).evaluate({ async: true });
      await applyDirectDamage(
        actor,
        toNumber(roll.total, 0),
        `${definition.label} affecte ${actor.name} :`
      );
    }

    if (definition.key === "smoked") {
      const intensity = Math.max(1, toNumber(state.intensity, 1));
      const eValue = toNumber(actor.system?.resources?.e?.value, 0);
      const next = Math.max(0, eValue - intensity);
      await actor.update({ "system.resources.e.value": next });
      if (intensity >= 10) {
        await actor.setFlag(SYSTEM_ID, "mustRest", true);
      }
      await ChatMessage.create({
        speaker: actorSpeaker(actor),
        content: `<em>Fumee : ${actor.name} perd ${intensity} Endurance (${eValue} -> ${next}).</em>`,
      });
    }

    if (toNumber(state.duration, 0) > 0) {
      await actor.update({
        [`system.conditions.${definition.key}.duration`]: Math.max(
          0,
          toNumber(state.duration, 0) - 1
        ),
      });
    }
  }

  if (actor.system?.states?.tcbPermanent && FU.hasProperty(actor, "system.resources.e.value")) {
    const eValue = toNumber(actor.system?.resources?.e?.value, 0);
    const eMax = toNumber(actor.system?.resources?.e?.max, 0);
    if (eValue < eMax) {
      await actor.update({
        "system.resources.e.value": Math.min(eMax, eValue + 1),
      });
    }
  }
}

export function registerActionHooks() {
  Hooks.on("updateCombat", async (combat, changed) => {
    if (changed.turn === undefined) return;
    const actor = combat.combatant?.actor;
    if (!actor) return;
    await processConditionTurnStart(actor);
  });
}

export const ActionEngine = {
  registerActionHooks,
  rollBasicAttack,
  runRecoveryBreath,
  runSprint,
  runWait,
  runRestRefresh,
  spendRp,
  setConditionState,
  setLimbState,
  useMedicalItem,
};
