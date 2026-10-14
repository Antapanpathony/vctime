// Browser smoke test: boots index.html in headless Chromium, drives the real UI with the mouse, screenshots each screen.
// usage: node tools/smoke.js [outdir]
const { launch } = require('./browser');
const path = require('path');
const out = process.argv[2] || '/tmp/claude-0/shots';
(async () => {
  const browser = await launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  await page.goto('file://' + path.resolve(__dirname, '..', 'index.html'));
  await page.waitForTimeout(400);
  const click = async (x, y) => { const [px, py] = await page.evaluate(([x, y]) => window.__ts.toPage(x, y), [x, y]); await page.mouse.move(px, py); await page.mouse.down(); await page.waitForTimeout(40); await page.mouse.up(); await page.waitForTimeout(80); };
  const shot = async n => { await page.waitForTimeout(150); await page.screenshot({ path: `${out}/${n}.png` }); };
  const ev = f => page.evaluate(f);
  await shot('01_setup');
  // click "Open Fund I"
  await click(420 + 580 + 110, 648 + 18);
  await page.waitForTimeout(300);
  console.log('screen', await ev(() => window.__ts.S.screen), 'help', await ev(() => window.__ts.S.help));
  await shot('02_help');
  await page.keyboard.press('Escape'); await page.waitForTimeout(100);
  await shot('03_pipeline');
  console.log('deals', await ev(() => window.__ts.G.deals.length));
  // advance first sourced deal via the card button, then open it
  await ev(() => { const G = window.__ts.G; for (const d of G.deals) { d.movedW = -9; } });
  const open = async (col) => { const id = await ev((col) => { const G = window.__ts.G; const d = G.deals.find(d => d.status === 'open' && d.col === col); if (!d) return 0; window.__ts.api.openDeal(d); return d.id; }, col); return id; };
  // walk a deal all the way to term sheet through the API so we can shoot each state
  const did = await ev(() => { const ts = window.__ts, G = ts.G; const d = G.deals.find(d => d.status === 'open' && d.col === 0 && ts.G.startups[d.sid].round.end - G.week > 6) || G.deals[0]; d.movedW = -9; G.rep = 60; ts.api.advanceDeal(d); d.movedW = -9; ts.api.advanceDeal(d); d.movedW = -9; ts.api.advanceDeal(d); ts.api.openDeal(d); return d.id; });
  await shot('04_deal_diligence');
  await ev(() => { const ts = window.__ts, G = ts.G; G.ap = 10; const d = G.deals.find(x => x.id === ts.S.dealId); for (const t of ['data', 'refs', 'cust', 'tech', 'bg']) ts.api.useTool(d, t); ts.api.hqVisit(d, 'qa'); window.__ts.S.dealView.hq = { focus: 'qa', t0: 0 }; });
  await shot('05_hq_scene');
  await ev(() => { window.__ts.S.dealView.hq = null; });
  await shot('06_deal_after_tools');
  await ev(() => { const ts = window.__ts, G = ts.G; G.ap = 10; const d = G.deals.find(x => x.id === ts.S.dealId); d.movedW = -9; ts.api.advanceDeal(d); });
  await shot('07_term_sheet');
  // send via real click
  await click(30 + 378 + 420 + 14 + 14 + 150, 58 + 612 - 92 + 4 + 20);
  await page.waitForTimeout(200);
  await shot('08_after_send');
  console.log('closed deals', await ev(() => window.__ts.G.deals.filter(d => d.status === 'closed').length), 'lost', await ev(() => window.__ts.G.deals.filter(d => d.status === 'lost').length));
  await ev(() => window.__ts.api.closeModal());
  // force a signed deal for the portfolio screens
  await ev(() => { const ts = window.__ts, G = ts.G; G.rep = 95; for (let i = 0; i < 40 && Object.keys(G.hold).length < 3; i++) { const d = G.deals.find(d => d.status === 'open'); if (!d) { ts.api.doEndTurn(); continue; } G.ap = 10; for (let k = 0; k < 4 && d.status === 'open' && d.col < 4; k++) { d.movedW = -9; ts.api.advanceDeal(d); } if (d.status === 'open' && d.col === 4) { G.ap = 10; ts.api.sendTermSheet(d, ts.api.defaultTerms(d)); } while (G.queue.length) { ts.api.resolveEvent(G.queue[0], ts.api.eventView(G.queue[0]).opts.find(o => !o.disabled).id); } ts.api.doEndTurn(); } });
  console.log('holdings', await ev(() => Object.keys(window.__ts.G.hold).length), 'week', await ev(() => window.__ts.G.week));
  for (const [i, tab] of ['pipeline', 'portfolio', 'fund', 'office', 'market'].entries()) { await ev(t => { window.__ts.S.tab = t; }, tab); await page.evaluate(t => { window.__ts.S.tab = t; }, tab); await shot(`1${i}_${tab}`); }
  // skip ahead a lot to trigger events
  for (let i = 0; i < 12; i++) { await ev(() => { const ts = window.__ts; ts.api.doSkip(26); }); const q = await ev(() => window.__ts.G.queue.length); if (q) { await shot('20_event'); break; } }
  console.log('week now', await ev(() => window.__ts.G.week), 'queue', await ev(() => window.__ts.G.queue.length));
  console.log('errors:', errors.length ? errors : 'none');
  await browser.close();
})().catch(e => { console.error('FAIL', e); process.exit(1); });
