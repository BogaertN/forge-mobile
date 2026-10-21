/* A MediaWiki stand-in for offline research tests (4.9.78). pages: { title: full text (first line = intro) }; redirects: { from: to }.
 * search: every page whose title or text shares a query word, ordered by shared words (ties: insertion order) — so decoys (the country
 * article, a same-word title) are listed like the live search lists them; titles=: extracts with redirects=1 semantics (query.redirects);
 * every other host answers 404 unless `extra` maps a URL fragment to a body. No network. */
const wiki = (pages, redirects, extra) => async u0 => { const u = String(u0); const d = decodeURIComponent(u.replace(/\+/g, ' '));
  const ok = (ct, b) => ({ ok: true, status: 200, url: u, headers: { get: h => (String(h).toLowerCase() === 'content-type' ? ct : null) }, text: async () => b, json: async () => JSON.parse(b) });
  for (const [k, v] of Object.entries(extra || {})) if (u.includes(k)) return typeof v === 'function' ? v(u) : ok(v.ct || 'application/json', typeof v.body === 'string' ? v.body : JSON.stringify(v.body));
  if (/robots\.txt$/.test(u)) return ok('text/plain', 'User-agent: *\nDisallow: /w/index.php?title=Special');
  const R = redirects || {}; const ws = s => String(s).toLowerCase().match(/[a-z0-9]+/g) || [];
  if (/wikipedia\.org/.test(u) && d.includes('list=search')) { const q = new Set(ws((d.match(/srsearch=([^&]*)/) || [])[1] || '').filter(w => w.length > 2));
    const sc = Object.keys(pages).map((t, i) => ({ t, i, s: ws(t + ' ' + pages[t]).filter(w => q.has(w)).length })).filter(x => x.s > 0).sort((a, b) => b.s - a.s || a.i - b.i);
    return ok('application/json', JSON.stringify({ query: { search: sc.map(x => ({ title: x.t })) } })); }
  if (/wikipedia\.org/.test(u) && d.includes('titles=')) { const ts = d.split('titles=')[1].split('&')[0].split('|'); const reds = [], out = {};
    ts.forEach((t, i) => { let to = t; if (!pages[t] && R[t]) { to = R[t]; reds.push({ from: t, to }); } if (pages[to]) out[i + 1] = { title: to, extract: d.includes('exintro=1') ? pages[to].split('\n')[0] : pages[to] }; });
    return ok('application/json', JSON.stringify({ query: Object.assign({ pages: out }, d.includes('redirects=1') && reds.length ? { redirects: reds } : {}) })); }
  return { ok: false, status: 404, url: u, headers: { get: () => '' }, text: async () => '', json: async () => ({}) }; };
module.exports = { wiki };
