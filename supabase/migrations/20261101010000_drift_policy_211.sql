-- 4.9.211 DRIFT-SPEC/v1 (resolved), Nic plan Release B: the server-side drift law for a lasting write.
-- app.drift_policy() mirrors kmath.js DRIFT_POLICY and mobile_config.DRIFT_POLICY (verify/r4211 checks the parity).
-- app.drift_eps() recomputes the write-trace epsilon from p_proof.drift_input = {hist, prev, act, depth, scheme}:
--   circular sigma = sqrt(2(1 - Rbar)) / 2pi over theta = 2pi(phi - 1)/9; D = 1 iff (prev, act) in S = {(5,8), (4,8)};
--   dphi = |act - (prev % 9 + 1)| / 9; eps = (sigma + D + dphi) / greatest(1, depth). Not clipped.
-- memory_writer_insert_signed now refuses: KB-WRITER-CHAIN-BREAK (receipt hash chain broken: halt), -DRIFT-INPUT-REQUIRED,
-- -EPS-MISMATCH (|server - claimed| > 1e-6), -FORBIDDEN (S or a backward committed step), -HARD-STOP (>= 0.80, inclusive),
-- -DRIFT (> 0.35), -UNNAMED (no Φ6 then Φ7 before Φ8/Φ9), -ECHO (< 0.97, or a categorical class fails, or the answer-side
-- class flags disagree with the stored text), -COHERENCE (C < 0.87). The stored payload carries drift.eps_server,
-- coherence_drift = 1 - eps, metric_id, phase_scheme_id and drift_status. The candidate epsilon (sfe.eps, the engine's
-- measurement) cannot be recomputed in SQL; it stays bounded at <= 0.35. Signature, link, nonce and freshness are unchanged.
-- Auth settings (sign-up) are not changed here. No rows are deleted.

begin;

create or replace function app.drift_policy() returns jsonb language sql immutable set search_path = '' as $$
  select '{"schema":"FORGE-DRIFT-POLICY/v1","profile":"nic-2026-10-14/v2","METRIC_ID":"eps_s/rsoc-v4.8+circ/v1","DENOMINATOR":"max1_depth",
    "PHASE_SCHEME_ID":"phase-scheme/rmc/v1","ADMIT_MAX":0.35,"EXPLORE_MIN":0.40,"HARD_MIN":0.80,"HARD_INCLUSIVE":true,"THETA_W_BASE":0.40,
    "GAMMA":0.5,"ECHO_MIN":0.85,"ECHO_MEMORY_MIN":0.97,"C_MIN":0.87,"LAMBDA_DRIFT":0.18,"CHI_CORRECT_PASSES":1,"CHI_GRACE_PER_LOOP":1,
    "CHRISTPING_SETTLE_MS":3330,"BREAKER_FAILS":3,"BREAKER_RECOVER_S":60,"RESURRECTION_LIMIT":5,"TREND_K":3,"ACCEL_NV":3,"ACCEL_TAU_MS":18.7,
    "FORBIDDEN":{"rmc":[[5,8],[4,8]],"backward":true}}'::jsonb
$$;

create or replace function app.phase_backward(p_from int, p_to int) returns boolean language sql immutable set search_path = '' as $$
  select p_to <> p_from and p_to <> (p_from % 9) + 1 and ((p_from - p_to + 9) % 9) < ((p_to - p_from + 9) % 9)
$$;

create or replace function app.drift_eps(p_hist int[], p_prev int, p_act int, p_depth int) returns jsonb
  language plpgsql immutable set search_path = '' as $$
declare v_c double precision := 0; v_s double precision := 0; v_n int := coalesce(cardinality(p_hist), 0); v_r double precision;
  v_sigma double precision := 0; v_d int; v_dphi double precision; v_eps double precision; p int;
