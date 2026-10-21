/* R478 (4.9.78, Nic's approval of the 2026-10-21 audit fixes; written FIRST, before the implementation). Offline: fixture web only.
 * The audit's own probe questions are NOT here (they are held-out style: their SHA-256 digests only, verify/heldout/research_probe_digests.json);
 * these cases exercise the same SHAPES with other words.
 *  1 SUBJECT of "what is X <participle> of/by/from …": the subject is the noun phrase X (the participle and its PP are the predicate).
 *  2 FULL NOUN PHRASE: a proper-name compound with its common-noun head ("<Country> <institution>") is the subject; the country / nationality is
 *    only a jurisdiction modifier; the bare country article never stands in for it; a title reached by a redirect from the full phrase (an
 *    alternate name) matches it; no blanket default jurisdiction; the shown sentence is verbatim-entailed and about the subject.
 *  3 DESCRIPTIVE / ORDINAL subjects ("the <ordinal> <noun> from <NP>"): a source whose sentence verbatim states "<Name> is the <description>"
 *    resolves the description to <Name>; an ordinal never matches a different ordinal.
 *  4 an acronym that spells a pronoun ("US") inside a name is a name: the question is a public lookup (AQ-1), not a personal turn.
 *  5 TRACE: every research path records the picked subject, the jurisdiction, the candidate sources and each rejection reason.
 *  7 UNITS: exact conversions inside the rate solver when every unit is unambiguous; an unqualified gallon (US or imperial) is refused as
 *    ambiguous wherever a conversion would need it (rate solver and the convert frame).
 *  8 MINOR: kb.contributions insert revoked by a repo migration; no "ChristPing"; χ is the "correction function" in labels and comments. */
const ROOT = require('path').join(__dirname, '..'); const fs = require('fs'), path = require('path');
const KMOD = require(ROOT + '/src/kernel.js'), FK = require(ROOT + '/src/forge.js'), PV = require(ROOT + '/src/provenance.js'), LEX = require(ROOT + '/data/lexicon.json');
const { wiki } = require('./fixtures/wikimock.js'); const AR = require(ROOT + '/src/archives.js'); /* the archives keep a per-session URL cache: cleared per case so fixtures never leak between cases */
const rows = [], tests = []; const T = (name, fn) => tests.push({ name, fn }); const expect = (c, why) => { if (!c) throw new Error(why || 'expectation failed'); };
let tick = 0; const clock = () => new Date(Date.UTC(2026, 9, 21, 16, 0, 0) + (tick++) * 1000).toISOString();
const mkStore = () => { const st = {}; return KMOD.MemoryStore({ get: k => st[k], set: (k, v) => { st[k] = v; } }); };
async function ask(pages, q, redirects) { AR._cache.clear(); const f = FK.ForgeKernel({ clock, lexicon: LEX, store: mkStore(), vaultIterations: 1000, fetch: wiki(pages, redirects) }); await f.vault.setup('correct horse'); await f.vault.unlock('correct horse');
  const r = f.process(q); const t = r.toolJob ? await r.toolJob : null; return { f, r, t, m: t && t.trace && t.trace.msm && t.trace.msm.meaning, rt: t && t.trace && t.trace.research }; }
const K = () => KMOD.Kernel({ lexicon: LEX, clock });
const plan = q => K().lookupPlan(q);
const qEnt = q => PV.questionEntity(plan(q), q);
const replyOf = x => (x.t && (x.t.reply || x.t.text)) || '';

/* ---------------- 1. participle questions ---------------- */
for (const [q, s] of [['What is bronze made of?', 'bronze'], ['What is paper produced from?', 'paper'], ['What are bricks composed of?', 'brick'], ['What was the telescope invented by?', 'telescope'], ['What is cheese derived from?', 'cheese']])
  T('1: the subject of "' + q + '" is the noun phrase "' + s + '" (the participle is the predicate, never part of the subject)', () => { const e = qEnt(q); expect(e === s || e === s + 's', 'question entity "' + e + '"'); });
T('1: end to end — the subject\'s own article answers a made-of question; a title sharing the participle ("Made in …") or a longer head ("… Age") is not the subject', async () => {
  const pages = { 'Made in Italy': 'Made in Italy is a merchandise mark indicating that a product is designed and manufactured in Italy.', 'Bronze Age': 'The Bronze Age was a historical period characterised by the use of bronze.',
    Bronze: 'Bronze is an alloy consisting primarily of copper, commonly with about 12 percent tin.\nBronze is harder than copper.' };
  const x = await ask(pages, 'What is bronze made of?'); expect(x.m && x.m.kind === 'research_answer' && x.m.source === 'Bronze', 'kind ' + (x.m && x.m.kind) + ' source ' + (x.m && x.m.source) + ' | ' + replyOf(x));
  expect(/Bronze is an alloy consisting primarily of copper/.test(replyOf(x)) && !/Unsupported/.test(replyOf(x)), replyOf(x)); });

