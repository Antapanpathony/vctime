// ============================================================================
// MAIN: boot, canvas scaling, input, game loop, save / load
// ============================================================================
const SAVE_KEY = 'termsheet.save.v1';
function localStorage_get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
function localStorage_set(k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } }
const _rep = (k, v) => v === Infinity ? '__inf__' : v;
const _rev = (k, v) => v === '__inf__' ? Infinity : v;
function saveGame(silent) {
  if (!G) return false;
  const ok = localStorage_set(SAVE_KEY, JSON.stringify(G, _rep));
  if (!ok && !silent) flash('Could not save (storage unavailable).', 'bad');
  return ok;
}
function hasSave() { return !!localStorage_get(SAVE_KEY); }
function loadGame() {
  try {
    const g = JSON.parse(localStorage_get(SAVE_KEY), _rev);
    setG(g); g.toasts = []; S.screen = 'game'; S.modal = null; S.scroll = {}; S.selHold = 0; S.endShown = false; S.help = false;
    flash('Game loaded.', 'good');
  } catch (e) { flash('Could not load the save.', 'bad'); }
}

function drainToasts() { if (!G || !G.toasts) return; for (const t of G.toasts) flash(t.t, t.k); G.toasts.length = 0; }
function afterWeek() {
  drainToasts(); sfx('turn');
  if (G.over) { G.queue.length = 0; S.modal = null; S.endShown = false; sfx('good'); }
  saveGame(true);
}
function doEndTurn() { if (!G || G.over || G.queue.length) return; endTurn(); afterWeek(); }
function doSkip(n) { if (!G || G.over || G.queue.length) return; const k = skipWeeks(n); afterWeek(); if (G.queue.length) flash(`Stopped after ${k} week${k === 1 ? '' : 's'}: a decision needs you.`, 'warn'); }

// ---------------------------------------------------------------- canvas / input
let _dpr = 1, _scale = 1, _offX = 0, _offY = 0, _last = 0;
function resize() {
  _dpr = window.devicePixelRatio || 1;
  const w = window.innerWidth, h = window.innerHeight;
  cv.style.width = w + 'px'; cv.style.height = h + 'px';
  cv.width = Math.round(w * _dpr); cv.height = Math.round(h * _dpr);
  _scale = Math.min(w / W, h / H); _offX = (w - W * _scale) / 2; _offY = (h - H * _scale) / 2;
}
function toLogical(e) { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left - _offX) / _scale, (e.clientY - r.top - _offY) / _scale]; }

function topLayer() {
  if (G && G.over && !S.endShown && S.screen === 'game') return 'end';
  if (S.help) return 'help';
  if (S.menu) return 'menu';
  if (G && G.queue.length && S.screen === 'game') return 'event';
  if (S.modal) return 'deal';
  return 'base';
}
function drawGame() {
  const top = topLayer(), off = l => (top !== l ? 1 : 0);
  UI.disabled += off('base');
  drawFrame();
  ({ pipeline: drawPipeline, portfolio: drawPortfolio, fund: drawFund, office: drawOffice, market: drawMarket }[S.tab] || drawPipeline)();
  UI.disabled -= off('base');
  if (S.modal) { UI.disabled += off('deal'); drawDealModal(); UI.disabled -= off('deal'); }
  if (G.queue.length && !G.over) { UI.disabled += off('event'); drawEventModal(); UI.disabled -= off('event'); }
  if (S.menu) { UI.disabled += off('menu'); drawMenu(); UI.disabled -= off('menu'); }
  if (S.help) { UI.disabled += off('help'); drawHelp(); UI.disabled -= off('help'); }
  if (G.over && !S.endShown) drawEnd();
}

