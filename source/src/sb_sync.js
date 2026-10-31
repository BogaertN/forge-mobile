/* sb_sync.js — the ONLY module that talks to Supabase (S2: account + device registration).
 * Storage and sync only; never part of reasoning. The reasoning core never imports or calls this module (verify: SBSYNC-ISOLATION).
 * Plain fetch against Supabase Auth (GoTrue) and the register-device Edge Function; no vendored SDK.
 * The publishable key and project URL are public by design (GitHub Pages); all protection is Row Level Security server-side.
 * The session lives in localStorage under "forge_sb_session" (outside the kernel.* stores; cleared by Delete everything). */
(function (root) {
'use strict';
const CONFIG = Object.freeze({
  url: 'https://hqcvywujrygbnaowgwln.supabase.co',
  key: 'sb_publishable_xcWU1fjhcZe0VHEb4LCirA_HlRPjVXI',
  redirect: 'https://bogaertn.github.io/forge-mobile/'
});
const SKEY = 'forge_sb_session', DKEY = 'forge_sb_device';
const PW_MIN = 8;
const canon = o => (Array.isArray(o) ? '[' + o.map(canon).join(',') + ']' : o && typeof o === 'object' ? '{' + Object.keys(o).sort().filter(k => o[k] !== undefined).map(k => JSON.stringify(k) + ':' + canon(o[k])).join(',') + '}' : JSON.stringify(o));
const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/;
function Client(o) { o = o || {};
  const cfg = Object.assign({}, CONFIG, o.config || {});
  const ls = o.storage || root.localStorage; const doFetch = o.fetch || ((...a) => root.fetch(...a));
  const nowSec = () => (o.nowSec ? o.nowSec() : Math.floor(Date.now() / 1000));
  const rnd = n => { const u = new Uint8Array(n); (o.crypto || root.crypto).getRandomValues(u); return [...u].map(x => x.toString(16).padStart(2, '0')).join(''); };
  const read = () => { try { const s = JSON.parse(ls.getItem(SKEY) || 'null'); return s && s.access_token ? s : null; } catch (e) { return null; } };
  const write = s => { if (s) ls.setItem(SKEY, JSON.stringify(s)); else ls.removeItem(SKEY); };
  const keep = (t) => ({ access_token: t.access_token, refresh_token: t.refresh_token, expires_at: t.expires_at ? Number(t.expires_at) : nowSec() + Number(t.expires_in || 3600), user: t.user ? { id: t.user.id, email: t.user.email } : null });
  async function call(path, init) { const r = await doFetch(cfg.url + path, Object.assign({ credentials: 'omit', referrerPolicy: 'no-referrer', cache: 'no-store' }, init));
    let body = null; try { body = await r.json(); } catch (e) { body = null; } return { ok: r.ok, status: r.status, body }; }
  const H = tok => Object.assign({ apikey: cfg.key, 'content-type': 'application/json' }, tok ? { authorization: 'Bearer ' + tok } : {});
  /* magic link: the link returns to the app with #access_token=…&refresh_token=… (implicit flow) */
  async function signIn(email) { email = String(email || '').trim().toLowerCase(); if (!EMAIL.test(email)) return { ok: false, rule: 'SB-EMAIL-INVALID' };
    const r = await call('/auth/v1/otp?redirect_to=' + encodeURIComponent(cfg.redirect), { method: 'POST', headers: H(), body: JSON.stringify({ email, create_user: true }) });
    return r.ok ? { ok: true, sent_to: email } : { ok: false, rule: 'SB-OTP-FAILED', status: r.status, error: r.body && (r.body.msg || r.body.error_description || r.body.message) }; }
  async function fetchUser(tok) { const r = await call('/auth/v1/user', { headers: H(tok) }); return r.ok && r.body ? { id: r.body.id, email: r.body.email } : null; }
  /* called once on load: consume a magic-link callback in the URL fragment, then scrub it from the address bar */
  async function handleCallback(loc, hist) { loc = loc || root.location; hist = hist || root.history; const h = String((loc && loc.hash) || '');
    if (!/access_token=|error_description=/.test(h)) return { ok: true, callback: false };
    const p = new URLSearchParams(h.replace(/^#/, '')); try { hist.replaceState(null, '', loc.pathname + loc.search); } catch (e) { /* non-browser */ }
    if (p.get('error_description')) return { ok: false, rule: 'SB-CALLBACK-ERROR', error: p.get('error_description') };
    const s = keep({ access_token: p.get('access_token'), refresh_token: p.get('refresh_token'), expires_at: p.get('expires_at'), expires_in: p.get('expires_in') });
    s.user = await fetchUser(s.access_token); if (!s.user) return { ok: false, rule: 'SB-CALLBACK-USER' }; write(s);
    /* PASSWORD_RECOVERY: a reset-password link arrives as type=recovery; the session is kept so updatePassword can set the new one */
    return { ok: true, callback: true, email: s.user.email, recovery: p.get('type') === 'recovery' }; }
  /* forgot password: Supabase emails a recovery link that returns to the Pages app (resetPasswordForEmail) */
  async function resetPassword(email) { email = String(email || '').trim().toLowerCase(); if (!EMAIL.test(email)) return { ok: false, rule: 'SB-EMAIL-INVALID' };
    const r = await call('/auth/v1/recover?redirect_to=' + encodeURIComponent(cfg.redirect), { method: 'POST', headers: H(), body: JSON.stringify({ email }) });
    return r.ok ? { ok: true, sent_to: email } : { ok: false, rule: 'SB-RECOVER-FAILED', status: r.status, error: r.body && (r.body.msg || r.body.error_description || r.body.message) }; }
  /* updateUser({ password }) with the recovery session */
  async function updatePassword(pw) { pw = String(pw || ''); if (pw.length < PW_MIN) return { ok: false, rule: 'SB-PASSWORD-TOO-SHORT' }; const tok = await token(); if (!tok) return { ok: false, rule: 'SB-NOT-SIGNED-IN' };
    const r = await call('/auth/v1/user', { method: 'PUT', headers: H(tok), body: JSON.stringify({ password: pw }) });
    return r.ok ? { ok: true } : { ok: false, rule: 'SB-PASSWORD-UPDATE-FAILED', status: r.status, error: r.body && (r.body.msg || r.body.error_description || r.body.message) }; }
  /* vault-only reset: the registered device key no longer exists, so the registration must be redone */
  function markDeviceRedo() { let dev = null; try { dev = JSON.parse(ls.getItem(DKEY) || 'null'); } catch (e) { dev = null; } ls.setItem(DKEY, JSON.stringify({ uid: dev && dev.uid || null, signer_id: null, redo: true, previous: dev && dev.signer_id || null })); return { ok: true }; }
  async function token() { const s = read(); if (!s) return null; if (s.expires_at - nowSec() > 60) return s.access_token;
    const r = await call('/auth/v1/token?grant_type=refresh_token', { method: 'POST', headers: H(), body: JSON.stringify({ refresh_token: s.refresh_token }) });
    if (!r.ok || !r.body || !r.body.access_token) { write(null); return null; } const n = keep(r.body); n.user = n.user || s.user; write(n); return n.access_token; }
  function status() { const s = read(); let dev = null; try { dev = JSON.parse(ls.getItem(DKEY) || 'null'); } catch (e) { dev = null; }
    return { signedIn: !!s, email: s && s.user ? s.user.email : null, uid: s && s.user ? s.user.id : null, expires_at: s ? s.expires_at : null, device: dev && s && dev.uid === s.user.id ? dev.signer_id : null, deviceRedo: !!(dev && dev.redo) }; }
  async function signOut() { const s = read(); write(null); ls.removeItem(DKEY); if (s) { try { await call('/auth/v1/logout?scope=local', { method: 'POST', headers: H(s.access_token) }); } catch (e) { /* offline: local session is already gone */ } } return { ok: true }; }
  /* register this device's PUBLIC signing key; prove(uid, nonce) must return {body,sig,signer,pub} (forge.signer.deviceProof) */
  async function registerDevice(prove) { const tok = await token(); const st = status(); if (!tok || !st.uid) return { ok: false, rule: 'SB-NOT-SIGNED-IN' };
    const proof = await prove(st.uid, rnd(16)); if (!proof) return { ok: false, rule: 'SB-DEVICE-KEY-UNAVAILABLE (unlock the vault first)' };
    const r = await call('/functions/v1/register-device', { method: 'POST', headers: H(tok), body: JSON.stringify(proof) });
    if (!r.ok || !r.body || !r.body.ok) return { ok: false, rule: (r.body && r.body.rule) || 'SB-REGISTER-FAILED', status: r.status };
    ls.setItem(DKEY, JSON.stringify({ uid: st.uid, signer_id: r.body.signer_id, at: new Date(nowSec() * 1000).toISOString() })); return { ok: true, signer_id: r.body.signer_id }; }
  /* The memory writer (4.9.205). The client RPC is closed. A write goes to the memory-writer Edge Function, which verifies the
   * session, that the account is linked to the owner with the writer role, that this device's registered key signed the fixed
   * proof body, and that the body binds the SHA-256 of these exact arguments. sign(uid, content_sha256, nonce) must return
   * {body, sig, signer} (forge.signer.writerProof). With no session, no registered device or a locked vault the row is NOT
   * sent: it stays local and pending. written is true only when the returned row reads back as admitted with the same packet. */
  async function insertAdmitted(row, sign) {
    const no = (rule, extra) => Object.assign({ ok: false, attempted: true, written: false, verified: false, pending: true, rule, calls_llm: false }, extra || {});
    const tok = await token();
    if (!tok) return no('KB-WRITER-NO-SESSION');
    const sfe = row && row.sfe || {}; const prov = row && row.provenance || {}; const contributor = String((prov && prov.contributor) || (row && row.contributor) || '').trim();
    const text = String(row && row.text || '');
    if (!contributor || sfe.Phi == null || sfe.eps == null || sfe.mu == null) return no('KB-WRITER-PROVENANCE-REQUIRED', { pending: false });
    const st = status();
    if (!st.uid) return no('KB-WRITER-NO-SESSION');
    if (!st.device) return no('KB-WRITER-DEVICE-NOT-REGISTERED');
    if (typeof sign !== 'function') return no('KB-WRITER-UNSIGNED');
    const payload = { text: text, schema: 'FORGE-RESONANCE-PACKET/v1', sfe: { Phi: sfe.Phi, eps: sfe.eps, mu: sfe.mu }, provenance: prov, contributor: contributor, state: 'admitted' };
    const args = { p_kind: 'fact', p_payload: payload, p_proof: { source: row && row.proof_source || 'rmc_core.admit_gate' }, p_sources: [], p_consent: { contributor: contributor }, p_provenance: prov, p_contributor: contributor };
    const H256 = (typeof module !== 'undefined' && module.exports) ? require('./sha256.js') : root.KSha;
    const digest = (H256 && H256.sha256) ? H256.sha256(canon(args)) : '';
    if (!/^[0-9a-f]{64}$/.test(digest)) return no('KB-WRITER-HASH', { pending: false });
    let proof = null; try { proof = await sign(st.uid, digest, rnd(16)); } catch (e) { proof = null; }
    if (!proof || !proof.body || !proof.sig) return no('KB-WRITER-DEVICE-LOCKED');
    if (proof.signer !== st.device) return no('KB-WRITER-DEVICE-NOT-REGISTERED');
    const ins = await call('/functions/v1/memory-writer', { method: 'POST', headers: H(tok), body: JSON.stringify({ args: args, proof: { body: proof.body, sig: proof.sig } }) });
    const back = ins.body && ins.body.ok && ins.body.row && !Array.isArray(ins.body.row) ? ins.body.row : null;
    const packet = back && back.payload && back.payload.sfe;
    const verified = !!(ins.ok && back && back.state === 'admitted' && back.verified !== false && packet && packet.Phi === sfe.Phi && packet.eps === sfe.eps && packet.mu === sfe.mu && back.payload.contributor === contributor && back.payload.text === text && back.payload.provenance);
    if (!verified) return no((ins.body && ins.body.rule) || 'KB-WRITER-READBACK-FAILED', { status: ins.status, pending: !ins.ok && ins.status !== 403 });
    return { ok: true, attempted: true, written: back.inserted !== false, verified: true, pending: false, id: back.id, signer_id: back.signer_id || proof.signer, rule: back.inserted === false ? 'KB-WRITER-ALREADY-PRESENT' : 'KB-WRITER-VERIFIED', status: ins.status, calls_llm: false };
  }
  /* 4.9.206 trusted anchors (Nic decision (b)): read-only, anonymous, from the kb.anchors view. The phone keeps an IndexedDB copy
   * (anchor_cache.js) so Ask works offline; this module only fetches. digest() is cheap; rows() pages the whole table. */
  async function anchorsDigest() { try { const r = await call('/rest/v1/rpc/kb_anchors_digest', { method: 'POST', headers: H(), body: '{}' });
      return r.ok && r.body && typeof r.body.digest === 'string' ? { ok: true, count: Number(r.body.count), digest: r.body.digest } : { ok: false, status: r.status }; } catch (e) { return { ok: false, offline: true }; } }
  async function anchorRows(o) { o = o || {}; const size = Math.min(1000, Math.max(50, o.pageSize || 1000)); const out = [];
    const cols = 'id,text,state,trust,packet,concepts,provenance,contributor,license,source_url,revision';
    try { for (let off = 0; off < 50000; off += size) {
        const r = await call('/rest/v1/kb_anchors?select=' + cols + '&order=id.asc&limit=' + size + '&offset=' + off, { headers: H() });
        if (!r.ok || !Array.isArray(r.body)) return { ok: false, status: r.status, rows: [] };
        for (const x of r.body) out.push(x); if (r.body.length < size) break; }
    } catch (e) { return { ok: false, offline: true, rows: [] }; }
    return { ok: true, rows: out }; }
  return { config: cfg, anchorsDigest, anchorRows, signIn, resetPassword, updatePassword, markDeviceRedo, handleCallback, token, status, signOut, registerDevice, insertAdmitted }; }
const api = { Client, CONFIG, SKEY, DKEY, PW_MIN, canon };
if (typeof module !== 'undefined' && module.exports) module.exports = api; else { root.KSbSync = api; root.KSb = Client(); }
})(typeof self !== 'undefined' ? self : this);