/* ---------------- 2. full noun phrase, jurisdiction, alternate names, sentence selection ---------------- */
for (const [q, s, j] of [['What does the French Navy do?', 'french navy', 'france'], ['What does the Canadian Army do?', 'canadian army', 'canada'], ['What does the French military do?', 'french military', 'france'], ['research France tax code', 'france tax code', 'france']])
  T('2: "' + q + '" keeps the full noun phrase "' + s + '" as the subject; the country is the jurisdiction modifier "' + j + '"', () => { const p = plan(q), e = qEnt(q); expect(e === s, 'subject "' + e + '" (plan entity ' + (p && p.entity) + ')'); expect(p && p.juris === j, 'juris ' + (p && p.juris)); });
for (const q of ['What is bronze made of?', 'What does a heart do?', 'How does a telescope work?'])
  T('2: no blanket default jurisdiction: "' + q + '" names no polity, so the plan has none', () => { const p = plan(q); expect(p && (p.juris === null || p.juris === undefined), 'juris ' + (p && p.juris)); });
const FR = { France: 'France is a country in Western Europe. Its total area is 643,801 square kilometres.', 'French Navy': 'The French Navy is the maritime arm of the French Armed Forces. Applicants must be at least 17 years old.',
  'French Armed Forces': 'The French Armed Forces are the military forces of France. They include the French Army, the French Navy and the French Air and Space Force.\nRecruits must be at least 17 years old.',
  'Taxation in France': 'Taxation in France is governed by the French tax code, the Code général des impôts. It sets out income tax and value added tax.', 'French Revolution': 'The French Revolution was a period of political change in France that began in 1789.' };
T('2: the bare country article never stands in for "<country> <institution>": the institution\'s own article is cited and its lead sentence (about the subject) is shown', async () => {
  const x = await ask(FR, 'What does the French Navy do?'); const rp = replyOf(x); expect(x.m && x.m.kind === 'research_answer' && x.m.source === 'French Navy', 'source ' + (x.m && x.m.source) + ' | ' + rp);
  expect(/The French Navy is the maritime arm of the French Armed Forces/.test(rp) && !/Applicants must/.test(rp) && !/643,801/.test(rp), 'off-topic or wrong sentence: ' + rp); expect(!/Unsupported/.test(rp), 'unsupported shown: ' + rp); });
T('2: a title reached by a redirect from the full phrase (an alternate name) matches it; the country article is set aside', async () => {
  const x = await ask(FR, 'What does the French military do?', { 'French military': 'French Armed Forces' }); const rp = replyOf(x);
  expect(x.m && x.m.kind === 'research_answer' && x.m.source === 'French Armed Forces', 'source ' + (x.m && x.m.source) + ' | ' + rp); expect(/The French Armed Forces are the military forces of France/.test(rp) && !/Recruits must/.test(rp), rp); });
T('2: a directive "research <country> tax code" is answered by the article the full phrase redirects to, never by the country article', async () => {
  const x = await ask(FR, 'research France tax code', { 'France tax code': 'Taxation in France' }); const rp = replyOf(x);
  expect(x.m && x.m.source === 'Taxation in France', 'source ' + (x.m && x.m.source) + ' | ' + rp); expect(!/643,801/.test(rp), rp); });
T('2: with only the country article and unrelated pages, the answer is an honest subject mismatch — never the country article\'s sentence', async () => {
  const pages = { France: FR.France, 'French Revolution': FR['French Revolution'] }; const x = await ask(pages, 'What does the French Navy do?'); const rp = replyOf(x);
  expect(x.m && x.m.kind === 'tool_failed' && x.m.limitation === 'SUBJECT_MISMATCH', 'kind ' + (x.m && x.m.kind) + ' | ' + rp); expect(!/643,801|Western Europe/.test(rp), rp); });

/* ---------------- 3. descriptive / ordinal subjects ---------------- */
const SOL = { Venus: 'Venus is the second planet from the Sun. It is a terrestrial planet.', Mercury: 'Mercury is the first planet from the Sun and the smallest in the Solar System.', Planet: 'A planet is a large, rounded astronomical body that orbits a star.', Sun: 'The Sun is the star at the centre of the Solar System.' };
T('3: "the second planet from the sun" resolves to the entity a source sentence verbatim names as it; a different ordinal never matches', async () => {
  const x = await ask(SOL, 'What is the second planet from the sun?'); const rp = replyOf(x);
  expect(x.m && x.m.kind === 'research_answer' && x.m.source === 'Venus', 'source ' + (x.m && x.m.source) + ' | ' + rp); expect(/Venus is the second planet from the Sun/.test(rp) && !/Mercury/.test(rp) && !/Unsupported/.test(rp), rp);
  expect(x.rt && x.rt.resolved_entity && /venus/i.test(x.rt.resolved_entity), 'trace resolved entity ' + JSON.stringify(x.rt && x.rt.resolved_entity)); });
