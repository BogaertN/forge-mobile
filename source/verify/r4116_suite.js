/* R4116 (4.9.116): Docs 4–5 lexicon and frames. Written FIRST.
 * Ordinary pathways that fail for a missing concept or frame become lawful acknowledgements.
 * A word is not a concept, a concept is not evidence, and evidence is not permission.
 * Recognizing a frame does not execute, write, or approve Echo.
 * Creative writing is not this release. */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const KMOD = require(ROOT + '/src/kernel.js');
const FK = require(ROOT + '/src/forge.js');
const LEX = require(ROOT + '/data/lexicon.json');
const EXT = require(ROOT + '/data/lexicon-ext.json');
const rows = [], tests = [];
const T = (name, fn) => tests.push({ name, fn });
const expect = (c, why) => { if (!c) throw new Error(why || 'expectation failed'); };
const CLOCK = () => '2026-10-27T00:16:00Z';
const mk = o => FK.ForgeKernel(Object.assign({ lexicon: LEX, lexiconExt: EXT, clock: CLOCK, store: KMOD.MemoryStore((() => { const st = {}; return { get: k => st[k], set: (k, v) => { st[k] = v; } }; })()) }, o || {}));
const sharedN = k => (k.store.load('shared_knowledge') || []).length;
const durable = k => (k.store.load('memory') || []).filter(r => r.status !== 'forgotten' && r.status !== 'superseded').length;
const lx = r => r && r.trace && r.trace.lexicon;
const ids = (r, key) => ((lx(r) && lx(r)[key]) || []).map(x => x.id);
const packetOf = r => r && (r.turn_packet || (r.trace && r.trace.turn_packet));
let TP = null;
try { TP = require(ROOT + '/src/turn_packet.js'); } catch (e) { TP = null; }
const LAW = 'word ≠ concept ≠ evidence ≠ permission';

function ack(k, text, concept, frame) {
  const r = k.process(text);
  const reply = r.reply || '';
  expect(r.trace && r.trace.echo && r.trace.echo.pass === true, text + ' echo ' + JSON.stringify(r.trace && r.trace.echo && r.trace.echo.reason));
  expect(r.trace.msm && r.trace.msm.meaning && r.trace.msm.meaning.kind === 'assert_ack', text + ' kind ' + (r.trace.msm && r.trace.msm.meaning && r.trace.msm.meaning.kind) + ' :: ' + reply.slice(0, 180));
  expect(!/could not attach|do not know the word|I found no verb/i.test(reply), text + ' still blocked: ' + reply.slice(0, 180));
  expect(lx(r) && lx(r).law === LAW, text + ' law ' + JSON.stringify(lx(r) && lx(r).law));
  if (concept) expect(ids(r, 'concepts').includes(concept), text + ' concepts ' + ids(r, 'concepts').join(','));
  expect(ids(r, 'frames').includes(frame), text + ' frames ' + ids(r, 'frames').join(','));
  const fr = (lx(r).frames || []).find(f => f.id === frame);
  expect(fr && fr.executes === false && fr.writes === false && fr.echo === false, text + ' flags ' + JSON.stringify(fr));
  expect(durable(k) === 0 && (r.trace.memory || []).length === 0, text + ' wrote memory');
  expect(sharedN(k) === 0, 'shared KB');
  expect(!(r.trace.msm.evidence.refs || []).some(id => String(id).startsWith('lexicon:C.')), text + ' concept used as evidence');
  const p = packetOf(r);
  expect(p && p.schema === 'FORGE-TURN-PACKET/v1' && p.packet_version === '4.9.111', 'packet schema');
  expect(p.lexicon && ids(r, 'frames').every(id => (p.lexicon.frames || []).some(f => f.id === id)), 'packet lexicon');
  return r;
}









