/* privacy.js — ingestion-time redaction + local Identity Vault (WebCrypto AES-GCM, PBKDF2-SHA-256).
   Policy (Doc7 privacy; forge Identity Vault): a sensitive VALUE never leaves this module in plaintext except
   (a) into AES-GCM ciphertext, (b) back to the user on an explicit, unlocked reveal. Everything downstream
   (kernel, trace, RMC memory, evidence, receipts, exports, dry-run) only ever sees the redacted text, in which
   each value is replaced by the ordinary English word "sealed". Deterministic: same input → same redaction. */
(function (root) {
  'use strict';
  const isNode = typeof module !== 'undefined' && module.exports;
  const KEYS = ['social security number', 'credit card number', 'debit card number', 'bank account number', 'driver license number', 'driving licence number', 'passport number', 'license number', 'licence number', 'card number', 'account number', 'routing number', 'sort code', 'security code', 'verification code', 'one-time code', 'recovery phrase', 'seed phrase', 'private key', 'secret key', 'api key', 'access token', 'auth token', 'pin code', 'pin number', 'passphrase', 'passcode', 'password', 'pin', 'ssn', 'cvv', 'cvc', 'iban', 'otp', 'token', 'secret', 'code', 'combination', 'login'];
  const KEY_RE = KEYS.map(k => k.replace(/[-]/g, '[- ]?').replace(/ /g, '\\s+')).join('|');
  /* values that describe rather than disclose (utsarga: redact; apavāda: these evaluative words) */
  const DESCRIPTIVE = new Set(['sealed', 'strong', 'weak', 'long', 'short', 'safe', 'secure', 'insecure', 'new', 'old', 'changed', 'expired', 'correct', 'wrong', 'saved', 'hidden', 'private', 'complex', 'simple', 'easy', 'hard', 'required', 'missing', 'lost', 'forgotten', 'stolen', 'reset', 'locked', 'unlocked', 'valid', 'invalid', 'a', 'an', 'the', 'not', 'on', 'in', 'at', 'from', 'with', 'for', 'to', 'of', 'very', 'too', 'still', 'also', 'now', 'here', 'there', 'mine', 'yours', 'it', 'that', 'this', 'what', 'my', 'your', 'same', 'different', 'unknown', 'written', 'stored', 'kept', 'encrypted']);
  const QUOTED = '"[^"]{1,200}"|“[^”]{1,200}”|\'[^\']{1,200}\'|`[^`]{1,200}`';
  const DIGITRUN = '\\+?\\d[\\d \\-]{2,40}\\d';
  const TOKEN = '[^\\s,;]{1,200}';
  const KV = new RegExp('\\b(' + KEY_RE + ')(\\s+(?:is|was|=|:|are|reads|equals)\\s*|\\s*[:=]\\s*)(' + QUOTED + '|' + DIGITRUN + '|' + TOKEN + ')', 'gi');
  const luhn = s => { const d = s.replace(/\D/g, ''); if (d.length < 13 || d.length > 19) return false; let sum = 0; for (let i = 0; i < d.length; i++) { let n = +d[d.length - 1 - i]; if (i % 2) { n *= 2; if (n > 9) n -= 9; } sum += n; } return sum % 10 === 0; };
  const FREE = [
    { label: 'private key', re: /-----BEGIN[^-]*-----[\s\S]*?-----END[^-]*-----/g },
    { label: 'token', re: /\beyJ[\w-]{6,}\.[\w-]{6,}\.[\w-]{6,}/g },
    { label: 'api key', re: /\b(?:sk|pk|rk)[-_](?:live[-_]|test[-_])?[A-Za-z0-9_-]{12,}\b/g },
    { label: 'api key', re: /\bAKIA[0-9A-Z]{16}\b/g },
    { label: 'github token', re: /\bgh[pousr]_[A-Za-z0-9]{20,}\b/g },
    { label: 'token', re: /\bxox[abprs]-[A-Za-z0-9-]{10,}\b/g },
    { label: 'social security number', re: /\b\d{3}-\d{2}-\d{4}\b/g },
    { label: 'iban', re: /\b[A-Z]{2}\d{2}(?: ?[A-Z0-9]{4}){3,7}(?: ?[A-Z0-9]{1,3})?\b/g },
    { label: 'card number', re: /\b\d(?:[ -]?\d){12,18}\b/g, test: luhn },
    { label: 'secret', re: /\b[a-f0-9]{32,}\b/gi },
    { label: 'secret', re: /\b(?=[A-Za-z0-9+\/]*\d)(?=[A-Za-z0-9+\/]*[A-Z])(?=[A-Za-z0-9+\/]*[a-z])[A-Za-z0-9+\/]{32,}={0,2}/g }
  ];
  function strip(v) { return v.replace(/^["“'`]|["”'`]$/g, ''); }
  /* redact(text) → { text, secrets:[{label,value}], rules:[ids] }. Values are replaced by "sealed". */
  function redact(text) {
    let out = String(text || ''); const secrets = []; const rules = [];
    out = out.replace(KV, (all, key, sep, val) => {
      let v = /^["“'`]/.test(val) ? val : val.replace(/[.?]+$/, ''); const tail = val.slice(v.length);
      if (!/^["“'`]/.test(v) && DESCRIPTIVE.has(v.toLowerCase())) return all;
      if (/^(?:is|was|are)$/i.test(v)) return all;
      secrets.push({ label: key.toLowerCase().replace(/\s+/g, ' '), value: strip(v) }); rules.push('PRIV-1.1 key–value secret (' + key.toLowerCase() + ')');
      const s2 = /^\s*[:=]\s*$/.test(sep) ? ' is ' : sep; return key + s2 + 'sealed' + tail; });
    for (const f of FREE) out = out.replace(f.re, m => { if (m === 'sealed' || (f.test && !f.test(m))) return m; secrets.push({ label: f.label, value: m }); rules.push('PRIV-1.2 free-standing pattern (' + f.label + ')'); return 'sealed'; });
    return { text: out, secrets, rules };
  }
  /* scan(obj, values) → true if any plaintext value occurs in the JSON of obj (used by tests and the migration) */
  function leaks(obj, values) { const s = typeof obj === 'string' ? obj : JSON.stringify(obj); return values.filter(v => v && v.length >= 3 && s.includes(v)); }
  /* deep redaction for legacy stores (migration): every string is passed through redact() */
  function deepRedact(x, found) { if (typeof x === 'string') { const r = redact(x); r.secrets.forEach(s => found.push(s)); return r.text; } if (Array.isArray(x)) return x.map(y => deepRedact(y, found)); if (x && typeof x === 'object') { const o = {}; for (const k of Object.keys(x)) o[k] = deepRedact(x[k], found); return o; } return x; }

  /* ---------------- Identity Vault (local, encrypted) ---------------- */
  const subtle = () => (root.crypto && root.crypto.subtle) || (isNode && require('crypto').webcrypto.subtle);
  const rnd = n => { const a = new Uint8Array(n); ((root.crypto && root.crypto.getRandomValues) ? root.crypto : require('crypto').webcrypto).getRandomValues(a); return a; };
  const b64 = u => (typeof Buffer !== 'undefined' ? Buffer.from(u).toString('base64') : (() => { let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); })());
  const unb64 = s => (typeof Buffer !== 'undefined' ? new Uint8Array(Buffer.from(s, 'base64')) : Uint8Array.from(atob(s), c => c.charCodeAt(0)));
  const enc = new TextEncoder(), dec = new TextDecoder();
  const CHECK = 'kernel-vault-check-v1';
  /* ONE passphrase rule everywhere (onboarding, vault form, vault setup, portable backup): at least PASSPHRASE_MIN characters.
   * Forge cannot recover a lost passphrase: there is no reset, no copy of the key and no server. */
  const PASSPHRASE_MIN = 8;
  const passphraseProblem = p => (!p || String(p).length < PASSPHRASE_MIN ? 'passphrase too short (at least ' + PASSPHRASE_MIN + ' characters)' : null);
  /* portable sealed box: carries its own versioned KDF parameters and salt, so it opens on a fresh install before any local vault exists */
  const PORTABLE_KDF = { name: 'PBKDF2', hash: 'SHA-256', iterations: 210000, salt_bytes: 16, version: 'forge-kdf/v1' };
  async function portableSeal(pass, text, o) { const pr = passphraseProblem(pass); if (pr) throw new Error(pr); const iterations = (o && o.iterations) || PORTABLE_KDF.iterations; const salt = rnd(16); const iv = rnd(12);
    const base = await subtle().importKey('raw', enc.encode(pass), 'PBKDF2', false, ['deriveKey']); const k = await subtle().deriveKey({ name: 'PBKDF2', salt, iterations, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt']);
    const ct = new Uint8Array(await subtle().encrypt({ name: 'AES-GCM', iv }, k, enc.encode(String(text)))); return { kdf: { name: 'PBKDF2', hash: 'SHA-256', iterations, salt: b64(salt), version: PORTABLE_KDF.version }, cipher: { name: 'AES-GCM', iv: b64(iv) }, ct: b64(ct) }; }
  async function portableOpen(pass, box) { if (!box || !box.kdf || box.kdf.name !== 'PBKDF2' || box.kdf.hash !== 'SHA-256' || !(box.kdf.iterations >= 1000) || !box.cipher || box.cipher.name !== 'AES-GCM') throw new Error('BACKUP-KDF-UNSUPPORTED');
    const base = await subtle().importKey('raw', enc.encode(String(pass || '')), 'PBKDF2', false, ['deriveKey']); const k = await subtle().deriveKey({ name: 'PBKDF2', salt: unb64(box.kdf.salt), iterations: box.kdf.iterations, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
    return dec.decode(await subtle().decrypt({ name: 'AES-GCM', iv: unb64(box.cipher.iv) }, k, unb64(box.ct))); }
  function Vault(io, opts) { /* io: { load(): obj|null, save(obj) } — only ciphertext is ever saved */
    opts = opts || {}; const iter = opts.iterations || 210000; let key = null; const pending = [];
    const st = () => io.load() || null;
    async function derive(pass, salt) { const base = await subtle().importKey('raw', enc.encode(pass), 'PBKDF2', false, ['deriveKey']); return subtle().deriveKey({ name: 'PBKDF2', salt, iterations: (st() && st().iter) || iter, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']); }
    async function encrypt(k, text) { const iv = rnd(12); const ct = new Uint8Array(await subtle().encrypt({ name: 'AES-GCM', iv }, k, enc.encode(text))); return { iv: b64(iv), ct: b64(ct) }; }
    async function decrypt(k, box) { return dec.decode(await subtle().decrypt({ name: 'AES-GCM', iv: unb64(box.iv) }, k, unb64(box.ct))); }
    return {
      status: () => (!st() ? 'none' : key ? 'unlocked' : 'locked'),
      async setup(pass) { if (st()) throw new Error('vault already exists'); if (passphraseProblem(pass)) throw new Error(passphraseProblem(pass)); const salt = rnd(16); const s0 = { v: 1, kdf: 'PBKDF2-SHA-256', iter, salt: b64(salt), entries: [] }; io.save(s0); key = await derive(pass, salt); s0.check = await encrypt(key, CHECK); io.save(s0); return true; },
      async unlock(pass) { const s = st(); if (!s) return false; try { const k = await derive(pass, unb64(s.salt)); if (await decrypt(k, s.check) !== CHECK) return false; key = k; return true; } catch (e) { return false; } },
      lock() { key = null; pending.length = 0; },
      queue(items) { if (!key) return 0; for (const it of items) pending.push(it); return items.length; },
      async flush() { const s = st(); if (!s || !key) { pending.length = 0; return 0; } let n = 0; while (pending.length) { const it = pending.shift(); const box = await encrypt(key, it.value); s.entries.push({ id: 'vault:' + (s.entries.length + 1), label: it.label, ref: it.ref || null, at: it.at || null, iv: box.iv, ct: box.ct }); n++; } io.save(s); return n; },
      list: () => (st() ? st().entries.map(e => ({ id: e.id, label: e.label, ref: e.ref, at: e.at })) : []),
      async reveal(id) { const s = st(); if (!s || !key) throw new Error('vault locked'); const e = s.entries.find(x => x.id === id); if (!e) throw new Error('no such entry'); return decrypt(key, e); },
      remove(id) { const s = st(); if (!s) return false; const i = s.entries.findIndex(x => x.id === id); if (i < 0) return false; s.entries.splice(i, 1); io.save(s); return true; },
      pendingCount: () => pending.length,
      /* sealed records (crawler captures, profiles): only ciphertext + non-identifying meta are stored */
      async seal(kind, label, text, meta) { const s = st(); if (!s || !key) throw new Error('vault locked'); const box = await encrypt(key, String(text)); const n = s.entries.reduce((m, e) => Math.max(m, +String(e.id).split(':')[1] || 0), 0) + 1; const e = Object.assign({ id: 'vault:' + n, label, kind, at: (meta && meta.at) || null, meta: meta || {} }, box); s.entries.push(e); io.save(s); return { id: e.id, label, kind }; },
      entries: kind => (st() ? st().entries.filter(e => !kind || e.kind === kind).map(e => ({ id: e.id, label: e.label, kind: e.kind || 'secret', ref: e.ref, at: e.at, meta: e.meta || {} })) : []),
      async encryptBlob(text) { if (!key) throw new Error('vault locked'); const s = st(); const box = await encrypt(key, String(text)); return Object.assign({ v: 1, kdf: s.kdf, iter: s.iter, salt: s.salt }, box); },
      async decryptBlob(box) { if (!key) throw new Error('vault locked'); return decrypt(key, box); }
    };
  }
  const api = { redact, leaks, deepRedact, Vault, KEYS, luhn, PASSPHRASE_MIN, passphraseProblem, PORTABLE_KDF, portableSeal, portableOpen };
  if (isNode) module.exports = api; else root.KPrivacy = api;
})(typeof self !== 'undefined' ? self : this);
