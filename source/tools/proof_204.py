"""4.9.204 collision, tuning, and spread proof. Stdlib plus matplotlib. No LLM."""
from __future__ import annotations

import json
import random
import time
from pathlib import Path

from rmc_engine_v1.frequency_203 import (
    _before_pair,
    _synth_word,
    letter_signature,
    measure_lexicon,
    migrate_seeds,
    resonate,
)
from rmc_engine_v1.frequency_204 import (
    Field,
    collapse_report,
    content_words,
    q,
    sun_series,
)
from rmc_engine_v1.frequency_204_config import PROPOSAL

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "data" / "frequency_204_proof.json"
CHARTS = ROOT / "data"


def _pair_key(a: str, b: str) -> tuple[str, str]:
    return (a, b) if a < b else (b, a)


def _count(sigs: list[dict], samples: int | None, rng: random.Random) -> dict:
    n = len(sigs)
    pairs = n * (n - 1) // 2
    before = after = drawn = 0
    if samples is None:
        for i in range(n):
            for j in range(i + 1, n):
                drawn += 1
                if _before_pair(sigs[i], sigs[j]):
                    before += 1
                if resonate(sigs[i], sigs[j])["resonate"]:
                    after += 1
    else:
        guard = 0
        while drawn < samples and guard < samples * 5:
            guard += 1
            i = rng.randrange(n)
            j = rng.randrange(n)
            if i == j:
                continue
            drawn += 1
            if _before_pair(sigs[i], sigs[j]):
                before += 1
            if resonate(sigs[i], sigs[j])["resonate"]:
                after += 1
    return {
        "n": n,
        "pairs": pairs,
        "samples": drawn,
        "before": before,
        "after": after,
        "before_rate": q(before / drawn, 6) if drawn else 0,
        "after_rate": q(after / drawn, 6) if drawn else 0,
        "expected_after_pairs": q((after / drawn) * pairs, 2) if drawn else 0,
    }


def lexicon_rows(field: Field | None) -> list[dict]:
    rows = []
    for row in migrate_seeds()["rows"]:
        if field is None:
            sig = {"word": row["word"], "Phi": row["Phi"], "components": row["frequency"]["components"]}
        else:
            tuned = field.tuned(row["word"])
            sig = {"word": row["word"], "Phi": tuned["Phi"], "components": tuned["components"]}
        rows.append(sig)
    return rows


def unrelated_rate(sigs: list[dict], linked: set[tuple[str, str]]) -> dict:
    n = len(sigs)
    considered = unrelated_hit = 0
    for i in range(n):
        for j in range(i + 1, n):
            if _pair_key(sigs[i]["word"], sigs[j]["word"]) in linked:
                continue
            considered += 1
            if resonate(sigs[i], sigs[j])["resonate"]:
                unrelated_hit += 1
    return {
        "considered": considered,
        "hits": unrelated_hit,
        "rate": q(unrelated_hit / considered, 6) if considered else 0,
    }


def cold_links(rows: list[dict]) -> tuple[Field, set[tuple[str, str]]]:
    field = Field()
    linked: set[tuple[str, str]] = set()
    for row in rows:
        if not row.get("admitted"):
            continue
        text = f"{row.get('question') or ''} {row.get('reply') or ''}"
        words = content_words(text)
        for i, left in enumerate(words):
            for right in words[i + 1:]:
                linked.add(_pair_key(left, right))
        field.admit({
            "id": f"cold-{row.get('n')}",
            "text": text,
            "C": row.get("C") or 0,
            "echo": row.get("echo") or 0,
            "drift": row.get("drift") if row.get("drift") is not None else 1,
            "phase": 6,
            "trust": "local",
            "calls_llm": False,
            "t_hours": float(row.get("n") or 0),
        })
    return field, linked


