-- 4.9.224 APPLIED: Athena write path (Nic 2026-11-04, pt139u/t140u).
-- Adds meaning/attribution columns on kb.anchors, exposes them on public.kb_anchors,
-- and creates app.athena_anchor_insert (service_role only). Writes stay OFF until Nic
-- sets p_commit=true; the runner defaults to dry-run (validate only, no insert).
-- Rollback SQL is at the bottom of this file (commented).

begin;

alter table kb.anchors
  add column if not exists meaning_id text,
  add column if not exists meaning_trace jsonb,
  add column if not exists independent_hosts text[],
  add column if not exists attribution text,
  add column if not exists archived_from text;

comment on column kb.anchors.meaning_id is '4.9.224: OEWN synset id of the pinned/resolved subject sense (Athena)';
comment on column kb.anchors.meaning_trace is '4.9.224: FORGE-ATHENA-MEANING/v1 agree/contradict/unplaced + subject_sense';
comment on column kb.anchors.independent_hosts is '4.9.224: hosts that counted toward the two-publisher agreement (GeoNames excluded)';
comment on column kb.anchors.attribution is '4.9.224: required CC BY / licence credit string when the licence needs attribution';
comment on column kb.anchors.archived_from is '4.9.224: frozen Factbook mirror URL+commit (or other archived_from) when used';

create or replace view public.kb_anchors with (security_invoker = true) as
  select anchor_id as id, text, state, trust, packet, concepts, provenance, contributor, license, source_url, revision,
         band_phase, band_name, band_hz, band_r, band_source, band_schema,
         content_sha256, fetched_at, asking_question,
         meaning_id, meaning_trace, independent_hosts, attribution, archived_from
  from kb.anchors a;

grant select on public.kb_anchors to anon, authenticated;
grant all on public.kb_anchors to postgres, service_role;

