"""Forge Mobile RMC core.

The live Ask path calls run() with live=true. That runs all 16 stages and,
when the admit gate and Echo both pass, returns the rendered answer.
dry_run=true keeps stages 14–16 skipped for tests. reasoning_seam is
world-model Observe and Derive, then the EchoForge debate, between recall
and the renderer. No model is called. C_min stays 0.87.
"""
from __future__ import annotations

import re
import json
import sys
import tempfile
from pathlib import Path
from typing import Any

from rmc_engine_v1.deep_dry_run_orchestrator import run_deep_dry_run
from rmc_engine_v1.echo_question import _tokens, echo_against_question
from rmc_engine_v1.memory_writer import bank_admitted
from rmc_engine_v1.mobile_config import THRESHOLDS, snapshot
from rmc_engine_v1.reasoning_seam import run_reasoning_seam


def _f(value: Any, default: float = 0.0) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def world_model_seam(memory: dict[str, Any], question: str) -> dict[str, Any]:
    """Observe, Derive, and the language-core debate. The seam function."""
    return run_reasoning_seam(question, memory)


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


# 4.9.209: the UNSOURCED_HELD list of ho-* ids is removed. Those hand-written
# rows were deleted in 4.9.207 and the list matched nothing. A row marked
# unsourced is still never a premise.

# Bounded, deterministic candidate fallback (Nic plan, Release A item 1): when the
# top candidate fails Echo or the gate, at most this many next-ranked candidates
# are tried, each measured from scratch by the same engine and gate.
FALLBACK_MAX = 3


def _rows(payload: dict[str, Any]) -> list[dict[str, Any]]:
    memory = payload.get("memory") if isinstance(payload.get("memory"), dict) else {}
    rows: list[dict[str, Any]] = []
    for source, key in (("rmc_receipt", "receipts"), ("phone_kb", "phone"), ("hosted_kb", "hosted"), ("anchor", "anchors"), ("research_quarantine", "research")):
        for row in memory.get(key) or []:
            if isinstance(row, dict) and str(row.get("text") or row.get("content") or "").strip():
                if row.get("unsourced") is True:
                    continue
                item = dict(row)
                item["source"] = source
                if source != "research_quarantine" and not shared_sourced(item):
                    # 4.9.210 (Release A2, Nic decision 2): a shared row with no source is not a
                    # premise. It is kept as quarantined evidence; a held question becomes a gap
                    # Athena sources from trusted anchors.
                    item["quarantined"] = True
                    item["unsourced_shared"] = True
                rows.append(item)
    return rows


def shared_sourced(row: dict[str, Any]) -> bool:
    """True unless the row is a shared-knowledge row with no source.

    Shared rows (tier confirmed_shared: the product-curator packs, the phone's
    confirmed-shared facts, curated contributions) need a source URL or a trust
    trace that rests on a trusted anchor. Other rows (anchors, the user's own
    remembered statements) are unaffected.
    """
    tier = str(row.get("tier") or row.get("state") or "").lower()
    if tier != "confirmed_shared":
        return True
    if str(row.get("source_url") or row.get("url") or "").startswith(("http://", "https://")):
        return True
    prov = row.get("provenance") if isinstance(row.get("provenance"), dict) else {}
    trust = prov.get("trust") if isinstance(prov.get("trust"), dict) else {}
    return bool(str(trust.get("rests_on") or "").strip()) and trust.get("blocks_admit") is not True


def _phase_tags(row: dict[str, Any], question: str | None = None) -> list[str]:
    """Scorer phase tags follow the concept packet, not a hand-set phase.

    A stored Φ that was typed in at ingestion is not the authority. The
    question's concept and a fact that names that concept share one tag.
    """
    from rmc_engine_v1.lexicon_resonance import concept_in_text, phase_tag, replaces_keyword_phase

    text = str(row.get("text") or row.get("content") or "")
    asked = replaces_keyword_phase(question or "")
    if asked and concept_in_text(asked["concept"], text):
        return list(asked["tags"])
    given = row.get("phase_tags")
    if isinstance(given, list) and given:
        return [str(tag) for tag in given]
    sfe = row.get("sfe") if isinstance(row.get("sfe"), dict) else None
    phi = None
    if isinstance(sfe, dict):
        try:
            phi = int(sfe.get("Phi"))
        except (TypeError, ValueError):
            phi = None
    if phi is not None and 1 <= phi <= 9:
        return phase_tag(phi)
    return ["Φ1"]


def _write_receipts(root: Path, rows: list[dict[str, Any]], question: str | None = None) -> int:
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
            "rpmc_phase_tags": _phase_tags(row, question),
            "quarantined": row.get("source") == "research_quarantine" or row.get("quarantined") is True,
            "sfe": row.get("sfe") if isinstance(row.get("sfe"), dict) else None,
            "anchor_placed": row.get("anchor_placed") is True,
            "anchor_ancestor_text": row.get("anchor_ancestor_text") or "",
            "provenance": row.get("provenance") if isinstance(row.get("provenance"), dict) else None,
            "contributor": row.get("contributor"),
            "trust": row.get("trust"),
            "tier": row.get("tier") or row.get("state"),
            "concepts": [str(c) for c in row.get("concepts")] if isinstance(row.get("concepts"), list) else None,
            "license": row.get("license"),
            "source_url": row.get("source_url") or row.get("url"),
            "revision": row.get("revision"),
            # 4.9.231 (plan 229 step 3): the phone's clause and the row's meaning id ride with the receipt to the world model
            "clause": row.get("clause") if isinstance(row.get("clause"), dict) else None,
            "meaning_id": row.get("meaning_id") if isinstance(row.get("meaning_id"), str) else None,
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


