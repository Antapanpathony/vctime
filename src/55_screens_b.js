// ============================================================================
// SCREENS B: portfolio, fund, office, market, modals (event, menu, help, end)
// ============================================================================

const CAP_COLS = ['#5cb4ff', '#b79cff', '#4fd1b5', '#ffb45c', '#ef7a8b', '#e6d86a', '#7fd35f', '#9aa9b8'];
function statusLabel(s, h) {
  if (h.status === 'written-off') return ['Written off', C.red];
  if (h.status === 'exited') return ['Exited', C.green];
  if (s.status === 'public') return [G.week < h.lockUntil ? `Public · lock ${h.lockUntil - G.week}w` : 'Public', C.blue];
  if (s.round) return ['Raising', C.gold];
  const run = runwayMo(s);
  if (run < 4) return ['Low runway', C.red];
  return ['Private', C.dim];
}
function trLabel(t) {
  if (t.kind === 'safe') return `SAFE ${fm(t.invested)} · cap ${fm(t.cap)}${t.mfn ? ' · MFN' : ''}${t.disc ? ' · 20% disc' : ''}${t.shares ? ' (converted)' : ''}`;
  if (t.kind === 'note') return `Bridge note ${fm(t.invested)} · 20% discount${t.shares ? ' (converted)' : ''}`;
  return `${fm(t.invested)} @ ${t.pps ? '$' + t.pps.toFixed(3) : '—'}/sh · ${t.pref === 'part' ? 'participating' : '1x non-part'} · ${t.anti === 'wa' ? 'WA anti-dil' : t.anti === 'ratchet' ? 'full ratchet' : 'no anti-dil'}`;
}

// ---------------------------------------------------------------- portfolio
function drawPortfolio() {
  const rows = portfolioRows();
  const act_ = rows.filter(r => r.active);
  const cost = sum(act_, r => r.h.invested), mark = sum(act_, r => r.mark), real = sum(rows, r => r.h.realized), allInv = sum(rows, r => r.h.invested + (r.h.realizedCost || 0));
  panel(14, 90, 780, 44, null);
  [['ACTIVE', String(act_.length)], ['COST', fm(cost)], ['MARK', fm(mark)], ['REALIZED', fm(real)], ['GROSS MOIC', fx((mark + real) / Math.max(1, allInv))]].forEach((c, i) => {
    T(c[0], 30 + i * 150, 104, { s: 10, w: 800, c: C.faint }); T(c[1], 30 + i * 150, 122, { s: 14, w: 700, mono: true });
  });
  // table
  panel(14, 142, 780, 526, null);
  const cols = [['Company', 34, 'left'], ['Stage', 204, 'left'], ['Cost', 318, 'right'], ['Own', 378, 'right'], ['Mark', 458, 'right'], ['MOIC', 524, 'right'], ['Runway', 598, 'right'], ['Status', 616, 'left']];
  cols.forEach(c => T(c[0], c[1], 160, { s: 10.5, w: 800, c: C.faint, a: c[2] }));
  const ch = rows.length * 30 + 4;
  beginScroll('port', 20, 172, 768, 490, ch);
  rows.forEach((r, i) => {
    const y = 174 + i * 30, sel = S.selHold === r.h.sid;
    const hv = hit(20, y, 760, 28);
    if (sel || hv) box(20, y, 760, 28, sel ? C.panel3 : C.panel2, sel ? C.gold : null, 5);
    if (hv) { UI.cursor = 'pointer'; if (UI.released && !UI.active) S.selHold = r.h.sid; }
    const s = r.s, st = statusLabel(s, r.h), dim_ = !r.active;
    sectorDot(34, y + 14, s.sector, 4);
    T(s.name, 44, y + 14, { s: 12.5, w: 700, maxW: 140, c: dim_ ? C.dim : C.text });
    T(stageName(s.done), 204, y + 14, { s: 11.5, c: C.dim });
    T(fm(r.h.invested), 318, y + 14, { s: 12, mono: true, a: 'right' });
    T(r.active ? fp(r.own, 2) : '—', 378, y + 14, { s: 12, mono: true, a: 'right' });
    T(r.active ? fm(r.mark) : fm(r.h.realized), 458, y + 14, { s: 12, mono: true, a: 'right', c: r.active ? C.text : C.dim });
    T(fx(r.moic, 1), 524, y + 14, { s: 12, mono: true, a: 'right', c: r.moic >= 1 ? C.green : r.moic > 0.3 ? C.amber : C.red });
    T(r.active && s.status === 'private' ? (runwayMo(s) > 40 ? '40+' : runwayMo(s).toFixed(0)) + ' mo' : '—', 598, y + 14, { s: 11.5, mono: true, a: 'right', c: r.active && runwayMo(s) < 5 ? C.red : C.dim });
    T(st[0], 616, y + 14, { s: 11.5, w: 700, c: st[1], maxW: 160 });
  });
  if (!rows.length) T('No investments yet. Close a deal from the Pipeline tab.', 404, 260, { s: 13, c: C.faint, a: 'center' });
  endScroll('port', 20, 172, 768, 490, ch);
  // detail
  const sel = rows.find(r => r.h.sid === S.selHold) || rows[0];
  if (sel) { S.selHold = sel.h.sid; drawHoldingDetail(sel, 806, 90, 460, 578); }
  else panel(806, 90, 460, 578, 'DETAIL');
}

