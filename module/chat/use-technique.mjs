import { applyPreHit, applyOnHit } from "../rules/breath-effects.mjs";
import { applyEffectsList } from "../rules/effects-engine.mjs";
import {
  buildReactionTargetRow,
  canInteractWithToken,
  consumeDeflectStance,
  resolveCanvasToken,
} from "./reaction-card.mjs";
import {
  actorHasBreath,
  buildFormulaWithActorStats,
  clearTechniqueCharge,
  getPreviousRoundDamageTaken,
  getTechniqueChargeState,
  getTechniqueCooldown,
  isTechniqueChargeReady,
  normalizeBreathName,
  noteActorDamageTaken,
  setTechniqueCooldown,
  startTechniqueCharge,
} from "../rules/technique-utils.mjs";

const FU = foundry.utils;
const SYSTEM_ID = "breathe-and-live";
const METERS_PER_SQUARE = 1.5;

function distMetersChebyshev(aToken, bToken) {
  if (!aToken?.center || !bToken?.center) return Number.POSITIVE_INFINITY;
  const gs = canvas.grid.size || 100;
  const dx = Math.abs(aToken.center.x - bToken.center.x) / gs;
  const dy = Math.abs(aToken.center.y - bToken.center.y) / gs;
  return Math.max(dx, dy) * METERS_PER_SQUARE;
}

async function pickTarget(excludeTokenId = null) {
  const targets = Array.from(game.user.targets ?? []);
  if (targets.length === 1) return targets[0];

  const others = canvas.tokens.placeables.filter(
    (token) => token.id !== excludeTokenId && !token.document.hidden && token.actor
  );
  if (!others.length) {
    ui.notifications.warn("Aucune cible disponible.");
    return null;
  }

  const options = others
    .map((token) => `<option value="${token.id}">${token.name}</option>`)
    .join("");

  return new Promise((resolve) => {
    new Dialog(
      {
        title: "Choisir une cible",
        content: `
          <div class="form-group">
            <label>Cible</label>
            <select id="bl-target">${options}</select>
          </div>
        `,
        buttons: {
          ok: {
            label: "Valider",
            callback: (html) => resolve(canvas.tokens.get(html.find("#bl-target").val())),
          },
          cancel: {
            label: "Annuler",
            callback: () => resolve(null),
          },
        },
        default: "ok",
      },
      { width: 420 }
    ).render(true);
  });
}

async function placeMistTemplate(targetToken) {
  if (!canvas.scene) return;
  await canvas.scene.createEmbeddedDocuments("MeasuredTemplate", [
    {
      t: "circle",
      user: game.user.id,
      x: targetToken.center.x,
      y: targetToken.center.y,
      distance: 3,
      fillColor: "#7da0ff",
      borderColor: "#7da0ff",
      hidden: false,
      flags: {
        [SYSTEM_ID]: { kind: "mist", expireRound: game.combat?.round ?? null },
      },
    },
  ]);
}

async function simpleDash(attackerToken, distanceMeters = 6) {
  const target = Array.from(game.user.targets ?? [])[0];
  if (!target) return;
  const dx = target.center.x - attackerToken.center.x;
  const dy = target.center.y - attackerToken.center.y;
  const len = Math.hypot(dx, dy) || 1;
  const nx = dx / len;
  const ny = dy / len;
  const gs = canvas.grid.size || 100;
  const maxSquares = distanceMeters / METERS_PER_SQUARE;
  const px = attackerToken.center.x + nx * maxSquares * gs;
  const py = attackerToken.center.y + ny * maxSquares * gs;
  await attackerToken.document.update({
    x: px - attackerToken.w / 2,
    y: py - attackerToken.h / 2,
  });
}

async function spendResource(actor, path, cost, label) {
  if (!cost) return { ok: true, note: null };
  const current = Number(FU.getProperty(actor, path) ?? 0) || 0;
  if (current < cost) {
    ui.notifications.warn(`Pas assez de ${label}. Requis: ${cost}, actuel: ${current}`);
    return { ok: false, note: null };
  }
  await actor.update({ [path]: current - cost });
  return { ok: true, note: `${label} -${cost}` };
}

function getTechniqueRange(item, ctx = {}) {
  if (item.system?.automation?.unlimitedRange) return 9999;
  return Number(ctx.overrideRange ?? item.system?.range ?? METERS_PER_SQUARE) || METERS_PER_SQUARE;
}

