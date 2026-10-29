"""General Pipeline dependency and runtime-tool authority registry.

GP-006 created the non-executable dependency governance surface. GP-010B-R1
uses the audited GP-010A wheelhouse to activate bounded external organs in the
existing governed socket:

* Lark 1.3.1 parses the already-supported linear-equation grammar only.
* SymPy 1.14.0 solves only the validated typed AST produced by that grammar.
* Hypothesis 6.155.1 drives adversarial verification tests only; it is not a
  user-answering runtime service.
* Pint 0.25.3 validates and computes the already-supported fraction-change
  capacity quantity path using mass/volume dimensional authority only.
* MATH-001R1 / GP-012R1 exposes already-audited SymPy 1.14.0 through a
  manifest-first computation-only symbolic mathematics socket. Verified results
  remain pending the existing Manifest Contract v2 and Echo delivery spine.

mpmath, sortedcontainers, flexcache, flexparser, platformdirs and the protected
pre-existing exact typing_extensions match are governed runtime supports. No
source text may grant dependency authority; authority is fixed here and
verified through service binding rules.
"""
from __future__ import annotations
from dataclasses import dataclass
from typing import Any, Dict, Iterable, List, Optional, Tuple
from .contracts import canonical_hash

GP006_BUILD_ID = "GENERAL-PIPELINE-DEPENDENCY-LICENSE-REGISTRY-BUILD-GP-006"
GP006_SCHEMA_VERSION = "general_pipeline_dependency_license_registry_v1_build_gp006"
GP010B_BUILD_ID = "GENERAL-PIPELINE-AUDITED-TOOL-ACTIVATION-INTEGRATION-BUILD-GP-010B-R1"
GP010B_SCHEMA_VERSION = "general_pipeline_audited_tool_activation_integration_v1_build_gp010b_r1"
EVIDENCE_CAPTURED_UTC = "2026-05-31"
# Superseded source-boundary audit markers: BOUND_TO_INSTALLED_GP007_SOURCE_HASHES; BOUND_TO_INSTALLED_GP008_SOURCE_HASHES.
ACTIVE_INTERNAL = "ACTIVE_INTERNAL_RUNTIME"
ACTIVE_ENVIRONMENT = "ACTIVE_PREEXISTING_ENVIRONMENT"
ACTIVE_EXTERNAL_SERVICE = "ACTIVE_AUDITED_EXTERNAL_SERVICE"
ACTIVE_TEST_TOOL = "ACTIVE_AUDITED_TEST_TOOL"
INSTALLED_TRANSITIVE = "INSTALLED_AUDITED_TRANSITIVE_SUPPORT"
CANDIDATE_REVIEW = "CANDIDATE_REVIEW_ONLY"
HOLD_LICENSE = "HOLD_LICENSE_BOUNDARY"

class DependencyRegistrationError(ValueError):
    pass
class DependencyBoundaryError(ValueError):
    pass

