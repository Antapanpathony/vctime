// Universe test: lifecycle of startups by latent quality Q, no player involvement.
const { load } = require('./load');
const api = load();
const N = +process.argv[2] || 200, stage0 = +(process.argv[3] || 0);
const Qs = [25, 35, 45, 55, 65, 75, 85, 92];
const g = api.newGame({ seed: 'uni', size: 1e9 });
const G = api.G; G.noSource = true;
const groups = {};
for (const Q of Qs) { groups[Q] = []; for (let i = 0; i < N; i++) { const s = api.genStartup({ q: Q + api.rg(G.rng, 0, 2), sector: ['ai','fin','clim','health','saas','cons','dev'][i % 7], stage: stage0, city: 'sf' }); groups[Q].push(s); } }
const maxDone = {};
for (let w = 0; w < 520; w++) { api.advanceWeek(); G.ap = 10; G.queue.length = 0; if (G.over) break; for (const Q of Qs) for (const s of groups[Q]) { /* track */ } }
console.log('Stage0', stage0, ' (done = last completed round idx; -1 none)');
console.log('Q   | dead% acq% pub% priv% | reached: seed A B C G | mean ARR(priv) ');
let allDead = 0, all = 0;
for (const Q of Qs) {
  const a = groups[Q]; const n = a.length;
  const cnt = st => a.filter(s => s.status === st).length;
  const dead = cnt('dead'), acq = cnt('acquired'), pub = cnt('public') + cnt('exited'), priv = cnt('private');
  const reach = k => a.filter(s => s.done >= k).length;
  allDead += dead; all += n;
  console.log(String(Q).padEnd(3), '|', (100*dead/n).toFixed(0).padStart(4), (100*acq/n).toFixed(0).padStart(5), (100*pub/n).toFixed(0).padStart(5), (100*priv/n).toFixed(0).padStart(5), '|', [0,1,2,3,4,5].map(k => (100*reach(k)/n).toFixed(0).padStart(4)).join(' '));
}
console.log('overall dead', (100*allDead/all).toFixed(0)+'%');
