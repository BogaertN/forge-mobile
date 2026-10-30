"""4.9.195 write-once Dead Path Archive and sealed loop records. Stdlib. No LLM.

Append-only. A rewrite is rejected. Nothing is erased.
The SHA-256 seal is Codex 3.3: psi, phase, ts, Codex hash, entropy.
The fork decision matches ledger.js (GenNode Doc 12). This module seals it.
It does not admit. C_min and Echo are the v4.3 constants.
"""
from __future__ import annotations

import hashlib
import json
from typing import Any

from rmc_engine_v1.drift_v43 import C_MIN, ECHO_MIN, PHASE_NAMES
from rmc_engine_v1.language_core_engines import drift_circuit_breaker

CODEX_ID = "AIWEB-GIL-CODEX-IV-001"
CITE = (
    "GN Doc 1 dead path archive is append-only. Grace before archival; never erase (RSOC axioms, READ192). "
    "Sealed signature is SHA-256 of ψ, phase, ts, Codex hash, and entropy (Gilligan Codex 3.3, a.c l.1611–1624). "
    "Codex 3.17 is the tamper-proof chain. A fork keeps the existing verified chain (GenNode Doc 12, ledger.js) "
    "and the resolution is sealed. Doc 11 carries sealed loops and dead paths only. "
    "Echo below the v4.3 minimum is not sealed. C_min stays 0.87. No LLM."
)
DEMO_DEVICE = "dev-0102030405060708"
T0 = "2026-10-30T16:00:00Z"
T1 = "2026-10-30T16:00:01Z"
T2 = "2026-10-30T16:00:02Z"
KINDS = {
    "memory_write",
    "memory_forget",
    "loop_sealed",
    "drift_archived",
    "capture",
    "consent",
    "sync_bundle",
    "export",
    "shared_contribution",
    "shared_accept",
    "tool_publish",
    "tool_use",
    "knowledge_cite",
    "economy_count",
    "economy_candidate",
    "economy_validation",
    "economy_nullify",
    "economy_reconcile",
}


