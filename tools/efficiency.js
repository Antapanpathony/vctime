// Price-efficiency check: what would a hypothetical investor earn buying $1 into EVERY round of every startup
// at the round price and holding to the end (survivor-bias-aware)? Grouped by round stage.
const { load } = require('./load');
const api = load();
const N = +process.argv[2] || 600;
const g = api.newGame({ seed: 'eff' + (process.argv[3] || 1), size: 1e9 });
const G = api.G; G.noSource = true;
const secs = ['ai', 'fin', 'clim', 'health', 'saas', 'cons', 'dev'];
const list = [];
for (let i = 0; i < N; i++) { const st = api.rw ? 0 : 0; const r = i % 100 / 100; const stage = r < 0.4 ? 0 : r < 0.75 ? 1 : r < 0.92 ? 2 : r < 0.98 ? 3 : 4; list.push(api.genStartup({ q: api.rg(G.rng, 44, 14), sector: secs[i % 7], stage, city: 'sf' })); }
for (let w = 0; w < 520; w++) { api.advanceWeek(); G.queue.length = 0; G.ap = 10; if (G.over) break; }
const byStage = {};
for (const s of list) {
  let EV = 0;
  if (s.status === 'acquired') EV = s.exitEV || 0; else if (s.status === 'public' || s.status === 'exited') EV = s.mcap || 0; else if (s.status === 'dead') EV = 0; else EV = api.equityMark(s) * 0.85;
  const fdN = api.fd(s);
  for (const r of s.rounds) {
    if (!r.pps || r.week < 0) continue; // backfilled earlier rounds have week<0 (not investable by us)
    const sh = 1e6, h = { tr: [{ shares: sh, invested: sh * r.pps, pref: '1x' }] };
    const pay = api.exitPayout(s, h, EV);
    const moic = pay / (sh * r.pps);
    (byStage[r.stage] = byStage[r.stage] || []).push(moic);
  }
}
for (const k of Object.keys(byStage).sort()) {
  const a = byStage[k].sort((x, y) => x - y), n = a.length, mean = a.reduce((x, y) => x + y, 0) / n;
  console.log('round', k, 'n', n, 'mean', mean.toFixed(2), 'median', a[n >> 1].toFixed(2), 'p90', a[Math.floor(n * 0.9)].toFixed(2), 'p99', a[Math.floor(n * 0.99)].toFixed(2), '<0.1x', (100 * a.filter(x => x < 0.1).length / n).toFixed(0) + '%', '>=3x', (100 * a.filter(x => x >= 3).length / n).toFixed(0) + '%', '>=20x', (100 * a.filter(x => x >= 20).length / n).toFixed(1) + '%');
}
