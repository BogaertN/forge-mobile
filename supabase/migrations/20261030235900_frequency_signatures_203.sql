-- 4.9.203 frequency signatures on lexicon packets.
-- APPLIED to project hqcvywujrygbnaowgwln on 2026-10-31 as migration frequency_signatures_203 (4.9.206, Nic's step 2: review and apply the pending migrations). Body unchanged.
-- applied: true
-- Nic asked for it to be applied (2026-10-31); it was applied through the Supabase migration tool.
-- It does not rewrite a phase. The existing Phi, eps, and mu stay the master.
-- The frequency column is the proposal-v1 signature, computed in the repo,
-- not by a hosted job.

begin;

alter table kb.anchors add column if not exists frequency jsonb;
comment on column kb.anchors.frequency is
  '4.9.203 proposal v1. Decimal Hz components plus the 144 Hz master phase. Not applied until Nic says so.';

commit;
