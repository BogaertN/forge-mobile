-- 4.9.202 self-seeded anchors.
-- FLAG: not applied.
-- applied: false
-- Nic applies migrations. This file stays in the repo only.
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