@dataclass(frozen=True)
class DependencyLicenseRecord:
    dependency_id: str
    component_name: str
    dependency_class: str
    intended_role: str
    license_observation: str
    upstream_evidence_reference: str
    review_status: str
    version_status: str
    evidence_captured_utc: str = EVIDENCE_CAPTURED_UTC
    artifact_sha256: str = ""
    runtime_use_allowed: bool = False
    installation_allowed: bool = False
    service_binding_allowed: bool = False
    installed_by_this_build: bool = False
    imported_by_this_build: bool = False
    redistribution_notice_required: bool = False
    commercial_use_review_required: bool = False
    transitive_license_review_required: bool = False
    linked_capability_scope: Tuple[str, ...] = ()
    governance_notes: Tuple[str, ...] = ()
    def __post_init__(self) -> None:
        allowed = {ACTIVE_INTERNAL, ACTIVE_ENVIRONMENT, ACTIVE_EXTERNAL_SERVICE, ACTIVE_TEST_TOOL, INSTALLED_TRANSITIVE, CANDIDATE_REVIEW, HOLD_LICENSE}
        if not self.dependency_id or not self.component_name or not self.intended_role:
            raise ValueError("dependency identity fields are required")
        if self.review_status not in allowed:
            raise ValueError(f"unsupported dependency status: {self.review_status}")
        if self.review_status in {CANDIDATE_REVIEW, HOLD_LICENSE} and any((self.runtime_use_allowed, self.installation_allowed, self.service_binding_allowed, self.installed_by_this_build, self.imported_by_this_build)):
            raise ValueError("review/hold dependencies may not be installed, imported, or authorized")
        if self.service_binding_allowed and not self.runtime_use_allowed:
            raise ValueError("service-bound dependency must be runtime-authorized")
        if self.review_status in {ACTIVE_EXTERNAL_SERVICE, ACTIVE_TEST_TOOL, INSTALLED_TRANSITIVE}:
            if len(self.artifact_sha256) != 64 or not self.installed_by_this_build:
                raise ValueError("activated external dependency must bind audited artifact hash and installation")
        if self.review_status == ACTIVE_EXTERNAL_SERVICE and not (self.runtime_use_allowed and self.service_binding_allowed and self.imported_by_this_build):
            raise ValueError("external service tool must be installed, imported, and service-authorized")
        if self.review_status == ACTIVE_TEST_TOOL and (not self.runtime_use_allowed or self.service_binding_allowed):
            raise ValueError("test tool may execute in tests only, never service-bind")
    def to_dict(self) -> Dict[str, Any]:
        return {
            "dependency_id": self.dependency_id, "component_name": self.component_name,
            "dependency_class": self.dependency_class, "intended_role": self.intended_role,
            "license_observation": self.license_observation, "upstream_evidence_reference": self.upstream_evidence_reference,
            "review_status": self.review_status, "version_status": self.version_status,
            "evidence_captured_utc": self.evidence_captured_utc, "artifact_sha256": self.artifact_sha256,
            "runtime_use_allowed": self.runtime_use_allowed, "installation_allowed": self.installation_allowed,
            "service_binding_allowed": self.service_binding_allowed, "installed_by_this_build": self.installed_by_this_build,
            "imported_by_this_build": self.imported_by_this_build, "redistribution_notice_required": self.redistribution_notice_required,
            "commercial_use_review_required": self.commercial_use_review_required,
            "transitive_license_review_required": self.transitive_license_review_required,
            "linked_capability_scope": list(self.linked_capability_scope), "governance_notes": list(self.governance_notes),
        }
    def record_hash(self) -> str:
        return canonical_hash(self.to_dict())

class DependencyRegistry:
    def __init__(self) -> None:
        self._records: Dict[str, DependencyLicenseRecord] = {}
    def register(self, record: DependencyLicenseRecord) -> bool:
        prior = self._records.get(record.dependency_id)
        if prior is not None:
            if prior.to_dict() == record.to_dict():
                return False
            raise DependencyRegistrationError(f"conflicting dependency record: {record.dependency_id}")
        self._records[record.dependency_id] = record
        return True
    def get(self, dependency_id: str) -> Optional[DependencyLicenseRecord]:
        return self._records.get(dependency_id)
    def records(self) -> List[DependencyLicenseRecord]:
        return [self._records[key] for key in sorted(self._records)]
    def snapshot(self) -> Dict[str, Any]:
        records = [record.to_dict() for record in self.records()]
        return {
            "build_id": GP010B_BUILD_ID, "schema_version": GP010B_SCHEMA_VERSION,
            "authority": "forge_audited_dependency_authority",
            "supersedes_dependency_boundary_from": GP006_BUILD_ID,
            "record_count": len(records),
            "active_service_external_ids": list(_EQUATION_EXTERNAL_SERVICE_DEPS + _CAPACITY_EXTERNAL_SERVICE_DEPS),
            "active_testing_external_ids": list(_ACTIVE_TEST_DEPS),
            "remaining_candidate_review_ids": [r.dependency_id for r in self.records() if r.review_status == CANDIDATE_REVIEW],
            "hold_ids": [r.dependency_id for r in self.records() if r.review_status == HOLD_LICENSE],
            "records": records,
        }
    def registry_hash(self) -> str:
        return canonical_hash(self.snapshot())

