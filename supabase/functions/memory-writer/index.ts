// memory-writer (Forge Mobile 4.9.205; 4.9.211 adds the DRIFT-SPEC/v1 write law: KB-WRITER-DRIFT-INPUT-REQUIRED, -EPS-MISMATCH,
// -FORBIDDEN, -HARD-STOP, -DRIFT, -UNNAMED, -ECHO, -COHERENCE, -CHAIN-BREAK). The ONLY path that writes an admitted fact to kb.contributions.
// It verifies (1) the caller's Supabase session, (2) that the account is linked to the owner and holds the
// writer role, (3) that the device key is registered to that account and not revoked, and (4) the ECDSA
// P-256 signature over the fixed proof body, which binds the account, the device, a fresh nonce, a timestamp
// and the SHA-256 of the canonical write arguments. Only then does it call the service-role-only SQL
// function public.memory_writer_insert_signed, which re-checks the link, device, nonce (replay), freshness
// and the admission packet (eps <= 0.35) before inserting. No dependencies. Not part of reasoning.
import { handle } from "./writer.js";
const URL_ = Deno.env.get("SUPABASE_URL")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
Deno.serve((req) => handle(req, { url: URL_, service: SERVICE, anon: ANON, fetch: (u, i) => fetch(u, i), now: () => Date.now() }));
