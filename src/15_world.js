// ============================================================================
// WORLD: weekly engine — startups, rounds, crises, exits, sourcing, macro
// ============================================================================

function growthMo(s) {
  const h = s.h, k = Math.min(s.done + 1, 5);
  let g = ((h.P - 30) / 100 * 0.21 + (h.F - 50) / 100 * 0.04 + (h.T - 50) / 100 * 0.05) * STAGES[k].damp + 0.015 * sectorHeat(s.sector) + s.gMod;
  if (s.breakout) g *= 1.18;
  if (g > 0) g *= Math.max(0.03, 1 - s.mrr * 12 / s.potential) / (1 + 0.25 * Math.sqrt(s.mrr * 12 / 8e6)); // market ceiling + law of large numbers
  if (s.fraud) g = Math.min(g, 0.01);
  return g;
}
function netBurn(s) { return s.expense - s.mrr; }
function runwayMo(s) { const nb = netBurn(s); return nb > 1 ? s.cash / nb : 99; }
function headcount(s) { return Math.max(2, Math.round(s.expense / 14500)); }

function stepStartup(s) {
  const r = s.rs;
  if (s.status === 'public') { stepPublic(s); return; }
  if (s.status !== 'private') return;
  const h = G.hold[s.id], held = h && h.status === 'active';
  // operating
  s.gMod += -0.05 * s.gMod + rg(r, 0, 0.006);
  let g = growthMo(s);
  if (rc(r, 0.0025)) s.gMod -= rr(r, 0.015, 0.04); // a bad quarter: competitor, churn, reorg
  if (G.week < s.stallUntil) g = Math.min(g, 0);
  const gw = g / 4.345 + rg(r, 0, 0.01);
  if (s.mrr < 400 && s.done < 1) s.mrr += rr(r, 0, 60) * Math.max(0, g * 8); // pre-revenue trickle
  else s.mrr = Math.max(0, s.mrr * (1 + gw));
  if (gw > 0) s.expense *= 1 + (s.mrr > s.expense * 0.8 ? 0.9 : 0.5) * gw;
  if (gw < 0.004 && s.mrr > 100e3) s.expense += (s.mrr * 0.92 - s.expense) * 0.06; // growth stalled: management cuts to break-even
  s.expense = Math.max(s.expense, s.mrr * 0.35);
  s.cash -= netBurn(s) / 4.345;
  // fundraising state machine
  if (s.round) {
    if (!s.round.taken && G.week >= s.round.end) resolveRound(s);
  } else if (s.done < 9) {
    const rw_ = runwayMo(s);
    const strong = perceivedRatio(s, s.done + 1) > 1.6 && rw_ < 15 && rc(r, 0.03);
    if (rw_ < 7 || strong) startRaise(s);
  }
  if (s.status !== 'private') return;
  if (s.cash <= 0 && !s.round) { collapse(s, 'ran out of cash'); return; }
  if (s.cash <= -netBurn(s) && s.round) { collapse(s, 'ran out of cash mid-raise'); return; }
  // random hazards
  if (!held && rc(r, 0.0004)) { collapse(s, 'imploded'); return; }
  // exit interest
  if (s.done >= 2) exitInterest(s, h, held);
  // fraud reveal
  if (held && h.fraudAt && G.week >= h.fraudAt && !h.fraudDone) {
    h.fraudDone = true; pushEvent('fraud', s.id);
  }
}

function startRaise(s) {
  const k = s.done + 1;
  if (k > 9) return;
  openRound(s, k, false);
  const h = G.hold[s.id];
  if (h && h.status === 'active') {
    const rd = s.round;
    if (h.prorata || h.rel >= 55) pushEvent('followon', s.id, { k });
    else logMsg(`${s.name} is raising ${stageName(k)} — the founder didn't offer you an allocation.`, 'warn');
  } else {
    const l = G.ledger.find(x => x.sid === s.id);
    if (l && !G.deals.some(d => d.sid === s.id && d.status === 'open') && rc(G.rng, 0.6) && s.status === 'private') {
      const d = makeDeal(s, 'resurface'); d.col = 0;
      logMsg(`${s.name} (you passed earlier) is back, raising ${stageName(k)}.`, 'info');
    }
  }
}

