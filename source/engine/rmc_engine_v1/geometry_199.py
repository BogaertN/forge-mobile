"""4.9.199 Geometry gates. Stdlib. No LLM.

Phase 6 membrane before naming or export. Closure is total angle 2 pi n.
M and V_c are axes. RSOC operator numbers win. Unified Algebra forms are recorded.
Calls the manifest compiler phase-6 order, the v4.3 laws, and the 4.9.195 seal.
"""
from __future__ import annotations

import json
import math
from typing import Any

from rmc_engine_v1.chi_hardening import luciferian_d_score
from rmc_engine_v1.dpa_195 import empty_archive, seal_loop, verify_archive
from rmc_engine_v1.drift_v43 import C_MIN, ECHO_MIN, PHASE_NAMES, WRITE_MAX
from rmc_engine_v1.language_core_engines import FORBIDDEN_STEPS, HARD_STOP
from rmc_engine_v1.manifest_compiler import _phase6_before_naming, _phase6_before_projection
from rmc_engine_v1.dpa_195 import sha256
from rmc_engine_v1.research_hooks import RESEARCH_HOOKS, memory_term, spc_lambda

TAU = math.tau
STORAGE_KEY = "kernel.geometry_199"
CITE = (
    "Geometry gates. Phase 6 membrane before naming or export (Geometry of Mind; manifest compiler phase-6 order). "
    "Phase closure total angle 2 pi n (Waking the Web l278). M and V_c (Waking2; UA b l.4322-4389). "
    "RSOC operators l.1190-1390. UA forms are recorded and RSOC numbers win (READ_NEW_PDFS section B). "
    "Chi precedence RSOC l.1411-1510. SHA-256 stands in for BLAKE3. No LLM."
)
PRECEDENCE = ["chi", "archive", "advance", "merge", "lock", "sever", "amplify", "discharge", "memory", "echo"]


def flags() -> dict[str, Any]:
    return {
        "admit_gate": False,
        "keyword_admit": False,
        "writes": False,
        "calls_llm": False,
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
        "rsoc_numbers": True,
        "ua_applied": False,
        "coherence_formula_unchanged": True,
        "geometry_build": "4.9.199",
        "renderer_build": "4.9.200",
    }


def r4(x: float) -> float:
    return math.floor(float(x) * 10000 + 0.5) / 10000


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


def js_round(x: float) -> int:
    return int(math.floor(float(x) + 0.5))


def phase_name(phi: Any) -> str:
    n = js_round(num(phi, 0))
    return PHASE_NAMES.get(n, "")


def angle_of(phi: Any) -> float:
    return ((num(phi, 1) - 1) / 9) * TAU


def signed(a: float, b: float) -> float:
    d = (b - a) % TAU
    if d > math.pi:
        d -= TAU
    if d < -math.pi:
        d += TAU
    return d


def cdist(a: float, b: float) -> float:
    d = abs(a - b) % TAU
    return min(d, TAU - d)


def ua(op: str, form: str) -> dict[str, Any]:
    return {
        "op": op,
        "form": form,
        "cite": "UA Vol I b l.4322-4389",
        "numbers": "RSOC",
        "applied": False,
        "constants_numeric": False,
        "admit_gate": False,
    }


def birth(spec: dict[str, Any] | None) -> dict[str, Any]:
    row = spec or {}
    phi = num(row.get("Phi"), 1)
    lam = row.get("lambda")
    return {
        "Phi": phi,
        "phase_name": phase_name(phi),
        "rho": num(row.get("rho"), 0),
        "Delta": num(row.get("Delta"), 0),
        "nu": num(row.get("nu"), 0),
        "mu": num(row.get("mu"), 1),
        "eps": num(row.get("eps"), 0),
        "chi": 1 if num(row.get("chi"), 0) else 0,
        "id": str(row.get("id") or ""),
        "H": num(row.get("H"), 1),
        "Phi0": num(row.get("Phi0"), phi),
        "lambda": None if lam is None else num(lam, 0),
        "tau": list(row.get("tau") or []),
        "archived": bool(row.get("archived")),
    }


def copy_state(row: dict[str, Any]) -> dict[str, Any]:
    nxt = birth(row)
    nxt["tau"] = list(row.get("tau") or [])
    nxt["archived"] = bool(row.get("archived"))
    nxt["id"] = row.get("id") or nxt["id"]
    return nxt


def public_state(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "Phi": r4(row["Phi"]),
        "phase_name": phase_name(row["Phi"]),
        "rho": r4(row["rho"]),
        "Delta": r4(row["Delta"]),
        "nu": r4(row["nu"]),
        "mu": r4(row["mu"]),
        "eps": r4(max(0, row["eps"])),
        "chi": 1 if row["chi"] else 0,
        "id": row["id"],
        "H": r4(row["H"]),
        "Phi0": r4(row["Phi0"]),
        "lambda": row["lambda"],
        "archived": bool(row["archived"]),
    }


