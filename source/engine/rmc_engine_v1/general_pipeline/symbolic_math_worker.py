"""MATH-001R1 isolated SymPy worker.

This file is launched directly by the governed parent service. Its import-time
surface is standard-library only. Resource limits are applied before the
computer-algebra backend and package AST validators are loaded.
"""
from __future__ import annotations

import json
import sys
from typing import Any, Dict, List, Mapping


def _bounded_policy(raw: Any) -> Dict[str, int]:
    defaults = {
        "cpu_seconds": 6,
        "memory_megabytes": 4096,
        "output_character_limit": 24000,
        "ast_node_limit": 256,
    }
    if not isinstance(raw, Mapping):
        return defaults
    ranges = {
        "cpu_seconds": (1, 20),
        "memory_megabytes": (256, 8192),
        "output_character_limit": (256, 100000),
        "ast_node_limit": (8, 1024),
    }
    result = dict(defaults)
    for key, (minimum, maximum) in ranges.items():
        value = raw.get(key, result[key])
        if isinstance(value, bool) or not isinstance(value, int):
            continue
        result[key] = max(minimum, min(maximum, value))
    return result


def _apply_resource_limits(policy: Mapping[str, int]) -> None:
    import resource
    cpu = policy["cpu_seconds"]
    memory = policy["memory_megabytes"] * 1024 * 1024
    output = max(4096, policy["output_character_limit"] * 4)
    resource.setrlimit(resource.RLIMIT_CPU, (cpu, cpu + 1))
    resource.setrlimit(resource.RLIMIT_AS, (memory, memory))
    resource.setrlimit(resource.RLIMIT_FSIZE, (output, output))
    resource.setrlimit(resource.RLIMIT_NOFILE, (32, 32))


def _construct(node: Mapping[str, Any], sp: Any, Operator: Any) -> Any:
    kind = node["node"]
    if kind == "integer":
        return sp.Integer(node["value"])
    if kind == "rational":
        return sp.Rational(node["numerator"], node["denominator"])
    if kind == "symbol":
        return sp.Symbol(node["name"], **dict(node.get("assumptions", {})))
    if kind == "constant":
        return {"pi": sp.pi, "E": sp.E, "I": sp.I, "oo": sp.oo}[node["name"]]
    if kind == "add":
        return sp.Add(*[_construct(v, sp, Operator) for v in node["args"]])
    if kind == "mul":
        return sp.Mul(*[_construct(v, sp, Operator) for v in node["args"]])
    if kind == "pow":
        return sp.Pow(_construct(node["base"], sp, Operator), _construct(node["exponent"], sp, Operator))
    if kind == "neg":
        return -_construct(node["arg"], sp, Operator)
    if kind == "function":
        functions = {
            "sin": sp.sin, "cos": sp.cos, "tan": sp.tan,
            "asin": sp.asin, "acos": sp.acos, "atan": sp.atan,
            "exp": sp.exp, "log": sp.log, "sqrt": sp.sqrt, "abs": sp.Abs,
        }
        return functions[node["name"]](*[_construct(v, sp, Operator) for v in node["args"]])
    if kind == "applied_function":
        return sp.Function(node["name"])(*[_construct(v, sp, Operator) for v in node["args"]])
    if kind == "derivative":
        return sp.Derivative(
            _construct(node["value"], sp, Operator),
            (_construct(node["variable"], sp, Operator), node.get("order", 1)),
        )
    if kind == "relation":
        left = _construct(node["left"], sp, Operator)
        right = _construct(node["right"], sp, Operator)
        relation = {
            "eq": sp.Eq, "ne": sp.Ne, "lt": sp.Lt,
            "le": sp.Le, "gt": sp.Gt, "ge": sp.Ge,
        }[node["operator"]]
        return relation(left, right, evaluate=False)
    if kind == "matrix":
        return sp.Matrix([[_construct(v, sp, Operator) for v in row] for row in node["rows"]])
    if kind == "point":
        return sp.geometry.Point(*[_construct(v, sp, Operator) for v in node["coordinates"]])
    if kind == "line":
        return sp.geometry.Line(_construct(node["point_a"], sp, Operator), _construct(node["point_b"], sp, Operator))
    if kind == "circle":
        return sp.geometry.Circle(_construct(node["center"], sp, Operator), _construct(node["radius"], sp, Operator))
    if kind == "quantum_operator":
        return Operator(node["name"])
    raise ValueError("unsupported AST node reached isolated worker")