function capRows(s) {
  const f = fd(s), rows = [{ n: 'Founders', v: s.cap.founders }, { n: 'Option pool', v: s.cap.pool }];
  for (const i of s.cap.inv) rows.push({ n: i.name, v: i.shares });
  const h = G.hold[s.id];
  if (h) { const mine = sum(h.tr, t => t.shares || 0); if (mine > 0) rows.push({ n: 'You', v: mine, me: true }); }
  const merged = []; // merge repeated investor names
  for (const r of rows) { const m = merged.find(x => x.n === r.n && !x.me); if (m && !r.me) m.v += r.v; else merged.push(Object.assign({}, r)); }
  return { rows: merged, f };
}

function drawHoldingDetail(r, x, y, w, h_) {
  const s = r.s, h = r.h;
  panel(x, y, w, h_, null);
  T(s.name, x + 16, y + 22, { s: 19, w: 900 });
  chip(x + 24 + measure(s.name, 19, 900), y + 14, stageName(s.done), C.gold);
  T(`${SECTOR_BY_ID[s.sector].name} · ${CITY_BY_ID[s.city].name} · ${s.founder.name}`, x + 16, y + 44, { s: 11.5, c: C.dim, maxW: w - 30 });
  const st = statusLabel(s, h);
  chip(x + w - measure(st[0], 10.5, 700) - 30, y + 14, st[0], st[1]);
  let yy = y + 64;
  // report
  if (r.active && s.status === 'private') {
    box(x + 12, yy, w - 24, 62, C.bg, C.line, 6);
    if (s.report) {
      const q = s.report;
      T(`Quarterly update · week ${q.w + 1}${h.board ? ' · board-verified' : ''}`, x + 22, yy + 12, { s: 10.5, w: 700, c: C.faint });
      const items = [['MRR', fm(q.mrr)], ['Burn/mo', fm(Math.max(0, q.burn))], ['Runway', (q.runway > 40 ? '40+' : q.runway.toFixed(0)) + ' mo'], ['Team', String(Math.round(q.hc))]];
      items.forEach((it, i) => { T(it[0], x + 22 + i * 105, yy + 32, { s: 10, c: C.faint }); T(it[1], x + 22 + i * 105, yy + 49, { s: 13.5, w: 700, mono: true }); });
      tip(x + 12, yy, w - 24, 62, 'Reported by the company. Reports can be spun — a board seat reduces the spin, and the data room (via a fresh look) shows more.');
    } else T('No quarterly update yet — the first arrives at quarter-end.', x + 22, yy + 31, { s: 12, c: C.faint });
    yy += 72;
  } else if (s.status === 'public') {
    box(x + 12, yy, w - 24, 62, C.bg, C.line, 6);
    T(`Public · market cap ${fm(s.mcap)}`, x + 22, yy + 16, { s: 13.5, w: 700 });
    T(`Your stake ${fp(r.own, 2)} = ${fm(publicValue(h))}`, x + 22, yy + 38, { s: 12.5, c: C.dim });
    T(G.week < h.lockUntil ? `Locked for ${h.lockUntil - G.week} more weeks` : 'Unlocked — you can sell', x + w - 22, yy + 38, { s: 12, w: 700, a: 'right', c: G.week < h.lockUntil ? C.amber : C.green });
    yy += 72;
  }
  // position
  const lines = [['Cost', fm(h.invested)], ['Ownership', fp(r.own, 2)], ['Mark', fm(r.mark)], ['Realized', fm(h.realized)], ['MOIC', fx(r.moic, 2)]];
  lines.forEach((l, i) => { T(l[0], x + 16 + (i % 3) * 148, yy + 8 + Math.floor(i / 3) * 34, { s: 10.5, c: C.faint, w: 700 }); T(l[1], x + 16 + (i % 3) * 148, yy + 24 + Math.floor(i / 3) * 34, { s: 14, w: 700, mono: true }); });
  T('Founder rel.', x + 16 + 2 * 148 - 0, yy + 42, { s: 10.5, c: C.faint, w: 700 });
  bar(x + 16 + 2 * 148, yy + 54, 120, 8, h.rel / 100, h.rel > 55 ? C.green : h.rel > 35 ? C.gold : C.red);
  tip(x + 16 + 2 * 148, yy + 36, 130, 30, `Founder relationship ${Math.round(h.rel)}/100. Aggressive terms and enforcing anti-dilution lower it; it affects follow-on allocations and referrals.`);
  yy += 76;
  chip(x + 16, yy, h.board ? 'BOARD SEAT' : 'no board seat', h.board ? C.green : C.faint, { s: 9.5 });
  chip(x + 110, yy, h.prorata ? 'PRO-RATA RIGHTS' : 'no pro-rata rights', h.prorata ? C.green : C.faint, { s: 9.5 });
  if (s.round && !s.round.taken) chip(x + 240, yy, `Raising ${stageName(s.round.stage)}`, C.gold, { s: 9.5 });
  yy += 24;
  if (r.active) {
    T('YOUR READ', x + 16, yy + 6, { s: 10.5, w: 800, c: C.faint });
    STATS.forEach((st, i) => {
      const k = s.know[st], bx_ = x + 96 + (i % 3) * 120, by = yy - (i < 3 ? 0 : -16);
      T(STAT_SHORT[st], bx_, by + 6, { s: 10.5, c: C.dim });
      T(k ? ratingWord(k.m) : '?', bx_ + 52, by + 6, { s: 10.5, w: 700, c: k ? ratingCol(k.m) : C.faint });
    });
    yy += 38;
  }
  // cap table
  T('CAP TABLE', x + 16, yy + 6, { s: 10.5, w: 800, c: C.faint });
  const cap = capRows(s);
  let bx = x + 16; const bw = w - 32;
  cap.rows.forEach((cr, i) => { const wdt = bw * cr.v / cap.f; ctx.fillStyle = cr.me ? C.gold : CAP_COLS[i % CAP_COLS.length]; ctx.fillRect(bx, yy + 16, Math.max(1, wdt - 1), 12); bx += wdt; });
  tip(x + 16, yy + 14, bw, 16, 'Fully-diluted ownership. Down rounds, option-pool top-ups and new rounds dilute you unless you follow on.');
  const show = cap.rows.slice().sort((a, b) => b.v - a.v).slice(0, 5);
  show.forEach((cr, i) => { const col = i % 2, rowI = Math.floor(i / 2); const idx = cap.rows.indexOf(cr); ctx.fillStyle = cr.me ? C.gold : CAP_COLS[idx % CAP_COLS.length]; ctx.fillRect(x + 16 + col * 220, yy + 38 + rowI * 16, 8, 8); T(`${cr.n} ${fp(cr.v / cap.f, 1)}`, x + 30 + col * 220, yy + 42 + rowI * 16, { s: 11, c: cr.me ? C.gold : C.dim, maxW: 190 }); });
  yy += 38 + 3 * 16 + 4;
  // tranches
  h.tr.slice(-3).forEach((t, i) => { T(trLabel(t), x + 16, yy + 6 + i * 15, { s: 10.5, c: C.faint, maxW: w - 30 }); });
  yy += Math.min(3, h.tr.length) * 15 + 8;
  // actions
  if (r.active && s.status === 'private') {
    T('HELP  (spend AP, nudge hidden stats upward)', x + 16, yy + 6, { s: 10.5, w: 800, c: C.faint });
    Object.keys(HELP_INFO).forEach((k, i) => {
      const av = helpAvailable(h, k), hi = HELP_INFO[k], bx_ = x + 16 + (i % 3) * 144, by = yy + 18 + Math.floor(i / 3) * 34;
      const cd = (h.helpCd[k] || 0) - G.week;
      if (button('help' + k + h.sid, bx_, by, 138, 30, hi.name, { sub: cd > 0 ? `cooldown ${cd}w` : `${hi.ap} AP`, disabled: !av.ok, why: av.msg, s: 11, tip: hi.desc })) act(helpAction(h, k));
    });
    yy += 18 + 68;
    const so = secondaryOffer(h);
    if (so) {
      T(`Secondary: sell at ${Math.round(so.disc * 100)}% below mark`, x + 16, yy + 8, { s: 11, c: C.dim });
      [0.25, 0.5, 1].forEach((f, i) => { if (button('sec' + f + h.sid, x + w - 16 - 3 * 62 + i * 62, yy - 2, 58, 24, Math.round(f * 100) + '%', { s: 11, disabled: G.ap < 1, why: 'Needs 1 AP' })) act(sellSecondary(h, f)); });
    }
  } else if (r.active && s.status === 'public') {
    const can = canSellPublic(h);
    T('SELL SHARES (1 AP)', x + 16, yy + 6, { s: 10.5, w: 800, c: C.faint });
    [0.25, 0.5, 1].forEach((f, i) => { if (button('pub' + f + h.sid, x + 16 + i * 100, yy + 20, 94, 30, f === 1 ? 'Sell all' : 'Sell ' + Math.round(f * 100) + '%', { disabled: !can || G.ap < 1, why: !can ? `Locked for ${h.lockUntil - G.week} more weeks` : 'Needs 1 AP', kind: 'good' })) act(sellPublic(h, f)); });
    T('Stock can fall while you wait. Selling is a decision, not a default.', x + 16, yy + 66, { s: 11, c: C.faint });
  }
}

