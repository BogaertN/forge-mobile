/* HELDOUT-EVAL (M0 guard rails, 4.9.57) — a fixed held-out language-core set (heldout/HELDOUT_DO_NOT_TUNE.json) written fresh and NEVER used for
 * tuning. Scores are REPORTED (artifact verify/eval_scores.json + console), not required: the suite blocks a release only when it crashes or when a
 * case that passed at the recorded baseline (eval_baseline.json) fails now. The first check reuses the "keep test questions out of shipped comments"
 * mechanism (W48/W49/W50: normalised word windows over every shipped file) so no held-out sentence — and no held-out made-up word — is in the code. */
const fs = require('fs'), path = require('path');
const E = require('./eval_lib.js'); const ROOT = E.ROOT;
const KMOD = require(ROOT + '/src/kernel.js'); const LEX = require(ROOT + '/data/lexicon.json'), EXT = require(ROOT + '/data/lexicon-ext.json');
const SET = JSON.parse(fs.readFileSync(path.join(__dirname, 'heldout', 'HELDOUT_DO_NOT_TUNE.json'), 'utf8'));
const open = () => KMOD.Kernel({ lexicon: LEX, lexiconExt: EXT, clock: () => '2026-10-18T12:00:00Z' });
const rows = [], tests = []; const T = (name, fn) => tests.push({ name, fn }); const expect = (x, why) => { if (!x) throw new Error(why || 'expectation failed'); };
const G = require(ROOT + '/src/grammar.js'); const inLex = l => !!(LEX.L[l] || (EXT.L && EXT.L[l]) || (LEX.exc && LEX.exc[l]) || G.CL[l]);
const known = w => { const l = w.toLowerCase(); return [l, l.replace(/s$/, ''), l.replace(/es$/, ''), l.replace(/e?d$/, ''), l.replace(/er$/, ''), l.replace(/est$/, '')].some(inLex); };
/* score every case once (crash-safe) */
const results = SET.cases.map(c => { let r = null, err = null; try { r = E.runCase(open, c.turns); } catch (e) { err = String(e && e.message || e).slice(0, 200); }
  const v = err ? 'crash' : E.verdict(r); return { id: c.id, cat: c.cat, expect: c.expect, verdict: v, pass: !err && E.judge(c.expect, v, r && r.reply), crash: err, reply: r && r.reply ? String(r.reply).slice(0, 160) : null, route: r && r.trace && r.trace.selection ? r.trace.selection.winner : null }; });
const base = E.readBaseline(); const passed = results.filter(x => x.pass).length;
const score = { schema: 'forge-heldout-score/v1', set: SET.schema, cases: results.length, passed, rate: +(passed / results.length).toFixed(4), by_category: E.tally(results, 'cat'), results };
E.writeArtifact('heldout_scores.json', score);
T('HELDOUT held-out sentences are not stored in the shipped source (no word window of any shipped file equals a held-out sentence of 4+ words)', () => {
  const sents = new Set(); for (const c of SET.cases) for (const t of c.turns) for (const s of t.split(/(?<=[.?!])\s+/)) { const n = E.norm(s); if (n.split(' ').length >= 4) sents.add(n); }
  expect(sents.size >= 40, 'fewer than 40 held-out sentences'); const lens = [...new Set([...sents].map(s => s.split(' ').length))];
  const words = E.norm(E.SHIPPED().map(f => fs.readFileSync(path.join(ROOT, f), 'utf8')).join('\n')).split(' '); const hits = [];
  for (const L of lens) for (let i = 0; i + L <= words.length; i++) { const w = words.slice(i, i + L).join(' '); if (sents.has(w)) hits.push(w); }
  expect(!hits.length, 'held-out sentence(s) in shipped source: ' + hits.slice(0, 3).join(' | ')); });
T('HELDOUT made-up words of the held-out set occur nowhere in the shipped source (no rule names them)', () => {
  const made = new Set(); for (const c of SET.cases) for (const t of c.turns) for (const w of t.split(/[^A-Za-z]+/)) if (w.length >= 5 && !known(w)) made.add(w.toLowerCase());
  expect(made.size >= 30, 'fewer than 30 made-up words (' + made.size + ')'); const words = new Set(E.norm(E.SHIPPED().map(f => fs.readFileSync(path.join(ROOT, f), 'utf8')).join('\n')).split(' '));
  const hits = [...made].filter(w => words.has(w)); expect(!hits.length, 'made-up held-out word(s) in shipped source: ' + hits.join(', ')); });
T('HELDOUT every held-out case runs to a reply without a crash', () => { const bad = results.filter(x => x.crash); expect(!bad.length, bad.map(x => x.id + ': ' + x.crash).join(' | ')); });
T('HELDOUT no regression: every case that passed at the recorded baseline still passes (scores are reported, not required)', () => {
  expect(base && base.heldout && Array.isArray(base.heldout.passed_ids), 'no recorded held-out baseline in verify/eval_baseline.json');
  const now = new Set(results.filter(x => x.pass).map(x => x.id)); const lost = base.heldout.passed_ids.filter(id => !now.has(id));
  expect(!lost.length, 'regressed vs baseline: ' + lost.map(id => { const x = results.find(y => y.id === id); return id + ' (' + (x ? x.verdict + ' ≠ ' + x.expect : 'missing') + ')'; }).join(', ')); });
for (const t of tests) { try { t.fn(); rows.push({ cls: 'HELDOUT-EVAL', name: t.name, ok: true }); } catch (e) { rows.push({ cls: 'HELDOUT-EVAL', name: t.name, ok: false, why: String(e && e.message || e).slice(0, 1400) }); } }
if (process.argv.includes('--report')) { process.stderr.write('HELDOUT ' + passed + '/' + results.length + '\n' + results.map(x => (x.pass ? 'PASS ' : 'FAIL ') + x.id + ' [' + x.verdict + ' vs ' + x.expect + '] ' + (x.reply || x.crash || '')).join('\n') + '\n'); }
process.stdout.write(JSON.stringify(rows));
