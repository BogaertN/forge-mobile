"""4.9.217 checks used by verify/r4217_suite.js. Real engine, no network, no LLM. Prints one JSON line.

The lookup ranks anchors that define the asked subject above anchors that only mention it, and Echo re-parses the
answer for the asked relation about the asked subject. Two definitional rows below are test fixtures (copies of a
shipped anchor's provenance with a definition sentence); they show that a definition is admitted when one exists.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "engine"))
sys.path.insert(0, str(ROOT))
_MATHLIBS = ROOT / "_mathlibs"
if _MATHLIBS.is_dir() and str(_MATHLIBS) not in sys.path:
    sys.path.insert(0, str(_MATHLIBS))

from rmc_engine_v1.anchor_store import clear_cache  # noqa: E402
from tools.live_188 import SEED, anchor_pool, starter_rows  # noqa: E402
from rmc_engine_v1.rmc_core import run  # noqa: E402
from rmc_engine_v1.echo_question import echo_against_question  # noqa: E402
from rmc_engine_v1 import relation_echo as rel  # noqa: E402
from rmc_engine_v1 import resonance_recall as rr  # noqa: E402
from rmc_engine_v1.mobile_config import THRESHOLDS  # noqa: E402
from rmc_engine_v1 import rmc_renderer_200 as r200  # noqa: E402

PAIRS = [
    ("What is the Moon?", "The Moon, on the other hand, moves completely around Earth in that time."),
    ("What is the Moon?", "The Moon is Earth's only natural satellite."),
    ("What is DNA?", "DNA, or deoxyribonucleic acid, is the hereditary material in humans and almost all other organisms."),
    ("What is DNA?", "Most DNA is located in the cell nucleus (where it is called nuclear DNA), but a small amount of DNA can also be found in the mitochondria."),
    ("What is Burkina Faso?", "Ouagadougou is the capital of Burkina Faso."),
    ("What is Burkina Faso?", "Burkina Faso is a landlocked country in West Africa."),
    ("What is the capital of Burkina Faso?", "Ouagadougou is the capital of Burkina Faso."),
    ("Why is the sky blue?", "Even though violet is scattered more than blue, the sky looks blue to us because our eyes are more sensitive to blue light."),
    ("Why is the ocean salty?", "Salt in the ocean comes from two sources: runoff from the land and openings in the seafloor."),
    ("Why is the ocean salty?", "One of the most well known qualities of the ocean is that it is salty."),
    ("What color is my car?", "My car is red."),
    ("What color is my car?", "My car is fast."),
    ("What is photosynthesis?", "Photosynthesis is essential to all life on earth; both plants and animals depend on it."),
    ("What is helium?", "Only a few elements, such as the gases helium, neon, and argon, consist of a collection of individual atoms."),
    ("What is the largest planet?", "Jupiter is the fifth planet from the Sun, and the largest in the solar system."),
    ("What is gravity?", "Its gravity holds the solar system together."),
    ("What is an atom?", "Atoms are the smallest units of an element."),
    ("What is a magnet?", "A magnet is not a battery."),
    ("Who painted the Mona Lisa?", "The Mona Lisa was painted by Leonardo da Vinci."),
    ("Who painted the Mona Lisa?", "The Mona Lisa hangs in the Louvre."),
    ("When did World War II end?", "World War II ended in 1945."),
    ("When did World War II end?", "World War II involved most of the world's nations."),
    ("How hot is the sun?", "The Sun's surface is about 5,500 degrees Celsius."),
    ("How hot is the sun?", "The Sun is very hot."),
    ("Where is Mount Everest?", "Mount Everest lies on the border of Nepal and China."),
    ("How do lightbulbs work?", "A lightbulb glows when current heats its filament."),
    ("And what about Mars?", "Mars is more interesting to most people than Venus."),
    ("What is my name?", "My name is Nic."),
    ("What is a volcano?", "A volcano is an opening in Earth's crust; lava erupts from it."),
    ("What is rust?", "Rust is called iron oxide."),
    ("What is quartz?", "Quartz is being mined in Brazil."),
    ("What is Saturn?", "Saturn, the sixth planet from the Sun, is known for its rings."),
]


def _anchor_memory(extra_direct=None, extra_pool=None):
    mem = json.loads(json.dumps(SEED))
    mem["anchors"] = list(STARTER) + list(extra_direct or [])
    mem["pools"] = [{"name": "anchors", "into": "anchors", "rows": list(POOL) + list(extra_pool or [])}]
    return mem


def ask(q, extra_direct=None, extra_pool=None, phone=None):
    mem = _anchor_memory(extra_direct, extra_pool)
    if phone:
        mem["phone"] = phone
    r = run({"question": q, "live": True, "memory": mem})
    e = r.get("echo") or {}
    pre = r.get("preselect") or {}
    return {"reply": r.get("reply"), "product_reply": bool(r.get("product_reply")), "echo": e.get("score"),
            "echo_pass": e.get("pass"), "echo_method": e.get("method"), "relation": e.get("relation"),
            "said": e.get("output_text"), "rests_on": (r.get("trust") or {}).get("rests_on"),
            "kept": ((pre.get("pools") or [{}])[0]).get("kept"), "calls_llm": r.get("calls_llm"),
            "write_echo_min": ((r.get("memory_write") or {}).get("write_gate") or {}).get("echo_min")}


def main() -> None:
    global STARTER, POOL
    clear_cache()
    STARTER, POOL = starter_rows(), anchor_pool()
    by_id = {r["id"]: r for r in list(POOL) + list(STARTER)}
    moon_def = dict(by_id["enc-openstax-moon"])
    moon_def.update(id="enc-test-moon-def", text="The Moon is Earth's only natural satellite.")
    bf_def = dict(by_id["enc-cia-uv-0"])
    bf_def.update(id="enc-test-bf-def", text="Burkina Faso is a landlocked country in West Africa.")
    car = [{"id": "rem-car", "text": "My car is red.", "scope": "phone", "provenance": {"requested_by": "user", "request": "remember_command", "kind": "statement"}}]
    out = {
        "thresholds": {"echo_min": THRESHOLDS["echo_min"]},
        "pairs": [{"q": q, "a": a, "reparse": rel.realises(q, a), "echo": echo_against_question(q, a, rendered=True),
                   "renderer_echo": r200.run({"op": "render", "question": q, "candidate": a, "charge": 0.55, "drift": 0.2, "chi": 0}).get("echo")}
                  for q, a in PAIRS],
        "asked": {q: rel.asked(q) for q, _ in PAIRS},
        "dna": ask("What is DNA?"),
        "moon": ask("What is the Moon?"),
        "moon_def": ask("What is the Moon?", extra_direct=[moon_def]),
        "burkina": ask("What is Burkina Faso?"),
        "burkina_def": ask("What is Burkina Faso?", extra_pool=[bf_def]),
        "burkina_capital": ask("What is the capital of Burkina Faso?"),
        "burkina_capital_def": ask("What is the capital of Burkina Faso?", extra_pool=[bf_def]),
        "sky": ask("Why is the sky blue?"),
        "ocean": ask("Why is the ocean salty?"),
        "math": ask("What is 17 times 23?"),
        "car": ask("What color is my car?", phone=car),
        "car_wrong": ask("Is my car blue?", phone=car),
        "phase": {
            "int4": rr._phase_value(4), "float49": rr._phase_value(4.9), "str45": rr._phase_value("Φ4.5"), "float40": rr._phase_value(4.0),
            "bad0": rr._phase_value(0), "bad10": rr._phase_value(10.0), "bool": rr._phase_value(True),
            "d_4_45": round(rr._circular_delta(4, 4.5), 6), "d_4_56": round(rr._circular_delta(4, 5.6), 6),
            "aligned_4_45": rr.phase_aligned(4, 4.5), "aligned_4_56": rr.phase_aligned(4, 5.6), "aligned_4_5": rr.phase_aligned(4, 5),
            "grace_45": rr._grace({"Phi": 4.5, "eps": 0.0, "mu": 1.0}, 4), "grace_5": rr._grace({"Phi": 5, "eps": 0.0, "mu": 1.0}, 4),
            "grace_49_vs_4": rr._grace({"Phi": 4.9, "eps": 0.0, "mu": 1.0}, 4),
            "placed": rr.place_packet({"text": "x", "sfe": {"Phi": 4.5, "eps": 0.0, "mu": 1.0}}, quarantined=False)["sfe"],
            "placed_int": rr.place_packet({"text": "x", "sfe": {"Phi": 4, "eps": 0.0, "mu": 1.0}}, quarantined=False)["sfe"],
        },
    }
    print(json.dumps(out, ensure_ascii=False, default=str))


STARTER: list = []
POOL: list = []

if __name__ == "__main__":
    main()
