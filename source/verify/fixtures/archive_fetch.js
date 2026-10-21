/* Offline archive responses (4.9.78): every body recorded by tools/archives_live_check.js --record from the live archive, keyed by the
 * SHA-256 of its URL. fetchArchives(fallback) answers a recorded URL from disk, any other URL from fallback (else 404). No network. */
const fs = require('fs'), path = require('path'), crypto = require('crypto'); const DIR = path.join(__dirname, 'archives');
const REC = {}; for (const f of fs.existsSync(DIR) ? fs.readdirSync(DIR) : []) { const j = JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8')); REC[j.url] = j; }
const key = u => crypto.createHash('sha256').update(u).digest('hex').slice(0, 24);
const resp = (u, status, ct, body) => ({ ok: status >= 200 && status < 300, status, url: u, headers: { get: h => (String(h).toLowerCase() === 'content-type' ? ct : String(h).toLowerCase() === 'access-control-allow-origin' ? '*' : null) }, text: async () => body, json: async () => JSON.parse(body) });
const fetchArchives = (fallback, log) => async (u0, o) => { const u = String(u0); if (log) log.push(u); const r = REC[u]; if (r) return resp(u, r.status, r.ct, r.body); return fallback ? fallback(u0, o) : resp(u, 404, 'text/plain', ''); };
module.exports = { REC, key, fetchArchives };
