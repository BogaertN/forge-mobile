/* Scratch harness. Overrides the speak floor only, in this process, and never writes mobile_config.py.
 * One engine pass records C, Echo, and drift. Each floor is the same admit rule with those measurements.
 * The write floor (Echo 0.97) and the drift limits are not overridden. */
const path = require('path');
const cp = require('child_process');
const fs = require('fs');
const SET = require('./set.js');
const ROOT = path.join(__dirname, '..', '..', '..');
const Q = require(ROOT + '/src/qframe.js');
const FK = require(ROOT + '/src/forge.js');
const K = require(ROOT + '/src/kernel.js');
const LEX = require(ROOT + '/data/lexicon.json');
const EXT = require(ROOT + '/data/lexicon-ext.json');
const Core = require(ROOT + '/src/rmc_core.js');
const R = require(ROOT + '/src/rmc_client.js');
const L = require(ROOT + '/src/learning.js');
const WF = require(ROOT + '/src/world_facts.js');

const SETTINGS = [
  { id: 'c87-e85', C: 0.87, echo: 0.85, baseline: true },
  { id: 'c85-e80', C: 0.85, echo: 0.80 },
  { id: 'c85-e75', C: 0.85, echo: 0.75 },
  { id: 'c82-e80', C: 0.82, echo: 0.80 },
  { id: 'c82-e75', C: 0.82, echo: 0.75 },
  { id: 'c80-e80', C: 0.80, echo: 0.80 },
  { id: 'c80-e75', C: 0.80, echo: 0.75 },
  { id: 'c75-e80', C: 0.75, echo: 0.80 },
  { id: 'c75-e75', C: 0.75, echo: 0.75 }
];

function kernel() {
  return FK.ForgeKernel({ store: K.MemoryStore(), lexicon: LEX, lexiconExt: EXT, clock: () => '2026-11-26T16:00:00Z' });
}
function phoneOf(f, texts, prior) {
  const all = (prior || []).concat(texts || []);
  return all.map((text, i) => {
    const sentence = /[.!?]$/.test(text) ? text : text + '.';
    return { id: 'sg' + i, text: sentence, clause: Q.clause(sentence, f), tier: 'phone', trust: 'trusted', scope: 'phone', source: 'phone_kb' };
  });
}
function askEngine(question, phone, floors) {
  const f = kernel();
  const frame = Q.compile(question, f);
  const payload = Core.withClauses({ question, frame, live: true, memory: { phone: phone || [], pools: [] } }, Q, f);
  const py = `
import json, os, sys
from rmc_engine_v1 import mobile_config as mc
c = os.environ.get("FORGE_SPEAK_C")
e = os.environ.get("FORGE_SPEAK_ECHO")
if c: mc.THRESHOLDS["C_min"] = float(c)
if e: mc.THRESHOLDS["echo_min"] = float(e)
from rmc_engine_v1.rmc_core import run
p = json.load(sys.stdin)
r = run(p)
d = (r.get("world_model") or {}).get("derive") or {}
s = d.get("survivor") or {}
echo = r.get("echo") or {}
admit = r.get("admit") or {}
write = r.get("memory_write") or {}
print(json.dumps({
  "product": r.get("product_reply") is True,
  "reply": r.get("reply"),
  "candidate": s.get("spoken") or s.get("text") or d.get("derived_text") or r.get("reply"),
  "coherence": r.get("coherence"),
  "echo": echo.get("score"),
  "echo_pass": echo.get("pass"),
  "drift": r.get("drift"),
  "drift_region": admit.get("drift_region"),
  "phase_ok": admit.get("phase_ok"),
  "disposition": admit.get("disposition"),
  "how": s.get("how"),
  "path": r.get("answer_path"),
  "route": r.get("route"),
  "write_proposed": write.get("proposed"),
  "write_echo_min": (write.get("write_gate") or {}).get("echo_min"),
  "thresholds": (admit.get("thresholds") or {}),
}, default=str))
`;
  const env = Object.assign({}, process.env, {
    PYTHONPATH: [path.join(ROOT, 'engine'), ROOT, path.join(ROOT, '_mathlibs')].join(path.delimiter)
  });
  if (floors) {
    env.FORGE_SPEAK_C = String(floors.C);
    env.FORGE_SPEAK_ECHO = String(floors.echo);
  }
  const proc = cp.spawnSync('python3', ['-c', py], { cwd: ROOT, input: JSON.stringify(payload), env, encoding: 'utf8', maxBuffer: 1 << 26 });
  if (proc.status !== 0) return { error: String(proc.stderr || proc.stdout || 'python').slice(-400) };
  try { return JSON.parse(proc.stdout.trim().split('\n').pop()); } catch (e) { return { error: 'bad_json' }; }
}
function num(v) { return typeof v === 'number' ? v : (v != null && v !== '' && !isNaN(Number(v)) ? Number(v) : null); }
function wouldSpeak(row, C, echoMin) {
  const c = num(row.coherence);
  const e = num(row.echo);
  if (!row.candidate || !String(row.candidate).trim()) return false;
  if (row.drift_region !== 'clean') return false;
  if (row.phase_ok === false) return false;
  if (c == null || c < C) return false;
  if (e == null || e < echoMin) return false;
  return true;
}
function norm(t) { return String(t || '').toLowerCase().replace(/\s+/g, ' ').trim(); }
function judge(item, spoken, text) {
  if (!item.scored) return spoken ? 'spoken-unscored' : 'held-unscored';
  if (!spoken) return 'held';
  const t = norm(text);
  if (!t) return 'nonsensical';
  const truth = item.truth || {};
  if (truth.expect === 'hold') return 'wrong';
  const forbid = truth.forbid || [];
  if (forbid.some(f => t.includes(norm(f)))) return 'wrong';
  const must = truth.must || [];
  const any = truth.mustAny || [];
  const mustOk = !must.length || must.every(m => t.includes(norm(m)));
  const anyOk = !any.length || any.some(m => t.includes(norm(m)));
  if (mustOk && anyOk && (must.length || any.length)) return 'correct';
  if (t.length < 8) return 'nonsensical';
  return 'wrong';
}
function textOf(row, spoken) { return spoken ? (row.reply || row.candidate || '') : ''; }

