// ============================================================================
// SIM: game state, startups, cap tables, rounds, exits
// ============================================================================
let G = null;
const setG = g => { G = g; };

const STATS = ['F', 'P', 'B', 'T', 'I', 'X'];
const STAT_NAMES = { F: 'Founder quality', P: 'Product-market fit', B: 'Burn discipline', T: 'Market timing', I: 'Integrity', X: 'Tech that works' };
const STAT_SHORT = { F: 'Founder', P: 'PMF', B: 'Burn', T: 'Timing', I: 'Integrity', X: 'Tech' };

function logMsg(text, kind) { G.log.push({ w: G.week, t: text, k: kind || 'info' }); if (G.log.length > 300) G.log.splice(0, 100); }
function toast(text, kind) { G.toasts = G.toasts || []; G.toasts.push({ t: text, k: kind || 'info', born: G.week }); }
function pushEvent(type, sid, data) { G.queue.push({ type, sid: sid || 0, data: data || {} }); }

// ---------------------------------------------------------------- new game
function newGame(o) {
  const seed = String(o.seed || Math.floor(Math.random() * 900000 + 100000));
  const size = o.size || 5e6;
  const gp = Math.round(size * 0.02);
  const g = {
    v: 1, seed, rng: mkrng(hashStr(seed + ':world')), wr: mkrng(hashStr(seed + ':open')), gc: {}, week: 0, ap: AP_BASE, apDebt: 0, over: false,
    fundName: o.fundName || 'Bad Haircut Ventures', home: o.home || 'sf', size,
    thesis: Object.assign({ smin: 0, smax: 1, sectors: ['ai', 'saas'], geo: 'region', check: 0.05 }, o.thesis || {}),
    reservePct: o.reservePct != null ? o.reservePct : 0.35,
    called: gp, fundCash: gp, invPaid: 0, dist: 0, carryPaid: 0, flows: [{ w: 0, a: -gp }], gp, reserveLeft: 0, feesPaid: 0, opexPaid: 0,
    cash: 250000 - gp, car: false, staff: { analysts: 0, scouts: [] }, cashHist: [],
    rep: 8, net: 6, lpTrust: 60, vaScore: 0.25, founderRel: 60,
    startups: {}, nextId: 1, names: {}, deals: [], nextDeal: 1, hold: {}, ledger: [],
    heat: {}, heatOu: {}, heatHist: [], macro: { regime: 'normal', since: 0 }, macroHist: [],
    queue: [], log: [], toasts: [], hist: [], reports: [], recent: [], realizedLog: [],
    stats: { sourced: 0, closed: 0, exits: 0, writeoffs: 0, frauds: 0, bestMoic: 0 },
    coldSector: o.thesis && o.thesis.sectors ? o.thesis.sectors[0] : 'ai', quarterBoard: 0,
    divisor: 1,
  };
  SECTORS.forEach(s => { g.heatOu[s.id] = 0; });
  setG(g);
  const D0 = dryPowder();
  g.reserveLeft = Math.max(0, g.reservePct * D0);
  SECTORS.forEach(s => { g.heat[s.id] = sectorHeatAt(s, 0, g.heatOu[s.id]); });
  recordHistory();
  logMsg(`${g.fundName} opens its doors. ${fm(size)} committed, ${fm(gp)} of it yours. Try not to lose it.`, 'good');
  return g;
}

function sectorHeatAt(sec, w, ou) { return clamp(sec.amp * Math.sin(2 * Math.PI * (w / sec.period + sec.phase)) + ou, -1, 1); }

// ---------------------------------------------------------------- fund money
function weeksLeft() { return Math.max(0, FUND_WEEKS - G.week); }
function annualFee() { return G.size * FEE_PCT; }
function uncalled() { return G.size - G.called; }
function dryPowder() { return uncalled() + G.fundCash - annualFee() / 52 * weeksLeft() - G.size * 0.01; }
function generalPowder() { return dryPowder() - G.reserveLeft; }
// spend money from the fund: idle cash (the GP commit) first, then call capital from LPs
function callCapital(amt, kind) {
  amt = Math.min(amt, Math.max(0, uncalled() + G.fundCash));
  const fromCash = Math.min(G.fundCash, amt); G.fundCash -= fromCash;
  const call = amt - fromCash;
  if (call > 0) { G.called += call; G.flows.push({ w: G.week, a: -call }); }
  if (kind === 'fee') G.feesPaid += amt; else if (kind === 'opex') G.opexPaid += amt; else if (kind === 'inv') G.invPaid += amt;
  return amt;
}
function distribute(amt) {
  if (amt <= 0) return;
  G.dist += amt;
  const carryDue = Math.max(0, CARRY_PCT * (G.dist - G.called) - G.carryPaid);
  G.carryPaid += carryDue;
  const net = amt - carryDue;
  G.flows.push({ w: G.week, a: net });
  G.cash += carryDue + net * (G.gp / G.size);
  return { carry: carryDue, net };
}