_SENT = re.compile(r"(?<=[.!?])\s+")


def _source_sentence(reply: str, rows: list[dict[str, Any]]) -> tuple[str, str]:
    """The premise sentence the reply was drawn from (exact containment), else ("", "question")."""
    want = re.sub(r"\s+", " ", str(reply or "")).strip().rstrip(".!?").lower()
    if not want:
        return "", "question"
    for row in rows:
        if row.get("quarantined") is True:
            continue
        text = re.sub(r"\s+", " ", str(row.get("text") or row.get("content") or ""))
        if want not in text.lower():
            continue
        for sent in _SENT.split(text):
            if want in sent.lower():
                return sent, "premise:" + str(row.get("id") or row.get("source") or "row")
        return text, "premise:" + str(row.get("id") or row.get("source") or "row")
    return "", "question"


def write_gate(question: str, reply: str, measured: dict[str, Any], gate: dict[str, Any], echo: dict[str, Any], packet: dict[str, Any], rows: list[dict[str, Any]], chi_passes: int = 0) -> dict[str, Any]:
    """4.9.211 the lasting-memory write gate (DRIFT-SPEC D12 + D8 + C_min).

    The write trace is the RMC stages the row actually passed (scheme phase-scheme/rmc/v1):
    Φ5 drift measured -> Φ6 correction (the ordered drift checks returned clean, or one
    χ-correct pass made it clean) -> Φ7 naming (the reply names at least one lexicon
    concept or proper-name compound, resonance_recall.row_concepts) -> Φ8 projection (the reply was rendered and spoken) -> the write is the Φ9
    return. A stage that did not happen is not in the trace, so the gate fails (no
    correction, no naming; no naming, no projection). The server recomputes the trace
    epsilon with app.drift_eps() from drift_input. The candidate epsilon (the engine
    measurement) stays in sfe.eps; the server bounds it (<= 0.35) but cannot recompute it.
    """
    from rmc_engine_v1.drift_policy import admit_decision, echo_classes

    from rmc_engine_v1.resonance_recall import row_concepts

    named = sorted(row_concepts({"text": reply, "packet": packet})) if reply else []
    hist = []
    if isinstance(measured.get("epsilon_s"), (int, float)):
        hist.append(5)
        if gate.get("drift_region") == "clean":
            hist.append(6)
            if named:
                hist.append(7)
                if reply:
                    hist.append(8)
    source, source_kind = _source_sentence(reply, rows)
    classes = echo_classes(reply, source if source else question)
    prev = hist[-1] if hist else 1
    drift_input = {"hist": hist, "prev": prev, "act": 9, "depth": 1 + int(chi_passes), "scheme": "phase-scheme/rmc/v1"}
    decision = admit_decision({
        "hist": hist, "prev": prev, "act": 9, "depth": drift_input["depth"],
        "echo": echo.get("score"), "echo_classes": classes, "coherence": measured.get("coherence"),
    })
    status = "stable" if decision["ok"] and not chi_passes else ("corrected" if decision["ok"] else "blocked")
    return {
        "ok": decision["ok"], "failed": decision["failed"], "rule": "MEMORY-WRITE-GATE",
        "drift_input": drift_input,
        "drift": {"eps": decision["drift"]["eps"], "metric_id": decision["drift"]["metric_id"], "region": decision["region"],
                  "theta_admit": decision["theta_admit"], "coherence_drift": decision["coherence_drift"]},
        "echo": echo.get("score"), "echo_min": 0.97, "echo_classes": classes, "echo_source": source_kind,
        "coherence": measured.get("coherence"), "candidate_eps": measured.get("epsilon_s"),
        "named": named[:12], "drift_status": status, "phase_scheme_id": "phase-scheme/rmc/v1", "calls_llm": False,
    }


