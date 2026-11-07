/* R4252 (4.9.249): a remembered copula chain has to survive the page's pools.
 *
 * The page hold on "is my pet a dog?" was not the size of the pools. Remember ran
 * before the extended lexicon attached, stored parsed:false, and Ask kept that
 * record. Observe then read "My pet" as a proper name, so the question frame
 * (head pet, owner user) did not unify, and the derived chain stayed intermediate.
 * These checks send the shipped confirmed_shared packs, the starter anchors, a
 * 3113-row anchor pool, irrelevant rows that share the question's concept, and a
 * conflicting relevant fact. The harness does not answer the question.
 */
const A = require('./ask_path.js');
const CLAUSE = 'forge.clause/v1';

function anchorPool() {
  const rows = [];
  for (let i = 0; i < 3113; i++) {
    const n = String(i).padStart(4, '0');
    rows.push({ id: 'anc-dist-' + n, text: 'Record ' + n + ' is a filed note.', concepts: ['N.NOTE'], tier: 'anchor', state: 'anchor', trust: 'trusted' });
  }
  return rows;
}
let ANCHORS = null;
function anchors() { return ANCHORS || (ANCHORS = anchorPool()); }

function distractors() {
  const rows = [];
  for (let i = 0; i < 24; i++) {
    rows.push({ id: 'cs:pet-distractor-' + String(i).padStart(2, '0'), text: 'A listed pet waited on day ' + i + '.', concepts: ['N.PET'], tier: 'confirmed_shared', contributor: 'product_curator' });
  }
  return rows;
}

function freeze(s) {
  for (const row of s.phone) {
    if (row && /my pet is a poodle/i.test(row.text || '')) row.clause = { schema: CLAUSE, text: String(row.text).replace(/[.!?]+$/, ''), parsed: false, calls_llm: false };
  }
}

function register(C, expect) {
  const admitted = row => row && row.product_reply === true && row.echo && row.echo.pass === true && row.echo.method === 'structural_frame' && row.calls_llm !== true && !(row.memory_write && row.memory_write.committed) && typeof row.drift === 'number' && row.drift <= 0.35 && row.outward_compile && row.outward_compile.applied === true;
  function pet(extra) {
    const s = A.session();
    expect(A.remember(s, 'remember that my pet is a poodle').ok && A.remember(s, 'remember that a poodle is a dog').ok);
    freeze(s);
    const n = s.phone.length;
    const row = A.ask(s, 'is my pet a dog?', Object.assign({ anchorRows: anchors(), sharedRows: distractors() }, extra || {}));
    expect(s.phone.length === n, 'ask wrote');
    return row;
  }
  function atomSource(row) {
    const uses = (row.memory_clauses && row.memory_clauses.uses) || [];
    const obs = uses.find(u => u && u.consumer === 'world_model.observe_atoms');
    const hit = ((obs && obs.sample) || []).find(s => /^my pet is a poodle/i.test(s.text || ''));
    return hit && hit.atom_source;
  }
  function preselect(row) {
    return row.preselect || (row.trace && row.trace.preselect) || {};
  }
  C('IS-A-POOL', 'a frozen unparsed remember still chains through the shipped pools and a 3113-row anchor pool', () => {
    const row = pet();
    const pools = preselect(row).pools || [];
    const shared = pools.find(p => p.name === 'confirmed_shared') || {};
    const anc = pools.find(p => p.name === 'anchors') || {};
    const surv = row.world_model && row.world_model.derive && row.world_model.derive.survivor;
    expect(shared.pool >= 3500 && anc.pool >= 3113, JSON.stringify({ shared: shared.pool, anchors: anc.pool }));
    expect(admitted(row) && row.reply === 'Your pet is a poodle. A poodle is a dog. Your pet is a dog.', row.reply);
    expect(surv && surv.how === 'WM-COPULA-CHAIN' && surv.frame_match && surv.frame_match.rule === 'polar', JSON.stringify(surv && { how: surv.how, rule: surv.frame_match && surv.frame_match.rule }));
    expect(atomSource(row) === 'clause', atomSource(row) || 'pet fact was not in the observe sample');
  });
  C('IS-A-POOL', 'the same frozen clause chains with no pools, and the reply matches the full-pool reply', () => {
    const full = pet();
    const s = A.session();
    expect(A.remember(s, 'remember that my pet is a poodle').ok && A.remember(s, 'remember that a poodle is a dog').ok);
    freeze(s);
    const bare = A.ask(s, 'is my pet a dog?', { isolated: true });
    expect(admitted(bare) && bare.reply === full.reply, JSON.stringify({ bare: bare.reply, full: full.reply }));
  });
  C('IS-A-POOL', 'a stored negative of the same atom still holds when the pools are present', () => {
    const s = A.session();
    expect(A.remember(s, 'remember that my pet is a poodle').ok && A.remember(s, 'remember that a poodle is a dog').ok && A.remember(s, 'remember that my pet is not a dog').ok);
    freeze(s);
    const row = A.ask(s, 'is my pet a dog?', { anchorRows: anchors(), sharedRows: distractors() });
    expect(row.product_reply !== true && row.calls_llm !== true, row.reply);
    const d = row.world_model && row.world_model.derive;
    expect(d && d.status === 'conflicted', d && d.status);
  });
  C('IS-A-POOL', 'a sourced relevant negative conflicts, and an unsourced copy stays quarantined', () => {
    const text = 'My pet is not a dog.';
    const base = { id: 'cs:0000000000000000', text, concepts: ['N.PET'], tier: 'confirmed_shared', contributor: 'product_curator' };
    const unsourced = pet({ sharedRows: distractors().concat([base]) });
    const keptU = ((preselect(unsourced).pools || []).find(p => p.name === 'confirmed_shared') || {}).kept || [];
    const factU = ((unsourced.world_model && unsourced.world_model.world && unsourced.world_model.world.facts) || []).find(f => f.text === text);
    expect(keptU.indexOf(base.id) >= 0, JSON.stringify(keptU));
    expect(factU && factU.status === 'quarantined', JSON.stringify(factU && { status: factU.status }));
    expect(admitted(unsourced) && unsourced.reply === 'Your pet is a poodle. A poodle is a dog. Your pet is a dog.', unsourced.reply);
    const sourced = pet({ sharedRows: distractors().concat([Object.assign({}, base, { source_url: 'https://example.test/sources/pet' })]) });
    const keptS = ((preselect(sourced).pools || []).find(p => p.name === 'confirmed_shared') || {}).kept || [];
    expect(keptS.indexOf(base.id) >= 0, JSON.stringify(keptS));
    expect(sourced.product_reply !== true && sourced.calls_llm !== true, sourced.reply);
    const d = sourced.world_model && sourced.world_model.derive;
    expect(d && d.status === 'conflicted', d && d.status);
  });
}
if (require.main === module) {
  const tests = [];
  const expect = (c, why) => { if (!c) throw new Error(why || 'expectation failed'); };
  const C = (cls, name, fn) => tests.push({ cls, name, fn });
  register(C, expect);
  const results = [];
  for (const t of tests) {
    let ok = false, why = '';
    try { t.fn(); ok = true; } catch (e) { why = String(e && e.message || e).slice(0, 800); }
    results.push({ cls: t.cls, name: t.name, ok, why });
  }
  console.log(JSON.stringify(results, null, 1));
  process.exit(results.every(r => r.ok) ? 0 : 1);
}
module.exports = register;