// ---------------------------------------------------------------- fund
function drawFund() {
  const m = fundMetrics();
  panel(14, 90, 760, 300, 'J-CURVE  (net TVPI and DPI, quarterly marks)');
  const pts = G.hist.map(h => [h.w / 52, h.tvpi]), pd = G.hist.map(h => [h.w / 52, h.dpi]);
  lineChart(24, 120, 740, 264, [{ pts: pd, col: C.teal, lw: 2 }, { pts: pts, col: C.gold, lw: 2.5 }], { xmin: 0, xmax: 10, ymin: 0, ymax: Math.max(2, ...pts.map(p => p[1]) , ...pd.map(p => p[1])) * 1.1, hline: 1, yfmt: v => v.toFixed(1) + 'x', xfmt: v => 'Y' + Math.round(v), xticks: 5 });
  T('TVPI', 680, 122, { s: 11, w: 800, c: C.gold }); T('DPI', 725, 122, { s: 11, w: 800, c: C.teal });
  // metrics grid
  panel(14, 400, 760, 268, 'FUND I — METRICS');
  const feesLeft = annualFee() / 52 * weeksLeft();
  const items = [
    ['Net TVPI', fx(m.tvpi), 'Marks + distributions, after fees and accrued carry, over paid-in capital.'], ['DPI', fx(m.dpi), 'Cash actually returned to LPs over paid-in. LPs see TVPI early and DPI late.'], ['Net IRR', m.irr == null ? '—' : fp(m.irr, 1), 'Annualised net return on LP cash flows.'],
    ['NAV (marks)', fm(m.nav), 'Your holdings at last-round marks.'], ['Paid-in', fm(G.called), 'Capital called so far (fees, expenses, investments).'], ['Distributed', fm(G.dist), 'Gross proceeds paid out.'],
    ['Carry paid (you)', fm(G.carryPaid), 'Carry arrives late, only after exits return the fund.'], ['Carry accrued', fm(m.carryAccrued), 'What you would be owed if everything liquidated at marks.'], ['Fees paid', fm(G.feesPaid), '2% of commitments per year.'],
    ['Dry powder', fm(dryPowder()), 'Uncalled capital minus the fees you still owe the fund over its life.'], ['Reserves left', fm(G.reserveLeft), 'Held back for follow-ons.'], ['Fees still due', fm(feesLeft), ''],
  ];
  items.forEach((it, i) => {
    const x = 30 + (i % 3) * 245, y = 424 + Math.floor(i / 3) * 56;
    T(it[0], x, y + 6, { s: 10.5, w: 700, c: C.faint }); T(it[1], x, y + 28, { s: 18, w: 800, mono: true, c: it[0] === 'Net TVPI' ? (m.tvpi >= 1 ? C.green : C.amber) : C.text });
    tip(x, y, 230, 48, it[2]);
  });
  // right column
  const rx = 786, rw = 480;
  panel(rx, 90, rw, 218, 'THESIS & DISCIPLINE');
  const t = G.thesis;
  T(`${stageName(t.smin)} → ${stageName(t.smax)} · ${t.geo === 'local' ? 'home city' : t.geo === 'region' ? 'home region' : 'global'} · ~${fp(t.check, 0)} checks`, rx + 16, 130, { s: 12.5, w: 700 });
  let sx_ = rx + 16; t.sectors.forEach(id => { sx_ += chip(sx_, 144, SECTOR_BY_ID[id].name, SECTOR_BY_ID[id].col) + 6; });
  const meters = [['LP trust', G.lpTrust, 'LPs decide the size of your next fund. Strong marks raise it; drift and bad quarters lower it.'], ['Reputation', G.rep, 'Opens doors with great founders and wins competitive deals.'], ['Network', G.net, 'Drives referrals and syndicate access.'], ['Founder rel.', G.founderRel, 'Average across your portfolio. Aggressive terms hurt it; it feeds referrals and follow-on access.']];
  meters.forEach((mt, i) => {
    const y = 176 + i * 28;
    T(mt[0], rx + 16, y + 6, { s: 12, c: C.dim }); bar(rx + 110, y, 300, 10, mt[1] / 100, mt[1] > 55 ? C.green : mt[1] > 30 ? C.gold : C.red); T(String(Math.round(mt[1])), rx + 424, y + 6, { s: 12, w: 700, mono: true });
    tip(rx + 16, y - 4, 420, 22, mt[2]);
  });
  const drift = driftLevel();
  panel(rx, 316, rw, 120, 'PORTFOLIO CONSTRUCTION');
  const act_ = activeHoldings(), total = sum(act_, h => h.invested) || 1, big = act_.reduce((a, h) => Math.max(a, h.invested), 0);
  T(`${Object.keys(G.hold).length} companies · ${act_.length} active`, rx + 16, 354, { s: 12.5, w: 700 });
  T(`Largest position ${fp(big / total, 0)} of cost · drift ${fp(drift, 0)} of last 8 off-thesis`, rx + 16, 376, { s: 12, c: drift > 0.3 ? C.red : C.dim });
  T(`Reserves ${fp(G.reserveLeft / Math.max(1, G.size), 0)} of fund left · initial budget ${fm(Math.max(0, generalPowder()))}`, rx + 16, 398, { s: 12, c: C.dim });
  const nB = Object.keys(G.hold).length; T(nB < 6 ? 'Style: concentrated' : nB < 14 ? 'Style: balanced' : 'Style: diversified', rx + 16, 420, { s: 12, c: C.gold, w: 700 });
  panel(rx, 444, rw, 224, 'LP REPORTS');
  const reps = G.reports.slice(-6).reverse();
  if (!reps.length) T('Your first quarterly LP report goes out at the end of Q1.', rx + 16, 490, { s: 12, c: C.faint });
  T('Qtr', rx + 16, 468, { s: 10, w: 800, c: C.faint }); ['TVPI', 'DPI', 'IRR', 'Trust'].forEach((c, i) => T(c, rx + 130 + i * 85, 468, { s: 10, w: 800, c: C.faint, a: 'right' }));
  reps.forEach((r, i) => {
    const y = 488 + i * 25;
    T(`Y${r.year} Q${r.q}`, rx + 16, y, { s: 12, c: C.dim }); T(fx(r.tvpi), rx + 130, y, { s: 12, mono: true, a: 'right' }); T(fx(r.dpi), rx + 215, y, { s: 12, mono: true, a: 'right' });
    T(r.irr == null ? '—' : fp(r.irr, 0), rx + 300, y, { s: 12, mono: true, a: 'right' }); T(String(Math.round(r.trust)), rx + 385, y, { s: 12, mono: true, a: 'right' });
  });
}

