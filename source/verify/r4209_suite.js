/* R4209 (4.9.209): Nic plan, Release A.
 * 1. Engine candidate fallback: when the top candidate fails Echo or the gate, the next-ranked candidates are tried (at most 3,
 *    each re-measured by the same engine and gate); never on a hard stop or a conflict. Trusted anchors outrank unsourced rows,
 *    and Ask picks shared rows by the question's surface phrase (before: the last 12 Z rows, which made "Why is the sky blue?" hold).
 * 2. Ask does not write: the engine returns a proposal; only "remember …" or the Remember tap writes.
 * 3. Curated kb.contributions (admitted) are read back through read-only functions and cached on the phone, same gate.
 * 4. memory_writer_hosted.py uses the Edge Function path with the same canonical args and sha as the phone; ho-* ids gone.
 * Real engine, no LLM, no network. */
const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const ROOT = path.join(__dirname, '..');
const tests = [];
const T = (name, fn) => tests.push({ name, fn });
const expect = (c, why) => { if (!c) throw new Error(why || 'expectation failed'); };
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
let CHK = null;
const chk = () => (CHK = CHK || JSON.parse(cp.execFileSync(process.env.PYTHON || 'python3', ['tools/check_209.py'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 26 }).trim().split('\n').pop()));
const app = read('src/app.js');
const say = app.slice(app.indexOf('async function say'), app.indexOf('function renderRmc'));

