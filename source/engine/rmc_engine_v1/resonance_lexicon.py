"""RMC Resonance Lexicon v1 — English to phase/operator resonance events.

Patch 262J1R-Preflight-B4: expanded production-readiness lexicon corpus, gold references, and coverage audit.

Purpose
-------
This module sits between raw English and the structural Drift Engine. It is
read-only and side-effect-free. It turns letters, words, and operator phrases
into governed resonance events that the drift layer can consume.

Core law
--------
Do not rely on keyword weights alone.

Authority hierarchy
-------------------
1. Letter pulses: weak signal. They may influence charge, but never trigger a
   circuit breaker alone.
2. Word loops: medium signal. They may suggest phase posture.
3. Phrase/operator resonance: strong signal. It detects the actual move being
   attempted: support, require, block, bypass, violate, delay.
4. Sentence transition law and manifest/trace gates remain final authority.

No writes, no DB reads, no Chroma, no LLM calls, no shell execution.
"""

from __future__ import annotations

import json
import math
import re
from collections import Counter
from pathlib import Path
from typing import Any

ENGINE_VERSION = "rmc_resonance_lexicon_v1_patch262J1R_preflight_B4"
ENGINE_MODE = "read_only_resonance_lexicon_dry_run"
REFERENCE_DIR = Path(__file__).resolve().parent / "reference"

try:  # Codex binding is read-only; absence degrades safely for older patch states.
    from .phase_codex import (
        get_phase_profile as _codex_get_phase_profile,
        phase_codex_boundary as _codex_boundary,
        validate_phase_codex as _codex_validate,
    )
except Exception:  # pragma: no cover - defensive compatibility fallback
    _codex_get_phase_profile = None
    _codex_boundary = None
    _codex_validate = None

try:  # B4 production-readiness audit is read-only; absence degrades safely.
    from .lexicon_audit import lexicon_audit_report as _lexicon_audit_report
except Exception:  # pragma: no cover - defensive compatibility fallback
    _lexicon_audit_report = None


WORD_RE = re.compile(r"[A-Za-z][A-Za-z'_-]*")

NEGATION_TOKENS = [
    "do not", "don't", "does not", "doesn't", "never", "not",
    "should not", "shouldn't", "must not", "mustn't", "cannot", "can't",
    "avoid", "prevent", "refuse", "refusing", "no longer",
    "we should not", "we must not", "you should not", "you must not",
]
NEGATION_WINDOW_CHARS = 60

UNSAFE_MARKERS = [
    "import os", "os.system", "subprocess.call", "subprocess.run",
    "open(", "exec(", "eval(", "__import__", "shell=true", "os.popen",
    "shutil.rmtree", "os.remove", "os.unlink", "rm -rf", "chmod 777",
]


def _read_json(path: Path, default: Any) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return default


def _read_jsonl(path: Path) -> list[dict]:
    rows: list[dict] = []
    try:
        for line in path.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            obj = json.loads(line)
            if isinstance(obj, dict):
                rows.append(obj)
    except Exception:
        pass
    return rows


def _load_letter_map() -> dict:
    data = _read_json(REFERENCE_DIR / "letter_phase_map_v1.json", {})
    letters = data.get("letters") if isinstance(data, dict) else None
    return letters if isinstance(letters, dict) else {}


def _load_words() -> dict[str, dict]:
    rows = _read_jsonl(REFERENCE_DIR / "word_loop_seed_lexicon_v1.jsonl")
    return {str(r.get("word", "")).lower(): r for r in rows if r.get("word")}


def _load_phrases() -> list[dict]:
    rows = _read_jsonl(REFERENCE_DIR / "operator_phrase_lexicon_v1.jsonl")
    # Longest first prevents a shorter dangerous phrase from swallowing a longer safe phrase.
    rows.sort(key=lambda r: len(str(r.get("phrase") or "")), reverse=True)
    return rows


def _normalize_text(text: str) -> str:
    return re.sub(r"\s+", " ", str(text or "").strip())


def _phase_add(target: dict[str, float], vector: Any, scale: float = 1.0) -> None:
    if isinstance(vector, str):
        target[vector] = round(target.get(vector, 0.0) + scale, 4)
    elif isinstance(vector, list):
        for p in vector:
            if isinstance(p, str):
                target[p] = round(target.get(p, 0.0) + scale / max(1, len(vector)), 4)
    elif isinstance(vector, dict):
        for k, v in vector.items():
            try:
                target[str(k)] = round(target.get(str(k), 0.0) + float(v) * scale, 4)
            except Exception:
                pass


