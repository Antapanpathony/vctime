'use strict';
// ============================================================================
// TERM SHEET — core utilities + static data
// RNG state objects are plain {s:uint32} so the whole game state is JSON-safe.
// ============================================================================

// ---------- RNG ----------
function hashStr(str) { let h = 2166136261 >>> 0; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function mkrng(seed) { return { s: seed >>> 0 }; }
function rf(r) { r.s = (r.s + 0x6D2B79F5) >>> 0; let t = r.s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
function rr(r, a, b) { return a + (b - a) * rf(r); }
function ri(r, a, b) { return Math.floor(rr(r, a, b + 1)); }
function rc(r, p) { return rf(r) < p; }
function rp(r, arr) { return arr[Math.floor(rf(r) * arr.length)]; }
function rg(r, m = 0, sd = 1) { let u = 0; while (u === 0) u = rf(r); const v = rf(r); return m + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
function rpois(r, lam) { const L = Math.exp(-lam); let k = 0, p = 1; do { k++; p *= rf(r); } while (p > L && k < 50); return k - 1; }
function rw(r, items, wfn) { let tot = 0; const ws = items.map(it => { const w = Math.max(0, wfn(it)); tot += w; return w; }); if (tot <= 0) return items[Math.floor(rf(r) * items.length)]; let x = rf(r) * tot; for (let i = 0; i < items.length; i++) { x -= ws[i]; if (x <= 0) return items[i]; } return items[items.length - 1]; }

const clamp = (x, a, b) => x < a ? a : x > b ? b : x;
const sigmoid = x => 1 / (1 + Math.exp(-x));
const lerp = (a, b, t) => a + (b - a) * t;
const sum = (arr, f) => arr.reduce((a, x) => a + (f ? f(x) : x), 0);

// ---------- formatting ----------
function fm(n, d) {
  if (n == null || isNaN(n)) return '—';
  const neg = n < 0; n = Math.abs(n);
  let s;
  if (n >= 1e9) s = (n / 1e9).toFixed(d != null ? d : n >= 1e10 ? 1 : 2) + 'B';
  else if (n >= 1e6) s = (n / 1e6).toFixed(d != null ? d : n >= 1e7 ? 1 : 2) + 'M';
  else if (n >= 1e3) s = (n / 1e3).toFixed(d != null ? d : n >= 1e5 ? 0 : 1) + 'k';
  else s = Math.round(n).toString();
  return (neg ? '-$' : '$') + s;
}
const fx = (n, d = 2) => (n == null || isNaN(n)) ? '—' : n.toFixed(d) + 'x';
const fp = (n, d = 0) => (n == null || isNaN(n)) ? '—' : (n * 100).toFixed(d) + '%';

// ---------- calendar ----------
const START_YEAR = 2027;
const FUND_WEEKS = 520;
function dateOf(w) {
  const y = Math.floor(w / 52), wk = w % 52;
  return { year: START_YEAR + y, fy: y + 1, wk: wk + 1, q: Math.floor(wk / 13) + 1 };
}
function dateStr(w) { const d = dateOf(w); return `Y${d.fy} · Q${d.q} · Wk ${d.wk}`; }
function calStr(w) { const d = dateOf(w); return `${START_YEAR + Math.floor(w / 52)} Q${d.q}`; }

// ---------- static data ----------
const SECTORS = [
  { id: 'ai',     name: 'AI / ML',     col: '#b79cff', fraud: 0.07, em: 1.25, period: 330, amp: 0.85, phase: 0.18,
    what: ['AI copilots', 'agent platforms', 'synthetic data', 'LLM eval tooling', 'inference optimisation', 'voice agents', 'AI paralegals'],
    who: ['law firms', 'dentists', 'insurance adjusters', 'logistics teams', 'call centres', 'hospital admins', 'game studios'],
    pre: ['Neuro', 'Cogni', 'Synth', 'Lumen', 'Vector', 'Token', 'Aleph', 'Prism', 'Axon', 'Sage'], suf: ['mind', 'ly', 'ai', 'labs', 'base', 'ware'] },
  { id: 'fin',    name: 'Fintech',     col: '#4fd1b5', fraud: 0.06, em: 1.0, period: 400, amp: 0.55, phase: 0.55,
    what: ['embedded payments', 'invoice financing', 'treasury tooling', 'KYC automation', 'neobank rails', 'expense management'],
    who: ['gig workers', 'SMB merchants', 'freight brokers', 'immigrants sending money home', 'family offices', 'landlords'],
    pre: ['Ledger', 'Mint', 'Coin', 'Pay', 'Vault', 'Cashew', 'Quota', 'Tally', 'Ratio'], suf: ['ly', 'pay', 'fi', 'stack', 'bank', 'hq'] },
  { id: 'clim',   name: 'Climate',     col: '#7fd35f', fraud: 0.05, em: 0.85, period: 460, amp: 0.5, phase: 0.8,
    what: ['carbon accounting', 'grid batteries', 'heat pumps', 'soil sensors', 'green steel', 'EV fleet charging'],
    who: ['utilities', 'farms', 'cement plants', 'landlords', 'shipping lines', 'municipalities'],
    pre: ['Terra', 'Verdant', 'Sol', 'Aero', 'Gaia', 'Ember', 'Tidal', 'Moss', 'Cinder'], suf: ['grid', 'works', 'ly', 'zero', 'cell', 'labs'] },
  { id: 'health', name: 'Healthtech',  col: '#ff8a9b', fraud: 0.06, em: 0.95, period: 380, amp: 0.45, phase: 0.35,
    what: ['remote patient monitoring', 'clinical trial matching', 'billing automation', 'mental health apps', 'diagnostics imaging', 'pharmacy logistics'],
    who: ['clinics', 'payers', 'pharma sponsors', 'rural hospitals', 'nurses', 'caregivers'],
    pre: ['Cura', 'Vita', 'Medi', 'Pulse', 'Hale', 'Nova', 'Clini', 'Remedy', 'Aura'], suf: ['health', 'care', 'ly', 'dx', 'rx', 'labs'] },
  { id: 'saas',   name: 'B2B SaaS',    col: '#5cb4ff', fraud: 0.03, em: 1.0, period: 360, amp: 0.4, phase: 0.05,
    what: ['workflow automation', 'revenue ops', 'procurement software', 'compliance dashboards', 'HR onboarding', 'field-service scheduling'],
    who: ['mid-market ops teams', 'franchise owners', 'recruiters', 'auditors', 'property managers', 'construction crews'],
    pre: ['Flow', 'Stack', 'Orbit', 'Cadence', 'Quorum', 'Beacon', 'Relay', 'Anchor', 'Keystone'], suf: ['hq', 'ly', 'io', 'works', 'desk', 'ops'] },
  { id: 'cons',   name: 'Consumer',    col: '#ffb45c', fraud: 0.05, em: 0.9, period: 290, amp: 0.6, phase: 0.65,
    what: ['social audio', 'creator tools', 'fitness subscriptions', 'micro-games', 'pet telehealth', 'meal kits for one'],
    who: ['Gen Z', 'new parents', 'commuters', 'remote workers', 'hobbyists', 'dog owners'],
    pre: ['Joy', 'Pebble', 'Wink', 'Bloom', 'Zest', 'Nudge', 'Mochi', 'Pip', 'Fable'], suf: ['app', 'ly', 'gram', 'go', 'ie', 'pop'] },
  { id: 'dev',    name: 'Dev Tools',   col: '#e6d86a', fraud: 0.03, em: 1.05, period: 350, amp: 0.4, phase: 0.45,
    what: ['observability', 'edge databases', 'CI acceleration', 'API gateways', 'secrets management', 'feature flagging'],
    who: ['platform teams', 'indie hackers', 'security teams', 'game devs', 'data engineers', 'SREs'],
    pre: ['Byte', 'Kernel', 'Fork', 'Pipe', 'Lambda', 'Rust', 'Hex', 'Shard', 'Null'], suf: ['db', 'ly', 'ctl', 'kit', 'ops', 'base'] },
];
const SECTOR_BY_ID = {}; SECTORS.forEach(s => SECTOR_BY_ID[s.id] = s);

const CITIES = [
  { id: 'sf',  name: 'San Francisco', short: 'SF',  region: 'AM' },
  { id: 'ldn', name: 'London',        short: 'LDN', region: 'EU' },
  { id: 'ber', name: 'Berlin',        short: 'BER', region: 'EU' },
  { id: 'tlv', name: 'Tel Aviv',      short: 'TLV', region: 'EU' },
  { id: 'sg',  name: 'Singapore',     short: 'SIN', region: 'AS' },
  { id: 'sz',  name: 'Shenzhen',      short: 'SZX', region: 'AS' },
  { id: 'blr', name: 'Bangalore',     short: 'BLR', region: 'AS' },
];
const CITY_BY_ID = {}; CITIES.forEach(c => CITY_BY_ID[c.id] = c);
const REGION_NAMES = { AM: 'Americas', EU: 'Europe / ME', AS: 'Asia' };

// bench = ARR needed to raise *this* round; pre/raise = fair round at r=1, neutral market
const STAGES = [
  { id: 'preseed', short: 'Pre-seed', pre: 3.6e6,  raise: 0.9e6, bench: 0,      damp: 1.2, burnMo: 40e3,  weeksOpen: [8, 13] },
  { id: 'seed',    short: 'Seed',     pre: 10e6,   raise: 2.5e6, bench: 150e3,  damp: 1.05, burnMo: 110e3, weeksOpen: [8, 13] },
  { id: 'a',       short: 'Series A', pre: 38e6,   raise: 10e6,  bench: 0.9e6,  damp: 0.95, burnMo: 380e3, weeksOpen: [8, 13] },
  { id: 'b',       short: 'Series B', pre: 130e6,  raise: 28e6,  bench: 3.4e6,  damp: 0.9, burnMo: 1.0e6, weeksOpen: [8, 13] },
  { id: 'c',       short: 'Series C', pre: 360e6,  raise: 65e6,  bench: 10e6,   damp: 0.85, burnMo: 2.4e6, weeksOpen: [8, 13] },
  { id: 'g',       short: 'Growth',   pre: 900e6,  raise: 130e6, bench: 28e6,   damp: 0.8, burnMo: 5e6,   weeksOpen: [8, 13] },
];

const MACRO = {
  bull:   { name: 'Bull market',     col: '#4cc38a', val: 1.2,  exit: 1.3,  ipo: 0.5,  raise: 0.6,  drift: 0.0035, rate: '3.0%' },
  normal: { name: 'Neutral',         col: '#dbe4ee', val: 1.0,  exit: 1.0,  ipo: 0.2,  raise: 0.0,  drift: 0.0008, rate: '4.0%' },
  bear:   { name: 'Bear market',     col: '#f2b84b', val: 0.78, exit: 0.75, ipo: 0.03, raise: -0.6, drift: -0.002, rate: '5.25%' },
  crash:  { name: 'Recession',       col: '#ef6461', val: 0.6,  exit: 0.55, ipo: 0.0,  raise: -1.2, drift: -0.005, rate: '3.5%' },
};
const MACRO_TRANS = { // per quarter
  bull:   { bull: 0.72, normal: 0.20, bear: 0.07, crash: 0.01 },
  normal: { bull: 0.20, normal: 0.62, bear: 0.15, crash: 0.03 },
  bear:   { bull: 0.05, normal: 0.30, bear: 0.50, crash: 0.15 },
  crash:  { bull: 0.0,  normal: 0.30, bear: 0.50, crash: 0.20 },
};

// Rival VC firms (NPCs)
const RIVALS = [
  { id: 'confetti', name: 'Confetti Capital',   style: 'Spray-and-pray seed fund', brand: 32, stages: [0, 1], speed: 0.9, friendly: 0.35, va: 0.1, pay: 0.0 },
  { id: 'lattice',  name: 'Lattice Ventures',   style: 'Top-tier seed / A', brand: 90, stages: [1, 2], speed: 0.5, friendly: 0.1, va: 0.9, pay: -0.05 },
  { id: 'sandhill', name: 'Sandhill & Sons',    style: 'Old-guard A / B, loves a pref', brand: 72, stages: [2, 3], speed: 0.3, friendly: -0.5, va: 0.5, pay: -0.08 },
  { id: 'apex',     name: 'Apex Growth',        style: 'Top-tier growth shop', brand: 96, stages: [3, 5], speed: 0.4, friendly: 0.0, va: 0.7, pay: 0.0 },
  { id: 'goodvibes',name: 'Good Vibes Fund',    style: 'Founder-friendly, conservative price', brand: 52, stages: [0, 2], speed: 0.5, friendly: 0.6, va: 0.8, pay: -0.12 },
  { id: 'hammer',   name: 'Hammerhead Capital', style: 'Pays up, hard terms', brand: 62, stages: [1, 4], speed: 0.8, friendly: -0.6, va: 0.2, pay: 0.14 },
  { id: 'prowl',    name: 'Prowl Crossover',    style: 'Crossover — fast and expensive', brand: 76, stages: [3, 5], speed: 1.0, friendly: -0.1, va: 0.2, pay: 0.18 },
  { id: 'seedling', name: 'Seedling Collective',style: 'Pre-seed accelerator', brand: 46, stages: [0, 0], speed: 0.8, friendly: 0.5, va: 0.6, pay: -0.05 },
  { id: 'northbeam',name: 'Northbeam Partners', style: 'Climate & health specialists', brand: 66, stages: [1, 3], speed: 0.4, friendly: 0.1, va: 0.8, pay: 0.0, sectors: ['clim', 'health'] },
  { id: 'kappa',    name: 'Kappa Partners',     style: 'Fintech & infra specialists', brand: 68, stages: [1, 3], speed: 0.5, friendly: -0.1, va: 0.6, pay: 0.04, sectors: ['fin', 'dev', 'saas'] },
];

// ---------- name / flavour generation ----------
const FIRST = ['Maya', 'Arjun', 'Lena', 'Tomas', 'Priya', 'Noah', 'Yuki', 'Amara', 'Diego', 'Sofia', 'Ravi', 'Hana', 'Jonas', 'Mei', 'Omar', 'Elena', 'Kofi', 'Ingrid', 'Tariq', 'Zoe', 'Wei', 'Nadia', 'Felix', 'Anika', 'Dmitri', 'Camila', 'Idris', 'Sasha', 'Leo', 'Anya'];
const LAST = ['Okafor', 'Lindqvist', 'Chen', 'Banerjee', 'Moreau', 'Haddad', 'Tanaka', 'Novak', 'Reyes', 'Kowalski', 'Adeyemi', 'Silva', 'Park', 'Goldberg', 'Rahman', 'Fischer', 'Mbeki', 'Lund', 'Ito', 'Castillo', 'Bianchi', 'Volkov', 'Nguyen', 'Osei', 'Weiss', 'Sharma', 'Ferreira', 'Kaplan', 'Yilmaz', 'Brandt'];

const QUIRK_BAD_I = ['Name-drops investors who have never heard of them', 'LinkedIn says Stanford. Stanford says otherwise.', "Calls every metric 'directionally accurate'", 'Deck has three different TAM slides', "Insists the numbers were 'audited by a friend'", 'Gets oddly specific about irrelevant details', 'Needs the wire "by Friday, no pressure"'];
const QUIRK_GOOD_I = ['Sends the bad-news email first', 'Shows you the churn tab unprompted', 'Admits what they do not know', 'Introduces you to a customer who complains', 'Keeps a spreadsheet of their own mistakes'];
const QUIRK_GOOD_F = ['Ships weekly and demos live', 'Recruited two ex-FAANG staff on nights and weekends', 'Answers questions before you finish asking', 'Talks to ten customers a week', 'Quiet, but every sentence contains a number'];
const QUIRK_BAD_F = ['Third pivot in five months', 'Has not hired anyone since demo day', 'Delegates everything, including the pitch', 'Reads the deck off the slides', "Cofounder is 'on a spiritual sabbatical'"];
const QUIRK_FLAVOR = ['Cold-brews coffee in the office bathroom', "Sleeps at the office, claims it's 'a choice'", 'Only communicates via voice memos', 'Wears the same hoodie as the logo', 'Has a very good dog named Vesting', 'Has not taken a vacation since 2019', 'Insists on walking meetings', 'Quotes Marcus Aurelius at least twice', 'Treats the cap table like a family tree', 'Brings a whiteboard to coffee'];

// ---------- tuning constants ----------
const AP_BASE = 10;
const FEE_PCT = 0.02, CARRY_PCT = 0.20;
const LIVING_COST_YR = 48000, CAR_COST_YR = 18000, ANALYST_YR = 36000, SCOUT_YR = 15000;
const COST = {
  screen: 1, meet: 1, dd: 1, ts: 1, send: 1, cold: 2, market: 1,
  data: 1, refs: 1, cust: 2, tech: 1, bg: 1,
  hqLocal: 2, hqRegion: 4, hqFar: 5,
  help: { intro: 1, hire: 1, raise: 2, pivot: 2, cust: 1 },
};
const CASHCOST = { tech: 4000, bg: 2500, legalSafe: 2500, legalPriced: 9000 };

const stg = k => STAGES[Math.min(5, Math.max(0, k))];
const stageName = k => k <= 5 ? STAGES[Math.max(0, k)].short : 'Growth ' + (k - 4);
const ratingWord = m => m >= 72 ? 'Strong' : m >= 58 ? 'Good' : m >= 44 ? 'Mixed' : m >= 30 ? 'Weak' : 'Poor';