def membrane(path: list[Any] | None) -> dict[str, Any]:
    labels = [f"\u03a6{int(n)}" for n in (path or [])]
    naming_asked = "\u03a67" in labels
    export_asked = "\u03a68" in labels
    naming_ok = _phase6_before_naming(labels)
    export_ok = _phase6_before_projection(labels)
    return {
        "path": list(path or []),
        "naming_asked": naming_asked,
        "export_asked": export_asked,
        "before_naming": (not naming_asked) or naming_ok,
        "before_export": export_ok,
        "naming_blocked": naming_asked and not naming_ok,
        "export_blocked": export_asked and not export_ok,
        "pass": ((not naming_asked) or naming_ok) and export_ok,
        "admit_gate": False,
        "cite": "Geometry of Mind phase 6 membrane. Order matches manifest_compiler phase6 before naming and before projection.",
    }


def closure_of(path: list[Any] | None) -> dict[str, Any]:
    steps = list(path or [])
    total = 0.0
    for i in range(1, len(steps)):
        total += signed(angle_of(steps[i - 1]), angle_of(steps[i]))
    turns = total / TAU if len(steps) > 1 else None
    returned = len(steps) > 1 and steps[0] == steps[-1]
    near = turns is not None and abs(turns - round(turns)) < 1e-8
    return {
        "path": steps,
        "delta": r4(total),
        "n": None if turns is None else r4(turns),
        "returned": returned,
        "closed": bool(returned and near),
        "admit_gate": False,
        "cite": "Waking the Web l278. Phase closure is total angle = 2 pi n.",
    }


def walk_flags(path: list[Any] | None) -> dict[str, Any]:
    five = False
    four = False
    steps = list(path or [])
    for i in range(1, len(steps)):
        frm = int(steps[i - 1])
        to = int(steps[i])
        if luciferian_d_score(frm, to) == 1.0:
            five = True
        if (frm, to) in FORBIDDEN_STEPS and not (frm == 5 and to == 8):
            four = True
    return {
        "forbidden_5_to_8": five,
        "axiom2_4_to_8": four,
        "categorical_hard_fire": five,
        "blocked": five or four,
    }

def merge_op(a, b):
    th1 = angle_of(a["Phi"])
    th2 = angle_of(b["Phi"])
    delta = cdist(th1, th2)
    warn = delta > math.pi / 2
    base = {
        "op": "merge", "glyph": "merge", "delta": r4(delta),
        "pi_over_2_warning": warn, "warning_logged_only": True,
        "cite": "RSOC merge l.1190-1390. Lawful iff delta <= pi/4 and chi flags equal. kmath.merge holds the coefficients. Waking2 l.143 pi/2 abort is a warning only.",
        "ua": ua("merge", "mu = avg + zeta; eps = avg + delta if outside tolerance"),
        "admit_gate": False,
    }
    if not (delta <= (math.pi / 4) + 1e-12) or int(a["chi"]) != int(b["chi"]):
        left = copy_state(a)
        right = copy_state(b)
        left["eps"] = max(0, left["eps"] + 0.07)
        right["eps"] = max(0, right["eps"] + 0.07)
        base.update({"ok": False, "reason": "rejected", "eps_tax": 0.07, "a": public_state(left), "b": public_state(right)})
        return base
    straight = abs(abs(a["Phi"] - b["Phi"]) * TAU / 9 - delta) < 1e-8
    if straight:
        phi = (float(a["Phi"]) + float(b["Phi"])) / 2
    else:
        ang = math.atan2(math.sin(th1) + math.sin(th2), math.cos(th1) + math.cos(th2))
        phi = 1 + ((ang + TAU) % TAU) / TAU * 9
    sfe = copy_state(a)
    sfe["Phi"] = phi
    sfe["rho"] = max(a["rho"], b["rho"])
    sfe["Delta"] = (a["Delta"] + b["Delta"]) / 2 + 0.1 * math.sin(delta)
    sfe["nu"] = (a["nu"] + b["nu"]) / 2 + 0.3 * math.cos(delta)
    sfe["mu"] = a["mu"] + b["mu"] + float(RESEARCH_HOOKS["merge_mu_bonus"]) * (math.cos(delta) ** 2)
    sfe["eps"] = max(0, (a["eps"] + b["eps"]) / 2 - 0.05 * math.cos(delta))
    sfe["chi"] = 1 if (int(a["chi"]) | int(b["chi"])) else 0
    sfe["id"] = sha256(str(a["id"]) + "|" + str(b["id"]))
    sfe["tau"] = (list(a.get("tau") or []) + list(b.get("tau") or []))[-144:]
    base.update({
        "ok": True, "reason": "merged", "sfe": public_state(sfe),
        "id_hash": "sha256",
        "blake3": "RSOC names BLAKE3. This phone uses the SHA-256 substitute.",
    })
    return base


