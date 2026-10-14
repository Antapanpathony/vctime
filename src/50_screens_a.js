// ============================================================================
// SCREENS A: frame, setup, pipeline, deal room (diligence, HQ visit, term sheet)
// ============================================================================

const TABS = [['pipeline', 'Pipeline'], ['portfolio', 'Portfolio'], ['fund', 'Fund'], ['office', 'Office'], ['market', 'Market']];

function act(res) {
  if (!res) return res;
  if (res.ok === false && res.msg) { flash(res.msg, 'warn'); sfx('warn'); }
  else if (res.ok && res.msg && !res.silent) flash(res.msg, res.won === false ? 'bad' : 'good');
  return res;
}

// ---------------------------------------------------------------- frame
function drawFrame() {
  box(0, 0, W, 50, C.bg2, null, 0);
  ctx.fillStyle = C.line; ctx.fillRect(0, 50, W, 1);
  T(G.fundName, 16, 17, { s: 15, w: 800, c: C.gold, maxW: 230 });
  T(`${dateStr(G.week)}  ·  ${calStr(G.week)}`, 16, 36, { s: 11.5, c: C.dim });
  // AP pips
  T('AP', 262, 25, { s: 11, w: 800, c: C.dim });
  for (let i = 0; i < AP_BASE; i++) {
    const cx = 292 + i * 18, on = i < G.ap;
    ctx.beginPath(); ctx.arc(cx, 25, 6.5, 0, 6.3);
    if (on) { ctx.fillStyle = C.gold; ctx.fill(); } else { ctx.strokeStyle = C.faint; ctx.lineWidth = 1.5; ctx.stroke(); }
  }
  tip(255, 8, 230, 34, `Action points: ${G.ap} of ${AP_BASE} left this week. Every pipeline move, diligence tool, visit and portfolio favour costs AP.${G.apDebt ? ' Next week you lose ' + G.apDebt + ' AP to travel/board duties.' : ''}`);
  if (G.apDebt > 0) T(`−${G.apDebt} next wk`, 470, 25, { s: 10.5, c: C.amber });
  const m = fundMetrics();
  let x = 560;
  for (const [lab, val, col] of [['TVPI', fx(m.tvpi), m.tvpi >= 1 ? C.green : C.amber], ['DPI', fx(m.dpi), C.text], ['NAV', fm(m.netNav), C.text], ['CASH', fm(G.cash), G.cash < 20000 ? C.red : C.text]]) {
    T(lab, x, 17, { s: 10, w: 800, c: C.faint }); T(val, x, 35, { s: 15, w: 700, c: col, mono: true }); x += Math.max(78, measure(val, 15, 700, true) + 22);
  }
  tip(560, 6, 300, 40, 'Net TVPI (marks + distributions, after fees and accrued carry), DPI (cash returned), net NAV, and your personal cash. The J-curve is real.');
  const M = MACRO[G.macro.regime];
  // controls
  const busy = G.queue.length > 0;
  if (button('end', W - 150, 8, 136, 34, 'End week ▶', { kind: 'primary', disabled: busy, why: 'Resolve the pending decision first.', tip: 'Advance one week (Space). Unspent AP is lost.', w: 800 })) doEndTurn();
  if (button('skip', W - 214, 8, 58, 34, '+4w', { disabled: busy, why: 'Resolve the pending decision first.', tip: 'Fast-forward up to 4 weeks. Stops if a decision comes up.' })) doSkip(4);
  if (button('skipq', W - 278, 8, 58, 34, '+13w', { disabled: busy, why: 'Resolve the pending decision first.', tip: 'Fast-forward a quarter. Stops if a decision comes up.' })) doSkip(13);
  if (button('menu', W - 346, 8, 62, 34, 'Menu', {})) S.menu = true;
  if (button('help', W - 380, 8, 28, 34, '?', { w: 800 })) S.help = true;
  // tabs
  let tx = 14;
  const counts = { pipeline: G.deals.filter(d => d.status === 'open').length, portfolio: activeHoldings().length };
  for (const [id, label] of TABS) {
    const lab = counts[id] != null ? `${label}  ${counts[id]}` : label;
    if (button('tab-' + id, tx, 56, 118, 28, lab, { kind: S.tab === id ? 'tabOn' : 'tab', w: 700, r: 6 })) S.tab = id;
    tx += 122;
  }
  T(`Dry powder ${fm(dryPowder())}   ·   Initial-check budget ${fm(Math.max(0, generalPowder()))}   ·   Reserves ${fm(G.reserveLeft)}`, W - 16, 70, { s: 11.5, c: C.dim, a: 'right' });
  const mw_ = chip(640, 62, M.name, M.col); tip(640, 62, mw_, 17, `Macro regime: ${M.name}. Rates ${M.rate}. Drives valuations, exit multiples and IPO windows.`);
  // footer log
  ctx.fillStyle = C.bg2; ctx.fillRect(0, 676, W, 44); ctx.fillStyle = C.line; ctx.fillRect(0, 676, W, 1);
  const lg = G.log.slice(-2);
  lg.forEach((e, i) => {
    const y = 688 + i * 18;
    ctx.fillStyle = logCol(e.k); ctx.beginPath(); ctx.arc(20, y, 3.5, 0, 6.3); ctx.fill();
    T(`Wk ${e.w + 1}`, 32, y, { s: 11, c: C.faint, mono: true });
    T(e.t, 86, y, { s: 12.5, c: i === lg.length - 1 ? C.text : C.dim, maxW: 1060 });
  });
  T('Space: end week · 1-5: tabs · Esc: close', W - 14, 706, { s: 10.5, c: C.faint, a: 'right' });
}