// ---------------------------------------------------------------- knowledge
function noiseMult() { return Math.pow(0.88, G.staff.analysts); }
function onThesis(s) { return thesisFit(s).ok; }
function fitMult(s) { return onThesis(s) ? 0.82 : 1.2; }
function know(s, stat, obs, sigma) {
  obs = clamp(obs, 0, 100);
  const k = s.know[stat], v2 = sigma * sigma;
  if (!k) { s.know[stat] = { m: obs, v: v2 }; return; }
  const nv = 1 / (1 / k.v + 1 / v2);
  k.m = nv * (k.m / k.v + obs / v2); k.v = nv;
}
function observe(s, stat, sigma, bias) {
  const sg = sigma * noiseMult() * fitMult(s);
  const obs = s.h[stat] + (bias || 0) + rg(G.rng, 0, sg);
  know(s, stat, obs, sg);
  return obs;
}

// ---------------------------------------------------------------- thesis
function cityRelation(cityId) {
  const h = CITY_BY_ID[G.home], c = CITY_BY_ID[cityId];
  if (c.id === h.id) return 'local';
  if (c.region === h.region) return 'region';
  return 'far';
}
function thesisFit(s) {
  const t = G.thesis, k = s.round ? s.round.stage : s.done + 1;
  const stage = k >= t.smin && k <= t.smax;
  const sector = t.sectors.includes(s.sector);
  const rel = cityRelation(s.city);
  const geo = t.geo === 'global' || (t.geo === 'region' && rel !== 'far') || (t.geo === 'local' && rel === 'local');
  return { stage, sector, geo, ok: stage && sector && geo };
}
function driftLevel() {
  if (!G.recent.length) return 0;
  const n = G.recent.slice(-8);
  return n.filter(x => x).length / n.length;
}
function biasFactor() { return clamp(1 - Math.max(0, driftLevel() - 0.2) * 1.2, 0.25, 1); }

// ---------------------------------------------------------------- startup generation
function invented(r) {
  const C = 'bdfgklmnprstvz', V = 'aeiou'; let s = ''; const n = ri(r, 2, 3);
  for (let i = 0; i < n; i++) s += C[ri(r, 0, C.length - 1)] + V[ri(r, 0, V.length - 1)];
  return s[0].toUpperCase() + s.slice(1) + (rc(r, 0.4) ? rp(r, ['x', 'n', 'ly', 'a', 'io']) : '');
}
function genName(r, sec) {
  for (let t = 0; t < 30; t++) {
    const m = rf(r); let nm;
    if (m < 0.45) nm = rp(r, sec.pre) + rp(r, sec.suf);
    else if (m < 0.7) nm = rp(r, sec.pre) + ' ' + rp(r, ['Labs', 'Systems', 'Co', 'Group', 'Works', 'Collective', 'Analytics']);
    else nm = invented(r);
    nm = nm.replace(/^(.)(.*)$/, (a, b, c) => b.toUpperCase() + c);
    if (!G.names[nm]) { G.names[nm] = 1; return nm; }
  }
  const nm = invented(r) + ri(r, 2, 99); G.names[nm] = 1; return nm;
}
function pickQuirk(r, h) {
  const m = rf(r);
  if (m < 0.22) return rc(r, 0.5 + (50 - h.I) / 120) && h.I < 55 ? rp(r, QUIRK_BAD_I) : (h.I > 70 ? rp(r, QUIRK_GOOD_I) : rp(r, QUIRK_FLAVOR));
  if (m < 0.40) return h.F > 62 && rc(r, 0.75) ? rp(r, QUIRK_GOOD_F) : (h.F < 42 && rc(r, 0.75) ? rp(r, QUIRK_BAD_F) : rp(r, QUIRK_FLAVOR));
  if (m < 0.47) return rp(r, rc(r, 0.5) ? QUIRK_BAD_I : QUIRK_BAD_F);
  return rp(r, QUIRK_FLAVOR);
}

