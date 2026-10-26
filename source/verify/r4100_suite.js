/* R4100 (4.9.100): conservation of a stated stock on the existing dynamics pathway.
 * A finite inflow or outflow (an amount, not a rate) answers how much remains.
 * Same unit: exact sum or difference. A second dimension, or a unit the table
 * does not define, is a diagnostic — no number and no guessed conversion.
 * An unqualified gallon mixed with another volume unit stays ambiguous.
 * Nothing is written to memory or the shared KB. No LLM.
 * Written FIRST (failing). */
const ROOT = require('path').join(__dirname, '..');
const KMOD = require(ROOT + '/src/kernel.js');
const LEX = require(ROOT + '/data/lexicon.json'), EXT = require(ROOT + '/data/lexicon-ext.json');
const rows = [], tests = []; const T = (name, fn) => tests.push({ name, fn });
const expect = (c, why) => { if (!c) throw new Error(why || 'expectation failed'); };
const mk = () => KMOD.Kernel({ lexicon: LEX, lexiconExt: EXT, clock: () => '2026-10-26T00:30:00Z' });
const ids = r => ((r.trace && r.trace.rules) || []).map(x => x.id);
const causal = r => r.trace && r.trace.msm && r.trace.msm.meaning && r.trace.msm.meaning.causal;
const quiet = k => {
  expect((k.store.load('shared_knowledge') || []).length === 0, 'shared KB written');
  expect(!k.memory().length, 'a fact was stored');
  expect(!k.worldState().relations.length && !k.worldState().entities.length, 'world written');
};

