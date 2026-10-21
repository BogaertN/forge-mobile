/* HELDBACK-EVAL (4.9.79, Nic 2026-10-21) — a NEW private held-back set ($FORGE_PRIVATE/heldback2.json, ~90 cases written blind on 2026-10-21 with
 * their behaviour criteria, never in the repo, never tuned on). The repo keeps per-case digests, the criteria SHAPE (no text) and recorded
 * outcomes in verify/heldout/heldout_record.json (part "heldback"); the old 54-case held-out set is now a PUBLIC regression set
 * (verify/regression/public54.json, HELDOUT-EVAL). Criteria (judged on the STRUCTURED result first):
 *   route    research = a research.web tool request; mea = the MEA problem lane / a hypothesis; local = no tool request; any = not judged
 *   verdict  the eval_lib verdict; any / none = reply substrings (case-insensitive); subject = the research subject carries every word
 * Every case fails on a crash, a blocked turn, or an unattached turn ("I could not attach", "Please tell me the role").
 * Research runs offline here (no fetch): only the route and the picked subject are judged. Scores are reported; the suite blocks only on a
 * crash or a regression against the baseline (eval_baseline.json heldback.passed_ids). Verification code only: nothing here ships. */
const fs = require('fs'), path = require('path');
const E = require('./eval_lib.js'); const ROOT = E.ROOT;
const KMOD = require(ROOT + '/src/kernel.js'), PV = require(ROOT + '/src/provenance.js'); const LEX = require(ROOT + '/data/lexicon.json'), EXT = require(ROOT + '/data/lexicon-ext.json');
const HR = require('./heldout_record.js'); const SET = HR.privateJSON('heldback2.json');
const FK = require(ROOT + '/src/forge.js'); let tick = 0; const clock = () => new Date(Date.UTC(2026, 9, 21, 15, 0, 0) + (tick++) * 1000).toISOString();
const mkStore = () => { const st = {}; return KMOD.MemoryStore({ get: k => st[k], set: (k, v) => { st[k] = v; } }); };
const offline = async u => ({ ok: false, status: 503, url: String(u), headers: { get: () => '' }, text: async () => '', json: async () => ({}) });
/* the app's own stack: ForgeKernel (tool routing lives there) with both lexicon tiers, an unlocked vault, and no network */
const open = async () => { const f = FK.ForgeKernel({ clock, lexicon: LEX, lexiconExt: EXT, store: mkStore(), vaultIterations: 1000, fetch: offline }); await f.vault.setup('held back'); await f.vault.unlock('held back'); return f; };
const rows = [], tests = []; const T = (name, fn) => tests.push({ name, fn }); const expect = (x, why) => { if (!x) throw new Error(why || 'expectation failed'); };
const REC = HR.recorded('heldback'); const caseSha = c => HR.sha(JSON.stringify(c));
const low = s => String(s || '').toLowerCase();
function routeOf(r) { const tr = r && r.trace && r.trace.tool_request, m = (r && r.trace && r.trace.msm && r.trace.msm.meaning) || {}; const tool = tr ? String(tr.tool || tr) : '';
  if (/^(mea_|hypothesis)/.test(m.kind || '') || /mea|hypothes/i.test(tool)) return 'mea'; if (/research\.web/.test(tool)) return 'research'; if (tool) return 'tool:' + tool; return 'local'; }
function judgeCase(c, r, k) { const why = []; const v = E.verdict(r), txt = String((r && r.reply) || ''), rt = routeOf(r);
  if (v === 'crash' || v === 'blocked') why.push(v); if (/I could not attach|Please tell me the role/.test(txt) && !(c.allow || []).includes('unattached')) why.push('unattached');
  if (c.route && c.route !== 'any' && rt !== c.route) why.push('route ' + rt);
  if (c.verdict && !E.judge(c.verdict, v, txt)) why.push('verdict ' + v);
  if (c.any && !c.any.some(s => low(txt).includes(low(s)))) why.push('missing');
  if (c.none && c.none.some(s => low(txt).includes(low(s)))) why.push('forbidden');
  if (c.subject && c.subject.length && rt === 'research') { const last = c.turns[c.turns.length - 1]; let q = ''; try { q = low(PV.questionEntity(k.lookupPlan(last), last)); } catch (e) { q = ''; } if (!c.subject.every(w => q.split(/[^a-z0-9]+/).some(x => x === w || x === w + 's' || x + 's' === w))) why.push('subject'); }
  return { verdict: v, route: rt, pass: !why.length, fail: why }; }