function frame(ts) {
  UI.dt = Math.min(0.05, (ts - _last) / 1000); _last = ts; UI.t += UI.dt;
  UI.tips.length = 0; UI.cursor = 'default';
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#080c11'; ctx.fillRect(0, 0, cv.width, cv.height);
  ctx.setTransform(_dpr * _scale, 0, 0, _dpr * _scale, _dpr * _offX, _dpr * _offY);
  ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.clip();
  ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, H);
  try {
    if (S.screen === 'game' && G) { drainToasts(); drawGame(); }
    else { if (!S.setup) initSetup(); drawSetup(); }
    drawToasts(); drawTips();
  } catch (e) { console.error(e); ctx.restore(); ctx.save(); T('Error: ' + e.message, 20, 20, { c: C.red }); window.__lastError = e; }
  ctx.restore();
  UI.pressed = false; UI.released = false; UI.wheel = 0; UI.keyQ.length = UI.focus ? UI.keyQ.length : 0;
  if (!UI.down) UI.active = null;
  UI.ox = 0; UI.oy = 0; UI.clips.length = 0; UI.stack.length = 0; UI.disabled = 0;
  cv.style.cursor = UI.cursor;
  requestAnimationFrame(frame);
}

function onKey(e) {
  if (UI.focus) {
    if (e.key === 'Escape' || e.key === 'Enter') { UI.focus = null; e.preventDefault(); return; }
    if (e.key === 'Backspace' || e.key.length === 1) { UI.keyQ.push(e.key); e.preventDefault(); }
    return;
  }
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (S.screen !== 'game' || !G) return;
  const top = topLayer();
  if (e.key === 'Escape') { if (S.help) S.help = false; else if (S.menu) S.menu = false; else if (S.dealView.hq) S.dealView.hq = null; else if (S.modal) closeModal(); else S.menu = true; e.preventDefault(); return; }
  if (top !== 'base') return;
  if (e.key === ' ' || e.key === 'Enter') { doEndTurn(); e.preventDefault(); }
  else if (e.key >= '1' && e.key <= '5') S.tab = TABS[+e.key - 1][0];
}

function boot() {
  cv = document.getElementById('c'); ctx = cv.getContext('2d');
  resize(); window.addEventListener('resize', resize);
  const upd = e => { const p = toLogical(e); UI.mx = p[0]; UI.my = p[1]; };
  cv.addEventListener('mousemove', upd);
  cv.addEventListener('mousedown', e => { upd(e); UI.down = true; UI.pressed = true; });
  window.addEventListener('mouseup', e => { upd(e); UI.down = false; UI.released = true; });
  cv.addEventListener('mouseleave', () => { UI.mx = -1; UI.my = -1; });
  cv.addEventListener('wheel', e => { UI.wheel += e.deltaY * 0.7; e.preventDefault(); }, { passive: false });
  cv.addEventListener('contextmenu', e => e.preventDefault());
  cv.addEventListener('touchstart', e => { const t = e.changedTouches[0]; upd(t); UI.down = true; UI.pressed = true; e.preventDefault(); }, { passive: false });
  cv.addEventListener('touchmove', e => { upd(e.changedTouches[0]); e.preventDefault(); }, { passive: false });
  cv.addEventListener('touchend', e => { UI.down = false; UI.released = true; e.preventDefault(); }, { passive: false });
  window.addEventListener('keydown', onKey);
  window.addEventListener('beforeunload', () => { if (S.screen === 'game' && G && !G.over) saveGame(true); });
  window.__ts = { get G() { return G; }, S, UI, toPage: (x, y) => { const r = cv.getBoundingClientRect(); return [r.left + _offX + x * _scale, r.top + _offY + y * _scale]; }, api: { startNewGame, doEndTurn, doSkip, openDeal, advanceDeal, useTool, hqVisit, sendTermSheet, defaultTerms, resolveEvent, eventView, loadGame, saveGame, initSetup, newGame, closeModal } };
  requestAnimationFrame(ts => { _last = ts; requestAnimationFrame(frame); });
}
if (typeof document !== 'undefined' && document.getElementById('c')) boot();
