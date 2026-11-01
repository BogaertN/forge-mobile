/* R4205 (4.9.205): Supabase writer lockdown (Nic decision (d)).
 * A memory-table write needs a signed-in account that holds the writer role, a live link to the owner account, and a device
 * signature that is VERIFIED (ECDSA P-256 over a fixed proof body that binds the account, device, nonce, time and the SHA-256
 * of the exact write arguments). The client RPC with a length-only signature check is closed. The Edge Function core
 * (supabase/functions/memory-writer/writer.js) runs here unchanged against a fake database. No LLM. */
const fs = require('fs');
const path = require('path');
const wc = require('crypto').webcrypto;
const ROOT = path.join(__dirname, '..');
const REPO = path.join(ROOT, '..');
const KMOD = require(ROOT + '/src/kernel.js'); const FK = require(ROOT + '/src/forge.js'); const LEX = require(ROOT + '/data/lexicon.json');
const SB = require(ROOT + '/src/sb_sync.js');
const tests = [];
const T = (name, fn) => tests.push({ name, fn });
const expect = (c, why) => { if (!c) throw new Error(why || 'expectation failed'); };
const UID = '11111111-2222-3333-4444-555555555555';
const OTHER = '99999999-2222-3333-4444-555555555555';
let tick = 0; const clock = () => new Date(Date.UTC(2026, 9, 31, 3, 0, 0) + (tick++) * 1000).toISOString();
const mkStore = () => { const st = {}; return KMOD.MemoryStore({ get: k => st[k], set: (k, v) => { st[k] = v; } }); };
const FF = () => { tick = 0; return FK.ForgeKernel({ clock, lexicon: LEX, store: mkStore(), vaultIterations: 1000 }); };
const mkLS = () => { const m = {}; return { getItem: k => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); }, removeItem: k => { delete m[k]; }, _m: m }; };
async function unlockedForge() { const f = FF(); await f.vault.setup('pw pw pw'); await f.vault.unlock('pw pw pw'); return f; }
/* 4.9.211: a lasting write carries the engine's write gate (DRIFT-SPEC/v1); r4211 tests the drift refusals */
const CLS = { ok: true, classes: { negation: { answer: false, source: false, ok: true }, certainty: { answer: false, source: false, ok: true }, condition: { answer: false, source: false, ok: true } } };
const ROW = { text: 'Jupiter is the largest planet in the solar system.', sfe: { Phi: 7, eps: 0.12, mu: 1 }, provenance: { question: 'What is the largest planet?', contributor: 'athena', premises: ['a1'] },
  write_gate: { ok: true, failed: [], drift_input: { hist: [5, 6, 7, 8], prev: 8, act: 9, depth: 1, scheme: 'phase-scheme/rmc/v1' }, drift: { eps: 0.119133, metric_id: 'eps_s/rsoc-v4.8+circ/v1' }, echo: 1, echo_classes: CLS, coherence: 0.89, drift_status: 'stable', phase_scheme_id: 'phase-scheme/rmc/v1' } };
const migration = () => fs.readFileSync(path.join(REPO, 'supabase', 'migrations', '20261031220000_writer_lockdown_205.sql'), 'utf8');

