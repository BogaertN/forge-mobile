#!/usr/bin/env python3
"""HTTP front of the FORGE Simulation Router. POST /v1/simulate {"question": "..."}; GET /v1/health.

  python3 -m server.sim_router.serve --port 8790 [--static source/] [--origin https://bogaertn.github.io]

With --static the same process also serves the PWA, so the phone reaches /sim/v1/... same-origin (CSP 'self').
CORS is limited to the listed origins (default: GitHub Pages + localhost). No secrets are read or needed: the router
writes nothing and holds no key. No model.
"""
from __future__ import annotations

import argparse
import json
import os
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

from . import router

ORIGINS = {"https://bogaertn.github.io", "http://127.0.0.1:8765", "http://localhost:8765"}
MAX_BODY = 4096


class Handler(SimpleHTTPRequestHandler):
    def log_message(self, fmt, *args):  # quiet
        pass

    def _cors(self):
        o = self.headers.get("Origin")
        if o and o in ORIGINS:
            self.send_header("Access-Control-Allow-Origin", o)
            self.send_header("Vary", "Origin")
            self.send_header("Access-Control-Allow-Headers", "content-type")
            self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")

    def _json(self, code, obj):
        b = json.dumps(obj, default=str).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(b)))
        self.send_header("Cache-Control", "no-store")
        self._cors()
        self.end_headers()
        self.wfile.write(b)

    def _api(self):
        p = self.path.split("?")[0]
        return p[4:] if p.startswith("/sim/") else (p if p.startswith("/v1/") else None)

    def do_OPTIONS(self):
        self.send_response(204); self._cors(); self.end_headers()

    def do_GET(self):
        api = self._api()
        if api == "/v1/health":
            return self._json(200, router.health())
        if api is not None or not self.server.static:
            return self._json(404, {"ok": False})
        return super().do_GET()

    def do_POST(self):
        if self._api() != "/v1/simulate":
            return self._json(404, {"ok": False})
        n = int(self.headers.get("Content-Length") or 0)
        if n <= 0 or n > MAX_BODY:
            return self._json(413, {"ok": False, "reason": "body"})
        try:
            body = json.loads(self.rfile.read(n))
            q = str(body.get("question") or "")[:400]
            frame = body.get("frame") if isinstance(body.get("frame"), dict) else None
            facts = body.get("facts") if isinstance(body.get("facts"), list) else None
        except Exception:
            return self._json(400, {"ok": False, "reason": "json"})
        return self._json(200, router.route(q, frame, facts))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--host", default="127.0.0.1"); ap.add_argument("--port", type=int, default=8790)
    ap.add_argument("--static", default=None); ap.add_argument("--origin", action="append", default=[])
    a = ap.parse_args()
    ORIGINS.update(a.origin)
    handler = partial(Handler, directory=a.static) if a.static else Handler
    env_port = os.environ.get("PORT")
    srv = ThreadingHTTPServer((a.host, int(env_port) if env_port else a.port), handler)
    srv.static = bool(a.static)
    print(json.dumps({"listening": srv.server_address, "static": a.static, **router.health()}), flush=True)
    srv.serve_forever()


if __name__ == "__main__":
    main()