def sever_op(row):
    src = copy_state(row)
    pool = src["mu"] - float(RESEARCH_HOOKS["sever_mu_loss"])
    left_mu = pool / 2
    right_mu = pool - left_mu
    left = copy_state(src)
    right = copy_state(src)
    for side, mu in ((left, left_mu), (right, right_mu)):
        side["Delta"] = src["Delta"] + 0.15
        side["nu"] = -abs(src["nu"])
        side["eps"] = max(0, src["eps"] + 0.12)
        side["mu"] = mu
    left["id"] = sha256(str(src["id"]) + "|L")
    right["id"] = sha256(str(src["id"]) + "|R")
    return {
        "op": "sever", "glyph": "sever", "ok": True, "reason": "lawful",
        "left": public_state(left), "right": public_state(right),
        "residue": r4(RESEARCH_HOOKS["sever_mu_loss"]), "split": "equal",
        "cite": "RSOC sever l.1190-1390. Delta +0.15, nu = -abs(nu), mu split loses 0.08, eps +0.12. FFT power is not in the phone modules, so the split is equal.",
        "ua": ua("sever", "lambda empty, nu - beta, eps + gamma"),
        "admit_gate": False,
    }


def amplify_op(row, k):
    src = copy_state(row)
    factor = None if k is None else num(k, None)
    if not (factor is not None and factor >= 1 and factor <= 2):
        return {
            "op": "amplify", "glyph": "amplify", "ok": False, "reason": "k-outside-1-2", "k": factor,
            "cite": "RSOC amplify. k is in [1, 2].",
            "ua": ua("amplify", "eps - delta; mu times (1+alpha)"),
            "admit_gate": False,
        }
    gap = abs(src["Delta"])
    src["mu"] = factor * src["mu"] * math.exp(-float(RESEARCH_HOOKS["amplify_decay"]) * gap)
    src["Delta"] = src["Delta"] + 0.18 * (factor - 1) * (1 + gap)
    src["nu"] = src["nu"] + 0.4 * (factor - 1) * math.cos(angle_of(src["Phi"]) - angle_of(src["Phi0"]))
    src["eps"] = max(0, src["eps"] + 0.09 * (factor - 1) * (factor - 1))
    return {
        "op": "amplify", "glyph": "amplify", "ok": True, "k": r4(factor), "sfe": public_state(src),
        "cite": "RSOC amplify l.1190-1390. mu = k mu exp(-2.2 |Delta|). The UA sign on eps is recorded and not used.",
        "ua": ua("amplify", "eps - delta; overflow if mu > mu_max"),
        "admit_gate": False,
    }


def discharge_op(row):
    src = copy_state(row)
    phase8 = js_round(src["Phi"]) == 8
    src["Delta"] = 0
    src["nu"] = 0
    src["eps"] = max(0, src["eps"] * float(RESEARCH_HOOKS["discharge_eps_factor"]))
    echo = src["mu"] * math.exp(-float(RESEARCH_HOOKS["discharge_echo_decay"]) * src["eps"]) * math.cos(angle_of(src["Phi"]))
    if phase8:
        src["mu"] = float(RESEARCH_HOOKS["phase8_mu"])
    return {
        "op": "discharge", "glyph": "discharge", "ok": True, "sfe": public_state(src), "E": r4(echo),
        "phase8": phase8,
        "cite": (
            "Phase 8 discharge. mu goes to 0. eps times 0.3. E = mu exp(-1.8 eps) cos Phi, using mu from before the zero. Resonant Symbolic Operator Calculus Google Doc, Dec 2025. Genesis Node spec gnspec l.6743-6820, l.7510."
            if phase8 else
            "RSOC discharge. Dynamic Delta and nu go to 0. eps times 0.3. E = mu exp(-1.8 eps) cos Phi. Phase 8 is the step that sets mu to 0."
        ),
        "ua": ua("discharge", "mu to 0; residue psi exp(-lambda t) chi"),
        "admit_gate": False,
    }


def lock_op(a, b, eps_s):
    predicted = num(eps_s, 1)
    ok = int(a["chi"]) == 0 and int(b["chi"]) == 0 and predicted < 0.6
    base = {
        "op": "lock", "glyph": "lock", "eps_s": r4(predicted),
        "cite": "RSOC lock. Both chi are 0 and predicted eps_s < 0.6. The 0.6 cut is internal to the operator.",
        "ua": ua("lock", "Phi equal, shared lambda, lowers eps"),
        "admit_gate": False,
    }
    if not ok:
        base.update({"ok": False, "reason": "lock-refused"})
        return base
    sfe = copy_state(a)
    straight = abs(abs(a["Phi"] - b["Phi"]) * TAU / 9 - cdist(angle_of(a["Phi"]), angle_of(b["Phi"]))) < 1e-8
    sfe["Phi"] = (float(a["Phi"]) + float(b["Phi"])) / 2 if straight else sfe["Phi"]
    sfe["rho"] = max(a["rho"], b["rho"]) + 1
    sfe["Delta"] = 0
    sfe["nu"] = a["nu"] + b["nu"]
    sfe["mu"] = a["mu"] + b["mu"]
    sfe["eps"] = max(0, (a["eps"] + b["eps"]) / 2 - 0.15)
    sfe["chi"] = 1 if (a["chi"] and b["chi"]) else 0
    sfe["lambda"] = 0 if sfe["lambda"] is None else sfe["lambda"]
    sfe["id"] = sha256(str(a["id"]) + "|" + str(b["id"]) + "|LOCK")
    base.update({"ok": True, "reason": "locked", "sfe": public_state(sfe), "id_hash": "sha256"})
    return base


