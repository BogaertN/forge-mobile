// memory-writer core (4.9.211: + the drift law) (plain ES module; network and clock are injected so verify/r4205_suite.js runs this exact file in Node).
export const PURPOSE = "forge-memory-writer/v1";
const ALLOWED_ORIGINS = new Set(["https://bogaertn.github.io"]);
const MAX_BODY = 40000;

export const canon = (o) => Array.isArray(o) ? "[" + o.map(canon).join(",") + "]"
  : o && typeof o === "object" ? "{" + Object.keys(o).sort()
      .filter((k) => o[k] !== undefined)
      .map((k) => JSON.stringify(k) + ":" + canon(o[k])).join(",") + "}"
  : JSON.stringify(o);
const hex = (b) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
const unb64 = (s) => { s = s.replace(/-/g, "+").replace(/_/g, "/"); while (s.length % 4) s += "="; const b = atob(s); return Uint8Array.from(b, (c) => c.charCodeAt(0)); };
export const sha256hex = async (s) => hex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)));


function cors(req) {
  const o = req.headers.get("origin") || "";
  return ALLOWED_ORIGINS.has(o) ? { "Access-Control-Allow-Origin": o, "Vary": "Origin",
    "Access-Control-Allow-Headers": "authorization, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" } : {};
}
const reply = (req, status, body) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...cors(req) } });

const ARG_KEYS = ["p_consent", "p_contributor", "p_kind", "p_payload", "p_proof", "p_provenance", "p_sources"];

// 4.9.211 DRIFT-SPEC/v1: the same trace-epsilon recompute as kmath.driftMeasure / drift_policy.drift_measure /
// SQL app.drift_eps (circular sigma over hist, D = 1 iff (prev, act) in S, dphi = |act - (prev % 9 + 1)| / 9,
// eps = (sigma + D + dphi) / max(1, depth); not clipped). The SQL writer re-checks everything; this is the early refusal.
export const DRIFT = Object.freeze({ METRIC_ID: "eps_s/rsoc-v4.8+circ/v1", SCHEME: "phase-scheme/rmc/v1", ADMIT_MAX: 0.35, HARD_MIN: 0.80,
  ECHO_MEMORY_MIN: 0.97, C_MIN: 0.87, S: [[5, 8], [4, 8]], CLASSES: ["negation", "certainty", "condition"] });