const measured = [];
let memory = [];
let chain = null;
const f0 = kernel();
for (const item of SET.questions) {
  if (item.chain && item.chain === chain) {
    memory = phoneOf(f0, item.setup || [], memory.map(r => r.text.replace(/\.$/, '')));
  } else {
    L.clear();
    WF.clear();
    chain = item.chain || null;
    memory = phoneOf(f0, item.setup || [], []);
  }
  const row = askEngine(item.q, memory);
  measured.push(Object.assign({ id: item.id, kind: item.kind, scored: item.scored !== false, chain: item.chain || null, q: item.q, truth: item.truth }, row));
  process.stderr.write(item.id + (row.product ? ' spoke' : ' held') + ' C=' + row.coherence + ' E=' + row.echo + '\n');
}

const baseline = SETTINGS[0];
const mismatches = measured.filter(row => wouldSpeak(row, baseline.C, baseline.echo) !== (row.product === true));

const summary = {};
const examples = {};
for (const setting of SETTINGS) {
  const bucket = { n: measured.length, spoken: 0, held: 0, correct: 0, wrong: 0, nonsensical: 0, unscored_spoken: 0, unscored_held: 0, newly_spoken: 0, newly_correct: 0, newly_wrong: 0, newly_nonsensical: 0, newly_unscored: 0 };
  const fresh = [];
  measured.forEach(row => {
    const item = SET.questions.find(q => q.id === row.id);
    const spoken = setting.baseline ? row.product === true : wouldSpeak(row, setting.C, setting.echo);
    const verdict = judge(item, spoken, spoken ? (row.candidate || row.reply) : '');
    row.verdicts = row.verdicts || {};
    row.verdicts[setting.id] = verdict;
    if (spoken) bucket.spoken++; else bucket.held++;
    if (verdict === 'correct') bucket.correct++;
    else if (verdict === 'wrong') bucket.wrong++;
    else if (verdict === 'nonsensical') bucket.nonsensical++;
    else if (verdict === 'spoken-unscored') bucket.unscored_spoken++;
    else if (verdict === 'held-unscored') bucket.unscored_held++;
    const baseSpoken = row.product === true;
    if (spoken && !baseSpoken) {
      bucket.newly_spoken++;
      if (verdict === 'correct') bucket.newly_correct++;
      else if (verdict === 'wrong') bucket.newly_wrong++;
      else if (verdict === 'nonsensical') bucket.newly_nonsensical++;
      else bucket.newly_unscored++;
      fresh.push({ id: row.id, kind: row.kind, q: row.q, text: row.candidate || row.reply, C: num(row.coherence), echo: num(row.echo), drift: num(row.drift), region: row.drift_region, verdict: verdict });
    }
  });
  summary[setting.id] = bucket;
  examples[setting.id] = fresh.slice(0, 10);
}

