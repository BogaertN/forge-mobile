/* Step 16, first slice. Remember two premises, ask the chain, do not auto-save the derived
 * answer, explicitly remember that answer, and recall it. The trace stages stay in order. */
const AP = require('./ask_path.js');
const ORDER = ['input_event', 'memory_recall_trace_spine', 'phase_parser', 'structural_drift_engine', 'protoforge2_drift_adapter', 'candidate_generator', 'evolutionary_drift_explorer', 'coherence_scorer', 'containment_router', 'chi_correction_gate_preview', 'storage_target_preview', 'resurrection_eligibility_preview', 'manifest_eligibility_check', 'output_renderer_eligibility_check', 'echo_validation_eligibility_check', 'memory_write_eligibility_check'];
function register(C, expect) {
  C('STEP16', 'a chain is spoken, not stored, then an explicit remember is what the next ask recalls', () => {
    const s = AP.session();
    const a = AP.remember(s, 'remember that a wren is a bird');
    const b = AP.remember(s, 'remember that a bird is an animal');
    const asked = AP.ask(s, 'is a wren an animal?');
    const ids = ((asked.trace && asked.trace.stages) || []).map(x => x.stage_id);
    const order = ORDER.every((id, i) => ids[i] === id);
    expect(a.ok && a.text === 'A wren is a bird.' && b.ok && b.text === 'A bird is an animal.', JSON.stringify({ a: a.rule, b: b.rule }));
    expect(asked.product_reply === true && asked.reply === 'A wren is a bird. A bird is an animal. A wren is an animal.' && s.phone.length === 2 && order, JSON.stringify({ reply: asked.reply, n: s.phone.length, ids }));
    const kept = AP.remember(s, 'remember that a wren is an animal');
    const again = AP.ask(s, 'is a wren an animal?');
    expect(kept.ok && kept.text === 'A wren is an animal.' && s.phone.length === 3, JSON.stringify(kept));
    expect(again.product_reply === true && again.reply === 'A wren is an animal.' && again.calls_llm === false, JSON.stringify({ reply: again.reply, calls: again.calls_llm }));
    const derive = asked.world_model && asked.world_model.derive;
    const survivor = derive && derive.survivor;
    const outward = asked.outward;
    const roles = outward && (outward.sentences || []).map(x => x.role);
    const keys = Object.keys(asked.trace || {});
    const layer = ['input', 'memory', 'world_model', 'admit', 'echo', 'output'];
    const layerOrder = layer.every((k, i) => keys.indexOf(k) > (i ? keys.indexOf(layer[i - 1]) : -1));
    expect(derive && derive.status === 'supported_only' && survivor && survivor.how === 'WM-COPULA-CHAIN' && survivor.checker_ok === true, JSON.stringify({ status: derive && derive.status, how: survivor && survivor.how }));
    expect(roles && roles.join(',') === 'premise,premise,conclusion' && outward.sentences[2].atom.args.join('|') === 'a wren|an animal' && asked.echo && asked.echo.pass === true && asked.admit && asked.admit.disposition === 'admit' && layerOrder, JSON.stringify({ roles, keys }));
    const next = AP.session();
    next.phone.push(s.phone[2]);
    const recalled = AP.ask(next, 'is a wren an animal?');
    expect(recalled.product_reply === true && recalled.reply === 'A wren is an animal.', JSON.stringify({ reply: recalled.reply }));
  });
  C('STEP16', 'a held gap resumes in order: held, Neo, Athena, Gilligan, resumed', async () => {
    const CU = require('../src/curators_208.js');
    const Neo = require('../src/neo.js');
    const mem = {};
    let researched = [];
    const reply = 'the mass of sample is 1';
    const c = CU.Curators({
      store: { get: k => mem[k], set: (k, v) => { mem[k] = JSON.parse(JSON.stringify(v)); } },
      now: () => 1,
      anchorsFor: async () => [],
      research: async () => ({ rule: 'ATHENA-PROPOSED', proposals: [{ property: 'mass', head: 'sample', value: '1', k: 2, gilligan: 'GILLIGAN-STRUCTURE-OK', phone_remember: false, method: 'lookup', hosts: ['a.example', 'b.example'], publishers: [{ id: 'a' }, { id: 'b' }], lineages: ['a', 'b'], frame: { kriya: 'be', polarity: 'pos', kartr: { text: 'the mass of sample', head: 'mass', det: 'the', of: { text: 'sample', head: 'sample' } }, pred: { type: 'np', text: '1', head: '1' } } }] }),
      rememberResearch: rows => { researched = rows || []; },
      premises: () => researched.map(f => ({ id: 'athena:' + f.head + ':' + f.property, text: reply, clause: f.frame, provenance: { method: 'lookup', publishers: ['a', 'b'] } })),
      run: async () => ({ product_reply: true, reply: reply, coherence: 0.91, drift: 0.01, echo: { pass: true, score: 1 }, admit: { disposition: 'admit', drift_region: 'clean' }, trust: { low_trust: false, trusted_anchor: true, rests_on: 'athena:sample:mass', blocks_admit: false }, memory_write: { proposal: { text: reply, sfe: { Phi: 9, eps: 0.01, mu: 1 }, provenance: {} }, write_gate: { ok: true, failed: [], drift: { eps: 0.119 }, echo: 1, echo_classes: { ok: true }, coherence: 0.91, drift_status: 'stable' } } }),
      insert: async () => ({ ok: false, pending: true, rule: 'KB-WRITER-NO-SESSION' })
    });
    const n = Neo.create({ curators: () => c, now: () => 1 });
    const held = n.noteHeld('What is the mass of sample?', { product_reply: false, route: 'hold' }, { sim: { reason: 'property_missing', substance: 'sample', missing: 'mass' } });
    const tick = await n.tick();
    const events = n.resumeTrace(n.forQuestion('What is the mass of sample?'));
    expect(held.ok === true && tick.rule === 'KB-WRITER-NO-SESSION' && tick.to === 'pending' && events.map(e => e.event).join('>') === 'held>neo>athena>gilligan>resumed' && events[2].rule === 'ATHENA-PROPOSED' && events[3].rule === 'KB-WRITER-NO-SESSION' && events.every(e => e.calls_llm === false), JSON.stringify({ held, tick: tick.rule, events }));
  });
}
module.exports = register;
if (require.main === module) {
  const jobs = [];
  register((cls, name, fn) => { jobs.push({ cls, name, fn }); }, (c, m) => { if (!c) throw new Error(m || 'fail'); });
  (async () => {
    const results = [];
    for (const j of jobs) {
      let ok = false, why = '';
      try { await j.fn(); ok = true; } catch (e) { why = String(e.message || e).slice(0, 500); }
      results.push({ cls: j.cls, name: j.name, ok, why });
    }
    console.log(JSON.stringify(results, null, 1));
    if (results.some(r => !r.ok)) process.exit(1);
  })();
}
