-- 4.9.187: the memory-writer grant that is already applied on
-- forge-mobile (hqcvywujrygbnaowgwln), plus a read-only anchor tier.
--
-- public.memory_writer_insert is security invoker. The caller therefore
-- needs usage on schema app and execute on app.memory_writer_insert.
-- Those two grants were applied live and were missing from the repo.
--
-- kb.contributions.state has no 'anchor' value. Anchors live in kb.anchors.
-- They are not admitted. Clients may read them. They cannot insert.

begin;

grant usage on schema app to authenticated;
grant execute on function app.memory_writer_insert(text, jsonb, jsonb, jsonb, text, text, jsonb, jsonb, text) to authenticated;

create table if not exists kb.anchors (
  id            uuid primary key default gen_random_uuid(),
  anchor_id     text not null unique,
  text          text not null check (char_length(text) between 8 and 2000),
  state         text not null default 'anchor' check (state = 'anchor'),
  packet        jsonb not null,
  concepts      jsonb not null default '[]'::jsonb,
  provenance    jsonb not null,
  contributor   text not null check (contributor like 'encyclopedia:%'),
  trust         text not null default 'trusted' check (trust = 'trusted'),
  license       text not null,
  source_url    text not null,
  revision      text not null,
  created_at    timestamptz not null default now(),
  constraint anchors_packet check (
    jsonb_typeof(packet) = 'object'
    and (packet ? 'Phi')
    and (packet ? 'eps')
    and (packet ? 'mu')
  )
);

alter table kb.anchors enable row level security;

drop policy if exists anchors_read on kb.anchors;
create policy anchors_read on kb.anchors
  for select
  to anon, authenticated
  using (true);

revoke insert, update, delete on kb.anchors from public, anon, authenticated;
grant select on kb.anchors to anon, authenticated;

commit;
