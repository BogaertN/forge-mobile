#!/usr/bin/env node
/* Print the requirement packet template, or check the in-repo links and the non-model receipt.
 * node tools/verify_req.js
 * node tools/verify_req.js --template */
const path = require('path');
const ROOT = path.join(__dirname, '..');
const RP = require(path.join(ROOT, 'src/req_packet.js'));
if (process.argv.includes('--template')) {
  process.stdout.write(JSON.stringify(RP.TEMPLATE, null, 1) + '\n');
  process.exit(0);
}
const N = require(path.join(ROOT, 'verify/nonllm.js'));
const missing = RP.linksMissing(ROOT);
const rec = N.scan(ROOT);
const out = {
  schema: RP.SCHEMA,
  release: require('fs').readFileSync(path.join(ROOT, 'VERSION'), 'utf8').trim(),
  packets: RP.PACKETS.map(p => ({ release: p.release, requirements: p.requirements.map(r => ({ id: r.id, tests: r.tests.map(t => t.id) })) })),
  links_missing: missing,
  non_llm: rec
};
process.stdout.write(JSON.stringify(out, null, 1) + '\n');
process.exit(missing.length || !rec.ok ? 1 : 0);
