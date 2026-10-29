"""RMC Drift Engine v1 — Structural Contract Drift Analysis.

Patch 262J1R-Preflight-B1: drift engine hardening.

ENGINE MODE
-----------
"structural_contract_drift_analysis"

This engine classifies drift from phase_report structure and source text
signals. It is NOT the live ProtoForge2/memory-drift.py runtime engine.
It is built from the design documents and operates as a formal contract
layer until the live engine connector is activated.

Design sources
--------------
- The Recursive Manifest Compiler - Section 05.4 Drift Analyzer
- The Recursive Manifest Compiler - Appendix C Drift Taxonomy
- The Recursive Manifest Compiler - Section 06.3 Drift Functional

IMPROVEMENTS IN B1 OVER B
--------------------------
1. Honest engine mode label — "structural_contract_drift_analysis"
2. Real syntactic firewall: Shannon entropy, payload length, symbol/noise
   ratio, brace/quote balance, unsafe markers, schema Jaccard check
3. Negation-aware bypass detection: "bypass correction" = violation;
   "do not bypass correction" = NOT a violation
4. sigma_res renamed trace_instability conceptually (output key kept for
   formula compat); expanded to include phase conflict, category
   oscillation, and active-loop mismatch
5. delta_phi is now transition_legality_delta — penalizes illegal moves
   (Phi5->Phi8, Phi7 without Phi6, Phi8 without Phi6/Phi7, etc.)
   not merely wide phase spans
6. Thresholds explicitly labeled as rmc_preflight_conservative;
   design doc weighted form preserved as extension path

WHAT IT DOES NOT DO
-------------------
No LLM calls, no Chroma queries, no DB reads, no file writes,
no memory writes, no projection, no shell execution.
"""

from __future__ import annotations

import hashlib
import math
from collections import Counter
from dataclasses import dataclass, field, asdict
from typing import Any

try:
    from .resonance_lexicon import analyze_resonance as _analyze_resonance
except Exception:  # pragma: no cover - drift engine must remain standalone
    _analyze_resonance = None

ENGINE_VERSION = "rmc_drift_engine_v1_patch262J1R_preflight_B2"
ENGINE_MODE    = "structural_contract_drift_analysis"

# ── ProtoForge2 live engine hook ──────────────────────────────────────────────
_LIVE_ENGINE: Any          = None
_LIVE_ENGINE_IMPORTED: bool = False

# ── Threshold definitions (with honest labels) ────────────────────────────────
# These are conservative thresholds calibrated for RMC preflight mode.
# The design document (Section 6.3) defines thresholds as task-sensitive,
# output-sensitive, and phase-sensitive. A full RPMC implementation may
# calibrate different values per output target.
THRESHOLDS = {
    "bounded_preview":            0.20,  # rmc_preflight_conservative
    "chi_t_correction_required":  0.35,  # rmc_preflight_conservative
    "circuit_breaker":            0.72,  # rmc_preflight_conservative
    "label": "rmc_preflight_conservative",
    "note": (
        "These thresholds are calibrated for RMC preflight dry-run mode. "
        "Live ProtoForge2/RPMC doctrine thresholds are task-sensitive and "
        "output-sensitive; they may differ from these preflight values. "
        "See Section 6.3: 'theta should be task-sensitive, output-sensitive, "
        "and phase-sensitive.'"
    ),
}


# ── Data structures ───────────────────────────────────────────────────────────

@dataclass
class DriftEvent:
    """One classified drift occurrence (Appendix C drift record format)."""
    drift_key:          str
    drift_type:         str
    plain_meaning:      str
    score:              float
    severity:           str
    evidence:           list[str]
    projection_rule:    str
    correction_required: bool
    memory_handling:    str
    scorer_mode:        str = ENGINE_MODE

    def to_dict(self) -> dict:
        d = asdict(self)
        d["score"] = round(d["score"], 4)
        return d


@dataclass
class EpsilonComponents:
    """epsilon_s = (sigma_res + D_score + |delta_phi|) / n  (Section 6.3).

    Note on naming:
    sigma_res is kept as the output field name for formula compatibility.
    Internally it measures trace_instability across phase conflict,
    category oscillation, active-loop mismatch, and phase confidence spread.
    The boundary object documents what each term actually measures.
    """
    sigma_res:    float = 0.0
    D_score:      float = 0.0
    delta_phi:    float = 0.0
    epsilon_s:    float = 0.0
    n:            int   = 3

    def to_dict(self) -> dict:
        return {
            "sigma_res": round(self.sigma_res, 4),
            "D_score":   round(self.D_score, 4),
            "phase_deviation_normalized": round(self.delta_phi, 4),
            "epsilon_s": round(self.epsilon_s, 4),
            "n":         self.n,
            "formula":   "epsilon_s = (sigma_res + D_score + |delta_phi|) / n",
            "thresholds": THRESHOLDS,
            "sigma_res_measures": "trace_instability: phase_conflict + category_oscillation + loop_mismatch + confidence_spread",
            "delta_phi_measures": "transition_legality: illegal move penalties, not phase span",
        }


