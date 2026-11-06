/* R4221 (4.9.221): meaning ids, advisory only (Nic 2026-11-04, t136u "That sounds right").
 * 1. A curated concept -> meaning table ships in the app (data/concept_senses.json): Open English WordNet 2025 plus sense
 *    ids (CC BY 4.0, attributed), ILI ids, Wikidata QIDs as links only. Every existing concept is PINNED to the meaning it
 *    has today; pinning never changes its phase or band.
 * 2. The homograph sense pack is lazy-loaded from the forge-ref Storage bucket, pinned by SHA-256 like forge-libs.
 * 3. The shadow sense trace (src/senses.js; Python mirror tools/sense_trace.py, in parity) is logged in memory only. No
 *    gate, recall or answer reads it; Lesk overlap is logged as a hint and never decides; an ambiguous new word is would_ask.
 * 4. Trusted list: Britannica off; OpenStax only for its CC BY editions (paths_allow), label fixed. Python and JS agree.
 * 5. Athena's dry-run computes the gap (ALREADY-ANCHORED subjects are skipped) instead of forcing it.
 * 6. Cold 60 recorded and identical to 4.9.220. No kb.anchors schema change. No LLM, no embeddings, no network in tests. */
const fs = require('fs');
const os = require('os');
const path = require('path');
const zlib = require('zlib');
const cp = require('child_process');
const crypto = require('crypto');
const ROOT = path.join(__dirname, '..');
const tests = [];
const T = (name, fn) => tests.push({ name, fn });
const expect = (c, why) => { if (!c) throw new Error(why || 'expectation failed'); };
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
const K = require(path.join(ROOT, 'src/senses.js'));
const table = JSON.parse(read('data/concept_senses.json'));
/* a tiny pack in the shipped format (fields synset, lexfile index, proper, ili, qid, gloss) */
const LEX = ['noun.animal', 'noun.artifact', 'noun.object', 'noun.person', 'noun.substance'];
const MINI = { schema: 'FORGE-SENSE-PACK/v1', lexfiles: LEX, count: 3, lemmas: {
  mercury: [['09585833-n', 3, 1, 'i1', 'Q1150', '(Roman mythology) messenger of Jupiter and god of commerce'], ['09374305-n', 2, 1, 'i85769', 'Q308', 'the smallest planet and the nearest to the sun'], ['14669524-n', 4, 0, 'i113966', 'Q925', 'a heavy silvery toxic metallic element that is liquid']],
  bat: [['02142775-n', 0, 0, '', '', 'nocturnal mouselike mammal with forelimbs modified to form membranous wings'], ['02810560-n', 1, 0, '', '', 'a club used for hitting a ball in various games']],
  saturn: [['09380050-n', 2, 1, '', 'Q193', 'a giant planet that is surrounded by rings'], ['09590979-n', 3, 1, '', 'Q47652', '(Roman mythology) god of agriculture and vegetation']] } };

