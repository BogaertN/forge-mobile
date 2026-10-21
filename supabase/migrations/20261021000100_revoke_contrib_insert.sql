-- 4.9.78 (audit 2026-10-21, item 8): the shared knowledge base stays OFF. Contributors may no longer insert into kb.contributions.
-- REPO FILE ONLY: this migration is NOT applied by the release pipeline or by any agent; Nic decides whether and when to apply it.
-- It removes the column-level insert grant made in 20261015000500_rls.sql and drops the contrib_insert row policy; select / read
-- policies are unchanged, so existing rows (there are none: kb tables were 0 rows on 2026-10-21) stay readable to their owners.
begin;
revoke insert on kb.contributions from authenticated;
drop policy if exists contrib_insert on kb.contributions;
commit;
