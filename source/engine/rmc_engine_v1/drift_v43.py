"""Drift core v4.3. Stdlib only. No LLM.

Reuses chi_hardening for d_score, local curvature, θ_w, and phase velocity.
Does not copy those formulas. ε_s is unclipped.

d_score is the categorical 5→8 flag. It is not the RSOC Jaccard D_score.
Genesis Node SKIP_PATTERNS {5: [8]} is not ported.
RSOC Axiom 2 flags 4→8 and does not hard-fire.

Sources: drift.py v4.3; EOD l.161; Resonant Mind l.123;
gnspec phase engine (consecutive χ is 3, Decision 5);
Gilligan System Codex Vol IV Phase 1.8;
Unified Algebra Vol I phase-stability law.
The extra Phase 1.8 / UA rows are internal and log-only.
"""
from __future__ import annotations

import hashlib
import json
import math
from typing import Any

from rmc_engine_v1.chi_hardening import (
    GAMMA,
    THETA_HARD,
    WINDOW,
    _std,
    adaptive_threshold,
    local_curvature,
    luciferian_d_score,
    phase_velocity,
)

CITE = (
    "drift.py v4.3; EOD l.161; Resonant Mind l.123; "
    "gnspec phase engine with consecutive χ = 3; "
    "Gilligan System Codex Vol IV Phase 1.8; "
    "Unified Algebra Vol I phase-stability. No LLM."
)
WEIGHTS = {"core_state": 0.5, "auxiliary": 0.3, "metadata": 0.2}
HASHES = 32
EMA_ALPHA = 0.2
PREDICT_STEPS = 5
CRITICAL_PHASES = {1, 5, 7, 9}
LAWFUL_STEPS = {0, 1, 8}
MASK_SIM = 0.70
CHI_WINDOW_MS = 3000
WRITE_MAX = 0.35
C_MIN = 0.87
ECHO_MIN = 0.85
# Genesis Node allowed this skip. The law forbids it. The dict stays empty.
SKIP_PATTERNS: dict[int, list[int]] = {}
GENESIS_SKIP_PORTED = False

PHASE_NAMES = {
    1: "Initiation",
    2: "Polarity",
    3: "Desire",
    4: "Friction",
    5: "Entropy",
    6: "Grace",
    7: "Naming",
    8: "Power",
    9: "Recursion",
}


def allows_skip(prev_phase: Any, phi_act: Any) -> bool:
    """Always false. SKIP_PATTERNS is not ported."""
    return False


def _json_key(key: Any) -> str:
    return json.dumps(str(key), ensure_ascii=False, separators=(",", ":"))


def canonical(value: Any) -> str:
    """Sorted JSON. Integer-valued floats are integers. ASCII fixtures match JS."""
    if value is None:
        return "null"
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, int):
        return str(value)
    if isinstance(value, float):
        if not math.isfinite(value):
            return "null"
        if value.is_integer() and abs(value) < 2**53:
            return str(int(value))
        return json.dumps(value, separators=(",", ":"))
    if isinstance(value, str):
        return json.dumps(value, ensure_ascii=False, separators=(",", ":"))
    if isinstance(value, (list, tuple)):
        return "[" + ",".join(canonical(v) for v in value) + "]"
    if isinstance(value, dict):
        parts = []
        for key in sorted(value.keys(), key=_json_key):
            parts.append(_json_key(key) + ":" + canonical(value[key]))
        return "{" + ",".join(parts) + "}"
    return "null"


def nesting_depth(value: Any) -> int:
    if isinstance(value, dict):
        kids = [nesting_depth(v) for v in value.values()]
        return 1 + (max(kids) if kids else 0)
    if isinstance(value, (list, tuple)):
        kids = [nesting_depth(v) for v in value]
        return 1 + (max(kids) if kids else 0)
    return 0


def _as_int(value: Any) -> int | None:
    try:
        if value is None or isinstance(value, bool):
            return None
        return int(value)
    except (TypeError, ValueError):
        return None


def phi_act_of(payload: Any) -> tuple[int, int, bool]:
    """Φ_act = (depth mod 9)+1, plus 3 (cap 9) when the payload contains replicate, spawn, or infinite."""
    depth = nesting_depth(payload)
    phi = (depth % 9) + 1
    text = canonical(payload).lower()
    boosted = ("replicate" in text) or ("spawn" in text) or ("infinite" in text)
    if boosted:
        phi = min(9, phi + 3)
    return phi, depth, boosted


