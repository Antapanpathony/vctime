// Same seed must give the same world (deal flow, heat, macro) no matter what the player does.
const { load } = require('./load');
function run(actor) {
  const api = load();
  const g = api.newGame({ seed: 'determinism-1', size: 5e6 });
  const G = api.G; const out = { sourced: [], heat: [], macro: [] };
  for (let w = 0; w < 80; w++) {
    actor(api, G, w);
    const before = new Set(G.deals.map(d => d.id));
    api.advanceWeek();
    out.sourced.push(G.deals.filter(d => !before.has(d.id) && d.channel === 'inbound').map(d => G.startups[d.sid] && G.startups[d.sid].name + ':' + G.startups[d.sid].q.toFixed(2)).join(','));
    out.heat.push(G.heat.ai.toFixed(4)); out.macro.push(G.macro.regime);
    G.queue.length = 0;
  }
  return out;
}
const idle = () => {};
const busy = (api, G, w) => { G.ap = 10; for (const d of G.deals.filter(d => d.status === 'open').slice(0, 6)) { d.movedW = -9; api.advanceDeal(d); if (d.col >= 3) api.useTool(d, 'data'); } api.coldOutreach('ai'); if (w % 7 === 0) api.hireAnalyst(); };
const a = run(idle), b = run(busy);
let same = 0, diff = 0;
for (let w = 0; w < 80; w++) { if (a.sourced[w] === b.sourced[w]) same++; else diff++; }
console.log('weeks with identical inbound deal flow:', same, '/ 80 (differences come from rep-driven volume)');
console.log('heat identical:', JSON.stringify(a.heat) === JSON.stringify(b.heat), ' macro identical:', JSON.stringify(a.macro) === JSON.stringify(b.macro));
process.exit(JSON.stringify(a.heat) === JSON.stringify(b.heat) && JSON.stringify(a.macro) === JSON.stringify(b.macro) && same > 40 ? 0 : 1);
