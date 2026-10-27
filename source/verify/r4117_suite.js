/* R4117 (4.9.117): Doc 9 verification packets. Written FIRST.
 * A requirement id names the tests that check it. Behavior totals and verifier gates stay apart.
 * A green behavior run cannot override a failed gate. The authority path keeps an explicit non-model receipt.
 * Math honesty, dream/SPC, and creative writing are not this release. */
const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const ROOT = path.join(__dirname, '..');
const tests = [], rows = [];
const T = (name, fn) => tests.push({ name, fn });
const expect = (c, why) => { if (!c) throw new Error(why || 'expectation failed'); };

T('the 4.9.116 packet maps each requirement id to tests in that suite', () => {
  const RP = require(ROOT + '/src/req_packet.js');
  expect(RP.SCHEMA === 'FORGE-REQ-PACKET/v1', RP.SCHEMA);
  const slice = RP.packet('4.9.116');
  expect(slice && slice.requirements.map(r => r.id).join(',') === 'R4116-LEXICON,R4116-FRAMES', JSON.stringify(slice && slice.requirements.map(r => r.id)));
  const n = slice.requirements.reduce((a, r) => a + r.tests.length, 0);
  expect(n >= 4, 'linked tests ' + n);
  for (const r of slice.requirements) {
    expect(r.falsify && r.statement, r.id);
    for (const t of r.tests) {
      expect(t.id && t.suite === 'r4116_suite.js' && t.cls === 'R4116' && t.name && RP.DOC9_CLASSES.includes(t.doc9_class), JSON.stringify(t));
      expect(fs.readFileSync(ROOT + '/verify/r4116_suite.js', 'utf8').includes(t.name), t.name);
    }
  }
  expect(RP.linksMissing(ROOT).length === 0, RP.linksMissing(ROOT).join(' '));
  expect(RP.TEMPLATE.schema === RP.SCHEMA && RP.TEMPLATE.release === '' && RP.TEMPLATE.requirements.length === 0 && RP.TEMPLATE.decision.behavior_overrides_gate === false, 'template');
  expect(RP.TEMPLATE !== slice && RP.packet('4.9.117') && RP.packet('4.9.117').release === '4.9.117', 'slices');
  const outside = (RP.OUTSIDE_TARGETED || []).map(x => x.id);
  expect(outside.includes('HELDOUT-EVAL') && outside.includes('MUTATION-EVAL') && RP.OUTSIDE_TARGETED.every(x => x.in_targeted_gate === false), outside.join(','));
  const okRows = [];
  for (const p of RP.PACKETS) for (const r of p.requirements) for (const t of r.tests) okRows.push({ cls: t.cls, name: t.name, ok: true });
  expect(RP.evidence(okRows).packets.every(p => p.requirements_ok === true), 'filled');
  const bad = okRows.map(r => Object.assign({}, r));
  bad[0].ok = false;
  expect(RP.evidence(bad).packets.some(p => p.requirements_ok === false), 'a failed link still fills');
});

T('a green behavior result does not override a failed gate', () => {
  const RP = require(ROOT + '/src/req_packet.js');
  const green = { passed: 7, failed: 0, not_run: 0, total: 7 };
  const held = RP.releaseDecision(green, { ok: false });
  expect(held.behavior_ok === true && held.gates_ok === false && held.ok === false && held.behavior_overrides_gate === false && held.both_required === true && held.law === 'GP-015', JSON.stringify(held));
  const red = RP.releaseDecision({ passed: 6, failed: 1, not_run: 0, total: 7 }, { ok: true });
  expect(red.behavior_ok === false && red.gates_ok === true && red.ok === false, JSON.stringify(red));
  const both = RP.releaseDecision(green, { ok: true });
  expect(both.ok === true && both.behavior_ok === true && both.gates_ok === true, JSON.stringify(both));
  const named = RP.releaseDecision({ passed: 6, failed: 0, not_run: 1, total: 7 }, { ok: true });
  expect(named.behavior_ok === false && named.ok === false, JSON.stringify(named));
});

T('the authority-path receipt is the Doc 9 non-model scan', () => {
  const N = require(ROOT + '/verify/nonllm.js');
  const rec = N.scan(ROOT);
  expect(rec.schema === 'FORGE-NONLLM-RECEIPT/v1' && rec.ok === true, JSON.stringify({ ok: rec.ok, n: rec.checks.length }));
  expect(rec.files.includes('src/kernel.js') && rec.files.includes('src/grammar.js') && rec.files.includes('src/reason.js'), rec.files.join(','));
  expect(rec.checks.length === rec.files.length * 11, rec.checks.length + '/' + rec.files.length);
  const planted = N.scanSource('src/kernel.js', 'const x = openai');
  expect(planted.some(c => c.ok === false && /openai/.test(c.detail)), 'planted token was accepted');
  const run = fs.readFileSync(ROOT + '/verify/run.js', 'utf8');
  expect(/nonllm\.js/.test(run) && !/openai\|anthropic/.test(run), 'scan list forked');
});

T('the requirement tool prints the packet and the receipt', () => {
  const r = cp.spawnSync('node', ['tools/verify_req.js'], { cwd: ROOT, encoding: 'utf8' });
  expect(r.status === 0, r.stdout + r.stderr);
  expect(/FORGE-REQ-PACKET\/v1/.test(r.stdout) && /FORGE-NONLLM-RECEIPT\/v1/.test(r.stdout), r.stdout.slice(0, 400));
  const tpl = cp.spawnSync('node', ['tools/verify_req.js', '--template'], { cwd: ROOT, encoding: 'utf8' });
  const j = JSON.parse(tpl.stdout);
  expect(tpl.status === 0 && j.schema === 'FORGE-REQ-PACKET/v1' && j.release === '' && j.requirements.length === 0, tpl.stdout.slice(0, 300));
});

