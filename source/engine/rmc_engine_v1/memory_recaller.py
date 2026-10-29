"""RMC Memory Recaller + Trace Spine v1.

Patch 262J1R-Preflight-B6 begins the real RMC application spine by adding
read-only memory recall and trace assembly on top of the already-installed
Phase Parser, Resonance Lexicon, Drift Analyzer, and dataset/reference surfaces.

This module is intentionally not an LLM hook. It does not render final
language, approve output, write memory, mutate datasets, query Chroma or any
vector store, execute shell, or touch Identity Vault. The withdrawn legacy
retrieval parameters remain refusal inputs only. Its job is to assemble the
trace inputs the RMC needs before Candidate Generation can become trustworthy.

Core doctrine:
    Input Event -> Phase Parser -> Memory Recaller -> Drift Analyzer ->
    Candidate Generator -> Coherence -> Correction/Naming -> Manifest ->
    Renderer -> Echo Validator -> Memory Writer

This module implements the read-only Memory Recaller and an early Trace Spine
object through the Drift Analyzer stage. Downstream C_t/R_t remain explicitly
not implemented here.
"""
from __future__ import annotations

import datetime as _dt
import hashlib
import json
import os
import re
from pathlib import Path
from typing import Any

from rmc_engine_v1.phase_parser import parse_phase
from rmc_engine_v1.resonance_lexicon import analyze_resonance
from rmc_engine_v1.drift_engine import analyze_drift
from rmc_engine_v1.frozen_legacy_boundary import classify_retrieval_request

ENGINE_VERSION = "rmc_memory_recaller_v1_frozen_legacy_containment_v1"
ENGINE_MODE = "read_only_rmc_memory_recaller_trace_spine_filesystem_only"
DEFAULT_FORGE_ROOT = Path("/home/nic/forge")
MAX_TEXT_BYTES = 900_000

PHASES = [f"Φ{i}" for i in range(1, 10)]


def _utc_now() -> str:
    return _dt.datetime.now(_dt.timezone.utc).replace(microsecond=0).isoformat()


def _forge_root(root: str | Path | None = None) -> Path:
    if root is not None:
        return Path(root).expanduser().resolve()
    env_root = os.environ.get("FORGE_ROOT")
    if env_root:
        return Path(env_root).expanduser().resolve()
    return DEFAULT_FORGE_ROOT


def _sha256_text(text: str) -> str:
    return hashlib.sha256((text or "").encode("utf-8")).hexdigest()


def _stable_id(prefix: str, text: str) -> str:
    return f"{prefix}_{_sha256_text(text)[:18]}"


def _read_text(path: Path, max_bytes: int = MAX_TEXT_BYTES) -> str:
    try:
        with path.open("rb") as f:
            data = f.read(max_bytes)
        return data.decode("utf-8", errors="replace")
    except Exception:
        return ""


def _read_json(path: Path) -> Any:
    text = _read_text(path)
    if not text.strip():
        return None
    try:
        return json.loads(text)
    except Exception:
        return None


def _iter_json_files(path: Path, pattern: str = "*.json", recursive: bool = False, limit: int = 400) -> list[Path]:
    if not path.exists():
        return []
    try:
        files = list(path.rglob(pattern) if recursive else path.glob(pattern))
        files = [p for p in files if p.is_file()]
        files.sort(key=lambda p: p.stat().st_mtime, reverse=True)
        return files[:limit]
    except Exception:
        return []


def _tokens(text: str) -> set[str]:
    return {t.lower() for t in re.findall(r"[A-Za-z0-9_χΦφ]+", str(text or "")) if len(t) >= 2}


