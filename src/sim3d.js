/* sim3d.js — 3-D physics preview + 3-D model viewer, lazy-loaded (user decision 2026-10-11, "3D on phone").
 * Engines (vendored locally, MIT, see vendor/LICENSE.*): cannon-es 0.20.0 (rigid-body physics), three.js r169 (WebGL rendering).
 * Maps ProtoForge's PyBullet sim plans where possible: PyBullet defaults (gravity −9.81 m/s², fixed step 1/240 s, ground plane) and
 * URDF links with box / sphere / cylinder collision geometry, origin xyz and inertial mass. Joints are NOT mapped (each link is a free
 * body) — reported; cylinders are y-axis in both cannon-es and three.js, matching URDF z after the axis swap in every result. Deterministic: seeded initial state, fixed step, no wall-clock; each recorded frame is hash-chained
 * (positions rounded to 1e-6) so a replay must reproduce the final hash. Labelled: “3-D PREVIEW (cannon-es) — not a PyBullet result”. */
(function (root) {
'use strict';
const isNode = typeof module !== 'undefined' && module.exports; const { sha256 } = isNode ? require('./sha256.js') : root.KSha;
const ENGINE = { physics: 'cannon-es 0.20.0 (MIT)', render: 'three.js r169 (MIT)', label: '3-D PREVIEW (cannon-es) — not a PyBullet result' };
const PYBULLET = { gravity: -9.81, dt: 1 / 240 };
let CANNON = null, THREE = null;
const base = () => (isNode ? 'file://' + require('path').join(__dirname, '..') + '/' : (typeof document !== 'undefined' ? document.baseURI : ''));
async function loadPhysics() { if (!CANNON) CANNON = await import(new URL('vendor/cannon-es.js', base()).href); return CANNON; }
async function loadRender() { if (!THREE) THREE = await import(new URL('vendor/three.module.min.js', base()).href); return THREE; }
function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
/* URDF subset → body plan */
function parseURDF(xml) { const s = String(xml || '').slice(0, 500000); const links = []; const notes = []; const re = /<link\s+name="([^"]+)"[^>]*>([\s\S]*?)<\/link>/g; let m;
  while ((m = re.exec(s)) && links.length < 64) { const b = m[2]; const col = (b.match(/<collision[\s\S]*?<\/collision>/) || [b])[0]; const num = (t, a) => { const x = t && t.match(new RegExp(a + '="([^"]+)"')); return x ? x[1].trim().split(/\s+/).map(Number) : null; };
    const mass = num((b.match(/<mass[^>]*>/) || [])[0], 'value'); const xyz = num((col.match(/<origin[^>]*>/) || [])[0], 'xyz') || [0, 0, 0];
    let shape = null; const bx = col.match(/<box[^>]*>/), sp = col.match(/<sphere[^>]*>/), cy = col.match(/<cylinder[^>]*>/), me = col.match(/<mesh[^>]*>/);
    if (bx) { const z = num(bx[0], 'size'); shape = { type: 'box', size: [z[0], z[2], z[1]] }; /* z-up → y-up */ } else if (sp) shape = { type: 'sphere', radius: num(sp[0], 'radius')[0] }; else if (cy) shape = { type: 'cylinder', radius: num(cy[0], 'radius')[0], length: num(cy[0], 'length')[0] }; else if (me) notes.push('link ' + m[1] + ': mesh geometry not mapped');
    if (shape) links.push({ name: m[1], shape, mass: mass ? mass[0] : 1, pos: [xyz[0], xyz[2] + 1, xyz[1]] /* URDF z-up → y-up, lifted 1 m */ }); }
  if (/<joint\b/.test(s)) notes.push('joints present: not mapped (links simulated as free bodies)'); return { bodies: links, notes }; }
function planFrom(o) { o = o || {}; const seed = (o.seed === undefined ? 1 : o.seed) >>> 0; const r = rng(seed); let bodies = o.bodies;
  if (!Array.isArray(bodies)) { const n = Math.max(1, Math.min(24, o.count || 4)); const kinds = ['box', 'sphere', 'cylinder']; bodies = [];
    for (let i = 0; i < n; i++) { const k = o.shape || kinds[i % 3]; const sz = 0.2 + r() * 0.3; bodies.push({ name: k + i, shape: k === 'box' ? { type: 'box', size: [sz, sz, sz] } : k === 'sphere' ? { type: 'sphere', radius: sz / 2 } : { type: 'cylinder', radius: sz / 2, length: sz }, mass: 1, pos: [(r() - 0.5) * 2, 1 + i * 0.6, (r() - 0.5) * 2], vel: [(r() - 0.5) * 2, 0, (r() - 0.5) * 2] }); } }
  return { seed, steps: Math.max(1, Math.min(4800, o.steps || 960)), dt: PYBULLET.dt, gravity: PYBULLET.gravity, every: 8, restitution: 0.4, friction: 0.3, bodies, notes: o.notes || [] }; }