// ---------------------------------------------------------------- office
function drawOffice() {
  panel(14, 90, 620, 270, 'PERSONAL WEALTH  (cars and staff come out of your pocket, not the fund)');
  T(fm(G.cash), 30, 142, { s: 34, w: 900, mono: true, c: G.cash < 20000 ? C.red : C.text });
  T('personal cash', 32, 168, { s: 11.5, c: C.dim });
  const rows = [['Management fee (2% of fund)', annualFee()], ['Living costs', -LIVING_COST_YR], ['Car lease', G.car ? -CAR_COST_YR : 0], ['Analysts', -G.staff.analysts * ANALYST_YR], ['Scouts', -G.staff.scouts.length * SCOUT_YR]];
  rows.forEach((r, i) => { T(r[0], 30, 196 + i * 22, { s: 12.5, c: C.dim }); T((r[1] >= 0 ? '+' : '−') + fm(Math.abs(r[1])) + '/yr', 400, 196 + i * 22, { s: 12.5, mono: true, a: 'right', c: r[1] > 0 ? C.green : r[1] < 0 ? C.text : C.faint }); });
  const net = personalWeekly() * 52;
  ctx.fillStyle = C.line; ctx.fillRect(30, 310, 380, 1);
  T('Net per year', 30, 328, { s: 13, w: 700 }); T((net >= 0 ? '+' : '−') + fm(Math.abs(net)), 400, 328, { s: 14, w: 800, mono: true, a: 'right', c: net >= 0 ? C.green : C.red });
  P('Carry is the real payoff, and it arrives late: only after exits return the fund.', 440, 190, 170, { s: 11.5, c: C.faint });
  P(`GP commit already paid: ${fm(G.gp)}. The score counts fund returns, never personal assets.`, 440, 250, 170, { s: 11.5, c: C.faint });
  // car
  panel(646, 90, 620, 130, 'CAR');
  P('One binary choice. Own a car and each local visit in your home city costs 1 AP less. Don\'t, and local visits cost normal AP. That is the whole mechanic.', 662, 120, 380, { s: 12.5, c: C.dim });
  if (button('car', 1062, 140, 184, 56, G.car ? 'Return the car' : 'Lease a car', { kind: G.car ? 'danger' : 'primary', sub: G.car ? `saving 1 AP per local visit` : `${fm(CAR_COST_YR)}/yr` })) act(toggleCar());
  // staff
  panel(646, 228, 620, 252, 'STAFF  (paid from your fee income)');
  T(`Analysts ${G.staff.analysts}/3`, 662, 268, { s: 13, w: 700 }); T(`${fm(ANALYST_YR)}/yr each · each cuts diligence noise ~12%`, 662, 288, { s: 11.5, c: C.dim });
  if (button('han', 1100, 252, 70, 32, 'Hire', { disabled: G.staff.analysts >= 3, kind: 'good' })) act(hireAnalyst());
  if (button('fan', 1176, 252, 70, 32, 'Fire', { disabled: !G.staff.analysts })) act(fireAnalyst());
  T(`Scouts ${G.staff.scouts.length}/3`, 662, 334, { s: 13, w: 700 }); T(`${fm(SCOUT_YR)}/yr each · a steady trickle of mid-quality deals in one sector`, 662, 354, { s: 11.5, c: C.dim });
  G.staff.scouts.forEach((sec, i) => { const b = 662 + i * 200; box(b, 376, 190, 30, C.panel2, C.line, 6); sectorDot(b + 14, 391, sec, 4); T(SECTOR_BY_ID[sec].name, b + 26, 391, { s: 12 }); if (button('fsc' + i, b + 150, 380, 36, 22, '✕', { s: 10 })) fireScout(i); });
  if (G.staff.scouts.length < 3) {
    T('Hire a scout in:', 662, 430, { s: 12, c: C.dim });
    SECTORS.forEach((sc, i) => { if (button('hsc' + sc.id, 770 + (i % 4) * 118, 418 + Math.floor(i / 4) * 30, 112, 26, sc.name, { s: 10.5, r: 5 })) act(hireScout(sc.id)); });
  }
  // travel
  panel(14, 368, 620, 300, 'TRAVEL  (commercial flights are free, always)');
  const tr = [['Local visit (home city)', G.car ? COST.hqLocal - 1 : COST.hqLocal, G.car ? 'car saves 1 AP' : 'a car would save 1 AP'], ['Regional flight (same region)', COST.hqRegion, 'return trip same week'], ['Intercontinental', COST.hqFar, `+${4} AP lost next week; 15% delay risk`]];
  tr.forEach((r, i) => { const y = 408 + i * 34; T(r[0], 30, y, { s: 13, w: 600 }); T(r[2], 30, y + 15, { s: 10.5, c: C.faint }); chip(560, y - 8, r[1] + ' AP', C.gold); });
  P(`Travel is a modifier, not the game. Your home is ${CITY_BY_ID[G.home].name}. Startups elsewhere cost more AP to visit — decide whether the diligence is worth the time.`, 30, 520, 580, { s: 12.5, c: C.dim });
  T('Coming later:', 30, 586, { s: 11, w: 800, c: C.faint });
  ['Charter market', 'Fractional shares', 'Private jets & co-owners', 'Pilot training'].forEach((l, i) => { box(30 + i * 148, 600, 140, 26, C.bg, C.line, 6); ctx.globalAlpha = 0.5; T('· ' + l, 100 + i * 148, 613, { s: 10.5, a: 'center' }); ctx.globalAlpha = 1; });
  T('Phases 2–4: fairs, rival dynamics, crypto sleeve, jets, Fund II.', 30, 646, { s: 11, c: C.faint });
}