function getSelectedTargets(attackerToken) {
  return Array.from(game.user.targets ?? []).filter(
    (target) => target.id !== attackerToken?.id && target.actor
  );
}

function getAoETargets(attackerToken, rangeM, { antiFriendlyFire = false } = {}) {
  const selected = getSelectedTargets(attackerToken).filter(
    (target) => distMetersChebyshev(attackerToken, target) <= rangeM
  );
  if (selected.length) return selected;

  return canvas.tokens.placeables.filter((token) => {
    if (!token?.actor || token.id === attackerToken?.id || token.document.hidden) return false;
    if (distMetersChebyshev(attackerToken, token) > rangeM) return false;
    if (!antiFriendlyFire) return true;
    return token.document.disposition !== attackerToken.document.disposition;
  });
}

async function resolveTechniqueTargets(attackerToken, item, ctx = {}) {
  const rangeM = getTechniqueRange(item, ctx);
  const area = item.system?.automation?.area || (item.system?.flags?.aoe ? "allInRange" : "single");
  if (area === "allInRange" || area === "cone") {
    const targets = getAoETargets(attackerToken, rangeM, {
      antiFriendlyFire: !!item.system?.flags?.antiFriendlyFire,
    });
    if (!targets.length) {
      ui.notifications.warn("Aucune cible valide dans la zone.");
    }
    return targets;
  }

  const target = await pickTarget(attackerToken.id);
  return target?.actor ? [target] : [];
}

async function promptStoneHeadMode(attacker, item) {
  const damageText = `${item.system?.damageText || ""}\n${item.system?.damage || ""}`;
  if (!/tête de hache/i.test(damageText)) return null;
  if (!game.user.isGM && !attacker.isOwner) return null;

  return new Promise((resolve) => {
    new Dialog(
      {
        title: "Pierre - Tete de Hache",
        content: "<p>Choisis l'extremite employee pour cette technique.</p>",
        buttons: {
          maul: {
            label: "Masse (Force + 6)",
            callback: () => resolve("maul"),
          },
          axe: {
            label: "Hache (Finesse + 2)",
            callback: () => resolve("axe"),
          },
        },
        default: "maul",
      },
      { width: 420 }
    ).render(true);
  });
}

async function promptTechniqueMode(item) {
  if (item.system?.automation?.alternativeMode !== "deflect") return "attack";
  return new Promise((resolve) => {
    new Dialog(
      {
        title: `${item.name} - Mode`,
        content: "<p>Utiliser la technique en attaque ou en posture defensible ?</p>",
        buttons: {
          attack: { label: "Attaque", callback: () => resolve("attack") },
          deflect: { label: "Deflecteur", callback: () => resolve("deflect") },
        },
        default: "attack",
      },
      { width: 420 }
    ).render(true);
  });
}

async function activateDeflectStance(actor, item) {
  const round = Number(game.combat?.round ?? 0) || null;
  await actor.setFlag(SYSTEM_ID, "deflectStance", {
    itemId: item.id,
    itemName: item.name,
    round,
  });
}

async function applyTechniqueDamage({
  attacker,
  attackerToken,
  targetToken,
  item,
  ctx,
  damage,
  totalDamage,
}) {
  const actor = targetToken?.actor;
  if (!actor) return;

  const hpPath = "system.resources.hp.value";
  const currentHp = Number(FU.getProperty(actor, hpPath) ?? 0) || 0;
  const nextHp = Math.max(0, currentHp - damage);
  await actor.update({ [hpPath]: nextHp });
  await noteActorDamageTaken(actor, damage);

  await applyOnHit(attacker, targetToken, item, ctx, {
    tookDamage: true,
    wasKilled: nextHp === 0,
  });

  const afflictionStacks = Number(item.system?.automation?.afflictionStacks ?? 0) || 0;
  if (afflictionStacks > 0) {
    const currentPoison = FU.getProperty(actor, "system.conditions.poisoned") || {};
    await actor.update({
      "system.conditions.poisoned.active": true,
      "system.conditions.poisoned.intensity":
        Math.max(1, Number(currentPoison.intensity || 0)) + afflictionStacks - 1,
    });
  }

  try {
    const techEffects = FU.getProperty(item, "system.effects") || [];
    if (Array.isArray(techEffects) && techEffects.length) {
      await applyEffectsList({
        source: attacker,
        target: targetToken,
        effects: techEffects,
        origin: item.uuid,
      });
    }
  } catch (error) {
    console.error("BL | applyEffectsList (on-hit) failed:", error);
  }

  const enduranceRestore = String(item.system?.automation?.enduranceRestore || "none");
  if (FU.hasProperty(attacker, "system.resources.e.value") && enduranceRestore !== "none") {
    const currentE = Number(FU.getProperty(attacker, "system.resources.e.value") ?? 0) || 0;
    const maxE = Number(FU.getProperty(attacker, "system.resources.e.max") ?? currentE) || currentE;
    const restore =
      enduranceRestore === "previousDamageTaken"
        ? getPreviousRoundDamageTaken(attacker)
        : totalDamage;
    const recovered = Math.max(0, Math.min(maxE - currentE, Number(restore) || 0));
    if (recovered > 0) {
      await attacker.update({ "system.resources.e.value": currentE + recovered });
      await ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor: attacker }),
        content: `<em>${attacker.name} recupere ${recovered} E grace a ${item.name}.</em>`,
      });
    }
  }

  return { currentHp, nextHp };
}

