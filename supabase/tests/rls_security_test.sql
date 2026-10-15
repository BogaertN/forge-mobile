-- RLS/security acceptance tests (S1). Runs as postgres; everything is rolled back by the final RAISE.
do $test$
declare
  r jsonb := '[]'::jsonb; ok boolean; n int;
  u_inv uuid := gen_random_uuid(); u_non uuid := gen_random_uuid(); u_other uuid := gen_random_uuid();
  rcpt uuid; cid uuid;
begin
  -- fixtures (as postgres)
  insert into auth.users (id, aud, role, email) values
    (u_inv,'authenticated','authenticated','inv@test.local'),(u_non,'authenticated','authenticated','non@test.local'),(u_other,'authenticated','authenticated','oth@test.local');
  insert into public.app_roles (user_id, role) values (u_inv,'contributor');
  insert into public.device_keys (signer_id, owner, pub_jwk) values
    ('sig-aaaaaaaaaaaaaaaa', u_inv, '{"kty":"EC","crv":"P-256","x":"a","y":"b"}'),
    ('sig-bbbbbbbbbbbbbbbb', u_non, '{"kty":"EC","crv":"P-256","x":"c","y":"d"}'),
    ('sig-cccccccccccccccc', u_other, '{"kty":"EC","crv":"P-256","x":"e","y":"f"}');
  insert into kb.receipts (action, subject) values ('admit','{"t":"fixture"}') returning id into rcpt;
  insert into kb.facts (item_id, version, subject, predicate, object, content_sha256, receipt_id)
    values ('f1',1,'water','boils_at','{"v":100,"u":"C"}', repeat('a',64), rcpt);
  insert into private.blobs (owner, store, record_id, version, device_id, content_hmac, ciphertext)
    values (u_other,'memory','m1',1,'d', repeat('b',64), '\x00');

  -- ===== anon =====
  execute 'set local role anon';
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  select count(*) into n from kb.facts; r := r || jsonb_build_object('T01 anon reads kb.facts', n = 1);
  select count(*) into n from kb.snapshots; r := r || jsonb_build_object('T02 anon reads kb.snapshots', true);
  begin insert into kb.facts (item_id,version,subject,predicate,object,content_sha256,receipt_id) values ('x',1,'a','b','{}',repeat('a',64),rcpt);
        ok := false; exception when others then ok := true; end; r := r || jsonb_build_object('T03 anon cannot insert kb.facts', ok);
  begin insert into kb.contributions (signer_id,kind,payload,content_sha256,signature,consent) values ('sig-aaaaaaaaaaaaaaaa','fact','{}',repeat('c',64),'s','{}');
        ok := false; exception when others then ok := true; end; r := r || jsonb_build_object('T04 anon cannot insert contributions', ok);
  begin insert into kb.receipts (action,subject) values ('admit','{}'); ok := false; exception when others then ok := true; end;
  r := r || jsonb_build_object('T05 anon cannot insert receipts', ok);
  begin select count(*) into n from private.blobs; ok := false; exception when others then ok := true; end;
  r := r || jsonb_build_object('T06 anon cannot read private.blobs', ok);
  begin insert into public.device_keys (signer_id,owner,pub_jwk) values ('sig-dddddddddddddddd',u_non,'{"kty":"EC","x":"1"}'); ok := false; exception when others then ok := true; end;
  r := r || jsonb_build_object('T07 anon cannot register device keys', ok);
  begin perform public.issue_invite(null,14); ok := false; exception when others then ok := true; end;
  r := r || jsonb_build_object('T08 anon cannot issue invites', ok);
  execute 'reset role';

  -- ===== signed-in, invited user =====
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub',u_inv,'role','authenticated')::text, true);
  -- private.blobs own read/write; cannot see or write others
  insert into private.blobs (store, record_id, version, device_id, content_hmac, ciphertext) values ('memory','m9',1,'d1',repeat('d',64),'\x01');
  select count(*) into n from private.blobs; r := r || jsonb_build_object('T09 user sees only own blobs', n = 1);
  begin insert into private.blobs (owner, store, record_id, version, device_id, content_hmac, ciphertext) values (u_other,'memory','m2',1,'d',repeat('d',64),'\x01');
        ok := false; exception when others then ok := true; end; r := r || jsonb_build_object('T10 user cannot write another user''s blob', ok);
  begin update private.blobs set version = 2 where record_id = 'm9'; ok := false; exception when others then ok := true; end;
  r := r || jsonb_build_object('T11 blobs are append-only (update blocked)', ok);
  -- forbidden stores
  ok := true;
  declare s text; begin
    foreach s in array array['vault','signing_key','node_pairing','pairing','permissions'] loop
      begin insert into private.blobs (store, record_id, version, device_id, content_hmac, ciphertext) values (s,'x',1,'d',repeat('e',64),'\x01'); ok := false;
      exception when check_violation then null; end;
    end loop; end;
  r := r || jsonb_build_object('T12 forbidden stores rejected (vault,signing_key,node_pairing,pairing,permissions)', ok);
  -- contributions
  insert into kb.contributions (signer_id,kind,payload,content_sha256,signature,consent)
    values ('sig-aaaaaaaaaaaaaaaa','fact','{"s":"x"}',repeat('1',64),'sig','{"tap":true}') returning id into cid;
  select state = 'quarantined' into ok from kb.contributions where id = cid;
  r := r || jsonb_build_object('T13 invited user inserts quarantined contribution with own key', ok);
  begin insert into kb.contributions (signer_id,kind,payload,content_sha256,signature,consent,state) values ('sig-aaaaaaaaaaaaaaaa','fact','{}',repeat('2',64),'s','{}','admitted');
        ok := false; exception when others then ok := true; end; r := r || jsonb_build_object('T14 cannot insert with state=admitted', ok);
  begin insert into kb.contributions (signer_id,kind,payload,content_sha256,signature,consent) values ('sig-cccccccccccccccc','fact','{}',repeat('3',64),'s','{}');
        ok := false; exception when others then ok := true; end; r := r || jsonb_build_object('T15 cannot contribute under another user''s device key', ok);
  begin insert into kb.contributions (contributor_id,signer_id,kind,payload,content_sha256,signature,consent) values (u_other,'sig-aaaaaaaaaaaaaaaa','fact','{}',repeat('4',64),'s','{}');
        ok := false; exception when others then ok := true; end; r := r || jsonb_build_object('T16 cannot set contributor_id to someone else', ok);
  begin update kb.contributions set state = 'admitted' where id = cid; exception when others then null; end;
  select state = 'quarantined' into ok from kb.contributions where id = cid;
  r := r || jsonb_build_object('T17 cannot UPDATE own contribution to admitted', ok);
  begin insert into kb.facts (item_id,version,subject,predicate,object,content_sha256,receipt_id) values ('y',1,'a','b','{}',repeat('a',64),rcpt);
        ok := false; exception when others then ok := true; end; r := r || jsonb_build_object('T18 user cannot write kb.facts', ok);
  begin insert into kb.rules (item_id,version,body,falsifiers,domain,content_sha256,receipt_id) values ('r',1,'{}','[1]','d',repeat('a',64),rcpt);
        ok := false; exception when others then ok := true; end; r := r || jsonb_build_object('T19 user cannot write kb.rules', ok);
  begin insert into kb.receipts (action,subject) values ('admit','{}'); ok := false; exception when others then ok := true; end;
  r := r || jsonb_build_object('T20 user cannot write receipts', ok);
  begin insert into kb.snapshots (sha256,seq,storage_path,sections,counts,receipts_head,publisher_kid,signature,receipt_id) values (repeat('a',64),1,'p','{}','{}','h','k','s',rcpt);
        ok := false; exception when others then ok := true; end; r := r || jsonb_build_object('T21 user cannot write snapshots', ok);
  begin insert into public.app_roles (user_id, role) values (u_inv,'owner'); ok := false; exception when others then ok := true; end;
  r := r || jsonb_build_object('T22 user cannot self-grant owner', ok);
  begin perform public.issue_invite(null,14); ok := false; exception when others then ok := true; end;
  r := r || jsonb_build_object('T23 non-owner cannot issue invite', ok);
  begin update kb.facts set subject = 'hacked'; exception when others then null; end; select subject = 'water' into ok from kb.facts where item_id = 'f1';
  r := r || jsonb_build_object('T24 user UPDATE on kb.facts has no effect', ok);
  execute 'reset role';

  -- ===== signed-in, NOT invited =====
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub',u_non,'role','authenticated')::text, true);
  begin insert into kb.contributions (signer_id,kind,payload,content_sha256,signature,consent) values ('sig-bbbbbbbbbbbbbbbb','fact','{}',repeat('5',64),'s','{}');
        ok := false; exception when others then ok := true; end; r := r || jsonb_build_object('T25 non-invited user cannot insert contribution', ok);
  select count(*) into n from kb.contributions; r := r || jsonb_build_object('T26 user cannot read others'' contributions', n = 0);
  select count(*) into n from private.blobs; r := r || jsonb_build_object('T27 non-invited sees no foreign blobs', n = 0);
  execute 'reset role';

  -- ===== invite flow: owner issues, user redeems =====
  insert into public.app_roles (user_id, role) values (u_other,'owner');
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub',u_other,'role','authenticated')::text, true);
  declare code text; begin
    code := public.issue_invite('t',7);
    execute 'reset role'; execute 'set local role authenticated';
    perform set_config('request.jwt.claims', json_build_object('sub',u_non,'role','authenticated')::text, true);
    perform public.redeem_invite(code);
    select app.has_role('contributor') into ok; r := r || jsonb_build_object('T28 owner-issued invite grants contributor on redeem', ok);
    begin perform public.redeem_invite(code); ok := false; exception when others then ok := true; end;
    r := r || jsonb_build_object('T29 invite cannot be redeemed twice', ok);
    insert into kb.contributions (signer_id,kind,payload,content_sha256,signature,consent) values ('sig-bbbbbbbbbbbbbbbb','fact','{}',repeat('6',64),'s','{}');
    r := r || jsonb_build_object('T30 redeemed user can now contribute', true);
  end;
  execute 'reset role';

  -- ===== service-level immutability (even postgres) =====
  begin update kb.facts set subject='x' where item_id='f1'; ok := false; exception when others then ok := true; end;
  r := r || jsonb_build_object('T31 UPDATE kb.facts blocked by trigger (privileged)', ok);
  begin delete from kb.facts where item_id='f1'; ok := false; exception when others then ok := true; end;
  r := r || jsonb_build_object('T32 DELETE kb.facts blocked by trigger', ok);
  begin delete from kb.receipts; ok := false; exception when others then ok := true; end;
  r := r || jsonb_build_object('T33 DELETE receipts blocked', ok);
  insert into kb.receipts (action, subject) values ('admit','{"t":2}');
  select (select prev_hash from kb.receipts order by seq desc limit 1) = (select hash from kb.receipts order by seq desc offset 1 limit 1) into ok;
  r := r || jsonb_build_object('T34 receipt hash chain links prev_hash', ok);

  raise exception 'TEST_RESULTS %', r;
end $test$;
