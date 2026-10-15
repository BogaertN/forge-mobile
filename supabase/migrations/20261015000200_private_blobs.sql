-- 0002: per-user end-to-end-encrypted private sync. Server sees ciphertext + keyed HMACs only.
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create table private.blobs (
  owner        uuid not null default auth.uid() references auth.users(id) on delete cascade,
  store        text not null check (store ~ '^[a-z_]{1,40}$'
                 and store not in ('vault','signing_key','node_pairing','pairing','permissions','policy','trace')),
  record_id    text not null check (length(record_id) between 1 and 200),
  version      bigint not null check (version >= 1),
  device_id    text not null check (length(device_id) <= 100),
  base_hmac    text check (base_hmac ~ '^[0-9a-f]{64}$'),
  content_hmac text not null check (content_hmac ~ '^[0-9a-f]{64}$'),
  ciphertext   bytea check (octet_length(ciphertext) <= 262144),
  deleted      boolean not null default false,
  server_seq   bigint generated always as identity,
  updated_at   timestamptz not null default now(),
  primary key (owner, store, record_id, version),
  check (deleted or ciphertext is not null)
);
create index blobs_owner_seq_idx on private.blobs (owner, server_seq);

create table private.sync_cursors (
  owner      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  device_id  text not null check (length(device_id) <= 100),
  last_seq   bigint not null default 0,
  updated_at timestamptz not null default now(),
  primary key (owner, device_id)
);
