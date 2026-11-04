-- 4.9.221 (Nic 2026-11-04, t136u): Storage bucket for pinned reference data the phone loads lazily (first: the Open English
-- WordNet 2025 plus homograph sense pack, CC BY 4.0, pinned by SHA-256 in src/senses.js FORGE_REF). Same pattern as forge-libs:
-- public READ only; no insert/update/delete policy on storage.objects for anon or authenticated, so only the service role
-- (server side, never shipped) can upload. Objects are content-addressed (sha256 prefix in the name) and immutable.
-- Applied 2026-11-04 through the Storage API; this file records it and is idempotent. Not a kb.anchors change.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('forge-ref', 'forge-ref', true, 10485760, array['application/gzip', 'application/octet-stream'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