// ---------------------------------------------------------------- setup
function initSetup() {
  S.setup = {
    seed: String(Math.floor(Math.random() * 900000 + 100000)), name: 'Bad Haircut Ventures', home: 'sf', size: 5e6, reserve: 0.35,
    smin: 0, smax: 1, sectors: ['ai', 'saas'], geo: 'region', check: 0.05,
  };
}
function drawSetup() {
  const u = S.setup;
  ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, H);
  // left hero
  T('TERM SHEET', 48, 70, { s: 44, w: 900, c: C.gold });
  T('Coffee Inc., with the coffee deleted.', 50, 108, { s: 15, c: C.dim });
  P('You are a solo angel with $250k, a promising Rolodex and a bad haircut. Raise Fund I, find the next category-defining company before anyone else, and try not to get scammed on the way. The only product is returns.', 50, 132, 330, { s: 13.5, c: C.text });
  panel(48, 270, 332, 234, 'HOW A WEEK WORKS');
  const lines = ['10 action points (AP) per week.', 'Source → Screen → Meet → Diligence → Term sheet.', 'Every move, tool and favour costs AP.', 'Hidden stats are seen through noisy tools.', 'Diligence beats vibes. Frauds exist.', 'Score = net IRR, TVPI and DPI at year 10.'];
  lines.forEach((l, i) => { ctx.fillStyle = C.gold; ctx.beginPath(); ctx.arc(66, 308 + i * 30, 3, 0, 6.3); ctx.fill(); T(l, 80, 308 + i * 30, { s: 12.5, maxW: 290 }); });
  T('Phase 1 build · single file · works offline', 50, 690, { s: 11, c: C.faint });
  // right: form
  const fx_ = 420;
  panel(fx_, 28, 820, 664, null);
  T('Set up Fund I', fx_ + 20, 54, { s: 20, w: 800 });
  T('Fund name', fx_ + 20, 92, { s: 11, w: 700, c: C.dim });
  u.name = input('in-name', fx_ + 20, 102, 300, 30, u.name, { max: 28 });
  T('Seed (same seed = same startups)', fx_ + 340, 92, { s: 11, w: 700, c: C.dim });
  u.seed = input('in-seed', fx_ + 340, 102, 190, 30, u.seed, { max: 14, mono: true });
  if (button('dice', fx_ + 538, 102, 60, 30, 'Roll', {})) u.seed = String(Math.floor(Math.random() * 900000 + 100000));
  // home city
  T('Home city (your local network, cheap local visits)', fx_ + 20, 154, { s: 11, w: 700, c: C.dim });
  CITIES.forEach((c, i) => { if (button('city' + c.id, fx_ + 20 + i * 112, 164, 106, 32, c.name, { kind: u.home === c.id ? 'primary' : 'ghost', s: 12, sub: REGION_NAMES[c.region] })) u.home = c.id; });
  // fund size
  T('Fund size (2% fee, 20% carry, 10 years; you commit 2%)', fx_ + 20, 218, { s: 11, w: 700, c: C.dim });
  [[3e6, 'Micro $3M', 'fee $60k/yr'], [5e6, 'Standard $5M', 'fee $100k/yr'], [10e6, 'Large $10M', 'fee $200k/yr · GP commit $200k']].forEach((o, i) => {
    if (button('size' + i, fx_ + 20 + i * 196, 228, 188, 40, o[1], { kind: u.size === o[0] ? 'primary' : 'ghost', sub: o[2] })) u.size = o[0];
  });
  T('Reserves held back for follow-ons', fx_ + 620, 218, { s: 11, w: 700, c: C.dim });
  [[0.2, '20%'], [0.35, '35%'], [0.5, '50%']].forEach((o, i) => { if (button('res' + i, fx_ + 620 + i * 62, 228, 58, 40, o[1], { kind: u.reserve === o[0] ? 'primary' : 'ghost' })) u.reserve = o[0]; });
  tip(fx_ + 620, 228, 190, 40, 'Initial checks may only use money outside the reserve. Reserves protect you from being diluted out of your winners.');
  // thesis
  T('FUND THESIS — deals that fit arrive more often and diligence faster; drifting costs LP trust', fx_ + 20, 296, { s: 11, w: 800, c: C.gold });
  T('Stage range', fx_ + 20, 316, { s: 12, w: 700, c: C.dim });
  const stNames = STAGES.map(s => s.short);
  let d = stepper('smin', fx_ + 20, 326, 300, 'From', stNames[u.smin], u.smin > 0, u.smin < u.smax); if (d) u.smin += d;
  d = stepper('smax', fx_ + 20, 354, 300, 'To', stNames[u.smax], u.smax > u.smin, u.smax < 5); if (d) u.smax += d;
  T('Geography', fx_ + 350, 316, { s: 12, w: 700, c: C.dim });
  [['local', 'Home city only'], ['region', 'Home region'], ['global', 'Global']].forEach((o, i) => { if (button('geo' + o[0], fx_ + 350 + i * 150, 326, 144, 28, o[1], { kind: u.geo === o[0] ? 'primary' : 'ghost', s: 12 })) u.geo = o[0]; });
  T('Flights between regions take two turns and risk delays. Home-city visits are cheap.', fx_ + 350, 372, { s: 11, c: C.faint });
  T('Sectors (pick 1–3)', fx_ + 20, 398, { s: 12, w: 700, c: C.dim });
  SECTORS.forEach((sc, i) => {
    const on = u.sectors.includes(sc.id), x = fx_ + 20 + (i % 4) * 190, y = 410 + Math.floor(i / 4) * 38;
    if (button('sec' + sc.id, x, y, 182, 32, sc.name, { kind: on ? 'primary' : 'ghost', disabled: !on && u.sectors.length >= 3, why: 'Three sectors max.' })) {
      if (on && u.sectors.length > 1) u.sectors = u.sectors.filter(z => z !== sc.id); else if (!on) u.sectors.push(sc.id);
    }
    sectorDot(x + 14, y + 16, sc.id, 4);
  });
  T('Typical initial check', fx_ + 20, 498, { s: 12, w: 700, c: C.dim });
  [[0.03, 'Spray', '3% of fund · ~25 bets'], [0.05, 'Diversified', '5% of fund · ~15 bets'], [0.08, 'Balanced', '8% · ~9 bets'], [0.15, 'Concentrated', '15% · ~5 bets']].forEach((o, i) => {
    if (button('chk' + i, fx_ + 20 + i * 196, 508, 188, 42, o[1], { kind: u.check === o[0] ? 'primary' : 'ghost', sub: o[2] })) u.check = o[0];
  });
  tip(fx_ + 20, 508, 780, 42, '15 bets at 5% each has lower variance; 6 bets at 15% each has a higher ceiling — and one bad year can end you.');
  // summary
  const invest = u.size * 0.78, init = invest * (1 - u.reserve);
  panel(fx_ + 20, 568, 780, 72, null, { fill: C.bg2 });
  T(`Investable ≈ ${fm(invest)}  ·  Initial checks ≈ ${fm(init)}  ·  ≈ ${Math.max(1, Math.round(init / (u.size * u.check)))} initial bets  ·  Reserves ${fm(invest * u.reserve)}`, fx_ + 36, 590, { s: 13, w: 600 });
  T(`Your capital: $250k − ${fm(u.size * 0.02)} GP commit = ${fm(250000 - u.size * 0.02)} personal cash.  Fee income ${fm(u.size * 0.02)}/yr vs. ~$48k/yr living costs.`, fx_ + 36, 614, { s: 12, c: C.dim });
  if (button('start', fx_ + 580, 648, 220, 36, 'Open Fund I ▶', { kind: 'primary', s: 15, w: 800 })) startNewGame();
  if (hasSave() && button('cont', fx_ + 20, 648, 200, 36, 'Continue saved game', {})) loadGame();
  if (button('back', fx_ + 232, 648, 120, 36, S.screen === 'setup' && G ? 'Back' : 'Skip', { disabled: !G })) { S.screen = 'game'; }
}
function startNewGame() {
  const u = S.setup;
  newGame({ seed: u.seed, fundName: u.name.trim() || 'Bad Haircut Ventures', home: u.home, size: u.size, reservePct: u.reserve, thesis: { smin: u.smin, smax: u.smax, sectors: u.sectors.slice(), geo: u.geo, check: u.check } });
  G.coldSector = u.sectors[0];
  // opening pipeline so week 1 has something to do
  for (let i = 0; i < 4; i++) sourceDeal('inbound');
  sourceDeal('referral');
  S.screen = 'game'; S.tab = 'pipeline'; S.modal = null; S.selHold = 0; S.scroll = {};
  if (!localStorage_get('termsheet.seen')) { S.help = true; localStorage_set('termsheet.seen', '1'); }
  saveGame(true);
}

