// module/chat/use-technique.mjs
// Breathe & Live — Lancer une Technique (full options, auto-touché pour Souffles)
// Foundry v12.343 — sûr (Actor/Token update & Roll.evaluate({async:true}))

export async function useTechnique(attackerActorOrToken, item, opts = {}) {
  const METERS_PER_SQUARE = 1.5;
  const FU = foundry.utils;

  // ===== Helpers base =====
  const controlled =
    opts.controlledToken ??
    canvas.tokens.controlled[0] ??
    attackerActorOrToken?.token;
  const attacker = attackerActorOrToken?.actor ?? attackerActorOrToken; // Token->Actor ou Actor
  function isGMorOwner(a) {
    return game.user.isGM || (a && a.isOwner);
  }

  function distMetersChebyshev(aToken, bToken) {
    const gs = canvas.grid.size || 100;
    const dx = Math.abs(aToken.center.x - bToken.center.x) / gs;
    const dy = Math.abs(aToken.center.y - bToken.center.y) / gs;
    return Math.max(dx, dy) * METERS_PER_SQUARE;
  }
  async function blUpdate(docOrActor, updateObj) {
    const a = docOrActor?.actor ?? docOrActor;
    return a.update(updateObj);
  }
  async function pickTarget(originToken) {
    const tgt = Array.from(game.user.targets ?? []);
    if (tgt.length === 1) return tgt[0];
    const others = canvas.tokens.placeables.filter(
      (t) => t.id !== originToken.id && !t.document.hidden
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
          content: `<p>Sélectionne la cible :</p><div class="form-group"><select id="bl-target">${opts}</select></div>`,
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

  // ===== Dégâts: injection de stats =====
  function statValue(actor, key) {
    const v = Number(FU.getProperty(actor, `system.stats.base.${key}`) ?? 0);
    return Number.isFinite(v) ? v : 0;
  }
  function buildDamageFormula(raw, actor) {
    if (!raw || typeof raw !== "string") return "1d8";
    let expr = raw.trim();

    const hasForceOrFinesse =
      /force\s*ou\s*finesse/i.test(expr) || /finesse\s*ou\s*force/i.test(expr);
    if (hasForceOrFinesse) {
      const f = statValue(actor, "force");
      const fi = statValue(actor, "finesse");
      const best = Math.max(f, fi);
      expr = expr
        .replace(/force\s*ou\s*finesse/gi, String(best))
        .replace(/finesse\s*ou\s*force/gi, String(best));
    }
    expr = expr.replace(/\bForce\b/gi, String(statValue(actor, "force")));
    expr = expr.replace(/\bFinesse\b/gi, String(statValue(actor, "finesse")));
    return expr;
  }

  // ===== Souffles: helpers (lis toggles fiche ET Items "breath") =====
  function _breathItem(actor, key) {
    return actor.items.find(
      (i) => i.type === "breath" && i.system?.key === key
    );
  }
  function hasBreath(actor, key) {
    const toggle = !!FU.getProperty(actor, `system.breaths.${key}.enabled`);
    const owned = !!_breathItem(actor, key);
    return toggle || owned;
  }
  function hasSpecial(actor, key, spec) {
    const toggle = !!FU.getProperty(
      actor,
      `system.breaths.${key}.specials.${spec}`
    );
    const item = _breathItem(actor, key);
    const fromItem = !!item?.system?.specials?.[spec];
    return toggle || fromItem;
  }
  function isMarque(actor) {
    return !!FU.getProperty(actor, "system.states.marque");
  }

  /** Modifie coût E et/ou formule de dégâts selon les souffles de l'attaquant. */
  function applyBreathSpecials(
    attacker,
    inCost,
    inDmgExpr,
    { targetIsDemon = false }
  ) {
    let cost = inCost;
    let dmgFormula = inDmgExpr;
    const notes = [];

    // SOLEIL — Élu : coût ÷2 ; si Marque → dégâts ×3
    if (hasBreath(attacker, "sun") && hasSpecial(attacker, "sun", "elu")) {
      cost = Math.max(0, Math.floor(cost / 2));
      notes.push("Soleil/Élu : Coût ÷2");
      if (isMarque(attacker)) {
        dmgFormula = `3*(${dmgFormula})`;
        notes.push("Soleil/Élu + Marque : Dégâts ×3");
      }
    }
    // LUNE — bonus vs démon : +1 dé (même taille que le plus gros dé trouvé)
    if (
      hasBreath(attacker, "moon") &&
      hasSpecial(attacker, "moon", "bonusSolo") &&
      targetIsDemon
    ) {
      const m =
        /(\d+)d(\d+)(?!.*\d+d\d+)/i.exec(dmgFormula) ||
        /(\d+)d(\d+)/i.exec(dmgFormula);
      if (m) dmgFormula = `${dmgFormula} + 1d${m[2]}`;
      notes.push("Lune : +1 dé de dégâts vs démons");
    }

    return { cost, dmgFormula, notes };
  }

  // ===== Contrôles de base =====
  if (!controlled)
    return ui.notifications.warn("Sélectionne d’abord un token.");
  if (!attacker) return ui.notifications.warn("Ce token n’a pas d’acteur.");
  if (!isGMorOwner(attacker)) {
    return ui.notifications.warn(
      "Tu n’es pas autorisé à utiliser les techniques de cet acteur."
    );
  }
  if (!item || item.type !== "technique") {
    return ui.notifications.warn("Cet élément n’est pas une Technique.");
  }

  // Flamme — Cœur flamboyant : toggle de round (×2 dégâts ce round)
  let flameHeartActive = false;
  if (
    hasBreath(attacker, "flame") &&
    hasSpecial(attacker, "flame", "coeurFlamboyant")
  ) {
    const round = game.combat?.round ?? null;
    const flag = attacker.getFlag("breathe-and-live", "flameHeartRound");
    flameHeartActive = round && flag === round;
  }
  const canMist =
    hasBreath(attacker, "mist") &&
    hasSpecial(attacker, "mist", "nuagesTrainants");

  // ===== Cible =====
  const targetToken = await pickTarget(controlled);
  if (!targetToken) return;
  const targetActor = targetToken.actor;
  if (!targetActor) return ui.notifications.warn("La cible n’a pas d’acteur.");

  const targetCA =
    10 +
    (Number(FU.getProperty(targetActor, "system.stats.base.vitesse") ?? 0) ||
      0);
  const isDemonTarget =
    targetActor?.type === "demon" || /demon/i.test(targetActor?.type ?? "");

  // Données de la technique
  const s = item.system ?? {};
  const dmgExpRaw = s.damage || "1d8";
  const rangeM = Number(s.range ?? METERS_PER_SQUARE) || METERS_PER_SQUARE;

  const distM = distMetersChebyshev(controlled, targetToken);
  const curE =
    Number(FU.getProperty(attacker, "system.resources.e.value") ?? 0) || 0;

  // ===== UI de sélection (une seule technique -> montrer quand même util bar) =====
  const notEnough = curE < Number(s.costE ?? 0);
  const outOfRange = rangeM < distM;
  if (outOfRange)
    return ui.notifications.warn(
      `Portée insuffisante : ${rangeM} m < ${distM.toFixed(1)} m.`
    );
  if (notEnough)
    return ui.notifications.warn(
      `Pas assez d'Endurance (E). Requis: ${s.costE}, actuel: ${curE}`
    );

  const utilBar = `
    <style>
      .bl-utils { display:flex; gap:.5rem; align-items:center; flex-wrap:wrap; margin-bottom:.3rem; }
      .bl-heart.active { background:#c33; color:#fff; }
    </style>
    <div class="bl-utils">
      ${
        hasBreath(attacker, "flame") &&
        hasSpecial(attacker, "flame", "coeurFlamboyant")
          ? `
        <button type="button" class="bl-heart ${
          flameHeartActive ? "active" : ""
        }" title="Flamme — Cœur flamboyant (×2 dégâts ce round)">
          ${
            flameHeartActive
              ? "Cœur flamboyant ACTIF"
              : "Activer Cœur flamboyant (round)"
          }
        </button>
      `
          : ``
      }
      ${
        canMist
          ? `<button type="button" class="bl-mist" title="Brume — Poser un voile (3 m)">Poser la Brume (3 m)</button>`
          : ``
      }
    </div>
    <div class="muted"><small>
      Cible: <b>${
        targetToken.name
      }</b> (CA ${targetCA}) — Dist: <b>${distM.toFixed(
    1
  )} m</b> — Portée: ${rangeM} m.
      <b>Les Techniques de Souffle touchent automatiquement.</b> La cible peut Esquiver (1 RP).
    </small></div>
  `;

  await new Promise((res) => {
    new Dialog(
      {
        title: `Lancer ${item.name}`,
        content: utilBar,
        buttons: {
          ok: { label: "Continuer", callback: () => res(true) },
          cancel: { label: "Annuler", callback: () => res(false) },
        },
        default: "ok",
      },
      { width: 520 }
    ).render(true);

    // Attachements post-render
    Hooks.once("renderDialog", (app, htmlEl) => {
      // Toggle Cœur flamboyant
      htmlEl.find(".bl-heart").on("click", async () => {
        if (!game.combat)
          return ui.notifications.warn(
            "Cœur flamboyant : nécessite un combat (round)."
          );
        const round = game.combat.round;
        const already =
          attacker.getFlag("breathe-and-live", "flameHeartRound") === round;
        if (already) {
          await attacker.unsetFlag("breathe-and-live", "flameHeartRound");
          ui.notifications.info("Cœur flamboyant désactivé pour ce round.");
          htmlEl
            .find(".bl-heart")
            .removeClass("active")
            .text("Activer Cœur flamboyant (round)");
        } else {
          await attacker.setFlag("breathe-and-live", "flameHeartRound", round);
          ui.notifications.info(
            "Cœur flamboyant ACTIVÉ pour ce round (dégâts ×2)."
          );
          htmlEl
            .find(".bl-heart")
            .addClass("active")
            .text("Cœur flamboyant ACTIF");
        }
      });

      // Poser Brume (template cercle ~3m)
      htmlEl.find(".bl-mist").on("click", async () => {
        await canvas.scene.createEmbeddedDocuments("MeasuredTemplate", [
          {
            t: "circle",
            user: game.user.id,
            x: controlled.center.x,
            y: controlled.center.y,
            distance: 3,
            borderColor: "#88bbff",
            fillColor: "#88bbff",
            flags: { "breathe-and-live": { mist: true, owner: attacker.id } },
          },
        ]);
        ui.notifications.info(
          "Brume déployée (3 m). Bonus défensifs selon vos règles de table."
        );
      });
    });
  });

  // ===== Exécution (auto-touché) =====

  // Dégâts base (injection Force/Finesse)
  let finalDmgExpr = buildDamageFormula(dmgExpRaw, attacker);

  // Souffles: modifs coût/dmg générales
  const baseCost = Number(s.costE ?? 0) || 0;
  const {
    cost: costAfterBreaths,
    dmgFormula: dmgAfterBreaths,
    notes: notesA,
  } = applyBreathSpecials(attacker, baseCost, finalDmgExpr, {
    targetIsDemon: isDemonTarget,
  });
  finalDmgExpr = dmgAfterBreaths;

  // Flamme — Cœur flamboyant actif ? ×2
  let flameHeartActiveNow = false;
  if (
    hasBreath(attacker, "flame") &&
    hasSpecial(attacker, "flame", "coeurFlamboyant") &&
    game.combat
  ) {
    flameHeartActiveNow =
      attacker.getFlag("breathe-and-live", "flameHeartRound") ===
      game.combat.round;
    if (flameHeartActiveNow) finalDmgExpr = `2*(${finalDmgExpr})`;
  }

  // Pierre — Mâchoire & Hache
  if (
    hasBreath(attacker, "stone") &&
    hasSpecial(attacker, "stone", "machoireHache")
  ) {
    const choice = await new Promise((res) => {
      new Dialog({
        title: "Pierre — Mâchoire & Hache",
        content: `<p>Choisis l’extrémité :</p>`,
        buttons: {
          maul: {
            label: "Masse (Force +6, pas de décapitation)",
            callback: () => res("maul"),
          },
          axe: {
            label: "Hache (Finesse +2, peut décapiter)",
            callback: () => res("axe"),
          },
        },
        default: "maul",
      }).render(true);
    });
    if (choice === "maul") {
      finalDmgExpr = `(${finalDmgExpr}) + ${statValue(attacker, "force") + 6}`;
    } else if (choice === "axe") {
      finalDmgExpr = `(${finalDmgExpr}) + ${
        statValue(attacker, "finesse") + 2
      }`;
    }
  }

  // Fleur — Concentration Florissante : +2 cumulatif dmg si même cible (cap 5)
  if (
    hasBreath(attacker, "flower") &&
    hasSpecial(attacker, "flower", "concentrationFlorissante")
  ) {
    const st = attacker.getFlag("breathe-and-live", "flowerStacks") ?? {
      tid: null,
      n: 0,
    };
    const same = st.tid === targetToken.id;
    const n = same ? Math.min(5, Number(st.n || 0) + 1) : 1;
    finalDmgExpr = `(${finalDmgExpr}) + ${2 * n}`;
    await attacker.setFlag("breathe-and-live", "flowerStacks", {
      tid: targetToken.id,
      n,
    });
  }

  // Endurance (après modifs)
  const curE2 =
    Number(FU.getProperty(attacker, "system.resources.e.value") ?? 0) || 0;
  if (curE2 < costAfterBreaths)
    return ui.notifications.warn(
      `Pas assez d'Endurance (E). Requis: ${costAfterBreaths}, actuel: ${curE2}`
    );
  await blUpdate(controlled, {
    "system.resources.e.value": curE2 - costAfterBreaths,
  });

  // Auto-hit
  const hit = true;

  // Jet de dégâts
  const dmgRoll = new Roll(finalDmgExpr);
  await dmgRoll.evaluate({ async: true });

  // Réactions possibles côté défenseur
  const canDeflect =
    hasBreath(targetActor, "water") &&
    hasSpecial(targetActor, "water", "devierVagues") &&
    rangeM > METERS_PER_SQUARE;
  const canDash =
    hasBreath(targetActor, "thunder") &&
    hasSpecial(targetActor, "thunder", "vitesseLumiere");

  // Notes (résumé)
  const notes = [...(notesA || [])];
  if (flameHeartActiveNow)
    notes.push("Flamme — Cœur flamboyant actif (×2 dmg)");
  if (
    hasBreath(attacker, "flower") &&
    hasSpecial(attacker, "flower", "concentrationFlorissante")
  ) {
    const { n = 1 } =
      attacker.getFlag("breathe-and-live", "flowerStacks") ?? {};
    notes.push(`Fleur — Concentration: +${2 * n} dégâts (stack ${n})`);
  }
  const notesHtml = notes.length
    ? `<div class="muted"><small>${notes.join(" • ")}</small></div>`
    : "";
  const dmgInfo =
    dmgExpRaw !== finalDmgExpr
      ? ` <small class="muted">(${finalDmgExpr})</small>`
      : "";

  // Boutons de réaction (toujours car hit=true)
  const reactBtns = `
    <div class="flexrow" style="gap:.5rem;">
      <button class="bl-dodge"  data-target-token="${
        targetToken.id
      }" data-damage="${dmgRoll.total}">
        Esquiver (1 RP)
      </button>
      ${
        canDeflect
          ? `
      <button class="bl-deflect" data-target-token="${targetToken.id}" data-damage="${dmgRoll.total}">
        Dévier (1 RP)
      </button>`
          : ``
      }
      ${
        canDash
          ? `
      <button class="bl-dash" data-target-token="${targetToken.id}">
        Dash (6 m)
      </button>`
          : ``
      }
      <button class="bl-takedmg" data-target-token="${
        targetToken.id
      }" data-damage="${dmgRoll.total}">
        Prendre les dégâts
      </button>
      <small style="opacity:.8;">(Réservé au MJ/proprio de ${
        targetToken.name
      })</small>
    </div>
  `;

  const msgContent = `
    <div class="bl-card">
      <div><b>${attacker.name}</b> utilise <b>${item.name}</b>${
    s.breath ? ` (${s.breath}${s.form ? ` — Forme ${s.form}` : ""})` : ""
  }</div>
      <div><small>E -${costAfterBreaths} • Cible: ${
    targetToken.name
  } • Dist: ${distM.toFixed(
    1
  )} m • Portée: ${rangeM} m • CA: ${targetCA}</small></div>
      <div><b>Résultat :</b> TOUCHÉ (Technique de Souffle)</div>
      <div><b>Dégâts:</b> ${dmgRoll.total}${dmgInfo}</div>
      ${notesHtml}
      <hr>
      ${reactBtns}
      <div class="bl-dodge-result" style="margin-top:.35rem;"></div>
    </div>`;

  const chatMsg = await dmgRoll.toMessage({
    speaker: ChatMessage.getSpeaker({ actor: attacker }),
    flavor: msgContent,
  });

  // ===== Handlers de réaction =====
  Hooks.once("renderChatMessage", (message, html) => {
    if (message.id !== chatMsg.id) return;

    function canInteractWithToken(tkn) {
      const a = tkn?.actor;
      return game.user.isGM || (a && a.isOwner);
    }

    const $dodge = html.find(".bl-dodge");
    const $deflect = html.find(".bl-deflect");
    const $dash = html.find(".bl-dash");
    const $take = html.find(".bl-takedmg");

    // --- Esquiver (RP 1) ---
    $dodge.on("click", async () => {
      const tgtTokenId = String($dodge.data("target-token"));
      const tgtToken = canvas.tokens.get(tgtTokenId);
      const tgtActor = tgtToken?.actor;
      if (!tgtActor) return ui.notifications.warn("Cible invalide.");
      if (!canInteractWithToken(tgtToken))
        return ui.notifications.warn("Non autorisé.");

      const rpPath = "system.resources.rp.value";
      const rpVal = Number(FU.getProperty(tgtActor, rpPath) ?? 0) || 0;
      if (rpVal < 1)
        return ui.notifications.warn(
          `Pas assez de RP (requis 1, actuel ${rpVal}).`
        );
      await blUpdate(tgtToken, { [rpPath]: rpVal - 1 });

      html
        .find(".bl-dodge-result")
        .html(`<em>Esquive réussie — RP -1, dégâts annulés.</em>`);
      $dodge.prop("disabled", true);
      $take.prop("disabled", true);
      $deflect.prop("disabled", true);
    });

    // --- Dévier (Eau, RP 1, si distance>1.5m) ---
    $deflect.on("click", async () => {
      const tgtTokenId = String($deflect.data("target-token"));
      const tgtToken = canvas.tokens.get(tgtTokenId);
      const tgtActor = tgtToken?.actor;
      if (!tgtActor) return ui.notifications.warn("Cible invalide.");
      if (!canInteractWithToken(tgtToken))
        return ui.notifications.warn("Non autorisé.");
      if (
        !(
          hasBreath(tgtActor, "water") &&
          hasSpecial(tgtActor, "water", "devierVagues")
        )
      )
        return;

      const rpPath = "system.resources.rp.value";
      const rpVal = Number(FU.getProperty(tgtActor, rpPath) ?? 0) || 0;
      if (rpVal < 1)
        return ui.notifications.warn(
          `Pas assez de RP (requis 1, actuel ${rpVal}).`
        );
      await blUpdate(tgtToken, { [rpPath]: rpVal - 1 });

      html
        .find(".bl-dodge-result")
        .html(`<em>Déviation réussie (Eau) — RP -1, dégâts annulés.</em>`);
      $deflect.prop("disabled", true);
      $dodge.prop("disabled", true);
      $take.prop("disabled", true);
    });

    // --- Dash (Foudre, 6 m) ---
    $dash.on("click", async () => {
      const tgtTokenId = String($dash.data("target-token"));
      const tgtToken = canvas.tokens.get(tgtTokenId);
      const tgtActor = tgtToken?.actor;
      if (!tgtActor) return ui.notifications.warn("Cible invalide.");
      if (!canInteractWithToken(tgtToken))
        return ui.notifications.warn("Non autorisé.");
      if (
        !(
          hasBreath(tgtActor, "thunder") &&
          hasSpecial(tgtActor, "thunder", "vitesseLumiere")
        )
      )
        return;

      ui.notifications.info(
        "Foudre — Vitesse de la lumière : déplace manuellement le token jusqu’à 6 m."
      );
      $dash.prop("disabled", true);
    });

    // --- Prendre les dégâts + effets post-hit ---
    $take.on("click", async () => {
      const dmgTotal = Number($take.data("damage")) || 0;
      const tgtTokenId = String($take.data("target-token"));
      const tgtToken = canvas.tokens.get(tgtTokenId);
      const tgtActor = tgtToken?.actor;
      if (!tgtActor) return ui.notifications.warn("Cible invalide.");
      if (!canInteractWithToken(tgtToken))
        return ui.notifications.warn("Non autorisé.");

      // Applique dégâts
      const hpPath = "system.resources.hp.value";
      const curHP = Number(FU.getProperty(tgtActor, hpPath) ?? 0) || 0;
      const newHP = Math.max(0, curHP - dmgTotal);
      await blUpdate(tgtToken, { [hpPath]: newHP });

      html
        .find(".bl-dodge-result")
        .html(
          `<em>${tgtActor.name} prend <b>${dmgTotal}</b> dégâts (PV ${curHP} → ${newHP}).</em>`
        );
      $dodge.prop("disabled", true);
      $deflect.prop("disabled", true);
      $take.prop("disabled", true);

      // Neige — Dents de Katana : CA -1d4 jusqu’à fin du round (si attaquant a Neige)
      if (
        hasBreath(attacker, "snow") &&
        hasSpecial(attacker, "snow", "dentsDeKatana")
      ) {
        const pen = new Roll("1d4");
        await pen.evaluate({ async: true });
        const caPath = "system.resources.ca";
        const curCA = Number(FU.getProperty(tgtActor, caPath) ?? 10) || 10;
        const newCA = Math.max(0, curCA - pen.total);
        await blUpdate(tgtToken, { [caPath]: newCA });
        ChatMessage.create({
          content: `<small>Neige — Dents de Katana : CA de ${tgtActor.name} ${curCA} → ${newCA} (fin du round).</small>`,
        });
        if (game.combat) {
          const thisRound = game.combat.round;
          const restore = async () => {
            if (game.combat?.round && game.combat.round > thisRound) {
              Hooks.off("updateCombat", restore);
              await blUpdate(tgtToken, { [caPath]: curCA });
              ChatMessage.create({
                content: `<small>Neige — Dents de Katana : CA de ${tgtActor.name} restaurée (${curCA}).</small>`,
              });
            }
          };
          Hooks.on("updateCombat", restore);
        }
      }

      // Vent — Vents de guerre : si démon tombe à 0 PV → attaquant regagne 1d2 RP
      const targetType = tgtActor?.type ?? "";
      const isDem = targetType === "demon" || /demon/i.test(targetType);
      if (
        isDem &&
        newHP <= 0 &&
        hasBreath(attacker, "wind") &&
        hasSpecial(attacker, "wind", "ventsDeGuerre")
      ) {
        const regen = new Roll("1d2");
        await regen.evaluate({ async: true });
        const rpPathAtk = "system.resources.rp.value";
        const curAtkRP = Number(FU.getProperty(attacker, rpPathAtk) ?? 0) || 0;
        await blUpdate(controlled, { [rpPathAtk]: curAtkRP + regen.total });
        ChatMessage.create({
          content: `<small>Vent — Vents de guerre : ${attacker.name} regagne ${regen.total} RP.</small>`,
        });
      }
    });
  });
}
