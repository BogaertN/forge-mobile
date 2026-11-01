-- 4.9.205 writer lockdown acceptance test. Run as postgres. Every write is rolled back by the final RAISE,
-- which prints WRITER_LOCKDOWN_RESULTS {...}; every value must be true.
do $$
declare
  r jsonb := '{}'::jsonb; v_owner uuid; v_signer text; v_stranger uuid := gen_random_uuid(); v_now bigint := extract(epoch from now())::bigint;
  v_body jsonb; v_res jsonb; v_sig text := repeat('A', 86) || '==';
  v_sha text := repeat('ab', 32); v_nonce text := repeat('c', 32);
  v_payload jsonb := '{"text":"WRITER LOCKDOWN TEST ROW (rolled back)","sfe":{"Phi":1,"eps":0.1,"mu":1},"provenance":{"test":"205"},"contributor":"test","state":"admitted"}';
  -- 4.9.211: a lasting write also carries the drift proof (supabase/tests/drift_writer_211_test.sql tests its refusals)
  v_proof jsonb := '{"drift_input":{"hist":[5,6,7,8],"prev":8,"act":9,"depth":1,"scheme":"phase-scheme/rmc/v1"},"drift":{"eps":0.119133,"metric_id":"eps_s/rsoc-v4.8+circ/v1"},"echo":1,"echo_classes":{"ok":true,"classes":{"negation":{"answer":false,"source":false,"ok":true},"certainty":{"answer":false,"source":false,"ok":true},"condition":{"answer":false,"source":false,"ok":true}}},"coherence":0.89}';
  ok boolean;