_ALL_CAPS = ("cap.math.whole_number_arithmetic.v1", "cap.math.fraction_change_capacity.v1", "cap.math.linear_equation_one_unknown.v1", "cap.math.multi_step_count_change.v1", "cap.math.symbolic_math.v1")
_EQ_CAP = ("cap.math.linear_equation_one_unknown.v1", "cap.math.symbolic_math.v1")
_DEP_INTERNAL = "dep.aiweb.general_pipeline.internal_executor.v1"
_DEP_PYTHON = "dep.python.standard_library.runtime.v1"
_DEP_LARK = "dep.external.lark.parser.1_3_1.gp010b"
_DEP_SYMPY = "dep.external.sympy.solver.1_14_0.gp010b"
_DEP_MPMATH = "dep.external.mpmath.transitive.1_3_0.gp010b"
_DEP_HYPOTHESIS = "dep.external.hypothesis.testing.6_155_1.gp010b"
_DEP_SORTED = "dep.external.sortedcontainers.transitive.2_4_0.gp010b"
_DEP_PINT = "dep.external.pint.quantity.0_25_3.gp011b"
_DEP_FLEXCACHE = "dep.external.flexcache.transitive.0_3.gp011b"
_DEP_FLEXPARSER = "dep.external.flexparser.transitive.0_4.gp011b"
_DEP_PLATFORMDIRS = "dep.external.platformdirs.transitive.4_10_0.gp011b"
_DEP_TYPING_EXT = "dep.environment.typing_extensions.preexisting.4_15_0.gp011b"
_BASE_SERVICE_DEPS = (_DEP_INTERNAL, _DEP_PYTHON)
_EQUATION_EXTERNAL_SERVICE_DEPS = (_DEP_LARK, _DEP_SYMPY, _DEP_MPMATH)
_EQUATION_SERVICE_DEPS = _BASE_SERVICE_DEPS + _EQUATION_EXTERNAL_SERVICE_DEPS
_CAPACITY_EXTERNAL_SERVICE_DEPS = (_DEP_PINT, _DEP_FLEXCACHE, _DEP_FLEXPARSER, _DEP_PLATFORMDIRS, _DEP_TYPING_EXT)
_CAPACITY_SERVICE_DEPS = _BASE_SERVICE_DEPS + _CAPACITY_EXTERNAL_SERVICE_DEPS
_SYMBOLIC_MATH_SERVICE_DEPS = _BASE_SERVICE_DEPS + (_DEP_SYMPY, _DEP_MPMATH)
_ACTIVE_TEST_DEPS = (_DEP_HYPOTHESIS, _DEP_SORTED)
_REGISTRY = DependencyRegistry()

def _register(**kwargs: Any) -> None:
    _REGISTRY.register(DependencyLicenseRecord(**kwargs))
