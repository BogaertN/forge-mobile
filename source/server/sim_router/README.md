# FORGE simulators: on the phone, plus an optional Home PC Simulator (4.9.245)

## Where each simulation runs
No Google Cloud, no third-party backend server. Seven families run **on the phone** (browser), computed by the real
engine at ask time, each sealed as a FORGE-SIM-RECEIPT/v1 with a sha256:

| Family | Solver id | Engine (pinned) | Runs in |
|---|---|---|---|
| Rigid bodies (push / drop) | `mujoco_wasm` | `@mujoco/mujoco@3.17.0` WASM | `src/sim_wasm_worker.js` |
| Projectiles / kinematics / calculus | `sympy_pyodide` | SymPy 1.13.3 + mpmath 1.3.0 (Pyodide 0.27.7 lock) | engine worker |
| Chemistry: balancing | `chemistry_ondevice` | SymPy `Matrix.nullspace` | engine worker |
| Chemistry: kinetics | `chemistry_kinetics` | SciPy 1.14.1 `solve_ivp` | engine worker |
| Chemistry: molecules | `rdkit_wasm` | `@rdkit/rdkit@2026.9.2` WASM | `src/sim_wasm_worker.js` |
| Biology: sequences | `biology_ondevice` | Biopython 1.84 `Bio.Seq` | engine worker |
| Biology: enzyme kinetics | `biology_kinetics` | SciPy `solve_ivp` (Michaelis-Menten) | engine worker |
| Astronomy | `astronomy_ondevice` | astropy 7.0.0 constants | engine worker |
| Quantum (one qubit) | `quantum_ondevice` | SciPy `linalg.expm` | engine worker |
| Circuits | `circuits_wasm` | ngspice 45.2 via `eecircuit-engine@1.9.0` WASM | `src/sim_wasm_worker.js` |
| CFD | `openfoam_cfd` | OpenFOAM simpleFoam | **Home PC only** |
| Ab initio (Hartree-Fock / DFT) | `pyscf_abinitio` | PySCF | **Home PC only** |

Spatial reaction-diffusion (dune-copasi) is a future Home PC slot; the phone integrates the well-mixed ODE.

Loading: nothing is fetched until an ask needs it. WASM files come from jsDelivr by exact version and are checked
against the SHA-384 pins in `src/sim_wasm_worker.js` before they run; Pyodide packages come from the pinned Pyodide
0.27.7 lock (`loadPackage` checks each file's sha256). Everything is cached (Cache API `forge-sim-v1` / browser cache)
so it works offline after first use. No .wasm file is in git or in the portable single file.

Air-gapped / local copies: set `localStorage['forge.sim_assets']` to a folder (same site path like `/sim-assets`, an
`https://` URL, or `http://localhost:…`) laid out like the CDN: `<folder>/@mujoco/mujoco@3.17.0/mujoco.js`,
`<folder>/@rdkit/rdkit@2026.9.2/dist/RDKit_minimal.{js,wasm}`, `<folder>/eecircuit-engine@1.9.0/dist/eecircuit-engine.mjs`,
`<folder>/pyodide/v0.27.7/full/…`. The same pins are checked; a file that does not match is refused.

The portable single file (`_release/single/kernel-app.html`) runs the Pyodide families; the WASM families need the
installed site (they run in a same-origin worker) and hold in the single file.

## Home PC Simulator (optional)
The phone sends only the heavy questions (CFD, Hartree-Fock / DFT) to it, and only when the user put its address in
**Custody → Home PC Simulator (Optional)** (`localStorage['forge.sim_router']`). Test Connection calls `/v1/health`.
Without an address those questions hold and say a Home PC is required.

```
cd source
python3 -m pip install -r server/sim_router/requirements.txt
python3 -m server.sim_router.serve --host 127.0.0.1 --port 8790 --origin https://bogaertn.github.io
# health: http://127.0.0.1:8790/v1/health
```
A phone page served over https can only reach an https address (or `http://localhost` on the same device). Put the PC
behind https on your own network, e.g. `tailscale serve --https=443 http://127.0.0.1:8790` or Caddy.

`router.py` uses the same `engine/rmc_engine_v1/sim_device.py` plan/seal code as the phone. A solver that is not
installed returns a structured hold with an install command (`reason`, `install`), never a guess.

### PySCF (Hartree-Fock / DFT)
```
python3 -m pip install pyscf==2.8.0
```
`solvers/pyscf_abinitio.py`: RHF/6-31G or RKS/B3LYP/6-31G on a fixed experimental geometry table (NIST CCCBDB:
hydrogen, water, methane, ammonia, nitrogen, carbon dioxide); reports total energy and HOMO/LUMO.

### OpenFOAM (CFD)
Ubuntu (openfoam.org packages):
```
sudo sh -c "wget -O - https://dl.openfoam.org/gpg.key > /etc/apt/trusted.gpg.d/openfoam.asc"
sudo add-apt-repository http://dl.openfoam.org/ubuntu && sudo apt-get update && sudo apt-get install -y openfoam12
source /opt/openfoam12/etc/bashrc   # sets FOAM_TUTORIALS; start the router from this shell
```
`solvers/openfoam_cfd.py`: copies the stock `incompressible/simpleFoam/pitzDaily` case, sets the inlet speed from the
question, runs blockMesh + simpleFoam, reports iterations and final residuals.

## Later: a FORGE server
When a server exists, run the same `serve.py` there and put its https address in the same setting. Nothing in the
phone changes.

