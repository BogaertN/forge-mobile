/* eval_lib.js — shared scoring for the M0 guard-rail suites (held-out + mutation). Verification code only: nothing here ships.
 * verdict(r) reads the STRUCTURED result first (world status, outcome category, meaning kind) and the reply text only as a fallback,
 * so a case is judged by what the kernel decided, not by phrasing. Scores are reported, never tuned on. */
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const OUT = path.resolve(process.env.FORGE_ARTIFACT || path.join(ROOT, '..', '_release')), VOUT = path.join(OUT, 'verify');
const BASELINE_FILE = path.join(__dirname, 'eval_baseline.json');
const WORLD = { supported_only: 'yes', refuted_only: 'no', conflicted: 'conflict', undetermined: 'unknown', incomplete: 'unknown', proof_rejected: 'unknown' };
function verdict(r) {
  if (!r || !r.trace) return 'crash';
  if (r.blocked || r.reply === null) return 'blocked';
  const m = (r.trace.msm && r.trace.msm.meaning) || {}, cat = r.outcome && r.outcome.category, cls = r.outcome && r.outcome.class, txt = String(r.reply || '');
  if (m.kind === 'world_answer' && WORLD[m.status]) return WORLD[m.status];
  if (cat === 'AMBIGUITY_PRESERVED' || /^clarify_(?:readings|referent|ambiguous)$/.test(m.kind || '')) return 'ambiguous';
  if (m.kind === 'yesno' || m.kind === 'gks_fact' || m.kind === 'inferred') { if (/^(?:[^.]*branch\. )?Yes\b/.test(txt)) return 'yes'; if (/^(?:[^.]*branch\. )?No\b/.test(txt)) return 'no'; }
  if (/^(?:recall_none|gks_unconfirmed|world_limitation|no_reason)$/.test(m.kind || '')) return 'unknown';
  if (cls === 'clarify') return 'clarify';
  if (/^(?:I answered in a branch\. )?Yes\b/.test(txt)) return 'yes';
  if (/^(?:I answered in a branch\. )?No\b/.test(txt)) return 'no';
  return 'other';
}
/* expectation → pass? 'unknown' accepts a clarification (withholding is the point); 'ambiguous' needs readings or referents held open (a bare clarification is not credited) */
function judge(expect, v, reply) {
  if (v === 'crash') return false;
  if (/^contains:/.test(expect)) return String(reply || '').toLowerCase().includes(expect.slice(9).toLowerCase());
  if (/^not:/.test(expect)) return v !== expect.slice(4) && v !== 'blocked';
  if (expect === 'unknown') return v === 'unknown' || v === 'clarify';
  if (expect === 'ambiguous') return v === 'ambiguous';
  return v === expect;
}
function runCase(open, turns) { const k = open(); let r = null; for (const t of turns) r = k.process(t); return r; }
function readBaseline() { try { return JSON.parse(fs.readFileSync(BASELINE_FILE, 'utf8')); } catch (e) { return null; } }
function writeArtifact(name, obj) { fs.mkdirSync(VOUT, { recursive: true }); fs.writeFileSync(path.join(VOUT, name), JSON.stringify(obj, null, 1)); }
function tally(rows, key) { const by = {}; for (const r of rows) { const k = r[key]; const b = by[k] = by[k] || { pass: 0, total: 0 }; b.total++; if (r.pass) b.pass++; } return by; }
const norm = s => s.toLowerCase().replace(/[^a-z' ]+/g, ' ').replace(/\s+/g, ' ').trim();
const SHIPPED = () => fs.readdirSync(path.join(ROOT, 'src')).filter(f => f.endsWith('.js')).map(f => 'src/' + f).concat(['index.html', 'sw.js']);
module.exports = { ROOT, OUT, VOUT, BASELINE_FILE, verdict, judge, runCase, readBaseline, writeArtifact, tally, norm, SHIPPED };