_register(dependency_id=_DEP_INTERNAL, component_name="AI.Web General Pipeline governed runtime", dependency_class="aiweb_owned_source", intended_role="Forge authority, capability boundary, manifests, receipts, renderer and Echo gates", license_observation="AI.WEB_OWNED_INTERNAL_SOURCE", upstream_evidence_reference="installed_source:rmc_engine_v1/general_pipeline", review_status=ACTIVE_INTERNAL, version_status="BOUND_TO_GP010B_R1_SOURCE_HASHES", runtime_use_allowed=True, service_binding_allowed=True, linked_capability_scope=_ALL_CAPS)
_register(dependency_id=_DEP_PYTHON, component_name="Python standard-library runtime", dependency_class="preexisting_runtime", intended_role="Existing deterministic runtime support", license_observation="Python Software Foundation License Version 2", upstream_evidence_reference="https://docs.python.org/3/license.html", review_status=ACTIVE_ENVIRONMENT, version_status="PREEXISTING_FORGE_VENV_RUNTIME", runtime_use_allowed=True, service_binding_allowed=True, redistribution_notice_required=True, linked_capability_scope=_ALL_CAPS)
_register(dependency_id=_DEP_LARK, component_name="Lark", dependency_class="audited_external_service", intended_role="Full-input grammar parsing for linear_equation_one_unknown", license_observation="MIT captured from audited wheel metadata/license", upstream_evidence_reference="gp010a:wheel:lark-1.3.1-py3-none-any.whl", review_status=ACTIVE_EXTERNAL_SERVICE, version_status="PINNED_INSTALLED_1.3.1", artifact_sha256="c629b661023a014c37da873b4ff58a817398d12635d3bbb2c5a03be7fe5d1e12", runtime_use_allowed=True, installation_allowed=True, service_binding_allowed=True, installed_by_this_build=True, imported_by_this_build=True, redistribution_notice_required=True, linked_capability_scope=_EQ_CAP, governance_notes=("Parses only the AI.Web-authored linear-equation grammar; cannot authorize domains or output.",))
_register(dependency_id=_DEP_SYMPY, component_name="SymPy", dependency_class="audited_external_service", intended_role="Exact symbolic solve and substitution proof for validated linear-equation AST", license_observation="BSD-style captured from audited wheel metadata/license", upstream_evidence_reference="gp010a:wheel:sympy-1.14.0-py3-none-any.whl", review_status=ACTIVE_EXTERNAL_SERVICE, version_status="PINNED_INSTALLED_1.14.0", artifact_sha256="e091cc3e99d2141a0ba2847328f5479b05d94a6635cb96148ccb3f34671bd8f5", runtime_use_allowed=True, installation_allowed=True, service_binding_allowed=True, installed_by_this_build=True, imported_by_this_build=True, redistribution_notice_required=True, linked_capability_scope=_EQ_CAP, governance_notes=("Receives only typed AST-derived SymPy objects; raw user text parsing is prohibited.",))
_register(dependency_id=_DEP_MPMATH, component_name="mpmath", dependency_class="audited_external_transitive", intended_role="Required SymPy numerical support distribution", license_observation="BSD-style captured from audited wheel metadata/license", upstream_evidence_reference="gp010a:wheel:mpmath-1.3.0-py3-none-any.whl", review_status=INSTALLED_TRANSITIVE, version_status="PINNED_INSTALLED_1.3.0", artifact_sha256="a0b2b9fe80bbcd81a6647ff13108738cfb482d481d826cc0e02f5b35e5c88d2c", runtime_use_allowed=True, installation_allowed=True, service_binding_allowed=True, installed_by_this_build=True, redistribution_notice_required=True, linked_capability_scope=_EQ_CAP)
_register(dependency_id=_DEP_HYPOTHESIS, component_name="Hypothesis", dependency_class="audited_external_test_tool", intended_role="Property/adversarial generation for equation parser and solver boundary", license_observation="MPL-2.0 captured from audited wheel metadata/license", upstream_evidence_reference="gp010a:wheel:hypothesis-6.155.1-py3-none-any.whl", review_status=ACTIVE_TEST_TOOL, version_status="PINNED_INSTALLED_6.155.1", artifact_sha256="2753f469df3ba3c483b08e0c37dbcbc41d8316ebb921abcc07493ee9c8a7d187", runtime_use_allowed=True, installation_allowed=True, installed_by_this_build=True, imported_by_this_build=True, redistribution_notice_required=True, linked_capability_scope=_EQ_CAP, governance_notes=("Authorized only inside verification scripts, never answer routing.",))
_register(dependency_id=_DEP_SORTED, component_name="sortedcontainers", dependency_class="audited_external_transitive", intended_role="Required Hypothesis transitive support distribution", license_observation="Apache-2.0 captured from audited wheel metadata/license", upstream_evidence_reference="gp010a:wheel:sortedcontainers-2.4.0-py2.py3-none-any.whl", review_status=INSTALLED_TRANSITIVE, version_status="PINNED_INSTALLED_2.4.0", artifact_sha256="a163dcaede0f1c021485e957a39245190e74249897e2ae4b2aa38595db237ee0", runtime_use_allowed=True, installation_allowed=True, installed_by_this_build=True, redistribution_notice_required=True, linked_capability_scope=_EQ_CAP)
_CAP_CAP = ("cap.math.fraction_change_capacity.v1",)
_register(dependency_id=_DEP_PINT, component_name="Pint", dependency_class="audited_external_service", intended_role="Unit-aware quantity computation and dimensional verification for fraction_change_capacity", license_observation="BSD captured from audited wheel metadata/license", upstream_evidence_reference="gp011a:wheel:pint-0.25.3-py3-none-any.whl", review_status=ACTIVE_EXTERNAL_SERVICE, version_status="PINNED_INSTALLED_0.25.3", artifact_sha256="27eb25143bd5de9fcc4d5a4b484f16faf6b4615aa93ece6b3373a8c1a3c1b97d", runtime_use_allowed=True, installation_allowed=True, service_binding_allowed=True, installed_by_this_build=True, imported_by_this_build=True, redistribution_notice_required=True, linked_capability_scope=_CAP_CAP, governance_notes=("Receives only AI.Web capacity quantity ASTs; arbitrary unit expressions and incompatible dimensions refuse.",))
_register(dependency_id=_DEP_FLEXCACHE, component_name="flexcache", dependency_class="audited_external_transitive", intended_role="Required Pint cache support distribution", license_observation="BSD captured from audited wheel metadata/license", upstream_evidence_reference="gp011a:wheel:flexcache-0.3-py3-none-any.whl", review_status=INSTALLED_TRANSITIVE, version_status="PINNED_INSTALLED_0.3", artifact_sha256="d43c9fea82336af6e0115e308d9d33a185390b8346a017564611f1466dcd2e32", runtime_use_allowed=True, installation_allowed=True, service_binding_allowed=True, installed_by_this_build=True, redistribution_notice_required=True, linked_capability_scope=_CAP_CAP)
_register(dependency_id=_DEP_FLEXPARSER, component_name="flexparser", dependency_class="audited_external_transitive", intended_role="Required Pint parser support distribution", license_observation="BSD captured from audited wheel metadata/license", upstream_evidence_reference="gp011a:wheel:flexparser-0.4-py3-none-any.whl", review_status=INSTALLED_TRANSITIVE, version_status="PINNED_INSTALLED_0.4", artifact_sha256="3738b456192dcb3e15620f324c447721023c0293f6af9955b481e91d00179846", runtime_use_allowed=True, installation_allowed=True, service_binding_allowed=True, installed_by_this_build=True, redistribution_notice_required=True, linked_capability_scope=_CAP_CAP)
_register(dependency_id=_DEP_PLATFORMDIRS, component_name="platformdirs", dependency_class="audited_external_transitive", intended_role="Required Pint platform support distribution", license_observation="MIT captured from audited wheel metadata/license", upstream_evidence_reference="gp011a:wheel:platformdirs-4.10.0-py3-none-any.whl", review_status=INSTALLED_TRANSITIVE, version_status="PINNED_INSTALLED_4.10.0", artifact_sha256="fb516cdb12eb0d857d0cd85a7c57cea4d060bee4578d6cf5a14dfdf8cbf8784a", runtime_use_allowed=True, installation_allowed=True, service_binding_allowed=True, installed_by_this_build=True, redistribution_notice_required=True, linked_capability_scope=_CAP_CAP)
_register(dependency_id=_DEP_TYPING_EXT, component_name="typing_extensions", dependency_class="preexisting_exact_dependency_reused", intended_role="Existing Forge distribution satisfying Pint's exact acquired dependency resolution without replacement", license_observation="PSF-2.0 captured from audited wheel metadata/license", upstream_evidence_reference="gp011b_collision_check:typing_extensions==4.15.0; gp011a:wheel:typing_extensions-4.15.0-py3-none-any.whl", review_status=ACTIVE_ENVIRONMENT, version_status="PREEXISTING_EXACT_MATCH_REUSED_4.15.0", artifact_sha256="f0fa19c6845758ab08074a0cfa8b7aecb71c999ca73d62883bc25cc018c4e548", runtime_use_allowed=True, installation_allowed=False, service_binding_allowed=True, installed_by_this_build=False, imported_by_this_build=False, redistribution_notice_required=True, linked_capability_scope=_CAP_CAP, governance_notes=("Protected pre-existing dependency shared by other Forge packages; GP-011B must not replace or uninstall it.",))
for dependency_id, name, role, license_obs, ref in (
    ("dep.candidate.sqlite_fts5.index.v1", "SQLite FTS5", "Future deterministic local corpus index", "Public domain candidate", "https://sqlite.org/copyright.html"),
    ("dep.candidate.pypdf.extract.v1", "pypdf", "Future approved PDF source intake", "BSD-3-Clause candidate", "https://github.com/py-pdf/pypdf/blob/main/LICENSE"),
    ("dep.candidate.pdfplumber.extract.v1", "pdfplumber", "Future layout-sensitive PDF intake", "MIT candidate", "https://github.com/jsvine/pdfplumber/blob/stable/LICENSE.txt"),
    ("dep.candidate.z3.constraints.v1", "Z3", "Future constraint verifier", "MIT candidate", "https://github.com/Z3Prover/z3/blob/master/LICENSE.txt"),
    ("dep.candidate.languagetool.proofread.v1", "LanguageTool", "Future spelling/grammar candidate generator", "LGPL candidate", "https://github.com/languagetool-org/languagetool"),
):
    _register(dependency_id=dependency_id, component_name=name, dependency_class="external_candidate", intended_role=role, license_observation=license_obs, upstream_evidence_reference=ref, review_status=CANDIDATE_REVIEW, version_status="UNPINNED_CANDIDATE_REVIEW_ONLY", redistribution_notice_required=True, commercial_use_review_required=True)
