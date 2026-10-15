-- Forge Mobile backend S1 / 0001: helper schema, roles (owner, contributor), device public keys, invites.
-- Roles are checked from a table, never from JWT user_metadata.
create extension if not exists pgcrypto with schema extensions;
create schema if not exists app;            -- NOT exposed via the API; helper functions only
revoke all on schema app from public;
grant usage on schema app to anon, authenticated;

create table public.app_roles (
  user_id    uuid not null references auth.users(id) on delete cascade,
  role       text not null check (role in ('owner','contributor')),
  granted_by uuid references auth.users(id) on delete set null,
  granted_at timestamptz not null default now(),
  primary key (user_id, role)
);
create index app_roles_granted_by_idx on public.app_roles (granted_by);
-- exactly one owner at most
create unique index app_roles_single_owner on public.app_roles (role) where role = 'owner';

create or replace function app.has_role(r text) returns boolean
  language sql stable security definer set search_path = '' as
$$ select exists (select 1 from public.app_roles where user_id = (select auth.uid()) and role = r) $$;
revoke all on function app.has_role(text) from public;
grant execute on function app.has_role(text) to anon, authenticated;

create table public.device_keys (
  signer_id  text primary key check (signer_id ~ '^sig-[0-9a-f]{16}$'),
  owner      uuid not null references auth.users(id) on delete cascade,
  pub_jwk    jsonb not null check (pub_jwk ? 'kty' and pub_jwk ? 'x' and not (pub_jwk ? 'd')),  -- never a private key
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);
create index device_keys_owner_idx on public.device_keys (owner);

create table public.invites (
  id          uuid primary key default gen_random_uuid(),
  code_sha256 text not null unique check (code_sha256 ~ '^[0-9a-f]{64}$'),  -- plaintext code is never stored
  issued_by   uuid not null references auth.users(id) on delete cascade,
  issued_at   timestamptz not null default now(),
  expires_at  timestamptz not null default now() + interval '14 days',
  redeemed_by uuid unique references auth.users(id) on delete set null,
  redeemed_at timestamptz,
  revoked_at  timestamptz,
  note        text check (length(note) <= 200)
);
create index invites_issued_by_idx on public.invites (issued_by);

-- owner issues a code; returns plaintext ONCE
create or replace function public.issue_invite(p_note text default null, p_days int default 14)
  returns text language plpgsql security definer set search_path = '' as $$
declare v_code text;
begin
  if not app.has_role('owner') then raise exception 'INVITE-OWNER-ONLY' using errcode = '42501'; end if;
  if p_days < 1 or p_days > 90 then raise exception 'INVITE-BAD-EXPIRY'; end if;
  v_code := encode(extensions.gen_random_bytes(18), 'hex');
  insert into public.invites (code_sha256, issued_by, expires_at, note)
  values (encode(extensions.digest(v_code, 'sha256'), 'hex'), (select auth.uid()), now() + make_interval(days => p_days), p_note);
  return v_code;
end $$;
revoke all on function public.issue_invite(text, int) from public, anon;
grant execute on function public.issue_invite(text, int) to authenticated;

-- signed-up user redeems a code -> contributor role
create or replace function public.redeem_invite(p_code text)
  returns boolean language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_uid uuid := (select auth.uid());
begin
  if v_uid is null then raise exception 'INVITE-SIGNIN-REQUIRED' using errcode = '42501'; end if;
  select id into v_id from public.invites
   where code_sha256 = encode(extensions.digest(coalesce(p_code,''), 'sha256'), 'hex')
     and redeemed_by is null and revoked_at is null and expires_at > now()
   for update;
  if v_id is null then raise exception 'INVITE-INVALID'; end if;
  update public.invites set redeemed_by = v_uid, redeemed_at = now() where id = v_id;
  insert into public.app_roles (user_id, role, granted_by)
    select v_uid, 'contributor', issued_by from public.invites where id = v_id
  on conflict do nothing;
  return true;
end $$;
revoke all on function public.redeem_invite(text) from public, anon;
grant execute on function public.redeem_invite(text) to authenticated;

create or replace function public.revoke_invite(p_id uuid) returns boolean
  language plpgsql security definer set search_path = '' as $$
begin
  if not app.has_role('owner') then raise exception 'INVITE-OWNER-ONLY' using errcode = '42501'; end if;
  update public.invites set revoked_at = now() where id = p_id and redeemed_by is null; return found;
end $$;
revoke all on function public.revoke_invite(uuid) from public, anon;
grant execute on function public.revoke_invite(uuid) to authenticated;
