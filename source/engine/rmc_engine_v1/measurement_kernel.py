"""RMC Measurement Kernel v1 — Patch 262J1R-Preflight-C2R.

Shared deterministic measurement functions for the Recursive Manifest Compiler.

This module is intentionally dependency-light and side-effect free. It performs
real readings over the live objects passed into the RMC pipeline: input text,
phase paths, memory nodes, drift reports, resonance vectors, candidates, and
structured trace objects.

It does not call an LLM, query Chroma, read DBs, execute shell, write files,
write memory, mutate canonical references, or touch Identity Vault.

Implemented readings:
    * token and phrase extraction with whole-word boundaries
    * normalized Shannon entropy
    * recursive structure signatures and structural deltas
    * weighted lexical/phase/operator semantic similarity
    * memory fit, ancestry/source confidence, and conflict hints
    * circular Φ1–Φ9 phase deviation
    * resonance variance σ_res from phase vectors
    * drift severity D_score from measured components and taxonomy
    * symbolic ε_s = (σ_res + D_score + |ΔΦ|) / n
    * novelty delta against active memory
    * bounded evolutionary drift check
    * coherence component scoring
"""
from __future__ import annotations

import hashlib
import json
import math
import re
import statistics
from collections import Counter
from typing import Any, Iterable

ENGINE_VERSION = "rmc_measurement_kernel_v1_patch262J1R_preflight_C2R"
ENGINE_MODE = "side_effect_free_real_measurement_kernel"
PHASES = [f"Φ{i}" for i in range(1, 10)]
PHASE_INDEX = {f"Φ{i}": i for i in range(1, 10)}

STOPWORDS = {
    "a", "an", "and", "are", "as", "at", "be", "before", "by", "do", "for",
    "from", "how", "i", "in", "into", "is", "it", "of", "on", "or", "our",
    "that", "the", "their", "this", "to", "we", "what", "when", "where", "with",
    "without", "you", "your",
}

DRIFT_TAXONOMY_PENALTY = {
    "none": 0.0,
    "syntactic": 0.28,
    "evolutionary": 0.35,
    "resonant": 0.50,
    "structural": 0.55,
    "semantic": 0.65,
    "recursive": 0.80,
    "catastrophic": 1.00,
}

TASK_NOVELTY_BUDGETS = {
    "formal_definition": 0.35,
    "coding_patch": 0.30,
    "architecture_design": 0.55,
    "correction_workflow": 0.72,
    "creative_brainstorm": 0.75,
    "public_scientific_claim": 0.25,
    "default": 0.55,
}


def measurement_boundary() -> dict[str, Any]:
    """Return side-effect/security contract for the shared measurement kernel."""
    return {
        "engine_version": ENGINE_VERSION,
        "engine_mode": ENGINE_MODE,
        "engine_module_location": "forge/rmc_engine_v1/measurement_kernel.py",
        "computes_real_readings": True,
        "implemented_readings": [
            "token_boundaries",
            "normalized_shannon_entropy",
            "structure_signature",
            "structure_delta",
            "semantic_distance",
            "memory_fit",
            "source_confidence",
            "conflict_penalty",
            "phase_delta",
            "resonance_variance_sigma_res",
            "drift_severity_D_score",
            "symbolic_epsilon_s",
            "novelty_delta",
            "bounded_evolutionary_drift",
            "coherence_components",
        ],
        "calls_llm": False,
        "queries_chroma": False,
        "reads_db_files": False,
        "executes_shell": False,
        "writes_files": False,
        "writes_rmc_memory": False,
        "writes_identity_vault": False,
        "mutates_canonical_reference": False,
    }


def clamp(value: Any, low: float = 0.0, high: float = 1.0) -> float:
    try:
        v = float(value)
    except Exception:
        v = 0.0
    return max(float(low), min(float(high), v))


def stable_hash(obj: Any) -> str:
    try:
        payload = json.dumps(obj, sort_keys=True, ensure_ascii=False, default=str)
    except Exception:
        payload = str(obj)
    return hashlib.sha256(payload.encode("utf-8", errors="replace")).hexdigest()


def stable_id(prefix: str, obj: Any, n: int = 18) -> str:
    return f"{prefix}_{stable_hash(obj)[:n]}"


def as_list(value: Any) -> list[Any]:
    if isinstance(value, list):
        return value
    if value in (None, "", {}):
        return []
    return [value]


def stringify(value: Any, *, limit: int = 8000) -> str:
    if isinstance(value, str):
        text = value
    else:
        try:
            text = json.dumps(value, sort_keys=True, ensure_ascii=False, default=str)
        except Exception:
            text = str(value)
    if limit and len(text) > limit:
        return text[:limit]
    return text


