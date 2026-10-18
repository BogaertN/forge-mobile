/* TMS (4.9.59, M2): justifications + truth maintenance. Every derived item records its justification as data (premise ids + texts, rule ids,
 * the selection record, a replay recipe; id = sha256 of the content). Withdrawing a premise withdraws every dependent item transitively unless
 * another justification survives; withdrawn items carry a receipt and are never deleted; "why?" / "how do you know?" / "what is that based on?"
 * read the recorded justification back, Echo-validated. Loaded by run.js with its harness. */
module.exports = ({ C, expect, K, ROOT }) => {
  const fs = require('fs'), JT = require(ROOT + '/src/justify.js'), { sha256 } = require(ROOT + '/src/sha256.js');
  const run = (f, ts) => ts.map(t => f.process(t));
  const item = (f, text) => f.justifications().filter(x => JT.norm(x.text) === JT.norm(text)).pop();
  const loc = f => run(f, ['remember that Rex is in Paris', 'remember that Paris is in France', 'is Rex in France?']);
  const chase = f => { run(f, ['remember that Rex chases Tom', 'remember that Tom chases Sam', 'remember that Ann chases Bo', 'remember that Bo chases Cy', 'explore ideas']); return f.stagedHypotheses().find(h => h.detail.rule && h.parents.length && JSON.stringify(h.body).includes('rex')); };
  const W = 'Every glimmer is a nova. Rhea is a glimmer. Is Rhea a nova?';
  C('TMS-WITHDRAW', 'transitive withdrawal: forgetting a stored fact withdraws the conclusion derived from it (receipt names the premise, its new status and the cause); the answer is no longer given', () => {
    const f = K(); const q = loc(f)[2]; expect(/^Yes/.test(q.reply) && q.trace.tms.recorded.length === 1, q.reply); const it = item(f, 'Rex is in France');
    expect(it && it.status === 'in' && it.justifications.length === 1 && it.justifications[0].premises.length === 2 && it.justifications[0].premises.every(p => /^mem:/.test(p.id)) && it.justifications[0].rules.includes('INF-LOC-TRANSITIVE') && it.justifications[0].selection && it.justifications[0].selection.schema === 'RMC-ROUTE-SELECTION/v2', JSON.stringify(it).slice(0, 300));
    const pid = f.store.load('memory').find(r => /Paris is in France/.test(f.renderClause(r.clause))).id; run(f, ['forget that Paris is in France']); expect(item(f, 'Rex is in France').status === 'in', 'withdrawn before confirmation');
    const y = f.process('yes'); const after = item(f, 'Rex is in France'), rc = f.withdrawalReceipts().find(r => r.item === it.id);
    expect(after.status === 'withdrawn' && y.trace.tms.withdrawn.includes(it.id) && rc && rc.transition === 'withdrawn' && rc.justifications[0].out.some(o => o.id === pid && o.status === 'forgotten') && rc.cause && rc.cause.turn === y.trace.turn, JSON.stringify(rc).slice(0, 300));
    expect(!/^Yes/.test(f.process('is Rex in France?').reply)); });
  C('TMS-WITHDRAW', 'transitive through governed items: fact → staged hypothesis → admitted rule → conclusion; forgetting one covering fact withdraws all three (the conclusion\'s own facts are still active), the rule leaves its store with invalidated proofs, and the withdrawn hypothesis cannot be re-approved', () => {
    const f = K(); const h = chase(f); expect(h, 'no rule hypothesis'); const a = f.approveHypothesis(h.id, true); expect(a.ok && f.admittedRules().length === 1, JSON.stringify(a).slice(0, 160));
    const q = f.process('does Ann chase Cy?'); expect(/^Yes/.test(q.reply), q.reply); const c = item(f, 'Ann chases Cy'), adm = f.store.load('admitted_rules')[0];
    expect(c && c.justifications[0].rules.includes(adm.id) && f.justifications().some(x => x.id === h.id && x.kind === 'hypothesis') && f.justifications().some(x => x.id === adm.id && x.kind === 'rule'), 'ledger chain');
    run(f, ['forget that Rex chases Tom']); const y = f.process('yes');
    expect([h.id, adm.id, c.id].every(id => y.trace.tms.withdrawn.includes(id)) && item(f, 'Ann chases Cy').status === 'withdrawn', JSON.stringify(y.trace.tms));
    const ar = f.store.load('admitted_rules')[0]; expect(ar.status === 'withdrawn' && ar.withdrawn_by === 'truth maintenance' && Array.isArray(ar.invalidated_proofs) && ar.invalidated_proofs.length >= 1 && f.admittedRules().every(r => r.status !== 'admitted'), JSON.stringify(ar).slice(0, 200));
    expect(f.store.load('hypotheses').find(x => x.id === h.id).status === 'withdrawn' && f.approveHypothesis(h.id, true).rule === 'HYP-WITHDRAWN');
    expect(['Ann chases Bo', 'Bo chases Cy'].every(t => f.store.load('memory').some(r => r.status === 'active' && f.renderClause(r.clause) === t)), 'facts of the conclusion stay');
    expect(f.store.load('containment_receipts').some(r => r.kind === 'tms.withdraw' && r.body.id === adm.id)); expect(!/^Yes/.test(f.process('does Ann chase Cy?').reply)); });
  C('TMS-WITHDRAW', 'a user-withdrawn admitted rule withdraws every conclusion that used it; "actually X is not Y" against a stored fact asks first, and only "yes" supersedes it (then its conclusions are withdrawn); a bare "forget that" names the previous turn\'s fact and still asks', () => {
    const f = K(); const h = chase(f); f.approveHypothesis(h.id, true); f.process('does Ann chase Cy?'); const c = item(f, 'Ann chases Cy'); const w = f.withdrawRule(f.store.load('admitted_rules')[0].id, true);
    expect(w.ok && w.tms.withdrawn.includes(c.id) && item(f, 'Ann chases Cy').status === 'withdrawn', JSON.stringify(w).slice(0, 200));
    const g = K(); loc(g); const snap = JSON.stringify(g.store.load('memory')); const a = g.process('actually Rex is not in Paris');
    expect(a.msm.meaning.kind === 'confirm_replace' && a.trace.rules.some(r => r.id === 'MEM-CORRECTION-ACTUALLY') && JSON.stringify(g.store.load('memory')) === snap && item(g, 'Rex is in France').status === 'in', a.reply);
    const y = g.process('yes'); expect(y.msm.meaning.kind === 'replaced' && item(g, 'Rex is in France').status === 'withdrawn' && y.trace.tms.receipts.length >= 1, y.reply);
    const k = K(); k.process('remember that Tom is in Rome'); const ft = k.process('forget that'); expect(ft.msm.meaning.kind !== 'blocked' && /Tom is in Rome/.test(ft.reply) && k.store.load('memory').some(r => r.status === 'active'), ft.reply);
    expect(/cold storage/.test(k.process('yes').reply) && !k.store.load('memory').some(r => r.status === 'active')); expect(K().process('forget that').msm.meaning.reason === 'FORGET_SCOPE', 'bare forget with nothing to name'); });
  C('TMS-MULTI', 'multiple justifications: a conclusion derived AND stated keeps both; withdrawing one premise keeps it IN (no receipt), withdrawing the last one withdraws it with every alternative listed', () => {
    const f = K(); loc(f); run(f, ['remember that Rex is in France', 'is Rex in France?']); const it = item(f, 'Rex is in France');
    expect(it.justifications.length === 2 && new Set(it.justifications.map(j => j.id)).size === 2 && it.justifications.some(j => j.premises.length === 2) && it.justifications.some(j => j.premises.length === 1), JSON.stringify(it.justifications.map(j => j.premises)));
    run(f, ['forget that Paris is in France', 'yes']); expect(item(f, 'Rex is in France').status === 'in' && !f.withdrawalReceipts().some(r => r.item === it.id), 'withdrawn despite a surviving justification');
    expect(f.process('how do you know that Rex is in France?').reply === 'You stated “Rex is in France”.');
    run(f, ['forget that Rex is in France', 'yes']); const rc = f.withdrawalReceipts().find(r => r.item === it.id); expect(item(f, 'Rex is in France').status === 'withdrawn' && rc && rc.alternatives_checked === 2 && rc.justifications.length === 2 && rc.justifications.every(j => j.out.length >= 1), JSON.stringify(rc).slice(0, 300)); });
  C('TMS-RECEIPT', 'withdrawal receipts: append-only, content-addressed (id = sha256 of the canonical receipt), the withdrawn item stays with all justifications and a history entry naming its receipt; nothing is deleted; the ledger is case-scoped bookkeeping and an exported category, never memory', () => {
    const f = K(); loc(f); const n0 = f.justifications().length; run(f, ['forget that Paris is in France', 'yes']); const r1 = f.withdrawalReceipts(); run(f, ['remember that Paris is in France', 'where is Rex?']);
    const r2 = f.withdrawalReceipts(); expect(r2.length >= r1.length && r1.every((r, i) => JSON.stringify(r2[i]) === JSON.stringify(r)), 'receipt rewritten'); expect(f.justifications().length >= n0, 'ledger shrank');
    for (const r of r2) expect(r.id === 'wd:' + sha256(JT.canon(Object.assign({}, r, { id: undefined }))).slice(0, 24) && r.schema === 'FORGE-WITHDRAWAL-RECEIPT/v1', 'receipt hash ' + r.id);
    const it = item(f, 'Rex is in France'); expect(it.status === 'withdrawn' && it.justifications.length === 1 && it.history.some(h => h.status === 'withdrawn' && r2.some(r => r.id === h.receipt)), JSON.stringify(it.history));
    expect(f.categories.includes('justifications') && f.categories.includes('withdrawal_receipts') && f.exportAll().justifications.length === f.justifications().length);
    expect(/CASE_CATS = new Set\(\[[^\]]*'justifications', 'withdrawal_receipts'/.test(fs.readFileSync(ROOT + '/src/kernel.js', 'utf8')), 'ledger not case-scoped');
    expect(f.store.load('memory').every(r => !/concl:|jus:|wd:/.test(JSON.stringify(r))), 'ledger leaked into memory'); });
  C('TMS-WHY', '"why?", "how do you know?" and "what is that based on?" read back the previous answer\'s recorded premises across turns, Echo-validated with independent re-verification; the selection names justify.followup; nothing is written', () => {
    const f = K(); f.process(W); const mem = JSON.stringify(f.store.load('memory'));
    for (const t of ['Why?', 'How do you know?', 'What is that based on?', 'why is that?', 'how do you know that?']) { const r = f.process(t);
      expect(r.reply === 'I derived “rhea is nova” from “Rhea is a glimmer” and “Every glimmer is a nova”. It uses 1 rule.' && r.trace.echo.pass && r.trace.echo.components.independent_reverification === 1 && r.trace.selection.winner === 'justify.followup', t + ' → ' + r.reply); }
    expect(JSON.stringify(f.store.load('memory')) === mem, 'a why turn wrote memory');
    const g = K(); loc(g); expect(g.process('why?').reply === 'I derived “Rex is in France” from “Rex is in Paris” and “Paris is in France”. It uses 1 rule.');
    g.process('remember that Tom is in Rome'); g.process('what is 2 + 2'); expect(g.process('How do you know that Rex is in France?').reply === 'I derived “Rex is in France” from “Rex is in Paris” and “Paris is in France”. It uses 1 rule.', 'named item');
    expect(g.process('where is Tom?') && g.process('how do you know?').reply === 'You stated “Tom is in Rome”.');
    run(g, ['forget that Paris is in France', 'yes']); expect(/I do not keep it\.$/.test(g.process('how do you know that Rex is in France?').reply));
    expect(K().process('why?').reply === 'I recorded no premise for my last answer.'); });
  C('TMS-WHY', 'a forged read-back fails Echo\'s independent re-verification (quote not the recorded premise, or a justification id that does not replay)', () => {
    const f = K(); f.process(W); const id = f.justifications()[0].id, m = f.whyOf(id), D = require(ROOT + '/src/derive.js');
    const ok = f.echo(D.realizeMeaning(m, {}).text, m); expect(ok.pass && ok.components.independent_reverification === 1, JSON.stringify(ok.components));
    const bad = f.echo('I derived “rhea is nova” from “Rhea is a nova” and “Every glimmer is a nova”. It uses 1 rule.', m); expect(!bad.pass, 'forged premise passed');
    const bad2 = f.echo(D.realizeMeaning(m, {}).text, Object.assign({}, m, { jid: 'jus:000000000000000000000000' })); expect(!bad2.pass, 'unknown justification passed'); });
  C('TMS-REPLAY', 'replay: every justification id re-derives from its content; a world justification re-derives its conclusion from the recorded premise sentences alone; identical inputs give identical ids in fresh kernels; tampering is detected', () => {
    const a = K(), b = K(); a.process(W); b.process(W); loc(a); const ids = x => x.justifications().map(i => i.justifications.map(j => j.id).join()).join('|');
    expect(ids(b) && ids(a).startsWith(ids(b)), 'non-deterministic ids');
    for (const it of a.justifications()) { const r = a.replayJustification(it.id); expect(r.ok && r.justifications.every(j => j.hash_ok), it.id + ' ' + JSON.stringify(r)); }
    const w = a.justifications().find(i => i.justifications[0].replay && i.justifications[0].replay.kind === 'world'); const rw = a.replayJustification(w.id); expect(rw.justifications[0].rederived === true, JSON.stringify(rw));
    expect(w.justifications[0].replay.text === 'Rhea is a glimmer. Every glimmer is a nova. Is Rhea a nova?' && w.justifications[0].premises.every(p => /^src:[0-9a-f]{12}:source:\d+$/.test(p.id)), JSON.stringify(w.justifications[0]).slice(0, 300));
    const xs = a.store.load('justifications'); xs.find(i => i.id === w.id).justifications[0].replay.text = 'Rhea is a glimmer. Is Rhea a nova?'; a.store.save('justifications', xs); expect(!a.replayJustification(w.id).ok, 'tampered recipe replayed');
    expect(!K().replayJustification('concl:none').ok); });
  C('TMS-ISOLATION', 'justify.js imports only sha256; the kernel never imports sb_sync.js; only answer conclusions with premises are recorded (no lookup, refusal, blocked or sensitive turn); a sealed secret never enters the ledger', () => {
    const js = fs.readFileSync(ROOT + '/src/justify.js', 'utf8'), ks = fs.readFileSync(ROOT + '/src/kernel.js', 'utf8'); expect((js.match(/require\(/g) || []).length === 1 && /require\('\.\/sha256\.js'\)/.test(js) && !/require\(['"]\.\/sb_sync/.test(ks) && !/sb_sync/.test(js));
    const f = K(); run(f, ['remember that my pin is 4821', 'what is my pin?', 'look up the population of France', 'delete all my files']); expect(!/4821/.test(JSON.stringify(f.exportAll().justifications) + JSON.stringify(f.withdrawalReceipts())));
    expect(f.justifications().every(i => i.kind !== 'conclusion' || i.justifications.every(j => j.premises.length >= 1 && j.premises.every(p => typeof p.text === 'string')))); });
};
