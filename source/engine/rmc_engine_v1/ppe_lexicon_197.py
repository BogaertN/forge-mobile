"""4.9.197 Phase Parsing Engine lexicon. Stdlib. No LLM.

Calls the 4.9.191 seed lexicon and letter map. Does not copy them.
Calls drift_v43.charge_step and step_flag. Does not copy the meter.
HarperScript is loaded read-only for the diff. It does not place a letter.

Decision 3 ε/μ is proposal v1 on every seed. Birth state stays ε₀=0, μ_init=1.0.
The letter map assigns a packet. It does not admit and it does not recall.
"""
from __future__ import annotations

import json
import math
from pathlib import Path
from typing import Any

from rmc_engine_v1.drift_v43 import C_MIN, ECHO_MIN, PHASE_NAMES, charge_step, step_flag
from rmc_engine_v1.lexicon_resonance import (
    angle_degrees,
    letter_map_authority,
    letter_rows,
    phase_profile,
    place_word,
    proposal_v1_count,
    seed_rows,
    word_count,
)

REFERENCE = Path(__file__).resolve().parent / "reference"
PROVENANCE = "proposal v1"
PHI_MAX = 9
ANGLE = "θ=(Φ−1)·40°"
DRIFT_WORDS = ("try", "maybe", "deserve")
COHERENT_WORDS = ("create", "reflect", "name")
EXCESS_PHI5 = 3
CITE = (
    "PPE KPI A–Z is letter_phase_map_v1, Phase Parsing Engine, not HarperScript. "
    "WLM roles: HarperScript word-loop table, READ192 §4, Excess Φ5 with no Φ6 is a Drift Carrier. "
    "DDS signatures: Phase Parsing Engine drift signature table. "
    "Decision 2 θ=(Φ−1)·40°. Decision 3 ε/μ is proposal v1. "
    "Birth ε₀=0, μ_init=1.0, RSOC Phase 1 l.2719 and l.2960, READ192 §3. "
    "M charge is the KPI table −2, not the JSON example −1, READ192 §2.8. "
    "Glyph lookup is the Phase Glyph Codex. Codex charge meter is drift_v43.charge_step, a l.2079–2081. "
    "UA gives no word ε/μ, READ_NEW_PDFS §B. The letter map does not admit. No LLM."
)
M_CONFLICT = {
    "letter": "M",
    "table_charge": -2,
    "example_charge": -1,
    "used": -2,
    "flag": "KPI-M-CHARGE",
    "status": "flagged",
    "cite": "HarperScript KPI table M charge −2. JSON example charge −1. READ192 §2.8. The table wins.",
}
STABILITY_EXAMPLE = {
    "word": "remember",
    "documented": 3.2,
    "formula": "unspecified",
    "used": False,
    "cite": "HarperScript remember stability rating 3.2. READ192 §3. No formula is stated.",
}
PCM_EXAMPLE = {
    "documented_sum": 8,
    "used": False,
    "cite": (
        "PPE PCM worked trail states +8. The per-phase examples do not form a complete table, "
        "and the printed terms do not add to +8. Letter charge uses the KPI table. "
        "The word meter calls drift_v43.charge_step."
    ),
}
ROLE_ORDER = (
    "full_spectrum",
    "recursive_seal",
    "drift_carrier",
    "identity_beacon",
    "growth_under_pressure",
    "question_marker",
)
ROLE_NAMES = {
    "full_spectrum": "Full Spectrum Word",
    "recursive_seal": "Recursive Seal",
    "drift_carrier": "Drift Carrier",
    "identity_beacon": "Identity Beacon",
    "growth_under_pressure": "Growth Under Pressure",
    "question_marker": "Question Marker",
}


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
        "resonance_not_parsing": True,
    }


def _std(values: list[int]) -> float:
    if len(values) < 2:
        return 0.0
    mean = sum(values) / len(values)
    return math.sqrt(sum((item - mean) ** 2 for item in values) / len(values))


def _clamp01(value: float) -> float:
    if value < 0:
        return 0.0
    if value > 1:
        return 1.0
    return value