function resolveRound(s) {
  const rd = s.round, k = rd.stage, r = s.rs;
  const M = MACRO[G.macro.regime];
  const ratio = perceivedRatio(s, k);
  const z = 3 * Math.log(Math.max(0.05, ratio)) + 1.0 + 0.9 * sectorHeat(s.sector) + M.raise + rd.signal + rd.prep + 0.25 * rd.rivals.length - 0.7 * s.fails - (rd.rivals.length ? 0 : 0.3);
  const h = G.hold[s.id], held = h && h.status === 'active';
  if (rf(r) >= sigmoid(z)) { failRaise(s, ratio); return; }
  let pre = fairPre(s, k) * rr(r, 0.93, 1.1);
  if (ratio < 0.6 && s.rounds.length) pre = Math.min(pre, lastPost(s) * rr(r, 0.55, 0.9));
  if (rd.safe) pre *= 1.05;
  const best = rd.rivals.slice().sort((a, b) => b.u - a.u)[0];
  const lead = best ? best.name : (held ? 'Insider-led' : 'Strategic angels');
  const mine = [];
  if (held && rd.mySlice > 0 && !rd.safe) {
    const amt = payFollowOn(rd.mySlice);
    if (amt > 0) mine.push({ invested: amt, pref: '1x', anti: 'wa' });
  } else if (held && rd.mySlice > 0 && rd.safe) {
    const amt = payFollowOn(rd.mySlice);
    if (amt > 0) mine.push({ invested: amt, disc: 0 });
  }
  const prevMark = held ? holdingMark(h) : 0;
  const rec = closeRound(s, { pre, raise: rd.raise, lead, poolPct: 0.10, mine, safeRound: rd.safe });
  if (best) { G.rivalWins = G.rivalWins || {}; G.rivalWins[best.id] = (G.rivalWins[best.id] || 0) + 1; }
  // pipeline fallout
  for (const d of dealsOf(s.id)) endDeal(d, 'lost', `${lead} closed the round`);
  if (held) {
    const up = !rec.down;
    const mark = holdingMark(h);
    logMsg(`${s.name} closed ${stageName(k)}${rec.safe ? ' (SAFE)' : ''}: ${fm(rec.raise)} at ${fm(rec.post)} post, led by ${lead}.${rec.down ? ' DOWN ROUND.' : ''}`, rec.down ? 'bad' : 'good');
    if (up) { G.rep = Math.min(100, G.rep + (h.lead ? 0.35 : 0.15)); if (mark > h.invested * 3) G.net += 0.2; }
    if (rec.down && s.antiTriggered) { s.antiTriggered = false; pushEvent('antidil', s.id); }
    if (mine.length) G.net += 0.5;
  }
  s.stallUntil = 0;
}

function payFollowOn(amt) {
  amt = Math.min(amt, Math.max(0, uncalled() + G.fundCash - annualFee() / 52 * weeksLeft() * 0.5));
  if (amt <= 0) return 0;
  const fromRes = Math.min(G.reserveLeft, amt);
  G.reserveLeft -= fromRes;
  callCapital(amt, 'inv');
  return amt;
}

function failRaise(s, ratio) {
  s.round = null; s.fails++;
  const h = G.hold[s.id], held = h && h.status === 'active';
  for (const d of dealsOf(s.id)) endDeal(d, 'lost', 'round fell apart');
  const rw_ = runwayMo(s);
  if (rw_ > 3.2 && s.fails < 3) { // try again shortly
    s.retryOk = true; return;
  }
  if (held) {
    if (ratio > 0.3 && s.fails < 3 && rc(G.rng, 0.6)) pushEvent('downround', s.id, { ratio });
    else pushEvent('runway', s.id);
  } else npcCrisis(s, ratio);
}

