"""4.9.198 Lexicon Growth Engine. Stdlib. No LLM.

Unknown words get a packet from the 4.9.197 letter map. No keyword scan.
Birth state is ε=0, μ=1.0, tagged proposal v1. Operators wait for 4.9.199.
Provisional until C≥0.87 and Echo≥0.85 across uses and drift<0.3.
A name seals at Φ≥7, echo confirmed, drift<0.2, through the 4.9.195 archive.
Drift above the write law quarantines. Φ5→Φ8 never promotes. Mask ≥0.70 denies.
"""
from __future__ import annotations

import json
import math
from typing import Any

from rmc_engine_v1.dpa_195 import append_dead_path, empty_archive, seal_loop, sha256, verify_archive
from rmc_engine_v1.drift_v43 import C_MIN, ECHO_MIN, MASK_SIM, WRITE_MAX, drift_mask
from rmc_engine_v1.language_core_engines import HARD_STOP
from rmc_engine_v1.lexicon_resonance import angle_degrees, seed_rows, tokens, word_count
from rmc_engine_v1.ppe_lexicon_197 import word as ppe_word

MEMORY_DRIFT = 0.3
NAMING_DRIFT = 0.2
NAMING_PHI = 7
USES_MIN = 2
STORAGE_KEY = "kernel.lexicon_growth_198"
PROVENANCE = "proposal v1"
ANGLE = "θ=(Φ−1)·40°"
CITE = (
    "Lexicon Growth Engine. HarperScript l.616. SLB l.646. SRL l.806. "
    "Birth ε=0 μ=1.0 is RSOC Phase 1. Promotion needs C≥0.87 and Echo≥0.85 across uses, "
    "and drift<0.3 (Codex memory stack 3.15, a l.2736). A name seals only at Φ≥7 with echo confirmed "
    "and drift<0.2 (Codex naming_engine 3.21, a l.3313–3341) through the 4.9.195 archive. "
    "Drift above the write law is χ quarantine. A Φ5→Φ8 letter walk is flagged and never promoted. "
    "Drift-mask similarity ≥0.70 denies (Codex Ch.4, a l.4001–4006). Phase and glyph come from the 4.9.197 letter map. "
    "θ=(Φ−1)·40°. The value tag is proposal v1. RSOC operator evolution is 4.9.199 and is not applied. No LLM."
)


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
        "memory_drift_max": MEMORY_DRIFT,
        "naming_drift_max": NAMING_DRIFT,
        "naming_phi_min": NAMING_PHI,
        "uses_min": USES_MIN,
        "mask_threshold": MASK_SIM,
        "resonance_not_parsing": True,
        "operators_applied": False,
        "geometry_build": "4.9.199",
        "coherence_formula_unchanged": True,
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


def empty() -> dict[str, Any]:
    return {"schema": "FORGE-LEXICON-GROWTH/v1", "words": {}, "seen": {}, "archive": empty_archive()}


def unique_tokens(text: str) -> list[str]:
    out: list[str] = []
    seen: dict[str, bool] = {}
    for token in tokens(text):
        if token not in seen:
            seen[token] = True
            out.append(token)
    return out


def _radians(index: int) -> float:
    return angle_degrees(index) * math.pi / 180.0


def aligned(a: Any, b: Any) -> bool:
    if not (isinstance(a, int) and isinstance(b, int) and 1 <= a <= 9 and 1 <= b <= 9):
        return False
    gap = abs(_radians(a) - _radians(b))
    wrapped = min(gap, math.tau - gap)
    return wrapped <= (math.pi / 4) + 1e-12


def birth_packet(token: str) -> dict[str, Any]:
    row = ppe_word(token)
    phi = row.get("Phi")
    return {
        "word": row["word"],
        "Phi": phi,
        "phase_name": row["phase_name"],
        "glyph": row.get("glyph") or "",
        "angle": ANGLE if isinstance(phi, int) else "unspecified",
        "angle_degrees": row.get("angle_degrees"),
        "eps": 0,
        "mu": 1,
        "provenance": PROVENANCE,
        "eps0": 0,
        "mu_init": 1,
        "eps_proposal": row["eps"],
        "mu_proposal": row["mu"],
        "how": row.get("how"),
        "authority": row.get("authority"),
        "forbidden_5_to_8": bool(row.get("forbidden_5_to_8")),
        "letter_phases": list(row.get("letter_phases") or []),
        "schema": "FORGE-RESONANCE-PACKET/v1",
    }


