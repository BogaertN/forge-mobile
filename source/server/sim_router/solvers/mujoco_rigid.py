"""Rigid-body solver: compile a FORGE-SIM-SCENE/v1 into MJCF, step MuJoCo, and measure the outcome."""
from __future__ import annotations

import math
from typing import Any

import mujoco
import numpy as np

NAME = "mujoco_rigid"
HANDLES = ("push", "drop")
SIM_SECONDS = 2.0
DT = 0.0005


def _geom(body: dict[str, Any]) -> tuple[str, str, float]:
    s = body["shape"]
    if s == "cylinder":
        return "cylinder", f'{body["radius"]:.6f} {body["height"] / 2:.6f}', body["height"] / 2
    if s == "box":
        return "box", f'{body["width"] / 2:.6f} {body["width"] / 2:.6f} {body["height"] / 2:.6f}', body["height"] / 2
    return "sphere", f'{body["radius"]:.6f}', body["radius"]


def mjcf(scene: dict[str, Any]) -> str:
    body = scene["body"]
    gtype, gsize, half = _geom(body)
    mu = float(scene["surface"]["mu"])
    z0 = half + (scene.get("drop_height", 0.0) if scene["action"] == "drop" else 0.0)
    return f"""<mujoco model="forge_scene">
  <option timestep="{DT}" gravity="0 0 -{scene['gravity']}" integrator="implicitfast" cone="elliptic"/>
  <default><geom condim="3" solref="0.002 1" solimp="0.95 0.99 0.001"/></default>
  <worldbody>
    <geom name="surface" type="plane" size="50 50 0.1" friction="{mu} 0.005 0.0001"/>
    <body name="obj" pos="0 0 {z0:.6f}">
      <freejoint/>
      <geom name="obj" type="{gtype}" size="{gsize}" mass="{body['mass']}" friction="{mu} 0.005 0.0001"/>
    </body>
  </worldbody>
</mujoco>"""


def _tilt_deg(d: Any, bid: int) -> float:
    zaxis = d.xmat[bid].reshape(3, 3)[:, 2]
    return math.degrees(math.acos(max(-1.0, min(1.0, float(zaxis[2])))))


def solve(scene: dict[str, Any]) -> dict[str, Any]:
    xml = mjcf(scene)
    m = mujoco.MjModel.from_xml_string(xml)
    d = mujoco.MjData(m)
    bid = mujoco.mj_name2id(m, mujoco.mjtObj.mjOBJ_BODY, "obj")
    mujoco.mj_forward(m, d)
    p0 = d.xpos[bid].copy()
    body = scene["body"]
    mass = float(body["mass"])
    g = float(scene["gravity"])
    seconds = SIM_SECONDS
    if scene["action"] == "drop":
        seconds = math.sqrt(2 * float(scene.get("drop_height", 1.0)) / g) + 0.5
    steps = int(seconds / DT)
    max_tilt, max_w, first_contact_t = 0.0, 0.0, None
    push = scene.get("push") or {}
    T = float(push.get("duration_s", 0))
    F = 0.0
    # application point in the body frame (height above base, on the -x face, force along +x)
    if scene["action"] == "push":
        _, _, half = _geom(body)
        h = float(scene["point"]["fraction"]) * (2 * half if body["shape"] != "sphere" else 2 * body["radius"])
        face = -(body["radius"] if body["shape"] != "box" else body["width"] / 2)
        r_local = np.array([face, 0.0, h - half])
        # FORGE push convention: the smallest horizontal force that starts the body moving, by either way it can
        # move (overcome static friction, or rotate about its front edge), times a margin. The solver then decides
        # which way it actually moves.
        mu = float(scene.get("push_reference_mu") or scene["surface"]["mu"])
        half_w = body["radius"] if body["shape"] != "box" else body["width"] / 2
        f_slip = mu * mass * g
        f_tip = mass * g * half_w / max(h, 1e-6) if body["shape"] != "sphere" else float("inf")
        F = float(push.get("margin", 1.25)) * min(f_slip, f_tip)
    for i in range(steps):
        d.xfrc_applied[bid, :] = 0
        if scene["action"] == "push" and i * DT < T:
            R = d.xmat[bid].reshape(3, 3)
            r = R @ r_local
            f = np.array([F, 0.0, 0.0])
            d.xfrc_applied[bid, :3] = f
            d.xfrc_applied[bid, 3:] = np.cross(r, f)
        mujoco.mj_step(m, d)
        max_tilt = max(max_tilt, _tilt_deg(d, bid))
        max_w = max(max_w, float(np.linalg.norm(d.qvel[3:6])))
        if first_contact_t is None and d.ncon > 0 and scene["action"] == "drop":
            first_contact_t = round((i + 1) * DT, 4)
    p1 = d.xpos[bid].copy()
    tilt = _tilt_deg(d, bid)
    disp = float(np.linalg.norm((p1 - p0)[:2]))
    dz = float(p1[2] - p0[2])
    if scene["action"] == "drop":
        outcome = "fall" if dz < -0.5 * max(scene.get("drop_height", 0.0), 0.02) else "stay"
    elif body["shape"] == "sphere":
        outcome = "roll" if disp > 0.02 else "stay"
    elif tilt > 60.0:
        outcome = "topple"
    elif disp > 0.02:
        outcome = "slide"
    else:
        outcome = "stay"
    return {
        "solver": NAME, "engine": "mujoco " + mujoco.__version__, "outcome": outcome,
        "measurements": {
            "sim_seconds": round(seconds, 3), "timestep": DT, "final_tilt_deg": round(tilt, 2), "max_tilt_deg": round(max_tilt, 2),
            "horizontal_displacement_m": round(disp, 4), "vertical_change_m": round(dz, 4),
            "max_angular_speed_rad_s": round(max_w, 3), "contacts_at_end": int(d.ncon),
            **({"push_force_N": round(F, 3), "push_rule": "1.25 x min(mu_table m g, m g w/2 / h)", "push_duration_s": T, "push_height_m": round(float(r_local[2] + _geom(body)[2]), 4)} if scene["action"] == "push" else {}),
            **({"first_contact_s": first_contact_t} if scene["action"] == "drop" else {}),
        },
        "classifier": "topple if final tilt > 60 deg; else slide if horizontal displacement > 0.02 m; else stay (sphere: roll; drop: fall if it lost > half the drop height)",
        "mjcf": xml,
    }