T('the 4.9.208 live failure is fixed: with the 12 unsourced Z rows present, "Why is the sky blue?" speaks the trusted anchor', () => {
  const r = chk().sky_z;
  expect(r.product_reply && /sky looks blue/.test(r.reply) && r.echo >= 0.85 && r.trust === 'TRUST-CLEAR', JSON.stringify(r).slice(0, 500));
  expect(r.reply === chk().sky.reply, 'same answer with and without the unrelated rows');
});
T('candidate fallback: the top candidate failed Echo, the next-ranked one was measured and admitted, and the record lists the try', () => {
  const r = chk().planet; const f = r.fallback;
  expect(r.product_reply && /^Jupiter is the fifth planet/.test(r.reply) && r.echo >= 0.85, JSON.stringify(r).slice(0, 400));
  expect(f && f.rule === 'ENGINE-CANDIDATE-FALLBACK' && f.max === 3 && f.calls_llm === false && f.spoken_after === f.tried.length && f.tried.length >= 1 && f.tried.length <= 3, JSON.stringify(f));
  expect(f.tried.every(t => t.candidate && t.echo < 0.85 && t.excluded.length && t.excluded.every(id => !/^web-/.test(id))), JSON.stringify(f.tried));
});
T('fallback bounds: held when nothing is left, never on a hard stop, a conflict, a spoken answer or a dry run, never drops research', () => {
  const a = chk().alone; const e = chk().eligible;
  expect(!a.product_reply && a.reply === null && a.fallback.rule === 'ENGINE-CANDIDATE-FALLBACK-EXHAUSTED' && a.fallback.spoken_after === null, JSON.stringify(a.fallback));
  expect(e.hard === false && e.conflict === false && e.spoken === false && e.dry === false && e.held === true && e.max === 3, JSON.stringify(e));
  expect(Array.isArray(e.research_rows) && e.research_rows.length === 0, 'research rows are never candidates to drop');
  expect(chk().mine.product_reply && chk().mine.reply === 'My car is red.', 'a remembered statement answers its own question');
});
T('every Ask lookup ranks by phase resonance: trust, then grace (phase alignment), then concepts; no token overlap', () => {
  const rr = read('engine/rmc_engine_v1/resonance_recall.py');
  expect(/def _trusted\(/.test(rr) && /def _resonance\(/.test(rr), 'keys');
  expect(/role_locks\.sort\(key=lambda row: \(_trusted\(row\[0\]\), _resonance\(row\[2\]\)\)/.test(rr) && /return \(_trusted\(row\[0\]\), _resonance\(row\[2\]\), specific\)/.test(rr), 'grace ranks right after trust');
  expect(/"uses_token_overlap": False/.test(rr), 'record');
  const mr = read('engine/rmc_engine_v1/memory_recaller.py');
  expect(!/def _score_node|legacy_overlap|semantic_overlap|def _tokens/.test(mr) && /resonance_report = rank_memory\(source_text, nodes, phase_report\)/.test(mr), 'the token-overlap recall branch is gone');
});
T('the phone does no lookup of its own: the shared packs and contributions go to the engine as pools, picked by packet concepts', () => {
  const r = chk().sky_pool; const p = r.preselect;
  expect(r.product_reply && r.reply === chk().sky.reply, JSON.stringify(r).slice(0, 300));
  expect(p && p.rule === 'ENGINE-POOL-PRESELECT' && p.method === 'resonance_packet_concepts' && p.uses_token_overlap === false && p.calls_llm === false, JSON.stringify(p));
  const pool = p.pools[0];
  expect(pool.name === 'confirmed_shared' && pool.pool === 12 && pool.cap === 12 && pool.kept.every(id => (pool.concepts[id] || []).some(c => p.question_concepts.indexOf(c) >= 0)), JSON.stringify(pool));
  expect(pool.kept.indexOf('cs:c96298fa8d98f5b9') < 0, 'a row with no shared packet concept is not a candidate');
  const mem = app.slice(app.indexOf('async function askMemory'), app.indexOf('function doc6Tag'));
  expect(!/slice\(-12\)/.test(mem) && !/bySurface|askSurfaces|indexOf\(' ' \+/.test(mem), 'no phone-side text matching for rows');
  expect(/name: 'confirmed_shared', into: 'hosted'/.test(mem) && /name: 'kb_contributions', into: 'hosted'/.test(mem), 'pools');
  expect(/def preselect_pools\(/.test(read('engine/rmc_engine_v1/rmc_core.py')), 'engine selects');
});
T('Ask writes nothing: the engine proposes, the phone stores only on "remember …" or the Remember tap', () => {
  const w = chk().sky.memory_write;
  expect(w.committed === false && w.proposed === true && w.rule === 'ASK-NO-AUTO-WRITE' && w.proposal.text === chk().sky.reply, JSON.stringify(w).slice(0, 300));
  expect(w.supabase.attempted === false && w.supabase.written === false && !w.phone_kb && !w.hosted_kb && !w.rmc_receipt, JSON.stringify(w.supabase));
  const core = read('engine/rmc_engine_v1/rmc_core.py');
  expect(!/commit_hosted/.test(core), 'no hosted commit in the engine');
  expect(!/insertAdmitted|FORGE_ADMITTED|saveReceipt|receipts\.push/.test(say), 'no write in the Ask path');
  expect(/REMEMBER_LAST\.test\(text\)/.test(say) && /REMEMBER_STATEMENT\.test\(text\)/.test(say) && /data-ask-remember/.test(say), 'explicit paths');
  const rem = app.slice(app.indexOf('async function rememberAnswer'), app.indexOf('const REMEMBER_STATEMENT'));
  expect(/KSb\.insertAdmitted\(body, \(uid, sha, nonce\) =>/.test(rem) && /requested_by: 'user'/.test(rem), 'the answer write goes through the locked writer');
  const st = app.slice(app.indexOf('async function rememberStatement'), app.indexOf('const REMEMBER_LAST'));
  expect(!/insertAdmitted|KSb/.test(st) && /PRIV-SECRET-NOT-KEPT/.test(st) && /REMEMBER-NOT-A-STATEMENT/.test(st), 'personal statements stay on the phone');
  const askMem = app.slice(app.indexOf('async function askMemory'), app.indexOf('function doc6Tag'));
  expect(!/FORGE_ADMITTED|load\('receipts'\)|receipts\.concat/.test(askMem), 'receipts are not fed back to Ask');
});
T('Athena curation writes still go through the locked writer, using the engine proposal', () => {
  const cu = read('src/curators_208.js');
  expect(/mw\.proposal \|\| mw\.hosted_kb/.test(cu) && !/memory_writer_insert/.test(cu), 'curators');
});
T('curated contributions are read through read-only functions, granted to anon, admitted facts only', () => {
  const sql = read('../supabase/migrations/20261101000000_contributions_read_209.sql');
  expect(/function public\.kb_contributions_admitted/.test(sql) && /function public\.kb_contributions_digest/.test(sql), 'functions');
  expect(/state = 'admitted'/.test(sql) && /kind = 'fact'/.test(sql) && /security definer/i.test(sql) && /set search_path = ''/i.test(sql) && /stable/i.test(sql), 'definer, admitted only');
  expect(!/\b(insert|update|delete)\b\s+(into|from)?\s*kb\./i.test(sql), 'no writes');
  const sb = read('src/sb_sync.js');
  expect(/rpc\/kb_contributions_admitted/.test(sb) && /rpc\/kb_contributions_digest/.test(sb), 'client');
});
T('the contributions cache keeps only gated rows, refetches only when the digest changes, and never writes', async () => {
  const CC = require(ROOT + '/src/contrib_cache.js');
  const good = { id: 'u1', text: 'Light from the Sun is scattered by air.', sfe: { Phi: 6, eps: 0.14, mu: 1 }, contributor: 'athena', provenance: { trust: { rests_on: 'nasa-sky', blocks_admit: false } } };
  expect(CC.keep(good), 'good');
  expect(!CC.keep(Object.assign({}, good, { sfe: { Phi: 6, eps: 0.36, mu: 1 } })), 'eps above admit');
  expect(!CC.keep(Object.assign({}, good, { sfe: { Phi: 0, eps: 0.1, mu: 1 } })), 'phi');
  expect(!CC.keep(Object.assign({}, good, { contributor: '' })), 'contributor');
  expect(!CC.keep(Object.assign({}, good, { provenance: { trust: { rests_on: null } } })), 'no anchor');
  expect(!CC.keep(Object.assign({}, good, { provenance: { trust: { rests_on: 'x', blocks_admit: true } } })), 'blocked');
  expect(!CC.keep(Object.assign({}, good, { provenance: { trust: { rests_on: 'x' }, source: 'https://en.wikipedia.org/' } })), 'low trust');
  let t = 0; const calls = { digest: 0, rows: 0 }; let dig = 'a';
  const sb = { contributionsDigest: async () => { calls.digest++; return { ok: true, count: 2, digest: dig }; }, contributionRows: async () => { calls.rows++; return { ok: true, rows: [good, Object.assign({}, good, { id: 'u2', sfe: { Phi: 6, eps: 0.5, mu: 1 } })] }; } };
  const c = CC.ContribCache({ backend: CC.memoryBackend(), sb: () => sb, now: () => t });
  const r1 = await c.ensure(); expect(r1.rule === 'CONTRIB-FETCHED' && r1.count === 1 && r1.writes === false && r1.calls_llm === false, JSON.stringify(r1));
  t = 1000; expect((await c.ensure()).rule === 'CONTRIB-CACHE-FRESH' && calls.digest === 1, 'fresh');
  t = 7 * 3600 * 1000; expect((await c.ensure()).rule === 'CONTRIB-CACHE-CURRENT' && calls.rows === 1, 'digest same: no refetch');
  dig = 'b'; t = 15 * 3600 * 1000; expect((await c.ensure()).rule === 'CONTRIB-FETCHED' && calls.rows === 2, 'digest changed');
  expect((await c.all()).map(r => r.id).join() === 'u1', 'only the gated row');
  expect(!/insertAdmitted|method:\s*'(POST|PATCH|PUT|DELETE)'|fetch\(|\.call\(/.test(read('src/contrib_cache.js')), 'read only');
  expect(/kb:' \+ row\.id/.test(app) && /tier: 'confirmed_shared', state: 'admitted'/.test(app), 'fed to the engine pool under the same gate');
  expect(/src\/contrib_cache\.js/.test(read('index.html')) && /\.\/src\/contrib_cache\.js/.test(read('sw.js')), 'shipped and cached offline');
});
T('memory_writer_hosted.py: Edge Function path, same canonical args and sha as the phone, no direct table insert', () => {
  const c = chk().canon; const SB = require(ROOT + '/src/sb_sync.js'); const { sha256 } = require(ROOT + '/src/sha256.js');
  expect(SB.canon(c.sample) === c.py && sha256(SB.canon(c.sample)) === c.sha, c.py);
  expect(c.arg_keys.join() === 'p_consent,p_contributor,p_kind,p_payload,p_proof,p_provenance,p_sources' && c.purpose === 'forge-memory-writer/v1', JSON.stringify(c.arg_keys));
  const py = read('engine/rmc_engine_v1/memory_writer_hosted.py');
  expect(/functions\/v1\/memory-writer/.test(py) && !/rest\/v1\/rpc\/memory_writer_insert/.test(py) && !/service_role/i.test(py), 'edge path only');
});
T('the stale UNSOURCED_HELD ho-* ids are gone', () => {
  expect(chk().unsourced_held === false && !/UNSOURCED_HELD\s*=/.test(read('engine/rmc_engine_v1/rmc_core.py')), 'constant');
  expect(!/"ho-(quartz|photo|sky)[a-z0-9-]*"\s*[,}\]]/.test(read('engine/rmc_engine_v1/rmc_core.py')), 'ids');
});
T('the Pyodide bundle carries this engine and its SRI is pinned', () => {
  const b = JSON.parse(read('data/py/rmc_engine_bundle.json')).files;
  for (const f of ['rmc_core.py', 'resonance_recall.py', 'memory_writer_hosted.py']) expect(b['rmc_engine_v1/' + f] === read('engine/rmc_engine_v1/' + f), f);
  const sri = 'sha384-' + require('crypto').createHash('sha384').update(fs.readFileSync(path.join(ROOT, 'data/py/rmc_engine_bundle.json'))).digest('base64');
  expect(read('src/rmc_client.js').indexOf(sri) >= 0, 'SRI ' + sri);
});
T('the cold 60 for 4.9.209 is recorded (not tuned): 22 admitted, 38 held, 0 false admits', () => {
  const c = JSON.parse(read('data/cold_209_results.json'));
  expect(/^4\.9\.209$/.test(c.release) && c.tuned === false && c.of === 60 && c.admitted === 22 && c.held === 38 && c.false_admits === 0 && c.calls_llm === false, JSON.stringify({ a: c.admitted, h: c.held }));
  expect(fs.existsSync(path.join(ROOT, '..', 'docs', 'LIVE_TEST_209.md')), 'report');
});
T('version registry names 4.9.209', () => {
  expect(read('VERSION').trim() === '4.9.211', 'VERSION');
  const reg = JSON.parse(read('data/feature_registry.json'));
  expect(reg.features.some(f => f.id === 'R4209-ASK-FALLBACK-NO-AUTOWRITE'), 'registry');
});

(async () => {
  const rows = []; let failed = 0;
  for (const t of tests) {
    try { await t.fn(); rows.push({ cls: 'R4209', name: t.name, ok: true }); }
    catch (e) { failed++; rows.push({ cls: 'R4209', name: t.name, ok: false, why: String(e && e.message || e).slice(0, 900) }); }
  }
  console.log(JSON.stringify(rows, null, 1));
  process.exit(failed ? 1 : 0);
})();
