/* R4261 (4.9.249): the live math path for the MATH-V3 solve block.
 *
 * One-variable equations and a pair of linear equations are the grammar's tree, then SymPy,
 * then computed_quantity Echo. A question does not write phone memory or world_facts.
 * Conversion states the exact fraction. Factor, derivative, and integral use the operation frame.
 */
const A = require('./ask_path.js');
const WF = require('../src/world_facts.js');
function ask(q) {
  const n = WF.rows().length;
  const s = A.session();
  const row = A.ask(s, q);
  if (s.phone.length !== 0 || WF.rows().length !== n) throw new Error('a math question stored a premise');
  return row;
}
function admitted(row) {
  return row && row.product_reply === true && row.echo && row.echo.pass === true && row.echo.method === 'computed_quantity_reparse' && row.calls_llm !== true && row.computed && row.computed.status === 'ok' && !(row.memory_write && row.memory_write.committed);
}
function register(C, expect) {
  C('MATH-V3', 'a linear pair is a structured system and it is not stored', () => {
    const row = ask('solve x + y = 3 and x - y = 1');
    const u = row.computed && row.computed.understood;
    const result = row.computed && row.computed.receipt && row.computed.receipt.result;
    expect(admitted(row) && row.reply === 'Solving x + y = 3 and x - y = 1 gives x = 2 and y = 1.' && row.computed.kind === 'system' && u && u.equations.join(' | ') === 'x + y = 3 | x - y = 1' && result && result.exact === true && result.text === 'x = 2 and y = 1', row.reply || row.route);
  });
  C('MATH-V3', 'a zero solution and a negative solution stay exact', () => {
    const zero = ask('solve x + y = 0 and x - y = 0');
    const neg = ask('solve x + y = -4 and x - y = -2');
    expect(admitted(zero) && zero.reply.includes('x = 0') && zero.reply.includes('y = 0'), zero.reply || zero.route);
    expect(admitted(neg) && neg.reply.includes('x = -3') && neg.reply.includes('y = -1'), neg.reply || neg.route);
  });
  C('MATH-V3', 'the irrational quadratic states both exact roots', () => {
    const row = ask('solve 2x^2 + 3x - 1 = 0');
    expect(admitted(row) && row.reply.includes('x = -√(17)/4 - 3/4') && row.reply.includes('x = -3/4 + √(17)/4') && row.computed.kind === 'equation', row.reply || row.route);
  });
  C('MATH-V3', 'an unreadable equation is not given a number', () => {
    const bad = ask('solve x + = 1');
    const three = ask('solve x + y = 3 and x - y = 1 and x = 0');
    expect(bad.product_reply !== true && bad.reply == null && bad.computed && bad.computed.status === 'unparsed' && bad.computed.rule === 'MATH-UNPARSED', JSON.stringify(bad.computed));
    expect(three.product_reply !== true && three.reply == null && three.computed && three.computed.rule === 'MATH-UNPARSED', JSON.stringify(three.computed));
  });
  C('MATH-V3', '60 km/h is the exact 50/3, and a float is not called exact', () => {
    const row = ask('convert 60 km/h to m/s');
    const res = row.computed.receipt.result;
    const neg = ask('convert -60 km/h to m/s');
    const zero = ask('convert 0 km/h to m/s');
    const bad = ask('convert 60 km to kg');
    const miles = ask('convert 5 miles to km');
    expect(admitted(row) && row.reply === '60 km/h is 50/3 (≈ 16.66666667) m/s.' && res.numerator === '50' && res.denominator === '3' && res.exact === true && res.approximate === '16.66666667', row.reply);
    expect(admitted(neg) && neg.reply.includes('-50/3') && neg.reply.includes('≈ -16.66666667'), neg.reply);
    expect(admitted(zero) && zero.reply === '0 km/h is 0 m/s.' && !/≈/.test(zero.reply), zero.reply);
    expect(bad.product_reply !== true && bad.reply == null && bad.computed.rule === 'MATH-UNIT-DIMENSION' && !/\d/.test(bad.reply || ''), JSON.stringify(bad.computed));
    expect(admitted(miles) && miles.reply === '5 miles is 8.04672 km.' && miles.computed.receipt.result.exact === true && miles.computed.receipt.result.approximate == null, miles.reply);
  });
  C('MATH-V3', 'factor states the factors, and an irreducible or broken polynomial does not invent one', () => {
    const row = ask('factor x^2 - 5x + 6');
    const neg = ask('factor x^2 - 4');
    const rep = ask('factor x^2 + 8x + 16');
    const irr = ask('factor x^2 + 1');
    const bad = ask('factor x^2 +');
    expect(admitted(row) && row.reply.includes('(x - 2)(x - 3)') && row.computed.receipt.result.text === '(x - 2)(x - 3)', row.reply);
    expect(admitted(neg) && neg.reply.includes('(x - 2)') && neg.reply.includes('(x + 2)'), neg.reply);
    expect(admitted(rep) && rep.reply.includes('(x + 4)^2'), rep.reply);
    expect(irr.product_reply !== true && irr.reply == null && irr.computed.rule === 'MATH-IRREDUCIBLE', JSON.stringify(irr.computed));
    expect(bad.product_reply !== true && bad.reply == null && bad.computed.rule === 'MATH-UNPARSED', JSON.stringify(bad.computed));
  });
  C('MATH-V3', 'a derivative keeps its variable and a sum, and a constant power is the constant', () => {
    const sum = ask('derivative of x^3 + 2x');
    const one = ask('derivative of 1x^1');
    const neg = ask('derivative of x^2 - 4x');
    const second = ask('second derivative of x^4');
    const mix = ask('derivative of x + y');
    const bare = ask('derivative of 7');
    const bad = ask('derivative of x^');
    expect(admitted(sum) && sum.computed.receipt.result.text === '3x^2 + 2' && sum.computed.receipt.result.variable === 'x' && sum.computed.receipt.result.order === 1, sum.reply);
    expect(admitted(one) && one.computed.receipt.result.text === '1', one.reply);
    expect(admitted(neg) && neg.computed.receipt.result.text === '2x - 4', neg.reply);
    expect(admitted(second) && second.computed.receipt.result.text === '12x^2' && second.computed.receipt.result.order === 2, second.reply);
    expect(mix.product_reply !== true && mix.reply == null && mix.computed.rule === 'MATH-VAR-AMBIGUOUS', JSON.stringify(mix.computed));
    expect(bare.product_reply !== true && bare.reply == null && bare.computed.rule === 'MATH-VAR-AMBIGUOUS', JSON.stringify(bare.computed));
    expect(bad.product_reply !== true && bad.reply == null && bad.computed.rule === 'MATH-UNPARSED', JSON.stringify(bad.computed));
  });
  C('MATH-V3', 'an indefinite integral states + C, and a definite integral is the number', () => {
    const ind = ask('integral of 2x');
    const def = ask('integral of 2x from 0 to 3');
    const bound = ask('integral of 2x from x to 3');
    expect(admitted(ind) && ind.reply.includes('x^2') && ind.reply.includes('+ C') && ind.computed.receipt.result.definite === false && ind.computed.receipt.result.text === 'x^2 + C', ind.reply);
    expect(admitted(def) && def.reply === 'The definite integral of 2 times x from 0 to 3 is 9.' && !/\+ C/.test(def.reply) && def.computed.receipt.result.definite === true, def.reply);
    expect(bound.product_reply !== true && bound.reply == null && bound.computed.rule === 'MATH-BOUND-VARIABLE', JSON.stringify(bound.computed));
  });
  C('MATH-V3', 'the same system asked twice is the same sentence', () => {
    const a = ask('solve x + y = 4 and x - y = 2');
    const b = ask('solve x + y = 4 and x - y = 2');
    expect(admitted(a) && a.reply === b.reply && a.reply.includes('x = 3') && a.reply.includes('y = 1'), a.reply + ' | ' + b.reply);
  });
}
module.exports = register;
if (require.main === module) {
  const results = [];
  register((cls, name, fn) => { let ok = false, why = ''; try { fn(); ok = true; } catch (e) { why = String(e.message || e).slice(0, 500); } results.push({ cls, name, ok, why }); }, (c, m) => { if (!c) throw new Error(m || 'fail'); });
  console.log(JSON.stringify(results, null, 1));
  if (results.some(r => !r.ok)) process.exit(1);
}
