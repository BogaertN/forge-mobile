"""LANG-EXPR-001 / GP-014 — production activation boundary for operator-guided math expression."""
from __future__ import annotations

from typing import Any, Dict

from .symbolic_math_language_vertical_slice import answer_symbolic_math_language_request
from .symbolic_math_operator_language_realizer import (
    BUILD_ID,
    operator_guided_language_realizer_boundary,
)


def activate() -> Dict[str, Any]:
    boundary = operator_guided_language_realizer_boundary()
    return {
        "build_id": BUILD_ID,
        "active": True,
        "extends_installed_gp013_actual_echo_vertical_slice": True,
        "language_realizer": boundary,
        "meaning_locked_before_phrase_selection": True,
        "actual_echo_delivery_required": True,
        "delivery_authority_added": False,
        "uses_historical_renderer_preview_lane": False,
        "corpus_ingestion_added": False,
        "calls_llm": False,
        "adds_route_or_ui": False,
        "writes_memory": False,
        "writes_identity_vault": False,
        "writes_contribution_economy": False,
        "mints_ct": False,
        "writes_ledgers": False,
    }


def attest() -> Dict[str, Any]:
    prompts = (
        "Differentiate x^3 + 4*x with respect to x.",
        "Integrate 3*x^2 + 4 with respect to x.",
        "Expand (x + 1)^3.",
        "Factor x^2 - 9.",
        "Simplify (x^2 - 1)/(x - 1).",
        "Trigonometric simplify sin(x)^2 + cos(x)^2.",
        "Trigonometric expand sin(x + y).",
        "Find the limit of (x^2 - 1)/(x - 1) as x approaches 1.",
    )
    rows = []
    for question in prompts:
        result = answer_symbolic_math_language_request(question)
        if result.status != "ANSWERED":
            raise ValueError(f"GP-014 expression attestation failed for {question!r}")
        receipt = result.trace["expression_realization_receipt"]
        delivery = result.trace["delivery_authorization_v2"]
        if receipt["actual_echo_invoked"] or receipt["delivery_authorized"]:
            raise ValueError("GP-014 realizer attempted delivery authority")
        if delivery["delivery_status"] != "ECHO_APPROVED_DELIVERY_AUTHORIZED":
            raise ValueError("GP-014 result did not reach actual Echo-authorized delivery")
        rows.append({
            "operation_family": receipt["operation_family"],
            "expression_realization_receipt_hash": result.trace["expression_realization_receipt_hash"],
            "candidate_count": len(receipt["candidates"]),
            "selected_candidate_id": receipt["selected_candidate_id"],
            "selected_score": receipt["selected_score"],
            "echo_hash": result.trace["echo_hash"],
            "delivery_authorization_v2_hash": result.trace["delivery_authorization_v2_hash"],
        })
    return {
        "build_id": BUILD_ID,
        "status": "LANG_EXPR001_GP014_ATTESTED_OPERATOR_GUIDED_ACTUAL_ECHO_DELIVERY",
        "attested_family_count": len(rows),
        "rows": rows,
        "all_rows_have_multiple_candidates": all(row["candidate_count"] >= 3 for row in rows),
        "actual_echo_delivery_required": True,
        "realizer_delivery_authority": False,
        "corpus_used": False,
        "llm_used": False,
        "writes_memory": False,
        "writes_identity_vault": False,
        "writes_contribution_economy": False,
        "mints_ct": False,
        "writes_ledgers": False,
    }


__all__ = ["activate", "attest"]