// ---------------------------------------------------------------- pipeline
function dealSort(a, b) { return (G.startups[a.sid].round ? G.startups[a.sid].round.end : 999) - (G.startups[b.sid].round ? G.startups[b.sid].round.end : 999) || a.id - b.id; }
function buzz(d, s) {
  const n = s.round ? s.round.rivals.length : 0;
  return d.marketChecked ? n : clamp(n + (((d.id * 7) % 3) - 1), 0, 4);
}
function openDeal(d) { S.modal = { type: 'deal' }; S.dealId = d.id; S.dealView = { tab: 'dd', hq: null }; }

function drawPipeline() {
  const cols = [[], [], [], [], []];
  for (const d of G.deals) if (d.status === 'open') cols[d.col].push(d);
  cols.forEach(c => c.sort(dealSort));
  // sourcing bar
  panel(14, 90, W - 28, 44, null);
  T('SOURCING', 30, 112, { s: 11, w: 800, c: C.gold });
  const inb = (2.1 + G.rep / 30).toFixed(1), ref = fp(clamp(0.12 + G.net / 160 + (G.founderRel - 50) / 400, 0.05, 0.7), 0);
  T(`Inbound ~${inb}/wk (noisy)`, 110, 112, { s: 12, c: C.dim }); tip(110, 96, 150, 32, 'Inbound: high volume, low quality. Mostly noise.');
  T(`Referrals ${ref}/wk (network ${Math.round(G.net)})`, 290, 112, { s: 12, c: C.dim }); tip(290, 96, 190, 32, 'Referrals: low volume, high quality. Driven by your network and founder relationships.');
  T(`Scouts ${G.staff.scouts.length}`, 500, 112, { s: 12, c: C.dim }); tip(500, 96, 70, 32, 'Scouts source steadily in their sector. Hire them in the Office tab.');
  T(`Drift ${fp(driftLevel(), 0)}`, 580, 112, { s: 12, c: driftLevel() > 0.3 ? C.red : C.dim });
  tip(580, 96, 80, 32, 'Share of your last 8 investments that were off-thesis. High drift costs LP trust and weakens your sourcing advantage.');
  const sec = SECTOR_BY_ID[G.coldSector];
  if (button('coldsec', 780, 98, 140, 28, sec.name, { s: 12, tip: 'Click to cycle the cold-outreach sector.' })) { const i = SECTORS.findIndex(z => z.id === G.coldSector); G.coldSector = SECTORS[(i + 1) % SECTORS.length].id; }
  sectorDot(792, 112, G.coldSector, 4);
  if (button('cold', 928, 98, 308, 28, `Cold outreach · ${COST.cold} AP`, { disabled: G.ap < COST.cold, why: 'Not enough AP.', tip: 'Low hit rate, low quality — but you choose the sector and your thesis stages.' })) act(coldOutreach(G.coldSector));
  // columns
  const gap = 8, cw = (W - 28 - gap * 5) / 6, y0 = 142, hgt = 528;
  for (let c = 0; c < 6; c++) {
    const x = 14 + c * (cw + gap);
    panel(x, y0, cw, hgt, null, { fill: C.bg2 });
    const names = [...COL_NAMES, 'Closed / passed'];
    T(names[c], x + 12, y0 + 16, { s: 12.5, w: 800 });
    if (c < 5) {
      chip(x + cw - 34, y0 + 8, String(cols[c].length), C.dim);
      const nxt = [COST.screen, COST.meet, COST.dd, COST.ts, 0][c];
      T(c < 4 ? `next step: ${nxt} AP` : 'send a term sheet: 1 AP', x + 12, y0 + 34, { s: 10.5, c: C.faint });
    } else T('last 12 weeks', x + 12, y0 + 34, { s: 10.5, c: C.faint });
    const ly = y0 + 46, lh = hgt - 52;
    if (c < 5) {
      const ch = cols[c].length * 80 + 4;
      beginScroll('col' + c, x + 4, ly, cw - 8, lh, ch);
      cols[c].forEach((d, i) => drawCard(d, x + 6, ly + 2 + i * 80, cw - 12, c));
      if (!cols[c].length) T(c === 0 ? 'Inbound will land here.' : 'Empty', x + cw / 2, ly + 30, { s: 11.5, c: C.faint, a: 'center' });
      endScroll('col' + c, x + 4, ly, cw - 8, lh, ch);
    } else {
      const done = G.deals.filter(d => d.status !== 'open' && d.endW != null && G.week - d.endW <= 12 && (d.col >= 1 || d.status === 'closed')).sort((a, b) => b.endW - a.endW);
      const ch = done.length * 40 + 4;
      beginScroll('colz', x + 4, ly, cw - 8, lh, ch);
      done.forEach((d, i) => {
        const s = G.startups[d.sid], yy = ly + 2 + i * 40, col = d.status === 'closed' ? C.green : d.status === 'passed' ? C.faint : C.red;
        ctx.fillStyle = col; ctx.fillRect(x + 8, yy + 4, 3, 30);
        T(s ? s.name : '?', x + 18, yy + 10, { s: 12, w: 700, maxW: cw - 34 });
        T(d.status === 'closed' ? 'Closed — invested' : d.why || d.status, x + 18, yy + 27, { s: 10.5, c: col === C.faint ? C.dim : col, maxW: cw - 34 });
      });
      endScroll('colz', x + 4, ly, cw - 8, lh, ch);
    }
  }
}

