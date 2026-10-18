/* node -r tools/mea_preload.js <suite>: runs a verifier suite with an MEA manifest active (MEA_MANIFEST = JSON file of deltas) and writes its
   score artifacts plus an Echo count into MEA_OUT instead of _release/verify. Used only by tools/mea_eval.js. */
const fs = require('fs'), path = require('path'); const ROOT = path.join(__dirname, '..');
const WR = require(ROOT + '/src/world_rules.js');
/* the kernel re-applies its own (adopted) manifest at every process() call, so the candidate is installed UNDER that call: with no adoption (the
   suites never adopt) the candidate stays active. 4.9.64 set it once and the first process() reset it (fix 4.9.65). */
if (process.env.MEA_MANIFEST) { const cand = JSON.parse(fs.readFileSync(process.env.MEA_MANIFEST, 'utf8')), set = WR.setManifest; WR.setManifest = d => set(d && d.length ? d : cand); WR.setManifest(null); }
const OUT = process.env.MEA_OUT; if (OUT) { const E = require(ROOT + '/verify/eval_lib.js'); let echo = 0; const run = E.runCase;
  E.writeArtifact = (name, obj) => { fs.mkdirSync(OUT, { recursive: true }); fs.writeFileSync(path.join(OUT, name), JSON.stringify(obj)); };
  E.runCase = (open, turns) => { const r = run(open, turns); if (r && r.trace && r.trace.echo && r.trace.echo.pass) echo++; return r; };
  process.on('exit', () => { try { fs.appendFileSync(path.join(OUT, 'echo.txt'), echo + '\n'); } catch (e) { /* best effort */ } }); }
