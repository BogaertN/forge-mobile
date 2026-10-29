"""
forge/rmc_engine_v1/mea/discovery_kernel.py

Patch 299 — MEA / Forge Discovery Kernel Manifest Memory Writer Dry-Run Identity.

This module exposes the Forge Discovery Kernel with deterministic replay support.
Patch 294 owns approved initial-seed persistence, Patch 295 exposes read-only
candidates generated from verified stored state, Patch 296R binds the repaired
transaction preflight trace, Patch 297 performed the first controlled atomic
candidate-driven manifest transition, Patch 297R separates invocation effects
from stored-state facts, and Patch 298 verifies that committed transition by
reconstructing it from the rollback-embedded source state. Patch 299 builds a
non-mutating manifest-memory record preview from that verified committed trace. The canonical
/api/mea/seal route remains unavailable, and no memory, Chroma, Identity Vault,
LLM, shell, network, renderer, launcher, or UI action is enabled.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict

from .manifest_schema import (
    MEA_PATCH_ID,
    MEA_SCHEMA_VERSION,
    ProblemManifest,
    build_144hz_test_manifest,
    canonical_hash,
    foundation_boundary,
    validate_manifest,
)
from .unknown_detector import detect_unknowns
from .proof_debt_scorer import score_proof_debt
from .information_gain_scorer import score_information_gain
from .convergence_scorer import score_convergence
from .goal_ancestry_scorer import score_goal_ancestry
from .operator_cost_scorer import score_operator_cost
from .operator_registry import operator_registry_summary
from .replay_engine import replay_candidate, replay_engine_boundary
from .claim_status_classifier import classify_claim_status, claim_status_taxonomy, classifier_boundary
from .seed_manifest_gate import (
    SEED_GATE_POST_ROUTE,
    SEED_GATE_STATUS_ROUTE,
    SEED_GATE_ALIAS_ROUTE,
    SEED_GATE_APPROVAL_TOKEN,
    seed_manifest_gate_boundary,
    build_seed_manifest_gate_preview,
)
from .candidate_set_gate import (
    CANDIDATE_SET_GATE_POST_ROUTE,
    CANDIDATE_SET_GATE_STATUS_ROUTE,
    CANDIDATE_SET_GATE_ALIAS_ROUTE,
    CANDIDATE_SET_PREVIEW_ROUTE,
    CANDIDATE_SET_GATE_APPROVAL_TOKEN,
    candidate_set_gate_boundary,
    build_candidate_set_gate_preview,
)
from .hard_gate_report import (
    HARD_GATE_REPORT_STATUS_ROUTE,
    HARD_GATE_REPORT_PREVIEW_ROUTE,
    HARD_GATE_REPORT_POST_ROUTE,
    HARD_GATE_REPORT_ALIAS_ROUTE,
    HARD_GATE_REPORT_APPROVAL_TOKEN,
    hard_gate_report_boundary,
    build_hard_gate_report_preview,
)

from .seal_readiness import (
    SEAL_READINESS_APPROVAL_TOKEN,
    SEAL_READINESS_ALIAS_ROUTE,
    SEAL_READINESS_POST_ROUTE,
    SEAL_READINESS_PREVIEW_ROUTE,
    SEAL_READINESS_STATUS_ROUTE,
    build_seal_readiness_preview,
    seal_readiness_boundary,
)

from .seal_packet_preview import (
    SEAL_PACKET_APPROVAL_TOKEN,
    SEAL_PACKET_ALIAS_ROUTE,
    SEAL_PACKET_POST_ROUTE,
    SEAL_PACKET_PREVIEW_ROUTE,
    SEAL_PACKET_STATUS_ROUTE,
    build_seal_packet_preview,
    seal_packet_boundary,
)

from .seal_packet_audit_chain import (
    SEAL_AUDIT_CHAIN_APPROVAL_TOKEN,
    SEAL_AUDIT_CHAIN_POST_ROUTE,
    SEAL_AUDIT_CHAIN_PREVIEW_ROUTE,
    SEAL_AUDIT_CHAIN_STATUS_ROUTE,
    build_seal_audit_chain_preview,
    seal_audit_chain_boundary,
)

from .operator_engine import (
    OPERATOR_ENGINE_APPROVAL_TOKEN,
    OPERATOR_ENGINE_POST_ROUTE,
    OPERATOR_ENGINE_PREVIEW_ROUTE,
    OPERATOR_ENGINE_STATUS_ROUTE,
    build_operator_engine_preview,
    operator_engine_boundary,
)

from .candidate_generator import (
    CANDIDATE_GENERATOR_APPROVAL_TOKEN,
    CANDIDATE_GENERATOR_POST_ROUTE,
    CANDIDATE_GENERATOR_PREVIEW_ROUTE,
    CANDIDATE_GENERATOR_STATUS_ROUTE,
    build_candidate_generator_preview,
    candidate_generator_boundary,
)

from .coherence_extension import (
    COHERENCE_EXTENSION_APPROVAL_TOKEN,
    COHERENCE_EXTENSION_POST_ROUTE,
    COHERENCE_EXTENSION_PREVIEW_ROUTE,
    COHERENCE_EXTENSION_STATUS_ROUTE,
    build_coherence_extension_preview,
    coherence_extension_boundary,
)

from .gate_engine import (
    GATE_ENGINE_APPROVAL_TOKEN,
    GATE_ENGINE_POST_ROUTE,
    GATE_ENGINE_PREVIEW_ROUTE,
    GATE_ENGINE_STATUS_ROUTE,
    build_gate_engine_preview,
    gate_engine_boundary,
)

from .seal_engine import (
    SEAL_ENGINE_DRY_RUN_ROUTE,
    SEAL_ENGINE_FORMULA,
    SEAL_ENGINE_PATCH_ID,
    SEAL_ENGINE_SCHEMA_VERSION,
    SEAL_ENGINE_STATUS_ROUTE,
    build_seal_engine_dry_run,
    seal_engine_boundary,
    seal_engine_status,
)

from .seal_candidate_gate import (
    SEAL_CANDIDATE_GATE_APPROVAL_TOKEN,
    SEAL_CANDIDATE_GATE_FORMULA,
    SEAL_CANDIDATE_GATE_PATCH_ID,
    SEAL_CANDIDATE_GATE_POST_ROUTE,
    SEAL_CANDIDATE_GATE_SCHEMA_VERSION,
    build_seal_candidate_gate_preview,
    seal_candidate_gate_boundary,
)

from .manifest_advance_preview import (
    MANIFEST_ADVANCE_PREVIEW_FORMULA,
    MANIFEST_ADVANCE_PREVIEW_PATCH_ID,
    MANIFEST_ADVANCE_PREVIEW_ROUTE,
    MANIFEST_ADVANCE_PREVIEW_SCHEMA_VERSION,
    build_manifest_advance_preview,
    manifest_advance_preview_boundary,
)

from .problem_manifest_store import (
    PROBLEM_MANIFEST_STORE_APPROVAL_TOKEN,
    PROBLEM_MANIFEST_STORE_FORMULA,
    PROBLEM_MANIFEST_STORE_PATCH_ID,
    PROBLEM_MANIFEST_GET_ROUTE,
    PROBLEM_MANIFEST_POST_ROUTE,
    PROBLEM_MANIFEST_STORE_SCHEMA_VERSION,
    problem_manifest_store_boundary,
    problem_manifest_store_status,
)

from .live_candidates import (
    LIVE_CANDIDATES_FORMULA,
    LIVE_CANDIDATES_GET_ROUTE,
    LIVE_CANDIDATES_PATCH_ID,
    LIVE_CANDIDATES_SCHEMA_VERSION,
    build_live_candidates_payload,
    live_candidates_boundary,
)


from .seal_transaction_preflight import (
    TRANSACTION_PREFLIGHT_APPROVAL_TOKEN,
    TRANSACTION_PREFLIGHT_FORMULA,
    TRANSACTION_PREFLIGHT_PATCH_ID,
    TRANSACTION_PREFLIGHT_POST_ROUTE,
    TRANSACTION_PREFLIGHT_SCHEMA_VERSION,
    build_seal_transaction_preflight_preview,
    transaction_preflight_boundary,
)

from .seal_transaction_commit import (
    TRANSACTION_COMMIT_APPROVAL_TOKEN,
    TRANSACTION_COMMIT_FORMULA,
    TRANSACTION_COMMIT_PATCH_ID,
    TRANSACTION_COMMIT_POST_ROUTE,
    TRANSACTION_COMMIT_SCHEMA_VERSION,
    transaction_commit_boundary,
)

from .live_trace_replay import (
    LIVE_TRACE_REPLAY_APPROVAL_TOKEN,
    LIVE_TRACE_REPLAY_FORMULA,
    LIVE_TRACE_REPLAY_PATCH_ID,
    LIVE_TRACE_REPLAY_POST_ROUTE,
    LIVE_TRACE_REPLAY_SCHEMA_VERSION,
    live_trace_replay_boundary,
)

from .manifest_memory_writer import (
    MANIFEST_MEMORY_WRITER_APPROVAL_TOKEN,
    MANIFEST_MEMORY_WRITER_DRY_RUN_ROUTE,
    MANIFEST_MEMORY_WRITER_FORMULA,
    MANIFEST_MEMORY_WRITER_PATCH_ID,
    MANIFEST_MEMORY_WRITER_SCHEMA_VERSION,
    MANIFEST_MEMORY_WRITER_STATUS_ROUTE,
    manifest_memory_writer_boundary,
    manifest_memory_writer_status,
)


KERNEL_NAME = "Forge Discovery Kernel"
KERNEL_STAGE = "manifest_memory_writer_dry_run_patch299"
KERNEL_PATCH_ID = "Patch 299 — MEA Manifest Memory Writer Dry-Run"
KERNEL_PACKAGE_PATH = "forge/rmc_engine_v1/mea/"
KERNEL_MODULE_PATH = "forge/rmc_engine_v1/mea/discovery_kernel.py"


@dataclass(frozen=True)
class KernelBoundary:
    """Immutable boundary declaration for the Patch 280 kernel surface."""

    read_only: bool = False
    writes_files: bool = True
    writes_memory: bool = False
    writes_chroma: bool = False
    writes_identity_vault: bool = False
    executes_shell: bool = False
    calls_llm: bool = False
    creates_post_routes: bool = True
    seeds_live_manifests: bool = True
    commits_live_candidates: bool = True
    advances_live_manifest: bool = True
    seals_candidates: bool = True
    executes_seal: bool = True
    promotes_to_memory: bool = False
    mutates_rmc_behavior: bool = False
    mutates_launcher_behavior: bool = False
    mutates_operator_console_ui: bool = False
    renderer_integration: bool = False

    def to_dict(self) -> Dict[str, bool]:
        return {
            "read_only": self.read_only,
            "writes_files": self.writes_files,
            "writes_memory": self.writes_memory,
            "writes_chroma": self.writes_chroma,
            "writes_identity_vault": self.writes_identity_vault,
            "executes_shell": self.executes_shell,
            "calls_llm": self.calls_llm,
            "creates_post_routes": self.creates_post_routes,
            "seeds_live_manifests": self.seeds_live_manifests,
            "commits_live_candidates": self.commits_live_candidates,
            "advances_live_manifest": self.advances_live_manifest,
            "seals_candidates": self.seals_candidates,
            "executes_seal": self.executes_seal,
            "promotes_to_memory": self.promotes_to_memory,
            "mutates_rmc_behavior": self.mutates_rmc_behavior,
            "mutates_launcher_behavior": self.mutates_launcher_behavior,
            "mutates_operator_console_ui": self.mutates_operator_console_ui,
            "renderer_integration": self.renderer_integration,
        }


@dataclass(frozen=True)
class ForgeDiscoveryKernelFoundation:
    """Read-only foundation facade for MEA replay-kernel readiness checks."""

    kernel_name: str = KERNEL_NAME
    kernel_stage: str = KERNEL_STAGE
    patch_id: str = KERNEL_PATCH_ID
    package_path: str = KERNEL_PACKAGE_PATH
    module_path: str = KERNEL_MODULE_PATH
    schema_version: str = MEA_SCHEMA_VERSION
    source_packet_lineage: str = "Claude MEA Foundation Patch A rebased and production-packaged against Patch 274R current-state packet"

    def boundary(self) -> Dict[str, bool]:
        base = foundation_boundary()
        declared = KernelBoundary().to_dict()
        replay_boundary = replay_engine_boundary()
        classifier = classifier_boundary()
        seed_gate = seed_manifest_gate_boundary()
        hard_gate = hard_gate_report_boundary()
        seal_ready = seal_readiness_boundary()
        seal_packet = seal_packet_boundary()
        seal_audit = seal_audit_chain_boundary()
        operator_engine = operator_engine_boundary()
        candidate_generator = candidate_generator_boundary()
        coherence_extension = coherence_extension_boundary()
        gate_engine = gate_engine_boundary()
        seal_engine = seal_engine_boundary()
        seal_candidate_gate = seal_candidate_gate_boundary()
        manifest_advance_preview = manifest_advance_preview_boundary()
        problem_manifest_store = problem_manifest_store_boundary()
        live_candidates = live_candidates_boundary()
        transaction_preflight = transaction_preflight_boundary()
        transaction_commit = transaction_commit_boundary()
        live_trace_replay = live_trace_replay_boundary()
        manifest_memory_writer = manifest_memory_writer_boundary()
        merged = dict(base)
        merged.update({k: v for k, v in replay_boundary.items() if isinstance(v, bool)})
        merged.update({k: v for k, v in classifier.items() if isinstance(v, bool)})
        merged.update({k: v for k, v in seed_gate.items() if isinstance(v, bool)})
        merged.update({k: v for k, v in hard_gate.items() if isinstance(v, bool)})
        merged.update({k: v for k, v in seal_ready.items() if isinstance(v, bool)})
        merged.update({k: v for k, v in seal_packet.items() if isinstance(v, bool)})
        merged.update({k: v for k, v in seal_audit.items() if isinstance(v, bool)})
        merged.update({k: v for k, v in operator_engine.items() if isinstance(v, bool)})
        merged.update({k: v for k, v in candidate_generator.items() if isinstance(v, bool)})
        merged.update({k: v for k, v in coherence_extension.items() if isinstance(v, bool)})
        merged.update({k: v for k, v in gate_engine.items() if isinstance(v, bool)})
        merged.update({k: v for k, v in seal_engine.items() if isinstance(v, bool)})
        merged.update({k: v for k, v in seal_candidate_gate.items() if isinstance(v, bool)})
        merged.update({k: v for k, v in manifest_advance_preview.items() if isinstance(v, bool)})
        merged.update({k: v for k, v in problem_manifest_store.items() if isinstance(v, bool)})
        merged.update({k: v for k, v in live_candidates.items() if isinstance(v, bool)})
        merged.update({k: v for k, v in transaction_preflight.items() if isinstance(v, bool)})
        merged.update({k: v for k, v in transaction_commit.items() if isinstance(v, bool)})
        merged.update({k: v for k, v in live_trace_replay.items() if isinstance(v, bool)})
        merged.update({k: v for k, v in manifest_memory_writer.items() if isinstance(v, bool)})
        merged.update(declared)
        return merged

    def identity(self) -> Dict[str, Any]:
        return {
            "kernel_name": self.kernel_name,
            "kernel_stage": self.kernel_stage,
            "patch_id": self.patch_id,
            "package_path": self.package_path,
            "module_path": self.module_path,
            "schema_version": self.schema_version,
            "mea_patch_id": MEA_PATCH_ID,
            "source_packet_lineage": self.source_packet_lineage,
            "full_runtime_active": False,
            "foundation_visible": True,
            "scoring_foundation_visible": True,
            "scoring_runtime_active": False,
            "convergence_scoring_visible": True,
            "goal_ancestry_scoring_visible": True,
            "operator_cost_scoring_visible": True,
            "operator_registry_visible": True,
            "replay_engine_visible": True,
            "replay_preview_active": True,
            "claim_status_classifier_visible": True,
            "claim_status_classification_active": True,
            "read_only_api_visible": True,
            "operator_console_visibility": "backend_route_manifest_and_read_only_json_payloads_only",
            "api_preview_routes": [
                "/api/mea/problem-manifest-preview",
                "/api/mea/unknown-vector-preview",
                "/api/mea/claim-status-preview",
                "/api/mea/replay-preview",
            ],
            "controlled_seed_gate_visible": True,
            "controlled_seed_gate_active": True,
            "seed_gate_post_route": SEED_GATE_POST_ROUTE,
            "seed_gate_status_route": SEED_GATE_STATUS_ROUTE,
            "seed_gate_alias_route": SEED_GATE_ALIAS_ROUTE,
            "seed_gate_approval_token": SEED_GATE_APPROVAL_TOKEN,
            "live_manifest_seeding_active": True,
            "problem_manifest_store_visible": True,
            "problem_manifest_store_active": True,
            "problem_manifest_get_route": PROBLEM_MANIFEST_GET_ROUTE,
            "problem_manifest_post_route": PROBLEM_MANIFEST_POST_ROUTE,
            "problem_manifest_store_approval_token": PROBLEM_MANIFEST_STORE_APPROVAL_TOKEN,
            "problem_manifest_store_formula": PROBLEM_MANIFEST_STORE_FORMULA,
            "problem_manifest_store_patch_id": PROBLEM_MANIFEST_STORE_PATCH_ID,
            "problem_manifest_store_schema_version": PROBLEM_MANIFEST_STORE_SCHEMA_VERSION,
            "initial_seed_persistence_only": False,
            "candidate_driven_manifest_advance_active": True,
            "live_candidates_visible": True,
            "live_candidates_active": True,
            "live_candidates_get_route": LIVE_CANDIDATES_GET_ROUTE,
            "live_candidates_formula": LIVE_CANDIDATES_FORMULA,
            "live_candidates_patch_id": LIVE_CANDIDATES_PATCH_ID,
            "live_candidates_schema_version": LIVE_CANDIDATES_SCHEMA_VERSION,
            "transaction_preflight_visible": True,
            "transaction_preflight_active": True,
            "transaction_preflight_post_route": TRANSACTION_PREFLIGHT_POST_ROUTE,
            "transaction_preflight_approval_token": TRANSACTION_PREFLIGHT_APPROVAL_TOKEN,
            "transaction_preflight_formula": TRANSACTION_PREFLIGHT_FORMULA,
            "transaction_preflight_patch_id": TRANSACTION_PREFLIGHT_PATCH_ID,
            "transaction_preflight_schema_version": TRANSACTION_PREFLIGHT_SCHEMA_VERSION,
            "transaction_preflight_reads_persisted_state": True,
            "transaction_preflight_mutation_active": False,
            "transaction_commit_visible": True,
            "transaction_commit_active": True,
            "transaction_commit_post_route": TRANSACTION_COMMIT_POST_ROUTE,
            "transaction_commit_approval_token": TRANSACTION_COMMIT_APPROVAL_TOKEN,
            "transaction_commit_formula": TRANSACTION_COMMIT_FORMULA,
            "transaction_commit_patch_id": TRANSACTION_COMMIT_PATCH_ID,
            "transaction_commit_schema_version": TRANSACTION_COMMIT_SCHEMA_VERSION,
            "transaction_commit_writes_mea_runtime_state": True,
            "transaction_commit_memory_promotion_active": False,
            "live_trace_replay_visible": True,
            "live_trace_replay_active": True,
            "live_trace_replay_post_route": LIVE_TRACE_REPLAY_POST_ROUTE,
            "live_trace_replay_approval_token": LIVE_TRACE_REPLAY_APPROVAL_TOKEN,
            "live_trace_replay_formula": LIVE_TRACE_REPLAY_FORMULA,
            "live_trace_replay_patch_id": LIVE_TRACE_REPLAY_PATCH_ID,
            "live_trace_replay_schema_version": LIVE_TRACE_REPLAY_SCHEMA_VERSION,
            "live_trace_replay_non_mutating": True,
            "canonical_seal_route_available": False,
            "downstream_candidate_generation_reads_persisted_state": True,
            "candidate_set_gate_visible": True,
            "candidate_set_gate_active": True,
            "candidate_set_preview_route": CANDIDATE_SET_PREVIEW_ROUTE,
            "candidate_set_gate_post_route": CANDIDATE_SET_GATE_POST_ROUTE,
            "candidate_set_gate_status_route": CANDIDATE_SET_GATE_STATUS_ROUTE,
            "candidate_set_gate_alias_route": CANDIDATE_SET_GATE_ALIAS_ROUTE,
            "candidate_set_gate_approval_token": CANDIDATE_SET_GATE_APPROVAL_TOKEN,
            "hard_gate_report_visible": True,
            "hard_gate_report_active": True,
            "hard_gate_report_status_route": HARD_GATE_REPORT_STATUS_ROUTE,
            "hard_gate_report_preview_route": HARD_GATE_REPORT_PREVIEW_ROUTE,
            "hard_gate_report_post_route": HARD_GATE_REPORT_POST_ROUTE,
            "hard_gate_report_alias_route": HARD_GATE_REPORT_ALIAS_ROUTE,
            "hard_gate_report_approval_token": HARD_GATE_REPORT_APPROVAL_TOKEN,
            "live_candidate_commit_active": True,
            "sealing_active": True,
            "memory_promotion_active": False,
            "activity_semantics": "active means approval-gated capability is installed; stored transition facts are reported by /api/mea/problem-manifest",
            "seal_readiness_visible": True,
            "seal_readiness_active": True,
            "seal_readiness_status_route": SEAL_READINESS_STATUS_ROUTE,
            "seal_readiness_preview_route": SEAL_READINESS_PREVIEW_ROUTE,
            "seal_readiness_post_route": SEAL_READINESS_POST_ROUTE,
            "seal_readiness_alias_route": SEAL_READINESS_ALIAS_ROUTE,
            "seal_readiness_approval_token": SEAL_READINESS_APPROVAL_TOKEN,
            "seal_packet_preview_visible": True,
            "seal_packet_preview_active": True,
            "seal_packet_status_route": SEAL_PACKET_STATUS_ROUTE,
            "seal_packet_preview_route": SEAL_PACKET_PREVIEW_ROUTE,
            "seal_packet_post_route": SEAL_PACKET_POST_ROUTE,
            "seal_packet_alias_route": SEAL_PACKET_ALIAS_ROUTE,
            "seal_packet_approval_token": SEAL_PACKET_APPROVAL_TOKEN,
            "seal_audit_chain_visible": True,
            "seal_audit_chain_active": True,
            "seal_audit_chain_status_route": SEAL_AUDIT_CHAIN_STATUS_ROUTE,
            "seal_audit_chain_preview_route": SEAL_AUDIT_CHAIN_PREVIEW_ROUTE,
            "seal_audit_chain_post_route": SEAL_AUDIT_CHAIN_POST_ROUTE,
            "seal_audit_chain_approval_token": SEAL_AUDIT_CHAIN_APPROVAL_TOKEN,
            
            "operator_engine_visible": True,
            "operator_engine_active": True,
            "operator_engine_status_route": OPERATOR_ENGINE_STATUS_ROUTE,
            "operator_engine_preview_route": OPERATOR_ENGINE_PREVIEW_ROUTE,
            "operator_engine_post_route": OPERATOR_ENGINE_POST_ROUTE,
            "operator_engine_approval_token": OPERATOR_ENGINE_APPROVAL_TOKEN,
            "live_operator_execution_active": False,
            "draft_sealing_active": False,
            "draft_rendering_active": False,
            "candidate_generator_visible": True,
            "candidate_generator_active": True,
            "candidate_generator_status_route": CANDIDATE_GENERATOR_STATUS_ROUTE,
            "candidate_generator_preview_route": CANDIDATE_GENERATOR_PREVIEW_ROUTE,
            "candidate_generator_post_route": CANDIDATE_GENERATOR_POST_ROUTE,
            "candidate_generator_approval_token": CANDIDATE_GENERATOR_APPROVAL_TOKEN,
            "generated_candidate_commit_active": False,
            "coherence_extension_visible": True,
            "coherence_extension_active": True,
            "coherence_extension_status_route": COHERENCE_EXTENSION_STATUS_ROUTE,
            "coherence_extension_preview_route": COHERENCE_EXTENSION_PREVIEW_ROUTE,
            "coherence_extension_post_route": COHERENCE_EXTENSION_POST_ROUTE,
            "coherence_extension_approval_token": COHERENCE_EXTENSION_APPROVAL_TOKEN,
            "gate_engine_visible": True,
            "gate_engine_active": True,
            "gate_engine_status_route": GATE_ENGINE_STATUS_ROUTE,
            "gate_engine_preview_route": GATE_ENGINE_PREVIEW_ROUTE,
            "gate_engine_post_route": GATE_ENGINE_POST_ROUTE,
            "gate_engine_approval_token": GATE_ENGINE_APPROVAL_TOKEN,
            "seal_engine_visible": True,
            "seal_engine_active": True,
            "seal_engine_status_route": SEAL_ENGINE_STATUS_ROUTE,
            "seal_engine_dry_run_route": SEAL_ENGINE_DRY_RUN_ROUTE,
            "seal_engine_formula": SEAL_ENGINE_FORMULA,
            "seal_engine_patch_id": SEAL_ENGINE_PATCH_ID,
            "seal_engine_schema_version": SEAL_ENGINE_SCHEMA_VERSION,
            "seal_execution_permitted": False,
            "seal_route_available": False,
            "seal_candidate_gate_visible": True,
            "seal_candidate_gate_active": True,
            "seal_candidate_gate_post_route": SEAL_CANDIDATE_GATE_POST_ROUTE,
            "seal_candidate_gate_approval_token": SEAL_CANDIDATE_GATE_APPROVAL_TOKEN,
            "seal_candidate_gate_formula": SEAL_CANDIDATE_GATE_FORMULA,
            "seal_candidate_gate_patch_id": SEAL_CANDIDATE_GATE_PATCH_ID,
            "seal_candidate_gate_schema_version": SEAL_CANDIDATE_GATE_SCHEMA_VERSION,
            "sealed_candidate_object_response_only": True,
            "manifest_advance_preview_visible": True,
            "manifest_advance_preview_route": MANIFEST_ADVANCE_PREVIEW_ROUTE,
            "manifest_advance_preview_formula": MANIFEST_ADVANCE_PREVIEW_FORMULA,
            "manifest_advance_preview_patch_id": MANIFEST_ADVANCE_PREVIEW_PATCH_ID,
            "manifest_advance_preview_schema_version": MANIFEST_ADVANCE_PREVIEW_SCHEMA_VERSION,
            "live_manifest_advance_active": True,
            "manifest_persistence_active": True,
            "manifest_persistence_scope": "approved_initial_seed_and_controlled_single_hypothesis_advance_no_memory_promotion",
            "manifest_memory_writer_visible": True,
            "manifest_memory_writer_active": True,
            "manifest_memory_writer_status_route": MANIFEST_MEMORY_WRITER_STATUS_ROUTE,
            "manifest_memory_writer_dry_run_route": MANIFEST_MEMORY_WRITER_DRY_RUN_ROUTE,
            "manifest_memory_writer_approval_token": MANIFEST_MEMORY_WRITER_APPROVAL_TOKEN,
            "manifest_memory_writer_formula": MANIFEST_MEMORY_WRITER_FORMULA,
            "manifest_memory_writer_dry_run_only": True,
            "manifest_memory_writer_writes_memory": False,
            "manifest_memory_writer_writes_chroma": False,
            "manifest_memory_writer_promotes_to_memory": False,
            "score_can_rank": True,
            "score_can_override_gates": False,
            "score_can_promote_claim_status": False,
            "seal_route_available": False,
            "next_runtime_layers": [
                "Patch 276 proof_debt_scorer.py + information_gain_scorer.py — installed read-only",
                "Patch 277 convergence_scorer.py + goal_ancestry_scorer.py + operator_cost_scorer.py — installed read-only",
                "Patch 278 operator_registry.py + replay_engine.py — installed read-only",
                "Patch 279 claim_status_classifier.py — installed read-only",
                "Patch 280 read-only MEA API / Operator Console visibility — installed read-only",
                "Patch 281 controlled seed manifest gate — installed non-mutating approval-token POST",
                "Patch 282 candidate set preview/gate — installed non-mutating approval-token POST",
                "Patch 283R hard gate report — installed non-mutating approval-token POST",
                "Patch 284R seal readiness preview — installed non-mutating approval-token POST",
                "Patch 285 seal packet preview — installed non-mutating approval-token POST",
                "Patch 286 seal packet audit chain — installed non-mutating approval-token POST",
                "Patch 287 operator engine preview — installed non-mutating approval-token POST",
                "Patch 288 candidate generator runtime preview — installed non-mutating approval-token POST",
                "Patch 289 coherence scorer extension preview — installed non-mutating approval-token POST",
                "Patch 290 reusable gate engine preview — installed non-mutating approval-token POST",
                "Patch 291 seal engine dry-run — installed non-mutating GET dry-run",
                "Patch 292 controlled seal-candidate gate — installed non-mutating approval-token POST",
                "Patch 293 live manifest advance preview — installed non-mutating GET preview",
                "Patch 294 controlled problem manifest store — installed approved initial seed persistence only",
                "Patch 295 controlled live candidate API — installed read-only generation from verified persisted manifest",
                "Patch 296 persisted-state seal/advance transaction preflight — installed non-mutating approval-token POST binding",
                "Patch 296R transaction trace source-binding hotfix — repaired null proposed-trace source hashes before mutation",
                "Patch 297 controlled atomic seal/manifest advance commit — first explicit hypothesis state transition; no memory promotion",
                "Patch 297R response semantics hotfix — separates duplicate-invocation no-op facts from already stored committed-state facts",
                "Patch 298 live trace replay verification — verifies committed advance from rollback-embedded source state with no new mutation",
                "Patch 299 manifest memory writer dry-run — previews replay-verified hypothesis memory record with no write or promotion",
            ],
            "boundary": self.boundary(),
        }

    def inspect_manifest(self, manifest: ProblemManifest) -> Dict[str, Any]:
        """Return deterministic validation + scoring + replay status for one manifest."""
        validation = validate_manifest(manifest)
        vector = detect_unknowns(manifest)
        proof_score = score_proof_debt(manifest)
        info_score = score_information_gain(manifest, manifest)
        convergence_score = score_convergence(manifest, manifest)
        ancestry_score = score_goal_ancestry(manifest, manifest)
        operator_cost_score = score_operator_cost(manifest)
        replay_score = replay_candidate(manifest, "noop_recall", {}, expected_candidate_hash=canonical_hash(manifest))
        classification = classify_claim_status(
            manifest,
            manifest,
            replay_result=replay_score,
            proof_debt_score=proof_score,
            information_gain_score=info_score,
            convergence_score=convergence_score,
        )
        return {
            "kernel_name": self.kernel_name,
            "kernel_stage": self.kernel_stage,
            "problem_id": manifest.problem_id,
            "manifest_hash": canonical_hash(manifest),
            "validation": {"valid": validation.valid, "errors": list(validation.errors), "warnings": list(validation.warnings)},
            "unknown_vector": vector.to_dict(),
            "claim_status": manifest.claim_status,
            "proof_debt": manifest.proof_debt,
            "proof_debt_score": proof_score.to_dict(),
            "information_gain_self_score": info_score.to_dict(),
            "convergence_self_score": convergence_score.to_dict(),
            "goal_ancestry_self_score": ancestry_score.to_dict(),
            "operator_cost_self_score": operator_cost_score.to_dict(),
            "replay_self_score": replay_score.to_dict(),
            "claim_status_classification": classification.to_dict(),
            "output_permissions": manifest.output_permissions,
            "boundary": self.boundary(),
        }

    def inspect_144hz_fixture(self) -> Dict[str, Any]:
        manifest = build_144hz_test_manifest()
        report = self.inspect_manifest(manifest)
        report["expected_future_classification"] = "hypothesis_not_verified_claim"
        report["anti_confabulation_purpose"] = (
            "The 144 Hz seed must remain test_required/hypothesis-bound until later MEA scoring "
            "and claim classification can prove otherwise. It must not render as verified_claim."
        )
        return report

    def replay_registry_report(self) -> Dict[str, Any]:
        return {
            "operator_registry": operator_registry_summary(),
            "replay_boundary": replay_engine_boundary(),
            "claim_status_taxonomy": claim_status_taxonomy(),
            "seed_manifest_gate_preview": build_seed_manifest_gate_preview(),
            "candidate_set_gate_preview": build_candidate_set_gate_preview(),
            "hard_gate_report_preview": build_hard_gate_report_preview(),
            "seal_readiness_preview": build_seal_readiness_preview(),
            "seal_packet_preview": build_seal_packet_preview(),
            "seal_audit_chain_preview": build_seal_audit_chain_preview(),
            "operator_engine_preview": build_operator_engine_preview(),
            "candidate_generator_preview": build_candidate_generator_preview(),
            "coherence_extension_preview": build_coherence_extension_preview(),
            "gate_engine_preview": build_gate_engine_preview(),
            "seal_engine_status": seal_engine_status(),
            "seal_engine_dry_run": build_seal_engine_dry_run(),
            "seal_candidate_gate_preview": build_seal_candidate_gate_preview(),
            "manifest_advance_preview": build_manifest_advance_preview(),
            "problem_manifest_store_status": problem_manifest_store_status(),
            "live_candidates": build_live_candidates_payload(),
            "transaction_preflight": build_seal_transaction_preflight_preview(),
            "live_trace_replay_boundary": live_trace_replay_boundary(),
            "manifest_memory_writer_status": manifest_memory_writer_status(),
            "manifest_memory_writer_boundary": manifest_memory_writer_boundary(),
        }


def build_foundation_kernel() -> ForgeDiscoveryKernelFoundation:
    """Factory used by status routes and tests. No side effects."""
    return ForgeDiscoveryKernelFoundation()


def kernel_identity() -> Dict[str, Any]:
    """Return a read-only identity payload for the foundation kernel."""
    return build_foundation_kernel().identity()


def kernel_foundation_probe() -> Dict[str, Any]:
    """Return identity plus the 144 Hz seed probe. No side effects."""
    kernel = build_foundation_kernel()
    return {
        "identity": kernel.identity(),
        "test_fixture": kernel.inspect_144hz_fixture(),
        "replay_foundation": kernel.replay_registry_report(),
    }
