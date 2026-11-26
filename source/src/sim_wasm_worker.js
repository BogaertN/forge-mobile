/* 4.9.245 sim_wasm_worker.js — the on-device WebAssembly simulators (module worker, same origin).
 * MuJoCo 3.17.0 (rigid bodies), RDKit 2026.09.2 (molecules) and ngspice 45.2 via eecircuit-engine 1.9.0 (circuits).
 * Each engine file is pinned by exact version and SHA-384, fetched only when an ask needs it (from jsDelivr, or from
 * the local override folder set in localStorage forge.sim_assets for an air-gapped phone or Home PC), checked before it
 * runs, kept in the Cache API (forge-sim-v1) so it works offline after first use, and imported from a Blob URL. A
 * mismatch is never run and its cache entry is removed. This worker measures; Python seals the receipt. No model.
 * It runs as its own same-origin script so the Emscripten embind glue can build its call stubs without loosening the
 * page's script policy. */
const CDN = 'https://cdn.jsdelivr.net/npm/';
const ASSETS = {
  'mujoco.js': { path: '@mujoco/mujoco@3.17.0/mujoco.js', sri: 'sha384-YEFOwRTR97kIK3/Jwfy+kPUBJZQFMapkHzI9j8cm00qv3BJYVaP6OfXCJaMjhT4h' },
  'mujoco.wasm': { path: '@mujoco/mujoco@3.17.0/mujoco.wasm', sri: 'sha384-zrkngfcNADmK71k5HLnbmQ/HsLqTRJfxTR/PRItg1MypO4vaEA5ADFCGcg66gMqb' },
  'RDKit_minimal.js': { path: '@rdkit/rdkit@2026.9.2/dist/RDKit_minimal.js', sri: 'sha384-RnhYDUmCQc4ovw3FMvwtiovU9DOK8HaD4OkecA5gTYx8e3tBxCC82heb+3Z6e5RE' },
  'RDKit_minimal.wasm': { path: '@rdkit/rdkit@2026.9.2/dist/RDKit_minimal.wasm', sri: 'sha384-3A4Sst+3zsG/E8CphvEqakRn7Dh5GboZFKZH4o6z/3NvHGSiJnUTI7qofSyhb6B4' },
  'eecircuit-engine.mjs': { path: 'eecircuit-engine@1.9.0/dist/eecircuit-engine.mjs', sri: 'sha384-+ERlDBv5IDKjjgMii/erQz5/q93+GJilHINYm/E5IOQFe7j/tA/cKOFJ79he8btR' },
};
const CACHE = 'forge-sim-v1';
const engines = {};
const log = [];
async function sha384(buf) { const d = new Uint8Array(await crypto.subtle.digest('SHA-384', buf)); let s = ''; for (const b of d) s += String.fromCharCode(b); return 'sha384-' + btoa(s); }
function urlOf(name, local) { const a = ASSETS[name]; return local ? local.replace(/\/+$/, '') + '/' + a.path : CDN + a.path; }
async function asset(name, local) {
  const a = ASSETS[name]; const url = urlOf(name, local);
  let cache = null; try { cache = await caches.open(CACHE); } catch (e) { cache = null; }
  let res = cache ? await cache.match(url) : null; let from = 'cache';
  if (!res) { from = local ? 'local' : 'network'; res = await fetch(url, { credentials: 'omit', referrerPolicy: 'no-referrer', integrity: a.sri }); if (!res.ok) throw new Error('sim_asset_http_' + res.status + '_' + name); }
  const buf = await res.arrayBuffer();
  if (await sha384(buf) !== a.sri) { if (cache) { try { await cache.delete(url); } catch (e) {} } throw new Error('sim_asset_integrity_mismatch_' + name); }
  if (from !== 'cache' && cache) { try { await cache.put(url, new Response(buf.slice(0))); } catch (e) {} }
  log.push({ name, path: a.path, sri: a.sri, verified: true, from, bytes: buf.byteLength });
  return buf;
}
async function importBuf(buf, suffix, url) {
  /* Emscripten resolves its side files against import.meta.url; a Blob URL is not a valid base, so the verified text is
   * given its real asset URL (the bytes were already checked against the pin). */
  let src = new TextDecoder().decode(buf);
  const onNode = typeof process !== 'undefined' && process.versions && process.versions.node;
  if (url && !onNode) src = src.split('import.meta.url').join(JSON.stringify(url));
  const parts = [src]; if (suffix) parts.push('\n' + suffix + '\n');
  if (typeof process !== 'undefined' && process.versions && process.versions.node && typeof require === 'function') {
    const fs = require('fs'), os = require('os'), path = require('path'), { pathToFileURL } = require('url');
    const file = path.join(os.tmpdir(), 'forge-wasm-' + process.pid + '-' + Date.now() + '.mjs');
    fs.writeFileSync(file, src);
    try { return await import(pathToFileURL(file).href); } finally { try { fs.unlinkSync(file); } catch (e) {} }
  }
  const u = URL.createObjectURL(new Blob(parts, { type: 'text/javascript' }));
  try { return await import(u); } finally { URL.revokeObjectURL(u); }
}
async function mujoco(local) {
  if (!engines.mujoco) engines.mujoco = (async () => { const [js, wasm] = await Promise.all([asset('mujoco.js', local), asset('mujoco.wasm', local)]); const mod = await importBuf(js, '', urlOf('mujoco.js', local)); return mod.default({ wasmBinary: wasm }); })();
  return engines.mujoco;
}
async function rdkit(local) {
  if (!engines.rdkit) engines.rdkit = (async () => { const [js, wasm] = await Promise.all([asset('RDKit_minimal.js', local), asset('RDKit_minimal.wasm', local)]); const mod = await importBuf(js, 'export default initRDKitModule;'); return mod.default({ wasmBinary: wasm, instantiateWasm: (imports, done) => { WebAssembly.instantiate(wasm, imports).then(r => done(r.instance, r.module)); return {}; } }); })();
  return engines.rdkit;
}
async function spice(local) {
  if (!engines.spice) engines.spice = (async () => { const js = await asset('eecircuit-engine.mjs', local); const mod = await importBuf(js, '', urlOf('eecircuit-engine.mjs', local)); const sim = new mod.Simulation(); await sim.start(); return sim; })();
  return engines.spice;
}
/* The MuJoCo loop mirrors the Python solver: a steady horizontal force F at a body-frame point r for the push duration,
 * applied each step as xfrc_applied = (F, R r × F), then measurements. Python plans the job and classifies. */
