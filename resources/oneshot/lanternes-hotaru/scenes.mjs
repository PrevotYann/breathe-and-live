// Scenes of the one-shot. Coordinates are in pixels on maps drawn with a
// 100 px grid (1 square = 1.5 m). Notes open the matching GM guide page.
import { ASSETS } from "./ids.mjs";

export const SCENES = [
  {
    key: "village",
    name: "1. Hotaru-mura — le village des lucioles",
    navName: "Le village",
    src: `${ASSETS}/maps/hotaru-mura.webp`,
    thumb: `${ASSETS}/maps/thumbs/hotaru-mura.webp`,
    width: 4000,
    height: 2800,
    darkness: 0,
    notes: [
      { page: "acte-1", x: 150, y: 1400, text: "Arrivée" },
      { page: "lieu-a", x: 1480, y: 1150, text: "A. Auberge du Saule" },
      { page: "lieu-b", x: 990, y: 1700, text: "B. Atelier d'Oume" },
      { page: "lieu-c", x: 3060, y: 750, text: "C. Hutte du charbonnier" },
      { page: "lieu-d", x: 2050, y: 1400, text: "D. Pont rouge" },
      { page: "lieu-d", x: 440, y: 310, text: "D. Sanctuaire aux glycines" },
      { page: "lieu-d", x: 3780, y: 330, text: "D. Chemin de la colline" },
      { page: "lieu-e", x: 600, y: 1115, text: "E. Maison du chef" },
    ],
    tokens: [
      { actor: "gonbei-arakawa", x: 1700, y: 1480 },
      { actor: "okiku", x: 1430, y: 1300 },
      { actor: "oume", x: 940, y: 1440 },
      { actor: "mii", x: 3010, y: 900 },
      { actor: "shinpei-kakushi", x: 100, y: 1500 },
    ],
  },
  {
    key: "pont",
    name: "2. Le pont des lanternes — la nuit de la fête",
    navName: "Le pont",
    src: `${ASSETS}/maps/pont-des-lanternes.webp`,
    thumb: `${ASSETS}/maps/thumbs/pont-des-lanternes.webp`,
    width: 3000,
    height: 2000,
    darkness: 0,
    notes: [
      { page: "acte-2", x: 1500, y: 560, text: "Acte 2 — La fête" },
      { page: "acte-2", x: 1500, y: 1040, text: "Tomoshibi apparaît (fin du round 3)" },
    ],
    tokens: [
      { actor: "rodeur-des-lanternes", x: 700, y: 1400, name: "Rôdeur (le bossu)", hidden: true },
      { actor: "rodeur-des-lanternes", x: 2200, y: 1400, name: "Rôdeur (le long cou)", img: `${ASSETS}/tokens/rodeur-long-cou.webp`, hidden: true },
      { actor: "mii", x: 1100, y: 600 },
      { actor: "oume", x: 1800, y: 600 },
      { actor: "tomoshibi", x: 1450, y: 900, hidden: true },
    ],
  },
  {
    key: "atelier",
    name: "3. L'atelier abandonné — le repaire du Lanternier",
    navName: "L'atelier",
    src: `${ASSETS}/maps/atelier-abandonne.webp`,
    thumb: `${ASSETS}/maps/thumbs/atelier-abandonne.webp`,
    width: 3000,
    height: 2200,
    darkness: 0,
    notes: [
      { page: "acte-3", x: 1500, y: 1950, text: "Acte 3 — Arrivée" },
      { page: "acte-3", x: 2050, y: 760, text: "Le four (cachette)" },
      { page: "epilogue", x: 2595, y: 1780, text: "Stèle de Kansuke" },
    ],
    tokens: [
      { actor: "tomoshibi", x: 1400, y: 700 },
      { actor: "mii", x: 1500, y: 700 },
      { actor: "sota", x: 850, y: 770 },
      { actor: "fumi", x: 1200, y: 1100 },
      { actor: "jiro", x: 1850, y: 1250 },
      { actor: "shinpei-kakushi", x: 1450, y: 2050, hidden: true },
      { actor: "oume", x: 1550, y: 2050, hidden: true },
    ],
  },
];