def tokens(text: Any) -> list[str]:
    """Return normalized whole-word tokens.

    The regex is boundary-based, so 'or' is not extracted from 'before'.
    """
    return re.findall(r"(?u)\b[\w\u03a6\u03c7]+(?:[-'][\w\u03a6\u03c7]+)?\b", str(text or "").lower())


def content_terms(text: Any, *, include_stopwords: bool = False) -> set[str]:
    out = set()
    for tok in tokens(text):
        if include_stopwords or (tok not in STOPWORDS and len(tok) > 1):
            out.add(tok)
    return out


def ngrams(tok: list[str], n: int) -> set[str]:
    if n <= 0 or len(tok) < n:
        return set()
    return {" ".join(tok[i:i+n]) for i in range(0, len(tok) - n + 1)}


def phrase_terms(text: Any) -> set[str]:
    tok = [t for t in tokens(text) if t not in STOPWORDS]
    return ngrams(tok, 2) | ngrams(tok, 3)


def normalized_shannon_entropy(value: Any) -> float:
    """Compute normalized Shannon entropy over whole-word tokens.

    Returns 0 for empty/single-class input and approaches 1 as token distribution
    becomes more diverse/even.
    """
    tok = tokens(stringify(value, limit=16000))
    if not tok:
        return 0.0
    counts = Counter(tok)
    total = float(sum(counts.values()))
    if total <= 0 or len(counts) <= 1:
        return 0.0
    entropy = -sum((count / total) * math.log2(count / total) for count in counts.values())
    max_entropy = math.log2(len(counts))
    if max_entropy <= 0:
        return 0.0
    return round(clamp(entropy / max_entropy), 6)


def _walk_structure(obj: Any, *, depth: int = 0, max_depth: int = 8) -> dict[str, Any]:
    type_counts: Counter[str] = Counter()
    key_paths: set[str] = set()
    list_lengths: list[int] = []
    scalar_count = 0
    max_seen_depth = depth

    def walk(value: Any, path: str, d: int) -> None:
        nonlocal scalar_count, max_seen_depth
        max_seen_depth = max(max_seen_depth, d)
        if d > max_depth:
            type_counts["truncated"] += 1
            return
        if isinstance(value, dict):
            type_counts["dict"] += 1
            for key, child in value.items():
                key_s = str(key)
                child_path = f"{path}.{key_s}" if path else key_s
                key_paths.add(child_path)
                walk(child, child_path, d + 1)
        elif isinstance(value, list):
            type_counts["list"] += 1
            list_lengths.append(len(value))
            for idx, child in enumerate(value[:50]):
                walk(child, f"{path}[]" if path else "[]", d + 1)
        elif isinstance(value, bool):
            type_counts["bool"] += 1
            scalar_count += 1
        elif isinstance(value, (int, float)) and not isinstance(value, bool):
            type_counts["number"] += 1
            scalar_count += 1
        elif value is None:
            type_counts["null"] += 1
            scalar_count += 1
        else:
            type_counts["string"] += 1
            scalar_count += 1

    walk(obj, "", depth)
    return {
        "type_counts": dict(sorted(type_counts.items())),
        "key_paths": sorted(key_paths),
        "key_count": len(key_paths),
        "max_depth": max_seen_depth,
        "list_count": len(list_lengths),
        "list_lengths_sample": list_lengths[:20],
        "scalar_count": scalar_count,
        "structure_hash": stable_hash({
            "type_counts": dict(sorted(type_counts.items())),
            "key_paths": sorted(key_paths),
            "max_depth": max_seen_depth,
            "list_lengths": list_lengths[:20],
        })[:16],
    }


def structure_signature(obj: Any) -> dict[str, Any]:
    return _walk_structure(obj)


def jaccard_distance(a: Iterable[Any], b: Iterable[Any]) -> float:
    set_a = {str(x) for x in a}
    set_b = {str(x) for x in b}
    if not set_a and not set_b:
        return 0.0
    union = set_a | set_b
    if not union:
        return 0.0
    return round(1.0 - (len(set_a & set_b) / len(union)), 6)


def structure_delta(a: Any, b: Any) -> float:
    sig_a = a if isinstance(a, dict) and "key_paths" in a else structure_signature(a)
    sig_b = b if isinstance(b, dict) and "key_paths" in b else structure_signature(b)
    key_delta = jaccard_distance(sig_a.get("key_paths", []), sig_b.get("key_paths", []))
    types_a = sig_a.get("type_counts", {}) if isinstance(sig_a.get("type_counts"), dict) else {}
    types_b = sig_b.get("type_counts", {}) if isinstance(sig_b.get("type_counts"), dict) else {}
    type_delta = jaccard_distance(types_a.keys(), types_b.keys())
    depth_a = float(sig_a.get("max_depth") or 0.0)
    depth_b = float(sig_b.get("max_depth") or 0.0)
    depth_delta = clamp(abs(depth_a - depth_b) / max(1.0, depth_a, depth_b, 8.0))
    return round(clamp(0.72 * key_delta + 0.18 * type_delta + 0.10 * depth_delta), 6)


