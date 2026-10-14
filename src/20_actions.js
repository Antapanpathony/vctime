// ============================================================================
// ACTIONS: everything the player can spend AP on
// All return {ok:bool, msg:string,...}; UI shows msg as a toast on failure.
// ============================================================================

const COL_NAMES = ['Sourced', 'Screened', 'Meeting', 'Diligence', 'Term sheet'];
const TOOL_INFO = {
  data: { name: 'Data room', ap: COST.data, cash: 0, desc: 'Revenue, burn, growth. Founders can window-dress it.' },
  refs: { name: 'Founder references', ap: COST.refs, cash: 0, desc: 'Integrity and team dynamics. References are hand-picked.' },
  cust: { name: 'Customer calls', ap: COST.cust, cash: 0, desc: 'Real product-market fit. Up to 3 rounds of calls.' },
  tech: { name: 'Technical expert', ap: COST.tech, cash: CASHCOST.tech, desc: 'Paid expert: does the tech actually work?' },
  bg:   { name: 'Background check', ap: COST.bg, cash: CASHCOST.bg, desc: 'Fraud history, litigation, odd corporate filings.' },
};
const TOOL_ORDER = ['data', 'refs', 'cust', 'tech', 'bg'];

const fail = msg => ({ ok: false, msg });
const okr = (msg, extra) => Object.assign({ ok: true, msg }, extra || {});
function spendAp(n) { if (G.ap < n) return false; G.ap -= n; return true; }
function dealStartup(d) { return G.startups[d.sid]; }
function note(d, tag, text, kind) { d.notes.push({ w: G.week, tag, text, kind: kind || 'info' }); }
function opexCall(amt) { if (amt > 0) callCapital(amt, 'opex'); }

// ---------------------------------------------------------------- pipeline moves
function gateRep(d) {
  const s = dealStartup(d);
  return Math.max(0, Math.round((s.q - 68) * 1.6 - (d.channel === 'referral' ? 12 : 0)));
}
function advanceCost(d) { return [COST.screen, COST.meet, COST.dd, COST.ts][d.col] || 0; }
function canAdvance(d) {
  if (d.status !== 'open') return fail('Deal is closed.');
  if (d.col >= 4) return fail('Already at term sheet.');
  const s = dealStartup(d);
  if (!s || !s.round) return fail('The round has closed.');
  if (G.ap < advanceCost(d)) return fail(`Needs ${advanceCost(d)} AP.`);
  if (d.movedW === G.week && !(d.hotUntil && G.week <= d.hotUntil)) return fail('Founders need a week to respond — try next turn.');
  if (d.col === 1 && G.rep < gateRep(d)) return fail(`Founder won't take your call yet (needs reputation ${gateRep(d)}; you have ${Math.round(G.rep)}).`);
  if (d.col === 3 && G.week > s.round.end) return fail('Round is closing.');
  return { ok: true };
}
function advanceDeal(d) {
  const c = canAdvance(d); if (!c.ok) return c;
  const s = dealStartup(d);
  spendAp(advanceCost(d));
  d.movedW = G.week;
  if (d.col === 0) {
    know(s, 'P', s.h.P + (s.dress * 50) + rg(G.rng, 0, 30 * noiseMult()), 30);
    know(s, 'T', s.h.T + rg(G.rng, 0, 26 * noiseMult()), 26);
    know(s, 'F', s.h.F + rg(G.rng, 0, 28 * noiseMult()), 28);
    d.col = 1;
    note(d, 'Deck', `Skimmed the deck: ${s.pitch}. ${thesisFit(s).ok ? 'Squarely on-thesis.' : 'Off-thesis — would count as drift.'}`);
  } else if (d.col === 1) {
    observe(s, 'F', 16); observe(s, 'I', 30); observe(s, 'T', 24);
    d.col = 2;
    note(d, 'Meeting', `Met ${s.founder.name}. ${s.founder.quirk}.`);
  } else if (d.col === 2) {
    d.col = 3;
    note(d, 'Diligence', 'Diligence started — the toolkit is open.');
  } else if (d.col === 3) {
    d.col = 4;
    d.ts = defaultTerms(d);
    const k = s.round.rivals.length;
    d.tsDeadline = Math.min(s.round.end, G.week + (k >= 2 ? 1 : k === 1 ? 2 : 3));
    note(d, 'Term sheet', `Preparing a term sheet. Window closes in ${Math.max(0, d.tsDeadline - G.week)} week(s).`);
  }
  return okr(`${s.name} → ${COL_NAMES[d.col]}`);
}
function passDeal(d, why) {
  if (d.status !== 'open') return fail('Deal is closed.');
  endDeal(d, 'passed', why || 'you passed');
  return okr('Passed.');
}