# ── Bypass / violation operator detection ─────────────────────────────────────

BYPASS_OPERATORS = [
    "bypass correction",
    "bypass naming",
    "bypass validation",
    "bypass governance",
    "skip correction",
    "skip naming",
    "skip validation",
    "skip the gate",
    "force projection",
    "force output",
    "publish anyway",
    "ignore the gate",
    "ignore validation",
    "ignore correction",
    "override correction",
    "override naming",
    "project now without correction",
    "project without correction",
    "project without naming",
    "project without validation",
    "without validation",
    "without correction",
]

# Negation tokens that precede a bypass phrase and cancel it
NEGATION_TOKENS = [
    "do not", "don't", "doesnt", "doesn't", "never", "not ",
    "should not", "shouldn't", "must not", "mustn't", "cannot",
    "can't", "won't", "would not", "wouldn't", "avoid", "prevent",
    "must avoid", "refusing to", "we should not", "you should not",
    "we must not",
]

_NEGATION_WINDOW_CHARS = 55  # look back this many chars for negation


def _detect_bypass_violations(source_text: str) -> list[dict]:
    """Detect bypass/violation operators with negation awareness.

    Algorithm:
      For each bypass phrase found in source_text:
        1. Find position of phrase
        2. Look at NEGATION_WINDOW_CHARS before it
        3. If any negation token is present → negated → NOT a violation
        4. If not negated → IS a violation

    This correctly handles:
      "bypass correction"          → violation     (no negation)
      "do not bypass correction"   → NOT violation (negated)
      "we should not skip naming"  → NOT violation (negated)
      "project without correction" → violation     (no negation)
    """
    text_lower = source_text.lower()
    violations = []
    for phrase in BYPASS_OPERATORS:
        pos = 0
        while True:
            idx = text_lower.find(phrase, pos)
            if idx == -1:
                break
            window_start = max(0, idx - _NEGATION_WINDOW_CHARS)
            window = text_lower[window_start:idx]
            negated = any(tok in window for tok in NEGATION_TOKENS)
            if not negated:
                violations.append({
                    "phrase":   phrase,
                    "position": idx,
                    "negated":  False,
                    "class":    "bypass_violation_operator",
                })
            pos = idx + 1
    return violations


# ── Taxonomy definitions ──────────────────────────────────────────────────────

def drift_taxonomy() -> dict:
    """Seven-category drift taxonomy (Appendix C of the RMC design document)."""
    return {
        "syntactic": {
            "label": "syntactic_drift",
            "plain": "The structure broke before meaning can be trusted.",
            "primary_evidence": "structural: schema Jaccard, entropy anomaly, symbol/noise, balance failure, unsafe markers",
            "projection_rule": "No syntactically invalid output may project as approved output.",
            "correction_path": "schema repair before any further processing",
            "memory_handling": "quarantine until structure is repaired; do not write to active memory",
        },
        "semantic": {
            "label": "semantic_drift",
            "plain": "The words or object remain valid, but meaning slips.",
            "primary_evidence": "structural: low confidence + projection phase; secondary: claim markers, bypass violations",
            "projection_rule": "Semantic drift above threshold blocks projection or requires re-render with limitations.",
            "correction_path": "phi6 correction with meaning re-anchor before phi7 naming",
            "memory_handling": "preserve with drift label; do not promote without correction",
        },
        "recursive": {
            "label": "recursive_drift",
            "plain": "The loop keeps turning without closure, ancestry, or improvement.",
            "primary_evidence": "structural: phase path loops, low phase span, repeated phase, entropy zone without correction",
            "projection_rule": "A recursively drifting loop may render status, but not closed final output.",
            "correction_path": "introduce phase movement; route to phi6 if corrections available",
            "memory_handling": "keep with loop-count flag; trigger correction after threshold",
        },
        "catastrophic": {
            "label": "catastrophic_drift",
            "plain": "The loop crossed a danger threshold threatening trace, privacy, projection, or memory integrity.",
            "primary_evidence": "structural: phase_skip_projection_risk, projection before gates; text: bypass violation operators",
            "projection_rule": "Projection blocked; circuit breaker must engage.",
            "correction_path": "full chi_t correction cycle required",
            "memory_handling": "route to SPC cold storage; log collapse trace; do not write to active memory",
        },
        "evolutionary": {
            "label": "evolutionary_drift",
            "plain": "Novel movement beyond existing memory that remains bounded and coherent.",
            "primary_evidence": "structural: branching phase path with maintained confidence; bounded novelty",
            "projection_rule": "May project only as bounded hypothesis, draft, simulation, or framework extension.",
            "correction_path": "not required if bounded; monitor for escalation",
            "memory_handling": "store as hypothesis candidate; do not promote to manifest without naming",
        },
        "resonant": {
            "label": "resonant_drift",
            "plain": "The output no longer fits the active loop, tone, timing, or phase posture.",
            "primary_evidence": "structural: routing mismatch, phase primary contradicts routing intent",
            "projection_rule": "Re-render with correct posture before approval.",
            "correction_path": "re-align with active loop context",
            "memory_handling": "soft quarantine; preserve for re-evaluation when context changes",
        },
        "structural": {
            "label": "structural_drift",
            "plain": "System bones out of order: pipeline, schema relationship, or authority path violated.",
            "primary_evidence": "structural: projection before correction+naming, pipeline order violation",
            "projection_rule": "Block or route back to correct module boundary.",
            "correction_path": "restore pipeline order; phi6 before phi7 before phi8",
            "memory_handling": "do not write; flag violation; operator review required",
        },
    }


