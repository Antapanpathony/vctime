// Fuzz test: random legal-ish actions every week on many seeds; checks invariants and that nothing throws.
const { load } = require('./load');
const games = +process.argv[2] || 12;
const api = load();
let fails = 0;
function check(G, w, tag) {
  const bad = [];
  const m = api.fundMetrics();
  for (const [k, v] of Object.entries({ cash: G.cash, called: G.called, dist: G.dist, tvpi: m.tvpi, dpi: m.dpi, nav: m.nav, fundCash: G.fundCash, rep: G.rep, trust: G.lpTrust })) if (!isFinite(v)) bad.push(k + '=' + v);
  if (G.called > G.size * 1.0001) bad.push('called>size ' + G.called);
  if (G.fundCash < -1) bad.push('fundCash<0 ' + G.fundCash);
  if (G.reserveLeft < -1) bad.push('reserve<0 ' + G.reserveLeft);
  for (const h of Object.values(G.hold)) {
    for (const t of h.tr) { if (!isFinite(t.shares) || !isFinite(t.invested)) bad.push('tranche NaN ' + h.sid); if (t.shares < 0) bad.push('neg shares'); }
    const s = G.startups[h.sid];
    if (s && h.status === 'active' && !isFinite(api.holdingMark(h))) bad.push('mark NaN ' + s.name);
    if (s && (!isFinite(s.mrr) || !isFinite(s.cash) || !isFinite(s.expense))) bad.push('startup NaN ' + s.name);
  }
  if (bad.length) { fails++; console.log('INVARIANT', tag, 'week', w, bad.slice(0, 4).join('; ')); }
}
for (let gi = 0; gi < games; gi++) {
  const sectors = api.SECTORS.map(s => s.id);
  const pick = a => a[Math.floor(Math.random() * a.length)];
  const g = api.newGame({ seed: 'fz' + gi + Math.random(), size: pick([3e6, 5e6, 10e6]), home: pick(['sf', 'ldn', 'sg', 'blr']), thesis: { smin: 0, smax: 2 + Math.floor(Math.random() * 3), sectors: [pick(sectors), pick(sectors)], geo: pick(['local', 'region', 'global']), check: pick([0.03, 0.05, 0.08, 0.15]) }, reservePct: pick([0.2, 0.35, 0.5]) });
  const G = api.G; let errors = 0;
  for (let w = 0; w < 520 && !G.over; w++) {
    try {
      let guard = 0;
      while (G.queue.length && guard++ < 60) {
        const ev = G.queue[0];
        if (!api.eventValid(ev)) { G.queue.shift(); continue; }
        const v = api.eventView(ev); const ok = v.opts.filter(o => !o.disabled);
        api.resolveEvent(ev, (ok.length ? pick(ok) : v.opts[0]).id);
      }
      for (let k = 0; k < 14 && G.ap > 0; k++) {
        const r = Math.random();
        const open = G.deals.filter(d => d.status === 'open');
        if (r < 0.45 && open.length) { const d = pick(open); d.movedW = Math.random() < 0.7 ? -9 : d.movedW; if (d.col < 4) api.advanceDeal(d); else { const t = api.defaultTerms(d); t.valPct = 0.6 + Math.random() * 0.65; t.lead = !t.safe && Math.random() < 0.5; t.board = t.lead && Math.random() < 0.5; t.pref = Math.random() < 0.3 ? 'part' : '1x'; t.anti = pick(['none', 'wa', 'ratchet']); t.pool = 0.08 + 0.02 * Math.floor(Math.random() * 7); t.mfn = Math.random() < 0.5; t.disc = Math.random() < 0.3 ? 0.2 : 0; const l = api.checkLimits(d, t); t.check = Math.min(Math.max(l.lo, l.lo + Math.random() * (l.hi - l.lo)), l.hi); api.sendTermSheet(d, t); } }
        else if (r < 0.62 && open.length) { const d = pick(open); api.useTool(d, pick(api.TOOL_ORDER)); if (Math.random() < 0.3) api.hqVisit(d, pick(Object.keys(api.HQ_FOCUS))); if (Math.random() < 0.2) api.marketCheck(d); }
        else if (r < 0.75) { const hs = api.activeHoldings(); if (hs.length) api.helpAction(pick(hs), pick(['intro', 'hire', 'raise', 'pivot', 'cust'])); }
        else if (r < 0.80 && open.length) api.passDeal(pick(open));
        else if (r < 0.84) { const hs = api.activeHoldings(); if (hs.length) { const h = pick(hs); if (api.canSellPublic(h)) api.sellPublic(h, pick([0.25, 0.5, 1])); else api.sellSecondary(h, pick([0.25, 0.5, 1])); } }
        else if (r < 0.88) api.coldOutreach(pick(sectors));
        else if (r < 0.90) { api.hireAnalyst(); } else if (r < 0.92) api.toggleCar();
        else break;
      }
      check(G, w, 'pre');
    } catch (e) { errors++; fails++; if (errors < 3) console.log('ERR game', gi, 'wk', w, e.stack.split('\n').slice(0, 5).join('\n')); }
    try { G.ap = Math.max(G.ap, 0); api.advanceWeek(); check(G, w, 'post'); } catch (e) { errors++; fails++; console.log('ERR advance', gi, w, e.stack.split('\n').slice(0, 6).join('\n')); break; }
  }
  const m = api.fundMetrics(true);
  console.log(`game ${gi}: size ${G.size / 1e6}M deals ${Object.keys(G.hold).length} TVPI ${m.tvpi.toFixed(2)} DPI ${m.dpi.toFixed(2)} IRR ${m.irr == null ? '-' : (100 * m.irr).toFixed(0) + '%'} errors ${errors}`);
}
console.log(fails ? 'FUZZ FAILURES: ' + fails : 'fuzz clean');
process.exit(fails ? 1 : 0);
