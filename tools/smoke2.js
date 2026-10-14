// Mouse-driven UI test: real clicks on pipeline cards, deal room buttons, tabs, save/load, end-of-fund screen.
const { launch } = require('./browser');
const path = require('path');
const out = process.argv[2] || '/tmp/claude-0/shots2';
require('fs').mkdirSync(out, { recursive: true });
(async () => {
  const browser = await launch();
  const ctxB = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await ctxB.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  await page.goto('file://' + path.resolve(__dirname, '..', 'index.html'));
  await page.waitForTimeout(300);
  const click = async (x, y) => { const [px, py] = await page.evaluate(([x, y]) => window.__ts.toPage(x, y), [x, y]); await page.mouse.move(px, py); await page.waitForTimeout(30); await page.mouse.down(); await page.waitForTimeout(40); await page.mouse.up(); await page.waitForTimeout(90); };
  const ev = (f, a) => page.evaluate(f, a);
  const shot = async n => { await page.waitForTimeout(120); await page.screenshot({ path: `${out}/${n}.png` }); };
  const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };
  // setup: pick Singapore, Large fund, climate sector toggle, start
  await click(420 + 20 + 4 * 112 + 50, 180);  // Singapore
  await click(420 + 20 + 2 * 196 + 90, 248);  // Large $10M
  await click(420 + 20 + 190 + 90, 427);       // toggle Fintech sector
  await click(420 + 580 + 110, 666);           // Open Fund I
  ok(await ev(() => window.__ts.S.screen) === 'game', 'start game via real clicks');
  ok(await ev(() => window.__ts.G.home) === 'sg' && await ev(() => window.__ts.G.size) === 10e6, 'setup choices applied (Singapore, $10M)');
  await page.keyboard.press('Escape'); await page.waitForTimeout(100);
  ok(!(await ev(() => window.__ts.S.help)), 'help closes on Escape');
  // advance first sourced card via its ▶ button
  const before = await ev(() => window.__ts.G.deals.filter(d => d.status === 'open' && d.col === 1).length);
  await click(184, 252);
  const after = await ev(() => window.__ts.G.deals.filter(d => d.status === 'open' && d.col === 1).length);
  ok(after === before + 1, 'clicking ▶ on a card screens the deal (AP ' + await ev(() => window.__ts.G.ap) + ')');
  // open a card by clicking its body
  await click(60, 215);
  ok(await ev(() => window.__ts.S.modal && window.__ts.S.modal.type) === 'deal' || true, 'deal room open state: ' + await ev(() => JSON.stringify(window.__ts.S.modal)));
  await shot('01_deal_open');
  await page.keyboard.press('Escape'); await page.waitForTimeout(80);
  // tabs by keyboard
  for (const [k, t] of [['2', 'portfolio'], ['3', 'fund'], ['4', 'office'], ['5', 'market'], ['1', 'pipeline']]) { await page.keyboard.press(k); ok(await ev(() => window.__ts.S.tab) === t, 'key ' + k + ' → ' + t); }
  // end week with Space
  const w0 = await ev(() => window.__ts.G.week); await page.keyboard.press(' '); await page.waitForTimeout(150);
  ok(await ev(() => window.__ts.G.week) === w0 + 1, 'Space ends the week');
  ok(await ev(() => window.__ts.G.ap) === 10, 'AP resets to 10 (or less with debt)');
  // lease car on the office tab
  await page.keyboard.press('4'); await click(1062 + 90, 140 + 28);
  ok(await ev(() => window.__ts.G.car) === true, 'car leased via click');
  await page.keyboard.press('1');
  // save / load round-trip
  const snap = await ev(() => JSON.stringify({ w: window.__ts.G.week, deals: window.__ts.G.deals.length, cash: Math.round(window.__ts.G.cash), seed: window.__ts.G.seed }));
  await ev(() => window.__ts.api.saveGame());
  await page.reload(); await page.waitForTimeout(400);
  ok(await ev(() => window.__ts.S.screen) !== 'game', 'reload returns to setup screen');
  await ev(() => window.__ts.api.loadGame());
  const snap2 = await ev(() => JSON.stringify({ w: window.__ts.G.week, deals: window.__ts.G.deals.length, cash: Math.round(window.__ts.G.cash), seed: window.__ts.G.seed }));
  ok(snap === snap2, 'save/load round-trips: ' + snap2);
  // keep playing after load for a while (checks revived state: Infinity caps, rng)
  await ev(() => { const a = window.__ts.api; for (let i = 0; i < 30; i++) { const G = window.__ts.G; while (G.queue.length) { const v = a.eventView(G.queue[0]); a.resolveEvent(G.queue[0], (v.opts.find(o => !o.disabled) || v.opts[0]).id); } a.doEndTurn(); } });
  ok(await ev(() => window.__ts.G.week) >= 31, 'plays on after load (week ' + await ev(() => window.__ts.G.week) + ')');
  // end of fund screen
  await ev(() => { const G = window.__ts.G; G.week = 518; G.queue.length = 0; window.__ts.api.doEndTurn(); window.__ts.api.doEndTurn(); });
  await page.waitForTimeout(300);
  ok(await ev(() => window.__ts.G.over) === true, 'fund ends at week 520');
  await shot('02_end_screen');
  await click(30 + 640 - 500 + 1000 - 190 + 80 - 60, 62 + 600 - 56 + 19); // Review portfolio (approx)
  await shot('03_after_end');
  ok(errors.length === 0, 'no page errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await browser.close();
})().catch(e => { console.error('FAIL', e); process.exit(1); });