# ── Feature extraction ────────────────────────────────────────────────────────

def _parse_phase_num(phase: Any) -> int | None:
    try:
        return int(str(phase or "").replace("\u03a6", "").replace("phi", "").strip())
    except Exception:
        return None


def _extract_features(phase_report: dict) -> dict:
    phase_state  = phase_report.get("phase_state")  or {}
    input_event  = phase_report.get("input_event")  or {}
    path:   list = phase_state.get("phase_path_hypothesis") or []
    warnings:list= phase_state.get("transition_warnings")   or []
    confidence   = float(phase_state.get("confidence") or 0.0)
    primary      = str(phase_state.get("phase_primary") or "")
    candidates:list = phase_state.get("phase_candidates") or []
    source_text  = str(input_event.get("x_t_raw_input_preview") or "")
    routing:list = phase_state.get("routing") or []

    nums_all = [n for n in [_parse_phase_num(p) for p in path] if n is not None]
    nums     = sorted(set(nums_all))
    span     = (max(nums) - min(nums)) if len(nums) >= 2 else 0
    primary_num = _parse_phase_num(primary)

    return {
        "path": path, "nums": nums, "nums_all": nums_all,
        "warnings": warnings, "confidence": confidence,
        "primary": primary, "primary_num": primary_num,
        "source_text": source_text,
        "source_missing": not bool(source_text.strip()),
        "candidates_empty": not bool(candidates),
        "candidates": candidates,
        "routing": routing,
        "phase_span": span,
        "has_phi5": 5 in nums, "has_phi6": 6 in nums,
        "has_phi7": 7 in nums, "has_phi9": 9 in nums,
        "has_phi8_or_9": any(n >= 8 for n in nums),
        "has_projection_skip": any(
            w.get("type") == "phase_skip_projection_risk" for w in warnings),
        "has_any_skip": bool(warnings),
        "repeated_phases": len(nums_all) != len(set(nums_all)),
    }


# ── Syntactic firewall ────────────────────────────────────────────────────────

def _shannon_entropy(text: str) -> float:
    if not text:
        return 0.0
    freq = Counter(text)
    total = len(text)
    return -sum((c / total) * math.log2(c / total) for c in freq.values())


def _classify_syntactic(f: dict, phase_report: dict) -> tuple[float, list]:
    """Multi-layer syntactic integrity firewall (B1 hardening)."""
    score, ev = 0.08, []
    src = f["source_text"]

    # ── Phase structure checks ─────────────────────────────────────────────
    if f["source_missing"]:
        score = max(score, 0.55); ev.append("structural:input_event_text_absent")
    if f["candidates_empty"]:
        score = max(score, 0.48); ev.append("structural:phase_candidates_empty")
    if not f["path"]:
        score = max(score, 0.52); ev.append("structural:phase_path_hypothesis_empty")
    if not f["primary"]:
        score = max(score, 0.40); ev.append("structural:phase_primary_absent")

    # ── Schema Jaccard check ───────────────────────────────────────────────
    expected = {"input_event", "phase_state"}
    actual   = set(phase_report.keys()) if phase_report else set()
    jaccard  = len(expected & actual) / max(1, len(expected | actual))
    if jaccard < 0.50:
        score = max(score, 0.48); ev.append(f"schema:low_jaccard={jaccard:.2f}")

    if src:
        # ── Shannon entropy ────────────────────────────────────────────────
        entropy = _shannon_entropy(src)
        if len(src) > 20 and entropy < 1.5:
            score = max(score, 0.58); ev.append(f"entropy:low={entropy:.2f}_repetitive_or_garbage")
        elif len(src) > 50 and entropy > 5.8:
            score = max(score, 0.42); ev.append(f"entropy:anomalous_high={entropy:.2f}_possibly_binary")

        # ── Payload length normalization ───────────────────────────────────
        if len(src) > 8000:
            score = max(score, 0.30); ev.append(f"payload:oversized={len(src)}_chars")

        # ── Symbol / noise ratio ───────────────────────────────────────────
        alphanum = sum(1 for c in src if c.isalnum() or c.isspace())
        snr = alphanum / max(1, len(src))
        if snr < 0.40:
            score = max(score, 0.52); ev.append(f"symbol_noise:low_alphanum_ratio={snr:.2f}")

        # ── Brace / quote balance ──────────────────────────────────────────
        for open_c, close_c in [('{','}'), ('[',']'), ('(',')'), ('"','"')]:
            if open_c == close_c:
                # quotes: just check even count
                if src.count(open_c) % 2 != 0 and src.count(open_c) > 4:
                    score = max(score, 0.36); ev.append(f"balance:odd_quote_count")
            else:
                diff = abs(src.count(open_c) - src.count(close_c))
                if diff > 3:
                    score = max(score, 0.38); ev.append(f"balance:unbalanced_{open_c}{close_c}_diff={diff}")

        # ── Unsafe shell / write markers ───────────────────────────────────
        unsafe_markers = [
            "import os", "os.system", "subprocess.call", "subprocess.run",
            "open(", "exec(", "eval(", "__import__", "shell=True", "os.popen",
            "shutil.rmtree", "os.remove", "os.unlink",
        ]
        found_unsafe = [m for m in unsafe_markers if m in src]
        if found_unsafe:
            score = max(score, 0.70); ev.append(f"unsafe:markers_found:{found_unsafe[:3]!r}")

    return round(min(score, 0.96), 4), ev


