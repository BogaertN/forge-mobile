/* node -r tools/mea_preload.js <suite>: runs a verifier suite with an MEA manifest active (MEA_MANIFEST = JSON file of deltas) and writes its
   score artifacts plus an Echo count into MEA_OUT instead of _release/verify. Used only by tools/mea_eval.js. */
const fs = require('fs'), path = require('path'); const ROOT = path.join(__dirname, '..');
const WR = require(ROOT + '/src/world_rules.js'); if (process.env.MEA_MANIFEST) WR.setManifest(JSON.parse(fs.readFileSync(process.env.MEA_MANIFEST, 'utf8')));
const OUT = process.env.MEA_OUT; if (OUT) { const E = require(ROOT + '/verify/eval_lib.js'); let echo = 0; const run = E.runCase;
  E.writeArtifact = (name, obj) => { fs.mkdirSync(OUT, { recursive: true }); fs.writeFileSync(path.join(OUT, name), JSON.stringify(obj)); };
  E.runCase = (open, turns) => { const r = run(open, turns); if (r && r.trace && r.trace.echo && r.trace.echo.pass) echo++; return r; };
  process.on('exit', () => { try { fs.appendFileSync(path.join(OUT, 'echo.txt'), echo + '\n'); } catch (e) { /* best effort */ } }); }
