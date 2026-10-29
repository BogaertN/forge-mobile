"""GP-015 — Ask Forge / Forge Output live verified-mathematics trace surface.

Purpose
-------
Expose the already-authorized GP-013/GP-014 natural-language mathematics path to
an Operator Console API surface without creating a new reasoning or delivery
authority.  This module presents a curated, JSON-safe trace for the UI.  It
executes no shell, performs no persistence, does not call an LLM, does not
query a corpus, and never authorizes delivery by itself.

Authority chain preserved
-------------------------
question -> GP-013 compiler -> MATH-001R1 computation -> MEA seal -> GP-014
operator-guided expression -> existing Manifest Contract v2 -> actual Echo ->
DeliveryAuthorizationReceiptV2.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Dict, Iterable, List, Mapping, Optional

from .symbolic_math_language_vertical_slice import answer_symbolic_math_language_request

BUILD_ID = "GP-015-ASK-FORGE-OUTPUT-LIVE-MATH-TRACE-SURFACE"
SCHEMA_VERSION = "aiweb_gp015_ask_forge_live_math_trace_surface_v1"
ENDPOINT = "/api/operator/ask-forge/math-trace"
MODE = "governed_natural_language_symbolic_math_trace_surface"
MAX_QUESTION_CHARS = 4000


@dataclass(frozen=True)
class TraceStage:
    stage_id: str
    label: str
    status: str
    summary: str
    evidence: Dict[str, Any]

    def to_dict(self) -> Dict[str, Any]:
        return {
            "stage_id": self.stage_id,
            "label": self.label,
            "status": self.status,
            "summary": self.summary,
            "evidence": self.evidence,
        }


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _safe_dict(value: Any) -> Dict[str, Any]:
    return dict(value) if isinstance(value, Mapping) else {}


def _safe_list(value: Any) -> List[Any]:
    return list(value) if isinstance(value, (list, tuple)) else []


def _stage_status(present: bool, delivered: bool = False, rejected: bool = False) -> str:
    if rejected:
        return "CONTAINED"
    if delivered:
        return "AUTHORIZED"
    return "COMPLETE" if present else "NOT_REACHED"


def _candidate_rows(receipt: Mapping[str, Any]) -> List[Dict[str, Any]]:
    rows: List[Dict[str, Any]] = []
    selected_id = str(receipt.get("selected_candidate_id") or "")
    for raw in _safe_list(receipt.get("candidates")):
        if not isinstance(raw, Mapping):
            continue
        candidate = dict(raw)
        rows.append({
            "candidate_id": candidate.get("candidate_id"),
            "selected": str(candidate.get("candidate_id") or "") == selected_id,
            "text": candidate.get("text"),
            "final_score": candidate.get("final_score"),
            "rejected_reasons": _safe_list(candidate.get("rejected_reasons")),
            "operator_measurements": _safe_dict(candidate.get("operator_measurements")),
            "measurement_readings": _safe_dict(candidate.get("measurement_readings")),
        })
    return rows


def _build_stages(result: Mapping[str, Any]) -> List[TraceStage]:
    trace = _safe_dict(result.get("trace"))
    status = str(result.get("status") or "UNKNOWN")
    answered = status == "ANSWERED"
    refused = status in {"REFUSED_UNLEARNED", "GATE_BLOCKED", "ECHO_REJECTED"}

    compiled = _safe_dict(trace.get("compiled_request"))
    operation = _safe_dict(trace.get("symbolic_math_operation_manifest"))
    evidence = _safe_dict(trace.get("verified_tool_evidence"))
    gate = _safe_dict(trace.get("mea_evidence_gate"))
    sealed = _safe_dict(trace.get("sealed_manifest"))
    meaning = _safe_dict(trace.get("meaning_manifest"))
    realization = _safe_dict(trace.get("expression_realization_receipt"))
    echo = _safe_dict(trace.get("echo"))
    delivery = _safe_dict(trace.get("delivery_authorization_v2"))
    non_delivery = _safe_dict(trace.get("non_delivery_receipt"))

    compiler_summary = (
        f"Compiled as {compiled.get('operation_family', 'bounded symbolic math request')}."
        if compiled else "Input did not compile into an authorized symbolic operation."
    )
    computation_summary = (
        f"Verified computation produced {evidence.get('computed_display_text', 'a symbolic result')}."
        if evidence else "No governed symbolic computation was executed."
    )
    mea_summary = (
        "Verified tool evidence passed the MEA seal gate and formed a resolved problem state."
        if sealed else "No resolved MEA seal was created for this request."
    )
    expression_summary = (
        f"Generated {len(_candidate_rows(realization))} lawful expression candidates and selected one by measured operator coherence."
        if realization else "No externalized language candidate was authorized for Echo review."
    )
    echo_summary = (
        "Actual Echo validated the selected expression and issued delivery authorization."
        if delivery else "No final delivery authorization was issued."
    )

    return [
        TraceStage(
            "language_compiler",
            "Natural-Language Compiler",
            _stage_status(bool(compiled), rejected=refused and not compiled),
            compiler_summary,
            {
                "compiled_request": compiled,
                "compiler_receipt": _safe_dict(trace.get("compiler_receipt")),
            },
        ),
        TraceStage(
            "typed_operation_manifest",
            "Typed Math Manifest",
            _stage_status(bool(operation)),
            "A strict operation manifest was bound for MATH-001R1 execution." if operation else "No typed math manifest formed.",
            {"symbolic_math_operation_manifest": operation},
        ),
        TraceStage(
            "governed_computation",
            "Governed Computation",
            _stage_status(bool(evidence)),
            computation_summary,
            {
                "verified_tool_evidence": evidence,
                "kernel_result": _safe_dict(trace.get("kernel_result")),
            },
        ),
        TraceStage(
            "mea_seal",
            "MEA Evidence Seal",
            _stage_status(bool(sealed), rejected=bool(gate) and not bool(gate.get("passed", False))),
            mea_summary,
            {"mea_evidence_gate": gate, "sealed_manifest": sealed},
        ),
        TraceStage(
            "rmc_expression",
            "RMC / FBSC Expression",
            _stage_status(bool(realization)),
            expression_summary,
            {
                "meaning_manifest": meaning,
                "expression_realization_receipt": realization,
                "candidates": _candidate_rows(realization),
            },
        ),
        TraceStage(
            "echo_delivery",
            "Echo Delivery Gate",
            _stage_status(bool(echo), delivered=bool(delivery), rejected=bool(echo) and not bool(echo.get("approved_output", False))),
            echo_summary,
            {"echo": echo, "delivery_authorization_v2": delivery, "non_delivery_receipt": non_delivery},
        ),
    ]


def ask_forge_math_trace_surface(question: str) -> Dict[str, Any]:
    """Run the accepted math path and return a UI-safe trace surface payload."""
    raw_question = str(question or "").strip()
    if not raw_question:
        return {
            "status": "ERROR",
            "build_id": BUILD_ID,
            "schema_version": SCHEMA_VERSION,
            "api_contract": "forge_operator_console_api_v1",
            "endpoint": ENDPOINT,
            "mode": MODE,
            "created_at_utc": _utc_now(),
            "question": "",
            "answer_text": None,
            "error": "empty_question",
            "stages": [],
            "boundary": gp015_surface_boundary(),
        }
    if len(raw_question) > MAX_QUESTION_CHARS:
        return {
            "status": "ERROR",
            "build_id": BUILD_ID,
            "schema_version": SCHEMA_VERSION,
            "api_contract": "forge_operator_console_api_v1",
            "endpoint": ENDPOINT,
            "mode": MODE,
            "created_at_utc": _utc_now(),
            "question": raw_question[:MAX_QUESTION_CHARS],
            "answer_text": None,
            "error": "question_exceeds_maximum_length",
            "stages": [],
            "boundary": gp015_surface_boundary(),
        }

    pipeline_result = answer_symbolic_math_language_request(raw_question)
    result = pipeline_result.to_dict()
    trace = _safe_dict(result.get("trace"))
    realization = _safe_dict(trace.get("expression_realization_receipt"))
    return {
        "status": result.get("status", "UNKNOWN"),
        "build_id": BUILD_ID,
        "schema_version": SCHEMA_VERSION,
        "api_contract": "forge_operator_console_api_v1",
        "endpoint": ENDPOINT,
        "mode": MODE,
        "created_at_utc": _utc_now(),
        "question": raw_question,
        "answer_text": result.get("answer_text"),
        "domain": result.get("domain"),
        "reasons": _safe_list(result.get("reasons")),
        "result_hash": pipeline_result.result_hash(),
        "stages": [stage.to_dict() for stage in _build_stages(result)],
        "selected_expression": realization.get("selected_text"),
        "expression_candidates": _candidate_rows(realization),
        "raw_trace": trace,
        "boundary": gp015_surface_boundary(),
    }


def gp015_surface_boundary() -> Dict[str, Any]:
    return {
        "surface": "Ask Forge / Forge Output live verified-math trace",
        "central_conversation_surface": True,
        "retains_existing_operator_tools": True,
        "executes_governed_math_transaction": True,
        "uses_installed_gp014_expression_realizer": True,
        "uses_actual_echo_delivery": True,
        "ui_is_authority": False,
        "forge_governs": True,
        "calls_llm": False,
        "uses_corpus": False,
        "executes_shell": False,
        "writes_files": False,
        "writes_memory": False,
        "writes_identity_vault": False,
        "writes_contribution_economy": False,
        "mints_ct": False,
        "writes_ledgers": False,
        "professional_decisions_require_human_review": True,
    }


def attest_gp015_math_trace_surface() -> Dict[str, Any]:
    cases = (
        "Differentiate x^3 + 4*x with respect to x.",
        "Factor x^2 - 9.",
        "Find the limit of (x^2 - 1)/(x - 1) as x approaches 1.",
    )
    rows = []
    for question in cases:
        row = ask_forge_math_trace_surface(question)
        if row.get("status") != "ANSWERED":
            raise ValueError(f"GP-015 attestation did not answer {question!r}: {row.get('reasons')}")
        if not row.get("answer_text") or not row.get("expression_candidates"):
            raise ValueError("GP-015 answered response omitted expression evidence")
        if row.get("stages", [])[-1].get("status") != "AUTHORIZED":
            raise ValueError("GP-015 response omitted actual Echo delivery authorization")
        rows.append({
            "question": question,
            "answer_text": row["answer_text"],
            "stage_statuses": {s["stage_id"]: s["status"] for s in row["stages"]},
            "expression_candidate_count": len(row["expression_candidates"]),
        })
    return {
        "status": "GP015_ASK_FORGE_MATH_TRACE_SURFACE_ATTESTED",
        "build_id": BUILD_ID,
        "cases": rows,
        "boundary": gp015_surface_boundary(),
    }
