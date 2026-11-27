/* 4.9.283: a creative copula has to fit the subject's taxonomy, and the copulas share one predicate. */
const path = require('path');
const ROOT = path.join(__dirname, '..');
const K = require(ROOT + '/src/kernel.js');
const FK = require(ROOT + '/src/forge.js');
const Q = require(ROOT + '/src/qframe.js');
const Fit = require(ROOT + '/src/clause_fit.js');
const LEX = require(ROOT + '/data/lexicon.json');
const EXT = require(ROOT + '/data/lexicon-ext.json');
const PRO = require(ROOT + '/data/lexicon-pro.json');
function forge() {
  const f = FK.ForgeKernel({ store: K.MemoryStore(), lexicon: LEX, lexiconExt: EXT, clock: () => '2026-11-26T00:00:00Z' });
  if (f.lexicon && f.lexicon.attach) f.lexicon.attach(PRO, 'pro');
  return f;
}
function sense(f, topic, lexname) {
  return (f.lexicon.senses(topic) || []).find(s => s.pos === 'n' && s.lexname === lexname) || null;
}
function register(C, expect) {
  C('R4289', 'a fresh bird keeps its class, drops a taxon label and a mismatched noun, and coordinates the copulas', () => {
    const f = forge();
    const topic = 'bittern';
    const chosen = sense(f, topic, 'noun.animal');
    expect(chosen && /heron/.test(chosen.gloss), JSON.stringify(chosen && chosen.gloss));
    const clauses = [
      'A bittern is a heron.',
      'A bittern is an aves.',
      'A bittern is a bill.',
      'A bittern is an a.',
      'A bittern is small.',
      'A bittern is compact.',
      'A bittern has a bill.'
    ].map(text => ({ text: text, clause: Q.clause(text, f), single_source: true, fact: false, admitted: false }));
    const fitted = Fit.fitList(topic, clauses, f, chosen);
    const texts = fitted.map(c => c.text).join(' ');
    expect(/heron/.test(texts) && /small/.test(texts) && /compact/.test(texts), texts);
    expect(!/aves/.test(texts) && !/was a bill/.test(texts) && !/is a bill/.test(texts) && !/\ban a\b/.test(texts), texts);
    expect((texts.match(/The bittern was/g) || []).length === 1, texts);
    expect(fitted.some(c => /has a bill/.test(c.text)), texts);
  });
  C('R4289', 'a body part of the chosen sense becomes a has-relation', () => {
    const f = forge();
    const topic = 'ibis';
    const chosen = sense(f, topic, 'noun.animal');
    const clauses = ['An ibis is a beak.', 'An ibis is a bird.'].map(text => ({ text: text, single_source: true, fact: false }));
    const fitted = Fit.fitList(topic, clauses, f, chosen);
    const texts = fitted.map(c => c.text).join(' ');
    expect(/had a beak/.test(texts) && /bird/.test(texts) && !/was a beak/.test(texts), texts);
  });
}
module.exports = register;
if (require.main === module) {
  const results = [];
  register((cls, name, fn) => { let ok = false, why = ''; try { fn(); ok = true; } catch (e) { why = String(e.message || e).slice(0, 800); } results.push({ cls, name, ok, why }); }, (c, m) => { if (!c) throw new Error(m || 'fail'); });
  console.log(JSON.stringify(results, null, 1));
  if (results.some(r => !r.ok)) process.exit(1);
}
