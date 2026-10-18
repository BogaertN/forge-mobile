/* Records the M0 guard-rail baseline (verify/eval_baseline.json) from the last held-out + mutation artifacts. Run deliberately, by hand, after
 *   node verify/heldout_suite.js && node verify/mutation_suite.js
 * and commit the file with a note saying why the baseline moved. The release never rewrites it (verification writes only to the artifact dir). */
const fs = require('fs'), path = require('path'); const E = require('./eval_lib.js');
const h = JSON.parse(fs.readFileSync(path.join(E.VOUT, 'heldout_scores.json'), 'utf8')), m = JSON.parse(fs.readFileSync(path.join(E.VOUT, 'mutation_scores.json'), 'utf8'));
const prev = E.readBaseline() || {}; const note = process.argv.slice(2).join(' ') || 'recorded';
const out = { schema: 'forge-eval-baseline/v1', recorded: note, version: fs.readFileSync(path.join(E.ROOT, 'VERSION'), 'utf8').trim(), history: (prev.history || []).concat([{ note, heldout: h.passed + '/' + h.cases, mutation: m.passed + '/' + m.variants }]),
  heldout: { passed: h.passed, cases: h.cases, rate: h.rate, by_category: h.by_category, passed_ids: h.results.filter(x => x.pass).map(x => x.id) },
  mutation: { passed: m.passed, variants: m.variants, rate: m.rate, by_operator: m.by_operator, passed_ids: m.results.filter(x => x.pass).map(x => x.id) } };
fs.writeFileSync(E.BASELINE_FILE, JSON.stringify(out, null, 1) + '\n'); console.log('baseline held-out ' + h.passed + '/' + h.cases + ', mutation ' + m.passed + '/' + m.variants);
