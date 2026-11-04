-- 4.9.219 APPLIED: additive band columns on kb.anchors, exposed at the end of the public.kb_anchors view (DRIFT-SPEC/v1 D15).
alter table kb.anchors
  add column if not exists band_phase smallint,
  add column if not exists band_name text,
  add column if not exists band_hz numeric(10,4),
  add column if not exists band_r numeric(10,6),
  add column if not exists band_source text,
  add column if not exists band_schema text;
comment on column kb.anchors.band_hz is 'symbolic Hz (FBSC), not measured; 4.9.219 band_tuning';
create or replace view public.kb_anchors with (security_invoker = true) as
  select anchor_id as id, text, state, trust, packet, concepts, provenance, contributor, license, source_url, revision,
         band_phase, band_name, band_hz, band_r, band_source, band_schema
  from kb.anchors a;

-- 4.9.219 ROLLBACK: restore the original view, then drop the band columns.
-- drop view public.kb_anchors;
-- create view public.kb_anchors with (security_invoker = true) as
--   select anchor_id as id, text, state, trust, packet, concepts, provenance, contributor, license, source_url, revision
--   from kb.anchors a;
-- grant select on public.kb_anchors to anon, authenticated;
-- grant all on public.kb_anchors to postgres, service_role;
-- alter table kb.anchors drop column if exists band_phase, drop column if exists band_name, drop column if exists band_hz,
--   drop column if exists band_r, drop column if exists band_source, drop column if exists band_schema;
