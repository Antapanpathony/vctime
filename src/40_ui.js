// ============================================================================
// UI TOOLKIT: immediate-mode widgets on Canvas 2D (1280x720 logical space)
// ============================================================================
const W = 1280, H = 720;
const C = {
  bg: '#0d131b', bg2: '#111a24', panel: '#17222e', panel2: '#1e2d3c', panel3: '#26384a', line: '#2c4054', text: '#e0e8f0', dim: '#93a8bc', faint: '#5f768b',
  gold: '#f2b84b', goldD: '#a77a1f', green: '#4cc38a', red: '#ef6461', blue: '#5cb4ff', purple: '#b79cff', amber: '#ffb45c', teal: '#4fd1b5',
};
const FONT = 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
const MONO = 'ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace';

let cv = null, ctx = null;
const UI = {
  mx: -1, my: -1, down: false, pressed: false, released: false, wheel: 0, rightClick: false,
  active: null, disabled: 0, ox: 0, oy: 0, clips: [], tips: [], cursor: 'default', focus: null, keyQ: [],
  t: 0, dt: 0, toasts: [], stamp: null, hover: null, textBuf: {}, stack: [],
};
const S = { screen: 'title', tab: 'pipeline', modal: null, dealId: 0, selHold: 0, scroll: {}, setup: null, hq: null, menu: false, help: false, coldIdx: 0, sound: true, dealView: {}, evSel: null };

// ---------- primitives ----------
function rrect(x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
function box(x, y, w, h, fill, stroke, r) {
  rrect(x, y, w, h, r == null ? 6 : r);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1; ctx.stroke(); }
}
function fontStr(size, weight, mono) { return `${weight || 400} ${size}px ${mono ? MONO : FONT}`; }
const _mc = new Map();
function measure(str, size, weight, mono) {
  const k = size + '|' + weight + '|' + (mono ? 1 : 0) + '|' + str;
  let v = _mc.get(k);
  if (v === undefined) { ctx.font = fontStr(size, weight, mono); v = ctx.measureText(str).width; if (_mc.size > 6000) _mc.clear(); _mc.set(k, v); }
  return v;
}
function fitText(str, maxW, size, weight, mono) {
  if (measure(str, size, weight, mono) <= maxW) return str;
  let lo = 0, hi = str.length;
  while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (measure(str.slice(0, mid) + '…', size, weight, mono) <= maxW) lo = mid; else hi = mid - 1; }
  return str.slice(0, lo) + '…';
}
// T: draw text. y is the vertical middle of the line.
function T(str, x, y, o) {
  o = o || {};
  const size = o.s || 13, weight = o.w || 400;
  str = String(str);
  if (o.maxW) str = fitText(str, o.maxW, size, weight, o.mono);
  ctx.font = fontStr(size, weight, o.mono);
  ctx.fillStyle = o.c || C.text; ctx.textAlign = o.a || 'left'; ctx.textBaseline = 'middle';
  ctx.fillText(str, x, y);
  return measure(str, size, weight, o.mono);
}
function wrapLines(str, maxW, size, weight) {
  const out = [];
  for (const para of String(str).split('\n')) {
    const words = para.split(' '); let line = '';
    for (const wd of words) {
      const t = line ? line + ' ' + wd : wd;
      if (measure(t, size, weight) > maxW && line) { out.push(line); line = wd; } else line = t;
    }
    out.push(line);
  }
  return out;
}
// paragraph: returns height used
function P(str, x, y, w, o) {
  o = o || {}; const size = o.s || 13, lh = o.lh || Math.round(size * 1.45);
  const lines = wrapLines(str, w, size, o.w || 400);
  for (let i = 0; i < lines.length; i++) T(lines[i], x, y + lh * i + lh / 2, { s: size, c: o.c, w: o.w, a: o.a });
  return lines.length * lh;
}
function paraH(str, w, size, lh) { size = size || 13; return wrapLines(str, w, size, 400).length * (lh || Math.round(size * 1.45)); }

