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

T('misplaced keys, bandaged wound, preheated oven, unplugged kettle, and marinated tofu are acknowledged', () => {
  const k = mk();
  ack(k, 'I misplaced my keys', 'C.MISPLACE', 'FR.MISPLACE.TR');
  ack(k, 'the nurse bandaged the wound', 'C.BANDAGE', 'FR.BANDAGE.TR');
  ack(k, 'she preheated the oven', 'C.PREHEAT', 'FR.PREHEAT.TR');
  ack(k, 'the oven preheated', 'C.PREHEAT', 'FR.PREHEAT.INCH');
  ack(k, 'she unplugged the kettle', 'C.UNPLUG', 'FR.UNPLUG.TR');
  ack(k, 'he marinated the tofu', 'C.MARINATE', 'FR.MARINATE.TR');
});

T('the room smells of bread uses the of-frame and adds no smell concept', () => {
  const r = ack(mk(), 'the room smells of bread', null, 'FR.SMELL.OF');
  expect(!ids(r, 'concepts').some(id => /SMELL/.test(id)), ids(r, 'concepts').join(','));
  expect(!(r.reply || '').toLowerCase().includes('could not attach'), r.reply);
});

T('bandage the wound is understood and blocked, with the frame and no write', () => {
  const k = mk();
  const r = k.process('bandage the wound');
  expect(r.trace.msm.meaning.kind === 'blocked', JSON.stringify(r.trace.msm.meaning.kind) + ' ' + (r.reply || '').slice(0, 160));
  expect(ids(r, 'concepts').includes('C.BANDAGE') && ids(r, 'frames').includes('FR.BANDAGE.TR'), JSON.stringify(lx(r)));
  const fr = lx(r).frames.find(f => f.id === 'FR.BANDAGE.TR');
  expect(fr.executes === false && fr.writes === false && fr.echo === false, JSON.stringify(fr));
  expect(durable(k) === 0 && !r.trace.tool_request, 'wrote or called a tool');
  expect(sharedN(k) === 0, 'shared KB');
});

T('a bandage noun is not the verb concept', () => {
  const k = mk();
  const r = k.process('the bandage is clean');
  expect(r.trace.echo && r.trace.echo.pass === true, r.reply);
  expect(r.trace.msm.meaning.kind === 'assert_ack', r.trace.msm.meaning.kind);
  expect(!ids(r, 'concepts').includes('C.BANDAGE'), JSON.stringify(lx(r)));
  const q = mk();
  const mean = q.process('what does bandage mean');
  expect(mean.trace.msm.meaning.kind === 'define', (mean.reply || '').slice(0, 200));
  expect(/cover a wound with a bandage/.test(mean.reply || ''), mean.reply);
  expect((mean.trace.msm.evidence.refs || []).includes('lexicon:C.BANDAGE'), JSON.stringify(mean.trace.msm.evidence.refs));
  expect(mean.trace.turn_packet && mean.trace.turn_packet.doc7 && mean.trace.turn_packet.doc7.belief === 'language_corpus', JSON.stringify(mean.trace.turn_packet && mean.trace.turn_packet.doc7));
  expect(durable(q) === 0, 'define wrote memory');
  const noun = mk().process('what is a bandage');
  expect(!/cover a wound with a bandage/.test(noun.reply || ''), noun.reply);
  expect(!ids(noun, 'concepts').includes('C.BANDAGE'), JSON.stringify(lx(noun)));
});

T('remember, who, and did answer from the bandaged-wound fact', () => {
  const k = mk();
  const rec = k.process('remember that the nurse bandaged the wound');
  expect(rec.trace.echo.pass === true && durable(k) === 1, (rec.reply || '').slice(0, 180) + ' mem ' + durable(k));
  expect(ids(rec, 'concepts').includes('C.BANDAGE') && ids(rec, 'frames').includes('FR.BANDAGE.TR'), JSON.stringify(lx(rec)));
  const who = k.process('who bandaged the wound');
  expect(who.trace.echo.pass === true && /nurse/i.test(who.reply || ''), (who.reply || '').slice(0, 180));
  expect(ids(who, 'concepts').includes('C.BANDAGE'), JSON.stringify(lx(who)));
  const did = k.process('did the nurse bandage the wound');
  expect(did.trace.echo.pass === true && /^Yes\b/.test(did.reply || ''), (did.reply || '').slice(0, 180));
  expect(sharedN(k) === 0, 'shared KB');
});