def synthetic_after(n: int, samples: int, admits: int, rng: random.Random) -> dict:
    words = [_synth_word(i) for i in range(n)]
    sigs = [letter_signature(word) for word in words]
    before = _count(sigs, samples, rng)
    field = Field()
    taken = 0
    guard = 0
    admitted: set[tuple[str, str]] = set()
    while taken < admits and guard < admits * 40:
        guard += 1
        i = rng.randrange(n)
        j = rng.randrange(n)
        if i == j:
            continue
        if not _before_pair(sigs[i], sigs[j]):
            continue
        key = _pair_key(words[i], words[j])
        if key in admitted:
            continue
        admitted.add(key)
        field.admit({
            "id": f"syn-{n}-{taken}",
            "words": [words[i], words[j]],
            "C": 0.9,
            "echo": 1.0,
            "drift": 0.05,
            "phase": 6,
            "trust": "local",
            "calls_llm": False,
            "t_hours": float(taken),
        })
        taken += 1
    tuned = []
    for word, sig in zip(words, sigs):
        if any(word in pair for pair in admitted):
            row = field.tuned(word)
            tuned.append({"word": word, "Phi": row["Phi"], "components": row["components"]})
        else:
            tuned.append({"word": word, "Phi": sig["Phi"], "components": sig["components"]})
    after = _count(tuned, samples, rng)
    unrelated = 0
    unrelated_hit = 0
    guard = 0
    drawn = 0
    while drawn < samples and guard < samples * 5:
        guard += 1
        i = rng.randrange(n)
        j = rng.randrange(n)
        if i == j:
            continue
        drawn += 1
        if _pair_key(words[i], words[j]) in admitted:
            continue
        unrelated += 1
        if resonate(tuned[i], tuned[j])["resonate"]:
            unrelated_hit += 1
    before["label"] = "spelling"
    after["label"] = "tuned"
    after["admits"] = taken
    after["unrelated_samples"] = unrelated
    after["unrelated_hits"] = unrelated_hit
    after["unrelated_rate"] = q(unrelated_hit / unrelated, 6) if unrelated else 0
    return {"n": n, "before": before, "after": after}


def write_charts(proof: dict) -> None:
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    labels = ["419 seeds"]
    before = [proof["lexicon"]["spelling_rate"]]
    after = [proof["lexicon"]["tuned_rate"]]
    for row in proof["synthetic"]:
        labels.append(f"{row['n'] // 1000}k" if row["n"] >= 1000 else str(row["n"]))
        before.append(row["before_rate"])
        after.append(row["after_rate"])
    fig, ax = plt.subplots(figsize=(7.2, 4.2))
    xs = range(len(labels))
    ax.bar([x - 0.18 for x in xs], before, width=0.36, label="spelling", color="#7dcea0")
    ax.bar([x + 0.18 for x in xs], after, width=0.36, label="after tuning", color="#e0a45a")
    ax.set_xticks(list(xs), labels)
    ax.set_ylabel("frequency collision rate")
    ax.set_title("Chance collision, spelling versus tuned offsets")
    ax.legend()
    fig.tight_layout()
    fig.savefig(CHARTS / "frequency_204_collision.png", dpi=120)
    plt.close(fig)

    series = proof["sun_light"]["steps"]
    fig, ax = plt.subplots(figsize=(7.2, 4.2))
    steps = [row["step"] for row in series]
    sun, light = [], []
    for row in series:
        pair = row["hz"].get("72") or [None, None]
        sun.append(pair[0])
        light.append(pair[1])
    ax.plot(steps, sun, label="sun 72 Hz", color="#e0a45a")
    ax.plot(steps, light, label="light 72 Hz", color="#5dade2")
    ax.set_xlabel("lawful co-admits")
    ax.set_ylabel("hertz")
    ax.set_title("sun / light on the 72 Hz carrier")
    ax.legend()
    fig.tight_layout()
    fig.savefig(CHARTS / "frequency_204_sun_light.png", dpi=120)
    plt.close(fig)

    fig, ax = plt.subplots(figsize=(7.2, 4.2))
    on = proof["collapse"]["with_spacing"]["trace"]
    off = proof["collapse"]["without_spacing"]["trace"]
    ax.plot([row["step"] for row in on], [row["stdev"] for row in on], label="spacing on", color="#7dcea0")
    ax.plot([row["step"] for row in off], [row["stdev"] for row in off], label="spacing off", color="#e07470")
    ax.set_xlabel("co-admits of the clique")
    ax.set_ylabel("stdev of the shared carrier (Hz)")
    ax.set_title("Frequency spread under attraction")
    ax.legend()
    fig.tight_layout()
    fig.savefig(CHARTS / "frequency_204_spread.png", dpi=120)
    plt.close(fig)


