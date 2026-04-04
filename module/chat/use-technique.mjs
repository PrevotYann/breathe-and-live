import { applyPreHit, applyOnHit } from "../rules/breath-effects.mjs";
import { applyEffectsList } from "../rules/effects-engine.mjs";

const FU = foundry.utils;
const SYSTEM_ID = "breathe-and-live";
const METERS_PER_SQUARE = 1.5;

function distMetersChebyshev(aToken, bToken) {
  const gs = canvas.grid.size || 100;
  const dx = Math.abs(aToken.center.x - bToken.center.x) / gs;
  const dy = Math.abs(aToken.center.y - bToken.center.y) / gs;
  return Math.max(dx, dy) * METERS_PER_SQUARE;
}

function canInteractWithToken(token) {
  const actor = token?.actor;
  return game.user.isGM || (actor && actor.isOwner);
}

async function pickTarget(excludeTokenId = null) {
  const targets = Array.from(game.user.targets ?? []);
  if (targets.length === 1) return targets[0];

  const others = canvas.tokens.placeables.filter(
    (token) => token.id !== excludeTokenId && !token.document.hidden
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

export async function useTechnique(attacker, item, { controlledToken = null } = {}) {
  if (!attacker || !item) return;

  if (!(game.user.isGM || attacker.isOwner)) {
    return ui.notifications.warn(
      "Tu n'es pas autorise a utiliser les techniques de cet acteur."
    );
  }

  if (attacker.getFlag(SYSTEM_ID, "mustRest")) {
    return ui.notifications.warn(
      `${attacker.name} est a 0E : il doit se reposer ce round avant d'attaquer.`
    );
  }

  let attackerToken = controlledToken;
  if (!attackerToken) {
    attackerToken =
      canvas.tokens.controlled[0] ||
      canvas.tokens.placeables.find((token) => token.actor?.id === attacker.id);
  }
  if (!attackerToken) {
    return ui.notifications.warn("Selectionne d'abord le token de l'attaquant.");
  }

  const targetToken = await pickTarget(attackerToken.id);
  if (!targetToken?.actor) return;

  const ctx = { attackerToken };
  const pre = applyPreHit(attacker, targetToken, item, ctx);

  const distM = distMetersChebyshev(attackerToken, targetToken);
  const rangeM =
    Number(ctx.overrideRange ?? item.system?.range ?? METERS_PER_SQUARE) ||
    METERS_PER_SQUARE;
  if (rangeM < distM) {
    return ui.notifications.warn(
      `Portee insuffisante : ${rangeM} m < ${distM.toFixed(1)} m.`
    );
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

  let damageRoll = new Roll(pre.dmgExpr || "1d8");
  await damageRoll.roll({ async: true });
  let markedRoll = null;
  if (attacker.system?.states?.marque) {
    markedRoll = new Roll(pre.dmgExpr || "1d8");
    await markedRoll.roll({ async: true });
    if ((markedRoll.total ?? 0) > (damageRoll.total ?? 0)) {
      damageRoll = markedRoll;
    }
  }

  const noteEntries = [...(pre.notes || [])];
  if (markedRoll) {
    noteEntries.push(`Forme Marquee : second jet ${markedRoll.total}`);
  }

  const buttons = `
    <div class="flexrow" style="gap:.35rem; flex-wrap:wrap;">
      <button class="bl-dodge" data-target-token="${targetToken.id}" data-damage="${damageRoll.total}">Esquiver (1 RP)</button>
      ${
        pre.ui?.canDeflect
          ? `<button class="bl-deflect" data-target-token="${targetToken.id}" data-damage="${damageRoll.total}">Devier (1 RP)</button>`
          : ""
      }
      ${
        pre.ui?.canDash
          ? `<button class="bl-dash" data-attacker-token="${attackerToken.id}">Dash (6 m)</button>`
          : ""
      }
      ${
        pre.ui?.canMist
          ? `<button class="bl-mist" data-target-token="${targetToken.id}">Brume (3 m)</button>`
          : ""
      }
      <button class="bl-takedmg" data-target-token="${targetToken.id}" data-damage="${damageRoll.total}">Prendre les degats</button>
    </div>
  `;

  const notes =
    noteEntries.length > 0
      ? `<div style="opacity:.8;"><small>${noteEntries.join(" • ")}</small></div>`
      : "";

  const chatMessage = await damageRoll.toMessage({
    speaker: ChatMessage.getSpeaker({ actor: attacker }),
    flavor: `
      <div class="bl-card" style="display:grid; gap:.25rem;">
        <div><b>${attacker.name}</b> utilise <b>${item.name}</b></div>
        <div><small>${spentNotes.join(" • ") || "Sans cout"} • Cible: ${targetToken.name} • Dist: ${distM.toFixed(1)} m • Portee: ${rangeM} m</small></div>
        <div><b>Degats potentiels:</b> ${damageRoll.total} <small>(${pre.dmgExpr})</small></div>
        ${notes}
        <hr>
        ${buttons}
        <div class="bl-dodge-result" style="margin-top:.35rem;"></div>
      </div>
    `,
  });

  Hooks.once("renderChatMessage", (message, html) => {
    if (message.id !== chatMessage.id) return;

    const zone = html;
    const getTarget = () => {
      const id = String(zone.find("[data-target-token]").first().attr("data-target-token"));
      const token = canvas.tokens.get(id);
      return { token, actor: token?.actor };
    };

    const disableButtons = () =>
      zone.find(".bl-dodge, .bl-deflect, .bl-dash, .bl-mist, .bl-takedmg").prop("disabled", true);

    zone.find(".bl-dodge").on("click", async () => {
      const { token, actor } = getTarget();
      if (!actor || !canInteractWithToken(token)) return;
      const currentRp = Number(FU.getProperty(actor, "system.resources.rp.value") ?? 0) || 0;
      if (currentRp < 1) {
        ui.notifications.warn(`Pas assez de RP (1 requis, actuel ${currentRp}).`);
        return;
      }
      await actor.update({ "system.resources.rp.value": currentRp - 1 });
      zone.find(".bl-dodge-result").html("<em>Esquive reussie : degats annules.</em>");
      await applyOnHit(attacker, token, item, ctx, { tookDamage: false });
      disableButtons();
    });

    zone.find(".bl-deflect").on("click", async () => {
      const { token, actor } = getTarget();
      if (!actor || !canInteractWithToken(token)) return;
      const currentRp = Number(FU.getProperty(actor, "system.resources.rp.value") ?? 0) || 0;
      if (currentRp < 1) {
        ui.notifications.warn(`Pas assez de RP (1 requis, actuel ${currentRp}).`);
        return;
      }
      await actor.update({ "system.resources.rp.value": currentRp - 1 });
      zone.find(".bl-dodge-result").html("<em>Deviation reussie : degats annules.</em>");
      await applyOnHit(attacker, token, item, ctx, { tookDamage: false });
      disableButtons();
    });

    zone.find(".bl-dash").on("click", async () => {
      const tokenId = String(zone.find(".bl-dash").attr("data-attacker-token"));
      const token = canvas.tokens.get(tokenId);
      if (!token || !canInteractWithToken(token)) return;
      await simpleDash(token, 6);
      zone.find(".bl-dodge-result").html("<em>Dash (6 m) effectue.</em>");
    });

    zone.find(".bl-mist").on("click", async () => {
      const { token } = getTarget();
      if (!token) return;
      await placeMistTemplate(token);
      zone.find(".bl-dodge-result").html("<em>Brume placee (3 m).</em>");
    });

    zone.find(".bl-takedmg").on("click", async () => {
      const damage = Number(zone.find(".bl-takedmg").attr("data-damage")) || 0;
      const { token, actor } = getTarget();
      if (!actor || !canInteractWithToken(token)) return;

      const hpPath = "system.resources.hp.value";
      const currentHp = Number(FU.getProperty(actor, hpPath) ?? 0) || 0;
      const nextHp = Math.max(0, currentHp - damage);
      await actor.update({ [hpPath]: nextHp });
      zone
        .find(".bl-dodge-result")
        .html(`<em>${actor.name} prend <b>${damage}</b> degats (PV ${currentHp} -> ${nextHp}).</em>`);

      await applyOnHit(attacker, token, item, ctx, {
        tookDamage: true,
        wasKilled: nextHp === 0,
      });

      try {
        const techEffects = FU.getProperty(item, "system.effects") || [];
        if (Array.isArray(techEffects) && techEffects.length) {
          await applyEffectsList({
            source: attacker,
            target: token,
            effects: techEffects,
            origin: item.uuid,
          });
        }
      } catch (error) {
        console.error("BL | applyEffectsList (on-hit) failed:", error);
      }

      disableButtons();
    });
  });
}
