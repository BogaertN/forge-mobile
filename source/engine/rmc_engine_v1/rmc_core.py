"""Forge Mobile foundations core.

This module runs Nic's deep_dry_run_orchestrator and returns a trace.
It does not replace the phone's Ask reply. A world-model seam sits between
memory recall and the admit gate and does not transform memory.
"""
from __future__ import annotations

import json
import re
import sys
import tempfile
from pathlib import Path
from typing import Any

from rmc_engine_v1.deep_dry_run_orchestrator import run_deep_dry_run
from rmc_engine_v1.mobile_config import THRESHOLDS, snapshot


def _f(value: Any, default: float = 0.0) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def world_model_seam(memory: dict[str, Any], question: str) -> dict[str, Any]:
    """Reserved layer between memory recall and the admit gate.

    Today it returns the recalled memory unchanged. A later world model
    replaces this function. It must not write KB rows and it must not call a model.
    """
    count = int(memory.get("active_memory_count") or memory.get("active") or 0)
    return {
        "layer": "world_model",
        "status": "seam",
        "applied": False,
        "question_sha256_16": __import__("hashlib").sha256(question.encode("utf-8", errors="replace")).hexdigest()[:16],
        "input_memory_count": count,
        "output_memory_count": count,
        "memory": memory,
        "calls_llm": False,
        "writes_memory": False,
        "later_184": {
            "self_facts": "Self-facts live in the world model and are evolvable. Self-extension is a core function. Not implemented in 4.9.182b.",
            "contract": "The world model contract is Nic's design. It is rebuilt from his own docs in 184. This seam is not that contract.",
        },
    }


_STOP = {
    "the", "and", "for", "with", "from", "that", "this", "what", "which", "when",
    "where", "who", "whom", "why", "how", "are", "was", "were", "you", "your",
    "does", "did", "can", "could", "into", "about", "have", "has", "not", "but",
}


def _tokens(text: str) -> set[str]:
    return {w for w in re.findall(r"[a-z0-9]+", str(text or "").lower()) if len(w) > 2 and w not in _STOP}


def echo_against_question(question: str, output_text: str) -> dict[str, Any]:
    """Echo ≥ 0.85 compares output meaning with the original question's idea.

    Method: Jaccard overlap of content tokens. The dry-run renderer is still
    skipped, so the output meaning is the selected candidate text.
    """
    left = _tokens(question)
    right = _tokens(output_text)
    if not left and not right:
        score = 1.0
    elif not left or not right:
        score = 0.0
    else:
        score = len(left & right) / len(left | right)
    score = round(score, 6)
    return {
        "score": score,
        "min": THRESHOLDS["echo_min"],
        "pass": score >= float(THRESHOLDS["echo_min"]),
        "method": "jaccard_content_tokens",
        "compares": "selected_candidate_meaning_to_original_question",
        "output_text": str(output_text or "")[:400],
    }


def _candidate_text(report: dict[str, Any]) -> str:
    artifacts = report.get("artifacts") if isinstance(report.get("artifacts"), dict) else {}
    coherence = artifacts.get("coherence_report") if isinstance(artifacts.get("coherence_report"), dict) else {}
    selected = coherence.get("selected_scored_candidate_preview") if isinstance(coherence.get("selected_scored_candidate_preview"), dict) else {}
    want = str(selected.get("candidate_id") or "")
    pools = []
    cand_report = artifacts.get("candidate_report") if isinstance(artifacts.get("candidate_report"), dict) else {}
    if isinstance(cand_report.get("candidate_set"), list):
        pools.extend(cand_report["candidate_set"])
    if isinstance(selected.get("candidate"), str):
        pools.insert(0, selected)
    best = ""
    for row in pools:
        if not isinstance(row, dict):
            continue
        if want and row.get("candidate_id") not in (None, "", want):
            continue
        text = str(row.get("candidate") or row.get("title") or "")
        if len(text) > len(best):
            best = text
    return best or str(selected.get("title") or "")


_LATE = (
    "output_renderer_eligibility_check",
    "echo_validation_eligibility_check",
    "memory_write_eligibility_check",
)


def _stage_rows(stages: list[Any]) -> list[dict[str, Any]]:
    rows = []
    for i, stage in enumerate(stages):
        if not isinstance(stage, dict):
            continue
        rows.append({
            "n": i + 1,
            "stage_id": stage.get("stage_id"),
            "status": stage.get("status"),
            "reason": stage.get("reason"),
        })
    return rows


