"""Home PC slot: COPASI, named on the AIWEBOS simulator list as the biochemical-network solver.

The model is a fixed one-reaction network (species A becomes species B). The caller does not supply a model,
a file, or code. If COPASI is not installed the solver returns a structured hold and the install command.
It does not store a fact.
"""
from __future__ import annotations

from typing import Any

NAME = "copasi_network"
INSTALL = {"pip": "python3 -m pip install python-copasi", "docs": "https://copasi.org/"}
_MODEL = """<?xml version="1.0" encoding="UTF-8"?>
<sbml xmlns="http://www.sbml.org/sbml/level2/version4" level="2" version="4">
  <model id="fixed_conversion">
    <listOfCompartments><compartment id="cell" size="1"/></listOfCompartments>
    <listOfSpecies>
      <species id="A" compartment="cell" initialAmount="1"/>
      <species id="B" compartment="cell" initialAmount="0"/>
    </listOfSpecies>
    <listOfReactions>
      <reaction id="convert" reversible="false">
        <listOfReactants><speciesReference species="A"/></listOfReactants>
        <listOfProducts><speciesReference species="B"/></listOfProducts>
        <kineticLaw>
          <math xmlns="http://www.w3.org/1998/Math/MathML"><ci>A</ci></math>
        </kineticLaw>
      </reaction>
    </listOfReactions>
  </model>
</sbml>
"""


def installed() -> bool:
    try:
        import COPASI  # noqa: F401
        return True
    except Exception:
        return False


def solve(problem: dict[str, Any] | None = None) -> dict[str, Any]:
    del problem
    if not installed():
        return {"solver": NAME, "hold": True, "reason": "copasi_not_installed", "install": INSTALL, "calls_llm": False}
    import COPASI
    data = COPASI.CDataModel()
    if not data.importSBMLFromString(_MODEL):
        return {"solver": NAME, "hold": True, "reason": "copasi_model_rejected", "install": INSTALL, "calls_llm": False}
    task = data.getTask("Time-Course")
    if task is None:
        return {"solver": NAME, "hold": True, "reason": "copasi_time_course_missing", "install": INSTALL, "calls_llm": False}
    problem = task.getProblem()
    problem.setDuration(1)
    problem.setStepNumber(10)
    if not task.process(True):
        return {"solver": NAME, "hold": True, "reason": "copasi_process_failed", "install": INSTALL, "calls_llm": False}
    amounts = {}
    model = data.getModel()
    for species in model.getMetabolites():
        amounts[species.getObjectName()] = float(species.getValue())
    return {"solver": NAME, "engine": "COPASI time course (Home PC)", "outcome": "run", "calls_llm": False,
            "measurements": {"species": amounts, "duration": 1, "steps": 10, "model": "fixed A to B"}}
