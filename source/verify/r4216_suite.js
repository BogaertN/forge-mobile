/* R4216 (4.9.216): the computed trust tier. SymPy, Pint and Pint's pure-Python dependencies are pinned wheels in the Supabase
 * Storage bucket forge-libs (public read, no public write). The phone loads them only when the engine understood a math question
 * and asked for them (needs_libs), checks each wheel's SHA-256 against the shipped manifest before unpacking it, and keeps them in
 * the Cache API for offline use. The engine parses the question with its own grammar (no eval), computes with SymPy (Pint for
 * units), writes a computation receipt as the premise row, and admits the sentence only through the normal gate and a recomputing
 * Echo. No seed answers, no LLM. The service key is never in the client or the repo. */
const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const crypto = require('crypto');
const ROOT = path.join(__dirname, '..');
const tests = [];
const T = (name, fn) => tests.push({ name, fn });
const expect = (c, why) => { if (!c) throw new Error(why || 'expectation failed'); };
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
const py = args => JSON.parse(cp.execFileSync(process.env.PYTHON || 'python3', args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 26 }).trim().split('\n').pop());
let A = null, B = null;
const withLibs = () => (A = A || py(['tools/check_216.py']));
const noLibs = () => (B = B || py(['tools/check_216.py', '--no-libs']));
const byQ = (o, q) => o.rows.find(r => r.question === q);
const LIVE = {
  'What is 17 times 23?': '17 times 23 is 391.',
  'What is 15% of 80?': '15% of 80 is 12.',
  'Solve 2x + 3 = 11': 'Solving 2x + 3 = 11 gives x = 4.',
  'What is the square root of 144?': 'The square root of 144 is 12.',
  'Convert 5 miles to kilometers': '5 miles is 8.04672 kilometers.'
};

