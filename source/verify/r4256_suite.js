/* R4256 (4.9.249): parent/child is an inverse, and descendant chains in its own direction.
 *
 * The relation table already says parent_of inverse child_of, and that parent is not transitive.
 * It does not say a parent is an ancestor. descendant_of is transitive and its inverse is ancestor_of,
 * read back along the of-phrase. Nothing derived is stored.
 */
const A = require('./ask_path.js');
function admitted(row) {
  return row && row.product_reply === true && row.echo && row.echo.pass === true && row.echo.method === 'structural_frame' && row.calls_llm !== true && !(row.memory_write && row.memory_write.committed) && typeof row.drift === 'number' && row.drift <= 0.35 && row.outward_compile && row.outward_compile.applied === true;
}
function ask(mem, q) {
  const s = A.session();
  for (const m of mem) { const k = A.remember(s, m); if (!k.ok) throw new Error(m); }
  const n = s.phone.length;
  const row = A.ask(s, q);
  if (s.phone.length !== n) throw new Error('ask wrote');
  return row;
}
function register(C, expect) {
  C('PARENT-CHILD', 'the child of a stored parent is that parent, and the parent question the other way', () => {
    const child = ask(['remember that Sue is the child of Tom'], 'is Tom a parent of Sue?');
    expect(admitted(child) && child.reply === 'Sue is the child of Tom. Tom is a parent of Sue.' && child.world_model.derive.survivor.how === 'WM-CHILD-INVERSE', child.reply);
  });
  C('PARENT-CHILD', 'a parent of a parent is not a parent and is not an ancestor', () => {
    const parent = ask(['remember that Tolva is a parent of Mirek', 'remember that Mirek is a parent of Sanju'], 'is Tolva a parent of Sanju?');
    const ancestor = ask(['remember that Tolva is a parent of Mirek', 'remember that Mirek is a parent of Sanju'], 'is Tolva an ancestor of Sanju?');
    expect(parent.product_reply !== true && ancestor.product_reply !== true, (parent.reply || parent.route) + ' / ' + (ancestor.reply || ancestor.route));
  });
  C('PARENT-CHILD', 'a stored negative of the derived child conflicts', () => {
    const row = ask(['remember that Tom is the parent of Sue', 'remember that Sue is not a child of Tom'], 'is Sue the child of Tom?');
    const d = row.world_model && row.world_model.derive;
    expect(row.product_reply !== true && d && d.status === 'conflicted', (row.reply || row.route || '') + ' ' + (d && d.status));
  });
  C('DESCENDANT', 'a descendant of a descendant is a descendant of the further ancestor', () => {
    const row = ask(['remember that Tolva is a descendant of Mirek', 'remember that Mirek is a descendant of Sanju'], 'is Sanju an ancestor of Tolva?');
    expect(admitted(row) && row.world_model.derive.survivor.how === 'WM-DESCENDANT-INVERSE' && row.reply === 'Tolva is a descendant of Mirek. Mirek is a descendant of Sanju. Sanju is an ancestor of Tolva.', row.reply);
  });
  C('DESCENDANT', 'descendant does not run backwards and a cycle is not identity', () => {
    const back = ask(['remember that Orla is a descendant of Pemba'], 'is Pemba a descendant of Orla?');
    const cycle = ask(['remember that Orla is a descendant of Pemba', 'remember that Pemba is a descendant of Orla'], 'is Orla a descendant of Orla?');
    expect(back.product_reply !== true && cycle.product_reply !== true, (back.route || '') + ' / ' + (cycle.route || ''));
  });
  C('DESCENDANT', 'a stored negative of the derived descendant conflicts', () => {
    const row = ask(['remember that Tolva is a descendant of Mirek', 'remember that Mirek is a descendant of Sanju', 'remember that Tolva is not a descendant of Sanju'], 'is Tolva a descendant of Sanju?');
    const d = row.world_model && row.world_model.derive;
    expect(row.product_reply !== true && d && d.status === 'conflicted', (row.reply || '') + ' ' + (d && d.status));
  });
}
module.exports = register;
if (require.main === module) {
  const results = [];
  register((cls, name, fn) => { let ok = false, why = ''; try { fn(); ok = true; } catch (e) { why = String(e.message).slice(0, 400); } results.push({ cls, name, ok, why }); }, c => { if (!c) throw new Error('fail'); });
  console.log(JSON.stringify(results, null, 1));
  if (results.some(r => !r.ok)) process.exit(1);
}
