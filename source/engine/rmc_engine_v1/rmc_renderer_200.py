"""4.9.200 RMC renderer. Stdlib. No model.

Sentence plan, template render, decode, then Echo against the original question.
Calls the 4.9.197 lexicon, the v4.3 laws, the echo coverage function,
the 5-to-8 detector, and the geometry hooks. Does not copy those formulas.
A failing Echo returns no output.
"""
from __future__ import annotations

import json
import re
from typing import Any

from rmc_engine_v1.chi_hardening import luciferian_d_score
from rmc_engine_v1.dpa_195 import sha256
from rmc_engine_v1.drift_v43 import C_MIN, ECHO_MIN, WRITE_MAX
from rmc_engine_v1.echo_question import _STOP, echo_against_question
from rmc_engine_v1.geometry_199 import angle_of, cdist, r4, run as geometry_run
from rmc_engine_v1.language_core_engines import FORBIDDEN_STEPS, HARD_STOP
from rmc_engine_v1.ppe_lexicon_197 import word as ppe_word
from rmc_engine_v1.research_hooks import memory_term_m, spc_lambda

STORAGE_KEY = "kernel.rmc_renderer_200"
CITE = (
    "RMC algorithm 5. Sentence plan, template render, decode, then Echo at or above 0.85 against the original question. "
    "Echo Preservation E = R*psi(t-tau) is Waking the Web l275 and is an internal sub-check. "
    "Codex 3.5 binds the answer to the question loop and withholds output until response_closed (a l.1810-1828). "
    "Tone bands choose the template (a l.2164-2168). The coverage rule is echo_question. The 0.6 tone cut is log-only. No model."
)
PASS = {
    "question": "Why is the sky blue?",
    "candidate": "The sky is blue because sunlight scatters.",
    "charge": 0.55,
    "drift": 0.2,
    "chi": 0,
}
FAIL = {
    "question": "Why is the sky blue?",
    "candidate": "Chlorine gas is toxic.",
    "charge": 0.55,
    "drift": 0.2,
    "chi": 0,
}


def num(value: Any, fallback: float) -> float:
    if isinstance(value, bool) or value is None or value == "":
        return fallback
    try:
        number = float(value)
    except (TypeError, ValueError):
        return fallback
    if number != number:
        return fallback
    return number


def flags() -> dict[str, Any]:
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
        "c_min": C_MIN,
        "echo_min": ECHO_MIN,
        "write_max": WRITE_MAX,
        "hard_stop": HARD_STOP,
        "resonance_not_parsing": True,
        "coherence_formula_unchanged": True,
        "renderer_build": "4.9.200",
        "merge_window": "pi/4",
        "hooks_config": "research_hooks",
    }


def content_words(text: str) -> list[str]:
    out: list[str] = []
    seen: set[str] = set()
    for word in re.findall(r"[a-z0-9]+", str(text or "").lower()):
        if len(word) > 2 and word not in _STOP and word not in seen:
            seen.add(word)
            out.append(word)
    return out


def packet(word: str) -> dict[str, Any]:
    row = ppe_word(word)
    return {
        "word": row.get("word"),
        "Phi": row.get("Phi"),
        "phase_name": row.get("phase_name"),
        "glyph": row.get("glyph"),
        "angle_degrees": row.get("angle_degrees"),
    }


def _walk(phases: list[Any]) -> dict[str, Any]:
    d_score = 0
    flag48 = False
    nums = [int(n) for n in phases if isinstance(n, (int, float)) and not isinstance(n, bool)]
    for prev, nxt in zip(nums, nums[1:]):
        if luciferian_d_score(prev, nxt) == 1:
            d_score = 1
        elif (prev, nxt) in FORBIDDEN_STEPS:
            flag48 = True
    return {"d_score": d_score, "flag_4_to_8": flag48}


