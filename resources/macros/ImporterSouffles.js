// Breathe & Live — Importer Souffles (Items) → Monde + (option) Compendium
// Crée des Items {type: "breath"} avec specials (booleans) et clé système pour repérage.

(async () => {
  const FU = foundry.utils;

  // === 1) Définition des souffles (clé stable + nom + capacités spéciales) ===
  // Remplis/renomme les special keys comme tu veux (elles n'imposent pas de règle ici).
  const BREATHS = [
    { key: "sun", name: "Souffle du Soleil", specials: ["elu"] },
    { key: "water", name: "Souffle de l'Eau", specials: ["devierVagues"] },
    { key: "flame", name: "Souffle de la Flamme", specials: [] },
    { key: "wind", name: "Souffle du Vent", specials: ["ventsDeGuerre"] },
    {
      key: "thunder",
      name: "Souffle de la Foudre",
      specials: ["vitesseLumiere"],
    },
    { key: "stone", name: "Souffle de la Pierre", specials: ["coupePierre"] },
    { key: "mist", name: "Souffle de la Brume", specials: ["nuagesTrainants"] },
    { key: "serpent", name: "Souffle du Serpent", specials: ["formeLibre"] },
    { key: "snow", name: "Souffle de la Neige", specials: ["dentsDeKatana"] },
  ];

  // === 2) Choix du compendium (optionnel) ===
  const packs = Array.from(game.packs).filter(
    (p) => p.metadata.type === "Item"
  );
  const packOpts = packs
    .map(
      (p) =>
        `<option value="${p.collection}">${p.title} (${p.collection})</option>`
    )
    .join("");
  const html = `
    <p>Créer les Souffles dans le monde (dossier “Souffles (Import)”) et éventuellement les pousser dans un compendium.</p>
    <div class="form-group">
      <label>Compendium cible (optionnel)</label>
      <select id="bl-pack"><option value="">— Aucun —</option>${packOpts}</select>
    </div>
    <div class="form-group">
      <label>Type d'Item</label>
      <select id="bl-type">
        <option value="breath">breath</option>
        <option value="feature">feature</option>
      </select>
      <p class="notes">Choisis "feature" si tu n'as pas ajouté "breath" dans Item.types.</p>
    </div>
  `;
  const params = await new Promise((res) => {
    new Dialog(
      {
        title: "Importer les Souffles",
        content: html,
        buttons: {
          ok: {
            label: "Importer",
            callback: (dlg) =>
              res({
                pack: dlg.find("#bl-pack").val() || "",
                itype: dlg.find("#bl-type").val() || "breath",
              }),
          },
          cancel: { label: "Annuler", callback: () => res(null) },
        },
        default: "ok",
      },
      { width: 520 }
    ).render(true);
  });
  if (!params) return;

  // === 3) Dossier monde ===
  let folder = game.folders.find(
    (f) => f.type === "Item" && f.name === "Souffles (Import)"
  );
  if (!folder)
    folder = await Folder.create({
      name: "Souffles (Import)",
      type: "Item",
      sorting: "a",
    });

  // === 4) Créer/mettre à jour dans le Monde (clé = name) ===
  const existing = game.items.filter((i) => i.type === params.itype);
  const byName = new Map(existing.map((i) => [i.name, i]));
  const toCreate = [];
  const toUpdate = [];

  for (const b of BREATHS) {
    const sys = {
      key: b.key,
      // structure souple : specials = { cle: false }
      specials: Object.fromEntries(b.specials.map((s) => [s, false])),
      description: "",
    };
    const doc = byName.get(b.name);
    if (!doc) {
      toCreate.push({
        name: b.name,
        type: params.itype,
        folder: folder.id,
        system: sys,
      });
    } else {
      toUpdate.push({
        _id: doc.id,
        "system.key": b.key,
        "system.specials": sys.specials,
      });
    }
  }

  const created = toCreate.length ? await Item.createDocuments(toCreate) : [];
  if (toUpdate.length) await Item.updateDocuments(toUpdate);

  ui.notifications.info(
    `Souffles: créés ${created.length}, mis à jour ${toUpdate.length}.`
  );

  // === 5) Pousser dans compendium (si choisi) ===
  if (params.pack) {
    const pack = game.packs.get(params.pack);
    if (!pack)
      return ui.notifications.warn(`Compendium introuvable: ${params.pack}`);
    const packDocs = await pack.getDocuments();
    const packByName = new Map(packDocs.map((d) => [d.name, d]));
    const worldDocs = BREATHS.map((b) => game.items.getName(b.name)).filter(
      Boolean
    );

    const importData = [];
    for (const w of worldDocs) {
      if (!packByName.has(w.name)) importData.push(w.toObject());
    }
    if (importData.length) {
      await pack.importDocuments(importData);
      ui.notifications.info(
        `Souffles importés dans ${pack.metadata.label}: ${importData.length}`
      );
    } else {
      ui.notifications.info(
        `Aucun nouveau Souffle à importer dans ${pack.metadata.label}.`
      );
    }
  }

  // Résumé chat
  ChatMessage.create({
    content: `<p><b>Souffles importés</b> — Monde: +${created.length} (maj ${toUpdate.length}).</p>`,
  });
})();