const isInt9 = (n) => Number.isInteger(n) && n >= 1 && n <= 9;
const nextPhase = (n) => (n % 9) + 1;
const backward = (a, b) => b !== a && b !== nextPhase(a) && ((a - b + 9) % 9) < ((b - a + 9) % 9);
export function driftEps(hist, prev, act, depth) {
  let c = 0, s = 0;
  for (const p of hist) { const th = ((p - 1) / 9) * 2 * Math.PI; c += Math.cos(th); s += Math.sin(th); }
  const sigma = hist.length < 2 ? 0 : Math.sqrt(Math.max(0, 2 * (1 - Math.min(1, Math.sqrt(c * c + s * s) / hist.length)))) / (2 * Math.PI);
  const d = DRIFT.S.some(([a, b]) => a === prev && b === act) ? 1 : 0;
  const dphi = Math.abs(act - ((prev % 9) + 1)) / 9;
  const eps = (sigma + d + dphi) / Math.max(1, Math.floor(depth));
  return { eps: Math.round(eps * 1e6) / 1e6, sigma, d, dphi };
}
/** the drift / Echo / naming law for a lasting write; returns a KB-WRITER-* rule or null */
export function driftRefusal(proof) {
  const di = proof && proof.drift_input;
  if (!di || typeof di !== "object" || !Array.isArray(di.hist) || !di.hist.every(isInt9) || !isInt9(di.prev) || !isInt9(di.act)
      || !Number.isInteger(di.depth) || di.depth < 1 || di.depth > 9 || di.scheme !== DRIFT.SCHEME || di.hist.length > 32
      || (di.hist.length && di.hist[di.hist.length - 1] !== di.prev)) return "KB-WRITER-DRIFT-INPUT-REQUIRED";
  const claimed = proof.drift && Number(proof.drift.eps);
  const m = driftEps(di.hist, di.prev, di.act, di.depth);
  if (!Number.isFinite(claimed) || Math.abs(m.eps - claimed) > 1e-6) return "KB-WRITER-EPS-MISMATCH";
  const path = di.hist.concat([di.act]);
  for (let i = 1; i < path.length; i++) if (path[i] !== path[i - 1] && (DRIFT.S.some(([a, b]) => a === path[i - 1] && b === path[i]) || backward(path[i - 1], path[i]))) return "KB-WRITER-FORBIDDEN";
  if (m.eps >= DRIFT.HARD_MIN) return "KB-WRITER-HARD-STOP";
  if (m.eps > DRIFT.ADMIT_MAX) return "KB-WRITER-DRIFT";
  const i6 = path.indexOf(6), i7 = path.indexOf(7), firstOut = path.findIndex((p) => p === 8 || p === 9);
  if (!(i6 >= 0 && i7 > i6 && firstOut > i7)) return "KB-WRITER-UNNAMED";
  const cls = proof.echo_classes && proof.echo_classes.classes;
  if (!(Number(proof.echo) >= DRIFT.ECHO_MEMORY_MIN) || !proof.echo_classes || proof.echo_classes.ok !== true || !cls
      || !DRIFT.CLASSES.every((k) => cls[k] && cls[k].ok === true)) return "KB-WRITER-ECHO";
  if (!(Number(proof.coherence) >= DRIFT.C_MIN)) return "KB-WRITER-COHERENCE";
  return null;
}

