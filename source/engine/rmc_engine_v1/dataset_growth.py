"""RMC Dataset Growth Pipeline v1 — observation capture, review queue, and promotion gate.

Patch 262J1R-Preflight-B5 adds a safe growth layer around the RMC resonance
lexicon/gold-reference system. It does not mutate canonical reference files.
It writes only operator-approved observation/review/receipt records under the
isolated growth root:

    /home/nic/forge/memory/rmc_dataset_v1/

Runtime law:
- raw input becomes an observation, never gold truth.
- observations may become candidate examples.
- candidates enter review queue.
- only a later approved promotion patch may update canonical reference files.

This module never calls an LLM, never queries Chroma, never reads DB files,
never writes Identity Vault, and never modifies rmc_engine_v1/reference/.
"""
from __future__ import annotations

import datetime as _dt
import hashlib
import json
import os
import tempfile
import re
from pathlib import Path
from typing import Any

from rmc_engine_v1.phase_parser import parse_phase
from rmc_engine_v1.resonance_lexicon import analyze_resonance
from rmc_engine_v1.drift_engine import analyze_drift
from rmc_engine_v1.lexicon_audit import lexicon_audit_report

ENGINE_VERSION = "rmc_dataset_growth_v1_patch262J1R_preflight_B5"
ENGINE_MODE = "dataset_growth_observation_pipeline"
DEFAULT_ROOT = Path("/home/nic/forge/memory/rmc_dataset_v1")
APPROVAL_CAPTURE = "CAPTURE_RMC_DATASET_OBSERVATION"
APPROVAL_CAPTURE_AND_QUEUE = "CAPTURE_AND_QUEUE_RMC_DATASET_CANDIDATE"
APPROVAL_CAPTURE_LLM_TURN = "CAPTURE_RMC_LLM_TURN"
APPROVAL_CAPTURE_DOCUMENT = "CAPTURE_RMC_DOCUMENT_OBSERVATIONS"
REFERENCE_DIR = Path(__file__).resolve().parent / "reference"

SUBDIRS = [
    "raw_events",
    "candidate_examples",
    "review_queue",
    "approved_promotions",
    "rejected_examples",
    "coverage_reports",
    "dataset_receipts",
    "version_manifests",
    "indexes",
]

CANONICAL_REFERENCE_FILES = [
    "letter_phase_map_v1.json",
    "word_loop_seed_lexicon_v1.jsonl",
    "operator_phrase_lexicon_v1.jsonl",
    "transition_law_examples_v1.jsonl",
    "syntactic_firewall_examples_v1.jsonl",
    "gold_reference_v1.jsonl",
    "scripture_phase_archetypes_v1.jsonl",
    "phase_codex_v2_5.json",
]


def _utc_now() -> str:
    return _dt.datetime.now(_dt.timezone.utc).replace(microsecond=0).isoformat()


def _day() -> str:
    return _dt.datetime.now(_dt.timezone.utc).strftime("%Y%m%d")


def _sha256_text(text: str) -> str:
    return hashlib.sha256((text or "").encode("utf-8")).hexdigest()


def _stable_id(prefix: str, text: str, salt: str = "") -> str:
    digest = hashlib.sha256(f"{prefix}|{salt}|{text}".encode("utf-8")).hexdigest()[:18]
    return f"{prefix}_{digest}"


def _dataset_root(root: str | Path | None = None) -> Path:
    if root is not None:
        return Path(root).expanduser().resolve()
    env_root = os.environ.get("FORGE_RMC_DATASET_ROOT")
    if env_root:
        return Path(env_root).expanduser().resolve()
    return DEFAULT_ROOT


def _assert_safe_root(root: Path) -> None:
    root = root.resolve()
    default = DEFAULT_ROOT.resolve()
    tmp = Path(tempfile.gettempdir()).resolve()
    if root == default or str(root).startswith(str(default) + os.sep):
        return
    if str(root).startswith(str(tmp) + os.sep):
        return
    raise ValueError(f"unsafe_dataset_root:{root}")


def _relative_to_root(path: Path, root: Path) -> str:
    try:
        return str(path.resolve().relative_to(root.resolve()))
    except Exception:
        return str(path)