function pickCity(r, bias) {
  const home = CITY_BY_ID[G.home];
  const x = rf(r);
  const pLocal = 0.5 + 0.18 * (1 - bias), pReg = 0.25;
  if (x < pLocal) return home.id;
  const same = CITIES.filter(c => c.region === home.region && c.id !== home.id);
  if (x < pLocal + pReg && same.length) return rp(r, same).id;
  const other = CITIES.filter(c => c.region !== home.region);
  return rp(r, other).id;
}

function genStartup(o) {
  const id = G.nextId++;
  const r = mkrng(hashStr(G.seed + ':s:' + (o.key || id)));
  const sec = SECTOR_BY_ID[o.sector];
  const Q = clamp(o.q, 4, 97);
  const h = {};
  h.F = clamp(Q + rg(r, 0, 13), 3, 98);
  h.P = clamp(Q + rg(r, 0, 15), 3, 98);
  h.T = clamp(50 + 0.35 * (Q - 50) + rg(r, 0, 17) + 8 * G.heat[o.sector], 3, 98);
  h.B = clamp(rg(r, 52, 18) + 0.1 * (Q - 50), 3, 98);
  h.X = clamp(Q + rg(r, 0, 17), 3, 98);
  const fraud = rc(r, sec.fraud * (Q < 40 ? 1.6 : Q > 70 ? 0.35 : 1));
  h.I = fraud ? rr(r, 3, 20) : clamp(rg(r, 62 + 0.2 * (Q - 50), 16), 25, 98);
  if (fraud) { h.P = Math.min(h.P, rr(r, 8, 42)); }
  const s = {
    id, name: genName(r, sec), sector: o.sector, city: o.city || pickCity(r, 1),
    founder: { name: rp(r, FIRST) + ' ' + rp(r, LAST) }, q: Q, h, fraud,
    breakout: h.P >= 82 && h.F >= 68 && h.T >= 58,
    pitch: rp(r, sec.what) + ' for ' + rp(r, sec.who),
    rs: r, born: G.week, status: 'private', know: {},
    done: -1, rounds: [], cap: { founders: 8e6, pool: 1e6, inv: [] }, safes: [], lowSafeCap: Infinity,
    mrr: 0, expense: 0, cash: 0, gMod: 0, dress: 0, distress: 1, fails: 0, round: null, lastRaiseW: G.week, pivotW: -99,
    saleBoost: 1, shock: 0, stallUntil: 0,
  };
  s.founder.quirk = pickQuirk(r, h);
  s.potential = 12e6 * Math.exp(0.125 * (0.45 * h.P + 0.25 * h.T + 0.3 * h.F - 50)) * Math.exp(rg(r, 0, 0.5)) * (s.breakout ? 2.6 : 1);
  s.dress = fraud ? rr(r, 0.35, 0.8) : Math.max(0, (100 - h.I) / 100 * rr(r, 0.05, 0.25));
  setupFinancials(s, o.stage);
  openRound(s, o.stage, o.fast);
  G.startups[id] = s;
  return s;
}

function sectorHeat(id) { return G.heat[id] || 0; }

function setupFinancials(s, r0) {
  const r = s.rs, h = s.h;
  // backfill earlier rounds so the cap table makes sense
  for (let k = 0; k < r0; k++) {
    const st = stg(k);
    const pre = st.pre * rr(r, 0.75, 1.5) * Math.pow(s.q / 50, 0.8), raise = st.raise * rr(r, 0.8, 1.2);
    const post = pre + raise;
    const poolPct = 0.10;
    const N = s.cap.founders + s.cap.pool + sum(s.cap.inv, x => x.shares);
    let postFD = (N - s.cap.pool) / (1 - poolPct - raise / post);
    if (poolPct * postFD < s.cap.pool) postFD = N / (1 - raise / post);
    const pps = post / postFD, newInv = raise / pps;
    s.cap.pool = Math.max(s.cap.pool, poolPct * postFD);
    s.cap.inv.push({ name: STAGES[k].short + ' investors', shares: newInv });
    s.rounds.push({ stage: k, pre, post, raise, pps, week: G.week - 60 + k * 10, lead: 'Earlier investors', down: false });
    s.done = k;
  }
  if (r0 === 0) {
    s.mrr = rr(r, 800, 5500);
    const net = STAGES[0].burnMo * rr(r, 0.6, 1.3);
    s.expense = s.mrr + net; s.cash = net * rr(r, 3.2, 6.5);
  } else {
    const arr = STAGES[r0].bench * Math.exp((h.P - 52) / 26) * rr(r, 0.65, 1.2);
    s.mrr = arr / 12;
    const net = STAGES[r0].burnMo * rr(r, 0.7, 1.3) * (1.25 - h.B / 200);
    s.expense = s.mrr + net; s.cash = net * rr(r, 3.2, 6.5);
  }
}

