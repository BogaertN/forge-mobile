-- 4.9.78 (audit 2026-10-21, item 8): the shared knowledge base stays OFF. Contributors may no longer insert into kb.contributions.
-- APPLIED 2026-10-21 09:40 CDT to forge-mobile (hqcvywujrygbnaowgwln) with Nic's approval (Supabase migration "revoke_contrib_insert").
-- Verified: an authenticated insert into kb.contributions fails with 42501 permission denied; contrib_insert policy gone; all kb tables 0 rows.
-- It removes the column-level insert grant made in 20261015000500_rls.sql and drops the contrib_insert row policy; select / read
-- policies are unchanged, so existing rows (there are none: kb tables were 0 rows on 2026-10-21) stay readable to their owners.
begin;
revoke insert on kb.contributions from authenticated;
drop policy if exists contrib_insert on kb.contributions;
commit;
