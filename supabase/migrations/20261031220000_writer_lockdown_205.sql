-- 4.9.205 writer lockdown (Nic decision (d), 2026-10-31).
-- Memory-table writes need (1) an authenticated account that holds the 'writer' role, (2) a live link from
-- that account to the account holding the 'owner' role (Nic), and (3) a device signature that was verified,
-- not just measured. Postgres cannot verify ECDSA P-256, so the signature is checked in the Edge Function
-- `memory-writer` (WebCrypto, the same check `register-device` already does) against the PUBLIC key stored in
-- public.device_keys for that account. Only that function (service role) may call the signed insert. The
-- signed proof body is stored with the row, so anyone can re-verify it later from device_keys.
-- The old client RPC (app/public.memory_writer_insert: length-only signature check) is closed.
-- Other client write paths (private.blobs, private.sync_cursors, device_keys) also require a linked account.
-- The drift admission rule (eps <= 0.35) is unchanged. Auth settings (sign-up) are not changed here.

begin;

-- 1. the writer role ---------------------------------------------------------------------------------------
alter table public.app_roles drop constraint if exists app_roles_role_check;
alter table public.app_roles add constraint app_roles_role_check check (role in ('owner', 'contributor', 'writer'));

-- 2. linked accounts: an account may write only while it is linked to the owner account ---------------------
create table if not exists public.account_links (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  owner_id   uuid not null references auth.users(id) on delete cascade,
  linked_by  uuid references auth.users(id) on delete set null,
  linked_at  timestamptz not null default now(),
  revoked_at timestamptz,
  note       text check (note is null or length(note) <= 200)
);
create index if not exists account_links_owner_idx on public.account_links (owner_id);
alter table public.account_links enable row level security;
alter table public.account_links force row level security;
drop policy if exists account_links_read on public.account_links;
create policy account_links_read on public.account_links for select to authenticated
  using (user_id = (select auth.uid()) or (select app.has_role('owner')));
revoke insert, update, delete, truncate on public.account_links from public, anon, authenticated;
grant select on public.account_links to authenticated;

-- linked = a live link row whose owner_id currently holds the 'owner' role
create or replace function app.is_linked(p_uid uuid) returns boolean
  language sql stable security definer set search_path = '' as
$$ select p_uid is not null and exists (
     select 1 from public.account_links l
       join public.app_roles o on o.user_id = l.owner_id and o.role = 'owner'
      where l.user_id = p_uid and l.revoked_at is null) $$;

-- may write = linked AND holds the writer role
create or replace function app.can_write(p_uid uuid) returns boolean
  language sql stable security definer set search_path = '' as
$$ select app.is_linked(p_uid) and exists (
     select 1 from public.app_roles r where r.user_id = p_uid and r.role = 'writer') $$;

revoke all on function app.is_linked(uuid) from public, anon, authenticated;
revoke all on function app.can_write(uuid) from public, anon, authenticated;
grant execute on function app.is_linked(uuid) to authenticated, service_role;
grant execute on function app.can_write(uuid) to authenticated, service_role;
grant usage on schema app to service_role;

-- the writer role can exist only on a linked account (enforced for every path, including service role)
create or replace function app.writer_role_guard() returns trigger
  language plpgsql security definer set search_path = '' as $$
begin
  if new.role = 'writer' and not app.is_linked(new.user_id) then
    raise exception 'WRITER-ROLE-NEEDS-LINK' using errcode = '42501';
  end if;
  return new;
end $$;
revoke all on function app.writer_role_guard() from public, anon, authenticated;
drop trigger if exists app_roles_writer_guard on public.app_roles;
create trigger app_roles_writer_guard before insert or update on public.app_roles
  for each row execute function app.writer_role_guard();

-- owner-only: link an account and grant it the writer role; unlink revokes both
create or replace function app.link_writer(p_user uuid, p_note text default null) returns boolean
  language plpgsql security definer set search_path = '' as $$
declare v_owner uuid := (select auth.uid());
begin
  if not app.has_role('owner') then raise exception 'LINK-OWNER-ONLY' using errcode = '42501'; end if;
  if p_user is null or not exists (select 1 from auth.users u where u.id = p_user) then raise exception 'LINK-NO-SUCH-ACCOUNT'; end if;
  insert into public.account_links (user_id, owner_id, linked_by, note) values (p_user, v_owner, v_owner, p_note)
  on conflict (user_id) do update set owner_id = excluded.owner_id, linked_by = excluded.linked_by,
    linked_at = now(), revoked_at = null, note = excluded.note;
  insert into public.app_roles (user_id, role, granted_by) values (p_user, 'writer', v_owner) on conflict do nothing;
  return true;
