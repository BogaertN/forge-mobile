# Forge Mobile backend (Supabase) — storage, sync and shared knowledge only; never reasoning

Project: `forge-mobile` (ref `hqcvywujrygbnaowgwln`, us-east-1, free tier). Design: plan §13 (proof-only admission).
- `migrations/` — applied in order via Supabase migrations (S1). Not part of the PWA build.
- `tests/rls_security_test.sql` — RLS/security acceptance tests; run as postgres, all work is rolled back
  by the final `RAISE` which prints `TEST_RESULTS [...]` (every entry must be `true`).
The anon key is public (GitHub Pages): only RLS, grants and append-only triggers protect data.
Clients can never write kb canonical tables, receipts, snapshots or contribution state.