// ---------------------------------------------------------------- diligence
function diligenceCoverage(d) {
  let n = 0;
  if (d.tools.data) n++; if (d.tools.refs) n++; if (d.tools.cust) n++; if (d.tools.tech) n++; if (d.tools.bg) n++;
  if (Object.keys(d.hq).length) n++;
  return n / 6;
}
function toolAvailable(d, tool) {
  const t = TOOL_INFO[tool];
  if (d.status !== 'open') return fail('Deal is closed.');
  if (d.col < 3) return fail('Move the deal to Diligence first.');
  if (tool === 'cust') { if ((d.tools.cust || 0) >= 3) return fail('You have already run three rounds of customer calls.'); }
  else if (d.tools[tool]) return fail('Already done.');
  if (G.ap < t.ap) return fail(`Needs ${t.ap} AP.`);
  if (t.cash > uncalled() + G.fundCash - annualFee() / 52 * weeksLeft() * 0.8) return fail('The fund cannot cover this expense.');
  return { ok: true };
}
function useTool(d, tool) {
  const c = toolAvailable(d, tool); if (!c.ok) return c;
  const s = dealStartup(d), t = TOOL_INFO[tool];
  spendAp(t.ap); opexCall(t.cash);
  const dish = (100 - s.h.I) / 100;
  if (tool === 'data') {
    d.tools.data = 1;
    const rm = s.mrr * (1 + s.dress), rg_ = growthMo(s) + s.dress * 0.35, nb = netBurn(s) * (1 - s.dress * 0.5);
    const cash = s.cash * (1 + s.dress * 0.15), run = nb > 1 ? cash / nb : 99;
    d.reported = { mrr: rm, g: rg_, burn: nb, cash, runway: run, hc: Math.round(headcount(s) * (1 + s.dress * 0.7)) };
    observe(s, 'B', 12, -s.dress * 20);
    know(s, 'P', s.h.P + s.dress * 60 + rg(G.rng, 0, 18 * noiseMult() * fitMult(s)), 18);
    note(d, 'Data room', `Reported MRR ${fm(rm)} (${rg_ >= 0 ? '+' : ''}${(rg_ * 100).toFixed(1)}%/mo), net burn ${fm(nb)}/mo, cash ${fm(cash)} → ${run > 60 ? '60+' : run.toFixed(0)} months runway. Headcount ${d.reported.hc}.`);
  } else if (tool === 'refs') {
    d.tools.refs = 1;
    const f = observe(s, 'F', 14, dish * 10), i = observe(s, 'I', 16, dish * 14);
    const lines = [];
    lines.push(f > 65 ? 'References rave about the founder\'s speed and judgment.' : f > 45 ? 'References call the founder "solid, still learning".' : 'References are lukewarm — lots of diplomatic pauses.');
    lines.push(i > 65 ? 'Everyone says they are straight with people.' : i > 45 ? 'Nobody flagged honesty concerns, but nobody volunteered praise either.' : 'One reference asked not to be quoted. That is a quote.');
    note(d, 'References', lines.join(' '));
  } else if (tool === 'cust') {
    d.tools.cust = (d.tools.cust || 0) + 1;
    const uses = d.tools.cust;
    const p = observe(s, 'P', 16 / (1 + 0.25 * (uses - 1)), s.dress * 25), tm = observe(s, 'T', 24);
    const pct = Math.round(clamp(p * 0.62 + rg(G.rng, 0, 3), 3, 75));
    note(d, `Customers #${uses}`, `"Very disappointed if it disappeared": ${pct}% of the users you reached. ${pct > 40 ? 'That is a real signal.' : pct > 25 ? 'Warm, not on fire.' : 'Most would shrug.'}`);
  } else if (tool === 'tech') {
    d.tools.tech = 1;
    const x = observe(s, 'X', 10);
    note(d, 'Tech expert', x > 65 ? 'Expert: "Real engineering. The architecture holds up."' : x > 45 ? 'Expert: "Works, but there is duct tape. A lot of duct tape."' : 'Expert: "The demo is smoke and mirrors. Parts of it are a screen recording."');
  } else if (tool === 'bg') {
    d.tools.bg = 1;
    const found = s.fraud ? rc(G.rng, 0.74) : rc(G.rng, 0.04);
    d.bg = found ? 'flags' : 'clean';
    if (found) { know(s, 'I', Math.min(s.h.I, 18) + rg(G.rng, 0, 6), 8); note(d, 'Background', s.fraud ? 'FLAGS: a prior venture wound up amid investor complaints, and an old regulatory filing mentions the founder by name.' : 'Flags: a civil dispute with a former cofounder — outcome unclear.', 'bad'); }
    else { know(s, 'I', Math.max(s.h.I, 55) + rg(G.rng, 0, 12), 20); note(d, 'Background', 'No red flags found in filings, litigation or corporate records.', 'good'); }
  }
  return okr(`${t.name}: done.`);
}