# ── Semantic classifier ───────────────────────────────────────────────────────

def _classify_semantic(f: dict) -> tuple[float, list]:
    score, ev = 0.08, []
    text = f["source_text"].lower()
    if f["has_phi8_or_9"] and f["confidence"] < 0.40:
        score = max(score, 0.62); ev.append("structural:projection_phase_with_low_confidence")
    if f["has_phi7"] and f["confidence"] < 0.25:
        score = max(score, 0.45); ev.append("structural:naming_phase_with_very_low_confidence")
    # Secondary text: claim inflation markers
    claim_markers = [m for m in ["proves", "guarantees", "solves", "confirmed as fact", "always true"]
                     if m in text]
    if claim_markers and f["confidence"] < 0.50:
        score = max(score, 0.55); ev.append(f"secondary:claim_inflation:{claim_markers[:2]!r}")
    return round(min(score, 0.96), 4), ev


# ── Recursive classifier ──────────────────────────────────────────────────────

def _classify_recursive(f: dict) -> tuple[float, list]:
    score, ev = 0.08, []
    if f["repeated_phases"]:
        score = max(score, 0.44); ev.append("structural:repeated_phase_in_path")
    if len(f["path"]) >= 3 and f["phase_span"] <= 1:
        score = max(score, 0.42); ev.append("structural:low_phase_movement_long_path")
    drift_zone = [n for n in f["nums"] if n in (4, 5)]
    if len(drift_zone) >= 2 and not f["has_phi6"]:
        score = max(score, 0.50); ev.append("structural:multiple_entropy_phases_without_correction")
    return round(min(score, 0.96), 4), ev


# ── Catastrophic classifier ───────────────────────────────────────────────────

def _classify_catastrophic(f: dict, bypass_violations: list) -> tuple[float, list]:
    """Catastrophic drift includes phase skips AND bypass violation operators."""
    score, ev = 0.08, []

    # Structural phase path violations
    if f["has_projection_skip"]:
        score = max(score, 0.84); ev.append("structural:phase_5_to_8_projection_skip_warning")
    if f["has_phi8_or_9"] and f["has_phi5"] and not (f["has_phi6"] and f["has_phi7"]):
        score = max(score, 0.78); ev.append("structural:projection_before_correction_and_naming")
    elif f["has_phi8_or_9"] and not f["has_phi6"]:
        score = max(score, 0.62); ev.append("structural:projection_without_correction_gate")
    if f["has_any_skip"] and f["phase_span"] >= 5:
        score = max(score, 0.70); ev.append("structural:large_phase_span_with_skip_warnings")

    # Bypass violation operators (from Appendix C C.5: "agent attempts to bypass governance")
    for v in bypass_violations:
        score = max(score, 0.82)
        ev.append(f"bypass_violation_operator:{v['phrase']!r}")

    return round(min(score, 0.96), 4), ev


# ── Evolutionary classifier ───────────────────────────────────────────────────

def _classify_evolutionary(f: dict) -> tuple[float, list]:
    score, ev = 0.08, []
    if f["phase_span"] >= 3 and f["confidence"] >= 0.25:
        score = max(score, 0.30); ev.append("structural:branching_path_with_maintained_confidence")
    if f["has_phi6"] and f["has_phi7"] and f["phase_span"] >= 2:
        score = max(score, 0.35); ev.append("structural:structured_evolution_through_correction_naming")
    return round(min(score, 0.55), 4), ev  # capped — never dominates as danger


