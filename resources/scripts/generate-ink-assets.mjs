// Generates the ink-brush sheet artwork (assets/ui/*.svg) used by styles/system.css.
// Shapes are procedural so they stay original, small and easy to regenerate.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const out = path.join(root, "assets/ui");
fs.mkdirSync(out, { recursive: true });

// Deterministic PRNG so regenerating does not churn the files.
function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}
// Smooth periodic noise: a handful of random sine harmonics.
function wobble(random, amplitude, harmonics = [3, 5, 9, 17, 29]) {
  const terms = harmonics.map((f, i) => ({ f, a: amplitude / (i + 1.2), p: random() * Math.PI * 2 }));
  return t => terms.reduce((sum, { f, a, p }) => sum + a * Math.sin(t * f * Math.PI * 2 + p), 0);
}
const fmt = n => Number(n.toFixed(1));
const poly = points => `M${points.map(([x, y]) => `${fmt(x)} ${fmt(y)}`).join("L")}Z`;
const svg = (w, h, body, extra = "") =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" ${extra}>${body}</svg>\n`;
const write = (name, content) => fs.writeFileSync(path.join(out, name), content);

/** Brush ring: filled band between two jittered radii, tapering at both ends. */
function brushArc({ cx, cy, rx, ry = rx, start, sweep, width, seed, steps = 220, head = 0.08, tail = 0.25, rough = 1.6 }) {
  const random = rng(seed);
  const outerNoise = wobble(random, rough);
  const innerNoise = wobble(random, rough * 1.4);
  const outer = [], inner = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const angle = (start + sweep * t) * Math.PI / 180;
    let profile = 1;
    if (t < head) profile = Math.sin((t / head) * Math.PI / 2);
    else if (t > 1 - tail) profile = Math.pow((1 - t) / tail, 0.7);
    const w = width * (0.82 + 0.18 * Math.sin(t * Math.PI)) * profile;
    const ro = 1 + (w / 2 + outerNoise(t)) / rx;
    const ri = 1 - (w / 2 + innerNoise(t)) / rx;
    outer.push([cx + Math.cos(angle) * rx * ro, cy + Math.sin(angle) * ry * ro]);
    inner.push([cx + Math.cos(angle) * rx * ri, cy + Math.sin(angle) * ry * ri]);
  }
  return poly([...outer, ...inner.reverse()]);
}

/** Dry-brush streaks: thin broken arcs that trail off the main stroke. */
function dryStreaks({ cx, cy, rx, ry = rx, start, sweep, width, seed, count = 5 }) {
  const random = rng(seed);
  const paths = [];
  for (let i = 0; i < count; i++) {
    const offset = (random() - 0.5) * width * 0.9;
    const from = start + sweep * (0.72 + random() * 0.1);
    const span = sweep * (0.1 + random() * 0.18);
    paths.push(brushArc({ cx, cy, rx: rx + offset, ry: ry + offset * (ry / rx), start: from, sweep: span,
      width: 1 + random() * 2.2, seed: seed + i * 31, steps: 60, head: 0.2, tail: 0.6, rough: 0.4 }));
  }
  return paths.join("");
}

const ink = "#141414";
const fill = d => `<path fill="${ink}" d="${d}"/>`;

// Stat ensō: open at the upper right like the printed sheet.
{
  const arc = { cx: 100, cy: 100, rx: 76, start: -48, sweep: -318, width: 24, seed: 11 };
  write("enso-stat.svg", svg(200, 200, fill(brushArc(arc)) + fill(dryStreaks(arc))));
}
// Resource ring: nearly closed, lighter stroke.
{
  const arc = { cx: 100, cy: 100, rx: 84, start: -100, sweep: 336, width: 13, seed: 23, tail: 0.18 };
  write("enso-ring.svg", svg(200, 200, fill(brushArc(arc)) + fill(dryStreaks({ ...arc, count: 3 }))));
}
// Small label bubble (PV, CA...): full loop with overlap.
{
  const arc = { cx: 60, cy: 40, rx: 54, ry: 33, start: 200, sweep: 380, width: 7, seed: 37, tail: 0.12, head: 0.05, rough: 0.8 };
  write("enso-bubble.svg", svg(120, 80, `<ellipse cx="60" cy="40" rx="52" ry="31" fill="#fbfaf6"/>` + fill(brushArc(arc)),
    'preserveAspectRatio="none"'));
}
// Souffle ellipse: wide sweeping stroke.
{
  const arc = { cx: 200, cy: 80, rx: 188, ry: 66, start: 160, sweep: 345, width: 15, seed: 41, tail: 0.3, rough: 1.2 };
  write("enso-ellipse.svg", svg(400, 160, fill(brushArc(arc)) + fill(dryStreaks({ ...arc, count: 4 })),
    'preserveAspectRatio="none"'));
}
// Skill oval: thin double loop, like a pen-drawn bubble.
{
  const a = { cx: 30, cy: 18, rx: 26, ry: 14, start: 190, sweep: 375, width: 2.6, seed: 53, tail: 0.15, head: 0.05, rough: 0.35 };
  const b = { ...a, rx: 25, ry: 13, start: 20, sweep: 300, width: 1.3, seed: 59 };
  write("oval.svg", svg(60, 36, fill(brushArc(a)) + fill(brushArc(b)), 'preserveAspectRatio="none"'));
}