end $$;
create or replace function app.unlink_writer(p_user uuid) returns boolean
  language plpgsql security definer set search_path = '' as $$
begin
  if not app.has_role('owner') then raise exception 'LINK-OWNER-ONLY' using errcode = '42501'; end if;
  update public.account_links set revoked_at = now() where user_id = p_user and revoked_at is null;
  delete from public.app_roles where user_id = p_user and role = 'writer';
  return found;
end $$;
revoke all on function app.link_writer(uuid, text) from public, anon, authenticated;
revoke all on function app.unlink_writer(uuid) from public, anon, authenticated;
grant execute on function app.link_writer(uuid, text) to authenticated;
grant execute on function app.unlink_writer(uuid) to authenticated;
create or replace function public.link_writer(p_user uuid, p_note text default null) returns boolean
  language sql security invoker set search_path = '' as $$ select app.link_writer(p_user, p_note) $$;
create or replace function public.unlink_writer(p_user uuid) returns boolean
  language sql security invoker set search_path = '' as $$ select app.unlink_writer(p_user) $$;
revoke all on function public.link_writer(uuid, text) from public, anon;
revoke all on function public.unlink_writer(uuid) from public, anon;
grant execute on function public.link_writer(uuid, text) to authenticated;
grant execute on function public.unlink_writer(uuid) to authenticated;

-- Nic: the account that holds the owner role is linked to itself and holds the writer role.
-- (No id is hard-coded: it is whoever holds 'owner'. There is exactly one by app_roles_single_owner.)
insert into public.account_links (user_id, owner_id, linked_by, note)
  select user_id, user_id, user_id, 'owner (Nic) self-link, 4.9.205' from public.app_roles where role = 'owner'
  on conflict (user_id) do nothing;
insert into public.app_roles (user_id, role, granted_by)
  select user_id, 'writer', user_id from public.app_roles where role = 'owner'
  on conflict do nothing;

-- 3. replay guard for signed writes -------------------------------------------------------------------------
create table if not exists app.writer_nonces (
  signer_id text not null,
  nonce     text not null check (nonce ~ '^[0-9a-f]{32}$'),
  used_at   timestamptz not null default now(),
  primary key (signer_id, nonce)
);
revoke all on app.writer_nonces from public, anon, authenticated;

-- 4. close the length-only client RPC -----------------------------------------------------------------------
revoke all on function public.memory_writer_insert(text, jsonb, jsonb, jsonb, text, text, jsonb, jsonb, text) from public, anon, authenticated;
revoke all on function app.memory_writer_insert(text, jsonb, jsonb, jsonb, text, text, jsonb, jsonb, text) from public, anon, authenticated;
create or replace function app.memory_writer_insert(
  p_kind text, p_payload jsonb, p_proof jsonb, p_sources jsonb, p_content_sha256 text,
  p_signature text, p_consent jsonb, p_provenance jsonb, p_contributor text
) returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  raise exception 'KB-WRITER-SIGNED-PATH-REQUIRED' using errcode = '42501';
end $$;
revoke all on function app.memory_writer_insert(text, jsonb, jsonb, jsonb, text, text, jsonb, jsonb, text) from public, anon, authenticated;

