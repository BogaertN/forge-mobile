-- 4.9.203 frequency signatures on lexicon packets.
-- FLAG: not applied.
-- applied: false
-- Nic applies migrations. This file stays in the repo only.
-- It does not rewrite a phase. The existing Phi, eps, and mu stay the master.
-- The frequency column is the proposal-v1 signature, computed in the repo,
-- not by a hosted job.

begin;

alter table kb.anchors add column if not exists frequency jsonb;
comment on column kb.anchors.frequency is
  '4.9.203 proposal v1. Decimal Hz components plus the 144 Hz master phase. Not applied until Nic says so.';

commit;