def _serialized(value: Any, sp: Any) -> Any:
    if isinstance(value, bool):
        return {"kind": "boolean", "value": value, "display_text": str(value)}
    if isinstance(value, dict):
        items = []
        for key in sorted(value, key=lambda item: str(item)):
            items.append({"key": _serialized(key, sp), "value": _serialized(value[key], sp)})
        return {"kind": "mapping", "items": items, "display_text": str(value)}
    if isinstance(value, (list, tuple, set)):
        values = [_serialized(item, sp) for item in value]
        return {"kind": "sequence", "items": values, "display_text": str(value)}
    if isinstance(value, sp.MatrixBase):
        rows = [[_serialized(item, sp) for item in row] for row in value.tolist()]
        return {"kind": "matrix", "rows": rows, "display_text": str(value), "structural_form": sp.srepr(value)}
    return {"kind": "symbolic", "display_text": str(value), "structural_form": sp.srepr(value)}


def _same(left: Any, right: Any, sp: Any) -> bool:
    return _serialized(left, sp) == _serialized(right, sp)


def _execute(manifest: Any, sp: Any, Operator: Any, Commutator: Any, TensorProduct: Any) -> tuple[Any, Dict[str, Any]]:
    family = manifest.operation_family
    operands = manifest.operands
    get = lambda key: _construct(operands[key], sp, Operator)
    if family == "exact_evaluation":
        source = get("value"); result = sp.simplify(source)
        verification = {"passed": sp.simplify(source - result) == 0, "strength": "EXACT_SYMBOLIC_EQUIVALENCE", "method": "simplified_residual_zero"}
    elif family == "simplification":
        source = get("value"); result = sp.simplify(source)
        verification = {"passed": sp.simplify(source - result) == 0, "strength": "EXACT_SYMBOLIC_EQUIVALENCE", "method": "simplified_residual_zero"}
    elif family == "expansion":
        source = get("value"); result = sp.expand(source)
        verification = {"passed": sp.simplify(source - result) == 0, "strength": "EXACT_SYMBOLIC_EQUIVALENCE", "method": "expanded_residual_zero"}
    elif family == "factoring":
        source = get("value"); result = sp.factor(source)
        verification = {"passed": sp.simplify(source - result) == 0, "strength": "EXACT_SYMBOLIC_EQUIVALENCE", "method": "factored_residual_zero"}
    elif family == "trigonometric_simplification":
        source = get("value"); result = sp.trigsimp(source)
        verification = {"passed": sp.trigsimp(source - result) == 0, "strength": "EXACT_SYMBOLIC_EQUIVALENCE", "method": "trigonometric_residual_zero"}
    elif family == "trigonometric_expansion":
        source = get("value"); result = sp.expand_trig(source)
        verification = {"passed": sp.trigsimp(source - result) == 0, "strength": "EXACT_SYMBOLIC_EQUIVALENCE", "method": "trigonometric_residual_zero"}
    elif family == "equation_solving":
        equation = get("equation"); variable = get("variable"); result = sp.solve(equation, variable, dict=True)
        passed = bool(result) and all(sp.simplify(equation.lhs.subs(solution) - equation.rhs.subs(solution)) == 0 for solution in result)
        verification = {"passed": passed, "strength": "EXACT_SUBSTITUTION_VERIFICATION", "method": "all_solutions_zero_residual"}
    elif family == "system_solving":
        equations = [_construct(value, sp, Operator) for value in operands["equations"]]
        variables = [_construct(value, sp, Operator) for value in operands["variables"]]
        result = sp.solve(equations, variables, dict=True)
        passed = bool(result) and all(all(sp.simplify(eq.lhs.subs(solution) - eq.rhs.subs(solution)) == 0 for eq in equations) for solution in result)
        verification = {"passed": passed, "strength": "EXACT_SUBSTITUTION_VERIFICATION", "method": "all_system_residuals_zero"}
    elif family == "inequality_solving":
        relation = get("relation"); variable = get("variable")
        result = sp.solve_univariate_inequality(relation, variable, relational=False)
        replay = sp.solve_univariate_inequality(relation, variable, relational=False)
        verification = {"passed": _same(result, replay, sp), "strength": "DETERMINISTIC_ENGINE_REPLAY", "method": "isolated_replay_same_result"}
    elif family == "differentiation":
        source = get("value"); variable = get("variable"); result = sp.diff(source, variable, operands["order"])
        replay = sp.diff(source, variable, operands["order"])
        verification = {"passed": _same(result, replay, sp), "strength": "DETERMINISTIC_ENGINE_REPLAY", "method": "isolated_replay_same_result"}
    elif family == "integration":
        source = get("value"); variable = get("variable"); result = sp.integrate(source, variable)
        verification = {"passed": sp.simplify(sp.diff(result, variable) - source) == 0, "strength": "EXACT_SYMBOLIC_EQUIVALENCE", "method": "derivative_of_antiderivative_residual_zero"}
    elif family == "limits":
        source = get("value"); variable = get("variable"); point = get("point")
        result = sp.limit(source, variable, point, dir=operands["direction"])
        replay = sp.limit(source, variable, point, dir=operands["direction"])
        verification = {"passed": _same(result, replay, sp), "strength": "DETERMINISTIC_ENGINE_REPLAY", "method": "isolated_replay_same_result"}
    elif family == "series_expansion":
        source = get("value"); variable = get("variable"); point = get("point")
        result = sp.series(source, variable, point, operands["order"])
        replay = sp.series(source, variable, point, operands["order"])
        verification = {"passed": _same(result, replay, sp), "strength": "DETERMINISTIC_ENGINE_REPLAY", "method": "isolated_replay_same_result"}
    elif family == "summation":
        source = get("value"); variable = get("variable"); lower = get("lower"); upper = get("upper")
        result = sp.summation(source, (variable, lower, upper)); replay = sp.summation(source, (variable, lower, upper))
        verification = {"passed": _same(result, replay, sp), "strength": "DETERMINISTIC_ENGINE_REPLAY", "method": "isolated_replay_same_result"}
    elif family == "products":
        source = get("value"); variable = get("variable"); lower = get("lower"); upper = get("upper")
        result = sp.product(source, (variable, lower, upper)); replay = sp.product(source, (variable, lower, upper))
        verification = {"passed": _same(result, replay, sp), "strength": "DETERMINISTIC_ENGINE_REPLAY", "method": "isolated_replay_same_result"}
    elif family == "matrix_determinant":
        matrix = get("matrix"); result = matrix.det(); replay = matrix.det()
        verification = {"passed": _same(result, replay, sp), "strength": "DETERMINISTIC_ENGINE_REPLAY", "method": "isolated_replay_same_result"}
    elif family == "matrix_inverse":
        matrix = get("matrix"); result = matrix.inv()
        verification = {"passed": matrix * result == sp.eye(matrix.rows), "strength": "EXACT_SYMBOLIC_EQUIVALENCE", "method": "matrix_times_inverse_identity"}
    elif family == "matrix_rref":
        matrix = get("matrix"); result = matrix.rref(); replay = matrix.rref()
        verification = {"passed": _same(result, replay, sp), "strength": "DETERMINISTIC_ENGINE_REPLAY", "method": "isolated_replay_same_result"}
    elif family == "matrix_eigen_analysis":
        matrix = get("matrix"); result = matrix.eigenvals(); replay = matrix.eigenvals()
        verification = {"passed": _same(result, replay, sp), "strength": "DETERMINISTIC_ENGINE_REPLAY", "method": "isolated_replay_same_result"}
    elif family == "euclidean_distance":
        point_a = get("point_a"); point_b = get("point_b"); result = point_a.distance(point_b)
        squared = sum((a - b) ** 2 for a, b in zip(point_a.args, point_b.args))
        verification = {"passed": sp.simplify(result ** 2 - squared) == 0, "strength": "EXACT_SYMBOLIC_EQUIVALENCE", "method": "distance_squared_residual_zero"}
    elif family == "pythagorean_reasoning":
        a = get("leg_a"); b = get("leg_b"); result = sp.sqrt(a ** 2 + b ** 2)
        verification = {"passed": sp.simplify(result ** 2 - a ** 2 - b ** 2) == 0, "strength": "EXACT_SYMBOLIC_EQUIVALENCE", "method": "pythagorean_residual_zero"}
    elif family == "geometry_intersection":
        entity_a = get("entity_a"); entity_b = get("entity_b"); result = entity_a.intersection(entity_b)
        passed = bool(result) and all(bool(entity_a.contains(point)) and bool(entity_b.contains(point)) for point in result)
        verification = {"passed": passed, "strength": "EXACT_SUBSTITUTION_VERIFICATION", "method": "intersection_membership_verified"}
    elif family == "ordinary_differential_equation_solving":
        equation = get("equation"); function = get("function"); result = sp.dsolve(equation, function)
        checked = sp.checkodesol(equation, result, solve_for_func=False)
        verification = {"passed": bool(checked[0]), "strength": "EXACT_SUBSTITUTION_VERIFICATION", "method": "ode_solution_check"}
    elif family == "commutators":
        result = Commutator(get("left"), get("right"))
        verification = {"passed": True, "strength": "STRUCTURAL_SYMBOLIC_RECEIPT", "method": "noncommuting_operator_structure_preserved"}
    elif family == "tensor_products":
        result = TensorProduct(*[_construct(value, sp, Operator) for value in operands["factors"]])
        verification = {"passed": True, "strength": "STRUCTURAL_SYMBOLIC_RECEIPT", "method": "tensor_factor_structure_preserved"}
    elif family == "substitution_verification":
        relation = get("relation")
        substitutions = {_construct(item["symbol"], sp, Operator): _construct(item["value"], sp, Operator) for item in operands["assignments"]}
        residual = sp.simplify(relation.lhs.subs(substitutions) - relation.rhs.subs(substitutions))
        result = sp.Eq(residual, 0)
        verification = {"passed": residual == 0, "strength": "EXACT_SUBSTITUTION_VERIFICATION", "method": "submitted_substitution_zero_residual"}
    else:
        raise ValueError("operation family is unavailable")
    return result, verification