T('the curated table pins every existing concept to one meaning, attributed, Wikidata as a link only', () => {
  expect(table.schema === 'FORGE-CONCEPT-SENSES/v1' && table.mode === 'advisory' && /pinned/.test(table.rule) && /never changes its phase or band/.test(table.rule), 'schema/rule');
  expect(/CC BY 4\.0/.test(table.source.licence) && /Open English WordNet 2025/.test(table.source.attribution) && /link/.test(table.source.wikidata), 'attribution');
  const ac = JSON.parse(read('engine/rmc_engine_v1/anchor_concepts.json')).concepts;
  const cl = JSON.parse(read('engine/rmc_engine_v1/concept_lexicon.json')).surfaces;
  for (const [w, c] of Object.entries(ac)) expect(table.concepts[c] && table.concepts[c].pinned === true && table.surfaces[w].some(x => x[0] === c), 'anchor concept ' + w + ' ' + c);
  for (const [w, c] of Object.entries(cl)) expect(table.concepts[c] && table.surfaces[w].some(x => x[0] === c), 'lexicon surface ' + w);
  for (const r of Object.values(table.concepts)) if (r.sense) expect(table.senses[r.sense], 'sense row ' + r.sense);
  for (const s of Object.values(table.senses)) expect(s[2] === '' || /^Q\d+$/.test(s[2]), 'qid ' + s[2]);
  const pin = (c, sid, q) => { const r = table.concepts[c]; expect(r && r.sense === sid && (!q || table.senses[sid][2] === q), c + ' ' + JSON.stringify(r)); };
  pin('A.SUN', '09473312-n', 'Q525'); pin('A.EARTH', '09293800-n', 'Q2'); pin('A.JUPITER', '09345360-n', 'Q319');
  pin('A.GEORGIA', '09041218-n', 'Q230'); pin('A.TURKEY', table.concepts['A.TURKEY'].sense); expect(table.senses[table.concepts['A.TURKEY'].sense][0] === 'noun.location', 'Turkey is the country');
  expect(table.concepts['A.HAMLET'].sense === null && /play/.test(table.concepts['A.HAMLET'].review), 'no sense is guessed for Hamlet');
  expect(table.counts.concepts === Object.keys(table.concepts).length && table.counts.with_sense === Object.values(table.concepts).filter(r => r.sense).length, 'counts');
});
T('the trace pins known concepts, resolves only by capitalisation, and logs anything else as would_ask', () => {
  const t = K.trace('Is Mercury hotter than the sun?', table, MINI);
  const m = t.entries.find(e => e.w === 'mercury'), s = t.entries.find(e => e.w === 'sun');
  expect(m.state === 'would_ask' && m.n === 3, 'two proper senses: ask ' + JSON.stringify(m));
  expect(m.lesk === '09374305-n', 'Lesk hint is logged (planet) ' + m.lesk);
  expect(s.state === 'pinned' && s.concepts.includes('A.SUN') && s.senses.includes('09473312-n'), 'sun pinned');
  const b = K.trace('The Bats flew. a bat hit the ball', table, MINI).entries.filter(e => e.w.startsWith('bat'));
  expect(b.length === 2 && b.every(e => e.state === 'would_ask'), 'bat: two categories, lower case, ask ' + JSON.stringify(b));
  const sat = K.trace('Is Saturn a giant planet with rings?', table, { lexfiles: LEX, lemmas: { saturn: [MINI.lemmas.saturn[0]] } }).entries.find(e => e.w === 'saturn');
  expect(sat.state === 'resolved' && sat.by === 'capitalisation' && sat.sense === '09380050-n', 'one proper sense ' + JSON.stringify(sat));
  const low = K.trace('Liquid Metal: the mercury rose', table, { lexfiles: LEX, lemmas: { mercury: MINI.lemmas.mercury } }).entries.find(e => e.w === 'mercury');
  expect(low.state === 'resolved' && low.by === 'lowercase' && low.sense === '14669524-n', 'lower case, one common category ' + JSON.stringify(low));
  const noPack = K.trace('What is Mercury?', table, null);
  expect(noPack.pack === false && noPack.counts.would_ask === 0 && noPack.counts.plain === 1, 'without the pack nothing is guessed');
  expect(K.trace('What is the capital of Burkina Faso?', table, null).entries.some(e => e.w === 'burkina faso' && e.state === 'pinned' && e.concepts.includes('A.BURKINAFASO')), 'compound name pinned');
});
T('Lesk never decides: the state is the same with the hint removed', () => {
  const src = read('src/senses.js');
  const body = src.match(/function trace\(text, table, pack\) \{[\s\S]*?\n\}/)[0];
  const stateLines = body.split('\n').filter(l => /state: '/.test(l));
  expect(stateLines.length >= 3 && stateLines.every(l => !/lesk\(/.test(l)), 'state never computed from lesk');
  expect(/e\.lesk = lesk\(/.test(body), 'lesk only stored as e.lesk');
  expect(!/\.lesk/.test(src.replace(body, '')), 'nothing else reads e.lesk');
});
T('JS and Python traces are identical (same table, same pack, same texts)', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'r4221-'));
  const pack = path.join(dir, 'mini.json.gz'); fs.writeFileSync(pack, zlib.gzipSync(JSON.stringify(MINI)));
  const texts = path.join(dir, 'texts.json');
  const extra = JSON.parse(read('data/cold_221_results.json')).rows.map(r => r.question);
  fs.writeFileSync(texts, JSON.stringify(['Is Mercury hotter than the sun?', 'The Bats flew. a bat hit the ball', 'mercury', "Mercury's orbit; Saturn's rings", 'Mr. Jordan went "home"; Georgia!', 'What is the capital of Burkina Faso?'].concat(extra)));
  const out = JSON.parse(cp.execFileSync('node', [path.join(ROOT, 'tools/parity_221_senses.js'), pack, texts], { encoding: 'utf8' }));
  expect(out.ok && out.cases === 66 && out.mismatches === 0, JSON.stringify(out));
});
T('the sense pack is pinned by SHA-256 in the forge-ref bucket and checked before use; nothing is stored', () => {
  const p = K.FORGE_REF.pack;
  expect(K.FORGE_REF.cache === 'forge-ref-v1' && /^https:\/\/hqcvywujrygbnaowgwln\.supabase\.co\/storage\/v1\/object\/public\/forge-ref\//.test(p.url) && p.url.endsWith(p.file), 'url ' + p.url);
  expect(/^[0-9a-f]{64}$/.test(p.sha256) && p.file.indexOf(p.sha256.slice(0, 12)) > 0 && p.bytes > 100000 && p.licence === 'CC BY 4.0', 'pin');
  expect(p.integrity === 'sha256-' + Buffer.from(p.sha256, 'hex').toString('base64'), 'integrity = sha256');
  const src = read('src/senses.js');
  expect(/credentials: 'omit'/.test(src) && /integrity: p\.integrity/.test(src) && /forge_ref_sha256_mismatch/.test(src) && /cache\.delete\(p\.url\)/.test(src), 'checked before use');
  expect(!/localStorage|sessionStorage|indexedDB|\/rest\/v1|\/rpc\/|method: 'POST'|apikey|service_role/i.test(src), 'no storage, no Supabase writes, no keys');
});
T('advisory only: Ask calls the trace after rendering, never awaits it, and no gate or recall reads it', () => {
  const app = read('src/app.js');
  expect(/renderRmc\(q?text, row\);\n  \/\* 4\.9\.221[^\n]*\n  if \(window\.KSenses && KSenses\.note\) \{ try \{ KSenses\.note\(q?text\); \}/.test(app), 'after render, not awaited');
  expect(!/await KSenses\.note|row\.sense|sense_trace/.test(app), 'not on the row');  /* 4.9.226: the trace stays advisory; the follow-up ask awaits KSenses.ensure() after the card is shown */
  for (const f of fs.readdirSync(path.join(ROOT, 'src'))) if (f.endsWith('.js') && f !== 'senses.js' && f !== 'app.js') expect(!/KSenses|concept_senses/.test(read('src/' + f)), 'src/' + f);
  for (const f of fs.readdirSync(path.join(ROOT, 'engine/rmc_engine_v1'))) if (f.endsWith('.py')) expect(!/concept_senses|sense_trace|forge-ref/.test(read('engine/rmc_engine_v1/' + f)), f);
  expect(/src\/senses\.js/.test(read('index.html')) && /'\.\/src\/senses\.js', '\.\/data\/concept_senses\.json'/.test(read('sw.js')) && /'data\/concept_senses\.json'/.test(read('tools/shipset.js')), 'shipped');
  expect(!fs.readdirSync(path.join(ROOT, '..', 'supabase', 'migrations')).some(f => /sense/i.test(f)), 'no sense_id migration');
});
T('trusted list: Britannica off, OpenStax only for its CC BY editions, Python and JS agree', () => {
  const cfg = JSON.parse(read('engine/rmc_engine_v1/reference/trusted_sources_202.json'));
  expect(!cfg.sources.some(s => /britannica/.test(s.host)), 'britannica');
  const o = cfg.sources.find(s => s.host === 'openstax.org');
  expect(o && o.license !== 'CC BY 4.0' && /NC-SA/.test(o.license_note) && o.paths_allow.includes('/books/astronomy/') && !o.paths_allow.some(p => /-2e\/|-3e\/|university-physics/.test(p) && !/american-government|economics|sociology|macro|micro/.test(p)), 'openstax');
  const S = require(path.join(ROOT, 'src/self_seed_202.js'));
  const urls = ['https://openstax.org/books/astronomy/pages/1-introduction', 'https://openstax.org/books/astronomy-2e/pages/1-introduction', 'https://openstax.org/books/biology-2e/pages/2-1', 'https://www.britannica.com/place/Burkina-Faso', 'https://www.nasa.gov/moon', 'https://openstax.org/'];
  const js = urls.map(u => !!S.sourceFor(u));
  const py = JSON.parse(cp.execFileSync('python3', ['-c', 'import sys,json; sys.path.insert(0,"engine"); from rmc_engine_v1 import self_seed_202 as s; print(json.dumps([bool(s.source_for(u)) for u in json.loads(sys.argv[1])]))', JSON.stringify(urls)], { cwd: ROOT, encoding: 'utf8' }));
  expect(JSON.stringify(js) === JSON.stringify(py) && JSON.stringify(js) === JSON.stringify([true, false, false, false, true, false]), JSON.stringify({ js, py }));
});
T('the Athena dry-run computes the gap; an anchored subject is skipped, nothing is written', () => {
  const t = read('tools/athena_dryrun_220.py');
  expect(!/"gap": True/.test(t) && /question_concepts\(question, set\(anchored\)\)/.test(t) && /ALREADY-ANCHORED/.test(t), 'computed gap');
  const d = JSON.parse(read('data/athena_dryrun_221.json'));
  const bf = d.find(r => r.question === 'What is the capital of Burkina Faso?');
  expect(bf && bf.rule === 'ALREADY-ANCHORED' && bf.gap === false && bf.docs.length === 0, 'Burkina Faso skipped');
  expect(d.every(r => r.writes === false && r.calls_llm === false), 'no writes');
});
T('what 4.9.221 logs is recorded, and no answer changed', () => {
  const l = JSON.parse(read('data/sense_log_221.json'));
  expect(l.mode === 'advisory' && l.answers_changed === 0 && l.questions.questions === 60 && l.anchors.anchors > 3000, 'log');
  expect(l.questions.with_pinned_meaning > 0 && l.anchors.own_concepts_all_pinned_with_sense > 0, 'counts');
});
T('the cold 60 for 4.9.221 is recorded (not tuned) and identical to 4.9.220', () => {
  const c = JSON.parse(read('data/cold_221_results.json')), p = JSON.parse(read('data/cold_220_results.json'));
  expect(c.release === '4.9.221' && c.tuned === false && c.of === 60 && c.false_admits === 0 && c.admitted === p.admitted, JSON.stringify({ a: c.admitted, f: c.false_admits }));
  expect(JSON.stringify(c.rows) === JSON.stringify(p.rows), 'every row identical to 4.9.220');
});
T('version registry names 4.9.221', () => {
  expect(read('VERSION').trim() === '4.9.245', 'VERSION');
  expect(JSON.stringify(JSON.parse(read('data/feature_registry.json'))).indexOf('R4221-') >= 0, 'registry');
});
(async () => {
  const rows = []; let failed = 0;
  for (const t of tests) {
    try { await t.fn(); rows.push({ cls: 'R4221', name: t.name, ok: true }); }
    catch (e) { failed++; rows.push({ cls: 'R4221', name: t.name, ok: false, why: String(e && e.message || e).slice(0, 900) }); }
  }
  console.log(JSON.stringify(rows, null, 1));
  process.exit(failed ? 1 : 0);
})();