def admit_gate(measured: dict[str, Any], *, apply_to_ask: bool = False, history: list[Any] | None = None, stamps_ms: list[Any] | None = None) -> dict[str, Any]:
    """4.9.211 DRIFT-SPEC/v1: the ordered drift checks (drift_policy.classify_drift), then C_min 0.87.

    forbidden (any eps) -> hard_stop eps >= 0.80 (inclusive) -> acceleration -> explore (quarantine)
    -> correct (one chi-correct pass by Gilligan, then re-measure; Ask holds) -> clean. The breaker
    and the trend rule route to correct. The sigma_res <= 0.35 gate is dropped (no paper basis, A4);
    sigma_res is still measured and reported. The live path applies this decision. The dry run records it.
    """
    from rmc_engine_v1.drift_policy import classify_drift
    path = measured.get("phase_path") or []
    drift = classify_drift({
        "eps": measured["epsilon_s"], "path": path if isinstance(path, list) else [path],
        # the trend rule reads the epsilon trajectory of this psi, ending with the current measurement
        "history": (list(history) + [measured["epsilon_s"]]) if isinstance(history, list) and history else None,
        "stamps_ms": stamps_ms, "metric_id": "eps_s/rmc-candidate/v1",
    })
    region = drift["region"]
    phase_ok = bool(measured["phase_ok"])
    coherence_ok = measured["coherence"] >= float(THRESHOLDS["C_min"])
    breaker = bool(measured["circuit_breaker"])
    if region == "forbidden":
        disposition = "forbidden"
    elif region == "hard_stop":
        disposition = "hard_stop"
    elif region in ("explore", "unmeasured"):
        disposition = "quarantine"
    elif region in ("correct", "acceleration") or breaker:
        disposition = "correct"
    elif phase_ok and coherence_ok:
        disposition = "admit"
    else:
        disposition = "held"
    return {
        "disposition": disposition,
        "applied_to_ask": bool(apply_to_ask and disposition == "admit"),
        "phase_ok": phase_ok,
        "drift_region": region,
        "drift_reason": drift["reason"],
        "theta_admit": drift["theta_admit"],
        "check_order": drift["check_order"],
        "trend": drift["trend"],
        "acceleration": drift["acceleration"],
        "acceleration_measured": drift["acceleration_measured"],
        "drift_flag": region != "clean" or breaker,
        "circuit_breaker": breaker,
        "sigma_res": round(float(measured.get("sigma_res") or 0.0), 6),
        "sigma_res_gate": "dropped (no paper basis, DRIFT-SPEC A4); reported only",
        "coherence_ok": coherence_ok,
        "hard_stop": region == "hard_stop",
        "discarded": False,
        "policy": "FORGE-DRIFT-POLICY/v1 nic-2026-10-14/v2",
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
        "score_components": {k: components.get(k) for k in (
            "memory_fit", "phase_validity", "drift_containment", "source_confidence",
            "utility_fit", "bounded_novelty_score", "operator_legality",
            "conflict_penalty", "projection_gate_penalty", "coherence_score", "formula",
        )} if components else {},
        "active_memory_count": int(recall.get("active_memory_count") or 0),
        "recall_sources": (recall.get("active_source_kind_counts") or {}),
        "memory_nodes": [
            {"id": n.get("memory_id"), "source": n.get("source_kind"), "weight": n.get("retrieval_weight")}
            for n in (recall.get("active_memory_nodes") or [])[:8]
            if isinstance(n, dict)
        ],
    }


def _measured_from_world(wm: dict[str, Any], base: dict[str, Any]) -> dict[str, Any]:
    """The gate's reading of the world model's spoken chain (rmc_engine_v1.world_claim_measure)."""
    out = dict(base)
    path = wm.get("phase_path") or base.get("phase_path") or ["Φ1"]
    weakest = wm.get("weakest_components") if isinstance(wm.get("weakest_components"), dict) else {}
    out.update({
        "route": wm.get("route") or base.get("route"),
        "reasons": wm.get("route_reason_codes") or [],
        "phase_path": path,
        "phase_ok": bool(wm.get("phase_ok")) and _phase_ok(path if isinstance(path, list) else [path]),
        "epsilon_s": round(_f(wm.get("epsilon_s"), 0.0), 6),
        "sigma_res": round(_f(wm.get("sigma_res"), 0.0), 6),
        "coherence": round(_f(wm.get("C"), 0.0), 6),
        "coherence_component": round(_f(wm.get("C"), 0.0), 6),
        "coherence_top_level": round(_f(wm.get("C"), 0.0), 6),
        "circuit_breaker": bool(wm.get("circuit_breaker")),
        "score_components": dict(weakest, formula=wm.get("formula")),
        "scored_candidate": wm.get("candidate_id"),
    })
    return out


def _norm_sentence(text: str) -> str:
    return " ".join(str(text or "").lower().split())


def _trust_trace(reply: str | None, rows: list[dict[str, Any]], links: list[dict[str, Any]]) -> dict[str, Any]:
    """Whether a spoken reply rests on a trusted anchor. A low-trust excerpt alone cannot."""
    from rmc_engine_v1.source_trust import trust_tier
    low_rows = [r for r in rows if trust_tier(r) == "low"]
    trusted_rows = [r for r in rows if r.get("source") != "research_quarantine" and trust_tier(r) != "low"]
    points = []
    for link in links or []:
        if isinstance(link, dict) and link.get("trust") == "low" and link.get("points_at"):
            points.append(link.get("points_at"))
    reply_n = _norm_sentence(reply)
    rests_on = None
    if reply_n:
        from rmc_engine_v1.world_model_v1 import CHAT_FACTS
        if any(reply_n == _norm_sentence(f.get("text")) for f in CHAT_FACTS):
            rests_on = "self-fact"
    if reply_n and rests_on is None:
        # 4.9.236: a personal memory is spoken to the listener ("my dog" → "your dog"); it still rests on that row
        from rmc_engine_v1.world_model_v1 import to_listener
        for row in trusted_rows:
            raw = str(row.get("text") or row.get("content") or "")
            forms = {_norm_sentence(raw)} | ({_norm_sentence(to_listener(raw))} if row.get("source") == "phone_kb" else set())
            forms.discard("")
            if any(text in reply_n or reply_n in text for text in forms):
                rests_on = row.get("id") or row.get("memory_id")
                break
    blocks = bool(reply_n and low_rows and not rests_on)
    return {
        "low_trust": bool(low_rows),
        "trusted_anchor": bool(trusted_rows),
        "rests_on": rests_on,
        "points_at": points,
        "blocks_admit": blocks,
        "rule": "LOW-TRUST-NO-PREMISE" if blocks else ("LOW-TRUST-POINTS-ANCHOR" if points else "TRUST-CLEAR"),
        "tiers": [{"id": r.get("id"), "trust": trust_tier(r), "source": r.get("source")} for r in rows[:16]],
    }


