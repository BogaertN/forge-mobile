/* R499 (4.9.99): compiler leftovers the probe flags (how + copula: the noun phrase is the
 * subject, a following participle or predicate adjective is not) and one cause/effect step
 * (intervention stays a what-if, deduction stays the forward chain, a non-unique backward
 * walk does not pick a cause, a disagreeing measurement downgrades the asserted mechanism).
 * Written FIRST (failing). General pathway rules, not answer patches. */
const ROOT = require('path').join(__dirname, '..');
const KMOD = require(ROOT + '/src/kernel.js');
const LEX = require(ROOT + '/data/lexicon.json'), EXT = require(ROOT + '/data/lexicon-ext.json');
const rows = [], tests = []; const T = (name, fn) => tests.push({ name, fn });
const expect = (c, why) => { if (!c) throw new Error(why || 'expectation failed'); };
const mk = () => KMOD.Kernel({ lexicon: LEX, lexiconExt: EXT, clock: () => '2026-10-26T00:00:00Z' });
const ids = r => ((r.trace && r.trace.rules) || []).map(x => x.id);
const subjOf = r => { const m = r.trace && r.trace.msm && r.trace.msm.meaning; return m && (m.subj || (m.items && m.items[0] && m.items[0].subj) || null); };

T('how-passive: bricks made in a kiln names the means', () => {
  const k = mk();
  k.process('Remember that bricks are made in a kiln.');
  const r = k.process('How are bricks made?');
  expect(!/could not attach/i.test(r.reply || ''), r.reply);
  expect(/brick/i.test(r.reply || '') && /kiln/i.test(r.reply || ''), r.reply);
  expect(ids(r).includes('Q-WH-HOW-PASSIVE'), ids(r).join(','));
  expect(!ids(r).includes('G-NO-DERIVATION'), ids(r).join(','));
  expect(k.memory().length === 1, 'the question stored a fact');
  expect((k.store.load('shared_knowledge') || []).length === 0, 'shared KB written');
});
T('how-passive: steel made from iron keeps steel as the subject', () => {
  const k = mk();
  k.process('Remember that steel is made from iron.');
  const r = k.process('How is steel made from iron?');
  const subj = subjOf(r);
  expect(!/could not attach/i.test(r.reply || ''), r.reply);
  expect(!/steel made from iron/i.test(r.reply || ''), r.reply);
  expect(/steel/i.test(r.reply || '') && /iron/i.test(r.reply || ''), r.reply);
  expect(ids(r).includes('Q-WH-HOW-PASSIVE'), ids(r).join(','));
  expect(subj && subj.head && subj.head.indexOf('steel') >= 0 && !subj.ppRel, JSON.stringify(subj));
  expect(!/made/.test(JSON.stringify(subj && subj.head)), JSON.stringify(subj));
});
T('how-state: the desert hot is a frame about the desert', () => {
  const k = mk();
  const r = k.process('How is the desert hot?');
  const subj = subjOf(r);
  expect(!/could not attach/i.test(r.reply || ''), r.reply);
  expect(ids(r).includes('Q-WH-HOW-STATE'), ids(r).join(','));
  expect(subj && JSON.stringify(subj).indexOf('desert') >= 0, JSON.stringify(subj) + ' ' + r.reply);
});
T('guard: how are you stays the self answer', () => {
  const k = mk();
  const r = k.process('How are you?');
  expect(/no emotions/i.test(r.reply || '') && /this device/i.test(r.reply || ''), r.reply);
  expect(ids(r).includes('SELF-UNSETTLED'), ids(r).join(','));
  expect(!ids(r).includes('Q-WH-HOW-PASSIVE'), ids(r).join(','));
});
T('guard: when were the bricks made stays the time question', () => {
  const k = mk();
  const r = k.process('When were the bricks made?');
  expect(ids(r).includes('Q-WH-PASSIVE'), ids(r).join(','));
  expect(!ids(r).includes('Q-WH-HOW-PASSIVE'), ids(r).join(','));
  expect(/brick/i.test(r.reply || '') && !/could not attach/i.test(r.reply || ''), r.reply);
});
T('guard: how does a compass work stays a manner question', () => {
  const k = mk();
  const r = k.process('How does a compass work?');
  expect(ids(r).includes('Q-WH-HOW-MANNER'), ids(r).join(','));
  expect(/compass/i.test(r.reply || '') && !/could not attach/i.test(r.reply || ''), r.reply);
});
T('deduction: does frost cause leaks stays an inference', () => {
  const k = mk();
  k.process('Remember that frost causes cracks.');
  k.process('Remember that cracks cause leaks.');
  const r = k.process('Does frost cause leaks?');
  expect(/^Yes, I infer/.test(r.reply || ''), r.reply);
  expect(ids(r).includes('INF-RELPROP') || ids(r).includes('INF-CAUSE-CHAIN'), ids(r).join(','));
  expect(!ids(r).some(id => /^DYN-/.test(id)), ids(r).join(','));
});
T('intervention: what happens if stays a what-if', () => {
  const k = mk();
  k.process('Remember that frost causes cracks.');
  k.process('Remember that cracks cause leaks.');
  const r = k.process('What happens if there is frost?');
  expect(ids(r).includes('DYN-WHATIF'), ids(r).join(','));
  expect(/frost/i.test(r.reply || '') && /crack/i.test(r.reply || ''), r.reply);
  expect(!/^Yes, I infer/.test(r.reply || ''), r.reply);
  expect(!ids(r).some(id => /^CAUSAL-INVERSION-/.test(id)), ids(r).join(','));
});
T('guard: two direct causes of cracks are both listed', () => {
  const k = mk();
  k.process('Remember that frost causes cracks.');
  k.process('Remember that impacts cause cracks.');
  const r = k.process('What causes cracks?');
  expect(/frost/i.test(r.reply || '') && /impact/i.test(r.reply || ''), r.reply);
  expect(!ids(r).includes('CAUSAL-INVERSION-NONUNIQUE'), ids(r).join(','));
  expect(k.memory().length === 2, 'the question stored a fact');
});
T('inversion: two upstream causes of leaks are both cited', () => {
  const k = mk();
  k.process('Remember that frost causes cracks.');
  k.process('Remember that cracks cause leaks.');
  k.process('Remember that impacts cause cracks.');
  const r = k.process('What causes leaks?');
  expect(/frost/i.test(r.reply || '') && /impact/i.test(r.reply || ''), (r.reply || 'no reply') + ' ' + ids(r).join(','));
  expect(/crack/i.test(r.reply || ''), r.reply);
  expect(ids(r).includes('CAUSAL-INVERSION-NONUNIQUE'), ids(r).join(','));
  expect(!ids(r).includes('DYN-WHATIF'), ids(r).join(','));
  expect(k.memory().length === 3, 'the question stored a fact');
  expect((k.store.load('shared_knowledge') || []).length === 0, 'shared KB written');
});
T('inversion: one cause chain is cited and not called non-unique', () => {
  const k = mk();
  k.process('Remember that frost causes cracks.');
  k.process('Remember that cracks cause leaks.');
  const r = k.process('What causes leaks?');
  expect(/frost/i.test(r.reply || '') && /crack/i.test(r.reply || '') && /leak/i.test(r.reply || ''), (r.reply || 'no reply') + ' ' + ids(r).join(','));
  expect(!ids(r).includes('CAUSAL-INVERSION-NONUNIQUE'), ids(r).join(','));
  expect(ids(r).includes('CAUSAL-INVERSION-CHAIN'), ids(r).join(','));
  expect(!ids(r).includes('DYN-WHATIF'), ids(r).join(','));
  expect(!/^Yes, I infer/.test(r.reply || ''), r.reply);
  expect(k.memory().length === 2, 'the question stored a fact');
  expect((k.store.load('shared_knowledge') || []).length === 0, 'shared KB written');
});
T('mechanism: a disagreeing measurement downgrades the level equation', () => {
  const k = mk();
  k.process('A tank contains 100 gallons. A pump removes 10 gallons each minute for 3 minutes. How much remains?');
  const r = k.process('I measured 80 gallons after 3 minutes');
  expect(/= 70 gallons/.test(r.reply || ''), r.reply);
  expect(/80 gallons/.test(r.reply || '') && /conflict/.test(r.reply || '') && /did not replace my prediction/.test(r.reply || ''), r.reply);
  expect(/downgrad/i.test(r.reply || ''), r.reply);
  expect(ids(r).includes('DYN-MECHANISM-DOWNGRADE'), ids(r).join(','));
  const mech = (((r.trace || {}).msm || {}).meaning || {}).causal;
  expect(mech && !(mech.mechanism_ids || []).includes('DYN-LEVEL'), JSON.stringify(mech && mech.mechanism_ids));
  expect(r.trace.echo && r.trace.echo.pass, (r.trace.echo && r.trace.echo.reason) || 'echo failed');
  expect(!k.worldState().relations.length && !k.worldState().entities.length, 'the scenario wrote to the durable world');
});
T('guard: an association is not an intervention effect', () => {
  const k = mk();
  k.process('Remember that rain correlates with floods.');
  const r = k.process('What happens if there is rain?');
  expect(/association|correlat/i.test(r.reply || ''), r.reply);
  expect(/no stored effect/i.test(r.reply || ''), r.reply);
  expect(!/causes “floods”/.test(r.reply || ''), r.reply);
  const c = (((r.trace || {}).msm || {}).meaning || {}).causal;
  expect(c && c.status === 'unsupported' && (c.missing || []).some(x => /mechanism/i.test(x)), JSON.stringify(c));
});

(async () => {
  let failed = 0;
  for (const t of tests) {
    try { await t.fn(); rows.push({ cls: 'R499', name: t.name, ok: true }); }
    catch (e) { failed++; rows.push({ cls: 'R499', name: t.name, ok: false, why: String(e.message || e).slice(0, 400) }); }
  }
  console.log(JSON.stringify(rows));
  process.exit(failed ? 1 : 0);
})();
