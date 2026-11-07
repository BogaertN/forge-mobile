/* R4261 (4.9.249): the live math path for the MATH-V3 solve block.
 *
 * One-variable equations and a pair of linear equations are the grammar's tree, then SymPy,
 * then computed_quantity Echo. A question does not write phone memory or world_facts.
 * Factor, derivative, integral, and the exact 50/3 conversion stay outside this file.
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