T('3: a superlative description resolves the same way ("the largest moon of <planet>")', async () => {
  const pages = { Titan: 'Titan is the largest moon of Saturn and the second-largest in the Solar System.', 'Moons of Saturn': 'The moons of Saturn are numerous and diverse.', Saturn: 'Saturn is the sixth planet from the Sun.' };
  const x = await ask(pages, 'What is the largest moon of Saturn?'); const rp = replyOf(x); expect(x.m && x.m.kind === 'research_answer' && x.m.source === 'Titan', 'source ' + (x.m && x.m.source) + ' | ' + rp); });
T('3: a description no source states is not resolved (no guess): subject mismatch, not a near ordinal', async () => {
  const x = await ask({ Mercury: SOL.Mercury, Planet: SOL.Planet }, 'What is the second planet from the sun?'); expect(x.m && x.m.kind === 'tool_failed', 'kind ' + (x.m && x.m.kind) + ' | ' + replyOf(x)); });

/* ---------------- 4. acronym that spells a pronoun ---------------- */
T('4: "What does the US Senate do?" is a public lookup (research starts), not a request to supply a role', async () => {
  const pages = { 'United States Senate': 'The United States Senate is the upper chamber of the United States Congress.', 'United States': 'The United States is a country primarily located in North America.' };
  const x = await ask(pages, 'What does the US Senate do?', { 'US Senate': 'United States Senate' });
  expect(x.r.trace.tool_request && /research\.web/.test(JSON.stringify(x.r.trace.tool_request)), 'no research: ' + (x.r.reply || x.r.text)); expect(!/Please tell me the role/.test(x.r.reply || x.r.text || ''), x.r.reply);
  expect(x.m && x.m.source === 'United States Senate', 'source ' + (x.m && x.m.source) + ' | ' + replyOf(x)); });

/* ---------------- 5. research trace ---------------- */
const traceOk = rt => rt && rt.schema === 'FORGE-RESEARCH-TRACE/v1' && typeof rt.subject === 'string' && 'juris' in rt && Array.isArray(rt.candidates) && rt.candidates.every(c => c.title && /^(accepted|rejected)$/.test(c.status) && (c.status === 'accepted' || c.reason));
T('5: an answered research turn records subject, jurisdiction, every candidate with its status and each rejection reason', async () => {
  const x = await ask(FR, 'What does the French Navy do?'); expect(traceOk(x.rt), JSON.stringify(x.rt || null).slice(0, 400)); expect(x.rt.subject === 'french navy' && x.rt.juris === 'france', 'subject/juris ' + x.rt.subject + '/' + x.rt.juris);
  const fr = x.rt.candidates.find(c => c.title === 'France'); expect(fr && fr.status === 'rejected' && /SUBJECT_MISMATCH/.test(fr.reason), 'France candidate ' + JSON.stringify(fr)); expect(x.rt.candidates.some(c => c.title === 'French Navy' && c.status === 'accepted'), 'accepted missing'); });
T('5: a SUBJECT_MISMATCH failure records the same trace', async () => { const x = await ask({ France: FR.France }, 'What does the French Navy do?'); expect(x.m && x.m.kind === 'tool_failed' && traceOk(x.rt) && x.rt.candidates.length >= 1 && x.rt.candidates.every(c => c.status === 'rejected'), JSON.stringify(x.rt || null).slice(0, 300)); });
T('5: a network failure records the subject and jurisdiction with no candidates', async () => {
  const f = FK.ForgeKernel({ clock, lexicon: LEX, store: mkStore(), vaultIterations: 1000, fetch: async u => ({ ok: false, status: 503, url: String(u), headers: { get: () => '' }, text: async () => '', json: async () => ({}) }) }); await f.vault.setup('correct horse'); await f.vault.unlock('correct horse');
  const r = f.process('What does the French Navy do?'); const t = await r.toolJob; const rt = t && t.trace && t.trace.research; expect(traceOk(rt) && rt.subject === 'french navy' && rt.candidates.length === 0, JSON.stringify(rt || null)); });

