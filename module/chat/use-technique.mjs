// Lancer une Technique de Souffle (auto-hit) avec réactions et effets de Souffles.
// Compatible Foundry v12.343

import { BreathFX, applyPreHit, applyOnHit } from "../rules/breath-effects.mjs";

const FU = foundry.utils;
const SYSTEM_ID = "breathe-and-live";
const METERS_PER_SQUARE = 1.5;

/** Distance “Chebyshev” (cases max * 1.5 m) pour coller à tes règles */
function distMetersChebyshev(aToken, bToken) {
  const gs = canvas.grid.size || 100;
  const dx = Math.abs(aToken.center.x - bToken.center.x) / gs;
  const dy = Math.abs(aToken.center.y - bToken.center.y) / gs;
  return Math.max(dx, dy) * METERS_PER_SQUARE;
}

/** Peut interagir avec un token (MJ ou owner) */
function canInteractWithToken(t) {
  const a = t?.actor;
  return game.user.isGM || (a && a.isOwner);
}

/** Choix de cible si aucune sélection */
async function pickTarget(excludeTokenId = null) {
  const tgt = Array.from(game.user.targets ?? []);
  if (tgt.length === 1) return tgt[0];

  const others = canvas.tokens.placeables.filter(
    (t) => t.id !== excludeTokenId && !t.document.hidden
  );
  if (!others.length) {
    ui.notifications.warn("Aucune cible disponible.");
    return null;
  }
  const opts = others
    .map((t) => `<option value="${t.id}">${t.name}</option>`)
    .join("");
  return await new Promise((res) => {
    new Dialog(
      {
        title: "Choisir une cible",
        content: `<p>Sélectionne la cible :</p>
                  <div class="form-group"><select id="bl-target">${opts}</select></div>`,
        buttons: {
          ok: {
            label: "Valider",
            callback: (html) =>
              res(canvas.tokens.get(html.find("#bl-target").val())),
          },
          cancel: { label: "Annuler", callback: () => res(null) },
        },
        default: "ok",
      },
      { width: 420 }
    ).render(true);
  });
}

/** Place un gabarit de Brume (cercle 3 m) au centre du token ciblé (cosmétique/contrôle zone) */
async function placeMistTemplate(targetToken) {
  const scene = canvas.scene;
  if (!scene) return;
  const r = (3 / METERS_PER_SQUARE) * (canvas.grid.size / 2); // 3m -> rayon en px
  const data = {
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
  };
  await canvas.scene.createEmbeddedDocuments("MeasuredTemplate", [data]);
}

/** Déplacement (Dash) simple de 6 m dans la direction du token attaquant -> cible */
async function simpleDash(attackerToken, distanceMeters = 6) {
  const maxSquares = distanceMeters / METERS_PER_SQUARE;
  // Déplacement le long du vecteur vers la cible la plus récente
  const tgt = Array.from(game.user.targets ?? [])[0];
  if (!tgt) return;
  const dx = tgt.center.x - attackerToken.center.x;
  const dy = tgt.center.y - attackerToken.center.y;
  const len = Math.hypot(dx, dy) || 1;
  const nx = dx / len,
    ny = dy / len;
  const gs = canvas.grid.size || 100;
  const px = attackerToken.center.x + nx * maxSquares * gs;
  const py = attackerToken.center.y + ny * maxSquares * gs;
  await attackerToken.document.update({
    x: px - attackerToken.w / 2,
    y: py - attackerToken.h / 2,
  });
}

/**
 * useTechnique(attackerActor, item, { controlledToken? })
 * Lancement d'une Technique depuis fiche, macro ou autre.
 */