// ---------------------------------------------------------------- market
function drawMarket() {
  panel(14, 90, 800, 330, 'SECTOR HEAT  (hype cycles inflate valuations and dry up when they pop)');
  const series = SECTORS.map(sc => ({ col: sc.col, pts: G.heatHist.map(h => [h.w / 52, h.h[SECTORS.indexOf(sc)]]).concat([[G.week / 52, G.heat[sc.id]]]), lw: 2 }));
  lineChart(24, 120, 780, 258, series, { xmin: 0, xmax: Math.max(2, G.week / 52 + 0.2), ymin: -1, ymax: 1, hline: 0, yfmt: v => (v > 0 ? '+' : '') + v.toFixed(1), xfmt: v => 'Y' + (Math.floor(v + 0.001) + 1), ticks: 4, xticks: Math.max(1, Math.min(6, Math.round(Math.max(2, G.week / 52 + 0.2)))) });
  SECTORS.forEach((sc, i) => { const x = 28 + i * 112; ctx.fillStyle = sc.col; ctx.fillRect(x, 392, 8, 8); T(sc.name, x + 14, 396, { s: 11, c: C.dim }); T((G.heat[sc.id] >= 0 ? '+' : '') + (G.heat[sc.id] * 100).toFixed(0), x + 14, 410, { s: 11, mono: true, w: 700, c: G.heat[sc.id] > 0.4 ? C.amber : C.text }); });
  const M = MACRO[G.macro.regime];
  panel(826, 90, 440, 330, 'MACRO');
  T(M.name, 846, 130, { s: 24, w: 900, c: M.col });
  T(`since week ${G.macro.since + 1} · policy rate ${M.rate}`, 846, 156, { s: 12, c: C.dim });
  [['Valuation multiple', `${(M.val * 100).toFixed(0)}%`], ['Exit multiples', `${(M.exit * 100).toFixed(0)}%`], ['IPO window', M.ipo >= 0.4 ? 'wide open' : M.ipo >= 0.15 ? 'open' : M.ipo > 0 ? 'barely' : 'shut'], ['Fundraising climate', M.raise > 0.3 ? 'easy' : M.raise > -0.3 ? 'normal' : M.raise > -0.9 ? 'tight' : 'frozen']].forEach((r, i) => { T(r[0], 846, 196 + i * 30, { s: 13, c: C.dim }); T(r[1], 1246, 196 + i * 30, { s: 14, w: 800, a: 'right', mono: true }); });
  P('Regimes shift every quarter or so. Bull markets inflate prices and open IPO windows; recessions slash valuations and strand exits. Hold too long and the window closes.', 846, 324, 400, { s: 12, c: C.faint });
  // rivals
  panel(14, 428, W - 28, 240, 'RIVAL FIRMS  (founders pick on price, terms, brand, speed and value-add)');
  ['Firm', 'Style', 'Brand', 'Stages', 'Rounds led'].forEach((c, i) => T(c, [30, 230, 560, 720, 900][i], 464, { s: 10.5, w: 800, c: C.faint }));
  RIVALS.forEach((rv, i) => {
    const y = 488 + i * 17.5;
    T(rv.name, 30, y, { s: 12, w: 700, maxW: 190 }); T(rv.style, 230, y, { s: 11.5, c: C.dim, maxW: 320 });
    bar(560, y - 4, 110, 8, rv.brand / 100, rv.brand > 80 ? C.gold : C.blue); T(String(rv.brand), 680, y, { s: 11, mono: true, c: C.dim });
    T(rv.stages[0] === rv.stages[1] ? stageName(rv.stages[0]) : `${stageName(rv.stages[0])}–${stageName(rv.stages[1])}`, 720, y, { s: 11.5, c: C.dim });
    T(String((G.rivalWins || {})[rv.id] || 0), 900, y, { s: 12, mono: true });
  });
  T(`Your brand: ${Math.round(G.rep)}. Early on you win only the deals nobody else wants.`, W - 40, 464, { s: 11.5, c: C.amber, a: 'right' });
}

