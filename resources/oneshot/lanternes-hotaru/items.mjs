// Items written for the one-shot. Values the book leaves to the GM (blood demon
// art costs and damage of a custom demon) are scenario choices and say so.
import { ASSETS } from "./ids.mjs";

export const SOURCE_SECTION = "One-shot : Les Lanternes de Hotaru";

const commonItem = (system) => ({
  tags: [],
  description: "",
  sourceSection: SOURCE_SECTION,
  activation: "passive",
  quantity: 1,
  usageNote: "",
  prerequisites: { class: "", rank: "", breath: "", weapon: "", trait: "" },
  uses: { value: 0, max: 0, per: "" },
  effects: [],
  selfEffects: [],
  templates: ["commonItem"],
  ...system,
});

const bdaAutomation = (overrides) => ({
  area: "single", unlimitedRange: false, cannotBeDodged: false, cannotBeReactedTo: false,
  afflictionCondition: "", afflictionIntensity: 1, afflictionDuration: 0, markAsh: false, noDamage: false,
  delayedDamageRounds: 0, delayedDamageFormula: "", targetCapBase: 0, targetCapScalePerLevel: 0,
  summonFormula: "", teleportToBurned: false, ...overrides,
});

const SCENARIO_VALUE = "Valeurs propres à ce scénario : le livre laisse au MJ le coût et les dégâts des arts de sang d'un démon inventé (dégâts calés sur le repère « Démon de rang élevé : BDA 1d6+3 »).";

/** Blood demon arts of Tomoshibi, embedded on his sheet. */
export const TOMOSHIBI_ARTS = [
  {
    key: "bda-feu-follet",
    name: "Art de sang — Feu follet bleu",
    type: "bda",
    img: `${ASSETS}/abilities/feu-follet-bleu.webp`,
    system: commonItem({
      tags: ["bda", "demon", "oneshot", "burn"],
      activation: "action",
      description: "<p>Tomoshibi souffle sur une petite lanterne bleue qui file vers sa cible et éclate en flammes froides.</p>",
      usageNote: `Jet de toucher (Finesse) contre la CA. Si ça touche : dégâts + Brûlure. ${SCENARIO_VALUE}`,
      costBdp: 3, demonisationGain: 0, damage: "1d6 + Finesse", range: 9, rangeText: "9 m", attackStat: "finesse", autoHit: false,
      specialLines: ["Applique Brûlure (1 dégât de feu par tour) si l'attaque touche."],
      automation: bdaAutomation({ afflictionCondition: "burn" }),
      ruleSource: { checkedAt: "2026-10-29", missingFields: ["coût BDP", "dégâts"], approved: false, scenario: true },
    }),
  },
  {
    key: "bda-lueur-d-oubli",
    name: "Art de sang — Lueur d'oubli",
    type: "bda",
    img: `${ASSETS}/abilities/lueur-d-oubli.webp`,
    system: commonItem({
      tags: ["bda", "demon", "oneshot", "charmed"],
      activation: "action",
      description: "<p>Une lumière bleue, douce comme une veilleuse d'enfance. La cible oublie un instant pourquoi elle se bat.</p>",
      usageNote: `Jet de toucher (Finesse) contre la CA. Si ça touche : état Charmé. Conseil MJ : une fois par round au maximum ; le charme se brise dès que le personnage charmé subit des dégâts ou à la fin de son prochain tour. ${SCENARIO_VALUE}`,
      costBdp: 5, demonisationGain: 0, damage: "1d4", range: 9, rangeText: "9 m", attackStat: "finesse", autoHit: false,
      specialLines: ["Applique Charmé si l'attaque touche (voir conseil MJ)."],
      automation: bdaAutomation({ afflictionCondition: "charmed", afflictionDuration: 1 }),
      ruleSource: { checkedAt: "2026-10-29", missingFields: ["coût BDP", "dégâts", "durée du charme"], approved: false, scenario: true },
    }),
  },
  {
    key: "bda-lanterne-prison",
    name: "Art de sang — Lanterne-prison",
    type: "bda",
    img: `${ASSETS}/tokens/lanterne-prison.webp`,
    system: commonItem({
      tags: ["bda", "demon", "oneshot", "imprisoned"],
      activation: "action",
      description: "<p>Des feuilles de papier huilé s'enroulent autour de la cible et se referment en lanterne géante.</p>",
      usageNote: `Jet de toucher (Finesse) contre la CA. Si ça touche : état Emprisonné. Pour se libérer : une action et un test de Force DD 13, ou un allié au contact coupe le papier (une action, réussite automatique). ${SCENARIO_VALUE}`,
      costBdp: 6, demonisationGain: 0, damage: "1d4", range: 4.5, rangeText: "4,5 m", attackStat: "finesse", autoHit: false,
      specialLines: ["Applique Emprisonné si l'attaque touche.", "Libération : test de Force DD 13 ou un allié coupe le papier."],
      automation: bdaAutomation({ afflictionCondition: "imprisoned" }),
      ruleSource: { checkedAt: "2026-10-29", missingFields: ["coût BDP", "dégâts", "condition de libération"], approved: false, scenario: true },
    }),
  },
  {
    key: "lignee-lanternier",
    name: "Nature — Le Lanternier",
    type: "demonAbility",
    img: `${ASSETS}/tokens/tomoshibi.webp`,
    system: commonItem({
      tags: ["demon", "oneshot", "passive", "sadness"],
      activation: "passive",
      description: "<p>Tomoshibi était un garçon nommé Kansuke. Il a oublié presque tout, sauf la voix de la vieille Oume.</p>",
      usageNote: "Point faible narratif : si quelqu'un l'appelle « Kansuke » en lui rappelant sa vie d'avant (Oume, ou un PJ qui a lu son carnet), il doit réussir un test d'Endurance DD 15 (règle de l'état Triste) ou devenir Triste. Choix du scénario : un démon Triste perd sa prochaine action. Une seule fois par combat.",
      costBdp: 0, demonisationGain: 0, damage: "", range: 0, rangeText: "", attackStat: "", specialLines: [],
      automation: bdaAutomation({ noDamage: true }),
    }),
  },
];

