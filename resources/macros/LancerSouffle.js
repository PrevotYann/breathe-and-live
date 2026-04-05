(async () => {
  const systemApi =
    game.breatheAndLive ||
    game.system?.api ||
    game.modules.get("breathe-and-live")?.api;
  if (!systemApi?.useTechnique) {
    return ui.notifications.error("API Breathe & Live introuvable.");
  }

  const controlled = canvas.tokens.controlled[0];
  if (!controlled?.actor) {
    return ui.notifications.warn("Selectionne d'abord un token.");
  }

  const actor = controlled.actor;
  const techniques = actor.items.filter(
    (item) => ["technique", "subclassTechnique", "bda", "demonAbility"].includes(item.type)
  );
  if (!techniques.length) {
    return ui.notifications.warn("Aucune technique disponible sur cet acteur.");
  }

  const METERS_PER_SQUARE = 1.5;
  const distMetersChebyshev = (aToken, bToken) => {
    const gs = canvas.grid.size || 100;
    const dx = Math.abs(aToken.center.x - bToken.center.x) / gs;
    const dy = Math.abs(aToken.center.y - bToken.center.y) / gs;
    return Math.max(dx, dy) * METERS_PER_SQUARE;
  };
  const getRangeMeters = (item) => {
    if (item.system?.automation?.unlimitedRange) return Number.POSITIVE_INFINITY;
    const range = Number(item.system?.range ?? 1.5);
    return Number.isFinite(range) ? range : 1.5;
  };
  const hasTargetInRange = (item) => {
    const rangeM = getRangeMeters(item);
    return canvas.tokens.placeables.some((token) => {
      if (!token?.actor || token.id === controlled.id || token.document.hidden) return false;
      return distMetersChebyshev(controlled, token) <= rangeM;
    });
  };

  const rows = techniques
    .map((item) => {
      const family = item.system?.breathLabel || item.system?.breath || item.type;
      const selectable = hasTargetInRange(item);
      const rangeLabel =
        getRangeMeters(item) === Number.POSITIVE_INFINITY
          ? "Portée illimitée"
          : `Portée ${item.system?.range ?? 1.5} m`;
      const details = [
        family,
        item.system?.form ? `Forme ${item.system.form}` : "",
        item.system?.costE ? `E ${item.system.costE}` : "",
        item.system?.costRp ? `RP ${item.system.costRp}` : "",
        item.system?.costBdp ? `BDP ${item.system.costBdp}` : "",
        rangeLabel,
      ]
        .filter(Boolean)
        .join(" • ");

      return `
        <label
          class="bl-tech-row ${selectable ? "" : "bl-tech-row--disabled"}"
          style="
            display:grid;
            gap:.15rem;
            padding:.45rem;
            border:1px solid ${selectable ? "rgba(255,255,255,.1)" : "rgba(176,56,56,.45)"};
            border-radius:6px;
            margin-bottom:.35rem;
            background:${selectable ? "rgba(0,0,0,.08)" : "rgba(120,40,40,.18)"};
            opacity:${selectable ? "1" : ".58"};
            color:${selectable ? "inherit" : "#6e6e6e"};
          "
        >
          <span><input type="radio" name="bl-technique" value="${item.id}" ${selectable ? "" : "disabled"} /> <strong>${item.name}</strong></span>
          <small>${details}</small>
          <small>${item.system?.damage || "-"}</small>
          ${selectable ? "" : '<small><em>Pas de cible à portée</em></small>'}
        </label>
      `;
    })
    .join("");

  const chosenId = await new Promise((resolve) => {
    new Dialog(
      {
        title: "Choisir une technique",
        content: `<form style="max-height:520px; overflow:auto;">${rows}</form>`,
        buttons: {
          ok: {
            label: "Utiliser",
            callback: (html) =>
              resolve(String(html.find('input[name="bl-technique"]:checked').val() || "")),
          },
          cancel: {
            label: "Annuler",
            callback: () => resolve(""),
          },
        },
        default: "ok",
      },
      { width: 720 }
    ).render(true);
  });

  if (!chosenId) return;
  const item = actor.items.get(chosenId);
  if (!item) return ui.notifications.warn("Technique introuvable.");

  await systemApi.useTechnique(actor, item, { controlledToken: controlled });
})();