def _rows(payload: dict[str, Any]) -> list[dict[str, Any]]:
    memory = payload.get("memory") if isinstance(payload.get("memory"), dict) else {}
    rows: list[dict[str, Any]] = []
    for source, key in (("rmc_receipt", "receipts"), ("phone_kb", "phone"), ("hosted_kb", "hosted")):
        for row in memory.get(key) or []:
            if isinstance(row, dict) and str(row.get("text") or row.get("content") or "").strip():
                item = dict(row)
                item["source"] = source
                rows.append(item)
    return rows


def _write_receipts(root: Path, rows: list[dict[str, Any]]) -> int:
    dest = root / "memory" / "context_library_v1" / "receipts"
    dest.mkdir(parents=True, exist_ok=True)
    count = 0
    for i, row in enumerate(rows):
        text = str(row.get("text") or row.get("content") or "").strip()
        body = {
            "receipt_id": str(row.get("id") or f"foundation-{i}"),
            "content": text[:1200],
            "text": text[:1200],
            "filename": str(row.get("source") or "memory"),
            "verification_ok": row.get("source") != "research_quarantine",
            "rpmc_phase_tags": row.get("phase_tags") or ["Φ1"],
            "quarantined": row.get("source") == "research_quarantine",
        }
        (dest / f"m{i:04d}.json").write_text(json.dumps(body, ensure_ascii=False), encoding="utf-8")
        count += 1
    return count


def _phase_ok(path: list[Any]) -> bool:
    nums = []
    for item in path or []:
        digits = "".join(ch for ch in str(item) if ch.isdigit())
        if digits:
            nums.append(int(digits))
    if nums == [1]:
        return True
    if len(nums) < 2:
        return bool(nums)
    return all(b == a + 1 or b == 1 for a, b in zip(nums, nums[1:]))


def admit_gate(measured: dict[str, Any]) -> dict[str, Any]:
    """Record the gate. Foundations do not project this decision into Ask."""
    gap = measured["sigma_res"]
    drift_flag = measured["epsilon_s"] > float(THRESHOLDS["drift_quarantine"]) or measured["circuit_breaker"]
    hard = measured["epsilon_s"] > float(THRESHOLDS["hard_stop"])
    phase_ok = bool(measured["phase_ok"])
    gap_ok = gap <= float(THRESHOLDS["resonance_epsilon"])
    coherence_ok = measured["coherence"] >= float(THRESHOLDS["C_min"])
    if hard:
        disposition = "hard_stop"
    elif drift_flag or not gap_ok:
        disposition = "quarantine"
    elif phase_ok and gap_ok and not drift_flag and coherence_ok:
        disposition = "admit"
    else:
        disposition = "held"
    return {
        "disposition": disposition,
        "applied_to_ask": False,
        "phase_ok": phase_ok,
        "resonance_gap": round(gap, 6),
        "resonance_gap_ok": gap_ok,
        "drift_flag": drift_flag,
        "coherence_ok": coherence_ok,
        "hard_stop": hard,
        "discarded": False,
        "thresholds": snapshot({
            "epsilon_s": measured["epsilon_s"],
            "coherence": measured["coherence"],
            "sigma_res": measured["sigma_res"],
        }),
    }


def _measured(report: dict[str, Any]) -> dict[str, Any]:
    artifacts = report.get("artifacts") if isinstance(report.get("artifacts"), dict) else {}
    coherence = artifacts.get("coherence_report") if isinstance(artifacts.get("coherence_report"), dict) else {}
    selected = coherence.get("selected_scored_candidate_preview") if isinstance(coherence.get("selected_scored_candidate_preview"), dict) else {}
    components = selected.get("score_components") if isinstance(selected.get("score_components"), dict) else {}
    drift = selected.get("measured_evolutionary_drift") if isinstance(selected.get("measured_evolutionary_drift"), dict) else {}
    structural = artifacts.get("structural_drift") if isinstance(artifacts.get("structural_drift"), dict) else {}
    eps_box = structural.get("epsilon_s") if isinstance(structural.get("epsilon_s"), dict) else {}
    phase = artifacts.get("phase_report") if isinstance(artifacts.get("phase_report"), dict) else {}
    phase_state = phase.get("phase_state") if isinstance(phase.get("phase_state"), dict) else {}
    path = phase_state.get("phase_path_hypothesis") or ["Φ1"]
    epsilon = _f(drift.get("epsilon_s"), _f(eps_box.get("epsilon_s"), 0.0))
    component = _f(components.get("coherence_score"), 0.0)
    top = _f(selected.get("coherence_score"), 0.0)
    recall = (((artifacts.get("trace_spine") or {}).get("memory_recall") or {}).get("memory_state") or {})
    circuit = bool(drift.get("circuit_breaker") is True or (structural.get("circuit_breaker") or {}).get("triggered"))
    return {
        "route": (report.get("final_route") or {}).get("route"),
        "reasons": (report.get("final_route") or {}).get("reason_codes") or [],
        "phase_path": path,
        "phase_primary": phase_state.get("phase_primary"),
        "phase_ok": _phase_ok(path if isinstance(path, list) else [path]),
        "epsilon_s": round(epsilon, 6),
        "sigma_res": round(_f(drift.get("sigma_res"), 0.0), 6),
        "coherence": round(component if component > 0 else top, 6),
        "coherence_component": round(component, 6),
        "coherence_top_level": round(top, 6),
        "circuit_breaker": circuit,
        "active_memory_count": int(recall.get("active_memory_count") or 0),
        "recall_sources": (recall.get("active_source_kind_counts") or {}),
        "memory_nodes": [
            {"id": n.get("memory_id"), "source": n.get("source_kind"), "weight": n.get("retrieval_weight")}
            for n in (recall.get("active_memory_nodes") or [])[:8]
            if isinstance(n, dict)
        ],
    }


