/* 4.9.221: JS (src/senses.js) vs Python (tools/sense_trace.py) shadow sense trace on the same texts, same table and
 * pack. usage: node tools/parity_221_senses.js <pack.json.gz> <texts.json>   (texts: a JSON list of strings)
 * Prints {ok, cases, mismatches}. No network, no model. */
const fs = require('fs'), path = require('path'), zlib = require('zlib'), cp = require('child_process');
const ROOT = path.join(__dirname, '..');
const S = require(path.join(ROOT, 'src/senses.js'));
const table = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/concept_senses.json'), 'utf8'));
const packFile = process.argv[2], textsFile = process.argv[3];
const pack = packFile ? JSON.parse(zlib.gunzipSync(fs.readFileSync(packFile))) : null;
const texts = JSON.parse(fs.readFileSync(textsFile, 'utf8'));
const js = texts.map(t => S.trace(t, table, pack));
const py = JSON.parse(cp.execFileSync('python3', ['-c', [
  'import json,sys,gzip', 'sys.path.insert(0, sys.argv[1])', 'from sense_trace import trace',
  'table=json.load(open(sys.argv[2]))', 'pack=json.loads(gzip.open(sys.argv[3]).read()) if sys.argv[3] else None',
  'texts=json.load(open(sys.argv[4]))', 'print(json.dumps([trace(t, table, pack) for t in texts]))'].join('\n'),
  path.join(ROOT, 'tools'), path.join(ROOT, 'data/concept_senses.json'), packFile || '', textsFile], { maxBuffer: 1 << 30 }).toString());
const bad = []; js.forEach((r, i) => { if (JSON.stringify(r) !== JSON.stringify(py[i])) bad.push(i); });
console.log(JSON.stringify({ ok: bad.length === 0, cases: texts.length, mismatches: bad.length, first: bad.slice(0, 3).map(i => ({ text: texts[i].slice(0, 120), js: js[i].counts, py: py[i].counts })) }));
process.exit(bad.length ? 1 : 0);
