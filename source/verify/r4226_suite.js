/* R4226 (4.9.226): meaning follow-up (Nic 2026-11-04, pt141u). After Forge asks "which meaning do you mean?" the reply picks one and the
 * ORIGINAL question is asked again under it. Deterministic; no ask pending means no change; at most FOLLOW_MAX_TRIES asks. */
const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const ROOT = path.join(__dirname, '..');
const tests = [];
const T = (name, fn) => tests.push({ name, fn });
const expect = (c, why) => { if (!c) throw new Error(why || 'expectation failed'); };
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
const K = require(path.join(ROOT, 'src/senses.js'));

const PACK = { lexfiles: ['noun.object', 'noun.person', 'noun.substance', 'noun.attribute', 'noun.group', 'noun.possession', 'noun.time'], lemmas: {
  mercury: [['14669524-n', 2, 0, 'i1', '', 'a heavy silvery toxic univalent and bivalent metal'], ['05021492-n', 3, 0, 'i2', '', 'temperature measured by a mercury thermometer'], ['09585833-n', 1, 1, 'i3', 'Q1', '(Roman mythology) messenger of Jupiter and god of commerce; counterpart of Greek Hermes'], ['09374305-n', 0, 1, 'i4', 'Q2', 'the smallest planet and the nearest to the sun']],
  bank: [['09236472-n', 0, 0, 'a', '', 'sloping land (especially the slope beside a body of water)'], ['08437235-n', 4, 0, 'b', '', 'a financial institution that accepts deposits and channels the money into lending activities'], ['09236341-n', 0, 0, 'c', '', 'a long ridge or pile'], ['08479077-n', 4, 0, 'd', '', 'an arrangement of similar objects in a row'], ['13389491-n', 5, 0, 'e', '', 'a supply or stock held in reserve for future use'], ['13377435-n', 5, 0, 'f', '', 'the funds held by a gambling house']],
  spring: [['15200000-n', 6, 0, 'g', '', 'the season of growth'], ['09000000-n', 0, 0, 'h', '', 'a natural flow of ground water']]
} };
const TABLE = { surfaces: {}, concepts: { 'A.SUN': { surface: 'sun', sense: '09473312-n' }, 'N.WEATHER': { surface: 'sun', sense: '11505767-n' } } };
K.setData(TABLE, PACK);
const merc = () => K.planAsk('What is Mercury?', { admitted: false }, {});
const unitRow = { computed: { status: 'ambiguous_unit', unit: 'gallon', options: ['US gallon', 'imperial gallon'] } };