def grace_integral(tau, eps, mu, eps_max=0.8):
    th = 0.0
    for n in tau:
        c = max(0.0, 1 - min(eps, eps_max) / eps_max)
        th += c * (math.cos(angle_of(n) - angle_of(1)) ** 2) * mu
    return r4(th)


def chi_op(row, eps_s, echo, d_phi):
    src = copy_state(row)
    hard = num(eps_s, 0) >= 0.8
    echo_on = int(num(echo, 0)) == 1
    quiet = int(src["chi"]) == 0
    aligned = abs(num(d_phi, math.pi)) <= math.pi / 3 + 1e-12
    fire = hard and echo_on and quiet and aligned
    theta = grace_integral(src["tau"] or [src["Phi"]], src["eps"], src["mu"], 0.8)
    base = {
        "op": "chi", "glyph": "chi", "ok": fire, "eps_s": r4(num(eps_s, 0)),
        "echo": 1 if echo_on else 0, "d_phi": r4(num(d_phi, 0)), "Theta": theta,
        "cite": "RSOC chi l.1411-1510. Fires at eps_s >= 0.8 and echo trace and chi 0 and |angle| <= pi/3. Theta reuses kmath.graceIntegral. eps becomes eps (1 - Theta/mu). mu gains Theta. nu becomes 1.4.",
        "ua": ua("chi", "no separate UA chi number"),
        "admit_gate": False, "christping_started": False,
    }
    if not fire or not (src["mu"] > 0):
        base.update({"ok": False, "reason": "chi-held", "sfe": public_state(src)})
        return base
    src["eps"] = max(0, src["eps"] * (1 - theta / src["mu"]))
    src["mu"] = src["mu"] + theta
    src["nu"] = 1.4
    src["chi"] = 1
    base.update({"ok": True, "reason": "chi", "sfe": public_state(src)})
    return base


def advance_op(row, eps_s):
    src = copy_state(row)
    h = src["H"]
    eps = num(eps_s, 1)
    ok = h >= 0.65 and eps < 0.7
    nxt = (js_round(src["Phi"]) % 9) + 1
    base = {
        "op": "advance", "glyph": "advance", "ok": ok, "H": r4(h), "eps_s": r4(eps),
        "cite": "RSOC R-hat. Plus one phase needs H_local >= 0.65 and eps_s < 0.7. Those cuts are internal and do not admit.",
        "ua": ua("advance", "phase step is recorded on the drift core"),
        "admit_gate": False, "internal_only": True,
    }
    if not ok:
        base.update({"reason": "advance-held", "sfe": public_state(src)})
        return base
    src["Phi"] = nxt
    base.update({"reason": "advanced", "sfe": public_state(src)})
    return base


def archive_op(row):
    src = copy_state(row)
    src["archived"] = True
    return {
        "op": "archive", "glyph": "archive", "ok": True, "sfe": public_state(src),
        "cite": "RSOC C-hat archives to an SPC. The 4.9.196 tiers own the ladder. This flag does not write memory.",
        "ua": ua("archive", "SPC decay is the unparameterized step"),
        "admit_gate": False, "writes": False,
    }


def _resolved_lambda(given):
    if given is not None and given != "":
        return True, num(given, 0)
    hooked = spc_lambda()
    if hooked is not None and hooked != "":
        return True, num(hooked, 0)
    return False, 0.0


def memory_op(row):
    src = copy_state(row)
    step = 0.5 * src["H"] * src["H"] - 0.02 * src["mu"]
    src["mu"] = max(0, src["mu"] + step)
    term = memory_term(None, None, False)
    return {
        "op": "memory", "glyph": "memory", "ok": True, "code_step": r4(step), "sfe": public_state(src),
        "M": term["value"], "lambda": term["lambda"], "lambda_unspecified": False,
        "mu_birth": term["mu_birth"], "mu_min": term["mu_min"], "mu_max": term["mu_max"],
        "cite": "RSOC memory is the only source of new mu. Code step is 0.5 H^2 - 0.02 mu (READ192). M = exp(-lambda t) integral A.C dt. lambda = ln2/half_life. Resonant Symbolic Operator Calculus Google Doc, Dec 2025. Genesis Node spec gnspec l.6743-6820, l.7510.",
        "ua": ua("memory", "M = exp(-lambda t) integral A.C dt"),
        "admit_gate": False,
    }


