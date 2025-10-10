// Breathe & Live — Techniques (3-cols) + CA + Esquiver + Prendre les dégâts
// + Auto stat dmg injection (Force/Finesse)
// Foundry v12.343 safe (token.actor.update & Roll.evaluate({async:true}))
(async () => {
  const METERS_PER_SQUARE = 1.5;
  const FU = foundry.utils;
  const ATTACK_STAT_FALLBACK = "vitesse"; // default attack stat if technique doesn't define one
  const DODGE_MODE = "auto"; // "auto" cancels dmg; or "roll" vs DODGE_TN
  const DODGE_TN = 15;

  const controlled = canvas.tokens.controlled[0];
  if (!controlled)
    return ui.notifications.warn("Sélectionne d’abord un token.");
  const attacker = controlled.actor;
  if (!attacker) return ui.notifications.warn("Ce token n’a pas d’acteur.");
  if (!(game.user.isGM || attacker.isOwner)) {
    return ui.notifications.warn(
      "Tu n’es pas autorisé à utiliser les techniques de cet acteur."
    );
  }

  function distMetersChebyshev(aToken, bToken) {
    const gs = canvas.grid.size || 100;
    const dx = Math.abs(aToken.center.x - bToken.center.x) / gs;
    const dy = Math.abs(aToken.center.y - bToken.center.y) / gs;
    return Math.max(dx, dy) * METERS_PER_SQUARE;
  }
  async function blUpdate(docOrActor, updateObj) {
    const a = docOrActor?.actor ?? docOrActor; // Token -> synthetic/world actor; Actor -> itself
    return a.update(updateObj);
  }

  async function pickTarget() {
    const tgt = Array.from(game.user.targets ?? []);
    if (tgt.length === 1) return tgt[0];
    const others = canvas.tokens.placeables.filter(
      (t) => t.id !== controlled.id && !t.document.hidden
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

  const targetToken = await pickTarget();
  if (!targetToken) return;
  const targetActor = targetToken.actor;
  if (!targetActor) return ui.notifications.warn("La cible n’a pas d’acteur.");

  // Target CA = 10 + Vitesse (pdf)
  const tgtVit =
    Number(FU.getProperty(targetActor, "system.stats.base.vitesse") ?? 0) || 0;
  const targetCA = 10 + tgtVit;

  const techniques = attacker.items.filter((i) => i.type === "technique");
  if (!techniques.length)
    return ui.notifications.warn("Aucune Technique sur cet acteur.");

  const distM = distMetersChebyshev(controlled, targetToken);
  const curE =
    Number(FU.getProperty(attacker, "system.resources.e.value") ?? 0) || 0;

  // Cards UI
  const cards = techniques
    .map((it) => {
      const s = it.system ?? {};
      const cost = Number(s.costE ?? 0) || 0;
      const dmg = s.damage || "1d8";
      const rangeM = Number(s.range ?? METERS_PER_SQUARE) || METERS_PER_SQUARE;
      const notEnough = curE < cost;
      const outOfRange = rangeM < distM; // rule: portée >= distance
      const disabled = notEnough || outOfRange;
      return `
      <label class="bl-card ${outOfRange ? "bl-too-far" : ""} ${
        notEnough ? "bl-not-enough" : ""
      } ${disabled ? "bl-disabled" : ""}">
        <input type="radio" name="tech" value="${it.id}" ${
        disabled ? "disabled" : ""
      }/>
        <div class="bl-card-body">
          <div class="bl-title"><strong>${it.name}</strong></div>
          <div class="bl-sub">${s.breath ?? ""}${
        s.form ? ` — Forme ${s.form}` : ""
      }</div>
          <div class="bl-line"><span>Coût E</span><b>${cost}</b></div>
          <div class="bl-line"><span>Dégâts</span><b>${dmg}</b></div>
          <div class="bl-line"><span>Portée</span><b>${rangeM} m</b></div>
          <div class="bl-line"><span>Distance</span><b>${distM.toFixed(
            1
          )} m</b></div>
        </div>
      </label>
    `;
    })
    .join("");

  const content = `
    <style>
      .bl-wrap { display:grid; grid-template-rows:auto 1fr; gap:.6rem; }
      .bl-legend { font-size:12px; opacity:.9; display:flex; gap:1rem; flex-wrap:wrap; align-items:center; }
      .bl-chip { padding:0 .35rem; border-radius:4px; border:1px solid transparent; }
      .bl-chip.red { background:rgba(255,0,0,.15); border-color:rgba(255,0,0,.35); }
      .bl-chip.gray{ background:rgba(150,150,150,.15); border-color:rgba(150,150,150,.35); }
      .bl-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:.6rem; max-height:560px; overflow:auto; }
      .bl-card { display:flex; gap:.6rem; padding:.5rem; border:1px solid #5554; border-radius:6px; background:#0003; align-items:flex-start; cursor:pointer; }
      .bl-card input[type="radio"]{ margin-top:.2rem; }
      .bl-card .bl-card-body{ display:grid; gap:.2rem; width:100%; }
      .bl-title{ font-size:13px; }
      .bl-sub{ font-size:11px; opacity:.85; margin-top:-2px; }
      .bl-line{ display:flex; justify-content:space-between; font-size:12px; border-top:1px dashed #6664; padding-top:.15rem; }
      .bl-too-far{ background:rgba(255,0,0,0.12); }
      .bl-not-enough{ opacity:.6; }
      .bl-disabled{ pointer-events:none; }
    </style>
    <div class="bl-wrap">
      <div class="bl-legend">
        <div><small>Cible: <b>${
          targetToken.name
        }</b> — CA: <b>${targetCA}</b> — Dist: <b>${distM.toFixed(
    1
  )} m</b> (1 case = ${METERS_PER_SQUARE} m)</small></div>
        <span class="bl-chip gray">Grisé = Endurance insuffisante</span>
        <span class="bl-chip red">Fond rouge = Portée &lt; Distance (interdit)</span>
        <div><small>Règle : <b>Portée ≥ Distance</b> + Jet d’attaque vs CA.</small></div>
      </div>
      <div class="bl-grid">${cards}</div>
    </div>
  `;

  const chosenId = await new Promise((res) => {
    const dlg = new Dialog(
      {
        title: "Techniques disponibles",
        content,
        buttons: {
          ok: {
            label: "Lancer",
            callback: (html) =>
              res(html.find('input[name="tech"]:checked').val() || null),
          },
          cancel: { label: "Fermer", callback: () => res(null) },
        },
        default: "ok",
      },
      { width: 1050 }
    );
    dlg.render(true);
    Hooks.once("renderDialog", (_app, htmlEl) => {
      htmlEl.find(".bl-card").on("click", function () {
        const radio = this.querySelector('input[type="radio"]');
        if (radio && !radio.disabled) radio.checked = true;
      });
    });
  });
  if (!chosenId) return;

  // Re-check + launch
  const item = attacker.items.get(chosenId);
  if (!item) return ui.notifications.warn("Technique introuvable.");

  const s = item.system ?? {};
  const cost = Number(s.costE ?? 0) || 0;
  const dmgExpRaw = s.damage || "1d8";
  const rangeM = Number(s.range ?? METERS_PER_SQUARE) || METERS_PER_SQUARE;

  const curE2 =
    Number(FU.getProperty(attacker, "system.resources.e.value") ?? 0) || 0;
  if (curE2 < cost)
    return ui.notifications.warn(
      `Pas assez d'Endurance (E). Requis: ${cost}, actuel: ${curE2}`
    );

  const distNow = distMetersChebyshev(controlled, targetToken);
  if (rangeM < distNow)
    return ui.notifications.warn(
      `Portée insuffisante : ${rangeM} m < ${distNow.toFixed(1)} m.`
    );

  // Spend E
  await blUpdate(controlled, { "system.resources.e.value": curE2 - cost });

  // Attack roll vs CA
  const atkStatKey = s.attackStat || ATTACK_STAT_FALLBACK;
  const atkBaseVal =
    Number(FU.getProperty(attacker, `system.stats.base.${atkStatKey}`) ?? 0) ||
    0;
  const atkMod = atkBaseVal - 1; // cohérent avec tes tests
  const atkRoll = new Roll(`1d20 + ${atkMod}`);
  await atkRoll.evaluate({ async: true });

  const hit = atkRoll.total >= targetCA;

  // --- Damage: inject Force/Finesse when present in the text ---
  function statValue(actor, key) {
    const v = Number(FU.getProperty(actor, `system.stats.base.${key}`) ?? 0);
    return Number.isFinite(v) ? v : 0;
  }
  function buildDamageFormula(raw, actor) {
    if (!raw || typeof raw !== "string") return "1d8";
    let expr = raw.trim();

    // Handle "Force ou Finesse" (any order/spaces)
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

    // Replace single tokens
    expr = expr.replace(/\bForce\b/gi, String(statValue(actor, "force")));
    expr = expr.replace(/\bFinesse\b/gi, String(statValue(actor, "finesse")));

    return expr;
  }

  const finalDmgExp = buildDamageFormula(dmgExpRaw, attacker);
  const dmgRoll = new Roll(finalDmgExp);
  await dmgRoll.evaluate({ async: true });
  const dmgInfo =
    dmgExpRaw !== finalDmgExp
      ? ` <small style="opacity:.8;">(${finalDmgExp})</small>`
      : "";

  function canInteractWithTarget(tkn) {
    const a = tkn?.actor;
    return game.user.isGM || (a && a.isOwner);
  }

  // Build buttons only if hit; otherwise show a note
  const buttonsHtml = hit
    ? `
    <div class="flexrow" style="gap:.5rem;">
      <button class="bl-dodge"  data-mode="${DODGE_MODE}" data-tn="${DODGE_TN}"
              data-target-token="${targetToken.id}" data-damage="${dmgRoll.total}">
        Esquiver (1 RP)
      </button>
      <button class="bl-takedmg" data-target-token="${targetToken.id}" data-damage="${dmgRoll.total}">
        Prendre les dégâts
      </button>
      <small style="opacity:.8;">(Boutons réservés au MJ ou au propriétaire de ${targetToken.name})</small>
    </div>
  `
    : `
    <div class="bl-miss-note" style="opacity:.8;"><em>Attaque manquée — aucune réaction possible.</em></div>
  `;

  // Chat card
  const msgContent = `
    <div class="bl-card">
      <div><b>${attacker.name}</b> utilise <b>${item.name}</b>${
    s.breath ? ` (${s.breath}${s.form ? ` — Forme ${s.form}` : ""})` : ""
  }</div>
      <div><small>E -${cost} • Cible: ${
    targetToken.name
  } • Dist: ${distNow.toFixed(1)} m • Portée: ${rangeM} m</small></div>
      <div><b>Jet d'attaque:</b> ${atkRoll.total} ${
    atkMod >= 0 ? `(1d20 + ${atkMod})` : `(1d20 ${atkMod})`
  } — <b>CA:</b> ${targetCA} — <b>${hit ? "TOUCHÉ" : "MANQUÉ"}</b></div>
      <div><b>Dégâts:</b> ${dmgRoll.total}${dmgInfo}</div>
      <hr>
      ${buttonsHtml}
      <div class="bl-dodge-result" style="margin-top:.35rem;"></div>
    </div>`;

  const chatMsg = await dmgRoll.toMessage({
    speaker: ChatMessage.getSpeaker({ actor: attacker }),
    flavor: msgContent,
  });

  // Wire buttons (only present if hit)
  Hooks.once("renderChatMessage", (message, html) => {
    if (message.id !== chatMsg.id) return;

    const $dodge = html.find(".bl-dodge");
    const $take = html.find(".bl-takedmg");
    if (!$dodge.length && !$take.length) return; // miss: nothing to wire

    // Esquiver
    $dodge.on("click", async () => {
      const mode = $dodge.data("mode");
      const tn = Number($dodge.data("tn")) || 15;
      const dmgTotal = Number($dodge.data("damage")) || 0;
      const tgtTokenId = String($dodge.data("target-token"));

      const tgtToken = canvas.tokens.get(tgtTokenId);
      const tgtActor = tgtToken?.actor;
      if (!tgtActor) return ui.notifications.warn("Cible invalide.");
      if (!canInteractWithTarget(tgtToken))
        return ui.notifications.warn("Non autorisé.");

      const rpPath = "system.resources.rp.value";
      const rpVal = Number(FU.getProperty(tgtActor, rpPath) ?? 0) || 0;
      if (rpVal < 1)
        return ui.notifications.warn(
          `Pas assez de RP (requis 1, actuel ${rpVal}).`
        );

      // Spend RP
      await blUpdate(tgtToken, { [rpPath]: rpVal - 1 });

      if (mode === "auto") {
        html
          .find(".bl-dodge-result")
          .html(`<em>Esquive réussie — RP -1, dégâts annulés.</em>`);
        $dodge.prop("disabled", true);
        $take.prop("disabled", true);
        return;
      }

      // Mode "roll": 1d20 + (best of Reflex/Agility -1) vs TN
      const d = tgtActor.system ?? {};
      const derived = d.stats?.derived ?? {};
      const refVal = Number(derived.reflexes ?? derived.reflexe ?? 0);
      const agiVal = Number(derived.agilite ?? derived.agility ?? 0);
      const best = Math.max(refVal, agiVal, 0);
      const mod = best - 1;

      const dodgeRoll = new Roll(`1d20 + ${mod}`);
      await dodgeRoll.evaluate({ async: true });
      await dodgeRoll.toMessage({
        speaker: ChatMessage.getSpeaker({ actor: tgtActor }),
        flavor: `<small>Esquive de ${tgtActor.name} (mod: ${
          mod >= 0 ? "+" : ""
        }${mod}) vs TN ${tn}</small>`,
      });

      if (dodgeRoll.total >= tn) {
        html
          .find(".bl-dodge-result")
          .html(`<em>Esquive réussie — RP -1, dégâts annulés.</em>`);
        $dodge.prop("disabled", true);
        $take.prop("disabled", true);
      } else {
        html
          .find(".bl-dodge-result")
          .html(
            `<em>Esquive échouée — RP -1. Vous pouvez cliquer “Prendre les dégâts”.</em>`
          );
        $dodge.prop("disabled", true);
      }
    });

    // Prendre les dégâts
    $take.on("click", async () => {
      const dmgTotal = Number($take.data("damage")) || 0;
      const tgtTokenId = String($take.data("target-token"));

      const tgtToken = canvas.tokens.get(tgtTokenId);
      const tgtActor = tgtToken?.actor;
      if (!tgtActor) return ui.notifications.warn("Cible invalide.");
      if (!(game.user.isGM || tgtActor.isOwner))
        return ui.notifications.warn("Non autorisé.");

      const hpPath = "system.resources.hp.value";
      const curHP = Number(FU.getProperty(tgtActor, hpPath) ?? 0) || 0;
      const newHP = Math.max(0, curHP - dmgTotal);
      await blUpdate(tgtToken, { [hpPath]: newHP });

      html
        .find(".bl-dodge-result")
        .html(
          `<em>${tgtActor.name} prend <b>${dmgTotal}</b> dégâts (PV ${curHP} → ${newHP}).</em>`
        );
      html.find(".bl-dodge").prop("disabled", true);
      $take.prop("disabled", true);
    });
  });
})();