function perceivedRatio(s, k) {
  const h = s.h;
  const team = Math.exp((0.45 * h.F + 0.4 * h.P + 0.15 * h.T - 50) / 22);
  if (k === 0) return team;
  const rev = Math.max(0.02, s.mrr * 12 * (1 + s.dress * 0.7) / stg(k).bench);
  return k === 1 ? Math.sqrt(rev * team) : rev;
}
function fairPre(s, k) {
  const st = stg(k);
  const r = perceivedRatio(s, k);
  const em = Math.pow(SECTOR_BY_ID[s.sector].em, 0.6);
  return st.pre * Math.pow(clamp(r, 0.25, 4), 0.8) * (1 + 0.3 * sectorHeat(s.sector)) * MACRO[G.macro.regime].val * em;
}

// open a funding round for a startup (the thing sitting in your pipeline)
function openRound(s, k, fast) {
  const r = s.rs, st = stg(k);
  const ratio = perceivedRatio(s, k);
  const fair = fairPre(s, k);
  const greed = rr(r, 1.0, 1.28);
  const raise = st.raise * Math.pow(clamp(ratio, 0.5, 2), 0.4) * rr(r, 0.9, 1.15);
  const safeP = k === 0 ? 0.65 : k === 1 ? 0.35 : 0;
  const safe = rc(r, safeP);
  const [wa, wb] = st.weeksOpen;
  s.round = {
    stage: k, fair, ask: fair * greed, raise, safe, poolPct: 0.10, greed,
    start: G.week, end: G.week + (fast ? ri(r, 2, 3) : ri(r, wa, wb)), signal: 0, prep: s.nextPrep || 0, mySlice: 0, taken: false,
    rivals: makeRivals(s, k, fair, greed),
  };
  if (safe) s.round.ask = s.round.ask * 1.05; // cap is quoted post-money-ish
  s.nextPrep = 0;
  return s.round;
}

function marketQ(s) { return 0.4 * s.h.F + 0.4 * s.h.P + 0.2 * s.h.T; }
function makeRivals(s, k, fair, greed) {
  const r = s.rs;
  const qm = marketQ(s) + rg(r, 0, 4);
  const stageF = [0.7, 1.0, 1.2, 1.3, 1.3, 1.3, 1.3, 1.3, 1.3, 1.3][k];
  const lam = clamp((qm - 38) / 16, 0, 3.2) * (1 + 0.35 * sectorHeat(s.sector)) * stageF * (s.fraud ? 0.5 : 1);
  const n = Math.min(4, rpois(r, lam));
  const out = [];
  const elig = RIVALS.filter(f => Math.min(5, k) >= f.stages[0] && Math.min(5, k) <= f.stages[1]);
  for (let i = 0; i < n && elig.length; i++) {
    const f = rw(r, elig.filter(e => !out.find(o => o.id === e.id)), e => (e.sectors ? (e.sectors.includes(s.sector) ? 2.2 : 0.4) : 1) * (0.5 + e.brand / 100));
    if (!f) break;
    const prem = fair * (1 + f.pay + rg(r, 0, 0.05));
    const u = (f.brand - 50) / 50 + 3.2 * Math.log(prem / (fair * greed)) + f.friendly * 0.8 + f.speed * 0.4 + f.va * 0.4 + rg(r, 0, 0.22);
    out.push({ id: f.id, name: f.name, u, pre: prem });
  }
  return out;
}

// ---------------------------------------------------------------- cap table math
function fd(s) {
  let t = s.cap.founders + s.cap.pool;
  for (const i of s.cap.inv) t += i.shares;
  const h = G.hold[s.id];
  if (h) for (const tr of h.tr) t += tr.shares || 0;
  return t;
}
function prefTotal(s) { return Math.max(1, sum(s.rounds, x => x.raise) + sum(s.safes, x => x.invested)); }
function lastPost(s) { return s.rounds.length ? s.rounds[s.rounds.length - 1].post : 0; }

