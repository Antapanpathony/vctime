// Loads the sim sources (no DOM) into a vm context so we can test/balance headlessly.
const fs = require('fs'), vm = require('vm'), path = require('path');
const SIM_FILES = ['00_core.js', '10_sim.js', '15_world.js', '20_actions.js', '25_metrics.js', '30_events.js'];
function load(extra) {
  const dir = path.join(__dirname, '..', 'src');
  const code = SIM_FILES.map(f => fs.readFileSync(path.join(dir, f), 'utf8')).join('\n');
  const ctx = vm.createContext({ console, Math, Date, JSON, Object, Array, Number, String, Set, Map, Infinity, NaN, isNaN });
  const exp = `;this.api = { get G(){return G;}, setG, newGame, advanceWeek, endTurn, skipWeeks, sourceDeal, genStartup, advanceDeal, canAdvance, passDeal, useTool, hqVisit, marketCheck,
    defaultTerms, termsPreview, winProb, sendTermSheet, checkLimits, termUtility, helpAction, eventView, resolveEvent, eventValid, EVENT_DEFS, fundMetrics, scoreFund, portfolioRows,
    holdingMark, positionValue, activeHoldings, ownPct, fd, arr, growthMo, runwayMo, STAGES, SECTORS, MACRO, dryPowder, generalPowder, thesisFit, rf, rg, ri, mkrng, hashStr, fm, fx, sellPublic, canSellPublic, dealsOf, sellSecondary, diligenceCoverage, exitPayout, equityMark, lastPost, TOOL_ORDER, HQ_FOCUS, coldOutreach, hireAnalyst, toggleCar };` + (extra || '');
  vm.runInContext(code + exp, ctx, { filename: 'sim.js' });
  return ctx.api;
}
module.exports = { load };