# ── Resonant classifier ───────────────────────────────────────────────────────

def _classify_resonant(f: dict) -> tuple[float, list]:
    score, ev = 0.08, []
    pn = f["primary_num"]
    if pn is not None and pn >= 8:
        if not any("projection" in r for r in f["routing"]):
            score = max(score, 0.50); ev.append("structural:projection_primary_without_routing")
    if f["primary"] in ("\u03a66", "phi6") and f["confidence"] < 0.30:
        score = max(score, 0.38); ev.append("structural:correction_phase_low_confidence")
    if f["has_phi5"] and f["has_phi9"] and not f["has_phi6"]:
        score = max(score, 0.46); ev.append("structural:entropy_to_closure_without_correction")
    return round(min(score, 0.96), 4), ev


# ── Structural classifier ─────────────────────────────────────────────────────

def _classify_structural(f: dict) -> tuple[float, list]:
    score, ev = 0.08, []
    if f["has_phi8_or_9"] and not f["has_phi6"]:
        score = max(score, 0.72); ev.append("structural:projection_without_correction")
    if f["has_phi7"] and not f["has_phi6"]:
        score = max(score, 0.55); ev.append("structural:naming_without_correction")
    if f["has_any_skip"] and not f["has_projection_skip"]:
        score = max(score, 0.40); ev.append("structural:phase_skip_pipeline_review")
    return round(min(score, 0.96), 4), ev


# ── Severity ──────────────────────────────────────────────────────────────────

def _severity(score: float) -> str:
    if score >= 0.75: return "critical"
    if score >= 0.55: return "high"
    if score >= 0.35: return "moderate"
    if score >= 0.18: return "low"
    return "none"


# ── epsilon_s components ──────────────────────────────────────────────────────

def _compute_trace_instability(phase_report: dict) -> tuple[float, dict]:
    """sigma_res as trace_instability (B1: expanded beyond simple confidence spread).

    Measures instability across:
    1. Phase confidence spread (base)
    2. Phase conflict (multiple phases with similar high confidence)
    3. Category oscillation (path phases pulling in opposite directions)
    4. Active-loop mismatch (routing doesn't match primary phase routing)

    Output field keeps the name sigma_res for formula compatibility.
    """
    phase_state = phase_report.get("phase_state") or {}
    confidence  = float(phase_state.get("confidence") or 0.0)
    candidates  = phase_state.get("phase_candidates") or []
    primary     = str(phase_state.get("phase_primary") or "")
    routing     = phase_state.get("routing") or []
    path        = phase_state.get("phase_path_hypothesis") or []

    # 1. Base confidence spread (original sigma_res)
    base = max(0.0, 1.0 - confidence)
    component_detail = {"confidence_spread": round(base, 4)}

    # 2. Phase conflict: top-2 candidates close in confidence → system is unsure
    phase_conflict = 0.0
    if len(candidates) >= 2:
        vals = sorted([float(c.get("confidence") or 0.0) for c in candidates[:5]], reverse=True)
        if vals[0] > 0.0 and abs(vals[0] - vals[1]) < 0.08:
            phase_conflict = min(0.20, (0.08 - abs(vals[0] - vals[1])) * 2.5)
    component_detail["phase_conflict"] = round(phase_conflict, 4)

    # 3. Category oscillation: path has phases from both entropy zone (4,5) AND
    #    correction/naming zone (6,7) AND projection zone (8,9) simultaneously
    nums = [_parse_phase_num(p) for p in path]
    nums = [n for n in nums if n is not None]
    oscillation = 0.0
    entropy_zone     = any(n in (4, 5) for n in nums)
    correction_zone  = any(n in (6, 7) for n in nums)
    projection_zone  = any(n >= 8 for n in nums)
    if entropy_zone and projection_zone and not correction_zone:
        oscillation = 0.18  # entropy + projection with no correction = oscillating
    elif entropy_zone and correction_zone and projection_zone:
        oscillation = 0.08  # all zones present — complex but may be lawful
    component_detail["category_oscillation"] = round(oscillation, 4)

    # 4. Active-loop mismatch: primary phase has a routing directive; if that
    #    directive is not in the routing list, there's a mismatch
    loop_mismatch = 0.0
    primary_num = _parse_phase_num(primary)
    routing_expectations = {
        5: "drift_analyzer_required",
        6: "correction_gate_candidate",
        7: "naming_gate_candidate",
        8: "projection_gate",
    }
    if primary_num in routing_expectations:
        expected_route = routing_expectations[primary_num]
        if not any(expected_route in r for r in routing):
            loop_mismatch = 0.12
    component_detail["active_loop_mismatch"] = round(loop_mismatch, 4)

    sigma_res = round(min(1.0, base + phase_conflict + oscillation + loop_mismatch), 4)
    component_detail["sigma_res_total"] = sigma_res
    return sigma_res, component_detail


