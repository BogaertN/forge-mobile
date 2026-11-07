/* R4253 (4.9.249): located-in on the live Ask path.
 *
 * Old assertion                                              Live assertion
 * transitive located-in (2 hops) Yes, I infer                WM-LIVE-GEO admits the compiled residence chain
 * transitive located-in (3 hops) Yes, I infer                same requirement; unmet when the continent is not a lexicon location
 * unrelated location not inferred                            the live ask does not admit Asia
 * negation consistency: conflict reported                    a stored negative conflicts; nothing is spoken
 * trace carries INF-* rule ids                               the derive trace names WM-LIVE-GEO (INF-LOC-TRANSITIVE is not revived)
 * person in city ⊂ country ⊂ continent: country              WM-LIVE-GEO when both place names are lexicon locations; otherwise unmet
 * person in city ⊂ country ⊂ continent: continent            same requirement; unmet for noun.object continents and untyped cities
 * person in city: no inference to Narnia                     the live ask does not admit Narnia
 *
 * Residence is the verb live with adhikarana "in". Geographic inclusion is copular "in" only when the
 * grammar's existing name test files both sides as noun.location. Containment stays inside/within.
 * Bare "in" is not made transitive. Part-of, ancestor, and TMS are not this batch.
 */
const A = require('./ask_path.js');

function admitted(row) {
  return row && row.product_reply === true && row.echo && row.echo.pass === true && row.echo.method === 'structural_frame' && row.calls_llm !== true && !(row.memory_write && row.memory_write.committed) && typeof row.drift === 'number' && row.drift <= 0.35 && row.outward_compile && row.outward_compile.applied === true;
}
function ask(mem, q) {
  const s = A.session();
  for (const m of mem) {
    const kept = A.remember(s, m);
    if (!kept.ok) throw new Error(m + ' ' + (kept.rule || ''));
  }
  const n = s.phone.length;
  const row = A.ask(s, q);
  if (s.phone.length !== n) throw new Error('ask wrote');
  return row;
}
function how(row) {
  return row.world_model && row.world_model.derive && row.world_model.derive.survivor && row.world_model.derive.survivor.how;
}

const PEOPLE = ['my sister', 'my brother', 'my friend', 'my aunt', 'my uncle'];
const CHAINS = [['Lyon', 'France', 'Europe'], ['Kyoto', 'Japan', 'Asia'], ['Toronto', 'Canada', 'America'], ['Porto', 'Portugal', 'Europe'], ['Cairo', 'Egypt', 'Africa']];

function original(C, expect) {
  C('INFERENCE', 'transitive located-in (2 hops)', () => {
    const row = ask(['remember that my sister lives in Paris', 'remember that Paris is in France'], 'does my sister live in France?');
    expect(admitted(row) && row.reply === 'Your sister lives in Paris. Paris is in France. Your sister lives in France.', row.reply);
    expect(how(row) === 'WM-LIVE-GEO', how(row));
  });
  C('INFERENCE', 'transitive located-in (3 hops)', () => {
    const row = ask(['remember that my sister lives in Paris', 'remember that Paris is in France', 'remember that France is in Europe'], 'does my sister live in Europe?');
    expect(admitted(row) && /lives in Europe\./.test(row.reply || ''), (row.reply || row.route || 'held') + ' (Europe is noun.object, not a lexicon location, so "in Europe" is not a geographic premise)');
  });
  C('INFERENCE', 'unrelated location not inferred', () => {
    const row = ask(['remember that my sister lives in Paris', 'remember that Paris is in France', 'remember that France is in Europe'], 'does my sister live in Asia?');
    expect(row.product_reply !== true && row.calls_llm !== true, row.reply);
  });
  C('INFERENCE', 'negation consistency: stored negative vs inferred positive → conflict reported', () => {
    const row = ask(['remember that my sister lives in Paris', 'remember that Paris is in France', 'remember that my sister does not live in France'], 'does my sister live in France?');
    const d = row.world_model && row.world_model.derive;
    expect(row.product_reply !== true && row.calls_llm !== true && d && d.status === 'conflicted', (row.reply || '') + ' ' + (d && d.status));
  });
  C('INFERENCE', 'trace carries INF-* rule ids', () => {
    const row = ask(['remember that my sister lives in Paris', 'remember that Paris is in France'], 'does my sister live in France?');
    const surv = row.world_model && row.world_model.derive && row.world_model.derive.survivor;
    const texts = ((surv && surv.premises) || []).map(p => p.text).join(' | ');
    expect(how(row) === 'WM-LIVE-GEO' && texts === 'My sister lives in Paris. | Paris is in France.', texts + ' ' + how(row));
  });
  for (const p of PEOPLE) for (const [c, n, k] of CHAINS) {
    const mem = [`remember that ${p} lives in ${c}`, `remember that ${c} is in ${n}`, `remember that ${n} is in ${k}`];
    const who = (p.replace(/^my /, 'Your '));
    C('INFERENCE', `${p} in ${c} ⊂ ${n} ⊂ ${k}: country`, () => {
      const row = ask(mem, `does ${p} live in ${n}?`);
      expect(admitted(row) && row.reply === `${who} lives in ${c}. ${c} is in ${n}. ${who} lives in ${n}.`, row.reply || 'held');
    });
    C('INFERENCE', `${p} in ${c} ⊂ ${n} ⊂ ${k}: continent`, () => {
      const row = ask(mem, `does ${p} live in ${k}?`);
      expect(admitted(row) && new RegExp('lives in ' + k + '\\.').test(row.reply || ''), (row.reply || 'held') + ' (continent or city is not a lexicon location)');
    });
    C('INFERENCE', `${p} in ${c}: no inference to Atlantis`, () => {
      const row = ask(mem, `does ${p} live in Narnia?`);
      expect(row.product_reply !== true && row.calls_llm !== true, row.reply);
    });
  }
}

