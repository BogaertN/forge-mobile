-- 4.9.216 (Nic): Storage bucket for the pinned open-source Python wheels the phone engine loads lazily for math
-- (sympy, mpmath, pint and pint's pure-Python dependencies). Public READ of these wheels only; no public write:
-- no insert/update/delete policy is created on storage.objects for anon or authenticated, so only the service role
-- (server side, never shipped) can upload. Size cap 10 MB per object; wheels are zip files.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('forge-libs', 'forge-libs', true, 10485760, array['application/zip', 'application/octet-stream'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
