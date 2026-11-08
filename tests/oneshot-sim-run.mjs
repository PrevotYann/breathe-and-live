import { simulateOneShot, warnings, PREGENS } from "./oneshot-simulator.mjs";
const n = Number(process.argv[2] || 1), log = n === 1;
const opts = process.argv[3] ? JSON.parse(process.argv[3]) : {};
if (opts.partySize) opts.party = PREGENS.slice(0, opts.partySize);
const t = { act2: {}, act3: {}, r2: 0, r3: 0, hpLoss2: 0, hpLoss3: 0, downs2: 0, downs3: 0, anyDown3: 0, bossHeals: 0, errors: new Map(), warns: new Map(), r2hist: {}, r3hist: {} };
const start = Date.now();
for (let s = 1; s <= n; s++) {
  warnings.length = 0;
  const r = await simulateOneShot(s * 7919, { ...opts, log });
  t.act2[r.act2] = (t.act2[r.act2] ?? 0) + 1; t.act3[r.act3] = (t.act3[r.act3] ?? 0) + 1;
  t.r2 += r.act2Stats.rounds; t.r3 += r.act3Stats.rounds; t.r2hist[r.act2Stats.rounds] = (t.r2hist[r.act2Stats.rounds] ?? 0) + 1; t.r3hist[r.act3Stats.rounds] = (t.r3hist[r.act3Stats.rounds] ?? 0) + 1;
  t.hpLoss2 += r.act2Stats.damageToPcs; t.hpLoss3 += r.act3Stats.damageToPcs; t.bossHeals += r.act3Stats.demonHeals;
  t.rpEnd2 = (t.rpEnd2 ?? 0) + r.act2Pcs.reduce((a, p) => a + p.rp, 0); t.rpEnd3 = (t.rpEnd3 ?? 0) + r.act3Pcs.reduce((a, p) => a + p.rp, 0); t.hpEnd3 = (t.hpEnd3 ?? 0) + r.act3Pcs.reduce((a, p) => a + Math.max(0, p.hp), 0);
  t.downs2 += r.act2Pcs.filter(p => p.hp <= 0).length; const d3 = r.act3Pcs.filter(p => p.hp <= 0).length; t.downs3 += d3; t.anyDown3 += d3 > 0;
  for (const e of [...(r.act2Stats.errors ?? []), ...(r.act3Stats.errors ?? [])]) t.errors.set(e, (t.errors.get(e) ?? 0) + 1);
  for (const w of warnings) t.warns.set(w.replace(/\d+/g, "#"), (t.warns.get(w.replace(/\d+/g, "#")) ?? 0) + 1);
  if (log) console.log([...r.act2Stats.events, "=== ACT 3 ===", ...r.act3Stats.events].join("\n"), JSON.stringify(r.act3Pcs));
}
const f = v => +(v / n).toFixed(2);
console.log(JSON.stringify({ n, ms: Date.now() - start, act2: t.act2, act3: t.act3, rounds2: f(t.r2), rounds3: f(t.r3), r2hist: t.r2hist, r3hist: t.r3hist, pcDmg2: f(t.hpLoss2), pcDmg3: f(t.hpLoss3), downs2: f(t.downs2), downs3: f(t.downs3), anyDown3: f(t.anyDown3), bossHeals: f(t.bossHeals), partyRpAfter2: f(t.rpEnd2), partyRpAfter3: f(t.rpEnd3), partyHpAfter3: f(t.hpEnd3) }));
if (t.errors.size) console.log("errors", t.errors); if (t.warns.size) console.log("warns", t.warns);
