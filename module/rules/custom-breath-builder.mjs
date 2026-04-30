import { CUSTOM_BREATH_COST_TABLES } from "../config/rule-data.mjs";

function findEntry(table, key, fallback = null) {
  return (CUSTOM_BREATH_COST_TABLES[table] || []).find((entry) => entry.key === key) || fallback;
}

export function calculateCustomBreathCost({ damageKey = "1d8", rangeKey = "melee", effectKey = "direct" } = {}) {
  const damage = findEntry("damage", damageKey, CUSTOM_BREATH_COST_TABLES.damage[1]);
  const range = findEntry("range", rangeKey, CUSTOM_BREATH_COST_TABLES.range[0]);
  const effect = findEntry("effects", effectKey, CUSTOM_BREATH_COST_TABLES.effects[0]);
  const rawCost =
    Number(damage?.endurance || 0) +
    Number(range?.endurance || 0) +
    Number(effect?.endurance || 0);

  return {
    damage,
    range,
    effect,
    rawCost,
    // TODO-RULEBOOK-AMBIGUITY: the custom-breath table can sum below zero for
    // low damage/melee/direct forms. Foundry execution cannot spend negative
    // Endurance, so item cost is clamped to 0 while rawCost remains visible.
    costE: Math.max(0, rawCost),
  };
}

export function buildCustomBreathTechniqueData({
  name = "Technique de souffle originale",
  breath = "custom",
  form = 1,
  damageKey = "1d8",
  rangeKey = "melee",
  effectKey = "direct",
  attackStat = "finesse",
} = {}) {
  const result = calculateCustomBreathCost({ damageKey, rangeKey, effectKey });
  const tags = ["breath", "custom", effectKey].filter(Boolean);
  const automation = {
    requiresBreath: true,
    area: effectKey === "sweep" ? "allInRange" : "single",
    alternativeMode: effectKey === "deflect" ? "deflect" : "",
    lineOnly: false,
    ranged: effectKey === "ranged",
    unlimitedRange: false,
    chargeTurns: effectKey === "charge" ? 1 : 0,
    cooldownTurns: 0,
    cannotBeDodged: false,
    cannotBeReactedTo: false,
    deflect: effectKey === "deflect",
    negateIncomingDamage: effectKey === "deflect",
    afflictionStacks: effectKey === "affliction" ? 1 : 0,
    afflictionCondition: "",
    pursuer: effectKey === "pursuer",
    sweep: effectKey === "sweep",
    regenerator: effectKey === "regenerator",
    enduranceRestore: effectKey === "regenerator" ? "damageDealt" : "none",
  };

  return {
    name,
    type: "technique",
    img: "icons/skills/melee/strike-sword-slashing-red.webp",
    system: {
      sourceSection: "Creation de souffle personnalise",
      activation: "action",
      tags,
      usageNote: `Cout brut table: ${result.rawCost}. Cout Foundry: ${result.costE}. Effet principal: ${result.effect?.label || effectKey}.`,
      prerequisites: {
        class: "",
        rank: "",
        sense: "",
        weapon: "",
        trait: "",
      },
      breath,
      breathKey: breath,
      breathLabel: breath === "custom" ? "Souffle Original" : breath,
      form: Number(form) || 1,
      costE: result.costE,
      damage: result.damage?.key || damageKey,
      damageText: result.damage?.label || damageKey,
      range: result.range?.meters ?? 1.5,
      rangeText: result.range?.label || rangeKey,
      attackStat,
      autoHit: true,
      isBreath: true,
      specialLines: [`Effet principal: ${result.effect?.label || effectKey}`],
      automation,
      customBreath: {
        enabled: true,
        damageKey,
        rangeKey,
        effectKey,
        rawCost: result.rawCost,
      },
      flags: {
        aoe: effectKey === "sweep",
        antiFriendlyFire: false,
        mobility: effectKey === "charge" || effectKey === "pursuer",
        decapitation: false,
        charge: effectKey === "charge" ? 1 : 0,
        deflect: effectKey === "deflect",
        regenerator: effectKey === "regenerator",
        affliction: effectKey === "affliction",
        pursuer: effectKey === "pursuer",
        sweep: effectKey === "sweep",
      },
    },
  };
}

export async function openCustomBreathBuilder(actor = null) {
  const optionList = (table) =>
    CUSTOM_BREATH_COST_TABLES[table]
      .map((entry) => `<option value="${entry.key}">${entry.label} (${entry.endurance >= 0 ? "+" : ""}${entry.endurance} E)</option>`)
      .join("");

  const payload = await new Promise((resolve) => {
    new Dialog(
      {
        title: "Calculateur de souffle maison",
        content: `
          <div class="form-group"><label>Nom</label><input id="bl-custom-name" type="text" value="Technique de souffle originale" /></div>
          <div class="form-group"><label>Souffle</label><input id="bl-custom-breath" type="text" value="custom" /></div>
          <div class="form-group"><label>Forme</label><input id="bl-custom-form" type="number" min="1" value="1" /></div>
          <div class="form-group"><label>Degats</label><select id="bl-custom-damage">${optionList("damage")}</select></div>
          <div class="form-group"><label>Portee</label><select id="bl-custom-range">${optionList("range")}</select></div>
          <div class="form-group"><label>Effet principal</label><select id="bl-custom-effect">${optionList("effects")}</select></div>
          <div class="form-group"><label>Stat</label><select id="bl-custom-stat"><option value="finesse">Finesse</option><option value="force">Force</option></select></div>
        `,
        buttons: {
          create: {
            label: actor ? "Creer sur l'acteur" : "Calculer",
            callback: (html) =>
              resolve({
                name: String(html.find("#bl-custom-name").val() || ""),
                breath: String(html.find("#bl-custom-breath").val() || "custom"),
                form: Number(html.find("#bl-custom-form").val() || 1),
                damageKey: String(html.find("#bl-custom-damage").val() || "1d8"),
                rangeKey: String(html.find("#bl-custom-range").val() || "melee"),
                effectKey: String(html.find("#bl-custom-effect").val() || "direct"),
                attackStat: String(html.find("#bl-custom-stat").val() || "finesse"),
              }),
          },
          cancel: { label: "Annuler", callback: () => resolve(null) },
        },
        default: "create",
      },
      { width: 520 }
    ).render(true);
  });
  if (!payload) return null;

  const itemData = buildCustomBreathTechniqueData(payload);
  const cost = calculateCustomBreathCost(payload);
  if (actor) {
    const created = await actor.createEmbeddedDocuments("Item", [itemData]);
    ui.notifications.info(`${itemData.name}: cout ${cost.costE} E (brut ${cost.rawCost}).`);
    return created?.[0] || itemData;
  }

  await ChatMessage.create({
    content: `<strong>${itemData.name}</strong>: cout ${cost.costE} E (brut ${cost.rawCost}), ${itemData.system.damage}, ${itemData.system.rangeText}, ${itemData.system.specialLines[0]}.`,
  });
  return itemData;
}