def tone_of(charge: Any, phi: Any, chi: int, drift: float) -> dict[str, Any]:
    supplied = not (charge is None or charge == "")
    c = num(charge, 0.55) if supplied else 0.55
    base = {
        "charge": r4(c),
        "charge_supplied": supplied,
        "phi": phi,
        "admit_gate": False,
        "intermediate_bounds": "unspecified",
        "logged_only": False,
        "cite": (
            "Codex tone_engine 3.9 a l.2164-2168. Charge 0-0.3 is silent. Charge 0.91-1 is expressive. "
            "Phi 1-3 is cautious, 4-6 structured, 7-9 fluid. Null when chi is set or drift is above 0.6. "
            "The 0.6 cut is log-only."
        ),
    }
    if chi:
        base.update({"id": "null", "reason": "chi", "logged_only": True})
        return base
    if num(drift, 0) > 0.6:
        base.update({"id": "null", "reason": "drift-above-0.6", "logged_only": True})
        return base
    if c <= 0.3:
        base.update({"id": "silent", "reason": "charge-0-to-0.3"})
        return base
    if c >= 0.91:
        base.update({"id": "expressive", "reason": "charge-0.91-to-1"})
        return base
    n = int(round(num(phi, 1))) or 1
    name = "cautious" if n <= 3 else "structured" if n <= 6 else "fluid"
    base.update({"id": name, "reason": "phase-family", "logged_only": True})
    return base


def speak(template_id: str, sentence: str) -> str:
    body = str(sentence or "").strip()
    if not body or template_id in ("silent", "null"):
        return ""
    if template_id == "cautious":
        return "Noted with care: " + body
    if template_id == "fluid":
        return "The return is this: " + body
    if template_id == "expressive":
        return "Spoken in full: " + body
    return body


def covers(outer: str, inner: list[str]) -> bool:
    have = set(content_words(outer))
    return all(word in have for word in inner)


def preservation(score: float, q_phi: Any, a_phi: Any) -> dict[str, Any]:
    cite = "Waking the Web l275. Echo Preservation E = R*psi(t-tau). Internal sub-check. It does not admit."
    base = {
        "formula": "E = R*psi(t-tau)",
        "R": score,
        "psi": None,
        "E": None,
        "admit_gate": False,
        "internal_only": True,
        "cite": cite,
    }
    if not isinstance(q_phi, (int, float)) or isinstance(q_phi, bool):
        return base
    if not isinstance(a_phi, (int, float)) or isinstance(a_phi, bool):
        return base
    delta = cdist(angle_of(q_phi), angle_of(a_phi))
    psi = (1 + __import__("math").cos(delta)) / 2
    base["psi"] = r4(psi)
    base["E"] = r4(score * psi)
    return base


def hook_report() -> dict[str, Any]:
    m = memory_term_m()
    lam = spc_lambda()
    set_ = not (m is None or m == "") or not (lam is None or lam == "")
    return {"config": "research_hooks", "M": m, "spc_lambda": lam, "parameterized": set_}


