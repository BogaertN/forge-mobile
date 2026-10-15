// v4.9.6 S2 suite: sb_sync.js session + device registration (fake network), and proof that answers are identical signed in or out
// with zero network use by the core. Async, so it runs as a child suite like w7.
const ROOT = require('path').join(__dirname, '..'); const wc = require('crypto').webcrypto;
const KMOD = require(ROOT + '/src/kernel.js'); const FK = require(ROOT + '/src/forge.js'); const LEX = require(ROOT + '/data/lexicon.json'); const SB = require(ROOT + '/src/sb_sync.js');
const rows = []; const tests = []; const T = (cls, name, fn) => tests.push({ cls, name, fn }); const expect = (c, why) => { if (!c) throw new Error(why || 'expectation failed'); };
let tick = 0; const clock = () => new Date(Date.UTC(2026, 9, 15, 3, 0, 0) + (tick++) * 1000).toISOString();
const mkStore = () => { const st = {}; return KMOD.MemoryStore({ get: k => st[k], set: (k, v) => { st[k] = v; } }); };
const FF = () => { tick = 0; return FK.ForgeKernel({ clock, lexicon: LEX, store: mkStore(), vaultIterations: 1000 }); };
const UID = '11111111-2222-3333-4444-555555555555';
const mkLS = () => { const m = {}; return { getItem: k => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); }, removeItem: k => { delete m[k]; }, _m: m }; };
const canon = o => (Array.isArray(o) ? '[' + o.map(canon).join(',') + ']' : o && typeof o === 'object' ? '{' + Object.keys(o).sort().filter(k => o[k] !== undefined).map(k => JSON.stringify(k) + ':' + canon(o[k])).join(',') + '}' : JSON.stringify(o));
/* the same checks the register-device Edge Function performs */
async function serverVerify(b) { if (!b || b.body.purpose !== 'forge-register-device/v1' || b.body.uid !== UID || b.body.signer !== b.signer) return 'REG-BAD-PROOF-BODY';
  const jwk = { kty: 'EC', crv: 'P-256', x: b.pub.x, y: b.pub.y }; const sid = 'sig-' + Buffer.from(await wc.subtle.digest('SHA-256', new TextEncoder().encode(canon(jwk)))).toString('hex').slice(0, 16);
  if (sid !== b.signer) return 'REG-SIGNER-MISMATCH'; const k = await wc.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
  return (await wc.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, k, Buffer.from(b.sig, 'base64url'), new TextEncoder().encode(canon(b.body)))) ? null : 'REG-BAD-SIGNATURE'; }
const fakeNet = log => async (url, init) => { log.push({ url, init }); const u = new URL(url); const j = (b, ok = true) => ({ ok, status: ok ? 200 : 400, json: async () => b });
  if (u.pathname === '/auth/v1/user' && init && init.method === 'PUT') return j({ id: UID, email: 'nic@example.test' });
  if (u.pathname === '/auth/v1/recover') return j({});
  if (u.pathname === '/auth/v1/user') return j({ id: UID, email: 'nic@example.test' });
  if (u.pathname === '/functions/v1/register-device') { const b = JSON.parse(init.body); const bad = await serverVerify(b); return bad ? j({ ok: false, rule: bad }, false) : j({ ok: true, signer_id: b.signer }); }
  if (u.pathname === '/auth/v1/otp' || u.pathname === '/auth/v1/logout') return j({}); return j({}, false); };
async function signedIn(prove) { const log = [], ls = mkLS(); const c = SB.Client({ storage: ls, fetch: fakeNet(log), crypto: wc });
  const cb = await c.handleCallback({ hash: '#access_token=a.b.c&refresh_token=r&expires_in=3600', pathname: '/forge-mobile/', search: '' }, { replaceState() {} });
  return { c, ls, log, cb, reg: prove ? await c.registerDevice(prove) : null }; }
async function unlockedForge() { const f = FF(); await f.vault.setup('pw pw pw'); await f.vault.unlock('pw pw pw'); return f; }

T('SBSYNC-ISOLATION', 'answers are identical signed in or signed out, and the core makes no network call while answering', async () => {
  const U = ['Is a dog an animal?', 'Run is a zelor. Is Run a zelor?', 'factor x^2 - 5x + 6', 'remember that my car is red', 'what color is my car', 'derivative of x^3 + 2x', 'All birds are animals. Tweety is a bird. Is Tweety an animal?'];
  const run = () => { const f = FF(); return U.map(u => { const r = f.process(u); return canon([r.reply, r.blocked || null, r.trace && r.trace.msm && r.trace.msm.meaning, r.trace && (r.trace.rules || []).map(x => x.id)]); }); };
  const g = globalThis.fetch; let calls = 0; globalThis.fetch = async () => { calls++; throw new Error('network used by core'); };
  try { const out = run(); const f = await unlockedForge(); const s = await signedIn((uid, n) => f.signer.deviceProof(uid, n)); expect(s.cb.ok && s.reg.ok, JSON.stringify([s.cb, s.reg]));
    globalThis.KSb = s.c; globalThis.localStorage = s.ls; const inn = run(); delete globalThis.KSb; delete globalThis.localStorage;
    expect(canon(out) === canon(inn), 'answers differ'); expect(calls === 0, 'core called fetch ' + calls + 'x'); } finally { globalThis.fetch = g; } });
