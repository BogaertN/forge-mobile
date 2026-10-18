/* RMC-SELECT (4.9.58, M1): the kernel never returns the first matching route. Every route of the table proposes (or is recorded as not evaluated
 * with the reason: outranked by a specific route, or the hard input-limit gate), and the winner is maximal under the fixed keys
 * Echo → held selection → completeness → specificity → drift → score. Loaded by run.js with its harness. */
module.exports = ({ C, expect, K, ROOT, KN }) => {
  const fs = require('fs'), src = fs.readFileSync(ROOT + '/src/kernel.js', 'utf8');
  const lit = re => { const m = src.match(re); return m ? JSON.parse(m[1].replace(/'/g, '"')) : null; };
  const IDS = lit(/const ROUTE_IDS = (\[[^\]]+\]);/);
  C('RMC-SELECT', 'static: evaluate() is exactly rmcChoose(routeTable(...)); routeTable is called nowhere else; its route list equals ROUTE_IDS; every route has a declared specificity and the language core is the only general route', () => {
    expect(/function evaluate\(raw, low, ctx\) \{ return rmcChoose\(routeTable\(raw, low, ctx\), ctx\); \}/.test(src), 'evaluate is not the selector one-liner');
    expect((src.match(/routeTable\(/g) || []).length === 2, 'routeTable has another caller'); expect(IDS && IDS.length >= 8, 'ROUTE_IDS');
    const listed = [...src.slice(src.indexOf('function routeTable(')).matchAll(/^\s{6}\['([a-z.0-9]+)', \(\) =>/gm)].map(m => m[1]); expect(JSON.stringify(listed) === JSON.stringify(IDS), 'route list ' + listed.join());
    const spec = src.match(/const ROUTE_SPEC = \{([\s\S]*?)\};\n/)[1]; const gen = IDS.filter(id => new RegExp("'" + id.replace('.', '\\.') + "': \\['general'").test(spec)), sp = IDS.filter(id => new RegExp("'" + id.replace('.', '\\.') + "': \\['specific'").test(spec));
    expect(gen.length === 1 && gen[0] === 'language.core' && sp.length === IDS.length - 1, 'specificity table ' + gen.join()); });
  const CORPUS = [['2 + 3 * 4'], ['5 / 0'], ['solve x + y = 3'], ['what is it'], ['send an email to my boss'], ['reset the loop'], ['What is 4 kilograms in grams?'], ['What is 80 meters in hours?'],
    ['Every glimmer is a nova. Every nova is quiet. Rhea is a glimmer. Is Rhea quiet?'], ['Ada is a corvel. Bo is a corvel. Who is a corvel?'], ['remember that Rex is in Paris', 'where is Rex?'], ['Tom is tall'],
    ['what is the metre'], ['hello'], ['remind me to call mom in 30 minutes'], ['the quick brown wennick'], ['Tom is a blorf. Tom is not a blorf. Is Tom a blorf?'], ['add a note: buy milk', 'show my notes']];
  const turns = []; const collect = () => { if (turns.length) return turns; for (const seq of CORPUS) { const k = K(); for (const u of seq) { const r = k.process(u); turns.push({ u, r, k }); } }
    return turns; }; /* the input-limit gate is exercised by CORE-REASONING (oversized world input → typed INPUT_LIMIT) */
  const cmp = (a, b) => (b.completeness - a.completeness) || ((b.specificity === 'specific' && b.completeness >= 1) - (a.specificity === 'specific' && a.completeness >= 1)) || (a.eps_s - b.eps_s) || (b.score - a.score);
  C('RMC-SELECT', 'no short-circuit: on every turn every route of the table is evaluated or recorded "not evaluated: outranked by specific route X" (X specific, selected or agreeing, Echo-passing, with a checked proof or the held continuation) or skipped by the hard input-limit gate', () => {
    let n = 0; for (const { u, r } of collect()) { const s = r.trace.selection; if (!s) continue; n++; expect(JSON.stringify(s.routes.map(x => x.route)) === JSON.stringify(IDS), u + ': routes ' + JSON.stringify(s.routes));
      for (const x of s.routes) { if (x.evaluated) { expect(s.routes_run.includes(x.route), u + ': ' + x.route); continue; }
        const m = /^not evaluated: outranked by specific route (\S+) /.exec(x.why || ''); if (/exceeds the declared input limit/.test(x.why || '')) { expect(u === '(oversized)', u + ': limit gate on a short input'); continue; }
        if (s.user_route) { expect(/user's choice/.test(x.why), u); continue; } expect(m && x.route === 'language.core', u + ': silently skipped ' + x.route + ' :: ' + x.why);
        const by = s.candidates.find(c => c.route === m[1]); expect(by && by.specificity === 'specific' && /^(?:selected|agreed|tied)$/.test(by.status) && by.echo && by.echo.pass && (by.completeness === 2 || by.resolves_hold), u + ': outranking candidate ' + JSON.stringify(by)); } }
    expect(n >= CORPUS.length, 'selection records ' + n); });
  C('RMC-SELECT', 'selection discipline: the winner is maximal under completeness → specificity → drift → score among Echo-passing candidates; a specific route outranks the core only with a complete proof (≥ 1) and a passing Echo; distances are recorded unweighted', () => {
    for (const { u, r } of collect()) { const s = r.trace.selection; if (!s || !s.winner) continue; const cs = s.candidates.filter(c => c.outcome), w = cs.find(c => c.status === 'selected'); expect(w, u + ': no selected candidate');
      expect(s.echo_all_failed || (w.echo && (w.echo.pass || w.echo.ambiguous)), u + ': winner failed Echo'); expect(/^none/.test(s.weights) && JSON.stringify(s.keys) === '["completeness","specificity","eps_s","score"]', u + ': keys');
      const pool = cs.filter(c => c.echo && c.echo.checked !== false && (c.echo.pass || c.echo.ambiguous) && (!cs.some(x => x.resolves_hold) || c.resolves_hold));
      for (const c of pool) expect(cmp(w, c) <= 0 || w.resolves_hold, u + ': ' + c.route + ' outranks the winner ' + w.route);
      for (const c of cs) if (c.status === 'not_selected' && /specificity/.test(c.why || '')) expect(w.specificity === 'specific' && w.completeness >= 1 && c.specificity === 'general', u + ': specificity misuse');
      for (const c of cs) if (c.distances) expect(c.distances.weights === null, u + ': weighted distances'); } });
  C('RMC-SELECT', 'the candidate list and the reason the winner won are in the trace and in the exported proof (which still re-verifies offline)', () => {
    const k = K(); const r = k.process('2 + 3 * 4'); expect(r.trace.selection && r.trace.selection.winner === 'math.gp014' && r.trace.selection.reason && r.trace.selection.candidates.length >= 1, JSON.stringify(r.trace.selection).slice(0, 300));
    const e = k.exportProof(); expect(e.ok && e.bundle.selection && e.bundle.selection.winner === 'math.gp014' && e.bundle.selection.routes.length === IDS.length && e.bundle.selection.candidates.every(c => c.route && c.status && c.why), JSON.stringify(e.bundle && e.bundle.selection).slice(0, 300));
    expect(KN.verifyProof(e.bundle, m => k.realize(m)).ok, 'proof does not re-verify'); });
};