def _coerce_phase_list(value: Any) -> list[str]:
    phases: list[str] = []
    if isinstance(value, str):
        raw = re.split(r"[,;|\s]+", value)
        phases = [p.strip() for p in raw if p.strip()]
    elif isinstance(value, list):
        phases = [str(p).strip() for p in value if str(p).strip()]
    elif isinstance(value, dict):
        phases = [str(k).strip() for k in value.keys() if str(k).strip().startswith("Φ")]
    cleaned = []
    for ph in phases:
        ph = ph.replace("Phi", "Φ").replace("phi", "Φ")
        m = re.search(r"(?:Φ|phase[_\s-]?)([1-9])", ph, re.I)
        if m:
            ph = f"Φ{m.group(1)}"
        if ph in PHASES and ph not in cleaned:
            cleaned.append(ph)
    return cleaned


def _phase_state(phase_report: dict[str, Any]) -> dict[str, Any]:
    if isinstance(phase_report.get("phase_state"), dict):
        return phase_report.get("phase_state") or {}
    return phase_report


def _relative(path: Path, root: Path) -> str:
    try:
        return str(path.resolve().relative_to(root.resolve()))
    except Exception:
        return str(path)


def _extract_node_text(data: Any, fallback: str = "") -> str:
    if isinstance(data, dict):
        parts: list[str] = []
        for key in (
            "content", "text", "chunk_text", "chunk_preview", "input", "claim", "summary",
            "filename", "source_filename", "corpus_id", "receipt_id", "memory_role",
            "symbolic_signature", "rpmc_phase_tags", "symbolic_operators", "expected_route",
            "candidate_family", "review_status",
        ):
            if data.get(key) not in (None, "", []):
                parts.append(f"{key}: {data.get(key)}")
        if not parts:
            for k, v in list(data.items())[:18]:
                if isinstance(v, (str, int, float, bool)):
                    parts.append(f"{k}: {v}")
        return " | ".join(parts)[:3000] or fallback
    if isinstance(data, list):
        return " | ".join(_extract_node_text(item) for item in data[:5])[:3000] or fallback
    return str(data or fallback)[:3000]


def _node_from_receipt(path: Path, root: Path, data: dict[str, Any]) -> dict[str, Any]:
    text = _extract_node_text(data, fallback=path.name)
    receipt_id = str(data.get("receipt_id") or path.stem)
    corpus_id = str(data.get("corpus_id") or "")
    phase_tags = _coerce_phase_list(data.get("rpmc_phase_tags") or data.get("phase_tags") or data.get("phase"))
    return {
        "memory_id": _stable_id("mem_receipt", str(path) + receipt_id),
        "source_kind": "ingestion_receipt",
        "source_path": _relative(path, root),
        "content_summary": text[:700],
        "source": data.get("filename") or data.get("source_filename") or path.name,
        "phase_tags": phase_tags,
        "confidence": "medium_high" if data.get("verification_ok") is not False else "low",
        "ancestry": {
            "receipt_id": receipt_id,
            "corpus_id": corpus_id,
            "collection": data.get("collection") or data.get("collection_name") or "",
            "symbolic_map_path": data.get("symbolic_map_path") or "",
        },
        "prior_drift_score": 0.0 if data.get("verification_ok") is not False else 0.45,
        "memory_role": "source_provenance_receipt",
    }


def _node_from_manifest(path: Path, root: Path, data: dict[str, Any]) -> dict[str, Any]:
    text = _extract_node_text(data, fallback=path.name)
    return {
        "memory_id": _stable_id("mem_manifest", str(path) + path.stem),
        "source_kind": "collection_manifest",
        "source_path": _relative(path, root),
        "content_summary": text[:700],
        "source": data.get("collection") or path.name,
        "phase_tags": _coerce_phase_list(data.get("phase_tags") or data.get("phase_path")),
        "confidence": "medium_high",
        "ancestry": {
            "collection": data.get("collection") or "",
            "total_chunks": data.get("total_chunks", data.get("collection_total_chunks", 0)),
            "receipts": data.get("receipts", [])[:8] if isinstance(data.get("receipts"), list) else data.get("receipts", ""),
        },
        "prior_drift_score": 0.0,
        "memory_role": "context_collection_manifest",
    }