def _codex_profile_for_phase(phase_id: str | None) -> dict:
    if not phase_id or _codex_get_phase_profile is None:
        return {}
    try:
        prof = _codex_get_phase_profile(str(phase_id))
        if not isinstance(prof, dict):
            return {}
        return {
            "phase_name": prof.get("phase_name"),
            "glyph": prof.get("glyph"),
            "code_identifier": prof.get("code_identifier"),
            "color": prof.get("hex"),
            "motion_behavior": prof.get("motion_behavior"),
            "function_hook": prof.get("function_hook"),
            "state_signature": prof.get("state_signature"),
            "drift_behavior": prof.get("drift_behavior"),
            "cold_storage_form": prof.get("cold_storage_form"),
            "gate_role": prof.get("gate_role"),
        }
    except Exception:
        return {}


def _evidence_span(text_lower: str, phrase_lower: str, start_at: int = 0) -> tuple[int, int] | None:
    idx = text_lower.find(phrase_lower, start_at)
    if idx < 0:
        return None
    return (idx, idx + len(phrase_lower))


def _negation_before(text_lower: str, idx: int) -> tuple[bool, str | None]:
    window = text_lower[max(0, idx - NEGATION_WINDOW_CHARS):idx]
    # Prefer longer tokens first.
    for token in sorted(NEGATION_TOKENS, key=len, reverse=True):
        pattern = r"(?:^|\W)" + re.escape(token) + r"(?:\W|$)"
        if re.search(pattern, window):
            return True, token
    return False, None


def _syntactic_firewall(text: str) -> dict:
    src = str(text or "")
    evidence: list[str] = []
    score = 0.0
    if not src.strip():
        return {"score": 0.8, "severity": "high", "evidence": ["empty_input"], "syntactic_drift": True}

    freq = Counter(src)
    total = len(src)
    entropy = -sum((c / total) * math.log2(c / total) for c in freq.values()) if total else 0.0
    alphanum = sum(1 for c in src if c.isalnum() or c.isspace())
    symbol_ratio = 1.0 - (alphanum / max(1, total))

    if total > 8000:
        score = max(score, 0.35); evidence.append(f"payload:oversized={total}")
    if total > 20 and entropy < 1.5:
        score = max(score, 0.55); evidence.append(f"entropy:low={entropy:.2f}")
    if total > 50 and entropy > 5.8:
        score = max(score, 0.42); evidence.append(f"entropy:high={entropy:.2f}")
    if symbol_ratio > 0.45:
        score = max(score, 0.55); evidence.append(f"symbol_noise:high={symbol_ratio:.2f}")

    for open_c, close_c in [("{", "}"), ("[", "]"), ("(", ")")]:
        diff = abs(src.count(open_c) - src.count(close_c))
        if diff > 2:
            score = max(score, 0.42); evidence.append(f"balance:unbalanced_{open_c}{close_c}_diff={diff}")
    if src.count('"') % 2 != 0 and src.count('"') > 3:
        score = max(score, 0.36); evidence.append("balance:odd_quote_count")

    src_lower = src.lower()
    found_unsafe = [m for m in UNSAFE_MARKERS if m in src_lower]
    if found_unsafe:
        score = max(score, 0.78); evidence.append(f"unsafe:markers_found:{found_unsafe[:3]!r}")

    severity = "none"
    if score >= 0.75: severity = "critical"
    elif score >= 0.55: severity = "high"
    elif score >= 0.35: severity = "moderate"
    elif score > 0: severity = "low"

    return {
        "score": round(score, 4),
        "severity": severity,
        "evidence": evidence or ["syntactic_shape_ok"],
        "entropy": round(entropy, 4),
        "symbol_noise_ratio": round(symbol_ratio, 4),
        "syntactic_drift": bool(score >= 0.35),
    }


def _letter_pulses(text: str, letter_map: dict) -> list[dict]:
    pulses: list[dict] = []
    for i, ch in enumerate(text):
        key = ch.upper()
        if key in letter_map:
            spec = dict(letter_map[key])
            pulses.append({
                "input_char": key,
                "position": i,
                "phase": spec.get("phase"),
                "symbolic_fn": spec.get("symbolic_fn"),
                "charge": spec.get("charge", 0),
                "drift_flag": bool(spec.get("drift_flag")),
                "authority": "weak_letter_signal",
                "codex_profile": _codex_profile_for_phase(spec.get("phase")),
            })
    return pulses