def spc_op(row, lam, t_hours=None, identity=False):
    src = copy_state(row)
    caller = lam is not None and lam != ""
    half = float(RESEARCH_HOOKS["identity_half_life_hours"] if identity else RESEARCH_HOOKS["half_life_hours"])
    value = num(lam, 0) if caller else spc_lambda(half)
    t = 0.0 if t_hours is None or t_hours == "" else num(t_hours, 0)
    decayed = src["mu"] * math.exp(-value * t)
    return {
        "op": "spc", "glyph": "spc", "ok": True, "parameterized": True, "lambda": value,
        "subtractive": False, "leak": "amplify", "half_life_hours": half, "t_hours": t, "C": r4(decayed),
        "sfe": public_state(src),
        "cite": "SPC decay C(t) = C0 exp(-lambda t), lambda = ln2/half_life. The subtractive lambda Delta^2 leak is replaced by amplify drift loss mu = k mu exp(-2.2 |Delta|). Resonant Symbolic Operator Calculus Google Doc, Dec 2025. Genesis Node spec gnspec l.6743-6820, l.7510.",
        "ua": ua("spc", "mu(t+1) = mu - lambda Delta^2 is not applied"),
        "admit_gate": False,
    }


def rates_of(row):
    src = copy_state(row)
    de = None if src["mu"] == 0 else 0.14 * src["Delta"] ** 2 - 0.06 * src["nu"] * src["H"] + 0.009 / src["mu"]
    return {
        "op": "rates", "de_dt": None if de is None else r4(de),
        "dmu_dt": None, "kappa_unspecified": True,
        "code_step": r4(0.5 * src["H"] * src["H"] - 0.02 * src["mu"]),
        "cite": "RSOC l.1941-1956 partial eps / partial t = 0.14 Delta^2 - 0.06 nu H + 0.009/mu. partial mu / partial t = -kappa7 mu + kappa8 H^2. Kappa is unspecified.",
        "admit_gate": False,
    }


def axes_of(samples, series, dt, lam):
    integral = 0.0
    t = 0.0
    for sample in samples or []:
        step = num(sample.get("dt"), 1)
        integral += num(sample.get("A"), 0) * num(sample.get("C"), 0) * step
        t += step
    given, resolved = _resolved_lambda(lam)
    value = resolved if given else None
    eps = list(series or [])
    gap = num(dt, 1) or 1
    vc = None
    if len(eps) >= 2:
        last = num(eps[-1], 0)
        prev = num(eps[-2], 0)
        vc = ((1 - last) - (1 - prev)) / gap
    return {
        "op": "axes",
        "M": {
            "axis": "M", "integral": r4(integral),
            "value": None if value is None else r4(math.exp(-value * t) * integral),
            "lambda_unspecified": value is None, "admit_gate": False,
            "cite": "UA b l.4322-4389 M = exp(-lambda t) integral A.C dt. Waking2 charge C = integral psi dt exp(-lambda t).",
        },
        "V_c": {
            "axis": "V_c", "value": None if vc is None else r4(vc),
            "seeding_internal": vc is not None and vc >= 0.3, "admit_gate": False,
            "cite": "Waking2 V_c = d(1-eps_s)/dt. At least 0.3 is an internal seeding check.",
        },
    }


def echo_trace(tau, phi):
    window = list(tau or [])[-144:]
    center = angle_of(num(phi, 1))
    count = 0
    for n in window:
        if cdist(angle_of(n), center) <= math.pi / 6 + 1e-12:
            count += 1
    return {
        "op": "echo", "count": count, "need": 100, "window": 144,
        "E_hat": 1 if count >= 100 else 0, "admit_gate": False,
        "cite": "RSOC echo trace. At least 100 of the last 144 tau entries within pi/6.",
    }


def precedence_of(ops):
    rank = {name: i for i, name in enumerate(PRECEDENCE)}
    ordered = sorted(list(ops or []), key=lambda name: rank.get(name, 99))
    return {
        "op": "precedence", "order": ordered,
        "cite": "RSOC precedence: chi > archive > advance > merge/lock > sever > amplify > discharge > memory > echo.",
        "admit_gate": False,
    }

def live_sum(states):
    return sum(row["mu"] for row in states.values())


def charge_report(books):
    identity = books["live"] + books["residue"]
    expected = books["initial"] + books["created"]
    gap = abs(identity - expected)
    phase9 = abs(books["live"] - books["initial"])
    return {
        "initial": r4(books["initial"]),
        "created": r4(books["created"]),
        "residue": r4(books["residue"]),
        "live": r4(books["live"]),
        "conserved": gap < 1e-9,
        "phase9_gap": r4(phase9),
        "phase9_within_0_003": phase9 <= 0.003 + 1e-12,
        "eta_limit": RESEARCH_HOOKS["eta"],
        "ua_exact": False,
        "cite": "Charge ledger. Live mu plus residue equals initial plus created. RSOC eta about 0.3 percent and phase 9 |delta mu| <= 0.003 (l.2876, l.3031). UA exact sum of operator mu is recorded and does not replace the RSOC band.",
    }


