/* Acoustic frames for Resonant Key Memory. Audible 16-MFSK on the 144 Hz grid, 1728–3888 Hz.
 * Reed-Solomon corrects 4 bytes. A MAC is required on any frame that can change state.
 * HELLO is unauthenticated. Near-ultrasonic is opt-in and marked visible. No secrets. */
(function (root) {
  'use strict';
  const isNode = typeof module !== 'undefined' && module.exports;
  const R = isNode ? require('./rkm.js') : root.KRKM;
  const PRIM = 0x11d;
  const EXP = new Uint8Array(512), LOG = new Uint8Array(256);
  (function () { let x = 1; for (let i = 0; i < 255; i++) { EXP[i] = x; LOG[x] = i; x <<= 1; if (x & 256) x ^= PRIM; } for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255]; })();
  const mul = (a, b) => (a && b) ? EXP[LOG[a] + LOG[b]] : 0;
  const inv = a => EXP[255 - LOG[a]];
  function polyMul(p, q) { const r = new Array(p.length + q.length - 1).fill(0); for (let i = 0; i < p.length; i++) for (let j = 0; j < q.length; j++) r[i + j] ^= mul(p[i], q[j]); return r; }
  function polyAdd(p, q) { const n = Math.max(p.length, q.length), o = new Array(n).fill(0); for (let i = 0; i < p.length; i++) o[n - p.length + i] ^= p[i]; for (let i = 0; i < q.length; i++) o[n - q.length + i] ^= q[i]; return o; }
  function polyEval(p, x) { let y = 0; for (const c of p) y = mul(y, x) ^ c; return y; }
  function rsGenerator() { let g = [1]; for (let i = 0; i < 8; i++) g = polyMul(g, [1, EXP[i]]); return g; }
  function rsEncode(msg) {
    const gen = rsGenerator();
    const out = msg.concat(new Array(8).fill(0));
    for (let i = 0; i < msg.length; i++) { const c = out[i]; if (!c) continue; for (let j = 1; j < gen.length; j++) out[i + j] ^= mul(gen[j], c); }
    for (let i = 0; i < msg.length; i++) out[i] = msg[i];
    return out;
  }
  function rsSyndromes(msg) { const s = []; for (let i = 0; i < 8; i++) s.push(polyEval(msg, EXP[i])); return s; }
  function rsDecode(code) {
    const n = code.length, synd = rsSyndromes(code);
    if (synd.every(x => x === 0)) return { ok: true, msg: code.slice(0, n - 8), calls_llm: false };
    let errLoc = [1], oldLoc = [1];
    for (let i = 0; i < 8; i++) {
      let delta = synd[i];
      for (let j = 1; j < errLoc.length; j++) delta ^= mul(errLoc[errLoc.length - 1 - j], synd[i - j] || 0);
      oldLoc = oldLoc.concat([0]);
      if (delta) {
        if (oldLoc.length > errLoc.length) { const next = oldLoc.map(c => mul(c, delta)); oldLoc = errLoc.map(c => mul(c, inv(delta))); errLoc = next; }
        errLoc = polyAdd(errLoc, oldLoc.map(c => mul(c, delta)));
      }
    }
    while (errLoc.length && errLoc[0] === 0) errLoc.shift();
    const found = [];
    for (let i = 0; i < 255; i++) if (polyEval(errLoc, EXP[i]) === 0) { const at = i + n - 256; if (at >= 0 && at < n) found.push({ at: at, x: EXP[(n - 1 - at) % 255] }); }
    if (!found.length || found.length !== errLoc.length - 1 || found.length > 4) return { ok: false, rule: 'RKM-RS-FAIL', calls_llm: false };
    const k = found.length;
    const M = [];
    for (let j = 0; j < k; j++) {
      const row = [];
      for (let i = 0; i < k; i++) { let p = 1; for (let t = 0; t < j; t++) p = mul(p, found[i].x); row.push(j === 0 ? 1 : p); }
      row.push(synd[j]); M.push(row);
    }
    for (let col = 0; col < k; col++) {
      let piv = col; for (let r = col; r < k; r++) if (M[r][col]) { piv = r; break; }
      if (!M[piv][col]) return { ok: false, rule: 'RKM-RS-FAIL', calls_llm: false };
      if (piv !== col) { const tmp = M[col]; M[col] = M[piv]; M[piv] = tmp; }
      const invp = inv(M[col][col]);
      for (let c = col; c <= k; c++) M[col][c] = mul(M[col][c], invp);
      for (let r = 0; r < k; r++) if (r !== col && M[r][col]) { const f = M[r][col]; for (let c = col; c <= k; c++) M[r][c] ^= mul(f, M[col][c]); }
    }
    const out = code.slice();
    found.forEach((f, i) => { out[f.at] ^= M[i][k]; });
    if (!rsSyndromes(out).every(x => x === 0)) return { ok: false, rule: 'RKM-RS-FAIL', calls_llm: false };
    return { ok: true, msg: out.slice(0, n - 8), calls_llm: false };
  }
    const crc = bytes => { let c = 0xffff; bytes.forEach(b => { c ^= b << 8; for (let i = 0; i < 8; i++) c = (c & 0x8000) ? ((c << 1) ^ 0x1021) & 0xffff : (c << 1) & 0xffff; }); return c; };
  function hmac(keyHex, bytes) {
    let key = R.hexToBytes(keyHex);
    if (key.length > 64) key = R.hexToBytes(R.shaBytes(key));
    while (key.length < 64) key.push(0);
    const ip = key.map(b => b ^ 0x36), op = key.map(b => b ^ 0x5c);
    const inner = R.hexToBytes(R.shaBytes(ip.concat(bytes)));
    return R.shaBytes(op.concat(inner)).slice(0, 16);
  }
  const TONE = k => 144 * (12 + k);
  function frame(type, payload, opts) {
    opts = opts || {};
    const fp = R.hexToBytes(R.structureFp);
    const body = [0xf1, type, fp[0], fp[1], fp[2], fp[3], opts.session || 0, opts.seq || 0, payload.length].concat(payload);
    let mac = [];
    const state = type !== 0x01 && type !== 0x02 && type !== 0x7f;
    if (state) {
      if (!opts.key) return { ok: false, rule: 'RKM-MAC-REQUIRED', calls_llm: false };
      mac = R.hexToBytes(hmac(opts.key, body));
    }
    const raw = body.concat(mac);
    const c = crc(raw);
    const coded = rsEncode(raw.concat([(c >> 8) & 255, c & 255]));
    const tones = [];
    coded.forEach(b => { tones.push(TONE((b >> 4) & 15)); tones.push(TONE(b & 15)); });
    return { ok: true, bytes: coded, tones: tones, profile: opts.ultrasonic ? 'near-ultrasonic' : 'audible', indicator: opts.ultrasonic === true, calls_llm: false };
  }
  function decode(bytes, opts) {
    opts = opts || {};
    const rs = rsDecode(bytes.slice());
    if (!rs.ok) return rs;
    const msg = rs.msg;
    if (msg.length < 11) return { ok: false, rule: 'RKM-FRAME-SHORT', calls_llm: false };
    const n = msg[8];
    const fp = R.bytesToHex(msg.slice(2, 6));
    if (fp !== R.structureFp) return { ok: false, rule: 'RKM-KEY-MISMATCH', calls_llm: false };
    const state = msg[1] !== 0x01 && msg[1] !== 0x02 && msg[1] !== 0x7f;
    const macLen = state ? 8 : 0;
    if (msg.length < 9 + n + macLen + 2) return { ok: false, rule: 'RKM-FRAME-SHORT', calls_llm: false };
    if (state) {
      if (!opts.key) return { ok: false, rule: 'RKM-MAC-REQUIRED', calls_llm: false };
      const expect = hmac(opts.key, msg.slice(0, 9 + n));
      if (R.bytesToHex(msg.slice(9 + n, 9 + n + 8)) !== expect) return { ok: false, rule: 'RKM-MAC-FAIL', calls_llm: false };
    }
    return { ok: true, type: msg[1], payload: msg.slice(9, 9 + n), calls_llm: false };
  }
  function tonesToBytes(tones) {
    const bytes = [];
    for (let i = 0; i < tones.length; i += 2) {
      const hi = Math.round(tones[i] / 144) - 12, lo = Math.round(tones[i + 1] / 144) - 12;
      bytes.push(((hi & 15) << 4) | (lo & 15));
    }
    return bytes;
  }
  function roundTrip(payload, key) {
    const made = frame(0x10, payload, { key: key, seq: 1 });
    if (!made.ok) return made;
    const back = tonesToBytes(made.tones);
    const broken = back.slice();
    for (let i = 0; i < 4 && i < broken.length; i++) broken[i] ^= 0xff;
    const got = decode(broken, { key: key });
    return { ok: got.ok === true && R.bytesToHex(got.payload) === R.bytesToHex(payload), rule: got.rule || 'RKM-ACOUSTIC-OK', calls_llm: false };
  }
  function play(tones, opts) {
    opts = opts || {};
    const AC = root.AudioContext || root.webkitAudioContext;
    if (!AC) return { ok: false, rule: 'RKM-NO-AUDIO', calls_llm: false };
    const ctx = new AC();
    const ultra = opts.ultrasonic === true;
    tones.forEach((hz, i) => {
      const o = ctx.createOscillator();
      o.frequency.value = ultra ? 17000 + (hz - 1728) : hz;
      o.connect(ctx.destination);
      const t0 = ctx.currentTime + i * (5 / 144);
      o.start(t0); o.stop(t0 + 4 / 144);
    });
    return { ok: true, profile: ultra ? 'near-ultrasonic' : 'audible', indicator: ultra, tones: tones.length, calls_llm: false };
  }
  function mount(doc) {
    if (!doc || doc.getElementById('rkmPanel')) return;
    const el = doc.createElement('div');
    el.id = 'rkmPanel'; el.className = 'card';
    el.innerHTML = '<div class="cardhead">Resonant Key Memory</div><div class="small" data-rkm-fp></div><div class="row"><button type="button" id="rkmPlay">Play</button><button type="button" id="rkmListen">Listen</button><button type="button" id="rkmExport">Export .hfield</button></div><label class="row"><input type="checkbox" id="rkmUltra"> Near-ultrasonic (visible opt-in)</label><textarea id="rkmPacket" rows="3" aria-label="hfield packet"></textarea><div class="small" id="rkmStatus"></div>';
    const log = doc.getElementById('log');
    (log && log.parentNode ? log.parentNode : doc.body).appendChild(el);
    const status = t => { const s = doc.getElementById('rkmStatus'); if (s) s.textContent = t; };
    const fp = doc.querySelector('[data-rkm-fp]'); if (fp) fp.textContent = 'key ' + R.KEY_VERSION + ' ' + R.structureFp;
    doc.getElementById('rkmPlay').onclick = () => {
      const ultra = doc.getElementById('rkmUltra').checked;
      const hello = frame(0x01, [0, 2, 0], {});
      const played = play(hello.tones || [], { ultrasonic: ultra });
      status(played.ok ? (ultra ? 'Playing near-ultrasonic. Indicator on.' : 'Playing audible tones.') : played.rule);
    };
    doc.getElementById('rkmListen').onclick = () => {
      const box = doc.getElementById('rkmPacket');
      const hex = (box.value || '').replace(/[^0-9a-f]/gi, '');
      if (hex.length < 4) { status('Paste a frame, or Play first. Listening uses the last audible frame when the mic is closed.'); return; }
      const bytes = R.hexToBytes(hex);
      const got = decode(bytes, {});
      status(got.ok ? 'Heard a frame.' : (got.rule || 'not a frame'));
    };
    doc.getElementById('rkmExport').onclick = () => {
      const live = root.KRKMLive;
      if (!live) { status('No memory yet.'); return; }
      const pkt = live.exportPacket();
      doc.getElementById('rkmPacket').value = JSON.stringify(pkt);
      status('Exported a claim packet. The receiver must run Gilligan. A peer is not a publisher.');
    };
  }
  const api = { frame, decode, roundTrip, play, tonesToBytes, mount, TONE, calls_llm: false };
  if (isNode) module.exports = api; else { root.KRKMAcoustic = api; if (root.document) { if (root.document.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', () => mount(root.document)); else mount(root.document); } }
})(typeof self !== 'undefined' ? self : this);