function npcCrisis(s, ratio) {
  const r = s.rs;
  if (s.fails < 3 && rc(r, 0.4)) { // insider bridge
    s.cash += s.expense * 4; s.distress = 0.7; s.stallUntil = G.week + 4; return;
  }
  if (rc(r, 0.45)) { npcSale(s, acqhireEV(s), 'acqui-hired'); return; }
  collapse(s, 'ran out of runway');
}
function npcSale(s, ev, why) {
  s.status = 'acquired'; s.exitEV = ev; s.exitW = G.week; s.exitWhy = why;
  for (const d of dealsOf(s.id)) endDeal(d, 'lost', why);
}

// a company dies
function collapse(s, why) {
  const h = G.hold[s.id];
  s.status = 'dead'; s.deadW = G.week; s.deadWhy = why; s.round = null;
  for (const d of dealsOf(s.id)) endDeal(d, 'lost', 'company ' + why);
  if (h && h.status === 'active') {
    const EV = Math.max(0, s.cash) * 0.4;
    const pay = exitPayout(s, h, EV);
    writeOff(h, pay, why);
  }
}
function writeOff(h, recovered, why) {
  const s = G.startups[h.sid];
  if (recovered > 0) distribute(recovered);
  h.realized += recovered; h.status = 'written-off'; h.exitW = G.week;
  G.stats.writeoffs++;
  G.rep = Math.max(0, G.rep - 0.25);
  G.lpTrust = Math.max(0, G.lpTrust - Math.min(3, (h.invested - recovered) / G.size * 15));
  const loss = h.invested - recovered;
  logMsg(`${s.name} ${why || 'shut down'}. You lose ${fm(loss)} (${recovered > 0 ? 'recovered ' + fm(recovered) : 'nothing recovered'}).`, 'bad');
  G.realizedLog.push({ sid: h.sid, name: s.name, invested: h.invested, got: h.realized, w: G.week, kind: 'writeoff' });
}

// ------------------------------------------------------------------ exits
function exitMult(s) {
  const M = MACRO[G.macro.regime];
  const base = [4, 6, 9, 10.5, 11.5, 12.5][Math.min(5, s.done)];
  return base * Math.pow(SECTOR_BY_ID[s.sector].em, 0.7) * M.exit * (1 + 0.25 * sectorHeat(s.sector)) * (s.breakout ? 1.25 : 1) * clamp(0.8 + 4 * growthMo(s), 0.7, 1.7);
}
function exitInterest(s, h, held) {
  const r = s.rs, a = arr(s);
  if (a < 0.5e6) return;
  // IPO window
  const M = MACRO[G.macro.regime];
  if (s.done >= 3 && a > 35e6 && M.ipo > 0) {
    const p = M.ipo * 0.02 * clamp(a / 60e6, 0.5, 2) * (1 + sectorHeat(s.sector));
    if (rc(r, p)) {
      const ev = a * 14 * M.exit * rr(r, 0.85, 1.3) * (s.breakout ? 1.3 : 1) * (1 + 0.3 * sectorHeat(s.sector)) * clamp(0.8 + 4 * growthMo(s), 0.7, 1.7);
      if (held) { if (!pendingOffer(s.id)) pushEvent('exitoffer', s.id, { kind: 'ipo', ev, cash: false }); }
      else goPublic(s, ev, 0.04);
      return;
    }
  }
  // M&A
  const p = 0.0022 * (1 + Math.max(0, sectorHeat(s.sector))) * (a > 3e6 ? 1.4 : 0.7) * (s.done >= 4 ? 1.3 : 1);
  if (rc(r, p)) {
    const ev = a * exitMult(s) * rr(r, 0.85, 1.3);
    if (ev < 0.6 * equityMark(s)) return;
    if (held) {
      if (pendingOffer(s.id)) return;
      const cash = rc(r, 0.62), opposes = rc(r, 0.3);
      if (opposes && !h.board) { logMsg(`An acquirer approached ${s.name} at ${fm(ev)}; the founder turned it down. (A board seat would have given you a vote.)`, 'warn'); return; }
      pushEvent('exitoffer', s.id, { kind: 'ma', ev, cash, opposes });
    } else if (rc(r, 0.6)) npcSale(s, ev, 'acquired');
  }
}
function pendingOffer(sid) { return G.queue.some(e => e.type === 'exitoffer' && e.sid === sid); }

