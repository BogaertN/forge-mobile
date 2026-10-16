#!/usr/bin/env node
/* node tools/verify_proof.js proof.json — offline re-verification of a Forge proof export (plan §3): no app, no network.
   Checks the bundle hash, re-validates and re-hashes every shared (GKS) premise, and re-derives the answer from the recorded meaning with the same
   deterministic realizer, requiring a byte-identical sentence and a passing Echo round trip. */
const fs = require('fs'), path = require('path'); const KN = require('../src/knowledge.js'); const { Kernel } = require('../src/kernel.js');
const b = JSON.parse(fs.readFileSync(process.argv[2], 'utf8')); const k = Kernel({ lexicon: require(path.join(__dirname, '../data/lexicon.json')) });
const r = KN.verifyProof(b, m => k.realize(m)); for (const [n, ok] of r.checks) console.log((ok ? 'ok   ' : 'FAIL ') + n); console.log(r.ok ? 'PROOF OK' : 'PROOF FAILED'); process.exit(r.ok ? 0 : 1);
