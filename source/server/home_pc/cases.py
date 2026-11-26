"""Starter cases for the home PC. A result is evidence. It is never a publisher.

Reference numbers are the published checks a local solver would be compared with.
No solver is invoked here. Ozone is a hold: one single-reference energy is not that molecule.
"""
from __future__ import annotations

from typing import Any


CFD = (
    {"id": "lid-driven-cavity", "cite": "Ghia, Ghia, Shin 1982", "quantity": "u_min_centerline", "value": -0.21090, "re": 100},
    {"id": "backward-step", "cite": "Armaly, Durst, Pereira, Schonung 1983", "quantity": "reattachment_xh", "value": 6.0, "re": 100},
    {"id": "pipe-flow", "cite": "Hagen-Poiseuille", "quantity": "f_darcy_laminar", "value": 64.0, "note": "f = 64/Re at Re=1, reported as 64"},
    {"id": "cylinder-wake", "cite": "Tritton 1959", "quantity": "cd", "value": 1.4, "re": 40},
    {"id": "dam-break", "cite": "Ritter 1892", "quantity": "front_speed_over_sqrt_gh", "value": 2.0},
    {"id": "heated-cavity", "cite": "de Vahl Davis 1983", "quantity": "nu_avg", "value": 2.238, "ra": 1e4},
    {"id": "sphere-drag", "cite": "Stokes", "quantity": "cd", "value": 24.0, "note": "Cd = 24/Re at Re=1, reported as 24"},
    {"id": "airfoil", "cite": "Abbott and von Doenhoff", "quantity": "cl_slope_per_rad", "value": 6.28, "note": "thin-airfoil 2π"},
    {"id": "flat-plate", "cite": "Blasius", "quantity": "cf_sqrt_re", "value": 0.664},
    {"id": "scalar-mixing", "cite": "conservation", "quantity": "mass_fraction_sum", "value": 1.0},
)

MOLECULES = (
    {"id": "H2", "cite": "NIST CCCBDB", "quantity": "bond_angstrom", "value": 0.741},
    {"id": "N2", "cite": "NIST CCCBDB", "quantity": "bond_angstrom", "value": 1.098},
    {"id": "O2", "cite": "NIST CCCBDB", "quantity": "bond_angstrom", "value": 1.208},
    {"id": "H2O", "cite": "NIST CCCBDB", "quantity": "angle_deg", "value": 104.5},
    {"id": "NH3", "cite": "NIST CCCBDB", "quantity": "angle_deg", "value": 106.7},
    {"id": "CH4", "cite": "NIST CCCBDB", "quantity": "angle_deg", "value": 109.47},
    {"id": "CO2", "cite": "NIST CCCBDB", "quantity": "angle_deg", "value": 180.0},
    {"id": "water-dimer", "cite": "Lane 2013", "quantity": "binding_kcal", "value": -5.0},
    {"id": "NaCl-aq", "cite": "CRC", "quantity": "solubility_g_per_100ml_20c", "value": 35.9},
    {"id": "methane-combustion", "cite": "NIST chemistry webbook", "quantity": "dh_kj_mol", "value": -802.0, "note": "CH4 + 2 O2 → CO2 + 2 H2O"},
    {"id": "ethane-conformer", "cite": "staggered vs eclipsed", "quantity": "barrier_kcal", "value": 2.9},
    {"id": "butane-conformer", "cite": "anti vs gauche", "quantity": "gap_kcal", "value": 0.9},
    {"id": "benzene", "cite": "NIST CCCBDB", "quantity": "cc_angstrom", "value": 1.397},
    {"id": "HCN", "cite": "NIST CCCBDB", "quantity": "relative_kcal", "value": 0.0},
    {"id": "HNC", "cite": "NIST CCCBDB", "quantity": "relative_kcal_above_HCN", "value": 14.0},
    {"id": "glycine", "cite": "conformer I", "quantity": "rank", "value": 1},
    {"id": "glucose", "cite": "beta-pyranose chair", "quantity": "rank", "value": 1},
    {"id": "caffeine", "cite": "PubChem CID 2519", "quantity": "heavy_atoms", "value": 14},
    {"id": "aspirin", "cite": "PubChem CID 2244", "quantity": "heavy_atoms", "value": 13},
    {"id": "O3", "should_hold": True, "cite": "ozone needs more than one reference configuration", "quantity": "single_reference", "value": None},
)

PRIORITY_INSTALL = (
    "openfoam", "pyscf", "gpu4pyscf", "xtb", "crest", "rdkit", "openbabel",
    "openmm", "ase", "pybullet", "mujoco",
)
PRIORITY_OPTIONAL = (
    "su2", "psi4", "cantera", "lammps", "fenicsx", "copasi", "neuron", "rebound", "qutip",
)


def cases() -> list[dict[str, Any]]:
    rows = []
    for row in list(CFD) + list(MOLECULES):
        item = dict(row)
        item["publisher"] = False
        item["evidence_only"] = True
        item["stored_as_fact"] = False
        rows.append(item)
    return rows


def check(case_id: str, measured: float | None = None, *, tol: float = 0.05) -> dict[str, Any]:
    found = next((c for c in cases() if c["id"] == case_id), None)
    if not found:
        return {"ok": False, "rule": "CASE-UNKNOWN", "publisher": False, "calls_llm": False}
    if found.get("should_hold"):
        return {"ok": True, "rule": "CASE-HOLD", "status": "hold", "id": case_id, "publisher": False, "stored_as_fact": False, "evidence_only": True, "calls_llm": False}
    if measured is None:
        return {"ok": True, "rule": "CASE-NOT-RUN", "status": "not_run", "id": case_id, "reference": found, "publisher": False, "stored_as_fact": False, "calls_llm": False}
    ref = float(found["value"])
    span = max(abs(ref) * tol, 1e-6)
    close = abs(float(measured) - ref) <= span
    return {
        "ok": True,
        "rule": "CASE-EVIDENCE" if close else "CASE-OFF-REFERENCE",
        "status": "evidence" if close else "off_reference",
        "id": case_id,
        "measured": float(measured),
        "reference": ref,
        "cite": found.get("cite"),
        "publisher": False,
        "stored_as_fact": False,
        "evidence_only": True,
        "calls_llm": False,
    }