def _run_once(payload: dict[str, Any] | None = None) -> dict[str, Any]:
    payload = dict(payload or {})
    question = str(payload.get("question") or payload.get("text") or "").strip()
    if not question:
        return {"ok": False, "engine": "rmc_engine_v1", "error": "empty_question", "calls_llm": False, "product_reply": False}
    rows = _rows(payload)
    # 4.9.216 computed tier: only the engine's own computation receipt for this question is a computed premise.
    # A row that merely claims tier "computed" from the phone's memory is not.
    rows = [r for r in rows if str(r.get("tier") or "").lower() != "computed" and not r.get("computed")]
    computed = payload.get("_computed") if isinstance(payload.get("_computed"), dict) else None
    if computed and computed.get("status") == "ok" and isinstance(computed.get("row"), dict):
        crow = dict(computed["row"])
        crow["source"] = "computation"
        rows.append(crow)
    research_rows = [r for r in rows if r.get("source") == "research_quarantine"]
    admitted_rows = [r for r in rows if r.get("source") != "research_quarantine"]
    from rmc_engine_v1.gilligan_anchor import connect_quarantine
    anchors = [connect_quarantine(question, row, admitted_rows) for row in research_rows]
    for link in anchors:
        placed = link.get("placed") if isinstance(link, dict) else None
        if link.get("gate_eligible") and isinstance(placed, dict) and placed.get("text"):
            rows.append(placed)
    with tempfile.TemporaryDirectory(prefix="rmc-core-") as tmp:
        root = Path(tmp)
        fed = _write_receipts(root, rows, question)
        live = bool(payload.get("live")) and not bool(payload.get("dry_run"))
        report = run_deep_dry_run(
            question,
            {"source": "forge-mobile-ask" if live else "forge-mobile-foundations", "retrieval_backend": "filesystem", "recall": "resonance"},
            root=str(root),
            execute_late_stages=live,
        )
        measured = _measured(report)
        memory = {
            "fed": fed,
            "active": measured["active_memory_count"],
            "sources": measured.get("recall_sources") or {},
            "nodes": measured["memory_nodes"],
        }
        artifacts = report.get("artifacts") if isinstance(report.get("artifacts"), dict) else {}
        recorded = artifacts.get("reasoning_seam") if isinstance(artifacts.get("reasoning_seam"), dict) else None
        world = recorded if recorded and recorded.get("layer") == "world_model" else world_model_seam(memory, question)
        rendered_full = str(artifacts.get("rendered_answer") or "")
        derived = str((world.get("derived_text") or "")).strip()
        language_core = artifacts.get("language_core") if isinstance(artifacts.get("language_core"), dict) else {}
        coherence_art = artifacts.get("coherence_report") if isinstance(artifacts.get("coherence_report"), dict) else {}
        selected_preview = coherence_art.get("selected_scored_candidate_preview") if isinstance(coherence_art.get("selected_scored_candidate_preview"), dict) else {}
        meaning_preview = coherence_art.get("selected_candidate_meaning_state_preview") if isinstance(coherence_art.get("selected_candidate_meaning_state_preview"), dict) else {}
        selected_id = str(selected_preview.get("candidate_id") or "")
        # Live speech is the sentence the scorer measured. A coverage tie used
        # to speak a different sentence (photosynthesis, for "what is oxygen")
        # that only shared a token. Echo is taken on the spoken sentence.
        derive_status = str(((world.get("derive") or {}) if isinstance(world.get("derive"), dict) else {}).get("status") or "")
        rendered = derived if live else rendered_full
        scored = str(meaning_preview.get("candidate") or "").strip()
        scored_kind = str(meaning_preview.get("candidate_kind") or "")
        # A conflict speaks neither side. The scored sentence is used only when
        # Derive did not refuse both.
        if live and derive_status != "conflicted" and scored and ("memory" in scored_kind or meaning_preview.get("language_core")):
            if echo_against_question(question, scored, rendered=True).get("pass"):
                rendered = scored
        if live and derive_status != "conflicted" and language_core.get("speech_act") in {"greeting", "request", "self", "capability"} and language_core.get("claim"):
            rendered = str(language_core.get("claim"))
        if (
            live
            and derive_status != "conflicted"
            and language_core.get("admitted_candidate")
            and language_core.get("claim")
            and selected_id == str(language_core.get("candidate_id") or "")
        ):
            rendered = str(language_core.get("claim"))
        echo = echo_against_question(question, rendered if live else _candidate_text(report), rendered=live)
        # "How are you?" and "What can you do?" are function words. The token
        # cut leaves no content word, so coverage was 0 no matter the reply.
        # The meaning is the speech act. They are different acts. The 0.85
        # line is unchanged.
        if (
            live
            and language_core.get("speech_act") in {"greeting", "request", "self", "capability"}
            and rendered
            and not _tokens(question)
        ):
            echo = dict(echo)
            echo["score"] = 1.0
            echo["pass"] = True
            echo["method"] = "speech_act_meaning"
        if computed is not None and live and derive_status != "conflicted" and scored and ("memory" in scored_kind or meaning_preview.get("language_core")):
            # 4.9.216: for a math question the scored sentence is checked by the recomputing Echo below, not by
            # word coverage (a sentence like "15% of 80 is 12." has no content words for coverage to read).
            rendered = scored
        if computed is not None:
            # 4.9.216: a math question's Echo re-parses the spoken sentence with the math grammar and recomputes it;
            # the sentence must state the asked quantity and its value. Unparsed or uncomputed math always fails.
            from rmc_engine_v1.computed_math import echo as computed_echo
            echo = computed_echo(question, rendered if live else _candidate_text(report), computed)
        # 4.9.234 (plan 229 step 6): the gate scores the sentence that is spoken. When that is the world model's
        # derived chain, its own kernel reading (world_claim_measure) is scored, not the orchestrator's other candidate.
        orchestrator_measured = measured
        wm_measure = artifacts.get("world_model_measure") if isinstance(artifacts.get("world_model_measure"), dict) else None
        scored_by = "orchestrator"
        # A dry run speaks nothing; the sentence it would speak is its candidate text, scored the same way.
        would_speak = rendered if rendered else _candidate_text(report)
        if wm_measure and would_speak and _norm_sentence(would_speak) == _norm_sentence(wm_measure.get("spoken")):
            measured = _measured_from_world(wm_measure, orchestrator_measured)
            scored_by = "world_model"
        gate = admit_gate(
            measured, apply_to_ask=bool(live and echo.get("pass") and rendered),
            history=payload.get("drift_history"), stamps_ms=payload.get("phase_stamps_ms"),
        )
        gate["scored"] = scored_by
        gate["scored_reading"] = {k: measured.get(k) for k in ("route", "coherence", "epsilon_s", "phase_ok", "circuit_breaker")}
        gate["orchestrator_reading"] = {k: orchestrator_measured.get(k) for k in ("route", "coherence", "epsilon_s", "phase_ok", "circuit_breaker")}
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
        chain = [s.get("stage_id") for s in stages]
        spoken = bool(gate.get("applied_to_ask") and rendered)
        reply = rendered if spoken else None
        trust_trace = _trust_trace(reply, rows, anchors)
        if spoken and trust_trace.get("blocks_admit"):
            spoken = False
            reply = None
            gate = dict(gate)
            gate["applied_to_ask"] = False
            gate["disposition"] = "held"
            gate["low_trust_block"] = trust_trace["rule"]
        recall_state = (((artifacts.get("trace_spine") or {}).get("memory_recall") or {}).get("memory_state") or {})
        resonance = recall_state.get("resonance") if isinstance(recall_state, dict) else None
        from rmc_engine_v1.resonance_recall import PACKET_SCHEMA, CITE as RESONANCE_CITE
        curation = []
        for link in anchors:
            curation.append({k: link.get(k) for k in (
                "ok", "rule", "writes", "gate_eligible", "band", "packet", "drift", "chi", "link", "role",
                "ancestor", "christping_initiated", "christping_owner", "ask_initiated", "calls_llm", "cite", "reason",
                "trust", "premise", "points_at", "admit_rests_on",
            )})
        memory_write = None
        if spoken:
            eps = measured["epsilon_s"]
            from rmc_engine_v1.lexicon_resonance import replaces_keyword_phase
            placed = replaces_keyword_phase(question)
            phi = int(placed["packet"]["Phi"]) if placed and placed["packet"].get("Phi") else 9
            sfe = {"Phi": phi, "eps": round(eps, 6), "mu": 1}
            packet = {
                "schema": PACKET_SCHEMA, "Phi": phi, "eps": sfe["eps"], "mu": 1, "sfe": sfe,
                "glyph": (placed or {}).get("packet", {}).get("glyph") if placed else "",
                "concept": (placed or {}).get("concept") if placed else None,
                "mu_status": "unspecified",
                "cite": RESONANCE_CITE, "placed_by": "athena", "standing": "projectable",
            }
            survivor = ((world.get("derive") or {}).get("survivor") or {})
            provenance = {
                "question": question,
                "premises": survivor.get("provenance") or [],
                "frame": ((survivor.get("debate") or {}).get("frame")),
                "source": "rmc_core.admit_gate",
                "contributor": "athena",
                "credit": "Athena placed the packet after resonance recall and the admit gate. Premise ids are the recalled rows.",
                "trust": trust_trace,
            }
            row_body = {"id": "admit-" + question[:24], "text": reply, "sfe": sfe, "packet": packet, "provenance": provenance, "contributor": "athena"}
            try:
                chi_passes = max(0, min(1, int(payload.get("chi_passes") or 0)))  # CHI_CORRECT_PASSES = 1
            except (TypeError, ValueError):
                chi_passes = 0
            wg = write_gate(question, reply, measured, gate, echo, packet, rows, chi_passes)
            row_body["write_gate"] = wg
            # 4.9.209 (Nic plan, Release A item 2): an admitted answer does NOT write lasting or
            # shared memory. The engine returns the row as a proposal. Only an explicit user
            # request ("remember …" or the Remember tap) writes it; Athena's curation writes go
            # through the locked writer. Nothing is banked here and nothing is sent.
            memory_write = {
                "committed": False,
                # 4.9.211 (DRIFT-SPEC D12 + D8): a lasting write needs the write gate: clean at theta_admit,
                # Φ6 correction then Φ7 naming, Echo >= 0.97 plus the categorical classes, C >= 0.87.
                "proposed": bool(wg["ok"]),
                "write_gate": wg,
                "rule": "ASK-NO-AUTO-WRITE" if wg["ok"] else "MEMORY-WRITE-GATE-" + str(wg["failed"][0]).upper().replace(":", "-").replace("_", "-"),
                "requires": "an explicit user request: 'remember …' or the Remember tap",
                "calls_llm": False,
                "text": reply,
                "packet": packet,
                "provenance": provenance,
                "proposal": row_body,
                # Decision only (pure, nothing is stored): would a "remember" add anything new, or is
                # the sentence already in memory? The Remember step uses it to avoid duplicates.
                "bank": bank_admitted(payload.get("memory") or {}, row_body),
                "supabase": {"attempted": False, "written": False, "verified": False, "rule": "ASK-NO-AUTO-WRITE", "calls_llm": False},
                "gilligan": {"christping_initiated": False, "reason": "Ask does not start ChristPing. Only Gilligan initiates it, and only above a hard stop."},
            }
        from rmc_engine_v1.language_core_engines import run_engines
        from rmc_engine_v1.lexicon_resonance import question_phase
        shown = question_phase(question)
        engines = run_engines(
            measured.get("epsilon_s"),
            int(shown["packet"]["Phi"]) if shown and shown.get("packet") and shown["packet"].get("Phi") else None,
            [r for r in (payload.get("memory") or {}).get("hosted") or [] if isinstance(r, dict) and r.get("unsourced")],
            question=question,
        )
        kind = "rendered_answer" if spoken else ("held_trace" if live else "foundation_trace")
        trace = {
            "input": question,
            "memory": memory,
            "world_model": {k: world[k] for k in (
                "layer", "slot", "status", "schema", "applied", "sits_after", "sits_before",
                "input_memory_count", "output_memory_count", "calls_llm", "writes_memory",
                "writes_durable_memory", "christping_initiated", "model_invoked",
                "derived_text", "world_root", "parent_root", "world", "observe", "self_facts",
                "derive", "debate", "proofs", "checker", "simulate", "limits", "effects", "cites", "upstream",
            ) if k in world},
            "world_model_measure": wm_measure,
            "admit": gate,
            "phase": {"primary": measured["phase_primary"], "path": measured["phase_path"], "ok": measured["phase_ok"],
                      "glyph": (shown or {}).get("packet", {}).get("glyph") if shown else "",
                      "concept": (shown or {}).get("concept") if shown else None,
                      "lexicon": (shown or {}).get("packet") if shown else None},
            "engines": engines,
            "operator_chain": chain,
            "stages": stage_rows,
            "late_stages": late,
            "drift": {"epsilon_s": measured["epsilon_s"], "sigma_res": measured["sigma_res"], "circuit_breaker": measured["circuit_breaker"],
                      "theta_w": engines.get("theta_w"), "chi_hardening": engines.get("chi_hardening")},
            "echo": echo,
            "resonance": resonance,
            "language_core": language_core,
            "quarantine_curation": curation,
            "trust": trust_trace,
            "memory_write": memory_write,
            "output": {
                "kind": kind,
                "product_reply": spoken,
                "reply": reply,
                "route": measured["route"],
                "status": report.get("status"),
                "admit_disposition": gate["disposition"],
                "echo_score": echo["score"],
                "live": live,
            },
        }
        return {
            "ok": True,
            "foundations": True,
            "live": live,
            "engine": "rmc_engine_v1",
            "entry": "deep_dry_run_orchestrator.run_deep_dry_run",
            "module": "rmc_engine_v1.rmc_core",
            "product_reply": spoken,
            "reply": reply,
            "claim": str((artifacts.get("admitted_claim") or {}).get("text") or "")[:500],
            "held": bool(live and not spoken),
            "calls_llm": False,
            "model_invoked": False,
            "route": measured["route"],
            "drift": measured["epsilon_s"],
            "coherence": measured["coherence"],
            "coherence_components": measured.get("score_components") or {},
            "active_memory_count": measured["active_memory_count"],
            "memory_fed": fed,
            "world_model": trace["world_model"],
            "world_model_measure": wm_measure,
            "admit": gate,
            "echo": echo,
            "resonance": resonance,
            "language_core": language_core,
            "quarantine_curation": curation,
            "trust": trust_trace,
            "memory_write": memory_write,
            "engines": engines,
            "lexicon": (shown or {}).get("packet") if shown else None,
            "stages": stage_rows,
            "late_stages": late,
            "recall_sources": measured.get("recall_sources") or {},
            "ok_stages": [s.get("stage_id") for s in stages if s.get("status") == "OK"],
            "stage_count": len(stages),
            "trace": trace,
            "status": report.get("status"),
            "computed": _computed_public(computed),
        }


