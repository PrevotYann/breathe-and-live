// Breathe & Live — Importer Techniques (CSV -> Items & Compendium) v1.1
// - CSV parser robuste (multilignes, guillemets)
// - Mapping FR/EN + nettoyage portée + description enrichie
// - Dédup monde & compendium par (name+breath+form)

(async () => {
  const FU = foundry.utils;

  // ---------- UI ----------
  const packs = Array.from(game.packs).filter(
    (p) => p.metadata.type === "Item"
  );
  const packOptions = packs
    .map(
      (p) =>
        `<option value="${p.collection}">${p.title} (${p.collection})</option>`
    )
    .join("");
  const dlgHtml = `
    <style>
      .bl-grid { display:grid; grid-template-columns: 1fr 1fr; gap:.5rem; }
      .bl-grid .full { grid-column: 1 / -1; }
      textarea { width:100%; height: 260px; }
      .hint { opacity:.8; font-size:12px; }
      .muted { opacity:.7; }
      .small { font-size:12px; }
    </style>
    <div class="bl-grid">
      <label class="full"><b>CSV (coller ici)</b> <span class="muted small">; gère guillemets et multi-lignes</span></label>
      <textarea id="bl-csv" class="full" placeholder="Souffle,# Forme,Nom,Description,Modificateur,Coût Endurance,Portée,Dégâts&#10;Flamme,1,Feu Inconscient,Texte...,Force,2,1.5m / CàC,3d6 + Force"></textarea>

      <label>Compendium cible (optionnel)</label>
      <select id="bl-pack"><option value="">— Ne pas pousser dans un compendium —</option>${packOptions}</select>

      <label>Défaut “Souffle” (si colonne manquante)</label>
      <input id="bl-default-breath" type="text" placeholder="ex: Eau / Soleil" />

      <label>Défaut “Stat d’attaque”</label>
      <input id="bl-default-astat" type="text" value="vitesse" />

      <div class="full hint">
        Colonnes reconnues (FR/EN, accents/casse ignorés) :
        <code>Nom|Name</code>, <code>Souffle|Breath</code>, <code># Forme|Forme|Form</code>,
        <code>Coût Endurance|Cout Endurance|CostE|Cost</code>, <code>Portée|Portee|Range</code>,
        <code>Dégâts|Degats|Damage</code>, <code>Description</code>, <code>Modificateur|Modifier|AttackStat</code>, <code>Tags</code>.
      </div>
    </div>
  `;
  const params = await new Promise((res) => {
    new Dialog(
      {
        title: "Importer Techniques (CSV)",
        content: dlgHtml,
        buttons: {
          ok: {
            label: "Importer",
            callback: (html) =>
              res({
                csvText: html.find("#bl-csv").val()?.trim() ?? "",
                targetPack: html.find("#bl-pack").val() || "",
                defaultBreath:
                  html.find("#bl-default-breath").val()?.trim() ?? "",
                defaultAStat:
                  html.find("#bl-default-astat").val()?.trim() || "vitesse",
              }),
          },
          cancel: { label: "Annuler", callback: () => res(null) },
        },
        default: "ok",
      },
      { width: 720, height: 520 }
    ).render(true);
  });
  if (!params || !params.csvText) return;

  // ---------- Helpers: normalisation ----------
  const normalize = (s) => (s ?? "").toString().trim();
  const toKey = (s) =>
    normalize(s)
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, ""); // remove accents

  // CSV parser robuste (séparateur auto , ou ;)
  function parseCSVRobust(src) {
    // guess separator from header line (first newline)
    const firstNl = src.indexOf("\n");
    const headLine = firstNl >= 0 ? src.slice(0, firstNl) : src;
    const sep = headLine.includes(";") && !headLine.includes(",") ? ";" : ",";

    const rows = [];
    let row = [];
    let field = "";
    let inQ = false;

    for (let i = 0; i < src.length; i++) {
      const ch = src[i];

      if (ch === '"') {
        const next = src[i + 1];
        if (inQ && next === '"') {
          field += '"';
          i++;
          continue;
        } // escaped quote ""
        inQ = !inQ;
        continue;
      }

      if (!inQ && ch === sep) {
        row.push(field);
        field = "";
        continue;
      }
      if (!inQ && (ch === "\n" || ch === "\r")) {
        // handle CRLF
        if (ch === "\r" && src[i + 1] === "\n") i++;
        row.push(field);
        field = "";
        rows.push(row);
        row = [];
        continue;
      }

      field += ch;
    }
    // last field
    row.push(field);
    rows.push(row);

    // Remove trailing empty rows
    while (rows.length && rows[rows.length - 1].every((c) => !normalize(c)))
      rows.pop();

    const header = (rows.shift() || []).map((h) => toKey(h));
    const objects = rows.map((cols) => {
      const obj = {};
      header.forEach((h, idx) => (obj[h] = normalize(cols[idx])));
      return obj;
    });
    return { header, rows: objects, sep };
  }

  const parsed = parseCSVRobust(params.csvText);
  if (!parsed.rows?.length)
    return ui.notifications.warn("CSV vide ou invalide.");

  // ---------- Mapping colonnes ----------
  // Construisons un index header -> nom logique
  const aliasMap = {
    name: ["nom", "name", "titre", "title"],
    breath: ["souffle", "breath"],
    form: ["# forme", "forme", "#forme", "form"],
    coste: [
      "coût endurance",
      "cout endurance",
      "coste",
      "cost",
      "cout e",
      "coût e",
      "endurance",
      "e",
    ],
    range: ["portee", "portée", "range"],
    damage: ["degats", "dégâts", "damage", "dmg"],
    description: ["description", "desc"],
    attackstat: [
      "modificateur",
      "modifier",
      "attackstat",
      "statattaque",
      "stat dattaque",
      "stat d’attaque",
      "astat",
    ],
    tags: ["tags", "motscles", "mots-cles", "mots cles"],
  };
  const colFor = (want) => {
    const list = aliasMap[want] || [];
    return parsed.header.find((h) => list.includes(h)) ?? null;
  };
  const COL = Object.fromEntries(
    Object.keys(aliasMap).map((k) => [k, colFor(k)])
  );

  // ---------- Normalisations métiers ----------
  const parseRangeMeters = (s) => {
    if (!s) return 1.5;
    const lower = toKey(s);
    // chope premier nombre (ex: "1.5m / ca c")
    const m = lower.match(/([\d]+[.,]?[\d]*)\s*m/);
    if (m) return Number(m[1].replace(",", ".")) || 1.5;
    // si "cac" sans nombre -> 1.5
    if (lower.includes("cac") || lower.includes("c a c")) return 1.5;
    // sinon nombre nu
    const m2 = lower.match(/([\d]+[.,]?[\d]*)/);
    return m2 ? Number(m2[1].replace(",", ".")) : 1.5;
  };

  const deduceAttackStat = (s, def = "vitesse") => {
    const k = toKey(s);
    if (k.includes("finesse")) return "finesse";
    if (k.includes("force")) return "force";
    // si "force / finesse" → ambigu → vide pour laisser au système choisir
    if (k.includes("force") && k.includes("finesse")) return "";
    return def || "";
  };

  const splitDamageAndNotes = (s) => {
    if (!s) return { dmg: "1d8", notes: [] };
    const parts = s
      .split(/\r?\n/)
      .map((t) => t.trim())
      .filter(Boolean);
    const dmg = parts.shift() || "1d8";
    return { dmg, notes: parts };
  };

  const mergeDescription = (desc, extraLines = []) => {
    const cleanDesc = desc ? desc : "";
    if (!extraLines.length) return cleanDesc;
    return (
      cleanDesc +
      (cleanDesc ? "\n\n" : "") +
      extraLines.map((t) => `• ${t}`).join("\n")
    );
  };

  const normTags = (txt) => {
    if (!txt) return [];
    return txt
      .split(/[;,]/)
      .map((t) => t.trim())
      .filter(Boolean);
  };

  // ---------- Dossier monde & compendium ----------
  let folder = game.folders.find(
    (f) => f.type === "Item" && f.name === "Techniques (Import)"
  );
  if (!folder)
    folder = await Folder.create({
      name: "Techniques (Import)",
      type: "Item",
      sorting: "a",
    });

  const pack = params.targetPack ? game.packs.get(params.targetPack) : null;
  if (params.targetPack && !pack)
    ui.notifications.warn(
      `Compendium introuvable: ${params.targetPack}. Import dans le monde uniquement.`
    );

  // Dedup monde: clé (name::breath::form)
  const worldExisting = game.items.filter((i) => i.type === "technique");
  const keyOf = (it) =>
    `${toKey(it.name)}::${toKey(FU.getProperty(it, "system.breath") || "")}::${
      FU.getProperty(it, "system.form") || ""
    }`;
  const worldKeys = new Set(worldExisting.map(keyOf));

  // ---------- Construction des Items ----------
  const rows = parsed.rows;
  const createdData = [];

  for (const r of rows) {
    const name = COL.name ? r[COL.name] : "";
    const breath = (COL.breath ? r[COL.breath] : params.defaultBreath) || "";
    const formRaw = COL.form ? r[COL.form] : "1";
    const form = Number((formRaw || "1").toString().replace(",", "."));
    const costRaw = COL.coste ? r[COL.coste] : "0";
    const costE = Number((costRaw || "0").toString().replace(",", "."));
    const rangeRaw = COL.range ? r[COL.range] : "";
    const range = parseRangeMeters(rangeRaw);
    const desc = COL.description ? r[COL.description] : "";
    const dmgRaw = COL.damage ? r[COL.damage] : "1d8";
    const { dmg, notes } = splitDamageAndNotes(dmgRaw);
    const attackStat = COL.attackstat
      ? deduceAttackStat(r[COL.attackstat], params.defaultAStat)
      : params.defaultAStat || "";
    const extraTags = COL.tags ? normTags(r[COL.tags]) : [];

    if (!name) {
      // ligne vide / mal parsée → on ignore proprement
      continue;
    }

    // description enrichie avec les notes de la colonne Dégâts
    const description = mergeDescription(desc, notes);

    const data = {
      name,
      type: "technique",
      folder: folder.id,
      system: {
        breath,
        form: isNaN(form) ? 1 : form,
        costE: isNaN(costE) ? 0 : costE,
        damage: dmg,
        range,
        attackStat,
        tags: extraTags,
        description,
      },
    };

    const key = keyOf({ name, system: { breath, form } });
    if (worldKeys.has(key)) {
      // déjà présent dans le monde → on saute
      continue;
    }
    worldKeys.add(key);
    createdData.push(data);
  }

  // Création dans le monde
  const created = await Item.createDocuments(createdData, { keepId: false });
  ui.notifications.info(`Techniques créées dans le monde : ${created.length}`);

  // Push compendium (sans doublon pack)
  if (pack && created.length) {
    const existing = await pack.getDocuments();
    const keyPack = (it) =>
      `${toKey(it.name)}::${toKey(
        FU.getProperty(it, "system.breath") || ""
      )}::${FU.getProperty(it, "system.form") || ""}`;
    const packKeys = new Set(existing.map(keyPack));
    const toImport = created
      .map((doc) => doc.toObject())
      .filter((obj) => !packKeys.has(keyPack(obj)));
    if (toImport.length) {
      await pack.importDocuments(toImport);
      ui.notifications.info(
        `Techniques importées dans ${pack.metadata.label}: ${toImport.length}`
      );
    } else {
      ui.notifications.info(
        `Aucune nouvelle technique à importer dans ${pack.metadata.label}.`
      );
    }
  }

  // Résumé chat
  const listHtml = created
    .slice(0, 10)
    .map(
      (i) =>
        `<li>${i.name} — ${i.system?.breath ?? ""} (Forme ${
          i.system?.form ?? "?"
        })</li>`
    )
    .join("");
  ChatMessage.create({
    speaker: ChatMessage.getSpeaker(),
    content: `<p><b>Import Techniques terminé</b> — ${
      created.length
    } objet(s) créé(s).</p>${
      listHtml
        ? `<ul>${listHtml}</ul>${
            created.length > 10 ? `<p>... (+${created.length - 10})</p>` : ""
          }`
        : ""
    }`,
  });
})();