export async function useTechnique(
  attacker,
  item,
  { controlledToken = null } = {}
) {
  if (!attacker || !item) return;

  // Autorisation (MJ ou propriétaire)
  if (!(game.user.isGM || attacker.isOwner)) {
    return ui.notifications.warn(
      "Tu n’es pas autorisé à utiliser les techniques de cet acteur."
    );
  }

  // Interdiction si l’acteur doit se reposer (E=0 automate)
  if (attacker.getFlag(SYSTEM_ID, "mustRest")) {
    return ui.notifications.warn(
      `${attacker.name} est à 0E : il doit se reposer ce round avant d'attaquer.`
    );
  }

  // Trouver un token “contrôlé” si non fourni
  let atkToken = controlledToken;
  if (!atkToken) {
    atkToken =
      canvas.tokens.controlled[0] ||
      canvas.tokens.placeables.find((t) => t.actor?.id === attacker.id);
  }
  if (!atkToken) {
    return ui.notifications.warn(
      "Sélectionne d’abord le token de l’attaquant."
    );
  }

  // Choisir la cible
  const targetToken = await pickTarget(atkToken.id);
  if (!targetToken) return;
  const targetActor = targetToken.actor;
  if (!targetActor) return ui.notifications.warn("La cible n’a pas d’acteur.");

  // Vérifier la portée (mètres) vs distance (Chebyshev * 1.5 m)
  const distM = distMetersChebyshev(atkToken, targetToken);
  const rangeM =
    Number(item.system?.range ?? METERS_PER_SQUARE) || METERS_PER_SQUARE;
  if (rangeM < distM) {
    return ui.notifications.warn(
      `Portée insuffisante : ${rangeM} m < ${distM.toFixed(1)} m.`
    );
  }

  // Pré-calcul (Souffles) : coût, dégâts, autoHit + drapeaux UI
  const ctx = {};
  let pre = applyPreHit(attacker, targetToken, item, ctx);

  // Consulter l'Endurance
  const ePath = "system.resources.e.value";
  const curE = Number(FU.getProperty(attacker, ePath) ?? 0) || 0;
  if (curE < pre.cost) {
    return ui.notifications.warn(
      `Pas assez d'Endurance (E). Requis: ${pre.cost}, actuel: ${curE}`
    );
  }

  // Dépense d'E (d'abord)
  await attacker.update({ [ePath]: curE - pre.cost });

  // Jet de dégâts (formule après injection des stats et effets de souffle)
  const dmgRoll = new Roll(pre.dmgExpr || "1d8");
  await dmgRoll.roll({ async: true });

  // Carte de chat — boutons conditionnels (Esquiver, Dévier, Dash, Brume, Prendre)
  const canDeflect = !!pre.ui?.canDeflect;
  const canDash = !!pre.ui?.canDash;
  const canMist = !!pre.ui?.canMist;
  const notes = pre.notes?.length
    ? `<div style="opacity:.8;"><small>${pre.notes.join(" • ")}</small></div>`
    : "";

  const buttons = `
    <div class="flexrow" style="gap:.35rem; flex-wrap:wrap;">
      <button class="bl-dodge" data-target-token="${
        targetToken.id
      }" data-damage="${dmgRoll.total}">Esquiver (1 RP)</button>
      ${
        canDeflect
          ? `<button class="bl-deflect" data-target-token="${targetToken.id}" data-damage="${dmgRoll.total}">Dévier (1 RP)</button>`
          : ""
      }
      ${
        canDash
          ? `<button class="bl-dash" data-attacker-token="${atkToken.id}">Dash (6 m)</button>`
          : ""
      }
      ${
        canMist
          ? `<button class="bl-mist" data-target-token="${targetToken.id}">Brume (3 m)</button>`
          : ""
      }
      <button class="bl-takedmg" data-target-token="${
        targetToken.id
      }" data-damage="${dmgRoll.total}">Prendre les dégâts</button>
      <small style="opacity:.8;">(Réactions : réservées au MJ ou au propriétaire de ${
        targetToken.name
      })</small>
    </div>
  `;

  const msgContent = `
    <div class="bl-card" style="display:grid; gap:.25rem;">
      <div><b>${attacker.name}</b> utilise <b>${item.name}</b>${
    item.system?.breath
      ? ` — ${item.system.breath}${
          item.system?.form ? ` (Forme ${item.system.form})` : ``
        }`
      : ""
  }</div>
      <div><small>E -${pre.cost} • Cible: ${
    targetToken.name
  } • Dist: ${distM.toFixed(1)} m • Portée: ${rangeM} m</small></div>
      <div><b>Dégâts potentiels:</b> ${dmgRoll.total} <small>(${
    pre.dmgExpr
  })</small></div>
      ${notes}
      <hr>
      ${buttons}
      <div class="bl-dodge-result" style="margin-top:.35rem;"></div>
    </div>
  `;

  const chatMsg = await dmgRoll.toMessage({
    speaker: ChatMessage.getSpeaker({ actor: attacker }),
    flavor: msgContent,
  });

  // Handlers des boutons (attachés après rendu)
  Hooks.once("renderChatMessage", (message, html) => {
    if (message.id !== chatMsg.id) return;

    const $zone = html;

    // Utilitaires
    const getTgt = (btnSelAttr = "data-target-token") => {
      const id = String($zone.find(`[${btnSelAttr}]`).attr(btnSelAttr));
      const t = canvas.tokens.get(id);
      return { token: t, actor: t?.actor };
    };

    // ---- Esquiver (1 RP : annule les dégâts) ----
    $zone.find(".bl-dodge").on("click", async () => {
      const { token: tgtToken, actor: tgtActor } = getTgt("data-target-token");
      if (!tgtActor) return ui.notifications.warn("Cible invalide.");
      if (!canInteractWithToken(tgtToken))
        return ui.notifications.warn("Non autorisé.");

      const rpPath = "system.resources.rp.value";
      const rpVal = Number(FU.getProperty(tgtActor, rpPath) ?? 0) || 0;
      if (rpVal < 1)
        return ui.notifications.warn(
          `Pas assez de RP (1 requis, actuel ${rpVal}).`
        );

      await tgtActor.update({ [rpPath]: rpVal - 1 });
      $zone
        .find(".bl-dodge-result")
        .html(`<em>Esquive réussie — RP -1, dégâts annulés.</em>`);
      // On notifie le moteur “onHit” avec tookDamage=false (pas d’effets à appliquer)
      await applyOnHit(attacker, tgtToken, item, ctx, { tookDamage: false });

      // lock tous les boutons de réaction / prise de dégâts
      $zone
        .find(".bl-dodge, .bl-deflect, .bl-dash, .bl-mist, .bl-takedmg")
        .prop("disabled", true);
    });

    // ---- Dévier (Eau, 1 RP) : rediriger/annuler — version simple = annule ----
    $zone.find(".bl-deflect").on("click", async () => {
      const { token: tgtToken, actor: tgtActor } = getTgt("data-target-token");
      if (!tgtActor) return ui.notifications.warn("Cible invalide.");
      if (!canInteractWithToken(tgtToken))
        return ui.notifications.warn("Non autorisé.");

      const rpPath = "system.resources.rp.value";
      const rpVal = Number(FU.getProperty(tgtActor, rpPath) ?? 0) || 0;
      if (rpVal < 1)
        return ui.notifications.warn(
          `Pas assez de RP (1 requis, actuel ${rpVal}).`
        );

      await tgtActor.update({ [rpPath]: rpVal - 1 });
      $zone
        .find(".bl-dodge-result")
        .html(`<em>Déviation réussie — RP -1, dégâts annulés.</em>`);
      await applyOnHit(attacker, tgtToken, item, ctx, { tookDamage: false });
      $zone
        .find(".bl-dodge, .bl-deflect, .bl-dash, .bl-mist, .bl-takedmg")
        .prop("disabled", true);
    });

    // ---- Dash (Foudre) : 6 m vers la cible ----
    $zone.find(".bl-dash").on("click", async () => {
      const atkId = String($zone.find(".bl-dash").attr("data-attacker-token"));
      const aTok = canvas.tokens.get(atkId);
      if (!aTok) return;
      if (!canInteractWithToken(aTok))
        return ui.notifications.warn("Non autorisé.");

      await simpleDash(aTok, 6);
      $zone.find(".bl-dodge-result").html(`<em>Dash (6 m) effectué.</em>`);
      // on ne locke pas forcément les autres boutons, à toi de décider ; ici on laisse.
    });

    // ---- Brume (3 m) : zone visuelle autour de la cible ----
    $zone.find(".bl-mist").on("click", async () => {
      const { token: tgtToken } = getTgt("data-target-token");
      if (!tgtToken) return;
      await placeMistTemplate(tgtToken);
      $zone.find(".bl-dodge-result").html(`<em>Brume placée (3 m).</em>`);
    });

    // ---- Prendre les dégâts ----
    $zone.find(".bl-takedmg").on("click", async () => {
      const dmgTotal =
        Number($zone.find(".bl-takedmg").attr("data-damage")) || 0;
      const { token: tgtToken, actor: tgtActor } = getTgt("data-target-token");
      if (!tgtActor) return ui.notifications.warn("Cible invalide.");
      if (!canInteractWithToken(tgtToken))
        return ui.notifications.warn("Non autorisé.");

      const hpPath = "system.resources.hp.value";
      const curHP = Number(FU.getProperty(tgtActor, hpPath) ?? 0) || 0;
      const newHP = Math.max(0, curHP - dmgTotal);
      await tgtActor.update({ [hpPath]: newHP });

      $zone
        .find(".bl-dodge-result")
        .html(
          `<em>${tgtActor.name} prend <b>${dmgTotal}</b> dégâts (PV ${curHP} → ${newHP}).</em>`
        );

      // Notifier les effets “on hit” (Neige, Vent, Fleur…)
      await applyOnHit(attacker, tgtToken, item, ctx, { tookDamage: true });

      // Verrouiller les autres boutons
      $zone
        .find(".bl-dodge, .bl-deflect, .bl-dash, .bl-mist, .bl-takedmg")
        .prop("disabled", true);
    });
  });
}
