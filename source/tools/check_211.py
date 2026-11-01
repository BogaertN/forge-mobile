"""4.9.211 checks used by verify/r4211_suite.js (Release B, DRIFT-SPEC/v1). Real engine, no network, no LLM. Prints one JSON line."""
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "engine"))
sys.path.insert(0, str(ROOT))

from tools.live_188 import SEED, anchor_pool, starter_rows  # noqa: E402
from rmc_engine_v1 import drift_policy as DP  # noqa: E402
from rmc_engine_v1.mobile_config import DRIFT_POLICY, THRESHOLDS  # noqa: E402
from rmc_engine_v1.rmc_core import admit_gate, run, write_gate  # noqa: E402

POOL = anchor_pool()
GRID = json.loads(sys.argv[1]) if len(sys.argv) > 1 else {"measure": [], "classify": []}


def ask(q: str, extra: dict | None = None) -> dict:
    mem = json.loads(json.dumps(SEED))
    mem["anchors"] = starter_rows()
    mem["pools"] = [{"name": "anchors", "into": "anchors", "rows": POOL}]
    payload = {"question": q, "live": True, "memory": mem}
    payload.update(extra or {})
    r = run(payload)
    mw = r.get("memory_write") or {}
    return {"reply": r.get("reply") if r.get("product_reply") else None, "admit": r.get("admit"), "drift": r.get("drift"),
            "proposed": mw.get("proposed"), "rule": mw.get("rule"), "write_gate": mw.get("write_gate")}


def measured(eps: float, sigma: float = 0.0, path: list | None = None, C: float = 0.9, breaker: bool = False) -> dict:
    return {"epsilon_s": eps, "sigma_res": sigma, "coherence": C, "phase_ok": True, "circuit_breaker": breaker, "phase_path": path or ["Φ1"]}


out = {
    "policy": DRIFT_POLICY,
    "thresholds": {k: THRESHOLDS[k] for k in ("hard_stop", "hard_stop_inclusive", "resonance_epsilon_role")},
    "measure": [DP.drift_measure(g["hist"], {"from": g["prev"], "to": g["act"]}, g["depth"]) for g in GRID["measure"]],
    "classify": [DP.classify_drift(c) for c in GRID["classify"]],
    "theta": [DP.theta_admit(0), DP.theta_admit(1), DP.theta_admit(None)],
    "trend": [DP.trend_rising([0.1, 0.11, 0.12, 0.13]), DP.trend_rising([0.1, 0.11, 0.11, 0.13]), DP.trend_rising([0.1, 0.11, 0.12])],
    "accel": [DP.acceleration_flag([0, 5, 10]), DP.acceleration_flag([0, 10, 20]), DP.acceleration_flag([])],
    "chi": [DP.evaluate_chi_eligibility({"eps": 0.85}, {"dphi_avg": 0.5}, True, {"owner": "gilligan"}),
            DP.evaluate_chi_eligibility({"eps": 0.85}, {"dphi_avg": 0.5}, True, {"owner": "gilligan", "chi_grace_used": 1}),
            DP.evaluate_chi_eligibility({"eps": 0.5}, {"dphi_avg": 0.5}, True, {"owner": "athena"})],
    "classes": [DP.echo_classes("The ocean is not salty.", "The ocean is salty."), DP.echo_classes("Salt may come from rocks.", "Salt may come from rocks and vents.")],
    "gate": {
        "sigma_big_clean": admit_gate(measured(0.12, sigma=0.6), apply_to_ask=True),
        "at_035": admit_gate(measured(0.35)),
        "at_0351": admit_gate(measured(0.351)),
        "at_040": admit_gate(measured(0.40)),
        "at_080": admit_gate(measured(0.80)),
        "at_0799": admit_gate(measured(0.799)),
        "forbidden_low": admit_gate(measured(0.1, path=["Φ5", "Φ8"])),
        "backward": admit_gate(measured(0.1, path=["Φ6", "Φ4"])),
        "trend": admit_gate(measured(0.2), history=[0.1, 0.12, 0.15]),
        "accel": admit_gate(measured(0.2), stamps_ms=[0, 4, 9]),
        "breaker": admit_gate(measured(0.2, breaker=True)),
    },
    "ocean": ask("Why is the ocean salty?"),
    "capital": ask("What is the capital of Japan?"),
    "capability": ask("What can you do?"),
    "corrected": ask("Why is the ocean salty?", {"chi_passes": 1}),
    "negation_lost": write_gate("Is the ocean not salty?", "The ocean is salty.", measured(0.12), {"drift_region": "clean"}, {"score": 1.0}, {"concept": "A.OCEAN"}, []),
    "source_sentence": write_gate("Why is salt in the ocean?", "Salt is in the ocean.", measured(0.12), {"drift_region": "clean"}, {"score": 1.0}, {"concept": "A.OCEAN"},
                                  [{"id": "p1", "text": "Salt is not in the river. Salt is in the ocean."}]),
    "negation_kept": write_gate("Why is the sky blue?", "The sky is not violet because our eyes are less sensitive to violet.", measured(0.12), {"drift_region": "clean"}, {"score": 1.0}, {},
                                [{"id": "p2", "text": "The sky is not violet because our eyes are less sensitive to violet."}]),
    "unnamed": write_gate("Hm?", "Ok.", measured(0.12), {"drift_region": "clean"}, {"score": 1.0}, {}, []),
    "low_echo": write_gate("Why is the ocean salty?", "Salt in the ocean comes from rocks.", measured(0.12), {"drift_region": "clean"}, {"score": 0.9}, {}, []),
}
print(json.dumps(out, default=str))
