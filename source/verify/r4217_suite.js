/* R4217 (4.9.217): lookup and Echo read the asked relation.
 * 1. Resonance lookup ranks an anchor that DEFINES the asked subject (the subject is the kartṛ of FR.BE.COP with a noun-phrase or
 *    naming predicate, an appositive, or — for an identity question — the asked phrase fills a side of the copula) above an anchor that
 *    merely mentions it; a copular attribution ranks between. Right after trust, in rank_memory and in preselect_pools. General only.
 * 2. Echo re-parses the answer (relation_echo.py: the engine's copular parse and the Pāṇinian kāraka readings) and requires the asked
 *    relation (definition, identity, attribute, cause, quantity, place, time, agent, manner) about the asked subject. Word coverage is
 *    the secondary number; thresholds stay 0.85 (speech) and 0.97 (writes). The math Echo and the remembered-fact Echo keep working.
 * 3. A decimal phase is kept on the 40° dial (RSOC Axiom 2) instead of being floored; integer packets read exactly as before.
 * 4. DRIFT-SPEC/v1 D3 resolved: the Ask candidate ε stays /3 (canonical, the nine-phase / 144 triad scale); max(1, depth) is the
 *    write-trace normaliser only. No LLM, no network. */
const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const ROOT = path.join(__dirname, '..');
const tests = [];
const T = (name, fn) => tests.push({ name, fn });
const expect = (c, why) => { if (!c) throw new Error(why || 'expectation failed'); };
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
const py = args => JSON.parse(cp.execFileSync(process.env.PYTHON || 'python3', args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 26 }).trim().split('\n').pop());
let C = null;
const chk = () => (C = C || py(['tools/check_217.py']));
const pair = (q, a) => chk().pairs.find(p => p.q === q && p.a.startsWith(a));
function same(a, b, at) {
  if (typeof a === 'number' && typeof b === 'number') { if (Math.abs(a - b) > 1e-9) throw new Error(at + ' ' + a + ' vs ' + b); return; }
  if (Array.isArray(a) && Array.isArray(b)) { if (a.length !== b.length) throw new Error(at + ' length'); a.forEach((x, i) => same(x, b[i], at + '[' + i + ']')); return; }
  if (a && b && typeof a === 'object' && typeof b === 'object') { const ks = [...new Set(Object.keys(a).concat(Object.keys(b)))].filter(k => a[k] !== undefined || b[k] !== undefined); for (const k of ks) { if (a[k] === undefined || b[k] === undefined) throw new Error(at + '.' + k + ' missing'); same(a[k], b[k], at + '.' + k); } return; }
  if (a !== b) throw new Error(at + ' ' + JSON.stringify(a) + ' vs ' + JSON.stringify(b));
}