def _show(value: Any) -> str:
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, int):
        return str(value)
    if isinstance(value, float):
        if value.is_integer():
            return str(int(value))
        return f"{value:.6f}".rstrip("0").rstrip(".")
    return str(value)


def _harper() -> dict[str, Any]:
    path = REFERENCE / "harper_visual_manifest_v1.json"
    return json.loads(path.read_text(encoding="utf-8"))


def _letters_of(word: str) -> list[dict[str, Any]]:
    rows = letter_rows()
    out = []
    for ch in str(word or "").upper():
        if not ("A" <= ch <= "Z"):
            continue
        spec = rows.get(ch)
        if not isinstance(spec, dict):
            continue
        phase = str(spec.get("phase") or "")
        if len(phase) != 2 or phase[1] not in "123456789":
            continue
        try:
            charge = int(spec.get("charge"))
        except (TypeError, ValueError):
            charge = 0
        out.append({
            "letter": ch,
            "phase": int(phase[1]),
            "charge": charge,
            "drift": bool(spec.get("drift_flag")),
            "fn": spec.get("symbolic_fn") or "",
        })
    return out


def _counts(phases: list[int]) -> dict[int, int]:
    counts: dict[int, int] = {}
    for phase in phases:
        counts[phase] = counts.get(phase, 0) + 1
    return counts


def _roles(phases: list[int]) -> dict[str, Any]:
    counts = _counts(phases)
    present = set(phases)
    matched = []
    if {1, 2, 3, 4, 5, 6, 7}.issubset(present):
        matched.append("full_spectrum")
    if phases and phases[0] == 1 and phases[-1] == 9:
        matched.append("recursive_seal")
    if counts.get(5, 0) >= EXCESS_PHI5 and 6 not in present:
        matched.append("drift_carrier")
    mode = None
    if counts:
        ranked = sorted(counts.items(), key=lambda item: (-item[1], item[0]))
        if len(ranked) == 1 or ranked[0][1] > ranked[1][1]:
            mode = ranked[0][0]
    if mode in (6, 7):
        matched.append("identity_beacon")
    if phases and sum(1 for phase in phases if phase in (3, 4, 5)) * 2 > len(phases):
        matched.append("growth_under_pressure")
    if len(phases) >= 2 and all(phase in (2, 4) for phase in phases) and all(phases[i] != phases[i - 1] for i in range(1, len(phases))):
        matched.append("question_marker")
    ordered = [name for name in ROLE_ORDER if name in matched]
    role = ROLE_NAMES[ordered[0]] if ordered else "unassigned"
    return {
        "role": role,
        "also": [ROLE_NAMES[name] for name in ordered[1:]],
        "precedence": "table order; Drift Carrier is before Growth Under Pressure so a Φ5 stack stays a Drift Carrier",
        "precedence_stated": False,
        "cite": "HarperScript WLM Symbolic Role Assignment Table. READ192 §4. Excess Φ5 with no Φ6 is a Drift Carrier. Precedence is not stated.",
    }


def _meter(phases: list[int]) -> dict[str, Any]:
    current = 0.0
    skips = 0
    lawful = 0
    for index in range(1, len(phases)):
        flag = step_flag(phases[index], phases[index - 1])
        row = charge_step(current, flag == 0)
        current = row["charge_next"]
        if row["lawful"]:
            lawful += 1
        else:
            skips += 1
    return {
        "start": 0.0,
        "charge": current,
        "lawful_steps": lawful,
        "skips": skips,
        "logged_only": True,
        "cite": "Codex resonance_charge_meter, a l.2079–2081, through drift_v43.charge_step. A UA-stable step is +0.1. A skip is −0.3. Clamp 0–1. It does not admit.",
    }


def _forbidden(phases: list[int]) -> bool:
    for index in range(1, len(phases)):
        if phases[index - 1] == 5 and phases[index] == 8:
            return True
    return False