async function runMujoco(job, local) {
  const mj = await mujoco(local);
  const m = mj.MjModel.from_xml_string(job.xml); const d = new mj.MjData(m);
  try {
    const b = job.body | 0; const dt = job.dt; const r = job.r_local;
    const hold = job.force || 0; const holdFor = job.duration || 0;
    mj.mj_forward(m, d);
    const p0 = Array.from(d.xpos.slice(3 * b, 3 * b + 3));
    const tilt = () => { const z = d.xmat[9 * b + 8]; return Math.acos(Math.max(-1, Math.min(1, z))) * 180 / Math.PI; };
    let maxTilt = 0, maxW = 0, first = null;
    let prev = p0.slice();
    let prevSpeed = 0;
    let slipRun = 0;
    let contactAt = null;
    const mass = job.mass || 0;
    const grav = job.gravity || 0;
    const weight = mass * grav;
    const cap = (job.cap_per_weight || 5) * weight;
    const rampS = job.ramp_s || job.seconds || 2;
    const mu = job.mu || 0;
    const halfW = job.half_w || 0;
    const bodyH = job.height || 0;
    const pushH = job.push_height_m || 0;
    const r4 = (v, n) => Math.round(v * 10 ** n) / 10 ** n;
    function note(kind, i, Fnow, tiltDeg) {
      const tr = tiltDeg * Math.PI / 180;
      const limit = mu * mass * grav * Math.max(0.2, Math.cos(tr));
      const over = Fnow * pushH;
      const restore = mass * grav * Math.max(0, halfW * Math.cos(tr) - (bodyH / 2) * Math.sin(tr));
      return {
        first_event: kind, first_event_s: r4((i + 1) * dt, 4), force_at_onset_N: r4(Fnow, 4),
        contact_force_N: r4(Fnow, 4), friction_limit_N: r4(limit, 4),
        overturning_torque_Nm: r4(over, 4), restoring_torque_Nm: r4(restore, 4),
        contact_exceeds_friction: kind === 'slip' ? 1 : 0,
        torque_exceeds_restoring: kind === 'tip' ? 1 : 0
      };
    }
    for (let i = 0; i < job.steps; i++) {
      const t = i * dt;
      let Fnow = 0;
      if (job.ramp && !first) Fnow = Math.min(cap, weight * (t / Math.max(rampS, 1e-6)));
      else if (!job.ramp && hold && t < holdFor) Fnow = hold;
      const x = d.xfrc_applied; for (let k = 0; k < 6; k++) x[6 * b + k] = 0;
      if (Fnow) {
        const R = d.xmat.slice(9 * b, 9 * b + 9);
        const rw = [R[0] * r[0] + R[1] * r[1] + R[2] * r[2], R[3] * r[0] + R[4] * r[1] + R[5] * r[2], R[6] * r[0] + R[7] * r[1] + R[8] * r[2]];
        /* torque = rw × (F, 0, 0) = (0, rw_z F, -rw_y F) */
        x[6 * b] = Fnow; x[6 * b + 4] = rw[2] * Fnow; x[6 * b + 5] = -rw[1] * Fnow;
      }
      mj.mj_step(m, d);
      const tiltDeg = tilt();
      maxTilt = Math.max(maxTilt, tiltDeg);
      const v = d.qvel; maxW = Math.max(maxW, Math.hypot(v[3], v[4], v[5]));
      const p = Array.from(d.xpos.slice(3 * b, 3 * b + 3));
      const speed = Math.hypot(p[0] - prev[0], p[1] - prev[1]) / Math.max(dt, 1e-6);
      const dist = Math.hypot(p[0] - p0[0], p[1] - p0[1]);
      if (job.ramp && !first && weight > 0 && job.shape !== 'sphere') {
        const tr = tiltDeg * Math.PI / 180;
        const demand = Fnow;
        const limit = mu * mass * grav * Math.max(0.2, Math.cos(tr));
        const over = Fnow * pushH;
        const restore = mass * grav * Math.max(0, halfW * Math.cos(tr) - (bodyH / 2) * Math.sin(tr));
        const tips = pushH > 0 && over > restore && restore > 0;
        const slips = limit > 0 && demand > limit;
        if (tips && !slips) first = note('tip', i, Fnow, tiltDeg);
        else if (slips && !tips) first = note('slip', i, Fnow, tiltDeg);
      } else if (job.ramp && !first && speed > 0.05) {
        slipRun += 1;
        if (slipRun >= 4) first = note('slip', i, Fnow, tiltDeg);
      }
      prevSpeed = speed;
      prev = p;
      if (job.drop && contactAt === null && d.ncon > 0) contactAt = Math.round((i + 1) * dt * 1e4) / 1e4;
    }
    const p1 = Array.from(d.xpos.slice(3 * b, 3 * b + 3));
    const ms = { sim_seconds: job.seconds, timestep: dt, steps: job.steps, final_tilt_deg: r4(tilt(), 2), max_tilt_deg: r4(maxTilt, 2),
      horizontal_displacement_m: r4(Math.hypot(p1[0] - p0[0], p1[1] - p0[1]), 4), vertical_change_m: r4(p1[2] - p0[2], 4),
      max_angular_speed_rad_s: r4(maxW, 3), contacts_at_end: d.ncon | 0 };
    if (job.drop) ms.first_contact_s = contactAt;
    if (first && first.first_event) Object.assign(ms, first);
    else if (job.ramp) ms.first_event = 'none';
    return { measurements: ms, version: '3.17.0', nbody: m.nbody };
  } finally { try { d.delete(); m.delete(); } catch (e) {} }
}
async function runRdkit(arg, local) {
  const R = await rdkit(local); const mol = R.get_mol(arg.smiles);
  if (!mol) throw new Error('rdkit_bad_smiles');
  try { return { version: R.version(), descriptors: mol.get_descriptors(), mol_json: mol.get_json(), num_atoms: mol.get_num_atoms(), num_bonds: mol.get_num_bonds() }; }
  finally { mol.delete(); }
}
async function runSpice(arg, local) {
  const sim = await spice(local); sim.setNetList(arg.netlist); const res = await sim.runSim();
  return { result: { header: res.header, numVariables: res.numVariables, variableNames: res.variableNames, numPoints: res.numPoints, dataType: res.dataType,
    data: (res.data || []).map(c => ({ name: c.name, type: c.type, values: Array.from(c.values || []).map(v => typeof v === 'number' ? v : (v && v.real != null ? v.real : Number(v))) })) } };
}
async function dispatch(cmd, arg, local) {
  if (cmd === 'mujoco') return runMujoco(arg, local);
  if (cmd === 'rdkit') return runRdkit(arg, local);
  if (cmd === 'spice') return runSpice(arg, local);
  if (cmd === 'assets') return { assets: ASSETS, cdn: CDN, cache: CACHE };
  throw new Error('unknown_cmd');
}
self.onmessage = async e => {
  const { id, cmd, arg, local } = e.data || {}; const n0 = log.length; const t0 = performance.now();
  try {
    let out = await dispatch(cmd, arg, local);
    out.assets_loaded = log.slice(n0); out.ms = Math.round(performance.now() - t0);
    self.postMessage({ id, ok: true, out });
  } catch (err) { self.postMessage({ id, ok: false, error: String(err && err.message || err).slice(0, 300) }); }
};
if (typeof module !== 'undefined' && module.exports) module.exports = { dispatch };