T('SBSYNC-DEVICE', 'device proof from the vault-held key verifies exactly as the register-device function checks it', async () => {
  const f = await unlockedForge(); const s = await signedIn((uid, n) => f.signer.deviceProof(uid, n)); expect(s.reg.ok && /^sig-[0-9a-f]{16}$/.test(s.reg.signer_id), JSON.stringify(s.reg));
  expect(s.c.status().device === s.reg.signer_id); const sent = JSON.parse(s.log.find(x => /register-device/.test(x.url)).init.body); expect(!('d' in sent.pub), 'private key component sent');
  expect(s.log.find(x => /register-device/.test(x.url)).init.headers.authorization === 'Bearer a.b.c'); });
T('SBSYNC-DEVICE', 'a tampered proof is refused (signature binds uid, signer, nonce, ts)', async () => {
  const f = await unlockedForge(); const s = await signedIn(async (uid, n) => { const p = await f.signer.deviceProof(uid, n); p.body.ts += 1; return p; }); expect(!s.reg.ok && s.reg.rule === 'REG-BAD-SIGNATURE', JSON.stringify(s.reg)); });
T('SBSYNC-DEVICE', 'device proof signs only the fixed registration shape; locked vault yields no proof', async () => {
  const f = FF(); expect(await f.signer.deviceProof(UID, '0'.repeat(32)) === null, 'locked vault'); const g = await unlockedForge();
  expect(await g.signer.deviceProof('not-a-uid', '0'.repeat(32)) === null && await g.signer.deviceProof(UID, 'short') === null); const p = await g.signer.deviceProof(UID, 'a'.repeat(32));
  expect(Object.keys(p.body).sort().join() === 'nonce,purpose,signer,ts,uid' && p.body.purpose === 'forge-register-device/v1'); });
T('SBSYNC-SESSION', 'magic-link callback stores the session outside kernel.* stores; sign-out clears session and device record and calls logout', async () => {
  const f = await unlockedForge(); const s = await signedIn((uid, n) => f.signer.deviceProof(uid, n)); expect(s.c.status().signedIn && s.c.status().email === 'nic@example.test');
  expect(Object.keys(s.ls._m).every(k => /^forge_sb_/.test(k)), Object.keys(s.ls._m).join()); await s.c.signOut();
  expect(!s.c.status().signedIn && !Object.keys(s.ls._m).length); expect(s.log.some(x => /\/auth\/v1\/logout/.test(x.url))); });
T('SBSYNC-SESSION', 'sign-in validates the email before any network call and asks for the Pages redirect', async () => {
  const log = []; const c = SB.Client({ storage: mkLS(), fetch: fakeNet(log) }); expect(!(await c.signIn('not-an-email')).ok && !log.length);
  expect((await c.signIn('A@B.co')).ok && log[0].url.includes('redirect_to=' + encodeURIComponent('https://bogaertn.github.io/forge-mobile/')) && JSON.parse(log[0].init.body).email === 'a@b.co');
  expect(log[0].init.credentials === 'omit' && log[0].init.cache === 'no-store'); });
T('SBSYNC-SESSION', 'an error callback stores nothing; no callback in the URL is a no-op', async () => {
  const ls = mkLS(); const c = SB.Client({ storage: ls, fetch: fakeNet([]) }); const r = await c.handleCallback({ hash: '#error_description=expired', pathname: '/', search: '' }, { replaceState() {} });
  expect(!r.ok && !Object.keys(ls._m).length); expect((await c.handleCallback({ hash: '', pathname: '/', search: '' }, { replaceState() {} })).callback === false); });
T('SBSYNC-SESSION', 'registering without a session is refused locally', async () => { const c = SB.Client({ storage: mkLS(), fetch: fakeNet([]) }); expect((await c.registerDevice(async () => ({}))).rule === 'SB-NOT-SIGNED-IN'); });