function goPublic(s, ev, vol) {
  s.status = 'public'; s.mcap = ev; s.ipoW = G.week; s.vol = vol || 0.04; s.mcap0 = ev;
  for (const d of dealsOf(s.id)) endDeal(d, 'lost', 'went public');
  s.round = null;
}
function stepPublic(s) {
  const M = MACRO[G.macro.regime];
  const r = s.rs;
  s.mcap *= Math.exp(M.drift + 0.0006 * (s.q - 50) / 50 + rg(r, 0, s.vol || 0.04));
  const h = G.hold[s.id];
  if (!h || h.status !== 'active') { if (G.week - (s.ipoW || 0) > 30) s.status = 'exited'; }
}
function publicValue(h) { const s = G.startups[h.sid]; return s.mcap * ownPct(s, h) * (h.stockDeal ? 1 : 1); }

// realise a holding (accept an acquisition offer or sale)
function sellHolding(h, EV, label) {
  const s = G.startups[h.sid];
  const pay = exitPayout(s, h, EV);
  distribute(pay);
  h.realized += pay; h.status = 'exited'; h.exitW = G.week;
  s.status = 'acquired'; s.exitEV = EV; s.exitW = G.week;
  finishExit(h, pay, label);
  return pay;
}
function finishExit(h, pay, label) {
  const s = G.startups[h.sid];
  const moic = h.realized / Math.max(1, h.invested);
  G.stats.exits++; G.stats.bestMoic = Math.max(G.stats.bestMoic, moic);
  if (moic > 10) G.rep = Math.min(100, G.rep + 5); else if (moic > 3) G.rep = Math.min(100, G.rep + 2); else if (moic > 1.2) G.rep = Math.min(100, G.rep + 0.7);
  G.realizedLog.push({ sid: h.sid, name: s.name, invested: h.invested, got: h.realized, w: G.week, kind: label || 'exit' });
  logMsg(`${label || 'Exit'}: ${s.name} — ${fm(h.invested)} → ${fm(h.realized)} (${fx(moic, 1)}).`, moic >= 1 ? 'good' : 'bad');
  for (const d of dealsOf(s.id)) endDeal(d, 'lost', 'sold');
}