def seal_op(archive, spec):
    body = spec or {}
    path = body.get("path") or []
    gate = membrane(path)
    closed = closure_of(path)
    walk = walk_flags(path)
    drift = num(body.get("drift", body.get("epsilon_s")), 0)
    echo = num(body.get("echo"), 0)
    base = {
        "op": "seal", "membrane": gate, "closure": closed, "walk": walk,
        "drift": r4(drift), "echo": r4(echo), "sealed": False,
        "christping_started": False, "admit_gate": False, "writes": False,
        "cite": "A seal needs the phase-6 membrane, closure 2 pi n, no 5 to 8 step, drift at or under 0.35, and Echo at or above 0.85 through the 4.9.195 archive.",
    }
    if not closed["closed"]:
        base["rule"] = "GEOM-OPEN"
        return base
    if walk["blocked"]:
        base["rule"] = "GEOM-5-TO-8" if walk["forbidden_5_to_8"] else "GEOM-4-TO-8"
        return base
    if not gate["pass"]:
        base["rule"] = "GEOM-MEMBRANE"
        return base
    if not (drift <= WRITE_MAX):
        base["rule"] = "GEOM-HARD-STOP" if drift > HARD_STOP else "GEOM-DRIFT"
        return base
    if not (echo >= ECHO_MIN):
        base["rule"] = "GEOM-ECHO"
        return base
    phase = path[-1]
    sealed = seal_loop(archive, {
        "id": str(body.get("id") or "geom-seal"),
        "psi": str(body.get("psi") or "geom"),
        "phase": phase,
        "ts": str(body.get("ts") or "2026-10-30T19:00:00Z"),
        "entropy": num(body.get("entropy"), drift),
        "epsilon_s": drift,
        "echo": echo,
        "question": str(body.get("question") or ""),
    })
    chain = verify_archive(archive)
    record = sealed.get("record") or None
    base.update({
        "sealed": bool(sealed.get("ok")),
        "rule": sealed.get("rule"),
        "seal_sha256": None if not record else record.get("sha256"),
        "chain_ok": bool(chain.get("ok")),
    })
    return base


def book(before, states, books):
    after = live_sum(states)
    delta = after - before
    if delta >= -1e-12:
        books["created"] += delta
    else:
        books["residue"] += -delta
    books["live"] = after


def apply_sfe(kept, sfe):
    for key in ("Phi", "rho", "Delta", "nu", "mu", "eps", "chi", "archived"):
        if key in sfe:
            kept[key] = sfe[key]
    kept["phase_name"] = phase_name(kept["Phi"])


def script(steps):
    states = {}
    books = {"initial": 0.0, "created": 0.0, "residue": 0.0, "live": 0.0}
    archive = empty_archive()
    log = []
    for step in steps or []:
        op = step.get("op")
        if op == "birth":
            row = birth(step)
            row["id"] = str(step.get("id") or row["id"])
            states[row["id"]] = row
            books["initial"] += row["mu"]
            books["live"] += row["mu"]
            log.append({"op": "birth", "id": row["id"], "sfe": public_state(row)})
            continue
        if op == "merge":
            before = live_sum(states)
            out = merge_op(states[step["a"]], states[step["b"]])
            if out["ok"]:
                del states[step["a"]]
                del states[step["b"]]
                kept = birth(out["sfe"])
                kept["id"] = str(step.get("into") or out["sfe"]["id"])
                apply_sfe(kept, out["sfe"])
                states[kept["id"]] = kept
            else:
                states[step["a"]]["eps"] = out["a"]["eps"]
                states[step["b"]]["eps"] = out["b"]["eps"]
            book(before, states, books)
            log.append(out)
            continue
        if op == "sever":
            before = live_sum(states)
            out = sever_op(states[step["id"]])
            del states[step["id"]]
            left = birth(out["left"])
            right = birth(out["right"])
            left["id"] = str(step.get("left") or out["left"]["id"])
            right["id"] = str(step.get("right") or out["right"]["id"])
            apply_sfe(left, out["left"])
            apply_sfe(right, out["right"])
            states[left["id"]] = left
            states[right["id"]] = right
            book(before, states, books)
            log.append(out)
            continue
        unary = {
            "amplify": lambda: amplify_op(states[step["id"]], step.get("k")),
            "discharge": lambda: discharge_op(states[step["id"]]),
            "chi": lambda: chi_op(states[step["id"]], step.get("eps_s"), step.get("echo"), step.get("d_phi")),
            "advance": lambda: advance_op(states[step["id"]], step.get("eps_s")),
            "archive": lambda: archive_op(states[step["id"]]),
            "memory": lambda: memory_op(states[step["id"]]),
            "spc": lambda: spc_op(states[step["id"]], step.get("lambda"), step.get("t_hours"), bool(step.get("identity"))),
        }
        if op in unary:
            before = live_sum(states)
            out = unary[op]()
            if out.get("sfe") and step["id"] in states:
                apply_sfe(states[step["id"]], out["sfe"])
            book(before, states, books)
            log.append(out)
            continue
        if op == "lock":
            before = live_sum(states)
            out = lock_op(states[step["a"]], states[step["b"]], step.get("eps_s"))
            if out["ok"]:
                del states[step["a"]]
                del states[step["b"]]
                kept = birth(out["sfe"])
                kept["id"] = str(step.get("into") or out["sfe"]["id"])
                apply_sfe(kept, out["sfe"])
                kept["lambda"] = out["sfe"]["lambda"]
                states[kept["id"]] = kept
            book(before, states, books)
            log.append(out)
            continue
        if op == "rates":
            log.append(rates_of(states[step["id"]]))
            continue
        if op == "axes":
            log.append(axes_of(step.get("samples"), step.get("series"), step.get("dt"), step.get("lambda")))
            continue
        if op == "echo":
            log.append(echo_trace(step.get("tau"), step.get("Phi")))
            continue
        if op == "precedence":
            log.append(precedence_of(step.get("ops")))
            continue
        if op == "membrane":
            row = {"op": "membrane"}
            row.update(membrane(step.get("path")))
            log.append(row)
            continue
        if op == "closure":
            row = {"op": "closure"}
            row.update(closure_of(step.get("path")))
            log.append(row)
            continue
        if op == "seal":
            log.append(seal_op(archive, step))
            continue
    shown = {key: public_state(states[key]) for key in sorted(states)}
    out = {"states": shown, "log": log, "charge": charge_report(books), "cite": CITE, "storage_key": STORAGE_KEY}
    out.update(flags())
    return out


