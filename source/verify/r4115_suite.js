/* R4115 (4.9.115): naming hygiene and offline packet replay. Written FIRST.
 * Pattern Reflection is not Gilligan. Tool Bench is not EchoForge. Foundation / Audit are ProtoForge disciplines.
 * RMC Echo is not EchoForge. A FORGE-TURN-PACKET/v1 verifies without the phone UI or the turn store.
 * No Genesis, HCS, marketplace, agents, shared KB, or LLM. */
const fs = require('fs');
const os = require('os');
const path = require('path');
const cp = require('child_process');
const ROOT = path.join(__dirname, '..');
const KMOD = require(ROOT + '/src/kernel.js');
const FK = require(ROOT + '/src/forge.js');
const LEX = require(ROOT + '/data/lexicon.json');
const EXT = require(ROOT + '/data/lexicon-ext.json');
const rows = [], tests = [];
const T = (name, fn) => tests.push({ name, fn });
const expect = (c, why) => { if (!c) throw new Error(why || 'expectation failed'); };
const CLOCK = () => '2026-10-27T00:15:00Z';
const mk = o => FK.ForgeKernel(Object.assign({ lexicon: LEX, lexiconExt: EXT, clock: CLOCK, store: KMOD.MemoryStore((() => { const st = {}; return { get: k => st[k], set: (k, v) => { st[k] = v; } }; })()) }, o || {}));
const sharedN = k => (k.store.load('shared_knowledge') || []).length;
let TP = null, tpErr = null;
try { TP = require(ROOT + '/src/turn_packet.js'); } catch (e) { tpErr = e; }
const packetOf = r => r && (r.turn_packet || (r.trace && r.trace.turn_packet));
const needMod = () => { if (!TP || typeof TP.verify !== 'function' || typeof TP.seal !== 'function') throw new Error('turn_packet verify/seal missing: ' + (tpErr && tpErr.message)); };
const hook = k => ({ echo: (t, m, vk) => k.kernel.echo(t, m, vk) });
const copy = p => JSON.parse(JSON.stringify(p));
const check = (v, id) => v && (v.checks || []).find(c => c.id === id);
const RECORDED = ['drift', 'memory', 'world', 'containment', 'gate', 'doc7'];

