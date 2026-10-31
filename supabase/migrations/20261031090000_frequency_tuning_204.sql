-- 4.9.204 tuned frequency offsets.
-- FLAG: not applied.
-- applied: false
-- Nic applies migrations. This file stays in the repo only.
-- The glyph master phase is not a column this migration writes.
-- Offsets are proposal v1, with the admit id that caused each pull.

begin;

alter table kb.anchors add column if not exists frequency_offsets jsonb;
comment on column kb.anchors.frequency_offsets is
  '4.9.204 proposal v1. Hertz offsets, provenance, and SPC age. Not applied until Nic says so. The 144 Hz master phase is not stored here as a moved value.';

commit;