def _symbolic_entries(data: Any) -> list[dict[str, Any]]:
    """Extract symbolic-map-like entries from several possible schemas."""
    if isinstance(data, list):
        return [item for item in data if isinstance(item, dict)]
    if not isinstance(data, dict):
        return []
    for key in ("entries", "symbolic_entries", "chunks", "symbolic_map", "map", "records"):
        value = data.get(key)
        if isinstance(value, list):
            return [item for item in value if isinstance(item, dict)]
        if isinstance(value, dict):
            out: list[dict[str, Any]] = []
            for k, v in value.items():
                if isinstance(v, dict):
                    row = dict(v)
                    row.setdefault("chunk_id", k)
                    out.append(row)
            return out
    # Some older maps are dicts keyed by chunk id.
    out = []
    for k, v in data.items():
        if isinstance(v, dict) and any(x in v for x in ("chunk_id", "rpmc_phase_tags", "memory_role", "chunk_preview")):
            row = dict(v)
            row.setdefault("chunk_id", k)
            out.append(row)
    return out


def _nodes_from_symbolic_map(path: Path, root: Path, data: Any, limit: int = 40) -> list[dict[str, Any]]:
    nodes: list[dict[str, Any]] = []
    for entry in _symbolic_entries(data)[:limit]:
        text = _extract_node_text(entry, fallback=path.name)
        phase_tags = _coerce_phase_list(entry.get("rpmc_phase_tags") or entry.get("phase_tags") or entry.get("phase"))
        role = str(entry.get("memory_role") or "symbolic_map_chunk")
        drift_score = 0.0
        if entry.get("drift_terms") or entry.get("collapse_terms"):
            drift_score = 0.25
        nodes.append({
            "memory_id": _stable_id("mem_symbolic", str(path) + str(entry.get("chunk_id") or text[:80])),
            "source_kind": "symbolic_map_entry",
            "source_path": _relative(path, root),
            "chunk_id": entry.get("chunk_id") or entry.get("id") or "",
            "content_summary": text[:850],
            "source": entry.get("source_file") or entry.get("filename") or path.name,
            "phase_tags": phase_tags,
            "confidence": "medium_high",
            "ancestry": {
                "corpus_id": entry.get("corpus_id") or "",
                "sha256_16": entry.get("sha256_16") or "",
                "symbolic_signature": entry.get("symbolic_signature") or "",
            },
            "prior_drift_score": drift_score,
            "memory_role": role,
        })
    return nodes


def _node_from_growth(path: Path, root: Path, data: dict[str, Any]) -> dict[str, Any]:
    text = _extract_node_text(data, fallback=path.name)
    phase_tags = _coerce_phase_list(
        data.get("expected_phase_path") or
        data.get("phase_path") or
        (data.get("phase_summary") or {}).get("phase_path_hypothesis") if isinstance(data.get("phase_summary"), dict) else None
    )
    drift_score = 0.0
    if isinstance(data.get("drift_summary"), dict):
        try:
            drift_score = float(data["drift_summary"].get("epsilon_s") or 0.0)
        except Exception:
            drift_score = 0.0
    kind = "dataset_growth_record"
    parts = set(path.parts)
    if "review_queue" in parts:
        kind = "dataset_review_queue_item"
    elif "candidate_examples" in parts:
        kind = "dataset_candidate_example"
    elif "raw_events" in parts:
        kind = "dataset_raw_event"
    elif "dataset_receipts" in parts:
        kind = "dataset_capture_receipt"
    return {
        "memory_id": _stable_id("mem_growth", str(path) + str(data.get("candidate_id") or data.get("observation_id") or path.stem)),
        "source_kind": kind,
        "source_path": _relative(path, root),
        "content_summary": text[:850],
        "source": data.get("source_kind") or path.name,
        "phase_tags": phase_tags,
        "confidence": "review_required" if kind in ("dataset_candidate_example", "dataset_review_queue_item") else "observation_only",
        "ancestry": {
            "observation_id": data.get("observation_id") or "",
            "candidate_id": data.get("candidate_id") or "",
            "approval": data.get("approval") or (data.get("receipt") or {}).get("approval") if isinstance(data.get("receipt"), dict) else "",
        },
        "prior_drift_score": drift_score,
        "memory_role": kind,
    }