T('conservation: removing a stated amount of the same unit', () => {
  const k = mk();
  const r = k.process('A tank contains 100 gallons. A pump removes 30 gallons. How much remains?');
  expect(/100 gallons − 30 gallons = 70 gallons\./.test(r.reply || ''), r.reply);
  expect(/only the stated amounts change the stock/.test(r.reply || ''), r.reply);
  expect(!/constant/.test(r.reply || ''), r.reply);
  expect(ids(r).includes('DYN-CONSERVATION'), ids(r).join(','));
  expect(r.trace.echo && r.trace.echo.pass, (r.trace.echo && r.trace.echo.reason) || 'echo failed');
  const c = causal(r);
  expect(c && c.status === 'conditionally_predicted' && c.derived_effects.length === 1 && /70 gallons/.test(c.derived_effects[0].text) && c.derived_effects[0].observed === false, JSON.stringify(c));
  quiet(k);
  const again = k.process('How much remains?');
  expect(!/70 gallons/.test(again.reply || ''), again.reply);
});
T('conservation: adding a stated amount of the same unit', () => {
  const k = mk();
  const r = k.process('A tank contains 100 gallons. A pump adds 15 gallons. How much remains?');
  expect(/100 gallons \+ 15 gallons = 115 gallons\./.test(r.reply || ''), r.reply);
  expect(ids(r).includes('DYN-CONSERVATION'), ids(r).join(','));
  expect(r.trace.echo && r.trace.echo.pass, (r.trace.echo && r.trace.echo.reason) || 'echo failed');
  quiet(k);
});
T('conservation: two stated outflows add before they leave the stock', () => {
  const k = mk();
  const r = k.process('A cistern contains 40 liters. A tap removes 12 liters and a hose removes 8 liters. How much is left?');
  expect(/40 liters − \(12 liters \+ 8 liters\) = 20 liters\./.test(r.reply || ''), r.reply);
  expect(ids(r).includes('DYN-CONSERVATION'), ids(r).join(','));
  expect(r.trace.echo && r.trace.echo.pass, (r.trace.echo && r.trace.echo.reason) || 'echo failed');
  quiet(k);
});
T('conservation: a count noun of one unit', () => {
  const k = mk();
  const r = k.process('A ledger holds 12 tokens. A clerk removes 3 tokens. How much remains?');
  expect(/12 tokens − 3 tokens = 9 tokens\./.test(r.reply || ''), r.reply);
  expect(r.trace.echo && r.trace.echo.pass, (r.trace.echo && r.trace.echo.reason) || 'echo failed');
  quiet(k);
});
T('conservation: crossing empty keeps the difference and names the bound', () => {
  const k = mk();
  const r = k.process('A tank contains 10 gallons. A pump removes 30 gallons. How much remains?');
  expect(/10 gallons − 30 gallons = −20 gallons\./.test(r.reply || ''), r.reply);
  expect(/reached “0 gallons”/.test(r.reply || ''), r.reply);
  expect(/cannot go below empty/.test(r.reply || ''), r.reply);
  expect(!/10 gallons − 30 gallons = 0 gallons/.test(r.reply || ''), r.reply);
  expect(r.trace.echo && r.trace.echo.pass, (r.trace.echo && r.trace.echo.reason) || 'echo failed');
  quiet(k);
});
T('conservation: passing a stated capacity names the capacity', () => {
  const k = mk();
  const r = k.process('A tank holds up to 50 gallons. It contains 40 gallons. A pump adds 20 gallons. How much remains?');
  expect(/40 gallons \+ 20 gallons = 60 gallons\./.test(r.reply || ''), r.reply);
  expect(/reached “50 gallons”/.test(r.reply || ''), r.reply);
  expect(/capacity/.test(r.reply || ''), r.reply);
  expect(!/40 gallons \+ 20 gallons = 50 gallons/.test(r.reply || ''), r.reply);
  expect(r.trace.echo && r.trace.echo.pass, (r.trace.echo && r.trace.echo.reason) || 'echo failed');
  quiet(k);
});
T('dimension: mass against volume is not converted', () => {
  const k = mk();
  const r = k.process('A tank contains 100 kilograms. A pump removes 30 liters. How much remains?');
  expect(/no conversion/.test(r.reply || '') && /did not compute/.test(r.reply || ''), r.reply);
  expect(!/=/.test(r.reply || ''), r.reply);
  expect(!/70/.test(r.reply || '') && !/3\.785/.test(r.reply || ''), r.reply);
  expect(ids(r).includes('DYN-CONSERVATION'), ids(r).join(','));
  const c = causal(r);
  expect(c && c.status === 'unsupported' && (c.missing || []).some(x => /unit conversion/i.test(x)), JSON.stringify(c));
  expect(r.trace.echo && r.trace.echo.pass, (r.trace.echo && r.trace.echo.reason) || 'echo failed');
  quiet(k);
});
T('dimension: a same-dimension factor the stock table does not define is not invented', () => {
  const k = mk();
  const r = k.process('A crate contains 2 kilograms. A clerk removes 500 grams. How much remains?');
  expect(/no conversion/.test(r.reply || '') && /did not compute/.test(r.reply || ''), r.reply);
  expect(!/=/.test(r.reply || '') && !/1\.5/.test(r.reply || '') && !/1500/.test(r.reply || ''), r.reply);
  expect(r.trace.echo && r.trace.echo.pass, (r.trace.echo && r.trace.echo.reason) || 'echo failed');
  quiet(k);
});
T('dimension: an unqualified gallon against liters is not assumed', () => {
  const k = mk();
  const r = k.process('A tank contains 100 gallons. A pump removes 30 liters. How much remains?');
  expect(/imperial/.test(r.reply || '') && /US/.test(r.reply || '') && /did not compute/.test(r.reply || ''), r.reply);
  expect(!/=/.test(r.reply || '') && !/3\.785/.test(r.reply || ''), r.reply);
  const c = causal(r);
  expect(c && c.status === 'unsupported', JSON.stringify(c));
  expect(r.trace.echo && r.trace.echo.pass, (r.trace.echo && r.trace.echo.reason) || 'echo failed');
  quiet(k);
});
T('defined factor: milliliters use the existing volume table and the factor is stated', () => {
  const k = mk();
  const r = k.process('A tank contains 2 liters. A pump removes 500 milliliters. How much remains?');
  expect(/exact by definition/.test(r.reply || ''), r.reply);
  expect(/= /.test(r.reply || '') && /liter/.test(r.reply || ''), r.reply);
  expect(!/did not compute/.test(r.reply || ''), r.reply);
  expect(ids(r).includes('DYN-CONSERVATION'), ids(r).join(','));
  expect(r.trace.echo && r.trace.echo.pass, (r.trace.echo && r.trace.echo.reason) || 'echo failed');
  quiet(k);
});
T('defined factor: a qualified US gallon uses the existing volume table', () => {
  const k = mk();
  const r = k.process('A tank contains 4 liters. A pump removes 1 US gallon. How much remains?');
  expect(/1 US gallon = 3\.785411784 liters \(exact by definition\)/.test(r.reply || ''), r.reply);
  expect(/4 liters − 3\.785411784 liters = 0\.214588216 liters\./.test(r.reply || ''), r.reply);
  expect(!/imperial/.test(r.reply || ''), r.reply);
  expect(ids(r).includes('DYN-CONSERVATION'), ids(r).join(','));
  expect(r.trace.echo && r.trace.echo.pass, (r.trace.echo && r.trace.echo.reason) || 'echo failed');
  quiet(k);
});
T('conservation: a missing start asks for the start and gives no number', () => {
  const k = mk();
  const r = k.process('A pump removes 12 liters. How much remains?');
  expect(/starting amount/.test(r.reply || '') && /did not compute/.test(r.reply || ''), r.reply);
  expect(!/=/.test(r.reply || ''), r.reply);
  expect(r.trace.echo && r.trace.echo.pass, (r.trace.echo && r.trace.echo.reason) || 'echo failed');
  quiet(k);
});
T('guard: a per-minute removal stays the rate equation', () => {
  const k = mk();
  const r = k.process('A tank contains 100 gallons. A pump removes 10 gallons each minute for 3 minutes. How much remains?');
  expect(/= 70 gallons\./.test(r.reply || ''), r.reply);
  expect(/constant/.test(r.reply || ''), r.reply);
  expect(!/only the stated amounts change the stock/.test(r.reply || ''), r.reply);
  expect(!ids(r).includes('DYN-CONSERVATION'), ids(r).join(','));
  expect(r.trace.echo && r.trace.echo.pass, (r.trace.echo && r.trace.echo.reason) || 'echo failed');
});
T('guard: a stated sum of two stocks stays the closed quantity rules', () => {
  const k = mk();
  const r = k.process('A cistern has 40 liters. A bucket has 10 liters. How many liters do the cistern and the bucket have?');
  expect(/40 liters \+ 10 liters = 50 liters\./.test(r.reply || ''), r.reply);
  expect(ids(r).includes('WM-QTY-CLOSED-UNITS'), ids(r).join(','));
  expect(!ids(r).includes('DYN-CONSERVATION'), ids(r).join(','));
});
T('guard: kilograms to liters stays a dimension refusal', () => {
  const k = mk();
  const r = k.process('What is 10 kilograms in liters?');
  expect(/dimensions differ/.test(r.reply || ''), r.reply);
  expect(!/3\.785/.test(r.reply || '') && !/= \d/.test(r.reply || ''), r.reply);
});
T('guard: two holdings are not added by the stock equation', () => {
  const k = mk();
  const r = k.process('A cistern holds 40 liters. A bucket holds 10 liters. How much do they hold together?');
  expect(!/= 50 liters/.test(r.reply || '') && !/DYN-CONSERVATION/.test(ids(r).join(',')), r.reply + ' ' + ids(r).join(','));
});

(async () => {
  let failed = 0;
  for (const t of tests) {
    try { await t.fn(); rows.push({ cls: 'R4100', name: t.name, ok: true }); }
    catch (e) { failed++; rows.push({ cls: 'R4100', name: t.name, ok: false, why: String(e.message || e).slice(0, 400) }); }
  }
  console.log(JSON.stringify(rows));
  process.exit(failed ? 1 : 0);
})();