function drawCard(d, x, y, w, col) {
  const s = G.startups[d.sid], rd = s.round;
  const h = 74;
  const hv = hit(x, y, w, h);
  const urgent = rd && (rd.end - G.week) <= 2;
  box(x, y, w, h, hv ? C.panel3 : C.panel, d.channel === 'hot' ? C.gold : urgent && col >= 2 ? C.red : C.line, 7);
  if (hv) UI.cursor = 'pointer';
  T(s.name, x + 10, y + 14, { s: 13, w: 800, maxW: w - 100 });
  chip(x + w - measure(stageName(d.stage), 10.5, 700) - 38, y + 6, stageName(d.stage), C.dim);
  sectorDot(x + 14, y + 33, s.sector, 4);
  const fit = thesisFit(s);
  T(`${SECTOR_BY_ID[s.sector].name} · ${CITY_BY_ID[s.city].short}`, x + 24, y + 33, { s: 11, c: C.dim, maxW: w - 90 });
  ctx.fillStyle = fit.ok ? C.green : C.red; ctx.beginPath(); ctx.arc(x + w - 14, y + 33, 3.5, 0, 6.3); ctx.fill();
  tip(x + w - 22, y + 26, 16, 14, fit.ok ? 'On-thesis' : 'Off-thesis (counts as drift if you invest): ' + [!fit.stage && 'stage', !fit.sector && 'sector', !fit.geo && 'geography'].filter(Boolean).join(', '));
  if (col >= 1) T(`${fm(rd.ask)} ${rd.safe ? 'cap' : 'pre'} · ${fm(rd.raise)} round`, x + 10, y + 50, { s: 11.5, c: C.text, maxW: w - 20 });
  else T(s.pitch, x + 10, y + 50, { s: 11.5, c: C.dim, maxW: w - 20 });
  // bottom row
  let bx = x + 10;
  if (col >= 1) { const b = buzz(d, s); for (let i = 0; i < 4; i++) { ctx.fillStyle = i < b ? C.amber : C.panel3; ctx.fillRect(bx + i * 7, y + 61, 5, 8); } bx += 32; tip(x + 8, y + 58, 32, 14, d.marketChecked ? `${buzz(d, s)} rival(s) circling` : 'Rough read of rival interest (ask around for exact names).'); }
  const left = rd ? Math.max(0, (col === 4 && d.tsDeadline != null ? d.tsDeadline : rd.end) - G.week) : 0;
  T(`${left}w left`, bx, y + 65, { s: 10.5, c: left <= 2 ? C.red : C.faint, w: left <= 2 ? 700 : 400 }); bx += 46;
  if (d.channel === 'referral') bx += chip(bx, y + 57, 'REF', C.blue, { s: 9.5 }) + 4;
  else if (d.channel === 'hot') bx += chip(bx, y + 57, 'HOT', C.gold, { s: 9.5 }) + 4;
  else if (d.channel === 'resurface') bx += chip(bx, y + 57, 'AGAIN', C.purple, { s: 9.5 }) + 4;
  else if (d.channel === 'scout') bx += chip(bx, y + 57, 'SCOUT', C.teal, { s: 9.5 }) + 4;
  // action buttons
  const can = canAdvance(d);
  let clickedBtn = false;
  if (col < 4) {
    const bw = 40, bxn = x + w - bw - 6;
    if (button('adv' + d.id, bxn, y + 54, bw, 17, '▶' + advanceCost(d), { kind: can.ok ? 'primary' : 'ghost', disabled: !can.ok, why: can.msg, s: 10.5, w: 800, r: 4, tip: `Advance to ${COL_NAMES[col + 1]} (${advanceCost(d)} AP)` })) { act(advanceDeal(d)); clickedBtn = true; }
  }
  if (button('pass' + d.id, x + w - 24, y + 4, 18, 14, '✕', { s: 9, r: 3, tip: 'Pass', kind: 'ghost' })) { passDeal(d); clickedBtn = true; }
  if (!clickedBtn && hv && UI.released && !UI.active) { openDeal(d); }
}

// ---------------------------------------------------------------- deal modal
function dim() { ctx.fillStyle = 'rgba(4,8,13,0.74)'; ctx.fillRect(0, 51, W, H - 51); }

function knowBar(x, y, w, stat, s) {
  const k = s.know[stat];
  T(STAT_SHORT[stat], x, y + 8, { s: 12, w: 700, c: C.text });
  const bx = x + 70, bw = w - 70 - 62;
  box(bx, y + 3, bw, 10, C.bg, C.line, 5);
  if (!k) { T('unknown', bx + bw / 2, y + 8.5, { s: 10, c: C.faint, a: 'center' }); T('?', x + w, y + 8, { s: 12, c: C.faint, a: 'right' }); return; }
  const sd = Math.sqrt(k.v), lo = clamp(k.m - 1.3 * sd, 0, 100), hi = clamp(k.m + 1.3 * sd, 0, 100), col = ratingCol(k.m);
  ctx.globalAlpha = 0.28; ctx.fillStyle = col; ctx.fillRect(bx + bw * lo / 100, y + 4, Math.max(2, bw * (hi - lo) / 100), 8); ctx.globalAlpha = 1;
  ctx.fillStyle = col; ctx.fillRect(bx + bw * k.m / 100 - 1.5, y + 1, 3, 14);
  T(ratingWord(k.m), x + w, y + 8, { s: 11.5, w: 700, c: col, a: 'right' });
  tip(x, y, w, 16, `${STAT_NAMES[stat]}: best guess ${Math.round(k.m)}/100, confidence band ±${Math.round(1.3 * sd)}. Narrow bands mean more evidence.`);
}