T('product copy keeps Pattern Reflection, Tool Bench, the Foundation layer, and RMC Echo distinct', () => {
  const app = fs.readFileSync(ROOT + '/src/app.js', 'utf8');
  const html = fs.readFileSync(ROOT + '/index.html', 'utf8');
  const help = fs.readFileSync(ROOT + '/src/app_extra.js', 'utf8');
  const spine = fs.readFileSync(ROOT + '/src/forge_spine.js', 'utf8');
  const gov = fs.readFileSync(ROOT + '/src/governance.js', 'utf8');
  const op = fs.readFileSync(ROOT + '/src/operator.js', 'utf8');
  const ui = app + '\n' + html + '\n' + help;
  expect(/Pattern Reflection/.test(ui) && /not Gilligan/.test(ui), 'Pattern Reflection is still spoken as Gilligan');
  expect(!/Forge > Gilligan/.test(app), 'Gilligan is still a kernel layer in the status stack');
  expect(/Tool Bench is not EchoForge/.test(ui) && /RMC Echo/.test(ui) && /not EchoForge/.test(ui), 'Tool Bench or RMC Echo still blurs into EchoForge');
  expect(/Foundation layer/.test(ui), 'Foundation layer missing');
  expect(/\['ProtoForge layer', '[^']*Audit \/ Receipts[^']*M2 ledger[^']*containment/.test(app), 'ProtoForge discipline row dropped');
  expect(!/RUN-PROTOFORGE|pfForm|pfRun|data-pf\b|<(?:button|input|form|select)[^>]*protoforge/i.test(html + app + help), 'CLEANUP-495 ProtoForge control');
  expect(!/EchoForge here is the no-LLM tool bench/.test(spine), 'advisory reason still calls EchoForge the tool bench');
  expect(/Tool Bench is not EchoForge/.test(spine + gov), 'advisory copy does not separate Tool Bench from EchoForge');
  expect(/id="echoforge"/.test(html) && /function gilligan\(/.test(op) && /echoForge:/.test(gov), 'storage key renamed');
  expect(/storage key/.test(ui) && /echoforge/.test(html), 'storage key not documented on the Tool Bench');
  const reg = JSON.parse(fs.readFileSync(ROOT + '/data/feature_registry.json', 'utf8'));
  const name = id => (reg.features.find(f => f.id === id) || {}).name || '';
  expect(/Pattern Reflection/.test(name('J-05')) && /not Gilligan/.test(name('J-05')), name('J-05'));
  expect(/Pattern Reflection/.test(name('X-12')) && !/^Gilligan /.test(name('X-12')), name('X-12'));
  expect(/Tool Bench/.test(name('J-04')) && /not EchoForge/.test(name('J-04')), name('J-04'));
});

T('an exported packet and a failure receipt verify offline, and a forged echo claim fails', () => {
  needMod();
  const k = mk();
  const hello = k.process('hello');
  const p = copy(packetOf(hello));
  expect(p.schema === 'FORGE-TURN-PACKET/v1' && p.packet_version === '4.9.111', 'schema moved');
  expect(p.integrity && p.integrity.alg === 'SHA-256' && /^[0-9a-f]{64}$/.test(p.integrity.hash), JSON.stringify(p.integrity));
  expect(p.replay && p.replay.output && p.replay.meaning, 'replay fields missing');
  k.store.save('trace', []); k.store.save('memory', []); k.store.save('receipts', []);
  const v = TP.verify(p, hook(k));
  expect(v && v.schema === 'FORGE-PACKET-VERIFY/v1' && v.trusted_ui === false && v.ok === true, JSON.stringify(v && { ok: v.ok, checks: v.checks }));
  expect(check(v, 'integrity').mode === 'reexecuted' && check(v, 'integrity').ok === true, 'integrity');
  expect(check(v, 'echo').mode === 'reexecuted' && check(v, 'echo').ok === true, JSON.stringify(check(v, 'echo')));
  expect(p.selected.route && check(v, 'selection').mode === 'reexecuted' && check(v, 'selection').ok === true, JSON.stringify(check(v, 'selection')));
  for (const id of RECORDED) expect(check(v, id) && check(v, id).mode === 'recorded-only', id + ' ' + JSON.stringify(check(v, id)));
  expect(sharedN(k) === 0, 'shared KB');
  const flipped = copy(p); flipped.echo.pass = !flipped.echo.pass; TP.seal(flipped);
  const lie = TP.verify(flipped, hook(k));
  expect(lie.ok === false && check(lie, 'integrity').ok === true && check(lie, 'echo').mode === 'reexecuted' && check(lie, 'echo').ok === false, JSON.stringify(lie.checks));
  const dirty = copy(p); dirty.input = String(dirty.input || '') + ' x';
  const bad = TP.verify(dirty, hook(k));
  expect(bad.ok === false && check(bad, 'integrity').ok === false, 'tampered body still hashed');
  const bare = TP.verify(p, {});
  expect(bare.ok === false && check(bare, 'echo').mode === 'recorded-only', 'echo claim accepted with no reparse');
  const failK = mk({ renderFault: t => t.replace('noted', 'denied') });
  const denied = failK.process('remember that my car is red');
  const fp = copy(packetOf(denied));
  expect(fp.receipt_type === 'echo_fail' && fp.echo.pass === false && fp.replay && fp.replay.output, JSON.stringify({ t: fp.receipt_type, e: fp.echo, out: fp.replay && fp.replay.output }));
  failK.store.save('trace', []); failK.store.save('memory', []);
  const fv = TP.verify(TP.openReceipt(fp), hook(failK));
  expect(fv.ok === true && check(fv, 'echo').mode === 'reexecuted' && check(fv, 'echo').ok === true && check(fv, 'integrity').ok === true, JSON.stringify(fv.checks));
  const buy = mk().process('buy milk');
  const bp = copy(packetOf(buy));
  expect(bp.receipt_type === 'gate_refusal' && bp.failure && bp.failure.subtype === 'action_blocked', JSON.stringify(bp.failure));
  const bv = TP.verify(bp, hook(mk()));
  expect(bv.ok === true && check(bv, 'echo').mode === 'reexecuted', JSON.stringify(bv.checks && bv.checks.slice(0, 3)));
  const file = path.join(os.tmpdir(), 'forge-r4115-packet.json');
  fs.writeFileSync(file, JSON.stringify(p));
  const cli = path.join(ROOT, 'tools', 'verify_packet.js');
  expect(fs.existsSync(cli), 'CLI missing');
  const okRun = cp.spawnSync('node', [cli, file], { encoding: 'utf8' });
  expect(okRun.status === 0, String(okRun.stderr || okRun.stdout).slice(0, 400));
  const oj = JSON.parse(okRun.stdout);
  expect(oj.ok === true && oj.trusted_ui === false && (oj.checks || []).some(c => c.id === 'echo' && c.mode === 'reexecuted'), okRun.stdout.slice(0, 400));
  const badFile = path.join(os.tmpdir(), 'forge-r4115-bad.json');
  fs.writeFileSync(badFile, JSON.stringify(dirty));
  const badRun = cp.spawnSync('node', [cli, badFile], { encoding: 'utf8' });
  expect(badRun.status === 1, 'tampered packet verified');
  const src = fs.readFileSync(ROOT + '/src/turn_packet.js', 'utf8') + fs.readFileSync(cli, 'utf8');
  expect(!/\b(llm|embedding|openai|classifier)\b/i.test(src), 'model path');
});

T('version, registry, CONFLICTS, and the in-app control close the locked queue', () => {
  const ver = fs.readFileSync(ROOT + '/VERSION', 'utf8').trim();
  const parts = ver.split('.').map(part => parseInt(part, 10));
  expect(parts[0] === 4 && parts[1] === 9 && parts[2] >= 115, ver);
  const reg = JSON.parse(fs.readFileSync(ROOT + '/data/feature_registry.json', 'utf8'));
  expect(reg.version === ver && reg.count === reg.features.length, reg.version + ' count ' + reg.count);
  const ids = reg.features.map(f => f.id);
  expect(ids.includes('R4114-LAW') && ids.includes('R4114-CUSTODY'), '4.9.114 rows dropped');
  expect(ids.includes('R4115-NAMES') && ids.includes('R4115-REPLAY'), ids.slice(-4).join(','));
  for (const id of ['R4115-NAMES', 'R4115-REPLAY']) {
    const f = reg.features.find(x => x.id === id);
    expect(f.claim === 'Partial' && (f.proof || []).includes('R4115') && /4\.9\.115/.test(f.note), id);
    expect(!/Christ function/i.test(f.note), id);
  }
  const tally = {}; for (const f of reg.features) tally[f.claim] = (tally[f.claim] || 0) + 1;
  expect(reg.claims.Implemented === 112 && tally.Implemented === 113, 'implemented tally moved ' + reg.claims.Implemented + '/' + tally.Implemented);
  expect(reg.claims.Partial === tally.Partial + 1, 'partial delta moved ' + reg.claims.Partial + '/' + tally.Partial);
  const cf = fs.readFileSync(ROOT + '/CONFLICTS.md', 'utf8');
  const sec = cf.slice(cf.lastIndexOf('## v4.9.115'));
  expect(/Pattern Reflection/.test(sec) && /not Gilligan|≠ Gilligan/.test(sec), 'Gilligan');
  expect(/Tool Bench/.test(sec) && /EchoForge/.test(sec) && /RMC Echo/.test(sec), 'bench');
  expect(/Foundation layer/.test(sec) && /CLEANUP-495/.test(sec), 'foundation');
  expect(/echoforge/.test(sec) && /gilligan/.test(sec), 'storage keys');
  expect(/FORGE-TURN-PACKET\/v1/.test(sec) && /reexecuted|re-executed/.test(sec) && /recorded-only/.test(sec), 'replay');
  expect(/shared KB stays empty|Shared KB stays empty/.test(sec), 'shared');
  expect(/locked queue|architecture queue/.test(sec) && /out of scope|do not/.test(sec), 'queue fence');
  expect(!/Christ function/i.test(sec), 'Christ function');
  const next = fs.readFileSync(ROOT + '/../NEXT_BUILD.md', 'utf8');
  expect(/4\.9\.115/.test(next) && /locked/.test(next) && /Genesis/.test(next), 'NEXT_BUILD');
  const readme = fs.readFileSync(ROOT + '/../README.md', 'utf8');
  expect(/4\.9\.115/.test(readme) && /Pattern Reflection/.test(readme) && /Verify packet/.test(readme), 'README');
  const html = fs.readFileSync(ROOT + '/index.html', 'utf8');
  const app = fs.readFileSync(ROOT + '/src/app.js', 'utf8');
  expect(/id="pktIn"/.test(html) && /Verify packet/.test(html), 'paste control');
  const i = app.indexOf('pktVerify');
  expect(i > 0, 'handler');
  const fn = app.slice(i, i + 700);
  expect(/KTurnPacket\.verify/.test(fn) && !/exportTurnPacket|store\.load\(/.test(fn), 'verify reads the turn store');
  const targeted = fs.readFileSync(ROOT + '/verify/targeted.json', 'utf8');
  const tg = JSON.parse(targeted), tp = String(tg.release || '').split('.').map(part => parseInt(part, 10));
  expect(tp[0] === 4 && tp[1] === 9 && tp[2] >= 115 && (tg.suites || []).includes('r4115_suite.js'), 'targeted gate');
});

(async () => {
  let failed = 0;
  for (const t of tests) {
    try { await t.fn(); rows.push({ cls: 'R4115', name: t.name, ok: true }); }
    catch (e) { failed++; rows.push({ cls: 'R4115', name: t.name, ok: false, why: String(e.message || e).slice(0, 500) }); }
  }
  console.log(JSON.stringify(rows));
  process.exit(failed ? 1 : 0);
})();
