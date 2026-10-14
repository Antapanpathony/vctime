// ============================================================================
// METRICS: NAV, TVPI / DPI / net IRR, final scoring
// ============================================================================

// Net IRR: finds the economically meaningful root nearest to 0% (late fee calls can create several sign changes)
function xirr(flows) {
  let hasNeg = false, hasPos = false;
  for (const f of flows) { if (f.a < 0) hasNeg = true; if (f.a > 0) hasPos = true; }
  if (!hasNeg || !hasPos) return null;
  const npv = r => { let t = 0; for (const f of flows) t += f.a / Math.pow(1 + r, f.w / 52); return t; };
  const f0 = npv(0);
  if (Math.abs(f0) < 1) return 0;
  const dir = f0 > 0 ? 1 : -1;
  let prev = 0, fprev = f0;
  for (let i = 1; i <= 400; i++) {
    const r = dir > 0 ? i * 0.01 : -i * 0.0024, fr = npv(r);
    if (fr * fprev <= 0) {
      let lo = Math.min(prev, r), hi = Math.max(prev, r), flo = npv(lo);
      for (let k = 0; k < 50; k++) { const mid = (lo + hi) / 2, fmid = npv(mid); if (flo * fmid <= 0) hi = mid; else { lo = mid; flo = fmid; } }
      return (lo + hi) / 2;
    }
    prev = r; fprev = fr;
  }
  if (dir > 0) return 4;
  // no root (late fee calls after distributions): fall back to a modified IRR from weighted durations
  let neg = 0, pos = 0, tn = 0, tp = 0;
  for (const f of flows) { if (f.a < 0) { neg -= f.a; tn -= f.a * f.w; } else { pos += f.a; tp += f.a * f.w; } }
  const yrs = Math.max(1, (tp / Math.max(1, pos) - tn / Math.max(1, neg)) / 52);
  return Math.max(-0.95, Math.pow(Math.max(0.001, pos / neg), 1 / yrs) - 1);
}

function positionValue(h, final) {
  const s = G.startups[h.sid];
  if (!s) return 0;
  if (s.status === 'public') return publicValue(h);
  const v = holdingMark(h);
  return final ? v * 0.85 : v;
}

function fundMetrics(final) {
  let nav = Math.max(0, G.fundCash);
  for (const h of activeHoldings()) nav += positionValue(h, final);
  const paidIn = Math.max(1, G.called);
  const carryAccrued = CARRY_PCT * Math.max(0, G.dist + nav - paidIn);
  const carryUnpaid = Math.max(0, carryAccrued - G.carryPaid);
  const netNav = nav - carryUnpaid;
  const dpi = (G.dist - G.carryPaid) / paidIn;
  const tvpi = (G.dist - G.carryPaid + netNav) / paidIn;
  const irr = G.week < 52 && !final ? null : xirr(G.flows.concat([{ w: G.week, a: netNav }]));
  return { nav, netNav, paidIn, tvpi, dpi, irr, carryAccrued, carryUnpaid };
}

function scoreFund(m) {
  const irr = m.irr == null ? -0.2 : m.irr;
  const a = clamp(irr / 0.25, 0, 1), b = clamp((m.tvpi - 1) / 2.5, 0, 1), c = clamp(m.dpi / 3, 0, 1);
  const base = 100 * (0.35 * a + 0.35 * b + 0.30 * c);
  const repBonus = clamp((0.6 * G.rep + 0.4 * G.lpTrust) / 100, 0, 1) * 6;
  const score = Math.round(base + repBonus);
  const T = [
    [92, 'S', 'Hall of Fame GP'], [78, 'A', 'Top-decile manager'], [60, 'B', 'Top-quartile manager'],
    [42, 'C', 'Respectable median'], [22, 'D', 'LPs politely stop returning your calls'], [0, 'F', 'The haircut was the best investment you made'],
  ];
  const t = T.find(x => score >= x[0]);
  return { score, base: Math.round(base), repBonus: Math.round(repBonus * 10) / 10, grade: t[1], title: t[2] };
}

// helper summaries for UI
function portfolioRows() {
  const rows = [];
  for (const h of Object.values(G.hold)) {
    const s = G.startups[h.sid]; if (!s) continue;
    const active = h.status === 'active';
    const mark = active ? positionValue(h) : 0;
    rows.push({ h, s, active, mark, moic: (mark + h.realized) / Math.max(1, h.invested), own: ownPct(s, h) });
  }
  rows.sort((a, b) => (b.active - a.active) || (b.mark + b.h.realized) - (a.mark + a.h.realized));
  return rows;
}