# ── Transition legality delta_phi ─────────────────────────────────────────────

# Illegal transition rules: (from_num_or_None, to_num, global_condition_fn, penalty, label)
# from_num_or_None = None means "check globally (Φto present but prerequisite missing)"
_TRANSITION_RULES: list[tuple] = [
    # Consecutive: Phi5 → Phi8+ (projection skip from drift)
    (5, 8,  None,                                                         0.84, "phi5_to_phi8_projection_skip"),
    (5, 9,  None,                                                         0.76, "phi5_to_phi9_closure_skip"),
    # Global: Phi8+ present without Phi6 AND Phi7
    (None, 8, lambda f: not f["has_phi6"] and not f["has_phi7"],          0.80, "projection_without_correction_and_naming"),
    # Global: Phi8+ present without Phi6 (but maybe has Phi7 out of order)
    (None, 8, lambda f: not f["has_phi6"] and f["has_phi7"],              0.72, "projection_without_correction"),
    # Global: Phi8+ present without Phi7
    (None, 8, lambda f: f["has_phi6"] and not f["has_phi7"],              0.60, "projection_without_naming"),
    # Global: Phi7 present without Phi6
    (None, 7, lambda f: not f["has_phi6"],                                0.55, "naming_without_correction"),
    # Global: Phi9 closure without correction OR naming
    (None, 9, lambda f: not f["has_phi6"] and not f["has_phi7"],          0.65, "closure_without_correction_and_naming"),
]


def _compute_transition_legality(f: dict) -> tuple[float, list]:
    """delta_phi as transition legality penalty (B1 replacement for phase span).

    Penalizes ILLEGAL phase movements specifically:
      - Phi5 → Phi8 skip (consecutive)
      - Projection (Phi8+) without correction (Phi6) and/or naming (Phi7)
      - Naming (Phi7) without correction (Phi6)
      - Closure (Phi9) without gates

    A lawful wide path (Phi1→Phi3→Phi6→Phi7→Phi9) has delta_phi=0.0
    because no illegal transitions are present, regardless of span.

    Returns (delta_phi, violations_list).
    """
    violations = []
    max_penalty = 0.0

    nums_all = f["nums_all"]  # in path order

    # Check consecutive transitions for hard skip rules
    for i in range(len(nums_all) - 1):
        a, b = nums_all[i], nums_all[i + 1]
        for from_p, to_p, cond, penalty, label in _TRANSITION_RULES:
            if from_p is not None and a == from_p and b >= to_p:
                max_penalty = max(max_penalty, penalty)
                violations.append({
                    "transition": f"\u03a6{a}\u2192\u03a6{b}",
                    "violation":  label,
                    "penalty":    penalty,
                    "type":       "consecutive",
                })

    # Check global path conditions (Phi present but prerequisite missing)
    for from_p, to_p, cond, penalty, label in _TRANSITION_RULES:
        if from_p is None and cond is not None:
            target_present = (to_p >= 8 and f["has_phi8_or_9"]) or (to_p == 7 and f["has_phi7"]) or (to_p == 9 and f["has_phi9"])
            if target_present and cond(f):
                # Only add if not already captured by a consecutive rule
                already = any(v["violation"] == label for v in violations)
                if not already:
                    max_penalty = max(max_penalty, penalty)
                    violations.append({
                        "transition": f"global:\u03a6{to_p}_present",
                        "violation":  label,
                        "penalty":    penalty,
                        "type":       "global_prerequisite",
                    })

    delta_phi = round(min(1.0, max_penalty), 4)
    return delta_phi, violations


def _compute_d_score(events: list) -> float:
    """D_score = max non-evolutionary destructive score (Section 6.3)."""
    return round(max((e.score for e in events if e.drift_key != "evolutionary"), default=0.0), 4)


# ── Public boundary ───────────────────────────────────────────────────────────

def drift_engine_boundary() -> dict:
    return {
        "engine_version":             ENGINE_VERSION,
        "engine_mode":                ENGINE_MODE,
        "engine_module_location":     "forge/rmc_engine_v1/drift_engine.py",
        "scoring_mode":               ENGINE_MODE,
        "synthetic_taxonomy_mode":    False,
        "keyword_counting_mode":      False,
        "real_memory_drift_engine_present": _LIVE_ENGINE_IMPORTED,
        "memory_drift_py_imported":   _LIVE_ENGINE_IMPORTED,
        "protoforge2_anchor_status":  "live_engine_bound" if _LIVE_ENGINE_IMPORTED else "contract_only",
        "primary_evidence_source":    "phase_report structure (path, confidence, warnings, routing)",
        "secondary_evidence_source":  "source_text (syntactic firewall, semantic drift, bypass detection)",
        "resonance_lexicon_available": _analyze_resonance is not None,
        "resonance_evidence_source": "rmc_engine_v1/resonance_lexicon.py resonance_events when available",
        "design_sources": [
            "RMC Section 05.4 Drift Analyzer",
            "RMC Appendix C Drift Taxonomy",
            "RMC Section 06.3 Drift Functional",
        ],
        "sigma_res_measures": "trace_instability: confidence_spread + phase_conflict + category_oscillation + active_loop_mismatch",
        "delta_phi_measures": "transition_legality: illegal move penalties (not phase span)",
        "thresholds": THRESHOLDS,
        "bypass_detection": "negation-aware; 'do not bypass correction' is NOT a violation",
        "ui_owns_drift_logic":      False,
        "main_py_owns_drift_logic": False,
        "engine_module_owns_drift_logic": True,
        "side_effect_free": True,
        "calls_llm":        False,
        "queries_chroma":   False,
        "reads_db_files":   False,
        "writes_files":     False,
        "writes_rmc_memory": False,
        "writes_identity_vault": False,
    }


