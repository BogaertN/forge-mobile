/* R4105 (4.9.105): a persistent versioned world head W_v.
 * The head is a WorldSnapshot. Its version_id is not the MemoryStore generation.
 * A commit is selectable only after the head readback. A failed stage does not
 * report success and does not publish a half head. The same backend reloads the
 * same version_id and content hash. A branch and a conservation step do not
 * move the head. Forgetting a premise withdraws a dependent. No LLM.
 * Written FIRST (failing). */
const ROOT = require('path').join(__dirname, '..');
const KMOD = require(ROOT + '/src/kernel.js');
const LEX = require(ROOT + '/data/lexicon.json'), EXT = require(ROOT + '/data/lexicon-ext.json');
const rows = [], tests = []; const T = (name, fn) => tests.push({ name, fn });
const expect = (c, why) => { if (!c) throw new Error(why || 'expectation failed'); };
const CLOCK = () => '2026-10-26T03:40:00Z';
const mk = (o) => KMOD.Kernel(Object.assign({ lexicon: LEX, lexiconExt: EXT, clock: CLOCK }, o || {}));
const sharedN = k => (k.store.load('shared_knowledge') || []).length;
const backend = () => { const st = {}; return { st, store: () => KMOD.MemoryStore({ get: k => (Object.prototype.hasOwnProperty.call(st, k) ? st[k] : null), set: (k, v) => { st[k] = String(v); }, del: k => { delete st[k]; }, keys: () => Object.keys(st) }) }; };
const open = (be, o) => mk(Object.assign({ store: be.store() }, o || {}));
const head = k => (typeof k.worldHead === 'function' ? k.worldHead() : null);

T('a remember commits a world head that is not the storage generation', () => {
  const k = mk();
  const r = k.process('remember that my car is red');
  expect(r.reply === 'I noted that your car is red.', r.reply);
  expect(r.trace.intent_kind === 'REQUEST_COMMIT', r.trace.intent_kind || 'missing');
  expect(r.trace.language !== 'LANGUAGE_UNEXPRESSIBLE', r.trace.language || '');
  const h = head(k);
  expect(h && h.committed === true, JSON.stringify(h));
  expect(h.schema === 'forge-world-state/v1', h.schema);
  expect(k.worldState().schema === 'FORGE-WORLD-STATE/v1', k.worldState().schema);
  expect(h.world_id && h.version_id && h.version_id !== String(h.storage_generation), JSON.stringify(h));
  expect(h.storage_generation === k.store.generation(), 'generation ' + k.store.generation() + ' head ' + h.storage_generation);
  expect(Array.isArray(h.parent_versions) && h.parent_versions.length === 0, JSON.stringify(h.parent_versions));
  expect(typeof h.content_hash === 'string' && h.content_hash.length >= 16, h.content_hash);
  expect(/^wrc:/.test(h.commit_receipt || ''), h.commit_receipt);
  expect(r.trace.world_version === h.version_id, r.trace.world_version || 'missing');
  expect(r.trace.world_commit && r.trace.world_commit.ok === true, JSON.stringify(r.trace.world_commit));
  expect(r.trace.world_head && r.trace.world_head.schema === h.schema && r.trace.world_head.version_id === h.version_id && r.trace.world_head.storage_generation === h.storage_generation, JSON.stringify(r.trace.world_head));
  expect(sharedN(k) === 0, 'shared KB written');
  const q = k.process('what is my car?');
  expect(q.reply === 'You told me that your car is red.', q.reply);
  expect(q.trace.intent_kind === 'READ', q.trace.intent_kind);
  expect(q.trace.world_version === h.version_id, q.trace.world_version);
  expect(head(k).version_id === h.version_id && head(k).content_hash === h.content_hash, 'a read moved the head');
});

T('the head survives a new kernel on the same store', () => {
  const be = backend();
  const k = open(be);
  k.process('remember that Aster is inside Beryl');
  k.process('remember that Beryl is inside Cobalt');
  const h = head(k);
  expect(h && h.committed && h.parent_versions.length === 1, JSON.stringify(h && h.parent_versions));
  const g = open(be);
  const again = head(g);
  expect(again && again.version_id === h.version_id && again.content_hash === h.content_hash && again.commit_receipt === h.commit_receipt, JSON.stringify(again));
  expect(again.storage_generation === h.storage_generation && again.storage_generation === g.store.generation(), 'reload mixed the generation into the version');
  const q = g.process('is Aster inside Cobalt?');
  expect(/^Yes/.test(q.reply || '') && q.trace.echo && q.trace.echo.pass, q.reply);
  expect(q.trace.intent_kind === 'DERIVE', q.trace.intent_kind);
  expect(q.trace.world_version === h.version_id, q.trace.world_version || 'missing');
  expect(head(g).version_id === h.version_id, 'the question committed a new head');
  expect(sharedN(g) === 0, 'shared KB written');
});