def main() -> None:
    from tools.audit_204 import run_cold, write_audit

    t0 = time.perf_counter()
    print("cold", flush=True)
    cold = run_cold()
    print("cold", cold["admitted"], flush=True)
    (ROOT / "tools" / "live_204_results.json").write_text(json.dumps(cold, ensure_ascii=False), encoding="utf-8")
    write_audit(cold)
    spelling = measure_lexicon()
    base_rows = lexicon_rows(None)
    field, linked = cold_links(cold["rows"])
    tuned_rows = lexicon_rows(field)
    tuned_all = _count(tuned_rows, None, random.Random(144))
    spelling_all = _count(base_rows, None, random.Random(144))
    unrelated_before = unrelated_rate(base_rows, linked)
    unrelated_after = unrelated_rate(tuned_rows, linked)
    rng = random.Random(144)
    synthetic = []
    for n, samples in ((1000, 20000), (10000, 20000), (100000, 40000)):
        print("synthetic", n, flush=True)
        synthetic.append(synthetic_after(n, samples, 200, rng))
        print("synthetic", n, "done", flush=True)
    series = sun_series(16)
    collapse = collapse_report(24, 12)
    # Drop the long hz lists from the collapse payload stored for the card.
    for key in ("with_spacing", "without_spacing"):
        collapse[key].pop("before_hz", None)
        collapse[key].pop("after_hz", None)
    watched = {}
    for left, right in (("sun", "light"), ("sun", "hot"), ("sun", "warm"), ("sun", "dog"), ("light", "quartz")):
        watched[f"{left}/{right}"] = {
            "before": Field().pair_view(left, right),
            "after_cold": field.pair_view(left, right),
            "after_explicit": None,
        }
    demo = Field()
    for step in range(12):
        demo.admit({
            "id": f"demo-{step}", "words": ["sun", "light"], "C": 0.9, "echo": 1, "drift": 0.05,
            "phase": 6, "trust": "local", "calls_llm": False, "t_hours": float(step),
        })
    for name in ("sun/light", "sun/hot", "sun/dog", "light/quartz"):
        left, right = name.split("/")
        watched[name]["after_explicit"] = demo.pair_view(left, right) if name != "sun/hot" else None
    hot = Field()
    for step in range(8):
        hot.admit({
            "id": f"hot-{step}", "words": ["sun", "hot"], "C": 0.9, "echo": 1, "drift": 0.05,
            "phase": 6, "trust": "local", "calls_llm": False, "t_hours": float(step),
        })
    watched["sun/hot"]["after_explicit"] = hot.pair_view("sun", "hot")
    proof = {
        "schema": "FORGE-FREQUENCY-PROOF/v204",
        "proposal": PROPOSAL,
        "calls_llm": False,
        "cold": {
            "admitted": cold["admitted"],
            "held": cold["held"],
            "false_admits": cold["false_admits"],
            "of": len(cold["rows"]),
        },
        "lexicon": {
            "n": spelling["n"],
            "pairs": spelling["pairs"],
            "phase_only_rate": spelling["before_rate"],
            "spelling_rate": spelling_all["after_rate"],
            "tuned_rate": tuned_all["after_rate"],
            "spelling_hits": spelling_all["after"],
            "tuned_hits": tuned_all["after"],
            "unrelated_before": unrelated_before,
            "unrelated_after": unrelated_after,
            "coadmitted_pairs": len(linked),
            "before_rate": spelling_all["after_rate"],
            "after_rate": tuned_all["after_rate"],
        },
        "synthetic": [
            {
                "n": row["n"],
                "before_rate": row["before"]["after_rate"],
                "after_rate": row["after"]["after_rate"],
                "unrelated_rate": row["after"]["unrelated_rate"],
                "admits": row["after"]["admits"],
                "samples": row["before"]["samples"],
                "expected_before_pairs": row["before"]["expected_after_pairs"],
                "expected_after_pairs": row["after"]["expected_after_pairs"],
            }
            for row in synthetic
        ],
        "watched": {
            key: {
                "before": value["before"]["resonate"],
                "before_reason": value["before"]["reason"],
                "before_cover": value["before"]["cover"],
                "after_cold": value["after_cold"]["resonate"],
                "after_cold_cover": value["after_cold"]["cover"],
                "after_explicit": None if value["after_explicit"] is None else value["after_explicit"]["resonate"],
                "after_explicit_cover": None if value["after_explicit"] is None else value["after_explicit"]["cover"],
                "after_explicit_reason": None if value["after_explicit"] is None else value["after_explicit"]["reason"],
                "phi": value["before"]["phi"],
            }
            for key, value in watched.items()
        },
        "sun_light": {"steps": series["steps"]},
        "collapse": collapse,
        "seconds": q(time.perf_counter() - t0, 3),
    }
    OUT.write_text(json.dumps(proof), encoding="utf-8")
    write_charts(proof)
    print("charts", flush=True)
    print(json.dumps({
        "cold": proof["cold"],
        "lexicon": proof["lexicon"],
        "synthetic": proof["synthetic"],
        "watched": proof["watched"],
        "collapse_holds": collapse["spacing_holds"],
        "seconds": proof["seconds"],
    }, indent=1))


if __name__ == "__main__":
    main()
