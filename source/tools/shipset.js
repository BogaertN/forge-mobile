/* shipset.js: the single list of source files the build ships (used by verify/run.js, build.py and tools/verify_release.js).
 * GENERATED files are written ONLY by build.py into the out-of-tree artifact (never into the tracked tree). */
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const STATIC = ['index.html', 'manifest.json', 'styles.css', 'sw.js', 'data/lexicon.json.gz', 'data/lexicon-ext.json.gz', 'data/WORDNET_LICENSE.txt', 'data/SBOM.json', 'data/command_catalog.json', 'data/feature_registry.json', 'data/py/coherence_math.py', 'icons/icon-192.png', 'icons/icon-512.png', 'vendor/three.module.min.js', 'vendor/cannon-es.js', 'vendor/LICENSE.three.txt', 'vendor/LICENSE.cannon-es.txt'];
const GENERATED = ['src/build-info.js', 'src/release.js', 'src/features.js', 'build-info.json', 'BUILD_MANIFEST.json'];
function list(root) { return STATIC.concat(fs.readdirSync(path.join(root, 'src')).filter(f => f.endsWith('.js') && !GENERATED.includes('src/' + f)).sort().map(f => 'src/' + f)); }
/* hash of every input that shapes the shipped app plus the verifier itself: build.py refuses to build a tree that verification did not see */
function inputs(root) { const v = fs.readdirSync(path.join(root, 'verify')).filter(f => f.endsWith('.js')).sort().map(f => 'verify/' + f); return list(root).concat(v, ['VERSION', 'build.py', 'tools/shipset.js']); }
function treeHash(root) { const h = crypto.createHash('sha256'); for (const f of inputs(root)) h.update(f + '\0' + crypto.createHash('sha256').update(fs.readFileSync(path.join(root, f))).digest('hex') + '\n'); return h.digest('hex'); }
module.exports = { STATIC, GENERATED, list, inputs, treeHash };
if (require.main === module) { const root = path.join(__dirname, '..'); if (process.argv[2] === 'hash') process.stdout.write(treeHash(root)); else process.stdout.write(JSON.stringify(list(root))); }