def _collect_candidate_nodes(root: Path, limit_per_source: int = 160) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    memory_root = root / "memory"
    context_root = memory_root / "context_library_v1"
    dataset_root = memory_root / "rmc_dataset_v1"

    nodes: list[dict[str, Any]] = []
    source_counts: dict[str, int] = {}

    for path in _iter_json_files(context_root / "receipts", "*.json", False, limit_per_source):
        data = _read_json(path)
        if isinstance(data, dict):
            nodes.append(_node_from_receipt(path, root, data))
            source_counts["ingestion_receipts"] = source_counts.get("ingestion_receipts", 0) + 1

    for path in _iter_json_files(context_root / "manifests", "*.json", False, limit_per_source):
        data = _read_json(path)
        if isinstance(data, dict):
            nodes.append(_node_from_manifest(path, root, data))
            source_counts["collection_manifests"] = source_counts.get("collection_manifests", 0) + 1

    for path in _iter_json_files(context_root / "symbolic_maps", "*.json", False, min(limit_per_source, 80)):
        data = _read_json(path)
        before = len(nodes)
        nodes.extend(_nodes_from_symbolic_map(path, root, data, limit=40))
        source_counts["symbolic_map_entries"] = source_counts.get("symbolic_map_entries", 0) + (len(nodes) - before)

    for sub in ("review_queue", "candidate_examples", "raw_events", "dataset_receipts"):
        for path in _iter_json_files(dataset_root / sub, "*.json", True, limit_per_source):
            data = _read_json(path)
            if isinstance(data, dict):
                nodes.append(_node_from_growth(path, root, data))
                source_counts[sub] = source_counts.get(sub, 0) + 1

    # Keep deterministic order and cap; final ranking happens later.
    return nodes[:1200], {
        "context_root": str(context_root),
        "dataset_root": str(dataset_root),
        "context_root_exists": context_root.exists(),
        "dataset_root_exists": dataset_root.exists(),
        "candidate_nodes_collected": len(nodes),
        "source_counts": source_counts,
    }


def _score_node(node: dict[str, Any], input_text: str, phase_report: dict[str, Any]) -> dict[str, Any]:
    text = str(node.get("content_summary") or "")
    input_tokens = _tokens(input_text)
    node_tokens = _tokens(text + " " + str(node.get("source") or "") + " " + str(node.get("memory_role") or ""))
    overlap = sorted(input_tokens & node_tokens)
    semantic = min(1.0, len(overlap) / max(4, len(input_tokens) or 1))

    phase_state = _phase_state(phase_report)
    primary = str(phase_state.get("phase_primary") or "")
    secondary = [str(p) for p in phase_state.get("phase_secondary") or []]
    node_phases = node.get("phase_tags") or []
    phase_hits = [p for p in node_phases if p == primary or p in secondary]
    phase_relevance = 0.0
    if phase_hits:
        phase_relevance = 0.35 + 0.12 * min(3, len(phase_hits))
    elif node_phases and primary:
        phase_relevance = 0.12

    ancestry = node.get("ancestry") or {}
    ancestry_score = 0.18 if any(v not in (None, "", [], {}) for v in ancestry.values()) else 0.0

    lower = (input_text + " " + text).lower()
    drift_terms = ("drift", "bypass", "collapse", "unstable", "correction", "χ", "christ", "circuit", "projection")
    drift_relation = 0.0
    if any(term in lower for term in drift_terms):
        drift_relation = 0.22
    try:
        drift_relation += min(0.18, float(node.get("prior_drift_score") or 0.0) * 0.2)
    except Exception:
        pass

    active_loop = 0.0
    if node.get("source_kind") in ("dataset_review_queue_item", "dataset_candidate_example"):
        active_loop = 0.20
    if node.get("source_kind") in ("ingestion_receipt", "symbolic_map_entry"):
        active_loop += 0.08

    retrieval_weight = round(min(1.0, semantic * 0.44 + phase_relevance + ancestry_score + drift_relation + active_loop), 4)
    evidence = []
    if overlap:
        evidence.append({"type": "semantic_overlap", "tokens": overlap[:12]})
    if phase_hits:
        evidence.append({"type": "phase_relevance", "phase_hits": phase_hits})
    if ancestry_score:
        evidence.append({"type": "ancestry_present"})
    if drift_relation:
        evidence.append({"type": "drift_relation", "score": round(drift_relation, 3)})
    if active_loop:
        evidence.append({"type": "active_loop_relation", "score": round(active_loop, 3)})
    out = dict(node)
    out.update({
        "retrieval_weight": retrieval_weight,
        "retrieval_dimensions": {
            "semantic_relevance": round(semantic, 4),
            "phase_relevance": round(phase_relevance, 4),
            "ancestry_match": round(ancestry_score, 4),
            "drift_relation": round(drift_relation, 4),
            "active_loop_relation": round(active_loop, 4),
        },
        "retrieval_evidence": evidence,
    })
    return out


