"""Write the 4.9.203 collision proof. Stdlib. No LLM."""
from __future__ import annotations

import json
from pathlib import Path

from rmc_engine_v1.frequency_203 import proof

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "data" / "frequency_203_proof.json"


def main() -> None:
    row = proof(samples=20000)
    # The related block repeats full component lists. Keep them: the card reads one word from JS.
    OUT.write_text(json.dumps(row, ensure_ascii=False), encoding="utf-8")
    lex = row["lexicon"]
    print("lexicon", lex["n"], "before", lex["before"], "after", lex["after"])
    for item in row["synthetic"]:
        print(item["n"], "before", item["before_rate"], "after", item["after_rate"], "expected", item["expected_after_pairs"])


if __name__ == "__main__":
    main()
