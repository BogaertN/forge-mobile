-- 4.9.204 tuned frequency offsets.
-- APPLIED to project hqcvywujrygbnaowgwln on 2026-10-31 as migration frequency_tuning_204 (4.9.206, Nic's step 2: review and apply the pending migrations). Body unchanged.
-- applied: true
-- Nic asked for it to be applied (2026-10-31); it was applied through the Supabase migration tool.
-- The glyph master phase is not a column this migration writes.
-- Offsets are proposal v1, with the admit id that caused each pull.

begin;

alter table kb.anchors add column if not exists frequency_offsets jsonb;
comment on column kb.anchors.frequency_offsets is
  '4.9.204 proposal v1. Hertz offsets, provenance, and SPC age. Not applied until Nic says so. The 144 Hz master phase is not stored here as a moved value.';

commit;