def _computed_public(computed: dict[str, Any] | None) -> dict[str, Any] | None:
    if not computed:
        return None
    keep = ("status", "kind", "rule", "reason", "clarify", "options", "unit", "sentence", "receipt", "understood", "needs_libs")
    out = {k: computed[k] for k in keep if k in computed}
    out["tier"] = "computed"
    out["calls_llm"] = False
    return out


def _fallback_eligible(result: dict[str, Any]) -> bool:
    if not result.get("live") or result.get("product_reply"):
        return False
    admit = result.get("admit") or {}
    if admit.get("hard_stop") or admit.get("disposition") == "hard_stop":
        return False
    derive = ((result.get("world_model") or {}).get("derive") or {})
    if str(derive.get("status") or "") == "conflicted":
        # A conflict speaks neither side. Dropping one side would hide it.
        return False
    return True


def _failed_candidate(result: dict[str, Any]) -> str:
    echo = result.get("echo") or {}
    for text in (echo.get("output_text"), (result.get("world_model") or {}).get("derived_text")):
        if str(text or "").strip():
            return str(text).strip()
    return ""


def _rows_for(payload: dict[str, Any], candidate: str) -> list[tuple[str, int]]:
    """Memory rows (not quarantined research) whose sentence is the failed candidate."""
    want = _norm_sentence(candidate).rstrip(".")
    memory = payload.get("memory") if isinstance(payload.get("memory"), dict) else {}
    hits = []
    if not want:
        return hits
    for key in ("receipts", "phone", "hosted", "anchors"):
        for i, row in enumerate(memory.get(key) or []):
            if not isinstance(row, dict):
                continue
            text = _norm_sentence(row.get("text") or row.get("content")).rstrip(".")
            if text and (text == want or text in want or want in text):
                hits.append((key, i))
    return hits