def _word_loops(text: str, word_map: dict[str, dict]) -> list[dict]:
    loops: list[dict] = []
    for m in WORD_RE.finditer(text):
        raw = m.group(0)
        key = raw.lower().strip("'_- ")
        spec = word_map.get(key)
        if spec:
            loops.append({
                "matched_text": raw,
                "match_type": "word",
                "operator": spec.get("operator"),
                "target_gate": spec.get("target_gate"),
                "polarity": spec.get("polarity"),
                "phase": spec.get("phase"),
                "confidence": 0.62,
                "authority": "medium_word_signal",
                "evidence_span": [m.start(), m.end()],
                "notes": spec.get("notes", ""),
                "codex_profile": _codex_profile_for_phase(spec.get("phase") if isinstance(spec.get("phase"), str) else None),
            })
    return loops


def _phrase_events(text: str, phrase_rows: list[dict]) -> tuple[list[dict], list[dict]]:
    text_norm = _normalize_text(text)
    text_lower = text_norm.lower()
    events: list[dict] = []
    violations: list[dict] = []
    occupied: list[tuple[int, int]] = []

    def overlaps(span: tuple[int, int]) -> bool:
        return any(not (span[1] <= a or span[0] >= b) for a, b in occupied)

    for row in phrase_rows:
        phrase = str(row.get("phrase") or "").strip()
        if not phrase:
            continue
        phrase_lower = phrase.lower()
        start = 0
        while True:
            span = _evidence_span(text_lower, phrase_lower, start)
            if span is None:
                break
            start = span[0] + 1
            if overlaps(span):
                continue
            negated, negation_token = _negation_before(text_lower, span[0])
            base_polarity = str(row.get("polarity") or "").lower()
            polarity = base_polarity
            operator = row.get("operator")
            circuit = bool(row.get("circuit_breaker_candidate"))
            notes = row.get("notes", "")
            # A negated dangerous phrase becomes a block/support event, not a violation.
            if negated and base_polarity in {"violates", "bypasses"}:
                polarity = "blocks"
                operator = "NEGATED_" + str(operator or "BYPASS")
                circuit = False
                notes = f"Negation token '{negation_token}' cancels dangerous operator."

            ev = {
                "matched_text": text_norm[span[0]:span[1]],
                "match_type": "operator_phrase",
                "operator": operator,
                "target_gate": row.get("target_gate"),
                "polarity": polarity,
                "phase_vector": row.get("phase_vector") or {},
                "scope": "sentence",
                "confidence": 0.94 if row.get("authority") == "strong_operator_phrase" else 0.80,
                "evidence_span": [span[0], span[1]],
                "authority": row.get("authority", "strong_operator_phrase"),
                "circuit_breaker_candidate": circuit,
                "phase_codex_profiles": {p: _codex_profile_for_phase(p) for p in (row.get("phase_vector") or {}).keys()},
                "negated": negated,
                "notes": notes,
            }
            events.append(ev)
            occupied.append(span)
            if polarity in {"violates", "bypasses"} or circuit:
                violations.append({
                    "violation_type": "operator_gate_violation",
                    "matched_text": ev["matched_text"],
                    "operator": ev["operator"],
                    "target_gate": ev["target_gate"],
                    "circuit_breaker_candidate": circuit,
                    "evidence_span": ev["evidence_span"],
                })
    return events, violations


def _recommend_route(violations: list[dict], syntactic: dict, phase_vector: dict[str, float]) -> str:
    if any(v.get("circuit_breaker_candidate") for v in violations):
        return "projection_blocked"
    if syntactic.get("syntactic_drift"):
        return "syntactic_quarantine"
    if phase_vector.get("Φ8", 0.0) > 0 and phase_vector.get("Φ6", 0.0) <= 0:
        return "projection_requires_correction"
    if phase_vector.get("Φ6", 0.0) > 0 and phase_vector.get("Φ7", 0.0) > 0:
        return "correction_then_naming_then_projection"
    if phase_vector.get("Φ6", 0.0) > 0:
        return "correction_required"
    return "bounded_preview_only"


