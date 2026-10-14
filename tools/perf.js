const { load } = require('./load');
const api = load();
const g = api.newGame({ seed: 'perf', size: 5e6 });
const G = api.G;
let tot = 0, worst = 0, maxS = 0;
for (let w = 0; w < 520; w++) {
  G.queue.length = 0; G.ap = 10;
  const t0 = process.hrtime.bigint();
  api.advanceWeek();
  const ms = Number(process.hrtime.bigint() - t0) / 1e6; tot += ms; worst = Math.max(worst, ms);
  maxS = Math.max(maxS, Object.keys(G.startups).length);
  if (G.over) break;
}
const json = JSON.stringify(G, (k, v) => v === Infinity ? '__inf__' : v);
console.log('avg ms/week', (tot / 520).toFixed(2), 'worst', worst.toFixed(1), 'max startups alive', maxS, 'startups now', Object.keys(G.startups).length, 'deals', G.deals.length, 'save KB', (json.length / 1024).toFixed(0));
