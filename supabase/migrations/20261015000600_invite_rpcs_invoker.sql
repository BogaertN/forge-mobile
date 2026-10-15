-- 0006: advisor 0029 fix. Privileged invite logic lives in the non-exposed `app` schema (SECURITY DEFINER);
-- the exposed public RPCs are SECURITY INVOKER wrappers. Owner/contributor checks still happen inside.
alter function public.issue_invite(text, int) set schema app;
alter function public.redeem_invite(text)     set schema app;
alter function public.revoke_invite(uuid)     set schema app;
revoke all on function app.issue_invite(text, int), app.redeem_invite(text), app.revoke_invite(uuid) from public, anon;
grant execute on function app.issue_invite(text, int), app.redeem_invite(text), app.revoke_invite(uuid) to authenticated;

create function public.issue_invite(p_note text default null, p_days int default 14) returns text
  language sql security invoker set search_path = '' as $$ select app.issue_invite(p_note, p_days) $$;
create function public.redeem_invite(p_code text) returns boolean
  language sql security invoker set search_path = '' as $$ select app.redeem_invite(p_code) $$;
create function public.revoke_invite(p_id uuid) returns boolean
  language sql security invoker set search_path = '' as $$ select app.revoke_invite(p_id) $$;
revoke all on function public.issue_invite(text, int), public.redeem_invite(text), public.revoke_invite(uuid) from public, anon;
grant execute on function public.issue_invite(text, int), public.redeem_invite(text), public.revoke_invite(uuid) to authenticated;
