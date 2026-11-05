"""Symbolic solver (SymPy): exact kinematics, trigonometry and the tip-vs-slide criterion, with receipts."""
from __future__ import annotations

from typing import Any

import sympy as sp

NAME = "sympy_math"
HANDLES = ("throw", "drop", "push")


def solve(scene: dict[str, Any]) -> dict[str, Any]:
    g = sp.nsimplify(scene["gravity"])
    if scene["action"] == "throw":
        th = sp.rad(sp.nsimplify(scene["launch"]["angle_deg"]))
        v = sp.nsimplify(scene["launch"]["speed"])
        t_f = sp.simplify(2 * v * sp.sin(th) / g)
        rng = sp.simplify(v ** 2 * sp.sin(2 * th) / g)
        h_max = sp.simplify((v * sp.sin(th)) ** 2 / (2 * g))
        return {"solver": NAME, "engine": "sympy " + sp.__version__, "outcome": "land",
                "exact": {"range_m": str(rng), "flight_time_s": str(t_f), "max_height_m": str(h_max)},
                "measurements": {"range_m": round(float(rng), 3), "flight_time_s": round(float(t_f), 3), "max_height_m": round(float(h_max), 3)},
                "equations": ["R = v^2 sin(2θ)/g", "t = 2 v sin θ / g", "H = (v sin θ)^2 / (2g)"]}
    if scene["action"] == "drop":
        h = sp.nsimplify(scene["drop_height"])
        t = sp.sqrt(2 * h / g)
        v = sp.sqrt(2 * g * h)
        return {"solver": NAME, "engine": "sympy " + sp.__version__, "outcome": "fall",
                "exact": {"fall_time_s": str(sp.simplify(t)), "impact_speed_m_s": str(sp.simplify(v))},
                "measurements": {"fall_time_s": round(float(t), 4), "impact_speed_m_s": round(float(v), 3)},
                "equations": ["t = sqrt(2h/g)", "v = sqrt(2 g h)"]}
    # push: quasi-static tip-vs-slide criterion for a cross-check (MuJoCo stays authoritative)
    b = scene["body"]
    if b["shape"] == "sphere":
        return {"solver": NAME, "engine": "sympy " + sp.__version__, "outcome": None, "note": "a sphere has no tipping edge"}
    half_w = sp.nsimplify(b["radius"] if b["shape"] == "cylinder" else b["width"] / 2)
    H = sp.nsimplify(b["height"]); mu = sp.nsimplify(scene["surface"]["mu"])
    h = sp.nsimplify(round(scene["point"]["fraction"], 4)) * H
    # slipping needs F > mu m g; tipping about the front edge needs F h > m g half_w  →  tip first iff h > half_w / mu
    h_crit = sp.simplify(half_w / mu)
    return {"solver": NAME, "engine": "sympy " + sp.__version__, "outcome": "topple" if h > h_crit else "slide",
            "exact": {"critical_push_height_m": str(h_crit), "push_height_m": str(h)},
            "measurements": {"critical_push_height_m": round(float(h_crit), 4), "push_height_m": round(float(h), 4)},
            "equations": ["slip: F > μ m g", "tip: F h > m g w/2", "tip before slip iff h > (w/2)/μ"],
            "role": "cross_check"}
