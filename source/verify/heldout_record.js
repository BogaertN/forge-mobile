/* heldout_record.js (4.9.78, audit item 6) — the held-out set and the mutation base cases live OUTSIDE the repo (a private directory:
 * $FORGE_PRIVATE, default <repo>/../../fm-private). The repo keeps only verify/heldout/heldout_record.json: per-case DIGESTS and recorded
 * outcomes, digests of the held-out sentence windows and made-up words, and the SHA-256 of every input that can change an outcome
 * (the kernel tree hash). Two modes, one verdict:
 *   PRIVATE present  the real evaluation runs; it must reproduce the record exactly for the current tree (a stale record fails, with the
 *                    command that re-records it: node verify/record_heldout.js);
 *   PRIVATE absent   (a fresh clone, CI) the record is validated: its tree hash must equal the current tree's, and its outcomes are the scores.
 * Either way a regression against eval_baseline.json blocks the release. Verification code only: nothing here ships. */
const fs = require('fs'), path = require('path'), crypto = require('crypto'), cp = require('child_process');
const E = require('./eval_lib.js'); const ROOT = E.ROOT;
const sha = s => crypto.createHash('sha256').update(s).digest('hex');
const PRIV = path.resolve(process.env.FORGE_PRIVATE || path.join(ROOT, '..', '..', 'fm-private'));
const RECORD_FILE = path.join(__dirname, 'heldout', 'heldout_record.json');
const privateJSON = name => { const f = path.join(PRIV, name); return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : null; };
const recording = () => process.env.FORGE_RECORD === '1';
/* every input that can change a held-out or mutation outcome: the kernel source, the tracked data, the encoded lexicons, and the suites' own code */
function treeFiles() { const out = []; const walk = d => { for (const n of fs.readdirSync(path.join(ROOT, d)).sort()) { const r = d + '/' + n, st = fs.statSync(path.join(ROOT, r)); if (st.isDirectory()) walk(r); else out.push(r); } }; walk('src');
  let tracked = []; try { tracked = cp.execFileSync('git', ['ls-files', 'data'], { cwd: ROOT, encoding: 'utf8' }).split('\n').filter(Boolean); } catch (e) { tracked = []; }
  const b64 = fs.existsSync(path.join(ROOT, '..', 'data')) ? fs.readdirSync(path.join(ROOT, '..', 'data')).filter(f => f.endsWith('.b64')).sort().map(f => '../data/' + f) : [];
  return out.concat(tracked.sort(), b64, ['verify/eval_lib.js', 'verify/heldout_record.js', 'verify/heldout_suite.js', 'verify/mutation_suite.js', 'tools/mea_preload.js']); }
function treeHash() { const h = crypto.createHash('sha256'); for (const f of treeFiles()) { h.update(f + '\0'); h.update(fs.readFileSync(path.join(ROOT, f))); h.update('\0'); } return h.digest('hex'); }
const manifestKey = () => [process.env.MEA_MANIFEST, process.env.MEAK_MANIFEST].map(f => (f ? sha(fs.readFileSync(f, 'utf8')) : '-')).join('|');
function readRecord() { try { return JSON.parse(fs.readFileSync(RECORD_FILE, 'utf8')); } catch (e) { return null; } }
/* merge one suite's part into the record (record mode only) */
function writePart(part, value) { const r = readRecord() || { schema: 'forge-heldout-record/v1' }; const k = manifestKey(), tree = treeHash();
  if (r.tree_sha256 !== tree) { for (const x of ['heldout', 'mutation', 'manifests']) delete r[x]; r.tree_sha256 = tree; }
  if (k === '-|-') r[part] = value; else { r.manifests = r.manifests || {}; r.manifests[k] = Object.assign(r.manifests[k] || {}, { [part]: { passed: value.passed, total: value.total } }); }
  r.recorded_files = treeFiles().length; fs.writeFileSync(RECORD_FILE, JSON.stringify(r, null, 1) + '\n'); }
/* the record's view for this process: { status: 'ok' | 'stale' | 'missing', part, tree } */
function recorded(part) { const r = readRecord(), tree = treeHash(); if (!r || !r[part]) return { status: 'missing', tree };
  if (r.tree_sha256 !== tree) return { status: 'stale', tree, recorded_tree: r.tree_sha256, part: r[part] };
  const k = manifestKey(); if (k !== '-|-') { const m = r.manifests && r.manifests[k] && r.manifests[k][part]; return m ? { status: 'ok', tree, part: r[part], manifest: m } : { status: 'missing', tree, note: 'no recorded score for this manifest' }; }
  return { status: 'ok', tree, part: r[part] }; }
/* digests of the normalised word windows (n ≥ 4 words) of a text list, by length */
function windowDigests(sents) { const by = {}; for (const s of sents) { const n = s.split(' ').length; (by[n] = by[n] || []).push(sha(s)); } for (const k of Object.keys(by)) by[k] = [...new Set(by[k])].sort(); return by; }
/* does any word window of the shipped source hash to a recorded digest? (the shipped text is scanned; the held-out text is never needed) */
function shippedWindowHits(byLen) { const words = E.norm(E.SHIPPED().map(f => fs.readFileSync(path.join(ROOT, f), 'utf8')).join('\n')).split(' '); const hits = [];
  for (const [L, list] of Object.entries(byLen)) { const set = new Set(list), n = +L; for (let i = 0; i + n <= words.length; i++) { const d = sha(words.slice(i, i + n).join(' ')); if (set.has(d)) hits.push(d.slice(0, 12) + ' (' + n + ' words at word ' + i + ')'); } } return hits; }
function shippedWordHits(digests) { const set = new Set(digests); const words = new Set(E.norm(E.SHIPPED().map(f => fs.readFileSync(path.join(ROOT, f), 'utf8')).join('\n')).split(' ')); return [...words].filter(w => set.has(sha(w))); }
module.exports = { PRIV, RECORD_FILE, sha, privateJSON, recording, treeFiles, treeHash, manifestKey, readRecord, writePart, recorded, windowDigests, shippedWindowHits, shippedWordHits };
