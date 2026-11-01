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
  /* 4.9.206 runtime fetches: every URL the app precaches or fetches (tools/check_fetches.js list) answers 200 on the live site, and the
   * Supabase anchors read the app uses (kb_anchors_digest via the public key in sb_sync.js) answers with the anchor count. */
  const CF = require(path.join(__dirname, 'check_fetches.js')); const urls = same ? CF.urls(path.join(OUT, 'site')) : []; const runtime404 = [];
  for (const u of urls) { try { const r = await fetch(base + u + bust, { cache: 'no-store' }); if (!r.ok) runtime404.push(u + ' HTTP ' + r.status); } catch (e) { runtime404.push(u + ' ' + e.message); } }
  let anchors = null; try { const sbsrc = fs.readFileSync(path.join(OUT, 'site', 'src', 'sb_sync.js'), 'utf8'); const U = sbsrc.match(/url: '([^']+)'/)[1], K = sbsrc.match(/key: '([^']+)'/)[1];
    const r = await fetch(U + '/rest/v1/rpc/kb_anchors_digest', { method: 'POST', headers: { apikey: K, 'content-type': 'application/json' }, body: '{}' }); anchors = r.ok ? await r.json() : { error: 'HTTP ' + r.status }; } catch (e) { anchors = { error: e.message }; }
  const anchorsOk = !!(anchors && anchors.count > 0 && typeof anchors.digest === 'string');
  /* 4.9.216 math wheels: every pinned wheel in the shipped FORGE_LIBS (src/pycheck.js) is fetched from its public Storage URL with no credentials
   * and its SHA-256 must equal the pinned digest (the same check the phone makes before unpacking). */
  const wheels = []; try { const man = require(path.join(OUT, 'site', 'src', 'pycheck.js')).FORGE_LIBS; /* the copy the phone ships */
    for (const w of man.wheels) { try { const r = await fetch(w.url, { credentials: 'omit', cache: 'no-store' }); const b = r.ok ? Buffer.from(await r.arrayBuffer()) : null; wheels.push({ file: w.file, status: r.status, ok: !!b && sha(b) === w.sha256 && b.length === w.bytes }); } catch (e) { wheels.push({ file: w.file, ok: false, error: e.message }); } } } catch (e) { wheels.push({ ok: false, error: 'FORGE_LIBS ' + e.message }); }
  const wheelsOk = wheels.length === 7 && wheels.every(w => w.ok);
  const ok = same && !bad.length && !runtime404.length && anchorsOk && wheelsOk; console.log(JSON.stringify({ ok, live: head, local_manifest_sha256: local.manifest_sha256, files_checked: same ? local.files.length : 0, mismatched: bad, runtime_urls_checked: urls.length, runtime_missing: runtime404, supabase_anchors: anchors, forge_libs_wheels: { ok: wheelsOk, checked: wheels.length, failed: wheels.filter(w => !w.ok) } }, null, 1)); process.exit(ok ? 0 : 1); })().catch(e => { console.log(JSON.stringify({ ok: false, error: e.message })); process.exit(1); });