T('a recognized preheat frame does not approve a changed Echo', () => {
  const k = mk({ renderFault: t => t.replace(/preheated/g, 'burned') });
  const r = k.process('remember that the baker preheated the oven');
  expect(r.reply == null && r.blocked === true, (r.reply || '') + ' blocked=' + r.blocked);
  expect(r.trace.language === 'LANGUAGE_UNEXPRESSIBLE', r.trace.language + ' ' + r.block_reason);
  expect(durable(k) === 0, 'echo fail stored');
  expect(ids(r, 'concepts').includes('C.PREHEAT') && ids(r, 'frames').includes('FR.PREHEAT.TR'), JSON.stringify(lx(r)));
  expect(lx(r).frames.every(f => f.echo === false), JSON.stringify(lx(r).frames));
});

T('defrost, reheat, and recycle stay on their existing stems', () => {
  const k = mk();
  for (const s of ['she defrosted the bread', 'he reheated the soup', 'she recycled the bottle']) {
    const r = k.process(s);
    expect(r.trace.msm.meaning.kind === 'assert_ack' && r.trace.echo.pass === true, s + ' ' + (r.reply || '').slice(0, 120));
    expect(!ids(r, 'concepts').some(id => /^C\./.test(id)), s + ' ' + ids(r, 'concepts').join(','));
  }
});

T('the trace and the receipt show the concept and frame ids', () => {
  const r = mk().process('she preheated the oven');
  const app = fs.readFileSync(ROOT + '/src/app.js', 'utf8');
  expect(/t\.lexicon/.test(app), 'trace line');
  expect(TP && typeof TP.receiptCard === 'function', 'receiptCard');
  const card = TP.receiptCard(packetOf(r));
  expect(/C\.PREHEAT/.test(card) && /FR\.PREHEAT\.TR/.test(card), card.slice(0, 400));
  expect(packetOf(r).packet_version === '4.9.111', packetOf(r).packet_version);
});

T('version, registry, CONFLICTS, and NEXT_BUILD name 4.9.116 and leave creative writing unstarted', () => {
  const ver = fs.readFileSync(ROOT + '/VERSION', 'utf8').trim();
  expect(ver === '4.9.116', ver);
  const reg = JSON.parse(fs.readFileSync(ROOT + '/data/feature_registry.json', 'utf8'));
  expect(reg.version === ver && reg.count === 280 && reg.count === reg.features.length, reg.version + ' ' + reg.count);
  for (const id of ['R4116-LEXICON', 'R4116-FRAMES']) {
    const f = reg.features.find(x => x.id === id);
    expect(f && f.claim === 'Partial' && (f.proof || []).includes('R4116') && /4\.9\.116/.test(f.note), id);
    expect(f && /creative writing not started/i.test(f.note) && !/Christ function/i.test(f.note), id + ' ' + (f && f.note));
  }
  const tally = {}; for (const f of reg.features) tally[f.claim] = (tally[f.claim] || 0) + 1;
  expect(reg.claims.Implemented === 112 && reg.claims.Partial === tally.Partial + 1, JSON.stringify(reg.claims) + ' ' + tally.Partial);
  const cf = fs.readFileSync(ROOT + '/CONFLICTS.md', 'utf8');
  const sec = cf.slice(cf.lastIndexOf('## v4.9.116'));
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
  expect(/"release": "4\.9\.116"/.test(targeted) && /r4116_suite\.js/.test(targeted), 'targeted');
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
