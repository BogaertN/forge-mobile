# Home PC

Nic runs this on Ubuntu. It serves the sim router and lets Neo's interval plan Athena's gap queue. It does not widen Neo's duty. A hosted write goes only through the existing gated writer. A `service_role` token is refused. With no writer credential the loop plans and does not write.

## Setup

1. Install Ubuntu packages you want available. OpenFOAM is `openfoam12` from openfoam.org, then `source /opt/openfoam12/etc/bashrc`. It is not a pip package.
2. From `source/`, run `sh server/home_pc/install.sh`. The script makes `.venv` and tries the optional wheels: mujoco, pyscf, pybullet, python-copasi or basico, openmm, neuron. A missing wheel is recorded and does not stop the rest.
3. `cp server/home_pc/.env.example server/home_pc/.env` and set the port and origin. Leave the writer lines empty unless you have a narrowly scoped writer session. Do not paste a service role key.
4. Try it: `. server/home_pc/.venv/bin/activate` then `python -m server.home_pc.run`. `GET /v1/health` lists the solvers.
5. Install the unit: copy `forge-home-pc.service` to `~/.config/systemd/user/`, edit the paths if the tree is not `/opt/forge-mobile`, then `systemctl --user enable --now forge-home-pc.service`.
6. On the phone, open Custody. The Settings field is the Home PC address. Save it, then Test Connection. The status line is the health.

The phone page can reach `https://` or `http://localhost` on the same device. A plain `http://` address on another computer is refused.

## Harmonic Conductor Studio

HCS stays its own desktop app on this Ubuntu machine. The home node only exchanges `.hfield` packets with it. A packet from HCS is a claim: `peer_is_publisher` and `auto_persist` are refused, and Gilligan still has to pass the claim before anything is kept.

Build the crates this bridge talks to (Ubuntu 24.04, the RTX 3060 Ti is for the HCS app, not for this Python process):

1. Install Rust from https://rustup.rs if `cargo` is missing.
2. `git clone https://github.com/BogaertN/harmonic-conductor-studio.git`
3. `cd harmonic-conductor-studio && cargo build -p hfield-packet -p hfield-forge-bridge -p hfield-cymatics`
4. Run the HCS app from that tree the way its own README says. Point `FORGE_HCS_URL` at it. Leave the variable empty and this node holds packets instead of forwarding them.

`python -c "from server.home_pc.hcs_bridge import exchange; print(exchange({'schema':'aiweb.hfield'}))"` should print `HCS-HELD` when the URL is empty.

