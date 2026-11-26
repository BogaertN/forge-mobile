/* Node dispatch for the same MuJoCo / RDKit / ngspice worker the phone runs.
 * The worker measures. Python still classifies and seals. No model. */
'use strict';
if (typeof global.self === 'undefined') global.self = global;
if (typeof global.caches === 'undefined') {
  global.caches = { open: async () => ({ match: async () => null, put: async () => {}, delete: async () => {} }) };
}
const { dispatch } = require('./sim_wasm_worker.js');
async function main() {
  const body = JSON.parse(require('fs').readFileSync(0, 'utf8') || '{}');
  const out = await dispatch(body.cmd, body.arg, body.local || null);
  process.stdout.write(JSON.stringify(out));
}
if (require.main === module) {
  main().catch(err => { process.stderr.write(String(err && err.stack || err)); process.exit(1); });
}
module.exports = { dispatch };