def chain_ok(store: dict[str, Any]) -> bool:
    return bool(verify_archive(store["archive"]).get("ok"))


def stats_of(entry: dict[str, Any]) -> dict[str, Any]:
    uses = entry["uses"]
    c_min = uses[0]["C"]
    echo_min = uses[0]["echo"]
    drift_max = uses[0]["drift"]
    questions_match = True
    for use in uses:
        if use["C"] < c_min:
            c_min = use["C"]
        if use["echo"] < echo_min:
            echo_min = use["echo"]
        if use["drift"] > drift_max:
            drift_max = use["drift"]
        if use["question"] != entry["question"]:
            questions_match = False
    phi = entry["packet"]["Phi"]
    return {
        "cMin": c_min,
        "echoMin": echo_min,
        "driftMax": drift_max,
        "questionsMatch": questions_match,
        "namingPhi": isinstance(phi, int) and phi >= NAMING_PHI,
        "namingEcho": questions_match and echo_min >= ECHO_MIN,
        "namingDrift": drift_max < NAMING_DRIFT,
    }


def view(entry: dict[str, Any], store: dict[str, Any]) -> dict[str, Any]:
    packet = entry["packet"]
    stats = stats_of(entry)
    shown = {
        "schema": packet["schema"],
        "Phi": packet["Phi"],
        "eps": packet["eps"],
        "mu": packet["mu"],
        "glyph": packet["glyph"],
        "angle": packet["angle"],
        "angle_degrees": packet["angle_degrees"],
        "phase_name": packet["phase_name"],
        "provenance": packet["provenance"],
        "eps0": packet["eps0"],
        "mu_init": packet["mu_init"],
        "eps_proposal": packet["eps_proposal"],
        "mu_proposal": packet["mu_proposal"],
        "how": packet["how"],
        "authority": packet["authority"],
    }
    return {
        "word": entry["word"],
        "tier": entry["tier"],
        "known": False,
        "usable": entry["tier"] == "promoted",
        "source": "growth",
        "packet": shown,
        "Phi": packet["Phi"],
        "phase_name": packet["phase_name"],
        "glyph": packet["glyph"],
        "angle_degrees": packet["angle_degrees"],
        "eps": packet["eps"],
        "mu": packet["mu"],
        "provenance": packet["provenance"],
        "forbidden_5_to_8": packet["forbidden_5_to_8"],
        "letter_phases": list(packet["letter_phases"]),
        "uses": len(entry["uses"]),
        "uses_detail": [
            {
                "content_id": use["content_id"],
                "contributor": use["contributor"],
                "timestamp": use["timestamp"],
                "question": use["question"],
                "C": use["C"],
                "echo": use["echo"],
                "drift": use["drift"],
                "counts": use["question"] == entry["question"],
            }
            for use in entry["uses"]
        ],
        "c_min": stats["cMin"],
        "echo_min": stats["echoMin"],
        "drift_max": stats["driftMax"],
        "questions_match": stats["questionsMatch"],
        "promoted": entry["tier"] == "promoted",
        "sealed": entry["sealed"],
        "quarantined": entry["tier"] == "quarantine",
        "denied": entry["tier"] == "denied",
        "chi": entry["chi"],
        "hard_stop": entry["hard_stop"],
        "mask_hit": entry["mask_hit"],
        "content_id": entry["content_id"],
        "input_id": entry["birth_input_id"],
        "contributor": entry["contributor"],
        "timestamp": entry["timestamp"],
        "question": entry["question"],
        "naming_phi": stats["namingPhi"],
        "naming_echo": stats["namingEcho"],
        "naming_drift": stats["namingDrift"],
        "seal_rule": entry["seal_rule"],
        "seal_sha256": entry["seal_sha256"],
        "archive_kind": entry["archive_kind"],
        "archive_rule": entry["archive_rule"],
        "archive_sha256": entry["archive_sha256"],
        "chain_ok": chain_ok(store),
    }


