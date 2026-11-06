"""Rigid-body solver (native MuJoCo on a Home PC). The job (MJCF, push force and point) and the classifier come from
engine sim_device, the same code the phone's WASM MuJoCo uses, so both give the same receipt shape."""
from __future__ import annotations

import math
from typing import Any

import mujoco
import numpy as np

from rmc_engine_v1 import sim_device as S

NAME = "mujoco_rigid"
HANDLES = ("push", "drop")


def measure(job: dict[str, Any]) -> dict[str, Any]:
    m = mujoco.MjModel.from_xml_string(job["xml"])
    d = mujoco.MjData(m)
    b = job["body"]
    mujoco.mj_forward(m, d)
    p0 = d.xpos[b].copy()
    tilt = lambda: math.degrees(math.acos(max(-1.0, min(1.0, float(d.xmat[b].reshape(3, 3)[2, 2])))))
    r_local, F, T, dt = np.array(job["r_local"]), job["force"], job["duration"], job["dt"]
    max_tilt = max_w = 0.0
    first = None
    for i in range(job["steps"]):
        d.xfrc_applied[b, :] = 0
        if F and i * dt < T:
            r = d.xmat[b].reshape(3, 3) @ r_local
            f = np.array([F, 0.0, 0.0])
            d.xfrc_applied[b, :3] = f
            d.xfrc_applied[b, 3:] = np.cross(r, f)
        mujoco.mj_step(m, d)
        max_tilt = max(max_tilt, tilt())
        max_w = max(max_w, float(np.linalg.norm(d.qvel[3:6])))
        if job["drop"] and first is None and d.ncon > 0:
            first = round((i + 1) * dt, 4)
    p1 = d.xpos[b].copy()
    ms = {"sim_seconds": job["seconds"], "timestep": dt, "steps": job["steps"], "final_tilt_deg": round(tilt(), 2),
          "max_tilt_deg": round(max_tilt, 2), "horizontal_displacement_m": round(float(np.linalg.norm((p1 - p0)[:2])), 4),
          "vertical_change_m": round(float(p1[2] - p0[2]), 4), "max_angular_speed_rad_s": round(max_w, 3),
          "contacts_at_end": int(d.ncon)}
    if job["drop"]:
        ms["first_contact_s"] = first
    return {"measurements": ms, "version": mujoco.__version__}


def solve(problem: dict[str, Any]) -> dict[str, Any]:
    run = S.finish(problem, measure(S.mujoco_job(problem["scene"])))
    run["engine"] = "mujoco " + mujoco.__version__ + " (native, Home PC)"
    return run