function travelInfo(city) {
  const rel = cityRelation(city);
  if (rel === 'local') return { rel, ap: G.car ? COST.hqLocal - 1 : COST.hqLocal, debt: 0, label: 'Local' };
  if (rel === 'region') return { rel, ap: COST.hqRegion, debt: 0, label: 'Regional flight' };
  return { rel, ap: COST.hqFar, debt: 4, label: 'Intercontinental' };
}
const HQ_FOCUS = {
  team: { name: 'Read the team', stat: 'F', desc: 'Culture, morale, who is actually at their desk.' },
  board: { name: 'Study the whiteboard', stat: 'B', desc: 'The burn plan, the runway countdown.' },
  qa: { name: 'Ask the awkward question', stat: 'I', desc: 'Watch the founder squirm — or not.' },
  demo: { name: 'Demand a live demo', stat: 'X', desc: 'Does the product work without a script?' },
};
function hqAvailable(d, focus) {
  if (d.status !== 'open') return fail('Deal is closed.');
  if (d.col < 3) return fail('Move the deal to Diligence first.');
  if (d.hq[focus]) return fail('You already looked into that.');
  const s = dealStartup(d), ti = travelInfo(s.city);
  if (G.ap < ti.ap) return fail(`Needs ${ti.ap} AP.`);
  return { ok: true };
}
function hqVisit(d, focus) {
  const c = hqAvailable(d, focus); if (!c.ok) return c;
  const s = dealStartup(d), ti = travelInfo(s.city), F = HQ_FOCUS[focus];
  spendAp(ti.ap);
  let extra = '';
  if (ti.debt) { G.apDebt += ti.debt; if (rc(G.rng, 0.15)) { G.apDebt += 2; extra = ' (Flight delayed: you lose 2 more AP next turn.)'; } }
  const obs = observe(s, F.stat, 7);
  for (const st2 of ['F', 'B', 'I', 'X']) if (st2 !== F.stat) observe(s, st2, 26); // you see the whole office, but only study one thing closely
  d.hq[focus] = 1;
  d.hqReal = headcount(s);
  d.hqSeed = (d.hqSeed || 0) + hashStr(focus) % 1000;
  if (focus === 'demo') observe(s, 'P', 20);
  const real = headcount(s);
  let txt = '';
  if (focus === 'team') txt = obs > 62 ? 'Desks are full, people are arguing about product — the good kind.' : obs > 42 ? 'A decent team; a couple of empty chairs and a lot of Slack notifications.' : 'Half the desks are empty and nobody will say why.';
  if (focus === 'board') txt = `Whiteboard: "RUNWAY ${runwayMo(s) > 40 ? '40+' : runwayMo(s).toFixed(0)} MO" in the corner. Burn plan is ${obs > 62 ? 'tight and annotated' : obs > 42 ? 'plausible' : 'a column of question marks'}.`;
  if (focus === 'qa') txt = obs > 62 ? 'The founder answers the awkward question directly, then volunteers a worse one.' : obs > 42 ? 'The founder answers most of it; changes the subject once.' : 'The founder deflects three times and asks if you want coffee.';
  if (focus === 'demo') txt = obs > 62 ? 'The live demo works, including the thing you asked them to try.' : obs > 42 ? 'The demo works after one restart.' : 'The demo crashes; the founder says "it works on my machine".';
  note(d, `HQ visit`, `${txt} Real headcount: ${real}.${extra}`);
  return okr(`HQ visit done (${F.name}).`, { focus });
}
function marketCheck(d) {
  if (d.status !== 'open') return fail('Deal is closed.');
  if (d.marketChecked) return fail('You already asked around.');
  if (d.col < 1) return fail('Screen the deal first.');
  if (!spendAp(COST.market)) return fail(`Needs ${COST.market} AP.`);
  const s = dealStartup(d); d.marketChecked = true;
  const rv = s.round.rivals;
  note(d, 'Market check', rv.length ? `Word on the street: ${rv.map(r => r.name).join(', ')} ${rv.length > 1 ? 'are' : 'is'} circling.` : 'Nobody else seems to be in this round.');
  return okr('You made a few calls.');
}

