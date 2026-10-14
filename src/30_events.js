// ============================================================================
// EVENTS: decisions that interrupt the week. Serialised as {type,sid,data};
// text/options/resolution live here so saves stay small.
// ============================================================================

const followFunds = () => Math.max(0, dryPowder());
function proRataAmt(s, h) {
  const own = ownPct(s, h);
  const rd = s.round; if (!rd) return 0;
  return Math.round(own * rd.raise * (h.prorata ? 1 : 0.5) / 5000) * 5000;
}
function bridgeAmt(s) { return Math.round(clamp(netBurn(s) * 6, 60e3, G.size * 0.15) / 10000) * 10000; }
function saleValue(s) { return acqhireEV(s); }
const opt = (id, label, sub, extra) => Object.assign({ id, label, sub: sub || '', ap: 0, disabled: false }, extra || {});
function needAp(o) { if (o.ap > G.ap) { o.disabled = true; o.why = `Needs ${o.ap} AP`; } return o; }

const EVENT_DEFS = {
  followon: {
    title: (ev, s) => `${s.name} is raising ${stageName(ev.data.k)}`,
    body: (ev, s, h) => {
      const rd = s.round, amt = proRataAmt(s, h);
      return [`Insiders are being asked to commit first. Your decision is a signal: pass, and the market reads it as a bad sign; follow, and it reads as conviction.`,
        `Target raise ~${fm(rd.raise)}${rd.safe ? ' on a SAFE' : ''}. Reported MRR ${fm(s.mrr)}, runway ${runwayMo(s) > 40 ? '40+' : runwayMo(s).toFixed(0)} months.`,
        `Your stake: ${fp(ownPct(s, h), 1)} (cost ${fm(h.invested)}, mark ${fm(holdingMark(h))}). Pro-rata ${h.prorata ? 'rights' : 'courtesy allocation (no rights)'}: ${fm(amt)}.`,
        `Dry powder ${fm(dryPowder())}, of which reserves ${fm(G.reserveLeft)}.`];
    },
    opts: (ev, s, h) => {
      const amt = proRataAmt(s, h), f = followFunds();
      return [
        opt('full', `Take full pro-rata — ${fm(amt)}`, 'Strong signal; the round gets easier.', { disabled: amt < 10000 || amt > f, why: amt > f ? 'Not enough dry powder' : 'Too small to matter' }),
        opt('half', `Take half — ${fm(amt / 2)}`, 'Neutral signal.', { disabled: amt < 20000 || amt / 2 > f, why: 'Not enough dry powder' }),
        opt('pass', 'Pass', 'The market will notice.'),
      ];
    },
    resolve: (ev, id, s, h) => {
      const rd = s.round, amt = proRataAmt(s, h);
      if (!rd) return 'The round closed before you could respond.';
      if (id === 'full') { rd.mySlice = amt; rd.signal += 0.35; h.rel = Math.min(100, h.rel + 2); G.net += 0.3; return `Committed ${fm(amt)} to ${s.name}'s round.`; }
      if (id === 'half') { rd.mySlice = amt / 2; return `Committed ${fm(amt / 2)} to ${s.name}'s round.`; }
      rd.signal -= 0.5; h.rel = Math.max(0, h.rel - 2); return `You passed on the follow-on in ${s.name}. Others noticed.`;
    },
  },

  runway: {
    title: (ev, s) => `${s.name}: runway is ending`,
    body: (ev, s) => [`The raise fell through and there are ${runwayMo(s).toFixed(1)} months of cash left. MRR ${fm(s.mrr)}, net burn ${fm(netBurn(s))}/mo, ${headcount(s)} people.`, `Decide: bridge them, back a pivot, sell what exists, or turn off the lights.`],
    opts: (ev, s, h) => {
      const amt = bridgeAmt(s);
      return [
        opt('bridge', `Bridge ${fm(amt)} (convertible note)`, 'Buys ~6 months; converts at a 20% discount. Needs dry powder.', { disabled: amt > followFunds(), why: 'Not enough dry powder' }),
        needAp(opt('pivot', 'Back a pivot (2 AP)', 'Cut costs 35%, re-aim the product. High variance.', { ap: 2 })),
        opt('sell', `Sell it — ~${fm(saleValue(s))}`, 'An acqui-hire for whatever exists.'),
        opt('shut', 'Shut it down', 'Return what cash is left.'),
      ];
    },
    resolve: (ev, id, s, h) => {
      if (id === 'bridge') {
        const amt = bridgeAmt(s); payFollowOn(amt);
        const tr = addTranche(s, { kind: 'note', invested: amt, cap: Infinity, disc: 0.2, mfn: false, pref: '1x', anti: 'none' });
        s.safes.push({ who: 'me', tid: tr.id, invested: amt, cap: Infinity, disc: 0.2, mfn: false });
        s.cash += amt; s.fails = 1; s.distress = 0.8; s.retryOk = true; G.net += 0.2;
        return `Bridged ${s.name} with ${fm(amt)}.`;
      }
      if (id === 'pivot') {
        spendAp(2);
        const dP = rg(s.rs, 6, 14);
        s.h.P = clamp(s.h.P + dP, 3, 98); s.expense = s.mrr + (s.expense - s.mrr) * 0.65; s.stallUntil = G.week + 6; s.fails = 1; s.gMod = 0; s.distress = 0.8;
        s.cash += s.expense * 1.5; // severance savings + last-ditch raise of friends and family
        return dP > 6 ? `The pivot found something: ${s.name} is moving again.` : `The pivot is wobbling, but it bought some time.`;
      }
      if (id === 'sell') { const ev_ = saleValue(s); s.cash = 0; sellHolding(h, ev_, 'Acqui-hire'); return `Sold ${s.name} for ${fm(ev_)}.`; }
      collapse(s, 'was shut down'); return `${s.name} shut down.`;
    },
  },

  downround: {
    title: (ev, s) => `${s.name}: down-round ultimatum`,
    body: (ev, s, h) => {
      const info = downInfo(s, ev);
      return [`The raise stalled, but a new investor will lead a round at ${fm(info.pre)} pre (previous post ${fm(lastPost(s))}) — a ${Math.round((1 - info.pre / lastPost(s)) * 100)}% haircut — ${fm(info.raise)} raised.`, `Down rounds trigger anti-dilution on your earlier shares (if you negotiated it), and the founder is already unhappy.`, `Your pro-rata in this round: ${fm(info.slice)}.`];
    },
    opts: (ev, s, h) => {
      const info = downInfo(s, ev);
      return [
        opt('support', `Support it — invest ${fm(info.slice)}`, 'Averages down; strong signal to the founder.', { disabled: info.slice < 10000 || info.slice > followFunds(), why: 'Not enough dry powder' }),
        opt('accept', 'Let them do it', 'You get diluted, no new money from you.'),
        opt('block', 'Block it (needs a board seat)', 'Hardball: 50% the company folds, 50% a better lifeline.', { disabled: !h.board, why: 'No board seat' }),
      ];
    },
    resolve: (ev, id, s, h) => {
      const info = downInfo(s, ev);
      if (id === 'block') {
        h.rel = Math.max(0, h.rel - 10);
        if (rc(G.rng, 0.5)) { collapse(s, 'folded after a blocked rescue round'); return `You blocked the round. ${s.name} could not find another lifeline.`; }
        closeRound(s, { pre: info.pre * 1.3, raise: info.raise, lead: 'Bridge investors', poolPct: 0.12, mine: [] });
        afterDown(s); return `You blocked the round; a better lifeline arrived.`;
      }
      const mine = [];
      if (id === 'support') { const amt = payFollowOn(info.slice); if (amt > 0) mine.push({ invested: amt, pref: '1x', anti: 'wa' }); h.rel = Math.min(100, h.rel + 4); }
      closeRound(s, { pre: info.pre, raise: info.raise, lead: 'Bridge investors', poolPct: 0.12, mine });
      afterDown(s);
      return id === 'support' ? `Backed ${s.name}'s down round with ${fm(mine.length ? mine[0].invested : 0)}.` : `${s.name} closed a down round.`;
    },
  },

  antidil: {
    title: (ev, s) => `${s.name}: anti-dilution fight`,
    body: (ev, s, h) => [`Your anti-dilution protection kicked in after the down round, handing you ${Math.round(sum(h.tr, t => t.adjust || 0)).toLocaleString()} extra shares.`, `The founder's cap table just got uglier. Waiving buys goodwill and morale; enforcing is within your rights.`],
    opts: () => [opt('waive', 'Waive the adjustment', '+ relationship, + founder morale, − your ownership'), opt('enforce', 'Enforce it', '− relationship; you keep the extra shares')],
    resolve: (ev, id, s, h) => {
      if (id === 'waive') { for (const t of h.tr) { if (t.adjust) { t.shares -= t.adjust; t.adjust = 0; t.cp = t.invested / t.shares; } } h.rel = Math.min(100, h.rel + 10); s.h.F = Math.min(98, s.h.F + 1.5); return 'You waived anti-dilution. The founder will remember.'; }
      h.rel = Math.max(0, h.rel - 12); G.founderRel = Math.max(0, G.founderRel - 1); return 'You enforced anti-dilution. Lawyers were involved.';
    },
  },

  fraud: {
    title: (ev, s) => `${s.name}: fraud revealed`,
    body: (ev, s, h) => {
      const cov = h.diligence || 0;
      return [`Investigators confirm ${s.founder.name} fabricated revenue and diverted funds. The company is finished.`, cov > 0.6 ? `Because you did most of your homework, the warranties and a clawback recover a little.` : `You skipped much of the diligence; the money is gone.`, `Diligence coverage on this deal: ${Math.round(cov * 100)}%.`];
    },
    opts: () => [opt('ok', 'Accept the loss', 'Reputation takes a hit proportional to what you skipped.')],
    resolve: (ev, id, s, h) => {
      const cov = h.diligence || 0;
      const rec = h.invested * cov * 0.22;
      G.stats.frauds++;
      G.rep = Math.max(0, G.rep - (0.8 + 2.2 * (1 - cov)));
      G.lpTrust = Math.max(0, G.lpTrust - (2 + 6 * (1 - cov)));
      s.status = 'dead'; s.deadW = G.week; s.deadWhy = 'fraud'; s.round = null;
      writeOff(h, rec, 'was a fraud');
      return `${s.name} was a fraud.`;
    },
  },

  cofounder: {
    title: (ev, s) => `${s.name}: cofounder blow-up`,
    body: (ev, s) => [`${s.founder.name} and their cofounder are no longer speaking except through Slack reactions. Half the team is picking sides.`],
    opts: (ev, s, h) => [
      needAp(opt('mediate', 'Mediate (2 AP)', 'Likely works if the founder is any good.', { ap: 2 })),
      opt('back', 'Back the CEO', 'Cofounder leaves; some knowledge walks out the door.'),
      opt('replace', 'Replace the CEO (board)', 'New CEO. Growth stalls for two months; founder relationship craters.', { disabled: !h.board, why: 'No board seat' }),
    ],
    resolve: (ev, id, s, h) => {
      if (id === 'mediate') { spendAp(2); if (rc(G.rng, 0.45 + s.h.F / 200 + G.rep / 300)) { G.rep += 0.1; return 'Mediation worked. They shook hands (awkwardly).'; } s.h.F = Math.max(3, s.h.F - 5); return 'Mediation failed. The cofounder left anyway.'; }
      if (id === 'back') { s.h.F = Math.max(3, s.h.F - 3); s.gMod -= 0.004; return 'The cofounder left. The CEO is grateful, the codebase less so.'; }
      s.h.F = clamp(rg(G.rng, 55, 12), 20, 90); s.stallUntil = G.week + 8; h.rel = Math.max(0, h.rel - 22); return 'You replaced the CEO. A new leader, a nervous team.';
    },
  },

  custlost: {
    title: (ev, s) => `${s.name}: key customer lost`,
    body: (ev, s) => [`Their biggest customer — about a quarter of revenue — is leaving for a competitor.`],
    opts: () => [needAp(opt('win', 'Help win them back (2 AP)', 'A call from the investor can move mountains.', { ap: 2 })), opt('accept', 'Accept it', 'MRR drops 25%.')],
    resolve: (ev, id, s) => {
      if (id === 'win') { spendAp(2); if (rc(G.rng, 0.5 + G.rep / 300)) { s.mrr *= 0.95; return 'You saved the account (mostly).'; } }
      s.mrr *= 0.75; s.h.P = Math.max(3, s.h.P - 3); return 'The customer left. MRR is down 25%.';
    },
  },

  competitor: {
    title: (ev, s) => `${s.name}: a competitor raised a monster round`,
    body: (ev, s) => [`A rival just announced a huge raise and is poaching customers with free pilots.`],
    opts: () => [needAp(opt('dd', 'Help them double down (1 AP)', 'Sharper positioning, faster roadmap.', { ap: 1 })), opt('ignore', 'Ignore it', 'Hope their product is worse.')],
    resolve: (ev, id, s) => {
      if (id === 'dd') { spendAp(1); if (rc(G.rng, 0.6)) return 'The company held its ground.'; s.h.P = Math.max(3, s.h.P - 2); return 'You tried; the competitor still took some share.'; }
      s.h.P = Math.max(3, s.h.P - rr(G.rng, 2, 6)); s.gMod -= 0.003; return 'The competitor took share. Growth slows.';
    },
  },

  regulatory: {
    title: (ev, s) => `${s.name}: regulatory trouble`,
    body: (ev, s) => [`A regulator has sent a letter. It is polite in the way that precedes a fine.`],
    opts: () => [opt('pay', 'Pay for good lawyers — $40k (fund)', 'Resolved cleanly.', { disabled: 40000 > followFunds(), why: 'Not enough dry powder' }), opt('ignore', 'Ignore it', '40% it blows up: growth freezes for two months.')],
    resolve: (ev, id, s) => {
      if (id === 'pay') { opexCall(40000); return 'Lawyers handled it. Expensive, quiet.'; }
      if (rc(G.rng, 0.4)) { s.stallUntil = G.week + 8; s.cash -= s.expense * 0.5; return 'It blew up: a fine and a frozen quarter.'; }
      return 'The letter went away. For now.';
    },
  },

  poach: {
    title: (ev, s) => `${s.name}: key hire poached`,
    body: (ev, s) => [`The head of engineering has a counter-offer from a Big Tech company with a free-lunch problem.`],
    opts: () => [opt('keep', 'Fund a retention package — $25k', 'Keeps the team intact.', { disabled: 25000 > followFunds(), why: 'Not enough dry powder' }), opt('let', 'Let them go', 'Team quality dips; growth stalls briefly.')],
    resolve: (ev, id, s) => { if (id === 'keep') { opexCall(25000); return 'Retention package signed. The engineer stays.'; } s.h.F = Math.max(3, s.h.F - 3); s.stallUntil = G.week + 3; return 'The engineer left. Hiring a replacement will take a while.'; },
  },

  scandal: {
    title: (ev, s) => `${s.name}: founder scandal`,
    body: (ev, s) => [`${s.founder.name} is trending for the wrong reasons.${s.h.I < 45 ? ' Frankly, it is not out of character.' : ''}`],
    opts: (ev, s, h) => [
      opt('stand', 'Stand by the founder', 'Reputation risk; 50% customers shrug.'),
      opt('oust', 'Push the founder out (board)', 'New CEO, founder relationship destroyed.', { disabled: !h.board, why: 'No board seat' }),
      opt('distance', 'Quietly distance yourself', 'Small reputation cost.'),
    ],
    resolve: (ev, id, s, h) => {
      if (id === 'stand') { G.rep = Math.max(0, G.rep - 0.6); if (rc(G.rng, 0.5)) { s.mrr *= 0.92; return 'The press cycle moved on, but some customers did not.'; } return 'It blew over.'; }
      if (id === 'oust') { s.h.F = clamp(rg(G.rng, 55, 12), 20, 90); s.h.I = clamp(s.h.I + 15, 0, 98); s.stallUntil = G.week + 8; h.rel = Math.max(0, h.rel - 25); G.rep = Math.max(0, G.rep - 0.2); return 'The board acted. A new CEO takes over.'; }
      G.rep = Math.max(0, G.rep - 0.3); h.rel = Math.max(0, h.rel - 3); return 'You kept your head down.';
    },
  },

  acquihire: {
    title: (ev, s) => `${s.name}: acqui-hire offer`,
    body: (ev, s) => [`A larger company wants the team, not the product. The offer is ${fm(acqhireVal(s))}.`, `Cost basis ${fm(G.hold[s.id].invested)}. This is the "return your capital, roughly" outcome.`],
    opts: () => [opt('sell', 'Take it', 'Realize it now.'), opt('hold', 'Decline', 'Keep swinging.')],
    resolve: (ev, id, s, h) => { if (id === 'sell') { const v = acqhireVal(s); sellHolding(h, v, 'Acqui-hire'); return `Acqui-hired for ${fm(v)}.`; } return 'You declined the acqui-hire.'; },
  },

  exitoffer: {
    title: (ev, s) => ev.data.kind === 'ipo' ? `${s.name}: IPO window is open` : `${s.name}: acquisition offer`,
    body: (ev, s, h) => {
      const d = ev.data, pay = exitPayout(s, h, d.ev), mark = holdingMark(h), M = MACRO[G.macro.regime];
      const lines = [];
      if (d.kind === 'ipo') lines.push(`Bankers say the window is open: ${fm(d.ev)} market cap on listing. Lock-up is 26 weeks, so you cannot sell instantly.`);
      else lines.push(`An acquirer is offering ${fm(d.ev)} for the whole company, paid ${d.cash ? 'in cash' : 'in acquirer stock (8-week lock-up, price can fall)'}.${d.opposes ? ' The founder opposes the sale.' : ''}`);
      lines.push(`Your share of proceeds: ${fm(pay)} on ${fm(h.invested)} invested (${fx(pay / Math.max(1, h.invested), 1)}). Current mark: ${fm(mark)}.`);
      lines.push(`Macro: ${M.name}. Sector heat ${sectorHeat(s.sector) >= 0 ? '+' : ''}${(sectorHeat(s.sector) * 100).toFixed(0)}. ARR ${fm(arr(s))}, growing ~${(growthMo(s) * 100).toFixed(1)}%/mo.`);
      return lines;
    },
    opts: (ev, s, h) => {
      const d = ev.data;
      if (d.kind === 'ipo') return [opt('go', 'Approve the IPO', 'Company lists; sell after lock-up.'), opt('no', 'Stay private', 'Windows close. Sometimes forever.')];
      const o = [opt('sell', d.cash ? 'Accept — sell now' : 'Accept — take the stock', d.cash ? 'Cash proceeds hit the fund now.' : 'Proceeds become locked stock.'), opt('no', 'Decline — hold', 'The offer disappears.')];
      if (d.opposes) { o[0] = opt('sell', 'Overrule the founder (board)', 'Accept the sale over their objection; relationship −15.'); }
      return o;
    },
    resolve: (ev, id, s, h) => {
      const d = ev.data;
      if (id === 'no') return `You turned down ${d.kind === 'ipo' ? 'the IPO' : 'the offer'} for ${s.name}.`;
      if (d.kind === 'ipo') {
        goPublic(s, d.ev * rr(G.rng, 1.0, 1.15), 0.045); h.lockUntil = G.week + 26;
        logMsg(`${s.name} IPO'd at ${fm(s.mcap)}. Your shares unlock in 26 weeks.`, 'good'); G.rep = Math.min(100, G.rep + 1);
        return `${s.name} went public.`;
      }
      if (d.opposes) h.rel = Math.max(0, h.rel - 15);
      if (d.cash) { sellHolding(h, d.ev, 'Acquisition'); return `Sold ${s.name} for ${fm(d.ev)}.`; }
      goPublic(s, d.ev * 0.98, 0.035); h.lockUntil = G.week + 8; h.stockDeal = true;
      logMsg(`${s.name} was acquired for stock. You hold shares, locked for 8 weeks.`, 'info');
      return `Accepted the stock deal for ${s.name}.`;
    },
  },

  lpliquidity: {
    title: () => 'An LP wants early liquidity',
    body: () => { const a = lpAsk(); return [`One of your LPs has a cash crunch and wants out of ${fm(a)} of their commitment early. LPs have long memories about this sort of thing.`]; },
    opts: () => { const a = lpAsk(); return [
      needAp(opt('buyer', 'Find a secondary buyer (2 AP)', '70% you pull it off. LP trust +3.', { ap: 2 })),
      opt('own', `Buy them out yourself — ${fm(a)} personal`, 'Costs personal cash. LP trust +6.', { disabled: a > G.cash, why: 'Not enough personal cash' }),
      opt('no', 'Decline', 'LP trust −4.'),
    ]; },
    resolve: (ev, id) => {
      const a = lpAsk();
      if (id === 'buyer') { spendAp(2); if (rc(G.rng, 0.7)) { G.lpTrust = Math.min(100, G.lpTrust + 3); return 'You found a buyer. The LP sends a bottle of wine.'; } G.lpTrust = Math.max(0, G.lpTrust - 1); return 'No buyer at a sensible price. The LP is disappointed.'; }
      if (id === 'own') { G.cash -= a; G.lpTrust = Math.min(100, G.lpTrust + 6); return `You bought out the LP for ${fm(a)}.`; }
      G.lpTrust = Math.max(0, G.lpTrust - 4); return 'You declined. The LP will remember.';
    },
  },

  leak: {
    title: () => 'Term sheet leak',
    body: (ev, s) => [`Someone at a co-investor leaked the terms of your ${s ? s.name : 'latest'} deal to a newsletter.`],
    opts: () => [needAp(opt('apol', 'Get ahead of it (1 AP)', 'Reputation −0.3', { ap: 1 })), opt('ignore', 'Ignore it', 'Reputation −1.2')],
    resolve: (ev, id) => { if (id === 'apol') { spendAp(1); G.rep = Math.max(0, G.rep - 0.3); return 'You wrote a gracious note. Mostly forgotten.'; } G.rep = Math.max(0, G.rep - 1.2); return 'The leak stung your reputation.'; },
  },
};