begin
  select user_id into v_owner from public.app_roles where role = 'owner';
  select signer_id into v_signer from public.device_keys where owner = v_owner and revoked_at is null limit 1;
  r := r || jsonb_build_object('owner_is_linked_writer', app.can_write(v_owner));
  r := r || jsonb_build_object('stranger_cannot_write', not app.can_write(v_stranger));

  -- anon
  perform set_config('request.jwt.claims', '{"role":"anon"}', true); perform set_config('role', 'anon', true);
  begin perform public.memory_writer_insert('fact', v_payload, '{}', '[]', v_sha, v_sig, '{}', '{"q":1}', 't'); ok := false;
  exception when insufficient_privilege then ok := true; end; r := r || jsonb_build_object('anon_old_rpc_denied', ok);
  begin perform public.memory_writer_insert_signed(v_owner, v_signer, v_nonce, v_now, '{}', 'fact', v_payload, '{}', '[]', v_sha, v_sig, '{}', '{"q":1}', 't'); ok := false;
  exception when insufficient_privilege then ok := true; end; r := r || jsonb_build_object('anon_signed_rpc_denied', ok);
  begin insert into kb.contributions (contributor_id, kind, payload, sources, content_sha256, signature, consent, state) values (v_owner, 'fact', v_payload, '[]', v_sha, v_sig, '{}', 'admitted'); ok := false;
  exception when insufficient_privilege then ok := true; end; r := r || jsonb_build_object('anon_table_insert_denied', ok);
  perform set_config('role', 'postgres', true);

  -- authenticated, not linked
  perform set_config('request.jwt.claims', json_build_object('sub', v_stranger, 'role', 'authenticated')::text, true); perform set_config('role', 'authenticated', true);
  begin perform public.memory_writer_insert('fact', v_payload, '{}', '[]', v_sha, v_sig, '{}', '{"q":1}', 't'); ok := false;
  exception when insufficient_privilege then ok := true; end; r := r || jsonb_build_object('stranger_old_rpc_denied', ok);
  begin perform public.memory_writer_insert_signed(v_stranger, v_signer, v_nonce, v_now, '{}', 'fact', v_payload, '{}', '[]', v_sha, v_sig, '{}', '{"q":1}', 't'); ok := false;
  exception when insufficient_privilege then ok := true; end; r := r || jsonb_build_object('stranger_signed_rpc_denied', ok);
  begin insert into kb.contributions (contributor_id, kind, payload, sources, content_sha256, signature, consent, state) values (v_stranger, 'fact', v_payload, '[]', v_sha, v_sig, '{}', 'admitted'); ok := false;
  exception when insufficient_privilege then ok := true; end; r := r || jsonb_build_object('stranger_table_insert_denied', ok);
  begin insert into private.blobs (owner, store, record_id, version, device_id, base_hmac, content_hmac, deleted) values (v_stranger, 's', 'r', 1, 'd', 'b', 'c', true); ok := false;
  exception when insufficient_privilege or others then ok := (sqlstate = '42501'); end; r := r || jsonb_build_object('stranger_blob_insert_denied', ok);
  begin perform public.link_writer(v_stranger, 'self'); ok := false;
  exception when insufficient_privilege then ok := (sqlerrm like '%LINK-OWNER-ONLY%'); end; r := r || jsonb_build_object('stranger_cannot_link_self', ok);
  begin insert into public.app_roles (user_id, role) values (v_stranger, 'writer'); ok := false;
  exception when insufficient_privilege then ok := true; end; r := r || jsonb_build_object('stranger_cannot_grant_writer', ok);
  perform set_config('role', 'postgres', true);

  -- even the service role / postgres cannot give the writer role or a device key to an unlinked account
  begin insert into public.app_roles (user_id, role) values (v_stranger, 'writer'); ok := false;
  exception when insufficient_privilege then ok := (sqlerrm like '%WRITER-ROLE-NEEDS-LINK%'); end; r := r || jsonb_build_object('writer_role_needs_link', ok);
  begin insert into public.device_keys (signer_id, owner, pub_jwk) values ('sig-0000000000000000', v_stranger, '{"kty":"EC","x":"a"}'); ok := false;
  exception when insufficient_privilege then ok := (sqlerrm like '%DEVICE-OWNER-NOT-LINKED%'); end; r := r || jsonb_build_object('device_key_needs_link', ok);

  -- service role (the Edge Function after it verified the ECDSA signature)
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true); perform set_config('role', 'service_role', true);
  v_body := jsonb_build_object('purpose', 'forge-memory-writer/v1', 'uid', v_stranger, 'signer', v_signer, 'nonce', v_nonce, 'content_sha256', v_sha, 'ts', v_now);
  begin perform public.memory_writer_insert_signed(v_stranger, v_signer, v_nonce, v_now, v_body, 'fact', v_payload, '{}', '[]', v_sha, v_sig, '{}', '{"q":1}', 't'); ok := false;
  exception when insufficient_privilege then ok := (sqlerrm like '%KB-WRITER-NOT-LINKED%'); end; r := r || jsonb_build_object('service_unlinked_refused', ok);
  v_body := jsonb_build_object('purpose', 'forge-memory-writer/v1', 'uid', v_owner, 'signer', v_signer, 'nonce', v_nonce, 'content_sha256', v_sha, 'ts', v_now - 1000);
  begin perform public.memory_writer_insert_signed(v_owner, v_signer, v_nonce, v_now - 1000, v_body, 'fact', v_payload, '{}', '[]', v_sha, v_sig, '{}', '{"q":1}', 't'); ok := false;
  exception when insufficient_privilege then ok := (sqlerrm like '%KB-WRITER-STALE-PROOF%'); end; r := r || jsonb_build_object('stale_proof_refused', ok);
  begin perform public.memory_writer_insert_signed(v_owner, v_signer, v_nonce, v_now, v_body, 'fact', v_payload, '{}', '[]', v_sha, 'short', '{}', '{"q":1}', 't'); ok := false;
  exception when insufficient_privilege then ok := (sqlerrm like '%KB-WRITER-SIGNATURE%'); end; r := r || jsonb_build_object('bad_signature_shape_refused', ok);
  v_body := jsonb_build_object('purpose', 'forge-memory-writer/v1', 'uid', v_owner, 'signer', v_signer, 'nonce', v_nonce, 'content_sha256', v_sha, 'ts', v_now);
  begin perform public.memory_writer_insert_signed(v_owner, v_signer, v_nonce, v_now, v_body, 'fact', jsonb_set(v_payload, '{sfe,eps}', '0.36'), '{}', '[]', v_sha, v_sig, '{}', '{"q":1}', 't'); ok := false;
  exception when insufficient_privilege then ok := (sqlerrm like '%KB-WRITER-PACKET-REQUIRED%'); end; r := r || jsonb_build_object('eps_over_035_refused', ok);
  -- (the nonce above was consumed inside a rolled-back sub-block, so it is still fresh here)
  v_res := public.memory_writer_insert_signed(v_owner, v_signer, v_nonce, v_now, v_body, 'fact', v_payload, v_proof, '[]', v_sha, v_sig, '{}', '{"q":1}', 't');
  r := r || jsonb_build_object('linked_signed_insert_ok', (v_res ->> 'inserted') = 'true' and (v_res ->> 'state') = 'admitted' and (v_res ->> 'signer_id') = v_signer);
  begin perform public.memory_writer_insert_signed(v_owner, v_signer, v_nonce, v_now, v_body, 'fact', v_payload, v_proof, '[]', v_sha, v_sig, '{}', '{"q":1}', 't'); ok := false;
  exception when insufficient_privilege then ok := (sqlerrm like '%KB-WRITER-REPLAY%'); end; r := r || jsonb_build_object('replay_refused', ok);
  perform set_config('role', 'postgres', true);
  raise exception 'WRITER_LOCKDOWN_RESULTS %', r;
end $$;