-- Athena insert: service_role only. p_commit=false (default) validates and returns the row Athena would write.
-- Unsourced rows are refused. Echo on the stored provenance must be >= 0.97. Server forces packet.eps = 0.
create or replace function app.athena_anchor_insert(p_row jsonb, p_commit boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_text text := btrim(coalesce(p_row ->> 'text', ''));
  v_anchor_id text := btrim(coalesce(p_row ->> 'anchor_id', p_row ->> 'id', ''));
  v_source_url text := btrim(coalesce(p_row ->> 'source_url', ''));
  v_license text := btrim(coalesce(p_row ->> 'license', ''));
  v_license_url text := btrim(coalesce(p_row ->> 'license_url', ''));
  v_contributor text := btrim(coalesce(p_row ->> 'contributor', ''));
  v_revision text := btrim(coalesce(p_row ->> 'revision', ''));
  v_content_sha256 text := lower(btrim(coalesce(p_row ->> 'content_sha256', p_row #>> '{provenance,content_sha256}', '')));
  v_asking text := btrim(coalesce(p_row ->> 'asking_question', p_row #>> '{provenance,asking_question}', ''));
  v_fetched timestamptz := nullif(btrim(coalesce(p_row ->> 'fetched_at', p_row #>> '{provenance,fetched_at}', '')), '')::timestamptz;
  v_meaning_id text := nullif(btrim(coalesce(p_row ->> 'meaning_id', '')), '');
  v_attribution text := nullif(btrim(coalesce(p_row ->> 'attribution', '')), '');
  v_archived_from text := nullif(btrim(coalesce(p_row ->> 'archived_from', p_row #>> '{provenance,archived_from}', '')), '');
  v_packet jsonb := coalesce(p_row -> 'packet', '{}'::jsonb);
  v_provenance jsonb := coalesce(p_row -> 'provenance', '{}'::jsonb);
  v_concepts jsonb := coalesce(p_row -> 'concepts', '[]'::jsonb);
  v_meaning_trace jsonb := p_row -> 'meaning_trace';
  v_hosts text[] := null;
  v_echo numeric;
  v_eps numeric;
  v_phi int;
  v_band jsonb;
  v_id uuid;
  v_out jsonb;
begin
  if auth.role() is distinct from 'service_role' and current_user is distinct from 'postgres' then
    raise exception 'ATHENA-SERVICE-ROLE-ONLY' using errcode = '42501';
  end if;
  if char_length(v_text) < 8 or char_length(v_text) > 2000 then
    raise exception 'ATHENA-TEXT-LENGTH' using errcode = '22023';
  end if;
  if v_anchor_id = '' or char_length(v_anchor_id) > 120 then
    raise exception 'ATHENA-ANCHOR-ID' using errcode = '22023';
  end if;
  if v_source_url = '' or lower(v_source_url) in ('unsourced', 'none', 'null') then
    raise exception 'ATHENA-UNSOURCED' using errcode = '22023';
  end if;
  if v_license = '' then
    raise exception 'ATHENA-LICENSE' using errcode = '22023';
  end if;
  if v_contributor = '' or (v_contributor not like 'self-seed:%' and v_contributor not like 'athena:%') then
    raise exception 'ATHENA-CONTRIBUTOR' using errcode = '22023';
  end if;
  if v_content_sha256 is null or v_content_sha256 !~ '^[0-9a-f]{64}$' then
    raise exception 'ATHENA-CONTENT-HASH' using errcode = '22023';
  end if;
  if jsonb_typeof(v_packet) is distinct from 'object' or not (v_packet ? 'Phi') or not (v_packet ? 'eps') or not (v_packet ? 'mu') then
    raise exception 'ATHENA-PACKET' using errcode = '22023';
  end if;
  if jsonb_typeof(v_provenance) is distinct from 'object' then
    raise exception 'ATHENA-PROVENANCE' using errcode = '22023';
  end if;
  -- independent hosts: prefer top-level array, else provenance.independent_hosts
  if jsonb_typeof(p_row -> 'independent_hosts') = 'array' then
    select array_agg(x order by x) into v_hosts
      from (select distinct jsonb_array_elements_text(p_row -> 'independent_hosts') as x) s
     where x <> '' and x <> 'geonames.org';
  elsif jsonb_typeof(v_provenance -> 'independent_hosts') = 'array' then
    select array_agg(x order by x) into v_hosts
      from (select distinct jsonb_array_elements_text(v_provenance -> 'independent_hosts') as x) s
     where x <> '' and x <> 'geonames.org';
  end if;
  if v_hosts is null or coalesce(array_length(v_hosts, 1), 0) < 2 then
    raise exception 'ATHENA-CORROBORATION' using errcode = '22023';
  end if;
  v_echo := nullif(v_provenance ->> 'echo', '')::numeric;
  if v_echo is null or v_echo < 0.97 then
    raise exception 'ATHENA-ECHO' using errcode = '22023';
  end if;
  -- server recomputes ε: Athena seed candidates carry eps=0; refuse a drifted write
  v_eps := coalesce(nullif(v_packet ->> 'eps', '')::numeric, 1);
  if v_eps > 0.35 then
    raise exception 'ATHENA-EPS' using errcode = '22023';
  end if;
  v_packet := jsonb_set(v_packet, '{eps}', '0'::jsonb, true);
  v_packet := jsonb_set(v_packet, '{sfe,eps}', '0'::jsonb, true);
  v_phi := nullif(v_packet ->> 'Phi', '')::int;
  if v_phi is null or v_phi < 1 or v_phi > 9 then
    raise exception 'ATHENA-PHI' using errcode = '22023';
  end if;
  v_band := v_packet -> 'band';
  if v_revision = '' then
    v_revision := left(v_content_sha256, 12);
  end if;
  v_provenance := v_provenance
    || jsonb_build_object(
         'schema', 'FORGE-ATHENA-PROVENANCE/v1',
         'independent_hosts', to_jsonb(v_hosts),
         'content_sha256', v_content_sha256,
         'source_url', v_source_url,
         'license', v_license,
         'echo', v_echo
       );
  v_out := jsonb_build_object(
    'ok', true,
    'commit', coalesce(p_commit, false),
    'anchor_id', v_anchor_id,
    'text', v_text,
    'source_url', v_source_url,
    'license', v_license,
    'license_url', nullif(v_license_url, ''),
    'content_sha256', v_content_sha256,
    'meaning_id', v_meaning_id,
    'independent_hosts', to_jsonb(v_hosts),
    'echo', v_echo,
    'Phi', v_phi,
    'band_phase', nullif(v_band ->> 'phase', '')::int,
    'band_name', v_band ->> 'band',
    'attribution', v_attribution,
    'archived_from', v_archived_from,
    'written', false
  );
  if not coalesce(p_commit, false) then
    return v_out || jsonb_build_object('dry_run', true, 'rule', 'ATHENA-DRY-RUN');
  end if;
  insert into kb.anchors (
    anchor_id, text, state, packet, concepts, provenance, contributor, trust, license, source_url, revision,
    fetched_at, content_sha256, asking_question,
    band_phase, band_name, band_hz, band_r, band_source, band_schema,
    meaning_id, meaning_trace, independent_hosts, attribution, archived_from
  ) values (
    v_anchor_id, v_text, 'anchor', v_packet, v_concepts, v_provenance, v_contributor, 'trusted', v_license, v_source_url, v_revision,
    v_fetched, v_content_sha256, nullif(v_asking, ''),
    nullif(v_band ->> 'phase', '')::smallint,
    nullif(v_band ->> 'band', ''),
    nullif(v_band ->> 'hz', '')::numeric,
    nullif(v_band ->> 'r', '')::numeric,
    nullif(v_band ->> 'source', ''),
    nullif(v_band ->> 'schema', ''),
    v_meaning_id, v_meaning_trace, v_hosts, v_attribution, v_archived_from
  )
  on conflict (anchor_id) do nothing
  returning id into v_id;
  if v_id is null then
    select id into v_id from kb.anchors where anchor_id = v_anchor_id;
    return v_out || jsonb_build_object('dry_run', false, 'written', false, 'rule', 'ATHENA-ALREADY', 'id', v_id);
  end if;
  return v_out || jsonb_build_object('dry_run', false, 'written', true, 'rule', 'ATHENA-WRITTEN', 'id', v_id);
end $$;

revoke all on function app.athena_anchor_insert(jsonb, boolean) from public, anon, authenticated;
grant execute on function app.athena_anchor_insert(jsonb, boolean) to service_role;

create or replace function public.athena_anchor_insert(p_row jsonb, p_commit boolean default false)
returns jsonb
language sql
security definer
set search_path = ''
as $$ select app.athena_anchor_insert(p_row, p_commit) $$;

revoke all on function public.athena_anchor_insert(jsonb, boolean) from public, anon, authenticated;
grant execute on function public.athena_anchor_insert(jsonb, boolean) to service_role;

commit;

-- 4.9.224 ROLLBACK:
-- begin;
-- drop function if exists public.athena_anchor_insert(jsonb, boolean);
-- drop function if exists app.athena_anchor_insert(jsonb, boolean);
-- drop view public.kb_anchors;
-- create view public.kb_anchors with (security_invoker = true) as
--   select anchor_id as id, text, state, trust, packet, concepts, provenance, contributor, license, source_url, revision,
--          band_phase, band_name, band_hz, band_r, band_source, band_schema
--   from kb.anchors a;
-- grant select on public.kb_anchors to anon, authenticated;
-- grant all on public.kb_anchors to postgres, service_role;
-- alter table kb.anchors
--   drop column if exists meaning_id,
--   drop column if exists meaning_trace,
--   drop column if exists independent_hosts,
--   drop column if exists attribution,
--   drop column if exists archived_from;
-- commit;