def phase_index(phase: Any) -> int | None:
    text = str(phase or "").strip()
    if text in PHASE_INDEX:
        return PHASE_INDEX[text]
    m = re.search(r"(?:Φ|phi)?\s*([1-9])\b", text, flags=re.IGNORECASE)
    if m:
        return int(m.group(1))
    return None


def normalize_phase(phase: Any) -> str | None:
    idx = phase_index(phase)
    return f"Φ{idx}" if idx else None


def phase_path(value: Any) -> list[str]:
    out = []
    for p in as_list(value):
        norm = normalize_phase(p)
        if norm and norm not in out:
            out.append(norm)
    return out


def circular_phase_delta(a: Any, b: Any) -> float:
    ia = phase_index(a)
    ib = phase_index(b)
    if ia is None or ib is None:
        return 0.0
    raw = abs(ib - ia)
    circular = min(raw, 9 - raw)
    return round(clamp(circular / 8.0), 6)


def phase_path_metrics(path: Any) -> dict[str, Any]:
    phases = phase_path(path)
    indexes = [phase_index(p) for p in phases if phase_index(p) is not None]
    deltas = [circular_phase_delta(phases[i], phases[i + 1]) for i in range(len(phases) - 1)]
    avg_delta = round(sum(deltas) / len(deltas), 6) if deltas else 0.0
    max_delta = round(max(deltas), 6) if deltas else 0.0
    warnings: list[dict[str, Any]] = []
    # Illegal export: Φ5 drift to Φ8 projection without Φ6 correction and Φ7 naming before projection.
    if 5 in indexes and 8 in indexes:
        i8 = indexes.index(8)
        before_8 = indexes[:i8]
        if 6 not in before_8 or 7 not in before_8:
            warnings.append({
                "type": "phase_5_to_8_projection_skip",
                "severity": "critical",
                "rule": "Φ5 drift may not project to Φ8 before Φ6 correction and Φ7 naming.",
            })
    if 8 in indexes:
        i8 = indexes.index(8)
        before_8 = indexes[:i8]
        if 6 not in before_8 or 7 not in before_8:
            warnings.append({
                "type": "projection_without_correction_or_naming",
                "severity": "high",
                "rule": "Projection requires Φ6 correction and Φ7 naming first.",
            })
    if 7 in indexes:
        i7 = indexes.index(7)
        if 6 not in indexes[:i7]:
            warnings.append({
                "type": "naming_without_prior_correction",
                "severity": "medium",
                "rule": "Naming should preserve prior Φ6 correction when drift/projection pressure is active.",
            })
    illegal = any(w.get("severity") in {"critical", "high"} for w in warnings)
    return {
        "phase_path": phases,
        "phase_indexes": indexes,
        "transition_deltas": deltas,
        "average_delta_phi": avg_delta,
        "max_delta_phi": max_delta,
        "phase_path_legal": not illegal,
        "phase_warnings": warnings,
        "phase_validity_score": 0.0 if any(w.get("severity") == "critical" for w in warnings) else (0.32 if any(w.get("severity") == "high" for w in warnings) else (0.68 if warnings else 0.92 if phases else 0.45)),
    }


def memory_node_text(node: dict[str, Any]) -> str:
    parts = [
        node.get("content"),
        node.get("content_summary"),
        node.get("summary"),
        node.get("memory_role"),
        node.get("symbolic_signature"),
        node.get("source"),
        node.get("source_path"),
        node.get("chunk_id"),
    ]
    return " | ".join(str(p) for p in parts if p not in (None, ""))


def memory_phase_tags(node: dict[str, Any]) -> list[str]:
    tags = []
    for key in ("phase_tags", "rpmc_phase_tags", "phases"):
        for p in as_list(node.get(key)):
            norm = normalize_phase(p)
            if norm and norm not in tags:
                tags.append(norm)
    # Some content summaries embed Φ tags.
    for m in re.finditer(r"Φ([1-9])", memory_node_text(node)):
        norm = f"Φ{m.group(1)}"
        if norm not in tags:
            tags.append(norm)
    return tags


def _confidence_to_float(value: Any) -> float:
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        return clamp(value)
    s = str(value or "").lower().strip()
    mapping = {
        "high": 0.92,
        "medium_high": 0.78,
        "medium": 0.62,
        "medium_low": 0.42,
        "low": 0.25,
        "unknown": 0.35,
        "": 0.35,
    }
    return mapping.get(s, 0.50)