def known_view(token: str) -> dict[str, Any]:
    row = ppe_word(token)
    return {
        "word": row["word"],
        "known": True,
        "tier": "lexicon",
        "source": "seed",
        "usable": True,
        "Phi": row["Phi"],
        "phase_name": row["phase_name"],
    }


def archive_quarantine(store: dict[str, Any], entry: dict[str, Any], use: dict[str, Any]) -> None:
    if entry["archive_kind"]:
        return
    phase = entry["packet"]["Phi"]
    if not (isinstance(phase, int) and 1 <= phase <= 9):
        entry["archive_rule"] = "DPA-PHASE"
        return
    appended = append_dead_path(store["archive"], {
        "id": "quarantine:" + entry["word"],
        "psi": entry["content_id"],
        "phase": phase,
        "ts": use["timestamp"],
        "entropy": use["drift"],
        "epsilon_s": use["drift"],
        "reason": "quarantine",
    })
    entry["archive_kind"] = "dead_path" if appended.get("ok") else None
    entry["archive_rule"] = appended.get("rule")
    record = appended.get("record")
    entry["archive_sha256"] = record.get("sha256") if isinstance(record, dict) else None


def seal_name(store: dict[str, Any], entry: dict[str, Any], stats: dict[str, Any]) -> None:
    if entry["sealed"]:
        return
    appended = seal_loop(store["archive"], {
        "id": "lexicon:" + entry["word"],
        "psi": entry["content_id"],
        "phase": entry["packet"]["Phi"],
        "ts": entry["uses"][-1]["timestamp"],
        "entropy": stats["driftMax"],
        "epsilon_s": stats["driftMax"],
        "echo": stats["echoMin"],
        "question": entry["question"],
    })
    entry["seal_rule"] = appended.get("rule")
    entry["sealed"] = bool(appended.get("ok"))
    record = appended.get("record")
    entry["seal_sha256"] = record.get("sha256") if isinstance(record, dict) else None
    if appended.get("ok") and isinstance(record, dict):
        entry["archive_kind"] = "sealed_loop"
        entry["archive_rule"] = appended.get("rule")
        entry["archive_sha256"] = record.get("sha256")


def evaluate(store: dict[str, Any], entry: dict[str, Any]) -> None:
    if entry["tier"] in ("quarantine", "denied"):
        return
    stats = stats_of(entry)
    hard = any(use["drift"] > HARD_STOP for use in entry["uses"])
    if stats["driftMax"] > WRITE_MAX:
        entry["tier"] = "quarantine"
        entry["chi"] = True
        entry["hard_stop"] = hard
        archive_quarantine(store, entry, entry["uses"][-1])
        return
    if any(use["mask_hit"] for use in entry["uses"]):
        entry["tier"] = "denied"
        entry["mask_hit"] = True
        entry["hard_stop"] = False
        entry["chi"] = False
        return
    entry["hard_stop"] = False
    entry["chi"] = False
    phi = entry["packet"]["Phi"]
    ready = (
        not entry["packet"]["forbidden_5_to_8"]
        and len(entry["uses"]) >= USES_MIN
        and stats["cMin"] >= C_MIN
        and stats["namingEcho"]
        and stats["driftMax"] < MEMORY_DRIFT
        and isinstance(phi, int)
        and phi >= 1
    )
    entry["tier"] = "promoted" if ready else "provisional"
    if ready and stats["namingPhi"] and stats["namingEcho"] and stats["namingDrift"]:
        seal_name(store, entry, stats)


def classify(text: str) -> dict[str, Any]:
    known = []
    novel = []
    seeds = seed_rows()
    for token in unique_tokens(text):
        if token in seeds:
            known.append(known_view(token))
        else:
            novel.append(token)
    return {"known": known, "novel": novel}


