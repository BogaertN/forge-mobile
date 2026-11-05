-- 4.9.227 APPLIED: Athena maintenance path (Nic 2026-11-04, t142u). "Fix the pipeline not the answer."
-- An Athena row written under an older pipeline (4.9.226 keyed definitions from letter-pattern concepts in the source
-- sentence, e.g. Moon -> A.EARTH) is superseded or retired through this path, never by silent SQL:
--   * app.athena_anchor_supersede: the replacement row must be re-admitted by Athena's own run (same gates; it is
--     validated by app.athena_anchor_insert before anything changes). The old row is snapshotted in
--     kb.anchor_maintenance with the reason and release, then replaced; the new row's provenance names what it superseded.
--   * app.athena_anchor_retire: when a subject no longer admits, the old row is snapshotted and removed; nothing is written.
-- Only Athena-contributed rows (self-seed:% / athena:%) can be touched. service_role only. p_commit=false is a dry run.

begin;

create table if not exists kb.anchor_maintenance (
  id uuid primary key default gen_random_uuid(),
  at timestamptz not null default now(),
  action text not null check (action in ('supersede', 'retire')),
  anchor_id text not null,
  release text not null,
  reason text not null check (char_length(reason) between 8 and 2000),
  old_row jsonb not null,
  new_row jsonb,
  new_id uuid,
  calls_llm boolean not null default false
);
alter table kb.anchor_maintenance enable row level security;
revoke all on kb.anchor_maintenance from public, anon, authenticated;
grant all on kb.anchor_maintenance to postgres, service_role;
comment on table kb.anchor_maintenance is '4.9.227: audit of Athena rows superseded or retired through app.athena_anchor_supersede / app.athena_anchor_retire';

