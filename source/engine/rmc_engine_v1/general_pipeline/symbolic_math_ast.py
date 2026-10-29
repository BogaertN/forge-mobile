"""MATH-001R1 / GP-012R1 — Typed symbolic mathematics manifest and safe AST boundary.

This module defines data only. It does not import a computer-algebra backend and it
never accepts free-form mathematical source strings. Mathematical values enter the
kernel as an explicitly allowlisted recursive node tree.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, Mapping, MutableMapping, Sequence, Tuple
import re

from .contracts import canonical_hash

MATH001_BUILD_ID = "MATH-001R1-GP-012R1-SYMBOLIC-MATHEMATICS-COMPUTATION-KERNEL-GOVERNANCE-CORRECTION"
MATH001_SCHEMA_VERSION = "aiweb_symbolic_math_operation_manifest_v1_math001r1"
MATH001_CAPABILITY_ID = "cap.math.symbolic_math.v1"

SUPPORTED_OPERATION_FAMILIES: Tuple[str, ...] = (
    "exact_evaluation",
    "simplification",
    "expansion",
    "factoring",
    "trigonometric_simplification",
    "trigonometric_expansion",
    "equation_solving",
    "system_solving",
    "inequality_solving",
    "differentiation",
    "integration",
    "limits",
    "series_expansion",
    "summation",
    "products",
    "matrix_determinant",
    "matrix_inverse",
    "matrix_rref",
    "matrix_eigen_analysis",
    "euclidean_distance",
    "pythagorean_reasoning",
    "geometry_intersection",
    "ordinary_differential_equation_solving",
    "commutators",
    "tensor_products",
    "substitution_verification",
)

_ALLOWED_FUNCTIONS = {"sin", "cos", "tan", "asin", "acos", "atan", "exp", "log", "sqrt", "abs"}
_ALLOWED_CONSTANTS = {"pi", "E", "I", "oo"}
_ALLOWED_RELATIONS = {"eq", "ne", "lt", "le", "gt", "ge"}
_IDENTIFIER = re.compile(r"^[A-Za-z][A-Za-z0-9_]{0,31}$")
_OPERATION_ID = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._:-]{0,95}$")


class SymbolicMathBoundaryError(ValueError):
    """Raised when typed mathematical input violates the manifest boundary."""


def _identifier(value: Any, label: str) -> str:
    if not isinstance(value, str) or _IDENTIFIER.fullmatch(value) is None:
        raise SymbolicMathBoundaryError(f"{label} must be a bounded identifier")
    return value


def _require_keys(node: Mapping[str, Any], required: set[str], allowed: set[str], path: str) -> None:
    missing = required.difference(node)
    extra = set(node).difference(allowed)
    if missing or extra:
        raise SymbolicMathBoundaryError(f"invalid keys at {path}: missing={sorted(missing)} extra={sorted(extra)}")


def validate_ast(node: Any, *, path: str = "$", counter: MutableMapping[str, int] | None = None, max_nodes: int = 256) -> int:
    """Validate one allowlisted mathematical AST without interpreting its meaning."""
    if counter is None:
        counter = {"nodes": 0}
    if not isinstance(node, Mapping):
        raise SymbolicMathBoundaryError(f"AST node at {path} must be an object")
    counter["nodes"] += 1
    if counter["nodes"] > max_nodes:
        raise SymbolicMathBoundaryError("AST node budget exceeded")
    kind = node.get("node")
    if not isinstance(kind, str):
        raise SymbolicMathBoundaryError(f"AST node kind missing at {path}")
    if kind == "integer":
        _require_keys(node, {"node", "value"}, {"node", "value"}, path)
        value = node["value"]
        if isinstance(value, bool) or not isinstance(value, int) or abs(value) > 10**12:
            raise SymbolicMathBoundaryError(f"integer outside bounded range at {path}")
    elif kind == "rational":
        _require_keys(node, {"node", "numerator", "denominator"}, {"node", "numerator", "denominator"}, path)
        for key in ("numerator", "denominator"):
            value = node[key]
            if isinstance(value, bool) or not isinstance(value, int) or abs(value) > 10**12:
                raise SymbolicMathBoundaryError(f"invalid rational component at {path}")
        if node["denominator"] == 0:
            raise SymbolicMathBoundaryError("rational denominator cannot be zero")
    elif kind == "symbol":
        _require_keys(node, {"node", "name"}, {"node", "name", "assumptions"}, path)
        _identifier(node["name"], f"symbol name at {path}")
        assumptions = node.get("assumptions", {})
        if not isinstance(assumptions, Mapping) or set(assumptions).difference({"real", "integer", "positive", "nonzero"}):
            raise SymbolicMathBoundaryError(f"unsupported symbol assumptions at {path}")
        if any(not isinstance(v, bool) for v in assumptions.values()):
            raise SymbolicMathBoundaryError(f"symbol assumption values must be boolean at {path}")
    elif kind == "constant":
        _require_keys(node, {"node", "name"}, {"node", "name"}, path)
        if node["name"] not in _ALLOWED_CONSTANTS:
            raise SymbolicMathBoundaryError(f"unsupported constant at {path}")
    elif kind in {"add", "mul"}:
        _require_keys(node, {"node", "args"}, {"node", "args"}, path)
        args = node["args"]
        if not isinstance(args, list) or not 2 <= len(args) <= 32:
            raise SymbolicMathBoundaryError(f"{kind} requires 2..32 arguments at {path}")
        for index, child in enumerate(args):
            validate_ast(child, path=f"{path}.args[{index}]", counter=counter, max_nodes=max_nodes)
    elif kind == "pow":
        _require_keys(node, {"node", "base", "exponent"}, {"node", "base", "exponent"}, path)
        validate_ast(node["base"], path=f"{path}.base", counter=counter, max_nodes=max_nodes)
        validate_ast(node["exponent"], path=f"{path}.exponent", counter=counter, max_nodes=max_nodes)
    elif kind == "neg":
        _require_keys(node, {"node", "arg"}, {"node", "arg"}, path)
        validate_ast(node["arg"], path=f"{path}.arg", counter=counter, max_nodes=max_nodes)
    elif kind == "function":
        _require_keys(node, {"node", "name", "args"}, {"node", "name", "args"}, path)
        if node["name"] not in _ALLOWED_FUNCTIONS:
            raise SymbolicMathBoundaryError(f"function is not allowlisted at {path}")
        args = node["args"]
        if not isinstance(args, list) or not 1 <= len(args) <= 4:
            raise SymbolicMathBoundaryError(f"invalid function argument list at {path}")
        for index, child in enumerate(args):
            validate_ast(child, path=f"{path}.args[{index}]", counter=counter, max_nodes=max_nodes)
    elif kind == "applied_function":
        _require_keys(node, {"node", "name", "args"}, {"node", "name", "args"}, path)
        _identifier(node["name"], f"function name at {path}")
        args = node["args"]
        if not isinstance(args, list) or not 1 <= len(args) <= 3:
            raise SymbolicMathBoundaryError(f"invalid applied-function argument list at {path}")
        for index, child in enumerate(args):
            validate_ast(child, path=f"{path}.args[{index}]", counter=counter, max_nodes=max_nodes)
    elif kind == "derivative":
        _require_keys(node, {"node", "value", "variable"}, {"node", "value", "variable", "order"}, path)
        order = node.get("order", 1)
        if isinstance(order, bool) or not isinstance(order, int) or not 1 <= order <= 6:
            raise SymbolicMathBoundaryError(f"derivative order outside bounds at {path}")
        validate_ast(node["value"], path=f"{path}.value", counter=counter, max_nodes=max_nodes)
        validate_ast(node["variable"], path=f"{path}.variable", counter=counter, max_nodes=max_nodes)
    elif kind == "relation":
        _require_keys(node, {"node", "operator", "left", "right"}, {"node", "operator", "left", "right"}, path)
        if node["operator"] not in _ALLOWED_RELATIONS:
            raise SymbolicMathBoundaryError(f"unsupported relation at {path}")
        validate_ast(node["left"], path=f"{path}.left", counter=counter, max_nodes=max_nodes)
        validate_ast(node["right"], path=f"{path}.right", counter=counter, max_nodes=max_nodes)
    elif kind == "matrix":
        _require_keys(node, {"node", "rows"}, {"node", "rows"}, path)
        rows = node["rows"]
        if not isinstance(rows, list) or not 1 <= len(rows) <= 12:
            raise SymbolicMathBoundaryError(f"matrix row limit violated at {path}")
        width = len(rows[0]) if isinstance(rows[0], list) else 0
        if not 1 <= width <= 12 or any(not isinstance(row, list) or len(row) != width for row in rows):
            raise SymbolicMathBoundaryError(f"matrix must be rectangular and bounded at {path}")
        for r, row in enumerate(rows):
            for c, child in enumerate(row):
                validate_ast(child, path=f"{path}.rows[{r}][{c}]", counter=counter, max_nodes=max_nodes)
    elif kind == "point":
        _require_keys(node, {"node", "coordinates"}, {"node", "coordinates"}, path)
        coords = node["coordinates"]
        if not isinstance(coords, list) or len(coords) not in {2, 3}:
            raise SymbolicMathBoundaryError(f"point must be 2D or 3D at {path}")
        for index, child in enumerate(coords):
            validate_ast(child, path=f"{path}.coordinates[{index}]", counter=counter, max_nodes=max_nodes)
    elif kind == "line":
        _require_keys(node, {"node", "point_a", "point_b"}, {"node", "point_a", "point_b"}, path)
        validate_ast(node["point_a"], path=f"{path}.point_a", counter=counter, max_nodes=max_nodes)
        validate_ast(node["point_b"], path=f"{path}.point_b", counter=counter, max_nodes=max_nodes)
    elif kind == "circle":
        _require_keys(node, {"node", "center", "radius"}, {"node", "center", "radius"}, path)
        validate_ast(node["center"], path=f"{path}.center", counter=counter, max_nodes=max_nodes)
        validate_ast(node["radius"], path=f"{path}.radius", counter=counter, max_nodes=max_nodes)
    elif kind == "quantum_operator":
        _require_keys(node, {"node", "name"}, {"node", "name"}, path)
        _identifier(node["name"], f"operator name at {path}")
    else:
        raise SymbolicMathBoundaryError(f"unsupported AST node kind {kind!r} at {path}")
    return counter["nodes"]


@dataclass(frozen=True)
class SymbolicMathResourcePolicy:
    wall_timeout_seconds: int = 8
    cpu_seconds: int = 6
    memory_megabytes: int = 4096
    output_character_limit: int = 24000
    ast_node_limit: int = 256

    def __post_init__(self) -> None:
        bounds = {
            "wall_timeout_seconds": (1, 30),
            "cpu_seconds": (1, 20),
            "memory_megabytes": (256, 8192),
            "output_character_limit": (256, 100000),
            "ast_node_limit": (8, 1024),
        }
        for name, (minimum, maximum) in bounds.items():
            value = getattr(self, name)
            if isinstance(value, bool) or not isinstance(value, int) or not minimum <= value <= maximum:
                raise SymbolicMathBoundaryError(f"resource policy {name} is outside the governed range")

    @classmethod
    def from_mapping(cls, value: Mapping[str, Any] | None) -> "SymbolicMathResourcePolicy":
        if value is None:
            return cls()
        if not isinstance(value, Mapping) or set(value).difference({"wall_timeout_seconds", "cpu_seconds", "memory_megabytes", "output_character_limit", "ast_node_limit"}):
            raise SymbolicMathBoundaryError("resource_policy contains unsupported fields")
        return cls(**dict(value))

    def to_dict(self) -> Dict[str, int]:
        return {
            "wall_timeout_seconds": self.wall_timeout_seconds,
            "cpu_seconds": self.cpu_seconds,
            "memory_megabytes": self.memory_megabytes,
            "output_character_limit": self.output_character_limit,
            "ast_node_limit": self.ast_node_limit,
        }


def _node_required(operands: Mapping[str, Any], key: str, counter: MutableMapping[str, int], policy: SymbolicMathResourcePolicy) -> None:
    if key not in operands:
        raise SymbolicMathBoundaryError(f"operand {key!r} is required")
    validate_ast(operands[key], path=f"$.operands.{key}", counter=counter, max_nodes=policy.ast_node_limit)


def _node_list(operands: Mapping[str, Any], key: str, minimum: int, maximum: int, counter: MutableMapping[str, int], policy: SymbolicMathResourcePolicy) -> None:
    values = operands.get(key)
    if not isinstance(values, list) or not minimum <= len(values) <= maximum:
        raise SymbolicMathBoundaryError(f"operand {key!r} must contain {minimum}..{maximum} AST values")
    for index, value in enumerate(values):
        validate_ast(value, path=f"$.operands.{key}[{index}]", counter=counter, max_nodes=policy.ast_node_limit)


def validate_operation_operands(operation_family: str, operands: Any, policy: SymbolicMathResourcePolicy) -> int:
    if not isinstance(operands, Mapping):
        raise SymbolicMathBoundaryError("operands must be an object")
    required: Dict[str, set[str]] = {
        "exact_evaluation": {"value"}, "simplification": {"value"}, "expansion": {"value"},
        "factoring": {"value"}, "trigonometric_simplification": {"value"}, "trigonometric_expansion": {"value"},
        "equation_solving": {"equation", "variable"}, "system_solving": {"equations", "variables"},
        "inequality_solving": {"relation", "variable"}, "differentiation": {"value", "variable", "order"},
        "integration": {"value", "variable"}, "limits": {"value", "variable", "point", "direction"},
        "series_expansion": {"value", "variable", "point", "order"}, "summation": {"value", "variable", "lower", "upper"},
        "products": {"value", "variable", "lower", "upper"}, "matrix_determinant": {"matrix"},
        "matrix_inverse": {"matrix"}, "matrix_rref": {"matrix"}, "matrix_eigen_analysis": {"matrix"},
        "euclidean_distance": {"point_a", "point_b"}, "pythagorean_reasoning": {"leg_a", "leg_b"},
        "geometry_intersection": {"entity_a", "entity_b"},
        "ordinary_differential_equation_solving": {"equation", "function", "variable"},
        "commutators": {"left", "right"}, "tensor_products": {"factors"},
        "substitution_verification": {"relation", "assignments"},
    }
    permitted = required[operation_family]
    extras = set(operands).difference(permitted)
    missing = permitted.difference(operands)
    if extras or missing:
        raise SymbolicMathBoundaryError(f"invalid operands for {operation_family}: missing={sorted(missing)} extra={sorted(extras)}")
    counter: MutableMapping[str, int] = {"nodes": 0}
    if operation_family in {"exact_evaluation", "simplification", "expansion", "factoring", "trigonometric_simplification", "trigonometric_expansion"}:
        _node_required(operands, "value", counter, policy)
    elif operation_family in {"equation_solving", "inequality_solving"}:
        _node_required(operands, "equation" if operation_family == "equation_solving" else "relation", counter, policy)
        _node_required(operands, "variable", counter, policy)
    elif operation_family == "system_solving":
        _node_list(operands, "equations", 1, 12, counter, policy); _node_list(operands, "variables", 1, 12, counter, policy)
    elif operation_family in {"differentiation", "series_expansion"}:
        _node_required(operands, "value", counter, policy); _node_required(operands, "variable", counter, policy)
        if operation_family == "series_expansion": _node_required(operands, "point", counter, policy)
        order = operands["order"]
        if isinstance(order, bool) or not isinstance(order, int) or not 1 <= order <= 12:
            raise SymbolicMathBoundaryError("operation order is outside the governed range")
    elif operation_family == "integration":
        _node_required(operands, "value", counter, policy); _node_required(operands, "variable", counter, policy)
    elif operation_family == "limits":
        _node_required(operands, "value", counter, policy); _node_required(operands, "variable", counter, policy); _node_required(operands, "point", counter, policy)
        if operands["direction"] not in {"+", "-", "+-"}:
            raise SymbolicMathBoundaryError("limit direction is not supported")
    elif operation_family in {"summation", "products"}:
        for key in ("value", "variable", "lower", "upper"): _node_required(operands, key, counter, policy)
    elif operation_family.startswith("matrix_"):
        _node_required(operands, "matrix", counter, policy)
    elif operation_family == "euclidean_distance":
        _node_required(operands, "point_a", counter, policy); _node_required(operands, "point_b", counter, policy)
    elif operation_family == "pythagorean_reasoning":
        _node_required(operands, "leg_a", counter, policy); _node_required(operands, "leg_b", counter, policy)
    elif operation_family == "geometry_intersection":
        _node_required(operands, "entity_a", counter, policy); _node_required(operands, "entity_b", counter, policy)
    elif operation_family == "ordinary_differential_equation_solving":
        for key in ("equation", "function", "variable"): _node_required(operands, key, counter, policy)
    elif operation_family == "commutators":
        _node_required(operands, "left", counter, policy); _node_required(operands, "right", counter, policy)
    elif operation_family == "tensor_products":
        _node_list(operands, "factors", 2, 8, counter, policy)
    elif operation_family == "substitution_verification":
        _node_required(operands, "relation", counter, policy)
        assignments = operands["assignments"]
        if not isinstance(assignments, list) or not 1 <= len(assignments) <= 16:
            raise SymbolicMathBoundaryError("assignments must be a bounded list")
        for index, assignment in enumerate(assignments):
            if not isinstance(assignment, Mapping) or set(assignment) != {"symbol", "value"}:
                raise SymbolicMathBoundaryError(f"invalid assignment at index {index}")
            validate_ast(assignment["symbol"], path=f"$.operands.assignments[{index}].symbol", counter=counter, max_nodes=policy.ast_node_limit)
            validate_ast(assignment["value"], path=f"$.operands.assignments[{index}].value", counter=counter, max_nodes=policy.ast_node_limit)
    return counter["nodes"]


@dataclass(frozen=True)
class SymbolicMathOperationManifest:
    operation_id: str
    operation_family: str
    operands: Mapping[str, Any]
    resource_policy: SymbolicMathResourcePolicy = field(default_factory=SymbolicMathResourcePolicy)
    schema_version: str = MATH001_SCHEMA_VERSION
    capability_id: str = MATH001_CAPABILITY_ID
    input_policy: str = "ALLOWLISTED_RECURSIVE_AST_ONLY"
    side_effect_policy: str = "COMPUTATION_ONLY_NO_WRITES_NO_MINT_NO_INGESTION"
    ast_node_count: int = field(init=False)

    def __post_init__(self) -> None:
        if self.schema_version != MATH001_SCHEMA_VERSION or self.capability_id != MATH001_CAPABILITY_ID:
            raise SymbolicMathBoundaryError("manifest schema or capability authority mismatch")
        if not isinstance(self.operation_id, str) or _OPERATION_ID.fullmatch(self.operation_id) is None:
            raise SymbolicMathBoundaryError("operation_id is not valid")
        if self.operation_family not in SUPPORTED_OPERATION_FAMILIES:
            raise SymbolicMathBoundaryError("operation family is not supported")
        if self.input_policy != "ALLOWLISTED_RECURSIVE_AST_ONLY" or self.side_effect_policy != "COMPUTATION_ONLY_NO_WRITES_NO_MINT_NO_INGESTION":
            raise SymbolicMathBoundaryError("manifest policy fields cannot be weakened")
        count = validate_operation_operands(self.operation_family, self.operands, self.resource_policy)
        object.__setattr__(self, "ast_node_count", count)

    @classmethod
    def from_mapping(cls, value: Mapping[str, Any]) -> "SymbolicMathOperationManifest":
        if not isinstance(value, Mapping):
            raise SymbolicMathBoundaryError("operation manifest must be an object")
        allowed = {"schema_version", "capability_id", "operation_id", "operation_family", "operands", "resource_policy", "input_policy", "side_effect_policy", "ast_node_count"}
        if set(value).difference(allowed):
            raise SymbolicMathBoundaryError("operation manifest contains unsupported fields")
        return cls(
            schema_version=value.get("schema_version", MATH001_SCHEMA_VERSION),
            capability_id=value.get("capability_id", MATH001_CAPABILITY_ID),
            operation_id=value["operation_id"],
            operation_family=value["operation_family"],
            operands=value["operands"],
            resource_policy=SymbolicMathResourcePolicy.from_mapping(value.get("resource_policy")),
            input_policy=value.get("input_policy", "ALLOWLISTED_RECURSIVE_AST_ONLY"),
            side_effect_policy=value.get("side_effect_policy", "COMPUTATION_ONLY_NO_WRITES_NO_MINT_NO_INGESTION"),
        )

    def to_dict(self) -> Dict[str, Any]:
        return {
            "schema_version": self.schema_version,
            "capability_id": self.capability_id,
            "operation_id": self.operation_id,
            "operation_family": self.operation_family,
            "operands": dict(self.operands),
            "resource_policy": self.resource_policy.to_dict(),
            "input_policy": self.input_policy,
            "side_effect_policy": self.side_effect_policy,
            "ast_node_count": self.ast_node_count,
        }

    def manifest_hash(self) -> str:
        return canonical_hash(self.to_dict())


def symbolic_math_ast_boundary() -> Dict[str, Any]:
    return {
        "build_id": MATH001_BUILD_ID,
        "schema_version": MATH001_SCHEMA_VERSION,
        "capability_id": MATH001_CAPABILITY_ID,
        "supported_operation_family_count": len(SUPPORTED_OPERATION_FAMILIES),
        "supported_operation_families": list(SUPPORTED_OPERATION_FAMILIES),
        "raw_mathematical_source_accepted": False,
        "allowlisted_recursive_ast_required": True,
        "bounded_resource_policy_required": True,
        "writes_memory": False,
        "writes_identity_vault": False,
        "writes_contribution_economy": False,
        "mints_ct": False,
        "writes_ledgers": False,
        "ingests_corpus": False,
    }


__all__ = [
    "MATH001_BUILD_ID", "MATH001_SCHEMA_VERSION", "MATH001_CAPABILITY_ID",
    "SUPPORTED_OPERATION_FAMILIES", "SymbolicMathBoundaryError",
    "SymbolicMathResourcePolicy", "SymbolicMathOperationManifest",
    "validate_ast", "validate_operation_operands", "symbolic_math_ast_boundary",
]
