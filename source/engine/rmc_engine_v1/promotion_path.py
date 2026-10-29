"""RMC Promotion Path / P_t engine.

Patch 262J1R-Preflight-C12 completes the human-review promotion path
for the RMC dataset growth surface:

    review_queue -> stable_memory -> retrieval index

This is not canonical-reference mutation and it is not an automatic trainer.
It promotes only reviewed RMC candidate/event records into an auditable stable
memory layer under /home/nic/forge/memory/rmc_dataset_v1/.  The original
review queue item remains immutable evidence; promotion creates a stable copy,
a receipt, and retrieval index rows.

Runtime law:
- preview/list/status are read-only.
- promotion requires explicit APPROVE_RMC_PROMOTION.
- promotion writes only inside the approved dataset root.
- no LLM calls, no Chroma, no DB reads, no shell execution, no Identity Vault.
- dangerous/circuit-breaker examples may be promoted only as blocked-pattern
  or negative training evidence, never as stable truth.
"""
from __future__ import annotations

import datetime as _dt
import hashlib
import json
import os
import re
import tempfile
from pathlib import Path
from typing import Any

ENGINE_VERSION = "rmc_promotion_path_v1_patch262J1R_preflight_C12"
ENGINE_MODE = "review_queue_to_stable_memory_promotion"
DEFAULT_DATASET_ROOT = Path("/home/nic/forge/memory/rmc_dataset_v1")
APPROVAL_TOKEN = "APPROVE_RMC_PROMOTION"

REQUIRED_REVIEW_FIELDS = [
    "candidate_id",
    "record_type",
    "queue_record_type",
    "input",
    "input_sha256",
    "phase_summary",
    "drift_summary",
    "resonance_summary",
    "candidate_target_dataset",
    "candidate_family",
    "review_status",
]

REQUIRED_STABLE_MEMORY_FIELDS = [
    "stable_memory_id",
    "stable_memory_object_type",
    "source_candidate_id",
    "source_review_path",
    "content",
    "content_sha256",
    "phase_tags",
    "drift_summary",
    "resonance_summary",
    "candidate_family",
    "candidate_target_dataset",
    "retrieval_tags",
    "promotion_status",
    "promotion_receipt_id",
]

SUBDIRS = [
    "review_queue",
    "stable_memory",
    "approved_promotions",
    "indexes",
]


def _utc_now() -> str:
    return _dt.datetime.now(_dt.timezone.utc).replace(microsecond=0).isoformat()


def _day() -> str:
    return _dt.datetime.now(_dt.timezone.utc).strftime("%Y%m%d")


def _sha(value: Any) -> str:
    return hashlib.sha256(json.dumps(value, sort_keys=True, ensure_ascii=False, default=str).encode("utf-8")).hexdigest()


def _stable_id(prefix: str, value: Any) -> str:
    return f"{prefix}_{_sha(value)[:18]}"


def _as_dict(value: Any) -> dict[str, Any]:
    return value if isinstance(value, dict) else {}


def _as_list(value: Any) -> list[Any]:
    return value if isinstance(value, list) else []


def _dataset_root(root: str | Path | None = None) -> Path:
    if root is not None:
        return Path(root).expanduser().resolve()
    env = os.environ.get("FORGE_RMC_DATASET_ROOT")
    if env:
        return Path(env).expanduser().resolve()
    return DEFAULT_DATASET_ROOT.resolve()


def _assert_safe_root(root: Path) -> None:
    root = root.resolve()
    default = DEFAULT_DATASET_ROOT.resolve()
    tmp = Path(tempfile.gettempdir()).resolve()
    if root == default or str(root).startswith(str(default) + os.sep):
        return
    if str(root).startswith(str(tmp) + os.sep):
        return
    raise ValueError(f"unsafe_promotion_root:{root}")


def _ensure_dirs(root: Path) -> dict[str, str]:
    _assert_safe_root(root)
    made: dict[str, str] = {}
    for name in SUBDIRS:
        path = root / name
        path.mkdir(parents=True, exist_ok=True)
        made[name] = str(path)
    return made


