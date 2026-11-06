"""Home PC slot: ab initio electronic structure with PySCF (Hartree-Fock or DFT B3LYP). Too heavy for a phone.

If PySCF is installed, the solver builds the molecule from a small fixed geometry table (experimental geometries,
NIST CCCBDB), runs RHF or RKS/B3LYP in the 6-31G basis, and reports the converged total energy and the HOMO/LUMO
orbital energies it computed. If PySCF is missing it returns a structured hold with the install command.
"""
from __future__ import annotations

from typing import Any

NAME = "pyscf_abinitio"
INSTALL = {"pip": "python3 -m pip install pyscf==2.8.0", "docs": "https://pyscf.org/install.html"}
# Ångström, experimental geometries (NIST CCCBDB, https://cccbdb.nist.gov/)
GEOMETRY = {
    "hydrogen": "H 0 0 0; H 0 0 0.7414",
    "water": "O 0 0 0.1173; H 0 0.7572 -0.4692; H 0 -0.7572 -0.4692",
    "methane": "C 0 0 0; H 0.6276 0.6276 0.6276; H -0.6276 -0.6276 0.6276; H -0.6276 0.6276 -0.6276; H 0.6276 -0.6276 -0.6276",
    "ammonia": "N 0 0 0.1173; H 0 0.9377 -0.2737; H 0.8121 -0.4689 -0.2737; H -0.8121 -0.4689 -0.2737",
    "nitrogen": "N 0 0 0; N 0 0 1.0977",
    "carbon dioxide": "C 0 0 0; O 0 0 1.1621; O 0 0 -1.1621",
}


def installed() -> bool:
    try:
        import pyscf  # noqa: F401
        return True
    except Exception:
        return False


def solve(problem: dict[str, Any]) -> dict[str, Any]:
    if not installed():
        return {"solver": NAME, "hold": True, "reason": "pyscf_not_installed", "install": INSTALL}
    name = problem.get("molecule")
    if name not in GEOMETRY:
        return {"solver": NAME, "hold": True, "reason": "geometry_unknown", "molecule": name, "known": sorted(GEOMETRY)}
    import pyscf
    from pyscf import dft, gto, scf
    mol = gto.M(atom=GEOMETRY[name], basis="6-31g", verbose=0)
    if problem.get("method") == "DFT":
        mf = dft.RKS(mol); mf.xc = "b3lyp"; how = "RKS/B3LYP/6-31G"
    else:
        mf = scf.RHF(mol); how = "RHF/6-31G"
    e = float(mf.kernel())
    occ = mf.mo_occ
    homo = float(mf.mo_energy[occ > 0].max()); lumo = float(mf.mo_energy[occ == 0].min())
    return {"solver": NAME, "engine": "pyscf " + pyscf.__version__ + " " + how + " (Home PC)", "outcome": "converge" if mf.converged else "run",
            "measurements": {"molecule": name, "method": how, "total_energy_hartree": round(e, 6), "homo_hartree": round(homo, 5),
                             "lumo_hartree": round(lumo, 5), "converged": bool(mf.converged)}}