/* a fake Supabase: auth, the tables the Edge Function reads, and the signed RPC */
function fakeSupabase(o) {
  const db = { links: o.links, roles: o.roles, keys: o.keys, inserted: [], nonces: new Set() };
  const res = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
  const server = async (url, init) => {
    const u = new URL(url); const q = k => (u.searchParams.get(k) || '').replace(/^eq\./, '');
    if (u.pathname === '/auth/v1/user') return /Bearer a\.b\.c$/.test(String(init.headers.authorization)) ? res(200, { id: o.sessionUid || UID }) : res(401, {});
    if (u.pathname === '/rest/v1/account_links') return res(200, db.links.filter(l => l.user_id === q('user_id')));
    if (u.pathname === '/rest/v1/app_roles') return res(200, db.roles.filter(r => r.user_id === q('user_id') && r.role === q('role')));
    if (u.pathname === '/rest/v1/device_keys') return res(200, db.keys.filter(k => k.signer_id === q('signer_id')));
    if (u.pathname === '/rest/v1/rpc/memory_writer_insert_signed') { const a = JSON.parse(init.body);
      if (String(init.headers.authorization) !== 'Bearer SERVICE') return res(403, { message: 'permission denied' });
      if (db.nonces.has(a.p_signer_id + a.p_nonce)) return res(400, { message: 'KB-WRITER-REPLAY' }); db.nonces.add(a.p_signer_id + a.p_nonce);
      if (a.p_payload.sfe.eps > 0.35) return res(400, { message: 'KB-WRITER-PACKET-REQUIRED' });
      const row = { id: 'row-' + db.inserted.length, state: 'admitted', kind: 'fact', contributor_id: a.p_uid, signer_id: a.p_signer_id, payload: Object.assign({}, a.p_payload, { provenance: a.p_provenance, contributor: a.p_contributor }), inserted: true, verified: true };
      db.inserted.push(a); return res(200, row); }
    return res(404, {});
  };
  return { db, server };
}
async function rig(o) {
  o = o || {};
  const W = await import(path.join(REPO, 'supabase', 'functions', 'memory-writer', 'writer.js'));
  const f = o.locked ? FF() : await unlockedForge();
  const id = o.locked ? null : await f.signer.ensure();
  const keys = id ? [{ signer_id: id.signer, owner: o.keyOwner || UID, pub_jwk: id.pub, revoked_at: o.revoked ? '2026-10-31' : null }] : [];
  const fake = fakeSupabase({ links: o.unlinked ? [] : [{ user_id: UID, revoked_at: null }], roles: o.noWriter ? [] : [{ user_id: UID, role: 'writer' }], keys, sessionUid: o.sessionUid });
  const calls = [];
  const net = async (url, init) => { calls.push(url); const u = new URL(url);
    if (u.pathname === '/functions/v1/memory-writer') {
      let body = init.body; if (o.tamperArgs) { const b = JSON.parse(body); b.args.p_payload.text = 'Saturn is the largest planet.'; body = JSON.stringify(b); }
      if (o.tamperBody) { const b = JSON.parse(body); b.proof.body.ts += 1; body = JSON.stringify(b); }
      const r = await W.handle(new Request(url, { method: 'POST', headers: init.headers, body }), { url: 'https://x.supabase.co', service: 'SERVICE', anon: 'ANON', fetch: fake.server, now: () => (o.skewSec ? Date.now() + o.skewSec * 1000 : Date.now()) });
      return { ok: r.ok, status: r.status, json: async () => r.json() }; }
    const r = await fake.server(url, init || { headers: {} }); return { ok: r.ok, status: r.status, json: async () => r.json() }; };
  const ls = mkLS(); const c = SB.Client({ storage: ls, fetch: net, crypto: wc });
  await c.handleCallback({ hash: '#access_token=a.b.c&refresh_token=r&expires_in=3600', pathname: '/forge-mobile/', search: '' }, { replaceState() {} });
  if (id && !o.unregistered) ls.setItem(SB.DKEY, JSON.stringify({ uid: UID, signer_id: id.signer }));
  const sign = o.noSigner ? undefined : (uid, sha, nonce) => f.signer.writerProof(uid, sha, nonce);
  const out = await c.insertAdmitted(Object.assign({}, ROW), sign);
  return { out, calls, fake, f, W };
}

T('linked writer + registered device + verified signature writes, and the row carries the device', async () => {
  const r = await rig();
  expect(r.out.ok && r.out.written && r.out.verified && r.out.rule === 'KB-WRITER-VERIFIED' && r.out.pending === false, JSON.stringify(r.out));
  expect(r.fake.db.inserted.length === 1, 'one insert');
  const a = r.fake.db.inserted[0];
  expect(a.p_signed_body.purpose === 'forge-memory-writer/v1' && a.p_signed_body.uid === UID && a.p_signer_id === a.p_signed_body.signer && /^[A-Za-z0-9+/]{86}==$/.test(a.p_signature), 'signed body stored');
  expect(a.p_payload.sfe.eps === 0.12 && a.p_payload.state === 'admitted', 'packet');
  expect(r.calls.some(u => /\/functions\/v1\/memory-writer$/.test(u)) && !r.calls.some(u => /rpc\/memory_writer_insert/.test(u)), 'client uses the Edge Function, not the RPC');
});
T('arguments changed after signing are refused (the signature binds their SHA-256)', async () => {
  const r = await rig({ tamperArgs: true }); expect(!r.out.ok && r.out.rule === 'KB-WRITER-CONTENT-MISMATCH' && !r.fake.db.inserted.length, JSON.stringify(r.out)); });