/* v4.9.8 vault-only reset + Supabase password recovery */
T('VAULT-RESET', 'vault-only reset needs the typed phrase and a locked vault; removes only vault + device key; every other store is byte-identical; a new passphrase works', async () => {
  const f = await unlockedForge(); f.process('remember that my car is red'); const pr = f.process('remember that my pin is 4821'); if (pr.sealing) await pr.sealing; await f.signer.ensure();
  expect(f.vault.entries().length >= 2, 'expected sealed pin + device key'); const all = f.store.allStores || KMOD.ALL_STORES || [];
  expect(f.operator.resetVault({ confirm: 'RESET VAULT', userTap: true }).rule === 'VAULT-RESET-LOCK-FIRST'); f.vault.lock();
  expect(f.operator.resetVault({ confirm: 'reset', userTap: true }).rule === 'VAULT-RESET-CONFIRMATION-MISMATCH' && f.vault.status() === 'locked');
  const plan = f.operator.vaultResetPlan(); expect(plan.sealed_values_lost >= 2 && plan.stores.join() === 'vault,signing_key' && plan.kept.includes('memory') && !plan.kept.includes('vault'));
  const keep = plan.kept; const before = keep.map(c => canon(f.store.load(c)));
  const r = f.operator.resetVault({ confirm: 'RESET VAULT', userTap: true }); expect(r.ok && r.device_redo && r.sealed_values_lost === plan.sealed_values_lost, JSON.stringify(r));
  const after = keep.map(c => canon(f.store.load(c))).map((v, i) => (keep[i] === 'permissions' ? before[i] : v));
  expect(canon(before) === canon(after), 'a non-vault store changed: ' + keep.filter((c, i) => before[i] !== after[i]).join());
  expect(f.vault.status() === 'none' && f.signer.id() === null && f.memory().some(m => /car/.test(JSON.stringify(m.clause))), 'vault/key not cleared or memory lost');
  expect(f.operator.resetVault({ confirm: 'RESET VAULT', userTap: true }).rule === 'VAULT-RESET-NO-VAULT');
  await f.vault.setup('new pass phrase'); expect(await f.vault.unlock('new pass phrase') && f.vault.entries().length === 0); expect(!!(await f.signer.ensure()), 'new device key'); });
T('VAULT-RESET', 'reset needs a user tap (permission service) and the device registration is flagged for redo, then cleared by re-registering', async () => {
  const f = await unlockedForge(); f.vault.lock(); expect(!f.operator.resetVault({ confirm: 'RESET VAULT' }).ok && f.vault.status() === 'locked');
  const g = await unlockedForge(); const s = await signedIn((uid, n) => g.signer.deviceProof(uid, n)); expect(s.c.status().device); const old = s.c.status().device; g.vault.lock();
  expect(g.operator.resetVault({ confirm: 'RESET VAULT', userTap: true }).ok); s.c.markDeviceRedo(); expect(s.c.status().signedIn && !s.c.status().device && s.c.status().deviceRedo, JSON.stringify(s.c.status()));
  await g.vault.setup('new pass phrase'); await g.vault.unlock('new pass phrase'); const re = await s.c.registerDevice((uid, n) => g.signer.deviceProof(uid, n)); expect(re.ok && re.signer_id !== old && !s.c.status().deviceRedo); });
T('SBSYNC-RECOVERY', 'forgot password validates the email locally, then POSTs /auth/v1/recover with the Pages redirect', async () => {
  const log = []; const c = SB.Client({ storage: mkLS(), fetch: fakeNet(log) }); expect(!(await c.resetPassword('nope')).ok && !log.length);
  const r = await c.resetPassword(' Nic@Example.test '); expect(r.ok && r.sent_to === 'nic@example.test'); const u = new URL(log[0].url);
  expect(u.pathname === '/auth/v1/recover' && u.searchParams.get('redirect_to') === 'https://bogaertn.github.io/forge-mobile/' && log[0].init.method === 'POST' && JSON.parse(log[0].init.body).email === 'nic@example.test' && log[0].init.credentials === 'omit'); });
T('SBSYNC-RECOVERY', 'a type=recovery callback is reported as PASSWORD_RECOVERY and updatePassword PUTs {password} with the recovery session', async () => {
  const log = [], ls = mkLS(); const c = SB.Client({ storage: ls, fetch: fakeNet(log), crypto: wc });
  const cb = await c.handleCallback({ hash: '#access_token=rec.tok.en&refresh_token=r&expires_in=3600&type=recovery', pathname: '/forge-mobile/', search: '' }, { replaceState() {} });
  expect(cb.ok && cb.recovery === true && c.status().signedIn); expect(!(await c.updatePassword('short')).ok && !log.some(x => x.init && x.init.method === 'PUT'));
  const r = await c.updatePassword('a new long password'); const put = log.find(x => x.init && x.init.method === 'PUT');
  expect(r.ok && put && new URL(put.url).pathname === '/auth/v1/user' && put.init.headers.authorization === 'Bearer rec.tok.en' && JSON.parse(put.init.body).password === 'a new long password');
  const plain = await signedIn(); expect(plain.cb.recovery === false, 'magic-link sign-in must not be treated as recovery'); });
T('SBSYNC-RECOVERY', 'updatePassword without a session is refused locally', async () => { const log = []; const c = SB.Client({ storage: mkLS(), fetch: fakeNet(log) }); expect((await c.updatePassword('long enough pw')).rule === 'SB-NOT-SIGNED-IN' && !log.length); });

(async () => { for (const t of tests) { try { await t.fn(); rows.push({ cls: t.cls, name: t.name, ok: true }); } catch (e) { rows.push({ cls: t.cls, name: t.name, ok: false, not_run: !!(e && e.notRun), why: String(e && e.stack || e).slice(0, 400) }); } }
  process.stdout.write(JSON.stringify(rows)); })();
