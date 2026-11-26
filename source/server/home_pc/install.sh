#!/bin/sh
# Ubuntu home PC. Install-first solvers are attempted before the optional set.
# A missing wheel is recorded and does not stop the rest. OpenFOAM, SU2, and the
# chemistry binaries are system packages; the script only notes them.
set -e
cd "$(dirname "$0")"
python3 -m venv .venv
. .venv/bin/activate
python -m pip install --upgrade pip
python -m pip install sympy numpy scipy biopython astropy || true
# Install first.
python -m pip install pyscf==2.8.0 || echo "pyscf: not installed"
python -m pip install gpu4pyscf || echo "gpu4pyscf: not installed (needs CUDA 12)"
python -m pip install rdkit || echo "rdkit: not installed"
python -m pip install openbabel-wheel || echo "openbabel: not installed"
python -m pip install openmm || echo "openmm: not installed"
python -m pip install ase || echo "ase: not installed"
python -m pip install pybullet==3.2.7 || echo "pybullet: not installed"
python -m pip install mujoco==3.17.0 || echo "mujoco: not installed"
# Optional next.
python -m pip install psi4 || echo "psi4: not installed"
python -m pip install cantera || echo "cantera: not installed"
python -m pip install fenics-dolfinx || echo "fenicsx: not installed"
python -m pip install python-copasi || python -m pip install basico || echo "copasi: not installed"
python -m pip install neuron || echo "neuron: not installed"
python -m pip install rebound || echo "rebound: not installed"
python -m pip install qutip || echo "qutip: not installed"
echo "OpenFOAM: system package openfoam12. Then source /opt/openfoam12/etc/bashrc."
echo "xtb and CREST: conda-forge or the Grimme releases, not required for this venv."
echo "SU2 and LAMMPS: system or upstream builds. Optional."
echo "Install finished. Copy .env.example to .env before the service starts."