def _context_library_status(root: Path) -> dict[str, Any]:
    context_root = root / "memory" / "context_library_v1"
    dataset_root = root / "memory" / "rmc_dataset_v1"
    subdirs = {
        "context_library_root": context_root,
        "receipts": context_root / "receipts",
        "manifests": context_root / "manifests",
        "symbolic_maps": context_root / "symbolic_maps",
        "indexes": context_root / "indexes",
        "dataset_growth_root": dataset_root,
        "dataset_review_queue": dataset_root / "review_queue",
        "dataset_receipts": dataset_root / "dataset_receipts",
    }
    return {
        name: {
            "path": str(path),
            "exists": path.exists(),
            "file_count": len([p for p in path.rglob("*") if p.is_file()]) if path.exists() and path.is_dir() else 0,
        }
        for name, path in subdirs.items()
    }


def memory_recaller_boundary() -> dict[str, Any]:
    return {
        "engine_version": ENGINE_VERSION,
        "engine_mode": ENGINE_MODE,
        "engine_module_location": "forge/rmc_engine_v1/memory_recaller.py",
        "implements_rmc_stage": "Memory Recaller + Trace Spine through Drift Analyzer",
        "reads_context_library_json": True,
        "reads_dataset_growth_json": True,
        "queries_chroma": False,
        "queries_vector_store": False,
        "semantic_similarity_authority": False,
        "reads_db_files": False,
        "calls_llm": False,
        "executes_shell": False,
        "writes_files": False,
        "writes_rmc_memory": False,
        "writes_identity_vault": False,
        "renders_final_language": False,
        "approved_output": False,
        "normal_runtime_gold_mutation_allowed": False,
        "retrieval_backend_default": "filesystem",
        "supported_retrieval_backends": ["filesystem"],
        "legacy_vector_parameters_are_refusal_inputs": True,
        "fallback_from_blocked_backend_allowed": False,
        "note": "This module builds read-only I_t/M_t/Φ_t/D_t trace inputs from deterministic filesystem sources only.",
    }

def build_input_event(source_text: str, source_metadata: dict[str, Any] | None = None) -> dict[str, Any]:
    source_metadata = source_metadata or {}
    text = str(source_text or "")
    return {
        "event_id": _stable_id("rmc_input_event", text + json.dumps(source_metadata, sort_keys=True, default=str)),
        "raw_input_preview": text[:800],
        "raw_input_sha256": _sha256_text(text),
        "raw_input_length": len(text),
        "conversation_context": source_metadata.get("conversation_context", "adapter_supplied_or_empty"),
        "identity_context": source_metadata.get("identity_context", "forge_operator_context_unprivileged"),
        "session_metadata": {
            "created_at_utc": _utc_now(),
            "source_kind": source_metadata.get("source_kind", "operator_query_input"),
            "selector": source_metadata.get("selector", ""),
            "active_scope": source_metadata.get("active_scope", "unknown"),
        },
    }


