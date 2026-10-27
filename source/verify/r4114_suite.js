/* R4114 (4.9.114): MSM-v1 custody completeness. Reconstructed Doc 2 — the Drive file is not in the tree.
 * The 13th preservation class, the forge 35C lifecycle law (not forge2 draft/candidate edges), and 35D strict bytes.
 * Written FIRST. No offline replay. No naming rename. MSM does not select, execute, write memory, or approve Echo. */
const fs = require('fs');
const ROOT = require('path').join(__dirname, '..');
const KMOD = require(ROOT + '/src/kernel.js');
const FK = require(ROOT + '/src/forge.js');
const MS = require(ROOT + '/src/msm.js');
const SP = require(ROOT + '/src/forge_spine.js');
const LEX = require(ROOT + '/data/lexicon.json');
const EXT = require(ROOT + '/data/lexicon-ext.json');
const rows = [], tests = [];
const T = (name, fn) => tests.push({ name, fn });
const expect = (c, why) => { if (!c) throw new Error(why || 'expectation failed'); };
const CLOCK = () => '2026-10-27T00:14:00Z';
const mk = () => { const st = {}; return FK.ForgeKernel({ lexicon: LEX, lexiconExt: EXT, clock: CLOCK, store: KMOD.MemoryStore({ get: k => st[k], set: (k, v) => { st[k] = v; } }) }); };
const sharedN = k => (k.store.load('shared_knowledge') || []).length;
const CLASS = 'action_proposal_simulation_and_observation';

function lawIssues(m) {
  const issues = [], idx = {};
  if (!m || !m.lineage_root) return ['no manifest'];
  idx[m.lineage_root.lineage_id] = m.lineage_root;
  for (const c of MS.COLLECTIONS) for (const r of m[c] || []) if (r && r.record_id) idx[r.record_id] = r;
  const arrived = new Set();
  for (const tr of m.semantic_transition_traces || []) {
    const rule = MS.RULES.find(r => r.from === tr.from_state && r.to === tr.to_state);
    if (!rule) issues.push('illegal_transition ' + tr.from_state + '→' + tr.to_state + '/' + tr.transition_kind);
    else if (!rule.kinds.includes(tr.transition_kind)) issues.push('illegal_transition_kind ' + tr.from_state + '→' + tr.to_state + ' ' + tr.transition_kind);
    else if (rule.authority) {
      const a = tr.authority_reference_ref && idx[tr.authority_reference_ref];
      if (!a || a.record_kind !== 'external_authority_reference') issues.push('authority_required ' + tr.from_state + '→' + tr.to_state);
    }
    if (tr.from_state === 'draft' || tr.to_state === 'candidate' || tr.to_state === 'accepted') issues.push('forge2 contract edge');
    arrived.add(tr.to_record_ref);
  }
  for (const c of MS.COLLECTIONS) {
    if (c === 'external_authority_references' || c === 'semantic_transition_traces') continue;
    for (const r of m[c] || []) if (!arrived.has(r.record_id)) issues.push('no arrival ' + r.record_kind);
  }
  if (!(m.candidate_meanings || []).length) issues.push('no candidate');
  if (!(m.governed_outward_meanings || []).length) issues.push('no outward');
  if (!(m.expression_links || []).length) issues.push('no expression');
  if (!(m.validation_links || []).length) issues.push('no validation');
  const sel = (m.selected_governed_meanings || []).length, nso = (m.non_selection_outcomes || []).length;
  if (!sel === !nso) issues.push('selected xor non-selection ' + sel + '/' + nso);
  return issues;
}
function sealed(m) {
  const body = JSON.parse(JSON.stringify(m)); delete body.manifest_id;
  if (SP.stableIdentifier('aiweb.msm.manifest', body) !== m.manifest_id) return 'manifest id does not match canonical bytes';
  const e = MS.encode(m); if (!e.ok) return 'encode ' + JSON.stringify(e.issues || e).slice(0, 160);
  const d = MS.decode(e.bytes);
  if (!d.ok || MS.encode(d.manifest).bytes !== e.bytes) return 'round trip ' + (d.issue || '');
  if (MS.decode(e.bytes + ' ').ok || MS.decode(JSON.stringify(JSON.parse(e.bytes), null, 1)).ok) return 'whitespace accepted';
  const o = JSON.parse(e.bytes);
  if (MS.decode(JSON.stringify({ manifest: o.manifest, envelope_version: 1, envelope_id: o.envelope_id })).ok) return 'reordered keys accepted';
  if (!/unknown_version/.test(String(MS.decode(e.bytes.replace('"envelope_version":1', '"envelope_version":2')).issue))) return 'unknown version accepted';
  if (MS.decode(e.bytes.replace('{"envelope_id"', '{"extra":1,"envelope_id"')).issue !== 'unknown_or_missing_field') return 'unknown field accepted';
  return '';
}
function custody(r) {
  const m = r.forge && r.forge.msm, c = r.trace && r.trace.msm && r.trace.msm.custody;
  expect(c && c.label === 'reconstructed Doc 2 / MSM-v1' && c.doc2 === 'not recovered' && c.manifest_id === m.manifest_id, JSON.stringify(c && { label: c.label, doc2: c.doc2 }));
  expect(c.lineage_root === m.lineage_root.lineage_id, 'lineage ref');
  for (const k of ['candidate_meanings', 'non_selection_outcomes', 'selected_governed_meanings', 'governed_outward_meanings', 'expression_links', 'validation_links']) expect(JSON.stringify(c[k]) === JSON.stringify((m[k] || []).map(x => x.record_id)), k);
  const blob = JSON.stringify(c);
  expect(!/signed_score|"components"|utterance|may_write_memory/.test(blob), 'projection absorbed a foreign body');
  expect(!('projection_status' in m) && !('confidence_bps' in m) && !('drift_score' in m), 'μ_t fields inside MSM');
  expect(r.trace.output_manifest && r.trace.output_manifest.manifest_id !== m.manifest_id && /^mu:/.test(r.trace.output_manifest.manifest_id), 'μ_t is not a separate projection');
  const rec = r.forge.receipt && r.forge.receipt.receipt_id;
  expect(rec && !JSON.stringify(m).includes(rec) && !blob.includes(rec), 'receipt written into MSM');
  expect(!('pass' in (m.validation_links[0] || {})), 'validation link approves Echo');
}