function hit(x, y, w, h) {
  if (UI.disabled > 0) return false;
  const ax = x + UI.ox, ay = y + UI.oy;
  if (UI.mx < ax || UI.mx >= ax + w || UI.my < ay || UI.my >= ay + h) return false;
  const c = UI.clips[UI.clips.length - 1];
  if (c && (UI.mx < c[0] || UI.mx >= c[2] || UI.my < c[1] || UI.my >= c[3])) return false;
  return true;
}
function tip(x, y, w, h, text) { if (text && hit(x, y, w, h)) UI.tips.push(text); }

// ---------- widgets ----------
function panel(x, y, w, h, title, o) {
  o = o || {};
  box(x, y, w, h, o.fill || C.panel, o.stroke || C.line, o.r == null ? 8 : o.r);
  if (title) { T(title, x + 14, y + 17, { s: 12, w: 700, c: o.tc || C.dim }); }
}
const BTN = {
  primary: { bg: C.gold, bgH: '#ffcb62', fg: '#1a1305', bd: C.gold },
  ghost: { bg: C.panel2, bgH: C.panel3, fg: C.text, bd: C.line },
  danger: { bg: '#4a2328', bgH: '#62303a', fg: '#ffb4b2', bd: '#7a3a40' },
  good: { bg: '#1c4535', bgH: '#26604a', fg: '#a8f0cc', bd: '#2f7a5c' },
  tab: { bg: 'rgba(0,0,0,0)', bgH: C.panel2, fg: C.dim, bd: 'rgba(0,0,0,0)' },
  tabOn: { bg: C.panel2, bgH: C.panel3, fg: C.text, bd: C.line },
};
function button(id, x, y, w, h, label, o) {
  o = o || {};
  const st = BTN[o.kind || 'ghost'];
  const dis = !!o.disabled;
  const hv = !dis && hit(x, y, w, h);
  let clicked = false;
  if (hv) {
    UI.cursor = 'pointer';
    if (UI.pressed) UI.active = id;
    if (UI.released && UI.active === id) { clicked = true; UI.active = null; }
  }
  if (dis && hit(x, y, w, h) && o.why) UI.tips.push(o.why);
  else if (hv && o.tip) UI.tips.push(o.tip);
  const down = hv && UI.down && UI.active === id;
  ctx.globalAlpha = dis ? 0.42 : 1;
  box(x, y + (down ? 1 : 0), w, h, hv ? st.bgH : st.bg, st.bd, o.r == null ? 6 : o.r);
  if (o.sub) {
    T(label, o.a === 'left' ? x + 12 : x + w / 2, y + h / 2 - 7 + (down ? 1 : 0), { s: o.s || 13, w: 700, c: st.fg, a: o.a === 'left' ? 'left' : 'center', maxW: w - 20 });
    T(o.sub, o.a === 'left' ? x + 12 : x + w / 2, y + h / 2 + 9 + (down ? 1 : 0), { s: 10.5, c: o.kind === 'primary' ? '#4a3a12' : C.dim, a: o.a === 'left' ? 'left' : 'center', maxW: w - 20 });
  } else T(label, o.a === 'left' ? x + 12 : x + w / 2, y + h / 2 + (down ? 1 : 0), { s: o.s || 13, w: o.w || 600, c: st.fg, a: o.a === 'left' ? 'left' : 'center', maxW: w < 44 ? w : w - 16 });
  ctx.globalAlpha = 1;
  if (clicked) sfx('click');
  return clicked;
}
function chip(x, y, label, col, o) {
  o = o || {}; const s = o.s || 10.5;
  const w = measure(label, s, 700) + 12;
  box(x, y, w, 17, o.fill || 'rgba(255,255,255,0.06)', col || C.line, 8);
  T(label, x + w / 2, y + 8.5, { s, w: 700, c: col || C.dim, a: 'center' });
  return w;
}
function bar(x, y, w, h, frac, col, bg) {
  box(x, y, w, h, bg || C.bg, null, h / 2);
  frac = clamp(frac, 0, 1);
  if (frac > 0.001) box(x, y, Math.max(h, w * frac), h, col || C.gold, null, h / 2);
}
function toggle(id, x, y, label, val, o) {
  o = o || {};
  const w = o.w || (measure(label, 12.5, 600) + 36);
  const hv = hit(x, y, w, 22); let ch = false;
  if (hv) { UI.cursor = 'pointer'; if (UI.pressed) UI.active = id; if (UI.released && UI.active === id) { ch = true; UI.active = null; sfx('click'); } }
  if (hv && o.tip) UI.tips.push(o.tip);
  box(x, y + 3, 30, 16, val ? C.green : C.panel3, null, 8);
  ctx.beginPath(); ctx.arc(val ? x + 22 : x + 8, y + 11, 6, 0, 6.3); ctx.fillStyle = '#fff'; ctx.fill();
  T(label, x + 38, y + 11, { s: 12.5, w: 600, c: val ? C.text : C.dim });
  return ch ? !val : val;
}
function slider(id, x, y, w, val, min, max, step, o) {
  o = o || {};
  const hv = hit(x - 6, y - 8, w + 12, 24);
  if (hv) { UI.cursor = 'pointer'; if (UI.pressed) UI.active = id; }
  if (UI.active === id && UI.down) {
    const f = clamp((UI.mx - UI.ox - x) / w, 0, 1);
    val = min + f * (max - min);
    if (step) val = Math.round(val / step) * step;
    val = clamp(val, min, max);
  }
  if (!UI.down && UI.active === id) UI.active = null;
  const f = max > min ? (val - min) / (max - min) : 0;
  box(x, y + 2, w, 6, C.bg, C.line, 3);
  box(x, y + 2, Math.max(6, w * f), 6, o.col || C.gold, null, 3);
  ctx.beginPath(); ctx.arc(x + w * f, y + 5, 8, 0, 6.3); ctx.fillStyle = '#f4f7fa'; ctx.fill(); ctx.strokeStyle = C.line; ctx.stroke();
  return val;
}
// stepper: [-] value [+]
function stepper(id, x, y, w, label, value, canDec, canInc) {
  let d = 0;
  T(label, x, y + 11, { s: 12, c: C.dim });
  if (button(id + '-', x + w - 124, y, 24, 22, '−', { disabled: !canDec, w: 700 })) d = -1;
  T(value, x + w - 72, y + 11, { s: 12.5, w: 700, a: 'center' });
  if (button(id + '+', x + w - 24, y, 24, 22, '+', { disabled: !canInc, w: 700 })) d = 1;
  return d;
}
function input(id, x, y, w, h, value, o) {
  o = o || {};
  const hv = hit(x, y, w, h);
  if (hv) { UI.cursor = 'text'; if (UI.pressed) UI.focus = id; }
  else if (UI.pressed && UI.focus === id) UI.focus = null;
  const foc = UI.focus === id;
  if (foc) {
    for (const k of UI.keyQ) {
      if (k === 'Backspace') value = value.slice(0, -1);
      else if (k.length === 1 && value.length < (o.max || 24) && (!o.re || o.re.test(k))) value += k;
    }
    UI.keyQ.length = 0;
  }
  box(x, y, w, h, C.bg, foc ? C.gold : C.line, 6);
  T(value + (foc && Math.floor(UI.t * 2) % 2 === 0 ? '|' : ''), x + 10, y + h / 2, { s: 13, mono: o.mono, maxW: w - 20 });
  return value;
}
function beginScroll(id, x, y, w, h, contentH) {
  const max = Math.max(0, contentH - h);
  let sc = S.scroll[id] || 0;
  if (hit(x, y, w, h) && UI.wheel) { sc = clamp(sc + UI.wheel, 0, max); UI.wheel = 0; }
  sc = clamp(sc, 0, max); S.scroll[id] = sc;
  ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip(); ctx.translate(0, -sc);
  UI.stack.push([UI.ox, UI.oy]);
  UI.clips.push([x + UI.ox, y + UI.oy, x + w + UI.ox, y + h + UI.oy]);
  UI.oy -= sc;
  return sc;
}
function endScroll(id, x, y, w, h, contentH) {
  UI.clips.pop(); const [ox, oy] = UI.stack.pop(); UI.ox = ox; UI.oy = oy;
  ctx.restore();
  if (contentH > h) {
    const f = h / contentH, sc = S.scroll[id] || 0, max = contentH - h;
    box(x + w - 5, y + 2 + (h - 4) * (sc / max) * (1 - f), 4, Math.max(18, (h - 4) * f), 'rgba(255,255,255,0.18)', null, 2);
  }
}
function lineChart(x, y, w, h, series, o) {
  o = o || {};
  let xmin = o.xmin != null ? o.xmin : Infinity, xmax = o.xmax != null ? o.xmax : -Infinity, ymin = o.ymin != null ? o.ymin : Infinity, ymax = o.ymax != null ? o.ymax : -Infinity;
  for (const s of series) for (const p of s.pts) { if (o.xmin == null) xmin = Math.min(xmin, p[0]); if (o.xmax == null) xmax = Math.max(xmax, p[0]); if (o.ymin == null) ymin = Math.min(ymin, p[1]); if (o.ymax == null) ymax = Math.max(ymax, p[1]); }
  if (!isFinite(xmin)) { xmin = 0; xmax = 1; } if (!isFinite(ymin)) { ymin = 0; ymax = 1; }
  if (xmax <= xmin) xmax = xmin + 1; if (ymax <= ymin) ymax = ymin + 1;
  const px = v => x + 34 + (v - xmin) / (xmax - xmin) * (w - 44), py = v => y + h - 18 - (v - ymin) / (ymax - ymin) * (h - 28);
  ctx.strokeStyle = C.line; ctx.lineWidth = 1;
  const ticks = o.ticks || 4;
  for (let i = 0; i <= ticks; i++) {
    const v = ymin + (ymax - ymin) * i / ticks, yy = py(v);
    ctx.globalAlpha = 0.5; ctx.beginPath(); ctx.moveTo(x + 34, yy); ctx.lineTo(x + w - 10, yy); ctx.stroke(); ctx.globalAlpha = 1;
    T(o.yfmt ? o.yfmt(v) : v.toFixed(1), x + 28, yy, { s: 10, c: C.faint, a: 'right' });
  }
  if (o.hline != null && o.hline > ymin && o.hline < ymax) { ctx.strokeStyle = C.faint; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.moveTo(x + 34, py(o.hline)); ctx.lineTo(x + w - 10, py(o.hline)); ctx.stroke(); ctx.setLineDash([]); }
  const xt = o.xticks || 5;
  for (let i = 0; i <= xt; i++) { const v = xmin + (xmax - xmin) * i / xt; T(o.xfmt ? o.xfmt(v) : Math.round(v), px(v), y + h - 5, { s: 10, c: C.faint, a: 'center' }); }
  for (const s of series) {
    if (!s.pts.length) continue;
    ctx.strokeStyle = s.col; ctx.lineWidth = s.lw || 2; ctx.lineJoin = 'round'; ctx.beginPath();
    s.pts.forEach((p, i) => { const X = px(p[0]), Y = py(clamp(p[1], ymin, ymax)); if (i) ctx.lineTo(X, Y); else ctx.moveTo(X, Y); });
    ctx.stroke();
    const last = s.pts[s.pts.length - 1];
    ctx.fillStyle = s.col; ctx.beginPath(); ctx.arc(px(last[0]), py(clamp(last[1], ymin, ymax)), 3, 0, 6.3); ctx.fill();
  }
}