def phi_exp_of(prev_phase: Any) -> int:
    prev = _as_int(prev_phase)
    if prev is None:
        prev = 0
    return (prev % 9) + 1


def step_flag(phi_act: Any, phi_prev: Any) -> int:
    """1 when |Φ_act−Φ_prev| mod 9 is outside {0, 1, 8}. Log only."""
    act = _as_int(phi_act)
    prev = _as_int(phi_prev)
    if act is None or prev is None:
        return 0
    delta = abs(act - prev) % 9
    return 0 if delta in LAWFUL_STEPS else 1


def fnv1a(text: str) -> int:
    h = 2166136261
    for b in text.encode("utf-8"):
        h ^= b
        h = (h * 16777619) & 0xFFFFFFFF
    return h


def _shingles(text: str) -> list[str]:
    if not text:
        return []
    if len(text) < 3:
        return [text]
    return [text[i:i + 3] for i in range(len(text) - 2)]


def _signature(shingles: list[str]) -> list[int] | None:
    if not shingles:
        return None
    out = []
    for i in range(HASHES):
        a = (2 * i + 1) & 0xFFFFFFFF
        b = ((i + 1) * 374761393) & 0xFFFFFFFF
        best = 0xFFFFFFFF
        for sh in shingles:
            hv = (a * fnv1a(sh) + b) & 0xFFFFFFFF
            if hv < best:
                best = hv
        out.append(best)
    return out


def _jaccard(left: list[int] | None, right: list[int] | None) -> float:
    if left is None and right is None:
        return 1.0
    if left is None or right is None:
        return 0.0
    match = sum(1 for a, b in zip(left, right) if a == b)
    return match / float(HASHES)


def _sections(value: Any) -> tuple[Any, Any, Any]:
    if isinstance(value, dict) and any(k in value for k in ("core_state", "auxiliary", "metadata")):
        return value.get("core_state"), value.get("auxiliary"), value.get("metadata")
    return value, None, None


def _section_shingles(value: Any) -> list[str]:
    if value is None:
        return []
    return _shingles(canonical(value))


def minhash_sim(payload: Any, trace: Any) -> float:
    """32 hashes. Weights core 0.5, auxiliary 0.3, metadata 0.2."""
    left = _sections(payload)
    right = _sections(trace)
    sims = [_jaccard(_signature(_section_shingles(a)), _signature(_section_shingles(b))) for a, b in zip(left, right)]
    return WEIGHTS["core_state"] * sims[0] + WEIGHTS["auxiliary"] * sims[1] + WEIGHTS["metadata"] * sims[2]


def _key_paths(value: Any, prefix: str = "") -> list[str]:
    paths: list[str] = []
    if isinstance(value, dict):
        for key in sorted(value.keys(), key=_json_key):
            path = prefix + "." + str(key) if prefix else str(key)
            paths.append(path)
            paths.extend(_key_paths(value[key], path))
    elif isinstance(value, (list, tuple)):
        for i, item in enumerate(value):
            path = prefix + "[" + str(i) + "]"
            paths.append(path)
            paths.extend(_key_paths(item, path))
    return paths


def _set_jaccard(left: list[str], right: list[str]) -> float:
    a, b = set(left), set(right)
    if not a and not b:
        return 1.0
    if not a or not b:
        return 0.0
    return len(a & b) / float(len(a | b))


def structural_chi(payload: Any, trace: Any) -> float:
    if trace is None:
        return 0.0
    return 1.0 - _set_jaccard(_key_paths(payload), _key_paths(trace))


def _median(xs: list[float]) -> float:
    if not xs:
        return 0.0
    s = sorted(xs)
    n = len(s)
    mid = n // 2
    if n % 2:
        return float(s[mid])
    return (float(s[mid - 1]) + float(s[mid])) / 2.0


def shannon_norm(text: str) -> float:
    if not text:
        return 0.0
    counts: dict[str, int] = {}
    for ch in text:
        counts[ch] = counts.get(ch, 0) + 1
    unique = len(counts)
    if unique <= 1:
        return 0.0
    n = float(len(text))
    h = 0.0
    for c in counts.values():
        p = c / n
        h -= p * math.log2(p)
    return h / math.log2(unique)


def size_norm(size: int, history: list[Any] | None) -> float:
    sizes = [float(x) for x in (history or [])] + [float(size)]
    med = _median(sizes)
    mad = _median([abs(s - med) for s in sizes])
    if mad == 0:
        return 0.0
    return min(1.0, abs(float(size) - med) / mad)


