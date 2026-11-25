/* M7 browser physics preview (ProtoForge stand-in; labelled PREVIEW — not a ProtoForge result).
 * Deterministic 2-D rigid circles: fixed timestep, seeded PRNG (mulberry32), semi-implicit Euler, elastic wall and pair collisions
 * with restitution. Every run records a frame-state hash chain; replay = re-run from the stored seed + params and compare the final hash. */
(function (root) {
'use strict';
const isNode = typeof module !== 'undefined' && module.exports; const { sha256 } = isNode ? require('./sha256.js') : root.KSha;
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const DEFAULTS = { seed: 1, bodies: 6, width: 10, height: 10, gravity: -9.81, restitution: 0.9, dt: 1 / 120, steps: 600 };
const LIMITS = { bodies: [1, 40], steps: [1, 6000], restitution: [0, 1], gravity: [-50, 50] };
function params(p) { const o = Object.assign({}, DEFAULTS, p || {}); for (const [k, [lo, hi]] of Object.entries(LIMITS)) { o[k] = Math.min(hi, Math.max(lo, Number(o[k]))); if (!isFinite(o[k])) o[k] = DEFAULTS[k]; } o.seed = (Number(o.seed) >>> 0) || 1; o.bodies = Math.round(o.bodies); o.steps = Math.round(o.steps); return o; }
function init(p) { const r = rng(p.seed); const B = []; for (let i = 0; i < p.bodies; i++) { const rad = 0.25 + r() * 0.35; B.push({ x: rad + r() * (p.width - 2 * rad), y: p.height * 0.4 + r() * (p.height * 0.6 - rad), vx: (r() - 0.5) * 4, vy: (r() - 0.5) * 2, r: rad, m: rad * rad }); } return B; }
const q6 = v => Math.round(v * 1e6) / 1e6; // quantised state for platform-stable hashing
function energy(B, p) { let e = 0; for (const b of B) e += 0.5 * b.m * (b.vx * b.vx + b.vy * b.vy) - b.m * p.gravity * b.y; return e; }
function step(B, p) { const g = p.gravity, dt = p.dt, e = p.restitution;
  for (const b of B) { b.vy += g * dt; b.x += b.vx * dt; b.y += b.vy * dt;
    /* mirrored penetration (scaled by e): an elastic wall then neither adds nor removes potential energy */
    if (b.x < b.r) { b.x = b.r + (b.r - b.x) * e; b.vx = -b.vx * e; } if (b.x > p.width - b.r) { b.x = p.width - b.r - (b.x - p.width + b.r) * e; b.vx = -b.vx * e; }
    if (b.y < b.r) { b.y = b.r + (b.r - b.y) * e; b.vy = -b.vy * e; } if (b.y > p.height - b.r) { b.y = p.height - b.r - (b.y - p.height + b.r) * e; b.vy = -b.vy * e; } }
  for (let i = 0; i < B.length; i++) for (let j = i + 1; j < B.length; j++) { const a = B[i], c = B[j]; const dx = c.x - a.x, dy = c.y - a.y; const d = Math.hypot(dx, dy), md = a.r + c.r; if (d === 0 || d >= md) continue;
    const nx = dx / d, ny = dy / d; const rv = (c.vx - a.vx) * nx + (c.vy - a.vy) * ny; const ov = (md - d) / 2; a.x -= nx * ov; a.y -= ny * ov; c.x += nx * ov; c.y += ny * ov; if (rv > 0) continue;
    const jn = -(1 + e) * rv / (1 / a.m + 1 / c.m); a.vx -= jn * nx / a.m; a.vy -= jn * ny / a.m; c.vx += jn * nx / c.m; c.vy += jn * ny / c.m; }
  for (const b of B) { b.x = q6(b.x); b.y = q6(b.y); b.vx = q6(b.vx); b.vy = q6(b.vy); } }
function run(pIn, opts) { const p = params(pIn); const B = init(p); const keep = (opts && opts.keepEvery) || 4; const frames = []; let h = sha256(JSON.stringify(p)); const e0 = energy(B, p);
  for (let s = 0; s < p.steps; s++) { step(B, p); if (s % 30 === 29) h = sha256(h + JSON.stringify(B)); if (s % keep === 0) frames.push(B.map(b => [b.x, b.y, b.r])); }
  const final = sha256(h + JSON.stringify(B)); const e1 = energy(B, p);
  return { kind: 'physics_preview', label: 'PREVIEW — browser approximation, not a ProtoForge result', engine: 'forge-mobile sim.js v1 (semi-implicit Euler, fixed dt)', params: p, frames, final_hash: final, energy: { start: q6(e0), end: q6(e1), ratio: q6(e0 ? e1 / e0 : 1) }, bodies: B.length }; }
function replay(rec) { const r = run(rec.params); return { ok: r.final_hash === rec.final_hash, final_hash: r.final_hash, expected: rec.final_hash }; }
function draw(canvas, res, i) { const ctx = canvas.getContext('2d'); const W = canvas.width, H = canvas.height, p = res.params; const sx = W / p.width, sy = H / p.height; const f = res.frames[Math.min(i, res.frames.length - 1)];
  ctx.fillStyle = '#0b1522'; ctx.fillRect(0, 0, W, H); ctx.strokeStyle = '#3d5a80'; ctx.strokeRect(0.5, 0.5, W - 1, H - 1);
  for (const [x, y, r] of f) { ctx.beginPath(); ctx.arc(x * sx, H - y * sy, r * sx, 0, 2 * Math.PI); ctx.fillStyle = '#7fb3ff'; ctx.fill(); }
  ctx.fillStyle = '#ffcf5a'; ctx.font = '12px sans-serif'; ctx.fillText('PREVIEW · not a ProtoForge result · frame ' + (i + 1) + '/' + res.frames.length, 6, 14); }
const api = { DEFAULTS, LIMITS, params, run, replay, draw, rng };
if (isNode) module.exports = api; else root.KSim = api;
})(typeof self !== 'undefined' ? self : this);