/** d: { url, service, anon, fetch(url, init), now() } */
export async function handle(req, d) {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(req) });
  if (req.method !== "POST") return reply(req, 405, { ok: false, rule: "KB-WRITER-METHOD" });
  const auth = req.headers.get("authorization") || "";
  if (!/^Bearer [A-Za-z0-9._-]+$/.test(auth)) return reply(req, 401, { ok: false, rule: "KB-WRITER-NO-SESSION" });
  // 1. who is calling: Supabase Auth validates the user's access token (an anon/publishable key is not a user)
  const ur = await d.fetch(d.url + "/auth/v1/user", { headers: { authorization: auth, apikey: d.anon } });
  if (!ur.ok) return reply(req, 401, { ok: false, rule: "KB-WRITER-BAD-SESSION" });
  const user = await ur.json(); const uid = user && user.id;
  if (typeof uid !== "string" || !/^[0-9a-f-]{36}$/.test(uid)) return reply(req, 401, { ok: false, rule: "KB-WRITER-BAD-SESSION" });
  let b; try { const t = await req.text(); if (t.length > MAX_BODY) throw 0; b = JSON.parse(t); } catch { return reply(req, 400, { ok: false, rule: "KB-WRITER-BAD-BODY" }); }
  const args = b && b.args, proof = b && b.proof;
  if (!args || typeof args !== "object" || Array.isArray(args) || Object.keys(args).sort().join() !== ARG_KEYS.join())
    return reply(req, 400, { ok: false, rule: "KB-WRITER-BAD-ARGS" });
  const body = proof && proof.body, sig = proof && proof.sig;
  // 2. the signed body has a fixed shape bound to this account
  if (!body || typeof body !== "object" || Object.keys(body).sort().join() !== "content_sha256,nonce,purpose,signer,ts,uid"
      || body.purpose !== PURPOSE || body.uid !== uid || typeof body.signer !== "string" || !/^sig-[0-9a-f]{16}$/.test(body.signer)
      || typeof body.nonce !== "string" || !/^[0-9a-f]{32}$/.test(body.nonce) || typeof body.content_sha256 !== "string" || !/^[0-9a-f]{64}$/.test(body.content_sha256))
    return reply(req, 400, { ok: false, rule: "KB-WRITER-PROOF-BODY" });
  if (!Number.isInteger(body.ts) || Math.abs(d.now() / 1000 - body.ts) > 300) return reply(req, 400, { ok: false, rule: "KB-WRITER-STALE-PROOF" });
  if (typeof sig !== "string" || !/^[A-Za-z0-9+/]{86}==$/.test(sig)) return reply(req, 400, { ok: false, rule: "KB-WRITER-SIGNATURE" });
  // 3. the signature covers exactly these write arguments
  if (await sha256hex(canon(args)) !== body.content_sha256) return reply(req, 400, { ok: false, rule: "KB-WRITER-CONTENT-MISMATCH" });
  const h = { apikey: d.service, authorization: "Bearer " + d.service, "content-type": "application/json" };
  // 4. the account must be linked to the owner and hold the writer role (the SQL function checks again)
  const cw = await d.fetch(d.url + "/rest/v1/account_links?select=user_id,revoked_at&user_id=eq." + uid, { headers: h });
  const links = cw.ok ? await cw.json() : [];
  const rr = await d.fetch(d.url + "/rest/v1/app_roles?select=role&role=eq.writer&user_id=eq." + uid, { headers: h });
  const roles = rr.ok ? await rr.json() : [];
  if (!links.length || links[0].revoked_at || !roles.length) return reply(req, 403, { ok: false, rule: "KB-WRITER-NOT-LINKED" });
  // 5. the device key is this account's, live, and the derived signer id matches the key
  const kr = await d.fetch(d.url + "/rest/v1/device_keys?select=owner,pub_jwk,revoked_at&signer_id=eq." + body.signer, { headers: h });
  const keys = kr.ok ? await kr.json() : [];
  if (!keys.length || keys[0].owner !== uid || keys[0].revoked_at) return reply(req, 403, { ok: false, rule: "KB-WRITER-DEVICE-UNKNOWN" });
  const pub = keys[0].pub_jwk || {};
  const jwk = { kty: "EC", crv: "P-256", x: pub.x, y: pub.y };
  const sid = "sig-" + (await sha256hex(canon(jwk))).slice(0, 16);
  if (pub.kty !== "EC" || pub.crv !== "P-256" || sid !== body.signer) return reply(req, 403, { ok: false, rule: "KB-WRITER-DEVICE-UNKNOWN" });
  // 6. verify the ECDSA P-256 signature over canon(body)
  let good = false;
  try { const k = await crypto.subtle.importKey("jwk", jwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"]);
        good = await crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, k, unb64(sig), new TextEncoder().encode(canon(body))); } catch { good = false; }
  if (!good) return reply(req, 400, { ok: false, rule: "KB-WRITER-BAD-SIGNATURE" });
  // 7. the drift law (4.9.211): recompute the trace epsilon and refuse early; the SQL writer checks the same again
  const dr = driftRefusal(args.p_proof);
  if (dr) return reply(req, 403, { ok: false, rule: dr });
  // 8. signed insert (service role only); the database re-checks link, device, nonce, freshness, the packet and the drift law
  const rpc = await d.fetch(d.url + "/rest/v1/rpc/memory_writer_insert_signed", { method: "POST", headers: h, body: JSON.stringify({
    p_uid: uid, p_signer_id: body.signer, p_nonce: body.nonce, p_ts: body.ts, p_signed_body: body,
    p_kind: args.p_kind, p_payload: args.p_payload, p_proof: args.p_proof, p_sources: args.p_sources,
    p_content_sha256: body.content_sha256, p_signature: sig, p_consent: args.p_consent,
    p_provenance: args.p_provenance, p_contributor: args.p_contributor }) });
  let out = null; try { out = await rpc.json(); } catch { out = null; }
  if (!rpc.ok) {
    const m = String(out && (out.message || out.hint || out.details) || "");
    const rule = (m.match(/KB-WRITER-[A-Z-]+/) || ["KB-WRITER-REFUSED"])[0];
    return reply(req, 403, { ok: false, rule });
  }
  return reply(req, 200, { ok: true, row: out });
}