# ── Main entry point ──────────────────────────────────────────────────────────

def analyze_drift(phase_report: dict) -> dict:
    """Analyze symbolic drift from a phase_parser output.

    Circuit Breaker Law (immutable)
    --------------------------------
    circuit_breaker_triggered = True when ANY of:
      1. catastrophic drift at critical severity (score >= 0.75)
      2. phase_skip_projection_risk in transition_warnings
      3. epsilon_s >= THRESHOLDS["circuit_breaker"]
    """
    if not isinstance(phase_report, dict):
        phase_report = {}

    if _LIVE_ENGINE_IMPORTED and _LIVE_ENGINE is not None:
        return _LIVE_ENGINE.analyze(phase_report)  # type: ignore

    input_event = phase_report.get("input_event") or {}
    phase_state = phase_report.get("phase_state") or {}
    source_text = str(input_event.get("x_t_raw_input_preview") or "")
    digest = hashlib.sha256(source_text.encode("utf-8", errors="replace")).hexdigest()[:16] if source_text else "empty_input"

    f = _extract_features(phase_report)
    taxonomy = drift_taxonomy()

    # Resonance lexicon evidence (B2): phrase/operator events outrank raw words.
    resonance_report = None
    resonance_bypass_violations = []
    if _analyze_resonance is not None:
        try:
            resonance_report = _analyze_resonance(source_text, {"source": "drift_engine"})
            for v in resonance_report.get("violations", []) if isinstance(resonance_report, dict) else []:
                if v.get("circuit_breaker_candidate"):
                    resonance_bypass_violations.append({
                        "phrase": str(v.get("matched_text") or v.get("operator") or "resonance_violation"),
                        "position": (v.get("evidence_span") or [0, 0])[0],
                        "negated": False,
                        "class": "resonance_operator_gate_violation",
                        "target_gate": v.get("target_gate"),
                    })
        except Exception as exc:  # keep drift engine read-only and resilient
            resonance_report = {"status": "ERROR", "error": str(exc), "read_only": True}

    # Bypass violation detection (negation-aware). Merge legacy text detection
    # with B2 resonance events; de-duplicate by phrase + position.
    legacy_bypass_violations = _detect_bypass_violations(source_text)
    seen = set()
    bypass_violations = []
    for item in legacy_bypass_violations + resonance_bypass_violations:
        key = (str(item.get("phrase")), int(item.get("position") or 0))
        if key not in seen:
            seen.add(key)
            bypass_violations.append(item)

    # Classify all seven categories
    syn_score,   syn_ev   = _classify_syntactic(f, phase_report)
    sem_score,   sem_ev   = _classify_semantic(f)
    rec_score,   rec_ev   = _classify_recursive(f)
    cat_score,   cat_ev   = _classify_catastrophic(f, bypass_violations)
    evo_score,   evo_ev   = _classify_evolutionary(f)
    res_score,   res_ev   = _classify_resonant(f)
    str_score,   str_ev   = _classify_structural(f)

    classifier_results = {
        "syntactic":    (syn_score, syn_ev),
        "semantic":     (sem_score, sem_ev),
        "recursive":    (rec_score, rec_ev),
        "catastrophic": (cat_score, cat_ev),
        "evolutionary": (evo_score, evo_ev),
        "resonant":     (res_score, res_ev),
        "structural":   (str_score, str_ev),
    }

    events: list[DriftEvent] = []
    for key, spec in taxonomy.items():
        score, evidence = classifier_results[key]
        sev = _severity(score)
        events.append(DriftEvent(
            drift_key=key, drift_type=spec["label"],
            plain_meaning=spec["plain"], score=score, severity=sev,
            evidence=evidence or ["no_marker_detected"],
            projection_rule=spec["projection_rule"],
            correction_required=(sev in ("moderate", "high", "critical") and key != "evolutionary"),
            memory_handling=spec["memory_handling"],
        ))
    events.sort(key=lambda e: e.score, reverse=True)

    # epsilon_s components
    sigma_res, sigma_detail = _compute_trace_instability(phase_report)
    d_score = _compute_d_score(events)
    delta_phi, delta_violations = _compute_transition_legality(f)
    epsilon_s = round((sigma_res + d_score + delta_phi) / 3.0, 4)
    eps = EpsilonComponents(sigma_res=sigma_res, D_score=d_score, delta_phi=delta_phi, epsilon_s=epsilon_s)

    # Circuit breaker
    has_critical_catastrophic = any(e.drift_key == "catastrophic" and e.severity == "critical" for e in events)
    has_skip = f["has_projection_skip"]
    cb_threshold = THRESHOLDS["circuit_breaker"]
    circuit_breaker = bool(has_critical_catastrophic or has_skip or epsilon_s >= cb_threshold)

    if has_critical_catastrophic and has_skip:
        cb_reason = "critical catastrophic drift AND phase_5_to_8_projection_skip"
    elif has_critical_catastrophic and bypass_violations:
        cb_reason = f"critical catastrophic drift from bypass_violation_operators: {[v['phrase'] for v in bypass_violations]!r}"
    elif has_critical_catastrophic:
        cb_reason = "catastrophic drift at critical severity (score >= 0.75)"
    elif has_skip:
        cb_reason = "phase_5_to_8_projection_skip in transition_warnings"
    elif epsilon_s >= cb_threshold:
        cb_reason = f"epsilon_s={epsilon_s:.4f} >= circuit_breaker_threshold={cb_threshold}"
    else:
        cb_reason = ""

    chi_threshold = THRESHOLDS["chi_t_correction_required"]
    chi_required = bool(circuit_breaker or epsilon_s >= chi_threshold or any(e.correction_required for e in events))

    bounded_preview_threshold = THRESHOLDS["bounded_preview"]
    if circuit_breaker:
        proj_status = "blocked_circuit_breaker"
        action = "block_projection_route_to_correction_or_cold_storage"
    elif chi_required:
        proj_status = "blocked_until_chi_t_correction"
        action = "correction_gate_required_before_candidate_generation"
    elif epsilon_s >= bounded_preview_threshold:
        proj_status = "bounded_preview_only"
        action = "carry_drift_report_forward_with_limitations"
    else:
        proj_status = "low_drift_preview_only"
        action = "candidate_dry_run_allowed_no_projection_or_write"

    boundary = drift_engine_boundary()
    return {
        "drift_report_id": f"drift_structural_contract_{digest}",
        "mode":            ENGINE_MODE,
        "source_input_id": str(input_event.get("event_id") or "unknown"),
        "engine_boundary": boundary,
        "resonance_lexicon": resonance_report or {"status": "NOT_AVAILABLE", "read_only": True},
        "drift_taxonomy_anchor": {
            "protoforge2_anchor_status": boundary["protoforge2_anchor_status"],
            "scoring_mode": boundary["scoring_mode"],
            "taxonomy_categories": list(taxonomy.keys()),
            "epsilon_s_formula": "epsilon_s = (sigma_res + D_score + |delta_phi|) / n",
            "sigma_res_measures": boundary["sigma_res_measures"],
            "delta_phi_measures": boundary["delta_phi_measures"],
            "thresholds_label": THRESHOLDS["label"],
            "design_sources": boundary["design_sources"],
        },
        "drift_classes": [e.to_dict() for e in events],
        "epsilon_s": eps.to_dict(),
        "sigma_detail": sigma_detail,
        "transition_violations": delta_violations,
        "bypass_violations_detected": bypass_violations,
        "phase_drift": {
            "phase_path_hypothesis": f["path"],
            "phase_deviation_raw": len(delta_violations),
            "phase_primary": phase_state.get("phase_primary"),
            "transition_warnings": f["warnings"],
            "phase_skip_detected": bool(f["warnings"]),
        },
        "chi_t": {
            "required": chi_required,
            "status": "required_before_projection" if chi_required else "not_required_for_preview",
            "note": "chi_t is a correction gate; no correction executed in this engine module.",
        },
        "circuit_breaker": {
            "triggered": circuit_breaker,
            "reason": cb_reason,
            "status": "projection_blocked" if circuit_breaker else "not_triggered",
            "triggers": {
                "critical_catastrophic_drift":   has_critical_catastrophic,
                "bypass_violations_present":     bool(bypass_violations),
                "phase_5_to_8_projection_skip":  has_skip,
                "epsilon_s_above_threshold":     epsilon_s >= cb_threshold,
                "epsilon_s":                     round(epsilon_s, 4),
                "circuit_breaker_threshold":     cb_threshold,
                "threshold_label":               THRESHOLDS["label"],
            },
        },
        "projection_status": proj_status,
        "recommended_action": action,
        "writes_files":         False,
        "identity_vault_write": False,
        "rmc_live_memory_write": False,
        "approved_output":      False,
        "engine_version":       ENGINE_VERSION,
    }
