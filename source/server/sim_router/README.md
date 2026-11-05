# Forge backend runner map (4.9.244, audited 2026-11-05 CST)

## What runs where today
| Layer | Where | What it does | Reasoning? |
|---|---|---|---|
| **Engine (primary)** | Phone/browser, **Pyodide** worker (`src/rmc_client.js` loads `data/py/rmc_engine_bundle.json`, SRI-pinned) | the whole Python engine: kernel → RMC → world_model_v1 → outward compile → Echo → gate | yes, on device |
| Engine fallback | `POST /api/rmc/deep-dry-run` (`tools/rmc_http.py`, same engine in CPython) | used by `rmc_client.js` only when the Pyodide bundle cannot load; **not hosted anywhere** (local/dev only) | same engine |
| Supabase `forge-mobile` (ref `hqcvywujrygbnaowgwln`) | Postgres + RLS, Storage (`forge-ref` bucket), 23 migrations; **Edge Functions (Deno): `register-device` v2, `memory-writer` v4** (read-only listing, 2026-11-05) | storage, sync, signed shared-KB writes only — "never reasoning" (supabase/README.md) | no |
| Athena runner | `tools/athena_runner_229.py` (+ `athena_write_224.py`, `athena_dryrun_*`) | offline/CLI gap-filler, dry-run by default; run by hand on a dev box; no daemon, no cron, no hosted worker | curation only |
| Home node | `tools/forge_node.py` | optional self-hosted helper (Termux / home PC): ping, tracker-free fetch, encrypted job queue; no model, no shell, no solver | no |
| GitHub Actions | `pages.yml` (targeted gate → build → Pages), `test.yml`, `fuzz.yml`, `gks-publish.yml` (manual signing) | CI + static deploy of `https://bogaertn.github.io/forge-mobile/` | no |

There was **no backend simulation runner** before this build.

## New in 4.9.244: Simulation Router
`source/server/sim_router/` — a Python HTTP service (stdlib `http.server`, no framework).
- `router.py` — contract `FORGE-SIM-RECEIPT/v1`; `SOLVERS` registry (each solver = module with `NAME`, `HANDLES`, `solve(scene)`); sha256 over the canonical receipt; scene compiled by the **same** `engine/rmc_engine_v1/sim_scene.py` the phone bundles.
- `solvers/mujoco_rigid.py` — MuJoCo 3.17 rigid body (MJCF from the scene; push / drop).
- `solvers/sympy_math.py` — SymPy 1.14 exact kinematics/trig (throw, drop) + tip-vs-slip cross-check.
- `serve.py` — `POST /v1/simulate {"question"}`, `GET /v1/health`; also mounted at `/sim/v1/...`; `--static <dir>` serves the PWA from the same process; CORS: `https://bogaertn.github.io` + localhost only; holds no secret, writes nothing.
- Next solvers slot in by adding a module to `SOLVERS` (chempy, cantera, tellurium …) and a `PRIMARY` action mapping; the receipt contract does not change.

Run locally (what the Chrome proofs used):
```
pip install mujoco==3.17.0 sympy==1.14.0 numpy
cd source && python3 -m server.sim_router.serve --port 8765 --static .
# app at http://127.0.0.1:8765/  router at http://127.0.0.1:8765/sim/v1/health
```

## How the phone reaches it
`src/app.js simulateViaRouter`: only for "What happens if …?" questions. Endpoint = `localStorage['forge.sim_router']` (must be `https://…`, or `http://127.0.0.1|localhost`), else same-origin `/sim` when the app itself is on localhost. CSP already allows `connect-src https:`, so any https router works from Pages with no CSP change. No endpoint / unreachable / bad receipt → no premise → the engine holds honestly. Receipt rows go into `memory.simulation` for that turn only (never stored).

## Hosting options for the live Pages app
- **Supabase Edge Function: not possible** for MuJoCo (Deno runtime, no native Python wheels). SymPy-only would also need Python — no.
- **Pyodide on the phone: not for MuJoCo** (no Pyodide build of the native `mujoco` wheel; SymPy alone would work in Pyodide, ~10 MB extra).
- **Recommended: a small container** (Fly.io, Render, Google Cloud Run, Railway) running `python3 -m server.sim_router.serve --host 0.0.0.0` (honours `$PORT`) with `requirements.txt`; https is provided by the host. Stateless, no secrets, ~120 MB image, MuJoCo step < 1 s per ask. Then set `forge.sim_router` to the https URL (a settings field can come next).
- Home node: run the same command next to `forge_node.py` behind https (Caddy / Tailscale Funnel).
- **Status: no hosted endpoint exists yet**; nothing was deployed (needs Nic's choice of host/account). Pages holds simulation asks until then. No `sb_secret_` is used or needed anywhere in the router.