// ---------- toasts / stamps ----------
function flash(text, kind) { UI.toasts.push({ t: text, k: kind || 'info', born: UI.t }); if (UI.toasts.length > 5) UI.toasts.shift(); }
function stampFx(text, col) { UI.stamp = { text, col, born: UI.t }; }
function drawToasts() {
  let y = 92;
  UI.toasts = UI.toasts.filter(t => UI.t - t.born < 4.2);
  for (const t of UI.toasts) {
    const age = UI.t - t.born, a = age < 0.2 ? age / 0.2 : age > 3.6 ? Math.max(0, 1 - (age - 3.6) / 0.6) : 1;
    const col = t.k === 'good' ? C.green : t.k === 'bad' ? C.red : t.k === 'warn' ? C.amber : C.blue;
    const w = Math.min(420, measure(t.t, 13, 600) + 30);
    ctx.globalAlpha = a;
    box(W - w - 16, y, w, 34, '#0b1118', col, 8);
    ctx.fillStyle = col; ctx.fillRect(W - w - 16, y + 6, 3, 22);
    T(t.t, W - w - 4, y + 17, { s: 13, w: 600, maxW: w - 24 });
    ctx.globalAlpha = 1; y += 40;
  }
  if (UI.stamp) {
    const age = UI.t - UI.stamp.born;
    if (age > 1.6) UI.stamp = null;
    else {
      const a = age < 0.1 ? age / 0.1 : age > 1.2 ? 1 - (age - 1.2) / 0.4 : 1, sc = age < 0.18 ? 1.5 - age / 0.18 * 0.5 : 1;
      ctx.save(); ctx.globalAlpha = a * 0.92; ctx.translate(W / 2, H / 2); ctx.rotate(-0.13); ctx.scale(sc, sc);
      ctx.lineWidth = 6; ctx.strokeStyle = UI.stamp.col; const tw = measure(UI.stamp.text, 64, 900) + 60;
      rrect(-tw / 2, -50, tw, 100, 10); ctx.stroke(); ctx.font = fontStr(64, 900); ctx.fillStyle = UI.stamp.col; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(UI.stamp.text, 0, 3);
      ctx.restore(); ctx.globalAlpha = 1;
    }
  }
}
function drawTips() {
  if (!UI.tips.length) return;
  const text = UI.tips[UI.tips.length - 1];
  const w = Math.min(340, Math.max(...wrapLines(text, 320, 12, 400).map(l => measure(l, 12, 400))) + 20), h = paraH(text, 320, 12, 16) + 14;
  let x = UI.mx + 14, y = UI.my + 16;
  if (x + w > W - 6) x = UI.mx - w - 10; if (y + h > H - 6) y = UI.my - h - 8;
  box(x, y, w, h, '#0a0f15', C.gold, 6);
  P(text, x + 10, y + 7, 320, { s: 12, lh: 16, c: C.text });
}