T('the five live math questions are computed and admitted through the gate, resting on their own computation receipt', () => {
  const o = withLibs();
  expect(o.libs.sympy === '1.13.3' && o.libs.pint === '0.24.4', 'libs ' + JSON.stringify(o.libs));
  for (const [q, want] of Object.entries(LIVE)) {
    const r = byQ(o, q);
    expect(r.reply === want && r.product_reply === true && r.disposition === 'admit', q + ' ' + JSON.stringify(r));
    expect(r.computed === 'ok' && r.echo === 1 && r.echo_method === 'computed_quantity_reparse' && r.recall_how === 'computation_receipt', q + ' trace ' + JSON.stringify(r));
    expect(r.receipt && r.receipt.schema === 'FORGE-COMPUTATION-RECEIPT/v1' && r.receipt.seeded === false && r.rests_on === r.receipt.receipt_id && /^calc:[0-9a-f]{24}$/.test(r.rests_on), q + ' receipt ' + JSON.stringify(r.receipt));
    expect(r.C >= 0.85 && r.eps < 0.2 && r.calls_llm === false, q + ' C/eps ' + r.C + ' ' + r.eps);
  }
  expect(byQ(o, 'Convert 5 miles to kilometers').receipt.libraries.pint === '0.24.4', 'pint in the receipt');
});
T('more forms: minus, percent-of, two roots, units, parentheses; exact values with an approximation where needed', () => {
  const o = withLibs(); const want = {
    'What is 5 minus 8?': '5 minus 8 is -3.', 'What percent of 80 is 12?': '12 is 15% of 80.', 'solve x^2 = 9': 'Solving x^2 = 9 gives x = -3 or x = 3.',
    'How many feet are in 3 miles?': '3 miles is 15840 feet.', 'What is the square root of 2?': 'The square root of 2 is √(2) ≈ 1.414213562.',
    'Convert 100 fahrenheit to celsius': '100 degrees Fahrenheit is ≈ 37.77777778 degrees Celsius.', 'What is 3 times (4 plus 5)?': '3 times (4 plus 5) is 27.' };
  for (const [q, w] of Object.entries(want)) { const r = byQ(o, q); expect(r.reply === w && r.disposition === 'admit' && r.computed === 'ok', q + ' ' + JSON.stringify(r)); }
});
T('nonsense, ambiguous units, division by zero and oversized results are held with the reason; nothing else answers them', () => {
  const o = withLibs();
  const cases = { 'What is 7 plus banana?': 'MATH-UNPARSED', 'Convert 3 gallons to liters': 'MATH-UNIT-AMBIGUOUS', 'What is 10 divided by 0?': 'MATH-UNDEFINED', 'What is 2^5000?': 'MATH-TOO-LARGE' };
  for (const [q, rule] of Object.entries(cases)) {
    const r = byQ(o, q);
    expect(r.reply === null && r.product_reply === false && r.disposition === 'held' && r.rule === rule && r.fallback === 'ENGINE-CANDIDATE-NO-FALLBACK-COMPUTED', q + ' ' + JSON.stringify(r));
  }
  expect(byQ(o, 'Convert 3 gallons to liters').clarify === 'Which gallon do you mean: US gallon or imperial gallon?', 'gallon clarify');
});
T('regressions: sky blue is admitted from its anchor, "what color is my car" is held, neither touches the computed tier', () => {
  const o = withLibs(); const sky = byQ(o, 'Why is the sky blue?'), car = byQ(o, 'What color is my car?');
  expect(sky.disposition === 'admit' && sky.rests_on === 'enc-nasa-sky-eyes' && sky.computed == null && sky.echo_method === 'question_meaning_coverage', JSON.stringify(sky));
  expect(car.disposition === 'held' && car.reply === null && car.computed == null, JSON.stringify(car));
});
T('a phone row or payload that claims the computed tier is not a premise; Echo rejects a wrong value, another quantity, a missing root', () => {
  const o = withLibs();
  expect(o.forged_row.reply === '17 times 23 is 391.' && o.forged_row.rests_on !== 'forged-calc', 'forged row ' + JSON.stringify(o.forged_row));
  expect(o.forged_payload.reply === '17 times 23 is 391.' && /^calc:/.test(o.forged_payload.rests_on), 'forged payload ' + JSON.stringify(o.forged_payload));
  expect(o.echo_wrong_value.pass === false && o.echo_other_quantity.pass === false && o.echo_other_root.pass === false && o.deterministic === true, 'echo');
});
T('before the wheels load the engine holds the math question and names the library groups it needs (needs_libs)', () => {
  const o = noLibs();
  const m = byQ(o, 'What is 17 times 23?'), c = byQ(o, 'Convert 5 miles to kilometers'), s = byQ(o, 'Why is the sky blue?');
  expect(m.disposition === 'held' && m.reply === null && m.computed === 'needs_libs' && m.rule === 'MATH-LIBS-NOT-LOADED' && JSON.stringify(m.needs_libs) === '["sympy"]', JSON.stringify(m));
  expect(JSON.stringify(c.needs_libs) === '["sympy","pint"]', JSON.stringify(c));
  expect(s.disposition === 'admit', 'sky without libs');
});
T('the grammar never evaluates user text: no eval, exec, sympify or parse_expr in computed_math', () => {
  const src = read('engine/rmc_engine_v1/computed_math.py');
  expect(!/\beval\(|\bexec\(|sympify|sympy_parser|parse_expr\b(?!\()/.test(src.replace(/_parse_expr/g, '')), 'evaluator in computed_math');
  expect(/_AMBIGUOUS/.test(src) && /MAX_EXP/.test(src) && /seeded/.test(src), 'guards');
});
T('the wheel manifest pins exact versions and SHA-256; the shipped copy, the CI lock and the manifest agree', () => {
  const m = JSON.parse(read('data/forge_libs.json')); const PC = require(ROOT + '/src/pycheck.js'); const S = PC.FORGE_LIBS;
  expect(m.schema === 'FORGE-LIBS/v1' && m.bucket === 'forge-libs' && m.pyodide === PC.PYODIDE.version, 'header');
  const want = { sympy: '1.13.3', mpmath: '1.3.0', pint: '0.24.4', flexcache: '0.3', flexparser: '0.4', platformdirs: '4.3.6', typing_extensions: '4.12.2' };
  expect(m.wheels.length === 7 && m.wheels.every(w => want[w.name] === w.version && /-py3-none-any\.whl$/.test(w.file)), 'versions');
  const req = read('engine/requirements-math.txt');
  for (const w of m.wheels) {
    expect(/^[0-9a-f]{64}$/.test(w.sha256) && w.integrity === 'sha256-' + Buffer.from(w.sha256, 'hex').toString('base64'), 'digest ' + w.name);
    expect(w.url === 'https://hqcvywujrygbnaowgwln.supabase.co/storage/v1/object/public/forge-libs/' + w.file, 'url ' + w.name);
    expect(req.indexOf(w.name + '==' + w.version + ' --hash=sha256:' + w.sha256) >= 0, 'requirements ' + w.name);
    const s = S.wheels.find(x => x.name === w.name); expect(s && s.sha256 === w.sha256 && s.url === w.url && s.integrity === w.integrity, 'shipped ' + w.name);
  }
  expect(JSON.stringify(S.groups) === JSON.stringify(m.groups) && JSON.stringify(m.groups.sympy) === '["mpmath","sympy"]', 'groups');
  const lib = path.join(ROOT, '_mathlibs');
  for (const w of m.wheels) { const dist = fs.readdirSync(lib).find(n => n.toLowerCase() === (w.name + '-' + w.version + '.dist-info').toLowerCase()); expect(dist, 'installed ' + w.name); }
});
T('the worker installs a wheel only after its SHA-256 matches, from the Cache API when present, and never from PyPI or the CDN lock', () => {
  const w = read('src/py_worker.js');
  expect(/integrity: w\.integrity/.test(w) && /credentials: 'omit'/.test(w) && /sha256hex\(buf\) !== w\.sha256/.test(w), 'verify');
  expect(w.indexOf('sha256hex(buf) !== w.sha256') < w.indexOf('extractall'), 'verified before unpacking');
  expect(/caches\.open\(cacheName\)/.test(w) && /cache\.delete\(w\.url\)/.test(w), 'cache');
  expect(!/micropip|loadPackage\(\['sympy'\]\)/.test(w), 'old sources');
  expect(/out\.needs_libs/.test(w) && /installLibs\(out\.needs_libs, arg\.libs\)/.test(w), 'lazy install on needs_libs');
  const sw = read('sw.js'); expect(/k !== L && k !== P/.test(sw) && /forge-libs-v1/.test(sw) && /pyodide\/v0\.27\.7\/full\//.test(sw), 'sw keeps the caches');
});
T('the worker installer, run in node with stubs: good wheels install, a changed byte is refused and not cached', async () => {
  const m = JSON.parse(read('data/forge_libs.json')); const vm = require('vm'); const store = new Map(); const ran = [];
  const make = bytes => { const ctx = { console, crypto: globalThis.crypto, Response, TextDecoder, URL, Blob, btoa, importScripts: () => {}, postMessage: () => {},
    caches: { open: async () => ({ match: async u => store.has(u) ? new Response(store.get(u)) : undefined, put: async (u, r) => { store.set(u, Buffer.from(await r.arrayBuffer())); }, delete: async u => { store.delete(u); } }) },
    fetch: async () => new Response(bytes) }; ctx.self = ctx; vm.createContext(ctx); vm.runInContext(read('src/py_worker.js') + '\n;self.__t = { installLibs, setPy: p => { py = p; } };', ctx);
    ctx.__t.setPy({ FS: { mkdirTree() {}, writeFile(p) { ran.push('write ' + p); } }, globals: { set() {} }, runPython(s) { ran.push(s.split('\n')[0]); } }); return ctx.__t; };
  const fake = Buffer.from('wheel bytes'); const hex = crypto.createHash('sha256').update(fake).digest('hex');
  const libs = { cache: 'x', groups: { sympy: ['mpmath'] }, wheels: [{ name: 'mpmath', version: '1', file: 'm.whl', url: 'u', sha256: hex, integrity: 'sha256-' + Buffer.from(hex, 'hex').toString('base64') }] };
  const log = await make(fake).installLibs(['sympy'], libs);
  expect(log.length === 1 && log[0].verified && log[0].from === 'network' && store.has('u') && ran.some(x => /zipfile/.test(x)), 'good ' + JSON.stringify(log));
  const again = await make(Buffer.from('nothing')).installLibs(['sympy'], libs); expect(again[0].from === 'cache', 'from cache');
  store.clear(); ran.length = 0; let err = '';
  try { await make(Buffer.from('wheel bytez')).installLibs(['sympy'], libs); } catch (e) { err = String(e.message); }
  expect(err === 'forge_libs_sha256_mismatch_mpmath' && !store.has('u') && !ran.some(x => /zipfile/.test(x)), 'tampered ' + err);
  expect(m.wheels.length === 7, 'manifest');
});
T('the service key is nowhere in the client, the build, or the repo; the bucket migration is public read with no write policy', () => {
  /* a real service key is a JWT or sb_secret_ value (32+ characters); a shorter value (e.g. a project ref) is public anyway */
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  const files = cp.execFileSync('git', ['ls-files'], { cwd: path.join(ROOT, '..'), encoding: 'utf8' }).split('\n').filter(Boolean).filter(f => !/\.(b64|gz|png|jpg|whl)$/.test(f));
  let hits = 0;
  for (const f of files) { let t = ''; try { t = fs.readFileSync(path.join(ROOT, '..', f), 'utf8'); } catch (e) { continue; } if ((key.length >= 32 && t.indexOf(key) >= 0) || /sb_secret_[A-Za-z0-9]/.test(t) || /SUPABASE_SERVICE_ROLE_KEY\s*[:=]\s*['"][^'"]/.test(t)) hits++; }
  expect(hits === 0, 'key-like text in ' + hits + ' tracked file(s)');
  for (const f of ['src/pycheck.js', 'src/py_worker.js', 'src/rmc_client.js', 'src/app.js', 'sw.js']) expect(!/service_role|SUPABASE_SERVICE/.test(read(f)), 'service text in ' + f);
  const sql = fs.readFileSync(path.join(ROOT, '..', 'supabase/migrations/20261101120000_forge_libs_bucket_216.sql'), 'utf8');
  expect(/'forge-libs'/.test(sql) && /public/.test(sql) && !/create policy/i.test(sql), 'migration');
});
T('verify_live fetches every shipped wheel URL without credentials and requires its pinned SHA-256', () => {
  const v = read('tools/verify_live.js');
  expect(/FORGE_LIBS/.test(v) && /credentials: 'omit'/.test(v) && /sha\(b\) === w\.sha256/.test(v) && /&& wheelsOk/.test(v), 'verify_live wheel check');
});
T('Ask shows the held math reason or the unit question, and the computed receipt id on an admitted answer', () => {
  const app = read('src/app.js');
  expect(/data-computed-held=/.test(app) && /comp\.clarify/.test(app) && /data-computed-receipt=/.test(app), 'app');
});
T('the wheels are not in the shipset and nothing in the build fetches them by a same-origin path', () => {
  const tracked = cp.execFileSync('git', ['ls-files'], { cwd: path.join(ROOT, '..'), encoding: 'utf8' });
  expect(!/\.whl$/m.test(tracked) && !/_mathlibs\//.test(tracked), 'wheel in git');
  expect(/_mathlibs\//.test(read('.gitignore')), 'gitignore');
});
T('CI installs the math wheels with --require-hashes from the same lock before the gate', () => {
  for (const f of ['test.yml', 'pages.yml']) { const y = fs.readFileSync(path.join(ROOT, '..', '.github/workflows', f), 'utf8'); expect(/--require-hashes --no-deps --only-binary :all: --target source\/_mathlibs -r source\/engine\/requirements-math\.txt/.test(y), f); }
});
T('the cold 60 for 4.9.216 is recorded (not tuned)', () => {
  const c = JSON.parse(read('data/cold_216_results.json'));
  expect(/^4\.9\.216$/.test(c.release) && c.tuned === false && c.of === 60 && c.false_admits === 0 && c.calls_llm === false && c.admitted + c.held === 60, JSON.stringify({ a: c.admitted, h: c.held }));
});
T('version registry names 4.9.216', () => {
  expect(/^4\.9\.21[6-9]$/.test(read('VERSION').trim()), 'VERSION');
  expect(JSON.stringify(JSON.parse(read('data/feature_registry.json'))).indexOf('R4216-') >= 0, 'registry');
});
(async () => {
  const rows = []; let failed = 0;
  for (const t of tests) {
    try { await t.fn(); rows.push({ cls: 'R4216', name: t.name, ok: true }); }
    catch (e) { failed++; rows.push({ cls: 'R4216', name: t.name, ok: false, why: String(e && e.message || e).slice(0, 900) }); }
  }
  console.log(JSON.stringify(rows, null, 1));
  process.exit(failed ? 1 : 0);
})();
