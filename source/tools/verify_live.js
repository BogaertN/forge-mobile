#!/usr/bin/env node
/* verify_live.js: proves the live Pages deployment IS the locally verified artifact.
 * usage: node tools/verify_live.js https://bogaertn.github.io/forge-mobile/ [artifact dir, default <repo>/_release]
 * Fetches live BUILD_MANIFEST.json; requires its manifest_sha256, version, commit and test total to equal the local verified build; then
 * fetches EVERY listed file and compares its sha256. Exit 0 only on a full match. */
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const base = (process.argv[2] || 'https://bogaertn.github.io/forge-mobile/').replace(/\/?$/, '/'); const OUT = path.resolve(process.argv[3] || process.env.FORGE_ARTIFACT || path.join(__dirname, '..', '..', '_release'));
const local = JSON.parse(fs.readFileSync(path.join(OUT, 'site', 'BUILD_MANIFEST.json'), 'utf8')); const sha = b => crypto.createHash('sha256').update(b).digest('hex');
(async () => { const bust = '?v=' + local.manifest_sha256.slice(0, 12); const get = async p => { const r = await fetch(base + p + bust, { cache: 'no-store' }); if (!r.ok) throw new Error(p + ' HTTP ' + r.status); return Buffer.from(await r.arrayBuffer()); };
  const live = JSON.parse((await get('BUILD_MANIFEST.json')).toString()); const head = { version: live.version, commit: live.commit, tests: live.tests, manifest_sha256: live.manifest_sha256 };
  const same = live.manifest_sha256 === local.manifest_sha256 && live.version === local.version && live.commit === local.commit && JSON.stringify(live.tests) === JSON.stringify(local.tests);
  let bad = []; if (same) for (const f of local.files) { const b = await get(f.path); if (sha(b) !== f.sha256) bad.push(f.path); }
  const ok = same && !bad.length; console.log(JSON.stringify({ ok, live: head, local_manifest_sha256: local.manifest_sha256, files_checked: same ? local.files.length : 0, mismatched: bad }, null, 1)); process.exit(ok ? 0 : 1); })().catch(e => { console.log(JSON.stringify({ ok: false, error: e.message })); process.exit(1); });
