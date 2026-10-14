// Locates Playwright + Chromium for the UI tests (works with a local install, a global install, or CHROMIUM / PLAYWRIGHT_PATH env vars).
const fs = require('fs');
function findPlaywright() {
  const tries = [process.env.PLAYWRIGHT_PATH, 'playwright', '/opt/node22/lib/node_modules/playwright', '/usr/lib/node_modules/playwright', '/usr/local/lib/node_modules/playwright'].filter(Boolean);
  for (const t of tries) { try { return require(t); } catch (e) { /* next */ } }
  throw new Error('Playwright not found. npm i -D playwright, or set PLAYWRIGHT_PATH.');
}
function findChromium() {
  if (process.env.CHROMIUM) return process.env.CHROMIUM;
  for (const p of ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome', '/opt/pw-browsers/chromium/chrome-linux/chrome']) if (fs.existsSync(p)) return p;
  return undefined; // let Playwright use its own download
}
async function launch() { const { chromium } = findPlaywright(); return chromium.launch({ executablePath: findChromium(), args: ['--no-sandbox'] }); }
module.exports = { launch };
