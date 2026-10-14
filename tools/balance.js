// Balance harness: run "spray" bots (invest in everything at entry, never follow on)
// to inspect the raw outcome distribution of startups.   usage: node tools/balance.js [games] [mode]
const { load } = require('./load');
const games = +process.argv[2] || 3;
const mode = process.argv[3] || 'spray';
const api = load();
const buckets = [[0, 0.05, 'dead (<0.05x)'], [0.05, 0.6, '0.05-0.6x'], [0.6, 1.5, '~1x (0.6-1.5)'], [1.5, 5, '1.5-5x'], [5, 20, '5-20x'], [20, 50, '20-50x'], [50, 1e9, '50x+']];
const tot = { n: 0, b: buckets.map(() => 0), byStage: {} };
const invested = [];
for (let gi = 0; gi < games; gi++) {
  const g = api.newGame({ seed: 'bal' + gi, size: 2e9, thesis: { smin: 0, smax: 5, sectors: ['ai', 'saas', 'fin', 'clim', 'health', 'cons', 'dev'], geo: 'global', check: 0.00005 }, reservePct: 0 });
  const G = api.G;
  // start with one fast pass
  for (let w = 0; w < 520; w++) {
    // bot: advance all deals as far as possible
    for (const d of G.deals.filter(d => d.status === 'open')) {
      G.ap = 10;
      for (let i = 0; i < 4 && d.status === 'open' && d.col < 4; i++) { d.movedW = -9; const r = api.advanceDeal(d); if (!r.ok) break; }
      if (d.status === 'open' && d.col === 4) {
        const t = api.defaultTerms(d); t.check = 100000; t.lead = false; t.valPct = 1;
        if (t.safe) { t.check = 100000; }
        const lim = api.checkLimits(d, t); t.check = Math.min(Math.max(t.check, lim.lo), lim.hi);
        G.ap = 10; G.rep = 90; // unrealistically strong brand so we always win: measure the raw distribution
        api.sendTermSheet(d, t);
      }
    }
    // events: default bot choices
    let guard = 0;
    while (G.queue.length && guard++ < 50) {
      const ev = G.queue[0];
      if (!api.eventValid(ev)) { G.queue.shift(); continue; }
      const v = api.eventView(ev);
      const pick = ({ followon: 'pass', runway: 'sell', downround: 'accept', antidil: 'enforce', fraud: 'ok', cofounder: 'back', custlost: 'accept', competitor: 'ignore', regulatory: 'ignore', poach: 'let', scandal: 'distance', acquihire: 'sell', exitoffer: ev.data && ev.data.kind === 'ipo' ? 'go' : 'sell', lpliquidity: 'no', leak: 'ignore' })[ev.type];
      api.resolveEvent(ev, pick);
    }
    G.ap = 10;
    api.advanceWeek();
    if (G.over) break;
  }
  const f = api.fundMetrics(true);
  for (const h of Object.values(G.hold)) {
    const s = G.startups[h.sid];
    const val = (h.status === 'active' ? api.positionValue(h, true) : 0) + h.realized;
    const cost = h.invested + (h.realizedCost || 0);
    const moic = val / Math.max(1, h.invested);
    tot.n++;
    const bi = buckets.findIndex(b => moic >= b[0] && moic < b[1]);
    tot.b[bi]++;
    const stg = h.stage0;
    const how = s.status === 'dead' ? 'dead' : s.status === 'acquired' ? 'acq' : s.status === 'public' ? 'pub' : s.status === 'exited' ? 'pub' : 'priv';
    const key = stg + ':' + how;
    tot.byStage[key] = tot.byStage[key] || { n: 0, sum: 0 };
    tot.byStage[key].n++; tot.byStage[key].sum += moic;
    invested.push({ moic, stage: stg });
  }
  console.log(`game ${gi}: holdings=${Object.keys(G.hold).length} sourced=${G.stats.sourced} TVPI=${f.tvpi.toFixed(2)} DPI=${f.dpi.toFixed(2)} IRR=${f.irr == null ? '-' : (f.irr * 100).toFixed(1) + '%'}`);
}
console.log('\nOutcome distribution of every deal closed (spray, no follow-on):');
buckets.forEach((b, i) => console.log(b[2].padEnd(20), String(tot.b[i]).padStart(5), (100 * tot.b[i] / tot.n).toFixed(1) + '%'));
const m = invested.map(x => x.moic).sort((a, b) => a - b);
console.log('N', tot.n, 'median', m[Math.floor(m.length / 2)].toFixed(2), 'mean', (m.reduce((a, b) => a + b, 0) / m.length).toFixed(2), 'p90', m[Math.floor(m.length * 0.9)].toFixed(2), 'p99', m[Math.floor(m.length * 0.99)].toFixed(2));

console.log('\nBy entry stage : status   (n, mean moic)');
for (const k of Object.keys(tot.byStage).sort()) console.log(k.padEnd(10), String(tot.byStage[k].n).padStart(5), (tot.byStage[k].sum / tot.byStage[k].n).toFixed(2));
for (let st = 0; st < 6; st++) { const a = invested.filter(x => x.stage === st).map(x => x.moic).sort((x, y) => x - y); if (!a.length) continue; console.log('stage', st, 'n', a.length, 'dead%', (100 * a.filter(x => x < 0.05).length / a.length).toFixed(0), 'median', a[Math.floor(a.length / 2)].toFixed(2), 'mean', (a.reduce((x, y) => x + y, 0) / a.length).toFixed(2), 'p95', a[Math.floor(a.length * 0.95)].toFixed(2)); }