-- 5. the signed insert (service role only; called by the memory-writer Edge Function after it verified the
--    account session and the ECDSA P-256 device signature) ------------------------------------------------
create or replace function app.memory_writer_insert_signed(
  p_uid uuid, p_signer_id text, p_nonce text, p_ts bigint, p_signed_body jsonb,
  p_kind text, p_payload jsonb, p_proof jsonb, p_sources jsonb, p_content_sha256 text,
  p_signature text, p_consent jsonb, p_provenance jsonb, p_contributor text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_phi int; v_eps numeric; v_mu numeric; v_id uuid; v_payload jsonb; v_row jsonb;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'KB-WRITER-SIGNED-PATH-REQUIRED' using errcode = '42501';
  end if;
  if not app.can_write(p_uid) then
    raise exception 'KB-WRITER-NOT-LINKED' using errcode = '42501';
  end if;
  if p_signer_id is null or not exists (select 1 from public.device_keys d
      where d.signer_id = p_signer_id and d.owner = p_uid and d.revoked_at is null) then
    raise exception 'KB-WRITER-DEVICE-UNKNOWN' using errcode = '42501';
  end if;
  if p_signature is null or p_signature !~ '^[A-Za-z0-9+/]{86}==$' then
    raise exception 'KB-WRITER-SIGNATURE' using errcode = '42501';
  end if;
  if p_ts is null or abs(extract(epoch from now()) - p_ts) > 300 then
    raise exception 'KB-WRITER-STALE-PROOF' using errcode = '42501';
  end if;
  if p_signed_body is null
     or p_signed_body ->> 'purpose' is distinct from 'forge-memory-writer/v1'
     or p_signed_body ->> 'uid' is distinct from p_uid::text
     or p_signed_body ->> 'signer' is distinct from p_signer_id
     or p_signed_body ->> 'nonce' is distinct from p_nonce
     or p_signed_body ->> 'content_sha256' is distinct from p_content_sha256
     or (p_signed_body ->> 'ts')::bigint is distinct from p_ts then
    raise exception 'KB-WRITER-PROOF-BODY' using errcode = '42501';
  end if;
  begin
    insert into app.writer_nonces (signer_id, nonce) values (p_signer_id, p_nonce);
  exception when unique_violation or check_violation then
    raise exception 'KB-WRITER-REPLAY' using errcode = '42501';
  end;
  if p_kind is distinct from 'fact' or p_payload is null or jsonb_typeof(p_payload) <> 'object'
     or (p_payload ? 'state' and (p_payload ->> 'state') is distinct from 'admitted') then
    raise exception 'KB-WRITER-UNADMITTED' using errcode = '42501';
  end if;
  if jsonb_typeof(p_payload -> 'sfe') is distinct from 'object'
     or not ((p_payload -> 'sfe') ? 'Phi' and (p_payload -> 'sfe') ? 'eps' and (p_payload -> 'sfe') ? 'mu') then
    raise exception 'KB-WRITER-PACKET-REQUIRED' using errcode = '42501';
  end if;
  begin
    v_phi := (p_payload -> 'sfe' ->> 'Phi')::int;
    v_eps := (p_payload -> 'sfe' ->> 'eps')::numeric;
    v_mu := (p_payload -> 'sfe' ->> 'mu')::numeric;
  exception when others then
    raise exception 'KB-WRITER-PACKET-REQUIRED' using errcode = '42501';
  end;
  -- admission law unchanged: eps <= 0.35
  if v_phi < 1 or v_phi > 9 or v_eps < 0 or v_eps > 0.35 or v_mu <= 0 or v_mu > 1 then
    raise exception 'KB-WRITER-PACKET-REQUIRED' using errcode = '42501';
  end if;
  if p_provenance is null or jsonb_typeof(p_provenance) <> 'object' or p_provenance = '{}'::jsonb then
    raise exception 'KB-WRITER-PROVENANCE-REQUIRED' using errcode = '42501';
  end if;
  if p_contributor is null or length(btrim(p_contributor)) = 0 or length(p_contributor) > 80 then
    raise exception 'KB-WRITER-PROVENANCE-REQUIRED' using errcode = '42501';
  end if;
  if p_content_sha256 is null or p_content_sha256 !~ '^[0-9a-f]{64}$' then
    raise exception 'KB-WRITER-HASH' using errcode = '42501';
  end if;
  if p_consent is null or jsonb_typeof(p_consent) <> 'object' then
    raise exception 'KB-WRITER-CONSENT' using errcode = '42501';
  end if;

  v_payload := p_payload || jsonb_build_object(
    'state', 'admitted',
    'sfe', jsonb_build_object('Phi', v_phi, 'eps', v_eps, 'mu', v_mu),
    'provenance', p_provenance,
    'contributor', btrim(p_contributor),
    'schema', coalesce(p_payload ->> 'schema', 'FORGE-RESONANCE-PACKET/v1'));

  perform set_config('app.memory_writer', 'on', true);
  begin
    insert into kb.contributions (contributor_id, signer_id, kind, payload, proof, sources,
      content_sha256, signature, consent, state)
    values (p_uid, p_signer_id, 'fact', v_payload,
      coalesce(p_proof, '{}'::jsonb) || jsonb_build_object('device_proof', p_signed_body, 'verified_by', 'edge:memory-writer ECDSA P-256'),
      coalesce(p_sources, '[]'::jsonb), p_content_sha256, p_signature, p_consent, 'admitted')
    returning id into v_id;
  exception when unique_violation then
    select jsonb_build_object('id', c.id, 'state', c.state, 'kind', c.kind, 'contributor_id', c.contributor_id,
      'signer_id', c.signer_id, 'payload', c.payload, 'inserted', false, 'verified', (c.state = 'admitted'))
      into v_row from kb.contributions c where c.kind = 'fact' and c.content_sha256 = p_content_sha256;
    if v_row is null or (v_row ->> 'state') is distinct from 'admitted' then
      raise exception 'KB-WRITER-DUPLICATE' using errcode = '42501';
    end if;
    return v_row;
  end;

  select jsonb_build_object('id', c.id, 'state', c.state, 'kind', c.kind, 'contributor_id', c.contributor_id,
    'signer_id', c.signer_id, 'payload', c.payload, 'inserted', true, 'verified', (c.state = 'admitted'))
    into v_row from kb.contributions c where c.id = v_id and c.contributor_id = p_uid;
  if v_row is null or (v_row ->> 'verified') is distinct from 'true' then
    raise exception 'KB-WRITER-READBACK-FAILED' using errcode = '42501';
  end if;
  return v_row;
end $$;
revoke all on function app.memory_writer_insert_signed(uuid, text, text, bigint, jsonb, text, jsonb, jsonb, jsonb, text, text, jsonb, jsonb, text) from public, anon, authenticated;
grant execute on function app.memory_writer_insert_signed(uuid, text, text, bigint, jsonb, text, jsonb, jsonb, jsonb, text, text, jsonb, jsonb, text) to service_role;

create or replace function public.memory_writer_insert_signed(
  p_uid uuid, p_signer_id text, p_nonce text, p_ts bigint, p_signed_body jsonb,
  p_kind text, p_payload jsonb, p_proof jsonb, p_sources jsonb, p_content_sha256 text,
  p_signature text, p_consent jsonb, p_provenance jsonb, p_contributor text
) returns jsonb language sql security invoker set search_path = '' as $$
  select app.memory_writer_insert_signed(p_uid, p_signer_id, p_nonce, p_ts, p_signed_body, p_kind, p_payload,
    p_proof, p_sources, p_content_sha256, p_signature, p_consent, p_provenance, p_contributor)
$$;
revoke all on function public.memory_writer_insert_signed(uuid, text, text, bigint, jsonb, text, jsonb, jsonb, jsonb, text, text, jsonb, jsonb, text) from public, anon, authenticated;
grant execute on function public.memory_writer_insert_signed(uuid, text, text, bigint, jsonb, text, jsonb, jsonb, jsonb, text, text, jsonb, jsonb, text) to service_role;

-- 6. the other client write paths also need a linked account ----------------------------------------------
drop policy if exists blobs_insert on private.blobs;
create policy blobs_insert on private.blobs for insert to authenticated
  with check (owner = (select auth.uid()) and (select app.is_linked((select auth.uid()))));
drop policy if exists cursors_insert on private.sync_cursors;
create policy cursors_insert on private.sync_cursors for insert to authenticated
  with check (owner = (select auth.uid()) and (select app.is_linked((select auth.uid()))));
drop policy if exists cursors_update on private.sync_cursors;
create policy cursors_update on private.sync_cursors for update to authenticated
  using (owner = (select auth.uid()))
  with check (owner = (select auth.uid()) and (select app.is_linked((select auth.uid()))));

-- device keys are written by the register-device function (service role); the key owner must be linked
create or replace function app.device_key_guard() returns trigger
  language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' and not app.is_linked(new.owner) then
    raise exception 'DEVICE-OWNER-NOT-LINKED' using errcode = '42501';
  end if;
  return new;
end $$;
revoke all on function app.device_key_guard() from public, anon, authenticated;
drop trigger if exists device_keys_link_guard on public.device_keys;
create trigger device_keys_link_guard before insert on public.device_keys
  for each row execute function app.device_key_guard();

commit;