// ------------------------------------------------------------------ deals
function makeDeal(s, channel) {
  const d = { id: G.nextDeal++, sid: s.id, col: 0, status: 'open', channel, w0: G.week, movedW: -1, tools: {}, notes: [], stage: s.round ? s.round.stage : s.done + 1, ask: s.round ? s.round.ask : 0, ts: null, marketChecked: false, hq: {}, cust: 0 };
  G.deals.push(d); G.stats.sourced++;
  return d;
}
function genQ(channel) {
  switch (channel) {
    case 'referral': return rg(G.wr, 62, 11);
    case 'scout': return rg(G.wr, 55, 12);
    case 'cold': return rg(G.wr, 40, 15);
    case 'hot': return rg(G.wr, 82, 5);
    default: return rg(G.wr, 44, 14);
  }
}
const STAGE_W = [0.36, 0.34, 0.17, 0.08, 0.035, 0.015];
function sourceDeal(channel, opts) {
  opts = opts || {};
  const t = G.thesis, bias = biasFactor();
  let sector = opts.sector;
  if (!sector) {
    if (rc(G.wr, 0.5 * bias) && t.sectors.length) sector = rp(G.wr, t.sectors);
    else sector = rw(G.wr, SECTORS, x => 1 + Math.max(-0.6, sectorHeat(x.id))).id;
  }
  let stage = opts.stage;
  if (stage == null) {
    if (rc(G.wr, (channel === 'cold' ? 0.8 : 0.55) * bias)) stage = ri(G.wr, t.smin, t.smax);
    else stage = rw(G.wr, [0, 1, 2, 3, 4, 5], i => STAGE_W[i]);
  }
  let city = opts.city;
  if (!city) {
    if (t.geo === 'local' && rc(G.wr, 0.35 * bias)) city = G.home;
    else if (t.geo === 'region' && rc(G.wr, 0.3 * bias)) { const same = CITIES.filter(c => c.region === CITY_BY_ID[G.home].region); city = rp(G.wr, same).id; }
    else city = pickCity(G.wr, bias);
  }
  const q = opts.q != null ? opts.q : genQ(channel);
  const kk = G.week + ':' + channel; G.gc[kk] = (G.gc[kk] || 0) + 1;
  const s = genStartup({ q, sector, stage, city, fast: channel === 'hot', key: kk + ':' + G.gc[kk] });
  if (channel === 'hot') { // guarantee competition
    const f = RIVALS.filter(x => stage >= x.stages[0] && stage <= x.stages[1])[0];
    if (f && s.round.rivals.length < 2) { const fair = s.round.fair; s.round.rivals.push({ id: f.id, name: f.name, u: (f.brand - 50) / 50 + 3.2 * Math.log(1 + f.pay) - 0.1 + f.friendly * 0.8 + f.speed * 0.4 + f.va * 0.4, pre: fair * (1 + f.pay) }); }
  }
  const d = makeDeal(s, channel);
  if (channel === 'referral') d.referrer = rp(G.wr, ['a co-investor', 'a portfolio founder', 'an old colleague', 'an LP', 'a scout in your network', 'your barber (really)']);
  return d;
}

function sourcingWeek() {
  const nIn = rpois(G.wr, 2.1 + G.rep / 30);
  for (let i = 0; i < nIn; i++) sourceDeal('inbound');
  const refP = clamp(0.12 + G.net / 160 + (G.founderRel - 50) / 400, 0.05, 0.7);
  if (rc(G.wr, refP)) sourceDeal('referral');
  if (G.net > 40 && rc(G.wr, 0.12)) sourceDeal('referral');
  for (const sec of G.staff.scouts) if (rc(G.wr, 0.35)) sourceDeal('scout', { sector: sec });
  // hot deal
  if (G.week > 6 && rc(G.wr, 0.012 + G.rep / 4000)) {
    const d = sourceDeal('hot', { stage: clamp(ri(G.wr, G.thesis.smin, G.thesis.smax), 0, 5), sector: G.thesis.sectors.length ? rp(G.wr, G.thesis.sectors) : undefined, city: G.home });
    d.col = 1; d.hotUntil = G.week + 2;
    const s = G.startups[d.sid]; know(s, 'P', s.h.P + rg(G.rng, 0, 16), 16); know(s, 'F', s.h.F + rg(G.rng, 0, 16), 16);
    toast(`Hot deal: ${s.name} is raising and moving fast — 2 weeks.`, 'warn');
    logMsg(`HOT DEAL: ${s.name} (${SECTOR_BY_ID[s.sector].name}) — round closes in ~2 weeks, rivals circling.`, 'warn');
  }
}

function pipelineWeek() {
  for (const d of G.deals) {
    if (d.status !== 'open') continue;
    const s = G.startups[d.sid];
    if (!s || s.status !== 'private' || !s.round) { endDeal(d, 'lost', 'round closed'); continue; }
    const age = G.week - d.w0;
    if (d.col === 0 && age >= 5) { endDeal(d, 'expired', 'went stale'); continue; }
    // preemption
    const k = s.round.rivals.length;
    if (k && d.col >= 1 && !s.round.taken && rc(G.rng, 0.012 * k * (d.col >= 3 ? 1.4 : 1))) {
      const rv = s.round.rivals[0];
      endDeal(d, 'lost', `${rv.name} preempted`);
      s.round.end = Math.min(s.round.end, G.week + 1);
      logMsg(`${rv.name} preempted ${s.name} before you could move.`, 'warn');
      continue;
    }
    if (d.col === 4 && d.tsDeadline != null && G.week > d.tsDeadline) {
      endDeal(d, 'lost', 'term sheet window closed');
      s.round.end = Math.min(s.round.end, G.week + 1);
      logMsg(`${s.name}: your term sheet window closed — the founder signed elsewhere.`, 'warn');
    }
  }
  if (G.deals.length > 400) G.deals = G.deals.filter(d => d.status === 'open' || G.week - (d.endW || 0) < 40);
}