/** Plot items handed to the players during the adventure (world items). */
export const PLOT_ITEMS = [
  {
    key: "lanterne-bleue",
    name: "Lanterne bleue",
    type: "utility",
    img: `${ASSETS}/items/lanterne-bleue.webp`,
    system: commonItem({
      tags: ["oneshot", "indice"],
      description: "<p>Une petite lanterne en papier, d'un bleu profond qui ne ressemble à aucune teinture du marché. Elle est froide au toucher, même allumée. Une odeur d'huile brûlée et de sang s'en dégage.</p><p><b>Indice :</b> la vieille Oume reconnaît immédiatement ce bleu : c'est le « bleu de Kansuke », une teinture que seul son ancien apprenti savait préparer.</p>",
      usageNote: "Objet d'enquête, sans effet de jeu. Récupérée sur la rivière (Acte 2) ou près de la maison du charbonnier (Acte 1).",
    }),
  },
  {
    key: "carnet-kansuke",
    name: "Carnet brûlé de Kansuke",
    type: "utility",
    img: `${ASSETS}/items/carnet-kansuke.webp`,
    system: commonItem({
      tags: ["oneshot", "indice"],
      description: "<p>Un petit carnet aux bords noircis par le feu. Oume l'a gardé dix ans. Il contient des dessins de lanternes et quelques phrases d'un garçon très seul.</p><p>Voir l'aide de jeu « Carnet brûlé de Kansuke ».</p>",
      usageNote: "Objet d'enquête. Un PJ qui l'a lu peut appeler le démon par son vrai nom (voir « Nature — Le Lanternier »).",
    }),
  },
  {
    key: "omamori-mii",
    name: "Omamori de Mii",
    type: "utility",
    img: `${ASSETS}/items/omamori-mii.webp`,
    system: commonItem({
      tags: ["oneshot", "roleplay"],
      description: "<p>Un petit sachet de tissu rouge, cousu de travers. Mii l'a acheté au sanctuaire pour que son grand frère Sota revienne. Elle le donne au pourfendeur qui lui a promis de le ramener.</p>",
      usageNote: "Objet de roleplay sans effet de jeu. À l'épilogue, le rendre à Sota est un beau moment.",
    }),
  },
];

/** Compendium items copied into the "Livraison Kakushi" folder (book rule: requesting items at the briefing). */
export const KAKUSHI_DELIVERY = [
  { source: "60cd44c04b9ccb78" }, // Bandage
  { source: "1452c8b780f766ff" }, // Pansement compressif
  { source: "d795c11f92be4431" }, // Trousse de premiers secours
  { source: "ecd2bd3716baccf9" }, // Analgésiques
  { source: "999bf320aca48937" }, // Poison de glycine affaiblissant
  { source: "fb6f7b0b47f67b86" }, // Kunai de glycine
  { source: "7d2676c6fc4e4f51", note: "Offerts par Okiku à l'auberge du Saule." }, // Dango
];