def _without(payload: dict[str, Any], hits: list[tuple[str, int]]) -> dict[str, Any]:
    out = dict(payload)
    memory = dict(payload.get("memory") or {})
    drop: dict[str, set[int]] = {}
    for key, i in hits:
        drop.setdefault(key, set()).add(i)
    for key, idx in drop.items():
        memory[key] = [row for j, row in enumerate(memory.get(key) or []) if j not in idx]
    out["memory"] = memory
    return out


POOL_CAPS = {"anchors": 16, "confirmed_shared": 12, "kb_contributions": 16}


def preselect_pools(payload: dict[str, Any]) -> dict[str, Any]:
    """4.9.209: candidate selection for the large phone pools happens here, in the engine.

    memory.pools = [{"name", "into", "rows"}]. A row is a candidate when its resonance
    packet concepts (its own packet concepts plus the concept lexicon the packets are
    placed from, the same lookup rank_memory uses) meet the question's concepts. Order:
    trust, then (4.9.217) whether the row defines the asked subject, then the number of
    specific (A.*) concepts met, then id. Capped per pool.
    No token-overlap score and no substring match; phase alignment, the resonance rank,
    the gate and Echo then run on the kept rows exactly as on every other row.
    """
    from rmc_engine_v1.resonance_recall import question_concepts, row_concepts, _trusted

    memory = dict(payload.get("memory") or {})
    pools = memory.pop("pools", None)
    if not isinstance(pools, list) or not pools:
        return payload
    question = str(payload.get("question") or "")
    known: set[str] = set()
    for pool in pools:
        for r in (pool.get("rows") if isinstance(pool, dict) else None) or []:
            if isinstance(r, dict) and isinstance(r.get("concepts"), list):
                known |= {str(c) for c in r["concepts"] if c}
    # The question's packet concepts (compound names first, then words), read against the
    # concepts the pools actually carry. A row's concepts are its own curated packet
    # concepts plus words outside proper-name compounds (row_concepts).
    asked = question_concepts(question, known)
    # 4.9.226: after "which meaning do you mean?" the phone sends the chosen sense. Its concept (when the sense has a
    # curated one) is asked for; the concepts of the meanings the user did NOT choose are dropped. No other change to recall.
    sense = payload.get("sense")
    picked_sense = str(sense.get("sense") or "") if isinstance(sense, dict) else ""
    if isinstance(sense, dict):
        keep = str(sense.get("concept") or "")
        drop = {str(c) for c in (sense.get("exclude_concepts") or []) if c}
        asked = {c for c in asked if c not in drop or c == keep}
        if keep and keep in known:
            asked = set(asked) | {keep}
    # 4.9.217: within a trust level, a row that defines the asked subject is kept before one that only mentions it
    # (relation_echo.define_rank, the same re-parse rank_memory and Echo use), so the cap never drops the definition.
    from rmc_engine_v1.relation_echo import asked as _asked_relation, define_rank as _define_rank
    ask_rel = _asked_relation(question)
    reads_definition = ask_rel.get("relation") in {"definition", "identify"}
    # 4.9.229 (Nic t151u): the same off-sense rule for rows already in memory (not only the pools): after a pick, a row filed
    # under another meaning_id never reaches recall.
    pre_off: list[str] = []
    if picked_sense:
        for key in ("anchors", "hosted", "phone"):
            kept_rows = []
            for r in memory.get(key) or []:
                mid = r.get("meaning_id") if isinstance(r, dict) else None
                if isinstance(mid, str) and mid and mid != picked_sense:
                    pre_off.append(str(r.get("id") or ""))
                    continue
                kept_rows.append(r)
            if key in memory:
                memory[key] = kept_rows
    seen_ids = {str(r.get("id") or "") for key in ("anchors", "hosted", "phone") for r in (memory.get(key) or []) if isinstance(r, dict)}
    record = []
    for pool in pools:
        if not isinstance(pool, dict):
            continue
        name = str(pool.get("name") or "")
        into = pool.get("into") if pool.get("into") in ("hosted", "phone", "anchors") else "hosted"
        cap = int(POOL_CAPS.get(name, 12))
        rows = [r for r in (pool.get("rows") or []) if isinstance(r, dict) and str(r.get("text") or "").strip() and str(r.get("id") or "") not in seen_ids]
        hits = []
        off_sense = []
        for row in rows:
            # 4.9.229: after the user picked a meaning, a fact filed under a different meaning (its meaning_id) is off-sense for
            # this question; it is not a candidate (the god is not answered with the planet). Rows without a meaning id are unchanged.
            mid = row.get("meaning_id")
            if picked_sense and isinstance(mid, str) and mid and mid != picked_sense:
                off_sense.append(str(row.get("id") or ""))
                continue
            if into == "anchors" and isinstance(row.get("concepts"), list) and row.get("concepts"):
                # an anchor is matched by its own curated concepts (its class), not by stray words
                rc = {str(c) for c in row["concepts"] if c}
            else:
                rc = row_concepts(row, str(row.get("text") or ""))
            met = asked & rc
            if met:
                specific = sum(1 for c in met if c.startswith("A."))
                defines = int(_define_rank(ask_rel, str(row.get("text") or "")).get("rank") or 0) if reads_definition else 0
                hits.append(((_trusted(row), specific, defines), str(row.get("id") or ""), row, sorted(met)))
        hits.sort(key=lambda h: (-h[0][0], -h[0][2], -h[0][1], h[1]))
        kept = hits[:cap]
        seen_ids.update(h[1] for h in kept)
        memory[into] = list(memory.get(into) or []) + [h[2] for h in kept]
        rec = {"name": name, "into": into, "pool": len(rows), "kept": [h[1] for h in kept],
               "concepts": {h[1]: h[3] for h in kept}, "cap": cap}
        if off_sense:
            rec["off_sense"] = sorted(off_sense)
        record.append(rec)
    out = dict(payload)
    out["memory"] = memory
    out["_preselect"] = {"rule": "ENGINE-POOL-PRESELECT", "method": "resonance_packet_concepts", "question_concepts": sorted(asked),
                         "uses_token_overlap": False, "calls_llm": False, "pools": record}
    if pre_off:
        out["_preselect"]["off_sense_memory"] = sorted(pre_off)
    return out


