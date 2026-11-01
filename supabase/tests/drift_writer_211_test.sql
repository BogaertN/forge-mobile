-- 4.9.211 drift writer acceptance test. Run as postgres. Every write is rolled back by the final RAISE,
-- which prints DRIFT_WRITER_RESULTS {...}; every value must be true.
do $$
declare
  r jsonb := '{}'::jsonb; v_owner uuid; v_signer text; v_now bigint := extract(epoch from now())::bigint;
  v_body jsonb; v_res jsonb; v_sig text := repeat('A', 86) || '==';
  v_sha text := repeat('cd', 32); v_n int := 0;
  v_payload jsonb := '{"text":"DRIFT WRITER TEST ROW (rolled back) Tokyo is the capital of Japan.","sfe":{"Phi":1,"eps":0.11,"mu":1},"provenance":{"test":"211"},"contributor":"test","state":"admitted"}';
  v_ok jsonb := '{"drift_input":{"hist":[5,6,7,8],"prev":8,"act":9,"depth":1,"scheme":"phase-scheme/rmc/v1"},"drift":{"eps":0.119133,"metric_id":"eps_s/rsoc-v4.8+circ/v1"},"echo":1,"echo_classes":{"ok":true,"classes":{"negation":{"answer":false,"source":false,"ok":true},"certainty":{"answer":false,"source":false,"ok":true},"condition":{"answer":false,"source":false,"ok":true}}},"coherence":0.89,"drift_status":"stable"}';
  ok boolean; v_case record;
begin
  select user_id into v_owner from public.app_roles where role = 'owner';
  select signer_id into v_signer from public.device_keys where owner = v_owner and revoked_at is null limit 1;
  r := r || jsonb_build_object('has_owner_device', v_signer is not null);
  r := r || jsonb_build_object('policy_hard_min', (app.drift_policy() ->> 'HARD_MIN')::numeric = 0.80 and (app.drift_policy() ->> 'METRIC_ID') = 'eps_s/rsoc-v4.8+circ/v1');
  r := r || jsonb_build_object('eps_5678_9', (app.drift_eps(array[5,6,7,8], 8, 9, 1) ->> 'eps')::numeric = 0.119133);
  r := r || jsonb_build_object('forbidden_depth10_still_d1', (app.drift_eps(array[5], 5, 8, 10) ->> 'd_score')::int = 1 and (app.drift_eps(array[5], 5, 8, 10) ->> 'eps')::numeric < 0.35);
  r := r || jsonb_build_object('chain_ok', app.receipts_chain_ok());
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true); perform set_config('role', 'service_role', true);
  for v_case in select * from (values
      ('missing_input', v_ok - 'drift_input', 'KB-WRITER-DRIFT-INPUT-REQUIRED'),
      ('eps_mismatch', jsonb_set(v_ok, '{drift,eps}', '0.1'), 'KB-WRITER-EPS-MISMATCH'),
      ('forbidden_58', jsonb_set(jsonb_set(jsonb_set(jsonb_set(v_ok, '{drift_input,hist}', '[5]'), '{drift_input,prev}', '5'), '{drift_input,act}', '8'), '{drift,eps}', (app.drift_eps(array[5], 5, 8, 1) -> 'eps')), 'KB-WRITER-FORBIDDEN'),
      ('backward', jsonb_set(jsonb_set(jsonb_set(v_ok, '{drift_input,hist}', '[5,6,7,8,6]'), '{drift_input,prev}', '6'), '{drift,eps}', (app.drift_eps(array[5,6,7,8,6], 6, 9, 1) -> 'eps')), 'KB-WRITER-FORBIDDEN'),
      ('unnamed', jsonb_set(jsonb_set(v_ok, '{drift_input,hist}', '[5,6,8]'), '{drift,eps}', (app.drift_eps(array[5,6,8], 8, 9, 1) -> 'eps')), 'KB-WRITER-UNNAMED'),
      ('drift_over', jsonb_set(jsonb_set(jsonb_set(v_ok, '{drift_input,hist}', '[5,6,7,8]'), '{drift_input,act}', '3'), '{drift,eps}', (app.drift_eps(array[5,6,7,8], 8, 3, 1) -> 'eps')), 'KB-WRITER-DRIFT'),
      ('echo_low', jsonb_set(v_ok, '{echo}', '0.9'), 'KB-WRITER-ECHO'),
      ('echo_class_lie', jsonb_set(v_ok, '{echo_classes,classes,negation,answer}', 'true'), 'KB-WRITER-ECHO'),
      ('coherence_low', jsonb_set(v_ok, '{coherence}', '0.8'), 'KB-WRITER-COHERENCE')
    ) t(name, proof, want) loop
    v_n := v_n + 1;
    v_body := jsonb_build_object('purpose', 'forge-memory-writer/v1', 'uid', v_owner, 'signer', v_signer, 'nonce', lpad(to_hex(v_n), 32, 'e'), 'content_sha256', v_sha, 'ts', v_now);
    begin perform public.memory_writer_insert_signed(v_owner, v_signer, lpad(to_hex(v_n), 32, 'e'), v_now, v_body, 'fact', v_payload, v_case.proof, '[]', v_sha, v_sig, '{}', '{"q":1}', 't'); ok := false;
    exception when insufficient_privilege then ok := (sqlerrm like '%' || v_case.want || '%'); if not ok then r := r || jsonb_build_object(v_case.name || '_got', sqlerrm); end if; end;
    r := r || jsonb_build_object(v_case.name, ok);
  end loop;
  v_body := jsonb_build_object('purpose', 'forge-memory-writer/v1', 'uid', v_owner, 'signer', v_signer, 'nonce', repeat('f', 32), 'content_sha256', v_sha, 'ts', v_now);
  v_res := public.memory_writer_insert_signed(v_owner, v_signer, repeat('f', 32), v_now, v_body, 'fact', v_payload, v_ok, '[]', v_sha, v_sig, '{}', '{"q":1}', 't');
  r := r || jsonb_build_object('clean_write_ok', (v_res ->> 'inserted') = 'true' and (v_res -> 'payload' -> 'drift' ->> 'eps_server')::numeric = 0.119133
    and (v_res -> 'payload' -> 'drift' ->> 'coherence_drift')::numeric = 0.880867 and (v_res -> 'payload' -> 'sfe' ->> 'eps')::numeric = 0.11);
  perform set_config('role', 'postgres', true);
  raise exception 'DRIFT_WRITER_RESULTS %', r;
end $$;