/* ---------------- 7. units ---------------- */
const CR = r => r && r.trace && r.trace.msm && r.trace.msm.meaning && r.trace.msm.meaning.causal;
T('7: the rate solver converts exactly when the gallon is qualified (litres − US gallons)', () => {
  const r = K().process('A tank contains 100 liters. A pump removes 2 US gallons each minute for 3 minutes. How much remains?'); const rp = r.reply || r.text;
  expect(!/no conversion/.test(rp) && /77\.287529296 liters/.test(rp), rp); const c = CR(r); expect(!c || c.status === 'conditionally_predicted', JSON.stringify(c)); });
T('7: an unqualified gallon that would need converting is refused as ambiguous (US or imperial), with no number', () => {
  const r = K().process('A tank contains 100 liters. A pump removes 2 gallons each minute for 3 minutes. How much remains?'); const rp = r.reply || r.text;
  expect(!/= \d/.test(rp) && /imperial/.test(rp) && /US/.test(rp), rp); const c = CR(r); expect(!c || c.status === 'unsupported', JSON.stringify(c)); });
T('7: gallons alone need no conversion and still compute', () => { const r = K().process('A tank contains 100 gallons. A pump removes 10 gallons each minute for 3 minutes. How much remains?'); expect(/= 70 gallons\./.test(r.reply), r.reply); });
T('7: convert refuses or asks about an unqualified gallon instead of assuming the US gallon', () => { const r = K().process('convert 10 gallons to liters'); const rp = r.reply || r.text; expect(!/37\.85/.test(rp) && /imperial/.test(rp), rp); });
T('7: convert computes exactly for a qualified gallon', () => { const a = K().process('convert 10 US gallons to liters'), b = K().process('convert 10 imperial gallons to liters'); expect(/37\.85411784/.test(a.reply), a.reply); expect(/45\.4609/.test(b.reply), b.reply); });

/* ---------------- 8. minor items ---------------- */
T('8: a repo migration revokes the contributor insert on kb.contributions (file only; not applied by the release)', () => { const dir = path.join(ROOT, '..', 'supabase', 'migrations'); const hit = fs.readdirSync(dir).map(f => fs.readFileSync(path.join(dir, f), 'utf8')).some(s => /revoke\s+insert[^;]*on\s+kb\.contributions\s+from\s+authenticated/i.test(s) && /drop\s+policy[^;]*contrib_insert/i.test(s)); expect(hit, 'no revoking migration'); });
T('8: tools/build_registry.py no longer names "ChristPing"', () => { expect(!/christ/i.test(fs.readFileSync(path.join(ROOT, 'tools', 'build_registry.py'), 'utf8')), 'still present'); });
T('8: χ is the "correction function" in code-facing labels and comments (never "correction operator")', () => { const files = fs.readdirSync(path.join(ROOT, 'src')).filter(f => /\.js$/.test(f)); const bad = files.filter(f => /correction operator/i.test(fs.readFileSync(path.join(ROOT, 'src', f), 'utf8'))); expect(!bad.length, 'still "correction operator" in ' + bad.join(', ')); expect(/correction function/.test(fs.readFileSync(path.join(ROOT, 'src', 'lexicon.js'), 'utf8')), 'lexicon χ label'); });

/* ---------------- 6. held-out relocation (statics) ---------------- */
T('6: no plain-text held-out set or mutation base sentences in the repo (digests and scores only)', () => {
  expect(!fs.existsSync(path.join(__dirname, 'heldout', 'HELDOUT_DO_NOT_TUNE.json')), 'plain-text held-out file still in the repo');
  const ms = fs.readFileSync(path.join(__dirname, 'mutation_suite.js'), 'utf8'); expect(!/turns:\s*\[\s*'/.test(ms), 'mutation base sentences still in mutation_suite.js');
  const rec = path.join(__dirname, 'heldout', 'heldout_record.json'); expect(fs.existsSync(rec), 'no held-out record'); expect(!/"turns"/.test(fs.readFileSync(rec, 'utf8')), 'record holds case text'); });
T('6: the held-out baseline protects the current score (≥ 48 of 54 passed ids)', () => { const b = JSON.parse(fs.readFileSync(path.join(__dirname, 'eval_baseline.json'), 'utf8')); expect(b.heldout && b.heldout.passed_ids.length >= 48, 'baseline ' + (b.heldout && b.heldout.passed_ids.length)); });

(async () => { for (const t of tests) { let ok = false, why = ''; try { const v = await t.fn(); ok = v === undefined || v === true; } catch (e) { why = String(e && e.stack || e).slice(0, 700); } rows.push({ cls: 'R478', name: t.name, ok, why }); } process.stdout.write(JSON.stringify(rows)); })();