/** Horizontal brush stroke between x0 and x1. */
function brushStroke({ x0, x1, y, width, seed, steps = 160, head = 0.04, tail = 0.2, rough = 0.8, tilt = 0 }) {
  const random = rng(seed);
  // Long strokes need low-frequency wobble, or stretching turns it into spikes.
  const top = wobble(random, rough, [1, 2, 3, 5]), bottom = wobble(random, rough * 1.3, [1, 2, 4, 7]);
  const upper = [], lower = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    let profile = 1;
    if (t < head) profile = Math.sin((t / head) * Math.PI / 2);
    else if (t > 1 - tail) profile = Math.pow((1 - t) / tail, 0.6);
    const x = x0 + (x1 - x0) * t, cy = y + tilt * t;
    const w = width * profile * (0.85 + 0.15 * Math.sin(t * 7 + 1));
    upper.push([x, cy - w / 2 + top(t)]);
    lower.push([x, cy + w / 2 + bottom(t)]);
  }
  return poly([...upper, ...lower.reverse()]);
}

// Underline for written fields (Nom, Rang...).
write("brush-line.svg", svg(600, 14,
  fill(brushStroke({ x0: 4, x1: 596, y: 7, width: 6, seed: 61, tail: 0.25 })), 'preserveAspectRatio="none"'));
// Heavier swash used behind section titles and the active tab.
write("brush-swash.svg", svg(300, 40,
  fill(brushStroke({ x0: 2, x1: 298, y: 21, width: 30, seed: 67, head: 0.02, tail: 0.3, rough: 2.2, tilt: -3 }))
  + fill(brushStroke({ x0: 160, x1: 296, y: 34, width: 3, seed: 71, head: 0.1, tail: 0.6, rough: 0.6 })),
  'preserveAspectRatio="none"'));

// Brush box for border-image: four strokes overlapping at the corners (slice 24).
{
  const s = 120, w = 9;
  const top = brushStroke({ x0: 2, x1: 118, y: 10, width: w, seed: 73, tail: 0.1, head: 0.03 });
  const bottom = brushStroke({ x0: 0, x1: 120, y: 110, width: w + 2, seed: 79, tail: 0.15, head: 0.02 });
  // Vertical strokes: build horizontally then swap axes.
  const vertical = (x, seed) => brushStroke({ x0: 3, x1: 117, y: x, width: w - 1, seed, tail: 0.08, head: 0.05 })
    .replace(/(-?[\d.]+) (-?[\d.]+)/g, (_m, a, b) => `${b} ${a}`);
  write("brush-box.svg", svg(s, s, `<rect x="12" y="12" width="96" height="96" fill="#fbfaf6"/>`
    + fill(top) + fill(bottom) + fill(vertical(10, 83)) + fill(vertical(110, 89))));
}

// Torn lower edge for the grey header band.
{
  const random = rng(97);
  const n = wobble(random, 2.4, [2, 5, 9, 17]);
  const points = [[0, 0], [1200, 0]];
  for (let i = 120; i >= 0; i--) {
    const x = (i / 120) * 1200;
    points.push([x, 18 + n(i / 120) + (random() - 0.5) * 1.5]);
  }
  write("torn-edge.svg", svg(1200, 28, `<path fill="#dedcd6" d="${poly(points)}"/>`, 'preserveAspectRatio="none"'));
}

// Washi grain: low-contrast fibres, tiled behind every panel.
write("paper-grain.svg", svg(240, 240,
  `<filter id="g" x="0" y="0"><feTurbulence type="fractalNoise" baseFrequency=".9 .35" numOctaves="3" seed="7"/>`
  + `<feColorMatrix values="0 0 0 0 .1  0 0 0 0 .09  0 0 0 0 .07  0 0 0 -1.6 .9"/></filter>`
  + `<rect width="240" height="240" filter="url(#g)" opacity=".16"/>`));

// Body silhouette for the injury chart: simple brushed figure, limbs as separate shapes.
{
  const body = [
    `<ellipse cx="100" cy="38" rx="22" ry="26"/>`,
    `<path d="M70 72 Q100 62 130 72 L138 150 Q100 160 62 150Z"/>`,
    `<path d="M66 76 L44 88 L28 150 L22 196 L34 198 L44 154 L66 104Z"/>`,
    `<path d="M134 76 L156 88 L172 150 L178 196 L166 198 L156 154 L134 104Z"/>`,
    `<path d="M66 152 L98 158 L94 236 L90 300 L72 300 L72 236Z"/>`,
    `<path d="M134 152 L102 158 L106 236 L110 300 L128 300 L128 236Z"/>`,
  ];
  write("body-silhouette.svg", svg(200, 310, `<g fill="${ink}" opacity=".13">${body.join("")}</g>`));
}

console.log(`Ink assets written to ${path.relative(root, out)}`);