T('a changed proof body fails the ECDSA verification', async () => {
  const r = await rig({ tamperBody: true }); expect(!r.out.ok && r.out.rule === 'KB-WRITER-BAD-SIGNATURE' && !r.fake.db.inserted.length, JSON.stringify(r.out)); });
T('an account that is not linked to the owner cannot write', async () => {
  const r = await rig({ unlinked: true }); expect(!r.out.ok && r.out.rule === 'KB-WRITER-NOT-LINKED' && !r.fake.db.inserted.length, JSON.stringify(r.out)); });
T('a linked account without the writer role cannot write', async () => {
  const r = await rig({ noWriter: true }); expect(!r.out.ok && r.out.rule === 'KB-WRITER-NOT-LINKED' && !r.fake.db.inserted.length, JSON.stringify(r.out)); });
T('a device key registered to another account, or revoked, is refused', async () => {
  const a = await rig({ keyOwner: OTHER }); expect(!a.out.ok && a.out.rule === 'KB-WRITER-DEVICE-UNKNOWN', JSON.stringify(a.out));
  const b = await rig({ revoked: true }); expect(!b.out.ok && b.out.rule === 'KB-WRITER-DEVICE-UNKNOWN' && !b.fake.db.inserted.length, JSON.stringify(b.out)); });
T('a stale proof is refused', async () => {
  const r = await rig({ skewSec: 900 }); expect(!r.out.ok && r.out.rule === 'KB-WRITER-STALE-PROOF', JSON.stringify(r.out)); });
T('locked vault, unregistered device or no signer: nothing is sent and the row stays local and pending', async () => {
  for (const [o, rule] of [[{ locked: true }, 'KB-WRITER-DEVICE-NOT-REGISTERED'], [{ unregistered: true }, 'KB-WRITER-DEVICE-NOT-REGISTERED'], [{ noSigner: true }, 'KB-WRITER-UNSIGNED']]) {
    const r = await rig(o); expect(!r.out.ok && r.out.pending === true && r.out.rule === rule && !r.calls.some(u => /memory-writer/.test(u)), JSON.stringify([o, r.out])); }
});
T('no session: nothing is sent', async () => {
  const c = SB.Client({ storage: mkLS(), fetch: async () => { throw new Error('network used'); }, crypto: wc });
  const out = await c.insertAdmitted(ROW, () => null); expect(!out.ok && out.rule === 'KB-WRITER-NO-SESSION' && out.pending === true, JSON.stringify(out)); });
