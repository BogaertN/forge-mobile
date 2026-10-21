/* live_probe.js (4.9.83): the LIVE measure. Runs a private probe set of ordinary questions through the app's own kernel path (ForgeKernel.process →
 * research tool job) against the real web, with browser semantics: an Origin header is sent and a response without an
 * Access-Control-Allow-Origin header is treated as a CORS failure (as the browser would). Requests are spaced. A case passes when the final
 * answer is not a refusal / mismatch / unsupported answer and contains one of the expected on-topic terms.
 *   FORGE_PRIVATE=/workspace/fm-private node tools/live_probe.js [probe.tsv] [--out file.jsonl] [--gap ms] [--limit n]
 * The probe set is private (never in the repo); this tool only reports a rate and per-case classes. Network flakiness is reported, never fatal. */
const path = require('path'), fs = require('fs');
const ROOT = path.join(__dirname, '..'); const KM = require(ROOT + '/src/kernel.js'), FK = require(ROOT + '/src/forge.js'), AR = require(ROOT + '/src/archives.js');
const LEX = require(ROOT + '/data/lexicon.json'), EXT = require(ROOT + '/data/lexicon-ext.json');
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const PRIV = process.env.FORGE_PRIVATE; const file = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : PRIV && path.join(PRIV, 'live', 'probe_v1.tsv');
if (!file || !fs.existsSync(file)) { console.log(JSON.stringify({ live_probe: 'NOT_RUN', reason: 'no private probe set (FORGE_PRIVATE/live/probe_v1.tsv)' })); process.exit(0); }
const out = arg('--out', null), gap = +arg('--gap', 1500), limit = +arg('--limit', 1e9);
const ORIGIN = 'https://bogaertn.github.io', UA = 'Mozilla/5.0 (ForgeMobile live probe)';
const browserFetch = async (u, o) => { const r = await fetch(u, Object.assign({}, o || {}, { headers: Object.assign({ Origin: ORIGIN, 'User-Agent': UA }, (o && o.headers) || {}) })); const body = await r.text(); const cors = r.headers.get('access-control-allow-origin');
  if (!cors) throw new TypeError('Failed to fetch (no CORS header) ' + String(u).slice(0, 80)); return { ok: r.ok, status: r.status, url: String(u), headers: { get: h => r.headers.get(h) }, text: async () => body, json: async () => JSON.parse(body) }; };
const cases = fs.readFileSync(file, 'utf8').split('\n').filter(l => l.trim() && !l.startsWith('#')).map(l => { const [cat, q, exp] = l.split('\t'); return { cat, q, exp: new RegExp(exp, 'i') }; }).slice(0, limit);
const sleep = ms => new Promise(r => setTimeout(r, ms)); const mk = () => { const st = {}; return KM.MemoryStore({ get: k => st[k], set: (k, v) => { st[k] = v; } }); };
/* 4.9.83: the verdict reads the ANSWER part of the reply only (before the source / provenance tail): the tail's own words ("1 source failed",
 * "no result") are bookkeeping, not the answer, and must not fail a correct answer; "no passage answered" is a non-answer. */
const answerPart = r => String(r).split(/\s(?=The source(?:s)? |It comes from |I checked |The provenance |The class is )/)[0];
const BAD = /SUBJECT_MISMATCH|ABOVE_DRIFT_BAND|drift of every source|no passage answered|does not (?:state|support)|not supported|unsupported|could not attach|found no (?:verb|subject)|no stored fact|cannot confirm|I do not know the word|no result|failed|not authorized/i;
(async () => { const rows = []; let i = 0;
  for (const c of cases) { i++; AR._cache.clear(); let row = { cat: c.cat, q: c.q };
    try { const f = FK.ForgeKernel({ clock: () => new Date().toISOString(), lexicon: LEX, lexiconExt: EXT, store: mk(), vaultIterations: 1000, fetch: browserFetch }); await f.vault.setup('live probe pass'); await f.vault.unlock('live probe pass');
      const r = f.process(c.q); const t = r.toolJob ? await Promise.race([r.toolJob, sleep(60000).then(() => null)]) : null; const fin = t || r; const m = (fin.trace && fin.trace.msm && fin.trace.msm.meaning) || {}; const reply = String(fin.reply || fin.text || '');
      const tr = (t && t.trace) || {}; row = Object.assign(row, { tool: !!r.toolJob, timeout: !!(r.toolJob && !t), kind: m.kind, reply: reply.slice(0, 1200), first: String(r.reply || '').slice(0, 200), block: tr.block_reason || m.reason || m.code || null, trace_subject: tr.trace_subject !== undefined ? tr.trace_subject : (m.trace_subject !== undefined ? m.trace_subject : undefined), subject: m.subject || (m.plan && m.plan.subject) || null, query: (m.plan && (m.plan.query || m.plan.q)) || m.query || null, rules: (fin.trace && fin.trace.rules || []).map(x => x.id).filter(x => /SUBJ|ENT|ROUTE|RESEARCH|ARCH|AUTH|EVID|ATTR|TOOL/.test(x)).slice(0, 30) });
      const ans = answerPart(reply); row.answer = ans.slice(0, 400); row.pass = !!r.toolJob && !!t && !BAD.test(ans) && c.exp.test(ans);
      if (!r.toolJob) row.pass = !BAD.test(ans) && c.exp.test(ans); }
    catch (e) { row.error = String(e && e.message || e).slice(0, 300); row.pass = false; }
    rows.push(row); if (out) fs.appendFileSync(out, JSON.stringify(row) + '\n'); process.stderr.write((row.pass ? 'PASS ' : 'FAIL ') + i + '/' + cases.length + ' ' + c.q + '\n'); await sleep(gap); }
  const by = {}; for (const r of rows) { by[r.cat] = by[r.cat] || [0, 0]; by[r.cat][1]++; if (r.pass) by[r.cat][0]++; }
  console.log(JSON.stringify({ live_probe: 'RUN', file_sha256: require('crypto').createHash('sha256').update(fs.readFileSync(file)).digest('hex').slice(0, 16), passed: rows.filter(r => r.pass).length, total: rows.length, by_category: by })); })();
