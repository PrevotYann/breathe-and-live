// Generates layout-reference placeholders of the one-shot "Les Lanternes de Hotaru":
// battle maps, tokens, handouts and cover. Shapes are procedural and deliberately
// simple; final generated art is maintained by prepare-oneshot-assets.mjs. SVGs are rasterised to WebP
// through Playwright's Chromium so Foundry scenes load a regular bitmap texture.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
// Layout regeneration must never overwrite the final production artwork.
const out = path.join(root, "tmp/oneshot-layouts/lanternes-hotaru");

// Deterministic PRNG so regenerating does not churn the files.
function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}
const f = n => Number(n.toFixed(1));
const svg = (w, h, body, defs = "") =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><defs>${defs}</defs>${body}</svg>`;
const rect = (x, y, w, h, fill, extra = "") => `<rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}" fill="${fill}" ${extra}/>`;
const circle = (cx, cy, r, fill, extra = "") => `<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(r)}" fill="${fill}" ${extra}/>`;
const ellipse = (cx, cy, rx, ry, fill, extra = "") => `<ellipse cx="${f(cx)}" cy="${f(cy)}" rx="${f(rx)}" ry="${f(ry)}" fill="${fill}" ${extra}/>`;
const line = (x1, y1, x2, y2, stroke, width, extra = "") =>
  `<line x1="${f(x1)}" y1="${f(y1)}" x2="${f(x2)}" y2="${f(y2)}" stroke="${stroke}" stroke-width="${width}" stroke-linecap="round" ${extra}/>`;
const pathD = (d, fill, extra = "") => `<path d="${d}" fill="${fill}" ${extra}/>`;