T('the Edge Function refuses anon and the publishable key; CORS allows only the Pages origin', async () => {
  const W = await import(path.join(REPO, 'supabase', 'functions', 'memory-writer', 'writer.js'));
  const d = { url: 'https://x.supabase.co', service: 'S', anon: 'A', fetch: async () => new Response('{}', { status: 401 }), now: () => Date.now() };
  const a = await W.handle(new Request('https://x/functions/v1/memory-writer', { method: 'POST', body: '{}' }), d); expect(a.status === 401 && (await a.json()).rule === 'KB-WRITER-NO-SESSION', 'anon');
  const b = await W.handle(new Request('https://x/functions/v1/memory-writer', { method: 'POST', headers: { authorization: 'Bearer sb_publishable_x' }, body: '{}' }), d); expect(b.status === 401 && (await b.json()).rule === 'KB-WRITER-BAD-SESSION', 'publishable');
  const p = await W.handle(new Request('https://x/functions/v1/memory-writer', { method: 'OPTIONS', headers: { origin: 'https://evil.example' } }), d); expect(!p.headers.get('access-control-allow-origin'), 'cors evil');
  const q = await W.handle(new Request('https://x/functions/v1/memory-writer', { method: 'OPTIONS', headers: { origin: 'https://bogaertn.github.io' } }), d); expect(q.headers.get('access-control-allow-origin') === 'https://bogaertn.github.io', 'cors pages');
});
T('writerProof signs only its fixed shape; registration proof is unchanged', async () => {
  const f = await unlockedForge(); const sha = 'a'.repeat(64), n = 'b'.repeat(32);
  expect(await FF().signer.writerProof(UID, sha, n) === null, 'locked vault');
  expect(await f.signer.writerProof('x', sha, n) === null && await f.signer.writerProof(UID, 'zz', n) === null && await f.signer.writerProof(UID, sha, 'short') === null, 'shape');
  const p = await f.signer.writerProof(UID, sha, n);
  expect(Object.keys(p.body).sort().join() === 'content_sha256,nonce,purpose,signer,ts,uid' && p.body.purpose === 'forge-memory-writer/v1', JSON.stringify(p.body));
  const d = await f.signer.deviceProof(UID, n); expect(Object.keys(d.body).sort().join() === 'nonce,purpose,signer,ts,uid' && d.body.purpose === 'forge-register-device/v1', 'device proof');
});
T('migration: writer role, owner link, signed path only, eps <= 0.35 kept, other client writes need a link', () => {
  const s = migration();
  expect(/check \(role in \('owner', 'contributor', 'writer'\)\)/.test(s), 'writer role');
  expect(/create table if not exists public\.account_links/.test(s) && /function app\.is_linked/.test(s) && /function app\.can_write/.test(s), 'links');
  expect(/WRITER-ROLE-NEEDS-LINK/.test(s) && /LINK-OWNER-ONLY/.test(s), 'role guard');
  expect(/revoke all on function public\.memory_writer_insert\(text, jsonb, jsonb, jsonb, text, text, jsonb, jsonb, text\) from public, anon, authenticated/.test(s), 'old rpc closed');
  expect(/KB-WRITER-SIGNED-PATH-REQUIRED/.test(s) && /grant execute on function public\.memory_writer_insert_signed\([^)]*\) to service_role;/.test(s) && !/memory_writer_insert_signed\([^)]*\) to [^;]*authenticated/.test(s), 'signed only');
  expect(/v_eps > 0\.35/.test(s) && /KB-WRITER-REPLAY/.test(s) && /KB-WRITER-STALE-PROOF/.test(s), 'law + replay');
  expect(/policy blobs_insert[\s\S]*app\.is_linked/.test(s) && /DEVICE-OWNER-NOT-LINKED/.test(s), 'other paths');
  expect(!/delete from kb\./i.test(s) && !/auth\.config|disable_signup/i.test(s), 'no kb deletes, no auth settings');
  const t = fs.readFileSync(path.join(REPO, 'supabase', 'tests', 'writer_lockdown_205_test.sql'), 'utf8');
  expect(/WRITER_LOCKDOWN_RESULTS/.test(t) && /stranger_cannot_write/.test(t) && /anon_old_rpc_denied/.test(t), 'acceptance test');
});
T('the app passes the device signer, and no client code calls the closed RPC', () => {
  const app = fs.readFileSync(ROOT + '/src/app.js', 'utf8'); expect(/KSb\.insertAdmitted\(body, \(uid, sha, nonce\) => forge\.signer && forge\.signer\.writerProof/.test(app), 'app.js');
  const sb = fs.readFileSync(ROOT + '/src/sb_sync.js', 'utf8'); expect(!/rpc\/memory_writer_insert/.test(sb) && /functions\/v1\/memory-writer/.test(sb), 'sb_sync');
});
T('version, registry, CONFLICTS and the drift law', () => {
  const ver = fs.readFileSync(path.join(ROOT, 'VERSION'), 'utf8').trim(); expect(ver === '4.9.217', ver);
  const reg = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'feature_registry.json'), 'utf8'));
  expect(reg.version === ver && reg.features.some(f => f.id === 'R4205-WRITER-LOCKDOWN') && reg.count === reg.features.length, reg.version);
  const conf = fs.readFileSync(path.join(ROOT, 'CONFLICTS.md'), 'utf8'); expect(/## v4\.9\.205/.test(conf) && /writer/i.test(conf), 'CONFLICTS');
  const cfg = fs.readFileSync(path.join(ROOT, 'engine', 'rmc_engine_v1', 'mobile_config.py'), 'utf8'); expect(/0\.35/.test(cfg) && /0\.8/.test(cfg), 'drift bands untouched');
});

(async () => {
  const rows = []; let failed = 0;
  for (const t of tests) {
    try { await t.fn(); rows.push({ cls: 'R4205', name: t.name, ok: true }); }
    catch (e) { failed++; rows.push({ cls: 'R4205', name: t.name, ok: false, why: String(e && e.message || e).slice(0, 900) }); }
  }
  console.log(JSON.stringify(rows, null, 1));
  process.exit(failed ? 1 : 0);
})();
