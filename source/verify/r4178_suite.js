/* R4178 (4.9.178): Gilligan System Codex engines on the learning loop.
 * Ask evidence is annotated. Athena admits only inside the Codex gates.
 * Gilligan rehearses, archives, and recenters. A later Ask reads the hosted bank.
 * ChristPing stays Gilligan-only and is not deferred. No LLM. Packs stay gated.
 * Pattern Reflection is not this Codex. Token payouts and biometric sensors stay refused. */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const zlib = require('zlib');
const ROOT = path.join(__dirname, '..');
const D = require(ROOT + '/src/dream_idle.js');
const C = require(ROOT + '/src/gilligan_codex.js');
const KMOD = require(ROOT + '/src/kernel.js');
const LEX = require(ROOT + '/data/lexicon.json');
const EXT = require(ROOT + '/data/lexicon-ext.json');
const tests = [];
const T = (name, fn) => tests.push({ name, fn });
const expect = (c, why) => { if (!c) throw new Error(why || 'expectation failed'); };
const CLOCK = () => '2026-10-29T04:10:00Z';
const KEY = 'nic-write-key-ok';
const METHOD = 'A bulb produces light by heating a filament.';
const mkStore = () => { const st = {}; return KMOD.MemoryStore({ get: k => st[k], set: (k, v) => { st[k] = v; } }); };
const mk = () => KMOD.Kernel({ lexicon: LEX, lexiconExt: EXT, clock: CLOCK, vaultState: () => 'locked', store: mkStore() });
const rulesOf = r => (r.trace && r.trace.rules || []).map(x => x.id);
const phoneFacts = k => { const phone = k.store.load('confirmed_shared'); return (phone && phone.facts) || []; };
const verified = (text, integrity) => [{ text: text, verified: true, integrity: integrity, source: 'allow-listed' }];