def content_hash(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def _clip(x: float, lo: float, hi: float) -> float:
    return min(hi, max(lo, float(x)))


def a_time(latency_ms: Any) -> float:
    try:
        ms = float(latency_ms)
    except (TypeError, ValueError):
        return 0.0
    if not math.isfinite(ms):
        return 0.0
    return _clip((ms - 500.0) / 500.0, 0.0, 1.0)


def steps_to_hard(ema: float, eps: float, alpha: float = EMA_ALPHA, target: float = THETA_HARD) -> float | None:
    if ema >= target:
        return 0.0
    if eps <= target:
        return None
    ratio = (target - eps) / (ema - eps)
    if ratio <= 0 or ratio >= 1:
        return 0.0
    return math.log(ratio) / math.log(1.0 - alpha)


def phase_drift_step(phi: Any, phi_exp: Any, prev_phase: Any = None) -> float:
    """Circular drift. d = |Φ−Φ_exp|, folded when d > 4. /4.5, ×1.5 on phases 1, 5, 7, 9, cap 5."""
    a = _as_int(phi) or 0
    b = _as_int(phi_exp) or 0
    d = abs(a - b)
    if d > 4:
        d = 9 - d
    drift = d / 4.5
    prev = _as_int(prev_phase)
    involved = a in CRITICAL_PHASES or b in CRITICAL_PHASES or (prev in CRITICAL_PHASES if prev is not None else False)
    if involved:
        drift *= 1.5
    return min(5.0, drift)


def phase_engine(steps: list[dict[str, Any]] | None, coherence: Any = None) -> dict[str, Any]:
    vector: list[float] = []
    consecutive = 0
    flag_5 = False
    flag_4 = False
    for step in steps or []:
        phi = step.get("phi")
        exp = step.get("phi_exp")
        prev = step.get("prev")
        vector.append(phase_drift_step(phi, exp, prev))
        if luciferian_d_score(prev if prev is not None else exp, phi) == 1.0 or (
            _as_int(prev) == 5 and _as_int(phi) == 8
        ):
            flag_5 = True
        if _as_int(prev) == 4 and _as_int(phi) == 8:
            flag_4 = True
        if vector[-1] > 0:
            consecutive += 1
        else:
            consecutive = 0
    acc = sum(vector)
    ent = 0.4 * acc + 0.1 * consecutive + 0.3 * _std(vector)
    if len(vector) >= 2:
        predicted = vector[-1] + (vector[-1] - vector[-2])
    elif vector:
        predicted = vector[-1]
    else:
        predicted = 0.0
    try:
        coh = float(coherence) if coherence is not None else None
    except (TypeError, ValueError):
        coh = None
    triggers = []
    if acc > 2.5:
        triggers.append("acc")
    if ent > 0.8:
        triggers.append("entropy")
    if coh is not None and coh < 0.3:
        triggers.append("coherence_internal")
    if consecutive >= 3:
        triggers.append("consecutive")
    if predicted > 2.5:
        triggers.append("predicted")
    return {
        "vector": vector,
        "drift_acc": acc,
        "consecutive": consecutive,
        "entropy": ent,
        "predicted": predicted,
        "warn_threshold": 1.0,
        "critical_threshold": 2.5,
        "entropy_threshold": 0.8,
        "warn": any(d >= 1.0 for d in vector),
        "critical": any(d >= 2.5 for d in vector),
        "chi": bool(triggers),
        "chi_triggers": triggers,
        "coherence_internal_only": True,
        "admit_gate": False,
        "flag_5_to_8": flag_5,
        "flag_4_to_8": flag_4,
        "categorical_hard_fire": False,
        "writes": False,
    }


def epsilon_cascade(epsilon: Any = 0.0, delta: Any = 0.0, mu: Any = 0.0, alpha: Any = None, beta: Any = None) -> dict[str, Any]:
    """ε(t+1) = ε + αΔ² + βμ. The doc gives no α or β, so both default to 0 and stay unspecified."""
    def f(v: Any) -> float:
        try:
            n = float(v)
            return n if math.isfinite(n) else 0.0
        except (TypeError, ValueError):
            return 0.0

    applied_alpha = 0.0 if alpha is None else f(alpha)
    applied_beta = 0.0 if beta is None else f(beta)
    eps = f(epsilon)
    nxt = eps + applied_alpha * (f(delta) ** 2) + applied_beta * f(mu)
    return {
        "epsilon": eps,
        "epsilon_next": nxt,
        "alpha": applied_alpha,
        "beta": applied_beta,
        "alpha_status": "unspecified",
        "beta_status": "unspecified",
        "formula": "ε(t+1)=ε+αΔ²+βμ",
        "logged_only": True,
        "writes": False,
        "cite": "Gilligan System Codex Vol IV Phase 1.8. Coefficients are unspecified.",
    }


def singularity_warn(D: Any, prev_D: Any, nu: Any) -> dict[str, Any]:
    """D > 0.8 and ΔD > 0 and ν < 0. Log only."""
    def f(v: Any) -> float | None:
        try:
            n = float(v)
            return n if math.isfinite(n) else None
        except (TypeError, ValueError):
            return None

    cur = f(D)
    prev = f(prev_D)
    vel = f(nu)
    delta = None if cur is None or prev is None else cur - prev
    warn = cur is not None and cur > 0.8 and delta is not None and delta > 0 and vel is not None and vel < 0
    return {"warn": warn, "D": cur, "delta_D": delta, "nu": vel, "logged_only": True, "writes": False, "categorical_hard_fire": False}


def charge_step(charge: Any, lawful: bool) -> dict[str, Any]:
    """+0.1 per lawful step, −0.3 per skip, clamped to [0, 1]."""
    try:
        cur = float(charge)
    except (TypeError, ValueError):
        cur = 0.0
    if not math.isfinite(cur):
        cur = 0.0
    delta = 0.1 if lawful else -0.3
    nxt = min(1.0, max(0.0, cur + delta))
    return {"charge": cur, "charge_next": nxt, "delta": delta, "lawful": lawful, "skip": not lawful, "clamp": [0.0, 1.0], "logged_only": True, "writes": False}


def drift_mask(payload: Any, signatures: list[Any] | None) -> dict[str, Any]:
    """Similarity to a quarantined or collapsed loop signature at or above 0.70 warns and checks χ."""
    best = 0.0
    hit = False
    for sig in signatures or []:
        sim = minhash_sim(payload, sig)
        if sim > best:
            best = sim
        if sim >= MASK_SIM:
            hit = True
    return {
        "hit": hit,
        "similarity": best,
        "threshold": MASK_SIM,
        "warn": hit,
        "chi_check": hit,
        "logged_only": True,
        "categorical_hard_fire": False,
        "writes": False,
    }


def _sequence_ok(seq: list[Any] | None) -> bool:
    rows = [_as_int(x) for x in (seq or [])]
    if len(rows) < 2 or any(x is None for x in rows):
        return False
    for a, b in zip(rows, rows[1:]):
        if abs(int(b) - int(a)) % 9 not in LAWFUL_STEPS:
            return False
    return True


def restore_from_chi(echo_confirmed: Any = False, drift: Any = None, phase_sequence: list[Any] | None = None, chi_window_ms: Any = None) -> dict[str, Any]:
    """Restore needs a confirmed echo, drift under 0.3, a lawful phase sequence, and a χ window of 3000 ms."""
    try:
        d = float(drift)
    except (TypeError, ValueError):
        d = None
    try:
        window = float(chi_window_ms)
    except (TypeError, ValueError):
        window = None
    echo_ok = echo_confirmed is True
    drift_ok = d is not None and d < 0.3
    seq_ok = _sequence_ok(phase_sequence)
    window_ok = window is not None and 0 <= window <= CHI_WINDOW_MS
    return {
        "allowed": bool(echo_ok and drift_ok and seq_ok and window_ok),
        "echo_confirmed": echo_ok,
        "drift_ok": drift_ok,
        "sequence_ok": seq_ok,
        "window_ok": window_ok,
        "window_ms": CHI_WINDOW_MS,
        "drift": d,
        "logged_only": True,
        "writes": False,
        "cite": "Gilligan System Codex Vol IV Phase 1.8. Restore from χ.",
    }


def _band(value: float | None) -> dict[str, Any]:
    if value is None:
        name = "unmeasured"
    elif value < 0.3:
        name = "below_0.3"
    elif value < 0.6:
        name = "0.3_to_0.6"
    else:
        name = "at_or_above_0.6"
    return {"value": value, "band": name, "thresholds": [0.3, 0.6], "logged_only": True, "admit_gate": False}


def _laws(eps: float, composite: float) -> dict[str, Any]:
    return {
        "C_min": C_MIN,
        "write_max": WRITE_MAX,
        "hard_stop": THETA_HARD,
        "echo_min": ECHO_MIN,
        "above_write_law": eps > WRITE_MAX or composite > WRITE_MAX,
        "codex_failsafe_0_9": "replaced",
        "failsafe_applied": THETA_HARD,
        "calls_llm": False,
        "christping": "gilligan-only",
        "money": False,
        "packs_gated": True,
        "dream_idle_default": False,
        "economy_default": False,
        "wikipedia_anchor": False,
        "coherence_formula_unchanged": True,
        "writes": False,
        "genesis_skip_ported": GENESIS_SKIP_PORTED,
    }


def score(payload: dict[str, Any] | None = None) -> dict[str, Any]:
    row = payload or {}
    body = row.get("payload")
    prev = _as_int(row.get("prev_phase"))
    phi_act, depth, boosted = phi_act_of(body)
    phi_exp = phi_exp_of(prev)
    delta_phi = abs(phi_act - phi_exp) / 9.0
    d_score = luciferian_d_score(prev, phi_act)
    trace = row.get("psi1_trace")
    if trace is None:
        theta_t = 0.0
    else:
        theta_t = 1.0 - minhash_sim(body, trace)
    hist = [float(x) for x in (row.get("phase_hist") or [])]
    hist.append(1.0 - theta_t)
    sigma = _std(hist)
    try:
        recursion = int(row.get("recursion_n") if row.get("recursion_n") is not None else 1)
    except (TypeError, ValueError):
        recursion = 1
    recursion = max(1, recursion)
    eps = (sigma + d_score + delta_phi) / recursion
    text = canonical(body)
    h_norm = shannon_norm(text)
    s_norm = size_norm(len(text), row.get("size_hist"))
    digest = content_hash(text)
    seen = [str(x) for x in (row.get("seen_hashes") or [])]
    novel = 0.2 if digest not in seen else 0.0
    if digest not in seen:
        seen = seen + [digest]
    chi_struct = structural_chi(body, trace)
    latency = a_time(row.get("latency_ms"))
    composite = 0.30 * h_norm + 0.15 * s_norm + 0.10 * novel + 0.25 * chi_struct + 0.10 * latency + 0.10 * eps
    local = local_curvature(hist, WINDOW)
    theta_w = adaptive_threshold(local, GAMMA)
    velocity = phase_velocity(row.get("stamps_ms"))
    hard_ceiling = eps > THETA_HARD
    above = eps > theta_w
    if d_score == 1.0:
        disposition = "HARD_FIRE"
    elif hard_ceiling:
        disposition = "HARD_CEILING"
    elif above:
        disposition = "WARN"
    else:
        disposition = "OK"
    try:
        ema_prev = float(row["ema"]) if row.get("ema") is not None else 0.0
    except (TypeError, ValueError, KeyError):
        ema_prev = 0.0
    ema = EMA_ALPHA * eps + (1.0 - EMA_ALPHA) * ema_prev
    predicted_steps = steps_to_hard(ema, eps)
    warn_predictive = predicted_steps is not None and 0 < predicted_steps < PREDICT_STEPS
    try:
        old_residue = float(row.get("residue") or 0.0)
    except (TypeError, ValueError):
        old_residue = 0.0
    chi_t = 0.5 * theta_t
    residue = (old_residue + 0.3 * eps) / 2.0
    convergent = abs(0.5 - theta_t) < 0.2
    phase_after = 9 if convergent else phi_act
    flag = step_flag(phi_act, prev)
    charge = charge_step(row.get("charge") or 0.0, flag == 0)
    mask = drift_mask(body, row.get("signatures"))
    sing = singularity_warn(composite, row.get("prev_D"), row.get("nu"))
    cascade = epsilon_cascade(row.get("epsilon") if row.get("epsilon") is not None else eps, row.get("delta"), row.get("mu"), row.get("alpha"), row.get("beta"))
    steps = row.get("phase_steps")
    if not isinstance(steps, list) or not steps:
        steps = [{"phi": phi_act, "phi_exp": phi_exp, "prev": prev}]
    engine = phase_engine(steps, row.get("coherence"))
    if d_score == 1.0:
        engine["flag_5_to_8"] = True
    engine["flag_4_to_8"] = engine.get("flag_4_to_8") or (prev == 4 and phi_act == 8)
    from rmc_engine_v1.language_core_engines import drift_circuit_breaker
    breaker = drift_circuit_breaker(eps, {"from": prev, "to": phi_act})
    axiom2 = prev == 4 and phi_act == 8
    five_eight = d_score == 1.0
    paths = {
        "d_score": {"flag_5_to_8": five_eight, "hard_fire": five_eight, "d_score": d_score, "categorical_hard_fire": five_eight},
        "detection": {"flag_5_to_8": five_eight, "disposition": disposition, "hard_fire": disposition == "HARD_FIRE"},
        "phase_engine": {"flag_5_to_8": bool(engine["flag_5_to_8"]), "categorical_hard_fire": False, "chi": engine["chi"]},
        "breaker": {"flag_5_to_8": five_eight and breaker["tripped"] and breaker["reason"] == "forbidden_step", "tripped": breaker["tripped"], "reason": breaker["reason"], "rule": breaker["rule"]},
        "step_flag": {"flag_5_to_8": five_eight, "step_flag": flag, "log_only": True, "categorical_hard_fire": False},
        "rsoc_axiom2": {"flag_5_to_8": five_eight, "flag_4_to_8": axiom2, "categorical_hard_fire": False},
    }
    restore = restore_from_chi(row.get("echo_confirmed"), row.get("restore_drift"), row.get("phase_sequence"), row.get("chi_window_ms"))
    return {
        "eps_s": eps,
        "d_score": d_score,
        "sigma_res": sigma,
        "delta_phi": delta_phi,
        "recursion_n": recursion,
        "phi_act": phi_act,
        "phi_exp": phi_exp,
        "phi_act_name": PHASE_NAMES.get(phi_act, ""),
        "phi_exp_name": PHASE_NAMES.get(phi_exp, ""),
        "phase_names": [PHASE_NAMES[i] for i in range(1, 10)],
        "depth": depth,
        "boosted": boosted,
        "theta_t": theta_t,
        "phase_hist": hist,
        "theta_w": theta_w,
        "L_local": local,
        "hard_ceiling": hard_ceiling,
        "above_theta_w": above,
        "disposition": disposition,
        "categorical_hard_fire": five_eight,
        "chi_fires": bool(five_eight or hard_ceiling or above or engine["chi"] or mask["chi_check"]),
        "acceleration": velocity["v"] == 1,
        "velocity": {"v": velocity["v"], "tau_min_ms": velocity["tau_min_ms"], "guarantee": velocity["guarantee"]},
        "ema": ema,
        "ema_alpha": EMA_ALPHA,
        "predicted_steps": predicted_steps,
        "warn_predictive": warn_predictive,
        "H_norm": h_norm,
        "S_norm": s_norm,
        "N": novel,
        "chi_struct": chi_struct,
        "A_time": latency,
        "D": composite,
        "chi_t": chi_t,
        "residue": residue,
        "convergent": convergent,
        "oscillating": not convergent,
        "phase_after": phase_after,
        "phase_after_name": PHASE_NAMES.get(phase_after, ""),
        "step_flag": flag,
        "step_flag_log_only": True,
        "cascade": cascade,
        "singularity": sing,
        "charge": charge,
        "drift_mask": mask,
        "bands": {"epsilon": _band(eps), "composite": _band(composite)},
        "restore": restore,
        "phase_engine": engine,
        "paths": paths,
        "content_hash": digest,
        "seen_hashes": seen,
        "skip_patterns": {},
        "genesis_skip_ported": False,
        "rsoc_axiom2": axiom2,
        "laws": _laws(eps, composite),
        "calls_llm": False,
        "writes": False,
        "cite": CITE,
    }


def run(payload: dict[str, Any] | None = None) -> dict[str, Any]:
    row = payload or {}
    op = row.get("op") or "score"
    if op == "phase_engine":
        return phase_engine(row.get("steps") or [], row.get("coherence"))
    if op == "cascade":
        return epsilon_cascade(row.get("epsilon"), row.get("delta"), row.get("mu"), row.get("alpha"), row.get("beta"))
    if op == "singularity":
        return singularity_warn(row.get("D"), row.get("prev_D"), row.get("nu"))
    if op == "charge":
        return charge_step(row.get("charge"), bool(row.get("lawful")))
    if op == "restore":
        return restore_from_chi(row.get("echo_confirmed"), row.get("drift"), row.get("phase_sequence"), row.get("chi_window_ms"))
    if op == "mask":
        return drift_mask(row.get("payload"), row.get("signatures"))
    if op == "step_flag":
        return {"step_flag": step_flag(row.get("phi_act"), row.get("phi_prev")), "log_only": True, "categorical_hard_fire": False}
    return score(row)


if __name__ == "__main__":
    import sys
    print(json.dumps(run(json.load(sys.stdin))))
