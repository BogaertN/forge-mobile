/* Forge trace sonification preview (schema forge-audible-trace-v1). Design taken from the Harmonic Conductor Studio doc (2026-06, "System A" +
 * "System B" first prototype), but this is NOT HCS: not music, not a Harmonic Field Score, never .hfield. HCS remains a separate application.
 * Truthful sonification: every sound event points back to a logged trace event or rule id — no invented "thinking" sounds.
 * 144 Hz nine-channel codec, as stated in the doc: root 144 Hz, harmonic bands 432 Hz and 1296 Hz, nine channel states.
 * Channel k (k = 1…9) ↔ phase Φk at 144·k Hz (our mapping: it contains 144, 432 = 3·144 and 1296 = 9·144; flagged as ours in CONFLICTS.md).
 * System B: syllable skeleton of the delivered sentence, with a posture contour taken from the manifest (never more certain than the MSM).
 * Labelled VISUALISATION / SONIFICATION of the trace; not a measurement, not a claim about inner states. */
(function (root) {
'use strict';
const ROOT_HZ = 144; const CH = k => ROOT_HZ * k;
/* event classes → channel (doc §3, "System A: Audible Trace Renderer" table) */
const EVENT = [
  [/^(LX-|K-|LL-|G-PARSE|V-|N-)/, 2, 'meaning parsed'], [/^(Q-|MEM-RECALL)/, 3, 'candidate formed'], [/AMBIGUITY|CLARIF|MIXED|DEPENDS/, 4, 'branching / ambiguity'],
  [/CONFLICT|CONTRADICTION|NEG-CONSISTENCY|DRIFT/, 5, 'tension detected'], [/REJECT|BLOCK|REFUS|DENY|NOT-ENTAILED|MISMATCH/, 6, 'failed route'],
  [/CHI|CORRECT|APAVADA|REPAIR/, 7, 'correction applied'], [/^(INF-|CALC-|GP014|ALG-)/, 8, 'evidence / derivation bound'], [/./, 3, 'rule applied']];
const POSTURE = { SELECTED_MEANING: 'informational', SELECTED_RESTRICTED_MEANING: 'warning', AMBIGUITY_PRESERVED: 'uncertain', CLARIFICATION_REQUIRED: 'uncertain', INCONGRUENT_REJECTED: 'blocked', UNDERSTOOD_ACTION_BLOCKED: 'blocked', REFUSAL_RELEVANT: 'blocked', NO_LAWFUL_CANDIDATE: 'blocked', PURPOSE_UNRECOVERABLE: 'blocked' };
/* contour per posture: list of channel steps (doc §3: stable resolving cadence / unresolved / tension→resolution / interruption) */
const CONTOUR = { informational: [5, 6, 9], uncertain: [5, 6, 5], warning: [7, 5, 7], correction: [5, 7, 9], blocked: [6, 6, 1] };
function postureOf(trace) { const cat = trace && trace.outcome ? trace.outcome.category : null; let p = POSTURE[cat] || 'uncertain'; const m = (trace && trace.msm && trace.msm.meaning) || {};
  if (p === 'informational' && (m.answer === 'unconfirmed' || m.answer === 'contradiction' || /_none$|^refuse$|^tool_failed$|^tool_denied$/.test(m.kind || ''))) p = 'uncertain';
  if (trace && (trace.rules || []).some(r => /CHI-CORRECTION|CR-CHI/.test(r.id))) p = 'correction'; return p; }
function syllables(word) { const w = String(word).toLowerCase().replace(/[^a-z]/g, ''); if (!w) return 0; const m = w.replace(/e$/, '').match(/[aeiouy]+/g); return Math.max(1, m ? m.length : 1); }
function score(trace, reply) { const ev = []; let t = 0; const add = (ch, dur, label, src) => { ev.push({ t: +t.toFixed(3), hz: CH(ch), ch, dur, label, source: src }); t += dur; };
  add(1, 0.18, 'input accepted', 'trace.turn ' + (trace && trace.turn));
  for (const r of ((trace && trace.rules) || []).slice(0, 24)) { const [, ch, label] = EVENT.find(([re]) => re.test(r.id)); add(ch, 0.09, label, r.id); }
  const cat = trace && trace.outcome ? trace.outcome.category : 'NO_LAWFUL_CANDIDATE'; let posture = POSTURE[cat] || 'uncertain';
  posture = postureOf(trace);
  const echoOk = !!(trace && trace.echo && trace.echo.pass); add(echoOk ? 9 : 6, 0.2, echoOk ? 'output authorized' : 'output blocked', 'echo ' + (echoOk ? 'pass' : 'fail'));
  /* System B: syllable skeleton of the delivered text with the posture contour */
  const sylls = []; if (reply && echoOk) for (const w of String(reply).split(/\s+/).slice(0, 40)) { const n = syllables(w); for (let i = 0; i < n; i++) sylls.push(w); }
  const C = CONTOUR[posture]; const tb = t; sylls.forEach((w, i) => { const ch = C[Math.min(C.length - 1, Math.floor(i / Math.max(1, sylls.length) * C.length))]; ev.push({ t: +(tb + i * 0.11).toFixed(3), hz: CH(ch), ch, dur: 0.08, label: 'syllable', source: 'reply word “' + w.replace(/[“”"]/g, '') + '”', layer: 'B' }); });
  t = tb + sylls.length * 0.11; ev.push({ t: +t.toFixed(3), hz: CH(posture === 'blocked' ? 1 : 9), ch: posture === 'blocked' ? 1 : 9, dur: 0.3, label: 'trace closed', source: cat });
  return { schema: 'forge-audible-trace-v1', label: 'SONIFICATION of the logged trace — not a measurement', root_hz: ROOT_HZ, bands_hz: [144, 432, 1296], posture, category: cat, events: ev, duration: +(t + 0.3).toFixed(3) }; }
/* posture validation gate (doc §4 step 5): the audio may not imply more certainty than the manifest */
function validate(sc, trace) { const want = postureOf(trace); const last = sc.events[sc.events.length - 1];
  const sourced = sc.events.every(e => e.source); const closes = (sc.posture === 'blocked') === (last.ch === 1); const noFalseCertainty = !(want !== 'informational' && sc.posture === 'informational');
  return { ok: sourced && closes && noFalseCertainty, checks: { every_event_sourced: sourced, closure_matches_posture: closes, no_false_certainty: noFalseCertainty } }; }
function play(sc, ctx) { const AC = ctx || new (root.AudioContext || root.webkitAudioContext)(); const t0 = AC.currentTime + 0.05;
  for (const e of sc.events) { const o = AC.createOscillator(), g = AC.createGain(); o.type = e.layer === 'B' ? 'triangle' : 'sine'; o.frequency.value = e.hz; g.gain.setValueAtTime(0, t0 + e.t); g.gain.linearRampToValueAtTime(0.12, t0 + e.t + 0.01); g.gain.linearRampToValueAtTime(0, t0 + e.t + e.dur); o.connect(g).connect(AC.destination); o.start(t0 + e.t); o.stop(t0 + e.t + e.dur + 0.02); }
  return AC; }
function draw(canvas, sc) { const c = canvas.getContext('2d'); const W = canvas.width, H = canvas.height; c.fillStyle = '#0b1522'; c.fillRect(0, 0, W, H);
  for (let k = 1; k <= 9; k++) { const y = H - k * (H - 20) / 9.5; c.fillStyle = '#22344d'; c.fillRect(0, y, W, 1); c.fillStyle = '#6c87a8'; c.font = '9px sans-serif'; c.fillText('Φ' + k + ' ' + CH(k) + 'Hz', 2, y - 2); }
  for (const e of sc.events) { const x = 60 + e.t / sc.duration * (W - 66); const y = H - e.ch * (H - 20) / 9.5; c.fillStyle = e.layer === 'B' ? '#ffcf5a' : '#7fb3ff'; c.fillRect(x, y - 3, Math.max(2, e.dur / sc.duration * (W - 66)), 6); }
  c.fillStyle = '#ffcf5a'; c.font = '11px sans-serif'; c.fillText('SONIFICATION of the logged trace · posture: ' + sc.posture, 60, 12); }
const api = { ROOT_HZ, CH, score, validate, play, draw, syllables, POSTURE };
if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.KSonify = api;
})(typeof self !== 'undefined' ? self : this);
