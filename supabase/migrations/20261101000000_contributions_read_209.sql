-- 4.9.209: curated kb.contributions are read back into Ask (Nic plan, Release A item 3, 2026-10-31).
-- kb.contributions keeps its RLS (contrib_read: the contributor or the owner). kb is not an exposed API schema.
-- Ask on any phone may read only the ADMITTED facts, through two read-only functions in public:
--   kb_contributions_admitted(limit, offset): id, text, sfe, provenance, contributor, content_sha256, created_at
--     of rows with state = 'admitted' and kind = 'fact'. No contributor_id, signer, signature, consent or proof.
--   kb_contributions_digest(): count + md5 digest, so the phone refetches only when the set changes.
-- Both are STABLE, SECURITY DEFINER with an empty search_path, and only SELECT. No write grant is added.
-- The write path is unchanged: only the memory-writer Edge Function (4.9.205) can insert, and only for a linked,
-- signed device. The drift bands are not changed.

begin;

create or replace function public.kb_contributions_admitted(p_limit int default 1000, p_offset int default 0)
  returns table (id uuid, text text, sfe jsonb, provenance jsonb, contributor text, content_sha256 text, created_at timestamptz)
  language sql stable security definer set search_path = '' as
$$ select c.id, c.payload ->> 'text', c.payload -> 'sfe', c.payload -> 'provenance', c.payload ->> 'contributor',
          c.content_sha256, c.created_at
     from kb.contributions c
    where c.state = 'admitted' and c.kind = 'fact'
    order by c.id
    limit least(greatest(coalesce(p_limit, 1000), 1), 1000) offset greatest(coalesce(p_offset, 0), 0) $$;
revoke all on function public.kb_contributions_admitted(int, int) from public;
grant execute on function public.kb_contributions_admitted(int, int) to anon, authenticated;
comment on function public.kb_contributions_admitted(int, int) is 'Read-only: admitted kb.contributions facts for Ask (4.9.209). No identities, signatures or proofs.';

create or replace function public.kb_contributions_digest() returns jsonb
  language sql stable security definer set search_path = '' as
$$ select jsonb_build_object('count', count(*),
     'digest', md5(coalesce(string_agg(c.id::text || '|' || c.content_sha256, E'\n' order by c.id), '')))
   from kb.contributions c where c.state = 'admitted' and c.kind = 'fact' $$;
revoke all on function public.kb_contributions_digest() from public;
grant execute on function public.kb_contributions_digest() to anon, authenticated;

commit;
