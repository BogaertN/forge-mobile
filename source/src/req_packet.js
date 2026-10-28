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
  const C = {
    drift: 'drift n and rho stay distinguished and are not a manuscript identity',
    phase: 'phase ablation stubs stay unmeasured reconstructions',
    echo: 'echo false rates on recorded surfaces stay research-only',
    gates: 'mobile drift gates stay Nic 0.35 and are not the paper bands',
    ver: 'version, registry, CONFLICTS, and NEXT_BUILD name 4.9.118 and leave dream and creative writing unstarted'
  };
  const D = {
    propose: 'a memory resurrect is a proposal and does not write memory, the world head, or the shared KB',
    commit: 'a separate commit tap is the only resurrection store',
    phrase: 'a resurrection phrase stages a proposal and still does not write',
    route: 'must_archive is a containment route input after ghost and before dream',
    inspect: 'a must_archive turn names the route on inspect and writes nothing',
    quiet: 'dream, phrase, and quarantine turns do not silently write past echo',
    copy: 'product copy refuses hardware SPC and automatic ChristPing and keeps chi as the correction function',
    ver: 'version, registry, CONFLICTS, and NEXT_BUILD name 4.9.119 and leave creative writing unstarted'
  };
  const E = {
    unbound: 'an unanchored invent is CREATE and refuses an unbound novelty',
    project: 'a projectable hypothesis is CREATE and a tap commits the idea record only',
    quarantine: 'explore alternatives speaks a quarantine idea and a tap does not store it',
    hard: 'a hard drift seal is refused and a seal without a proposal is refused',
    guard: 'explore ideas stays PROPOSE_EVIDENCE and a question about an idea stays READ',
    ver: 'version, registry, CONFLICTS, and NEXT_BUILD name 4.9.120 and leave COMPOSE and Suppose unstarted'
  };
  const F = {
    none: 'compose that idea with no proposal is COMPOSE and refuses commit_without_proposal',
    project: 'a projectable idea composes to a multi-sentence paragraph that exact-Echoes and a tap still commits the record only',
    quarantine: 'a quarantine idea stays a speculative branch when written out and a tap still refuses it',
    unbound: 'an unbound novelty spoken as a discovery is refused',
    express: 'an empty claim is language_unexpressible and an Echo miss blocks the paragraph',
    meaning: 'compose that meaning narrates the selected MSM and does not open an idea record',
    guard: 'CREATE, EXPLORE, READ, PROPOSE_EVIDENCE, and SIMULATE stay on their own intents',
    ver: 'version, registry, CONFLICTS, and NEXT_BUILD name 4.9.121 and leave Suppose unstarted'
  };
  const G = {
    open: 'a suppose story opens an isolated simulation and does not write the world',
    cont: 'continuing the branch keeps the same simulation and the claim stays speculative',
    park: 'parking or ending the branch uses dream quarantine and does not write the world',
    world: 'a world-write attempt is refused and the world head stays',
    unbound: 'an unbound novelty spoken as a discovery is refused',
    none: 'commit the branch with no simulation is commit_without_proposal',
    echo: 'an Echo miss blocks the simulation and stores nothing',
    guard: 'a syllogism Suppose, a bare Suppose, and a dynamics what-if stay on their routes',
    ver: 'version, registry, CONFLICTS, and NEXT_BUILD name 4.9.122 and leave the next creative unstarted'
  };
  const H = {
    expand: 'a projectable idea expands beyond the claim into roles, anchors, and a lexicon gloss',
    phrase: 'compose phrases still route to COMPOSE and each one expands the same idea',
    quarantine: 'a quarantine idea expands and stays non-projectable',
    refuse: 'compose refusals stay commit_without_proposal, novelty_unbound, drift_hard, and language_unexpressible',
    meaning: 'compose that meaning expands the selected clause and does not store',
    echo: 'an Echo miss blocks the expansion and stores nothing',
    ver: 'version, registry, CONFLICTS, and NEXT_BUILD name 4.9.123 and leave the confirmed-facts design unstarted'
  };
  const I = {
    seed: 'a cleared starter leaves invent unbound and an installed starter anchors invent',
    compose: 'compose uses starter anchors and names starter pack provenance',
    clear: 'Clear starter knowledge restores unbound invent and does not write memory or shared knowledge',
    audit: 'Audit and the starter view name starter_pack and creative paths do not store confirmed facts',
    ver: 'version, registry, CONFLICTS, and NEXT_BUILD name 4.9.124 and leave import and a shared write unstarted'
  };
  const J = {
    admit: 'a valid pack admits confirmed anchors and leaves starter and remembered facts in place',
    hold: 'a contested import stays held until a tap admits it',
    refuse: 'a bad pack refuses with a typed receipt and writes no anchor',
    anchor: 'invent and compose use a newly admitted import anchor',
    quiet: 'create compose and simulate do not store confirmed facts and Clear starter still works',
    audit: 'Audit shows the import receipt and the Memory screen has Import next to starter',
    budget: 'the single-file budget stays within 1.920 MB raw and 570 kB gzip',
    ver: 'version, registry, CONFLICTS, and NEXT_BUILD name 4.9.125 and leave a shared write unstarted'
  };
  const K = {
    chrome: 'chrome, nav, typography, and spacing carry the calm shell markers',
    pills: 'Doc 7 status pills and calm empty states name projectable contested quarantine hypothesis',
    discover: 'Ask shows invent and compose discoverability one-liners without hiding them behind Advanced',
    next: 'UNSUPPORTED and dead-end turns show a gentle next-step redirect',
    onboard: 'starter onboarding one-liner names starter_pack and keeps Clear starter knowledge reachable',
    reach: 'non-negotiables stay reachable: gates, packet export, Audit, Ideas tap, Remember, invent/compose/suppose, Clear starter, Import',
    budget: 'the single-file budget stays within 1.920 MB raw and 570 kB gzip',
    ver: 'version, registry, CONFLICTS, and NEXT_BUILD name 4.9.126 and leave a deep IA rewrite and a shared write unstarted'
  };
  const M = {
    pack: 'letter-A FORGE-CONFIRMED-PACK/v1 confirmed_shared',
    gate: 'curator admit confirmed_shared without tap',
    invent: 'invent compose prefer confirmed_shared',
    memory: 'memory wins over confirmed_shared; scrapbook empty',
    quiet: 'CREATE COMPOSE SIMULATE no auto-write confirmed_shared',
    audit: 'Audit names confirmed_shared; packs not in single',
    ver: 'version registry CONFLICTS NEXT_BUILD name 4.9.127'
  };
  const N = {
    pull: 'pull hosted shared knowledge without write key; phone DB stays empty',
    write: 'write without key refuses; write with Nic key mutates session only',
    invent: 'invent compose prefer hosted shared knowledge; speech names it',
    az: 'hosted A-Z index and packs',
    ver: 'version registry CONFLICTS NEXT_BUILD name 4.9.142'
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
    ] },
    { schema: SCHEMA, release: '4.9.118', requirements: [
      { id: 'R4118-NONEQ', statement: 'Math honesty is research-only and is not a manuscript equivalence.', falsify: 'A research divisor or a phase stub is treated as the Mobile write law or as a verified manuscript number.', tests: [L('R4118.drift', 'r4118_suite.js', 'R4118', C.drift, 'CALIBRATION'), L('R4118.phase', 'r4118_suite.js', 'R4118', C.phase, 'NEGATIVE'), L('R4118.echo', 'r4118_suite.js', 'R4118', C.echo, 'CALIBRATION'), L('R4118.gates', 'r4118_suite.js', 'R4118', C.gates, 'REGRESSION'), L('R4118.ver', 'r4118_suite.js', 'R4118', C.ver, 'REGRESSION')] }
    ] },
    { schema: SCHEMA, release: '4.9.119', requirements: [
      { id: 'R4119-DREAM', statement: 'Resurrection is a proposal, must_archive is a route input, and dream, SPC, and quarantine do not silently write.', falsify: 'Seven gates store memory, must_archive stays a side flag, or a dream or quarantine turn writes memory or the world head.', tests: [L('R4119.propose', 'r4119_suite.js', 'R4119', D.propose, 'POSITIVE'), L('R4119.commit', 'r4119_suite.js', 'R4119', D.commit, 'POSITIVE'), L('R4119.phrase', 'r4119_suite.js', 'R4119', D.phrase, 'POSITIVE'), L('R4119.route', 'r4119_suite.js', 'R4119', D.route, 'REGRESSION'), L('R4119.inspect', 'r4119_suite.js', 'R4119', D.inspect, 'ADVERSARIAL'), L('R4119.quiet', 'r4119_suite.js', 'R4119', D.quiet, 'NEGATIVE'), L('R4119.copy', 'r4119_suite.js', 'R4119', D.copy, 'REGRESSION'), L('R4119.ver', 'r4119_suite.js', 'R4119', D.ver, 'REGRESSION')] }
    ] },
    { schema: SCHEMA, release: '4.9.120', requirements: [
      { id: 'R4120-IDEA', statement: 'CREATE and EXPLORE carry novelty and drift. An unbound novelty is not a discovery. A quarantine idea may be spoken. A tap commits the idea record only.', falsify: 'A creative phrase is READ, an unbound novelty is spoken as a discovery, a quarantine tap writes memory or the world head, or a seal without a proposal stores a row.', tests: [L('R4120.unbound', 'r4120_suite.js', 'R4120', E.unbound, 'NEGATIVE'), L('R4120.project', 'r4120_suite.js', 'R4120', E.project, 'POSITIVE'), L('R4120.quarantine', 'r4120_suite.js', 'R4120', E.quarantine, 'ADVERSARIAL'), L('R4120.hard', 'r4120_suite.js', 'R4120', E.hard, 'NEGATIVE'), L('R4120.guard', 'r4120_suite.js', 'R4120', E.guard, 'REGRESSION'), L('R4120.ver', 'r4120_suite.js', 'R4120', E.ver, 'REGRESSION')] }
    ] },
    { schema: SCHEMA, release: '4.9.121', requirements: [
      { id: 'R4121-COMPOSE', statement: 'COMPOSE narrates a selected idea or MSM as multi-sentence Language Core prose. The paragraph exact-Echoes. Claim status stays visible. Memory, the world head, and the shared KB stay unchanged.', falsify: 'A compose phrase is READ or EXPLAIN, an unbound novelty is spoken as a discovery, a paragraph writes memory or the world head, or a compose with no proposal stores a row.', tests: [L('R4121.none', 'r4121_suite.js', 'R4121', F.none, 'NEGATIVE'), L('R4121.project', 'r4121_suite.js', 'R4121', F.project, 'POSITIVE'), L('R4121.quarantine', 'r4121_suite.js', 'R4121', F.quarantine, 'ADVERSARIAL'), L('R4121.unbound', 'r4121_suite.js', 'R4121', F.unbound, 'NEGATIVE'), L('R4121.express', 'r4121_suite.js', 'R4121', F.express, 'ADVERSARIAL'), L('R4121.meaning', 'r4121_suite.js', 'R4121', F.meaning, 'POSITIVE'), L('R4121.guard', 'r4121_suite.js', 'R4121', F.guard, 'REGRESSION'), L('R4121.ver', 'r4121_suite.js', 'R4121', F.ver, 'REGRESSION')] }
    ] },
    { schema: SCHEMA, release: '4.9.122', requirements: [
      { id: 'R4122-SUPPOSE', statement: 'A Suppose story is an isolated SIMULATE branch. The surface names it a counterfactual simulation. Parking it uses dream quarantine. It does not write the world head, memory, or the shared KB.', falsify: 'A story suppose is spoken as a fact, a park writes the world, or a world-write, an unbound discovery, or a commit with no branch is stored.', tests: [L('R4122.open', 'r4122_suite.js', 'R4122', G.open, 'POSITIVE'), L('R4122.cont', 'r4122_suite.js', 'R4122', G.cont, 'POSITIVE'), L('R4122.park', 'r4122_suite.js', 'R4122', G.park, 'ADVERSARIAL'), L('R4122.world', 'r4122_suite.js', 'R4122', G.world, 'NEGATIVE'), L('R4122.unbound', 'r4122_suite.js', 'R4122', G.unbound, 'NEGATIVE'), L('R4122.none', 'r4122_suite.js', 'R4122', G.none, 'NEGATIVE'), L('R4122.echo', 'r4122_suite.js', 'R4122', G.echo, 'ADVERSARIAL'), L('R4122.guard', 'r4122_suite.js', 'R4122', G.guard, 'REGRESSION'), L('R4122.ver', 'r4122_suite.js', 'R4122', G.ver, 'REGRESSION')] }
    ] },
    { schema: SCHEMA, release: '4.9.123', requirements: [
      { id: 'R4123-COMPOSE', statement: 'COMPOSE expands a staged idea or a selected meaning into several Language Core sentences that develop the idea. The paragraph exact-Echoes. Claim status stays visible. Memory, the world head, and the shared KB stay unchanged.', falsify: 'Compose only restates the claim, a compose phrase is READ or EXPLAIN, the expansion writes memory, the world head, or the shared KB, or a refusal stores a row.', tests: [L('R4123.expand', 'r4123_suite.js', 'R4123', H.expand, 'POSITIVE'), L('R4123.phrase', 'r4123_suite.js', 'R4123', H.phrase, 'POSITIVE'), L('R4123.quarantine', 'r4123_suite.js', 'R4123', H.quarantine, 'ADVERSARIAL'), L('R4123.refuse', 'r4123_suite.js', 'R4123', H.refuse, 'NEGATIVE'), L('R4123.meaning', 'r4123_suite.js', 'R4123', H.meaning, 'POSITIVE'), L('R4123.echo', 'r4123_suite.js', 'R4123', H.echo, 'ADVERSARIAL'), L('R4123.ver', 'r4123_suite.js', 'R4123', H.ver, 'REGRESSION')] }
    ] },
    { schema: SCHEMA, release: '4.9.124', requirements: [
      { id: 'R4124-SEED', statement: 'A small on-device starter pack is confirmed on first open. CREATE and COMPOSE use it when memory has no anchors. Provenance is starter_pack. Clear starter knowledge removes it. Memory and the shared KB stay unchanged.', falsify: 'A fresh invent is unbound while the pack is present, compose says the user told the kernel, Clear writes memory or shared knowledge, or a creative path stores a confirmed fact.', tests: [L('R4124.seed', 'r4124_suite.js', 'R4124', I.seed, 'POSITIVE'), L('R4124.compose', 'r4124_suite.js', 'R4124', I.compose, 'POSITIVE'), L('R4124.clear', 'r4124_suite.js', 'R4124', I.clear, 'NEGATIVE'), L('R4124.audit', 'r4124_suite.js', 'R4124', I.audit, 'ADVERSARIAL'), L('R4124.ver', 'r4124_suite.js', 'R4124', I.ver, 'REGRESSION')] }
    ] },
    { schema: SCHEMA, release: '4.9.125', requirements: [
      { id: 'R4125-IMPORT', statement: 'A person can load a confirmed pack. Confirmed items are admitted. Contested items stay held until a tap. A bad pack is a typed refusal. Import does not write shared knowledge.', falsify: 'A valid pack writes shared knowledge, a contested item is projectable before a tap, a bad pack is admitted, invent ignores a newly admitted anchor, or a creative path stores a confirmed fact.', tests: [L('R4125.admit', 'r4125_suite.js', 'R4125', J.admit, 'POSITIVE'), L('R4125.hold', 'r4125_suite.js', 'R4125', J.hold, 'ADVERSARIAL'), L('R4125.refuse', 'r4125_suite.js', 'R4125', J.refuse, 'NEGATIVE'), L('R4125.anchor', 'r4125_suite.js', 'R4125', J.anchor, 'POSITIVE'), L('R4125.quiet', 'r4125_suite.js', 'R4125', J.quiet, 'NEGATIVE'), L('R4125.audit', 'r4125_suite.js', 'R4125', J.audit, 'ADVERSARIAL'), L('R4125.budget', 'r4125_suite.js', 'R4125', J.budget, 'REGRESSION'), L('R4125.ver', 'r4125_suite.js', 'R4125', J.ver, 'REGRESSION')] }
    ] },
    { schema: SCHEMA, release: '4.9.126', requirements: [
      { id: 'R4126-SHELL', statement: 'Calm chrome, Doc 7 status pills, and empty states with one next step. Power surfaces stay reachable. Soft budget unchanged.', falsify: 'A power surface is removed, Doc 7 pills are absent, empty states hide the next step, or the soft budget rises.', tests: [L('R4126.chrome', 'r4126_suite.js', 'R4126', K.chrome, 'POSITIVE'), L('R4126.pills', 'r4126_suite.js', 'R4126', K.pills, 'POSITIVE'), L('R4126.budget', 'r4126_suite.js', 'R4126', K.budget, 'REGRESSION')] },
      { id: 'R4126-COPY', statement: 'Invent and compose discoverability one-liners stay visible. UNSUPPORTED turns show a gentle next-step redirect.', falsify: 'Invent is Advanced-only, compose is unnamed, or an unsupported turn has no next step.', tests: [L('R4126.discover', 'r4126_suite.js', 'R4126', K.discover, 'POSITIVE'), L('R4126.next', 'r4126_suite.js', 'R4126', K.next, 'ADVERSARIAL')] },
      { id: 'R4126-REACH', statement: 'Starter onboarding names starter_pack. Clear starter knowledge and Import confirmed facts stay reachable. Shared KB stays empty. A deep IA rewrite is not started.', falsify: 'Clear starter is removed, Import is removed, shared knowledge is written, or a deep IA rewrite ships.', tests: [L('R4126.onboard', 'r4126_suite.js', 'R4126', K.onboard, 'POSITIVE'), L('R4126.reach', 'r4126_suite.js', 'R4126', K.reach, 'ADVERSARIAL'), L('R4126.ver', 'r4126_suite.js', 'R4126', K.ver, 'REGRESSION')] }
    ] },
    { schema: SCHEMA, release: '4.9.127', requirements: [
      { id: 'R4127-GATE', statement: 'Curator packs admit confirmed_shared; contested held; creative never auto-write; scrapbook empty.', falsify: 'Pack needs tap, contested projects, creative writes confirmed_shared, or scrapbook gains row.', tests: [L('R4127.gate', 'r4127_suite.js', 'R4127', M.gate, 'POSITIVE'), L('R4127.quiet', 'r4127_suite.js', 'R4127', M.quiet, 'NEGATIVE'), L('R4127.memory', 'r4127_suite.js', 'R4127', M.memory, 'ADVERSARIAL')] },
      { id: 'R4127-LETTER-A', statement: 'Hosted a.json is FORGE-CONFIRMED-PACK/v1; invent/compose prefer confirmed_shared.', falsify: 'Letter A missing, invent ignores confirmed_shared, says shared KB, or packs in single.', tests: [L('R4127.pack', 'r4127_suite.js', 'R4127', M.pack, 'POSITIVE'), L('R4127.invent', 'r4127_suite.js', 'R4127', M.invent, 'POSITIVE')] },
      { id: 'R4127-PROV', statement: 'Audit names confirmed_shared; no shared KB; budget unchanged.', falsify: 'Audit omits confirmed_shared, UI shared KB, budget rises, or scrapbook written.', tests: [L('R4127.audit', 'r4127_suite.js', 'R4127', M.audit, 'ADVERSARIAL'), L('R4127.ver', 'r4127_suite.js', 'R4127', M.ver, 'REGRESSION')] }
    ] },
    { schema: SCHEMA, release: '4.9.142', requirements: [
      { id: 'R4128-HOSTED', statement: 'Hosted A–Z shared knowledge pulls into session RAM for invent/compose. Phone DB is not the product brain. Scrapbook stays empty.', falsify: 'Pull writes thousands of facts into phone confirmed_shared or scrapbook, or invent ignores hosted anchors.', tests: [L('R4128.pull', 'r4128_suite.js', 'R4128', N.pull, 'POSITIVE'), L('R4128.invent', 'r4128_suite.js', 'R4128', N.invent, 'POSITIVE')] },
      { id: 'R4128-WRITE-KEY', statement: 'Write to shared knowledge refuses without Nic write key. Read/pull needs no key.', falsify: 'admitConfirmedShared or writeSharedKnowledge succeeds with only productCurator true, or pull requires a key.', tests: [L('R4128.write', 'r4128_suite.js', 'R4128', N.write, 'ADVERSARIAL')] },
      { id: 'R4128-AZ', statement: 'Index 4.9.142 hosts all 26 letters with ≥1890 admitted items (4161 / 4399 curated); UI/Audit name Shared knowledge base.', falsify: 'Letters missing, count below floor, or UI still hides shared knowledge naming.', tests: [L('R4128.az', 'r4128_suite.js', 'R4128', N.az, 'POSITIVE'), L('R4128.ver', 'r4128_suite.js', 'R4128', N.ver, 'REGRESSION')] }
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
