#!/usr/bin/env python3
"""Thin backend for the already-declared /api/rmc/deep-dry-run endpoint.

The body is the same mobile_ask payload the browser worker runs. No model.
"""
from __future__ import annotations

import json
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "engine"))

from rmc_engine_v1.rmc_core import run  # noqa: E402


class Handler(BaseHTTPRequestHandler):
    def _send(self, code: int, payload: dict) -> None:
        raw = json.dumps(payload, default=str).encode("utf-8")
        self.send_response(code)
        self.send_header("content-type", "application/json")
        self.send_header("content-length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

    def do_POST(self) -> None:  # noqa: N802
        if self.path.split("?", 1)[0] != "/api/rmc/deep-dry-run":
            self._send(404, {"ok": False, "error": "not_found", "calls_llm": False})
            return
        length = int(self.headers.get("content-length") or "0")
        raw = self.rfile.read(length) if length else b"{}"
        try:
            payload = json.loads(raw.decode("utf-8") or "{}")
        except json.JSONDecodeError:
            self._send(400, {"ok": False, "error": "bad_json", "calls_llm": False, "reply": "The answer is held."})
            return
        if not isinstance(payload, dict):
            payload = {"question": str(payload)}
        result = run(payload)
        result["path"] = "backend"
        self._send(200, result)

    def log_message(self, fmt: str, *args) -> None:
        return


def main() -> int:
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8765
    server = ThreadingHTTPServer(("127.0.0.1", port), Handler)
    print(f"rmc listening on http://127.0.0.1:{port}/api/rmc/deep-dry-run", flush=True)
    server.serve_forever()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