// ---------------------------------------------------------------- term sheets
function followPre(d) { const rd = dealStartup(d).round; return rd.rivals.length ? Math.max.apply(null, rd.rivals.map(r => r.pre)) : rd.fair * 1.05; }
function checkLimits(d, t) {
  const rd = dealStartup(d).round;
  let lo = Math.max(15000, rd.raise * 0.03), hi;
  if (rd.safe) hi = rd.raise * 0.5;
  else if (t.lead) { lo = Math.max(lo, rd.raise * 0.25); hi = rd.raise * 0.7; }
  else hi = rd.raise * 0.3;
  const funds = Math.max(0, generalPowder());
  return { lo, hi: Math.max(lo, hi), funds, afford: funds >= lo };
}
function defaultTerms(d) {
  const rd = dealStartup(d).round;
  const t = { safe: rd.safe, lead: false, valPct: 1.0, check: 0, board: false, prorata: false, pool: 0.10, pref: '1x', anti: 'wa', mfn: false, disc: 0 };
  const want = G.size * G.thesis.check;
  t.lead = !rd.safe && want >= rd.raise * 0.25;
  const lim = checkLimits(d, t);
  t.check = Math.round(clamp(want, lim.lo, lim.hi) / 5000) * 5000;
  if (t.lead) { t.board = true; t.prorata = true; }
  return t;
}
function termsPreview(d, t) {
  const s = dealStartup(d), rd = s.round;
  let pre, own;
  if (t.safe) { pre = rd.ask * t.valPct; own = t.check / pre; }
  else if (t.lead) { pre = rd.ask * t.valPct; own = t.check / (pre + rd.raise); }
  else { pre = followPre(d); own = t.check / (pre + rd.raise); }
  return { pre, post: pre + (t.safe ? 0 : rd.raise), own, raise: rd.raise };
}
function termUtility(d, t) {
  const s = dealStartup(d), rd = s.round;
  let u = (G.rep - 50) / 50;
  if (t.safe || t.lead) u += 3.2 * Math.log(Math.max(0.2, t.valPct));
  if (t.safe) { u += 0.25; if (t.mfn) u -= 0.1; if (t.disc) u -= 0.12; if (t.prorata) u -= 0.08; }
  else if (t.lead) {
    u += 0.5 * (t.check / rd.raise);
    if (t.board) u -= 0.12; if (t.prorata) u -= 0.1;
    if (t.pref === 'part') u -= 0.9;
    if (t.anti === 'wa') u -= 0.2; else if (t.anti === 'ratchet') u -= 1.3;
    u -= (t.pool * 100 - 10) * 0.05;
  }
  u += 0.5 * Math.max(0, 1 - (G.week - d.w0) / 5);
  u += 0.5 * G.vaScore + (thesisFit(s).ok ? 0.15 : 0);
  if (d.channel === 'referral') u += 0.2;
  return u;
}
function winProb(d, t) {
  const s = dealStartup(d), rd = s.round;
  if (!t.lead && !t.safe) { // following someone else's lead: it's about getting allocation
    const hot = rd.rivals.length;
    return sigmoid(1.0 + (G.rep - 25) / 30 - 0.7 * hot + 0.5 * G.vaScore - 1.2 * (t.check / rd.raise) + (d.channel === 'referral' ? 0.4 : 0));
  }
  const u = termUtility(d, t);
  const best = rd.rivals.length ? Math.max.apply(null, rd.rivals.map(r => r.u)) : -0.9;
  return sigmoid((u - best) / 0.5);
}
function founderMood(p) { return p > 0.8 ? 'Eager' : p > 0.55 ? 'Warm' : p > 0.3 ? 'Lukewarm' : 'Cold'; }

