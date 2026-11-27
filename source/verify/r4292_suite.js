/* 4.9.289: an ask that finds the engine not ready waits and retries. A thin fallback is not an empty route. */
const path = require('path');
const fs = require('fs');
const ROOT = path.join(__dirname, '..');
const R = require(ROOT + '/src/rmc_client.js');
function register(C, expect) {
  C('R4292', 'a not-ready engine is retried, and a last failure names its route', async () => {
    let calls = 0;
    const row = await R.settle(() => {
      calls += 1;
      if (calls < 3) return Promise.reject(new Error('pyodide_client_missing'));
      return Promise.resolve({ ok: true, product_reply: true, route: 'computed', reply: '19 times 23 is 437.' });
    }, [0, 0, 0, 0]);
    expect(calls === 3 && row.route === 'computed' && row.product_reply === true, JSON.stringify(row));
    const missed = await R.settle(() => Promise.reject(new Error('503')), [0, 0]);
    expect(missed.route === 'engine_unavailable' && missed.fallback === true && missed.product_reply === false, JSON.stringify(missed));
    const src = fs.readFileSync(path.join(ROOT, 'src/app.js'), 'utf8');
    expect(src.indexOf('async function engineReady') >= 0 && src.indexOf('engine_unavailable') >= 0, 'the page waits');
  });
}
module.exports = register;
if (require.main === module) {
  const results = [];
  const pending = [];
  register((cls, name, fn) => { pending.push(Promise.resolve().then(fn).then(() => results.push({ cls, name, ok: true, why: '' })).catch(e => results.push({ cls, name, ok: false, why: String(e.message || e).slice(0, 800) }))); }, (c, m) => { if (!c) throw new Error(m || 'fail'); });
  Promise.all(pending).then(() => { console.log(JSON.stringify(results, null, 1)); if (results.some(r => !r.ok)) process.exit(1); });
}