const r6 = x => Math.round(x * 1e6) / 1e6;
async function run(o) { const C = await loadPhysics(); const p = planFrom(o); const w = new C.World({ gravity: new C.Vec3(0, p.gravity, 0) }); w.allowSleep = false; w.defaultContactMaterial.restitution = p.restitution; w.defaultContactMaterial.friction = p.friction;
  const ground = new C.Body({ mass: 0, shape: new C.Plane() }); ground.quaternion.setFromEuler(-Math.PI / 2, 0, 0); w.addBody(ground); const bs = [];
  for (const b of p.bodies) { const s = b.shape; const shape = s.type === 'box' ? new C.Box(new C.Vec3(s.size[0] / 2, s.size[1] / 2, s.size[2] / 2)) : s.type === 'sphere' ? new C.Sphere(s.radius) : new C.Cylinder(s.radius, s.radius, s.length, 12);
    const body = new C.Body({ mass: b.mass, shape, position: new C.Vec3(b.pos[0], b.pos[1], b.pos[2]) }); if (b.vel) body.velocity.set(b.vel[0], b.vel[1], b.vel[2]); w.addBody(body); bs.push(body); }
  const frames = []; let h = sha256('sim3d|' + JSON.stringify({ seed: p.seed, steps: p.steps, dt: p.dt, bodies: p.bodies }));
  const snap = () => bs.map(b => [r6(b.position.x), r6(b.position.y), r6(b.position.z), r6(b.quaternion.x), r6(b.quaternion.y), r6(b.quaternion.z), r6(b.quaternion.w)]);
  for (let i = 1; i <= p.steps; i++) { w.step(p.dt); if (i % p.every === 0 || i === p.steps) { const s = snap(); h = sha256(h + '|' + JSON.stringify(s)); frames.push(s); } }
  return { engine: ENGINE, plan: p, frames, final_hash: h, label: ENGINE.label, settled: bs.every(b => b.velocity.length() < 0.05), notes: p.notes }; }
async function replay(prev) { const r = await run({ seed: prev.plan.seed, steps: prev.plan.steps, bodies: prev.plan.bodies }); return { ok: r.final_hash === prev.final_hash, final_hash: r.final_hash }; }
/* simple OBJ (v / f) parser for the model viewer */
function parseOBJ(txt) { const v = [], f = []; for (const line of String(txt || '').slice(0, 3000000).split(/\r?\n/)) { const t = line.trim().split(/\s+/); if (t[0] === 'v' && t.length >= 4) v.push(t.slice(1, 4).map(Number)); else if (t[0] === 'f' && t.length >= 4) { const ix = t.slice(1).map(x => parseInt(x, 10)).map(i => (i < 0 ? v.length + i : i - 1)); for (let k = 1; k + 1 < ix.length; k++) f.push([ix[0], ix[k], ix[k + 1]]); } }
  const ok = v.length > 0 && f.every(tri => tri.every(i => i >= 0 && i < v.length)); return { ok, vertices: v.length, faces: f.length, v, f }; }