// ---------------------------------------------------------------- modals
function drawEventModal() {
  const ev = G.queue[0];
  if (!ev) return;
  if (!eventValid(ev)) { G.queue.shift(); return; }
  const v = eventView(ev), s = ev.sid ? G.startups[ev.sid] : null;
  dim();
  const w = 680;
  let bodyH = 0; v.body.forEach(p => { bodyH += paraH(p, w - 56, 13.5, 20) + 8; });
  const optH = v.opts.length * 58;
  const h = 100 + bodyH + optH + 20, x = (W - w) / 2, y = Math.max(60, (H - h) / 2);
  box(x, y, w, h, C.bg2, C.gold, 12);
  chip(x + 22, y + 18, G.queue.length > 1 ? `DECISION · ${G.queue.length} waiting` : 'DECISION', C.gold, { s: 9.5 });
  T(v.title, x + 22, y + 56, { s: 22, w: 900, maxW: w - 44 });
  let yy = y + 82;
  v.body.forEach(p => { const hh = P(p, x + 28, yy, w - 56, { s: 13.5, lh: 20, c: C.text }); yy += hh + 8; });
  yy += 10;
  v.opts.forEach((o, i) => {
    needApCheck(o);
    const cost = o.ap ? ` · ${o.ap} AP` : '';
    if (button('ev' + i, x + 24, yy + i * 58, w - 48, 52, o.label + cost, { kind: i === 0 && !o.disabled ? 'primary' : 'ghost', sub: o.disabled && o.why ? o.why : o.sub, disabled: o.disabled, why: o.why, a: 'left', s: 14 })) {
      const msg = resolveEvent(ev, o.id);
      if (msg) flash(msg, 'info');
      sfx('click'); drainToasts();
    }
  });
}
function needApCheck(o) { if (o.ap > G.ap) { o.disabled = true; o.why = `Needs ${o.ap} AP`; } }

