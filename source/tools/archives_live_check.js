/* Live reachability check of every archive in src/archives.js (4.9.78). Queries each archive ONCE through its own connector with a fixed
 * sample plan, sending an Origin header (as the browser would) and reporting: HTTP reachability, the CORS header, results, first title + URL.
 * Read-only GETs; no credentials. Not part of the offline release suite (it needs the network).
 *   node tools/archives_live_check.js                 report (JSON lines + a table)
 *   node tools/archives_live_check.js --record <dir>  also save every response body as an offline fixture (verify/fixtures/archives) */
const path = require('path'), fs = require('fs'), crypto = require('crypto');
const AR = require(path.join(__dirname, '..', 'src', 'archives.js'));
const SAMPLES = require(path.join(__dirname, '..', 'verify', 'fixtures', 'archive_samples.js'));
const rec = process.argv.indexOf('--record') > 0 ? process.argv[process.argv.indexOf('--record') + 1] : null;
const ORIGIN = 'https://forge-mobile.github.io', UA = 'ForgeMobileArchiveCheck/4.9.78 (read-only reachability check)';
const seen = {}; const live = async (u, o) => { const r = await fetch(u, Object.assign({}, o || {}, { headers: Object.assign({ Origin: ORIGIN, 'User-Agent': UA }, (o && o.headers) || {}) })); const body = await r.text();
  seen[u] = { status: r.status, cors: r.headers.get('access-control-allow-origin'), ct: r.headers.get('content-type') };
  if (rec && r.ok) { fs.mkdirSync(rec, { recursive: true }); fs.writeFileSync(path.join(rec, crypto.createHash('sha256').update(u).digest('hex').slice(0, 24) + '.json'), JSON.stringify({ url: u, status: r.status, ct: seen[u].ct, body })); }
  return { ok: r.ok, status: r.status, url: u, headers: { get: h => r.headers.get(h) }, text: async () => body, json: async () => JSON.parse(body) }; };
(async () => { const out = [];
  for (const a of AR.ARCHIVES) { const plan = SAMPLES[a.id]; if (!plan) { out.push({ id: a.id, status: 'NO_SAMPLE' }); continue; } AR._cache.clear(); for (const k of Object.keys(seen)) delete seen[k]; const t0 = Date.now(); let res = null, err = null;
    try { res = await AR._C[a.id](live, plan); } catch (e) { err = String(e && e.message || e); }
    const calls = Object.entries(seen).map(([u, v]) => ({ url: u.slice(0, 140), status: v.status, cors: v.cors }));
    const ok = !err && calls.length > 0 && calls.every(c => c.status === 200 && c.cors) && res && res.length > 0;
    out.push({ id: a.id, name: a.name, tier: a.tier, status: ok ? 'REACHABLE' : err ? 'ERROR' : !res || !res.length ? 'NO_RESULT' : 'NO_CORS', results: res ? res.length : 0, first: res && res[0] ? { title: res[0].title, url: res[0].url, excerpt: String(res[0].excerpt).slice(0, 160) } : null, error: err, calls, ms: Date.now() - t0 }); }
  for (const r of out) console.log(JSON.stringify(r));
  console.error('\n' + out.map(r => (r.status === 'REACHABLE' ? 'OK   ' : 'FAIL ') + (r.id + '                 ').slice(0, 18) + (String(r.tier) + '                    ').slice(0, 21) + r.status + ' ' + (r.first ? r.first.url : r.error || '')).join('\n'));
  console.error('checked ' + new Date().toISOString() + ': ' + out.filter(r => r.status === 'REACHABLE').length + '/' + out.length + ' reachable'); })();