export async function useTechnique(attacker, item, { controlledToken = null } = {}) {
  if (!attacker || !item) return;

  if (!(game.user.isGM || attacker.isOwner)) {
    return ui.notifications.warn("Tu n'es pas autorise a utiliser les techniques de cet acteur.");
  }

  if (attacker.getFlag(SYSTEM_ID, "mustRest")) {
    return ui.notifications.warn(
      `${attacker.name} est a 0E : il doit se reposer ce round avant d'attaquer.`
    );
  }

  const breathKey = item.system?.breathKey || normalizeBreathName(item.system?.breath);
  if (item.type === "technique" && breathKey && !actorHasBreath(attacker, breathKey)) {
    return ui.notifications.warn(
      `${attacker.name} ne possede pas le souffle requis pour ${item.name}.`
    );
  }

  let attackerToken = resolveCanvasToken(controlledToken, attacker);
  if (!attackerToken) {
    return ui.notifications.warn("Selectionne d'abord le token de l'attaquant.");
  }

  const automation = item.system?.automation || {};
  const chargeTurns = Number(automation.chargeTurns ?? item.system?.flags?.charge ?? 0) || 0;
  const cooldownRound = getTechniqueCooldown(attacker, item);
  if (chargeTurns > 0 && !game.combat) {
    return ui.notifications.warn("Les techniques a temps de charge necessitent un combat actif.");
  }
  if (cooldownRound && game.combat && Number(game.combat.round) < cooldownRound) {
    return ui.notifications.warn(
      `${item.name} est encore en recharge jusqu'au round ${cooldownRound}.`
    );
  }

  const chargeState = await getTechniqueChargeState(attacker);
  if (chargeState?.itemId && chargeState.itemId !== item.id && !isTechniqueChargeReady(chargeState)) {
    return ui.notifications.warn(
      `${attacker.name} charge deja ${chargeState.itemName} jusqu'au round ${chargeState.readyRound}.`
    );
  }
  if (chargeTurns > 0 && (!chargeState || chargeState.itemId !== item.id)) {
    const started = await startTechniqueCharge(attacker, item, chargeTurns);
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: attacker }),
      content: `<em>${attacker.name} commence a charger ${item.name}. Disponible au round ${started.readyRound}. Une attaque subie interrompt la charge.</em>`,
    });
    return;
  }
  if (chargeState?.itemId === item.id && !isTechniqueChargeReady(chargeState)) {
    return ui.notifications.warn(
      `${item.name} n'est pas encore pret. Round requis: ${chargeState.readyRound}.`
    );
  }
  if (chargeState?.itemId === item.id && isTechniqueChargeReady(chargeState)) {
    await clearTechniqueCharge(attacker);
  }

  const mode = await promptTechniqueMode(item);
  if (mode === "deflect") {
    const eSpend = await spendResource(
      attacker,
      "system.resources.e.value",
      Number(item.system?.costE ?? 0) || 0,
      "E"
    );
    if (!eSpend.ok) return;
    await activateDeflectStance(attacker, item);
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: attacker }),
      content: `<div class="bl-card"><b>${attacker.name}</b> adopte la posture <b>${item.name}</b> jusqu'a la fin du round pour annuler une prochaine attaque.</div>`,
    });
    return;
  }

  const ctx = { attackerToken };
  const headWeaponMode = await promptStoneHeadMode(attacker, item);
  if (headWeaponMode) ctx.headWeaponMode = headWeaponMode;

  let targetTokens = await resolveTechniqueTargets(attackerToken, item, ctx);
  if (!targetTokens.length) return;

  const firstTarget = targetTokens[0];
  const pre = applyPreHit(attacker, firstTarget, item, ctx);
  const rangeM = getTechniqueRange(item, ctx);

  targetTokens = targetTokens.filter(
    (targetToken) =>
      item.system?.automation?.unlimitedRange ||
      distMetersChebyshev(attackerToken, targetToken) <= rangeM
  );
  if (!targetTokens.length) {
    return ui.notifications.warn(`Portee insuffisante : aucune cible dans ${rangeM} m.`);
  }

  const spentNotes = [];
  const eSpend = await spendResource(
    attacker,
    "system.resources.e.value",
    Number(pre.cost ?? item.system?.costE ?? 0) || 0,
    "E"
  );
  if (!eSpend.ok) return;
  if (eSpend.note) spentNotes.push(eSpend.note);

  const rpSpend = await spendResource(
    attacker,
    "system.resources.rp.value",
    Number(item.system?.costRp ?? 0) || 0,
    "RP"
  );
  if (!rpSpend.ok) return;
  if (rpSpend.note) spentNotes.push(rpSpend.note);

  const bdpSpend = await spendResource(
    attacker,
    "system.resources.bdp.value",
    Number(item.system?.costBdp ?? 0) || 0,
    "BDP"
  );
  if (!bdpSpend.ok) return;
  if (bdpSpend.note) spentNotes.push(bdpSpend.note);

  try {
    const selfEffects = FU.getProperty(item, "system.selfEffects") || [];
    if (Array.isArray(selfEffects) && selfEffects.length) {
      await applyEffectsList({
        source: attacker,
        target: attackerToken,
        effects: selfEffects,
        origin: item.uuid,
      });
    }
  } catch (error) {
    console.error("BL | applyEffectsList (self) failed:", error);
  }

  let damageRoll = new Roll(buildFormulaWithActorStats(pre.dmgExpr || "1d8", attacker, ctx));
  await damageRoll.roll({ async: true });

  let markedRoll = null;
  if (attacker.system?.states?.marque) {
    markedRoll = new Roll(buildFormulaWithActorStats(pre.dmgExpr || "1d8", attacker, ctx));
    await markedRoll.roll({ async: true });
    if ((markedRoll.total ?? 0) > (damageRoll.total ?? 0)) {
      damageRoll = markedRoll;
    }
  }

  const noteEntries = [...(pre.notes || []), ...(item.system?.specialLines || [])];
  if (markedRoll) {
    noteEntries.push(`Forme Marquee : second jet ${markedRoll.total}`);
  }

  const targetRows = targetTokens
    .map((targetToken) =>
      buildReactionTargetRow({
        attackerToken,
        targetToken,
        damageTotal: damageRoll.total,
        allowDodge:
          !item.system?.automation?.cannotBeDodged && !item.system?.automation?.cannotBeReactedTo,
        allowReactions: !item.system?.automation?.cannotBeReactedTo,
        allowWaterDeflect: !item.system?.automation?.cannotBeReactedTo,
      })
    )
    .join("");

  const utilityButtons = `
    <div class="flexrow" style="gap:.35rem; flex-wrap:wrap;">
      ${
        pre.ui?.canDash
          ? `<button class="bl-dash" data-attacker-token="${attackerToken.id}">Dash (6 m)</button>`
          : ""
      }
      ${
        pre.ui?.canMist
          ? `<button class="bl-mist" data-target-token="${firstTarget.id}">Brume (3 m)</button>`
          : ""
      }
    </div>
  `;

  const notes =
    noteEntries.length > 0
      ? `<div style="opacity:.8;"><small>${noteEntries.join(" • ")}</small></div>`
      : "";

  const chatMessage = await damageRoll.toMessage({
    speaker: ChatMessage.getSpeaker({ actor: attacker }),
    flavor: `
      <div class="bl-card" style="display:grid; gap:.35rem;">
        <div><b>${attacker.name}</b> utilise <b>${item.name}</b></div>
        <div><small>${spentNotes.join(" • ") || "Sans cout"} • Portee: ${
          item.system?.automation?.unlimitedRange ? "illimitee" : `${rangeM} m`
        } • Cibles: ${targetTokens.map((token) => token.name).join(", ")}</small></div>
        <div><b>Degats potentiels:</b> ${damageRoll.total} <small>(${pre.dmgExpr})</small></div>
        ${notes}
        ${utilityButtons}
        <hr>
        <div class="bl-target-list" style="display:grid; gap:.5rem;">${targetRows}</div>
      </div>
    `,
  });

  if (Number(automation.cooldownTurns ?? 0) > 0) {
    await setTechniqueCooldown(attacker, item, Number(automation.cooldownTurns));
  }

  Hooks.once("renderChatMessage", (message, html) => {
    if (message.id !== chatMessage.id) return;

    const disableTargetButtons = (tokenId) => {
      html.find(`button[data-target-token="${tokenId}"]`).prop("disabled", true);
    };

    html.find(".bl-dodge").on("click", async (event) => {
      const button = $(event.currentTarget);
      const token = canvas.tokens.get(String(button.attr("data-target-token")));
      const actor = token?.actor;
      if (!actor || !canInteractWithToken(token)) return;

      const currentRp = Number(FU.getProperty(actor, "system.resources.rp.value") ?? 0) || 0;
      if (currentRp < 1) {
        ui.notifications.warn(`Pas assez de RP (1 requis, actuel ${currentRp}).`);
        return;
      }
      await actor.update({ "system.resources.rp.value": currentRp - 1 });
      html
        .find(`.bl-target-row[data-target-token="${token.id}"] .bl-target-result`)
        .html("<em>Esquive reussie : degats annules.</em>");
      await applyOnHit(attacker, token, item, ctx, { tookDamage: false });
      disableTargetButtons(token.id);
    });

    html.find(".bl-deflect").on("click", async (event) => {
      const button = $(event.currentTarget);
      const token = canvas.tokens.get(String(button.attr("data-target-token")));
      const actor = token?.actor;
      if (!actor || !canInteractWithToken(token)) return;

      const currentRp = Number(FU.getProperty(actor, "system.resources.rp.value") ?? 0) || 0;
      if (currentRp < 1) {
        ui.notifications.warn(`Pas assez de RP (1 requis, actuel ${currentRp}).`);
        return;
      }
      await actor.update({ "system.resources.rp.value": currentRp - 1 });
      html
        .find(`.bl-target-row[data-target-token="${token.id}"] .bl-target-result`)
        .html("<em>Deviation reussie : degats annules.</em>");
      await applyOnHit(attacker, token, item, ctx, { tookDamage: false });
      disableTargetButtons(token.id);
    });

    html.find(".bl-stance-deflect").on("click", async (event) => {
      const button = $(event.currentTarget);
      const token = canvas.tokens.get(String(button.attr("data-target-token")));
      const actor = token?.actor;
      if (!actor || !canInteractWithToken(token)) return;
      await consumeDeflectStance(actor);
      html
        .find(`.bl-target-row[data-target-token="${token.id}"] .bl-target-result`)
        .html("<em>Posture defensive consommee : degats annules.</em>");
      disableTargetButtons(token.id);
    });

    html.find(".bl-dash").on("click", async () => {
      const tokenId = String(html.find(".bl-dash").attr("data-attacker-token"));
      const token = canvas.tokens.get(tokenId);
      if (!token || !canInteractWithToken(token)) return;
      await simpleDash(token, 6);
    });

    html.find(".bl-mist").on("click", async () => {
      await placeMistTemplate(firstTarget);
    });

    html.find(".bl-takedmg").on("click", async (event) => {
      const button = $(event.currentTarget);
      const token = canvas.tokens.get(String(button.attr("data-target-token")));
      const actor = token?.actor;
      if (!actor || !canInteractWithToken(token)) return;

      const damage = Number(button.attr("data-damage")) || 0;
      const result = await applyTechniqueDamage({
        attacker,
        attackerToken,
        targetToken: token,
        item,
        ctx,
        damage,
        totalDamage: damage,
      });
      html
        .find(`.bl-target-row[data-target-token="${token.id}"] .bl-target-result`)
        .html(
          `<em>${actor.name} prend <b>${damage}</b> degats (PV ${result.currentHp} -> ${result.nextHp}).</em>`
        );
      disableTargetButtons(token.id);
    });
  });
}