def _signatures(phases: list[int], scope: str) -> list[dict[str, Any]]:
    counts = _counts(phases)
    present = set(phases)
    rows = []

    def add(name: str, hit: bool, reaction: str, pattern: str) -> None:
        rows.append({
            "name": name,
            "hit": hit,
            "reaction": reaction,
            "pattern": pattern,
            "christping_started": False,
            "cold_store_write": False,
            "admit_gate": False,
            "logged_only": True,
        })

    add(
        "Phase 5 Overload",
        counts.get(5, 0) >= EXCESS_PHI5 and 6 not in present,
        "Drift Warning → ChristPing",
        "Φ5 appears three or more times without Φ6",
    )
    add(
        "Phase Skip Spiral",
        any(phases[i - 1] == 4 and phases[i] == 8 for i in range(1, len(phases))),
        "Drift Alert → Loop Correction",
        "Φ4 to Φ8 jump, bypassing Φ6 and Φ7",
    )
    add(
        "Identity Suppression",
        scope == "sentence" and 7 not in present and len(phases) >= 2,
        "Self Loss Alert → Vector Scan",
        "Absence of Φ7 over time. A single word does not fire it.",
    )
    first_nine = next((i for i, phase in enumerate(phases) if phase == 9), None)
    saw_one = first_nine is not None and 1 in phases[:first_nine]
    add(
        "False Closure",
        first_nine is not None and not saw_one,
        "Ghost Loop Route → Cold Store",
        "Φ9 without a Φ1 before it. Operational reading of valid loop progression. The doc does not define the predicate.",
    )
    add(
        "Overdrive Projection",
        any(phases[i - 1] == 3 and phases[i] == 8 for i in range(1, len(phases))),
        "Entropy Warning → Pulse Cutoff",
        "Φ3 to Φ8 burst without reflection",
    )
    return rows


def _proposal(parts: list[dict[str, Any]]) -> dict[str, Any]:
    phases = [part["phase"] for part in parts]
    drift_mass = sum(abs(part["charge"]) for part in parts if part["drift"])
    total_mass = sum(abs(part["charge"]) for part in parts)
    drift_count = sum(1 for part in parts if part["drift"])
    if not parts:
        eps = 0.0
    elif total_mass == 0:
        eps = drift_count / len(parts)
    else:
        eps = drift_mass / total_mass
    mu = _clamp01(1.0 - _std(phases) / PHI_MAX)
    return {
        "eps": _clamp01(eps),
        "mu": mu,
        "provenance": PROVENANCE,
        "eps0": 0,
        "mu_init": 1.0,
        "phi_max": PHI_MAX,
        "morphemes": "unspecified",
        "cite": (
            "Decision 3 proposal v1. ε is the KPI-charge-weighted share of drift-flag letters, clamped 0–1. "
            "A morpheme drift list is not stated, so the letter drift_flag list is the list. "
            "μ = 1 − σ(letter phases) / 9. σ is the population standard deviation. "
            "Birth ε₀=0 and μ_init=1.0 stay beside the proposal. RSOC l.2719 and l.2960. READ_NEW_PDFS §B."
        ),
    }


def _distribution(phases: list[int]) -> dict[str, Any]:
    counts = _counts(phases)
    return {
        "counts": {str(phase): counts.get(phase, 0) for phase in range(1, 10)},
        "phi6_absent": 6 not in counts,
        "cite": "PPE PCM phase distribution. Φ6 absence is flagged. It does not admit.",
    }