T('the 13th preservation class is on action, simulation, and observation records, and not on a greeting or a remember', () => {
  expect(MS.PRESERVATION.length === 13 && MS.PRESERVATION.includes(CLASS) && JSON.stringify(SP.PRESERVATION) === JSON.stringify(MS.PRESERVATION), 'enum');
  expect(SP.LIFECYCLE.includes('draft') && SP.LIFECYCLE.includes('candidate') && !MS.RULES.some(r => r.from === 'draft' || r.to === 'draft' || r.to === 'candidate' || r.from === 'accepted'), '35C mixed with forge2 LIFECYCLE_EDGES');
  const k = mk();
  const hello = k.process('hello');
  expect(!hello.forge.msm.candidate_meanings[0].preservation_classes.includes(CLASS) && hello.trace.msm_v1.preservation_classes.join() === 'non_llm_provenance', JSON.stringify(hello.forge.msm.candidate_meanings[0].preservation_classes));
  const rem = k.process('remember that my car is red');
  const rp = rem.forge.msm.candidate_meanings[0].preservation_classes;
  expect(rp.includes('memory_boundary') && !rp.includes(CLASS), JSON.stringify(rp));
  const before = JSON.stringify(k.store.load('memory'));
  const sup = k.process('Suppose Quo is inside Rub.');
  const sp = sup.forge.msm.candidate_meanings[0].preservation_classes;
  expect(sup.trace.intent_kind === 'SIMULATE' && sp.includes(CLASS) && sup.trace.msm_v1.preservation_classes.includes(CLASS), JSON.stringify(sp) + ' / ' + JSON.stringify(sup.trace.msm_v1.preservation_classes));
  expect(JSON.stringify(k.store.load('memory')) === before && sharedN(k) === 0 && sup.trace.msm.limits.may_write_memory === false, 'suppose wrote memory');
  const buy = k.process('buy milk');
  const bp = buy.forge.msm.candidate_meanings[0].preservation_classes;
  expect(buy.trace.msm.meaning.kind === 'blocked' && bp.includes(CLASS) && bp.includes('permission_versus_request') && !(buy.trace.memory || []).length, JSON.stringify(bp) + ' ' + buy.reply);
  const prop = k.process('show the proposals');
  expect(prop.trace.msm.meaning.kind === 'mea_proposals' && prop.forge.msm.candidate_meanings[0].preservation_classes.includes(CLASS) && prop.trace.msm_v1.preservation_classes.includes(CLASS), JSON.stringify(prop.forge.msm.candidate_meanings[0].preservation_classes));
  expect(sharedN(k) === 0, 'shared KB');
});