function drawDealModal() {
  const d = G.deals.find(z => z.id === S.dealId);
  if (!d) { S.modal = null; return; }
  const s = G.startups[d.sid], rd = s ? s.round : null;
  dim();
  const mx_ = 30, my_ = 58, mw = 1220, mh = 612;
  box(mx_, my_, mw, mh, C.bg2, C.line, 12);
  // header
  T(s.name, mx_ + 22, my_ + 26, { s: 24, w: 900 });
  let hx = mx_ + 34 + measure(s.name, 24, 900);
  hx += chip(hx, my_ + 17, stageName(d.stage) + (rd && rd.safe ? ' · SAFE' : ''), C.gold) + 6;
  sectorDot(hx + 6, my_ + 26, s.sector, 5); hx += 16;
  T(`${SECTOR_BY_ID[s.sector].name} · ${CITY_BY_ID[s.city].name} (${travelInfo(s.city).label.toLowerCase()})`, hx, my_ + 26, { s: 12.5, c: C.dim });
  T(`${s.pitch} — founder ${s.founder.name}`, mx_ + 24, my_ + 52, { s: 12.5, c: C.dim, maxW: 900 });
  if (button('dclose', mx_ + mw - 48, my_ + 12, 34, 30, '✕', { w: 800 })) closeModal();
  const open = d.status === 'open';
  if (!open) {
    panel(mx_ + 330, my_ + 230, 560, 150, null);
    T(d.status === 'closed' ? 'Deal closed — you are in.' : d.status === 'passed' ? 'You passed.' : 'Deal gone.', mx_ + 610, my_ + 270, { s: 20, w: 800, a: 'center', c: d.status === 'closed' ? C.green : C.red });
    T(d.why || '', mx_ + 610, my_ + 305, { s: 13, c: C.dim, a: 'center', maxW: 520 });
    if (button('dok', mx_ + 530, my_ + 335, 160, 34, 'Back to pipeline', { kind: 'primary' })) closeModal();
    return;
  }
  const ly = my_ + 70;
  // ---- left: round + knowledge
  panel(mx_ + 14, ly, 350, 126, 'THE ROUND');
  const left = Math.max(0, (d.col === 4 && d.tsDeadline != null ? d.tsDeadline : rd.end) - G.week);
  if (d.col >= 1) {
    T(`${fm(rd.raise)} ${rd.safe ? 'SAFE round' : 'priced round'}`, mx_ + 28, ly + 40, { s: 14, w: 800 });
    T(`Ask: ${fm(rd.ask)} ${rd.safe ? 'valuation cap' : 'pre-money'}`, mx_ + 28, ly + 62, { s: 12.5 });
    T(`Window: ${left} week${left === 1 ? '' : 's'} left`, mx_ + 28, ly + 82, { s: 12.5, c: left <= 2 ? C.red : C.dim });
    const b = buzz(d, s); T(`Rival interest: ${['none', 'light', 'some', 'heavy', 'frenzy'][b]}`, mx_ + 28, ly + 102, { s: 12.5, c: b >= 3 ? C.amber : C.dim });
  } else T('Screen the deal to see the terms they are asking for.', mx_ + 28, ly + 50, { s: 12.5, c: C.dim, maxW: 310 });
  const fit = thesisFit(s);
  chip(mx_ + 290, ly + 6, fit.ok ? 'ON-THESIS' : 'OFF-THESIS', fit.ok ? C.green : C.red, { s: 9.5 });
  const ky = ly + 136;
  panel(mx_ + 14, ky, 350, 222, 'WHAT YOU KNOW  (noisy estimates)');
  STATS.forEach((st, i) => knowBar(mx_ + 28, ky + 30 + i * 26, 322, st, s));
  const bgTxt = d.bg === 'flags' ? 'FLAGS FOUND' : d.bg === 'clean' ? 'clean' : 'not run';
  T('Background', mx_ + 28, ky + 30 + 6 * 26 + 8, { s: 12, w: 700 }); T(bgTxt, mx_ + 350, ky + 30 + 6 * 26 + 8, { s: 11.5, w: 700, c: d.bg === 'flags' ? C.red : d.bg === 'clean' ? C.green : C.faint, a: 'right' });
  if (G.staff.analysts) { }
  const ry = ky + 232;
  panel(mx_ + 14, ry, 350, mh - (ry - my_) - 14, 'REPORTED BY THE COMPANY');
  if (d.reported) {
    const r = d.reported;
    const rows = [['MRR', fm(r.mrr)], ['Monthly growth', (r.g * 100).toFixed(1) + '%'], ['Net burn / mo', fm(r.burn)], ['Cash', fm(r.cash)], ['Runway', (r.runway > 60 ? '60+' : r.runway.toFixed(0)) + ' mo'], ['Headcount', String(r.hc)]];
    rows.forEach((rw_, i) => { T(rw_[0], mx_ + 28, ry + 34 + i * 20, { s: 12, c: C.dim }); T(rw_[1], mx_ + 350, ry + 34 + i * 20, { s: 12.5, w: 700, a: 'right', mono: true }); });
  } else T('Open the data room to see their numbers (they may be window-dressed).', mx_ + 28, ry + 40, { s: 12, c: C.faint, maxW: 310 });

  // ---- middle: toolkit
  const mx2 = mx_ + 378, mw2 = 420;
  panel(mx2, ly, mw2, 256, 'DILIGENCE TOOLKIT');
  const canTools = d.col >= 3;
  if (!canTools) T('Move the deal to Diligence to unlock', mx2 + mw2 - 14, ly + 17, { s: 11, c: C.amber, a: 'right' });
  TOOL_ORDER.forEach((t, i) => {
    const ti = TOOL_INFO[t], av = toolAvailable(d, t), y = ly + 32 + i * 36;
    const done = t === 'cust' ? (d.tools.cust || 0) : d.tools[t] ? 1 : 0;
    T(ti.name + (t === 'cust' ? ` (${d.tools.cust || 0}/3)` : ''), mx2 + 14, y + 11, { s: 13, w: 700, c: done && t !== 'cust' ? C.green : C.text });
    T(ti.desc, mx2 + 14, y + 27, { s: 10.5, c: C.faint, maxW: 280 });
    const cost = `${ti.ap} AP${ti.cash ? ' · ' + fm(ti.cash) : ''}`;
    if (button('tool' + t, mx2 + mw2 - 108, y + 2, 96, 28, done && t !== 'cust' ? '✓ done' : cost, { kind: av.ok ? 'ghost' : 'ghost', disabled: !av.ok, why: av.msg, s: 11.5, tip: ti.desc })) act(useTool(d, t));
  });
  // HQ
  const hy = ly + 266;
  panel(mx2, hy, mw2, 120, 'HQ VISIT  — ' + travelInfo(s.city).label);
  const ti = travelInfo(s.city);
  T(`${ti.ap} AP per visit${ti.debt ? ` · +${ti.debt} AP lost next week (return flight)` : ''}${ti.rel === 'local' && G.car ? ' · car saves 1 AP' : ''}`, mx2 + 14, hy + 34, { s: 11.5, c: C.dim });
  Object.keys(HQ_FOCUS).forEach((f, i) => {
    const av = hqAvailable(d, f), bx = mx2 + 14 + (i % 2) * 200, by = hy + 46 + Math.floor(i / 2) * 36;
    if (button('hq' + f, bx, by, 192, 32, d.hq[f] ? '✓ ' + HQ_FOCUS[f].name : HQ_FOCUS[f].name, { disabled: !av.ok, why: av.msg, s: 11.5, tip: HQ_FOCUS[f].desc + ' Reveals ' + STAT_NAMES[HQ_FOCUS[f].stat] + ' with little noise.' })) { const r = act(hqVisit(d, f)); if (r && r.ok) S.dealView.hq = { focus: f, t0: UI.t }; }
  });
  if (Object.keys(d.hq).length) { if (button('hqview', mx2 + mw2 - 72, hy + 6, 62, 20, 'Replay', { s: 10.5, r: 4 })) S.dealView.hq = { focus: Object.keys(d.hq).slice(-1)[0], t0: UI.t }; }
  // log
  const lgy = hy + 130, lgh = mh - (lgy - my_) - 14;
  panel(mx2, lgy, mw2, lgh, 'FINDINGS');
  const notes = d.notes.slice().reverse();
  let ch = 6; const hs = notes.map(n => { const hh = Math.max(22, paraH(n.text, mw2 - 114, 12, 16)) + 8; ch += hh; return hh; });
  beginScroll('dlog', mx2 + 4, lgy + 26, mw2 - 8, lgh - 30, ch);
  let yy = lgy + 30;
  notes.forEach((n, i) => {
    chip(mx2 + 12, yy, fitText(n.tag, 76, 9.5, 700), n.kind === 'bad' ? C.red : n.kind === 'good' ? C.green : C.dim, { s: 9.5 });
    P(n.text, mx2 + 100, yy - 2, mw2 - 114, { s: 12, lh: 16, c: n.kind === 'bad' ? '#ffb4b2' : C.text });
    yy += hs[i];
  });
  endScroll('dlog', mx2 + 4, lgy + 26, mw2 - 8, lgh - 30, ch);

  // ---- right: decision
  const rx = mx2 + mw2 + 14, rw = mx_ + mw - rx - 14;
  if (d.col < 4) drawNextStep(d, s, rx, ly, rw, mh - 70 - 14);
  else drawTermBuilder(d, s, rx, ly, rw, mh - 70 - 14);
  if (S.dealView.hq) drawHQScene(d, s);
}