function lpAsk() { return Math.round(G.size * 0.03 / 5000) * 5000; }
function acqhireVal(s) { if (!s._ah || s._ah.w !== G.week) s._ah = { w: G.week, v: acqhireEV(s) * 1.1 }; return s._ah.v; }
function downInfo(s, ev) {
  const h = G.hold[s.id];
  if (!ev.data.pre) {
    const pre = lastPost(s) * rr(s.rs, 0.4, 0.6), k = s.done + 1;
    const raise = Math.max(stg(k).raise * 0.3, netBurn(s) * 12);
    ev.data.pre = pre; ev.data.raise = raise;
  }
  const pre = ev.data.pre, raise = ev.data.raise;
  const own = ownPct(s, h);
  return { pre, raise, slice: Math.round(own * raise / 5000) * 5000 };
}
function afterDown(s) {
  if (s.antiTriggered) { s.antiTriggered = false; pushEvent('antidil', s.id); }
  s.stallUntil = G.week + 4;
}

// ---- generic API for UI/bots ----
function eventCtx(ev) { const s = ev.sid ? G.startups[ev.sid] : null; const h = ev.sid ? G.hold[ev.sid] : null; return [ev, s, h]; }
function eventView(ev) {
  const def = EVENT_DEFS[ev.type], ctx = eventCtx(ev);
  return { title: def.title.apply(null, ctx), body: def.body.apply(null, ctx), opts: def.opts.apply(null, ctx) };
}
function resolveEvent(ev, id) {
  const def = EVENT_DEFS[ev.type], ctx = eventCtx(ev);
  const idx = G.queue.indexOf(ev); if (idx >= 0) G.queue.splice(idx, 1);
  const msg = def.resolve.apply(null, [ev, id, ctx[1], ctx[2]]);
  if (msg) { logMsg(msg, 'info'); }
  return msg;
}
function eventValid(ev) {
  // drop events whose subject disappeared
  if (ev.sid) { const s = G.startups[ev.sid], h = G.hold[ev.sid]; if (!s || !h || h.status !== 'active' || s.status === 'dead') return false; if (ev.type !== 'followon' && s.status !== 'private' && ev.type !== 'exitoffer') return false; if (ev.type === 'followon' && !s.round) return false; }
  return true;
}
