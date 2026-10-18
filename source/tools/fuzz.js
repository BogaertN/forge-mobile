#!/usr/bin/env node
/* tools/fuzz.js — 4.9.71 ruling 8 (Nic): random-seed fuzzing OUTSIDE the release/CI gate. Non-blocking: always exits 0.
 * Runs the seeded GELC property suite with N fresh seeds and APPENDS every failure (seed, case, message) to _fuzz/failures.jsonl (git-ignored),
 * so a failing seed is fixed in the pipeline (a general change, never an answer patch) and can then be reproduced with GELC_SEED=<seed>.
 * Sends nothing anywhere. Usage: node tools/fuzz.js [runs=10] [firstSeed=random] */
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const ROOT = path.resolve(__dirname, '..'), OUT = path.join(ROOT, '_fuzz'), LOG = path.join(OUT, 'failures.jsonl');
const runs = Math.max(1, +(process.argv[2] || 10)); let seed = +(process.argv[3] || (Date.now() % 2147483647));
fs.mkdirSync(OUT, { recursive: true });
const HARNESS = `const ROOT=process.argv[1]; const KM=require(ROOT+'/src/kernel.js'), FK=require(ROOT+'/src/forge.js'), LEX=require(ROOT+'/data/lexicon.json'), EXT=require(ROOT+'/data/lexicon-ext.json');
const FKN=()=>{const st={};let t=0;return FK.ForgeKernel({store:KM.MemoryStore({get:k=>st[k],set:(k,v)=>{st[k]=v}}),clock:()=>new Date(Date.UTC(2026,9,11,20,45,0)+(t++)*1000).toISOString(),lexicon:LEX,lexiconExt:EXT})};
const rows=[];const expect=(c,m)=>{if(!c)throw new Error(m)};const C=(g,n,fn)=>{try{fn();rows.push({g,n,ok:true})}catch(e){rows.push({g,n,ok:false,why:String(e&&e.message).slice(0,600)})}};
require(ROOT+'/verify/gelc_suite.js')({C,expect,FKN,ROOT,canon:KM.canon,KMOD:KM});process.stdout.write(JSON.stringify(rows));`;
let failed = 0;
for (let i = 0; i < runs; i++, seed = (seed * 48271) % 2147483647) {
  let rows = []; try { rows = JSON.parse(execFileSync(process.execPath, ['-e', HARNESS, ROOT], { env: Object.assign({}, process.env, { GELC_SEED: String(seed) }), maxBuffer: 64 << 20 }).toString()); }
  catch (e) { rows = [{ g: 'HARNESS', n: 'suite crashed', ok: false, why: String(e && e.message).slice(0, 600) }]; }
  for (const r of rows.filter(r => !r.ok)) { failed++; fs.appendFileSync(LOG, JSON.stringify({ at: new Date().toISOString(), seed, group: r.g, case: r.n.slice(0, 160), why: r.why }) + '\n'); }
  console.log('seed ' + seed + ': ' + rows.filter(r => r.ok).length + ' pass, ' + rows.filter(r => !r.ok).length + ' fail');
}
console.log(failed ? failed + ' failure(s) appended to ' + path.relative(ROOT, LOG) + ' (reproduce with GELC_SEED=<seed>)' : 'no failures'); process.exit(0);