_register(dependency_id="dep.hold.pymupdf.extract.v1", component_name="PyMuPDF", dependency_class="external_candidate", intended_role="Possible PDF extraction held pending licensing decision", license_observation="AGPL or commercial license requirement", upstream_evidence_reference="https://pymupdf.readthedocs.io/en/latest/faq/index.html", review_status=HOLD_LICENSE, version_status="HELD_NOT_ELIGIBLE_FOR_INSTALL", commercial_use_review_required=True)

def all_dependency_records() -> List[DependencyLicenseRecord]:
    return _REGISTRY.records()
def dependency_record(dependency_id: str) -> Optional[DependencyLicenseRecord]:
    return _REGISTRY.get(dependency_id)
def active_runtime_dependency_ids(domain_id: Optional[str] = None) -> Tuple[str, ...]:
    if domain_id == "linear_equation_one_unknown":
        return _EQUATION_SERVICE_DEPS
    if domain_id == "fraction_change_capacity":
        return _CAPACITY_SERVICE_DEPS
    if domain_id == "symbolic_math":
        return _SYMBOLIC_MATH_SERVICE_DEPS
    return _BASE_SERVICE_DEPS
def active_testing_dependency_ids() -> Tuple[str, ...]:
    return _ACTIVE_TEST_DEPS