// ------------------------------------------------------------------ macro / heat
function updateHeat() {
  for (const sec of SECTORS) {
    G.heatOu[sec.id] = G.heatOu[sec.id] * 0.97 + rg(G.wr, 0, 0.035);
    G.heat[sec.id] = sectorHeatAt(sec, G.week, G.heatOu[sec.id]);
  }
}
function updateMacro() {
  const row = MACRO_TRANS[G.macro.regime];
  const x = rf(G.wr); let acc = 0;
  for (const k of Object.keys(row)) { acc += row[k]; if (x <= acc) { if (k !== G.macro.regime) { logMsg(`Macro regime shifts: ${MACRO[k].name}. Rates ${MACRO[k].rate}.`, k === 'bull' ? 'good' : k === 'normal' ? 'info' : 'warn'); G.macro = { regime: k, since: G.week }; } break; }
  }
}

// ------------------------------------------------------------------ the weekly tick
function personalWeekly() {
  const fee = annualFee() / 52;
  return fee - (LIVING_COST_YR + (G.car ? CAR_COST_YR : 0) + G.staff.analysts * ANALYST_YR + G.staff.scouts.length * SCOUT_YR) / 52;
}
function activeHoldings() { return Object.values(G.hold).filter(h => h.status === 'active'); }
function boardSeats() { return activeHoldings().filter(h => h.board).length; }

function advanceWeek() {
  if (G.over) return;
  const w = G.week;
  G.wr = mkrng(hashStr(G.seed + ':wk:' + w)); // world stream: heat, macro and sourcing are independent of what you do
  // money
  if (w < FUND_WEEKS) callCapital(annualFee() / 52, 'fee');
  G.cash += personalWeekly();
  if (G.cash < 0) {
    if (G.car) { G.car = false; logMsg('Personal cash ran dry: the car lease was cancelled.', 'bad'); }
    else if (G.staff.scouts.length) { G.staff.scouts.pop(); logMsg('Personal cash ran dry: a scout was let go.', 'bad'); }
    else if (G.staff.analysts) { G.staff.analysts--; logMsg('Personal cash ran dry: an analyst was let go.', 'bad'); }
  }
  // world
  updateHeat();
  if (w > 0 && w % 13 === 0) updateMacro();
  const ids = Object.keys(G.startups);
  for (const id of ids) stepStartup(G.startups[id]);
  pipelineWeek();
  if (!G.noSource) sourcingWeek();
  rollEvents();
  // board load
  G.boardAcc = (G.boardAcc || 0) + boardSeats() / 6.5;
  let boardAP = 0; while (G.boardAcc >= 1) { boardAP++; G.boardAcc -= 1; }
  G.apDebt += boardAP;
  // quarterly
  if ((w + 1) % 13 === 0) quarterly();
  if (w % 4 === 3) { recordHistory(); G.heatHist.push({ w, h: SECTORS.map(x => G.heat[x.id]) }); }
  // prune
  if (w % 26 === 25) pruneStartups();
  G.week++;
  G.recentToastsCleared = 0;
  if (G.week >= FUND_WEEKS) { G.over = true; finalizeFund(); return; }
  const debt = Math.min(G.apDebt, AP_BASE - 3);
  G.ap = AP_BASE - debt; G.apDebt = Math.max(0, G.apDebt - debt);
  for (const d of G.deals) d.apNote = 0;
}