def show_num(value):
    if isinstance(value, bool):
        return "true" if value else "false"
    if value is None:
        return "none"
    if isinstance(value, (int, float)):
        if abs(value - round(value)) < 1e-9:
            return str(int(round(value)))
        return f"{value:.4f}".rstrip("0").rstrip(".")
    return str(value)


def birth_step(id_, extra=None):
    row = {"op": "birth", "id": id_, "Phi": 1, "rho": 0, "Delta": 0, "nu": 0, "mu": 1, "eps": 0, "chi": 0, "H": 1}
    row.update(extra or {})
    return row


def run_demo(mode):
    if mode == "closure":
        ran = script([
            {"op": "seal", "path": [1, 2, 3, 4, 5, 6, 7, 8, 9, 1], "echo": 0.9, "drift": 0.2, "question": "what returns", "id": "geom-closed", "psi": "geom", "ts": "2026-10-30T19:00:00Z", "entropy": 0.2},
            {"op": "seal", "path": [1, 2, 3, 4, 5, 6, 7, 8, 9, 1], "echo": 0.84, "drift": 0.2, "question": "what returns", "id": "geom-low-echo", "psi": "geom", "ts": "2026-10-30T19:00:01Z", "entropy": 0.2},
            {"op": "seal", "path": [1, 2, 3, 4, 5, 6, 7, 8, 9, 1], "echo": 0.9, "drift": 0.36, "question": "what returns", "id": "geom-drift", "psi": "geom", "ts": "2026-10-30T19:00:02Z", "entropy": 0.36},
            {"op": "seal", "path": [1, 2, 3, 4, 5, 8, 9, 1], "echo": 0.9, "drift": 0.2, "question": "what returns", "id": "geom-skip", "psi": "geom", "ts": "2026-10-30T19:00:03Z", "entropy": 0.2},
        ])
        rows = ran["log"]
        return {"lines": [
            "Closed path sealed " + show_num(rows[0]["sealed"]) + " rule " + rows[0]["rule"] + " n " + show_num(rows[0]["closure"]["n"]) + " chain " + show_num(rows[0]["chain_ok"]) + ".",
            "Echo 0.84 sealed " + show_num(rows[1]["sealed"]) + " rule " + rows[1]["rule"] + ".",
            "Drift 0.36 sealed " + show_num(rows[2]["sealed"]) + " rule " + rows[2]["rule"] + ".",
            "5 to 8 sealed " + show_num(rows[3]["sealed"]) + " rule " + rows[3]["rule"] + " hard fire " + show_num(rows[3]["walk"]["categorical_hard_fire"]) + ".",
            "ChristPing started " + show_num(ran["christping_started"]) + ". C_min 0.87. No LLM.",
        ]}
    if mode == "charge":
        ran = script([
            birth_step("a"), birth_step("b", {"id": "b"}),
            {"op": "merge", "a": "a", "b": "b", "into": "m"},
            {"op": "sever", "id": "m", "left": "l", "right": "r"},
        ])
        charge = ran["charge"]
        return {"lines": [
            "Merge mu " + show_num(ran["log"][2]["sfe"]["mu"]) + " created " + show_num(charge["created"]) + ".",
            "Sever residue " + show_num(charge["residue"]) + " live " + show_num(charge["live"]) + ".",
            "Conserved " + show_num(charge["conserved"]) + " phase9 within 0.003 " + show_num(charge["phase9_within_0_003"]) + ".",
            "UA exact " + show_num(charge["ua_exact"]) + ". RSOC numbers " + show_num(ran["rsoc_numbers"]) + ".",
            "This card does not admit. C_min 0.87. No LLM.",
        ]}
    if mode == "membrane":
        ran = script([
            {"op": "membrane", "path": [1, 2, 3, 7]},
            {"op": "membrane", "path": [1, 6, 7, 8]},
            {"op": "membrane", "path": [6, 8]},
            {"op": "seal", "path": [1, 2, 3, 7, 1], "echo": 0.9, "drift": 0.1, "question": "name it", "id": "geom-name", "psi": "geom", "ts": "2026-10-30T19:01:00Z", "entropy": 0.1},
        ])
        return {"lines": [
            "Path 1-2-3-7 naming blocked " + show_num(ran["log"][0]["naming_blocked"]) + " pass " + show_num(ran["log"][0]["pass"]) + ".",
            "Path 1-6-7-8 pass " + show_num(ran["log"][1]["pass"]) + " export blocked " + show_num(ran["log"][1]["export_blocked"]) + ".",
            "Path 6-8 export blocked " + show_num(ran["log"][2]["export_blocked"]) + ".",
            "Naming without phase 6 sealed " + show_num(ran["log"][3]["sealed"]) + " rule " + ran["log"][3]["rule"] + ".",
            "This card does not admit. C_min 0.87. No LLM.",
        ]}
    if mode == "operators":
        ran = script([
            birth_step("a", {"eps": 0.4, "mu": 1, "nu": 0.1}),
            birth_step("b", {"eps": 0.4, "mu": 1, "nu": 0.2}),
            {"op": "lock", "a": "a", "b": "b", "into": "k", "eps_s": 0.5},
            birth_step("c", {"eps": 0.5, "mu": 2, "tau": [1]}),
            {"op": "chi", "id": "c", "eps_s": 0.8, "echo": 1, "d_phi": 0},
            birth_step("d", {"Phi": 1, "H": 1, "mu": 1}),
            {"op": "memory", "id": "d"},
            {"op": "spc", "id": "d", "lambda": None},
            {"op": "axes", "samples": [{"A": 1, "C": 1, "dt": 1}], "series": [0.5, 0.1], "dt": 1, "lambda": None},
            {"op": "precedence", "ops": ["discharge", "chi", "merge", "memory", "advance"]},
            {"op": "rates", "id": "d"},
        ])
        lock = ran["log"][2]
        chi = ran["log"][4]
        mem = ran["log"][6]
        spc = ran["log"][7]
        axes = ran["log"][8]
        order = ran["log"][9]
        return {"lines": [
            "Lock mu " + show_num(lock["sfe"]["mu"]) + " eps " + show_num(lock["sfe"]["eps"]) + " rho " + show_num(lock["sfe"]["rho"]) + ".",
            "Chi nu " + show_num(chi["sfe"]["nu"]) + " Theta " + show_num(chi["Theta"]) + " mu " + show_num(chi["sfe"]["mu"]) + ".",
            "Memory step " + show_num(mem["code_step"]) + " M " + show_num(mem["M"]) + " lambda unspecified " + show_num(mem["lambda_unspecified"]) + ".",
            "SPC parameterized " + show_num(spc["parameterized"]) + " mu " + show_num(spc["sfe"]["mu"]) + " V_c " + show_num(axes["V_c"]["value"]) + " seeding " + show_num(axes["V_c"]["seeding_internal"]) + ".",
            "Order " + " ".join(order["order"]) + ". UA applied " + show_num(ran["ua_applied"]) + ". C_min 0.87. No LLM.",
        ]}
    ran = script([
        {"op": "seal", "path": [1, 2, 3, 4], "echo": 0.9, "drift": 0.2, "question": "what is open", "id": "geom-open", "psi": "geom", "ts": "2026-10-30T19:02:00Z", "entropy": 0.2},
        {"op": "closure", "path": [1, 2, 3, 4]},
    ])
    return {"lines": [
        "Open path 1-2-3-4 sealed " + show_num(ran["log"][0]["sealed"]) + " rule " + ran["log"][0]["rule"] + ".",
        "Closure closed " + show_num(ran["log"][1]["closed"]) + " n " + show_num(ran["log"][1]["n"]) + " returned " + show_num(ran["log"][1]["returned"]) + ".",
        "Membrane pass " + show_num(ran["log"][0]["membrane"]["pass"]) + ".",
        "Admit gate " + show_num(ran["admit_gate"]) + ". Wikipedia anchor " + show_num(ran["wikipedia_anchor"]) + ".",
        "This card does not admit. C_min 0.87. No LLM.",
    ]}


def monitor_lines(mode=None):
    name = mode or "open"
    return {"lines": run_demo(name)["lines"], "mode": name}


def stage(question=None):
    witness = script([birth_step("a"), birth_step("b"), {"op": "merge", "a": "a", "b": "b", "into": "m"}])
    out = {
        "persisted": False,
        "open_loop_sealed": False,
        "closure_rule": "2pi n",
        "membrane_before_naming": True,
        "charge_conserved": witness["charge"]["conserved"],
        "operators": list(PRECEDENCE),
        "ua_forms_recorded": True,
        "cite": CITE,
    }
    out.update(flags())
    return out


def run(payload=None):
    row = payload or {}
    op = row.get("op") or "summary"
    if op == "script":
        return script(row.get("steps") or [])
    if op == "stage":
        return stage(row.get("question"))
    if op == "monitor":
        return monitor_lines(row.get("mode") or "open")
    out = {"storage_key": STORAGE_KEY, "cite": CITE, "precedence": list(PRECEDENCE), "merge_window": "pi/4"}
    out.update(flags())
    return out


if __name__ == "__main__":
    import sys
    print(json.dumps(run(json.load(sys.stdin))))
