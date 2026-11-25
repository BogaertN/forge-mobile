"""Home PC slot: the fixed PyBullet DIRECT falling cube from BogaertN/forge main.py.

The simulation type is pybullet_fixed_falling_cube: one box, gravity, no GUI, no URDF, no mesh,
and no caller-supplied code. If PyBullet is not installed the solver returns a structured hold
and the install command. It does not store a fact.
"""
from __future__ import annotations

from typing import Any

NAME = "pybullet_falling_cube"
INSTALL = {"pip": "python3 -m pip install pybullet==3.2.7", "docs": "https://pybullet.org/wordpress/"}


def installed() -> bool:
    try:
        import pybullet  # noqa: F401
        return True
    except Exception:
        return False


def solve(problem: dict[str, Any] | None = None) -> dict[str, Any]:
    del problem  # the cube, the drop, and the step count are fixed; the caller does not supply a model
    if not installed():
        return {"solver": NAME, "hold": True, "reason": "pybullet_not_installed", "install": INSTALL, "calls_llm": False}
    import pybullet as p
    client = p.connect(p.DIRECT)
    try:
        p.setGravity(0, 0, -9.81, physicsClientId=client)
        ground = p.createCollisionShape(p.GEOM_PLANE, physicsClientId=client)
        p.createMultiBody(baseMass=0, baseCollisionShapeIndex=ground, physicsClientId=client)
        box = p.createCollisionShape(p.GEOM_BOX, halfExtents=[0.05, 0.05, 0.05], physicsClientId=client)
        body = p.createMultiBody(baseMass=1, baseCollisionShapeIndex=box, basePosition=[0, 0, 1], physicsClientId=client)
        z0 = float(p.getBasePositionAndOrientation(body, physicsClientId=client)[0][2])
        for _ in range(240):
            p.stepSimulation(physicsClientId=client)
        z1 = float(p.getBasePositionAndOrientation(body, physicsClientId=client)[0][2])
    finally:
        p.disconnect(physicsClientId=client)
    return {"solver": NAME, "engine": "PyBullet DIRECT falling cube (Home PC)", "outcome": "fell" if z1 < z0 else "held",
            "calls_llm": False, "gui": False, "urdf": False, "mesh": False,
            "measurements": {"z_start_m": round(z0, 6), "z_end_m": round(z1, 6), "steps": 240, "fell": z1 < z0 - 1e-4}}