T('Audit shows the requirement packet', () => {
  const RP = require(ROOT + '/src/req_packet.js');
  const app = fs.readFileSync(ROOT + '/src/app.js', 'utf8');
  expect(/KReqPacket\.auditCard/.test(app), 'audit');
  const html = RP.auditCard();
  expect(/FORGE-REQ-PACKET\/v1/.test(html) && /R4116-LEXICON/.test(html) && /R4116-FRAMES/.test(html), html);
  expect(/R4117-TRACE/.test(html) && /R4117-GATES/.test(html) && /R4117-NONLLM/.test(html), html);
  expect(/does not override a failed gate/.test(html), html);
  expect(!/behavior passed|gates passed/i.test(html), html);
  const page = fs.readFileSync(ROOT + '/index.html', 'utf8');
  const sw = fs.readFileSync(ROOT + '/sw.js', 'utf8');
  expect(page.includes('src/req_packet.js') && page.indexOf('src/req_packet.js') < page.indexOf('src/app.js'), 'script order');
  expect(sw.includes('./src/req_packet.js'), 'precache');
});

T('the targeted gate writes the packet and the release check uses one decision', () => {
  const tg = fs.readFileSync(ROOT + '/verify/targeted.js', 'utf8');
  const vr = fs.readFileSync(ROOT + '/tools/verify_release.js', 'utf8');
  expect(/req_packet/.test(tg) && /req_packet\.json/.test(tg), 'targeted writer');
  expect(/releaseDecision\(/.test(vr) && /behavior_overrides_gate/.test(vr), 'decision');
  expect(/const ok = decision\.ok/.test(vr) && !/ok = behaviorOk \|\|/.test(vr), vr.match(/const ok = .*/) && vr.match(/const ok = .*/)[0]);
  expect(/S\.gate === 'targeted'/.test(vr), 'packet gate is the publish path');
});

T('version, registry, CONFLICTS, and NEXT_BUILD name 4.9.117 and leave the later queue unstarted', () => {
  const ver = fs.readFileSync(ROOT + '/VERSION', 'utf8').trim();
  expect(ver === '4.9.117', ver);
  const reg = JSON.parse(fs.readFileSync(ROOT + '/data/feature_registry.json', 'utf8'));
  expect(reg.version === ver && reg.count === reg.features.length, reg.version + ' ' + reg.count);
  for (const id of ['R4117-TRACE', 'R4117-GATES', 'R4117-NONLLM']) {
    const f = reg.features.find(x => x.id === id);
    expect(f && f.claim === 'Partial' && (f.proof || []).includes('R4117') && /4\.9\.117/.test(f.note), id);
    expect(f && !/Christ function/i.test(f.note), id);
  }
  const a11 = reg.features.find(x => x.id === 'A-11');
  expect(a11 && a11.claim === 'Partial' && /4\.9\.117/.test(a11.note) && /suite level/.test(a11.note), a11 && a11.note);
  const tally = {}; for (const f of reg.features) tally[f.claim] = (tally[f.claim] || 0) + 1;
  expect(reg.claims.Implemented === 112 && reg.claims.Partial === tally.Partial + 1, JSON.stringify(reg.claims) + ' ' + tally.Partial);
  const cf = fs.readFileSync(ROOT + '/CONFLICTS.md', 'utf8');
  const at = cf.lastIndexOf('## v4.9.117');
  const nxt = cf.indexOf('\n## v', at + 12);
  const sec = cf.slice(at, nxt === -1 ? undefined : nxt);
  expect(/GP-015/.test(sec) && /FORGE-REQ-PACKET\/v1/.test(sec) && /FORGE-NONLLM-RECEIPT\/v1/.test(sec), 'conflicts');
  expect(/math honesty/.test(sec) && /dream/.test(sec) && /creative writing/.test(sec), 'queue');
  expect(/not started|do not start/.test(sec) && /shared KB stays empty|Shared KB stays empty/.test(sec), 'fence');
  expect(!/Christ function/i.test(sec), 'name');
  const next = fs.readFileSync(ROOT + '/../NEXT_BUILD.md', 'utf8');
  expect(/4\.9\.117/.test(next) && /math honesty/.test(next) && /dream/.test(next) && /creative writing/.test(next) && /Genesis/.test(next), 'NEXT_BUILD');
  expect(/do not start/i.test(next), 'next fence');
  const readme = fs.readFileSync(ROOT + '/../README.md', 'utf8');
  expect(/4\.9\.117/.test(readme) && /requirement packet/i.test(readme) && /does not override a failed gate/.test(readme), 'README');
  expect(!/failing-first|bot instruction/i.test(readme), 'README product');
  const targeted = JSON.parse(fs.readFileSync(ROOT + '/verify/targeted.json', 'utf8'));
  expect(targeted.release === '4.9.117' && targeted.suites.includes('r4117_suite.js') && targeted.suites[0] === 'r4117_suite.js', targeted.release);
  expect(!fs.existsSync(ROOT + '/src/creative.js'), 'creative writing started');
});

(async () => {
  let failed = 0;
  for (const t of tests) {
    try { await t.fn(); rows.push({ cls: 'R4117', name: t.name, ok: true }); }
    catch (e) { failed++; rows.push({ cls: 'R4117', name: t.name, ok: false, why: String(e.message || e).slice(0, 500) }); }
  }
  console.log(JSON.stringify(rows, null, 1));
  process.exit(failed ? 1 : 0);
})();