/* rendering (browser): three.js WebGL; falls back to an own wireframe projection when WebGL is unavailable */
function hasWebGL(c) { try { return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch (e) { return false; } }
async function view(canvas, res, opts) { opts = opts || {}; const probe = document.createElement('canvas'); if (!hasWebGL(probe)) return wire(canvas, res, opts);
  const T = await loadRender(); const r = new T.WebGLRenderer({ canvas, antialias: true }); r.setSize(canvas.width, canvas.height, false); const sc = new T.Scene(); sc.background = new T.Color(0x0b1220);
  const cam = new T.PerspectiveCamera(50, canvas.width / canvas.height, 0.05, 100); cam.position.set(4, 3, 5); cam.lookAt(0, 0.5, 0); sc.add(new T.HemisphereLight(0xffffff, 0x223344, 1.2)); const dl = new T.DirectionalLight(0xffffff, 1.2); dl.position.set(3, 6, 2); sc.add(dl);
  sc.add(new T.GridHelper(8, 16, 0x335577, 0x223344)); const meshes = [];
  if (res.model) { const g = new T.BufferGeometry(); const pos = []; for (const tri of res.model.f) for (const i of tri) pos.push(...res.model.v[i]); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.computeVertexNormals(); g.computeBoundingSphere(); const s = 1.5 / (g.boundingSphere.radius || 1); const mm = new T.Mesh(g, new T.MeshStandardMaterial({ color: 0x7fc8ff, flatShading: true })); mm.scale.setScalar(s); mm.position.set(-g.boundingSphere.center.x * s, 1 - g.boundingSphere.center.y * s, -g.boundingSphere.center.z * s); sc.add(mm); meshes.push(mm); }
  else for (const b of res.plan.bodies) { const s = b.shape; const geo = s.type === 'box' ? new T.BoxGeometry(...s.size) : s.type === 'sphere' ? new T.SphereGeometry(s.radius, 20, 14) : new T.CylinderGeometry(s.radius, s.radius, s.length, 16); const mm = new T.Mesh(geo, new T.MeshStandardMaterial({ color: s.type === 'box' ? 0xffcf5a : s.type === 'sphere' ? 0x9cff9c : 0xc9a0ff })); if (s.type === 'cylinder') mm.userData.cyl = true; sc.add(mm); meshes.push(mm); }
  let f = 0, ang = 0; const q = new T.Quaternion();
  const draw = () => { if (!res.model) { const fr = res.frames[Math.min(f, res.frames.length - 1)]; fr.forEach((s, i) => { meshes[i].position.set(s[0], s[1], s[2]); q.set(s[3], s[4], s[5], s[6]); meshes[i].quaternion.copy(q); }); } else { ang += 0.01; meshes[0].rotation.y = ang; }
    r.render(sc, cam); }; draw(); let raf = null; const loop = () => { f++; draw(); if ((res.model && f < 600) || f < res.frames.length) raf = requestAnimationFrame(loop); }; if (opts.animate !== false) raf = requestAnimationFrame(loop);
  return { renderer: 'three.js WebGL', stop: () => cancelAnimationFrame(raf), frame: n => { f = n; draw(); } }; }
function wire(canvas, res, opts) { const c = canvas.getContext('2d'); const W = canvas.width, H = canvas.height; const P = (x, y, z) => [W / 2 + (x - z * 0.5) * 60, H * 0.8 - (y - z * 0.25) * 60];
  const draw = n => { c.fillStyle = '#0b1220'; c.fillRect(0, 0, W, H); c.strokeStyle = '#335577'; for (let i = -4; i <= 4; i++) { let a = P(i, 0, -4), b = P(i, 0, 4); c.beginPath(); c.moveTo(...a); c.lineTo(...b); c.stroke(); a = P(-4, 0, i); b = P(4, 0, i); c.beginPath(); c.moveTo(...a); c.lineTo(...b); c.stroke(); }
    if (res.model) { c.strokeStyle = '#7fc8ff'; for (const t of res.model.f.slice(0, 4000)) { c.beginPath(); t.forEach((i, k) => { const v = res.model.v[i]; const p = P(v[0], v[1] + 1, v[2]); k ? c.lineTo(...p) : c.moveTo(...p); }); c.closePath(); c.stroke(); } return; }
    const fr = res.frames[Math.min(n, res.frames.length - 1)]; fr.forEach((s, i) => { const b = res.plan.bodies[i]; const rr = b.shape.type === 'box' ? b.shape.size[0] / 2 : b.shape.radius; const p = P(s[0], s[1], s[2]); c.strokeStyle = b.shape.type === 'box' ? '#ffcf5a' : b.shape.type === 'sphere' ? '#9cff9c' : '#c9a0ff'; c.beginPath(); c.arc(p[0], p[1], Math.max(2, rr * 60), 0, 2 * Math.PI); c.stroke(); }); };
  draw(res.model ? 0 : (res.frames ? res.frames.length - 1 : 0)); return { renderer: 'wireframe fallback (no WebGL)', stop: () => {}, frame: draw }; }
const api = { ENGINE, PYBULLET, run, replay, planFrom, parseURDF, parseOBJ, view, loadPhysics, loadRender };
if (isNode) module.exports = api; else root.KSim3D = api;
})(typeof self !== 'undefined' ? self : this);