function sendTermSheet(d, t) {
  if (d.status !== 'open') return fail('Deal is closed.');
  if (d.col < 4) return fail('Not at term-sheet stage.');
  const s = dealStartup(d), rd = s.round;
  if (!rd) return fail('The round has closed.');
  const lim = checkLimits(d, t);
  if (t.check < lim.lo - 1 || t.check > lim.hi + 1) return fail('Check size is outside what this round allows.');
  if (t.check > lim.funds + 1) return fail(`Initial-check budget is ${fm(lim.funds)} (the rest is reserved for follow-ons).`);
  if (G.ap < COST.send) return fail(`Needs ${COST.send} AP.`);
  spendAp(COST.send);
  const p = winProb(d, t);
  if (rf(G.rng) < p) return closeDeal(d, t);
  const best = rd.rivals.slice().sort((a, b) => b.u - a.u)[0];
  const who = best ? best.name : 'another investor';
  endDeal(d, 'lost', `founder went with ${who}`);
  rd.end = Math.min(rd.end, G.week + 1);
  logMsg(`${s.name}: the founder chose ${who} over your term sheet.`, 'bad');
  return { ok: true, won: false, msg: `Lost: ${s.name} chose ${who}.` };
}
function closeDeal(d, t) {
  const s = dealStartup(d), rd = s.round, pv = termsPreview(d, t);
  const lead = t.lead || t.safe;
  opexCall(t.safe ? CASHCOST.legalSafe : CASHCOST.legalPriced);
  callCapital(t.check, 'inv');
  rd.taken = true;
  const best = rd.rivals.slice().sort((a, b) => b.u - a.u)[0];
  const leadName = lead ? G.fundName : (best ? best.name : 'Angel syndicate');
  const mine = [{ invested: t.check, pref: t.lead ? t.pref : '1x', anti: t.lead ? t.anti : 'wa', disc: t.disc, mfn: t.mfn }];
  const rec = closeRound(s, { pre: t.safe ? rd.ask * t.valPct : pv.pre, raise: rd.raise, lead: leadName, poolPct: t.lead ? t.pool : 0.10, mine, safeRound: t.safe });
  const h = G.hold[s.id];
  h.board = !!(t.lead && !t.safe && t.board);
  h.prorata = !!t.prorata && (t.lead || t.safe);
  h.lead = lead;
  let rel = 62 + (t.valPct - 1) * 35 + G.vaScore * 8;
  if (t.lead && !t.safe) { if (t.pref === 'part') rel -= 10; if (t.anti === 'ratchet') rel -= 14; else if (t.anti === 'wa') rel -= 2; rel -= (t.pool * 100 - 10) * 0.5; }
  h.rel = clamp(rel, 20, 95);
  h.diligence = diligenceCoverage(d);
  h.stage0 = rd.stage; h.q0 = s.q; h.entryW = G.week; h.entryPost = rec.post;
  if (s.fraud) h.fraudAt = G.week + ri(G.rng, 10, 60);
  G.recent.push(!thesisFit(s).ok); if (G.recent.length > 30) G.recent.shift();
  G.stats.closed++;
  if (lead) G.rep = Math.min(100, G.rep + 0.3);
  if (rd.rivals.length) G.net += 0.4;
  G.founderRel = clamp(sum(activeHoldings(), x => x.rel) / Math.max(1, activeHoldings().length), 0, 100);
  endDeal(d, 'closed', 'invested');
  logMsg(`CLOSED: ${fm(t.check)} into ${s.name} (${stageName(rec.stage)}${t.safe ? ' SAFE' : ''}) — ${fp(pv.own, 1)} for ${fm(rec.post)} ${t.safe ? 'cap' : 'post'}${h.board ? ', board seat' : ''}.`, 'good');
  return { ok: true, won: true, msg: `Closed ${s.name}!` };
}

