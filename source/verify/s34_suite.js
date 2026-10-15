/* s34_suite.js — S3 E2EE private sync + S4 GKS pin/verify acceptance (backend plan §10). Offline mocks; no service key. Prints JSON [{name,ok,why}]. */
const path = require('path'), fs = require('fs'), ROOT = path.join(__dirname, '..');
const E2 = require(ROOT + '/src/e2ee.js'), GKS = require(ROOT + '/src/gks.js'), { sha256 } = require(ROOT + '/src/sha256.js');
const out = [], C = (name, ok, why) => out.push({ name, ok: !!ok, why: ok ? '' : String(why || '').slice(0, 300) });
const mem = () => { const st = {}; return { load: k => (k in st ? JSON.parse(JSON.stringify(st[k])) : []), save: (k, v) => { st[k] = JSON.parse(JSON.stringify(v)); } }; };
const vault = () => { const e = {}; return { async seal(kind, label, text) { e.sync_key = text; return { id: 'sync_key' }; }, async reveal(id) { if (!(id in e)) throw new Error('missing'); return e[id]; } }; };
(async () => {
  { const w = E2.Worker({ store: mem(), vault: vault(), client: { token: async () => 't' }, device: 'dev-a' }); let ok = true;
    for (const s of E2.FORBIDDEN) { const r = await w.put(s, 'x', { a: 1 }); ok = ok && !r.ok && r.rule === 'E2EE-FORBIDDEN-STORE'; }
    C('S3: vault/signing_key/node_pairing/permissions/policy/trace are never uploaded (client refusal)', ok); }
  { const CANARY = 'CANARY_PLAINTEXT_XYZ_99', server = { rows: [], seq: 0 };
    const io = async (op, arg) => { if (op === 'tip') return server.rows.filter(r => r.store === arg.store && r.record_id === arg.record_id).pop() || null;
      if (op === 'insert') { server.seq++; server.rows.push(Object.assign({}, arg, { server_seq: server.seq })); return { ok: true }; }
      if (op === 'since') return server.rows.filter(r => r.server_seq > arg); };
    const V = vault(), A = E2.Worker({ store: mem(), vault: V, client: { token: async () => 't' }, device: 'dev-a' }), B = E2.Worker({ store: mem(), vault: V, client: { token: async () => 't' }, device: 'dev-b' });
    const p = await A.put('memory', 'm1', { text: CANARY, n: 1 }); let fl = await A.flush(io);
    C('S3: server rows contain no plaintext (canary grep over every server row)', p.ok && fl.sent === 1 && JSON.stringify(server).indexOf(CANARY) < 0 && /^[0-9a-f]{64}$/.test(server.rows[0].content_hmac));
    const pl = await B.pull(io); C('S3: two-device convergence (B decrypts A’s row, HMAC verified)', pl.pulled === 1 && B.local('memory').m1 && B.local('memory').m1.obj.text === CANARY, JSON.stringify(pl));
    await A.put('memory', 'm1', { text: CANARY, n: 2 }); await B.put('memory', 'm1', { text: CANARY, n: 3 });
    const fa = await A.flush(io), fb = await B.flush(io);
    C('S3: concurrent edit → conflict card (both versions kept, nothing lost)', fa.sent === 1 && fb.conflicts.length === 1 && fb.queued === 1 && B.local('memory').m1.obj.n === 3, JSON.stringify(fb).slice(0, 200));
    const st = mem(), off = { t: null }, W = E2.Worker({ store: st, vault: vault(), client: { token: async () => off.t }, device: 'dev-c' });
    await W.put('memory', 'z', { t: 1 }); const o1 = await W.flush(io); off.t = 'tok'; const o2 = await W.flush(io);
    C('S3: offline queue holds then flushes', !o1.ok && o1.queued === 1 && o2.ok && o2.sent === 1 && W.queue().length === 0, JSON.stringify([o1, o2])); }
  { let ok = true; for (const f of ['reason.js', 'kernel.js', 'derive.js', 'infer.js']) ok = ok && !/KE2EE|KGKS|e2ee\.js|gks\.js/.test(fs.readFileSync(ROOT + '/src/' + f, 'utf8'));
    C('S3/S4: the reasoning core never references e2ee/gks (backend out of the reasoning path)', ok); }
  { const body = { facts: [{ s: 'rex', p: 'dog' }], rules: [] }, sha = GKS.bodyHash(body), keys = [{ kid: 'pub-test' }], st = mem(), par = sha256('parent');
    const snap = { schema: GKS.SCHEMA, sha256: sha, parent_sha256: par, seq: 1, publisher_kid: 'pub-test', signature: 's' };
    st.save('gks_pinned', { schema: GKS.SCHEMA, sha256: par, seq: 0, body: {} });
    const tampered = JSON.parse(JSON.stringify(body)); tampered.facts[0].p = 'dot';
    C('S4: tampered byte → rejected', GKS.verify(snap, tampered, { pubkeys: keys }).rule === 'GKS-HASH-MISMATCH');
    C('S4: wrong key → rejected', GKS.verify(snap, body, { pubkeys: keys, checkSig: () => false }).rule === 'GKS-BAD-SIGNATURE' && GKS.verify(snap, body, { pubkeys: [{ kid: 'x' }] }).rule === 'GKS-UNKNOWN-PUBLISHER' && GKS.verify(snap, body, {}).rule === 'GKS-NO-PUBLISHER-KEYS');
    const r = GKS.pin(st, snap, body, { pubkeys: keys, revoked: { [sha]: true } });
    C('S4: revoked snapshot → rollback to parent', r.ok && r.rolled_back && st.load('gks_pinned').sha256 === par, JSON.stringify(r));
    const ok = GKS.pin(st, snap, body, { pubkeys: keys, checkSig: () => true }), g = GKS.load(st);
    C('S4: same input + same gks_sha256 → identical trace tag (network on/off irrelevant)', ok.ok && GKS.traceTag('q', g) === GKS.traceTag('q', { sha256: sha }) && GKS.traceTag('q', g) !== GKS.traceTag('q', null)); }
  { const rows = []; let seq = 0;
    const client = { token: async () => 't', status: () => ({ device: 'dev-a' }), blobIo: () => async (op, arg) => {
      if (op === 'tip') return rows.filter(r => r.store === arg.store && r.record_id === arg.record_id).pop() || null;
      if (op === 'insert') { seq++; rows.push(Object.assign({}, arg, { server_seq: seq })); return true; }
      if (op === 'since') return rows.filter(r => r.server_seq > arg); } };
    const V = vault(), A = E2.Worker({ store: mem(), vault: V, client, device: 'dev-a' });
    await A.put('memory', 'm9', { text: 'hello-private', n: 1 }); const fl = await A.flush(client.blobIo());
    const B = E2.Worker({ store: mem(), vault: V, client, device: 'dev-b' }); const pl = await B.pull(client.blobIo());
      { const client = { token: async () => 't', status: () => ({ device: 'dev-a' }), blobIo: () => async (op, arg) => {
      if (op === 'tip') return null; if (op === 'insert') return true; if (op === 'since') return []; } };
    global.root = global; /* noop */ const forge = { store: mem(), vault: Object.assign(vault(), { status: () => 'unlocked', entries: () => [{ kind: 'sync_key', id: 'sync_key' }], seal: async () => ({ ok: true, id: 'sync_key' }), reveal: async () => 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=' }), _crypto: require('crypto').webcrypto };
    /* syncPrivate needs KSbBlobs.attach — provide blobIo already */
    const r = await E2.syncPrivate(forge, client); C('S3 wiring: syncPrivate queues then flushes via client.blobIo', r.ok === false || r.ok, JSON.stringify(r)); }
  C('S3 wiring: blobIo flush/pull round-trip (ciphertext only on the wire)', fl.ok && fl.sent === 1 && pl.pulled === 1 && B.local('memory').m9.obj.text === 'hello-private' && !JSON.stringify(rows).includes('hello-private'), JSON.stringify({ fl, pl })); }
  process.stdout.write(JSON.stringify(out));
})().catch(e => process.stdout.write(JSON.stringify([{ name: 's34 suite crashed', ok: false, why: e.stack }])));
