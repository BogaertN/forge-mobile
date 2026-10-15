#!/usr/bin/env node
/* Build + sign a GKS snapshot. Private JWK from env GKS_PUBLISHER_PRIVATE_JWK (Actions secret). Never logs the key. */
'use strict';
const fs = require('fs'), path = require('path');
const GKS = require('../src/gks.js');
const ROOT = path.join(__dirname, '..');
const OUT = process.env.FORGE_GKS_OUT || path.join(ROOT, '..', '_release', 'gks');
(async () => {
  const priv = process.env.GKS_PUBLISHER_PRIVATE_JWK; if (!priv) { console.error('missing GKS_PUBLISHER_PRIVATE_JWK'); process.exit(2); }
  let jwk; try { jwk = JSON.parse(priv); } catch (e) { console.error('GKS_PUBLISHER_PRIVATE_JWK is not JSON'); process.exit(2); }
  if (!jwk.kid || !jwk.d) { console.error('private JWK needs kid and d'); process.exit(2); }
  const known = GKS.KB_PUBLISHER_PUBKEYS.find(k => k.kid === jwk.kid);
  if (!known) { console.error('kid not in compiled KB_PUBLISHER_PUBKEYS'); process.exit(2); }
  const parentPath = process.env.GKS_PARENT || '';
  let parent = null, seq = 1;
  if (parentPath && fs.existsSync(parentPath)) { parent = JSON.parse(fs.readFileSync(parentPath, 'utf8')); seq = (parent.seq || 0) + 1; }
  const body = { schema: GKS.SCHEMA, facts: [], rules: [], lexicon: { core: 'bundled', note: 'WordNet stays in Pages; GKS body is the signed overlay' }, built_for: 'forge-mobile' };
  if (fs.existsSync(path.join(ROOT, 'data', 'gks-body.json'))) Object.assign(body, JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'gks-body.json'), 'utf8')));
  const sha = GKS.bodyHash(body);
  const signature = await GKS.signBody(jwk, body);
  const snap = { schema: GKS.SCHEMA, sha256: sha, parent_sha256: parent ? parent.sha256 : null, seq, publisher_kid: jwk.kid, signature, sections: { facts: 0, rules: 0 }, counts: { facts: 0, rules: 0 } };
  const v = await GKS.verify(snap, body); if (!v.ok) { console.error('self-verify failed', v.rule); process.exit(1); }
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, sha + '.json'), JSON.stringify({ snap, body }));
  fs.writeFileSync(path.join(OUT, 'latest.json'), JSON.stringify({ snap, body }));
  console.log(JSON.stringify({ ok: true, sha256: sha, seq, kid: jwk.kid, out: OUT }));
})().catch(e => { console.error(e.message || e); process.exit(1); });