def weighted_semantic_similarity(a: Any, b: Any, *, phase_a: Iterable[Any] | None = None, phase_b: Iterable[Any] | None = None, operator_a: Iterable[Any] | None = None, operator_b: Iterable[Any] | None = None) -> float:
    text_a = stringify(a, limit=12000)
    text_b = stringify(b, limit=12000)
    terms_a = content_terms(text_a)
    terms_b = content_terms(text_b)
    phrase_a = phrase_terms(text_a)
    phrase_b = phrase_terms(text_b)
    phase_set_a = set(phase_path(list(phase_a or [])))
    phase_set_b = set(phase_path(list(phase_b or [])))
    op_a = {str(o).lower() for o in (operator_a or []) if str(o).strip()}
    op_b = {str(o).lower() for o in (operator_b or []) if str(o).strip()}

    def jac(sa: set[str], sb: set[str]) -> float:
        if not sa and not sb:
            return 0.0
        if not sa or not sb:
            return 0.0
        return len(sa & sb) / len(sa | sb)

    exact = jac(terms_a, terms_b)
    phrase = jac(phrase_a, phrase_b)
    phase = jac(phase_set_a, phase_set_b)
    ops = jac(op_a, op_b)
    # Weighted lexical/semantic overlap. Deterministic and inspectable.
    return round(clamp(0.50 * exact + 0.20 * phrase + 0.20 * phase + 0.10 * ops), 6)


def semantic_distance(a: Any, b: Any, **kwargs: Any) -> float:
    return round(1.0 - weighted_semantic_similarity(a, b, **kwargs), 6)


def extract_memory_nodes_from_trace(trace_or_report: dict[str, Any]) -> list[dict[str, Any]]:
    if not isinstance(trace_or_report, dict):
        return []
    # Candidate report wraps trace under source_trace_spine.
    if isinstance(trace_or_report.get("source_trace_spine"), dict):
        nested = extract_memory_nodes_from_trace(trace_or_report["source_trace_spine"])
        if nested:
            return nested
    if isinstance(trace_or_report.get("source_candidate_conclusion"), dict):
        nested = extract_memory_nodes_from_trace(trace_or_report["source_candidate_conclusion"])
        if nested:
            return nested
    if isinstance(trace_or_report.get("source_evolutionary_drift"), dict):
        nested = extract_memory_nodes_from_trace(trace_or_report["source_evolutionary_drift"])
        if nested:
            return nested
    symbolic = trace_or_report.get("symbolic_trace") or {}
    if isinstance(symbolic, dict):
        m_t = symbolic.get("M_t") or {}
        if isinstance(m_t, dict) and isinstance(m_t.get("active_memory_nodes"), list):
            return [n for n in m_t.get("active_memory_nodes") if isinstance(n, dict)]
    recall = trace_or_report.get("memory_recall") or {}
    if isinstance(recall, dict):
        state = recall.get("memory_state") or {}
        if isinstance(state, dict) and isinstance(state.get("active_memory_nodes"), list):
            return [n for n in state.get("active_memory_nodes") if isinstance(n, dict)]
    mem_support = trace_or_report.get("source_memory_support") or {}
    if isinstance(mem_support, dict) and isinstance(mem_support.get("linked_memory_nodes"), list):
        return [n for n in mem_support.get("linked_memory_nodes") if isinstance(n, dict)]
    return []


def extract_phase_state_from_trace(trace_or_report: dict[str, Any]) -> dict[str, Any]:
    if not isinstance(trace_or_report, dict):
        return {}
    if isinstance(trace_or_report.get("source_phase_state"), dict):
        return dict(trace_or_report.get("source_phase_state") or {})
    if isinstance(trace_or_report.get("source_trace_spine"), dict):
        return extract_phase_state_from_trace(trace_or_report["source_trace_spine"])
    symbolic = trace_or_report.get("symbolic_trace") or {}
    if isinstance(symbolic, dict) and isinstance(symbolic.get("Φ_t"), dict):
        return dict(symbolic.get("Φ_t") or {})
    phase_report = trace_or_report.get("phase_report") or {}
    if isinstance(phase_report, dict):
        if isinstance(phase_report.get("phase_state"), dict):
            return dict(phase_report.get("phase_state") or {})
        return dict(phase_report)
    return {}