def word(text: str, scope: str = "word") -> dict[str, Any]:
    placed = place_word(text)
    key = placed["word"]
    parts = _letters_of(key)
    phases = [part["phase"] for part in parts]
    proposal = _proposal(parts)
    phi = placed.get("Phi")
    profile = phase_profile(phi if isinstance(phi, int) else None)
    names = PHASE_NAMES
    phase_name = names.get(phi, "") if isinstance(phi, int) else ""
    row = {
        "word": key,
        "Phi": phi,
        "phase": ("Φ" + str(phi)) if isinstance(phi, int) else None,
        "phase_name": phase_name,
        "codex_phase_name": profile.get("phase_name") or placed.get("name") or "",
        "glyph": placed.get("glyph") or profile.get("glyph") or "",
        "angle": ANGLE if isinstance(phi, int) else "unspecified",
        "angle_degrees": angle_degrees(phi) if isinstance(phi, int) else None,
        "angle_label": "derived from Breadboard",
        "eps": proposal["eps"],
        "mu": proposal["mu"],
        "provenance": PROVENANCE,
        "eps0": 0,
        "mu_init": 1.0,
        "charge_sum": sum(part["charge"] for part in parts),
        "meter": _meter(phases),
        "role": _roles(phases),
        "distribution": _distribution(phases),
        "signatures": _signatures(phases, scope),
        "forbidden_5_to_8": _forbidden(phases),
        "drift_list_example": key in DRIFT_WORDS,
        "coherent_list_example": key in COHERENT_WORDS,
        "authority": placed.get("authority"),
        "map_authority": placed.get("map_authority"),
        "not_map_authority": placed.get("not_map_authority"),
        "how": placed.get("how"),
        "seed_phase": placed.get("seed_phase"),
        "letter_phases": phases,
        "placement_eps": placed.get("eps"),
        "placement_mu": placed.get("mu"),
    }
    row.update(flags())
    return row


def _compact(row: dict[str, Any]) -> dict[str, Any]:
    meter = row["meter"]
    return {
        "word": row["word"],
        "Phi": row["Phi"],
        "phase_name": row["phase_name"],
        "glyph": row["glyph"],
        "angle": row["angle"],
        "angle_degrees": row["angle_degrees"],
        "eps": row["eps"],
        "mu": row["mu"],
        "provenance": row["provenance"],
        "eps0": row["eps0"],
        "mu_init": row["mu_init"],
        "role": row["role"]["role"],
        "charge_sum": row["charge_sum"],
        "meter": meter["charge"],
        "forbidden_5_to_8": row["forbidden_5_to_8"],
        "admit_gate": False,
    }


def seeds() -> dict[str, Any]:
    rows = []
    missing = 0
    for key in sorted(seed_rows()):
        row = word(key)
        if row["Phi"] is None or row["angle_degrees"] is None or row["provenance"] != PROVENANCE:
            missing += 1
        if row["eps0"] != 0 or row["mu_init"] != 1.0:
            missing += 1
        rows.append(_compact(row))
    report = {
        "count": word_count(),
        "tagged": len(rows),
        "missing": missing,
        "provenance": PROVENANCE,
        "seed_file_proposal_v1": proposal_v1_count(),
        "eps0": 0,
        "mu_init": 1.0,
        "angle": ANGLE,
        "rows": rows,
        "cite": CITE,
    }
    report.update(flags())
    return report


def glyph_for(phi: int) -> dict[str, Any]:
    profile = phase_profile(phi)
    row = {
        "phi": phi,
        "phase": "Φ" + str(phi),
        "phase_name": PHASE_NAMES.get(phi, ""),
        "glyph": profile.get("glyph") or "",
        "source": "phase_codex_v2_5",
        "copied_dictionary": False,
        "cite": "Codex glyph_dictionary.json lookup, a l.3991–3999. The lookup is the Phase Glyph Codex loader. No second glyph table is stored.",
    }
    row.update(flags())
    return row


def harper_diff() -> dict[str, Any]:
    manifest = _harper()
    historical = manifest.get("letters") or {}
    letters = letter_rows()
    rows = []
    phase_conflicts = []
    for ch in "ABCDEFGHIJKLMNOPQRSTUVWXYZ":
        ppe = letters.get(ch) or {}
        old = historical.get(ch) or {}
        ppe_phase = str(ppe.get("phase") or "")
        ppe_index = int(ppe_phase[1]) if len(ppe_phase) == 2 and ppe_phase[1] in "123456789" else None
        numbers = old.get("phase_numbers") or []
        match = numbers == [ppe_index]
        item = {
            "letter": ch,
            "ppe_phase": ppe_phase,
            "ppe_fn": ppe.get("symbolic_fn") or "",
            "ppe_charge": ppe.get("charge"),
            "harper_phase": old.get("phase") or "",
            "harper_fn": old.get("symbolic_fn") or "",
            "phase_match": match,
            "used": "Phase Parsing Engine",
        }
        rows.append(item)
        if not match:
            phase_conflicts.append(ch)
    used = letter_rows().get("M", {}).get("charge")
    report = {
        "map_authority": letter_map_authority().get("map_authority"),
        "not_map_authority": letter_map_authority().get("not_map_authority"),
        "historical_loaded": manifest.get("authority") == "historical",
        "historical_places": False,
        "phase_conflicts": phase_conflicts,
        "phase_conflict_count": len(phase_conflicts),
        "m": M_CONFLICT,
        "m_table_used": used == -2,
        "rows": rows,
        "cite": "Decision 1. PPE KPI wins. HarperScript visual manifest is read-only. READ192 §2.8.",
    }
    report.update(flags())
    return report


