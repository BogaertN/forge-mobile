"""RMC Lexicon Audit v1 — production-readiness coverage report.

Patch 262J1R-Preflight-B4 expands the seed resonance lexicon into a real
reference corpus and verifies minimum coverage before downstream candidate
generation can be trusted.

This module is read-only and side-effect-free. It performs file reads from the
reference directory only. It never writes files, mutates memory, calls an LLM,
queries Chroma, executes shell commands, or approves output.
"""
from __future__ import annotations

import json
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any

ENGINE_VERSION = "rmc_lexicon_audit_v1_patch262J1R_preflight_B4"
ENGINE_MODE = "read_only_lexicon_audit"
REFERENCE_DIR = Path(__file__).resolve().parent / "reference"

THRESHOLDS = {
    "word_loop_seed_lexicon_v1.jsonl": 250,
    "operator_phrase_lexicon_v1.jsonl": 150,
    "gold_reference_v1.jsonl": 150,
    "transition_law_examples_v1.jsonl": 75,
    "syntactic_firewall_examples_v1.jsonl": 50,
    "scripture_phase_archetypes_v1.jsonl": 30,
}
REQUIRED_PHASES = [f"Φ{i}" for i in range(1, 10)]
REQUIRED_OPERATOR_FAMILIES = {
    "dangerous_bypass",
    "dangerous_projection",
    "safe_negated_bypass",
    "safe_negated_projection",
    "lawful_gate_order",
    "lawful_block_until_gate",
    "cold_storage_lawful",
    "memory_lawful",
    "authority_lawful",
}


def _read_jsonl(path: Path) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    if not path.exists():
        return rows
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        rows.append(json.loads(line))
    return rows


def _as_phase_list(value: Any) -> list[str]:
    if isinstance(value, str):
        return [value]
    if isinstance(value, list):
        return [str(v) for v in value]
    if isinstance(value, dict):
        return [str(k) for k in value.keys() if str(k).startswith("Φ")]
    return []


def _duplicates(rows: list[dict[str, Any]], key: str) -> list[str]:
    c = Counter(str(r.get(key, "")).lower() for r in rows if r.get(key))
    return sorted(k for k, v in c.items() if v > 1)


def _row_schema_failures(rows: list[dict[str, Any]], required: list[str]) -> list[str]:
    failures: list[str] = []
    for idx, row in enumerate(rows, start=1):
        missing = [k for k in required if k not in row]
        if missing:
            failures.append(f"row_{idx}:missing:{','.join(missing)}")
    return failures[:50]


def lexicon_audit_boundary() -> dict[str, Any]:
    return {
        "engine_version": ENGINE_VERSION,
        "engine_mode": ENGINE_MODE,
        "engine_module_location": "forge/rmc_engine_v1/lexicon_audit.py",
        "reference_location": "forge/rmc_engine_v1/reference/",
        "thresholds": THRESHOLDS,
        "side_effect_free": True,
        "calls_llm": False,
        "queries_chroma": False,
        "reads_db_files": False,
        "writes_files": False,
        "writes_rmc_memory": False,
        "writes_identity_vault": False,
        "approved_output": False,
    }