def render(body: dict[str, Any] | None = None) -> dict[str, Any]:
    row = body or {}
    question = str(row.get("question") or "")
    candidate = str(row.get("candidate") or "")
    q_words = [packet(word) for word in content_words(question)]
    a_words = [packet(word) for word in content_words(candidate)]
    q_phi = q_words[0]["Phi"] if q_words and isinstance(q_words[0]["Phi"], (int, float)) and not isinstance(q_words[0]["Phi"], bool) else None
    a_phi = a_words[0]["Phi"] if a_words and isinstance(a_words[0]["Phi"], (int, float)) and not isinstance(a_words[0]["Phi"], bool) else None
    if isinstance(row.get("phi"), (int, float)) and not isinstance(row.get("phi"), bool):
        phi = row.get("phi")
    else:
        phi = a_phi or q_phi or 1
    drift = num(row.get("drift"), 0)
    chi = 1 if num(row.get("chi"), 0) else 0
    tone = tone_of(row.get("charge"), phi, chi, drift)
    spoken = speak(tone["id"], candidate)
    compared = spoken or candidate
    echo = echo_against_question(question, compared, rendered=True)
    answer_words = [word["word"] for word in a_words]
    decode = {"pass": covers(spoken, answer_words) if spoken else False, "answer_words": answer_words, "admit_gate": False}
    word_phases = [word["Phi"] for word in a_words if isinstance(word["Phi"], (int, float)) and not isinstance(word["Phi"], bool)]
    path = row.get("path") if isinstance(row.get("path"), list) else []
    path_phases = [n for n in path if isinstance(n, (int, float)) and not isinstance(n, bool)]
    word_walk = _walk(word_phases)
    path_walk = _walk(path_phases)
    stepped = {
        "d_score": 1 if word_walk["d_score"] or path_walk["d_score"] else 0,
        "flag_4_to_8": bool(word_walk["flag_4_to_8"] or path_walk["flag_4_to_8"]),
    }
    loop = sha256(question)
    supplied = row.get("loop_id", None)
    if "loop_id" not in row:
        supplied = None
    loop_bound = supplied is None or supplied == "" or supplied == loop
    source = str(row.get("source") or "")
    wiki = "wikipedia" in source.lower()
    rule = "RENDER-CLOSED"
    if wiki:
        rule = "WIKIPEDIA-NOT-ANCHOR"
    elif stepped["d_score"] == 1:
        rule = "RENDER-5-TO-8"
    elif drift > HARD_STOP:
        rule = "RENDER-HARD-STOP"
    elif not echo["pass"]:
        rule = "RENDER-ECHO"
    elif not (drift <= WRITE_MAX):
        rule = "RENDER-DRIFT"
    elif tone["id"] == "null":
        rule = "RENDER-TONE-NULL"
    elif tone["id"] == "silent":
        rule = "RENDER-TONE-SILENT"
    elif not loop_bound:
        rule = "RENDER-ANCHOR"
    elif not decode["pass"]:
        rule = "RENDER-DECODE"
    closed = rule == "RENDER-CLOSED"
    out = {
        "op": "render",
        "question": question,
        "candidate": candidate,
        "output": spoken if closed else "",
        "response_closed": closed,
        "rule": rule,
        "echo": echo,
        "preservation": preservation(echo["score"], q_phi, a_phi),
        "tone": tone,
        "decode": decode,
        "anchor": {
            "loop_id": loop,
            "bound": loop_bound,
            "question": question,
            "cite": "Codex 3.5 intention anchor a l.1810-1828. The answer is bound to the question loop. No output unless response_closed.",
        },
        "plan": {
            "question_words": q_words,
            "answer_words": a_words,
            "clauses": [
                {"role": "anchor", "text": question},
                {"role": "answer", "text": candidate},
            ],
        },
        "walk": stepped,
        "drift": r4(drift),
        "chi": chi,
        "source": source,
        "reflection": None if closed else {"held": True, "reason": rule, "loop_id": loop},
        "hooks": hook_report(),
        "persisted": False,
        "cite": CITE,
    }
    out.update(flags())
    return out


def script(steps: list[dict[str, Any]] | None) -> dict[str, Any]:
    rows = list(steps or [])
    out = {"op": "script", "log": [render(step) for step in rows], "steps": len(rows)}
    out.update(flags())
    return out