def _with_preselect(result: dict[str, Any], pre: dict[str, Any] | None) -> dict[str, Any]:
    if pre:
        result["preselect"] = pre
        if isinstance(result.get("trace"), dict):
            result["trace"]["preselect"] = pre
    return result


def run(payload: dict[str, Any] | None = None) -> dict[str, Any]:
    """One Ask turn. When the top candidate fails Echo or the gate, the next-ranked
    candidates are tried (at most FALLBACK_MAX, in rank order) before holding.

    Each try removes the failed candidate's own row and runs the same engine and
    the same gate again, so every number on a fallback answer is measured, not
    carried over. A hard stop and a conflict do not fall back. Deterministic.
    """
    payload = dict(payload or {})
    payload.pop("_computed", None)  # only the engine sets this
    # 4.9.230 (plan 229 step 2): the phone's kāraka frame is held for this turn so every layer that
    # reads the question reads the same frame; the trace records which layers used it.
    from rmc_engine_v1 import question_frame
    q0 = str(payload.get("question") or payload.get("text") or "").strip()
    frame0 = payload.get("frame")
    tokens = question_frame.begin(frame0, q0)
    # 4.9.231 (plan 229 step 3): the clauses the phone parsed for its memory rows are held for this turn too.
    from rmc_engine_v1 import memory_clauses
    mtok = memory_clauses.begin(payload)
    try:
        result = _run_turn(payload)
        qf = question_frame.summary(frame0, q0)
        mc = memory_clauses.summary()
    finally:
        memory_clauses.end(mtok)
        question_frame.end(tokens)
    if isinstance(result, dict):
        result["qframe"] = qf
        result["memory_clauses"] = mc
        if isinstance(result.get("trace"), dict):
            result["trace"]["qframe"] = qf
            result["trace"]["memory_clauses"] = mc
    return result


