// register-device (Forge Mobile S2). Verifies that the caller (a) holds a valid Supabase user session and
// (b) controls the device ECDSA P-256 key, then stores the PUBLIC key in public.device_keys for that user.
// The service role key comes from the function environment only; it is never in the repo, CI or the client.
// No dependencies. Not part of reasoning.
const ALLOWED_ORIGINS = new Set(["https://bogaertn.github.io"]);
const PURPOSE = "forge-register-device/v1";
const URL_ = Deno.env.get("SUPABASE_URL")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;

const canon = (o: unknown): string => Array.isArray(o) ? "[" + o.map(canon).join(",") + "]"
  : o && typeof o === "object" ? "{" + Object.keys(o as Record<string, unknown>).sort()
      .filter((k) => (o as Record<string, unknown>)[k] !== undefined)
      .map((k) => JSON.stringify(k) + ":" + canon((o as Record<string, unknown>)[k])).join(",") + "}"
  : JSON.stringify(o);
const hex = (b: ArrayBuffer) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
const unb64 = (s: string) => { s = s.replace(/-/g, "+").replace(/_/g, "/"); while (s.length % 4) s += "="; const b = atob(s); return Uint8Array.from(b, (c) => c.charCodeAt(0)); };

function cors(req: Request): Record<string, string> {
  const o = req.headers.get("origin") || "";
  return ALLOWED_ORIGINS.has(o) ? { "Access-Control-Allow-Origin": o, "Vary": "Origin",
    "Access-Control-Allow-Headers": "authorization, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" } : {};
}
const reply = (req: Request, status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...cors(req) } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(req) });
  if (req.method !== "POST") return reply(req, 405, { ok: false, rule: "REG-METHOD" });
  const auth = req.headers.get("authorization") || "";
  if (!/^Bearer [A-Za-z0-9._-]+$/.test(auth)) return reply(req, 401, { ok: false, rule: "REG-NO-SESSION" });
  // 1. who is calling: ask Supabase Auth to validate the user's access token
  const ur = await fetch(URL_ + "/auth/v1/user", { headers: { authorization: auth, apikey: ANON } });
  if (!ur.ok) return reply(req, 401, { ok: false, rule: "REG-BAD-SESSION" });
  const user = await ur.json(); const uid: string = user.id;
  let b: any; try { const t = await req.text(); if (t.length > 4096) throw 0; b = JSON.parse(t); } catch { return reply(req, 400, { ok: false, rule: "REG-BAD-BODY" }); }
  const { body, sig, signer, pub } = b || {};
  // 2. shape + freshness + binding to this user
  if (!body || body.purpose !== PURPOSE || body.uid !== uid || body.signer !== signer || typeof body.nonce !== "string" || body.nonce.length < 16)
    return reply(req, 400, { ok: false, rule: "REG-BAD-PROOF-BODY" });
  if (!Number.isInteger(body.ts) || Math.abs(Date.now() / 1000 - body.ts) > 300) return reply(req, 400, { ok: false, rule: "REG-STALE-PROOF" });
  if (!pub || pub.kty !== "EC" || pub.crv !== "P-256" || typeof pub.x !== "string" || typeof pub.y !== "string" || "d" in pub)
    return reply(req, 400, { ok: false, rule: "REG-BAD-KEY" });
  const jwk = { kty: "EC", crv: "P-256", x: pub.x, y: pub.y };
  // 3. signer id must be derived from the key (same rule as shared.js Signer)
  const sid = "sig-" + hex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canon(jwk)))).slice(0, 16);
  if (sid !== signer) return reply(req, 400, { ok: false, rule: "REG-SIGNER-MISMATCH" });
  // 4. proof of possession
  let good = false;
  try { const k = await crypto.subtle.importKey("jwk", jwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"]);
        good = await crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, k, unb64(String(sig)), new TextEncoder().encode(canon(body))); } catch { good = false; }
  if (!good) return reply(req, 400, { ok: false, rule: "REG-BAD-SIGNATURE" });
  // 5. store public key (service role; idempotent for the same owner)
  const h = { apikey: SERVICE, authorization: "Bearer " + SERVICE, "content-type": "application/json" };
  const ex = await fetch(URL_ + "/rest/v1/device_keys?select=owner,revoked_at&signer_id=eq." + sid, { headers: h });
  const rows = ex.ok ? await ex.json() : [];
  if (rows.length) {
    if (rows[0].owner !== uid) return reply(req, 409, { ok: false, rule: "REG-KEY-BELONGS-TO-ANOTHER-USER" });
    if (rows[0].revoked_at) return reply(req, 409, { ok: false, rule: "REG-KEY-REVOKED" });
    return reply(req, 200, { ok: true, signer_id: sid, already: true });
  }
  const ins = await fetch(URL_ + "/rest/v1/device_keys", { method: "POST", headers: { ...h, prefer: "return=minimal" },
    body: JSON.stringify({ signer_id: sid, owner: uid, pub_jwk: jwk }) });
  if (!ins.ok) return reply(req, 500, { ok: false, rule: "REG-INSERT-FAILED" });
  return reply(req, 200, { ok: true, signer_id: sid });
});