// price + close a round. o: {pre, raise, lead, poolPct, mine:[{invested, pref, anti, board, prorata, safe, cap, mfn, disc, kind}] , safeRound}
function closeRound(s, o) {
  const k = s.round ? s.round.stage : s.done + 1;
  const w = G.week;
  const h0 = G.hold[s.id];
  if (o.safeRound) {
    // SAFE round: money in, valuation cap recorded; converts at next priced round
    const cap = o.pre;
    s.cash += o.raise;
    const mineInv = sum(o.mine || [], t => t.invested);
    const otherInv = Math.max(0, o.raise - mineInv);
    if (otherInv > 0) s.safes.push({ who: 'other', invested: otherInv, cap, disc: rc(s.rs, 0.5) ? 0.2 : 0, mfn: false, name: o.lead });
    for (const t of (o.mine || [])) {
      const tr = addTranche(s, { kind: 'safe', invested: t.invested, cap, disc: t.disc || 0, mfn: !!t.mfn, pref: '1x', anti: 'none' });
      s.safes.push({ who: 'me', tid: tr.id, invested: t.invested, cap, disc: t.disc || 0, mfn: !!t.mfn });
    }
    s.lowSafeCap = Math.min(s.lowSafeCap, cap);
    s.rounds.push({ stage: k, pre: cap, post: cap, raise: o.raise, pps: 0, week: w, lead: o.lead, down: false, safe: true });
    s.done = k;
  } else {
    const pre = o.pre, raise = o.raise, post = pre + raise;
    // convert safes / notes
    const Nbase = s.cap.founders + s.cap.pool + sum(s.cap.inv, x => x.shares) + (h0 ? sum(h0.tr, t => t.shares || 0) : 0);
    let safeShares = 0; const conv = [];
    for (const sf of s.safes) {
      const capV = Math.min(sf.cap || Infinity, sf.mfn ? s.lowSafeCap : Infinity);
      const convVal = Math.min(capV, pre * (1 - (sf.disc || 0)));
      const sh = sf.invested / convVal * Nbase;
      safeShares += sh; conv.push([sf, sh]);
    }
    const N = Nbase + safeShares;
    const poolPct = o.poolPct != null ? o.poolPct : 0.10;
    let postFD = (N - s.cap.pool) / (1 - poolPct - raise / post);
    if (poolPct * postFD < s.cap.pool) postFD = N / (1 - raise / post);
    const pps = post / postFD;
    const prevPps = s.rounds.length ? lastPps(s) : 0;
    const down = prevPps > 0 && pps < prevPps * 0.98;
    // convert
    for (const [sf, sh] of conv) {
      if (sf.who === 'me') {
        const tr = h0.tr.find(t => t.id === sf.tid);
        if (tr) { tr.shares = sh; tr.cp = tr.invested / sh; tr.converted = true; }
      } else s.cap.inv.push({ name: sf.name || 'SAFE holders', shares: sh });
    }
    s.safes = [];
    // anti-dilution on my earlier priced tranches
    if (down && h0) {
      const A = N, newShares = raise / pps;
      for (const t of h0.tr) {
        if (!t.shares || t.kind === 'safe' || t.anti === 'none' || !t.cp) continue;
        if (pps >= t.cp) continue;
        let cp2;
        if (t.anti === 'ratchet') cp2 = pps;
        else { const B = raise / t.cp; cp2 = t.cp * (A + B) / (A + newShares); }
        const ns = t.invested / cp2;
        if (ns > t.shares) { t.adjust = (t.adjust || 0) + (ns - t.shares); t.shares = ns; t.cp = cp2; s.antiTriggered = true; }
      }
    }
    // pool top-up
    const poolAdd = Math.max(0, poolPct * postFD - s.cap.pool);
    s.cap.pool += poolAdd;
    // new investors
    let myShares = 0;
    for (const t of (o.mine || [])) {
      const tr = addTranche(s, { kind: t.kind || 'priced', invested: t.invested, pps, cp: pps, pref: t.pref || '1x', anti: t.anti || 'wa' });
      tr.shares = t.invested / pps; myShares += tr.shares;
    }
    s.cap.inv.push({ name: o.lead, shares: Math.max(0, raise / pps - myShares) });
    s.cash += raise;
    s.rounds.push({ stage: k, pre, post, raise, pps, week: w, lead: o.lead, down });
    s.done = k;
    s.lastDown = down;
  }
  s.round = null; s.fails = 0; s.lastRaiseW = w; s.distress = 1;
  // reset burn plan
  const plan = 12 + s.h.B / 100 * 12;
  s.expense = s.mrr + Math.max(stg(k).burnMo * 0.5, s.cash / plan);
  s.stallUntil = 0;
  return s.rounds[s.rounds.length - 1];
}
function lastPps(s) { for (let i = s.rounds.length - 1; i >= 0; i--) if (s.rounds[i].pps > 0) return s.rounds[i].pps; return 0; }

