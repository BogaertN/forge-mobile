/* R4177 (4.9.177): Forge tools that fit the no-LLM learning loop.
 * Phase parse and hosted recall come from BogaertN/forge. Search and read stay on hosted://bank.
 * Shell, patch writes, payments, vector search, and a model call stay refused. */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const KMOD = require(ROOT + '/src/kernel.js');
const LEX = require(ROOT + '/data/lexicon.json');
const EXT = require(ROOT + '/data/lexicon-ext.json');
const FT = require(ROOT + '/src/forge_tools.js');
const PT = require(ROOT + '/src/pipeline_tools.js');
const tests = [];
const T = (name, fn) => tests.push({ name, fn });
const expect = (c, why) => { if (!c) throw new Error(why || 'expectation failed'); };
const CLOCK = () => '2026-10-29T03:20:00Z';
const BULB = 'A bulb produces light by heating a filament';
const DOG = 'A dog is an animal';
const ROWS = [
  { id: 'cs:bulb', text: BULB, sfe: { Phi: 9, eps: 0.08, mu: 1 } },
  { id: 'cs:dog', text: DOG, sfe: { Phi: 5, eps: 0.6, mu: 0 } }
];
const mk = () => KMOD.Kernel({ lexicon: LEX, lexiconExt: EXT, clock: CLOCK, vaultState: () => 'locked' });

T('phase parse matches Forge and the word or inside before is not a polarity hit', () => {
  const naming = FT.parsePhase('before the naming', {}, CLOCK).phase_state;
  expect(naming.phase_primary === 'Φ7' && naming.confidence === 0.555 && naming.phase_path_hypothesis.join(',') === 'Φ7', JSON.stringify(naming));
  expect(naming.phase_candidates[0].evidence.indexOf('sequence_gate:before_naming') !== -1, naming.phase_candidates[0].evidence.join(','));
  const phi2 = naming.phase_candidates.find(c => c.phase === 'Φ2');
  expect(phi2 && phi2.confidence === 0.03 && phi2.evidence.length === 0, JSON.stringify(phi2));
  const drift = FT.parsePhase('the drift is unstable and wrong', {}, CLOCK).phase_state;
  expect(drift.phase_primary === 'Φ5' && drift.confidence === 0.59, JSON.stringify({ p: drift.phase_primary, c: drift.confidence }));
  const correct = FT.parsePhase('correct the drift before naming', {}, CLOCK).phase_state;
  expect(correct.phase_primary === 'Φ6' && correct.confidence === 0.854 && correct.phase_path_hypothesis.join(',') === 'Φ5,Φ6,Φ7', JSON.stringify(correct.phase_path_hypothesis));
  const either = FT.parsePhase('either or mirror', {}, CLOCK).phase_state;
  expect(either.phase_primary === 'Φ2' && either.phase_candidates[0].evidence.indexOf('keyword:or') !== -1, JSON.stringify(either.phase_candidates[0].evidence));
  expect(FT.parsePhase('How does a bulb produce light', {}, CLOCK).calls_llm === false, 'phase calls a model');
});

T('hosted recall ranks the filament sentence and refuses a device path and a vector backend', () => {
  const rec = FT.recallHosted('How does a bulb produce light', ROWS);
  expect(rec.status === 'OK' && rec.calls_llm === false && rec.network === false && rec.device_filesystem === false, JSON.stringify({ status: rec.status, net: rec.network }));
  const nodes = rec.memory_state.active_memory_nodes;
  expect(nodes[0].memory_id === 'cs:bulb' && nodes[0].retrieval_weight === 0.492 && nodes[1].memory_id === 'cs:dog' && nodes[1].retrieval_weight === 0.42, JSON.stringify(nodes.map(n => [n.memory_id, n.retrieval_weight])));
  const overlap = (nodes[0].retrieval_evidence || []).find(e => e.type === 'semantic_overlap');
  expect(overlap && overlap.tokens.indexOf('bulb') !== -1 && overlap.tokens.indexOf('light') !== -1, JSON.stringify(overlap));
  expect((nodes[1].retrieval_evidence || []).every(e => e.type !== 'semantic_overlap'), 'dog overlapped');
  const disk = FT.recallMemory('bulb', { retrieval_backend: 'filesystem' }, { root: '/home/nic/forge', nodes: FT.nodesFromHosted(ROWS) });
  expect(disk.ok === false && disk.rule === 'FORGE-DEVICE-PATH-REFUSED' && disk.memory_state.active_memory_count === 0, JSON.stringify(disk));
  const vector = FT.recallMemory('bulb', { retrieval_backend: 'filesystem', chroma_collection: 'forge_kb' }, { nodes: FT.nodesFromHosted(ROWS) });
  expect(vector.status === 'BLOCKED' && vector.reason_code === 'FROZEN_LEGACY_VECTOR_CONTROL_PROHIBITED' && vector.calls_llm === false, JSON.stringify(vector));
  const model = FT.classifyLlm({ enabled: true, model: 'local' });
  expect(model.status === 'BLOCKED' && model.calls_llm === false && model.reason_code === 'FROZEN_LEGACY_LLM_REQUEST_PROHIBITED', JSON.stringify(model));
});

