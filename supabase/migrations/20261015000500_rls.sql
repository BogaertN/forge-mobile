-- 0005: grants + Row Level Security on every table. Anon key is public (GitHub Pages): only RLS + grants protect data.
revoke all on all tables in schema kb, private from anon, authenticated;
revoke all on public.app_roles, public.device_keys, public.invites from anon, authenticated;

alter table public.app_roles   enable row level security;
alter table public.device_keys enable row level security;
alter table public.invites     enable row level security;
alter table private.blobs        enable row level security;
alter table private.sync_cursors enable row level security;
do $$ declare t text; begin
  foreach t in array array['receipts','contributions','facts','rules','lexicon_concepts','relations','hypotheses',
                           'corroborations','conflicts','attributions','snapshots','snapshot_revocations']
  loop execute format('alter table kb.%I enable row level security; alter table kb.%I force row level security', t, t); end loop;
end $$;

-- roles: a user sees own roles; owner sees all. No client writes (owner bootstrap = SQL; contributor = redeem_invite).
grant select on public.app_roles to authenticated;
create policy app_roles_read on public.app_roles for select to authenticated
  using (user_id = (select auth.uid()) or (select app.has_role('owner')));

-- device public keys: world-readable for signature verification; registration via Edge Function (service role) only.
grant select on public.device_keys to anon, authenticated;
create policy device_keys_read on public.device_keys for select to anon, authenticated using (true);

-- invites: owner only reads; issue/redeem/revoke via security-definer RPCs.
grant select on public.invites to authenticated;
create policy invites_owner_read on public.invites for select to authenticated using ((select app.has_role('owner')));

-- private: owner-only; insert new versions (no update/delete: append-only + tombstones)
grant select, insert on private.blobs to authenticated;
create policy blobs_select on private.blobs for select to authenticated using (owner = (select auth.uid()));
create policy blobs_insert on private.blobs for insert to authenticated with check (owner = (select auth.uid()));
grant select, insert, update on private.sync_cursors to authenticated;
create policy cursors_select on private.sync_cursors for select to authenticated using (owner = (select auth.uid()));
create policy cursors_insert on private.sync_cursors for insert to authenticated with check (owner = (select auth.uid()));
create policy cursors_update on private.sync_cursors for update to authenticated
  using (owner = (select auth.uid())) with check (owner = (select auth.uid()));

-- shared kb: public read, zero client write policies
grant select on kb.receipts, kb.facts, kb.rules, kb.lexicon_concepts, kb.relations, kb.hypotheses,
                kb.corroborations, kb.conflicts, kb.attributions, kb.snapshots, kb.snapshot_revocations to anon, authenticated;
create policy receipts_read  on kb.receipts             for select to anon, authenticated using (true);
create policy facts_read     on kb.facts                for select to anon, authenticated using (true);
create policy rules_read     on kb.rules                for select to anon, authenticated using (true);
create policy lexicon_read   on kb.lexicon_concepts     for select to anon, authenticated using (true);
create policy relations_read on kb.relations            for select to anon, authenticated using (true);
create policy hyp_read       on kb.hypotheses           for select to anon, authenticated using (true);
create policy corr_read      on kb.corroborations       for select to anon, authenticated using (true);
create policy conf_read      on kb.conflicts            for select to anon, authenticated using (true);
create policy attr_read      on kb.attributions         for select to anon, authenticated using (true);
create policy snap_read      on kb.snapshots            for select to anon, authenticated using (true);
create policy snaprev_read   on kb.snapshot_revocations for select to anon, authenticated using (true);

-- contributions: invited (contributor role) users insert only their own quarantined row under their own live device key.
grant select on kb.contributions to authenticated;
grant insert (signer_id, kind, payload, proof, sources, content_sha256, signature, consent, gks_sha256)
  on kb.contributions to authenticated;               -- column-level: state/screen_result/decision_receipt/contributor_id not insertable
create policy contrib_insert on kb.contributions for insert to authenticated
  with check (
    contributor_id = (select auth.uid())
    and state = 'quarantined'
    and (select app.has_role('contributor'))
    and exists (select 1 from public.device_keys d
                where d.signer_id = kb.contributions.signer_id
                  and d.owner = (select auth.uid()) and d.revoked_at is null));
create policy contrib_read on kb.contributions for select to authenticated
  using (contributor_id = (select auth.uid()) or (select app.has_role('owner')));