def resonance_lexicon_boundary() -> dict:
    return {
        "engine_version": ENGINE_VERSION,
        "engine_mode": ENGINE_MODE,
        "engine_module_location": "forge/rmc_engine_v1/resonance_lexicon.py",
        "reference_location": "forge/rmc_engine_v1/reference/",
        "phase_codex_binding": "forge/rmc_engine_v1/phase_codex.py",
        "phase_codex_reference": "forge/rmc_engine_v1/reference/phase_codex_v2_5.json",
        "phase_codex_available": bool(_codex_boundary),
        "phase_codex_validation": _codex_validate() if _codex_validate else {"status": "NOT_AVAILABLE"},
        "lexicon_audit_status": (_lexicon_audit_report().get("status") if _lexicon_audit_report else "NOT_AVAILABLE"),
        "lexicon_audit_counts": (_lexicon_audit_report().get("counts") if _lexicon_audit_report else {}),
        "authority_hierarchy": [
            "letter_resonance_weak_signal",
            "word_loop_medium_signal",
            "phrase_operator_strong_signal",
            "sentence_transition_and_manifest_trace_final_authority",
        ],
        "letter_level_may_trigger_circuit_breaker": False,
        "phrase_operator_matches_outrank_word_matches": True,
        "side_effect_free": True,
        "calls_llm": False,
        "queries_chroma": False,
        "reads_db_files": False,
        "writes_files": False,
        "writes_rmc_memory": False,
        "writes_identity_vault": False,
        "approved_output": False,
    }


def analyze_resonance(source_text: str, source_metadata: dict | None = None) -> dict:
    """Analyze English symbolic communication into resonance events.

    Returns a dry-run packet. It does not write memory and does not approve output.
    """
    text = _normalize_text(source_text)
    source_metadata = source_metadata or {}
    letter_map = _load_letter_map()
    word_map = _load_words()
    phrase_rows = _load_phrases()

    syntactic = _syntactic_firewall(text)
    letters = _letter_pulses(text, letter_map)
    words = _word_loops(text, word_map)
    phrases, violations = _phrase_events(text, phrase_rows)

    phase_vector: dict[str, float] = {}
    # Weak letter contribution: tiny, informational only.
    for p in letters:
        ph = p.get("phase")
        if isinstance(ph, str):
            _phase_add(phase_vector, ph, 0.015)
    # Medium word contribution.
    for w in words:
        _phase_add(phase_vector, w.get("phase"), 0.18)
    # Strong phrase/operator contribution.
    for ev in phrases:
        _phase_add(phase_vector, ev.get("phase_vector") or {}, 1.0)

    gate_signals: dict[str, dict] = {}
    for ev in phrases + words:
        tg = ev.get("target_gate")
        targets = tg if isinstance(tg, list) else [tg]
        for gate in targets:
            if not gate:
                continue
            gate = str(gate)
            item = gate_signals.setdefault(gate, {"supports":0, "requires":0, "blocks":0, "violates":0, "events":[]})
            pol = str(ev.get("polarity") or "").lower()
            if pol in item:
                item[pol] += 1
            elif pol in {"bypasses"}:
                item["violates"] += 1
            item["events"].append(ev.get("matched_text"))

    circuit_candidate = any(v.get("circuit_breaker_candidate") for v in violations)
    projection_allowed: bool | str = False if circuit_candidate or syntactic.get("syntactic_drift") else "conditional_after_gates"
    memory_write_allowed = False  # Always false in B2 dry-run.
    recommended_route = _recommend_route(violations, syntactic, phase_vector)

    active_phase_codex_profiles = {
        phase: _codex_profile_for_phase(phase)
        for phase in sorted(phase_vector.keys())
        if _codex_profile_for_phase(phase)
    }
    codex_boundary = _codex_boundary() if _codex_boundary else {"status": "NOT_AVAILABLE", "read_only": True}

    return {
        "status": "OK",
        "mode": ENGINE_MODE,
        "read_only": True,
        "input": text,
        "source_metadata": source_metadata,
        "syntactic_firewall": syntactic,
        "letter_pulses": letters[:256],
        "letter_pulse_count": len(letters),
        "word_loops": words,
        "operator_phrases": phrases,
        "resonance_events": phrases + words,
        "phase_vector": dict(sorted(phase_vector.items())),
        "gate_signals": gate_signals,
        "phase_codex_binding": {
            "available": bool(_codex_boundary),
            "source": "FBSC Phase Glyph Codex v2.5",
            "engine_module_location": "forge/rmc_engine_v1/phase_codex.py",
            "active_phase_profiles": active_phase_codex_profiles,
            "boundary": codex_boundary,
        },
        "lexicon_audit_summary": (
            {
                "status": _lexicon_audit_report().get("status"),
                "counts": _lexicon_audit_report().get("counts"),
                "coverage_checks": _lexicon_audit_report().get("coverage_checks"),
            } if _lexicon_audit_report else {"status": "NOT_AVAILABLE"}
        ),
        "violations": violations,
        "circuit_breaker_candidate": circuit_candidate,
        "projection_allowed": projection_allowed,
        "final_language_allowed": False,
        "memory_write_allowed": memory_write_allowed,
        "recommended_route": recommended_route,
        "engine_boundary": resonance_lexicon_boundary(),
        "approved_output": False,
    }
