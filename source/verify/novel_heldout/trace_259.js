/* Records one admit / use / retract pass for 4.9.259. Not a golden. */
const path = require('path');
const fs = require('fs');
const ROOT = path.join(__dirname, '..', '..');
const Q = require(ROOT + '/src/qframe.js');
const FK = require(ROOT + '/src/forge.js');
const K = require(ROOT + '/src/kernel.js');
const LEX = require(ROOT + '/data/lexicon.json');
const EXT = require(ROOT + '/data/lexicon-ext.json');
const Core = require(ROOT + '/src/rmc_core.js');
const R = require(ROOT + '/src/rmc_client.js');
const L = require(ROOT + '/src/learning.js');
function kernel() {
  return FK.ForgeKernel({ store: K.MemoryStore(), lexicon: LEX, lexiconExt: EXT, clock: () => '2026-11-26T05:00:00Z' });
}
function phone(f, texts) {
  return texts.map((text, i) => {
    const sentence = /[.!?]$/.test(text) ? text : text + '.';
    return { id: 't' + i, text: sentence, clause: Q.clause(sentence, f), tier: 'phone', trust: 'trusted', source: 'phone_kb' };
  });
}
function ask(q, texts) {
  const f = kernel();
  const frame = Q.compile(q, f);
  const payload = Core.withClauses({ question: q, frame, live: true, memory: { phone: phone(f, texts), pools: [] } }, Q, f);
  const row = R.askSync(payload);
  const d = (row.world_model && row.world_model.derive) || {};
  const s = d.survivor || {};
  return {
    q: q,
    reply: row.reply || null,
    product: row.product_reply === true,
    path: row.answer_path || null,
    how: s.how || null,
    coherence: row.coherence,
    echo: row.echo && row.echo.score,
    induced: s.induced || null,
    admitted: L.admittedIds(),
    rules: (L.list().rules || []).map(r => ({ id: r.id, status: r.status, valid_to: r.valid_to || null, deleted: r.deleted, class: r.class, hosted: r.hosted, support: r.support, reason: r.reason }))
  };
}
L.clear();
const base = ['A marten is a mammal.', 'A marten has whiskers.', 'A mink is a mammal.', 'A mink has whiskers.', 'A ferret is a mammal.', 'A ferret has whiskers.', 'A genet is a mammal.', 'The quillon weighs 4.2 kilograms and is 0.62 meters tall and 0.18 meters wide and 0.18 meters deep.'];
const used = ask('Does a genet have whiskers?', base);
const sim = ask('What happens if I push the quillon near the top?', base);
const math = ask('What is 17 percent of 640?', base);
const recalled = ask('Is a genet a mammal?', base);
const retracted = ask('Does a genet have whiskers?', base.concat(['A civet is a mammal.', 'A civet has no whiskers.']));
const ledger = L.ledger().slice(0, 3);
const f = kernel();
const success = Q.clause('A marten has whiskers.', f);
L.clear();
const noted = L.noteCorrection('marten whisker', 'A marten has whiskers.', success);
const bad = L.validateReplay(noted.proposal.id, 'mink', Q.clause('A mink has whiskers.', f));
L.noteCorrection('marten whisker', 'A marten has whiskers.', success);
const good = L.validateReplay(noted.proposal.id, 'mink whisker', Q.clause('A mink has whiskers.', f));
const admittedStatus = good.proposal && good.proposal.status;
const applied = Q.compile('stoat whisker', f);
const gone = L.retractFrame(noted.proposal.id);
const after = Q.compile('stoat whisker', f);
const out = {
  schema: 'forge.learned_trace/v1', not_a_golden: true, version: '4.9.259',
  admit_use: used, simulate: sim, math: math, recall: recalled, retract: retracted,
  ledger: ledger,
  frame: {
    proposed: noted.rule,
    bad_replay: bad.rule,
    admitted: good.rule,
    status: admittedStatus,
    applied: applied && applied.rule,
    archived: gone.proposal && { status: gone.proposal.status, valid_to: gone.proposal.valid_to, deleted: gone.proposal.deleted },
    unused: after && after.parsed
  }
};
const dest = process.argv[2];
if (dest) fs.writeFileSync(dest, JSON.stringify(out, null, 1));
console.log(JSON.stringify({
  use: { product: used.product, reply: used.reply, how: used.how, C: used.coherence, echo: used.echo, id: used.induced && used.induced.id, support: used.induced && used.induced.support },
  sim: { product: sim.product, reply: sim.reply, path: sim.path },
  math: { product: math.product, reply: math.reply, path: math.path },
  recall: { product: recalled.product, reply: recalled.reply, path: recalled.path, how: recalled.how },
  retract: { product: retracted.product, reply: retracted.reply, rule: retracted.rules[0] },
  frame: out.frame
}, null, 1));