// ---------------------------------------------------------------- portfolio help
const HELP_INFO = {
  intro: { name: 'Investor intros', ap: COST.help.intro, desc: 'Warm intros to next-round investors: makes the next raise easier.' },
  hire:  { name: 'Hiring help', ap: COST.help.hire, desc: 'Recruit senior hires; nudges team quality up.' },
  raise: { name: 'Fundraising help', ap: COST.help.raise, desc: 'Narrative, data room and process coaching before a raise.' },
  pivot: { name: 'Pivot advice', ap: COST.help.pivot, desc: 'Most useful when product-market fit is struggling.' },
  cust:  { name: 'Customer intros', ap: COST.help.cust, desc: 'Open doors to real customers; lifts revenue and PMF.' },
};
function helpAvailable(h, type) {
  const s = G.startups[h.sid];
  if (h.status !== 'active' || s.status !== 'private') return fail('Not available.');
  if ((h.helpCd[type] || 0) > G.week) return fail(`Cooling down for ${h.helpCd[type] - G.week} more week(s).`);
  if (G.ap < HELP_INFO[type].ap) return fail(`Needs ${HELP_INFO[type].ap} AP.`);
  return { ok: true };
}
function helpAction(h, type) {
  const c = helpAvailable(h, type); if (!c.ok) return c;
  const s = G.startups[h.sid];
  spendAp(HELP_INFO[type].ap);
  h.helpCd[type] = G.week + 4;
  const p = clamp(0.62 + G.rep / 250 + (h.rel - 50) / 300 + (h.board ? 0.08 : 0), 0.3, 0.95);
  s.helped = s.helped || {};
  const bump = (st, amt) => { const used = s.helped[st] || 0; const room = Math.max(0, 12 - used); const d = Math.min(room, amt); s.h[st] = Math.min(98, s.h[st] + d); s.helped[st] = used + d; return d; };
  if (rf(G.rng) >= p) { logMsg(`${HELP_INFO[type].name} for ${s.name} didn't land this time.`, 'info'); return okr('It didn\'t land.', { landed: false }); }
  let msg = '';
  // diminishing returns: every extra favour to the same company works less well
  s.helpN = s.helpN || {}; const n = s.helpN[type] = (s.helpN[type] || 0) + 1;
  const dm = Math.pow(0.8, n - 1);
  if (type === 'intro') { if (s.round) s.round.prep = Math.min(0.8, s.round.prep + 0.35 * dm); else s.nextPrep = Math.min(0.8, (s.nextPrep || 0) + 0.35 * dm); G.net = Math.min(100, G.net + 0.4 * (1 - G.net / 100)); msg = 'Two good investors took the call.'; }
  if (type === 'hire') { bump('F', rr(G.rng, 1.5, 3.5) * dm); msg = 'A strong senior hire signed.'; }
  if (type === 'raise') { if (s.round) s.round.prep = Math.min(0.8, s.round.prep + 0.5 * dm); else s.nextPrep = Math.min(0.8, (s.nextPrep || 0) + 0.5 * dm); msg = 'The pitch narrative got sharper.'; }
  if (type === 'pivot') { bump('P', (s.h.P < 55 ? rr(G.rng, 3, 9) : rr(G.rng, 0.5, 2)) * dm); if (s.h.P < 55) s.gMod += 0.004 * dm; msg = 'The new positioning resonated.'; }
  if (type === 'cust') { bump('P', rr(G.rng, 1, 3) * dm); s.mrr *= 1 + rr(G.rng, 0.03, 0.08) * dm; G.net = Math.min(100, G.net + 0.3 * (1 - G.net / 100)); msg = 'Three new customers signed.'; }
  G.vaScore = Math.min(1, G.vaScore + 0.02); G.rep = Math.min(100, G.rep + 0.05);
  h.rel = Math.min(100, h.rel + 1);
  logMsg(`${HELP_INFO[type].name} for ${s.name}: ${msg}`, 'good');
  return okr(msg, { landed: true });
}