def extract_drift_state_from_trace(trace_or_report: dict[str, Any]) -> dict[str, Any]:
    if not isinstance(trace_or_report, dict):
        return {}
    if isinstance(trace_or_report.get("source_drift_report"), dict) and trace_or_report.get("source_drift_report"):
        return dict(trace_or_report.get("source_drift_report") or {})
    if isinstance(trace_or_report.get("source_trace_spine"), dict):
        drift = extract_drift_state_from_trace(trace_or_report["source_trace_spine"])
        if drift:
            return drift
    drift = trace_or_report.get("drift_report") or {}
    if isinstance(drift, dict) and drift:
        return dict(drift)
    symbolic = trace_or_report.get("symbolic_trace") or {}
    if isinstance(symbolic, dict) and isinstance(symbolic.get("D_t"), dict):
        return dict(symbolic.get("D_t") or {})
    return {}


def extract_phase_vector(trace_or_report: dict[str, Any]) -> dict[str, float]:
    if not isinstance(trace_or_report, dict):
        return {}
    if isinstance(trace_or_report.get("source_trace_spine"), dict):
        nested = extract_phase_vector(trace_or_report["source_trace_spine"])
        if nested:
            return nested
    if isinstance(trace_or_report.get("source_candidate_conclusion"), dict):
        nested = extract_phase_vector(trace_or_report["source_candidate_conclusion"])
        if nested:
            return nested
    resonance = trace_or_report.get("resonance_summary") or {}
    if isinstance(resonance, dict) and isinstance(resonance.get("phase_vector"), dict):
        return {str(k): clamp(v) for k, v in resonance.get("phase_vector", {}).items()}
    return {}


def resonance_variance(phase_vector: dict[str, Any] | None) -> float:
    if not isinstance(phase_vector, dict) or not phase_vector:
        return 0.0
    vals = [clamp(v) for k, v in phase_vector.items() if normalize_phase(k)]
    if len(vals) <= 1:
        return 0.0
    return round(clamp(statistics.pstdev(vals)), 6)


def _drift_taxonomy_from_state(drift_state: dict[str, Any], candidate: dict[str, Any] | None = None, phase_metrics: dict[str, Any] | None = None) -> list[str]:
    names: list[str] = []
    for key in ("drift_taxonomy", "drift_categories", "drift_types", "top_drift_classes", "drift_classes"):
        value = drift_state.get(key) if isinstance(drift_state, dict) else None
        for item in as_list(value):
            if isinstance(item, dict):
                name = str(item.get("type") or item.get("name") or item.get("class") or "").lower()
            else:
                name = str(item or "").lower()
            for known in DRIFT_TAXONOMY_PENALTY:
                if known != "none" and known in name and known not in names:
                    names.append(known)
    if phase_metrics and not phase_metrics.get("phase_path_legal", True):
        if "recursive" not in names:
            names.append("recursive")
    if candidate and str(candidate.get("candidate_kind") or "") == "bounded_evolutionary_candidate":
        if "evolutionary" not in names:
            names.append("evolutionary")
    if not names:
        names = ["none"]
    return names


def taxonomy_penalty(names: Iterable[str]) -> float:
    penalties = []
    for name in names:
        low = str(name or "").lower()
        penalties.append(DRIFT_TAXONOMY_PENALTY.get(low, 0.0))
    return round(clamp(max(penalties) if penalties else 0.0), 6)


def source_confidence(nodes: list[dict[str, Any]]) -> float:
    if not nodes:
        return 0.0
    vals = []
    for node in nodes[:24]:
        conf = _confidence_to_float(node.get("confidence"))
        weight = clamp(node.get("retrieval_weight"), 0.0, 1.0)
        ancestry = 1.0 if node.get("ancestry") or node.get("source_path") or node.get("source") else 0.55
        vals.append(clamp(0.55 * conf + 0.30 * weight + 0.15 * ancestry))
    return round(sum(vals) / max(1, len(vals)), 6)