def examples() -> dict[str, Any]:
    remember = word("remember")
    transform = word("transform")
    create = word("create")
    report = {
        "remember_role": remember["role"]["role"],
        "remember_example_role": "Drift Marker / Memory Capsule",
        "remember_example_role_used": False,
        "remember_eps": remember["eps"],
        "remember_mu": remember["mu"],
        "remember_charge_sum": remember["charge_sum"],
        "remember_phi": remember["Phi"],
        "remember_phase_name": remember["phase_name"],
        "remember_glyph": remember["glyph"],
        "remember_angle_degrees": remember["angle_degrees"],
        "remember_provenance": remember["provenance"],
        "remember_eps0": remember["eps0"],
        "remember_mu_init": remember["mu_init"],
        "remember_forbidden": remember["forbidden_5_to_8"],
        "remember_overload": remember["signatures"][0]["hit"],
        "remember_christping_started": False,
        "transform_role": transform["role"]["role"],
        "transform_example_role": "Harmonic Transition Vector",
        "transform_example_role_used": False,
        "transform_charge_sum": transform["charge_sum"],
        "transform_documented_charge": 3,
        "transform_charge_flag": "KPI-M-CHARGE",
        "stability": STABILITY_EXAMPLE,
        "pcm": PCM_EXAMPLE,
        "create_phi": create["Phi"],
        "create_provenance": create["provenance"],
        "create_coherent_list": create["coherent_list_example"],
        "try_drift_list": word("try")["drift_list_example"],
        "try_admit_gate": False,
        "ep_forbidden": word("ep")["forbidden_5_to_8"],
        "sky_phi": word("sky")["Phi"],
        "leaves_phi": word("leaves")["Phi"],
        "ocean_phi": word("ocean")["Phi"],
        "cite": CITE,
    }
    report.update(flags())
    return report


def stage(question: str | None = None) -> dict[str, Any]:
    from rmc_engine_v1.lexicon_resonance import tokens

    picked = []
    for token in tokens(question or ""):
        picked.append(_compact(word(token)))
        if len(picked) == 6:
            break
    if not picked:
        picked = [_compact(word(name)) for name in ("sky", "leaves", "ocean")]
    diff = harper_diff()
    row = {
        "seeds": word_count(),
        "provenance": PROVENANCE,
        "eps0": 0,
        "mu_init": 1.0,
        "angle": ANGLE,
        "m_charge": M_CONFLICT["used"],
        "m_example_charge": M_CONFLICT["example_charge"],
        "m_flag": M_CONFLICT["flag"],
        "harper_phase_conflicts": diff["phase_conflict_count"],
        "map_authority": diff["map_authority"],
        "not_map_authority": diff["not_map_authority"],
        "words": picked,
        "seed_file_proposal_v1": proposal_v1_count(),
        "cite": CITE,
    }
    row.update(flags())
    return row


