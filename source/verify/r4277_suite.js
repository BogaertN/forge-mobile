/* 4.9.254: one pipeline. Every spoken answer is parse, recall, derive, gate, compile.
 * A question with no derivation holds. These questions are the named checks, not a fit list. */
const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const ROOT = path.join(__dirname, '..');
const LEX = require(ROOT + '/data/lexicon.json');
const EXT = require(ROOT + '/data/lexicon-ext.json');
const K = require(ROOT + '/src/kernel.js');
const FK = require(ROOT + '/src/forge.js');
const Q = require(ROOT + '/src/qframe.js');
const CORE = require(ROOT + '/src/rmc_core.js');
const R2 = require(ROOT + '/src/rmc_renderer_200.js');
const UM = require(ROOT + '/src/user_manual.js');
function forge() { return FK.ForgeKernel({ store: K.MemoryStore(), lexicon: LEX, lexiconExt: EXT, clock: () => '2026-11-26T00:00:00Z' }); }
function ask(q, phone) {
  const f = forge();
  const py = 'import json,sys\nfrom rmc_engine_v1.rmc_core import run\np=json.load(sys.stdin)\nprint(json.dumps(run(p), default=str))';
  const env = Object.assign({}, process.env, { PYTHONPATH: path.join(ROOT, 'engine') + path.delimiter + ROOT });
  const rows = (phone || []).map((t, i) => ({ id: 'p' + i, text: t, source: 'phone_kb', trust: 'trusted' }));
  let payload = { question: q, live: true, memory: { phone: rows, pools: [] } };
  payload = CORE.withClauses(Object.assign({}, payload, { frame: Q.compile(q, f) }), Q, f);
  const r = cp.spawnSync('python3', ['-c', py], { cwd: ROOT, input: JSON.stringify(payload), env, encoding: 'utf8', maxBuffer: 1 << 26 });
  if (r.status !== 0) throw new Error((r.stderr || 'python failed').slice(-400));
  const row = JSON.parse(r.stdout.trim().split('\n').pop());
  return CORE.outwardCompile(row, payload, f, R2, Q);
}
function register(C, expect) {
  C('R4277', 'the manual is the document, and every sentence parses', () => {
    const disk = fs.readFileSync(path.join(ROOT, '..', 'docs', 'USER_MANUAL.md'), 'utf8');
    expect(disk.trim() === UM.TEXT.trim(), 'the runtime text drifted from the document');
    const f = forge();
    const lines = UM.sentences();
    const rows = UM.rows(Q, f);
    expect(lines.length >= 8 && rows.length === lines.length && rows.every(r => r.clause && r.clause.parsed), 'a manual sentence did not parse');
    const self = CORE.withClauses({ question: 'x', memory: {} }, Q, f).memory.self.map(r => r.text);
    expect(self.some(t => /answer a question from a remembered fact/.test(t)) && self.some(t => /hold a claim that a ledger has refuted/.test(t)), 'the two kernel sentences were dropped');
  });
  C('R4277', 'a chain speaks every gate-passing survivor and a where-question fills the place', () => {
    const wren = ask('What is a wren?', ['A wren is a bird.', 'A bird is an animal.']);
    expect(wren.product_reply === true && /A wren is a bird/.test(wren.reply) && /A bird is an animal/.test(wren.reply) && /A wren is an animal/.test(wren.reply), JSON.stringify(wren.reply));
    expect(wren.pipeline && wren.pipeline.stages.join(',') === 'parse,recall,derive,gate,compile' && wren.answer_path === 'derived', JSON.stringify(wren.pipeline));
    const where = ask('Where does my dog live?', ['My dog lives in Denver.', 'My dog is named Rex.']);
    expect(where.product_reply === true && /Denver/.test(where.reply) && where.echo.method === 'structural_frame', JSON.stringify(where.reply));
    const about = ask('Tell me about my dog.', ['My dog lives in Denver.', 'My dog is named Rex.']);
    expect(about.product_reply === true && about.answer_path === 'recalled' && /Denver/.test(about.reply) && /Rex/.test(about.reply), JSON.stringify([about.reply, about.answer_path]));
  });
  C('R4277', 'a negative self-fact is derived, and a question with no derivation holds', () => {
    const no = ask('Do you call a language model?');
    expect(no.product_reply === true && /^No\. /.test(no.reply) && /do not call a language model/.test(no.reply) && no.pipeline.stages.indexOf('compile') === 4, JSON.stringify(no.reply));
    const sky = ask('Why is the sky blue?');
    expect(sky.product_reply !== true && sky.reply == null && sky.pipeline && sky.pipeline.gap === true && sky.pipeline.stages.indexOf('compile') < 0, JSON.stringify([sky.reply, sky.route, sky.pipeline]));
    const doc = fs.readFileSync(path.join(ROOT, '..', 'docs', 'PIPELINE.md'), 'utf8');
    expect(/Parse/.test(doc) && /Recall/.test(doc) && /Gate/.test(doc) && /Compile/.test(doc) && /Bypasses removed/.test(doc), 'pipeline doc');
    expect(fs.readFileSync(path.join(ROOT, 'VERSION'), 'utf8').trim() === '4.9.288', 'VERSION');
  });
}
module.exports = register;
if (require.main === module) {
  const results = [];
  register((cls, name, fn) => { let ok = false, why = ''; try { fn(); ok = true; } catch (e) { why = String(e.message || e).slice(0, 700); } results.push({ cls, name, ok, why }); }, (c, m) => { if (!c) throw new Error(m || 'fail'); });
  console.log(JSON.stringify(results, null, 1));
  if (results.some(r => !r.ok)) process.exit(1);
}