T('a failed stage does not publish a head or report success', () => {
  const be = backend();
  const k = open(be, { worldPublishFault: () => { throw new Error('disk'); } });
  const before = JSON.stringify(k.store.load('world_head'));
  const r = k.process('remember that my car is red');
  expect(r.trace.world_commit && r.trace.world_commit.ok === false, JSON.stringify(r.trace.world_commit));
  expect(r.trace.world_commit.rule === 'WV-STAGE-ABORTED', r.trace.world_commit && r.trace.world_commit.rule);
  expect(JSON.stringify(k.store.load('world_head')) === before, 'a failed stage became the head');
  expect(head(k) && head(k).committed === false, JSON.stringify(head(k)));
  expect(r.trace.world_version === head(k).version_id, r.trace.world_version);
  const stage = k.store.load('world_head_stage');
  expect(stage && !Array.isArray(stage) && stage.version_id && stage.version_id !== r.trace.world_version, 'the stage was selected or missing');
  expect(!(k.worldState().entities || []).some(e => e.id === 'ent:car'), 'the projection was published without a head');
  const g = open(be);
  expect(head(g).committed === false && head(g).version_id === head(k).version_id, 'reload saw a head the failed commit did not select');
  expect(sharedN(k) === 0, 'shared KB written');
});

T('a branch and a conservation step leave the committed head in place', () => {
  const k = mk();
  k.process('Remember that Pim is inside Quo.');
  const h = head(k);
  const world = JSON.stringify(k.worldState());
  const sim = k.process('Suppose Quo is inside Rub. Is Pim inside Rub?');
  expect(sim.trace.intent_kind === 'SIMULATE', sim.trace.intent_kind);
  expect(/branch/.test(sim.reply || '') && /Yes/.test(sim.reply || ''), sim.reply);
  expect(head(k).version_id === h.version_id && head(k).content_hash === h.content_hash, 'the branch moved the head');
  expect(sim.trace.world_version === h.version_id, sim.trace.world_version);
  expect(JSON.stringify(k.worldState()) === world, 'the branch wrote the projection');
  const tank = k.process('A tank contains 100 gallons. A pump removes 30 gallons. How much remains?');
  expect(/100 gallons − 30 gallons = 70 gallons\./.test(tank.reply || ''), tank.reply);
  expect(tank.trace.intent_kind === 'DERIVE', tank.trace.intent_kind);
  expect(head(k).version_id === h.version_id, 'conservation committed a world change');
  expect(tank.trace.world_version === h.version_id, tank.trace.world_version);
  expect(!k.memory().some(m => /gallon|tank|pump/.test(JSON.stringify(m))), 'the tank was stored');
  expect(sharedN(k) === 0, 'shared KB written');
});

T('forgetting a premise withdraws a dependent and commits the next head', () => {
  const k = mk();
  k.process('remember that Aster is inside Beryl');
  k.process('remember that Beryl is inside Cobalt');
  const before = head(k);
  const derived = k.worldState().relations.find(r => r.origin === 'derived' && r.text === 'aster is in cobalt');
  expect(derived && derived.item, JSON.stringify(k.worldState().relations.map(r => r.text)));
  k.process('is Aster inside Cobalt?');
  k.process('forget that Beryl is inside Cobalt');
  const r = k.process('yes');
  expect(r.trace.intent_kind === 'REQUEST_COMMIT', r.trace.intent_kind + ' ' + r.reply);
  const h = head(k);
  expect(h.version_id !== before.version_id, 'forget kept the same version');
  expect(h.parent_versions[0] === before.version_id, JSON.stringify(h.parent_versions));
  expect(h.invalidated.includes(derived.item), JSON.stringify(h.invalidated));
  const ws = k.worldState();
  expect(!ws.relations.some(rel => rel.item === derived.item), 'the dependent stayed active');
  expect(ws.withdrawn.some(w => w.item === derived.item && /^wd:/.test(w.receipt || '')), JSON.stringify(ws.withdrawn).slice(0, 300));
  expect(r.trace.world_version === h.version_id, r.trace.world_version);
  expect(sharedN(k) === 0, 'shared KB written');
});

T('guard: propose problem physics and a refused remember stay on their paths', () => {
  const k = mk();
  const p = k.process('propose problem physics');
  expect(p.trace.intent_kind === 'PROPOSE_EVIDENCE', p.trace.intent_kind + ' ' + p.reply);
  expect(/substrate \(fundamental\) frequency/.test(p.reply || ''), p.reply);
  expect(head(k).committed === false, 'the proposal committed a world head');
  expect(sharedN(k) === 0, 'shared KB written');
  const bad = KMOD.Kernel({ lexicon: LEX, lexiconExt: EXT, clock: CLOCK, renderFault: t => t.replace('noted', 'denied') });
  const r = bad.process('remember that my car is red');
  expect(r.reply == null && r.trace.language === 'LANGUAGE_UNEXPRESSIBLE', (r.trace.language || 'missing') + ' ' + r.reply);
  expect(r.trace.intent_kind === 'REQUEST_COMMIT', r.trace.intent_kind);
  expect(!bad.memory().length, 'a failed surface was stored');
  expect(head(bad).committed === false, 'an unexpressible remember committed a head');
});

(async () => {
  for (const t of tests) { try { await t.fn(); rows.push({ cls: 'R4105', name: t.name, ok: true }); } catch (e) { rows.push({ cls: 'R4105', name: t.name, ok: false, detail: String(e.message || e).slice(0, 400) }); } }
  console.log(JSON.stringify(rows));
  process.exit(rows.some(r => !r.ok) ? 1 : 0);
})();