function drawNextStep(d, s, x, y, w, h) {
  panel(x, y, w, h, 'NEXT STEP');
  const c = canAdvance(d), next = COL_NAMES[d.col + 1];
  const blurb = [
    'Skim the deck. Gives you a first, very noisy read on team, product and timing.',
    'Take a founder meeting. Reveals more about the founder, their honesty and the market they are chasing.',
    'Open diligence. Unlocks the data room, references, customer calls, the technical expert, background check and HQ visits.',
    'Prepare a term sheet. Founders will compare you with rivals, so decide how hard to push on price and terms.',
  ][d.col];
  const hh = P(blurb, x + 14, y + 34, w - 28, { s: 12.5, c: C.dim });
  if (d.col === 1 && !c.ok && c.msg && c.msg.includes('reputation')) P('Great founders only take your call at high reputation. A referral lowers the bar.', x + 14, y + 40 + hh, w - 28, { s: 12, c: C.amber });
  if (button('dadv', x + 14, y + h - 150, w - 28, 44, `Move to ${next}`, { kind: 'primary', sub: `${advanceCost(d)} AP`, disabled: !c.ok, why: c.msg, s: 14 })) act(advanceDeal(d));
  if (button('dmkt', x + 14, y + h - 98, w - 28, 34, d.marketChecked ? 'Asked around ✓' : `Ask around about rivals · ${COST.market} AP`, { disabled: d.marketChecked || d.col < 1 || G.ap < 1, why: d.col < 1 ? 'Screen the deal first.' : d.marketChecked ? '' : 'Not enough AP.', s: 12 })) act(marketCheck(d));
  if (button('dpass', x + 14, y + h - 56, w - 28, 34, 'Pass on this deal', { kind: 'danger', s: 12.5 })) { passDeal(d); }
  if (d.col === 3) {
    const cov = diligenceCoverage(d);
    T(`Diligence coverage ${Math.round(cov * 100)}%`, x + 14, y + h - 168, { s: 11.5, c: cov < 0.5 ? C.amber : C.dim });
    tip(x + 14, y + h - 178, w - 28, 20, 'If this turns out to be a fraud, you lose in proportion to what you skipped.');
  }
}