/** Smooth path through points (Catmull-Rom converted to cubic Bezier). */
function smooth(points) {
  let d = `M${points[0][0]} ${points[0][1]}`;
  for (let i = 0; i < points.length - 1; i++) {
    const [p0, p1, p2, p3] = [points[i - 1] ?? points[i], points[i], points[i + 1], points[i + 2] ?? points[i + 1]];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${f(c1[0])} ${f(c1[1])} ${f(c2[0])} ${f(c2[1])} ${p2[0]} ${p2[1]}`;
  }
  return d;
}

/** Ground speckles so flat colour areas read as terrain. */
function speckle(random, w, h, count, colors, rMin = 3, rMax = 10) {
  let body = "";
  for (let i = 0; i < count; i++) {
    body += circle(random() * w, random() * h, rMin + random() * (rMax - rMin), colors[Math.floor(random() * colors.length)], 'opacity="0.35"');
  }
  return body;
}

/** Tree canopy seen from above. */
function tree(random, x, y, r, dark, light) {
  let body = circle(x + 8, y + 10, r, "#000", 'opacity="0.25"') + circle(x, y, r, dark);
  for (let i = 0; i < 5; i++) {
    const a = random() * Math.PI * 2, d = random() * r * 0.45;
    body += circle(x + Math.cos(a) * d, y + Math.sin(a) * d, r * (0.35 + random() * 0.25), light, 'opacity="0.55"');
  }
  return body;
}

function forest(random, area, count, palette, avoid = () => false) {
  let body = "";
  for (let i = 0; i < count; i++) {
    const x = area.x + random() * area.w, y = area.y + random() * area.h;
    if (avoid(x, y)) continue;
    body += tree(random, x, y, 55 + random() * 50, palette[0], palette[1]);
  }
  return body;
}

/** Japanese house from above: walls, ridge line and roof shading. */
function house(x, y, w, h, roof, { ridge = "h", door = "s" } = {}) {
  let body = rect(x + 10, y + 12, w, h, "#000", 'opacity="0.3"');
  body += rect(x, y, w, h, roof, 'stroke="#1d1410" stroke-width="6"');
  if (ridge === "h") {
    body += rect(x, y, w, h / 2, "#ffffff", 'opacity="0.08"');
    body += line(x + 12, y + h / 2, x + w - 12, y + h / 2, "#1d1410", 8);
  } else {
    body += rect(x, y, w / 2, h, "#ffffff", 'opacity="0.08"');
    body += line(x + w / 2, y + 12, x + w / 2, y + h - 12, "#1d1410", 8);
  }
  const doors = { s: [x + w / 2 - 40, y + h - 6, 80, 22], n: [x + w / 2 - 40, y - 16, 80, 22], e: [x + w - 6, y + h / 2 - 40, 22, 80], w: [x - 16, y + h / 2 - 40, 22, 80] };
  const [dx, dy, dw, dh] = doors[door];
  body += rect(dx, dy, dw, dh, "#c9a26b", 'stroke="#1d1410" stroke-width="4"');
  return body;
}

function lanternGlow(x, y, r, color = "#ffb347") {
  return circle(x, y, r * 3.2, `url(#glow-${color.slice(1)})`) + circle(x, y, r, color, 'stroke="#5a2a10" stroke-width="3"');
}
const glowDef = color => `<radialGradient id="glow-${color.slice(1)}"><stop offset="0" stop-color="${color}" stop-opacity="0.75"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></radialGradient>`;
const GLOWS = ["#ffb347", "#6fc3ff", "#ff6b3d", "#cfe8ff"].map(glowDef).join("");

function torii(x, y, scale = 1) {
  const s = scale;
  return rect(x - 150 * s, y - 18 * s, 300 * s, 36 * s, "#b3261e", 'stroke="#3a0c08" stroke-width="5"') +
    rect(x - 120 * s, y + 30 * s, 240 * s, 20 * s, "#8e1d17") +
    circle(x - 100 * s, y + 5 * s, 22 * s, "#3a0c08") + circle(x + 100 * s, y + 5 * s, 22 * s, "#3a0c08");
}

function waterBand(random, d, width, deep, shallow) {
  let body = pathD(d, "none", `stroke="${shallow}" stroke-width="${width + 70}" stroke-linecap="round" stroke-linejoin="round"`);
  body += pathD(d, "none", `stroke="${deep}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"`);
  body += pathD(d, "none", `stroke="#ffffff" stroke-width="6" stroke-dasharray="40 90" opacity="0.25"`);
  void random;
  return body;
}

// ---------------------------------------------------------------------------
// Map 1 — Hotaru-mura by day (40 x 28 cells of 100 px = 1.5 m).
function villageMap() {
  const W = 4000, H = 2800, random = rng(1917);
  let body = rect(0, 0, W, H, "#6f8f45");
  body += speckle(random, W, H, 2600, ["#5b7a36", "#86a457", "#4f6b2e"]);
  // Rice paddies (east bank, south).
  for (let gx = 2450; gx < 3900; gx += 290) {
    for (let gy = 1700; gy < 2700; gy += 230) {
      body += rect(gx, gy, 260, 200, "#9cc06a", 'stroke="#6b5a35" stroke-width="10" opacity="0.95"');
      body += rect(gx + 20, gy + 20, 220, 160, "#7fb7a8", 'opacity="0.35"');
    }
  }
  // Main road and side lanes.
  body += rect(0, 1320, W, 160, "#c8ad7f");
  body += rect(1050, 400, 120, 920, "#c8ad7f");
  body += rect(250, 1480, 110, 900, "#c8ad7f");
  body += pathD(smooth([[2700, 1320], [2950, 1050], [3150, 900], [3500, 600], [3800, 350], [4000, 200]]), "none",
    'stroke="#b8996a" stroke-width="90" stroke-dasharray="120 40"');
  // River crossing the village from north to south.
  const river = smooth([[1900, -50], [2000, 800], [2060, 1400], [2000, 2000], [2150, 2850]]);
  body += waterBand(random, river, 240, "#3b6f93", "#7aa7b8");
  // Fireflies above the river (pale dots).
  for (let i = 0; i < 70; i++) body += circle(1850 + random() * 400, random() * H, 5, "#f8f3a0", 'opacity="0.7"');
  // Bridge.
  body += rect(1830, 1335, 440, 130, "#8a5a32", 'stroke="#3a2412" stroke-width="8"');
  for (let x = 1850; x < 2260; x += 34) body += line(x, 1340, x, 1460, "#5d3a1d", 4);
  body += rect(1830, 1320, 440, 18, "#b3261e") + rect(1830, 1462, 440, 18, "#b3261e");
  // Shrine with wisteria trellis (north-west).
  body += rect(150, 120, 700, 520, "#a99a80", 'opacity="0.55"');
  body += house(250, 180, 380, 260, "#6b2a2a", { door: "s" });
  body += torii(450, 700, 0.9);
  for (let i = 0; i < 26; i++) body += circle(700 + random() * 260, 160 + random() * 420, 26 + random() * 14, random() > 0.5 ? "#b48ad6" : "#9b6fc2", 'opacity="0.85"');
  body += rect(690, 150, 280, 440, "none", 'stroke="#5a3d22" stroke-width="10" stroke-dasharray="30 30"');
  // Village houses.
  body += house(300, 950, 600, 330, "#4a4a5a", { door: "s" }); // chief Arakawa
  body += house(1220, 1010, 520, 290, "#7a4a2a", { door: "s" }); // Inn "Le Saule"
  body += tree(random, 1790, 980, 120, "#7fae5a", "#b6d98a"); // willow
  body += house(780, 1560, 420, 300, "#8c3b2a", { door: "n" }); // Oume's workshop
  for (let x = 820; x < 1200; x += 70) body += lanternGlow(x, 1920, 20); // drying lanterns
  body += house(430, 1600, 260, 210, "#5b4636", { door: "n", ridge: "v" });
  body += house(420, 1960, 280, 220, "#5b4636", { door: "e" });
  body += house(820, 2080, 300, 220, "#64503d", { door: "n" });
  body += house(1380, 1600, 300, 220, "#5b4636", { door: "n" });
  body += house(1380, 2000, 300, 230, "#64503d", { door: "n", ridge: "v" });
  body += house(1250, 600, 300, 230, "#5b4636", { door: "w" });
  body += house(700, 760, 280, 170, "#64503d", { door: "s" });
  body += house(1500, 260, 280, 220, "#5b4636", { door: "s", ridge: "v" });
  // Charcoal burner's hut (Mii & Sota) on the east bank, near the forest.
  body += house(2900, 640, 320, 230, "#4d3f33", { door: "s" });
  body += circle(3350, 760, 95, "#2b2420", 'stroke="#14100d" stroke-width="10"');
  body += circle(3350, 760, 40, "#5e3b25");
  body += house(2400, 900, 260, 200, "#5b4636", { door: "w" });
  body += house(2500, 1550, 240, 150, "#64503d", { door: "n" });
  // Festival lanterns strung along the main road.
  for (let x = 120; x < 1820; x += 150) body += lanternGlow(x, 1335, 16);
  for (let x = 2320; x < 2900; x += 150) body += lanternGlow(x, 1335, 16);
  // Forest edges (north and east), kept away from the clearings.
  const clear = (x, y) => (x > 1700 && x < 2350) || (x > 2800 && x < 3500 && y > 550 && y < 950) || (y > 120 && x < 1000 && y < 650);
  body += forest(random, { x: 0, y: -60, w: W, h: 220 }, 60, ["#2f4a22", "#4d6e34"], clear);
  body += forest(random, { x: 2350, y: 0, w: 1700, h: 560 }, 90, ["#2f4a22", "#4d6e34"], (x, y) => clear(x, y) || Math.abs(y - (900 - (x - 3150) * 0.95)) < 110);
  body += forest(random, { x: 3650, y: 500, w: 400, h: 1100 }, 40, ["#2f4a22", "#4d6e34"]);
  body += forest(random, { x: -40, y: 2380, w: 1800, h: 460 }, 45, ["#35522a", "#58783b"]);
  return svg(W, H, body, GLOWS);
}

// ---------------------------------------------------------------------------
// Map 2 — The festival bridge at night (30 x 20 cells).
function bridgeMap() {
  const W = 3000, H = 2000, random = rng(818);
  let body = rect(0, 0, W, H, "#1f2d24");
  body += speckle(random, W, H, 1500, ["#18241c", "#2a3b2d", "#233328"]);
  // North bank: festival square.
  body += rect(300, 120, 2400, 560, "#5a4c3a", 'opacity="0.9"');
  body += speckle(random, 2400, 560, 300, ["#4a3e2f", "#6a5a45"]).replace(/cx="([\d.]+)" cy="([\d.]+)"/g, (m, x, y) => `cx="${f(Number(x) + 300)}" cy="${f(Number(y) + 120)}"`);
  body += torii(1500, 150, 1.1);
  // Food stalls (yatai) with striped awnings.
  for (const [x, y] of [[420, 260], [780, 260], [2000, 260], [2360, 260], [420, 470], [2360, 470]]) {
    body += rect(x + 8, y + 10, 260, 150, "#000", 'opacity="0.35"') + rect(x, y, 260, 150, "#6d4a2c", 'stroke="#2a1a0e" stroke-width="5"');
    for (let i = 0; i < 260; i += 52) body += rect(x + i, y, 26, 60, "#c0392b") + rect(x + i + 26, y, 26, 60, "#f2e6d0");
  }
  // Taiko stage.
  body += rect(1250, 330, 500, 260, "#7a5230", 'stroke="#2a1a0e" stroke-width="8"');
  body += circle(1500, 460, 80, "#8c2f1e", 'stroke="#2a1a0e" stroke-width="10"') + circle(1500, 460, 55, "#d9b98c");
  // Lantern strings above the square.
  for (let x = 330; x < 2700; x += 120) body += lanternGlow(x, 700, 15);
  for (let x = 330; x < 2700; x += 160) body += lanternGlow(x, 140, 15);
  // River.
  body += rect(0, 820, W, 440, "#1b3a52") + rect(0, 780, W, 50, "#3f5d5a") + rect(0, 1250, W, 50, "#3f5d5a");
  for (let i = 0; i < 60; i++) {
    const x = random() * W, y = 860 + random() * 360;
    body += line(x, y, x + 60 + random() * 80, y, "#5b86a6", 4, 'opacity="0.5"');
  }
  // Floating lanterns: warm ones for the dead, three cold blue ones.
  for (let i = 0; i < 26; i++) {
    const x = 60 + random() * (W - 120), y = 880 + random() * 320;
    if (x > 1300 && x < 1700) continue;
    body += rect(x - 18, y - 18, 36, 36, "#3a2a18") + lanternGlow(x, y, 13);
  }
  for (const [x, y] of [[640, 1080], [2280, 950], [2520, 1160]]) body += lanternGlow(x, y, 18, "#6fc3ff");
  // Wooden bridge crossing north to south.
  body += rect(1340, 640, 320, 760, "#7b5131", 'stroke="#2a1a0e" stroke-width="8"');
  for (let y = 660; y < 1400; y += 34) body += line(1345, y, 1655, y, "#4f3219", 4);
  body += rect(1330, 640, 22, 760, "#a3281f") + rect(1648, 640, 22, 760, "#a3281f");
  for (const y of [660, 900, 1140, 1380]) body += circle(1341, y, 18, "#5a130e") + circle(1659, y, 18, "#5a130e");
  // South bank: reeds, rocks and the path into the forest.
  body += pathD(smooth([[1500, 1400], [1450, 1600], [1600, 1800], [1550, 2050]]), "none", 'stroke="#4e4232" stroke-width="150"');
  for (let i = 0; i < 70; i++) {
    const x = random() * W, y = 1300 + random() * 90;
    body += line(x, y, x + random() * 20 - 10, y - 40 - random() * 30, "#4c6b3a", 5);
  }
  for (const [x, y, r] of [[300, 1450, 70], [900, 1500, 55], [2200, 1480, 80], [2700, 1420, 60], [1100, 1350, 40]]) {
    body += ellipse(x + 8, y + 10, r, r * 0.75, "#000", 'opacity="0.35"') + ellipse(x, y, r, r * 0.75, "#5d5f63", 'stroke="#2c2d30" stroke-width="5"');
  }
  body += forest(random, { x: -40, y: 1500, w: W + 80, h: 560 }, 70, ["#14231a", "#22382a"], (x) => x > 1380 && x < 1700);
  body += forest(random, { x: -40, y: -40, w: 380, h: 900 }, 16, ["#14231a", "#22382a"]);
  body += forest(random, { x: 2680, y: -40, w: 380, h: 900 }, 16, ["#14231a", "#22382a"]);
  return svg(W, H, body, GLOWS);
}

// ---------------------------------------------------------------------------
// Map 3 — The abandoned lantern workshop (30 x 22 cells).
function workshopMap() {
  const W = 3000, H = 2200, random = rng(1907);
  let body = rect(0, 0, W, H, "#1c2a20");
  body += speckle(random, W, H, 1400, ["#16221a", "#26372a", "#2d3a26"]);
  // Path from the south up to the workshop.
  body += pathD(smooth([[1500, 2250], [1450, 1950], [1550, 1750], [1500, 1600]]), "none", 'stroke="#463c2e" stroke-width="160"');
  // Charred floor.
  body += rect(560, 380, 1880, 1240, "#2e221a");
  for (let y = 400; y < 1610; y += 60) body += line(570, y, 2430, y, "#1c140f", 6);
  for (let i = 0; i < 40; i++) body += circle(600 + random() * 1800, 420 + random() * 1160, 30 + random() * 70, "#111", 'opacity="0.35"');
  // Broken walls (thick strokes with gaps = doors and holes).
  const walls = [[560, 380, 1300, 380], [1500, 380, 2440, 380], [560, 380, 560, 900], [560, 1150, 560, 1620],
    [2440, 380, 2440, 1000], [2440, 1250, 2440, 1620], [560, 1620, 1350, 1620], [1650, 1620, 2440, 1620], [1500, 380, 1500, 900], [1500, 1100, 1500, 1300]];
  for (const [x1, y1, x2, y2] of walls) body += line(x1, y1, x2, y2, "#0c0806", 34) + line(x1, y1, x2, y2, "#4a3524", 18);
  // Collapsed beams.
  for (const [x, y, a] of [[900, 560, 20], [1200, 1450, -35], [2100, 520, 60], [1750, 1500, 10]]) {
    body += rect(x - 200, y - 22, 400, 44, "#3b2a1c", `transform="rotate(${a} ${x} ${y})" stroke="#0c0806" stroke-width="6"`);
  }
  // Kiln (where Tomoshibi hides by day) and cellar trapdoor.
  body += circle(2050, 760, 200, "#5a2f22", 'stroke="#1a0d08" stroke-width="16"') + circle(2050, 760, 120, "#140b08");
  for (let a = 0; a < 360; a += 30) {
    const r = (a * Math.PI) / 180;
    body += rect(2050 + Math.cos(r) * 160 - 30, 760 + Math.sin(r) * 160 - 15, 60, 30, "#7a3b28", `transform="rotate(${a} ${f(2050 + Math.cos(r) * 160)} ${f(760 + Math.sin(r) * 160)})"`);
  }
  body += rect(2200, 1050, 160, 160, "#050302", 'stroke="#6b4a2c" stroke-width="10"');
  for (let y = 1070; y < 1200; y += 30) body += line(2230, y, 2330, y, "#6b4a2c", 6);
  // Workbenches and drying racks.
  body += rect(650, 1300, 500, 120, "#5a4330", 'stroke="#0c0806" stroke-width="6"');
  body += rect(1650, 430, 300, 100, "#5a4330", 'stroke="#0c0806" stroke-width="6"');
  for (let x = 680; x < 1400; x += 90) body += line(x, 450, x, 640, "#7a6040", 6);
  // Three giant cocoon lanterns holding the captives.
  for (const [x, y] of [[900, 820], [1250, 1150], [1900, 1300]]) {
    body += circle(x, y, 260, "url(#glow-6fc3ff)");
    body += ellipse(x, y, 95, 130, "#efe2c4", 'stroke="#5a4a32" stroke-width="8"');
    for (let k = -90; k <= 90; k += 36) body += line(x - 92, y + k, x + 92, y + k, "#b89f74", 5, 'opacity="0.8"');
    body += rect(x - 50, y - 145, 100, 26, "#2b1f14") + rect(x - 50, y + 120, 100, 26, "#2b1f14");
  }
  // Small hovering blue lanterns.
  for (const [x, y] of [[700, 450], [1400, 700], [2300, 500], [800, 1500], [2300, 1450], [1650, 950]]) body += lanternGlow(x, y, 14, "#6fc3ff");
  // Paper scraps.
  for (let i = 0; i < 60; i++) {
    const x = 600 + random() * 1800, y = 420 + random() * 1160;
    body += rect(x, y, 24, 18, "#d8cba8", `opacity="0.6" transform="rotate(${f(random() * 90)} ${f(x)} ${f(y)})"`);
  }
  // Well and memorial stone outside.
  body += circle(420, 1850, 90, "#5d5f63", 'stroke="#2c2d30" stroke-width="12"') + circle(420, 1850, 55, "#0d1a24");
  body += rect(2550, 1820, 90, 150, "#7c7f84", 'stroke="#2c2d30" stroke-width="8" rx="12"');
  body += circle(2520, 1990, 14, "#f2c94c") + circle(2670, 1990, 14, "#f2c94c") + rect(2575, 1985, 40, 20, "#e8e2d0");
  body += forest(random, { x: -60, y: -60, w: W + 120, h: 330 }, 55, ["#101c14", "#1e3024"]);
  body += forest(random, { x: -60, y: 200, w: 500, h: 1500 }, 30, ["#101c14", "#1e3024"]);
  body += forest(random, { x: 2520, y: 200, w: 540, h: 1450 }, 30, ["#101c14", "#1e3024"]);
  body += forest(random, { x: -60, y: 1700, w: W + 120, h: 560 }, 50, ["#101c14", "#1e3024"],
    (x, y) => (x > 1300 && x < 1700) || Math.hypot(x - 420, y - 1850) < 180 || Math.hypot(x - 2595, y - 1890) < 200);
  return svg(W, H, body, GLOWS);
}

// ---------------------------------------------------------------------------
// Tokens: simple silhouettes on a coloured disc with a theme ring.
const RING = {
  water: (c) => Array.from({ length: 8 }, (_, i) => {
    const a = (i / 8) * Math.PI * 2;
    return circle(200 + Math.cos(a) * 172, 200 + Math.sin(a) * 172, 16, c, 'opacity="0.9"');
  }).join(""),
  thunder: (c) => pathD("M200 22 L220 60 L200 60 L225 100 L180 52 L198 52 Z", c) + pathD("M200 378 L180 340 L200 340 L175 300 L220 348 L202 348 Z", c),
  flame: (c) => Array.from({ length: 10 }, (_, i) => {
    const a = (i / 10) * Math.PI * 2, x = 200 + Math.cos(a) * 170, y = 200 + Math.sin(a) * 170;
    return pathD(`M${f(x)} ${f(y - 22)} Q${f(x + 18)} ${f(y)} ${f(x)} ${f(y + 16)} Q${f(x - 18)} ${f(y)} ${f(x)} ${f(y - 22)} Z`, c);
  }).join(""),
  wind: (c) => pathD("M60 120 Q200 40 340 120", "none", `stroke="${c}" stroke-width="12"`) + pathD("M60 280 Q200 360 340 280", "none", `stroke="${c}" stroke-width="12"`),
  blood: (c) => [0, 1, 2, 3].map(i => {
    const a = (i / 4) * Math.PI * 2 + 0.6, x = 200 + Math.cos(a) * 168, y = 200 + Math.sin(a) * 168;
    return pathD(`M${f(x)} ${f(y - 24)} Q${f(x + 18)} ${f(y + 4)} ${f(x)} ${f(y + 14)} Q${f(x - 18)} ${f(y + 4)} ${f(x)} ${f(y - 24)} Z`, c);
  }).join(""),
  none: () => "",
};

function token({ base, accent, skin = "#e9c9a6", hair = "#1d1a1a", ring = "none", ringColor = "#ffffff", kind = "human", extra = "" }) {
  let body = circle(200, 200, 196, accent) + circle(200, 200, 182, base);
  body += RING[ring](ringColor);
  if (kind === "human") {
    body += pathD("M90 360 Q100 250 200 245 Q300 250 310 360 Z", "#1c1c2b"); // uniform shoulders
    body += circle(200, 175, 72, skin);
    body += pathD("M126 170 Q130 92 200 92 Q272 92 276 170 Q250 130 200 128 Q150 130 126 170 Z", hair);
  } else if (kind === "demon") {
    body += pathD("M80 370 Q95 245 200 238 Q305 245 320 370 Z", "#2a1414");
    body += circle(200, 175, 74, "#c9b7a4");
    body += pathD("M150 112 L135 55 L172 104 Z", "#e6dccb") + pathD("M250 112 L265 55 L228 104 Z", "#e6dccb");
    body += ellipse(172, 172, 15, 9, "#c0161b") + ellipse(228, 172, 15, 9, "#c0161b");
    body += pathD("M165 215 Q200 232 235 215 L228 226 L214 218 L200 228 L186 218 L172 226 Z", "#f4efe4");
  } else if (kind === "lantern") {
    body += pathD("M80 370 Q95 255 200 250 Q305 255 320 370 Z", "#1a2230");
    body += ellipse(200, 165, 82, 98, "#efe2c4", 'stroke="#5a4a32" stroke-width="6"');
    for (let k = -60; k <= 60; k += 30) body += line(124, 165 + k, 276, 165 + k, "#b89f74", 4);
    body += rect(160, 60, 80, 18, "#2b1f14") + rect(160, 254, 80, 18, "#2b1f14");
    body += ellipse(172, 165, 13, 10, "#2f8fd8") + ellipse(228, 165, 13, 10, "#2f8fd8");
    body += circle(200, 165, 120, "url(#glow-6fc3ff)");
  }
  body += extra;
  body += circle(200, 200, 189, "none", `stroke="#111" stroke-width="6"`);
  return svg(400, 400, body, GLOWS);
}

const TOKENS = {
  "mizuki-asagiri": { base: "#2d5f8a", accent: "#9fd0f0", ring: "water", ringColor: "#cfe8ff", hair: "#2b2230" },
  "kenta-hayase": { base: "#8a6d12", accent: "#f2d14b", ring: "thunder", ringColor: "#fff3a0", hair: "#d9a33a" },
  "chiyo-akabane": { base: "#8a2a14", accent: "#ff9a4a", ring: "flame", ringColor: "#ffcf6a", hair: "#7a1d12" },
  "itsuki-kazahaya": { base: "#2f6b4a", accent: "#a7e0b6", ring: "wind", ringColor: "#e2f6e8", hair: "#e8e8e8" },
  "tamaki-kurosu": { base: "#3b2140", accent: "#c05a7a", ring: "blood", ringColor: "#e05a6a", hair: "#121014" },
  "oume": { base: "#6d5a44", accent: "#d9c29a", hair: "#d9d4cc", skin: "#e2c2a0" },
  "mii": { base: "#7a5a8a", accent: "#e6b3ef", hair: "#2b1d16" },
  "shinpei-kakushi": { base: "#24242c", accent: "#8a8a98", hair: "#111", skin: "#e9c9a6", extra: rect(128, 185, 144, 70, "#1b1b22") },
  "gonbei-arakawa": { base: "#4a4a5a", accent: "#b0b0c8", hair: "#5a5a5a", skin: "#dcb894" },
  "okiku": { base: "#7a4a2a", accent: "#e8b88a", hair: "#2b1a12" },
  "sota": { base: "#555", accent: "#aaa", hair: "#1e1a16" },
  "fumi": { base: "#555", accent: "#aaa", hair: "#2a1a10" },
  "jiro": { base: "#555", accent: "#aaa", hair: "#3a3026", skin: "#d6b08a" },
  "rodeur-des-lanternes": { base: "#3a1212", accent: "#9b2a2a", kind: "demon" },
  "tomoshibi": { base: "#0f1a2a", accent: "#4aa3e8", kind: "lantern" },
  "lanterne-prison": { base: "#1a2230", accent: "#6fc3ff", kind: "lantern" },
};

// ---------------------------------------------------------------------------
// Handout: Mii's crayon drawing (clue towards the hill workshop).
function miiDrawing() {
  const W = 1200, H = 900, random = rng(8);
  const wobblyLine = (pts, color, width) => pathD(smooth(pts.map(([x, y]) => [x + random() * 8 - 4, y + random() * 8 - 4])), "none",
    `stroke="${color}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round" opacity="0.9"`);
  let body = rect(0, 0, W, H, "#f3ead6") + speckle(random, W, H, 400, ["#e2d6bb", "#d8caa8"], 2, 6);
  body += wobblyLine([[0, 620], [250, 520], [520, 330], [700, 300], [900, 420], [1200, 560]], "#4f8a3a", 14); // the hill
  body += wobblyLine([[620, 300], [620, 200], [760, 200], [760, 300]], "#5b3a22", 10); // workshop on the hill
  body += wobblyLine([[600, 205], [690, 140], [780, 205]], "#5b3a22", 10);
  body += wobblyLine([[735, 150], [735, 90], [760, 90], [760, 165]], "#333", 10); // kiln chimney
  for (let i = 0; i < 4; i++) body += wobblyLine([[750 + i * 12, 80 - i * 15], [770 + i * 20, 50 - i * 18]], "#888", 6);
  body += circle(1050, 130, 70, "#f7e27a", 'opacity="0.85"') + circle(1080, 115, 60, "#f3ead6"); // crescent moon
  // Lantern-headed figure.
  body += ellipse(420, 470, 55, 68, "#f7f0dc", 'stroke="#6a5a3a" stroke-width="8"');
  body += circle(400, 465, 10, "#2f6fd8") + circle(440, 465, 10, "#2f6fd8");
  body += wobblyLine([[420, 540], [420, 690]], "#222", 10) + wobblyLine([[420, 580], [340, 620]], "#222", 10) + wobblyLine([[420, 580], [500, 610]], "#222", 10);
  body += wobblyLine([[420, 690], [380, 780]], "#222", 10) + wobblyLine([[420, 690], [460, 780]], "#222", 10);
  // Blue lights leading uphill.
  for (const [x, y] of [[520, 560], [580, 470], [620, 390], [660, 330], [340, 640]]) body += circle(x, y, 22, "#5fa8f0", 'opacity="0.85"');
  // Mii's brother being led by the hand.
  body += circle(560, 640, 30, "#f0cfae", 'stroke="#222" stroke-width="5"');
  body += wobblyLine([[560, 670], [560, 760]], "#222", 8) + wobblyLine([[560, 700], [505, 615]], "#222", 8);
  body += wobblyLine([[560, 760], [535, 830]], "#222", 8) + wobblyLine([[560, 760], [585, 830]], "#222", 8);
  // A little crying figure (Mii herself) at the bottom left.
  body += circle(160, 700, 30, "#f0cfae", 'stroke="#222" stroke-width="5"');
  body += circle(150, 735, 6, "#5fa8f0") + circle(172, 738, 6, "#5fa8f0");
  body += wobblyLine([[160, 730], [160, 810]], "#c0392b", 14);
  return svg(W, H, body);
}

// Cover: night valley, lantern-lit river and one blue light on the hill.
function cover() {
  const W = 1600, H = 900, random = rng(42);
  const sky = `<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0b1426"/><stop offset="1" stop-color="#2a3550"/></linearGradient>`;
  let body = rect(0, 0, W, H, "url(#sky)");
  for (let i = 0; i < 120; i++) body += circle(random() * W, random() * 420, 1.5 + random() * 2, "#fff", `opacity="${f(0.3 + random() * 0.6)}"`);
  body += circle(1300, 160, 80, "#f4f0d8") + circle(1330, 140, 72, "#18233c");
  body += pathD("M0 560 Q300 380 620 470 Q900 330 1200 430 Q1420 360 1600 420 L1600 900 L0 900 Z", "#13241b");
  body += pathD("M0 680 Q400 560 800 640 Q1200 560 1600 640 L1600 900 L0 900 Z", "#0d1912");
  body += pathD("M-20 900 Q500 700 820 760 Q1150 820 1620 700", "none", 'stroke="#1d4766" stroke-width="90"');
  for (let i = 0; i < 40; i++) {
    const t = random(), x = t * 1600, y = 900 - 200 * Math.sin(t * Math.PI) - 10 + random() * 30;
    body += lanternGlow(x, y - 20, 7);
  }
  body += lanternGlow(980, 380, 12, "#6fc3ff");
  body += rect(930, 350, 110, 60, "#0a120d");
  body += pathD("M920 352 L985 318 L1050 352 Z", "#0a120d");
  for (let i = 0; i < 60; i++) body += circle(random() * W, 450 + random() * 450, 2.5, "#f8f3a0", `opacity="${f(0.4 + random() * 0.5)}"`);
  return svg(W, H, body, GLOWS + sky);
}

// ---------------------------------------------------------------------------
async function rasterise(jobs) {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    for (const { file, markup, quality = 0.86, width } of jobs) {
      const data = await page.evaluate(async ({ markup, quality, width }) => {
        const img = new Image();
        img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`;
        await img.decode();
        const scale = width ? width / img.naturalWidth : 1;
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.naturalWidth * scale); canvas.height = Math.round(img.naturalHeight * scale);
        canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
        return canvas.toDataURL("image/webp", quality);
      }, { markup, quality, width });
      const target = path.join(out, file);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, Buffer.from(data.split(",")[1], "base64"));
      console.log(`Wrote ${path.relative(root, target)}`);
    }
  } finally {
    await browser.close();
  }
}

const maps = { "hotaru-mura": villageMap(), "pont-des-lanternes": bridgeMap(), "atelier-abandonne": workshopMap() };
await rasterise([
  ...Object.entries(maps).flatMap(([name, markup]) => [
    { file: `maps/${name}.webp`, markup, quality: 0.8 },
    { file: `maps/thumbs/${name}.webp`, markup, quality: 0.7, width: 400 },
  ]),
  { file: "handouts/dessin-de-mii.webp", markup: miiDrawing() },
  { file: "cover.webp", markup: cover() },
  ...Object.entries(TOKENS).map(([name, options]) => ({ file: `tokens/${name}.webp`, markup: token(options) })),
]);