T('session search stays on the hosted bank and shell, patch, payment, and vector search are refused', () => {
  const tools = FT.sessionTools(ROWS);
  const found = tools.dispatch('search_text', { query: 'filament', path: 'hosted://bank' });
  expect(found.ok === true && /filament/.test(found.data) && found.network === false, found.data);
  const listed = tools.dispatch('list_files', { path: 'hosted://bank', max_depth: 9 });
  expect(listed.ok === true && /cs:bulb\.txt/.test(listed.data) && /cs:dog\.txt/.test(listed.data), listed.data);
  const read = tools.dispatch('read_file', { path: 'hosted://bank/cs:bulb.txt', start_line: 1, end_line: 1 });
  expect(read.ok === true && /heating a filament/.test(read.data), read.data);
  const outside = tools.dispatch('read_file', { path: '/etc/passwd' });
  expect(outside.ok === false && /approved session bank/.test(outside.error) && outside.network === false, JSON.stringify(outside));
  const url = tools.dispatch('search_text', { query: 'filament', path: 'https://example.com/secret' });
  expect(url.ok === false && url.network === false, JSON.stringify(url));
  const climb = tools.dispatch('list_files', { path: 'hosted://bank/../etc' });
  expect(climb.ok === false, JSON.stringify(climb));
  const shell = tools.dispatch('run_safe_command', { command_name: 'free -h' });
  expect(shell.ok === false && shell.rule === 'FORGE-SHELL-REFUSED' && shell.executes_shell === false && shell.executes === false, JSON.stringify(shell));
  const patch = tools.dispatch('write_proposed_patch', { target_file: '/tmp/x' });
  expect(patch.rule === 'FORGE-PATCH-WRITE-REFUSED' && patch.writes_files === false, JSON.stringify(patch));
  const pay = tools.dispatch('payment', {});
  expect(pay.rule === 'FORGE-PAYMENT-DISABLED', JSON.stringify(pay));
  const kb = tools.dispatch('search_knowledge_base', { query: 'bulb' });
  expect(kb.ok === false && kb.status === 'BOUNDARY_BLOCKED_NON_AUTHORITATIVE' && kb.network === false && kb.queries_chroma === false, JSON.stringify({ status: kb.status, net: kb.network }));
  const absent = tools.dispatch('rmc_pipeline_preview', { input_text: 'drift' });
  expect(absent.rule === 'FORGE-RUNTIME-ABSENT' && absent.calls_llm === false, JSON.stringify(absent));
  const phase = tools.dispatch('rmc_phase_parse_preview', { text: 'finish and seal the archive' });
  expect(phase.ok === true && phase.data.phase_state.phase_primary === 'Φ9' && phase.network === false, JSON.stringify(phase.data && phase.data.phase_state && phase.data.phase_state.phase_primary));
  const gov = fs.readFileSync(path.join(ROOT, 'src', 'governance.js'), 'utf8');
  const built = fs.readFileSync(path.join(ROOT, 'src', 'toolbuilder.js'), 'utf8');
  const cat = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'command_catalog.json'), 'utf8'));
  const user = cat.tools.find(t => t.id === 'user.tool');
  expect(/PERM-MARKETPLACE-TRANSFER-NOT-BUILT/.test(gov) && /no network/.test(built) && user && user.network === false, 'user tool or payment');
});

T('a hosted method sentence answers the pipeline without a fetch', async () => {
  const k = mk();
  let fetched = 0;
  const hit = await PT.researchExcerpt('How does a bulb produce light?', {
    bank: ROWS,
    reparse: t => k.reparseClause(t),
    fetch: () => { fetched += 1; throw new Error('fetch'); }
  });
  expect(hit.ok === true && hit.tool === 'recall_memory' && hit.network === false && hit.calls_llm === false && /filament/.test(hit.excerpt || '') && fetched === 0, JSON.stringify({ tool: hit.tool, net: hit.network, excerpt: hit.excerpt, fetched: fetched }));
  expect(hit.measured && hit.measured.calls_llm === false && hit.measured.claim && /filament/.test(hit.measured.claim), JSON.stringify(hit.measured));
  const miss = await PT.researchExcerpt('How does a bulb produce light?', {
    bank: [ROWS[1]],
    reparse: t => k.reparseClause(t),
    fetch: () => { fetched += 1; return Promise.reject(new Error('down')); }
  });
  expect(miss.tool !== 'recall_memory' && fetched === 1 && miss.calls_llm === false, JSON.stringify({ rule: miss.rule, tool: miss.tool, fetched: fetched }));
  const open = await PT.researchExcerpt('https://example.com/crawl', { bank: ROWS, fetch: () => { fetched += 1; } });
  expect(open.ok === false && open.rule === 'RESEARCH-OPEN-CRAWL-REFUSED' && fetched === 1, JSON.stringify(open));
});

