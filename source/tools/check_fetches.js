#!/usr/bin/env node
/* check_fetches.js (4.9.206 release gate): every URL the built site precaches or fetches must exist in the built site.
 * 1. every entry of sw.js FILES exists (cache.addAll fails the whole install on one 404, which breaks the offline install);
 * 2. every same-origin asset path written as a string literal in a shipped script (fetch('data/x.json'), const P = 'engine/...')
 *    exists; 3. every prefix fetch (fetch('packs/confirmed_shared/' + k)) has shipped files under it.
 * Usage: node tools/check_fetches.js [siteDir]  (default ../_release/site). Exit 1 and a list on any missing URL.
 * EXEMPT lists runtime paths that are known to 404 and handled by the caller; each entry names the release that removes it. */
const fs = require('fs'), path = require('path');
const EXEMPT = {};
const ASSET = /^(?:\.\/)?((?:data|engine|reference|packs|docs|src|vendor|icons)\/[A-Za-z0-9_\-./]+\.(?:json|jsonl|js|py|gz|png|txt|wasm|whl|zip))$/;
const PREFIX = /fetch\(\s*['"`]((?:data|engine|packs|docs)\/[A-Za-z0-9_\-./]*\/)['"`]\s*\+/g;
function check(site) {
  const exists = p => { try { return fs.statSync(path.join(site, p)).isFile(); } catch (e) { return false; } };
  const missing = [], seen = new Set();
  const need = (p, from) => { const k = p.replace(/^\.\//, ''); if (k === '' || seen.has(k + '|' + from)) return; seen.add(k + '|' + from); if (EXEMPT[k]) return; if (!exists(k)) missing.push({ url: k, from }); };
  const sw = fs.readFileSync(path.join(site, 'sw.js'), 'utf8');
  const m = sw.match(/const FILES = (\[[^\]]*\])/); if (!m) return { ok: false, missing: [{ url: 'sw.js FILES', from: 'sw.js' }], checked: 0 };
  const files = JSON.parse(m[1].replace(/'/g, '"'));
  const dup = files.filter((f, i) => files.indexOf(f) !== i); for (const d of dup) missing.push({ url: d.replace(/^\.\//, ''), from: 'sw.js FILES duplicate (addAll rejects duplicates)' });
  for (const f of files) if (f !== './') need(f, 'sw.js FILES');
  const scripts = [];
  const walk = d => { for (const e of fs.readdirSync(path.join(site, d), { withFileTypes: true })) { const r = d ? d + '/' + e.name : e.name; if (e.isDirectory()) walk(r); else if (/\.js$/.test(e.name) && r !== 'sw.js') scripts.push(r); } };
  walk('src');
  let literals = 0, prefixes = 0;
  for (const s of scripts) {
    const t = fs.readFileSync(path.join(site, s), 'utf8');
    for (const lit of t.matchAll(/['"`]([^'"`\s\\]{4,200})['"`]/g)) { const a = lit[1].match(ASSET); if (a && !/\*|\$\{/.test(a[1])) { literals++; need(a[1], s); } }
    for (const p of t.matchAll(PREFIX)) { prefixes++; const dir = path.join(site, p[1]); let n = 0; try { n = fs.readdirSync(dir).filter(f => fs.statSync(path.join(dir, f)).isFile()).length; } catch (e) { n = 0; }
      if (!n && !/^data\/$/.test(p[1])) missing.push({ url: p[1] + '*', from: s }); }
  }
  const urls = [...new Set([...seen].map(x => x.split('|')[0]))].filter(u => u && !EXEMPT[u]).sort();
  return { ok: missing.length === 0, missing, urls, checked: files.length + literals, sw_files: files.length, literals, prefixes, exempt: EXEMPT };
}
const urls = site => check(site).urls;
module.exports = { check, urls, EXEMPT };
if (require.main === module) {
  const site = path.resolve(process.argv[2] || path.join(__dirname, '..', '..', '_release', 'site'));
  const r = check(site);
  console.log('check_fetches: ' + (r.ok ? 'ok' : 'FAIL') + ' · sw FILES ' + r.sw_files + ' · literal asset paths ' + r.literals + ' · prefix fetches ' + r.prefixes);
  for (const x of r.missing) console.log('  missing ' + x.url + '  (' + x.from + ')');
  process.exit(r.ok ? 0 : 1);
}
