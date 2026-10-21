/* Records verify/heldout/heldout_record.json (4.9.78): needs the PRIVATE held-out set and mutation bases ($FORGE_PRIVATE, default
 * <repo>/../../fm-private). Runs the held-out and mutation suites for real on the current tree, then once more with the top shipped MEA
 * proposal active (the MEA suite re-judges it in CI from this record). Run deliberately, after any change to the kernel inputs (the tree
 * hash covers src/, tracked data, the encoded lexicons and the suites), and commit the record. It never writes the case text. */
const fs = require('fs'), path = require('path'), os = require('os'), cp = require('child_process');
const HR = require('./heldout_record.js'); const ROOT = path.join(__dirname, '..');
if (!HR.privateJSON('heldout.json') || !HR.privateJSON('mutation_bases.json')) { console.error('private held-out set not found in ' + HR.PRIV + ' (set FORGE_PRIVATE)'); process.exit(2); }
const env0 = Object.assign({}, process.env, { FORGE_RECORD: '1' }); delete env0.MEA_MANIFEST; delete env0.MEAK_MANIFEST;
for (const f of ['heldout_suite.js', 'mutation_suite.js']) cp.execFileSync('node', [path.join(__dirname, f)], { env: env0, encoding: 'utf8', maxBuffer: 1 << 26 });
const D = require(ROOT + '/src/mea_data.js'); const top = D.candidates[0]; const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mear-')), mf = path.join(dir, 'm.json'); fs.writeFileSync(mf, JSON.stringify(top.deltas));
const env1 = Object.assign({}, env0, { MEA_MANIFEST: mf, MEA_OUT: dir }); const pre = path.join(ROOT, 'tools', 'mea_preload.js');
for (const f of ['heldout_suite.js', 'mutation_suite.js']) cp.execFileSync('node', ['-r', pre, path.join(__dirname, f)], { env: env1, encoding: 'utf8', maxBuffer: 1 << 26 });
fs.rmSync(dir, { recursive: true, force: true });
const r = HR.readRecord(); const hp = r.heldout.cases.filter(x => x.pass).length, mp = r.mutation.variants.filter(x => x.pass).length;
console.log('recorded tree ' + r.tree_sha256.slice(0, 12) + ': held-out ' + hp + '/' + r.heldout.cases.length + ', mutation ' + mp + '/' + r.mutation.variants.length + ', manifests ' + Object.keys(r.manifests || {}).length);