// ---- term sheet builder
function drawTermBuilder(d, s, x, y, w, h) {
  const rd = s.round, t = d.ts || (d.ts = defaultTerms(d));
  panel(x, y, w, h, 'TERM SHEET');
  const lim = checkLimits(d, t);
  t.check = clamp(Math.round(t.check / 5000) * 5000, lim.lo, lim.hi);
  let ry = y + 34;
  const lx = x + 14, cw = w - 28;
  // role
  if (!rd.safe) {
    if (button('tlead', lx, ry, cw / 2 - 3, 28, 'Lead', { kind: t.lead ? 'primary' : 'ghost', s: 12.5, tip: 'Set the price and terms, take a board seat. Needs ≥25% of the round.' })) { t.lead = true; t.board = true; t.prorata = true; }
    if (button('tfol', lx + cw / 2 + 3, ry, cw / 2 - 3, 28, 'Follow', { kind: !t.lead ? 'primary' : 'ghost', s: 12.5, tip: 'Take a smaller slice at someone else\'s price and standard terms (1x non-participating, broad-based anti-dilution).' })) { t.lead = false; t.board = false; t.prorata = false; t.pref = '1x'; t.anti = 'wa'; t.pool = 0.10; }
    ry += 36;
  } else { T('SAFE — converts at the next priced round', lx, ry + 10, { s: 12, c: C.dim }); ry += 26; }
  const pv0 = termsPreview(d, t);
  // valuation
  if (rd.safe || t.lead) {
    T(rd.safe ? `Cap ${fm(rd.ask * t.valPct)}` : `Pre-money ${fm(rd.ask * t.valPct)}`, lx, ry + 8, { s: 12.5, w: 700 });
    T(`${Math.round(t.valPct * 100)}% of ask`, lx + cw, ry + 8, { s: 11.5, c: t.valPct > 1.02 ? C.green : t.valPct < 0.9 ? C.amber : C.dim, a: 'right' });
    t.valPct = slider('tval', lx, ry + 18, cw, t.valPct, 0.6, 1.25, 0.01);
    ry += 40;
  } else { T(`Price set by the lead: ${fm(followPre(d))} pre`, lx, ry + 8, { s: 12.5, w: 700 }); ry += 28; }
  // check
  T(`Check ${fm(t.check)}`, lx, ry + 8, { s: 12.5, w: 700 }); T(`range ${fm(lim.lo)}–${fm(lim.hi)}`, lx + cw, ry + 8, { s: 11, c: C.faint, a: 'right' });
  t.check = slider('tchk', lx, ry + 18, cw, t.check, lim.lo, lim.hi, 5000);
  ry += 40;
  // terms
  if (t.safe) {
    t.mfn = toggle('tmfn', lx, ry, 'MFN clause', t.mfn, { tip: 'If a later SAFE gets a lower cap, yours matches it.' });
    t.disc = toggle('tdisc', lx + 140, ry, '20% discount', !!t.disc, { tip: 'Converts at the lower of the cap and a 20% discount to the round price.' }) ? 0.2 : 0;
    t.prorata = toggle('tpro', lx, ry + 26, 'Pro-rata side letter', t.prorata);
    ry += 54;
  } else if (t.lead) {
    t.board = toggle('tboard', lx, ry, 'Board seat', t.board, { tip: 'Votes on exits and founder replacement, less spin in reports. Costs ~1 AP per quarter.' });
    t.prorata = toggle('tpro', lx + 150, ry, 'Pro-rata rights', t.prorata, { tip: 'Right to keep your percentage in later rounds.' });
    ry += 28;
    const dd = stepper('tpool', lx, ry, cw + 120 - 120, 'Option pool (post)', Math.round(t.pool * 100) + '%', t.pool > 0.08, t.pool < 0.20); if (dd) t.pool = clamp(t.pool + dd * 0.02, 0.08, 0.20);
    ry += 30;
    T('Liquidation preference', lx, ry + 8, { s: 11.5, c: C.dim }); ry += 18;
    if (button('tp1', lx, ry, cw / 2 - 3, 26, '1x non-participating', { kind: t.pref === '1x' ? 'primary' : 'ghost', s: 11 })) t.pref = '1x';
    if (button('tp2', lx + cw / 2 + 3, ry, cw / 2 - 3, 26, 'Participating', { kind: t.pref === 'part' ? 'primary' : 'ghost', s: 11, tip: 'You get your money back AND your share. Founders hate it.' })) t.pref = 'part';
    ry += 32;
    T('Anti-dilution', lx, ry + 8, { s: 11.5, c: C.dim }); ry += 18;
    [['none', 'None'], ['wa', 'Broad-based'], ['ratchet', 'Full ratchet']].forEach((o, i) => { if (button('ta' + o[0], lx + i * (cw / 3), ry, cw / 3 - 3, 26, o[1], { kind: t.anti === o[0] ? 'primary' : 'ghost', s: 11, tip: o[0] === 'ratchet' ? 'Very aggressive: resets your price to any down-round price. Founders may walk.' : '' })) t.anti = o[0]; });
    ry += 34;
  } else {
    T('Standard terms: 1x non-participating, broad-based anti-dilution.', lx, ry + 6, { s: 11, c: C.faint, maxW: cw }); ry += 24;
  }
  // preview
  const pv = termsPreview(d, t), p = winProb(d, t);
  box(lx, ry, cw, 52, C.bg, C.line, 6);
  T(`You own ≈ ${fp(pv.own, 2)} at close`, lx + 10, ry + 14, { s: 12.5, w: 700 });
  T(`${t.safe ? 'cap' : 'post'} ${fm(t.safe ? rd.ask * t.valPct : pv.post)} · cost ${fm(t.check)} + legal ${fm(t.safe ? CASHCOST.legalSafe : CASHCOST.legalPriced)}`, lx + 10, ry + 33, { s: 11, c: C.dim, maxW: cw - 20 });
  ry += 60;
  // founder meter
  const fz = (((d.id * 37) % 11) - 5) * 0.02, pf = d.marketChecked ? p : clamp(p + fz, 0, 1);
  T('Founder mood', lx, ry + 8, { s: 12, c: C.dim }); T(founderMood(pf) + (d.marketChecked ? ` · ${Math.round(p * 100)}%` : ''), lx + cw, ry + 8, { s: 12.5, w: 800, c: pf > 0.55 ? C.green : pf > 0.3 ? C.gold : C.red, a: 'right' });
  bar(lx, ry + 20, cw, 8, pf, pf > 0.55 ? C.green : pf > 0.3 ? C.gold : C.red);
  tip(lx, ry, cw, 30, 'Founders weigh price, terms, your brand, your speed and your value-add against rival offers. Ask around to see the exact odds.');
  ry += 36;
  if (rd.rivals.length && d.marketChecked) {
    rd.rivals.forEach(r => { T(`${r.name}: ~${fm(r.pre)} pre`, lx, ry + 7, { s: 11, c: C.amber, maxW: cw }); ry += 15; });
  } else if (rd.rivals.length) { T(`${buzz(d, s) ? 'Others are circling.' : 'Looks quiet.'} Ask around for names.`, lx, ry + 7, { s: 11, c: C.faint }); ry += 15; }
  const sendY = y + h - 92;
  const budgetOk = t.check <= lim.funds + 1;
  T(`Initial-check budget ${fm(lim.funds)}`, lx, sendY - 8, { s: 11, c: budgetOk ? C.faint : C.red });
  if (button('tsend', lx, sendY + 4, cw, 42, 'Send term sheet', { kind: 'primary', sub: `${COST.send} AP · window ${Math.max(0, (d.tsDeadline != null ? d.tsDeadline : rd.end) - G.week)}w`, disabled: G.ap < COST.send || !budgetOk, why: !budgetOk ? 'Over your initial-check budget (reserves are held back).' : 'Not enough AP.', s: 14 })) {
    const r = sendTermSheet(d, t);
    if (r.ok === false) act(r);
    else if (r.won) { stampFx('SIGNED', C.green); sfx('good'); flash(r.msg, 'good'); }
    else { stampFx('LOST', C.red); sfx('bad'); flash(r.msg, 'bad'); }
  }
  if (button('tpass', lx, sendY + 52, cw / 2 - 3, 28, 'Pass', { kind: 'danger', s: 12 })) passDeal(d);
  if (button('tmkt', lx + cw / 2 + 3, sendY + 52, cw / 2 - 3, 28, d.marketChecked ? 'Asked ✓' : 'Ask around · 1 AP', { disabled: d.marketChecked || G.ap < 1, s: 11.5 })) act(marketCheck(d));
}