// ---------------------------------------------------------------- selling public / locked
function canSellPublic(h) { const s = G.startups[h.sid]; return s.status === 'public' && h.status === 'active' && G.week >= h.lockUntil; }
function sellPublic(h, frac) {
  if (!canSellPublic(h)) return fail(G.week < h.lockUntil ? `Locked up for ${h.lockUntil - G.week} more week(s).` : 'Nothing to sell.');
  if (!spendAp(1)) return fail('Needs 1 AP.');
  const s = G.startups[h.sid];
  const val = publicValue(h) * frac;
  const f = fd(s);
  for (const t of h.tr) { t.shares *= (1 - frac); }
  h.invested0 = h.invested0 || h.invested;
  const costPart = h.invested * frac;
  distribute(val); h.realized += val;
  G.realizedLog.push({ sid: h.sid, name: s.name, invested: costPart, got: val, w: G.week, kind: 'public sale' });
  h.invested -= costPart; h.realizedCost = (h.realizedCost || 0) + costPart;
  if (frac >= 0.999) { h.status = 'exited'; h.exitW = G.week; h.invested = h.invested0; finishExit(h, val, 'Sold position'); }
  else logMsg(`Sold ${Math.round(frac * 100)}% of ${s.name} for ${fm(val)}.`, 'good');
  return okr(`Sold for ${fm(val)}.`);
}

// secondary sale of a private position (any stage >= seed) at a discount
function secondaryOffer(h) {
  const s = G.startups[h.sid];
  if (s.status !== 'private' || s.done < 1) return null;
  return { disc: 0.2 + 0.08 * (MACRO[G.macro.regime].val < 1 ? 1 : 0), val: holdingMark(h) };
}
function sellSecondary(h, frac) {
  const so = secondaryOffer(h); if (!so) return fail('No secondary market for this position.');
  if (!spendAp(1)) return fail('Needs 1 AP.');
  const s = G.startups[h.sid];
  const val = so.val * frac * (1 - so.disc);
  const cost = h.invested * frac;
  for (const t of h.tr) { t.shares *= (1 - frac); t.invested *= (1 - frac); }
  distribute(val); h.realized += val; h.invested -= cost; h.realizedCost = (h.realizedCost || 0) + cost;
  G.realizedLog.push({ sid: h.sid, name: s.name, invested: cost, got: val, w: G.week, kind: 'secondary' });
  logMsg(`Secondary: sold ${Math.round(frac * 100)}% of ${s.name} for ${fm(val)} (${Math.round(so.disc * 100)}% below mark).`, 'info');
  if (frac >= 0.999) { h.status = 'exited'; h.exitW = G.week; }
  return okr(`Sold for ${fm(val)}.`);
}

// ---------------------------------------------------------------- sourcing, staff, car
function coldOutreach(sector) {
  if (!spendAp(COST.cold)) return fail(`Needs ${COST.cold} AP.`);
  const n = rc(G.rng, 0.5) ? 0 : (rc(G.rng, 0.15) ? 2 : 1);
  for (let i = 0; i < n; i++) sourceDeal('cold', { sector, stage: ri(G.rng, G.thesis.smin, G.thesis.smax) });
  const msg = n ? `Cold outreach landed ${n} reply${n > 1 ? 's' : ''}.` : 'Cold outreach: crickets.';
  logMsg(msg, 'info');
  return okr(msg, { n });
}
function hireAnalyst() { if (G.staff.analysts >= 3) return fail('Max 3 analysts.'); G.staff.analysts++; return okr('Analyst hired: diligence noise drops.'); }
function fireAnalyst() { if (!G.staff.analysts) return fail('No analysts.'); G.staff.analysts--; return okr('Analyst let go.'); }
function hireScout(sec) { if (G.staff.scouts.length >= 3) return fail('Max 3 scouts.'); G.staff.scouts.push(sec); return okr('Scout hired.'); }
function fireScout(i) { G.staff.scouts.splice(i, 1); return okr('Scout let go.'); }
function toggleCar() { G.car = !G.car; return okr(G.car ? 'Car leased: local visits cost 1 AP less.' : 'Car returned.'); }

// ---------------------------------------------------------------- turn control
function endTurn() {
  if (G.over) return fail('The fund is closed.');
  advanceWeek();
  return okr('Week advanced.');
}
function skipWeeks(n) {
  let i = 0;
  while (i < n && !G.over && !G.queue.length) { advanceWeek(); i++; }
  return i;
}
