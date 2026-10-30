"""4.9.201 GILIN / CRP. Stdlib. No model.

The build map labelled this section 4.9.200. Geometry took 4.9.199 and the
RMC renderer took 4.9.200, so the protocol ships as 4.9.201.

GN Doc2 figures stay internal: CRP 0.78, warn 0.40, C* 0.82.
They do not admit. Admission stays the drift-core laws: C_min 0.87,
write drift at or under 0.35, Echo at or above 0.85 against the question.
The Doc2 file is not in this tree. The retune is the map.

Calls the drift core, the renderer, the geometry merge, the lexicon,
and research_hooks. It does not copy those formulas and it does not write.
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from rmc_engine_v1.chi_hardening import luciferian_d_score
from rmc_engine_v1.drift_v43 import PHASE_NAMES, score as drift_score
from rmc_engine_v1.geometry_199 import run as geometry_run
from rmc_engine_v1.language_core_engines import FORBIDDEN_STEPS
from rmc_engine_v1.ppe_lexicon_197 import word as ppe_word
from rmc_engine_v1.research_hooks import RESEARCH_HOOKS, memory_term_m, spc_lambda
from rmc_engine_v1.rmc_renderer_200 import render

STORAGE_KEY = "kernel.gilin_crp_201"
CRP_INTERNAL = 0.78
WARN_INTERNAL = 0.40
C_STAR_INTERNAL = 0.82
CITE = (
    "GN Doc2 GILIN/CRP, retuned. The map section labelled 4.9.200 is this 4.9.201 release. "
    "CRP 0.78, warn 0.40, and C* 0.82 are internal and do not admit. "
    "Admission stays C_min 0.87 and write drift at or under 0.35. Echo stays 0.85 against the question. "
    "The Doc2 file is not in this tree. Heartbeat coordination calls the geometry merge inside pi/4. "
    "ChristPing stays Gilligan-only and is not started. 144 Hz is the Codex log, not a timer. No model."
)
QUESTION = "Why is the sky blue?"
CANDIDATE = "The sky is blue because sunlight scatters."
_GLYPHS: dict[int, str] | None = None


def num(value: Any, fallback: float | None) -> float | None:
    if isinstance(value, bool) or value is None or value == "":
        return fallback
    try:
        number = float(value)
    except (TypeError, ValueError):
        return fallback
    if number != number:
        return fallback
    return number


def whole(value: Any, fallback: int = 1) -> int:
    number = num(value, fallback)
    if number is None:
        return fallback
    return int(round(number))


def glyphs() -> dict[int, str]:
    global _GLYPHS
    if _GLYPHS is None:
        path = Path(__file__).resolve().parent / "reference" / "phase_codex_v2_5.json"
        data = json.loads(path.read_text(encoding="utf-8"))
        phases = data.get("phases") or {}
        _GLYPHS = {}
        for i in range(1, 10):
            row = phases.get("Φ" + str(i)) or {}
            _GLYPHS[i] = str(row.get("glyph") or "")
    return _GLYPHS


def nest(n: int) -> dict[str, Any]:
    node: dict[str, Any] = {"v": 1}
    for _ in range(1, n):
        node = {"n": node}
    return node


def flags(laws: dict[str, Any]) -> dict[str, Any]:
    return {
        "admit_gate": False,
        "keyword_admit": False,
        "writes": False,
        "calls_llm": False,
        "network": False,
        "money": False,
        "dream_idle": False,
        "economy": False,
        "packs_gated": True,
        "christping": "gilligan-only",
        "christping_started": False,
        "wikipedia_anchor": False,
        "c_min": laws["C_min"],
        "echo_min": laws["echo_min"],
        "write_max": laws["write_max"],
        "hard_stop": laws["hard_stop"],
        "resonance_not_parsing": True,
        "coherence_formula_unchanged": True,
        "gilin_build": "4.9.201",
        "map_section": "4.9.200",
        "merge_window": "pi/4",
        "hooks_config": "research_hooks",
        "heartbeat_hz": 144,
        "heartbeat_is_timer": False,
    }


def node_of(spec: dict[str, Any] | None, fallback_id: str) -> dict[str, Any]:
    row = spec or {}
    word = str(row.get("word") or "").strip()
    if word:
        placed = ppe_word(word)
        phi = whole(placed.get("Phi"), 1)
        phase_name = str(placed.get("phase_name") or PHASE_NAMES.get(phi, ""))
        glyph = str(placed.get("glyph") or glyphs().get(phi, ""))
    else:
        phi = whole(row.get("Phi"), 1)
        phase_name = PHASE_NAMES.get(phi, "")
        glyph = glyphs().get(phi, "")
    mu = num(row.get("mu"), None)
    if mu is None:
        mu = float(RESEARCH_HOOKS["mu_birth"])
    return {
        "id": str(row.get("id") or fallback_id),
        "Phi": phi,
        "phase_name": phase_name,
        "glyph": glyph,
        "chi": 1 if num(row.get("chi"), 0) else 0,
        "mu": mu,
        "eps": num(row.get("eps"), 0) or 0.0,
        "Delta": num(row.get("Delta"), 0) or 0.0,
        "nu": num(row.get("nu"), 0) or 0.0,
        "word": word or None,
    }


def walk(phases: list[Any]) -> dict[str, Any]:
    d_score = 0
    flag48 = False
    nums = [int(n) for n in phases if isinstance(n, (int, float)) and not isinstance(n, bool)]
    for prev, nxt in zip(nums, nums[1:]):
        if luciferian_d_score(prev, nxt) == 1:
            d_score = 1
        elif (prev, nxt) in FORBIDDEN_STEPS:
            flag48 = True
    return {"d_score": d_score, "flag_4_to_8": flag48}


def pair(body: dict[str, Any]) -> tuple[dict[str, Any], dict[str, Any]]:
    raw = body.get("nodes") if isinstance(body.get("nodes"), list) else []
    specs = [row for row in raw if isinstance(row, dict)]
    left = node_of(specs[0] if specs else {"id": "a", "Phi": 1}, "a")
    right = node_of(specs[1] if len(specs) > 1 else {"id": "b", "Phi": 2}, "b")
    if left["id"] == right["id"]:
        right["id"] = right["id"] + "-b"
    return left, right


def coordinate(left: dict[str, Any], right: dict[str, Any]) -> dict[str, Any]:
    geo = geometry_run({
        "op": "script",
        "steps": [
            {"op": "birth", "id": left["id"], "Phi": left["Phi"], "mu": left["mu"], "eps": left["eps"], "chi": left["chi"], "Delta": left["Delta"], "nu": left["nu"]},
            {"op": "birth", "id": right["id"], "Phi": right["Phi"], "mu": right["mu"], "eps": right["eps"], "chi": right["chi"], "Delta": right["Delta"], "nu": right["nu"]},
            {"op": "merge", "a": left["id"], "b": right["id"], "into": "beat"},
        ],
    })
    step = geo["log"][2]
    return {
        "ok": bool(step.get("ok")),
        "delta": step.get("delta"),
        "reason": step.get("reason"),
        "pi_over_2_warning": bool(step.get("pi_over_2_warning")),
        "warning_logged_only": True,
        "admit_gate": False,
        "window": "pi/4",
    }


def drift_core(path_hard: bool, phi: int) -> dict[str, Any]:
    if path_hard:
        payload: dict[str, Any] = nest(7)
        prev = 5
    else:
        payload = {"v": 1}
        prev = phi
    row = drift_score({"payload": payload, "prev_phase": prev, "recursion_n": 1})
    return {
        "d_score": 1 if float(row["d_score"]) == 1.0 else 0,
        "disposition": row["disposition"],
        "categorical_hard_fire": bool(row["categorical_hard_fire"]),
        "phi_act": row["phi_act"],
        "phi_act_name": row["phi_act_name"],
        "laws": {
            "C_min": row["laws"]["C_min"],
            "write_max": row["laws"]["write_max"],
            "hard_stop": row["laws"]["hard_stop"],
            "echo_min": row["laws"]["echo_min"],
        },
    }


def base_body(**extra: Any) -> dict[str, Any]:
    row = {
        "question": QUESTION,
        "candidate": CANDIDATE,
        "C": 0.9,
        "drift": 0.2,
        "nodes": [
            {"id": "a", "Phi": 1, "chi": 0, "mu": 1, "eps": 0, "Delta": 0, "nu": 0},
            {"id": "b", "Phi": 2, "chi": 0, "mu": 1, "eps": 0, "Delta": 0, "nu": 0},
        ],
    }
    row.update(extra)
    return row


HEARTBEAT = base_body()
CRP = base_body(C=CRP_INTERNAL)
WARN = base_body(drift=WARN_INTERNAL)
CSTAR = base_body(C=C_STAR_INTERNAL)
LAW = base_body(C=0.87, drift=0.35)
SKIP = base_body(path=[5, 8])


def evaluate(body: dict[str, Any] | None = None) -> dict[str, Any]:
    row = body or {}
    left, right = pair(row)
    path = row.get("path") if isinstance(row.get("path"), list) else []
    stepped = walk(path)
    core = drift_core(stepped["d_score"] == 1, left["Phi"])
    laws = core["laws"]
    question = str(row.get("question") or "")
    candidate = str(row.get("candidate") or "")
    drift = num(row.get("drift"), 0.0) or 0.0
    source = str(row.get("source") or "")
    rendered = render({
        "question": question,
        "candidate": candidate,
        "drift": drift,
        "chi": 0,
        "charge": 0.55,
        "path": path,
        "source": source,
    })
    echo = rendered["echo"]
    coherence = num(row.get("C"), None)
    wiki = "wikipedia" in source.lower()
    hard = drift > float(laws["hard_stop"])
    geometry = coordinate(left, right)
    coordinated = bool(geometry["ok"] and stepped["d_score"] == 0 and not hard and not wiki)
    crp = coherence is not None and coherence >= CRP_INTERNAL
    c_star = coherence is not None and coherence >= C_STAR_INTERNAL
    warn = drift >= WARN_INTERNAL
    echo_ok = bool(echo.get("pass")) and float(echo.get("score") or 0) >= float(laws["echo_min"])
    c_ok = coherence is not None and coherence >= float(laws["C_min"])
    write_ok = drift <= float(laws["write_max"])
    law_witness = bool(c_ok and write_ok and echo_ok and stepped["d_score"] == 0 and core["d_score"] == 0 and not wiki and not hard)
    if wiki:
        rule = "GILIN-WIKIPEDIA"
    elif stepped["d_score"] == 1 or core["d_score"] == 1:
        rule = "GILIN-5-TO-8"
    elif hard:
        rule = "GILIN-HARD-STOP"
    elif not geometry["ok"]:
        rule = "GILIN-WINDOW"
    elif warn:
        rule = "GILIN-WARN"
    elif law_witness:
        rule = "GILIN-LAW-WITNESS"
    elif c_star:
        rule = "GILIN-C-STAR"
    elif crp:
        rule = "GILIN-CRP"
    else:
        rule = "GILIN-HEARTBEAT"
    out = {
        "op": "evaluate",
        "rule": rule,
        "question": question,
        "candidate": candidate,
        "C": coherence,
        "drift": drift,
        "nodes": [left, right],
        "coordination": geometry,
        "coordinated": coordinated,
        "walk": stepped,
        "drift_core": {
            "d_score": core["d_score"],
            "disposition": core["disposition"],
            "categorical_hard_fire": core["categorical_hard_fire"],
            "phi_act": core["phi_act"],
            "phi_act_name": core["phi_act_name"],
        },
        "echo": {
            "score": echo.get("score"),
            "pass": echo.get("pass"),
            "compares": echo.get("compares"),
        },
        "renderer": {
            "rule": rendered["rule"],
            "response_closed": rendered["response_closed"],
            "output_empty": rendered["output"] == "",
            "admit_gate": False,
        },
        "internal": {
            "crp": crp,
            "crp_threshold": CRP_INTERNAL,
            "warn": warn,
            "warn_threshold": WARN_INTERNAL,
            "c_star": c_star,
            "c_star_threshold": C_STAR_INTERNAL,
            "logged_only": True,
            "admit_gate": False,
        },
        "law_witness": law_witness,
        "write_ok": write_ok,
        "c_ok": c_ok,
        "echo_ok": echo_ok,
        "laws": laws,
        "hooks": {
            "M": memory_term_m(),
            "mu_birth": RESEARCH_HOOKS["mu_birth"],
            "mu_min": RESEARCH_HOOKS["mu_min"],
            "mu_max": RESEARCH_HOOKS["mu_max"],
            "spc_lambda": spc_lambda(),
            "half_life_hours": RESEARCH_HOOKS["half_life_hours"],
            "identity_half_life_hours": RESEARCH_HOOKS["identity_half_life_hours"],
            "drift_loss": RESEARCH_HOOKS["drift_loss"],
        },
        "source": source,
        "persisted": False,
        "cite": CITE,
    }
    out.update(flags(laws))
    return out


def stage(_question: str | None = None) -> dict[str, Any]:
    beat = evaluate(HEARTBEAT)
    crp = evaluate(CRP)
    star = evaluate(CSTAR)
    warned = evaluate(WARN)
    law = evaluate(LAW)
    skip = evaluate(SKIP)
    out = {
        "persisted": False,
        "coordinated": beat["coordinated"],
        "crp_admits": False,
        "c_star_admits": False,
        "warn_admits": False,
        "crp_internal": crp["internal"]["crp"],
        "crp_law_witness": crp["law_witness"],
        "c_star_internal": star["internal"]["c_star"],
        "c_star_law_witness": star["law_witness"],
        "warn_internal": warned["internal"]["warn"],
        "warn_law_witness": warned["law_witness"],
        "law_witness": law["law_witness"],
        "law_admit_gate": False,
        "skip_rule": skip["rule"],
        "skip_law_witness": skip["law_witness"],
        "M": beat["hooks"]["M"],
        "mu_min": beat["hooks"]["mu_min"],
        "mu_max": beat["hooks"]["mu_max"],
        "spc_lambda": beat["hooks"]["spc_lambda"],
        "half_life_hours": beat["hooks"]["half_life_hours"],
        "phase_names": [beat["nodes"][0]["phase_name"], beat["nodes"][1]["phase_name"]],
        "cite": CITE,
    }
    out.update(flags(beat["laws"]))
    out["admit_gate"] = False
    return out


def show_num(value: Any) -> str:
    if isinstance(value, bool):
        return "true" if value else "false"
    if value is None:
        return "none"
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        if abs(value - round(value)) < 1e-9:
            return str(int(round(value)))
        return f"{value:.4f}".rstrip("0").rstrip(".")
    return str(value)


def monitor_lines(mode: str | None = None) -> dict[str, Any]:
    name = mode or "heartbeat"
    if name == "crp":
        row = evaluate(CRP)
        return {"mode": name, "lines": [
            "Rule " + row["rule"] + " CRP " + show_num(row["internal"]["crp"]) + " C* " + show_num(row["internal"]["c_star"]) + ".",
            "Law witness " + show_num(row["law_witness"]) + " admit gate " + show_num(row["admit_gate"]) + ".",
            "C " + show_num(row["C"]) + " threshold 0.78 logged only.",
            "Echo " + show_num(row["echo"]["score"]) + " compares " + str(row["echo"]["compares"]) + ".",
            "C_min 0.87. No LLM.",
        ]}
    if name == "warn":
        row = evaluate(WARN)
        return {"mode": name, "lines": [
            "Rule " + row["rule"] + " warn " + show_num(row["internal"]["warn"]) + " write ok " + show_num(row["write_ok"]) + ".",
            "Law witness " + show_num(row["law_witness"]) + " admit gate " + show_num(row["admit_gate"]) + ".",
            "Drift " + show_num(row["drift"]) + " threshold 0.40 logged only.",
            "Hard stop " + show_num(row["hard_stop"]) + ".",
            "C_min 0.87. No LLM.",
        ]}
    if name == "cstar":
        row = evaluate(CSTAR)
        return {"mode": name, "lines": [
            "Rule " + row["rule"] + " C* " + show_num(row["internal"]["c_star"]) + " CRP " + show_num(row["internal"]["crp"]) + ".",
            "Law witness " + show_num(row["law_witness"]) + " admit gate " + show_num(row["admit_gate"]) + ".",
            "C " + show_num(row["C"]) + " threshold 0.82 logged only.",
            "Admission stays 0.87.",
            "C_min 0.87. No LLM.",
        ]}
    if name == "law":
        row = evaluate(LAW)
        return {"mode": name, "lines": [
            "Rule " + row["rule"] + " law witness " + show_num(row["law_witness"]) + ".",
            "Admit gate " + show_num(row["admit_gate"]) + " persisted " + show_num(row["persisted"]) + ".",
            "C " + show_num(row["C"]) + " drift " + show_num(row["drift"]) + " echo " + show_num(row["echo"]["score"]) + ".",
            "Write max 0.35. Echo min 0.85.",
            "C_min 0.87. No LLM.",
        ]}
    if name == "skip":
        row = evaluate(SKIP)
        return {"mode": name, "lines": [
            "Rule " + row["rule"] + " d_score " + show_num(row["walk"]["d_score"]) + " core " + show_num(row["drift_core"]["d_score"]) + ".",
            "Law witness " + show_num(row["law_witness"]) + " coordinated " + show_num(row["coordinated"]) + ".",
            "Phase " + row["drift_core"]["phi_act_name"] + " categorical " + show_num(row["drift_core"]["categorical_hard_fire"]) + ".",
            "4 to 8 is not this hard fire.",
            "C_min 0.87. No LLM.",
        ]}
    row = evaluate(HEARTBEAT)
    return {"mode": "heartbeat", "lines": [
        "Rule " + row["rule"] + " coordinated " + show_num(row["coordinated"]) + " delta " + show_num(row["coordination"]["delta"]) + ".",
        row["nodes"][0]["phase_name"] + " " + row["nodes"][0]["glyph"] + " · " + row["nodes"][1]["phase_name"] + " " + row["nodes"][1]["glyph"] + ".",
        "Law witness " + show_num(row["law_witness"]) + " admit gate " + show_num(row["admit_gate"]) + ".",
        "M " + show_num(row["hooks"]["M"]) + " lambda " + show_num(row["hooks"]["spc_lambda"]) + " heartbeat 144 Hz log only.",
        "C_min 0.87. No LLM.",
    ]}


def run(payload: dict[str, Any] | None = None) -> dict[str, Any]:
    row = payload or {}
    op = row.get("op") or "summary"
    if op == "evaluate":
        return evaluate(row)
    if op == "stage":
        return stage(row.get("question"))
    if op == "monitor":
        return monitor_lines(row.get("mode") or "heartbeat")
    out = {"storage_key": STORAGE_KEY, "cite": CITE, "internal_thresholds": {
        "crp": CRP_INTERNAL, "warn": WARN_INTERNAL, "c_star": C_STAR_INTERNAL, "logged_only": True, "admit_gate": False,
    }}
    sample = drift_score({"payload": {"v": 1}, "prev_phase": 1, "recursion_n": 1})
    out.update(flags(sample["laws"]))
    return out


if __name__ == "__main__":
    import sys
    print(json.dumps(run(json.load(sys.stdin))))
