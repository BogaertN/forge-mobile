"""MATH-001R1 / GP-012R1 — Complete in-memory attestation across twenty-six symbolic families."""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, List, Tuple

from .contracts import canonical_hash
from .symbolic_math_ast import (
    MATH001_BUILD_ID,
    MATH001_CAPABILITY_ID,
    SUPPORTED_OPERATION_FAMILIES,
    SymbolicMathOperationManifest,
)
from .symbolic_math_kernel import execute_symbolic_math_attestation_batch, symbolic_math_kernel_boundary


def I(value: int) -> Dict[str, Any]: return {"node": "integer", "value": value}
def Q(numerator: int, denominator: int) -> Dict[str, Any]: return {"node": "rational", "numerator": numerator, "denominator": denominator}
def S(name: str, **assumptions: bool) -> Dict[str, Any]: return {"node": "symbol", "name": name, "assumptions": assumptions} if assumptions else {"node": "symbol", "name": name}
def C(name: str) -> Dict[str, Any]: return {"node": "constant", "name": name}
def Add(*args: Dict[str, Any]) -> Dict[str, Any]: return {"node": "add", "args": list(args)}
def Mul(*args: Dict[str, Any]) -> Dict[str, Any]: return {"node": "mul", "args": list(args)}
def Pow(base: Dict[str, Any], exponent: Dict[str, Any]) -> Dict[str, Any]: return {"node": "pow", "base": base, "exponent": exponent}
def Neg(arg: Dict[str, Any]) -> Dict[str, Any]: return {"node": "neg", "arg": arg}
def Fn(name: str, *args: Dict[str, Any]) -> Dict[str, Any]: return {"node": "function", "name": name, "args": list(args)}
def UF(name: str, *args: Dict[str, Any]) -> Dict[str, Any]: return {"node": "applied_function", "name": name, "args": list(args)}
def D(value: Dict[str, Any], variable: Dict[str, Any], order: int = 1) -> Dict[str, Any]: return {"node": "derivative", "value": value, "variable": variable, "order": order}
def Rel(operator: str, left: Dict[str, Any], right: Dict[str, Any]) -> Dict[str, Any]: return {"node": "relation", "operator": operator, "left": left, "right": right}
def Matrix(*rows: Tuple[Dict[str, Any], ...]) -> Dict[str, Any]: return {"node": "matrix", "rows": [list(row) for row in rows]}
def Point(*coordinates: Dict[str, Any]) -> Dict[str, Any]: return {"node": "point", "coordinates": list(coordinates)}
def Line(point_a: Dict[str, Any], point_b: Dict[str, Any]) -> Dict[str, Any]: return {"node": "line", "point_a": point_a, "point_b": point_b}
def Op(name: str) -> Dict[str, Any]: return {"node": "quantum_operator", "name": name}


def canonical_attestation_manifests() -> List[SymbolicMathOperationManifest]:
    x, y, i = S("x"), S("y"), S("i", integer=True)
    f_x = UF("f", x)
    raw = [
        ("exact_evaluation", {"value": Add(I(2), Q(1, 3))}),
        ("simplification", {"value": Mul(Add(x, I(1)), Add(x, Neg(I(1))))}),
        ("expansion", {"value": Pow(Add(x, I(1)), I(3))}),
        ("factoring", {"value": Add(Pow(x, I(2)), Neg(I(1)))}),
        ("trigonometric_simplification", {"value": Add(Pow(Fn("sin", x), I(2)), Pow(Fn("cos", x), I(2)))}),
        ("trigonometric_expansion", {"value": Fn("sin", Add(x, y))}),
        ("equation_solving", {"equation": Rel("eq", Add(Mul(I(2), x), I(3)), I(9)), "variable": x}),
        ("system_solving", {"equations": [Rel("eq", Add(x, y), I(5)), Rel("eq", Add(x, Neg(y)), I(1))], "variables": [x, y]}),
        ("inequality_solving", {"relation": Rel("gt", Add(x, I(1)), I(0)), "variable": x}),
        ("differentiation", {"value": Mul(Pow(x, I(2)), Fn("sin", x)), "variable": x, "order": 1}),
        ("integration", {"value": Mul(I(2), x), "variable": x}),
        ("limits", {"value": Mul(Fn("sin", x), Pow(x, Neg(I(1)))), "variable": x, "point": I(0), "direction": "+-"}),
        ("series_expansion", {"value": Fn("exp", x), "variable": x, "point": I(0), "order": 4}),
        ("summation", {"value": i, "variable": i, "lower": I(1), "upper": I(5)}),
        ("products", {"value": i, "variable": i, "lower": I(1), "upper": I(4)}),
        ("matrix_determinant", {"matrix": Matrix((I(1), I(2)), (I(3), I(4)))}),
        ("matrix_inverse", {"matrix": Matrix((I(1), I(2)), (I(3), I(5)))}),
        ("matrix_rref", {"matrix": Matrix((I(1), I(2)), (I(2), I(4)))}),
        ("matrix_eigen_analysis", {"matrix": Matrix((I(2), I(0)), (I(0), I(3)))}),
        ("euclidean_distance", {"point_a": Point(I(0), I(0)), "point_b": Point(I(3), I(4))}),
        ("pythagorean_reasoning", {"leg_a": I(3), "leg_b": I(4)}),
        ("geometry_intersection", {"entity_a": Line(Point(I(0), I(0)), Point(I(2), I(2))), "entity_b": Line(Point(I(0), I(2)), Point(I(2), I(0)))}),
        ("ordinary_differential_equation_solving", {"equation": Rel("eq", D(f_x, x), f_x), "function": f_x, "variable": x}),
        ("commutators", {"left": Op("A"), "right": Op("B")}),
        ("tensor_products", {"factors": [Op("A"), Op("B")]}),
        ("substitution_verification", {"relation": Rel("eq", Pow(x, I(2)), I(9)), "assignments": [{"symbol": x, "value": I(3)}]}),
    ]
    return [
        SymbolicMathOperationManifest(
            operation_id=f"math001.attestation.{index:02d}.{family}",
            operation_family=family,
            operands=operands,
        )
        for index, (family, operands) in enumerate(raw, start=1)
    ]