const band = measured.filter(row => {
  const c = num(row.coherence), e = num(row.echo);
  return row.drift_region === 'clean' && row.phase_ok !== false && c != null && e != null && c >= 0.80 && c < 0.87 && e >= 0.80;
}).map(row => ({ id: row.id, kind: row.kind, q: row.q, text: row.candidate, C: num(row.coherence), echo: num(row.echo), product: row.product, truth: row.truth && row.truth.expect }));

const spot = measured.filter(row => {
  if (row.chain) return false;
  const c = num(row.coherence), e = num(row.echo);
  return (c != null && c >= 0.75 && c < 0.87) || (e != null && e >= 0.75 && e < 0.85);
}).slice(0, 8);
const override = [];
for (const row of spot) {
  const item = SET.questions.find(q => q.id === row.id);
  L.clear();
  const again = askEngine(item.q, phoneOf(f0, item.setup || [], []), { C: 0.75, echo: 0.75 });
  override.push({
    id: row.id,
    offline: wouldSpeak(row, 0.75, 0.75),
    engine: again.product === true,
    engine_C: again.thresholds && again.thresholds.C_min,
    engine_echo: again.thresholds && again.thresholds.echo_min,
    write_echo_min: again.write_echo_min || null,
    match: wouldSpeak(row, 0.75, 0.75) === (again.product === true)
  });
  process.stderr.write('override ' + row.id + ' offline=' + wouldSpeak(row, 0.75, 0.75) + ' engine=' + (again.product === true) + '\n');
}

const out = {
  schema: 'forge.speak_gate_experiment.result/v1',
  not_a_golden: true,
  mobile_config_defaults_unchanged: true,
  write_floor: { echo: 0.97, note: 'not overridden' },
  drift: { quarantine: 0.35, hard_stop: 0.80, note: 'not overridden' },
  baseline_mismatches: mismatches.map(row => ({ id: row.id, product: row.product, offline: wouldSpeak(row, 0.87, 0.85), region: row.drift_region, C: row.coherence, echo: row.echo })),
  override_check: override,
  settings: SETTINGS,
  summary: summary,
  examples: examples,
  likely_band: band,
  rows: measured
};
const dir = __dirname;
fs.writeFileSync(path.join(dir, 'results.json'), JSON.stringify(out, null, 1));
const lines = ['| setting | C | Echo | spoken | held | correct | wrong | nonsensical | unscored spoken | newly spoken | newly correct | newly wrong | newly nonsensical |', '|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|'];
for (const setting of SETTINGS) {
  const b = summary[setting.id];
  lines.push('| ' + [setting.id, setting.C, setting.echo, b.spoken, b.held, b.correct, b.wrong, b.nonsensical, b.unscored_spoken, b.newly_spoken, b.newly_correct, b.newly_wrong, b.newly_nonsensical].join(' | ') + ' |');
}
fs.writeFileSync(path.join(dir, 'tables.md'), lines.join('\n') + '\n');
process.stdout.write(lines.join('\n') + '\n');
process.stdout.write('mismatches ' + mismatches.length + ' override ' + override.filter(r => r.match).length + '/' + override.length + '\n');