def memory_relation(candidate: dict[str, Any], nodes: list[dict[str, Any]], candidate_phase_path: list[str] | None = None) -> dict[str, Any]:
    text = " | ".join(str(candidate.get(k) or "") for k in ("candidate", "title", "rationale", "candidate_kind"))
    c_path = phase_path(candidate_phase_path or candidate.get("phase_path") or [candidate.get("phase_target")])
    sims = []
    node_summaries = []
    phase_hits: dict[str, int] = {}
    conflict_count = 0
    for node in nodes[:24]:
        n_tags = memory_phase_tags(node)
        n_text = memory_node_text(node)
        sim = weighted_semantic_similarity(text, n_text, phase_a=c_path, phase_b=n_tags)
        sims.append(sim)
        for p in set(c_path) & set(n_tags):
            phase_hits[p] = phase_hits.get(p, 0) + 1
        node_conf = _confidence_to_float(node.get("confidence"))
        prior_drift = clamp(node.get("prior_drift_score"), 0.0, 1.0)
        # Lightweight conflict hint: semantically close, but low confidence/high prior drift.
        if sim >= 0.16 and (node_conf < 0.38 or prior_drift >= 0.70):
            conflict_count += 1
        node_summaries.append({
            "memory_id": node.get("memory_id"),
            "source_kind": node.get("source_kind"),
            "memory_role": node.get("memory_role"),
            "phase_tags": n_tags,
            "retrieval_weight": clamp(node.get("retrieval_weight"), 0.0, 1.0),
            "confidence_numeric": node_conf,
            "similarity": round(sim, 6),
            "prior_drift_score": prior_drift,
        })
    max_sim = max(sims) if sims else 0.0
    avg_top = sum(sorted(sims, reverse=True)[:5]) / max(1, min(5, len(sims))) if sims else 0.0
    # Memory fit uses semantic relation, phase-hit density, retrieval weights, and source confidence.
    retrieval_weights = [clamp(n.get("retrieval_weight"), 0.0, 1.0) for n in nodes[:24]]
    avg_retrieval = sum(retrieval_weights) / max(1, len(retrieval_weights)) if retrieval_weights else 0.0
    phase_density = clamp(sum(phase_hits.values()) / max(1, len(nodes[:24]), len(c_path)))
    src_conf = source_confidence(nodes[:24])
    mem_fit = clamp(0.35 * max_sim + 0.22 * avg_top + 0.18 * phase_density + 0.15 * avg_retrieval + 0.10 * src_conf)
    novelty = clamp(1.0 - max_sim)
    sem_dist = clamp(1.0 - avg_top)
    return {
        "active_memory_count": len(nodes),
        "evaluated_memory_count": min(len(nodes), 24),
        "memory_fit": round(mem_fit, 6),
        "semantic_distance": round(sem_dist, 6),
        "novelty_delta": round(novelty, 6),
        "max_memory_similarity": round(max_sim, 6),
        "avg_top_memory_similarity": round(avg_top, 6),
        "phase_hit_counts": phase_hits,
        "phase_relevance": round(phase_density, 6),
        "average_retrieval_weight": round(avg_retrieval, 6),
        "source_confidence": src_conf,
        "conflict_count": conflict_count,
        "conflict_penalty": round(clamp(conflict_count / max(1, min(len(nodes), 12))) * 0.20, 6),
        "memory_similarity_sample": sorted(node_summaries, key=lambda n: n.get("similarity", 0.0), reverse=True)[:8],
    }


def infer_task_type(candidate: dict[str, Any], trace_or_report: dict[str, Any] | None = None) -> str:
    text = " ".join([
        str(candidate.get("candidate_kind") or ""),
        str(candidate.get("title") or ""),
        str(candidate.get("candidate") or ""),
        stringify(trace_or_report or {}, limit=1000),
    ]).lower()
    if any(term in text for term in ("patch", "code", "module", "compile", "verifier")):
        return "coding_patch"
    if any(term in text for term in ("correction", "correct", "drift", "repair", "coherence return")):
        return "correction_workflow"
    if any(term in text for term in ("definition", "define", "naming", "name")):
        return "formal_definition"
    if any(term in text for term in ("public", "scientific", "proof", "claim")):
        return "public_scientific_claim"
    if any(term in text for term in ("brainstorm", "creative", "dream")):
        return "creative_brainstorm"
    if any(term in text for term in ("architecture", "system", "compiler", "engine")):
        return "architecture_design"
    return "default"


def symbolic_epsilon(sigma_res: float, d_score: float, delta_phi: float, n: int = 3) -> float:
    n_safe = max(1, int(n or 3))
    return round(clamp((clamp(sigma_res) + clamp(d_score) + clamp(delta_phi)) / n_safe), 6)


def drift_severity_score(*, entropy_score: float, structure_delta_score: float, semantic_distance_score: float, phase_deviation: float, taxonomy_score: float) -> float:
    return round(clamp(
        0.25 * clamp(entropy_score)
        + 0.20 * clamp(structure_delta_score)
        + 0.20 * clamp(semantic_distance_score)
        + 0.20 * clamp(phase_deviation)
        + 0.15 * clamp(taxonomy_score)
    ), 6)