function drawMenu() {
  dim();
  const w = 420, h = 360, x = (W - w) / 2, y = 130;
  box(x, y, w, h, C.bg2, C.line, 12);
  T('Menu', x + 24, y + 30, { s: 22, w: 900 });
  if (button('mresume', x + 24, y + 56, w - 48, 40, 'Resume', { kind: 'primary' })) S.menu = false;
  if (button('msave', x + 24, y + 104, w - 48, 36, 'Save game', {})) { saveGame(); flash('Game saved.', 'good'); }
  if (button('mload', x + 24, y + 148, w - 48, 36, 'Load saved game', { disabled: !hasSave() })) { loadGame(); S.menu = false; }
  S.sound = toggle('msound', x + 24, y + 196, 'Sound effects', S.sound);
  if (button('mnew', x + 24, y + 236, w - 48, 36, 'New game…', { kind: 'danger' })) { S.menu = false; initSetup(); S.screen = 'setup'; }
  T(`Seed ${G.seed} — replay the same startups`, x + w / 2, y + 296, { s: 11.5, c: C.faint, a: 'center', mono: true });
  T('Autosaves every week.', x + w / 2, y + 318, { s: 11.5, c: C.faint, a: 'center' });
}

function drawHelp() {
  dim();
  const w = 900, h = 560, x = (W - w) / 2, y = 80;
  box(x, y, w, h, C.bg2, C.gold, 12);
  T('How to run a fund', x + 28, y + 36, { s: 24, w: 900, c: C.gold });
  const secs = [
    ['The week', 'You get 10 action points (AP) each week. Spend them on deals, diligence and helping your portfolio, then End week. Unspent AP is lost.'],
    ['The pipeline', 'Sourced → Screened → Meeting → Diligence → Term sheet. Each move costs AP, and founders need a week between steps. Rounds close; waiting loses deals.'],
    ['Diligence', 'Startups have hidden stats: founder, product-market fit, burn, timing, integrity, tech. Each tool reveals some of them with noise (the confidence bars). Founders bluff — contradictions between tools are your signal. Frauds exist; skip diligence and they scam you in proportion.'],
    ['Term sheets', 'Pick lead or follow, valuation, check size and terms. Founders choose between offers on price, terms, your brand, speed and value-add. Aggressive terms win returns but hurt founder relationships.'],
    ['Your portfolio', 'Help founders with AP, follow on in winners (reserves!), take board seats, and decide when to sell. Outcomes follow a power law: most die, some return about 1x, a few return 50x or more.'],
    ['The score', 'After 10 years: net IRR, TVPI and DPI of Fund I, plus a small reputation bonus. Personal assets never count — only carry does. LPs watch for thesis drift.'],
  ];
  let yy = y + 60;
  secs.forEach(s => { T(s[0], x + 28, yy + 8, { s: 13, w: 800 }); const hh = P(s[1], x + 170, yy, w - 200, { s: 12.5, lh: 18, c: C.dim }); yy += Math.max(hh, 20) + 14; });
  if (button('hclose', x + w - 168, y + h - 54, 140, 36, 'Got it', { kind: 'primary' })) S.help = false;
  T('Tip: hover almost anything for an explanation.', x + 28, y + h - 36, { s: 12, c: C.faint });
}

