/* R4259 (4.9.249): age stays age, magnitude stays magnitude, and a copular preposition is not a sense.
 *
 * older/younger chain and invert only inside age. greater/less and their surface words stay magnitude.
 * A stored taller fact answers that comparison and is not given those rules.
 * A numeral above a numeral is not the thing-above-thing chain.
 * Copular before has no kala role, so a preface and a lunch are the same preposition. That is a limit, not a disambiguation.
 */
const A = require('./ask_path.js');
const Q = require('../src/qframe.js');
function admitted(row) {
  return row && row.product_reply === true && row.echo && row.echo.pass === true && row.echo.method === 'structural_frame' && row.calls_llm !== true && !(row.memory_write && row.memory_write.committed) && typeof row.drift === 'number' && row.drift <= 0.35 && row.outward_compile && row.outward_compile.applied === true;
}
function ask(mem, q) {
  const s = A.session();
  for (const m of mem) { const k = A.remember(s, m); if (!k.ok) throw new Error(m + ' ' + (k.rule || '')); }
  const n = s.phone.length;
  const row = A.ask(s, q);
  if (s.phone.length !== n) throw new Error('ask wrote');
  return row;
}
function register(C, expect) {
  C('COMPARE', 'the red lamp keeps its colour on the age fact and on the refused swap', () => {
    const yes = ask(['remember that the red lamp is older than the blue lamp'], 'is the red lamp older than the blue lamp?');
    expect(admitted(yes) && yes.reply === 'The red lamp is older than the blue lamp.' && yes.world_model.derive.survivor.how === 'direct', yes.reply);
    const no = ask(['remember that the red lamp is older than the blue lamp'], 'is the blue lamp older than the red lamp?');
    expect(admitted(no) && no.reply === 'The red lamp is older than the blue lamp. The blue lamp is not older than the red lamp.' && no.world_model.derive.survivor.how === 'WM-OLDER_THAN-ASYM', no.reply);
  });
  C('COMPARE', 'height stays height: a taller fact answers itself and does not become age', () => {
    const yes = ask(['remember that my brother is taller than my sister'], 'is my brother taller than my sister?');
    const shorter = ask(['remember that my brother is taller than my sister'], 'is my sister shorter than my brother?');
    const chain = ask(['remember that Nia is taller than Bo', 'remember that Bo is taller than Cy'], 'is Nia taller than Cy?');
    expect(admitted(yes) && yes.reply === 'Your brother is taller than your sister.' && yes.world_model.derive.survivor.how === 'direct', yes.reply);
    expect(admitted(shorter) && shorter.reply === 'Your brother is taller than your sister. Your sister is shorter than your brother.' && shorter.world_model.derive.survivor.how === 'WM-TALLER_THAN-INVERSE', shorter.reply);
    expect(admitted(chain) && chain.world_model.derive.survivor.how === 'WM-TALLER_THAN-CHAIN', chain.reply);
    const older = ask(['remember that my brother is taller than my sister'], 'is my brother older than my sister?');
    const fromAge = ask(['remember that my brother is older than my sister'], 'is my brother taller than my sister?');
    const mix = ask(['remember that Nia is taller than Pavel', 'remember that Pavel is older than Soren'], 'is Nia older than Soren?');
    expect(older.product_reply !== true && fromAge.product_reply !== true && mix.product_reply !== true, [older.reply, fromAge.reply, mix.reply].join(' | '));
  });
  C('COMPARE', 'relative age does not invent a number, and a negative of the inverse conflicts', () => {
    const num = ask(['remember that my brother is older than my sister'], 'is my brother 40?');
    expect(num.product_reply !== true, num.reply || num.route);
    const neg = ask(['remember that my brother is older than my sister', 'remember that my sister is not younger than my brother'], 'is my sister younger than my brother?');
    const d = neg.world_model && neg.world_model.derive;
    expect(neg.product_reply !== true && d && d.status === 'conflicted', (neg.reply || neg.route || '') + ' ' + (d && d.status));
  });
  C('COMPARE', 'an age cycle does not make someone older than themself, and age is not magnitude', () => {
    const self = ask(['remember that Nia is older than Bo', 'remember that Bo is older than Nia'], 'is Nia older than Nia?');
    const mix = ask(['remember that Nia is older than Bo', 'remember that Bo is greater than Cy'], 'is Nia older than Cy?');
    const cross = ask(['remember that Nia is older than Bo'], 'is Nia greater than Bo?');
    expect(self.product_reply !== true && mix.product_reply !== true && cross.product_reply !== true, [self.reply, mix.reply, cross.reply].join(' | '));
    const stated = ask(['remember that Nia is older than Bo'], 'is Nia older than Bo?');
    expect(admitted(stated), stated.reply || stated.route);
  });
  C('COMPARE', 'mass, width, elevation, depth, and length stay apart, and shorter follows height', () => {
    const mass = ask(['remember that the crate is heavier than the drum in the hall', 'remember that the drum is heavier than the sack in the hall'], 'is the crate heavier than the sack in the hall?');
    const split = ask(['remember that the crate is heavier than the drum in the hall', 'remember that the drum is heavier than the sack on the roof'], 'is the crate heavier than the sack?');
    const cross = ask(['remember that the crate is heavier than the drum'], 'is the crate wider than the drum?');
    const elev = ask(['remember that the crate is higher than the drum'], 'is the crate taller than the drum?');
    const longer = ask(['remember that the rope is longer than the cord'], 'is the cord shorter than the rope?');
    const height = ask(['remember that the rope is taller than the cord'], 'is the cord shorter than the rope?');
    const both = ask(['remember that the rope is longer than the cord', 'remember that the rope is taller than the cord'], 'is the cord shorter than the rope?');
    const self = ask(['remember that Nia is heavier than Bo', 'remember that Bo is heavier than Nia'], 'is Nia heavier than Nia?');
    const neg = ask(['remember that Quo is heavier than Ola', 'remember that Ola is not lighter than Quo'], 'is Ola lighter than Quo?');
    const one = ask(['remember that Quo is 180 cm tall'], 'is Quo taller than Ola?');
    expect(admitted(mass) && mass.reply === 'The crate is heavier than the drum in the hall. The drum is heavier than the sack in the hall. The crate is heavier than the sack in the hall.' && mass.world_model.derive.survivor.how === 'WM-HEAVIER_THAN-CHAIN', mass.reply);
    expect(split.product_reply !== true && cross.product_reply !== true && elev.product_reply !== true && longer.product_reply !== true && self.product_reply !== true && one.product_reply !== true, [split.reply, cross.reply, elev.reply, longer.reply, self.reply, one.reply].join(' | '));
    expect(admitted(height) && /taller than the cord/.test(height.reply) && /shorter than the rope/.test(height.reply) && height.world_model.derive.survivor.how === 'WM-TALLER_THAN-INVERSE', height.reply);
    expect(admitted(both) && /taller than the cord/.test(both.reply) && !/longer/.test(both.reply), both.reply);
    const d = neg.world_model && neg.world_model.derive;
    expect(neg.product_reply !== true && d && d.status === 'conflicted', (neg.reply || neg.route || '') + ' ' + (d && d.status));
  });
  C('COMPARE', 'a mass converts exactly, and a bare length or a missing height does not', () => {
    const U = require('../src/units.js');
    const Alg = require('../src/algebra.js');
    const names = U.massNames().slice().sort();
    const fromTable = Object.keys(Alg.U).filter(n => Alg.U[n] && Alg.U[n].dim === 'mass').sort();
    expect(JSON.stringify(names) === JSON.stringify(fromTable), names.join(','));
    const py = JSON.parse(require('child_process').execFileSync('python3', ['-c', 'import json; from rmc_engine_v1.unit_ratio import mass_names; print(json.dumps(mass_names()))'], { cwd: require('path').join(__dirname, '..'), env: Object.assign({}, process.env, { PYTHONPATH: require('path').join(__dirname, '..', 'engine') }), encoding: 'utf8' }));
    for (const n of ['kg', 'gram', 'grams', 'pound', 'pounds', 'lb', 'lbs']) expect(U.isMass(n) && py.indexOf(n) >= 0, n);
    expect(!U.isMass('cm') && py.indexOf('cm') < 0 && Alg.U.cm && Alg.U.cm.dim === 'length', 'cm');
    const grams = ask(['remember that Quo is 3000 grams', 'remember that Ola is 5 kg'], 'is Ola heavier than Quo?');
    const prem = (grams.world_model.derive.survivor.premises || []).map(p => p.text);
    const steps = Object.values(grams.world_model.proofs || {}).reduce((a, p) => a.concat((p && p.steps) || []), []);
    const qty = steps.map(s => s.atom && s.atom.quantity).filter(Boolean);
    expect(admitted(grams) && grams.reply === 'Ola is 5 kg. Quo is 3000 grams. Ola is heavier than Quo.' && grams.world_model.derive.survivor.how === 'WM-MEASURE-COMPARE' && prem.some(t => /5 kg/.test(t)) && prem.some(t => /3000 grams/.test(t)), grams.reply);
    expect(qty.some(q => q.num === '5' && q.unit === 'kg' && q.dim === 'mass' && q.property === 'heavy' && q.n === '5' && q.d === '1') && qty.some(q => q.num === '3000' && q.unit === 'grams' && q.dim === 'mass' && q.property === 'heavy' && q.n === '3000' && q.d === '1000'), JSON.stringify(qty));
    const tall = ask(['remember that Quo is 180 cm tall', 'remember that Ola is 2 m tall'], 'is Ola taller than Quo?');
    expect(admitted(tall) && /Ola is taller than Quo/.test(tall.reply) && /180 cm tall/.test(tall.reply) && /2 m tall/.test(tall.reply) && tall.world_model.derive.survivor.how === 'WM-MEASURE-COMPARE', tall.reply);
    const s = A.session();
    const one = A.remember(s, 'remember that Quo is 180 cm tall');
    const missing = A.ask(s, 'is Quo taller than Ola?');
    const gap = missing.world_model.derive.measure_gap;
    const keptQty = gap && (gap.measures || []).find(m => m.property === 'tall');
    expect(one.clause.pred.property === 'tall' && one.clause.pred.unit === 'cm' && one.clause.pred.num === '180' && missing.product_reply !== true && missing.world_model.derive.status === 'undetermined' && missing.world_model.derive.reason === 'measure_missing_comparator' && gap && gap.asked === 'taller_than' && gap.owners === 1 && keptQty && keptQty.num === '180' && keptQty.unit === 'cm' && keptQty.dim === 'length' && !((missing.world_model.derive.claims || []).some(c => c.how === 'WM-MEASURE-COMPARE')) && !/\d/.test(missing.reply || ''), missing.reply || missing.world_model.derive.reason);
    const bare = ask(['remember that Quo is 180 cm'], 'is Quo taller than Ola?');
    const cross = ask(['remember that Quo is 3 kg', 'remember that Ola is 180 cm tall'], 'is Ola heavier than Quo?');
    const mismatch = ask(['remember that Quo is 3 kg tall'], 'is Quo taller than Ola?');
    const high = ask(['remember that the shelf is 2 m high', 'remember that the crate is 180 cm tall'], 'is the shelf taller than the crate?');
    const crossGap = cross.world_model.derive.measure_gap;
    const highGap = high.world_model.derive.measure_gap;
    expect(bare.product_reply !== true && bare.world_model.derive.status === 'undetermined' && !(bare.world_model.derive.measure_gap) && !/\d/.test(bare.reply || ''), bare.reply || bare.world_model.derive.reason);
    expect(cross.product_reply !== true && cross.world_model.derive.reason === 'measure_incompatible' && crossGap && crossGap.measures.some(m => m.property === 'heavy' && m.unit === 'kg' && m.num === '3' && m.dim === 'mass') && crossGap.measures.some(m => m.property === 'tall' && m.unit === 'cm'), JSON.stringify(crossGap));
    expect(mismatch.product_reply !== true && mismatch.world_model.observe.clause_fallback_reasons.measure_incompatible >= 1 && !mismatch.world_model.derive.measure_gap, JSON.stringify(mismatch.world_model.observe.clause_fallback_reasons));
    expect(high.product_reply !== true && high.world_model.derive.reason === 'measure_incompatible' && highGap && highGap.asked === 'taller_than' && highGap.measures.some(m => m.property === 'high') && highGap.measures.some(m => m.property === 'tall'), JSON.stringify(highGap));
  });
  C('ORDER', 'a numeral above a numeral is not the thing-above-thing chain', () => {
    const other = ask(['remember that the score is above 10'], 'is the score above 5?');
    const same = ask(['remember that the score is above 10'], 'is the score above 10?');
    const mixed = ask(['remember that the lamp is above the table', 'remember that the table is above 10'], 'is the lamp above 10?');
    const things = ask(['remember that the lamp is above the table', 'remember that the table is above the floor'], 'is the lamp above the floor?');
    expect(other.product_reply !== true && mixed.product_reply !== true, (other.reply || other.route) + ' | ' + (mixed.reply || mixed.route));
    expect(admitted(same) && same.reply === 'The score is above 10.', same.reply);
    expect(admitted(things) && things.world_model.derive.survivor.how === 'WM-ABOVE-CHAIN' && things.reply === 'The lamp is above the table. The table is above the floor. The lamp is above the floor.', things.reply);
  });
  C('ORDER', 'copular before has no sense: a preface and a lunch are the same preposition', () => {
    const s = A.session();
    const a = A.remember(s, 'remember that the preface is before the meeting');
    const b = A.remember(s, 'remember that the meeting is before lunch');
    expect(a.ok && a.clause.pred.prep === 'before' && !a.clause.pred.role && !(a.clause.adj || []).some(x => x.role === 'kala'), JSON.stringify(a.clause && a.clause.pred));
    expect(b.ok && b.clause.pred.prep === 'before' && !b.clause.pred.role && !(b.clause.adj || []).some(x => x.role === 'kala'), JSON.stringify(b.clause && b.clause.pred));
    const row = A.ask(s, 'is the preface before lunch?');
    expect(admitted(row) && row.world_model.derive.survivor.how === 'WM-BEFORE-CHAIN' && row.reply === 'The preface is before the meeting. The meeting is before lunch. The preface is before lunch.', row.reply);
    const q = Q.compile('is chapter two before lunch?', A.kernel());
    expect(!(q && q.pred && q.pred.prep === 'before'), JSON.stringify(q && q.pred));
    const held = ask(['remember that chapter two is before the meeting', 'remember that the meeting is before lunch'], 'is chapter two before lunch?');
    expect(held.product_reply !== true, held.reply || held.route);
  });
}
module.exports = register;
if (require.main === module) {
  const results = [];
  register((cls, name, fn) => { let ok = false, why = ''; try { fn(); ok = true; } catch (e) { why = String(e.message || e).slice(0, 500); } results.push({ cls, name, ok, why }); }, (c, m) => { if (!c) throw new Error(m || 'fail'); });
  console.log(JSON.stringify(results, null, 1));
  if (results.some(r => !r.ok)) process.exit(1);
}