def sha256(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


CODEX_HASH = sha256(CODEX_ID)


def _prim(value: Any) -> Any:
    if isinstance(value, bool) or value is None:
        return value
    if isinstance(value, float) and value.is_integer():
        return int(value)
    return value


def canon(value: Any) -> str:
    value = _prim(value)
    if isinstance(value, list):
        return "[" + ",".join(canon(item) for item in value) + "]"
    if isinstance(value, dict):
        keys = sorted(key for key in value if value[key] is not None)
        return "{" + ",".join(json.dumps(key, ensure_ascii=False) + ":" + canon(value[key]) for key in keys) + "}"
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"))


def flags() -> dict[str, Any]:
    return {
        "admit_gate": False,
        "writes": False,
        "calls_llm": False,
        "money": False,
        "dream_idle": False,
        "economy": False,
        "packs_gated": True,
        "christping": "gilligan-only",
        "wikipedia_anchor": False,
        "c_min": C_MIN,
        "echo_min": ECHO_MIN,
    }


def phase_name(n: Any) -> str | None:
    try:
        return PHASE_NAMES.get(int(n))
    except (TypeError, ValueError):
        return None


def classify(epsilon_s: Any, transition: dict[str, Any] | None = None) -> dict[str, Any]:
    breaker = drift_circuit_breaker(epsilon_s, transition, [])
    try:
        number = float(epsilon_s) if epsilon_s is not None else None
    except (TypeError, ValueError):
        number = None
    row = {
        "dead": breaker["consecutive_failures"] >= 1,
        "breaker_reason": breaker["reason"],
        "tripped": breaker["tripped"],
        "consecutive_failures": breaker["consecutive_failures"],
        "hard_stop": breaker["reason"] == "hard_stop",
        "forbidden_step": breaker["reason"] == "forbidden_step",
        "spc_above_0_5": number is not None and number > 0.5,
        "spc_logged_only": True,
        "cite": CITE,
    }
    row.update(flags())
    return row


def empty_archive() -> dict[str, Any]:
    return {"schema": "FORGE-DPA/v1", "dead_paths": [], "sealed_loops": [], "resolutions": []}


def _list_of(archive: dict[str, Any], kind: str) -> list[dict[str, Any]]:
    if kind == "sealed_loop":
        return archive["sealed_loops"]
    if kind == "ledger_fork":
        return archive["resolutions"]
    return archive["dead_paths"]


def loop_signature(body: dict[str, Any]) -> str:
    return sha256(canon({
        "psi": str(body["psi"]),
        "phase": body["phase"],
        "ts": str(body["ts"]),
        "codex_hash": CODEX_HASH,
        "entropy": body["entropy"],
    }))


def fork_signature(body: dict[str, Any]) -> str:
    return sha256(canon({
        "device": body["device"],
        "fork_seq": body["fork_seq"],
        "ours": body["ours"],
        "theirs": body["theirs"],
        "kept": "existing",
    }))


def link_body(row: dict[str, Any]) -> dict[str, Any]:
    body: dict[str, Any] = {
        "seq": row["seq"],
        "prev": row["prev"],
        "id": row["id"],
        "kind": row["kind"],
        "signature": row["signature"],
    }
    if row.get("phase_name") is not None:
        body["phase_name"] = row["phase_name"]
    if row.get("question") is not None:
        body["question"] = row["question"]
    if row.get("epsilon_s") is not None:
        body["epsilon_s"] = row["epsilon_s"]
    if row.get("reason") is not None:
        body["reason"] = row["reason"]
    if row.get("echo") is not None:
        body["echo"] = row["echo"]
    return body


def link_hash(row: dict[str, Any]) -> str:
    return sha256(canon(link_body(row)))


def expected_signature(row: dict[str, Any]) -> str:
    if row["kind"] == "ledger_fork":
        return fork_signature(row)
    return loop_signature(row)


def verify_list(records: list[dict[str, Any]] | None) -> dict[str, Any]:
    prev = "genesis"
    rows = records or []
    for i, entry in enumerate(rows):
        if entry["seq"] != i + 1:
            return {"ok": False, "at": i, "why": "DPA-SEQ-GAP", "head": prev, "n": i}
        if entry["prev"] != prev:
            return {"ok": False, "at": i, "why": "DPA-PREV-MISMATCH", "head": prev, "n": i}
        if entry["kind"] != "ledger_fork" and entry.get("codex_hash") != CODEX_HASH:
            return {"ok": False, "at": i, "why": "DPA-CODEX-HASH", "head": prev, "n": i}
        if expected_signature(entry) != entry["signature"]:
            return {"ok": False, "at": i, "why": "DPA-SIGNATURE-MISMATCH", "head": prev, "n": i}
        if link_hash(entry) != entry["sha256"]:
            return {"ok": False, "at": i, "why": "DPA-HASH-MISMATCH", "head": prev, "n": i}
        prev = entry["sha256"]
    return {"ok": True, "n": len(rows), "head": prev, "why": None, "at": None}


def verify_archive(archive: dict[str, Any] | None) -> dict[str, Any]:
    box = archive or empty_archive()
    dead = verify_list(box.get("dead_paths"))
    loops = verify_list(box.get("sealed_loops"))
    forks = verify_list(box.get("resolutions"))
    return {
        "ok": bool(dead["ok"] and loops["ok"] and forks["ok"]),
        "dead_paths": dead,
        "sealed_loops": loops,
        "resolutions": forks,
        "cite": CITE,
    }


def _reject(rule: str) -> dict[str, Any]:
    row = {"ok": False, "rule": rule, "archived": False, "record": None}
    row.update(flags())
    return row


def append_row(archive: dict[str, Any], kind: str, fields: dict[str, Any]) -> dict[str, Any]:
    rows = _list_of(archive, kind)
    if any(row["id"] == fields["id"] for row in rows):
        return _reject("DPA-REWRITE-REJECTED")
    seq = len(rows) + 1
    prev = rows[-1]["sha256"] if rows else "genesis"
    row = {"seq": seq, "prev": prev, "kind": kind}
    row.update(fields)
    if kind != "ledger_fork":
        row["codex_hash"] = CODEX_HASH
    row["signature"] = fork_signature(row) if kind == "ledger_fork" else loop_signature(row)
    row["sha256"] = link_hash(row)
    rows.append(row)
    out = {"ok": True, "rule": "DPA-APPENDED", "archived": True, "record": row}
    out.update(flags())
    return out


def append_dead_path(archive: dict[str, Any], spec: dict[str, Any] | None) -> dict[str, Any]:
    body = spec or {}
    step = None
    if body.get("from") is not None or body.get("to") is not None:
        step = {"from": body.get("from"), "to": body.get("to")}
    gate = classify(body.get("epsilon_s"), step)
    if not gate["dead"]:
        out = _reject("DPA-NOT-DEAD")
        out["classify"] = gate
        return out
    name = phase_name(body.get("phase"))
    if not name:
        return _reject("DPA-PHASE")
    if not body.get("id") or body.get("psi") is None or body.get("ts") is None or body.get("entropy") is None:
        return _reject("DPA-FIELDS")
    appended = append_row(archive, "dead_path", {
        "id": str(body["id"]),
        "psi": str(body["psi"]),
        "phase": int(body["phase"]),
        "phase_name": name,
        "ts": str(body["ts"]),
        "entropy": body["entropy"],
        "epsilon_s": body["epsilon_s"],
        "reason": str(body.get("reason") or "write-law"),
    })
    if appended["ok"]:
        appended["classify"] = gate
    return appended


def seal_loop(archive: dict[str, Any], spec: dict[str, Any] | None) -> dict[str, Any]:
    body = spec or {}
    step = None
    if body.get("from") is not None or body.get("to") is not None:
        step = {"from": body.get("from"), "to": body.get("to")}
    gate = classify(body.get("epsilon_s"), step)
    if gate["forbidden_step"] or gate["dead"]:
        out = _reject("SEAL-REFUSED-DEAD-PATH")
        out["classify"] = gate
        return out
    echo = body.get("echo")
    if not isinstance(echo, (int, float)) or not echo >= ECHO_MIN:
        out = _reject("SEAL-ECHO-BELOW-MIN")
        out["echo"] = echo
        return out
    if not body.get("question"):
        return _reject("SEAL-QUESTION-REQUIRED")
    name = phase_name(body.get("phase"))
    if not name:
        return _reject("DPA-PHASE")
    if not body.get("id") or body.get("psi") is None or body.get("ts") is None or body.get("entropy") is None:
        return _reject("DPA-FIELDS")
    appended = append_row(archive, "sealed_loop", {
        "id": str(body["id"]),
        "psi": str(body["psi"]),
        "phase": int(body["phase"]),
        "phase_name": name,
        "ts": str(body["ts"]),
        "entropy": body["entropy"],
        "epsilon_s": body["epsilon_s"],
        "echo": echo,
        "question": str(body["question"]),
        "reason": "sealed",
    })
    if appended["ok"]:
        appended["classify"] = gate
    return appended


def erase() -> dict[str, Any]:
    row = _reject("DPA-ERASE-REJECTED")
    row["cite"] = CITE
    return row


def entry_hash(entry: dict[str, Any]) -> str:
    return sha256(canon({
        "device": entry["device"],
        "seq": entry["seq"],
        "prev": entry["prev"],
        "kind": entry["kind"],
        "payload_sha256": entry["payload_sha256"],
        "at": entry["at"],
    }))


def verify_ledger(chain: list[dict[str, Any]] | None, anchor: dict[str, Any] | None = None) -> dict[str, Any]:
    rows = chain or []
    if not rows:
        return {"ok": True, "n": 0}
    device = rows[0]["device"]
    start = anchor["start_seq"] if anchor and anchor.get("start_seq") else 1
    prior = anchor["prior_head"] if anchor and anchor.get("prior_head") else "genesis"
    if start == 1 and prior != "genesis":
        return {"ok": False, "at": 0, "why": "LEDGER-CHECKPOINT-ANCHOR"}
    for i, entry in enumerate(rows):
        if entry["device"] != device:
            return {"ok": False, "at": i, "why": "LEDGER-MIXED-DEVICE"}
        if entry["seq"] != start + i:
            return {"ok": False, "at": i, "why": "LEDGER-SEQ-GAP"}
        expect_prev = rows[i - 1]["hash"] if i else prior
        if entry["prev"] != expect_prev:
            return {"ok": False, "at": i, "why": "LEDGER-PREV-MISMATCH"}
        if entry["kind"] not in KINDS:
            return {"ok": False, "at": i, "why": "LEDGER-KIND-UNDECLARED"}
        if entry_hash(entry) != entry["hash"]:
            return {"ok": False, "at": i, "why": "LEDGER-HASH-MISMATCH"}
    return {"ok": True, "n": start - 1 + len(rows), "device": device, "head": rows[-1]["hash"], "start_seq": start}


def ledger_entry(device: str, seq: int, prev: str, payload: dict[str, Any], at: str) -> dict[str, Any]:
    entry = {
        "device": device,
        "seq": seq,
        "prev": prev,
        "kind": "memory_write",
        "payload_sha256": sha256(canon(payload)),
        "at": at,
    }
    entry["hash"] = entry_hash(entry)
    return entry


def demo_chains() -> dict[str, Any]:
    first = ledger_entry(DEMO_DEVICE, 1, "genesis", {"n": 1}, T0)
    second = ledger_entry(DEMO_DEVICE, 2, first["hash"], {"n": 2}, T1)
    existing = [first, second]
    forged_tail = {
        "device": second["device"],
        "seq": second["seq"],
        "prev": second["prev"],
        "kind": second["kind"],
        "payload_sha256": "f" * 64,
        "at": second["at"],
    }
    forged_tail["hash"] = entry_hash(forged_tail)
    longer = existing + [ledger_entry(DEMO_DEVICE, 3, second["hash"], {"n": 3}, T2)]
    return {"existing": existing, "forged": [first, forged_tail], "longer": longer, "device": DEMO_DEVICE}


def resolve_fork(existing: list[dict[str, Any]] | None, incoming: list[dict[str, Any]] | None, archive: dict[str, Any] | None = None) -> dict[str, Any]:
    have = existing or []
    nxt = incoming or []
    v_ex = verify_ledger(have)
    v_in = verify_ledger(nxt)
    if not have:
        out = _reject("LEDGER-EMPTY-EXISTING")
        out["resolved"] = False
        return out
    if not v_ex["ok"]:
        out = {"ok": False, "resolved": False, "rule": v_ex["why"], "at": v_ex["at"], "archived": False, "record": None}
        out.update(flags())
        return out
    if not v_in["ok"]:
        out = {"ok": False, "resolved": False, "rule": v_in["why"], "at": v_in["at"], "archived": False, "record": None}
        out.update(flags())
        return out
    if have[0]["device"] != nxt[0]["device"]:
        out = _reject("LEDGER-DEVICE-MISMATCH")
        out["resolved"] = False
        return out
    common = min(len(have), len(nxt))
    fork = -1
    for i in range(common):
        if have[i]["hash"] != nxt[i]["hash"]:
            fork = i
            break
    if fork < 0 and len(nxt) <= len(have):
        out = {"ok": True, "resolved": True, "rule": "LEDGER-ALREADY-HAVE", "archived": False, "record": None, "added": 0, "kept": "existing"}
        out.update(flags())
        return out
    if fork < 0:
        out = {"ok": True, "resolved": True, "rule": "LEDGER-FAST-FORWARD", "archived": False, "record": None, "added": len(nxt) - len(have), "kept": "incoming-extension"}
        out.update(flags())
        return out
    ours = have[fork]["hash"]
    theirs = nxt[fork]["hash"]
    ident = "fork:" + have[0]["device"] + ":" + str(fork + 1) + ":" + ours + ":" + theirs
    store = archive if archive is not None else empty_archive()
    if any(row["id"] == ident for row in store["resolutions"]):
        out = {
            "ok": True, "resolved": True, "already": True, "rule": "LEDGER-FORK-RESOLVED", "archived": False, "record": None,
            "fork": fork + 1, "ours": ours, "theirs": theirs, "kept": "existing",
        }
        out.update(flags())
        return out
    appended = append_row(store, "ledger_fork", {
        "id": ident,
        "device": have[0]["device"],
        "fork_seq": fork + 1,
        "ours": ours,
        "theirs": theirs,
        "kept": "existing",
        "reason": "fork",
    })
    out = {
        "ok": True,
        "resolved": True,
        "already": False,
        "rule": "LEDGER-FORK-RESOLVED",
        "archived": True,
        "record": appended["record"],
        "fork": fork + 1,
        "ours": ours,
        "theirs": theirs,
        "kept": "existing",
    }
    out.update(flags())
    return out


def rewrite_demo() -> dict[str, Any]:
    archive = empty_archive()
    first = append_dead_path(archive, {"id": "dp-sky", "psi": "psi-sky", "phase": 5, "ts": T0, "entropy": 0.36, "epsilon_s": 0.36, "reason": "write-law"})
    again = append_dead_path(archive, {"id": "dp-sky", "psi": "psi-rewritten", "phase": 5, "ts": T1, "entropy": 0.36, "epsilon_s": 0.36, "reason": "rewrite"})
    calm = append_dead_path(archive, {"id": "dp-calm", "psi": "psi-calm", "phase": 4, "ts": T0, "entropy": 0.1, "epsilon_s": 0.35, "reason": "at-write-max"})
    checked = verify_archive(archive)
    return {
        "first_ok": first["ok"],
        "first_rule": first["rule"],
        "kept_psi": archive["dead_paths"][0]["psi"] if archive["dead_paths"] else None,
        "rewrite_ok": again["ok"],
        "rewrite_rule": again["rule"],
        "length": len(archive["dead_paths"]),
        "calm_rule": calm["rule"],
        "chain_ok": checked["ok"],
        "head": checked["dead_paths"]["head"],
        "admit_gate": False,
        "writes": False,
        "calls_llm": False,
        "money": False,
    }


def tamper_demo() -> dict[str, Any]:
    archive = empty_archive()
    append_dead_path(archive, {"id": "dp-sky", "psi": "psi-sky", "phase": 5, "ts": T0, "entropy": 0.36, "epsilon_s": 0.36, "reason": "write-law"})
    honest = verify_archive(archive)
    broken = json.loads(json.dumps(archive))
    broken["dead_paths"][0]["psi"] = "psi-tampered"
    found = verify_archive(broken)
    return {
        "honest_ok": honest["ok"],
        "tamper_ok": found["ok"],
        "tamper_why": found["dead_paths"]["why"],
        "admit_gate": False,
        "writes": False,
        "calls_llm": False,
    }


def seal_demo() -> dict[str, Any]:
    archive = empty_archive()
    sealed = seal_loop(archive, {"id": "loop-sky", "psi": "psi-loop", "phase": 9, "ts": T2, "entropy": 0.1, "epsilon_s": 0.2, "echo": ECHO_MIN, "question": "why is the sky blue"})
    low = seal_loop(archive, {"id": "loop-low", "psi": "psi-low", "phase": 9, "ts": T2, "entropy": 0.1, "epsilon_s": 0.2, "echo": 0.84, "question": "why is the sky blue"})
    skip = seal_loop(archive, {"id": "loop-skip", "psi": "psi-skip", "phase": 8, "ts": T2, "entropy": 0.1, "epsilon_s": 0.1, "echo": 0.9, "question": "why is the sky blue", "from": 5, "to": 8})
    again = seal_loop(archive, {"id": "loop-sky", "psi": "psi-other", "phase": 9, "ts": T2, "entropy": 0.1, "epsilon_s": 0.2, "echo": 0.9, "question": "a different question"})
    checked = verify_archive(archive)
    return {
        "seal_ok": sealed["ok"],
        "seal_rule": sealed["rule"],
        "phase_name": archive["sealed_loops"][0]["phase_name"] if archive["sealed_loops"] else None,
        "question": archive["sealed_loops"][0]["question"] if archive["sealed_loops"] else None,
        "low_rule": low["rule"],
        "skip_rule": skip["rule"],
        "rewrite_rule": again["rule"],
        "length": len(archive["sealed_loops"]),
        "chain_ok": checked["sealed_loops"]["ok"],
        "admit_gate": False,
        "writes": False,
        "calls_llm": False,
        "money": False,
    }


def fork_demo() -> dict[str, Any]:
    chains = demo_chains()
    archive = empty_archive()
    resolved = resolve_fork(chains["existing"], chains["forged"], archive)
    again = resolve_fork(chains["existing"], chains["forged"], archive)
    forward = resolve_fork(chains["existing"], chains["longer"], empty_archive())
    broken = [dict(row) for row in chains["forged"]]
    broken[1]["hash"] = "0" * 64
    refused = resolve_fork(chains["existing"], broken, empty_archive())
    checked = verify_archive(archive)
    return {
        "resolved": resolved["resolved"],
        "rule": resolved["rule"],
        "fork": resolved["fork"],
        "kept": resolved["kept"],
        "already": again["already"],
        "again_rule": again["rule"],
        "length": len(archive["resolutions"]),
        "chain_ok": checked["resolutions"]["ok"],
        "forward_rule": forward["rule"],
        "forward_added": forward["added"],
        "broken_ok": refused["ok"],
        "broken_rule": refused["rule"],
        "existing_verifies": verify_ledger(chains["existing"])["ok"],
        "forged_verifies": verify_ledger(chains["forged"])["ok"],
        "ours": resolved["ours"],
        "theirs": resolved["theirs"],
        "admit_gate": False,
        "writes": False,
        "calls_llm": False,
        "money": False,
    }


def stage(epsilon_s: Any) -> dict[str, Any]:
    gate = classify(epsilon_s, None)
    return {
        "eligible": gate["dead"],
        "breaker_reason": gate["breaker_reason"],
        "spc_above_0_5": gate["spc_above_0_5"],
        "spc_logged_only": True,
        "rewrite_rule": "DPA-REWRITE-REJECTED",
        "erase_rule": "DPA-ERASE-REJECTED",
        "fork_rule": "LEDGER-FORK-RESOLVED",
        "admit_gate": False,
        "writes": False,
        "calls_llm": False,
        "money": False,
        "c_min": C_MIN,
        "echo_min": ECHO_MIN,
    }


def monitor_lines(mode: str | None = None) -> dict[str, Any]:
    if mode == "chain":
        row = tamper_demo()
        seal = seal_demo()
        return {
            "attrs": {"mode": "chain", "status": "verified" if row["honest_ok"] else "broken", "detail": row["tamper_why"]},
            "lines": [
                "Honest dead-path chain verifies: " + str(row["honest_ok"]).lower() + ".",
                "A changed ψ without a new hash fails. " + str(row["tamper_why"]) + ".",
                "Sealed loop chain verifies: " + str(seal["chain_ok"]).lower() + ". Phase " + str(seal["phase_name"]) + ".",
                "Question stays on the seal: " + str(seal["question"]) + ".",
                "Echo below " + str(ECHO_MIN) + " is " + seal["low_rule"] + ". Φ5 to Φ8 is " + seal["skip_rule"] + ".",
                "This card does not admit. C_min " + str(C_MIN) + ". No LLM.",
            ],
        }
    if mode == "fork":
        row = fork_demo()
        return {
            "attrs": {"mode": "fork", "status": row["rule"], "detail": "seq-" + str(row["fork"])},
            "lines": [
                "Existing chain verifies: " + str(row["existing_verifies"]).lower() + ". Forged chain verifies: " + str(row["forged_verifies"]).lower() + ".",
                "Fork at seq " + str(row["fork"]) + " resolved. Kept " + row["kept"] + ". Rule " + row["rule"] + ".",
                "A second merge of that fork is already resolved. Length " + str(row["length"]) + ".",
                "A longer chain that shares the prefix fast-forwards. Added " + str(row["forward_added"]) + ".",
                "A broken hash is " + row["broken_rule"] + " and is not sealed as a fork.",
                "Resolution chain verifies: " + str(row["chain_ok"]).lower() + ". No LLM.",
            ],
        }
    row = rewrite_demo()
    gone = erase()
    return {
        "attrs": {"mode": "rewrite", "status": row["rewrite_rule"], "detail": row["kept_psi"]},
        "lines": [
            "First append " + row["first_rule"] + ". ψ kept " + str(row["kept_psi"]) + ".",
            "Rewrite of the same id is " + row["rewrite_rule"] + ". Length " + str(row["length"]) + ".",
            "Drift 0.35 is " + row["calm_rule"] + ". It is not a dead path.",
            "Erase is " + gone["rule"] + ". The chain still verifies: " + str(row["chain_ok"]).lower() + ".",
            "Codex 0.5 SPC trigger is log only. The write law is unchanged.",
            "This card does not write memory. C_min " + str(C_MIN) + ". No LLM.",
        ],
    }


def run(payload: dict[str, Any] | None = None) -> dict[str, Any]:
    row = payload or {}
    op = row.get("op") or "rewrite"
    if op == "classify":
        step = None
        if row.get("from") is not None or row.get("to") is not None:
            step = {"from": row.get("from"), "to": row.get("to")}
        return classify(row.get("epsilon_s"), step)
    if op == "tamper":
        return tamper_demo()
    if op == "seal":
        return seal_demo()
    if op == "fork":
        return fork_demo()
    if op == "erase":
        return erase()
    if op == "stage":
        return stage(row.get("epsilon_s"))
    if op == "monitor":
        return monitor_lines(row.get("mode") or "rewrite")
    return rewrite_demo()


if __name__ == "__main__":
    import sys

    print(json.dumps(run(json.load(sys.stdin))))
