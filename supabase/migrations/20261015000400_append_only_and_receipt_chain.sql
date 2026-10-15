-- 0004: immutability + receipt hash chain + contribution rate limit.
create or replace function app.forbid_mutation() returns trigger language plpgsql set search_path = '' as
$$ begin raise exception 'APPEND-ONLY: % on %.% is not allowed', tg_op, tg_table_schema, tg_table_name using errcode = '42501'; end $$;

do $$ declare t text; begin
  foreach t in array array['facts','rules','lexicon_concepts','relations','receipts','attributions','corroborations','snapshots','snapshot_revocations']
  loop execute format('create trigger %I_append_only before update or delete on kb.%I for each row execute function app.forbid_mutation()', t, t); end loop;
end $$;
create trigger blobs_append_only before update or delete on private.blobs for each row execute function app.forbid_mutation();

-- receipts: hash = sha256(prev_hash || canonical row); serialized by advisory lock
create or replace function app.receipt_chain() returns trigger language plpgsql set search_path = '' as $$
declare v_prev text;
begin
  perform pg_advisory_xact_lock(hashtext('kb.receipts.chain'));
  select hash into v_prev from kb.receipts order by seq desc limit 1;
  new.prev_hash := v_prev;
  new.hash := encode(extensions.digest(coalesce(v_prev,'') || '|' || jsonb_build_object(
      'id', new.id, 'action', new.action, 'subject', new.subject, 'gks_sha256', new.gks_sha256,
      'verifier_sha256', new.verifier_sha256, 'gates', new.gates, 'cause_receipt', new.cause_receipt,
      'created_at', new.created_at)::text, 'sha256'), 'hex');
  return new;
end $$;
create trigger receipts_chain before insert on kb.receipts for each row execute function app.receipt_chain();

-- contributions: client rows must start quarantined with no server fields; rate limit 50/day
create or replace function app.contribution_guard() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if current_user in ('anon','authenticated') then
    if new.state <> 'quarantined' or new.screen_result is not null or new.decision_receipt is not null then
      raise exception 'KB-CLIENT-CANNOT-SET-STATE' using errcode = '42501'; end if;
    if (select count(*) from kb.contributions c where c.contributor_id = new.contributor_id and c.created_at > now() - interval '1 day') >= 50 then
      raise exception 'KB-RATE-LIMIT' using errcode = '54000'; end if;
  end if;
  return new;
end $$;
create trigger contributions_guard before insert on kb.contributions for each row execute function app.contribution_guard();