begin
  if p_prev is null or p_act is null or p_prev not between 1 and 9 or p_act not between 1 and 9 then
    raise exception 'DRIFT-EPS-BAD-INPUT' using errcode = '22023';
  end if;
  if v_n >= 2 then
    foreach p in array p_hist loop
      v_c := v_c + cos(2 * pi() * (p - 1) / 9.0); v_s := v_s + sin(2 * pi() * (p - 1) / 9.0);
    end loop;
    v_r := least(1.0, sqrt(v_c * v_c + v_s * v_s) / v_n);
    v_sigma := sqrt(greatest(0.0, 2 * (1 - v_r))) / (2 * pi());
  end if;
  v_d := case when (p_prev, p_act) in ((5, 8), (4, 8)) then 1 else 0 end;
  v_dphi := abs(p_act - ((p_prev % 9) + 1)) / 9.0;
  v_eps := (v_sigma + v_d + v_dphi) / greatest(1, coalesce(p_depth, 1));
  return jsonb_build_object('eps', round(v_eps::numeric, 6), 'sigma_res', round(v_sigma::numeric, 6), 'd_score', v_d,
    'dphi', round(v_dphi::numeric, 6), 'rho', greatest(1, coalesce(p_depth, 1)), 'metric_id', 'eps_s/rsoc-v4.8+circ/v1',
    'phase_scheme_id', 'phase-scheme/rmc/v1', 'clipped', false);
end $$;

-- the categorical Echo classes on the answer side (mirror of kmath.ECHO_CLASS_RX / drift_policy.ECHO_CLASS_RX)
create or replace function app.echo_class(p_text text, p_class text) returns boolean language sql immutable set search_path = '' as $$
  select case p_class
    when 'negation' then coalesce(p_text, '') ~* '\y(not|no|never|none|nobody|nothing|neither|nor|cannot|without)\y|n''t\y'
    when 'certainty' then coalesce(p_text, '') ~* '\y(may|might|could|possibly|perhaps|probably|likely|unlikely|uncertain|approximately|roughly|reportedly|allegedly)\y'
    when 'condition' then coalesce(p_text, '') ~* '\y(if|unless|provided|whenever|otherwise)\y'
    else null end
$$;

-- the receipt hash chain (0004): every row's prev_hash is the previous row's hash and its hash recomputes
create or replace function app.receipts_chain_ok() returns boolean language sql stable security definer set search_path = '' as $$
  select not exists (
    select 1 from (
      select r.*, lag(r.hash) over (order by r.seq) as want_prev from kb.receipts r
    ) x
    where x.prev_hash is distinct from x.want_prev
       or x.hash is distinct from encode(extensions.digest(coalesce(x.want_prev, '') || '|' || jsonb_build_object(
            'id', x.id, 'action', x.action, 'subject', x.subject, 'gks_sha256', x.gks_sha256,
            'verifier_sha256', x.verifier_sha256, 'gates', x.gates, 'cause_receipt', x.cause_receipt,
            'created_at', x.created_at)::text, 'sha256'), 'hex'))
$$;

revoke all on function app.drift_policy() from public;
revoke all on function app.phase_backward(int, int) from public;
revoke all on function app.drift_eps(int[], int, int, int) from public;
revoke all on function app.echo_class(text, text) from public;
revoke all on function app.receipts_chain_ok() from public, anon, authenticated;
grant execute on function app.drift_policy() to anon, authenticated, service_role;
grant execute on function app.phase_backward(int, int) to anon, authenticated, service_role;
grant execute on function app.drift_eps(int[], int, int, int) to anon, authenticated, service_role;
grant execute on function app.echo_class(text, text) to anon, authenticated, service_role;
grant execute on function app.receipts_chain_ok() to service_role;

-- read-only public wrappers so the phone (and r4211) can check the server mirror
create or replace function public.drift_policy() returns jsonb language sql stable security invoker set search_path = '' as $$ select app.drift_policy() $$;
create or replace function public.drift_eps(p_hist int[], p_prev int, p_act int, p_depth int) returns jsonb
  language sql stable security invoker set search_path = '' as $$ select app.drift_eps(p_hist, p_prev, p_act, p_depth) $$;
revoke all on function public.drift_policy() from public;
revoke all on function public.drift_eps(int[], int, int, int) from public;
grant execute on function public.drift_policy() to anon, authenticated, service_role;
grant execute on function public.drift_eps(int[], int, int, int) to anon, authenticated, service_role;

