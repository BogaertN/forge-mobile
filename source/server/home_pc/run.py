"""Home PC process. It serves the sim router and ticks Athena's gap loop on Neo's interval.

A hosted write uses only the existing gated writer. A service_role token is refused.
With no writer credential the loop plans and does not write.
"""
from __future__ import annotations

import os
import sys
import threading
import time
from pathlib import Path


def load_env(path: Path) -> None:
    if not path.is_file():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip())


def writer_refused() -> str | None:
    token = os.environ.get("FORGE_WRITER_BEARER") or ""
    if "service_role" in token:
        return "service_role is not the writer credential"
    return None


def tick_once() -> dict:
    """One Neo interval. Planning does not write. A write needs the gated credential."""
    reason = writer_refused()
    if reason:
        return {"ok": False, "rule": "HOME-WRITER-REFUSED", "error": reason, "wrote": False, "calls_llm": False}
    if not os.environ.get("FORGE_WRITER_URL") or not os.environ.get("FORGE_WRITER_BEARER"):
        return {"ok": True, "rule": "HOME-PLAN-ONLY", "wrote": False, "calls_llm": False}
    return {"ok": False, "rule": "KB-WRITER-NO-SESSION", "wrote": False, "calls_llm": False}


def loop() -> None:
    interval = float(os.environ.get("FORGE_NEO_INTERVAL_S") or "60")
    while True:
        tick_once()
        time.sleep(max(5.0, interval))


def main() -> None:
    load_env(Path(__file__).with_name(".env"))
    if writer_refused():
        raise SystemExit(writer_refused())
    os.environ["PORT"] = os.environ.get("FORGE_HOME_PORT") or os.environ.get("PORT") or "8790"
    origin = os.environ.get("FORGE_HOME_ORIGIN")
    if origin and "--origin" not in sys.argv:
        sys.argv.extend(["--origin", origin])
    threading.Thread(target=loop, daemon=True).start()
    from server.sim_router.serve import main as serve
    serve()


if __name__ == "__main__":
    main()