def lexicon_audit_report() -> dict[str, Any]:
    files = {name: _read_jsonl(REFERENCE_DIR / name) for name in THRESHOLDS}
    counts = {name: len(rows) for name, rows in files.items()}

    threshold_results = {
        name: {
            "count": counts.get(name, 0),
            "minimum": minimum,
            "passed": counts.get(name, 0) >= minimum,
        }
        for name, minimum in THRESHOLDS.items()
    }

    words = files["word_loop_seed_lexicon_v1.jsonl"]
    phrases = files["operator_phrase_lexicon_v1.jsonl"]
    gold = files["gold_reference_v1.jsonl"]
    transitions = files["transition_law_examples_v1.jsonl"]
    syntactic = files["syntactic_firewall_examples_v1.jsonl"]
    scripture = files["scripture_phase_archetypes_v1.jsonl"]

    word_phase_counts: dict[str, int] = defaultdict(int)
    for row in words:
        for ph in _as_phase_list(row.get("phase")):
            if ph in REQUIRED_PHASES:
                word_phase_counts[ph] += 1

    phrase_families = Counter(str(r.get("family", "unknown")) for r in phrases)
    missing_operator_families = sorted(REQUIRED_OPERATOR_FAMILIES - set(phrase_families.keys()))

    bad_examples = [r for r in gold if r.get("expected_circuit_breaker_candidate") is True]
    safe_examples = [r for r in gold if r.get("expected_circuit_breaker_candidate") is False and r.get("expected_violation") is False]
    syntactic_gold = [r for r in gold if "expected_syntactic_drift" in r]

    schema_failures = {
        "word_loop_seed_lexicon_v1.jsonl": _row_schema_failures(words, ["word", "phase", "operator", "polarity", "family", "authority", "notes"]),
        "operator_phrase_lexicon_v1.jsonl": _row_schema_failures(phrases, ["phrase", "operator", "target_gate", "polarity", "phase_vector", "circuit_breaker_candidate", "authority", "family", "notes"]),
        "gold_reference_v1.jsonl": _row_schema_failures(gold, ["id", "input", "expected_violation", "expected_circuit_breaker_candidate", "notes"]),
        "transition_law_examples_v1.jsonl": _row_schema_failures(transitions, ["id", "input", "expected_phase_path", "expected_violation", "expected_circuit_breaker_candidate"]),
        "syntactic_firewall_examples_v1.jsonl": _row_schema_failures(syntactic, ["id", "input", "expected_syntactic_drift", "family"]),
        "scripture_phase_archetypes_v1.jsonl": _row_schema_failures(scripture, ["id", "archetype", "meaning", "phase_path", "family", "authority", "notes"]),
    }

    duplicate_report = {
        "duplicate_words": _duplicates(words, "word")[:25],
        "duplicate_phrases": _duplicates(phrases, "phrase")[:25],
        "duplicate_gold_ids": _duplicates(gold, "id")[:25],
        "duplicate_transition_ids": _duplicates(transitions, "id")[:25],
    }

    coverage_checks = {
        "all_thresholds_pass": all(v["passed"] for v in threshold_results.values()),
        "all_phases_have_word_coverage": all(word_phase_counts.get(ph, 0) >= 25 for ph in REQUIRED_PHASES),
        "operator_families_complete": not missing_operator_families,
        "gold_has_bad_examples": len(bad_examples) >= 60,
        "gold_has_safe_examples": len(safe_examples) >= 60,
        "gold_has_syntactic_examples": len(syntactic_gold) >= 10,
        "no_duplicate_keys": not any(duplicate_report.values()),
        "schema_clean": not any(schema_failures.values()),
    }

    status = "OK" if all(coverage_checks.values()) else "FAILED"
    if status != "OK":
        failure_code = "LEXICON_TOO_SMALL_OR_SCHEMA_INCOMPLETE_FOR_PRODUCTION_READINESS"
    else:
        failure_code = None

    return {
        "status": status,
        "failure_code": failure_code,
        "current_patch": "Patch 262J1R-Preflight-B4 — Lexicon Expansion + Gold Standard Dataset Hardening",
        "mode": ENGINE_MODE,
        "read_only": True,
        "counts": counts,
        "threshold_results": threshold_results,
        "word_phase_counts": dict(sorted(word_phase_counts.items())),
        "operator_family_counts": dict(sorted(phrase_families.items())),
        "missing_operator_families": missing_operator_families,
        "gold_reference_balance": {
            "bad_circuit_breaker_examples": len(bad_examples),
            "safe_non_violation_examples": len(safe_examples),
            "syntactic_gold_examples": len(syntactic_gold),
        },
        "schema_failures": schema_failures,
        "duplicate_report": duplicate_report,
        "coverage_checks": coverage_checks,
        "authority_hierarchy": [
            "letter_resonance_weak_signal",
            "word_loop_medium_signal",
            "phrase_operator_strong_signal",
            "sentence_transition_and_manifest_trace_final_authority",
        ],
        "boundary": lexicon_audit_boundary(),
        "approved_output": False,
        "writes_files": False,
        "rmc_live_memory_write": False,
        "identity_vault_write": False,
    }


if __name__ == "__main__":  # manual read-only inspection helper
    print(json.dumps(lexicon_audit_report(), indent=2, ensure_ascii=False))