-- the signed insert, now with the drift law (same signature; the public wrapper from 4.9.205 is unchanged)
create or replace function app.memory_writer_insert_signed(
  p_uid uuid, p_signer_id text, p_nonce text, p_ts bigint, p_signed_body jsonb,
  p_kind text, p_payload jsonb, p_proof jsonb, p_sources jsonb, p_content_sha256 text,
  p_signature text, p_consent jsonb, p_provenance jsonb, p_contributor text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_phi int; v_eps numeric; v_mu numeric; v_id uuid; v_payload jsonb; v_row jsonb;
  v_di jsonb; v_hist int[]; v_prev int; v_act int; v_depth int; v_path int[]; v_m jsonb; v_seps numeric; v_claim numeric;
  v_i6 int; v_i7 int; v_out int; v_echo numeric; v_coh numeric; v_cls jsonb; v_text text; k text; i int;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'KB-WRITER-SIGNED-PATH-REQUIRED' using errcode = '42501';
  end if;
  if not app.can_write(p_uid) then
    raise exception 'KB-WRITER-NOT-LINKED' using errcode = '42501';
  end if;
  if p_signer_id is null or not exists (select 1 from public.device_keys d
      where d.signer_id = p_signer_id and d.owner = p_uid and d.revoked_at is null) then
    raise exception 'KB-WRITER-DEVICE-UNKNOWN' using errcode = '42501';
  end if;
  if p_signature is null or p_signature !~ '^[A-Za-z0-9+/]{86}==$' then
    raise exception 'KB-WRITER-SIGNATURE' using errcode = '42501';
  end if;
  if p_ts is null or abs(extract(epoch from now()) - p_ts) > 300 then
    raise exception 'KB-WRITER-STALE-PROOF' using errcode = '42501';
  end if;
  if p_signed_body is null
     or p_signed_body ->> 'purpose' is distinct from 'forge-memory-writer/v1'
     or p_signed_body ->> 'uid' is distinct from p_uid::text
     or p_signed_body ->> 'signer' is distinct from p_signer_id
     or p_signed_body ->> 'nonce' is distinct from p_nonce
     or p_signed_body ->> 'content_sha256' is distinct from p_content_sha256
     or (p_signed_body ->> 'ts')::bigint is distinct from p_ts then
    raise exception 'KB-WRITER-PROOF-BODY' using errcode = '42501';
  end if;
  begin
    insert into app.writer_nonces (signer_id, nonce) values (p_signer_id, p_nonce);
  exception when unique_violation or check_violation then
    raise exception 'KB-WRITER-REPLAY' using errcode = '42501';
  end;
  if p_kind is distinct from 'fact' or p_payload is null or jsonb_typeof(p_payload) <> 'object'
     or (p_payload ? 'state' and (p_payload ->> 'state') is distinct from 'admitted') then
    raise exception 'KB-WRITER-UNADMITTED' using errcode = '42501';
  end if;
  if jsonb_typeof(p_payload -> 'sfe') is distinct from 'object'
     or not ((p_payload -> 'sfe') ? 'Phi' and (p_payload -> 'sfe') ? 'eps' and (p_payload -> 'sfe') ? 'mu') then
    raise exception 'KB-WRITER-PACKET-REQUIRED' using errcode = '42501';
  end if;
  begin
    v_phi := (p_payload -> 'sfe' ->> 'Phi')::int;
    v_eps := (p_payload -> 'sfe' ->> 'eps')::numeric;
    v_mu := (p_payload -> 'sfe' ->> 'mu')::numeric;
  exception when others then
    raise exception 'KB-WRITER-PACKET-REQUIRED' using errcode = '42501';
  end;
  -- the candidate epsilon (engine measurement, client-claimed) stays bounded: eps <= 0.35
  if v_phi < 1 or v_phi > 9 or v_eps < 0 or v_eps > 0.35 or v_mu <= 0 or v_mu > 1 then
    raise exception 'KB-WRITER-PACKET-REQUIRED' using errcode = '42501';
  end if;
  if p_provenance is null or jsonb_typeof(p_provenance) <> 'object' or p_provenance = '{}'::jsonb then
    raise exception 'KB-WRITER-PROVENANCE-REQUIRED' using errcode = '42501';
  end if;
  if p_contributor is null or length(btrim(p_contributor)) = 0 or length(p_contributor) > 80 then
    raise exception 'KB-WRITER-PROVENANCE-REQUIRED' using errcode = '42501';
  end if;
  if p_content_sha256 is null or p_content_sha256 !~ '^[0-9a-f]{64}$' then
    raise exception 'KB-WRITER-HASH' using errcode = '42501';
  end if;
  if p_consent is null or jsonb_typeof(p_consent) <> 'object' then
    raise exception 'KB-WRITER-CONSENT' using errcode = '42501';
  end if;

  -- 4.9.211 DRIFT-SPEC/v1: the server recomputes the write-trace epsilon; it no longer trusts a self-reported number alone.
  if not app.receipts_chain_ok() then
    raise exception 'KB-WRITER-CHAIN-BREAK' using errcode = '42501';   -- a hash-chain break halts every admitted write
  end if;
  v_di := p_proof -> 'drift_input';
  if v_di is null or jsonb_typeof(v_di) <> 'object' or jsonb_typeof(v_di -> 'hist') is distinct from 'array'
     or (v_di ->> 'scheme') is distinct from 'phase-scheme/rmc/v1'
     or coalesce(v_di ->> 'prev', '') !~ '^[1-9]$' or coalesce(v_di ->> 'act', '') !~ '^[1-9]$' or coalesce(v_di ->> 'depth', '') !~ '^[1-9]$'
     or jsonb_array_length(v_di -> 'hist') > 32
     or exists (select 1 from jsonb_array_elements(v_di -> 'hist') x where jsonb_typeof(x) <> 'number' or x::text !~ '^[1-9]$') then
    raise exception 'KB-WRITER-DRIFT-INPUT-REQUIRED' using errcode = '42501';
  end if;
  v_hist := array(select x::int from jsonb_array_elements_text(v_di -> 'hist') with ordinality t(x, n) order by n);
  v_prev := (v_di ->> 'prev')::int; v_act := (v_di ->> 'act')::int; v_depth := (v_di ->> 'depth')::int;
  if cardinality(v_hist) > 0 and v_hist[cardinality(v_hist)] <> v_prev then
    raise exception 'KB-WRITER-DRIFT-INPUT-REQUIRED' using errcode = '42501';
  end if;
  v_m := app.drift_eps(v_hist, v_prev, v_act, v_depth);
  v_seps := (v_m ->> 'eps')::numeric;
  begin v_claim := (p_proof -> 'drift' ->> 'eps')::numeric; exception when others then v_claim := null; end;
  if v_claim is null or abs(v_seps - v_claim) > 0.000001 then
    raise exception 'KB-WRITER-EPS-MISMATCH' using errcode = '42501';
  end if;
  v_path := v_hist || v_act;
  for i in 2 .. cardinality(v_path) loop
    if v_path[i] <> v_path[i - 1] and ((v_path[i - 1], v_path[i]) in ((5, 8), (4, 8)) or app.phase_backward(v_path[i - 1], v_path[i])) then
      raise exception 'KB-WRITER-FORBIDDEN' using errcode = '42501';
    end if;
  end loop;
  if v_seps >= 0.80 then
    raise exception 'KB-WRITER-HARD-STOP' using errcode = '42501';
  end if;
  if v_seps > 0.35 then
    raise exception 'KB-WRITER-DRIFT' using errcode = '42501';
  end if;
  v_i6 := array_position(v_path, 6); v_i7 := array_position(v_path, 7);
  v_out := (select min(n) from unnest(v_path) with ordinality u(p, n) where p in (8, 9));
  if v_i6 is null or v_i7 is null or v_i7 <= v_i6 or v_out is null or v_out <= v_i7 then
    raise exception 'KB-WRITER-UNNAMED' using errcode = '42501';
  end if;
  begin v_echo := (p_proof ->> 'echo')::numeric; exception when others then v_echo := null; end;
  v_cls := p_proof -> 'echo_classes' -> 'classes';
  v_text := coalesce(p_payload ->> 'text', '');
  if v_echo is null or v_echo < 0.97 or (p_proof -> 'echo_classes' ->> 'ok') is distinct from 'true' or jsonb_typeof(v_cls) is distinct from 'object' then
    raise exception 'KB-WRITER-ECHO' using errcode = '42501';
  end if;
  foreach k in array array['negation', 'certainty', 'condition'] loop
    if (v_cls -> k ->> 'ok') is distinct from 'true'
       or (v_cls -> k ->> 'answer') is distinct from (app.echo_class(v_text, k))::text then
      raise exception 'KB-WRITER-ECHO' using errcode = '42501';
    end if;
  end loop;
  begin v_coh := (p_proof ->> 'coherence')::numeric; exception when others then v_coh := null; end;
  if v_coh is null or v_coh < 0.87 then
    raise exception 'KB-WRITER-COHERENCE' using errcode = '42501';
  end if;

  v_payload := p_payload || jsonb_build_object(
    'state', 'admitted',
    'sfe', jsonb_build_object('Phi', v_phi, 'eps', v_eps, 'mu', v_mu),
    'provenance', p_provenance,
    'contributor', btrim(p_contributor),
    'schema', coalesce(p_payload ->> 'schema', 'FORGE-RESONANCE-PACKET/v1'),
    'drift', jsonb_build_object('eps_server', v_seps, 'coherence_drift', greatest(0, least(1, 1 - v_seps)),
      'metric_id', 'eps_s/rsoc-v4.8+circ/v1', 'phase_scheme_id', 'phase-scheme/rmc/v1',
      'drift_status', coalesce(p_proof ->> 'drift_status', 'stable'), 'candidate_eps', v_eps, 'policy', 'nic-2026-10-14/v2'));

  perform set_config('app.memory_writer', 'on', true);
  begin
    insert into kb.contributions (contributor_id, signer_id, kind, payload, proof, sources,
      content_sha256, signature, consent, state)
    values (p_uid, p_signer_id, 'fact', v_payload,
      coalesce(p_proof, '{}'::jsonb) || jsonb_build_object('device_proof', p_signed_body, 'verified_by', 'edge:memory-writer ECDSA P-256'),
      coalesce(p_sources, '[]'::jsonb), p_content_sha256, p_signature, p_consent, 'admitted')
    returning id into v_id;
  exception when unique_violation then
    select jsonb_build_object('id', c.id, 'state', c.state, 'kind', c.kind, 'contributor_id', c.contributor_id,
      'signer_id', c.signer_id, 'payload', c.payload, 'inserted', false, 'verified', (c.state = 'admitted'))
      into v_row from kb.contributions c where c.kind = 'fact' and c.content_sha256 = p_content_sha256;
    if v_row is null or (v_row ->> 'state') is distinct from 'admitted' then
      raise exception 'KB-WRITER-DUPLICATE' using errcode = '42501';
    end if;
    return v_row;
  end;

  select jsonb_build_object('id', c.id, 'state', c.state, 'kind', c.kind, 'contributor_id', c.contributor_id,
    'signer_id', c.signer_id, 'payload', c.payload, 'inserted', true, 'verified', (c.state = 'admitted'))
    into v_row from kb.contributions c where c.id = v_id and c.contributor_id = p_uid;
  if v_row is null or (v_row ->> 'verified') is distinct from 'true' then
    raise exception 'KB-WRITER-READBACK-FAILED' using errcode = '42501';
  end if;
  return v_row;
end $$;
revoke all on function app.memory_writer_insert_signed(uuid, text, text, bigint, jsonb, text, jsonb, jsonb, jsonb, text, text, jsonb, jsonb, text) from public, anon, authenticated;
grant execute on function app.memory_writer_insert_signed(uuid, text, text, bigint, jsonb, text, jsonb, jsonb, jsonb, text, text, jsonb, jsonb, text) to service_role;

commit;