def _ensure_dirs(root: Path) -> dict[str, str]:
    _assert_safe_root(root)
    made: dict[str, str] = {}
    for name in SUBDIRS:
        p = root / name
        p.mkdir(parents=True, exist_ok=True)
        made[name] = str(p)
    return made


def _write_json_atomic(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp_name = tempfile.mkstemp(prefix=path.name + ".", suffix=".tmp", dir=str(path.parent))
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            json.dump(payload, f, indent=2, ensure_ascii=False, sort_keys=True)
            f.write("\n")
        os.replace(tmp_name, path)
    finally:
        if os.path.exists(tmp_name):
            os.unlink(tmp_name)


def _append_jsonl(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a", encoding="utf-8") as f:
        f.write(json.dumps(payload, ensure_ascii=False, sort_keys=True) + "\n")


def _count_json_files(path: Path) -> int:
    if not path.exists():
        return 0
    return sum(1 for p in path.rglob("*.json") if p.is_file())


def _count_jsonl_rows(path: Path) -> int:
    if not path.exists():
        return 0
    total = 0
    for p in path.rglob("*.jsonl"):
        if not p.is_file():
            continue
        for line in p.read_text(encoding="utf-8").splitlines():
            if line.strip() and not line.strip().startswith("#"):
                total += 1
    return total


def _safe_preview(text: str, limit: int = 4000) -> str:
    text = str(text or "")
    return text[:limit]


def _allowed_document_roots() -> list[Path]:
    home = Path("/home/nic")
    return [
        home / "Downloads",
        home / "forge_corpus",
        home / "forge" / "memory" / "rmc_dataset_v1" / "uploads",
        home / "forge" / "memory" / "rmc_dataset_v1" / "document_staging",
        Path(tempfile.gettempdir()),
    ]


def _assert_safe_document_path(path: str | Path) -> Path:
    p = Path(path).expanduser().resolve()
    roots = [r.resolve() for r in _allowed_document_roots()]
    if not any(p == r or str(p).startswith(str(r) + os.sep) for r in roots):
        raise ValueError(f"unsafe_document_path:{p}")
    if not p.exists() or not p.is_file():
        raise FileNotFoundError(str(p))
    return p


def _read_text_document(path: Path, max_chars: int = 50000) -> tuple[str, dict[str, Any]]:
    suffix = path.suffix.lower()
    meta = {
        "document_path": str(path),
        "filename": path.name,
        "suffix": suffix,
        "size_bytes": path.stat().st_size,
        "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
        "max_chars": max_chars,
    }
    if path.stat().st_size > 25_000_000:
        raise ValueError("document_too_large_for_dataset_growth_preview")
    text = ""
    if suffix == ".pdf":
        try:
            from pypdf import PdfReader  # type: ignore
            reader = PdfReader(str(path))
            parts = []
            for page in reader.pages[:25]:
                if sum(len(x) for x in parts) >= max_chars:
                    break
                parts.append(page.extract_text() or "")
            text = "\n\n".join(parts)
            meta["extraction_method"] = "pypdf_first_25_pages"
            meta["pdf_page_count"] = len(reader.pages)
        except Exception as exc:
            raise RuntimeError(f"pdf_text_extraction_failed:{str(exc)[:160]}")
    else:
        data = path.read_bytes()
        try:
            text = data[:max_chars * 4].decode("utf-8")
            meta["extraction_method"] = "utf8_text"
        except UnicodeDecodeError:
            text = data[:max_chars * 4].decode("utf-8", errors="replace")
            meta["extraction_method"] = "utf8_replace"
    text = text[:max_chars]
    meta["extracted_chars"] = len(text)
    if not text.strip():
        raise ValueError("document_text_empty_after_extraction")
    return text, meta


def _chunk_text(text: str, max_chars: int = 2200, overlap: int = 120) -> list[dict[str, Any]]:
    clean = re.sub(r"\n{3,}", "\n\n", str(text or "")).strip()
    if not clean:
        return []
    chunks = []
    start = 0
    n = len(clean)
    idx = 0
    while start < n:
        end = min(n, start + max_chars)
        if end < n:
            cut = clean.rfind("\n\n", start, end)
            if cut <= start + 400:
                cut = clean.rfind(". ", start, end)
            if cut > start + 400:
                end = cut + 1
        chunk = clean[start:end].strip()
        if chunk:
            chunks.append({"chunk_index": idx, "char_start": start, "char_end": end, "text": chunk})
            idx += 1
        if end >= n:
            break
        start = max(0, end - overlap)
    return chunks


def _index_counts(root: Path) -> dict[str, int]:
    return {
        "raw_events": _count_json_files(root / "raw_events"),
        "candidate_examples": _count_json_files(root / "candidate_examples"),
        "review_queue": _count_json_files(root / "review_queue"),
        "approved_promotions": _count_json_files(root / "approved_promotions"),
        "rejected_examples": _count_json_files(root / "rejected_examples"),
        "coverage_reports": _count_json_files(root / "coverage_reports"),
        "dataset_receipts": _count_json_files(root / "dataset_receipts"),
        "version_manifests": _count_json_files(root / "version_manifests"),
        "index_rows": _count_jsonl_rows(root / "indexes"),
    }


def _reference_hash_manifest() -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for name in CANONICAL_REFERENCE_FILES:
        p = REFERENCE_DIR / name
        rows.append({
            "file": name,
            "exists": p.exists(),
            "sha256": hashlib.sha256(p.read_bytes()).hexdigest() if p.exists() else None,
            "size_bytes": p.stat().st_size if p.exists() else 0,
            "canonical_reference": True,
            "write_protected_by_dataset_growth": True,
        })
    return rows


def dataset_growth_boundary(root: str | Path | None = None) -> dict[str, Any]:
    r = _dataset_root(root)
    return {
        "engine_version": ENGINE_VERSION,
        "engine_mode": ENGINE_MODE,
        "engine_module_location": "forge/rmc_engine_v1/dataset_growth.py",
        "growth_root": str(r),
        "canonical_reference_location": "forge/rmc_engine_v1/reference/",
        "canonical_reference_write_allowed": False,
        "normal_runtime_gold_mutation_allowed": False,
        "observation_write_allowed_with_explicit_approval": True,
        "required_capture_approval": APPROVAL_CAPTURE,
        "required_capture_and_queue_approval": APPROVAL_CAPTURE_AND_QUEUE,
        "required_llm_turn_capture_approval": APPROVAL_CAPTURE_LLM_TURN,
        "required_document_capture_approval": APPROVAL_CAPTURE_DOCUMENT,
        "calls_llm": False,
        "queries_chroma": False,
        "reads_db_files": False,
        "writes_identity_vault": False,
        "writes_rmc_live_memory": False,
        "executes_shell": False,
        "approved_output": False,
    }


def dataset_growth_status(root: str | Path | None = None) -> dict[str, Any]:
    r = _dataset_root(root)
    subdir_status = {name: {"path": str(r / name), "exists": (r / name).exists()} for name in SUBDIRS}
    lexicon = lexicon_audit_report()
    return {
        "status": "OK",
        "mode": "read_only_dataset_growth_status",
        "dataset_root": str(r),
        "subdirs": subdir_status,
        "counts": _index_counts(r),
        "canonical_reference_audit_status": lexicon.get("status"),
        "canonical_reference_counts": lexicon.get("counts", {}),
        "canonical_reference_hash_manifest": _reference_hash_manifest(),
        "growth_law": {
            "raw_input_becomes": "observation_record",
            "observation_becomes": "candidate_example_after_mining",
            "candidate_becomes": "review_queue_item",
            "reviewed_item_becomes": "approved_promotion_candidate",
            "approved_promotion_becomes": "future_reference_patch_only",
            "raw_input_never_becomes": "gold_truth_directly",
        },
        "boundary": dataset_growth_boundary(r),
    }


def _source_metadata(source_text: str, source_kind: str = "operator_query_input") -> dict[str, Any]:
    return {
        "source_kind": source_kind,
        "input_sha256": _sha256_text(source_text),
        "input_length": len(source_text or ""),
        "input_preview": (source_text or "")[:240],
    }


def _build_pipeline(source_text: str, source_kind: str = "operator_query_input") -> dict[str, Any]:
    meta = _source_metadata(source_text, source_kind)
    phase_report = parse_phase(source_text, meta)
    resonance_report = analyze_resonance(source_text, meta)
    drift_report = analyze_drift(phase_report)
    return {
        "source_metadata": meta,
        "phase_report": phase_report,
        "resonance_report": resonance_report,
        "drift_report": drift_report,
    }


def _infer_candidate_kind(resonance_report: dict[str, Any], drift_report: dict[str, Any]) -> tuple[str, str]:
    syntactic = resonance_report.get("syntactic_firewall", {}) or {}
    violations = resonance_report.get("violations", []) or []
    circuit = bool(resonance_report.get("circuit_breaker_candidate")) or bool((drift_report.get("circuit_breaker") or {}).get("triggered"))
    if syntactic.get("syntactic_drift"):
        return "syntactic_firewall_example", "syntactic_candidate"
    if violations or circuit:
        return "gold_reference_bad_or_operator_phrase_candidate", "dangerous_or_violation_candidate"
    if resonance_report.get("operator_phrases"):
        return "operator_phrase_or_gold_safe_candidate", "safe_or_lawful_candidate"
    return "word_loop_or_transition_candidate", "needs_human_classification"


def _compact_phase_report(phase_report: dict[str, Any]) -> dict[str, Any]:
    st = phase_report.get("phase_state", {}) if isinstance(phase_report, dict) else {}
    return {
        "event_id": (phase_report.get("input_event") or {}).get("event_id"),
        "phase_primary": st.get("phase_primary"),
        "phase_secondary": st.get("phase_secondary", []),
        "phase_path_hypothesis": st.get("phase_path_hypothesis", []),
        "confidence": st.get("confidence"),
        "transition_warnings": st.get("transition_warnings", []),
    }


def _compact_resonance_report(resonance_report: dict[str, Any]) -> dict[str, Any]:
    return {
        "syntactic_firewall": resonance_report.get("syntactic_firewall", {}),
        "word_loop_count": len(resonance_report.get("word_loops", []) or []),
        "operator_phrase_count": len(resonance_report.get("operator_phrases", []) or []),
        "resonance_event_count": len(resonance_report.get("resonance_events", []) or []),
        "phase_vector": resonance_report.get("phase_vector", {}),
        "gate_signals": resonance_report.get("gate_signals", {}),
        "violations": resonance_report.get("violations", []),
        "circuit_breaker_candidate": resonance_report.get("circuit_breaker_candidate", False),
        "projection_allowed": resonance_report.get("projection_allowed", False),
        "recommended_route": resonance_report.get("recommended_route"),
    }


def _compact_drift_report(drift_report: dict[str, Any]) -> dict[str, Any]:
    return {
        "drift_report_id": drift_report.get("drift_report_id"),
        "epsilon_s": (drift_report.get("epsilon_s") or {}).get("epsilon_s"),
        "projection_status": drift_report.get("projection_status"),
        "recommended_action": drift_report.get("recommended_action"),
        "circuit_breaker": drift_report.get("circuit_breaker", {}),
        "top_drift_classes": [
            {
                "drift_key": row.get("drift_key"),
                "score": row.get("score"),
                "severity": row.get("severity"),
                "evidence": row.get("evidence", [])[:5],
            }
            for row in (drift_report.get("drift_classes", []) or [])[:4]
        ],
    }


def capture_preview(source_text: str, source_kind: str = "operator_query_input", root: str | Path | None = None) -> dict[str, Any]:
    r = _dataset_root(root)
    pipeline = _build_pipeline(source_text, source_kind)
    phase_report = pipeline["phase_report"]
    resonance_report = pipeline["resonance_report"]
    drift_report = pipeline["drift_report"]
    candidate_target, candidate_family = _infer_candidate_kind(resonance_report, drift_report)
    observation_id = _stable_id("rmcobs", source_text, json.dumps(_compact_resonance_report(resonance_report), sort_keys=True))
    candidate_id = _stable_id("rmccand", source_text, candidate_target)
    day = _day()
    planned_paths = {
        "raw_event": str(r / "raw_events" / day / f"{observation_id}.json"),
        "candidate_example": str(r / "candidate_examples" / day / f"{candidate_id}.json"),
        "review_queue": str(r / "review_queue" / day / f"{candidate_id}_review.json"),
        "receipt": str(r / "dataset_receipts" / day / f"{observation_id}_receipt.json"),
        "index": str(r / "indexes" / "events_index.jsonl"),
    }
    return {
        "status": "OK",
        "mode": "read_only_capture_preview",
        "observation_id": observation_id,
        "candidate_id": candidate_id,
        "source_metadata": pipeline["source_metadata"],
        "phase_summary": _compact_phase_report(phase_report),
        "resonance_summary": _compact_resonance_report(resonance_report),
        "drift_summary": _compact_drift_report(drift_report),
        "candidate_target_dataset": candidate_target,
        "candidate_family": candidate_family,
        "review_status": "NEEDS_REVIEW",
        "planned_paths": planned_paths,
        "write_would_touch_only_dataset_root": True,
        "canonical_reference_write_allowed": False,
        "writes_files": False,
        "boundary": dataset_growth_boundary(r),
    }


def _build_records(preview: dict[str, Any], approval: str, queue_candidate: bool, extra_context: dict[str, Any] | None = None) -> tuple[dict[str, Any], dict[str, Any], dict[str, Any]]:
    now = _utc_now()
    obs = {
        "record_type": "rmc_dataset_observation_v1",
        "observation_id": preview["observation_id"],
        "created_at_utc": now,
        "approval": approval,
        "source_metadata": preview["source_metadata"],
        "phase_summary": preview["phase_summary"],
        "resonance_summary": preview["resonance_summary"],
        "drift_summary": preview["drift_summary"],
        "candidate_target_dataset": preview["candidate_target_dataset"],
        "candidate_family": preview["candidate_family"],
        "record_status": "OBSERVED_NOT_GOLD",
        "law": "Raw input becomes observation only; never canonical truth.",
        "extra_context": extra_context or {},
    }
    cand = {
        "record_type": "rmc_dataset_candidate_example_v1",
        "candidate_id": preview["candidate_id"],
        "source_observation_id": preview["observation_id"],
        "created_at_utc": now,
        "candidate_target_dataset": preview["candidate_target_dataset"],
        "candidate_family": preview["candidate_family"],
        "input": preview["source_metadata"].get("input_preview", ""),
        "input_sha256": preview["source_metadata"].get("input_sha256"),
        "suggested_labels": {
            "expected_violation": bool(preview["resonance_summary"].get("violations")),
            "expected_circuit_breaker_candidate": bool(preview["resonance_summary"].get("circuit_breaker_candidate")),
            "expected_projection_allowed": bool(preview["resonance_summary"].get("projection_allowed")),
            "expected_memory_write_allowed": False,
            "recommended_route": preview["resonance_summary"].get("recommended_route"),
        },
        "phase_summary": preview["phase_summary"],
        "resonance_summary": preview["resonance_summary"],
        "drift_summary": preview["drift_summary"],
        "review_status": "NEEDS_REVIEW",
        "promotion_allowed": False,
        "promotion_reason": "Requires human/verifier review and future approved promotion patch.",
        "extra_context": extra_context or {},
    }
    receipt = {
        "record_type": "rmc_dataset_capture_receipt_v1",
        "observation_id": preview["observation_id"],
        "candidate_id": preview["candidate_id"] if queue_candidate else None,
        "created_at_utc": now,
        "approval": approval,
        "queue_candidate": queue_candidate,
        "canonical_reference_write_allowed": False,
        "canonical_reference_files_touched": [],
        "growth_paths": preview.get("planned_paths", {}),
        "source_input_sha256": preview["source_metadata"].get("input_sha256"),
        "engine_version": ENGINE_VERSION,
        "extra_context_sha256": _sha256_text(json.dumps(extra_context or {}, sort_keys=True, ensure_ascii=False)),
    }
    return obs, cand, receipt


def capture_observation(source_text: str, approval: str | None, source_kind: str = "operator_query_input", root: str | Path | None = None) -> dict[str, Any]:
    r = _dataset_root(root)
    _assert_safe_root(r)
    if approval not in {APPROVAL_CAPTURE, APPROVAL_CAPTURE_AND_QUEUE}:
        return {
            "status": "REFUSED",
            "failure_code": "RMC_DATASET_CAPTURE_REQUIRES_EXPLICIT_APPROVAL",
            "required_approval_values": [APPROVAL_CAPTURE, APPROVAL_CAPTURE_AND_QUEUE],
            "received_approval": approval,
            "writes_files": False,
            "canonical_reference_write_allowed": False,
            "boundary": dataset_growth_boundary(r),
        }
    queue_candidate = approval == APPROVAL_CAPTURE_AND_QUEUE
    _ensure_dirs(r)
    preview = capture_preview(source_text, source_kind, r)
    observation, candidate, receipt = _build_records(preview, approval, queue_candidate)
    paths = preview["planned_paths"]
    raw_path = Path(paths["raw_event"])
    receipt_path = Path(paths["receipt"])
    index_path = Path(paths["index"])
    written = []

    _write_json_atomic(raw_path, observation)
    written.append(str(raw_path))
    if queue_candidate:
        cand_path = Path(paths["candidate_example"])
        review_path = Path(paths["review_queue"])
        _write_json_atomic(cand_path, candidate)
        _write_json_atomic(review_path, {**candidate, "queue_record_type": "rmc_dataset_review_queue_item_v1"})
        written.extend([str(cand_path), str(review_path)])
    _write_json_atomic(receipt_path, receipt)
    written.append(str(receipt_path))
    _append_jsonl(index_path, {
        "observation_id": observation["observation_id"],
        "candidate_id": candidate["candidate_id"] if queue_candidate else None,
        "created_at_utc": receipt["created_at_utc"],
        "input_sha256": receipt["source_input_sha256"],
        "queue_candidate": queue_candidate,
        "receipt": _relative_to_root(receipt_path, r),
        "canonical_reference_write_allowed": False,
    })
    written.append(str(index_path))

    return {
        "status": "OK",
        "mode": "approved_dataset_observation_capture",
        "observation_id": observation["observation_id"],
        "candidate_id": candidate["candidate_id"] if queue_candidate else None,
        "queued_for_review": queue_candidate,
        "written_files": written,
        "written_files_relative": [_relative_to_root(Path(p), r) for p in written],
        "canonical_reference_files_touched": [],
        "canonical_reference_write_allowed": False,
        "writes_files": True,
        "writes_scope": "growth_dataset_only",
        "dataset_root": str(r),
        "receipt": receipt,
        "post_capture_counts": _index_counts(r),
        "boundary": dataset_growth_boundary(r),
    }



def capture_llm_turn_preview(request_text: str, response_text: str = "", route: str = "operator_llm_request", root: str | Path | None = None) -> dict[str, Any]:
    preview = capture_preview(request_text, "operator_llm_request", root)
    response_text = str(response_text or "")
    preview["mode"] = "read_only_llm_turn_capture_preview"
    preview["llm_turn"] = {
        "route": route,
        "request_sha256": _sha256_text(request_text),
        "response_sha256": _sha256_text(response_text),
        "request_length": len(request_text or ""),
        "response_length": len(response_text),
        "response_preview": _safe_preview(response_text, 2000),
        "stores_hidden_chain_of_thought": False,
        "canonical_reference_write_allowed": False,
    }
    return preview


def capture_llm_turn(request_text: str, response_text: str, approval: str | None, route: str = "operator_llm_request", root: str | Path | None = None) -> dict[str, Any]:
    if approval != APPROVAL_CAPTURE_LLM_TURN:
        return {
            "status": "REFUSED",
            "failure_code": "RMC_LLM_TURN_CAPTURE_REQUIRES_EXPLICIT_APPROVAL",
            "required_approval": APPROVAL_CAPTURE_LLM_TURN,
            "received_approval": approval,
            "writes_files": False,
            "canonical_reference_write_allowed": False,
            "boundary": dataset_growth_boundary(root),
        }
    r = _dataset_root(root)
    _assert_safe_root(r)
    _ensure_dirs(r)
    preview = capture_llm_turn_preview(request_text, response_text, route, r)
    extra = preview.get("llm_turn", {})
    observation, candidate, receipt = _build_records(preview, approval, True, extra)
    paths = preview["planned_paths"]
    raw_path = Path(paths["raw_event"])
    cand_path = Path(paths["candidate_example"])
    review_path = Path(paths["review_queue"])
    receipt_path = Path(paths["receipt"])
    index_path = Path(paths["index"])
    _write_json_atomic(raw_path, observation)
    _write_json_atomic(cand_path, candidate)
    _write_json_atomic(review_path, {**candidate, "queue_record_type": "rmc_dataset_review_queue_item_v1"})
    _write_json_atomic(receipt_path, receipt)
    _append_jsonl(index_path, {
        "observation_id": observation["observation_id"],
        "candidate_id": candidate["candidate_id"],
        "created_at_utc": receipt["created_at_utc"],
        "source_kind": "operator_llm_request",
        "route": route,
        "input_sha256": receipt["source_input_sha256"],
        "receipt": _relative_to_root(receipt_path, r),
        "canonical_reference_write_allowed": False,
    })
    written = [raw_path, cand_path, review_path, receipt_path, index_path]
    return {
        "status": "OK",
        "mode": "approved_llm_turn_dataset_capture",
        "observation_id": observation["observation_id"],
        "candidate_id": candidate["candidate_id"],
        "queued_for_review": True,
        "writes_files": True,
        "writes_scope": "growth_dataset_only",
        "written_files_relative": [_relative_to_root(p, r) for p in written],
        "canonical_reference_files_touched": [],
        "canonical_reference_write_allowed": False,
        "post_capture_counts": _index_counts(r),
        "boundary": dataset_growth_boundary(r),
    }


def document_capture_preview(path: str, root: str | Path | None = None, max_chars: int = 50000) -> dict[str, Any]:
    r = _dataset_root(root)
    p = _assert_safe_document_path(path)
    text, meta = _read_text_document(p, max_chars=max_chars)
    chunks = _chunk_text(text)
    doc_id = _stable_id("rmcdoc", meta["sha256"], p.name)
    day = _day()
    chunk_previews = []
    for ch in chunks[:12]:
        cp = capture_preview(ch["text"], "document_chunk", r)
        chunk_previews.append({
            "chunk_index": ch["chunk_index"],
            "char_start": ch["char_start"],
            "char_end": ch["char_end"],
            "observation_id": cp.get("observation_id"),
            "candidate_id": cp.get("candidate_id"),
            "candidate_target_dataset": cp.get("candidate_target_dataset"),
            "candidate_family": cp.get("candidate_family"),
            "projection_allowed": (cp.get("resonance_summary") or {}).get("projection_allowed"),
            "circuit_breaker_candidate": (cp.get("resonance_summary") or {}).get("circuit_breaker_candidate"),
        })
    return {
        "status": "OK",
        "mode": "read_only_document_dataset_capture_preview",
        "document_id": doc_id,
        "document_metadata": meta,
        "chunk_count": len(chunks),
        "previewed_chunks": chunk_previews,
        "planned_paths": {
            "document_record": str(r / "raw_events" / day / f"{doc_id}_document.json"),
            "document_receipt": str(r / "dataset_receipts" / day / f"{doc_id}_document_receipt.json"),
            "index": str(r / "indexes" / "events_index.jsonl"),
        },
        "write_would_touch_only_dataset_root": True,
        "canonical_reference_write_allowed": False,
        "writes_files": False,
        "boundary": dataset_growth_boundary(r),
    }


def capture_document_observations(path: str, approval: str | None, root: str | Path | None = None, max_chars: int = 50000) -> dict[str, Any]:
    if approval != APPROVAL_CAPTURE_DOCUMENT:
        return {
            "status": "REFUSED",
            "failure_code": "RMC_DOCUMENT_CAPTURE_REQUIRES_EXPLICIT_APPROVAL",
            "required_approval": APPROVAL_CAPTURE_DOCUMENT,
            "received_approval": approval,
            "writes_files": False,
            "canonical_reference_write_allowed": False,
            "boundary": dataset_growth_boundary(root),
        }
    r = _dataset_root(root)
    _assert_safe_root(r)
    _ensure_dirs(r)
    p = _assert_safe_document_path(path)
    text, meta = _read_text_document(p, max_chars=max_chars)
    chunks = _chunk_text(text)
    doc_id = _stable_id("rmcdoc", meta["sha256"], p.name)
    day = _day()
    document_record = {
        "record_type": "rmc_document_growth_capture_v1",
        "document_id": doc_id,
        "created_at_utc": _utc_now(),
        "approval": approval,
        "document_metadata": meta,
        "chunk_count": len(chunks),
        "record_status": "DOCUMENT_OBSERVED_NOT_GOLD",
        "canonical_reference_write_allowed": False,
    }
    written: list[Path] = []
    doc_path = r / "raw_events" / day / f"{doc_id}_document.json"
    _write_json_atomic(doc_path, document_record)
    written.append(doc_path)
    for ch in chunks:
        cp = capture_preview(ch["text"], "document_chunk", r)
        extra = {"document_id": doc_id, "document_filename": p.name, "chunk_index": ch["chunk_index"], "char_start": ch["char_start"], "char_end": ch["char_end"]}
        obs, cand, receipt = _build_records(cp, approval, True, extra)
        paths = cp["planned_paths"]
        raw_path = Path(paths["raw_event"])
        cand_path = Path(paths["candidate_example"])
        review_path = Path(paths["review_queue"])
        receipt_path = Path(paths["receipt"])
        _write_json_atomic(raw_path, obs)
        _write_json_atomic(cand_path, cand)
        _write_json_atomic(review_path, {**cand, "queue_record_type": "rmc_dataset_review_queue_item_v1"})
        _write_json_atomic(receipt_path, receipt)
        written.extend([raw_path, cand_path, review_path, receipt_path])
    receipt_path = r / "dataset_receipts" / day / f"{doc_id}_document_receipt.json"
    receipt = {
        "record_type": "rmc_document_dataset_capture_receipt_v1",
        "document_id": doc_id,
        "created_at_utc": _utc_now(),
        "approval": approval,
        "chunk_count": len(chunks),
        "source_document_sha256": meta["sha256"],
        "canonical_reference_files_touched": [],
        "canonical_reference_write_allowed": False,
        "written_files_relative": [_relative_to_root(x, r) for x in written],
    }
    _write_json_atomic(receipt_path, receipt)
    written.append(receipt_path)
    index_path = r / "indexes" / "events_index.jsonl"
    _append_jsonl(index_path, {"document_id": doc_id, "created_at_utc": receipt["created_at_utc"], "source_kind": "document_capture", "chunk_count": len(chunks), "receipt": _relative_to_root(receipt_path, r), "canonical_reference_write_allowed": False})
    written.append(index_path)
    return {
        "status": "OK",
        "mode": "approved_document_dataset_capture",
        "document_id": doc_id,
        "chunk_count": len(chunks),
        "queued_for_review": True,
        "writes_files": True,
        "writes_scope": "growth_dataset_only",
        "written_files_relative": [_relative_to_root(x, r) for x in written],
        "canonical_reference_files_touched": [],
        "canonical_reference_write_allowed": False,
        "post_capture_counts": _index_counts(r),
        "boundary": dataset_growth_boundary(r),
    }


def coverage_report(root: str | Path | None = None) -> dict[str, Any]:
    r = _dataset_root(root)
    status = dataset_growth_status(r)
    counts = status["counts"]
    canonical = status.get("canonical_reference_counts", {})
    readiness = {
        "growth_root_exists": r.exists(),
        "has_raw_events": counts.get("raw_events", 0) > 0,
        "has_review_queue": counts.get("review_queue", 0) > 0,
        "canonical_reference_status_ok": status.get("canonical_reference_audit_status") == "OK",
        "canonical_and_growth_separated": True,
    }
    return {
        "status": "OK",
        "mode": "read_only_dataset_growth_coverage_report",
        "dataset_root": str(r),
        "growth_counts": counts,
        "canonical_reference_counts": canonical,
        "readiness": readiness,
        "coverage_note": "Growth corpus expands observation/review coverage; canonical gold changes require future approved promotion patch.",
        "boundary": dataset_growth_boundary(r),
    }