def observe(store: dict[str, Any], spec: dict[str, Any] | None) -> dict[str, Any]:
    body = spec or {}
    text = "" if body.get("text") is None else str(body.get("text"))
    question = text if body.get("question") is None else str(body.get("question"))
    contributor = str(body.get("contributor") or "user")
    timestamp = str(body.get("timestamp") or "1970-01-01T00:00:00Z")
    measured_c = num(body.get("C"), 0)
    echo = num(body.get("echo"), 0)
    drift = num(body.get("drift"), 0)
    collapsed = body.get("collapsed") if isinstance(body.get("collapsed"), list) else []
    content_id = sha256(text)
    split = classify(text)
    if store["seen"].get(content_id):
        words = [view(store["words"][token], store) for token in split["novel"] if token in store["words"]]
        return {"idempotent": True, "content_id": content_id, "text": text, "words": words, "known": split["known"]} | flags()
    store["seen"][content_id] = True
    for token in split["novel"]:
        if token not in store["words"]:
            store["words"][token] = {
                "word": token,
                "tier": "provisional",
                "packet": birth_packet(token),
                "uses": [],
                "contributor": contributor,
                "timestamp": timestamp,
                "question": question,
                "birth_input_id": content_id,
                "content_id": sha256("growth\n" + token),
                "sealed": False,
                "seal_rule": None,
                "seal_sha256": None,
                "archive_kind": None,
                "archive_rule": None,
                "archive_sha256": None,
                "chi": False,
                "hard_stop": False,
                "mask_hit": False,
            }
        entry = store["words"][token]
        mask = drift_mask(token, collapsed)
        entry["uses"].append({
            "content_id": content_id,
            "contributor": contributor,
            "timestamp": timestamp,
            "question": question,
            "C": measured_c,
            "echo": echo,
            "drift": drift,
            "mask_hit": bool(mask.get("hit")),
        })
        if mask.get("hit"):
            entry["mask_hit"] = True
        evaluate(store, entry)
    words = [view(store["words"][token], store) for token in split["novel"]]
    return {"idempotent": False, "content_id": content_id, "text": text, "words": words, "known": split["known"]} | flags()


def recall(store: dict[str, Any], probe: dict[str, Any] | None) -> dict[str, Any]:
    body = probe or {}
    phi = None
    probe_word = ""
    if body.get("phi") is not None and body.get("phi") != "":
        try:
            n = int(body.get("phi"))
        except (TypeError, ValueError):
            n = 0
        if 1 <= n <= 9:
            phi = n
    elif body.get("text"):
        picked = tokens(str(body.get("text")))
        probe_word = picked[0] if picked else ""
        if probe_word:
            phi = ppe_word(probe_word).get("Phi")
    hits = []
    for name in sorted(store["words"]):
        entry = store["words"][name]
        if entry["tier"] != "promoted":
            continue
        if not aligned(phi if isinstance(phi, int) else None, entry["packet"]["Phi"] if isinstance(entry["packet"]["Phi"], int) else None):
            continue
        hits.append({
            "word": entry["word"],
            "Phi": entry["packet"]["Phi"],
            "phase_name": entry["packet"]["phase_name"],
            "glyph": entry["packet"]["glyph"],
            "eps": entry["packet"]["eps"],
            "mu": entry["packet"]["mu"],
            "provenance": entry["packet"]["provenance"],
            "tier": entry["tier"],
            "usable": True,
        })
    return {"phi": phi, "probe_word": probe_word, "method": "phase_align", "keyword_rank": False, "window": "π/4", "hits": hits} | flags()


def _absent(key: str) -> dict[str, Any]:
    return {
        "word": key,
        "source": "absent",
        "usable": False,
        "tier": None,
        "Phi": None,
        "phase_name": None,
        "glyph": "",
        "eps": None,
        "mu": None,
        "provenance": None,
        "angle_degrees": None,
        "forbidden_5_to_8": False,
        "sealed": False,
    } | flags()


def place(store: dict[str, Any], word: str | None) -> dict[str, Any]:
    key = str(word or "").lower()
    if not key:
        return _absent("")
    if key in seed_rows():
        row = ppe_word(key)
        return {
            "word": key,
            "source": "seed",
            "usable": True,
            "tier": "lexicon",
            "Phi": row["Phi"],
            "phase_name": row["phase_name"],
            "glyph": row.get("glyph") or "",
            "eps": row["eps"],
            "mu": row["mu"],
            "provenance": row["provenance"],
            "angle_degrees": row.get("angle_degrees"),
            "forbidden_5_to_8": bool(row.get("forbidden_5_to_8")),
            "sealed": False,
        } | flags()
    entry = store["words"].get(key)
    if not entry:
        return _absent(key)
    return {
        "word": key,
        "source": "growth",
        "usable": entry["tier"] == "promoted",
        "tier": entry["tier"],
        "Phi": entry["packet"]["Phi"],
        "phase_name": entry["packet"]["phase_name"],
        "glyph": entry["packet"]["glyph"],
        "eps": entry["packet"]["eps"],
        "mu": entry["packet"]["mu"],
        "provenance": entry["packet"]["provenance"],
        "angle_degrees": entry["packet"]["angle_degrees"],
        "forbidden_5_to_8": entry["packet"]["forbidden_5_to_8"],
        "sealed": entry["sealed"],
    } | flags()