def measure_candidate(candidate: dict[str, Any], trace_or_report: dict[str, Any] | None = None, *, memory_nodes: list[dict[str, Any]] | None = None, phase_state: dict[str, Any] | None = None, drift_state: dict[str, Any] | None = None, phase_vector: dict[str, Any] | None = None) -> dict[str, Any]:
    """Compute real measurement readings for one candidate meaning state."""
    trace = trace_or_report or {}
    nodes = memory_nodes if memory_nodes is not None else extract_memory_nodes_from_trace(trace)
    if not nodes and isinstance(candidate.get("memory_links"), list):
        nodes = [n for n in candidate.get("memory_links", []) if isinstance(n, dict)]
    phase_s = phase_state if phase_state is not None else extract_phase_state_from_trace(trace)
    drift_s = drift_state if drift_state is not None else extract_drift_state_from_trace(trace)
    vector = phase_vector if phase_vector is not None else extract_phase_vector(trace)
    c_path = phase_path(candidate.get("phase_path") or [candidate.get("phase_target")])
    if not c_path:
        c_path = phase_path(phase_s.get("phase_path_hypothesis") or [phase_s.get("phase_primary")])
    p_metrics = phase_path_metrics(c_path)
    mem = memory_relation(candidate, nodes, c_path)
    input_text = " | ".join(str(candidate.get(k) or "") for k in ("title", "candidate", "rationale", "candidate_kind"))
    entropy = normalized_shannon_entropy(input_text)
    sig_candidate = structure_signature(candidate)
    sig_template = structure_signature({
        "candidate_id": "",
        "title": "",
        "candidate": "",
        "candidate_kind": "",
        "phase_target": "Φ1",
        "phase_path": [],
        "memory_links": [],
        "confidence": 0.0,
        "novelty": 0.0,
        "drift": 0.0,
        "allowed_to_continue_to_scoring": False,
    })
    s_delta = structure_delta(sig_candidate, sig_template)
    sigma = resonance_variance(vector)
    taxonomy = _drift_taxonomy_from_state(drift_s, candidate, p_metrics)
    tax = taxonomy_penalty(taxonomy)
    d_score = drift_severity_score(
        entropy_score=entropy,
        structure_delta_score=s_delta,
        semantic_distance_score=mem.get("semantic_distance", 0.0),
        phase_deviation=p_metrics.get("max_delta_phi", 0.0),
        taxonomy_score=tax,
    )
    eps = symbolic_epsilon(sigma, d_score, p_metrics.get("max_delta_phi", 0.0), 3)
    task_type = infer_task_type(candidate, trace)
    novelty_budget = TASK_NOVELTY_BUDGETS.get(task_type, TASK_NOVELTY_BUDGETS["default"])
    novelty_delta = mem.get("novelty_delta", 1.0)
    phase_legal = bool(p_metrics.get("phase_path_legal"))
    bounded = bool(
        novelty_delta > 0.0
        and novelty_delta <= novelty_budget
        and eps <= 0.60
        and phase_legal
        and (bool(nodes) or "hypothesis" in str(candidate.get("candidate_kind") or "").lower())
    )
    circuit = bool(
        eps > 0.80
        or any(w.get("severity") == "critical" for w in p_metrics.get("phase_warnings", []))
        or "catastrophic" in taxonomy
    )
    chi_required = bool(eps > 0.60 or "recursive" in taxonomy or not phase_legal)
    if circuit:
        chi_action = "circuit_breaker_block_projection_route_to_correction_or_archive"
    elif chi_required:
        chi_action = "route_to_correction_engine"
    elif bounded:
        chi_action = "allow_bounded_exploration"
    else:
        chi_action = "hold_for_review_or_add_memory_support"
    return {
        "measurement_kernel_version": ENGINE_VERSION,
        "candidate_id": candidate.get("candidate_id"),
        "token_count": len(tokens(input_text)),
        "phrase_count": len(phrase_terms(input_text)),
        "entropy_norm": entropy,
        "structure_signature": sig_candidate,
        "structure_delta": s_delta,
        "semantic_distance": mem.get("semantic_distance", 0.0),
        "memory_fit": mem.get("memory_fit", 0.0),
        "source_confidence": mem.get("source_confidence", 0.0),
        "conflict_count": mem.get("conflict_count", 0),
        "conflict_penalty": mem.get("conflict_penalty", 0.0),
        "memory_relation": mem,
        "phase_metrics": p_metrics,
        "sigma_res": sigma,
        "drift_taxonomy": taxonomy,
        "taxonomy_penalty": tax,
        "D_score": d_score,
        "epsilon_s": eps,
        "novelty_delta": novelty_delta,
        "task_type": task_type,
        "novelty_budget": novelty_budget,
        "bounded_evolutionary_drift": bounded,
        "circuit_breaker": circuit,
        "chi_t_required": chi_required,
        "chi_t_action": chi_action,
        "reads_actual_candidate": True,
        "reads_actual_memory_nodes": bool(nodes),
        "reads_actual_phase_path": bool(c_path),
        "reads_actual_resonance_vector": bool(vector),
    }


