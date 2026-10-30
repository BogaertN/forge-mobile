"""Cold pass and two fill passes for 4.9.201. The GILIN stage is on the trace and does not change the admit gate."""
from __future__ import annotations

import json
from pathlib import Path

from rmc_engine_v1.anchor_store import clear_cache
from rmc_engine_v1.memory_writer import bank_admitted
from rmc_engine_v1.rmc_core import run
from tools.live_188 import QUESTIONS, SEED, research_rows, shard_rows, starter_rows

ROOT = Path(__file__).resolve().parents[1]


def one(question: str, memory: dict) -> dict:
    row = run({"question": question, "live": True, "memory": memory})
    comp = row.get("coherence_components") or {}
    echo = row.get("echo") or {}
    cur = (row.get("quarantine_curation") or [{}])[0]
    bank = ((row.get("memory_write") or {}).get("bank") or {})
    lc = row.get("language_core") if isinstance(row.get("language_core"), dict) else {}
    dpa = ((row.get("engines") or {}).get("dpa_195") or {})
    tiers = ((row.get("engines") or {}).get("tiers_196") or {})
    ppe = ((row.get("engines") or {}).get("ppe_197") or {})
    growth = ((row.get("engines") or {}).get("growth_198") or {})
    geom = ((row.get("engines") or {}).get("geometry_199") or {})
    rend = ((row.get("engines") or {}).get("rmc_renderer_200") or {})
    gilin = ((row.get("engines") or {}).get("gilin_crp_201") or {})
    return {
        "question": question,
        "route": row.get("route"),
        "C": row.get("coherence"),
        "memory_fit": comp.get("memory_fit"),
        "drift": row.get("drift"),
        "echo": echo.get("score"),
        "echo_pass": echo.get("pass"),
        "admitted": bool(row.get("product_reply")),
        "reply": row.get("reply"),
        "derived": str(((row.get("world_model") or {}).get("derived_text") or "")),
        "calls_llm": row.get("calls_llm"),
        "model_invoked": (lc.get("model_invoked") if lc else None) or row.get("model_invoked"),
        "anchor": cur.get("rule"),
        "trust": (row.get("trust") or {}).get("rule"),
        "premise": cur.get("premise"),
        "bank": bank.get("reason"),
        "speech_act": lc.get("speech_act"),
        "anchors_connected": lc.get("anchors_connected"),
        "gap": lc.get("gap"),
        "language_core": lc.get("function"),
        "claim": lc.get("claim"),
        "dpa_eligible": dpa.get("eligible"),
        "dpa_admit_gate": dpa.get("admit_gate"),
        "dpa_calls_llm": dpa.get("calls_llm"),
        "tier": tiers.get("tier"),
        "half_tier": tiers.get("half_tier"),
        "tiers_admit_gate": tiers.get("admit_gate"),
        "tiers_calls_llm": tiers.get("calls_llm"),
        "tiers_dream_idle": tiers.get("dream_idle"),
        "ppe_provenance": ppe.get("provenance"),
        "ppe_admit_gate": ppe.get("admit_gate"),
        "ppe_calls_llm": ppe.get("calls_llm"),
        "ppe_dream_idle": ppe.get("dream_idle"),
        "ppe_keyword_admit": ppe.get("keyword_admit"),
        "ppe_m_charge": ppe.get("m_charge"),
        "ppe_seeds": ppe.get("seeds"),
        "ppe_words": len(ppe.get("words") or []),
        "growth_provenance": growth.get("provenance"),
        "growth_admit_gate": growth.get("admit_gate"),
        "growth_calls_llm": growth.get("calls_llm"),
        "growth_dream_idle": growth.get("dream_idle"),
        "growth_keyword_admit": growth.get("keyword_admit"),
        "growth_persisted": growth.get("persisted"),
        "growth_operators_applied": growth.get("operators_applied"),
        "growth_novel": len(growth.get("novel") or []),
        "geometry_build": geom.get("geometry_build"),
        "geometry_admit_gate": geom.get("admit_gate"),
        "geometry_calls_llm": geom.get("calls_llm"),
        "geometry_dream_idle": geom.get("dream_idle"),
        "geometry_persisted": geom.get("persisted"),
        "geometry_charge_conserved": geom.get("charge_conserved"),
        "geometry_membrane": geom.get("membrane_before_naming"),
        "geometry_ua_applied": geom.get("ua_applied"),
        "geometry_rsoc_numbers": geom.get("rsoc_numbers"),
        "geometry_open_loop_sealed": geom.get("open_loop_sealed"),
        "renderer_build": rend.get("renderer_build"),
        "renderer_admit_gate": rend.get("admit_gate"),
        "renderer_calls_llm": rend.get("calls_llm"),
        "renderer_network": rend.get("network"),
        "renderer_dream_idle": rend.get("dream_idle"),
        "renderer_persisted": rend.get("persisted"),
        "renderer_failing_echo_output": rend.get("failing_echo_output"),
        "renderer_failing_echo_closed": rend.get("failing_echo_closed"),
        "renderer_response_closed": rend.get("response_closed"),
        "renderer_wikipedia_anchor": rend.get("wikipedia_anchor"),
        "renderer_money": rend.get("money"),
        "renderer_economy": rend.get("economy"),
        "renderer_M": rend.get("M"),
        "renderer_spc_lambda": rend.get("spc_lambda"),
        "gilin_build": gilin.get("gilin_build"),
        "gilin_admit_gate": gilin.get("admit_gate"),
        "gilin_calls_llm": gilin.get("calls_llm"),
        "gilin_network": gilin.get("network"),
        "gilin_dream_idle": gilin.get("dream_idle"),
        "gilin_persisted": gilin.get("persisted"),
        "gilin_money": gilin.get("money"),
        "gilin_economy": gilin.get("economy"),
        "gilin_wikipedia_anchor": gilin.get("wikipedia_anchor"),
        "gilin_crp_admits": gilin.get("crp_admits"),
        "gilin_c_star_admits": gilin.get("c_star_admits"),
        "gilin_warn_admits": gilin.get("warn_admits"),
        "gilin_law_admit_gate": gilin.get("law_admit_gate"),
        "gilin_christping_started": gilin.get("christping_started"),
        "gilin_M": gilin.get("M"),
        "gilin_spc_lambda": gilin.get("spc_lambda"),
        "gilin_coordinated": gilin.get("coordinated"),
    }