def recall_memory(source_text: str, source_metadata: dict[str, Any] | None = None, root: str | Path | None = None, limit: int = 12) -> dict[str, Any]:
    """Build a deterministic filesystem-only active memory set M_t."""
    source_metadata = dict(source_metadata or {})
    root_path = _forge_root(root)
    input_event = build_input_event(source_text, source_metadata)
    phase_report = parse_phase(source_text, source_metadata)
    retrieval_decision = classify_retrieval_request(source_metadata)

    requested_backend = (
        retrieval_decision.get("requested", {}).get("backend")
        if isinstance(retrieval_decision.get("requested"), dict)
        else source_metadata.get("retrieval_backend")
    )
    if retrieval_decision.get("status") != "OK":
        inventory = {
            "context_root": str(root_path / "memory" / "context_library_v1"),
            "dataset_root": str(root_path / "memory" / "rmc_dataset_v1"),
            "context_root_exists": (root_path / "memory" / "context_library_v1").exists(),
            "dataset_root_exists": (root_path / "memory" / "rmc_dataset_v1").exists(),
            "candidate_nodes_collected": 0,
            "source_counts": {},
            "retrieval_backend_requested": requested_backend,
            "retrieval_backend_effective": "none",
            "fallback_performed": False,
        }
        return {
            "status": "BLOCKED",
            "reason_code": retrieval_decision.get("reason_code"),
            "engine_version": ENGINE_VERSION,
            "engine_mode": ENGINE_MODE,
            "stage": "Memory Recaller",
            "input_event": input_event,
            "phase_report_summary": {
                "phase_primary": _phase_state(phase_report).get("phase_primary"),
                "phase_secondary": _phase_state(phase_report).get("phase_secondary", []),
                "phase_path_hypothesis": _phase_state(phase_report).get("phase_path_hypothesis", []),
                "confidence": _phase_state(phase_report).get("confidence"),
                "transition_warnings": _phase_state(phase_report).get("transition_warnings", []),
            },
            "memory_state": {
                "M_t_present": False,
                "candidate_nodes_collected": 0,
                "active_memory_count": 0,
                "retrieval_dimensions": ["semantic_relevance", "phase_relevance", "ancestry", "drift_relation", "active_loop_relation"],
                "retrieval_backend_requested": requested_backend,
                "retrieval_backend_effective": "none",
                "active_memory_nodes": [],
                "source_counts_collected": {},
                "active_source_kind_counts": {},
                "active_memory_role_counts": {},
                "active_phase_counts": {},
            },
            "legacy_retrieval_request": retrieval_decision,
            "context_library_status": _context_library_status(root_path),
            "inventory": inventory,
            "fallback_performed": False,
            "boundary": memory_recaller_boundary(),
        }

    nodes, inventory = _collect_candidate_nodes(root_path)
    inventory["retrieval_backend_requested"] = requested_backend or "filesystem"
    inventory["retrieval_backend_effective"] = "filesystem"
    inventory["candidate_nodes_collected"] = len(nodes)
    inventory["fallback_performed"] = False

    ranked = [_score_node(node, source_text, phase_report) for node in nodes]
    ranked.sort(key=lambda n: (n.get("retrieval_weight", 0), len(n.get("retrieval_evidence", []))), reverse=True)
    active = ranked[: max(1, min(int(limit or 12), 50))]
    role_counts: dict[str, int] = {}
    source_counts: dict[str, int] = {}
    phase_counts: dict[str, int] = {}
    for node in active:
        role = str(node.get("memory_role") or "unknown")
        kind = str(node.get("source_kind") or "unknown")
        role_counts[role] = role_counts.get(role, 0) + 1
        source_counts[kind] = source_counts.get(kind, 0) + 1
        for ph in node.get("phase_tags") or []:
            phase_counts[ph] = phase_counts.get(ph, 0) + 1

    return {
        "status": "OK",
        "engine_version": ENGINE_VERSION,
        "engine_mode": ENGINE_MODE,
        "stage": "Memory Recaller",
        "input_event": input_event,
        "phase_report_summary": {
            "phase_primary": _phase_state(phase_report).get("phase_primary"),
            "phase_secondary": _phase_state(phase_report).get("phase_secondary", []),
            "phase_path_hypothesis": _phase_state(phase_report).get("phase_path_hypothesis", []),
            "confidence": _phase_state(phase_report).get("confidence"),
            "transition_warnings": _phase_state(phase_report).get("transition_warnings", []),
        },
        "memory_state": {
            "M_t_present": True,
            "candidate_nodes_collected": inventory.get("candidate_nodes_collected", 0),
            "active_memory_count": len(active),
            "retrieval_dimensions": ["semantic_relevance", "phase_relevance", "ancestry", "drift_relation", "active_loop_relation"],
            "retrieval_backend_requested": inventory.get("retrieval_backend_requested"),
            "retrieval_backend_effective": "filesystem",
            "active_memory_nodes": active,
            "source_counts_collected": inventory.get("source_counts", {}),
            "active_source_kind_counts": source_counts,
            "active_memory_role_counts": role_counts,
            "active_phase_counts": phase_counts,
        },
        "legacy_retrieval_request": retrieval_decision,
        "context_library_status": _context_library_status(root_path),
        "inventory": inventory,
        "fallback_performed": False,
        "boundary": memory_recaller_boundary(),
    }

