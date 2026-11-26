#!/bin/sh
# Ubuntu home PC. Optional solvers are attempted and recorded. A missing one does not stop the install.
set -e
cd "$(dirname "$0")"
python3 -m venv .venv
. .venv/bin/activate
python -m pip install --upgrade pip
python -m pip install sympy numpy scipy biopython astropy || true
python -m pip install mujoco==3.17.0 || echo "mujoco: not installed"
python -m pip install pyscf==2.8.0 || echo "pyscf: not installed"
python -m pip install pybullet==3.2.7 || echo "pybullet: not installed"
python -m pip install python-copasi || python -m pip install basico || echo "copasi: not installed"
python -m pip install openmm || echo "openmm: not installed"
python -m pip install neuron || echo "neuron: not installed"
echo "OpenFOAM is a system package, not a pip wheel. See README.md."
echo "Install finished. Copy .env.example to .env before the service starts."