def monitor_lines(mode: str | None = None) -> dict[str, Any]:
    if mode == "harper":
        diff = harper_diff()
        letters = ", ".join(diff["phase_conflicts"])
        return {
            "attrs": {"mode": "harper", "status": diff["m"]["flag"], "detail": str(diff["phase_conflict_count"])},
            "lines": [
                "Letter map: " + str(diff["map_authority"]) + ". Not " + str(diff["not_map_authority"]) + ".",
                "M charge used is " + str(diff["m"]["used"]) + ". The JSON example says " + str(diff["m"]["example_charge"]) + ". Flag " + diff["m"]["flag"] + ".",
                "HarperScript phase conflicts: " + letters + ".",
                "The historical manifest does not place a letter.",
                "This card does not admit. C_min " + str(C_MIN) + ". No LLM.",
            ],
        }
    if mode == "drift":
        sample = examples()
        return {
            "attrs": {"mode": "drift", "status": sample["remember_role"], "detail": "5to8-" + str(sample["ep_forbidden"]).lower()},
            "lines": [
                "remember is " + sample["remember_role"] + ". Φ" + str(sample["remember_phi"]) + " " + sample["remember_phase_name"] + " glyph " + sample["remember_glyph"] + ". ε " + _show(sample["remember_eps"]) + " μ " + _show(sample["remember_mu"]) + " " + sample["remember_provenance"] + ".",
                "Birth state ε " + _show(sample["remember_eps0"]) + " μ " + _show(sample["remember_mu_init"]) + ". θ " + str(sample["remember_angle_degrees"]) + "°.",
                "Phase 5 Overload is logged. ChristPing started: " + str(sample["remember_christping_started"]).lower() + ".",
                "ep walks Φ5 then Φ8. Forbidden flag " + str(sample["ep_forbidden"]).lower() + ". It does not admit.",
                "transform charge sum is " + str(sample["transform_charge_sum"]) + ". The worked example says " + str(sample["transform_documented_charge"]) + " because it uses M −1. Flag " + sample["transform_charge_flag"] + ".",
                "This card does not admit. C_min " + str(C_MIN) + ". No LLM.",
            ],
        }
    sample = examples()
    sky = word("sky")
    leaves = word("leaves")
    ocean = word("ocean")
    return {
        "attrs": {"mode": "seeds", "status": PROVENANCE, "detail": str(word_count())},
        "lines": [
            str(word_count()) + " seeds. Provenance " + PROVENANCE + ". Birth ε 0 μ 1.0. θ=(Φ−1)·40°.",
            "sky · Φ" + str(sky["Phi"]) + " " + sky["phase_name"] + " · glyph " + sky["glyph"] + " · θ " + str(sky["angle_degrees"]) + "° · ε " + _show(sky["eps"]) + " · μ " + _show(sky["mu"]),
            "leaves · Φ" + str(leaves["Phi"]) + " " + leaves["phase_name"] + " · glyph " + leaves["glyph"] + " · θ " + str(leaves["angle_degrees"]) + "° · ε " + _show(leaves["eps"]) + " · μ " + _show(leaves["mu"]),
            "ocean · Φ" + str(ocean["Phi"]) + " " + ocean["phase_name"] + " · glyph " + ocean["glyph"] + " · θ " + str(ocean["angle_degrees"]) + "° · ε " + _show(ocean["eps"]) + " · μ " + _show(ocean["mu"]),
            "remember " + sample["remember_role"] + " · create Φ" + str(sample["create_phi"]) + " · the 4.9.191 seed file still has " + str(proposal_v1_count()) + " proposal tags.",
            "M charge −2 is the table. The example −1 is flagged. This card does not admit. No LLM.",
        ],
    }


def run(payload: dict[str, Any] | None = None) -> dict[str, Any]:
    row = payload or {}
    op = row.get("op") or "seeds"
    if op == "word":
        return word(str(row.get("word") or ""), str(row.get("scope") or "word"))
    if op == "harper":
        return harper_diff()
    if op == "examples":
        return examples()
    if op == "glyph":
        try:
            phi = int(row.get("phi") or 1)
        except (TypeError, ValueError):
            phi = 1
        return glyph_for(phi)
    if op == "stage":
        return stage(row.get("question"))
    if op == "monitor":
        return monitor_lines(row.get("mode") or "seeds")
    if op == "summary":
        full = seeds()
        return {key: value for key, value in full.items() if key != "rows"} | {"checked": len(full["rows"])}
    return seeds()


if __name__ == "__main__":
    import sys

    print(json.dumps(run(json.load(sys.stdin))))
