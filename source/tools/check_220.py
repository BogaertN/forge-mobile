"""4.9.220 checks: Athena places each fact she writes (decimal phase from content + its band). No network, no writes."""
import json, os, sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "engine"))
from rmc_engine_v1 import band_tuning as bt
from rmc_engine_v1 import self_seed_202 as ss

SAMPLES = ["Ouagadougou is the capital of Burkina Faso.", "Gravity is a force that pulls objects together.",
           "The Moon is Earth's only natural satellite.", "Mercury is the smallest planet in the Solar System.",
           "Lima is the capital of Peru.", "DNA, or deoxyribonucleic acid, is the hereditary material in humans.",
           "Photosynthesis is essential to all life on earth.", "Tokyo is the capital of Japan.", "hello", ""]
out = {"places": [], "by_phase": {}}
for t in SAMPLES:
    sp = ss.sentence_placement(t)
    p = bt.place(t, sp["phi"] or 1, {"concept": sp.get("concept")})
    out["places"].append({"text": t, "phase_int": sp["phi"], "Phi": p["Phi"], "phase": p["phase"], "band": p["band"]["band"], "hz": p["band"]["hz"]})
for ph in range(1, 10):
    p = bt.place("Gravity is a force that pulls objects together.", ph)
    out["by_phase"][ph] = {"Phi": p["Phi"], "band_of": bt.band_of(p["Phi"]), "hz": p["band"]["hz"], "in": bt.in_band(ph, p["band"]["hz"])}
row = {"text": "Ouagadougou is the capital of Burkina Faso.", "phi": 6, "host": "example.org", "url": "https://example.org/a", "license": "CC0",
       "license_url": "", "fetched_at": "2026-11-04T00:00:00Z", "sha256": "0" * 64, "tier": 1, "concept": "A.BURKINAFASO", "delta": 0, "echo": 1.0}
a = ss._anchor_from("What is the capital of Burkina Faso?", row, 6, [row])
out["anchor_packet"] = {"sfe_Phi": a["packet"]["sfe"]["Phi"], "band": a["packet"]["band"]["band"], "placement": a["packet"]["placement"]}
print(json.dumps(out, sort_keys=True))