def coherence_components(candidate: dict[str, Any], measurement: dict[str, Any], *, target_novelty: float | None = None) -> dict[str, Any]:
    mem_fit = clamp(measurement.get("memory_fit"))
    phase_validity = clamp((measurement.get("phase_metrics") or {}).get("phase_validity_score"))
    epsilon = clamp(measurement.get("epsilon_s"))
    drift_containment = clamp(1.0 - epsilon)
    source_conf = clamp(measurement.get("source_confidence"))
    novelty_delta = clamp(measurement.get("novelty_delta"))
    budget = clamp(measurement.get("novelty_budget"), 0.05, 1.0)
    target = clamp(target_novelty if target_novelty is not None else min(0.42, budget * 0.72), 0.0, 1.0)
    bounded_novelty_score = clamp(1.0 - abs(novelty_delta - target))
    utility = clamp(_utility_fit_from_candidate(candidate))
    operator_legality = 1.0 if not measurement.get("circuit_breaker") and (measurement.get("phase_metrics") or {}).get("phase_path_legal", False) else 0.0
    conflict_penalty = clamp(measurement.get("conflict_penalty"))
    projection_gate_penalty = 0.0
    phase_path_value = (measurement.get("phase_metrics") or {}).get("phase_path", [])
    if "Φ8" in phase_path_value and not ("Φ6" in phase_path_value and "Φ7" in phase_path_value):
        projection_gate_penalty = 0.25
    if measurement.get("circuit_breaker"):
        projection_gate_penalty = max(projection_gate_penalty, 0.35)
    score = clamp(
        0.24 * mem_fit
        + 0.20 * phase_validity
        + 0.18 * drift_containment
        + 0.14 * source_conf
        + 0.10 * utility
        + 0.08 * bounded_novelty_score
        + 0.06 * operator_legality
        - conflict_penalty
        - projection_gate_penalty
    )
    return {
        "memory_fit": round(mem_fit, 6),
        "phase_validity": round(phase_validity, 6),
        "drift_containment": round(drift_containment, 6),
        "source_confidence": round(source_conf, 6),
        "utility_fit": round(utility, 6),
        "bounded_novelty_score": round(bounded_novelty_score, 6),
        "operator_legality": round(operator_legality, 6),
        "conflict_penalty": round(conflict_penalty, 6),
        "projection_gate_penalty": round(projection_gate_penalty, 6),
        "coherence_score": round(score, 6),
        "formula": "0.24*memory_fit + 0.20*phase_validity + 0.18*drift_containment + 0.14*source_confidence + 0.10*utility_fit + 0.08*bounded_novelty_score + 0.06*operator_legality - conflict_penalty - projection_gate_penalty",
    }


def _utility_fit_from_candidate(candidate: dict[str, Any]) -> float:
    kind = str(candidate.get("candidate_kind") or "").lower()
    title = str(candidate.get("title") or "").lower()
    if "correction" in kind or "correction" in title:
        return 0.88
    if "memory" in kind:
        return 0.84
    if "projection" in kind:
        return 0.58
    if "evolutionary" in kind:
        return 0.70
    if "archive" in kind or "containment" in kind:
        return 0.44
    return 0.62


def measure_trace_summary(trace_or_report: dict[str, Any]) -> dict[str, Any]:
    nodes = extract_memory_nodes_from_trace(trace_or_report)
    phase_state = extract_phase_state_from_trace(trace_or_report)
    drift_state = extract_drift_state_from_trace(trace_or_report)
    vector = extract_phase_vector(trace_or_report)
    path = phase_path(phase_state.get("phase_path_hypothesis") or [phase_state.get("phase_primary")])
    phase_metrics = phase_path_metrics(path)
    entropy = normalized_shannon_entropy(trace_or_report)
    sigma = resonance_variance(vector)
    taxonomy = _drift_taxonomy_from_state(drift_state, None, phase_metrics)
    d_score = drift_severity_score(
        entropy_score=entropy,
        structure_delta_score=0.0,
        semantic_distance_score=0.0,
        phase_deviation=phase_metrics.get("max_delta_phi", 0.0),
        taxonomy_score=taxonomy_penalty(taxonomy),
    )
    return {
        "measurement_kernel_version": ENGINE_VERSION,
        "active_memory_count": len(nodes),
        "phase_metrics": phase_metrics,
        "entropy_norm": entropy,
        "sigma_res": sigma,
        "drift_taxonomy": taxonomy,
        "D_score": d_score,
        "epsilon_s": symbolic_epsilon(sigma, d_score, phase_metrics.get("max_delta_phi", 0.0), 3),
        "source_confidence": source_confidence(nodes),
        "reads_actual_memory_nodes": bool(nodes),
        "reads_actual_phase_path": bool(path),
        "reads_actual_resonance_vector": bool(vector),
    }
