-- 4.9.206: anchors are read from Supabase (Nic decision (b), 2026-10-31).
-- 1. kb.anchors already holds all 3,101 anchors_188 rows (seed_kb_anchors + seed_kb_anchors_190, applied 2026-10-30).
--    Ids, texts, concepts, provenance, URLs, revisions and licenses match source/data/anchors_188 exactly.
--    Eight 4.9.190 rows still carry the 4.9.190 packet; 4.9.191 re-placed their phase by lexicon resonance
--    (hand-set phase removed). This brings those eight packets to the repo values. Nothing is deleted.
-- 2. kb is not an exposed API schema, so anon/authenticated read anchors through a security-invoker view in
--    public (RLS on kb.anchors still applies: read-only, anchors_read). No client can write through it.
-- 3. kb_anchors_digest() lets the phone check whether its IndexedDB copy is current without a full download.
-- The drift bands are not changed.

begin;

update kb.anchors set packet = '{"schema": "FORGE-RESONANCE-PACKET/v1", "Phi": 5, "eps": 0.0, "mu": 1.0, "sfe": {"Phi": 5, "eps": 0.0, "mu": 1.0}, "placed_by": "athena", "standing": "anchor", "phi_basis": "lexicon_resonance on the anchor concept; hand-set phase removed", "glyph": "◌̸", "concept": "A.HAMLET", "authority": "weak_letter_signal", "seed": ["H:Φ7", "A:Φ1", "M:Φ5", "L:Φ6", "E:Φ5", "T:Φ4"], "eps_status": "unspecified", "mu_status": "unspecified"}'::jsonb where anchor_id = 'enc-gutenberg-hamlet';
update kb.anchors set packet = '{"schema": "FORGE-RESONANCE-PACKET/v1", "Phi": 6, "eps": 0.0, "mu": 1.0, "sfe": {"Phi": 6, "eps": 0.0, "mu": 1.0}, "placed_by": "athena", "standing": "anchor", "phi_basis": "lexicon_resonance on the anchor concept; hand-set phase removed", "glyph": "()", "concept": "A.LARGEST", "authority": "weak_letter_signal", "seed": ["L:Φ6", "A:Φ1", "R:Φ2", "G:Φ6", "E:Φ5", "S:Φ3", "T:Φ4"], "eps_status": "unspecified", "mu_status": "unspecified"}'::jsonb where anchor_id = 'enc-nasa-jupiter';
update kb.anchors set packet = '{"schema": "FORGE-RESONANCE-PACKET/v1", "Phi": 6, "eps": 0.0, "mu": 1.0, "sfe": {"Phi": 6, "eps": 0.0, "mu": 1.0}, "placed_by": "athena", "standing": "anchor", "phi_basis": "lexicon_resonance on the anchor concept; hand-set phase removed", "glyph": "()", "concept": "A.LARGEST", "authority": "weak_letter_signal", "seed": ["L:Φ6", "A:Φ1", "R:Φ2", "G:Φ6", "E:Φ5", "S:Φ3", "T:Φ4"], "eps_status": "unspecified", "mu_status": "unspecified"}'::jsonb where anchor_id = 'enc-nasa-jupiter-oldest';
update kb.anchors set packet = '{"schema": "FORGE-RESONANCE-PACKET/v1", "Phi": 4, "eps": 0.0, "mu": 1.0, "sfe": {"Phi": 4, "eps": 0.0, "mu": 1.0}, "placed_by": "athena", "standing": "anchor", "phi_basis": "lexicon_resonance on the anchor concept; hand-set phase removed", "glyph": "◊", "concept": "A.SKY", "authority": "weak_letter_signal", "seed": ["S:Φ3", "K:Φ4", "Y:Φ5"], "eps_status": "unspecified", "mu_status": "unspecified"}'::jsonb where anchor_id = 'enc-nasa-sky-blue';
update kb.anchors set packet = '{"schema": "FORGE-RESONANCE-PACKET/v1", "Phi": 4, "eps": 0.0, "mu": 1.0, "sfe": {"Phi": 4, "eps": 0.0, "mu": 1.0}, "placed_by": "athena", "standing": "anchor", "phi_basis": "lexicon_resonance on the anchor concept; hand-set phase removed", "glyph": "◊", "concept": "A.SKY", "authority": "weak_letter_signal", "seed": ["S:Φ3", "K:Φ4", "Y:Φ5"], "eps_status": "unspecified", "mu_status": "unspecified"}'::jsonb where anchor_id = 'enc-nasa-sky-eyes';
update kb.anchors set packet = '{"schema": "FORGE-RESONANCE-PACKET/v1", "Phi": 1, "eps": 0.0, "mu": 1.0, "sfe": {"Phi": 1, "eps": 0.0, "mu": 1.0}, "placed_by": "athena", "standing": "anchor", "phi_basis": "lexicon_resonance on the anchor concept; hand-set phase removed", "glyph": "⊙", "concept": "A.OCEAN", "authority": "weak_letter_signal", "seed": ["O:Φ9", "C:Φ3", "E:Φ5", "A:Φ1", "N:Φ7"], "eps_status": "unspecified", "mu_status": "unspecified"}'::jsonb where anchor_id = 'enc-noaa-ocean-salty';
update kb.anchors set packet = '{"schema": "FORGE-RESONANCE-PACKET/v1", "Phi": 1, "eps": 0.0, "mu": 1.0, "sfe": {"Phi": 1, "eps": 0.0, "mu": 1.0}, "placed_by": "athena", "standing": "anchor", "phi_basis": "lexicon_resonance on the anchor concept; hand-set phase removed", "glyph": "⊙", "concept": "A.OCEAN", "authority": "weak_letter_signal", "seed": ["O:Φ9", "C:Φ3", "E:Φ5", "A:Φ1", "N:Φ7"], "eps_status": "unspecified", "mu_status": "unspecified"}'::jsonb where anchor_id = 'enc-noaa-ocean-sources';
update kb.anchors set packet = '{"schema": "FORGE-RESONANCE-PACKET/v1", "Phi": 5, "eps": 0.0, "mu": 1.0, "sfe": {"Phi": 5, "eps": 0.0, "mu": 1.0}, "placed_by": "athena", "standing": "anchor", "phi_basis": "lexicon_resonance on the anchor concept; hand-set phase removed", "glyph": "◌̸", "concept": "A.LEAVES", "authority": "weak_letter_signal", "seed": ["L:Φ6", "E:Φ5", "A:Φ1", "V:Φ7", "E:Φ5", "S:Φ3"], "eps_status": "unspecified", "mu_status": "unspecified"}'::jsonb where anchor_id = 'enc-nps-leaves';

create or replace view public.kb_anchors with (security_invoker = true) as
  select a.anchor_id as id, a.text, a.state, a.trust, a.packet, a.concepts, a.provenance, a.contributor,
         a.license, a.source_url, a.revision
    from kb.anchors a;
revoke all on public.kb_anchors from public, anon, authenticated;
grant select on public.kb_anchors to anon, authenticated;
comment on view public.kb_anchors is 'Read-only trusted anchors (kb.anchors) for the phone''s offline IndexedDB cache. 4.9.206.';

create or replace function public.kb_anchors_digest() returns jsonb
  language sql stable security invoker set search_path = '' as
$$ select jsonb_build_object('count', count(*),
     'digest', md5(coalesce(string_agg(a.anchor_id || '|' || md5(a.text) || '|' || md5(a.packet::text), E'\n' order by a.anchor_id collate "C"), '')))
   from kb.anchors a $$;
revoke all on function public.kb_anchors_digest() from public;
grant execute on function public.kb_anchors_digest() to anon, authenticated;

commit;