create or replace function app.athena_anchor_supersede(p_anchor_id text, p_row jsonb, p_reason text, p_release text, p_commit boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old kb.anchors%rowtype;
  v_check jsonb;
  v_res jsonb;
  v_mid uuid;
  v_row jsonb;
begin
  if auth.role() is distinct from 'service_role' and current_user is distinct from 'postgres' then
    raise exception 'ATHENA-SERVICE-ROLE-ONLY' using errcode = '42501';
  end if;
  if char_length(btrim(coalesce(p_reason, ''))) < 8 then
    raise exception 'ATHENA-MAINT-REASON' using errcode = '22023';
  end if;
  if btrim(coalesce(p_release, '')) = '' then
    raise exception 'ATHENA-MAINT-RELEASE' using errcode = '22023';
  end if;
  select * into v_old from kb.anchors where anchor_id = btrim(coalesce(p_anchor_id, ''));
  if not found then
    raise exception 'ATHENA-MAINT-NO-ROW' using errcode = '22023';
  end if;
  if v_old.contributor not like 'self-seed:%' and v_old.contributor not like 'athena:%' then
    raise exception 'ATHENA-MAINT-NOT-ATHENA' using errcode = '42501';
  end if;
  -- the replacement passes the same gates as any Athena write (raises if it does not)
  v_check := app.athena_anchor_insert(p_row, false);
  v_row := p_row || jsonb_build_object('provenance', coalesce(p_row -> 'provenance', '{}'::jsonb) || jsonb_build_object(
             'supersedes', jsonb_build_object('anchor_id', v_old.anchor_id, 'concepts', v_old.concepts, 'reason', p_reason, 'release', p_release)));
  if not coalesce(p_commit, false) then
    return jsonb_build_object('ok', true, 'dry_run', true, 'rule', 'ATHENA-MAINT-DRY-RUN', 'action', 'supersede',
      'anchor_id', v_old.anchor_id, 'old_concepts', v_old.concepts, 'new_concepts', p_row -> 'concepts', 'check', v_check);
  end if;
  insert into kb.anchor_maintenance (action, anchor_id, release, reason, old_row, new_row)
    values ('supersede', v_old.anchor_id, p_release, p_reason, to_jsonb(v_old), v_row)
    returning id into v_mid;
  delete from kb.anchors where id = v_old.id;
  v_row := jsonb_set(v_row, '{provenance,supersedes,maintenance_id}', to_jsonb(v_mid::text), true);
  v_res := app.athena_anchor_insert(v_row, true);
  if coalesce((v_res ->> 'written')::boolean, false) is not true then
    raise exception 'ATHENA-MAINT-WRITE-FAILED %', v_res::text using errcode = '22023';
  end if;
  update kb.anchor_maintenance set new_id = (v_res ->> 'id')::uuid where id = v_mid;
  return jsonb_build_object('ok', true, 'dry_run', false, 'rule', 'ATHENA-SUPERSEDED', 'action', 'supersede', 'maintenance_id', v_mid,
    'anchor_id', v_old.anchor_id, 'old_concepts', v_old.concepts, 'new_concepts', p_row -> 'concepts', 'insert', v_res);
end $$;

create or replace function app.athena_anchor_retire(p_anchor_id text, p_reason text, p_release text, p_commit boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old kb.anchors%rowtype;
  v_mid uuid;
begin
  if auth.role() is distinct from 'service_role' and current_user is distinct from 'postgres' then
    raise exception 'ATHENA-SERVICE-ROLE-ONLY' using errcode = '42501';
  end if;
  if char_length(btrim(coalesce(p_reason, ''))) < 8 then
    raise exception 'ATHENA-MAINT-REASON' using errcode = '22023';
  end if;
  if btrim(coalesce(p_release, '')) = '' then
    raise exception 'ATHENA-MAINT-RELEASE' using errcode = '22023';
  end if;
  select * into v_old from kb.anchors where anchor_id = btrim(coalesce(p_anchor_id, ''));
  if not found then
    raise exception 'ATHENA-MAINT-NO-ROW' using errcode = '22023';
  end if;
  if v_old.contributor not like 'self-seed:%' and v_old.contributor not like 'athena:%' then
    raise exception 'ATHENA-MAINT-NOT-ATHENA' using errcode = '42501';
  end if;
  if not coalesce(p_commit, false) then
    return jsonb_build_object('ok', true, 'dry_run', true, 'rule', 'ATHENA-MAINT-DRY-RUN', 'action', 'retire', 'anchor_id', v_old.anchor_id);
  end if;
  insert into kb.anchor_maintenance (action, anchor_id, release, reason, old_row)
    values ('retire', v_old.anchor_id, p_release, p_reason, to_jsonb(v_old)) returning id into v_mid;
  delete from kb.anchors where id = v_old.id;
  return jsonb_build_object('ok', true, 'dry_run', false, 'rule', 'ATHENA-RETIRED', 'action', 'retire', 'maintenance_id', v_mid, 'anchor_id', v_old.anchor_id);
end $$;

revoke all on function app.athena_anchor_supersede(text, jsonb, text, text, boolean) from public, anon, authenticated;
revoke all on function app.athena_anchor_retire(text, text, text, boolean) from public, anon, authenticated;
grant execute on function app.athena_anchor_supersede(text, jsonb, text, text, boolean) to service_role;
grant execute on function app.athena_anchor_retire(text, text, text, boolean) to service_role;

create or replace function public.athena_anchor_supersede(p_anchor_id text, p_row jsonb, p_reason text, p_release text, p_commit boolean default false)
returns jsonb language sql security definer set search_path = ''
as $$ select app.athena_anchor_supersede(p_anchor_id, p_row, p_reason, p_release, p_commit) $$;
create or replace function public.athena_anchor_retire(p_anchor_id text, p_reason text, p_release text, p_commit boolean default false)
returns jsonb language sql security definer set search_path = ''
as $$ select app.athena_anchor_retire(p_anchor_id, p_reason, p_release, p_commit) $$;
revoke all on function public.athena_anchor_supersede(text, jsonb, text, text, boolean) from public, anon, authenticated;
revoke all on function public.athena_anchor_retire(text, text, text, boolean) from public, anon, authenticated;
grant execute on function public.athena_anchor_supersede(text, jsonb, text, text, boolean) to service_role;
grant execute on function public.athena_anchor_retire(text, text, text, boolean) to service_role;

commit;

-- 4.9.227 ROLLBACK (functions only; kb.anchor_maintenance is the audit and is kept):
-- begin;
-- drop function if exists public.athena_anchor_supersede(text, jsonb, text, text, boolean);
-- drop function if exists public.athena_anchor_retire(text, text, text, boolean);
-- drop function if exists app.athena_anchor_supersede(text, jsonb, text, text, boolean);
-- drop function if exists app.athena_anchor_retire(text, text, text, boolean);
-- commit;
