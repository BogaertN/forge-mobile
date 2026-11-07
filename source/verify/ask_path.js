/* Production Ask entry for verifiers. Same stages as src/app.js say(), without the DOM.
 * A question is compiled by src/qframe.js, sent through src/rmc_client.js to rmc_engine_v1,
 * then outward-compiled by src/rmc_core.js. Explicit remember stores a kāraka clause on the
 * session phone list only. Ask does not append to that list and does not write Supabase.
 * Kernel.process is not called. No model. */
const path = require('path');
const ROOT = path.join(__dirname, '..');
const K = require(ROOT + '/src/kernel.js');
const FK = require(ROOT + '/src/forge.js');
const Q = require(ROOT + '/src/qframe.js');
const R = require(ROOT + '/src/rmc_client.js');
const Core = require(ROOT + '/src/rmc_core.js');
const Priv = require(ROOT + '/src/privacy.js');
const LEX = require(ROOT + '/data/lexicon.json');
const EXT = require(ROOT + '/data/lexicon-ext.json');
const REMEMBER = /^\s*(?:please\s+)?remember\s+(?:that\s+)?(\S.*?)\s*[.!]?\s*$/i;
let forge = null;
function kernel() { return forge || (forge = FK.ForgeKernel({ store: K.MemoryStore(), lexicon: LEX, lexiconExt: EXT, clock: () => '2026-11-07T00:00:00Z' })); }
function session() { return { phone: [] }; }
function remember(s, text) {
  const m = String(text).match(REMEMBER);
  const said = m ? m[1].trim() : '';
  if (!said) return { ok: false, rule: 'REMEMBER-EMPTY' };
  if (/\?$/.test(said) || /^(?:what|who|whom|whose|which|when|where|why|how|is|are|was|were|do|does|did|can|could|will|would|should)\b/i.test(said)) return { ok: false, rule: 'REMEMBER-NOT-A-STATEMENT' };
  if (Priv.redact(said).secrets.length) return { ok: false, rule: 'PRIV-SECRET-NOT-KEPT' };
  const sentence = said.charAt(0).toUpperCase() + said.slice(1) + (/[.!]$/.test(said) ? '' : '.');
  const clause = Q.clause(sentence, kernel());
  const row = { id: 'rem-' + s.phone.length, text: sentence, clause, tier: 'phone', trust: 'trusted', scope: 'phone', provenance: { requested_by: 'user', request: 'remember_command', kind: 'statement', said: String(text) } };
  s.phone.push(row);
  return { ok: true, rule: 'REMEMBER-BY-USER-REQUEST', text: sentence, clause };
}
function ask(s, question) {
  const f = kernel();
  const frame = Q.compile(question, f);
  const before = s.phone.length;
  const memory = { receipts: [], phone: s.phone.slice(), hosted: [], anchors: [], research: [], self: [] };
  const payload = Core.withClauses({ question, frame, live: true, dry_run: false, memory }, Q, f);
  let row = R.askSync(payload);
  row = Core.outwardCompile(row, payload, f, null);
  if (s.phone.length !== before) throw new Error('ask appended phone memory');
  return row;
}
module.exports = { session, remember, ask, kernel };
