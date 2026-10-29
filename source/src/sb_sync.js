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
  /* The memory writer. Anon has no execute grant. The function rejects an unadmitted row.
   * written is true only when the returned row reads back as admitted with the same packet. */
  async function insertAdmitted(row) {
    const tok = await token();
    if (!tok) return { ok: false, attempted: true, written: false, verified: false, rule: 'KB-WRITER-NO-SESSION', calls_llm: false };
    const sfe = row && row.sfe || {}; const prov = row && row.provenance || {}; const contributor = String((prov && prov.contributor) || (row && row.contributor) || '').trim();
    const text = String(row && row.text || '');
    if (!contributor || sfe.Phi == null || sfe.eps == null || sfe.mu == null) return { ok: false, attempted: true, written: false, verified: false, rule: 'KB-WRITER-PROVENANCE-REQUIRED', calls_llm: false };
    const payload = { text: text, schema: 'FORGE-RESONANCE-PACKET/v1', sfe: { Phi: sfe.Phi, eps: sfe.eps, mu: sfe.mu }, provenance: prov, contributor: contributor, state: 'admitted' };
    const digest = (root.KSha && KSha.sha256) ? KSha.sha256(JSON.stringify(payload)) : '';
    if (!/^[0-9a-f]{64}$/.test(digest)) return { ok: false, attempted: true, written: false, verified: false, rule: 'KB-WRITER-HASH', calls_llm: false };
    const body = { p_kind: 'fact', p_payload: payload, p_proof: { source: 'rmc_core.admit_gate' }, p_sources: [], p_content_sha256: digest, p_signature: digest, p_consent: { contributor: contributor }, p_provenance: prov, p_contributor: contributor };
    const ins = await call('/rest/v1/rpc/memory_writer_insert', { method: 'POST', headers: Object.assign(H(tok), { prefer: 'return=representation' }), body: JSON.stringify(body) });
    const back = ins.body && !Array.isArray(ins.body) ? ins.body : null;
    const packet = back && back.payload && back.payload.sfe;
    const verified = !!(ins.ok && back && back.state === 'admitted' && back.verified !== false && packet && packet.Phi === sfe.Phi && packet.eps === sfe.eps && packet.mu === sfe.mu && back.payload.contributor === contributor && back.payload.text === text && back.payload.provenance);
    return { ok: verified, attempted: true, written: verified && back.inserted !== false, verified: verified, id: back && back.id, rule: verified ? (back.inserted === false ? 'KB-WRITER-ALREADY-PRESENT' : 'KB-WRITER-VERIFIED') : 'KB-WRITER-READBACK-FAILED', status: ins.status, calls_llm: false };
  }
  return { config: cfg, signIn, resetPassword, updatePassword, markDeviceRedo, handleCallback, token, status, signOut, registerDevice, insertAdmitted }; }
const api = { Client, CONFIG, SKEY, DKEY, PW_MIN };
if (typeof module !== 'undefined' && module.exports) module.exports = api; else { root.KSbSync = api; root.KSb = Client(); }
})(typeof self !== 'undefined' ? self : this);