def build_trace_spine(source_text: str, source_metadata: dict[str, Any] | None = None, root: str | Path | None = None, limit: int = 12) -> dict[str, Any]:
    """Assemble the read-only RMC trace spine through deterministic memory recall."""
    source_metadata = dict(source_metadata or {})
    input_event = build_input_event(source_text, source_metadata)
    phase_report = parse_phase(source_text, source_metadata)
    resonance_report = analyze_resonance(source_text, source_metadata)
    drift_report = analyze_drift(phase_report)
    memory_report = recall_memory(source_text, source_metadata, root=root, limit=limit)

    if memory_report.get("status") != "OK":
        return {
            "status": "BLOCKED",
            "reason_code": memory_report.get("reason_code"),
            "engine_version": ENGINE_VERSION,
            "engine_mode": "read_only_rmc_trace_spine_filesystem_only",
            "stage": "Trace Spine",
            "input_event": input_event,
            "phase_report": phase_report,
            "memory_recall": memory_report,
            "drift_report": drift_report,
            "symbolic_trace": {
                "I_t": input_event,
                "M_t": {"status": "BLOCKED", "active_memory_count": 0, "active_memory_nodes": []},
                "Φ_t": {
                    "phase_primary": _phase_state(phase_report).get("phase_primary"),
                    "phase_secondary": _phase_state(phase_report).get("phase_secondary", []),
                    "phase_path_hypothesis": _phase_state(phase_report).get("phase_path_hypothesis", []),
                    "confidence": _phase_state(phase_report).get("confidence"),
                },
                "D_t": {
                    "drift_report_id": drift_report.get("drift_report_id"),
                    "epsilon_s": drift_report.get("epsilon_s"),
                    "projection_status": drift_report.get("projection_status"),
                },
                "C_t": {"status": "NOT_IMPLEMENTED_IN_B6"},
                "R_t": {"status": "NOT_RENDERED"},
            },
            "trace_spine_readiness": {
                "input_event_present": bool(input_event.get("event_id")),
                "phase_state_present": bool(_phase_state(phase_report).get("phase_primary")),
                "memory_state_present": False,
                "drift_state_present": bool(drift_report.get("drift_report_id")),
                "candidate_generator_present": False,
                "manifest_ready": False,
                "rendering_allowed": False,
                "memory_write_allowed": False,
            },
            "fallback_performed": False,
            "boundary": memory_recaller_boundary(),
        }

    operator_chain = [
        {"stage": "Input Event", "status": "implemented_read_only", "object": "I_t"},
        {"stage": "Phase Parser", "status": "implemented_read_only", "object": "Φ_t"},
        {"stage": "Memory Recaller", "status": "implemented_read_only_filesystem_only", "object": "M_t"},
        {"stage": "Drift Analyzer", "status": "implemented_read_only", "object": "D_t"},
        {"stage": "Candidate Conclusion Generator", "status": "not_implemented_in_B6", "object": "C_t"},
        {"stage": "Renderer", "status": "not_implemented_in_B6", "object": "R_t"},
    ]

    trace = {
        "trace_id": _stable_id("rmctrace", input_event["event_id"] + str(memory_report.get("memory_state", {}).get("active_memory_count", 0))),
        "trace_created_at_utc": _utc_now(),
        "I_t": input_event,
        "M_t": {
            "active_memory_count": memory_report.get("memory_state", {}).get("active_memory_count", 0),
            "active_memory_node_ids": [n.get("memory_id") for n in memory_report.get("memory_state", {}).get("active_memory_nodes", [])],
            "active_memory_nodes": memory_report.get("memory_state", {}).get("active_memory_nodes", []),
        },
        "Φ_t": {
            "phase_primary": _phase_state(phase_report).get("phase_primary"),
            "phase_secondary": _phase_state(phase_report).get("phase_secondary", []),
            "phase_path_hypothesis": _phase_state(phase_report).get("phase_path_hypothesis", []),
            "confidence": _phase_state(phase_report).get("confidence"),
        },
        "O_t": operator_chain,
        "D_t": {
            "drift_report_id": drift_report.get("drift_report_id"),
            "epsilon_s": drift_report.get("epsilon_s"),
            "projection_status": drift_report.get("projection_status"),
            "recommended_action": drift_report.get("recommended_action"),
            "circuit_breaker": drift_report.get("circuit_breaker"),
            "top_drift_classes": drift_report.get("top_drift_classes", [])[:5],
        },
        "C_t": {
            "status": "NOT_IMPLEMENTED_IN_B6",
            "next_required_patch": "B7 or C — Candidate Conclusion Generator Extraction",
        },
        "R_t": {
            "status": "NOT_RENDERED",
            "law": "No output rendering in B6; language remains downstream of manifest/renderer.",
        },
    }

    return {
        "status": "OK",
        "engine_version": ENGINE_VERSION,
        "engine_mode": "read_only_rmc_trace_spine_filesystem_only",
        "stage": "Trace Spine",
        "input_event": input_event,
        "phase_report": phase_report,
        "resonance_summary": {
            "resonance_event_count": len(resonance_report.get("resonance_events", [])),
            "operator_phrase_count": len(resonance_report.get("operator_phrases", [])),
            "circuit_breaker_candidate": resonance_report.get("circuit_breaker_candidate", False),
            "projection_allowed": resonance_report.get("projection_allowed", False),
            "phase_vector": resonance_report.get("phase_vector", {}),
            "violations": resonance_report.get("violations", []),
        },
        "memory_recall": memory_report,
        "drift_report": drift_report,
        "symbolic_trace": trace,
        "trace_spine_readiness": {
            "input_event_present": bool(input_event.get("event_id")),
            "phase_state_present": bool(_phase_state(phase_report).get("phase_primary")),
            "memory_state_present": True,
            "drift_state_present": bool(drift_report.get("drift_report_id")),
            "candidate_generator_present": False,
            "manifest_ready": False,
            "rendering_allowed": False,
            "memory_write_allowed": False,
        },
        "fallback_performed": False,
        "boundary": memory_recaller_boundary(),
    }

