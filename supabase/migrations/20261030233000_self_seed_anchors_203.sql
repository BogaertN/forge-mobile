-- 4.9.203 reference-prose anchors.
-- FLAG: not applied.
-- applied: false
-- Nic applies migrations. This file stays in the repo only.
-- It does not insert seed rows. A self-seeded anchor still carries the fetch
-- URL, license, time, and SHA-256. Period year and the stale flag are recorded
-- when the source is a dated edition.

begin;

alter table kb.anchors add column if not exists period_year integer;
alter table kb.anchors add column if not exists stale boolean;
alter table kb.anchors add column if not exists page_class text;

commit;