function pruneStartups() {
  const keep = new Set();
  for (const d of G.deals) if (d.status === 'open') keep.add(d.sid);
  for (const k of Object.keys(G.hold)) keep.add(+k);
  for (const l of G.ledger) keep.add(l.sid);
  for (const id of Object.keys(G.startups)) {
    if (keep.has(+id)) continue;
    const s = G.startups[id];
    if (s.status === 'private' && !s.round) continue;
    if (s.status === 'private' && s.round && !s.round.taken) { // un-sourced company still alive: keep simulating a while (cheap)
      if (G.week - s.born < 150) continue;
    }
    delete G.startups[id];
  }
}

function quarterly() {
  // portfolio updates
  for (const h of activeHoldings()) {
    const s = G.startups[h.sid];
    if (s.status !== 'private') continue;
    const growth = s.h.P > 0 ? growthMo(s) : 0;
    const spinning = growth < 0.025 || runwayMo(s) < 8;
    const dish = (100 - s.h.I) / 100;
    const spin = spinning ? dish * (h.board ? 0.18 : 0.45) * (0.6 + 0.8 * hashStr(s.id + ':' + G.week) / 4294967295) : 0;
    s.report = { w: G.week, mrr: s.mrr * (1 + spin), burn: netBurn(s) * (1 - spin * 0.5), runway: runwayMo(s) * (1 + spin * 0.8), hc: headcount(s) * (1 + spin * 0.6), spun: spin > 0.06 };
    G.reportsLog = G.reportsLog || [];
  }
  const m = fundMetrics();
  const d = dateOf(G.week);
  const expected = 0.88 + 0.2 * (G.week / 52);
  let dTrust = clamp((m.tvpi - expected) * 3, -2.5, 2.5);
  if (driftLevel() > 0.3) dTrust -= 1.5;
  if (G.week < 26) dTrust = Math.max(dTrust, 0);
  G.lpTrust = clamp(G.lpTrust + dTrust, 0, 100);
  G.reports.push({ w: G.week, q: d.q, year: d.fy, tvpi: m.tvpi, dpi: m.dpi, irr: m.irr, nav: m.nav, trust: G.lpTrust, drift: driftLevel() });
  logMsg(`Q${d.q} LP report sent — TVPI ${fx(m.tvpi)}, DPI ${fx(m.dpi)}. LP trust ${Math.round(G.lpTrust)}.`, 'info');
  // staff thinking about leaving? (kept simple)
}

// ------------------------------------------------------------------ random events
function rollEvents() {
  const hs = activeHoldings();
  for (const h of hs) {
    const s = G.startups[h.sid];
    if (s.status !== 'private') continue;
    if (G.queue.some(e => e.sid === h.sid)) continue;
    if (!rc(G.rng, 0.010)) continue;
    const opts = [
      ['cofounder', 1.0 + clamp((60 - s.h.F) / 35, -0.6, 1.5)],
      ['custlost', s.mrr > 40e3 ? 0.9 : 0.1],
      ['competitor', 0.8],
      ['regulatory', (s.sector === 'fin' || s.sector === 'health') ? 1.3 : 0.2],
      ['poach', s.done >= 1 ? 0.7 : 0.1],
      ['scandal', clamp(0.25 + (55 - s.h.I) / 50, 0.05, 1.2)],
      ['acquihire', (s.h.P < 48 && s.done <= 2 && s.mrr < 1e6) ? 0.9 : 0.05],
    ];
    const pick = rw(G.rng, opts, o => o[1])[0];
    pushEvent(pick, s.id);
  }
  if (G.week > 52 && rc(G.rng, 0.006)) pushEvent('lpliquidity', 0);
  if (G.week > 20 && rc(G.rng, 0.006) && hs.length) pushEvent('leak', hs[Math.floor(rf(G.rng) * hs.length)].sid);
}

function finalizeFund() {
  G.over = true;
  const m = fundMetrics(true);
  G.final = m;
  recordHistory();
}
