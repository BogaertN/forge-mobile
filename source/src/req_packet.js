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
    ver: 'version registry CONFLICTS NEXT_BUILD name 4.9.171'
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
        { schema: SCHEMA, release: '4.9.182', requirements: [
      { id: 'R4182-RMC-ENGINE', statement: 'Foundations only. A new core runs rmc_engine_v1 run_deep_dry_run, records thresholds, feeds receipts and KB into the memory recaller, and returns a trace. A world-model seam sits between recall and the admit gate and does not change memory. The existing Ask path still answers. No LLM. Packs stay gated.', falsify: 'The core skips run_deep_dry_run, memory is not fed, the world-model seam writes memory, or the version docs omit 4.9.182.', tests: [L('R4182.run', 'r4182_suite.js', 'R4182', 'the new core runs deep dry run and returns a trace', 'POSITIVE'), L('R4182.memory', 'r4182_suite.js', 'R4182', 'receipts and KB are visible to the memory recaller', 'POSITIVE'), L('R4182.seam', 'r4182_suite.js', 'R4182', 'the world-model seam sits between recall and the admit gate and does not apply', 'ADVERSARIAL'), L('R4182.ver', 'r4182_suite.js', 'R4182', 'version registry CONFLICTS NEXT_BUILD name 4.9.182', 'REGRESSION')] }
    ] },
        { schema: SCHEMA, release: '4.9.181', requirements: [
      { id: 'R4181-ASK-KEYS', statement: 'An admitted row is indexed by the question that produced it. The same question and a reword recall it before AQ-1. A lead sentence that failed a raw parse is simplified until the grammar round-trips. Drift and chi still gate the bank. Gzip leave is at least 5 kB under 570 kB. No LLM.', falsify: 'A re-ask of an admitted Jupiter, chloramine, Mars, or paper row starts AQ-1, a DNA or by-which lead stays unparsed, drift above 0.80 is admitted, or the portable file drops below 5 kB of gzip leave.', tests: [L('R4181.parse', 'r4181_suite.js', 'R4181', 'lead sentences for DNA, Ada, gravity, and a by-which paper round-trip', 'POSITIVE'), L('R4181.recall', 'r4181_suite.js', 'R4181', 'the four 4.9.180 recall misses are indexed and recalled before AQ-1', 'POSITIVE'), L('R4181.gate', 'r4181_suite.js', 'R4181', 'a parsed sentence above 0.80 still recenters and does not write', 'ADVERSARIAL'), L('R4181.ver', 'r4181_suite.js', 'R4181', 'version registry CONFLICTS NEXT_BUILD name 4.9.181', 'REGRESSION')] }
    ] },
        { schema: SCHEMA, release: '4.9.180', requirements: [
      { id: 'R4180-ATHENA-DOC', statement: 'Athena document tools that fit the no-LLM loop are built. A fetched sentence that fails a raw parse is normalized and admitted when drift is at or under 0.35. The next Ask recalls it. Bleach mixed with ammonia is chloramine gas. ProtoForge has a local definition. Packs stay gated. No LLM.', falsify: 'A parseable fetched answer stays out of the bank, a re-ask misses an admitted sentence, bleach is only nitrogen trichloride, protoforge has no definition, community nodes publish a pack, or a payment tool is built.', tests: [L('R4180.proto', 'r4180_suite.js', 'R4180', 'what is protoforge answers the local definition and a command stays internal', 'POSITIVE'), L('R4180.parse', 'r4180_suite.js', 'R4180', 'an HTML sentence and a which-clause admit and the next Ask recalls them', 'POSITIVE'), L('R4180.hazard', 'r4180_suite.js', 'R4180', 'bleach and ammonia headlines chloramine gas and does not give a procedure', 'ADVERSARIAL'), L('R4180.athena', 'r4180_suite.js', 'R4180', 'seventeen Athena tools are wired and sixty-seven stays are skipped', 'POSITIVE'), L('R4180.gates', 'r4180_suite.js', 'R4180', 'hard drift, a locked passcode, and pack publish stay refused', 'ADVERSARIAL'), L('R4180.ver', 'r4180_suite.js', 'R4180', 'version registry CONFLICTS NEXT_BUILD name 4.9.180', 'REGRESSION')] }
    ] },
        { schema: SCHEMA, release: '4.9.179', requirements: [
      { id: 'R4179-FORGE2-WIRING', statement: 'Forge2 contracts seal the learning loop. A how-question runs language.core, research.web fetches, Athena admits, Gilligan re-curates, and the next Ask recalls the hosted sentence. A model candidate and an unrestricted network effect stay refused. Packs stay gated. No LLM.', falsify: 'A public how-question stops at a vault prompt, a protoforge question is blocked before language.core, a lawful admit is not recalled, or the successor receipt is missing.', tests: [L('R4179.core', 'r4179_suite.js', 'R4179', 'language.core answers a public how-question and a protoforge question', 'POSITIVE'), L('R4179.loop', 'r4179_suite.js', 'R4179', 'a real question runs Ask, research.web, Athena, Gilligan, the hosted bank, and recall', 'POSITIVE'), L('R4179.ver', 'r4179_suite.js', 'R4179', 'version registry CONFLICTS NEXT_BUILD name 4.9.179', 'REGRESSION')] }
    ] },
        { schema: SCHEMA, release: '4.9.178', requirements: [
      { id: 'R4178-GILLIGAN-CODEX', statement: 'Gilligan Codex engines run on the learning loop. A measured Ask is admitted and later recalled. ChristPing stays armed and Gilligan-only. Dream rehearsal and resurrection do not write until the gates pass. Token payouts, biometric sensors, a phase skip, and a bare sigil stay refused. No LLM. Packs stay gated. Pattern Reflection is not the Codex.', falsify: 'A lawful admit is not recalled, Athena initiates ChristPing, a dream row becomes the hosted bank, a payout or a sensor reading is accepted, or the version docs omit 4.9.178.', tests: [L('R4178.inventory', 'r4178_suite.js', 'R4178', 'Codex inventory builds the engines and skips money and hardware', 'POSITIVE'), L('R4178.loop', 'r4178_suite.js', 'R4178', 'a measured Ask becomes an Athena admit and a later Ask recalls it', 'POSITIVE'), L('R4178.christ', 'r4178_suite.js', 'R4178', 'hard drift arms ChristPing and Athena cannot initiate it', 'ADVERSARIAL'), L('R4178.dream', 'r4178_suite.js', 'R4178', 'dream rehearsal and resurrection do not write until the gates pass', 'ADVERSARIAL'), L('R4178.refuse', 'r4178_suite.js', 'R4178', 'goal, token, biometric, phase skip, and a bare sigil stay refused', 'NEGATIVE'), L('R4178.ver', 'r4178_suite.js', 'R4178', 'version registry CONFLICTS NEXT_BUILD name 4.9.178', 'REGRESSION')] }
    ] },
        { schema: SCHEMA, release: '4.9.177', requirements: [
      { id: 'R4177-FORGE-TOOLS', statement: 'Forge phase parse and hosted recall run on the learning loop. Search and read stay inside the session bank. A hosted method sentence is reused without a fetch. Shell, payments, vector search, and a model call stay refused. No LLM. Packs stay gated.', falsify: 'Phase parse disagrees with Forge, an unrelated row outranks the hosted method, a device path or a vector backend is read, a fetch runs when the bank already has the method, or a shell or payment tool executes.', tests: [L('R4177.phase', 'r4177_suite.js', 'R4177', 'phase parse matches Forge and the word or inside before is not a polarity hit', 'POSITIVE'), L('R4177.recall', 'r4177_suite.js', 'R4177', 'hosted recall ranks the filament sentence and refuses a device path and a vector backend', 'ADVERSARIAL'), L('R4177.bank', 'r4177_suite.js', 'R4177', 'session search stays on the hosted bank and shell, patch, payment, and vector search are refused', 'ADVERSARIAL'), L('R4177.loop', 'r4177_suite.js', 'R4177', 'a hosted method sentence answers the pipeline without a fetch', 'POSITIVE'), L('R4177.ver', 'r4177_suite.js', 'R4177', 'version registry CONFLICTS NEXT_BUILD name 4.9.177', 'REGRESSION')] }
    ] },
        { schema: SCHEMA, release: '4.9.176', requirements: [
      { id: 'R4176-HELD-ADMIT', statement: 'A tap admits a contested held shared-knowledge row into the session bank when the write key is already held. A quarantine row stays held. Phone DB and letter packs are not written. Ask recalls the admitted sentence. No LLM.', falsify: 'A contested row stays held after the key and a tap, a quarantine row is admitted, the phone DB gains a fact, or recall starts AQ-1.', tests: [L('R4176.nokey', 'r4176_suite.js', 'R4176', 'a tap without a held write key leaves the contested row held', 'ADVERSARIAL'), L('R4176.admit', 'r4176_suite.js', 'R4176', 'a granted key admits the contested row and Ask recalls it before research', 'POSITIVE'), L('R4176.quar', 'r4176_suite.js', 'R4176', 'a quarantine held row stays held and does not become shared knowledge', 'ADVERSARIAL'), L('R4176.ver', 'r4176_suite.js', 'R4176', 'version registry CONFLICTS NEXT_BUILD name 4.9.176', 'REGRESSION')] }
    ] },
        { schema: SCHEMA, release: '4.9.175', requirements: [
      { id: 'R4175-PIPELINE-TOOLS', statement: 'A session write-key grant lets a measured claim admit into the hosted bank. research.web returns a method excerpt without reading the vault. A parseable excerpt is recalled before AQ-1. An open crawl is not admitted. No LLM. Packs stay gated.', falsify: 'A lawful admit stays at 0 after the key is held, a how/method fetch returns no excerpt or reads the vault, an open URL is promoted, or recall starts AQ-1.', tests: [L('R4175.key', 'r4175_suite.js', 'R4175', 'write key grant lets a measured claim admit and a missing key leaves the bank at 0', 'POSITIVE'), L('R4175.fetch', 'r4175_suite.js', 'R4175', 'research tool returns a method excerpt and does not answer from the vault', 'ADVERSARIAL'), L('R4175.recall', 'r4175_suite.js', 'R4175', 'a fetched method sentence admits under the granted key and Ask recalls it', 'POSITIVE'), L('R4175.refuse', 'r4175_suite.js', 'R4175', 'an open crawl and an unparsed excerpt are not admitted', 'ADVERSARIAL'), L('R4175.cold', 'r4175_suite.js', 'R4175', 'Gilligan cold re-curate writes the same hosted bank with the granted key', 'POSITIVE'), L('R4175.ask', 'r4175_suite.js', 'R4175', 'Ask still answers a how-method question from a Wikipedia-class source', 'POSITIVE'), L('R4175.phone', 'r4175_suite.js', 'R4175', 'phone access holds the key in the session, packs stay gated, and the portable file skips the tools', 'REGRESSION'), L('R4175.ver', 'r4175_suite.js', 'R4175', 'version registry CONFLICTS NEXT_BUILD name 4.9.175', 'REGRESSION'), L('R4175.receipt', 'r4175_suite.js', 'R4175', 'a buy-milk receipt hides patterns that do not apply and a math turn still names its route', 'REGRESSION'), L('R4175.hazard', 'r4175_suite.js', 'R4175', 'bleach and ammonia is answered from web evidence and mustard gas is a warning not a procedure', 'ADVERSARIAL')] }
    ] },
        { schema: SCHEMA, release: '4.9.174', requirements: [
      { id: 'R4174-LEARNING-LOOP', statement: 'Ask answers a how/method question from web excerpts. That measured evidence can be admitted to the hosted bank and later recalled. Unmeasured quarantine stays custody. No LLM. Packs stay gated.', falsify: 'How do lightbulbs work ends as NO_LAWFUL_CANDIDATE when a Wikipedia-class source states the method, or a lawful admit is not recalled before AQ-1, or a crawl-shaped payload is promoted.', tests: [L('R4174.admit', 'r4174_suite.js', 'R4174', 'research callback plus write key admits and the hosted bank grows from the write', 'POSITIVE'), L('R4174.bridge', 'r4174_suite.js', 'R4174', 'Ask research evidence becomes an Athena gap with curated extracts and a crawl shape is refused', 'ADVERSARIAL'), L('R4174.recall', 'r4174_suite.js', 'R4174', 'after a lawful admit Ask recalls the taught method from hosted knowledge', 'POSITIVE'), L('R4174.web', 'r4174_suite.js', 'R4174', 'a how-method question with a Wikipedia-class source is a research answer, not a gate refusal', 'POSITIVE'), L('R4174.cold', 'r4174_suite.js', 'R4174', 'unmeasured quarantine stays Gilligan custody and a promoteable cold row uses the write key', 'ADVERSARIAL'), L('R4174.law', 'r4174_suite.js', 'R4174', 'no LLM, always on, packs gated, and the portable file still leaves the mesh out', 'REGRESSION'), L('R4174.ver', 'r4174_suite.js', 'R4174', 'version registry CONFLICTS NEXT_BUILD name 4.9.174', 'REGRESSION')] }
    ] },
        { schema: SCHEMA, release: '4.9.173', requirements: [
      { id: 'R4173-CUSTODY', statement: 'The phone custody screen shows live always-on Athena and Gilligan status from the mesh: schedule, research, admit, cold re-curate, and hosted KB count. Ask pauses that work, then it resumes. The screen does not publish letter packs and does not require a KB click. No LLM.', falsify: 'The monitor is a painted idle animation, schedule is only DREAM-IDLE-GATED, opening Custody stuffs a letter pack, or the mesh runs inside Ask.', tests: [L('R4173.snap', 'r4173_suite.js', 'R4173', 'custody snapshot follows a real always-on tick, admit, and cold re-curate', 'POSITIVE'), L('R4173.pause', 'r4173_suite.js', 'R4173', 'Ask pause is visible on the custody mesh and resume keeps working', 'ADVERSARIAL'), L('R4173.ui', 'r4173_suite.js', 'R4173', 'phone custody screen binds the mesh and does not publish packs', 'POSITIVE'), L('R4173.ver', 'r4173_suite.js', 'R4173', 'version registry CONFLICTS NEXT_BUILD name 4.9.173', 'REGRESSION')] }
    ] },
        { schema: SCHEMA, release: '4.9.172', requirements: [
      { id: 'R4172-ALWAYS-ON', statement: 'Gilligan, Athena, and helpers are always-on. Athena researches continuously. Gilligan re-curates cold storage. A lawful promote writes the hosted session KB with no UI click. ChristPing is Gilligan-only and pulls hard drift onto a different path. Quarantine does not spend the spawn window and does not write confirmed_shared. Ask pauses helpers, then they resume. Phone pack publish stays gated. No LLM.', falsify: 'Schedule is only DREAM-IDLE-GATED, a quarantine probe blocks a later promote with ATHENA-SPAWN-WINDOW-CAP, hard drift is admitted, Neo initiates ChristPing, or the phone pack is stuffed by backend fill.', tests: [L('R4172.on', 'r4172_suite.js', 'R4172', 'boundary and schedule are always-on continuous work', 'POSITIVE'), L('R4172.ask', 'r4172_suite.js', 'R4172', 'Ask pauses helpers then resumes and a manual hibernate stays hibernated', 'ADVERSARIAL'), L('R4172.fill', 'r4172_suite.js', 'R4172', 'Athena researches continuously and backend fill writes hosted KB without a phone pack', 'POSITIVE'), L('R4172.christ', 'r4172_suite.js', 'R4172', 'ChristPing is Gilligan-only and high drift leaves the noisy claim off confirmed_shared', 'ADVERSARIAL'), L('R4172.window', 'r4172_suite.js', 'R4172', 'quarantine admit does not burn the spawn window and a later promote still lands', 'REGRESSION'), L('R4172.cold', 'r4172_suite.js', 'R4172', 'Gilligan re-curates cold storage and quarantine cold does not become truth', 'ADVERSARIAL'), L('R4172.ver', 'r4172_suite.js', 'R4172', 'version registry CONFLICTS NEXT_BUILD name 4.9.172', 'REGRESSION')] }
    ] },
        { schema: SCHEMA, release: '4.9.171', requirements: [
      { id: 'R4171-SPAWN-MESH', statement: 'Idle orchestrator runs Spawn, Run, Hibernate, Retire, Resurrect. Athena maySpawn and mayAdmit. One enforcer per policy domain. Caps refuse storms. Retire writes a hashed cold record. Ask pauses every helper. A gap is admitted once. Spawns and results are resonance or idle-dream packets. calls_llm is refused. Quarantine does not write confirmed_shared. No LLM.', falsify: 'A helper storm is accepted, Ask leaves a helper running, quarantine writes confirmed_shared, a gap is admitted twice, or a freeform or model spawn is accepted.', tests: [L('R4171.life', 'r4171_suite.js', 'R4171', 'registry lifecycle spawns, hibernates, retires into a hashed cold bank, and resurrects', 'POSITIVE'), L('R4171.budget', 'r4171_suite.js', 'R4171', 'spawn budget refuses a parent storm, a helper storm, and an idle-window storm', 'ADVERSARIAL'), L('R4171.ask', 'r4171_suite.js', 'R4171', 'Ask answering pauses every helper and Gilligan yields to Athena', 'ADVERSARIAL'), L('R4171.gate', 'r4171_suite.js', 'R4171', 'Athena maySpawn and mayAdmit refuse Neo, freeform, a held domain, and a second admit', 'ADVERSARIAL'), L('R4171.packet', 'r4171_suite.js', 'R4171', 'helper results are resonance or idle-dream packets and research refuses a model', 'ADVERSARIAL'), L('R4171.fork', 'r4171_suite.js', 'R4171', 'orchestrator forks a seeded helper and refuses a direct peer call', 'ADVERSARIAL'), L('R4171.once', 'r4171_suite.js', 'R4171', 'a helper reintegrates once and Athena admits the gap once', 'POSITIVE'), L('R4171.ver', 'r4171_suite.js', 'R4171', 'version registry CONFLICTS NEXT_BUILD name 4.9.171', 'REGRESSION')] }
    ] },
        { schema: SCHEMA, release: '4.9.170', requirements: [
      { id: 'R4170-IDLE-ADMIT', statement: 'Idle dream admit defaults on. Explicit eps null is unmeasured, not zero. Athena authorizes a declared helper before a hosted pack write. Quarantine does not write confirmed_shared or packs. Gilligan ticks and Athena spawn no-op while Ask is answering. No LLM.', falsify: 'eps null promotes as zero, quarantine writes a pack, the default admit stays off, or a helper calls a model.', tests: [L('R4170.null', 'r4170_suite.js', 'R4170', 'null and undefined epsilon are not measured zero and are not projectable as zero', 'ADVERSARIAL'), L('R4170.on', 'r4170_suite.js', 'R4170', 'admit defaults on and the tick still no-ops while Ask is answering', 'POSITIVE'), L('R4170.spawn', 'r4170_suite.js', 'R4170', 'Athena registry spawns only declared helpers and gates the pack write', 'ADVERSARIAL'), L('R4170.pack', 'r4170_suite.js', 'R4170', 'promote admit persists the letter pack and quarantine does not', 'POSITIVE'), L('R4170.ver', 'r4170_suite.js', 'R4170', 'version registry CONFLICTS NEXT_BUILD name 4.9.171', 'REGRESSION')] }
    ] },
        { schema: SCHEMA, release: '4.9.169', requirements: [
      { id: 'R4169-IDLE-DREAM', statement: 'Idle dream worker enumerates gaps and routes by the standing drift table. Low drift with high integrity is a promote-candidate. Quarantine keeps researching and does not write confirmed_shared. High drift hard-rejects and grace-recenters onto another path. Hosted admit attaches FORGE-RESONANCE-PACKET/v1 and stays default-off. No LLM. No phone dream KB.', falsify: 'Quarantine writes confirmed_shared, a high-drift path is admitted, admit lacks {Phi,eps,mu}, the worker calls an LLM, or the daemon runs inside Ask.', tests: [L('R4169.low', 'r4169_suite.js', 'R4169', 'low drift high integrity is a promote-candidate and stays off confirmed_shared while admit is paused', 'POSITIVE'), L('R4169.quar', 'r4169_suite.js', 'R4169', 'quarantine band keeps researching and does not write confirmed_shared', 'ADVERSARIAL'), L('R4169.chi', 'r4169_suite.js', 'R4169', 'chi caution band corrects once and does not write confirmed_shared', 'POSITIVE'), L('R4169.high', 'r4169_suite.js', 'R4169', 'high drift hard-rejects, grace-recenters, and steers a different path', 'NEGATIVE'), L('R4169.pkt', 'r4169_suite.js', 'R4169', 'admit attaches a resonance packet; quarantine admit does not write confirmed_shared', 'ADVERSARIAL'), L('R4169.idle', 'r4169_suite.js', 'R4169', 'idle tick skips while answering; letter holes invent no fact; no LLM', 'NEGATIVE'), L('R4169.ver', 'r4169_suite.js', 'R4169', 'version registry CONFLICTS NEXT_BUILD name 4.9.171', 'REGRESSION')] }
    ] },
        { schema: SCHEMA, release: '4.9.168', requirements: [
      { id: 'R4168-RESONANCE-PACKETS', statement: 'Every hosted confirmed_shared row that participates in RPMC gather carries a minimal resonance packet {Phi,eps,mu} (Axiom 4; §1 RPM; §3.4 Grace Integral). Attach-on-admit when pack omits packet; packet-only backfill allowed; RPMC priors to research carry sfe. Zero canned answers; continuous fill stays paused.', falsify: 'Packs lack sfe and pull does not attach; priors drop sfe; or a Roe/quartz/autism/laceration canned answer patch ships.', tests: [L('R4168.packs', 'r4168_suite.js', 'R4168', 'hosted packs carry minimal resonance packets {Phi,eps,mu} (Axiom 4 / §3.4)', 'POSITIVE'), L('R4168.pull', 'r4168_suite.js', 'R4168', 'pull preserves pack sfe; missing pack packet attaches default on admit', 'POSITIVE'), L('R4168.grace', 'r4168_suite.js', 'R4168', 'normalizeResonance: pack Phi5 sealed; Phi9 projectable combines (grace)', 'POSITIVE'), L('R4168.gather', 'r4168_suite.js', 'R4168', 'RPMC gather uses CS packets: quartz miss path carries sfe priors (not canned Naming)', 'POSITIVE'), L('R4168.attach', 'r4168_suite.js', 'R4168', 'attach-on-admit when pack omits sfe: session fact still phase-aligns', 'POSITIVE'), L('R4168.ver', 'r4168_suite.js', 'R4168', 'version registry CONFLICTS NEXT_BUILD name 4.9.171', 'REGRESSION')] }
    ] },
        { schema: SCHEMA, release: '4.9.167', requirements: [
      { id: 'R4167-PUBLIC-RESEARCH', statement: 'Public what-is: RPMC domain/archive ancestors → research.web vault-optional → RSOC/Panini; vault only for vault_write; no canned molecule pack.', falsify: 'h2s passphrase / RPMC-NONE with no Name, or capture.page loses vault, or canned H2S pack.', tests: [L('R4167.formula', 'r4167_suite.js', 'R4167', 'CHEM-FORMULA case-insensitive: h2s / H2S → chemistry domain + entity', 'POSITIVE'), L('R4167.h2s', 'r4167_suite.js', 'R4167', 'What is h2s? locked vault: RPMC-ANCESTOR-CANDIDATES → RSOC-COMPOSE → research; no AUTH vault passphrase', 'POSITIVE'), L('R4167.hs', 'r4167_suite.js', 'R4167', 'What is hydrogen sulfide?: same RPMC candidates + research; no vault passphrase', 'POSITIVE'), L('R4167.photo', 'r4167_suite.js', 'R4167', 'non-civics factual miss (What is photosynthesis?): RPMC candidates or AQ-1 research; no vault gate', 'POSITIVE'), L('R4167.auth', 'r4167_suite.js', 'R4167', 'research.web authorize locked: allow (network_read only); capture.page still vault-gated', 'POSITIVE'), L('R4167.forge', 'r4167_suite.js', 'R4167', 'forge locked: chemical what-is Names from mock archives without passphrase', 'POSITIVE'), L('R4167.cos', 'r4167_suite.js', 'R4167', 'forge locked: second non-civics factual (carbon dioxide formula ask when miss) Names without vault', 'POSITIVE'), L('R4167.second', 'r4167_suite.js', 'R4167', 'Second Amendment what-is: RPMC candidates → research compose (math path, not canned); locked still no vault gate', 'POSITIVE'), L('R4167.ver', 'r4167_suite.js', 'R4167', 'version registry CONFLICTS NEXT_BUILD name 4.9.171', 'REGRESSION')] }
    ]},
{ schema: SCHEMA, release: '4.9.166', requirements: [
      { id: 'R4166-TRACE-QUOTA', statement: 'MemoryStore.save never throws uncaught QuotaExceeded on soft cats (esp. kernel.trace); shrinks/evicts and soft-fails so the answer path completes. Chemical what-is exact CS miss logs RPMC-ANCESTOR-* then AUTH-AQ1 (research) — not a canned pack row; no per-question pack thicken.', falsify: 'Huge-trace save throws QuotaExceeded into UI, or What is h2s? answers from a canned H2S pack / skips RPMC+AQ-1.', tests: [L('R4166.quota', 'r4166_suite.js', 'R4166', 'MemoryStore.save: huge trace under QuotaExceeded never throws; shrinks / soft-fails', 'POSITIVE'), L('R4166.process', 'r4166_suite.js', 'R4166', 'process under full-storage backend: reply completes; no uncaught QuotaExceeded', 'POSITIVE'), L('R4166.h2s', 'r4166_suite.js', 'R4166', 'What is h2s?: exact CS miss → RPMC-ANCESTOR / AUTH-AQ1 research — not canned pack', 'POSITIVE'), L('R4166.hs', 'r4166_suite.js', 'R4166', 'What is hydrogen sulfide?: same lawful miss path; no subject pack thicken', 'POSITIVE'), L('R4166.ver', 'r4166_suite.js', 'R4166', 'version registry CONFLICTS NEXT_BUILD name 4.9.171', 'REGRESSION')] }
    ]},
    { schema: SCHEMA, release: '4.9.165', requirements: [
      { id: 'R4165-RESONATE-ANCESTOR', statement: 'When exact CS misses on a factual WH, FIND related CS, RPMC grace/phase-gate them as candidates into AUTH-AQ1/research (RSOC-COMPOSE-EVIDENCE), then RSOC select + Panini NL — never class-dump or canned Naming; silence only for no-basis novelty. Exact First/Fifth richer paths unchanged.', falsify: 'Second what-is dumps class text or a canned Second string, skips AQ-1 on civics miss, invents bear-arms substance, or First/Fifth lose CS-RECALL/COMPOSE-PRESENCE.', tests: [L('R4165.grace', 'r4165_suite.js', 'R4165', 'RPMC graceOverAncestors: phase-align + G_min gate (pass / fail-closed)', 'POSITIVE'), L('R4165.second', 'r4165_suite.js', 'R4165', 'Second Amendment what-is: RPMC candidates → AQ-1 (not class dump, not canned Naming)', 'POSITIVE'), L('R4165.miss', 'r4165_suite.js', 'R4165', 'Second rights WH stages RPMC priors into AQ-1; deliberate miss AQ-1 without false CS answer; class dump absent', 'ADVERSARIAL'), L('R4165.ver', 'r4165_suite.js', 'R4165', 'version registry CONFLICTS NEXT_BUILD name 4.9.171', 'REGRESSION')] }
    ]},
    { schema: SCHEMA, release: '4.9.164', requirements: [
      { id: 'R4164-GZIP-LEAVE', statement: 'Soft gzip leave restored ≥5 kB under 570 kB; 4.9.163 civics WH + discourse pathways and First/Fifth packs unchanged; soft budget unchanged.', falsify: 'Budget raised, pathways removed, or version docs omit 4.9.164.', tests: [L('R4163.whatis', 'r4163_suite.js', 'R4163', 'Fifth Amendment what-is from shared KB with Bill of Rights and rights substance', 'POSITIVE'), L('R4163.ver', 'r4163_suite.js', 'R4163', 'version registry CONFLICTS NEXT_BUILD name 4.9.171', 'REGRESSION')] }
    ]},
    { schema: SCHEMA, release: '4.9.163', requirements: [
      { id: 'R4163-CIVICS-WH', statement: 'Civics what-is/rights WH from hosted shared KB with substance; people/person IRRN does not clarify-hold a covered WH.', falsify: 'Fifth what-is is Bill-of-Rights-only, or rights WH holds people/person clarify, or answer is a Fifth-only special case.', tests: [L('R4163.whatis', 'r4163_suite.js', 'R4163', 'Fifth Amendment what-is from shared KB with Bill of Rights and rights substance', 'POSITIVE'), L('R4163.rights', 'r4163_suite.js', 'R4163', 'Fifth Amendment rights WH answers without people/person clarify hold', 'POSITIVE')] },
      { id: 'R4163-DISCOURSE-CS', statement: 'After a CS civics answer, pronoun follow-ups stay on that entity from shared KB; deliberate miss still AQ-1.', falsify: 'Follow-up starts research.web on Says, or miss does not AQ-1.', tests: [L('R4163.disc', 'r4163_suite.js', 'R4163', 'Fifth Amendment discourse follow-up keeps CS entity; no research.web on Says', 'POSITIVE'), L('R4163.miss', 'r4163_suite.js', 'R4163', 'First Amendment rights still from shared KB; deliberate miss still AQ-1', 'ADVERSARIAL'), L('R4163.ver', 'r4163_suite.js', 'R4163', 'version registry CONFLICTS NEXT_BUILD name 4.9.171', 'REGRESSION')] }
    ]},
    { schema: SCHEMA, release: '4.9.162', requirements: [
      { id: 'R4162-READ-CONNECT', statement: 'Ordinary factual WH/YN/about consult memory then hosted confirmed_shared then GKS before AQ-1; replies name Shared knowledge base.', falsify: 'With A+F pulled, First Amendment still routes to research.web, or CS hit skips Echo, or answer is a one-off special case.', tests: [L('R4162.fa', 'r4162_suite.js', 'R4162', 'First Amendment answers from hosted shared KB without research.web', 'POSITIVE'), L('R4162.yn', 'r4162_suite.js', 'R4162', 'yes/no from shared KB with shared provenance; memory wins over CS', 'POSITIVE')] },
      { id: 'R4162-CS-BEFORE-AQ1', statement: 'Shared KB hit skips AUTH-AQ1; deliberate miss still AQ-1; phone/scrapbook stay empty.', falsify: 'Miss does not AQ-1, or hit writes phone confirmed_shared / scrapbook.', tests: [L('R4162.miss', 'r4162_suite.js', 'R4162', 'deliberate miss still falls through to AQ-1 research.web', 'ADVERSARIAL'), L('R4162.ver', 'r4162_suite.js', 'R4162', 'version registry CONFLICTS NEXT_BUILD name 4.9.171', 'REGRESSION')] }
    ]},
    { schema: SCHEMA, release: '4.9.161', requirements: [
      { id: 'R4128-HOSTED', statement: 'Hosted A–Z shared knowledge pulls into session RAM for invent/compose. Phone DB is not the product brain. Scrapbook stays empty.', falsify: 'Pull writes thousands of facts into phone confirmed_shared or scrapbook, or invent ignores hosted anchors.', tests: [L('R4128.pull', 'r4128_suite.js', 'R4128', N.pull, 'POSITIVE'), L('R4128.invent', 'r4128_suite.js', 'R4128', N.invent, 'POSITIVE')] },
      { id: 'R4128-WRITE-KEY', statement: 'Write to shared knowledge refuses without Nic write key. Read/pull needs no key.', falsify: 'admitConfirmedShared or writeSharedKnowledge succeeds with only productCurator true, or pull requires a key.', tests: [L('R4128.write', 'r4128_suite.js', 'R4128', N.write, 'ADVERSARIAL')] },
      { id: 'R4128-AZ', statement: 'Index 4.9.163 hosts all 26 letters with ≥1890 admitted items (6518 / 6756 curated); UI/Audit name Shared knowledge base.', falsify: 'Letters missing, count below floor, or UI still hides shared knowledge naming.', tests: [L('R4128.az', 'r4128_suite.js', 'R4128', N.az, 'POSITIVE'), L('R4128.ver', 'r4128_suite.js', 'R4128', N.ver, 'REGRESSION')] }
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
