"""Home PC slot: incompressible CFD with OpenFOAM (simpleFoam). Too heavy for a phone.

If OpenFOAM is installed (simpleFoam and blockMesh on PATH, $FOAM_TUTORIALS set), the solver copies the stock
incompressible/simpleFoam/pitzDaily tutorial case into a temporary folder, sets the inlet speed from the question,
runs blockMesh then simpleFoam, and reports the iterations it took and the final initial residuals it printed (what the
run measured, nothing else). If OpenFOAM is missing it returns a structured hold with the install command.
"""
from __future__ import annotations

import os
import re
import shutil
import subprocess
import tempfile
from typing import Any

NAME = "openfoam_cfd"
INSTALL = {
    "ubuntu": "sudo sh -c \"wget -O - https://dl.openfoam.org/gpg.key > /etc/apt/trusted.gpg.d/openfoam.asc\" && sudo add-apt-repository http://dl.openfoam.org/ubuntu && sudo apt-get update && sudo apt-get install -y openfoam12 && echo 'source /opt/openfoam12/etc/bashrc' >> ~/.bashrc",
    "docs": "https://openfoam.org/download/",
}


def installed() -> bool:
    return bool(shutil.which("simpleFoam") and shutil.which("blockMesh") and os.environ.get("FOAM_TUTORIALS"))


def solve(problem: dict[str, Any]) -> dict[str, Any]:
    if not installed():
        return {"solver": NAME, "hold": True, "reason": "openfoam_not_installed", "install": INSTALL}
    case_src = os.path.join(os.environ["FOAM_TUTORIALS"], "incompressible", "simpleFoam", "pitzDaily")
    if not os.path.isdir(case_src):
        return {"solver": NAME, "hold": True, "reason": "pitzDaily_tutorial_missing", "install": INSTALL}
    speed = (problem.get("case") or {}).get("speed_m_s") or 10.0
    work = tempfile.mkdtemp(prefix="forge_cfd_")
    case = os.path.join(work, "case")
    shutil.copytree(case_src, case)
    u = os.path.join(case, "0", "U")
    txt = open(u).read()
    txt = re.sub(r"uniform \(10 0 0\)", f"uniform ({speed:g} 0 0)", txt)
    open(u, "w").write(txt)
    logs = {}
    for cmd in ("blockMesh", "simpleFoam"):
        p = subprocess.run([cmd, "-case", case], capture_output=True, text=True, timeout=3600)
        logs[cmd] = p.stdout[-20000:]
        if p.returncode != 0:
            return {"solver": NAME, "error": f"{cmd} failed: " + p.stderr[-400:]}
    out = logs["simpleFoam"]
    iters = re.findall(r"^Time = (\d+)", out, re.M)
    res = {}
    for field in ("Ux", "Uy", "p"):
        m = re.findall(r"Solving for " + field + r", Initial residual = ([0-9.eE+-]+)", out)
        if m:
            res[field] = float(m[-1])
    shutil.rmtree(work, ignore_errors=True)
    return {"solver": NAME, "engine": "OpenFOAM simpleFoam (Home PC)", "outcome": "converge" if "SIMPLE solution converged" in out else "run",
            "measurements": {"case": "pitzDaily backward-facing step (OpenFOAM tutorial)", "inlet_speed_m_s": speed,
                             "iterations": int(iters[-1]) if iters else None, "final_initial_residuals": res}}