def save(store: dict[str, Any], backend: Any = None) -> str:
    raw = json.dumps(store, ensure_ascii=False)
    if backend is not None and hasattr(backend, "set"):
        backend.set(STORAGE_KEY, raw)
    return raw


def load(raw: str | None = None, backend: Any = None) -> dict[str, Any]:
    text = raw
    if (text is None or text == "") and backend is not None and hasattr(backend, "get"):
        text = backend.get(STORAGE_KEY)
    if not text:
        return empty()
    try:
        parsed = json.loads(text)
    except json.JSONDecodeError:
        return empty()
    if not isinstance(parsed, dict) or parsed.get("schema") != "FORGE-LEXICON-GROWTH/v1" or "words" not in parsed or "archive" not in parsed:
        return empty()
    if "seen" not in parsed:
        parsed["seen"] = {}
    return parsed


def script(steps: list[dict[str, Any]] | None) -> dict[str, Any]:
    store = empty()
    log: list[dict[str, Any]] = []
    for step in steps or []:
        op = (step or {}).get("op")
        if op == "observe":
            log.append({"op": "observe"} | observe(store, step))
        elif op == "recall":
            log.append({"op": "recall"} | recall(store, step))
        elif op == "place":
            log.append({"op": "place"} | place(store, step.get("word")))
        elif op == "restart":
            raw = save(store, None)
            store = load(raw, None)
            log.append({"op": "restart", "words": sorted(store["words"]), "chain_ok": chain_ok(store)})
    words = [view(store["words"][name], store) for name in sorted(store["words"])]
    return {"log": log, "words": words, "store": store} | flags()


def public_script(steps: list[dict[str, Any]] | None) -> dict[str, Any]:
    ran = script(steps)
    ran.pop("store", None)
    return ran


def stage(question: str | None = None) -> dict[str, Any]:
    split = classify(question or "")
    novel = []
    for token in split["novel"]:
        if len(novel) >= 6:
            break
        packet = birth_packet(token)
        novel.append({
            "word": packet["word"],
            "Phi": packet["Phi"],
            "phase_name": packet["phase_name"],
            "glyph": packet["glyph"],
            "angle": packet["angle"],
            "angle_degrees": packet["angle_degrees"],
            "eps": packet["eps"],
            "mu": packet["mu"],
            "provenance": packet["provenance"],
            "eps0": packet["eps0"],
            "mu_init": packet["mu_init"],
            "forbidden_5_to_8": packet["forbidden_5_to_8"],
            "tier": "provisional",
        })
    return {
        "question": str(question or ""),
        "novel": novel,
        "known": [row["word"] for row in split["known"]],
        "novel_count": len(split["novel"]),
        "known_count": len(split["known"]),
        "persisted": False,
        "provenance": PROVENANCE,
        "eps0": 0,
        "mu_init": 1,
        "angle": ANGLE,
        "cite": CITE,
    } | flags()


def show_num(value: Any) -> str:
    if isinstance(value, bool):
        return "true" if value else "false"
    if value is None:
        return "none"
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        if abs(float(value) - round(float(value))) < 1e-9:
            return str(int(round(float(value))))
        return f"{float(value):.6f}".rstrip("0").rstrip(".")
    return str(value)


def _obs(text: str, question: str, timestamp: str, measured_c: float, echo: float, drift: float, collapsed: list[Any] | None = None) -> dict[str, Any]:
    return {
        "op": "observe",
        "text": text,
        "question": question,
        "contributor": "nic",
        "timestamp": timestamp,
        "C": measured_c,
        "echo": echo,
        "drift": drift,
        "collapsed": collapsed or [],
    }


