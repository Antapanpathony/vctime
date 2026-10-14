// End-to-end bot on a realistic fund: screens, does diligence, bids, follows on, resolves every event type.
// usage: node tools/playbot.js [games] [skill: 0=random 1=diligence-aware]
const { load } = require('./load');
const games = +process.argv[2] || 3, skill = +(process.argv[3] || 1);
const api = load();
function trueQ(s) { return 0.4 * s.h.F + 0.4 * s.h.P + 0.2 * s.h.T; }
function estQ(s) { const k = s.know; const get = (x, d) => (k[x] ? k[x].m : d); return 0.4 * get('F', 45) + 0.4 * get('P', 45) + 0.2 * get('T', 45); }
const results = [];
for (let gi = 0; gi < games; gi++) {
  const g = api.newGame({ seed: 'play' + gi, size: 5e6, home: 'sf', thesis: { smin: 0, smax: 2, sectors: ['ai', 'saas', 'dev'], geo: 'region', check: 0.05 }, reservePct: 0.35 });
  const G = api.G; let errors = 0;
  for (let w = 0; w < 520 && !G.over; w++) {
    try {
      // resolve events
      let guard = 0;
      while (G.queue.length && guard++ < 60) {
        const ev = G.queue[0];
        if (!api.eventValid(ev)) { G.queue.shift(); continue; }
        const v = api.eventView(ev); const ok = v.opts.filter(o => !o.disabled);
        const sE = ev.sid ? G.startups[ev.sid] : null;
        const hi = sE && skill === 2 ? trueQ(sE) >= 58 && !sE.fraud : true;
        const prefer = skill === 2 ? ({ followon: [hi ? 'full' : 'pass', 'pass'], runway: [hi ? 'bridge' : 'sell', 'sell'], downround: ['accept'], antidil: ['waive'], fraud: ['ok'], cofounder: ['mediate', 'back'], custlost: ['win', 'accept'], competitor: ['dd', 'ignore'], regulatory: ['pay', 'ignore'], poach: ['keep', 'let'], scandal: ['stand', 'distance'], acquihire: ['sell'], exitoffer: ['sell', 'go'], lpliquidity: ['buyer', 'own', 'no'], leak: ['apol', 'ignore'] })[ev.type] : ({ followon: ['full', 'half', 'pass'], runway: ['bridge', 'sell', 'shut'], downround: ['support', 'accept'], antidil: ['waive', 'enforce'], fraud: ['ok'], cofounder: ['mediate', 'back'], custlost: ['win', 'accept'], competitor: ['dd', 'ignore'], regulatory: ['pay', 'ignore'], poach: ['keep', 'let'], scandal: ['stand', 'distance'], acquihire: ['sell', 'hold'], exitoffer: ['sell', 'go', 'no'], lpliquidity: ['buyer', 'own', 'no'], leak: ['apol', 'ignore'] })[ev.type];
        let pick = null; for (const p of prefer) if (ok.find(o => o.id === p)) { pick = p; break; }
        if (!pick) pick = ok[0] ? ok[0].id : v.opts[0].id;
        api.resolveEvent(ev, pick);
      }
      // portfolio help
      for (const h of api.activeHoldings()) { if (G.ap > 4) api.helpAction(h, ['intro', 'hire', 'cust', 'raise'][w % 4]); }
      // sell public positions
      for (const h of api.activeHoldings()) if (api.canSellPublic(h) && G.ap > 0) api.sellPublic(h, 1);
      // pipeline
      const open = G.deals.filter(d => d.status === 'open');
      for (const d of open) {
        const s = G.startups[d.sid];
        if (d.status !== 'open') continue;
        if (skill === 2 && d.col <= 3 && !(api.thesisFit(s).ok && trueQ(s) >= 60 && !s.fraud && s.h.I > 35)) { if (d.col >= 1 || G.week - d.w0 > 1) api.passDeal(d); continue; }
        if (d.col === 0 && G.ap > 6) { if (api.thesisFit(s).ok || skill === 0) api.advanceDeal(d); else if (G.week - d.w0 > 1) api.passDeal(d); }
        else if (d.col === 1 && G.ap > 5) { api.advanceDeal(d); }
        else if (d.col === 2 && G.ap > 4) { api.advanceDeal(d); }
        else if (d.col === 3 && G.ap > 3) {
          if (skill === 2) { api.advanceDeal(d); continue; }
          if (skill) { for (const t of ['data', 'refs', 'cust', 'tech', 'bg']) if (G.ap > 2) api.useTool(d, t); if (G.ap > 4) api.hqVisit(d, 'qa'); }
          const q = estQ(s), fraudFlag = d.bg === 'flags' || (s.know.I && s.know.I.m < 40);
          if (skill && (q < 56 || fraudFlag)) { api.passDeal(d); continue; }
          api.advanceDeal(d);
        } else if (d.col === 4) {
          const t = api.defaultTerms(d); if (G.ap > 0 && api.checkLimits(d, t).afford) api.sendTermSheet(d, t);
        }
      }
    } catch (e) { errors++; if (errors < 4) console.log('ERR wk', w, e.stack.split('\n').slice(0, 4).join('\n')); }
    G.ap = 10;
    try { api.advanceWeek(); } catch (e) { errors++; console.log('ERR advance', e.stack.split('\n').slice(0, 5).join('\n')); break; }
  }
  const m = api.fundMetrics(true), sc = api.scoreFund(m);
  const hs = Object.values(G.hold);
  console.log(`game ${gi}: deals=${hs.length} writeoffs=${G.stats.writeoffs} exits=${G.stats.exits} frauds=${G.stats.frauds} TVPI=${m.tvpi.toFixed(2)} DPI=${m.dpi.toFixed(2)} IRR=${m.irr == null ? '-' : (m.irr * 100).toFixed(1) + '%'} rep=${G.rep.toFixed(0)} score=${sc.score}(${sc.grade}) errors=${errors} personal=${Math.round(G.cash)} dry=${Math.round(api.dryPowder())}`);
  results.push(m.tvpi);
}
console.log('mean TVPI', (results.reduce((a, b) => a + b, 0) / results.length).toFixed(2));