def _inside(root: Path, path: Path) -> bool:
    try:
        rr = root.resolve()
        pp = path.resolve()
        return pp == rr or rr in pp.parents
    except Exception:
        return False


def _relative(root: Path, path: Path) -> str:
    try:
        return str(path.resolve().relative_to(root.resolve()))
    except Exception:
        return str(path)


def _read_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def _write_json_atomic(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp_name = tempfile.mkstemp(prefix=path.name + ".", suffix=".tmp", dir=str(path.parent))
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as handle:
            json.dump(payload, handle, indent=2, ensure_ascii=False, sort_keys=True)
            handle.write("\n")
        os.replace(tmp_name, path)
    finally:
        if os.path.exists(tmp_name):
            os.unlink(tmp_name)


def _append_jsonl(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(payload, ensure_ascii=False, sort_keys=True) + "\n")


def _read_jsonl(path: Path) -> list[dict[str, Any]]:
    if not path.exists():
        return []
    rows: list[dict[str, Any]] = []
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            parsed = json.loads(line)
        except Exception:
            continue
        if isinstance(parsed, dict):
            rows.append(parsed)
    return rows


def _count_json(path: Path) -> int:
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
        total += sum(1 for line in p.read_text(encoding="utf-8").splitlines() if line.strip())
    return total


def promotion_boundary(root: str | Path | None = None) -> dict[str, Any]:
    r = _dataset_root(root)
    return {
        "engine_version": ENGINE_VERSION,
        "engine_mode": ENGINE_MODE,
        "engine_module_location": "forge/rmc_engine_v1/promotion_path.py",
        "approved_dataset_root": str(r),
        "input_contract": "human_reviewed_rmc_dataset_review_queue_item",
        "output_contract": "stable_memory_record_plus_promotion_receipt_plus_retrieval_index_row",
        "promotion_token_required": APPROVAL_TOKEN,
        "preview_read_only": True,
        "promote_writes_files_only_with_explicit_approval": True,
        "canonical_reference_write": False,
        "identity_vault_write": False,
        "rmc_live_memory_write": False,
        "queries_chroma": False,
        "reads_db_files": False,
        "calls_llm": False,
        "executes_shell": False,
        "source_review_queue_immutable": True,
    }


def promotion_schema_contract() -> dict[str, Any]:
    return {
        "promotion_symbol": "P_t",
        "formula": "P_t = promote(review_queue_item) iff approval_token_valid ∧ review_item_valid ∧ safe_path ∧ not_duplicate",
        "memory_update_formula": "M_{t+1} = M_t ∪ {stable_memory_t, retrieval_index_t, promotion_receipt_t}",
        "source_path": "review_queue/<day>/<candidate_id>_review.json",
        "stable_memory_path": "stable_memory/<namespace>/<day>/<stable_memory_id>.json",
        "receipt_path": "approved_promotions/<day>/<promotion_id>_receipt.json",
        "retrieval_index_path": "indexes/stable_memory_retrieval_index.jsonl",
        "required_review_fields": list(REQUIRED_REVIEW_FIELDS),
        "required_stable_memory_fields": list(REQUIRED_STABLE_MEMORY_FIELDS),
        "approval_token_required": APPROVAL_TOKEN,
        "dangerous_examples_policy": "may_promote_only_as_blocked_pattern_or_negative_training_evidence_not_stable_truth",
    }


def _review_paths(root: Path) -> list[Path]:
    review_root = root / "review_queue"
    if not review_root.exists():
        return []
    return sorted([p for p in review_root.rglob("*.json") if p.is_file()], key=lambda p: str(p))


def _candidate_id_from_path(path: Path) -> str:
    name = path.name
    if name.endswith("_review.json"):
        return name[:-len("_review.json")]
    if name.endswith(".json"):
        return name[:-len(".json")]
    return name


def _find_review_path(root: Path, candidate_id: str | None = None, review_path: str | Path | None = None) -> Path | None:
    if review_path is not None:
        p = Path(review_path).expanduser().resolve()
        return p if _inside(root, p) and p.is_file() else None
    cid = str(candidate_id or "").strip()
    if not cid:
        return None
    for p in _review_paths(root):
        data_id = None
        try:
            data_id = _read_json(p).get("candidate_id")
        except Exception:
            pass
        if cid == data_id or cid == _candidate_id_from_path(p):
            return p
    return None


def _missing_review_fields(item: dict[str, Any]) -> list[str]:
    return [key for key in REQUIRED_REVIEW_FIELDS if key not in item]


def _phase_tags(item: dict[str, Any]) -> list[str]:
    phase = _as_dict(item.get("phase_summary"))
    tags: list[str] = []
    for key in ("phase_primary",):
        value = phase.get(key)
        if value and value not in tags:
            tags.append(str(value))
    for value in _as_list(phase.get("phase_secondary")) + _as_list(phase.get("phase_path_hypothesis")):
        if value and str(value) not in tags:
            tags.append(str(value))
    return tags


def _circuit_breaker_triggered(item: dict[str, Any]) -> bool:
    drift = _as_dict(item.get("drift_summary"))
    circuit = _as_dict(drift.get("circuit_breaker"))
    return bool(circuit.get("triggered"))


def _namespace_for_item(item: dict[str, Any]) -> str:
    family = str(item.get("candidate_family") or "").lower()
    target = str(item.get("candidate_target_dataset") or "").lower()
    drift = _as_dict(item.get("drift_summary"))
    projection_status = str(drift.get("projection_status") or "").lower()
    if _circuit_breaker_triggered(item) or "dangerous" in family or "bad" in target or "blocked" in projection_status:
        return "blocked_patterns"
    if "syntactic" in target:
        return "syntactic_firewall_examples"
    if "operator" in target:
        return "operator_phrase_examples"
    if "transition" in target or "word_loop" in target:
        return "transition_examples"
    return "approved_events"


def _review_summary(path: Path, root: Path) -> dict[str, Any]:
    try:
        item = _read_json(path)
    except Exception as exc:
        return {
            "candidate_id": _candidate_id_from_path(path),
            "path": _relative(root, path),
            "status": "UNREADABLE",
            "error": f"{type(exc).__name__}:{str(exc)[:120]}",
            "promotable_preview": False,
        }
    missing = _missing_review_fields(item)
    namespace = _namespace_for_item(item)
    return {
        "candidate_id": item.get("candidate_id") or _candidate_id_from_path(path),
        "source_observation_id": item.get("source_observation_id"),
        "path": _relative(root, path),
        "review_status": item.get("review_status"),
        "candidate_family": item.get("candidate_family"),
        "candidate_target_dataset": item.get("candidate_target_dataset"),
        "phase_tags": _phase_tags(item),
        "circuit_breaker_triggered": _circuit_breaker_triggered(item),
        "promotion_namespace": namespace,
        "promotable_preview": not missing,
        "missing_required_fields": missing,
    }


def promotion_status(root: str | Path | None = None, limit: int = 20) -> dict[str, Any]:
    r = _dataset_root(root)
    _assert_safe_root(r)
    review_items = [_review_summary(p, r) for p in _review_paths(r)[: max(0, int(limit or 20))]]
    return {
        "status": "OK",
        "engine_version": ENGINE_VERSION,
        "engine_mode": "read_only_promotion_status_C12",
        "stage": "Promotion Path Status",
        "dataset_root": str(r),
        "counts": {
            "review_queue": _count_json(r / "review_queue"),
            "stable_memory": _count_json(r / "stable_memory"),
            "approved_promotions": _count_json(r / "approved_promotions"),
            "retrieval_index_rows": _count_jsonl_rows(r / "indexes"),
        },
        "review_queue_preview": review_items,
        "schema_contract": promotion_schema_contract(),
        "boundary": promotion_boundary(r),
        "writes_files": False,
        "memory_write_allowed": False,
        "identity_vault_write": False,
        "queries_chroma": False,
        "calls_llm": False,
    }


def _stable_memory_record(item: dict[str, Any], review_path: Path, root: Path) -> dict[str, Any]:
    candidate_id = str(item.get("candidate_id") or _candidate_id_from_path(review_path))
    content = str(item.get("input") or "")
    namespace = _namespace_for_item(item)
    receipt_basis = {
        "candidate_id": candidate_id,
        "input_sha256": item.get("input_sha256"),
        "target": item.get("candidate_target_dataset"),
        "namespace": namespace,
    }
    receipt_id = _stable_id("rmcpromrec", receipt_basis)
    stable_basis = {**receipt_basis, "receipt_id": receipt_id, "review_path": _relative(root, review_path)}
    retrieval_tags = ["rmc", "stable_memory", "promotion_path", namespace]
    for tag in item.get("suggested_labels") or []:
        if isinstance(tag, str) and tag not in retrieval_tags:
            retrieval_tags.append(tag)
    for phase in _phase_tags(item):
        tag = f"phase:{phase}"
        if tag not in retrieval_tags:
            retrieval_tags.append(tag)
    if _circuit_breaker_triggered(item) and "blocked_pattern" not in retrieval_tags:
        retrieval_tags.append("blocked_pattern")
    return {
        "stable_memory_id": _stable_id("rmcstable", stable_basis),
        "stable_memory_object_type": "rmc_stable_memory_v1",
        "created_at_utc": _utc_now(),
        "source_candidate_id": candidate_id,
        "source_observation_id": item.get("source_observation_id"),
        "source_review_path": _relative(root, review_path),
        "source_review_sha256": _sha(item),
        "content": content,
        "content_sha256": item.get("input_sha256") or _sha(content),
        "phase_tags": _phase_tags(item),
        "phase_summary": _as_dict(item.get("phase_summary")),
        "drift_summary": _as_dict(item.get("drift_summary")),
        "resonance_summary": _as_dict(item.get("resonance_summary")),
        "candidate_family": item.get("candidate_family"),
        "candidate_target_dataset": item.get("candidate_target_dataset"),
        "memory_role": "blocked_pattern_evidence" if namespace == "blocked_patterns" else "stable_reviewed_candidate",
        "truth_status": "negative_or_blocked_example_not_truth" if namespace == "blocked_patterns" else "human_reviewed_stable_memory_candidate",
        "retrieval_tags": retrieval_tags,
        "retrieval_weight": _retrieval_weight(item, namespace),
        "promotion_namespace": namespace,
        "promotion_status": "promotion_preview_not_written",
        "promotion_receipt_id": receipt_id,
        "canonical_reference_write": False,
        "identity_vault_write": False,
    }


def _retrieval_weight(item: dict[str, Any], namespace: str) -> float:
    drift = _as_dict(item.get("drift_summary"))
    eps = drift.get("epsilon_s")
    try:
        eps_f = float(eps)
    except Exception:
        eps_f = 0.5
    base = 0.62
    if namespace == "blocked_patterns":
        base = 0.72  # blocked examples are highly retrievable as warnings, not truth.
    if namespace == "approved_events":
        base = 0.78
    return round(max(0.05, min(1.0, base - min(0.25, eps_f * 0.12))), 6)


def _target_paths(root: Path, stable: dict[str, Any], day: str | None = None) -> dict[str, Path]:
    day = day or _day()
    namespace = re.sub(r"[^a-zA-Z0-9_\-]", "_", str(stable.get("promotion_namespace") or "approved_events"))[:80]
    stable_id = re.sub(r"[^a-zA-Z0-9_\-]", "_", str(stable.get("stable_memory_id") or "missing_stable_id"))[:140]
    receipt_id = re.sub(r"[^a-zA-Z0-9_\-]", "_", str(stable.get("promotion_receipt_id") or "missing_receipt_id"))[:140]
    return {
        "stable_memory": root / "stable_memory" / namespace / day / f"{stable_id}.json",
        "promotion_receipt": root / "approved_promotions" / day / f"{receipt_id}.json",
        "retrieval_index": root / "indexes" / "stable_memory_retrieval_index.jsonl",
        "stable_memory_index": root / "indexes" / "stable_memory_index.jsonl",
    }


def _index_duplicate(root: Path, stable: dict[str, Any]) -> dict[str, Any]:
    rows = _read_jsonl(root / "indexes" / "stable_memory_retrieval_index.jsonl")
    content_hash = str(stable.get("content_sha256"))
    candidate_id = str(stable.get("source_candidate_id"))
    stable_id = str(stable.get("stable_memory_id"))
    for row in rows:
        if stable_id and row.get("stable_memory_id") == stable_id:
            return {"duplicate": True, "reason": "stable_memory_id_already_indexed", "row": row}
        if candidate_id and row.get("source_candidate_id") == candidate_id:
            return {"duplicate": True, "reason": "source_candidate_id_already_promoted", "row": row}
        if content_hash and row.get("content_sha256") == content_hash:
            return {"duplicate": True, "reason": "content_sha256_already_promoted", "row": row}
    return {"duplicate": False, "reason": None, "row": None}


def build_promotion_plan(candidate_id: str | None = None, root: str | Path | None = None, review_path: str | Path | None = None) -> dict[str, Any]:
    r = _dataset_root(root)
    _assert_safe_root(r)
    path = _find_review_path(r, candidate_id, review_path)
    if path is None:
        return {
            "status": "REFUSED",
            "engine_version": ENGINE_VERSION,
            "engine_mode": "read_only_promotion_plan_C12",
            "failure_code": "RMC_PROMOTION_REVIEW_ITEM_NOT_FOUND",
            "candidate_id": candidate_id,
            "promotion_allowed": False,
            "writes_files": False,
            "boundary": promotion_boundary(r),
        }
    if not _inside(r, path):
        return {
            "status": "REFUSED",
            "engine_version": ENGINE_VERSION,
            "engine_mode": "read_only_promotion_plan_C12",
            "failure_code": "RMC_PROMOTION_REVIEW_PATH_OUTSIDE_ROOT",
            "candidate_id": candidate_id,
            "promotion_allowed": False,
            "writes_files": False,
            "boundary": promotion_boundary(r),
        }
    try:
        item = _read_json(path)
    except Exception as exc:
        return {
            "status": "REFUSED",
            "engine_version": ENGINE_VERSION,
            "engine_mode": "read_only_promotion_plan_C12",
            "failure_code": "RMC_PROMOTION_REVIEW_ITEM_UNREADABLE",
            "candidate_id": candidate_id,
            "diagnostics": {"exception_type": type(exc).__name__, "exception": str(exc)[:200]},
            "promotion_allowed": False,
            "writes_files": False,
            "boundary": promotion_boundary(r),
        }
    missing = _missing_review_fields(item)
    stable = _stable_memory_record(item, path, r)
    paths = _target_paths(r, stable)
    unsafe = [str(p) for p in paths.values() if not _inside(r, p)]
    duplicate = _index_duplicate(r, stable)
    receipt = _promotion_receipt_preview(stable, item, path, paths, duplicate)
    if missing or unsafe:
        status = "REFUSED"
    else:
        status = "OK"
    return {
        "status": status,
        "engine_version": ENGINE_VERSION,
        "engine_mode": "read_only_promotion_plan_C12",
        "stage": "Promotion Path Preview",
        "candidate_id": item.get("candidate_id") or _candidate_id_from_path(path),
        "source_review_path": _relative(r, path),
        "promotion_allowed": status == "OK" and not bool(duplicate.get("duplicate")),
        "requires_explicit_approval": True,
        "approval_token_required": APPROVAL_TOKEN,
        "missing_required_fields": missing,
        "unsafe_paths": unsafe,
        "duplicate_check": duplicate,
        "stable_memory_preview": stable,
        "promotion_receipt_preview": receipt,
        "target_paths_preview": {key: _relative(r, value) for key, value in paths.items()},
        "schema_contract": promotion_schema_contract(),
        "boundary": promotion_boundary(r),
        "writes_files": False,
        "memory_write_allowed": False,
        "identity_vault_write": False,
        "canonical_reference_write": False,
    }


def _promotion_receipt_preview(stable: dict[str, Any], item: dict[str, Any], review_path: Path, paths: dict[str, Path], duplicate: dict[str, Any]) -> dict[str, Any]:
    return {
        "receipt_id": stable.get("promotion_receipt_id"),
        "receipt_kind": "rmc_promotion_receipt_v1_preview",
        "created_at_utc": _utc_now(),
        "source_candidate_id": stable.get("source_candidate_id"),
        "source_observation_id": item.get("source_observation_id"),
        "source_review_path": str(review_path),
        "stable_memory_id": stable.get("stable_memory_id"),
        "promotion_namespace": stable.get("promotion_namespace"),
        "content_sha256": stable.get("content_sha256"),
        "duplicate_check": duplicate,
        "target_paths": {key: str(value) for key, value in paths.items()},
        "actual_files_written": [],
        "canonical_reference_write": False,
        "identity_vault_write": False,
    }


def _promotion_refused(failure_code: str, reason_codes: list[str], plan: dict[str, Any] | None = None, diagnostics: dict[str, Any] | None = None, root: Path | None = None) -> dict[str, Any]:
    return {
        "status": "REFUSED",
        "engine_version": ENGINE_VERSION,
        "engine_mode": "promotion_commit_C12",
        "stage": "Promotion Path Commit",
        "promotion_committed": False,
        "promotion_allowed": False,
        "failure_code": failure_code,
        "reason_codes": reason_codes,
        "plan_status": _as_dict(plan).get("status"),
        "diagnostics": diagnostics or {},
        "actual_files_written": [],
        "writes_files": False,
        "memory_write_allowed": False,
        "identity_vault_write": False,
        "canonical_reference_write": False,
        "boundary": promotion_boundary(root or DEFAULT_DATASET_ROOT),
    }


def _index_rows(stable: dict[str, Any], receipt: dict[str, Any], paths: dict[str, Path], committed_at: str) -> tuple[dict[str, Any], dict[str, Any]]:
    retrieval_row = {
        "indexed_at_utc": committed_at,
        "index_kind": "stable_memory_retrieval_index_v1",
        "stable_memory_id": stable.get("stable_memory_id"),
        "source_candidate_id": stable.get("source_candidate_id"),
        "source_observation_id": stable.get("source_observation_id"),
        "content_sha256": stable.get("content_sha256"),
        "phase_tags": stable.get("phase_tags", []),
        "retrieval_tags": stable.get("retrieval_tags", []),
        "retrieval_weight": stable.get("retrieval_weight"),
        "memory_role": stable.get("memory_role"),
        "truth_status": stable.get("truth_status"),
        "promotion_namespace": stable.get("promotion_namespace"),
        "stable_memory_path": str(paths["stable_memory"]),
        "promotion_receipt_id": receipt.get("receipt_id"),
        "promotion_receipt_path": str(paths["promotion_receipt"]),
    }
    stable_row = {
        "indexed_at_utc": committed_at,
        "index_kind": "stable_memory_file_index_v1",
        "stable_memory_id": stable.get("stable_memory_id"),
        "source_candidate_id": stable.get("source_candidate_id"),
        "promotion_namespace": stable.get("promotion_namespace"),
        "stable_memory_path": str(paths["stable_memory"]),
        "content_sha256": stable.get("content_sha256"),
    }
    return retrieval_row, stable_row


def promote_review_item(candidate_id: str, approval_token: str | None = None, root: str | Path | None = None) -> dict[str, Any]:
    r = _dataset_root(root)
    _assert_safe_root(r)
    plan = build_promotion_plan(candidate_id=candidate_id, root=r)
    if approval_token != APPROVAL_TOKEN:
        return _promotion_refused(
            "RMC_PROMOTION_REQUIRES_EXPLICIT_APPROVAL",
            ["approval_token_missing_or_invalid"],
            plan,
            {"expected_approval_token": APPROVAL_TOKEN, "approval_token_supplied": bool(approval_token)},
            r,
        )
    if plan.get("status") != "OK" or not plan.get("promotion_allowed"):
        reasons = ["promotion_plan_not_allowed"]
        if _as_dict(plan.get("duplicate_check")).get("duplicate"):
            reasons.append("duplicate_stable_memory_candidate")
        if plan.get("missing_required_fields"):
            reasons.append("missing_required_review_fields")
        return _promotion_refused(
            "RMC_PROMOTION_REFUSED_PLAN_NOT_ALLOWED",
            reasons,
            plan,
            {"plan_failure_code": plan.get("failure_code"), "missing_required_fields": plan.get("missing_required_fields")},
            r,
        )
    _ensure_dirs(r)
    stable = _as_dict(plan.get("stable_memory_preview"))
    if not stable or any(key not in stable for key in REQUIRED_STABLE_MEMORY_FIELDS):
        return _promotion_refused(
            "RMC_PROMOTION_REFUSED_INVALID_STABLE_MEMORY_PREVIEW",
            ["invalid_stable_memory_preview"],
            plan,
            {"missing_stable_fields": [key for key in REQUIRED_STABLE_MEMORY_FIELDS if key not in stable]},
            r,
        )
    paths = _target_paths(r, stable)
    unsafe = [str(p) for p in paths.values() if not _inside(r, p)]
    if unsafe:
        return _promotion_refused("RMC_PROMOTION_REFUSED_UNSAFE_TARGET_PATH", ["unsafe_target_path"], plan, {"unsafe_paths": unsafe}, r)
    duplicate = _index_duplicate(r, stable)
    if duplicate.get("duplicate"):
        return _promotion_refused("RMC_PROMOTION_REFUSED_DUPLICATE", [str(duplicate.get("reason") or "duplicate")], plan, {"duplicate": duplicate}, r)

    committed_at = _utc_now()
    promotion_id = _stable_id("rmcprom", {"stable_memory_id": stable.get("stable_memory_id"), "approval": approval_token, "root": str(r)})
    stable_committed = dict(stable)
    stable_committed.update({
        "promotion_status": "promoted_to_stable_memory",
        "promotion_id": promotion_id,
        "promoted_at_utc": committed_at,
        "promotion_engine_version": ENGINE_VERSION,
        "approved_by_token": APPROVAL_TOKEN,
    })
    receipt = _as_dict(plan.get("promotion_receipt_preview"))
    receipt.update({
        "receipt_kind": "rmc_promotion_receipt_v1",
        "promotion_id": promotion_id,
        "created_at_utc": committed_at,
        "stable_memory_id": stable_committed.get("stable_memory_id"),
        "promotion_status": "committed",
        "approval_token_hash": _sha(approval_token),
        "actual_files_written": [],
    })
    retrieval_row, stable_row = _index_rows(stable_committed, receipt, paths, committed_at)
    actual: list[str] = []
    try:
        _write_json_atomic(paths["stable_memory"], stable_committed)
        actual.append(str(paths["stable_memory"]))
        _write_json_atomic(paths["promotion_receipt"], receipt)
        actual.append(str(paths["promotion_receipt"]))
        _append_jsonl(paths["retrieval_index"], retrieval_row)
        actual.append(str(paths["retrieval_index"]))
        _append_jsonl(paths["stable_memory_index"], stable_row)
        actual.append(str(paths["stable_memory_index"]))
    except Exception as exc:
        return _promotion_refused(
            "RMC_PROMOTION_FAILED_DURING_WRITE",
            ["write_exception"],
            plan,
            {"exception_type": type(exc).__name__, "exception": str(exc), "actual_files_written_before_failure": actual},
            r,
        )
    receipt["actual_files_written"] = list(actual)
    # Update receipt after actual path list is known.
    _write_json_atomic(paths["promotion_receipt"], receipt)
    return {
        "status": "OK",
        "engine_version": ENGINE_VERSION,
        "engine_mode": "promotion_commit_C12",
        "stage": "Promotion Path Commit",
        "promotion_committed": True,
        "promotion_allowed": True,
        "promotion_id": promotion_id,
        "source_candidate_id": stable_committed.get("source_candidate_id"),
        "stable_memory_id": stable_committed.get("stable_memory_id"),
        "stable_memory": stable_committed,
        "promotion_receipt": receipt,
        "retrieval_index_row": retrieval_row,
        "stable_memory_index_row": stable_row,
        "source_review_queue_left_immutable": True,
        "actual_files_written": actual,
        "writes_files": True,
        "memory_write_allowed": True,
        "identity_vault_write": False,
        "canonical_reference_write": False,
        "queries_chroma": False,
        "calls_llm": False,
        "boundary": promotion_boundary(r),
    }