// ---------- sound ----------
let _ac = null;
function sfx(name) {
  if (!S.sound) return;
  try {
    if (!_ac) _ac = new (window.AudioContext || window.webkitAudioContext)();
    const t0 = _ac.currentTime, seq = { click: [[660, 0.03]], good: [[523, 0.09], [659, 0.09], [784, 0.16]], bad: [[220, 0.14], [165, 0.22]], warn: [[440, 0.08], [440, 0.08]], turn: [[392, 0.05]], stamp: [[196, 0.05], [147, 0.1]] }[name];
    if (!seq) return;
    let t = t0;
    for (const [f, d] of seq) {
      const o = _ac.createOscillator(), g = _ac.createGain();
      o.type = name === 'bad' ? 'sawtooth' : 'triangle'; o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.06, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      o.connect(g); g.connect(_ac.destination); o.start(t); o.stop(t + d + 0.02); t += d;
    }
  } catch (e) { /* audio is optional */ }
}

// ---------- shared drawing helpers ----------
function sectorDot(x, y, sid, r) { ctx.fillStyle = SECTOR_BY_ID[sid].col; ctx.beginPath(); ctx.arc(x, y, r || 4, 0, 6.3); ctx.fill(); }
function ratingWord(m) { return m >= 72 ? 'Strong' : m >= 58 ? 'Good' : m >= 44 ? 'Mixed' : m >= 30 ? 'Weak' : 'Poor'; }
function ratingCol(m) { return m >= 62 ? C.green : m >= 45 ? C.gold : C.red; }
function logCol(k) { return k === 'good' ? C.green : k === 'bad' ? C.red : k === 'warn' ? C.amber : C.faint; }