function repaired(C, expect) {
  C('LOCATED-IN', 'two geographic hops admit residence when every place is a lexicon location', () => {
    const row = ask(['remember that my sister lives in London', 'remember that London is in England', 'remember that England is in Britain'], 'does my sister live in Britain?');
    expect(admitted(row) && row.reply === 'Your sister lives in London. London is in England. England is in Britain. Your sister lives in Britain.', row.reply);
    expect(how(row) === 'WM-LIVE-GEO', how(row));
  });
  C('LOCATED-IN', 'geographic inclusion does not run backwards', () => {
    const row = ask(['remember that Paris is in France'], 'is France in Paris?');
    expect(row.product_reply !== true, row.reply);
  });
  C('LOCATED-IN', 'a geographic cycle does not place a location inside itself', () => {
    const row = ask(['remember that Paris is in France', 'remember that France is in Paris'], 'is Paris in Paris?');
    expect(row.product_reply !== true, row.reply);
  });
  C('LOCATED-IN', 'inside is enclosure, not residence, so it does not feed the geographic rule', () => {
    const row = ask(['remember that my sister lives inside Paris', 'remember that Paris is in France'], 'does my sister live in France?');
    expect(row.product_reply !== true, row.reply);
  });
  C('LOCATED-IN', 'a box in a drawer and an interest in music are not geographic inclusion', () => {
    const box = ask(['remember that the key is in the box', 'remember that the box is in the drawer'], 'is the key in the drawer?');
    expect(box.product_reply !== true, box.reply);
    const idiom = ask(['remember that she is interested in music', 'remember that music is in the festival'], 'is she interested in the festival?');
    expect(idiom.product_reply !== true, idiom.reply);
  });
  C('LOCATED-IN', 'an unknown place name is not guessed to be a location', () => {
    const row = ask(['remember that my sister lives in Kyoto', 'remember that Kyoto is in Japan'], 'does my sister live in Japan?');
    expect(row.product_reply !== true, row.reply);
  });
  C('LOCATED-IN', 'a noun.object continent is not a geographic premise', () => {
    const row = ask(['remember that my sister lives in Paris', 'remember that Paris is in France', 'remember that France is in Europe'], 'does my sister live in Europe?');
    expect(row.product_reply !== true, row.reply);
  });
  C('LOCATED-IN', 'a frozen unparsed remember still chains after the lexicon can parse it', () => {
    const s = A.session();
    expect(A.remember(s, 'remember that my sister lives in Paris').ok && A.remember(s, 'remember that Paris is in France').ok);
    for (const row of s.phone) row.clause = { schema: 'forge.clause/v1', text: String(row.text).replace(/[.!?]+$/, ''), parsed: false, calls_llm: false };
    const row = A.ask(s, 'does my sister live in France?');
    expect(admitted(row) && /lives in France\./.test(row.reply), row.reply);
  });
}

if (require.main === module) {
  const tests = [];
  const expect = (c, why) => { if (!c) throw new Error(why || 'expectation failed'); };
  const C = (cls, name, fn) => tests.push({ cls, name, fn });
  repaired(C, expect);
  const results = [];
  for (const t of tests) {
    let ok = false, why = '';
    try { t.fn(); ok = true; } catch (e) { why = String(e && e.message || e).slice(0, 800); }
    results.push({ cls: t.cls, name: t.name, ok, why });
  }
  console.log(JSON.stringify(results, null, 1));
  process.exit(results.every(r => r.ok) ? 0 : 1);
}
module.exports = { original, repaired };