def _run_turn(payload: dict[str, Any]) -> dict[str, Any]:
    payload.pop("frame", None)
    from rmc_engine_v1 import computed_math
    question = str(payload.get("question") or payload.get("text") or "").strip()
    understood = computed_math.understand(question) if question else None
    if understood is not None:
        computed = computed_math.compute(question, understood)
        payload["_computed"] = computed
    payload = preselect_pools(payload)
    pre = payload.pop("_preselect", None)
    first = _with_preselect(_run_once(payload), pre)
    computed = payload.get("_computed")
    if computed is not None and computed.get("status") != "ok":
        # 4.9.216: unparsed, ambiguous, undefined or not-yet-loaded math holds with its reason. No other row may
        # answer a math question, so there is no fallback. needs_libs tells the phone which pinned wheels to load
        # (data/forge_libs.json) before it asks again; nothing is guessed meanwhile.
        if computed.get("status") == "needs_libs":
            first["needs_libs"] = computed.get("needs_libs")
        first["fallback"] = {"rule": "ENGINE-CANDIDATE-NO-FALLBACK-COMPUTED", "max": FALLBACK_MAX, "tried": [], "spoken_after": None, "calls_llm": False}
        if isinstance(first.get("trace"), dict):
            first["trace"]["fallback"] = first["fallback"]
        return first
    if not _fallback_eligible(first):
        return first
    tried = []
    current, cur_payload = first, payload
    for _ in range(FALLBACK_MAX):
        candidate = _failed_candidate(current)
        hits = _rows_for(cur_payload, candidate)
        if not hits:
            break
        tried.append({
            "candidate": candidate,
            "echo": (current.get("echo") or {}).get("score"),
            "disposition": (current.get("admit") or {}).get("disposition"),
            "excluded": sorted({str(((cur_payload.get("memory") or {}).get(k) or [])[i].get("id") or "") for k, i in hits}),
        })
        cur_payload = _without(cur_payload, hits)
        nxt = _with_preselect(_run_once(cur_payload), pre)
        if nxt.get("product_reply"):
            nxt["fallback"] = {"rule": "ENGINE-CANDIDATE-FALLBACK", "max": FALLBACK_MAX, "tried": tried, "spoken_after": len(tried), "calls_llm": False}
            nxt["trace"]["fallback"] = nxt["fallback"]
            return nxt
        if not _fallback_eligible(nxt):
            break
        current = nxt
    first["fallback"] = {"rule": "ENGINE-CANDIDATE-FALLBACK-EXHAUSTED" if tried else "ENGINE-CANDIDATE-NO-NEXT", "max": FALLBACK_MAX, "tried": tried, "spoken_after": None, "calls_llm": False}
    first["trace"]["fallback"] = first["fallback"]
    return first


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