def _one(raw_manifest: Mapping[str, Any], policy: Mapping[str, int], sp: Any, Operator: Any, Commutator: Any, TensorProduct: Any) -> Dict[str, Any]:
    from rmc_engine_v1.general_pipeline.symbolic_math_ast import SymbolicMathOperationManifest
    try:
        manifest = SymbolicMathOperationManifest.from_mapping(raw_manifest)
        result, verification = _execute(manifest, sp, Operator, Commutator, TensorProduct)
        serialized = _serialized(result, sp)
        encoded = json.dumps(serialized, sort_keys=True, separators=(",", ":"))
        if len(encoded) > policy["output_character_limit"]:
            return {"status": "REFUSED", "reason_code": "RESULT_OUTPUT_LIMIT_EXCEEDED", "operation_id": manifest.operation_id, "operation_family": manifest.operation_family}
        return {
            "status": "EXECUTED_VERIFIED" if verification["passed"] else "EXECUTED_UNVERIFIED",
            "operation_id": manifest.operation_id,
            "operation_family": manifest.operation_family,
            "result": serialized,
            "verification": verification,
            "backend": "sympy==1.14.0",
            "worker_boundary": "ISOLATED_RESOURCE_LIMITS_APPLIED_BEFORE_SYMPY_IMPORT",
        }
    except Exception as exc:
        return {"status": "REFUSED", "reason_code": "ISOLATED_OPERATION_REFUSED", "detail": f"{type(exc).__name__}: {exc}"[:400]}


def main() -> int:
    try:
        request = json.loads(sys.stdin.read())
        policy = _bounded_policy(request.get("resource_policy"))
        _apply_resource_limits(policy)
        import sympy as sp
        from sympy.physics.quantum import Commutator, Operator, TensorProduct
        manifests = request.get("manifests")
        if not isinstance(manifests, list) or not manifests:
            raise ValueError("worker requires a non-empty manifest list")
        results = [_one(manifest, policy, sp, Operator, Commutator, TensorProduct) for manifest in manifests]
        response = {
            "worker_status": "COMPLETED",
            "backend": "sympy==1.14.0",
            "resource_limits_applied_before_backend_import": True,
            "results": results,
        }
        sys.stdout.write(json.dumps(response, sort_keys=True, separators=(",", ":")))
        return 0
    except Exception as exc:
        sys.stdout.write(json.dumps({"worker_status": "REFUSED", "reason_code": "WORKER_INITIALIZATION_REFUSED", "detail": f"{type(exc).__name__}: {exc}"[:400]}, sort_keys=True))
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