T('version registry CONFLICTS NEXT_BUILD name 4.9.177', () => {
  const ver = fs.readFileSync(path.join(ROOT, 'VERSION'), 'utf8').trim();
  expect(ver === '4.9.181', ver);
  const conf = fs.readFileSync(path.join(ROOT, 'CONFLICTS.md'), 'utf8');
  expect(/v4\.9\.177/.test(conf) && /recall_memory/.test(conf) && /Gilligan Codex/.test(conf) && /Athena document/.test(conf), 'CONFLICTS');
  const nb = fs.readFileSync(path.join(ROOT, '..', 'NEXT_BUILD.md'), 'utf8');
  expect(/4\.9\.177/.test(nb) && /Gilligan Codex/.test(nb) && /Athena document/.test(nb), 'NEXT_BUILD');
  const readme = fs.readFileSync(path.join(ROOT, '..', 'README.md'), 'utf8');
  expect(/4\.9\.177/.test(readme) && /hosted/.test(readme) && /recall/.test(readme), 'README');
  const tgt = JSON.parse(fs.readFileSync(path.join(ROOT, 'verify', 'targeted.json'), 'utf8'));
  expect(tgt.release === '4.9.181' && (((tgt.suites[0] === 'r4181_suite.js' || tgt.suites[0] === 'r4180_suite.js') || tgt.suites[0] === 'r4179_suite.js') || tgt.suites[0] === 'r4178_suite.js') || tgt.suites[0] === 'r4177_suite.js' && tgt.suites.includes('r4176_suite.js'), JSON.stringify({ release: tgt.release, head: tgt.suites[0] }));
  const reg = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'feature_registry.json'), 'utf8'));
  expect(reg.version === '4.9.181' && reg.features.some(f => f.id === 'R4177-FORGE-TOOLS'), reg.version);
  expect(reg.count === reg.features.length && reg.count >= 334, 'count ' + reg.count);
  const inv = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'forge_tool_inventory.json'), 'utf8'));
  expect(inv.release === '4.9.177' && inv.tools.length > 700, 'inventory ' + inv.tools.length);
  const row = name => inv.tools.find(t => t.name === name);
  expect(row('recall_memory').status === 'ported' && /memory_recaller\.py/.test(row('recall_memory').path), JSON.stringify(row('recall_memory')));
  expect(row('search_text').status === 'ported' && row('run_safe_command').status === 'skipped', 'dispatcher rows');
  expect(row('search_knowledge_base').status === 'ported' && /Slice 0B/.test(row('search_knowledge_base').reason), row('search_knowledge_base').reason);
  expect(row('duckduckgo').status === 'skipped' && /network/.test(row('duckduckgo').reason), row('duckduckgo').reason);
  expect(inv.tools.filter(t => t.source_repo === 'BogaertN/forge' && t.path === 'config/tool_registry.json').every(t => t.status === 'skipped'), 'registry skipped');
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
  const build = fs.readFileSync(path.join(ROOT, 'build.py'), 'utf8');
  expect(/src="src\/forge_tools\.js"/.test(html) && html.indexOf('src/forge_tools.js') < html.indexOf('src/pipeline_tools.js'), 'script order');
  expect(/\.\/src\/forge_tools\.js/.test(sw), 'service worker');
  expect(/src\/forge_tools\.js/.test(build) && /does not inline/.test(build), 'single file skips the tools');
  const src = fs.readFileSync(path.join(ROOT, 'src', 'forge_tools.js'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  expect(!/ollama|openai|anthropic|llm_renderer|\bchroma(db)?\b/i.test(src), 'banned token');
  expect(!/\bfetch\s*\(/.test(src), 'no fetch');
});

(async () => {
  let failed = 0;
  const rows = [];
  for (const t of tests) {
    try { await t.fn(); rows.push({ cls: 'R4177', name: t.name, ok: true }); }
    catch (e) { failed++; rows.push({ cls: 'R4177', name: t.name, ok: false, why: String(e.message || e).slice(0, 800) }); }
  }
  console.log(JSON.stringify(rows, null, 1));
  process.exit(failed ? 1 : 0);
})();