function addTranche(s, t) {
  let h = G.hold[s.id];
  if (!h) {
    h = G.hold[s.id] = { sid: s.id, tr: [], invested: 0, realized: 0, board: false, prorata: false, lead: false, rel: 60, status: 'active', since: G.week, helpCd: {}, nextTr: 1, lockUntil: 0, exitW: 0, spent: {}, diligence: 0 };
  }
  t.id = h.nextTr++; t.w = G.week; t.shares = t.shares || 0;
  h.tr.push(t); h.invested += t.invested;
  return t;
}

// ---------------------------------------------------------------- holdings valuation
function equityMark(s) {
  if (s.status === 'dead') return 0;
  if (s.status === 'public') return s.mcap;
  if (!s.rounds.length) return 0;
  let v = lastPost(s) * s.distress;
  // stale + profitable → mark to ARR model
  const stale = G.week - s.lastRaiseW;
  if (stale > 70 && s.mrr > s.expense * 0.9) v = Math.max(v, s.mrr * 12 * 10 * MACRO[G.macro.regime].exit);
  return v;
}
function ownPct(s, h) {
  h = h || G.hold[s.id]; if (!h) return 0;
  const f = fd(s);
  // converted shares + a post-money-style estimate for SAFEs / notes that have not converted yet
  return sum(h.tr, t => t.shares || 0) / f + sum(h.tr.filter(t => !t.shares), t => t.invested / Math.max(1, t.cap && isFinite(t.cap) ? t.cap : (lastPost(s) || t.invested * 10) * 0.8));
}
function holdingMark(h) {
  const s = G.startups[h.sid];
  if (!s || h.status !== 'active') return 0;
  if (s.status === 'dead') return 0;
  const eq = equityMark(s), f = fd(s);
  let v = 0;
  for (const t of h.tr) {
    if (t.shares) v += t.shares / f * eq;
    else v += t.invested * (s.rounds.length && t.kind === 'safe' ? Math.max(1, lastPost(s) / t.cap * 0.9) : 1) * s.distress;
  }
  return v;
}
function holdingCost(h) { return h.invested; }

// payout for a holding if company sold for equity value EV
function exitPayout(s, h, EV) {
  const pt = prefTotal(s), f = fd(s);
  let pay = 0;
  for (const t of h.tr) {
    if (!t.shares) { // unconverted SAFE / note
      pay += EV <= pt ? EV * t.invested / pt : t.invested * Math.max(1, EV / (t.cap || lastPost(s) || EV));
      continue;
    }
    const own = t.shares / f;
    if (EV <= pt) pay += EV * t.invested / pt;
    else if (t.pref === 'part') pay += t.invested + own * (EV - pt);
    else pay += Math.max(t.invested, own * EV);
  }
  return pay;
}
function arr(s) { return s.mrr * 12; }

// ---------------------------------------------------------------- misc helpers
function dealsOf(sid) { return G.deals.filter(d => d.sid === sid && d.status === 'open'); }
function endDeal(d, status, why) { d.status = status; d.why = why; d.endW = G.week; if (d.col >= 1 && status !== 'closed') { addLedger(d); } }
function addLedger(d) {
  const s = G.startups[d.sid]; if (!s) return;
  if (G.ledger.find(l => l.sid === d.sid)) return;
  G.ledger.push({ sid: d.sid, name: s.name, sector: s.sector, w: G.week, stage: d.stage, ask: d.ask, why: d.why || 'passed', pre: s.round ? s.round.ask : 0 });
}
function recordHistory() {
  const m = fundMetrics();
  G.hist.push({ w: G.week, tvpi: m.tvpi, dpi: m.dpi, nav: m.nav, paid: m.paidIn, dist: G.dist });
}

// deterministic per (company, week) so event screens never flicker or churn the RNG
function hash01(str) { return hashStr(str) / 4294967296; }
function acqhireEV(s) {
  const M = MACRO[G.macro.regime];
  const f = 0.05e6 + 0.23e6 * hash01(s.id + ':ah:' + G.week);
  return Math.max(s.cash * 0.6, headcount(s) * f * M.val + arr(s) * 0.6);
}
