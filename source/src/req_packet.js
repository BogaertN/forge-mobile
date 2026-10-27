/* 4.9.117: requirement → test packet. The verify run fills pass or fail.
 * Behavior totals and verifier gates stay apart (GP-015). This file does not choose a route or write memory. */
(function (root) {
  const SCHEMA = 'FORGE-REQ-PACKET/v1', RECEIPT = 'FORGE-NONLLM-RECEIPT/v1';
  const DOC9_CLASSES = ['POSITIVE', 'NEGATIVE', 'AMBIGUITY', 'ADVERSARIAL', 'REGRESSION', 'NON-LLM SCAN', 'PRIVACY', 'ROUND-TRIP', 'CALIBRATION', 'DETERMINISM'];
  const A = {
    ack: 'misplaced keys, bandaged wound, preheated oven, unplugged kettle, and marinated tofu are acknowledged',
    smell: 'the room smells of bread uses the of-frame and adds no smell concept',
    block: 'bandage the wound is understood and blocked, with the frame and no write',
    noun: 'a bandage noun is not the verb concept',
    recall: 'remember, who, and did answer from the bandaged-wound fact',
    echo: 'a recognized preheat frame does not approve a changed Echo',
    stems: 'defrost, reheat, and recycle stay on their existing stems',
    receipt: 'the trace and the receipt show the concept and frame ids',
    record: 'version, registry, CONFLICTS, and NEXT_BUILD name 4.9.116 and leave creative writing unstarted'
  };
  const B = {
    map: 'the 4.9.116 packet maps each requirement id to tests in that suite',
    gate: 'a green behavior result does not override a failed gate',
    scan: 'the authority-path receipt is the Doc 9 non-model scan',
    tool: 'the requirement tool prints the packet and the receipt',
    audit: 'Audit shows the requirement packet',
    wire: 'the targeted gate writes the packet and the release check uses one decision',
    ver: 'version, registry, CONFLICTS, and NEXT_BUILD name 4.9.117 and leave the later queue unstarted'
  };
  const L = (id, suite, cls, name, doc9_class) => ({ id, suite, cls, name, doc9_class });
  const PACKETS = [
    { schema: SCHEMA, release: '4.9.116', requirements: [
      { id: 'R4116-LEXICON', statement: 'Five concepts. A word is not a concept, a concept is not evidence, and evidence is not permission.', falsify: 'An acknowledgement stores memory, or a concept id is used as evidence.', tests: [L('R4116.ack', 'r4116_suite.js', 'R4116', A.ack, 'POSITIVE'), L('R4116.noun', 'r4116_suite.js', 'R4116', A.noun, 'NEGATIVE'), L('R4116.recall', 'r4116_suite.js', 'R4116', A.recall, 'POSITIVE'), L('R4116.stems', 'r4116_suite.js', 'R4116', A.stems, 'NEGATIVE'), L('R4116.record', 'r4116_suite.js', 'R4116', A.record, 'REGRESSION')] },
      { id: 'R4116-FRAMES', statement: 'Seven frames. Recognizing a frame does not execute, write, or approve Echo.', falsify: 'A recognized frame executes, writes, or approves Echo.', tests: [L('R4116.ack', 'r4116_suite.js', 'R4116', A.ack, 'POSITIVE'), L('R4116.smell', 'r4116_suite.js', 'R4116', A.smell, 'POSITIVE'), L('R4116.block', 'r4116_suite.js', 'R4116', A.block, 'NEGATIVE'), L('R4116.echo', 'r4116_suite.js', 'R4116', A.echo, 'ADVERSARIAL'), L('R4116.receipt', 'r4116_suite.js', 'R4116', A.receipt, 'REGRESSION'), L('R4116.record', 'r4116_suite.js', 'R4116', A.record, 'REGRESSION')] }
    ] },
    { schema: SCHEMA, release: '4.9.117', requirements: [
      { id: 'R4117-TRACE', statement: 'A slice names requirement ids, test ids, and a blank template.', falsify: 'A requirement id has no test in the suite.', tests: [L('R4117.map', 'r4117_suite.js', 'R4117', B.map, 'REGRESSION'), L('R4117.tool', 'r4117_suite.js', 'R4117', B.tool, 'REGRESSION'), L('R4117.audit', 'r4117_suite.js', 'R4117', B.audit, 'REGRESSION'), L('R4117.ver', 'r4117_suite.js', 'R4117', B.ver, 'REGRESSION')] },
      { id: 'R4117-GATES', statement: 'A passing behavior run does not override a failed gate.', falsify: 'A passing behavior total makes a failed gate pass.', tests: [L('R4117.gate', 'r4117_suite.js', 'R4117', B.gate, 'REGRESSION'), L('R4117.wire', 'r4117_suite.js', 'R4117', B.wire, 'REGRESSION')] },
      { id: 'R4117-NONLLM', statement: 'The authority path keeps the Doc 9 non-model scan.', falsify: 'The authority-path scan accepts a model call.', tests: [L('R4117.scan', 'r4117_suite.js', 'R4117', B.scan, 'NON-LLM SCAN')] }
    ] }
  ];
  const TEMPLATE = { schema: SCHEMA, release: '', requirements: [], decision: { law: 'GP-015', behavior_overrides_gate: false, both_required: true }, non_llm: { schema: RECEIPT, files: [], checks: [] }, named_outside_gate: [] };
  const OUTSIDE_TARGETED = [
    { id: 'HELDOUT-EVAL', where: 'verify/heldout_suite.js', scores: 'reported_not_required', in_targeted_gate: false },
    { id: 'MUTATION-EVAL', where: 'verify/mutation_suite.js', scores: 'reported_not_required', in_targeted_gate: false }
  ];
  const packet = release => PACKETS.find(p => p.release === release) || null;
  function releaseDecision(behavior, gates) {
    const b = behavior || {}, behavior_ok = b.failed === 0 && b.not_run === 0 && b.passed === b.total && b.total > 0, gates_ok = !!(gates && gates.ok === true);
    return { law: 'GP-015', behavior_overrides_gate: false, both_required: true, behavior_ok, gates_ok, ok: behavior_ok && gates_ok };
  }
  function evidence(results) {
    const rows = results || [];
    const packets = PACKETS.map(slice => {
      const requirements = slice.requirements.map(req => {
        const tests = req.tests.map(t => { const hit = rows.find(r => String(r.cls).toUpperCase() === t.cls && r.name === t.name); return Object.assign({}, t, { ok: hit ? !!hit.ok : null, not_run: !!(hit && hit.not_run), missing: !hit }); });
        return Object.assign({}, req, { tests, ok: tests.length > 0 && tests.every(t => t.ok === true && !t.not_run && !t.missing) });
      });
      return Object.assign({}, slice, { requirements, requirements_ok: requirements.every(r => r.ok) });
    });
    return { schema: SCHEMA, packets };
  }
  function linksMissing(root) {
    const fs = require('fs'), path = require('path'), missing = [];
    for (const slice of PACKETS) for (const req of slice.requirements) {
      if (!req.falsify) missing.push(req.id);
      for (const t of req.tests) {
        if (!DOC9_CLASSES.includes(t.doc9_class)) missing.push(t.id);
        let src = ''; try { src = fs.readFileSync(path.join(root, 'verify', t.suite), 'utf8'); } catch (e) { src = ''; }
        if (!src.includes(t.name)) missing.push(t.id);
      }
    }
    return missing;
  }
  function auditCard() {
    let body = '';
    for (const slice of PACKETS) for (const req of slice.requirements) body += '<div><b>' + req.id + '</b> ' + req.tests.map(t => t.id).join(', ') + '</div>';
    return '<div class="card"><div class="cardhead">Requirement packet</div><div class="small">Schema ' + SCHEMA + '.</div>' + body + '<div class="small">A passing behavior run does not override a failed gate.</div></div>';
  }
  const api = { SCHEMA, RECEIPT_SCHEMA: RECEIPT, DOC9_CLASSES, PACKETS, TEMPLATE, OUTSIDE_TARGETED, packet, releaseDecision, evidence, linksMissing, auditCard };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.KReqPacket = api;
})(typeof self !== 'undefined' ? self : this);
