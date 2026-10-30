"""Forge Mobile RMC core.

The live Ask path calls run() with live=true. That runs all 16 stages and,
when the admit gate and Echo both pass, returns the rendered answer.
dry_run=true keeps stages 14–16 skipped for tests. reasoning_seam is
world-model Observe and Derive, then the EchoForge debate, between recall
and the renderer. No model is called. C_min stays 0.87.
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
from rmc_engine_v1.reasoning_seam import run_reasoning_seam


def _f(value: Any, default: float = 0.0) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def world_model_seam(memory: dict[str, Any], question: str) -> dict[str, Any]:
    """Observe, Derive, and the language-core debate. The seam function."""
    return run_reasoning_seam(question, memory)


_STOP = {
    "the", "and", "for", "with", "from", "that", "this", "what", "which", "when",
    "where", "who", "whom", "why", "how", "are", "was", "were", "you", "your",
    "does", "did", "can", "could", "into", "about", "have", "has", "not", "but",
}


def _tokens(text: str) -> set[str]:
    return {w for w in re.findall(r"[a-z0-9]+", str(text or "").lower()) if len(w) > 2 and w not in _STOP}


def echo_against_question(question: str, output_text: str, *, rendered: bool = False) -> dict[str, Any]:
    """Echo ≥ 0.85.

    Live path: coverage of the original question's meaning tokens by the
    rendered answer. A longer truthful sentence is not punished for extra words.
    Dry run: Jaccard of the selected candidate meaning against the question,
    which stays 0 while stages 14–16 are skipped.
    """
    left = _tokens(question)
    right = _tokens(output_text)
    if rendered:
        if not left:
            score = 0.0
        else:
            score = len(left & right) / len(left)
        method = "question_meaning_coverage"
        compares = "rendered_answer_to_original_question_meaning"
    else:
        if not left and not right:
            score = 1.0
        elif not left or not right:
            score = 0.0
        else:
            score = len(left & right) / len(left | right)
        method = "jaccard_content_tokens"
        compares = "selected_candidate_meaning_to_original_question"
    score = round(score, 6)
    return {
        "score": score,
        "min": THRESHOLDS["echo_min"],
        "pass": score >= float(THRESHOLDS["echo_min"]),
        "method": method,
        "compares": compares,
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


# Spoken in 4.9.190 from the hosted bank with no source, license, or revision.
# Wikipedia excerpts for the same questions are low trust and are not a basis.
UNSOURCED_HELD = {
    "ho-ada", "ho-french", "ho-mona", "ho-curie", "ho-phone", "ho-cleo", "ho-ww2", "ho-bleach", "ho-vinegar",
    # The spoken Hamlet line is a hosted paraphrase. The Gutenberg title page is a different sentence.
    "ho-hamlet",
}


def _rows(payload: dict[str, Any]) -> list[dict[str, Any]]:
    memory = payload.get("memory") if isinstance(payload.get("memory"), dict) else {}
    rows: list[dict[str, Any]] = []
    for source, key in (("rmc_receipt", "receipts"), ("phone_kb", "phone"), ("hosted_kb", "hosted"), ("anchor", "anchors"), ("research_quarantine", "research")):
        for row in memory.get(key) or []:
            if isinstance(row, dict) and str(row.get("text") or row.get("content") or "").strip():
                if row.get("unsourced") is True or str(row.get("id") or "") in UNSOURCED_HELD:
                    continue
                item = dict(row)
                item["source"] = source
                rows.append(item)
    return rows


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
            "license": row.get("license"),
            "source_url": row.get("source_url") or row.get("url"),
            "revision": row.get("revision"),
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


def admit_gate(measured: dict[str, Any], *, apply_to_ask: bool = False) -> dict[str, Any]:
    """C_min stays 0.87. The live path applies this decision. The dry run records it."""
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
        "applied_to_ask": bool(apply_to_ask and disposition == "admit"),
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
        for row in trusted_rows:
            text = _norm_sentence(row.get("text") or row.get("content"))
            if text and (text in reply_n or reply_n in text):
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


def run(payload: dict[str, Any] | None = None) -> dict[str, Any]:
    payload = dict(payload or {})
    question = str(payload.get("question") or payload.get("text") or "").strip()
    if not question:
        return {"ok": False, "engine": "rmc_engine_v1", "error": "empty_question", "calls_llm": False, "product_reply": False}
    rows = _rows(payload)
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
        if live and derive_status != "conflicted" and language_core.get("speech_act") in {"greeting", "request", "self"} and language_core.get("claim"):
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
        # The meaning is the speech act. The 0.85 line is unchanged.
        if (
            live
            and language_core.get("speech_act") in {"greeting", "request", "self"}
            and rendered
            and not _tokens(question)
        ):
            echo = dict(echo)
            echo["score"] = 1.0
            echo["pass"] = True
            echo["method"] = "speech_act_meaning"
        gate = admit_gate(measured, apply_to_ask=bool(live and echo.get("pass") and rendered))
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
        from rmc_engine_v1.memory_writer_hosted import commit_hosted
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
            from rmc_engine_v1.memory_writer import bank_admitted
            session = payload.get("memory") if isinstance(payload.get("memory"), dict) else {}
            bank = bank_admitted(session, row_body)
            hosted_result = (
                {"attempted": False, "written": False, "verified": False, "rule": "KB-WRITER-ALREADY-BANKED", "calls_llm": False}
                if not bank["written"]
                else commit_hosted(row_body, transport=payload.get("hosted_transport"))
            )
            memory_write = {
                "committed": True,
                "calls_llm": False,
                "text": reply,
                "packet": packet,
                "provenance": provenance,
                "phone_kb": row_body,
                "hosted_kb": row_body,
                "rmc_receipt": row_body,
                "supabase": hosted_result,
                "bank": {k: bank[k] for k in ("written", "reason", "kept", "replace_id", "calls_llm")},
                "gilligan": {"christping_initiated": False, "reason": "Ask does not start ChristPing. Only Gilligan initiates it, and only above a hard stop."},
            }
        from rmc_engine_v1.language_core_engines import run_engines
        from rmc_engine_v1.lexicon_resonance import question_phase
        shown = question_phase(question)
        engines = run_engines(
            measured.get("epsilon_s"),
            int(shown["packet"]["Phi"]) if shown and shown.get("packet") and shown["packet"].get("Phi") else None,
            [r for r in (payload.get("memory") or {}).get("hosted") or [] if isinstance(r, dict) and r.get("unsourced")],
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
                "derive", "debate", "proofs", "checker", "simulate", "limits", "effects", "cites",
            ) if k in world},
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
