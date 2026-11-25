# Generator for Forge Harmonic Key v0.1 artifacts (key json/csv, example packet, example frames, numbers for the spec)
import json, math, csv, unicodedata, struct, os
import blake3, reedsolo
OUT = "/workspace/forge-harmonic-key"

def canon(obj):
    def norm(o):
        if isinstance(o, str): return unicodedata.normalize("NFC", o)
        if isinstance(o, dict): return {norm(k): norm(v) for k, v in o.items()}
        if isinstance(o, list): return [norm(x) for x in o]
        return o
    return json.dumps(norm(obj), sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
def b3(b): return blake3.blake3(b).hexdigest()

ROOT = 144.0
SLOTS = 9
SPACING = 40
CLAUSE_ROLES = [  # delta columns: kaaraka clause roles, 3 triads
 ("kriya","predicate / relation (the verb or relation of the clause)"),
 ("karta","agent / subject"),
 ("karma","object / patient"),
 ("karana","instrument / means"),
 ("sampradana","recipient / beneficiary"),
 ("apadana","source / point of departure ('from')"),
 ("adhikarana","locus: place, time, medium or context"),
 ("mana","measure: value with unit"),
 ("nibandhana","qualifier: condition, scope, negation, statistic (mean, max...)"),
]
BANDS = [
 dict(index=0,name="delta",range_hz=[1,4],divisor=64,kind="consolidated long-term fact (verified, stored)",column_scheme="clause_role",
      q_tune=6,kappa=12,half_life_s=365*86400,amp_floor=0.25,
      slots=CLAUSE_ROLES),
 dict(index=1,name="theta",range_hz=[4,8],divisor=32,kind="sequence / context / trace order",column_scheme="sequence_position",
      q_tune=3,kappa=6,half_life_s=30*86400,amp_floor=0.0,
      slots=[("seq_1","position 1 (Forge loop convention: held Ask)"),("seq_2","position 2 (Neo tick)"),("seq_3","position 3 (Athena lookup / simulate / derive)"),
             ("seq_4","position 4 (Gilligan check)"),("seq_5","position 5 (resumed answer)"),("seq_6","position 6"),("seq_7","position 7"),("seq_8","position 8"),("seq_9","position 9 (longer sequences continue in a new window, flag CONT)")]),
 dict(index=2,name="alpha",range_hz=[8,13],divisor=16,kind="gating / suppression of what is irrelevant now",column_scheme="gate_state",
      q_tune=8,kappa=16,half_life_s=3600,amp_floor=0.0,
      slots=[("pass","open gate: eligible for retrieval"),("suppress_irrelevant","inhibit: off-topic for the current task"),("suppress_contradicted","inhibit: contradicted, awaiting Athena re-check"),
             ("hold_pending","held Ask waiting for Neo/Athena"),("speculative","speculative bin: NEVER on the speaking path"),("ghost","failed / rejected attempt store (kept, never spoken)"),
             ("tier_cold","collapsed to cold tier (kept, not deleted)"),("tier_deep","collapsed to deep tier (kept, not deleted)"),("quarantine_peer","received peer claim not yet through Gilligan")]),
 dict(index=3,name="beta",range_hz=[13,30],divisor=8,kind="active task / rule hold (working state)",column_scheme="task_slot",
      q_tune=4,kappa=12,half_life_s=15*60,amp_floor=0.0,
      slots=[("current_question","the Ask being answered"),("active_rule","rule or law currently applied"),("active_gap","the gap Athena is filling"),
             ("constraint","constraint on the answer (units, range, scope)"),("expected_type","expected answer type (quantity, entity, yes/no...)"),("unit_frame","unit system in force"),
             ("peer_session","current Forge-to-Forge session"),("pending_followup","follow-up question queued"),("reserved_b8","reserved")]),
 dict(index=4,name="gamma",range_hz=[30,80],divisor=4,kind="binding: the parts of one item",column_scheme="binding_part",
      q_tune=4,kappa=10,half_life_s=7*86400,amp_floor=0.0,
      slots=[("head","head entity of the item"),("class","type / class"),("attribute","attribute name"),("value","value"),("unit","unit"),
             ("part_whole","part-of / has-part link"),("alias","name / alias / surface form"),("publisher","publisher lineage reference"),("evidence","evidence hash / timestamp")]),
 dict(index=5,name="ripple",range_hz=[80,144],divisor=1,kind="replay / consolidation (Athena re-check during Neo idle ticks)",column_scheme="replay_stage",
      q_tune=3,kappa=6,half_life_s=60,amp_floor=0.0,
      slots=[("replay_request","Neo schedules a replay"),("re_lookup","Athena re-looks-up sources"),("re_simulate","Athena re-runs a simulator"),("re_derive","Athena re-derives"),
             ("gilligan_recheck","Gilligan re-validates under the same fixed gates"),("reinforce","passed: amplitude reinforced"),("demote","failed: collapse one tier"),
             ("readmit","re-admission attempt (counted, cap 5)"),("fixed_point","fixed-point check: re-inference gives identical fact set")]),
]
RESERVED_ROWS = [dict(index=6,name="reserved_high_gamma",divisor=2,carrier_hz=72.0,note="72 Hz octave rung (high gamma). Reserved; decoders must reject records using it in key 0.1."),
                 dict(index=7,name="none",note="'no parent' marker in the parent-band field; never a record band.")]

key_bands = []
for b in BANDS:
    lo, hi = b["range_hz"]
    carrier = ROOT / b["divisor"]
    slots = []
    for s, (role, meaning) in enumerate(b["slots"]):
        slots.append(dict(slot=s, phase_deg=s*SPACING, triad=s//3, hfield_phase=s+1,
                          role_code=f"0x{b['index']*16+s:02X}", role=role, meaning=meaning))
    key_bands.append(dict(index=b["index"], name=b["name"], range_hz=b["range_hz"], carrier_hz=carrier,
        carrier_rule=f"144 / {b['divisor']}", geometric_center_hz=round(math.sqrt(lo*hi),3),
        q_band_descriptive=round(carrier/(hi-lo),3), q_tune=b["q_tune"], kappa=b["kappa"],
        half_life_s=b["half_life_s"], amp_floor=b["amp_floor"], memory_kind=b["kind"],
        column_scheme=b["column_scheme"], slots=slots))

structure = dict(key_id="forge.harmonic_key", key_major=0, root_hz=ROOT, phase_slots=SLOTS, slot_spacing_deg=SPACING,
    triads=[[0,1,2],[3,4,5],[6,7,8]], hfield_phase_rule="hfield_phase = slot + 1",
    bands=[dict(index=b["index"], name=b["name"], carrier_hz=b["carrier_hz"], column_scheme=b["column_scheme"],
                roles=[(s["role_code"], s["role"]) for s in b["slots"]]) for b in key_bands],
    reserved_rows=[dict(index=r["index"], name=r["name"]) for r in RESERVED_ROWS],
    address_layout="band:3|slot:4|amp_q:4|parent_band:3|parent_slot:4|flags:6 (24 bits, big-endian)",
    flags=["VERIFIED_REF","SPECULATIVE","CONTRADICTS","REQUEST","CONT","RESERVED"])
structure_hash = b3(canon(structure))
tuning = dict(match_lit=0.5, match_near_miss=0.05, pac_modulation_depth=0.9, alpha_inhibit_factor=0.1,
    reinforcement_eta=dict(gilligan_admit=0.5, answer_passed_gates=0.1, ripple_replay_passed=0.2, peer_reference_resolved=0.05),
    peer_reinforcement_cap_per_peer_per_day=0.05, contradiction_amp_multiplier=0.5, readmission_cap=5, amp_quant_levels=16,
    fact_id_prefix_bytes_acoustic=8, absent_atom_floor_eps=0.05)
key = dict(key_id="forge.harmonic_key", key_version="0.1.0", status="draft for Nic's review",
    root_hz=ROOT, phase_slots=SLOTS, slot_spacing_deg=SPACING, carrier_rule="carrier_hz = 144 / 2^k (octave ladder down from the 144 Hz root)",
    note="All frequencies here are LOGICAL coordinates used for addressing and tuning math. They are not played as sound and are not measured brain signals.",
    bands=key_bands, reserved_rows=RESERVED_ROWS, tuning=tuning, structure=structure,
    structure_hash_blake3=structure_hash, structure_fp=structure_hash[:8])
full_hash = b3(canon({k:v for k,v in key.items()}))
key["full_hash_blake3"] = full_hash
json.dump(key, open(f"{OUT}/forge_harmonic_key_v0.1.json","w"), indent=2, ensure_ascii=False)

with open(f"{OUT}/forge_harmonic_key_v0.1.csv","w",newline="") as f:
    w = csv.writer(f)
    w.writerow(["role_code","band_index","band","band_range_hz","carrier_hz","q_tune","kappa","half_life_s","amp_floor","memory_kind","slot","phase_deg","triad","hfield_phase","role","meaning"])
    for b in key_bands:
        for s in b["slots"]:
            w.writerow([s["role_code"],b["index"],b["name"],f"{b['range_hz'][0]}-{b['range_hz'][1]}",b["carrier_hz"],b["q_tune"],b["kappa"],b["half_life_s"],b["amp_floor"],b["memory_kind"],s["slot"],s["phase_deg"],s["triad"],s["hfield_phase"],s["role"],s["meaning"]])

# ---------- math helpers
def B(fq, fm, Q): r = fm/fq - fq/fm; return 1/(1+Q*Q*r*r)
def Phi(dphi_deg, kappa): return math.exp(kappa*(math.cos(math.radians(dphi_deg))-1))
def N(dphi_deg, m=0.9): return (1+m*math.cos(math.radians(dphi_deg)))/(1+m)
nums = {}
car = {b["name"]: b["carrier_hz"] for b in key_bands}
qt = {b["name"]: b["q_tune"] for b in key_bands}
kp = {b["name"]: b["kappa"] for b in key_bands}
names = [b["name"] for b in key_bands]
nums["crosstalk"] = {q: {m: round(B(car[q], car[m], qt[m]),4) for m in names} for q in names}
nums["phi"] = {n: {d: Phi(d, kp[n]) for d in (0,40,80,120,160)} for n in names}
nums["pac"] = {d: round(N(d),4) for d in (0,40,80,120,180)}

# ---------- example facts (EXAMPLE DATA)
def q(v): return max(0, min(15, round(v*15)))
fact1 = {"k":"forge.clause.v1","roles":{
  "kriya":{"t":"relation","v":"speed"},
  "karta":{"t":"entity","v":"light"},
  "adhikarana":{"t":"medium","v":"vacuum"},
  "mana":{"t":"quantity","v":"299792458","u":"m/s"}}}
fact2 = {"k":"forge.clause.v1","roles":{
  "kriya":{"t":"relation","v":"distance"},
  "karta":{"t":"entity","v":"moon"},
  "apadana":{"t":"entity","v":"earth"},
  "mana":{"t":"quantity","v":"384400000","u":"m"},
  "nibandhana":{"t":"qualifier","v":"mean"}}}
def atom_id(a): return b3(canon(a))
facts = []
for nm, fc, amp in (("fact1", fact1, 1.0), ("fact2", fact2, 0.8)):
    fid = b3(canon(fc))
    atoms = []
    for role, a in fc["roles"].items():
        slot = [r for r,_ in CLAUSE_ROLES].index(role)
        atoms.append(dict(role=role, slot=slot, phase_deg=slot*40, atom=a, atom_id=atom_id(a)))
    facts.append(dict(name=nm, clause=fc, canonical=canon(fc).decode(), fact_id=fid, amp=amp, amp_q=q(amp), atoms=sorted(atoms,key=lambda x:x["slot"])))

def addr(band, slot, amp_q, pband=7, pslot=0, flags=0):
    v = (band<<21)|(slot<<17)|(amp_q<<13)|(pband<<10)|(pslot<<6)|flags
    return v.to_bytes(3,"big")
FLAG = dict(VERIFIED_REF=1<<5, SPECULATIVE=1<<4, CONTRADICTS=1<<3, REQUEST=1<<2, CONT=1<<1)
for f in facts:
    a = addr(0, 0, f["amp_q"], 7, 0, FLAG["VERIFIED_REF"])
    f["fact_addr_hex"] = a.hex()
    f["record_hex"] = (a + bytes.fromhex(f["fact_id"][:16])).hex()
    for at in f["atoms"]:
        at["addr_hex"] = addr(0, at["slot"], f["amp_q"], 7, 0, FLAG["VERIFIED_REF"]).hex()
# gamma binding for fact2's measure: value & unit ride inside delta slot 7 window
g_val = {"t":"value","v":"384400000"}; g_unit = {"t":"unit","v":"m"}
facts[1]["gamma"] = [dict(part="value", slot=3, atom=g_val, atom_id=atom_id(g_val), addr_hex=addr(4,3,facts[1]["amp_q"],0,7,FLAG["VERIFIED_REF"]).hex()),
                     dict(part="unit", slot=4, atom=g_unit, atom_id=atom_id(g_unit), addr_hex=addr(4,4,facts[1]["amp_q"],0,7,FLAG["VERIFIED_REF"]).hex())]

# decay examples
def decay(A0, dt, h, floor): return max(floor, A0*2**(-dt/h))
nums["decay_delta_180d"] = decay(1.0, 180*86400, 365*86400, 0.25)
nums["decay_delta_3y"] = decay(1.0, 3*365*86400, 365*86400, 0.25)
nums["decay_theta_30d"] = decay(1.0, 30*86400, 30*86400, 0)
nums["reinforce_from_0711"] = nums["decay_delta_180d"] + 0.1*(1-nums["decay_delta_180d"])

# retrieval worked example: query for Moon-Earth mean distance, gap at mana
EPS = 0.05
def M(ms, Bv=1.0):
    p = 1.0
    for m in ms: p *= max(m, EPS)
    return Bv * p**(1/len(ms))
A2 = decay(0.8, 30*86400, 365*86400, 0.25)
nums["A2_30d"] = A2
nums["M_exact"] = M([1,1,1,1]); nums["R_exact"] = A2*nums["M_exact"]
nums["M_one_adjacent"] = M([1,1,1,Phi(40,12)])
nums["M_role_far"] = M([1,1,1,Phi(160,12)])
nums["M_partial_2of4"] = M([1,1,0,0])
nums["M_theta_query_on_delta"] = M([1,1,1,1], B(car["theta"],car["delta"],6))
nums["M_old_fact_floor"] = M([1,1,1,1]); nums["R_old_fact_floor"] = 0.25*nums["M_old_fact_floor"]
# ---------- acoustic frames
def crc16_ccitt(data, crc=0xFFFF):
    for b in data:
        crc ^= b<<8
        for _ in range(8):
            crc = ((crc<<1)^0x1021) & 0xFFFF if crc & 0x8000 else (crc<<1) & 0xFFFF
    return crc
rs = reedsolo.RSCodec(8)
KEYFP = bytes.fromhex(structure_hash[:8])
MT = dict(HELLO=0x01, HELLO_ACK=0x02, CLAIM=0x10, QUERY=0x11, ANSWER=0x12, ACK=0x20, NACK=0x21, BYE=0x7F)
SYM_S = 5/144  # 4/144 tone + 1/144 guard
PREAMBLE_S = 0.25 + 4*SYM_S
def frame(mt, session, seq, payload, mac_key=None):
    hdr = bytes([0xF1, MT[mt]]) + KEYFP + bytes([session, seq, len(payload)])
    body = hdr + payload
    if mac_key: body += blake3.blake3(body, key=mac_key).digest()[:8]
    body += struct.pack(">H", crc16_ccitt(body))
    coded = bytes(rs.encode(body))
    return dict(type=mt, bytes=len(coded), data_bytes=len(body), hex=coded.hex(), seconds=round(PREAMBLE_S + len(coded)*2*SYM_S, 2))
nonceA = bytes.fromhex("5a17c0de"); nonceB = bytes.fromhex("0b5e55ed")
session = nonceA[0] ^ nonceB[0]
frames = []
frames.append(frame("HELLO", 0x00, 0, bytes([0,1,0b00000001]) + nonceA))
frames.append(frame("HELLO_ACK", 0x00, 0, nonceA + nonceB + bytes([0b00000001])))
frames.append(frame("CLAIM", session, 1, bytes.fromhex(facts[0]["record_hex"]) + bytes.fromhex(facts[1]["record_hex"])))
# QUERY: known atoms (karta moon, apadana earth, kriya distance, nibandhana mean) + gap at mana
qrecs = b""
for at in facts[1]["atoms"]:
    if at["role"] == "mana": continue
    qrecs += addr(0, at["slot"], 15) + bytes.fromhex(at["atom_id"][:16])
qrecs += addr(0, 7, 15, 7, 0, FLAG["REQUEST"]) + bytes(8)
frames.append(frame("QUERY", session, 2, qrecs))
frames.append(frame("ACK", session, 3, bytes([1])))
macframe = frame("CLAIM", session, 4, bytes.fromhex(facts[1]["record_hex"]), mac_key=bytes(range(32)))
nums["mac_frame"] = macframe
# decode self-test
for fr in frames + [macframe]:
    raw = bytes.fromhex(fr["hex"]); dec = bytes(rs.decode(raw)[0])
    assert crc16_ccitt(dec[:-2]) == struct.unpack(">H", dec[-2:])[0]
    bad = bytearray(raw); bad[3]^=0xFF; bad[10]^=0x55; bad[-1]^=0x0F; bad[5]^=1
    assert bytes(rs.decode(bytes(bad))[0]) == dec, "RS failed to correct 4 errors"
nums["frames"] = frames
nums["raw_bps"] = 4/SYM_S; nums["raw_Bps"] = 4/SYM_S/8
nums["tones"] = [144*(12+k) for k in range(16)]

# ---------- full JSON .hfield forge packet (example)
trace_steps = ["held","neo","athena","gilligan","resumed"]
trace = dict(order=">".join(trace_steps), steps=[dict(step=s, band="theta", slot=i, phase_deg=i*40, parent=dict(band="beta", slot=0)) for i,s in enumerate(trace_steps)])
trace_hash = b3(canon(trace))
records = []
for f in facts:
    records.append(dict(fact_id=f["fact_id"], address=dict(band="delta", band_index=0, slot=0, phase_deg=0, hfield_phase=1, role_code="0x00",
        amplitude=f["amp"], amp_q=f["amp_q"], parent=None, flags=["VERIFIED_REF"], compact_hex=f["fact_addr_hex"]),
        clause=f["clause"],
        atoms=[dict(role=a["role"], slot=a["slot"], phase_deg=a["phase_deg"], role_code=f"0x{a['slot']:02X}", atom_id=a["atom_id"]) for a in f["atoms"]],
        evidence=dict(lineages=["lineage:EXAMPLE-publisher-A","lineage:EXAMPLE-publisher-B"], independent_publisher_count=2, note="placeholder lineages: example data only"),
        sender_gate_report=dict(note="informational only; receiver recomputes with its own Gilligan", admitted=True)))
forge_memory = dict(schema="forge.hfield.memory.v1",
    key=dict(key_id="forge.harmonic_key", key_version="0.1.0", structure_fp=structure_hash[:8], structure_hash_blake3=structure_hash, full_hash_blake3=full_hash),
    message=dict(type="CLAIM", session=f"0x{session:02X}", seq=1, sent_at="2026-11-25T13:40:00Z", sender="forge.instance.EXAMPLE-A", receiver="forge.instance.EXAMPLE-B"),
    records=records, trace=dict(trace, trace_hash_blake3=trace_hash),
    receiver_policy=dict(content_is_claim=True, must_pass_gilligan=True, auto_persist=False, speak_gate_echo=0.85, write_gate_echo=0.97, c_min=0.87, min_independent_publishers=2))
forge_memory["payload_hash_blake3"] = b3(canon(forge_memory))
hfield = {
 "format":"aiweb.hfield","version":"0.1.0",
 "packet":{"contract_id":"aiweb.hfield.packet_contract.v1","packet_kind":"forge_memory_exchange_packet","packet_role":"forge_to_forge_claim",
   "source_system":"Forge","target_systems":["Forge","HCS"],"analog_bridge_intent":"forge_memory_key_coordinates_over_acoustic_or_network",
   "phase_profile":{"phase_count":9,"phase_order":[2,1,3,4,5,6,7,9,8],"anchor_layout":"center_1_lower_5_upper_9","root_frequency_hz":144.0,"communication_mode":"nine_phase_frequency_packet"},
   "payload_layers":["score","frequency_phase","gesture","field","render","forge_bridge","forge_memory"],
   "render_targets":["acoustic_mfsk_frame","forge_card_view"],
   "forge_bridge":{"status":"bound","bridge_profile":"forge_memory_bridge_v1","forge_runtime_ref":"forge-mobile@4.9.x","symbolic_trace_ref":f"blake3:{trace_hash}","validation_ref":"gilligan:receiver_must_revalidate"},
   "migration_profile":"forge_memory_packet_v1"},
 "provenance":{"contract_id":"aiweb.hfield.identity_provenance_contract.v1","artifact_id":f"forge.packet.{forge_memory['payload_hash_blake3'][:16]}","artifact_kind":"harmonic_field_packet",
   "custody_model":"identity_vault_reference_only","disclosure_class":"private_reference_only",
   "identity_vault":{"status":"reference_only","vault_profile":"aiweb.identity_vault.reference.v1","vault_record_ref":"aiweb.identity_vault.forge.EXAMPLE-A","public_identity_ref":None},
   "creator":{"principal_id":"forge.instance.EXAMPLE-A","principal_kind":"system","display_label":"Forge instance A (example)","identity_vault_ref":None,"authority_scope":"system_generated_private_reference_only"},
   "contributors":[],"parent_artifacts":[],"derivative_chain":[],"forge_trace_ref":f"blake3:{trace_hash}","memory_capsule_ref":None,"authority_receipt_ref":None,
   "consent_event_ref":None,"license_ref":None,"rights_policy_ref":None,"signature_ref":None,"provenance_hash":None,
   "raw_private_identity_exported":False,"public_identity_authorized":False,"economic_processing_authorized":False,"portable_rights_authorized":False},
 "title":"Forge memory packet (EXAMPLE)","root_frequency_hz":144.0,
 "anchors":{"anchor_1":{"ratio":1.0,"role":"center_home_root_presence"},"anchor_5":{"ratio":0.5,"role":"lower_depth_weight_transformation"},"anchor_9":{"ratio":3.0,"role":"upper_lift_expression_release"}},
 "gesture_vocabulary":"nine_gesture_conductor_v0","coupling_profile":"forge_memory_key_v0_1",
 "music":{"tempo_bpm":60.0,"meter":"4/4","tuning_mode":"twelve_tone_equal_temperament_reader_proof","tracks":[{"track_id":"forge_root_reference","role":"logical_144hz_root_reference_view_only_not_the_acoustic_carrier","notes":[{"midi_note":50,"start_ms":0,"duration_ms":1000,"velocity":0.5}]}]},
 "conductor":{"field_layout":"center_1_lower_5_upper_9","primary_hand_track":{"track_id":"primary_hand","events":[]},"expressive_hand_track":{"track_id":"expressive_hand","events":[]}},
 "forge_memory":forge_memory}
json.dump(hfield, open(f"{OUT}/example_forge_packet_v0.1.hfield","w"), indent=2, ensure_ascii=False)
json.dump(dict(nums=nums, facts=facts, structure_hash=structure_hash, full_hash=full_hash, session=session), open(f"{OUT}/src/computed.json","w"), indent=1, default=str)
print(structure_hash, full_hash)
for fr in frames: print(fr["type"], fr["bytes"], fr["seconds"])
print("mac", macframe["bytes"], macframe["seconds"])
print(json.dumps({k:v for k,v in nums.items() if k not in ("frames","mac_frame","tones")}, indent=1, default=str))
for f in facts: print(f["name"], f["fact_id"], f["record_hex"], f["canonical"])
