/* R4254 (4.9.249): Remember's conflict key keeps the complement.
 *
 * Old phone behavior                                      Live assertion
 * verb + subject + opposite polarity refuses the write    only the same complements conflict
 * "lives in Paris" blocks "does not live in France"       both are kept; Ask holds when a proof relates them
 * "my dog is Rex" blocks "my dog is Fido"                  still WORLD-FACTS-CONFLICT-PREDICATE
 * "my dog is Rex" blocks "my dog is not Rex"               still WORLD-FACTS-CONFLICT-POLARITY
 *
 * The key is the clause's kriyā, kartṛ, predicate, karma and adjunct roles. A derived geographic
 * conflict is the world model's, after both premises are stored. Nothing is overwritten.
 */
const K = require('../src/kernel.js');
const FK = require('../src/forge.js');
const Q = require('../src/qframe.js');
const WF = require('../src/world_facts.js');
const A = require('./ask_path.js');
const LEX = require('../data/lexicon.json');
const EXT = require('../data/lexicon-ext.json');
const f = FK.ForgeKernel({ store: K.MemoryStore(), lexicon: LEX, lexiconExt: EXT, clock: () => '2026-11-07T00:00:00Z' });

function put(text) {
  return WF.upsert({ text, clause: Q.clause(text, f), kind: 'remember' });
}

function register(C, expect) {
  C('REMEMBER-KEY', 'a different residence is kept; the same residence with the opposite polarity is refused', () => {
    WF.clear();
    const a = put('My sister lives in Paris.');
    const b = put('My sister does not live in France.');
    const c = put('My sister does not live in Paris.');
    expect(a.ok && a.rule === 'WORLD-FACTS-ADDED', JSON.stringify(a));
    expect(b.ok && b.rule === 'WORLD-FACTS-ADDED', JSON.stringify(b));
    expect(c.ok === false && c.rule === 'WORLD-FACTS-CONFLICT-POLARITY' && /Paris/.test(c.message), JSON.stringify(c));
    const texts = WF.rows().map(r => r.text).sort();
    expect(texts.join('|') === 'My sister does not live in France.|My sister lives in Paris.', texts.join('|'));
    WF.clear();
  });
  C('REMEMBER-KEY', 'a copular identity is still not replaced, and its exact negative is still refused', () => {
    WF.clear();
    expect(put('My dog is Rex.').ok);
    const other = put('My dog is Fido.');
    const neg = put('My dog is not Rex.');
    expect(other.ok === false && other.rule === 'WORLD-FACTS-CONFLICT-PREDICATE', JSON.stringify(other));
    expect(neg.ok === false && neg.rule === 'WORLD-FACTS-CONFLICT-POLARITY', JSON.stringify(neg));
    expect(WF.rows().map(r => r.text).join('|') === 'My dog is Rex.', WF.rows().map(r => r.text).join('|'));
    WF.clear();
  });
  C('REMEMBER-KEY', 'a different spouse or time is not the opposite atom; an apart container is the declared functional constraint', () => {
    WF.clear();
    expect(put('She is married to Bob.').ok && put('She is not married to Cy.').ok, 'spouse');
    expect(put('She is not married to Bob.').rule === 'WORLD-FACTS-CONFLICT-POLARITY', 'same spouse');
    expect(put('The meeting is before lunch.').ok && put('The meeting is not before dinner.').ok, 'time');
    expect(put('The meeting is not before lunch.').rule === 'WORLD-FACTS-CONFLICT-POLARITY', 'same time');
    expect(put('The key is inside the box.').ok, 'first container');
    const drawer = put('The key is inside the drawer.');
    expect(drawer.ok === false && drawer.rule === 'WORLD-FACTS-CONFLICT-FUNCTIONAL' && /box/.test(drawer.message), JSON.stringify(drawer));
    expect(put('The key is not inside the box.').rule === 'WORLD-FACTS-CONFLICT-POLARITY', 'same container');
    expect(WF.rows().some(r => r.text === 'The key is inside the box.') && !WF.rows().some(r => /drawer/.test(r.text)), 'first container kept');
    WF.clear();
  });
  C('REMEMBER-KEY', 'a second mother conflicts; a birthplace inside a known container does not', () => {
    WF.clear();
    expect(put('Vin is the mother of Wes.').ok);
    const other = put('Xan is the mother of Wes.');
    expect(other.ok === false && other.rule === 'WORLD-FACTS-CONFLICT-FUNCTIONAL', JSON.stringify(other));
    expect(put('Ann was born in Paris.').ok && put('Paris is inside France.').ok && put('Ann was born in France.').ok, 'contained birthplace');
    const rome = put('Ann was born in Rome.');
    expect(rome.ok === false && rome.rule === 'WORLD-FACTS-CONFLICT-FUNCTIONAL', JSON.stringify(rome));
    expect(WF.rows().some(r => r.text === 'Ann was born in Paris.') && WF.rows().some(r => r.text === 'Ann was born in France.'), 'both contained places kept');
    WF.clear();
  });
  C('REMEMBER-KEY', 'an unparsed complement is not treated as the opposite of a different place', () => {
    WF.clear();
    const bare = WF.upsert({ text: 'My sister lives.', clause: { schema: 'forge.clause/v1', text: 'My sister lives', parsed: false }, atom: { predicate: 'live', args: ['my sister', ''], polarity: 'pos' }, kind: 'remember' });
    const france = put('My sister does not live in France.');
    expect(bare.ok && france.ok, JSON.stringify([bare, france]));
    WF.clear();
  });
  C('REMEMBER-KEY', 'an adjective of one subject is not silently replaced', () => {
    WF.clear();
    expect(put('The sky is blue.').ok);
    const grey = put('The sky is grey.');
    const neg = put('The sky is not blue.');
    expect(grey.ok === false && grey.rule === 'WORLD-FACTS-CONFLICT-PREDICATE', JSON.stringify(grey));
    expect(neg.ok === false && neg.rule === 'WORLD-FACTS-CONFLICT-POLARITY', JSON.stringify(neg));
    WF.clear();
  });
  C('REMEMBER-KEY', 'a stored negative of the derived residence holds, and both premises stay', () => {
    const s = A.session();
    expect(A.remember(s, 'remember that my sister lives in Paris').ok);
    expect(A.remember(s, 'remember that Paris is in France').ok);
    expect(A.remember(s, 'remember that my sister does not live in France').ok);
    expect(s.phone.length === 3, String(s.phone.length));
    const row = A.ask(s, 'does my sister live in France?');
    const d = row.world_model && row.world_model.derive;
    expect(row.product_reply !== true && row.calls_llm !== true && d && d.status === 'conflicted', (row.reply || '') + ' ' + (d && d.status));
    expect(!(row.memory_write && row.memory_write.committed), 'derived answer was stored');
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