(async () => {
const results = SET ? await Promise.all(SET.cases.map(async c => { let r = null, err = null, k = null; try { const f = await open(); k = f.kernel || f; for (const t of c.turns) { r = f.process(t); if (r && r.toolJob) await r.toolJob.catch(() => null); } } catch (e) { err = String(e && e.message || e).slice(0, 200); }
  const j = err ? { verdict: 'crash', route: '-', pass: false, fail: ['crash'] } : judgeCase(c, r, k); return { id: c.id, cat: c.cat, case_sha256: caseSha(c), verdict: j.verdict, route: j.route, pass: j.pass, fail: j.fail, crash: !!err, _crash: err, _reply: r && r.reply ? String(r.reply).slice(0, 200) : null }; }))
  : REC.status === 'ok' ? REC.part.cases.map(x => Object.assign({}, x)) : [];
const sentsOf = () => { const s = new Set(); for (const c of SET.cases) for (const t of c.turns) for (const x of t.split(/(?<=[.?!])\s+/)) { const n = E.norm(x); if (n.split(' ').length >= 4) s.add(n); } return [...s]; };
const part = SET ? { set_schema: SET.schema, set_sha256: HR.sha(JSON.stringify(SET)), cases: results.map(({ _crash, _reply, ...x }) => x), sentence_windows: HR.windowDigests(sentsOf()), sentence_count: sentsOf().length } : REC.part || null;
const base = E.readBaseline(); const passed = results.filter(x => x.pass).length, total = results.length;
E.writeArtifact('heldback_scores.json', { schema: 'forge-heldback-score/v1', mode: SET ? 'private' : 'record', cases: total, passed, rate: +(passed / (total || 1)).toFixed(4), by_category: E.tally(results, 'cat'), results: results.map(({ _crash, _reply, ...x }) => x) });
if (SET && HR.recording()) HR.writePart('heldback', part);
T('HELDBACK the held-back set is private: no case text in the repo, the record holds digests and outcomes only', () => { expect(!/"turns"/.test(fs.readFileSync(HR.RECORD_FILE, 'utf8')), 'case text in the record'); expect(!fs.existsSync(path.join(__dirname, 'heldout', 'heldback2.json')) && !fs.existsSync(path.join(__dirname, 'regression', 'heldback2.json')), 'plain-text held-back file in the repo'); });
T('HELDBACK the record matches the current tree (' + (SET ? 'private set present: the evaluation reproduces the record' : 'no private set: the record is validated') + '; re-record with node verify/record_heldout.js)', () => {
  if (SET && HR.recording()) return; expect(REC.status === 'ok', 'record ' + REC.status + (REC.recorded_tree ? ' (recorded ' + REC.recorded_tree.slice(0, 12) + ', current ' + REC.tree.slice(0, 12) + ')' : ''));
  if (SET) expect(JSON.stringify(REC.part.cases) === JSON.stringify(part.cases) && JSON.stringify(REC.part.sentence_windows) === JSON.stringify(part.sentence_windows), 'the evaluation differs from the record'); });
T('HELDBACK held-back sentences are not in the shipped source (no 4+ word window hashes to one)', () => { expect(part && part.sentence_count >= 60, 'fewer than 60 held-back sentences'); const hits = HR.shippedWindowHits(part.sentence_windows); expect(!hits.length, 'held-back sentence(s) in shipped source: ' + hits.slice(0, 3).join(' | ')); });
T('HELDBACK every case runs to a reply without a crash', () => { const bad = results.filter(x => x.crash); expect(!bad.length, bad.map(x => x.id).join(' ')); });
T('HELDBACK no regression: every case that passed at the recorded baseline still passes (scores are reported, not required)', () => { expect(base && base.heldback && Array.isArray(base.heldback.passed_ids), 'no held-back baseline in verify/eval_baseline.json');
  const now = new Set(results.filter(x => x.pass).map(x => x.id)); const lost = base.heldback.passed_ids.filter(id => !now.has(id)); expect(!lost.length, 'regressed vs baseline: ' + lost.join(', ')); });
for (const t of tests) { try { t.fn(); rows.push({ cls: 'HELDBACK-EVAL', name: t.name, ok: true }); } catch (e) { rows.push({ cls: 'HELDBACK-EVAL', name: t.name, ok: false, why: String(e && e.message || e).slice(0, 1400) }); } }
if (process.argv.includes('--report')) process.stderr.write('HELDBACK ' + passed + '/' + total + '\n' + results.map(x => (x.pass ? 'PASS ' : 'FAIL ') + x.id + ' [' + x.route + ' ' + x.verdict + ' ' + (x.fail || []).join(',') + '] ' + (x._reply || x._crash || '')).join('\n') + '\n');
process.stdout.write(JSON.stringify(rows));
})();