def main() -> None:
    clear_cache()
    research = research_rows()
    starter = starter_rows()
    extra: list[dict] = []
    seen: set[str] = set()
    passes = []
    for n in range(3):
        rows = []
        admitted = 0
        for topic, question in QUESTIONS:
            memory = json.loads(json.dumps(SEED))
            memory["hosted"] = list(memory.get("hosted") or []) + extra
            memory["anchors"] = starter + shard_rows(question)
            web = research.get(question) or {}
            if web.get("text"):
                memory["research"] = [{
                    "id": "web-" + question[:24],
                    "text": web["text"],
                    "url": web.get("url") or "",
                    "source": "wikipedia",
                    "trust": "low",
                    "quarantined": True,
                    "premise": False,
                }]
            item = one(question, memory)
            item["topic"] = topic
            item["n"] = len(rows) + 1
            rows.append(item)
            if item["admitted"]:
                admitted += 1
                text = item["reply"]
                if text:
                    row_body = {
                        "id": "admit-" + str(len(extra)),
                        "text": text,
                        "sfe": {"Phi": 9, "eps": item["drift"], "mu": 1},
                        "provenance": {"question": question, "contributor": "athena"},
                        "contributor": "athena",
                        "trust": "trusted",
                    }
                    session = {
                        "receipts": memory.get("receipts") or [],
                        "phone": memory.get("phone") or [],
                        "hosted": list(memory.get("hosted") or []) + extra,
                        "anchors": memory["anchors"],
                    }
                    bank = bank_admitted(session, row_body)
                    item["bank"] = bank["reason"]
                    if bank["written"] and text not in seen:
                        seen.add(text)
                        if bank.get("replace_id"):
                            extra = [row for row in extra if row.get("id") != bank["replace_id"]]
                        extra.append(row_body)
        passes.append({
            "pass": n,
            "name": "cold" if n == 0 else "pass " + str(n + 1),
            "admitted": admitted,
            "held": len(rows) - admitted,
            "echo_pass": sum(1 for r in rows if r["echo_pass"]),
            "routes": {
                "active_stack_candidate": sum(1 for r in rows if r["route"] == "active_stack_candidate"),
                "correction_queue": sum(1 for r in rows if r["route"] == "correction_queue"),
            },
            "C_min": min(r["C"] for r in rows),
            "C_max": max(r["C"] for r in rows),
            "banked": len(extra),
            "rows": rows,
        })
        print(passes[-1]["name"], "admitted", admitted, "echo", passes[-1]["echo_pass"], "bank", len(extra), flush=True)
    keys = ("echo", "derived", "C", "admitted", "reply")
    flips = []
    cold = passes[0]["rows"]
    for row in cold:
        series = [next(r for r in p["rows"] if r["question"] == row["question"]) for p in passes]
        if len({tuple(r[k] for k in keys) for r in series}) != 1:
            flips.append(row["question"])
    gaps = [
        {"n": r["n"], "topic": r["topic"], "question": r["question"], "speech_act": r["speech_act"], "C": r["C"]}
        for r in cold if not r["admitted"] and r.get("gap")
    ]
    out = {"passes": passes, "flips": flips, "stable": not flips, "gaps": gaps, "calls_llm": any(r["calls_llm"] for p in passes for r in p["rows"])}
    dest = ROOT / "tools" / "live_201_results.json"
    dest.write_text(json.dumps(out, ensure_ascii=False), encoding="utf-8")
    print("stable", out["stable"], "gaps", len(gaps), "wrote", dest)


if __name__ == "__main__":
    main()