// ---- HQ scene
function drawHQScene(d, s) {
  const v = S.dealView.hq; if (!v) return;
  ctx.fillStyle = 'rgba(2,5,9,0.8)'; ctx.fillRect(0, 51, W, H - 51);
  const x0 = 170, y0 = 90, w0 = 940, h0 = 540;
  box(x0, y0, w0, h0, C.bg2, C.gold, 12);
  T(`${s.name} — HQ, ${CITY_BY_ID[s.city].name}`, x0 + 22, y0 + 24, { s: 18, w: 800 });
  T(HQ_FOCUS[v.focus].name, x0 + w0 - 70, y0 + 24, { s: 12.5, c: C.gold, a: 'right', w: 700 });
  if (button('hqx', x0 + w0 - 56, y0 + 10, 40, 28, '✕', {})) { S.dealView.hq = null; return; }
  // scene area
  const sx = x0 + 20, sy = y0 + 46, sw = w0 - 40, sh = 380;
  const r = mkrng(hashStr('hq' + s.id));
  ctx.save(); ctx.beginPath(); ctx.rect(sx, sy, sw, sh); ctx.clip();
  ctx.fillStyle = '#1b2733'; ctx.fillRect(sx, sy, sw, sh);
  ctx.fillStyle = '#243548'; ctx.fillRect(sx, sy + 150, sw, sh - 150);
  ctx.strokeStyle = 'rgba(255,255,255,0.04)'; for (let i = 0; i < 20; i++) { ctx.beginPath(); ctx.moveTo(sx + i * 50, sy + 150); ctx.lineTo(sx + i * 50 - 60, sy + sh); ctx.stroke(); }
  // windows
  for (let i = 0; i < 3; i++) { ctx.fillStyle = '#3b5f86'; ctx.fillRect(sx + 20 + i * 80, sy + 24, 62, 78); ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(sx + 20 + i * 80, sy + 24, 62, 30); }
  // whiteboard
  const wbx = sx + 290, wby = sy + 20, wbw = 330, wbh = 112;
  ctx.fillStyle = '#e9eef2'; ctx.fillRect(wbx, wby, wbw, wbh); ctx.strokeStyle = '#8c9aa6'; ctx.lineWidth = 3; ctx.strokeRect(wbx, wby, wbw, wbh);
  const run = runwayMo(s), hc = headcount(s);
  ctx.font = fontStr(15, 800, true); ctx.fillStyle = '#c0392b'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.fillText(`RUNWAY: ${run > 40 ? '40+' : run.toFixed(0)} MO`, wbx + 16, wby + 26);
  ctx.fillStyle = '#2c3e50'; ctx.font = fontStr(12, 600, true);
  ctx.fillText(`burn ${fm(Math.max(0, netBurn(s)))}/mo`, wbx + 16, wby + 50);
  ctx.fillText(s.h.B > 55 ? 'plan: hire 2, ship v2' : s.h.B > 35 ? 'plan: hire 6?? (see Q3)' : 'plan: ??? → profit?', wbx + 16, wby + 72);
  ctx.strokeStyle = '#2c7a4b'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(wbx + 200, wby + 90); for (let i = 0; i < 6; i++) ctx.lineTo(wbx + 200 + i * 22, wby + 90 - (s.h.P > 50 ? i * 8 : i % 2 * 12)); ctx.stroke();
  // desks
  const desks = clamp(Math.ceil(hc * 1.35) + 2, 6, 18), per = Math.ceil(desks / 3);
  const occupied = Math.min(desks, hc), order = []; for (let i = 0; i < desks; i++) order.push(i);
  for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(rf(r) * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
  const occ = new Set(order.slice(0, occupied));
  for (let i = 0; i < desks; i++) {
    const row = Math.floor(i / per), colI = i % per;
    const dx = sx + 40 + colI * Math.min(110, (sw - 260) / per), dy = sy + 190 + row * 62;
    ctx.fillStyle = '#5a4630'; ctx.fillRect(dx, dy + 18, 70, 12);
    ctx.fillStyle = '#10161c'; ctx.fillRect(dx + 20, dy, 30, 20);
    ctx.fillStyle = occ.has(i) ? '#6fb7ff' : '#26323d'; ctx.fillRect(dx + 22, dy + 2, 26, 14);
    if (occ.has(i)) {
      const slump = s.h.F < 42 ? 4 : 0;
      ctx.fillStyle = ['#d98c5f', '#c9a07a', '#8d5a3b', '#f0c9a0'][ri(r, 0, 3)]; ctx.beginPath(); ctx.arc(dx + 35, dy + 30 + slump, 7, 0, 6.3); ctx.fill();
      ctx.fillStyle = s.h.F > 60 ? '#4cc38a' : s.h.F > 42 ? '#7a8fb5' : '#8a6a6a'; ctx.fillRect(dx + 27, dy + 37 + slump, 16, 14);
    } else { ctx.fillStyle = 'rgba(255,255,255,0.05)'; ctx.fillRect(dx + 8, dy + 20, 54, 4); }
  }
  // trash + plant clues
  if (s.h.B < 40) { ctx.fillStyle = '#6b4f3a'; for (let i = 0; i < 5; i++) ctx.fillRect(sx + 24 + i * 7, sy + sh - 34 - (i % 2) * 6, 6, 12); }
  ctx.fillStyle = s.h.F > 50 ? '#3f8f4f' : '#8a7a3f'; ctx.beginPath(); ctx.arc(sx + sw - 250, sy + 130, 16, 0, 6.3); ctx.fill(); ctx.fillStyle = '#6b4a2f'; ctx.fillRect(sx + sw - 258, sy + 140, 16, 14);
  // product screen (demo)
  const psx = sx + sw - 220, psy = sy + 40;
  ctx.fillStyle = '#0f1419'; ctx.fillRect(psx, psy, 190, 110); ctx.strokeStyle = '#555'; ctx.strokeRect(psx, psy, 190, 110);
  if (s.h.X > 50) { ctx.fillStyle = '#4cc38a'; for (let i = 0; i < 6; i++) ctx.fillRect(psx + 14 + i * 28, psy + 96 - (10 + (i * 37 % 60)), 18, 10 + (i * 37 % 60)); T('LIVE DEMO · OK', psx + 95, psy + 12, { s: 10, c: C.green, a: 'center', mono: true }); }
  else { ctx.fillStyle = '#ef6461'; T('ERROR 500', psx + 95, psy + 50, { s: 14, w: 800, c: C.red, a: 'center', mono: true }); T('works on my machine', psx + 95, psy + 74, { s: 10.5, c: C.dim, a: 'center', mono: true }); }
  // founder
  const fxp = sx + sw - 90, fyp = sy + 250;
  ctx.fillStyle = '#e0b48c'; ctx.beginPath(); ctx.arc(fxp, fyp, 15, 0, 6.3); ctx.fill();
  ctx.fillStyle = '#22262b'; ctx.fillRect(fxp - 15, fyp - 17, 30, 9); // hair
  ctx.fillStyle = s.fraud ? '#6b4a8a' : '#3b6ea5'; ctx.fillRect(fxp - 17, fyp + 15, 34, 46);
  const honest = s.h.I > 48;
  const said = honest ? 'Honest answer: churn is 4%.\nWe are fixing onboarding.' : 'Great question! Actually,\ncan we circle back to that?';
  const bw = 214, bx = fxp - bw - 20, by = fyp - 44;
  ctx.fillStyle = '#f2f5f8'; rrect(bx, by, bw, 50, 8); ctx.fill();
  said.split('\n').forEach((l, i) => T(l, bx + 10, by + 15 + i * 18, { s: 12, c: '#1b2733', w: 600 }));
  ctx.restore();
  // clue summary
  T(`Real headcount: ${hc}${d.reported ? `  (they told you ${d.reported.hc})` : ''}`, x0 + 22, y0 + 446, { s: 13, w: 700 });
  const last = d.notes.filter(n => n.tag === 'HQ visit').slice(-1)[0];
  if (last) P(last.text, x0 + 22, y0 + 462, w0 - 44, { s: 13, c: C.dim });
  T('Hover the scene for clues: the whiteboard, the empty desks, the demo screen and the founder all tell you something.', x0 + 22, y0 + 524, { s: 11, c: C.faint });
  tip(wbx, wby, wbw, wbh, `Whiteboard: runway countdown and burn plan. ${s.h.B < 40 ? 'The plan is… optimistic.' : ''}`);
  tip(sx, sy + 190, sw - 260, 190, `${occupied} of ${desks} desks occupied.${d.reported ? ' They claimed ' + d.reported.hc + ' people.' : ''}`);
  tip(psx, psy, 190, 110, 'The product demo screen.');
  tip(fxp - 110, fyp - 50, 140, 120, `${s.founder.name}. ${s.founder.quirk}.`);
}

function closeModal() { S.modal = null; S.dealView = {}; }
