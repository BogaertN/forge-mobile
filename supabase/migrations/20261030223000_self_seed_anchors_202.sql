-- 4.9.202 self-seeded anchors.
-- APPLIED to project hqcvywujrygbnaowgwln on 2026-10-31 as migration self_seed_anchors_202 (4.9.206, Nic's step 2: review and apply the pending migrations). Body unchanged.
-- applied: true
-- Nic asked for it to be applied (2026-10-31); it was applied through the Supabase migration tool.
-- It does not insert seed rows. A self-seeded anchor is written by the
-- admit path after the gates pass, with the fetch URL, license, time, and SHA-256
-- already stored on provenance. The contributor check grows to allow self-seed hosts.

begin;

alter table kb.anchors add column if not exists fetched_at timestamptz;
alter table kb.anchors add column if not exists content_sha256 text;
alter table kb.anchors add column if not exists asking_question text;

alter table kb.anchors drop constraint if exists anchors_contributor_check;
alter table kb.anchors add constraint anchors_contributor_check
  check (contributor like 'encyclopedia:%' or contributor like 'self-seed:%');

commit;
