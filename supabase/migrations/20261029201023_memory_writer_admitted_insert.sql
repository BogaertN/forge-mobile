-- 4.9.186: the memory writer may insert an ADMITTED fact. This narrows
-- supabase/migrations/20261021000100_revoke_contrib_insert.sql.
-- It does not restore the old client insert of quarantined rows.
--
-- anon and authenticated have no INSERT, UPDATE, or DELETE on kb.contributions.
-- The only insert path is app.memory_writer_insert (security definer, not in
-- an exposed schema). public.memory_writer_insert is a security-invoker wrapper
-- granted to authenticated only. The function refuses anything that is not an
-- admitted fact carrying sfe {Phi, eps, mu}, provenance, and contributor credit.
-- contributor_id is auth.uid(), so the account that added the row is recorded.
-- A direct table insert, including an unadmitted one, stays denied.
--
-- Apply to forge-mobile (hqcvywujrygbnaowgwln) when a project access token is
-- available. This file is the migration. It is not applied by committing it.

begin;

-- Device signature stays for a future signed client row. The memory writer
-- credits the account instead, so signer_id may be null. A non-null signer
-- still has to reference a live device key.
alter table kb.contributions alter column signer_id drop not null;

alter table kb.contributions drop constraint if exists contributions_admitted_packet;
alter table kb.contributions add constraint contributions_admitted_packet check (
  state <> 'admitted'
  or (
    jsonb_typeof(payload -> 'sfe') = 'object'
    and (payload -> 'sfe') ? 'Phi'
    and (payload -> 'sfe') ? 'eps'
    and (payload -> 'sfe') ? 'mu'
    and jsonb_typeof(payload -> 'provenance') = 'object'
    and length(btrim(coalesce(payload ->> 'contributor', ''))) > 0
  )
);

-- Reads of admitted rows by their author stay on the existing contrib_read
-- index (contributor_id, created_at). This partial index is the writer lookup.
create index if not exists contributions_admitted_writer_idx
  on kb.contributions (contributor_id, created_at desc)
  where state = 'admitted';

revoke insert, update, delete on kb.contributions from public, anon, authenticated;

-- The 4.9.78 guard is security definer, so current_user inside it is the owner
-- and the old anon/authenticated branch never saw a client. Check the JWT role.
-- A client still cannot set state. The memory writer sets app.memory_writer for
-- this transaction only, and even then the row must be admitted.
create or replace function app.contribution_guard() returns trigger
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  v_role text;
begin
  v_role := coalesce(auth.role(), '');
  if v_role in ('anon', 'authenticated') then
    if current_setting('app.memory_writer', true) = 'on' then
      if new.state is distinct from 'admitted' then
        raise exception 'KB-WRITER-UNADMITTED' using errcode = '42501';
      end if;
    else
      if new.state is distinct from 'quarantined' or new.screen_result is not null or new.decision_receipt is not null then
        raise exception 'KB-CLIENT-CANNOT-SET-STATE' using errcode = '42501';
      end if;
      if (select count(*) from kb.contributions c
          where c.contributor_id = new.contributor_id
            and c.created_at > now() - interval '1 day') >= 50 then
        raise exception 'KB-RATE-LIMIT' using errcode = '54000';
      end if;
    end if;
  end if;
  return new;
end $$;

revoke all on function app.contribution_guard() from public, anon, authenticated;

create or replace function app.memory_writer_insert(
  p_kind text,
  p_payload jsonb,
  p_proof jsonb,
  p_sources jsonb,
  p_content_sha256 text,
  p_signature text,
  p_consent jsonb,
  p_provenance jsonb,
  p_contributor text
) returns jsonb
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  v_uid uuid;
  v_phi int;
  v_eps numeric;
  v_mu numeric;
  v_id uuid;
  v_payload jsonb;
  v_row jsonb;
begin
  v_uid := auth.uid();
  if v_uid is null then
    raise exception 'KB-WRITER-ANON-REFUSED' using errcode = '42501';
  end if;
  if p_kind is distinct from 'fact' then
    raise exception 'KB-WRITER-UNADMITTED' using errcode = '42501';
  end if;
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'KB-WRITER-UNADMITTED' using errcode = '42501';
  end if;
  if p_payload ? 'state' and (p_payload ->> 'state') is distinct from 'admitted' then
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
  if p_signature is null or length(btrim(p_signature)) < 64 then
    raise exception 'KB-WRITER-SIGNATURE' using errcode = '42501';
  end if;
  if p_consent is null or jsonb_typeof(p_consent) <> 'object' then
    raise exception 'KB-WRITER-CONSENT' using errcode = '42501';
  end if;

  v_payload := p_payload || jsonb_build_object(
    'state', 'admitted',
    'sfe', jsonb_build_object('Phi', v_phi, 'eps', v_eps, 'mu', v_mu),
    'provenance', p_provenance,
    'contributor', btrim(p_contributor),
    'schema', coalesce(p_payload ->> 'schema', 'FORGE-RESONANCE-PACKET/v1')
  );

  perform set_config('app.memory_writer', 'on', true);

  insert into kb.contributions (
    contributor_id, signer_id, kind, payload, proof, sources,
    content_sha256, signature, consent, state
  ) values (
    v_uid, null, 'fact', v_payload, p_proof, coalesce(p_sources, '[]'::jsonb),
    p_content_sha256, p_signature, p_consent, 'admitted'
  )
  returning id into v_id;

  select jsonb_build_object(
    'id', c.id,
    'state', c.state,
    'kind', c.kind,
    'contributor_id', c.contributor_id,
    'payload', c.payload,
    'inserted', true,
    'verified', (c.state = 'admitted')
  )
  into v_row
  from kb.contributions c
  where c.id = v_id and c.contributor_id = v_uid;

  if v_row is null or (v_row ->> 'state') is distinct from 'admitted' or (v_row ->> 'verified') is distinct from 'true' then
    raise exception 'KB-WRITER-READBACK-FAILED' using errcode = '42501';
  end if;
  return v_row;
exception
  when unique_violation then
    select jsonb_build_object(
      'id', c.id,
      'state', c.state,
      'kind', c.kind,
      'contributor_id', c.contributor_id,
      'payload', c.payload,
      'inserted', false,
      'verified', (c.state = 'admitted')
    )
    into v_row
    from kb.contributions c
    where c.kind = 'fact' and c.content_sha256 = p_content_sha256 and c.contributor_id = v_uid;
    if v_row is null or (v_row ->> 'state') is distinct from 'admitted' then
      raise exception 'KB-WRITER-DUPLICATE' using errcode = '42501';
    end if;
    return v_row;
end $$;

revoke all on function app.memory_writer_insert(text, jsonb, jsonb, jsonb, text, text, jsonb, jsonb, text) from public, anon, authenticated;

create or replace function public.memory_writer_insert(
  p_kind text,
  p_payload jsonb,
  p_proof jsonb,
  p_sources jsonb,
  p_content_sha256 text,
  p_signature text,
  p_consent jsonb,
  p_provenance jsonb,
  p_contributor text
) returns jsonb
  language sql
  security invoker
  set search_path = ''
as $$
  select app.memory_writer_insert(
    p_kind, p_payload, p_proof, p_sources, p_content_sha256, p_signature, p_consent, p_provenance, p_contributor
  )
$$;

revoke all on function public.memory_writer_insert(text, jsonb, jsonb, jsonb, text, text, jsonb, jsonb, text) from public, anon;
grant execute on function public.memory_writer_insert(text, jsonb, jsonb, jsonb, text, text, jsonb, jsonb, text) to authenticated;

commit;