T('the lookup ranks the anchor that defines the asked subject first: "What is DNA?" is answered by the definition, not by a mention', () => {
  const d = chk().dna;
  expect(d.product_reply && /^DNA, or deoxyribonucleic acid, is the hereditary material/.test(d.reply) && d.echo >= 0.85 && d.relation.asked === 'definition' && d.relation.realised === true && d.relation.define_rank === 2, JSON.stringify(d).slice(0, 500));
  const rr = read('engine/rmc_engine_v1/resonance_recall.py'), core = read('engine/rmc_engine_v1/rmc_core.py');
  /* 4.9.238: concept hits rank the named subject concept (specific) before grace; see CONFLICTS v4.9.238 */
  expect(/role_locks\.sort\(key=lambda row: \(_trusted\(row\[0\]\), _defines\(row\[0\]\), _resonance\(row\[2\]\)(, _band_key\(_band\(row\[0\]\)\[\"weight\"\]\))?\)/.test(rr) && /return \(_trusted\(row\[0\]\), _defines\(row\[0\]\), specific, _resonance\(row\[2\]\), _band_key\(_band\(row\[0\]\)\[\"weight\"\]\)\)/.test(rr), 'rank_memory: trust, defines, grace');
  expect(/hits\.sort\(key=lambda h: \(-h\[0\]\[0\], -h\[0\]\[2\], -h\[0\]\[1\], h\[1\]\)\)/.test(core) && /_define_rank\(ask_rel/.test(core), 'preselect_pools: trust, defines, specific, id');
  expect(/"uses_token_overlap": False/.test(rr) && !/question_meaning|_tokens\(/.test(read('engine/rmc_engine_v1/relation_echo.py')), 'no token-overlap rank');
});
T('"What is the Moon?" is held while the anchors only mention the Moon, and admitted when a definitional anchor exists', () => {
  const m = chk().moon, md = chk().moon_def;
  expect(!m.product_reply && m.reply === null && /^The Moon, on the other hand/.test(m.said) && m.relation.asked === 'definition' && m.relation.realised === false && m.echo < 0.85, JSON.stringify(m).slice(0, 400));
  expect(md.product_reply && md.reply === "The Moon is Earth's only natural satellite." && md.relation.define_rank === 2 && md.calls_llm === false, JSON.stringify(md).slice(0, 400));
});
T('"What is Burkina Faso?" is held on the capital sentence (it defines the capital, not the country) and admitted with a definitional anchor; the capital question is unchanged', () => {
  const b = chk().burkina, bd = chk().burkina_def, c = chk().burkina_capital, cd = chk().burkina_capital_def;
  expect(!b.product_reply && b.reply === null, JSON.stringify(b).slice(0, 300));
  expect(bd.product_reply && bd.reply === 'Burkina Faso is a landlocked country in West Africa.' && bd.relation.realised === true, JSON.stringify(bd).slice(0, 300));
  expect(c.product_reply && c.reply === 'Ouagadougou is the capital of Burkina Faso.' && cd.reply === c.reply && c.relation.asked === 'identify' && c.relation.role === 'karma', JSON.stringify(c).slice(0, 300));
  expect(!pair('What is Burkina Faso?', 'Ouagadougou').echo.pass, 'mention');
});
T('Echo re-parses the asked relation about the asked subject; overlap alone never passes a sentence that does not realise it', () => {
  const ok = [['What is DNA?', 'DNA, or'], ['What is the capital of Burkina Faso?', 'Ouagadougou'], ['Why is the sky blue?', 'Even though'], ['Why is the ocean salty?', 'Salt in the ocean'],
    ['What color is my car?', 'My car is red'], ['What is the largest planet?', 'Jupiter'], ['Who painted the Mona Lisa?', 'The Mona Lisa was painted'], ['Where is Mount Everest?', 'Mount Everest lies'],
    ['What is a volcano?', 'A volcano is an opening'], ['What is rust?', 'Rust is called'], ['What is Saturn?', 'Saturn, the sixth planet'], ['What is my name?', 'My name is Nic']];
  for (const [q, a] of ok) { const p = pair(q, a); expect(p && p.reparse.realised === true && p.echo.pass === true && p.echo.relation.realised === true, q + ' ' + JSON.stringify(p && p.echo).slice(0, 300)); }
  const no = [['What is the Moon?', 'The Moon, on the other'], ['What is DNA?', 'Most DNA'], ['What is Burkina Faso?', 'Ouagadougou'], ['Why is the ocean salty?', 'One of the most'], ['What color is my car?', 'My car is fast'],
    ['What is helium?', 'Only a few'], ['What is gravity?', 'Its gravity'], ['What is a magnet?', 'A magnet is not'], ['Who painted the Mona Lisa?', 'The Mona Lisa hangs'], ['When did World War II end?', 'World War II involved'],
    ['How hot is the sun?', 'The Sun is very hot'], ['What is quartz?', 'Quartz is being']];
  for (const [q, a] of no) { const p = pair(q, a); expect(p && p.reparse.realised === false && p.echo.pass === false && p.echo.score <= 0.5 && p.echo.relation.realised === false, q + ' ' + JSON.stringify(p && p.echo).slice(0, 300)); }
  const mars = pair('And what about Mars?', 'Mars'); expect(mars.reparse.realised === null && mars.echo.pass === true && !mars.echo.relation, 'an unclassified question keeps the coverage rule');
  for (const p of chk().pairs) expect(p.echo.pass === (p.echo.score >= 0.85) && (p.reparse.realised !== false || p.echo.score <= 0.5), 'the 0.85 line is unchanged; a relation that is not realised caps the score at 0.5');
});
T('thresholds are unchanged: 0.85 to speak, 0.97 to write; the math Echo and the remembered-fact Echo keep working', () => {
  expect(chk().thresholds.echo_min === 0.85, 'speech');
  for (const k of ['dna', 'sky', 'ocean', 'car', 'math', 'burkina_capital']) expect(chk()[k].write_echo_min === 0.97, k + ' write');
  const m = chk().math; expect(m.product_reply && m.reply === '17 times 23 is 391.' && m.echo_method === 'computed_quantity_reparse', JSON.stringify(m).slice(0, 300));
  const c = chk().car; expect(c.product_reply && c.reply === 'My car is red.' && c.relation.asked === 'attribute' && c.relation.realised === true, JSON.stringify(c).slice(0, 300));
  expect(!chk().car_wrong.product_reply, 'a wrong value is still held');
  const s = chk().sky, o = chk().ocean; expect(s.product_reply && s.relation.asked === 'cause' && s.relation.stated === true && o.product_reply && /^Salt in the ocean/.test(o.reply), 'cause');
});
T('the renderer card and the engine read the relation alike (src/relation_echo.js is the copy of relation_echo.py)', () => {
  const R = require(path.join(ROOT, 'src', 'rmc_renderer_200.js'));
  for (const p of chk().pairs) same(R.run({ op: 'render', question: p.q, candidate: p.a, charge: 0.55, drift: 0.2, chi: 0 }).echo, p.renderer_echo, p.q + ' / ' + p.a.slice(0, 30));
  const RE = require(path.join(ROOT, 'src', 'relation_echo.js'));
  for (const [q, a] of Object.entries(chk().asked)) { const j = RE.asked(q, null); if (a.relation !== 'attribute') { expect(j.relation === a.relation && j.subject.join(' ') === a.subject.join(' ') && j.head === a.head, q + ' ' + JSON.stringify([j, a])); } }
  expect(/<script src="src\/relation_echo\.js"><\/script><script src="src\/rmc_renderer_200\.js">/.test(read('index.html')) && read('sw.js').indexOf("'./src/relation_echo.js'") >= 0, 'shipped');
  const app = read('src/app.js'); expect(/data-echo-relation=/.test(app) && /forge\.parseRenderedClause\(row\.reply\)/.test(app) && /never admits or holds/.test(app), 'the card shows the relation and the Pāṇini re-parse as evidence only');
});
T('a decimal phase is kept on the 40° dial and tunes inside its band; integer phases read as before', () => {
  const p = chk().phase;
  expect(p.int4 === 4 && p.float40 === 4 && p.float49 === 4.9 && p.str45 === 4.5 && p.bad0 === null && p.bad10 === null && p.bool === null, JSON.stringify(p));
  expect(Math.abs(p.d_4_45 - Math.PI / 9) < 1e-6 && Math.abs(p.d_4_56 - 1.6 * 2 * Math.PI / 9) < 1e-6 && p.aligned_4_45 && !p.aligned_4_56 && p.aligned_4_5, 'continuous gap, π/4 window');
  expect(Math.abs(p.grace_45.grace - Math.cos(Math.PI / 9) ** 2) < 1e-6 && Math.abs(p.grace_5.grace - Math.cos(2 * Math.PI / 9) ** 2) < 1e-6 && p.grace_49_vs_4.phi === 4.9, JSON.stringify([p.grace_45, p.grace_5, p.grace_49_vs_4]));
  expect(p.placed.Phi === 4.5 && p.placed_int.Phi === 4, 'placement keeps the decimal');
});
T('DRIFT-SPEC/v1 D3 resolved: the Ask candidate ε stays /3 (canonical, nine-phase / 144 triads); max(1, depth) is the write-trace normaliser only', () => {
  expect(/epsilon_s = round\(\(sigma_res \+ d_score \+ delta_phi\) \/ 3\.0, 4\)/.test(read('engine/rmc_engine_v1/drift_engine.py')), 'candidate /3 unchanged');
  const dp = read('engine/rmc_engine_v1/drift_policy.py'); expect(/WRITE-TRACE eps/.test(dp) && /stays \/3/.test(dp) && /nine-phase/.test(dp), 'drift_policy docstring');
  expect(/"DENOMINATOR": "max1_depth"/.test(read('engine/rmc_engine_v1/mobile_config.py')) && /write-trace normaliser only/.test(read('engine/rmc_engine_v1/mobile_config.py')), 'mobile_config note');
  const conf = read('CONFLICTS.md'); const i = conf.indexOf('## v4.9.217'); const e = conf.slice(i, i + 6000); /* 4.9.219 (4.9.221, 4.9.222, 4.9.223, 4.9.230, 4.9.231, 4.9.232, 4.9.233, 4.9.234, 4.9.235, 4.9.236, 4.9.237, 4.9.238, 4.9.239, 4.9.240, 4.9.242, 4.9.243, 4.9.244, 4.9.245: one more each): later entries sit above; the 4.9.217 entry stays near the top */ expect(i >= 0 && (conf.slice(0, i).match(/^## v/gm) || []).length <= 22 && /\/3 is canonical/.test(e) && /nine-phase/.test(e), 'CONFLICTS entry at the top');
});
T('the cold 60 for 4.9.217 is recorded (not tuned) with zero false admits', () => {
  const c = JSON.parse(read('data/cold_217_results.json'));
  expect(/^4\.9\.217$/.test(c.release) && c.tuned === false && c.of === 60 && c.false_admits === 0 && c.calls_llm === false && c.admitted + c.held === 60, JSON.stringify({ a: c.admitted, h: c.held, f: c.false_admits }));
});
T('version registry names 4.9.217', () => {
  expect(/^4\.9\.(21[7-9]|2[2-9]\d)$/.test(read('VERSION').trim()), 'VERSION');
  expect(JSON.stringify(JSON.parse(read('data/feature_registry.json'))).indexOf('R4217-') >= 0, 'registry');
});
(async () => {
  const rows = []; let failed = 0;
  for (const t of tests) {
    try { await t.fn(); rows.push({ cls: 'R4217', name: t.name, ok: true }); }
    catch (e) { failed++; rows.push({ cls: 'R4217', name: t.name, ok: false, why: String(e && e.message || e).slice(0, 900) }); }
  }
  console.log(JSON.stringify(rows, null, 1));
  process.exit(failed ? 1 : 0);
})();