T('version, registry, CONFLICTS, and NEXT_BUILD name 4.9.116 and leave creative writing unstarted', () => {
  const ver = fs.readFileSync(ROOT + '/VERSION', 'utf8').trim();
  const parts = ver.split('.').map(part => parseInt(part, 10));
  expect(parts[0] === 4 && parts[1] === 9 && parts[2] >= 116, ver);
  const reg = JSON.parse(fs.readFileSync(ROOT + '/data/feature_registry.json', 'utf8'));
  expect(reg.version === ver && reg.count === reg.features.length, reg.version + ' ' + reg.count);
  for (const id of ['R4116-LEXICON', 'R4116-FRAMES']) {
    const f = reg.features.find(x => x.id === id);
    expect(f && (f.claim === 'Partial' || (f.claim === 'Out of scope / parked' && /Retired 4\.9\.215/.test(f.note)) /* 4.9.215 C4: parked when its proof was retired */) && (f.proof || []).includes('R4116') && /4\.9\.116/.test(f.note), id);
    expect(f && /creative writing not started/i.test(f.note) && !/Christ function/i.test(f.note), id + ' ' + (f && f.note));
  }
  const tally = {}; for (const f of reg.features) tally[f.claim] = (tally[f.claim] || 0) + 1;
  expect(reg.claims.Implemented === 112 && reg.claims.Partial === tally.Partial + 1, JSON.stringify(reg.claims) + ' ' + tally.Partial);
  const cf = fs.readFileSync(ROOT + '/CONFLICTS.md', 'utf8');
  const at = cf.lastIndexOf('## v4.9.116');
  const nxt = cf.indexOf('\n## v', at + 12);
  const sec = cf.slice(at, nxt === -1 ? undefined : nxt);
  expect(/Doc 4/.test(sec) && /Doc 5/.test(sec) && /C\.MISPLACE/.test(sec) && /FR\.SMELL\.OF/.test(sec), 'conflicts pathways');
  expect(/creative writing/.test(sec) && /not started|do not start/.test(sec), 'creative writing fence');
  expect(/shared KB stays empty|Shared KB stays empty/.test(sec) && !/Christ function/i.test(sec), 'shared');
  expect(!/\b(llm|embedding|classifier)\b/i.test(sec), 'model');
  const next = fs.readFileSync(ROOT + '/../NEXT_BUILD.md', 'utf8');
  expect(/4\.9\.116/.test(next) && /4\.9\.115/.test(next) && /Genesis/.test(next), 'NEXT_BUILD');
  const readme = fs.readFileSync(ROOT + '/../README.md', 'utf8');
  expect(/4\.9\.116/.test(readme) && /4\.9\.115/.test(readme) && /Pattern Reflection/.test(readme) && /Verify packet/.test(readme), 'README');
  expect(/misplaced|bandaged|preheated/.test(readme) && !/failing-first|bot instruction/i.test(readme), 'README product');
  const targeted = fs.readFileSync(ROOT + '/verify/targeted.json', 'utf8');
  const tg = JSON.parse(targeted), tp = String(tg.release || '').split('.').map(part => parseInt(part, 10));
  expect(tp[0] === 4 && tp[1] === 9 && tp[2] >= 116 && (tg.suites || []).includes('r4116_suite.js'), 'targeted');
  expect(!fs.existsSync(ROOT + '/src/creative.js'), 'creative writing started');
  const L = require(ROOT + '/src/lexicon.js');
  const cs = L.SEED_CONCEPTS.filter(c => String(c.id).startsWith('C.'));
  expect(cs.length === 5, 'concepts ' + cs.length);
  const fr = cs.reduce((n, c) => n + (c.frames || []).length, 0) + (L.DOC45_OF && L.DOC45_OF.smell ? 1 : 0);
  expect(fr === 7, 'frames ' + fr);
});

(async () => {
  let failed = 0;
  for (const t of tests) {
    try { await t.fn(); rows.push({ cls: 'R4116', name: t.name, ok: true }); }
    catch (e) { failed++; rows.push({ cls: 'R4116', name: t.name, ok: false, why: String(e.message || e).slice(0, 500) }); }
  }
  console.log(JSON.stringify(rows, null, 1));
  process.exit(failed ? 1 : 0);
})();