def run_demo(mode: str | None) -> dict[str, Any]:
    if mode == "promote":
        ran = script([
            _obs("create hnv", "what is hnv", "2026-10-30T18:00:00Z", 0.9, 0.9, 0.19),
            _obs("hnv.", "what is hnv", "2026-10-30T18:00:01Z", 0.9, 0.9, 0.19),
        ])
        word = next(row for row in ran["words"] if row["word"] == "hnv")
        return {
            "persist": True,
            "store": ran["store"],
            "attrs": {"mode": "promote", "status": word["tier"], "detail": "sealed" if word["sealed"] else "open"},
            "lines": [
                "hnv uses " + str(word["uses"]) + " tier " + word["tier"] + " sealed " + show_num(word["sealed"]) + ".",
                "Φ" + str(word["Phi"]) + " " + word["phase_name"] + " glyph " + word["glyph"] + " θ " + show_num(word["angle_degrees"]) + "° ε " + show_num(word["eps"]) + " μ " + show_num(word["mu"]) + " " + word["provenance"] + ".",
                "Naming gate Φ " + show_num(word["naming_phi"]) + " echo " + show_num(word["naming_echo"]) + " drift " + show_num(word["naming_drift"]) + ".",
                "Seal " + (word["seal_sha256"] or "none") + " rule " + (word["seal_rule"] or "none") + " chain " + show_num(word["chain_ok"]) + ".",
                "Contributor " + word["contributor"] + " input " + word["input_id"] + " at " + word["timestamp"] + ".",
                "This card does not admit. C_min 0.87. No LLM.",
            ],
        }
    if mode == "quarantine":
        ran = script([
            _obs("zz", "what is zz", "2026-10-30T18:01:00Z", 0.9, 0.9, 0.36),
            _obs("ep", "what is ep", "2026-10-30T18:01:01Z", 0.9, 0.9, 0.1),
            _obs("ep.", "what is ep", "2026-10-30T18:01:02Z", 0.9, 0.9, 0.1),
            _obs("qq", "what is qq", "2026-10-30T18:01:03Z", 0.9, 0.9, 0.1, ["qq"]),
            _obs("qq.", "what is qq", "2026-10-30T18:01:04Z", 0.9, 0.9, 0.1, ["qq"]),
        ])
        zz = next(row for row in ran["words"] if row["word"] == "zz")
        ep = next(row for row in ran["words"] if row["word"] == "ep")
        qq = next(row for row in ran["words"] if row["word"] == "qq")
        return {
            "persist": True,
            "store": ran["store"],
            "attrs": {"mode": "quarantine", "status": zz["tier"], "detail": qq["tier"]},
            "lines": [
                "zz drift " + show_num(zz["drift_max"]) + " tier " + zz["tier"] + " χ " + show_num(zz["chi"]) + " ChristPing started " + show_num(ran["christping_started"]) + ".",
                "Dead path " + (zz["archive_rule"] or "none") + " chain " + show_num(zz["chain_ok"]) + " promoted " + show_num(zz["promoted"]) + ".",
                "ep forbidden " + show_num(ep["forbidden_5_to_8"]) + " tier " + ep["tier"] + " promoted " + show_num(ep["promoted"]) + ".",
                "qq mask " + show_num(qq["mask_hit"]) + " tier " + qq["tier"] + " promoted " + show_num(qq["promoted"]) + ".",
                "This card does not admit. C_min 0.87. No LLM.",
            ],
        }
    if mode == "recall":
        ran = script([
            _obs("hnv", "what is hnv", "2026-10-30T18:02:00Z", 0.9, 0.9, 0.19),
            _obs("hnv.", "what is hnv", "2026-10-30T18:02:01Z", 0.9, 0.9, 0.19),
            {"op": "recall", "text": "h"},
            {"op": "recall", "text": "zzzz"},
            {"op": "place", "word": "hnv"},
            {"op": "place", "word": "create"},
        ])
        near = ran["log"][2]
        far = ran["log"][3]
        placed = ran["log"][4]
        seeded = ran["log"][5]
        near_hit = ", ".join(hit["word"] for hit in near["hits"]) or "none"
        far_hit = ", ".join(hit["word"] for hit in far["hits"]) or "none"
        return {
            "persist": True,
            "store": ran["store"],
            "attrs": {"mode": "recall", "status": near_hit, "detail": far["method"]},
            "lines": [
                "Probe " + near["probe_word"] + " phase Φ" + show_num(near["phi"]) + ". Hits " + near_hit + ". Method phase align. Keyword rank " + show_num(near["keyword_rank"]) + ".",
                "Probe " + far["probe_word"] + " phase Φ" + show_num(far["phi"]) + ". Hits " + far_hit + ".",
                "hnv placement usable " + show_num(placed["usable"]) + " ε " + show_num(placed["eps"]) + " μ " + show_num(placed["mu"]) + ".",
                "create placement source " + seeded["source"] + " usable " + show_num(seeded["usable"]) + ".",
                "This card does not admit. C_min 0.87. No LLM.",
            ],
        }
    if mode == "restart":
        ran = script([
            _obs("hnv", "what is hnv", "2026-10-30T18:03:00Z", 0.9, 0.9, 0.19),
            _obs("hnv.", "what is hnv", "2026-10-30T18:03:01Z", 0.9, 0.9, 0.19),
            {"op": "restart"},
            _obs("hnv", "what is hnv", "2026-10-30T18:03:00Z", 0.9, 0.9, 0.19),
        ])
        word = next(row for row in ran["words"] if row["word"] == "hnv")
        replay = ran["log"][-1]
        return {
            "persist": True,
            "store": ran["store"],
            "attrs": {"mode": "restart", "status": word["tier"], "detail": show_num(replay["idempotent"])},
            "lines": [
                "Round trip keeps " + word["word"] + " tier " + word["tier"] + " sealed " + show_num(word["sealed"]) + " uses " + str(word["uses"]) + ".",
                "Replay idempotent " + show_num(replay["idempotent"]) + " uses " + str(replay["words"][0]["uses"]) + ".",
                "Chain " + show_num(word["chain_ok"]) + ". Local key " + STORAGE_KEY + ".",
                "This card does not admit. C_min 0.87. No LLM.",
            ],
        }
    ran = script([_obs("create hnv", "what is hnv", "2026-10-30T18:00:00Z", 0.9, 0.9, 0.1)])
    word = next(row for row in ran["words"] if row["word"] == "hnv")
    known = ran["log"][0]["known"][0]
    return {
        "persist": False,
        "store": ran["store"],
        "attrs": {"mode": "packets", "status": word["tier"], "detail": word["phase_name"]},
        "lines": [
            "Known " + known["word"] + " stays in the seed lexicon.",
            "Novel " + word["word"] + " tier " + word["tier"] + " Φ" + str(word["Phi"]) + " " + word["phase_name"] + " glyph " + word["glyph"] + " θ " + show_num(word["angle_degrees"]) + "° ε " + show_num(word["eps"]) + " μ " + show_num(word["mu"]) + " " + word["provenance"] + ".",
            "Birth ε " + show_num(word["packet"]["eps0"]) + " μ " + show_num(word["packet"]["mu_init"]) + ". Uses " + str(word["uses"]) + ". Promoted " + show_num(word["promoted"]) + ".",
            "Input " + word["input_id"] + " contributor " + word["contributor"] + " at " + word["timestamp"] + ".",
            "This card does not admit. C_min 0.87. No LLM.",
        ],
    }


def monitor_lines(mode: str | None = None) -> dict[str, Any]:
    ran = run_demo(mode or "packets")
    return {"attrs": ran["attrs"], "lines": ran["lines"]}


def run(payload: dict[str, Any] | None = None) -> dict[str, Any]:
    row = payload or {}
    op = row.get("op") or "summary"
    if op == "script":
        return public_script(row.get("steps") or [])
    if op == "stage":
        return stage(row.get("question"))
    if op == "monitor":
        return monitor_lines(row.get("mode") or "packets")
    if op == "recall":
        return recall(empty(), row)
    return {"storage_key": STORAGE_KEY, "provenance": PROVENANCE, "angle": ANGLE, "cite": CITE, "seeds": word_count()} | flags()


if __name__ == "__main__":
    import sys

    print(json.dumps(run(json.load(sys.stdin))))