T('live MSM-v1 records follow the 35C law, strict 35D bytes, and trace.msm only cites their ids', () => {
  const k = mk();
  let m0 = MS.create({ manifest_id: 'msm:t', lineage_id: 'lin:t', origin_ref: 'turn:1' });
  const sgm = { record_kind: 'selected_governed_meaning', record_id: 'sgm:t', lifecycle_state: 'selected_governed_meaning', selected_candidate_ref: 'cm:1', selection_authority_ref: 'ea:1', communicative_act: 'assert', concept_refs: [], relation_refs: [], meaning_modifiers: [], inherited_limitations: [], authority_sensitive_distinctions: [], preservation_classes: ['non_llm_provenance'] };
  expect(MS.transition(m0, { from_ref: 'lin:t', kind: 'ancestry', to: sgm }).issue.code === 'illegal_transition', 'skipped candidate accepted');
  const bad = MS.transition(m0, { from_ref: 'lin:t', kind: 'ancestry', to: Object.assign({}, sgm, { record_kind: 'candidate_meaning', record_id: 'cm:d', lifecycle_state: 'draft' }) });
  expect(!bad.ok && bad.issue.code === 'illegal_transition', 'draft edge accepted ' + JSON.stringify(bad.issue));
  for (const u of ['hello', 'remember that my car is red', 'Suppose Quo is inside Rub.', 'buy milk', 'flurb the zang', 'I saw her duck', 'show the proposals']) {
    const r = k.process(u), m = r.forge.msm, law = lawIssues(m), bytes = sealed(m);
    expect(!law.length, u + ' ' + law.slice(0, 4).join('; '));
    expect(!bytes, u + ' ' + bytes);
    expect(SP.validateManifest(m).valid, u + ' 35B ' + JSON.stringify(SP.validateManifest(m).issues.slice(0, 2)));
    custody(r);
    expect(r.trace.msm.msm_v1 && r.trace.msm.msm_v1.manifest_id && r.trace.msm.msm_v1.manifest_id !== m.manifest_id, u + ' kernel ref');
  }
  expect(sharedN(k) === 0, 'shared KB');
});

T('version, registry, CONFLICTS, README, and the UI name reconstructed Doc 2 and leave 4.9.115 parked', () => {
  const ver = fs.readFileSync(ROOT + '/VERSION', 'utf8').trim();
  const reg = JSON.parse(fs.readFileSync(ROOT + '/data/feature_registry.json', 'utf8'));
  expect(reg.version === ver && reg.count === reg.features.length, reg.version + ' count ' + reg.count);
  const ids = reg.features.map(f => f.id);
  expect(ids.includes('R4113-CATEGORIES') && ids.includes('R4113-BELIEF'), '4.9.113 rows dropped');
  expect(ids.includes('R4114-LAW') && ids.includes('R4114-CUSTODY'), ids.slice(-4).join(','));
  for (const id of ['R4114-LAW', 'R4114-CUSTODY']) {
    const f = reg.features.find(x => x.id === id);
    expect(f.claim === 'Partial' && (f.proof || []).includes('R4114') && /4\.9\.114/.test(f.note) && /reconstructed/.test(f.note), id);
    expect(!/Christ function/i.test(f.note) && !/file was recovered|Drive file recovered/i.test(f.note), id);
  }
  const tally = {}; for (const f of reg.features) tally[f.claim] = (tally[f.claim] || 0) + 1;
  expect(reg.claims.Implemented === 112 && tally.Implemented === 113, 'implemented tally moved ' + reg.claims.Implemented + '/' + tally.Implemented);
  expect(reg.claims.Partial === tally.Partial + 1, 'partial delta moved ' + reg.claims.Partial + '/' + tally.Partial);
  const cf = fs.readFileSync(ROOT + '/CONFLICTS.md', 'utf8');
  const sec = cf.slice(cf.lastIndexOf('## v4.9.114'));
  expect(/action_proposal_simulation_and_observation/.test(sec) && /35C/.test(sec) && /35D/.test(sec), 'law missing');
  expect(/reconstructed/.test(sec) && /not recovered|was not recovered|not located/.test(sec), 'honesty');
  expect(/does not select|may not select/.test(sec) && /shared KB stays empty|Shared KB stays empty/.test(sec), 'authority');
  expect(/4\.9\.115/.test(sec) && /out of scope|do not/.test(sec), 'later queue not fenced');
  expect(!/Christ function/i.test(sec), 'Christ function');
  const next = fs.readFileSync(ROOT + '/../NEXT_BUILD.md', 'utf8');
  expect(/4\.9\.114/.test(next) && /reconstructed Doc 2/.test(next) && /4\.9\.115/.test(next), 'NEXT_BUILD');
  const readme = fs.readFileSync(ROOT + '/../README.md', 'utf8');
  expect(/4\.9\.114/.test(readme) && /reconstructed Doc 2/.test(readme) && /not recovered/.test(readme), 'README');
  const app = fs.readFileSync(ROOT + '/src/app.js', 'utf8');
  expect(/reconstructed Doc 2 \/ MSM-v1/.test(app) && !/file was recovered|Drive file recovered/i.test(app), 'UI label');
  const targeted = fs.readFileSync(ROOT + '/verify/targeted.json', 'utf8');
  expect(/r4114_suite\.js/.test(targeted), 'targeted gate');
  expect(!fs.existsSync(ROOT + '/DOC2.md') && !fs.existsSync(ROOT + '/../DOC_2.md'), 'invented Doc 2 file');
});

(async () => {
  let failed = 0;
  for (const t of tests) {
    try { await t.fn(); rows.push({ cls: 'R4114', name: t.name, ok: true }); }
    catch (e) { failed++; rows.push({ cls: 'R4114', name: t.name, ok: false, why: String(e.message || e).slice(0, 500) }); }
  }
  console.log(JSON.stringify(rows));
  process.exit(failed ? 1 : 0);
})();