@dataclass(frozen=True)
class SymbolicMathKernelAttestationReceipt:
    computed_operation_families: Tuple[str, ...]
    execution_receipt_hashes: Tuple[str, ...]
    pending_governance_receipt_hashes: Tuple[str, ...]
    kernel_boundary_hash: str
    schema_version: str = "aiweb_symbolic_math_computation_kernel_attestation_v1_math001r1"
    status: str = "MATH001R1_SYMBOLIC_COMPUTATION_KERNEL_ATTESTED_26_OF_26_PENDING_GOVERNANCE"
    delivery_authorized: bool = False
    actual_echo_invoked: bool = False
    writes_memory: bool = False
    writes_identity_vault: bool = False
    writes_contribution_economy: bool = False
    mints_ct: bool = False
    writes_ledgers: bool = False
    ingests_corpus: bool = False

    def __post_init__(self) -> None:
        if self.computed_operation_families != SUPPORTED_OPERATION_FAMILIES:
            raise ValueError("attestation does not cover the canonical symbolic operation surface")
        if len(self.execution_receipt_hashes) != len(SUPPORTED_OPERATION_FAMILIES):
            raise ValueError("attestation execution receipt hash count is incomplete")
        if len(self.pending_governance_receipt_hashes) != len(SUPPORTED_OPERATION_FAMILIES):
            raise ValueError("attestation pending-governance receipt hash count is incomplete")
        all_hashes = self.execution_receipt_hashes + self.pending_governance_receipt_hashes + (self.kernel_boundary_hash,)
        if any(len(value) != 64 for value in all_hashes):
            raise ValueError("attestation requires complete SHA-256 bindings")
        if self.delivery_authorized or self.actual_echo_invoked:
            raise ValueError("computation attestation cannot claim delivery or Echo invocation")

    def to_dict(self) -> Dict[str, Any]:
        return {
            "schema_version": self.schema_version, "status": self.status,
            "capability_id": MATH001_CAPABILITY_ID,
            "computed_operation_families": list(self.computed_operation_families),
            "computed_operation_family_count": len(self.computed_operation_families),
            "execution_receipt_hashes": list(self.execution_receipt_hashes),
            "pending_governance_receipt_hashes": list(self.pending_governance_receipt_hashes),
            "kernel_boundary_hash": self.kernel_boundary_hash,
            "delivery_authorized": self.delivery_authorized,
            "actual_echo_invoked": self.actual_echo_invoked,
            "writes_memory": self.writes_memory, "writes_identity_vault": self.writes_identity_vault,
            "writes_contribution_economy": self.writes_contribution_economy,
            "mints_ct": self.mints_ct, "writes_ledgers": self.writes_ledgers,
            "ingests_corpus": self.ingests_corpus,
        }

    def receipt_hash(self) -> str:
        return canonical_hash(self.to_dict())


def attest_symbolic_math_kernel() -> Dict[str, Any]:
    manifests = canonical_attestation_manifests()
    computed = execute_symbolic_math_attestation_batch(manifests)
    expected = "COMPUTED_VERIFIED_PENDING_DOWNSTREAM_GOVERNANCE"
    if any(result.get("status") != expected for result in computed):
        failed = [item for item in computed if item.get("status") != expected]
        raise ValueError(f"symbolic attestation contained a failed or over-authorized result: {failed}")
    if any(item.get("delivery_authorized") or item.get("render_allowed") or item.get("actual_echo_invoked") for item in computed):
        raise ValueError("symbolic computation result improperly asserted downstream governance")
    receipt = SymbolicMathKernelAttestationReceipt(
        computed_operation_families=tuple(item["operation_manifest"]["operation_family"] for item in computed),
        execution_receipt_hashes=tuple(item["execution_receipt_hash"] for item in computed),
        pending_governance_receipt_hashes=tuple(item["pending_governance_receipt_hash"] for item in computed),
        kernel_boundary_hash=canonical_hash(symbolic_math_kernel_boundary()),
    )
    return {
        "build_id": MATH001_BUILD_ID,
        "status": receipt.status,
        "attestation_receipt": receipt.to_dict(),
        "attestation_receipt_hash": receipt.receipt_hash(),
        "computed_results_pending_governance": computed,
    }


__all__ = [
    "canonical_attestation_manifests", "SymbolicMathKernelAttestationReceipt",
    "attest_symbolic_math_kernel",
]