function drawEnd() {
  dim();
  const m = G.final || fundMetrics(true), sc = scoreFund(m);
  const w = 1000, h = 600, x = (W - w) / 2, y = 62;
  box(x, y, w, h, C.bg2, C.gold, 14);
  T('FUND I — FINAL REPORT', x + 30, y + 30, { s: 12, w: 800, c: C.faint });
  T(G.fundName, x + 30, y + 62, { s: 28, w: 900 });
  T(sc.grade, x + w - 90, y + 76, { s: 92, w: 900, c: sc.grade <= 'B' ? C.gold : C.dim, a: 'center' });
  T(sc.title, x + 30, y + 92, { s: 15, c: C.gold, w: 700 });
  T(`Score ${sc.score}  (returns ${sc.base} + reputation ${sc.repBonus})`, x + 30, y + 116, { s: 13, c: C.dim });
  [['Net IRR', m.irr == null ? '—' : fp(m.irr, 1)], ['Net TVPI', fx(m.tvpi)], ['DPI', fx(m.dpi)], ['Carry to you', fm(G.carryPaid + m.carryUnpaid * 0)], ['Companies', String(Object.keys(G.hold).length)]].forEach((c, i) => {
    T(c[0], x + 30 + i * 190, y + 160, { s: 11, w: 700, c: C.faint }); T(c[1], x + 30 + i * 190, y + 188, { s: 26, w: 900, mono: true });
  });
  T('Unrealised positions are valued at 85% of mark; DPI counts only cash returned.', x + 30, y + 212, { s: 11.5, c: C.faint });
  const rows = Object.values(G.hold).map(h => ({ h, s: G.startups[h.sid], v: h.realized + positionValue(h, true) })).filter(r => r.s).sort((a, b) => b.v / Math.max(1, b.h.invested) - a.v / Math.max(1, a.h.invested));
  panel(x + 24, y + 232, 460, 280, 'BEST CALLS');
  rows.slice(0, 5).forEach((r, i) => { const yy = y + 270 + i * 40; T(r.s.name, x + 40, yy, { s: 13, w: 700 }); T(`${fm(r.h.invested)} → ${fm(r.v)}`, x + 40, yy + 17, { s: 11.5, c: C.dim }); T(fx(r.v / Math.max(1, r.h.invested), 1), x + 470, yy + 8, { s: 17, w: 900, mono: true, a: 'right', c: C.green }); });
  if (!rows.length) T('You never invested. LPs are puzzled.', x + 40, y + 280, { s: 13, c: C.faint });
  panel(x + 508, y + 232, 468, 280, 'THE ONES THAT GOT AWAY');
  const got = G.ledger.map(l => ({ l, s: G.startups[l.sid] })).filter(r => r.s).map(r => ({ r, v: r.s.status === 'acquired' ? (r.s.exitEV || 0) : r.s.status === 'public' ? r.s.mcap : r.s.status === 'dead' ? 0 : lastPost(r.s) })).sort((a, b) => b.v - a.v).slice(0, 5);
  got.forEach((g, i) => { const yy = y + 270 + i * 40; T(g.r.s.name, x + 524, yy, { s: 13, w: 700 }); T(`you passed: ${g.r.l.why}`, x + 524, yy + 17, { s: 11.5, c: C.dim, maxW: 280 }); T(g.v > 0 ? fm(g.v) : 'dead', x + 962, yy + 8, { s: 15, w: 800, mono: true, a: 'right', c: g.v > 100e6 ? C.red : C.dim }); });
  if (!got.length) T('Nothing you passed on made headlines. Probably.', x + 524, y + 280, { s: 13, c: C.faint });
  if (button('endnew', x + 30, y + h - 56, 220, 38, 'New fund (same seed)', { kind: 'ghost' })) { initSetup(); S.setup.seed = G.seed; S.screen = 'setup'; }
  if (button('endnew2', x + 262, y + h - 56, 220, 38, 'New fund (new seed)', { kind: 'primary' })) { initSetup(); S.screen = 'setup'; }
  if (button('endview', x + w - 190, y + h - 56, 160, 38, 'Review portfolio', {})) S.endShown = true;
}
