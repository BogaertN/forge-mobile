/* HELDOUT-EVAL (M0 guard rails, 4.9.57; private since 4.9.78) — a fixed held-out language-core set (PRIVATE: $FORGE_PRIVATE/heldout.json, never in the
 * repo; the repo keeps digests and recorded outcomes only, verify/heldout/heldout_record.json — see heldout_record.js) written fresh and NEVER used for
 * tuning. Scores are REPORTED (artifact verify/eval_scores.json + console), not required: the suite blocks a release only when it crashes or when a
 * case that passed at the recorded baseline (eval_baseline.json) fails now. The first check reuses the "keep test questions out of shipped comments"
 * mechanism (W48/W49/W50: normalised word windows over every shipped file) so no held-out sentence — and no held-out made-up word — is in the code. */
const fs = require('fs'), path = require('path');
const E = require('./eval_lib.js'); const ROOT = E.ROOT;
const KMOD = require(ROOT + '/src/kernel.js'); const LEX = require(ROOT + '/data/lexicon.json'), EXT = require(ROOT + '/data/lexicon-ext.json');
const HR = require('./heldout_record.js'); const SET = JSON.parse(fs.readFileSync(path.join(__dirname, 'regression', 'public54.json'), 'utf8')); /* 4.9.79: the old held-out set is a PUBLIC regression set (Nic 2026-10-21); the private held-back set is heldback_suite.js */
const open = () => KMOD.Kernel({ lexicon: LEX, lexiconExt: EXT, clock: () => '2026-10-18T12:00:00Z' });
const rows = [], tests = []; const T = (name, fn) => tests.push({ name, fn }); const expect = (x, why) => { if (!x) throw new Error(why || 'expectation failed'); };
const G = require(ROOT + '/src/grammar.js'); const inLex = l => !!(LEX.L[l] || (EXT.L && EXT.L[l]) || (LEX.exc && LEX.exc[l]) || G.CL[l]);
const known = w => { const l = w.toLowerCase(); return [l, l.replace(/s$/, ''), l.replace(/es$/, ''), l.replace(/e?d$/, ''), l.replace(/er$/, ''), l.replace(/est$/, '')].some(inLex); };
const REC = HR.recorded('heldout'); const caseSha = c => HR.sha(JSON.stringify(c));
/* score every case once (crash-safe) — only where the private set is present; otherwise the record's outcomes are the scores */
const results = SET ? SET.cases.map(c => { let r = null, err = null; try { r = E.runCase(open, c.turns); } catch (e) { err = String(e && e.message || e).slice(0, 200); }
  const v = err ? 'crash' : E.verdict(r); return { id: c.id, cat: c.cat, case_sha256: caseSha(c), verdict: v, pass: !err && E.judge(c.expect, v, r && r.reply), crash: err ? true : false, _crash: err, _reply: r && r.reply ? String(r.reply).slice(0, 160) : null }; })
  : REC.status === 'ok' ? (REC.manifest ? null : REC.part.cases.map(x => Object.assign({}, x))) : [];
const sentsOf = () => { const sents = new Set(); for (const c of SET.cases) for (const t of c.turns) for (const x of t.split(/(?<=[.?!])\s+/)) { const n = E.norm(x); if (n.split(' ').length >= 4) sents.add(n); } return [...sents]; };
const madeOf = () => { const made = new Set(); for (const c of SET.cases) for (const t of c.turns) for (const w of t.split(/[^A-Za-z]+/)) if (w.length >= 5 && !known(w)) made.add(w.toLowerCase()); return [...made]; };
const part = SET ? { set_schema: SET.schema, set_sha256: HR.sha(JSON.stringify(SET)), cases: results.map(({ _crash, _reply, ...x }) => x), sentence_windows: HR.windowDigests(sentsOf()), sentence_count: sentsOf().length, made_up_sha256: madeOf().map(HR.sha).sort(), made_up_count: madeOf().length } : REC.part || null;
const base = E.readBaseline(); const passed = results ? results.filter(x => x.pass).length : REC.manifest.passed, total = results ? results.length : REC.manifest.total;
const score = { schema: 'forge-heldout-score/v1', set: part && part.set_schema, mode: SET ? 'private' : 'record', cases: total, passed, rate: +(passed / (total || 1)).toFixed(4), by_category: results ? E.tally(results, 'cat') : {}, results: (results || []).map(({ _crash, _reply, ...x }) => x) };
E.writeArtifact('heldout_scores.json', score); if (SET && HR.recording()) HR.writePart('heldout', HR.manifestKey() !== '-|-' ? { passed, total } : part);
T('HELDOUT the 54-case regression set is public (verify/regression/public54.json); the record keeps digests and outcomes only', () => {
  expect(SET && SET.cases.length === 54, 'public regression set missing'); expect(!/"turns"/.test(fs.readFileSync(HR.RECORD_FILE, 'utf8')), 'case text in the record'); });
