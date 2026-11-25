/* R4251 (4.9.249): copula is-a on the live Ask path.
 *
 * Old INFERENCE row                                      Live assertion
 * is-a via WordNet hypernyms (Yes + the word WordNet)    still required in verify/run.js; unmet, no lexicon hop is a derive step
 * WordNet is-a grid (pet is a poodle ⇒ dog/animal/…)     same unmet rows, still in verify/run.js
 * is-a not provable → no guess                           live ask does not admit a yes
 * (no separate old row; the chain the WM already had)   membership, subclass, converse, negative, conflict, identity, cycle, provenance
 *
 * Part-of, ancestor, and "lives in" stay out of this batch. Bare "in" is not enclosure.
 */
const A = require('./ask_path.js');
function register(C, expect) {
  const admitted = row => row && row.product_reply === true && row.echo && row.echo.pass === true && row.echo.method === 'structural_frame' && row.calls_llm !== true && !(row.memory_write && row.memory_write.committed) && typeof row.drift === 'number' && row.drift <= 0.35 && row.outward_compile && row.outward_compile.applied === true;
  function turn(mem, q) {
    const s = A.session();
    for (const m of mem) expect(A.remember(s, m).ok, m);
    const n = s.phone.length;
    const row = A.ask(s, q);
    expect(s.phone.length === n, 'ask wrote');
    return row;
  }
  C('IS-A', 'a particular in a kind, and that kind in a class, admits the chain', () => {
    const row = turn(['remember that my pet is a poodle', 'remember that a poodle is a dog'], 'is my pet a dog?');
    const surv = row.world_model.derive.survivor;
    expect(admitted(row) && row.reply === 'Your pet is a poodle. A poodle is a dog. Your pet is a dog.', row.reply);
    expect(surv.how === 'WM-COPULA-CHAIN' && surv.checker_ok === true && surv.frame_match.rule === 'polar', JSON.stringify({ how: surv.how, rule: surv.frame_match && surv.frame_match.rule }));
  });
  C('IS-A', 'subclass hops cite both premises and do not run backwards', () => {
    const row = turn(['remember that a poodle is a dog', 'remember that a dog is an animal'], 'is a poodle an animal?');
    const surv = row.world_model.derive.survivor;
    const texts = (surv.premises || []).map(p => p.text);
    expect(admitted(row) && /A poodle is an animal\.$/.test(row.reply), row.reply);
    expect(texts.join(' | ') === 'A poodle is a dog. | A dog is an animal.', JSON.stringify(texts));
    const back = turn(['remember that a poodle is a dog'], 'is a dog a poodle?');
    expect(back.product_reply === true && /^Not necessarily\./.test(back.reply) && !/^Yes/.test(back.reply) && back.echo.pass === true && back.world_model.derive.survivor.frame_match.rule === 'polar_converse', back.reply);
  });
  C('IS-A', 'a particular membership does not run backwards, and a negative is spoken', () => {
    const back = turn(['remember that my pet is a poodle'], 'is a poodle my pet?');
    expect(back.product_reply !== true || /^Not necessarily\./.test(back.reply || ''), back.reply);
    const neg = turn(['remember that a dog is not a cat'], 'is a dog a cat?');
    expect(admitted(neg) && neg.reply === 'A dog is not a cat.', neg.reply);
  });
  C('IS-A', 'a stated negative conflicts with the positive and nothing is spoken', () => {
    const row = turn(['remember that a poodle is a dog', 'remember that a poodle is not a dog'], 'is a poodle a dog?');
    expect(row.product_reply !== true, row.reply);
  });
  C('IS-A', 'an unrelated kind is not guessed, and a cycle is not an identity', () => {
    const row = turn(['remember that a poodle is a dog'], 'is a sparrow a fish?');
    expect(row.product_reply !== true, row.reply);
    const cycle = turn(['remember that a poodle is a dog', 'remember that a dog is a poodle'], 'is a poodle a poodle?');
    expect(cycle.product_reply !== true, cycle.reply);
  });
  C('IS-A', 'two referring phrases are an identity; a kind is not', () => {
    const idn = turn(['remember that Rex is my dog'], 'is my dog Rex?');
    expect(admitted(idn) && idn.reply === 'Rex is your dog.', idn.reply);
    const kind = turn(['remember that Rex is a dog', 'remember that a dog is not a cat'], 'is Rex a cat?');
    expect(kind.product_reply !== true || /not a cat/.test(kind.reply || ''), kind.reply);
  });
  C('IS-A', 'bare in is location or membership, not enclosure, so it does not chain', () => {
    const place = turn(['remember that Paris is in France', 'remember that France is in Europe'], 'is Paris in Europe?');
    expect(place.product_reply !== true, place.reply);
    const box = turn(['remember that the key is in the box', 'remember that the box is in the drawer'], 'is the key in the drawer?');
    expect(box.product_reply !== true, box.reply);
    const idiom = turn(['remember that she is interested in music', 'remember that music is in the festival'], 'is she interested in the festival?');
    expect(idiom.product_reply !== true, idiom.reply);
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