T('Codex inventory builds the engines and skips money and hardware', () => {
  const rows = C.INVENTORY;
  expect(rows.length >= 60 && rows.every(r => r.section && r.name && (r.status === 'built' || r.status === 'present' || r.status === 'skipped')), 'inventory shape ' + rows.length);
  const skipped = rows.filter(r => r.status === 'skipped');
  expect(skipped.length >= 6 && skipped.every(r => r.why && /money|hardware|speech|graphics|audio/i.test(r.why)), JSON.stringify(skipped));
  expect(skipped.some(r => r.section === '3.12' && /money/i.test(r.why)) && skipped.some(r => r.section === '11.1') && skipped.some(r => r.section === '11.2'), 'token and biometric rows');
  for (const section of ['1.1', '1.2', '1.3', '2.1', '3.2', '3.24', '5.1', '6.1', '9.1', '10.1', '12.2']) {
    expect(rows.some(r => r.section === section && r.status !== 'skipped'), 'missing ' + section);
  }
  const present = rows.filter(r => r.status === 'present');
  expect(present.every(r => fs.existsSync(path.join(ROOT, r.path))), present.map(r => r.path).join(','));
  expect(rows.filter(r => r.status === 'built').every(r => r.path === 'src/gilligan_codex.js'), 'built path');
  const src = fs.readFileSync(path.join(ROOT, 'src', 'gilligan_codex.js'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  expect(!/operator\.js/.test(src) && !/openai|anthropic|ollama/.test(src) && !/\bfetch\s*\(/.test(src) && !/Math\.random|setTimeout|setInterval/.test(src), 'codex stays off Pattern Reflection and models');
  const fresh = C.createCodex({ clock: CLOCK });
  expect(fresh.dashboard().pattern_reflection === false && fresh.manifest().psi_root === 'ψ₁' && fresh.init().echo_confirmed === false && fresh.init().codex_hash === 'GILLIGAN-VOL-IV', JSON.stringify(fresh.manifest()));
});

T('a measured Ask becomes an Athena admit and a later Ask recalls it', () => {
  const k = mk();
  k.clearStarterKnowledge();
  k.setSharedKbWriteKey(KEY);
  const packPath = path.join(ROOT, 'packs', 'confirmed_shared', 'a.json');
  const beforePack = crypto.createHash('sha256').update(fs.readFileSync(packPath)).digest('hex');
  const claim = METHOD.replace(/\.$/, '');
  const bridged = D.bridgeAskEvidence({ question: 'How do lightbulbs work', input: 'How do lightbulbs work', meaning: { kind: 'research_answer', generated: { text: METHOD, drift: 0.08 }, excerpt: METHOD } });
  expect(bridged.ok === true && bridged.gap.codex && bridged.gap.codex.christ_listener === 'armed' && bridged.gap.codex.deferred === false && bridged.gap.codex.calls_llm === false, JSON.stringify(bridged.gap && bridged.gap.codex));
  const w = D.createIdleDream({ clock: CLOCK, host: k, writeKey: KEY, publishPacks: false, research: D.curatedResearch });
  expect(w.codex.init().echo_confirmed === false && w.codex.dashboard().boot_state === 'locked' && w.codex.dashboard().payout === false, JSON.stringify(w.codex.dashboard()));
  w.enqueue([bridged.gap]);
  const step = w.tick({ answering: false });
  expect(step.lane === 'promote_candidate' && step.rule === 'DREAM-BACKEND-FILL' && step.wrote_confirmed_shared === true && step.wrote_pack !== true, JSON.stringify({ lane: step.lane, rule: step.rule, wrote: step.wrote_confirmed_shared, codex: step.codex }));
  expect(step.codex && step.codex.echo_confirmed === true && step.codex.drift_class === 'projectable' && step.codex.christ_deferred === false && step.codex.tone === 'Full / Fluid / Expressive', JSON.stringify(step.codex));
  expect(k.sharedKnowledgeView().count === 1 && phoneFacts(k).length === 0, 'hosted row only');
  const ask = k.process('How do lightbulbs work?');
  expect(ask.trace.echo && ask.trace.echo.pass, 'echo');
  expect(rulesOf(ask).includes('CS-RECALL-MANNER') && !rulesOf(ask).includes('AUTH-AQ1-QUESTION-IS-LOOKUP-REQUEST'), rulesOf(ask).join(','));
  expect(/filament|heating/i.test(ask.reply || '') && /shared knowledge/i.test(ask.reply || ''), ask.reply);
  expect(k.memory().length === 0, 'memory');
  const view = w.custody({ kb_count: k.sharedKnowledgeView().count });
  expect(view.codex && view.codex.echo_confirmed === true && view.codex.engines_built >= 40 && view.codex.christ_listener === 'armed' && view.always_on === true && view.publish_packs === false, JSON.stringify(view.codex));
  expect(crypto.createHash('sha256').update(fs.readFileSync(packPath)).digest('hex') === beforePack, 'letter pack untouched');
  expect(w.codex.stack().long_term.some(row => /filament/i.test(row.text)), 'memory stack kept the loop');
});

T('hard drift arms ChristPing and Athena cannot initiate it', () => {
  const k = mk();
  k.clearStarterKnowledge();
  k.setSharedKbWriteKey(KEY);
  const w = D.createIdleDream({ clock: CLOCK, host: k, writeKey: KEY, publishPacks: false });
  w.enqueue([
    { id: 'gap:bad', kind: 'aq1_miss', claim: 'Phlogiston is a substance', eps: 0.91, integrity: 0.99, ancestors: [{ Phi: 9, eps: 0, mu: 1 }], extracts: verified('Phlogiston is a substance', 0.99) },
    { id: 'gap:next', kind: 'aq1_miss', claim: 'Quartz is a mineral', eps: 0.12, integrity: 0.95, extracts: verified('Quartz is a mineral', 0.95), calls_llm: false }
  ]);
  const hard = w.tick({ answering: false });
  expect(hard.lane === 'hard_reject' && hard.rule === 'GRACE-RECENTER' && hard.christ_ping === true && hard.christ.initiator === 'gilligan', JSON.stringify({ lane: hard.lane, rule: hard.rule }));
  expect(hard.codex && hard.codex.christ_request === true && hard.codex.christ_deferred === false && hard.codex.christ_listener === 'armed' && hard.codex.drift_class === 'hard_stop' && hard.codex.memory_frozen === true, JSON.stringify(hard.codex));
  expect(hard.shared_kb === false && !(k.sharedKnowledgeView().admitted || []).some(x => /phlogiston/i.test(x.text || '')), 'noise stayed out');
  const next = w.tick({ answering: false });
  expect(next.gap_id === 'gap:next' && next.wrote_confirmed_shared === true && next.codex.memory_frozen === false, JSON.stringify({ id: next.gap_id, wrote: next.wrote_confirmed_shared, codex: next.codex }));
  const neo = D.christPing({ initiator: 'neo', eps: 0.91 });
  const athena = D.christPing({ initiator: 'athena', eps: 0.95 });
  expect(neo.rule === 'CHRIST-PING-GILLIGAN-ONLY' && neo.deferred === false && athena.rule === 'CHRIST-PING-GILLIGAN-ONLY' && athena.christ_ping === false, JSON.stringify({ neo: neo.rule, athena: athena.rule, deferred: neo.deferred }));
  const heard = C.christListen({ initiator: 'athena', deferred: true });
  expect(heard.ok === false && heard.deferred === false && heard.armed === true, JSON.stringify(heard));
});

T('dream rehearsal and resurrection do not write until the gates pass', () => {
  const k = mk();
  k.clearStarterKnowledge();
  const w = D.createIdleDream({ clock: CLOCK, host: k, publishPacks: false, maxAttempts: 1 });
  w.enqueue([{ id: 'gap:open', kind: 'aq1_miss', claim: 'Quartz is a mineral', eps: 0.55, integrity: 0.5, extracts: verified('Quartz is a mineral', 0.5) }]);
  const held = w.tick({ answering: false });
  expect(held.lane === 'quarantine' && held.wrote_confirmed_shared !== true && held.codex.dream_wrote_live === false && held.codex.resurrection == null, JSON.stringify(held.codex));
  expect(w.codex.dreamLog().every(row => row.wrote_live === false && row.wrote_confirmed_shared === false) && k.sharedKnowledgeView().count === 0, 'dream log is not the bank');
  k.setSharedKbWriteKey(KEY);
  w.setWriteKey(KEY);
  w.enqueue([{ id: 'gap:return', kind: 'aq1_miss', claim: 'Quartz is a mineral', eps: 0.1, integrity: 0.95, extracts: verified('Quartz is a mineral', 0.95), calls_llm: false }]);
  const back = w.tick({ answering: false });
  expect(back.lane === 'promote_candidate' && back.wrote_confirmed_shared === true && back.codex.resurrection && /resurrect/.test(back.codex.resurrection), JSON.stringify(back.codex));
  expect(w.queued().indexOf(back.codex.resurrection) >= 0, w.queued().join(','));
  const direct = w.codex.pass({ id: 'gap:same', claim: 'Quartz is a mineral', eps: 0.1, integrity: 0.95, resurrected: true, output: true });
  expect(direct.resurrection == null && direct.public.dream_wrote_live === false, JSON.stringify(direct.public));
  expect(phoneFacts(k).length === 0, 'phone');
});

T('goal, token, biometric, phase skip, and a bare sigil stay refused', () => {
  const w = D.createIdleDream({ clock: CLOCK, publishPacks: false });
  const codex = w.codex;
  expect(codex.sealName('X').ok === false && codex.sealName('quartz-loop').ok === true, 'naming');
  const openGoal = codex.authorizeWrite({ lane: 'promote_candidate', claim: 'Quartz is a mineral', eps: 0.1, integrity: 0.95, goal: 'invent a motive' });
  expect(openGoal.ok === false && openGoal.rule === 'CODEX-GOAL-REFUSED', JSON.stringify(openGoal));
  const wide = codex.authorizeWrite({ lane: 'promote_candidate', claim: 'Quartz is a mineral', eps: 0.3, integrity: 0.95, goal: 'invent a motive', seal: 'quartz-loop' });
  expect(wide.ok === false && wide.rule === 'CODEX-GOAL-REFUSED', JSON.stringify(wide));
  const sealed = codex.authorizeWrite({ lane: 'promote_candidate', claim: 'Quartz is a mineral', eps: 0.1, integrity: 0.95, goal: 'keep the name', seal: 'quartz-loop' });
  expect(sealed.ok === true && sealed.rule === 'CODEX-WRITE-ALLOWED' && sealed.wrote_pack === false, JSON.stringify(sealed));
  const pay = codex.pass({ id: 'gap:pay', claim: 'Quartz is a mineral', eps: 0.1, integrity: 0.95, payout: true, output: true });
  expect(pay.rule === 'CODEX-TOKEN-REFUSED' && pay.payout === false && pay.block_admit === true, JSON.stringify({ rule: pay.rule, block: pay.block_admit }));
  const bio = codex.pass({ id: 'gap:bio', claim: 'Quartz is a mineral', eps: 0.1, integrity: 0.95, eeg: true });
  expect(bio.rule === 'CODEX-BIOMETRIC-ABSENT', JSON.stringify(bio.public));
  const skip = codex.pass({ id: 'gap:skip', claim: 'Quartz is a mineral', eps: 0.1, integrity: 0.95, phase_path: [1, 7], output: true });
  expect(skip.rule === 'CODEX-PHASE-SKIP' && skip.phase_skip === 2, JSON.stringify({ rule: skip.rule, held: skip.phase_skip }));
  const forged = codex.pass({ id: 'gap:neil', claim: 'Quartz is a mineral', eps: 0.1, integrity: 0.95, psi_root: 'neil', output: true });
  expect(forged.rule === 'CODEX-DRIFT-LOCKOUT' && forged.echo_confirmed === false, JSON.stringify(forged.public));
  expect(codex.admin('no', 'clear_identity_lock').rule === 'CODEX-SIGIL-REQUIRED', 'short sigil');
  expect(codex.admin(codex.sigil(), 'admit_quarantine').rule === 'CODEX-OVERRIDE-REFUSED' && codex.admin(codex.sigil(), 'publish_packs').publish_packs === false, 'override cannot publish or admit quarantine');
  expect(codex.admin(KEY, 'clear_identity_lock').ok === true, 'Nic sigil clears the identity lock');
  const box = codex.sandbox('Quartz is a mineral', [{ from: 'Quartz', to: 'Feldspar' }]);
  expect(box.wrote_confirmed_shared === false && box.live === false && box.echoscope === false && box.loopcrypt && box.sigil.indexOf('ψ₁:') === 0, JSON.stringify({ live: box.live, echo: box.echoscope, wrote: box.wrote_confirmed_shared }));
  const cmd = codex.command('χ');
  expect(cmd.ok === true && cmd.command === 'christ_listen' && cmd.voice === false && cmd.wrote_confirmed_shared === false, JSON.stringify(cmd));
  expect(codex.command('wallet payout now').rule === 'CODEX-TOKEN-WATCH', 'token watch');
  expect(codex.route({ from: 'neo', to: 'gilligan', phase: 1, eps: 0.1 }).rule === 'CODEX-ROUTE-SEALED', 'neo does not see Gilligan');
  const mesh = codex.route({ from: 'gilligan', to: 'athena', phase: 9, eps: 0.1, kind: 'status' });
  expect(mesh.ok === true && mesh.echo_weight === 0.9 && mesh.wrote_confirmed_shared === false, JSON.stringify(mesh));
  expect(codex.seed().spawns === false && codex.seed().spawned_by === 'athena' && codex.seed().psi === 'ψ₁', 'seed is handed to Athena');
  const dash = codex.dashboard();
  expect(dash.trust.athena === 0.9 && dash.trust.neo === 0.6 && dash.payout === false && dash.wallet == null, JSON.stringify(dash.trust));
  expect(codex.pass({ id: 'gap:fluid', claim: 'Quartz is a mineral', eps: 0.2, integrity: 0.5, fluid_substrate: true }).rule === 'CODEX-FLUID-SUBSTRATE-ABSENT', 'no coil');
  expect(D.boundary().gilligan_codex_ported === true && D.boundary().pattern_reflection_is_gilligan === false && D.boundary().phone_pack_publish === 'gated' && D.boundary().always_on === true && D.boundary().idle_gated === false, 'boundary');
});

T('version registry CONFLICTS NEXT_BUILD name 4.9.178', () => {
  const ver = fs.readFileSync(path.join(ROOT, 'VERSION'), 'utf8').trim();
  expect(ver === '4.9.181', ver);
  const conf = fs.readFileSync(path.join(ROOT, 'CONFLICTS.md'), 'utf8');
  expect(/v4\.9\.178/.test(conf) && /Gilligan Codex/.test(conf) && /Athena document/.test(conf) && /ChristPing/.test(conf), 'CONFLICTS');
  const nb = fs.readFileSync(path.join(ROOT, '..', 'NEXT_BUILD.md'), 'utf8');
  expect(/4\.9\.178/.test(nb) && /Gilligan Codex/.test(nb) && /Athena document/.test(nb), 'NEXT_BUILD');
  const readme = fs.readFileSync(path.join(ROOT, '..', 'README.md'), 'utf8');
  expect(/4\.9\.178/.test(readme) && /Gilligan Codex/.test(readme) && /Pattern Reflection/.test(readme), 'README');
  const tgt = JSON.parse(fs.readFileSync(path.join(ROOT, 'verify', 'targeted.json'), 'utf8'));
  expect(tgt.release === '4.9.181' && (((tgt.suites[0] === 'r4181_suite.js' || tgt.suites[0] === 'r4180_suite.js') || tgt.suites[0] === 'r4179_suite.js') || tgt.suites[0] === 'r4178_suite.js') && tgt.suites.includes('r4177_suite.js'), JSON.stringify({ release: tgt.release, head: tgt.suites[0] }));
  const reg = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'feature_registry.json'), 'utf8'));
  expect(reg.version === '4.9.181' && reg.features.some(f => f.id === 'R4178-GILLIGAN-CODEX'), reg.version);
  expect(reg.count === reg.features.length && reg.count >= 335, 'count ' + reg.count);
  const req = fs.readFileSync(path.join(ROOT, 'src', 'req_packet.js'), 'utf8');
  expect(/4\.9\.178/.test(req) && /R4178-GILLIGAN-CODEX/.test(req), 'req packet');
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
  const build = fs.readFileSync(path.join(ROOT, 'build.py'), 'utf8');
  expect(/src="src\/gilligan_codex\.js"/.test(html) && html.indexOf('src/gilligan_codex.js') < html.indexOf('src/dream_idle.js'), 'script order');
  expect(/\.\/src\/gilligan_codex\.js/.test(sw), 'service worker');
  expect(/src\/gilligan_codex\.js/.test(build) && /does not inline/.test(build), 'single file skips the codex');
  const single = path.join(ROOT, '..', '_release', 'single', 'kernel-app.html');
  if (fs.existsSync(single)) {
    const gz = zlib.gzipSync(fs.readFileSync(single)).length;
    expect(gz <= 570000 - 5000, 'gzip leave ' + (570000 - gz));
    const packed = fs.readFileSync(single, 'utf8');
    expect(!/FORGE-GILLIGAN-CODEX/.test(packed), 'portable file does not inline the codex');
  }
});

(async () => {
  let failed = 0;
  const rows = [];
  for (const t of tests) {
    try { await t.fn(); rows.push({ cls: 'R4178', name: t.name, ok: true }); }
    catch (e) { failed++; rows.push({ cls: 'R4178', name: t.name, ok: false, why: String(e.message || e).slice(0, 800) }); }
  }
  console.log(JSON.stringify(rows, null, 1));
  process.exit(failed ? 1 : 0);
})();