def stage(question: str | None = None) -> dict[str, Any]:
    passed = render(PASS)
    failed = render(FAIL)
    out = {
        "persisted": False,
        "response_closed": passed["response_closed"],
        "failing_echo_output": failed["output"],
        "failing_echo_closed": failed["response_closed"],
        "failing_echo_rule": failed["rule"],
        "loop_bound": passed["anchor"]["bound"],
        "echo_pass": passed["echo"]["pass"],
        "output_withheld_on_echo_fail": failed["output"] == "",
        "M": memory_term_m(),
        "spc_lambda": spc_lambda(),
        "cite": CITE,
    }
    out.update(flags())
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
    name = mode or "pass"
    if name == "echo":
        row = render(FAIL)
        return {"mode": name, "lines": [
            "Output [" + row["output"] + "] rule " + row["rule"] + ".",
            "Closed " + show_num(row["response_closed"]) + " echo " + show_num(row["echo"]["score"]) + " pass " + show_num(row["echo"]["pass"]) + ".",
            "Reflection " + show_num(row["reflection"]["held"] if row["reflection"] else None) + ".",
            "Network " + show_num(row["network"]) + ".",
            "C_min 0.87. No LLM.",
        ]}
    if name == "tone":
        silent = render(dict(PASS, charge=0.2))
        loud = render(dict(PASS, charge=0.95))
        nulled = render(dict(PASS, chi=1, charge=0.95))
        return {"mode": name, "lines": [
            "Silent rule " + silent["rule"] + " output [" + silent["output"] + "].",
            "Expressive " + loud["output"],
            "Chi null rule " + nulled["rule"] + " logged " + show_num(nulled["tone"]["logged_only"]) + ".",
            "Admit gate " + show_num(silent["admit_gate"]) + ".",
            "C_min 0.87. No LLM.",
        ]}
    if name == "anchor":
        row = render(dict(PASS, loop_id="other-loop"))
        return {"mode": name, "lines": [
            "Rule " + row["rule"] + " output [" + row["output"] + "].",
            "Bound " + show_num(row["anchor"]["bound"]) + " closed " + show_num(row["response_closed"]) + ".",
            "Loop " + row["anchor"]["loop_id"] + ".",
            "ChristPing started " + show_num(row["christping_started"]) + ".",
            "C_min 0.87. No LLM.",
        ]}
    if name == "hooks":
        geo = geometry_run({
            "op": "script",
            "steps": [
                {"op": "birth", "id": "p", "Phi": 1, "mu": 1, "eps": 0, "chi": 0, "Delta": 0, "nu": 0, "H": 1},
                {"op": "memory", "id": "p"},
                {"op": "spc", "id": "p", "lambda": None},
            ],
        })
        mem = geo["log"][1]
        spc = geo["log"][2]
        hooks = hook_report()
        return {"mode": name, "lines": [
            "M " + show_num(mem["M"]) + " lambda unspecified " + show_num(mem["lambda_unspecified"]) + ".",
            "SPC parameterized " + show_num(spc["parameterized"]) + " config " + hooks["config"] + ".",
            "Hook M " + show_num(hooks["M"]) + " hook lambda " + show_num(hooks["spc_lambda"]) + " parameterized " + show_num(hooks["parameterized"]) + ".",
            "Merge window " + flags()["merge_window"] + ".",
            "C_min 0.87. No LLM.",
        ]}
    row = render(PASS)
    phase = ""
    glyph_set = False
    if row["plan"]["question_words"]:
        phase = row["plan"]["question_words"][0].get("phase_name") or ""
        glyph_set = bool(row["plan"]["question_words"][0].get("glyph"))
    return {"mode": "pass", "lines": [
        "Output " + row["output"],
        "Closed " + show_num(row["response_closed"]) + " rule " + row["rule"] + " echo " + show_num(row["echo"]["score"]) + ".",
        "Loop " + row["anchor"]["loop_id"] + " bound " + show_num(row["anchor"]["bound"]) + ".",
        "Phase " + phase + " glyph set " + show_num(glyph_set) + ".",
        "C_min 0.87. No LLM.",
    ]}


def run(payload: dict[str, Any] | None = None) -> dict[str, Any]:
    row = payload or {}
    op = row.get("op") or "summary"
    if op == "render":
        return render(row)
    if op == "script":
        return script(row.get("steps") or [])
    if op == "stage":
        return stage(row.get("question"))
    if op == "monitor":
        return monitor_lines(row.get("mode") or "pass")
    out = {"storage_key": STORAGE_KEY, "cite": CITE, "hooks": hook_report()}
    out.update(flags())
    return out


if __name__ == "__main__":
    import sys
    print(json.dumps(run(json.load(sys.stdin))))