def dependency_records_for_ids(dependency_ids: Iterable[str]) -> List[DependencyLicenseRecord]:
    records = []
    for dependency_id in dependency_ids:
        record = dependency_record(dependency_id)
        if record is None:
            raise DependencyBoundaryError(f"dependency record not found: {dependency_id}")
        records.append(record)
    return records
def validate_service_dependency_binding(dependency_ids: Tuple[str, ...], domain_id: Optional[str] = None) -> None:
    expected = active_runtime_dependency_ids(domain_id)
    if dependency_ids != expected:
        raise DependencyBoundaryError(f"service dependency binding mismatch for {domain_id!r}")
    for record in dependency_records_for_ids(dependency_ids):
        if not (record.runtime_use_allowed and record.service_binding_allowed):
            raise DependencyBoundaryError(f"dependency not service-authorized: {record.dependency_id}")
        if record.review_status in {CANDIDATE_REVIEW, HOLD_LICENSE, ACTIVE_TEST_TOOL}:
            raise DependencyBoundaryError("candidate, held or test-only dependency cannot bind an answer service")
def validate_testing_dependency_binding(dependency_ids: Tuple[str, ...]) -> None:
    if dependency_ids != _ACTIVE_TEST_DEPS:
        raise DependencyBoundaryError("testing dependency binding mismatch")
    for record in dependency_records_for_ids(dependency_ids):
        if not record.runtime_use_allowed or record.service_binding_allowed:
            raise DependencyBoundaryError("testing dependency has invalid authority")
def dependency_registry_snapshot() -> Dict[str, Any]:
    return _REGISTRY.snapshot()
def dependency_registry_hash() -> str:
    return _REGISTRY.registry_hash()
def dependency_boundary_contract() -> Dict[str, Any]:
    return {
        "build_id": GP010B_BUILD_ID, "schema_version": GP010B_SCHEMA_VERSION,
        "dependency_registry_model": "forge_audited_installed_and_bounded_tool_authority",
        "supersedes_gp006_review_only_boundary": True,
        "third_party_components_installed": ["lark==1.3.1", "sympy==1.14.0", "hypothesis==6.155.1", "mpmath==1.3.0", "sortedcontainers==2.4.0", "Pint==0.25.3", "flexcache==0.3", "flexparser==0.4", "platformdirs==4.10.0"],
        "preexisting_dependency_reused_without_replacement": ["typing_extensions==4.15.0"],
        "third_party_components_imported_for_runtime_service": ["lark==1.3.1", "sympy==1.14.0", "Pint==0.25.3"],
        "third_party_components_imported_for_verification_only": ["hypothesis==6.155.1"],
        "source_can_install_or_authorize_dependency": False, "raw_user_text_sent_to_sympy": False,
        "manifest_first_symbolic_math_capability_active": True, "symbolic_math_safe_ast_only": True,
        "symbolic_math_worker_isolated": True, "symbolic_math_computation_only": True,
        "symbolic_math_delivery_authority_added": False, "symbolic_math_actual_echo_substitution_added": False,
        "symbolic_math_pending_existing_manifest_v2_and_echo": True,
        "adds_new_domain": False, "adds_corpus_ingestion": False, "writes_memory": False,
        "writes_identity_vault": False, "writes_contribution_economy": False,
        "writes_ledgers": False, "mints_ct": False,
    }
