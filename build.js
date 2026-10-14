// Concatenates src/*.js into a single self-contained index.html (no network, no dependencies).
const fs = require('fs'), path = require('path');
const FILES = ['00_core.js', '10_sim.js', '15_world.js', '20_actions.js', '25_metrics.js', '30_events.js', '40_ui.js', '50_screens_a.js', '55_screens_b.js', '60_main.js'];
const dir = path.join(__dirname, 'src');
const js = FILES.map(f => fs.readFileSync(path.join(dir, f), 'utf8')).join('\n');
if (js.includes('</script>')) throw new Error('source contains </script>');
const html = fs.readFileSync(path.join(dir, 'template.html'), 'utf8').replace('/*__SCRIPT__*/', () => js);
fs.writeFileSync(path.join(__dirname, 'index.html'), html);
console.log(`index.html written (${(html.length / 1024).toFixed(0)} KB)`);