def run(payload: dict[str, Any] | None = None) -> dict[str, Any]:
    payload = dict(payload or {})
    question = str(payload.get("question") or payload.get("text") or "").strip()
    if not question:
        return {"ok": False, "engine": "rmc_engine_v1", "error": "empty_question", "calls_llm": False, "product_reply": False}
    rows = _rows(payload)
    with tempfile.TemporaryDirectory(prefix="rmc-core-") as tmp:
        root = Path(tmp)
        fed = _write_receipts(root, rows)
        report = run_deep_dry_run(question, {"source": "forge-mobile-foundations", "retrieval_backend": "filesystem"}, root=str(root))
        measured = _measured(report)
        memory = {
            "fed": fed,
            "active": measured["active_memory_count"],
            "sources": measured.get("recall_sources") or {},
            "nodes": measured["memory_nodes"],
        }
        world = world_model_seam(memory, question)
        gate = admit_gate(measured)
        stages = [s for s in (report.get("stages") or []) if isinstance(s, dict)]
        stage_rows = _stage_rows(stages)
        late = []
        for row in stage_rows:
            if row["stage_id"] in _LATE:
                late.append({
                    "n": row["n"],
                    "stage_id": row["stage_id"],
                    "status": row["status"],
                    "skipped": row["status"] == "SKIPPED",
                    "reason": row["reason"],
                })
        echo = echo_against_question(question, _candidate_text(report))
        chain = [s.get("stage_id") for s in stages]
        trace = {
            "input": question,
            "memory": memory,
            "world_model": {k: world[k] for k in ("layer", "status", "applied", "input_memory_count", "output_memory_count", "calls_llm", "writes_memory", "later_184")},
            "admit": gate,
            "phase": {"primary": measured["phase_primary"], "path": measured["phase_path"], "ok": measured["phase_ok"]},
            "operator_chain": chain,
            "stages": stage_rows,
            "late_stages": late,
            "drift": {"epsilon_s": measured["epsilon_s"], "sigma_res": measured["sigma_res"], "circuit_breaker": measured["circuit_breaker"]},
            "echo": echo,
            "output": {
                "kind": "foundation_trace",
                "product_reply": False,
                "route": measured["route"],
                "status": report.get("status"),
                "admit_disposition": gate["disposition"],
                "echo_score": echo["score"],
            },
        }
        return {
            "ok": True,
            "foundations": True,
            "engine": "rmc_engine_v1",
            "entry": "deep_dry_run_orchestrator.run_deep_dry_run",
            "module": "rmc_engine_v1.rmc_core",
            "product_reply": False,
            "calls_llm": False,
            "model_invoked": False,
            "route": measured["route"],
            "drift": measured["epsilon_s"],
            "coherence": measured["coherence"],
            "active_memory_count": measured["active_memory_count"],
            "memory_fed": fed,
            "world_model": trace["world_model"],
            "admit": gate,
            "echo": echo,
            "stages": stage_rows,
            "late_stages": late,
            "recall_sources": measured.get("recall_sources") or {},
            "ok_stages": [s.get("stage_id") for s in stages if s.get("status") == "OK"],
            "stage_count": len(stages),
            "trace": trace,
            "status": report.get("status"),
        }


def main() -> int:
    raw = sys.stdin.read()
    try:
        payload = json.loads(raw) if raw.strip() else {}
    except json.JSONDecodeError:
        payload = {"question": raw.strip()}
    if not isinstance(payload, dict):
        payload = {"question": str(payload)}
    print(json.dumps(run(payload), default=str))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