T('a held ambiguous word asks, with the real meanings, capitalisation narrowing to proper nouns', () => {
  const p = merc();
  expect(p && p.kind === 'sense' && p.options.length === 2 && p.word === 'Mercury', JSON.stringify(p));
  expect(p.options.some(o => o.sense === '09374305-n') && p.options.some(o => o.sense === '09585833-n'), 'planet and god');
  expect(/Which Mercury do you mean\?/.test(K.askText(p, false)) && /1\)/.test(K.askText(p, false)), K.askText(p, false));
});
T('lowercase mercury asks about the common meanings (metal, temperature)', () => {
  const p = K.planAsk('What is mercury?', {}, {});
  expect(p && p.options.length === 2 && p.options.some(o => o.sense === '14669524-n'), JSON.stringify(p && p.options.map(o => o.sense)));
});
T('the reply "the planet" picks the planet and the ORIGINAL question is asked under it', () => {
  const f = K.follow(merc(), 'the planet');
  expect(f.state === 'resolved' && f.option.sense === '09374305-n', JSON.stringify(f));
  expect(f.run.question === 'What is Mercury?' && f.run.sense.sense === '09374305-n' && f.run.sense.word === 'Mercury', JSON.stringify(f.run));
});
T('replies by number, ordinal, gloss fragment and paraphrase all resolve', () => {
  const p = merc(); const planet = '09374305-n', god = '09585833-n';
  const cases = [['2', planet], ['option 2', planet], ['the second one', planet], ['second', planet], ['1', god], ['the first', god], ['last', planet],
    ['the god', god], ['the Roman god', god], ['messenger of Jupiter', god], ['smallest planet', planet], ['the one nearest the sun', planet], ['a world', planet], ['the mythological character', god]];
  for (const [r, want] of cases) {
    const f = K.follow(p, r);
    expect(f.state === 'resolved' && f.option.sense === want, r + ' -> ' + JSON.stringify(f.state === 'resolved' ? f.option.sense : f));
  }
});
T('a reply that is a new question drops the ask and is answered as a new question', () => {
  for (const r of ['What is Venus?', 'how tall is Everest', 'Convert 3 gallons to liters', 'remember that I like tea']) expect(K.follow(merc(), r).state === 'new', r);
});
T('a vague reply is asked about once more, then dropped (never loops)', () => {
  let p = merc(); const f1 = K.follow(p, 'blue');
  expect(f1.state === 'again' && f1.pending.tries === 1 && /still need one meaning/.test(f1.text), JSON.stringify(f1));
  const f2 = K.follow(f1.pending, 'hmm');
  expect(f2.state === 'giveup', JSON.stringify(f2));
  expect(K.FOLLOW_MAX_TRIES === 2, 'max tries');
});
T('after a vague reply a clear one still resolves', () => {
  const f1 = K.follow(merc(), 'yes'); expect(f1.state === 'again', 'again');
  const f2 = K.follow(f1.pending, 'the planet'); expect(f2.state === 'resolved' && f2.option.sense === '09374305-n', JSON.stringify(f2));
});
T('a reply matching two options equally narrows to those two', () => {
  const p = K.planAsk('What is bank?', {}, {}); // 6 senses: too many, no ask
  expect(p === null, 'six senses ask nothing');
  const q = K.planAsk('What is a spring?', {}, {});
  const f = K.follow(q, 'the');
  expect(f.state === 'again', JSON.stringify(f));
});
T('too many meanings, a non-"what is" question, and an already-picked word never ask', () => {
  expect(K.planAsk('What is a bank?', {}, {}) === null, 'bank');
  expect(K.planAsk('Tell me about Mercury', {}, {}) === null, 'shape');
  expect(K.planAsk('What is Mercury?', {}, { sensed: 'Mercury' }) === null, 'sensed word');
  expect(K.planAsk('What is the capital of Peru?', {}, {}) === null, 'capital');
  expect(K.planAsk('What is Mercury?', { computed: { status: 'ok' } }, {}) === null, 'computed ok');
});
T('an ambiguous unit asks, and the reply rewrites the ORIGINAL question with the chosen unit', () => {
  const p = K.planAsk('Convert 3 gallons to liters', unitRow, {});
  expect(p && p.kind === 'unit' && p.options.length === 2 && p.word === 'gallon', JSON.stringify(p));
  expect(K.follow(p, 'US').run.question === 'Convert 3 us gallons to liters', K.follow(p, 'US').run.question);
  expect(K.follow(p, 'the british one').run.question === 'Convert 3 imperial gallons to liters', K.follow(p, 'the british one').run.question);
  expect(K.follow(p, '2').run.question === 'Convert 3 imperial gallons to liters', 'ordinal');
  expect(K.follow(p, 'American').run.question === 'Convert 3 us gallons to liters', 'american');
});
T('unit chains are bounded', () => {
  let p = K.planAsk('x', unitRow, {}); expect(p && p.chain === 1, 'chain 1');
  expect(K.planAsk('x', unitRow, { chain: 3 }) === null, 'chain limit');
});
T('rewriting a unit keeps singular and plural and parentheses are dropped', () => {
  expect(K.rewriteUnit('How many 2 ounces', 'ounce', 'avoirdupois ounce (mass)') === 'How many 2 avoirdupois ounces', K.rewriteUnit('How many 2 ounces', 'ounce', 'avoirdupois ounce (mass)'));
  expect(K.rewriteUnit('Convert 1 gallon to liters', 'gallon', 'US gallon') === 'Convert 1 us gallon to liters', 'singular');
});
T('follow() with nothing pending is a no-op', () => {
  expect(K.follow(null, 'the planet').state === 'new' && K.follow({}, 'x').state === 'new', 'noop');
});
T('the app keeps the ask pending only in memory and changes nothing when none is pending', () => {
  const app = read('src/app.js');
  expect(/let pendingAsk = null;/.test(app), 'pending state');
  expect(/if \(pendingAsk && window\.KSenses && KSenses\.follow\)/.test(app), 'follow only when pending');
  expect(/askCtx\.sense \? \{ sense: askCtx\.sense \} : \{\}/.test(app), 'sense only when picked');
  expect(/if \(!admitted && window\.KSenses && KSenses\.planAsk\)/.test(app), 'admitted answers never ask');
  expect(!/localStorage\.setItem\([^)]*pendingAsk/.test(app) && !/store\.(save|set)\([^)]*pendingAsk/.test(app), 'never stored');
  expect(/let qtext = text; let askCtx = \{\};/.test(app), 'qtext defaults to text');
});
T('the trace, pinning and parity of 4.9.221 are untouched', () => {
  const t = K.trace('What is the Moon?', { surfaces: { moon: [['A.MOON', '09381255-n']] }, concepts: {} }, PACK);
  expect(t.entries.length === 1 && t.entries[0].state === 'pinned', JSON.stringify(t.entries));
});
const pyEnv = Object.assign({}, process.env, { PYTHONPATH: path.join(ROOT, 'engine') });
const unit = cp.spawnSync('python3', [path.join(ROOT, 'tools/test_followup_226.py')], { cwd: ROOT, env: pyEnv, encoding: 'utf8', maxBuffer: 1 << 26 });
let unitRows = [];
try { unitRows = JSON.parse(unit.stdout); } catch (e) { unitRows = [{ name: 'python unit tests ran', ok: false, why: String(unit.stderr || unit.stdout).slice(0, 800) }]; }
for (const r of unitRows) T('engine: ' + r.name, () => expect(r.ok, r.why || r.name));
T('the engine tests ran', () => expect(unit.status === 0 && unitRows.length >= 5, 'python exit ' + unit.status));
T('the engine bundle carries the sense steer', () => {
  const b = read('data/py/rmc_engine_bundle.json'); expect(/exclude_concepts/.test(b), 'bundle has the 4.9.226 preselect');
});
T('the cold 60 is unchanged (21 of 60, 0 false admits, rows identical to 4.9.224)', () => {
  const a = JSON.parse(read('data/cold_224_results.json')); const b = JSON.parse(read('data/cold_226_results.json'));
  expect(b.admitted === 21 && b.false_admits === 0 && b.of === 60 && b.tuned === false, JSON.stringify({ a: b.admitted, f: b.false_admits }));
  const k = r => JSON.stringify([r.n, r.question, r.admitted, r.reply]);
  expect(a.rows.map(k).join('|') === b.rows.map(k).join('|'), 'rows differ from 4.9.224');
});
T('version registry names 4.9.226', () => {
  expect(read('VERSION').trim() === '4.9.233', 'VERSION');
  const reg = JSON.parse(read('data/feature_registry.json'));
  expect(reg.version === '4.9.233' && reg.count === reg.features.length, 'registry');
});

(async () => {
  const rows = []; let failed = 0;
  for (const t of tests) {
    try { await t.fn(); rows.push({ cls: 'R4226', name: t.name, ok: true }); }
    catch (e) { failed++; rows.push({ cls: 'R4226', name: t.name, ok: false, why: String(e.message || e).slice(0, 500) }); }
  }
  console.log(JSON.stringify(rows, null, 1));
  process.exit(failed ? 1 : 0);
})();