T('HELDOUT the record matches the current tree (' + (SET ? 'private set present: the evaluation reproduces the record' : 'no private set: the record is validated') + '; a stale record fails — re-record with node verify/record_heldout.js)', () => {
  if (SET && HR.recording()) return; expect(REC.status === 'ok', 'record ' + REC.status + (REC.recorded_tree ? ' (recorded tree ' + REC.recorded_tree.slice(0, 12) + ', current ' + REC.tree.slice(0, 12) + ')' : '') + (REC.note ? ': ' + REC.note : ''));
  if (SET) { if (REC.manifest) expect(REC.manifest.passed === passed && REC.manifest.total === total, 'manifest score differs from the record');
    else expect(JSON.stringify(REC.part.cases) === JSON.stringify(part.cases) && JSON.stringify(REC.part.sentence_windows) === JSON.stringify(part.sentence_windows) && JSON.stringify(REC.part.made_up_sha256) === JSON.stringify(part.made_up_sha256), 'the evaluation differs from the record'); } });
T('HELDOUT held-out sentences are not stored in the shipped source (no word window of any shipped file hashes to a held-out sentence digest of 4+ words)', () => {
  expect(part && part.sentence_count >= 40, 'fewer than 40 held-out sentences'); const hits = HR.shippedWindowHits(part.sentence_windows); expect(!hits.length, 'held-out sentence(s) in shipped source: ' + hits.slice(0, 3).join(' | ')); });
T('HELDOUT made-up words of the held-out set occur nowhere in the shipped source (no rule names them)', () => {
  expect(part && part.made_up_count >= 30, 'fewer than 30 made-up words (' + (part && part.made_up_count) + ')'); const hits = HR.shippedWordHits(part.made_up_sha256); expect(!hits.length, 'made-up held-out word(s) in shipped source: ' + hits.join(', ')); });
T('HELDOUT every held-out case runs to a reply without a crash', () => { const bad = (results || []).filter(x => x.crash); expect(!bad.length, bad.map(x => x.id + ': ' + (x._crash || 'crash')).join(' | ')); });
T('HELDOUT no regression: every case that passed at the recorded baseline still passes (scores are reported, not required)', () => {
  expect(base && base.heldout && Array.isArray(base.heldout.passed_ids), 'no recorded held-out baseline in verify/eval_baseline.json'); if (!results) return; /* a manifest re-judge reports a count only */
  const now = new Set(results.filter(x => x.pass).map(x => x.id)); const lost = base.heldout.passed_ids.filter(id => !now.has(id));
  expect(!lost.length, 'regressed vs baseline: ' + lost.map(id => { const x = results.find(y => y.id === id); return id + ' (' + (x ? x.verdict + (SET ? ' ≠ ' + SET.cases.find(c => c.id === id).expect : '') : 'missing') + ')'; }).join(', ')); });
for (const t of tests) { try { t.fn(); rows.push({ cls: 'HELDOUT-EVAL', name: t.name, ok: true }); } catch (e) { rows.push({ cls: 'HELDOUT-EVAL', name: t.name, ok: false, why: String(e && e.message || e).slice(0, 1400) }); } }
if (process.argv.includes('--report')) { process.stderr.write('HELDOUT ' + passed + '/' + total + '\n' + (results || []).map(x => (x.pass ? 'PASS ' : 'FAIL ') + x.id + ' [' + x.verdict + '] ' + (x._reply || x._crash || '')).join('\n') + '\n'); }
process.stdout.write(JSON.stringify(rows));
