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
    budget: 'the single-file budget stays within 2.500 MB raw and 750 kB gzip',
    ver: 'version, registry, CONFLICTS, and NEXT_BUILD name 4.9.125 and leave a shared write unstarted'
  };
  const K = {
    chrome: 'chrome, nav, typography, and spacing carry the calm shell markers',
    pills: 'Doc 7 status pills and calm empty states name projectable contested quarantine hypothesis',
    discover: 'Ask shows invent and compose discoverability one-liners without hiding them behind Advanced',
    next: 'UNSUPPORTED and dead-end turns show a gentle next-step redirect',
    onboard: 'starter onboarding one-liner names starter_pack and keeps Clear starter knowledge reachable',
    reach: 'non-negotiables stay reachable: gates, packet export, Audit, Ideas tap, Remember, invent/compose/suppose, Clear starter, Import',
    budget: 'the single-file budget stays within 2.500 MB raw and 750 kB gzip',
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
    { schema: SCHEMA, release: '4.9.117', requirements: [
      { id: 'R4117-TRACE', statement: 'A slice names requirement ids, test ids, and a blank template.', falsify: 'A requirement id has no test in the suite.', tests: [L('R4117.map', 'r4117_suite.js', 'R4117', B.map, 'REGRESSION'), L('R4117.tool', 'r4117_suite.js', 'R4117', B.tool, 'REGRESSION'), L('R4117.audit', 'r4117_suite.js', 'R4117', B.audit, 'REGRESSION'), L('R4117.ver', 'r4117_suite.js', 'R4117', B.ver, 'REGRESSION')] },
      { id: 'R4117-GATES', statement: 'A passing behavior run does not override a failed gate.', falsify: 'A passing behavior total makes a failed gate pass.', tests: [L('R4117.gate', 'r4117_suite.js', 'R4117', B.gate, 'REGRESSION'), L('R4117.wire', 'r4117_suite.js', 'R4117', B.wire, 'REGRESSION')] },
      { id: 'R4117-NONLLM', statement: 'The authority path keeps the Doc 9 non-model scan.', falsify: 'The authority-path scan accepts a model call.', tests: [L('R4117.scan', 'r4117_suite.js', 'R4117', B.scan, 'NON-LLM SCAN')] }
    ] },
    { schema: SCHEMA, release: '4.9.118', requirements: [
      { id: 'R4118-NONEQ', statement: 'Math honesty is research-only and is not a manuscript equivalence.', falsify: 'A research divisor or a phase stub is treated as the Mobile write law or as a verified manuscript number.', tests: [L('R4118.drift', 'r4118_suite.js', 'R4118', C.drift, 'CALIBRATION'), L('R4118.phase', 'r4118_suite.js', 'R4118', C.phase, 'NEGATIVE'), L('R4118.gates', 'r4118_suite.js', 'R4118', C.gates, 'REGRESSION'), L('R4118.ver', 'r4118_suite.js', 'R4118', C.ver, 'REGRESSION')] }
    ] },
    { schema: SCHEMA, release: '4.9.119', requirements: [
      { id: 'R4119-DREAM', statement: 'Resurrection is a proposal, must_archive is a route input, and dream, SPC, and quarantine do not silently write.', falsify: 'Seven gates store memory, must_archive stays a side flag, or a dream or quarantine turn writes memory or the world head.', tests: [L('R4119.route', 'r4119_suite.js', 'R4119', D.route, 'REGRESSION'), L('R4119.copy', 'r4119_suite.js', 'R4119', D.copy, 'REGRESSION'), L('R4119.ver', 'r4119_suite.js', 'R4119', D.ver, 'REGRESSION')] }
    ] },
    { schema: SCHEMA, release: '4.9.125', requirements: [
      { id: 'R4125-IMPORT', statement: 'A person can load a confirmed pack. Confirmed items are admitted. Contested items stay held until a tap. A bad pack is a typed refusal. Import does not write shared knowledge.', falsify: 'A valid pack writes shared knowledge, a contested item is projectable before a tap, a bad pack is admitted, invent ignores a newly admitted anchor, or a creative path stores a confirmed fact.', tests: [L('R4125.refuse', 'r4125_suite.js', 'R4125', J.refuse, 'NEGATIVE'), L('R4125.audit', 'r4125_suite.js', 'R4125', J.audit, 'ADVERSARIAL'), L('R4125.budget', 'r4125_suite.js', 'R4125', J.budget, 'REGRESSION'), L('R4125.ver', 'r4125_suite.js', 'R4125', J.ver, 'REGRESSION')] }
    ] },
    { schema: SCHEMA, release: '4.9.126', requirements: [
      { id: 'R4126-SHELL', statement: 'Calm chrome, Doc 7 status pills, and empty states with one next step. Power surfaces stay reachable. Soft budget unchanged.', falsify: 'A power surface is removed, Doc 7 pills are absent, empty states hide the next step, or the soft budget rises.', tests: [L('R4126.chrome', 'r4126_suite.js', 'R4126', K.chrome, 'POSITIVE'), L('R4126.pills', 'r4126_suite.js', 'R4126', K.pills, 'POSITIVE'), L('R4126.budget', 'r4126_suite.js', 'R4126', K.budget, 'REGRESSION')] },
      { id: 'R4126-COPY', statement: 'Invent and compose discoverability one-liners stay visible. UNSUPPORTED turns show a gentle next-step redirect.', falsify: 'Invent is Advanced-only, compose is unnamed, or an unsupported turn has no next step.', tests: [L('R4126.discover', 'r4126_suite.js', 'R4126', K.discover, 'POSITIVE')] },
      { id: 'R4126-REACH', statement: 'Starter onboarding names starter_pack. Clear starter knowledge and Import confirmed facts stay reachable. Shared KB stays empty. A deep IA rewrite is not started.', falsify: 'Clear starter is removed, Import is removed, shared knowledge is written, or a deep IA rewrite ships.', tests: [L('R4126.onboard', 'r4126_suite.js', 'R4126', K.onboard, 'POSITIVE'), L('R4126.ver', 'r4126_suite.js', 'R4126', K.ver, 'REGRESSION')] }
    ] },
    { schema: SCHEMA, release: '4.9.127', requirements: [
      { id: 'R4127-GATE', statement: 'Curator packs admit confirmed_shared; contested held; creative never auto-write; scrapbook empty.', falsify: 'Pack needs tap, contested projects, creative writes confirmed_shared, or scrapbook gains row.', tests: [L('R4127.gate', 'r4127_suite.js', 'R4127', M.gate, 'POSITIVE')] },
      { id: 'R4127-LETTER-A', statement: 'Hosted a.json is FORGE-CONFIRMED-PACK/v1; invent/compose prefer confirmed_shared.', falsify: 'Letter A missing, invent ignores confirmed_shared, says shared KB, or packs in single.', tests: [L('R4127.pack', 'r4127_suite.js', 'R4127', M.pack, 'POSITIVE')] },
      { id: 'R4127-PROV', statement: 'Audit names confirmed_shared; no shared KB; budget unchanged.', falsify: 'Audit omits confirmed_shared, UI shared KB, budget rises, or scrapbook written.', tests: [L('R4127.audit', 'r4127_suite.js', 'R4127', M.audit, 'ADVERSARIAL'), L('R4127.ver', 'r4127_suite.js', 'R4127', M.ver, 'REGRESSION')] }
    ] },
        { schema: SCHEMA, release: '4.9.182', requirements: [
      { id: 'R4182-RMC-ENGINE', statement: 'Foundations only. A new core runs rmc_engine_v1 run_deep_dry_run, records thresholds, feeds receipts and KB into the memory recaller, and returns a trace. A world-model seam sits between recall and the admit gate and does not change memory. The existing Ask path still answers. No LLM. Packs stay gated.', falsify: 'The core skips run_deep_dry_run, memory is not fed, the world-model seam writes memory, or the version docs omit 4.9.182.', tests: [L('R4182.run', 'r4182_suite.js', 'R4182', 'the new core runs deep dry run and returns a trace', 'POSITIVE'), L('R4182.memory', 'r4182_suite.js', 'R4182', 'receipts and KB are visible to the memory recaller', 'POSITIVE'), L('R4182.seam', 'r4182_suite.js', 'R4182', 'the world model sits between recall and the admit gate and does not write memory', 'ADVERSARIAL'), L('R4182.ver', 'r4182_suite.js', 'R4182', 'version registry CONFLICTS NEXT_BUILD name 4.9.182', 'REGRESSION')] }
    ] },
        { schema: SCHEMA, release: '4.9.187', requirements: [
      { id: 'R4186-ANCHOR-HOP', statement: 'Gilligan connects quarantined web evidence to an admitted concept within drift. Athena resonance-places it. The unchanged admit gate is the only write. Multi-hop derive records provenance and drift on every hop. The memory writer inserts an admitted fact with a resonance packet, provenance, and contributor credit. Anon cannot insert an unadmitted row. No LLM.', falsify: 'A quarantined excerpt with no ancestor is written, the admit gate is skipped, a hop has no provenance, anon can insert an unadmitted row, or a model is called.', tests: [L('R4186.noparse', 'r4186_suite.js', 'R4186', 'recall and the anchor do not parse with a regex or token overlap', 'ADVERSARIAL'), L('R4186.rls', 'r4186_suite.js', 'R4186', 'anon cannot insert an unadmitted contribution', 'ADVERSARIAL'), L('R4186.anchor', 'r4186_suite.js', 'R4186', 'Gilligan anchors inside the drift bands and does not skip the admit gate', 'POSITIVE'), L('R4186.hop', 'r4186_suite.js', 'R4186', 'multi-hop derive records provenance and drift on every hop', 'POSITIVE'), L('R4186.writer', 'r4186_suite.js', 'R4186', 'the memory writer reports a hosted insert only after readback', 'ADVERSARIAL'), L('R4186.ver', 'r4186_suite.js', 'R4186', 'version registry names 4.9.186 and the switches stay off', 'REGRESSION')] }
    ] },
        { schema: SCHEMA, release: '4.9.185', requirements: [
      { id: 'R4185-RESONANCE-RECALL', statement: 'Recall is phase-align of a FORGE-RESONANCE-PACKET/v1 packet and a Doc 4/5 frame or concept. It is not token overlap. C_min stays 0.87. The coherence formula is unchanged. Only an admitted sentence is written, with provenance and contributor credit. A quarantine with no ancestor is not written. No LLM.', falsify: 'Recall ranks by token overlap or a regex extractor, C_min or the formula changes, a quarantined excerpt is written, or a model is called.', tests: [L('R4185.noparse', 'r4185_suite.js', 'R4185', 'recall does not rank by token overlap or a regex extractor', 'ADVERSARIAL'), L('R4185.packet', 'r4185_suite.js', 'R4185', 'an admitted answer carries a resonance packet, provenance, and contributor credit', 'POSITIVE'), L('R4185.quarantine', 'r4185_suite.js', 'R4185', 'quarantine is not a premise and a short chain stays under C_min', 'ADVERSARIAL'), L('R4185.model', 'r4185_suite.js', 'R4185', 'new modules do not call a model', 'NEGATIVE'), L('R4185.ver', 'r4185_suite.js', 'R4185', 'version registry names 4.9.185', 'REGRESSION')] }
    ] },
        { schema: SCHEMA, release: '4.9.184', requirements: [
      { id: 'R4184-WORLD-MODEL', statement: 'Observe and Derive run in rmc_core between recall and the renderer. The EchoForge debate is proponent then opponent on the Doc 4/5 frames. No model. A surviving claim is the renderer input. A conflict renders neither side. C_min stays 0.87.', falsify: 'The seam writes durable memory, a model is called, a conflict is spoken, quarantined web text is a premise, or C_min is lowered.', tests: [L('R4184.chain', 'r4184_suite.js', 'R4184', 'copula chain carries provenance, drift, and chi, and does not lower C_min', 'POSITIVE'), L('R4184.conflict', 'r4184_suite.js', 'R4184', 'a conflict is not rendered as either side', 'ADVERSARIAL'), L('R4184.web', 'r4184_suite.js', 'R4184', 'quarantined web text is not a premise', 'ADVERSARIAL'), L('R4184.self', 'r4184_suite.js', 'R4184', 'a self-fact can be superseded and the parent root is kept', 'POSITIVE'), L('R4184.proof', 'r4184_suite.js', 'R4184', 'the independent checker rejects a tampered proof and no socket is opened', 'ADVERSARIAL'), L('R4184.model', 'r4184_suite.js', 'R4184', 'new engine modules do not name a model API', 'NEGATIVE'), L('R4184.ask', 'r4184_suite.js', 'R4184', 'Ask shows the engine reply only', 'REGRESSION'), L('R4184.ver', 'r4184_suite.js', 'R4184', 'version registry names 4.9.185', 'REGRESSION')] }
    ] },
        { schema: SCHEMA, release: '4.9.181', requirements: [
      { id: 'R4181-ASK-KEYS', statement: 'An admitted row is indexed by the question that produced it. The same question and a reword recall it before AQ-1. A lead sentence that failed a raw parse is simplified until the grammar round-trips. Drift and chi still gate the bank. Gzip leave is at least 5 kB under 570 kB. No LLM.', falsify: 'A re-ask of an admitted Jupiter, chloramine, Mars, or paper row starts AQ-1, a DNA or by-which lead stays unparsed, drift above 0.80 is admitted, or the portable file drops below 5 kB of gzip leave.', tests: [L('R4181.parse', 'r4181_suite.js', 'R4181', 'lead sentences for DNA, Ada, gravity, and a by-which paper round-trip', 'POSITIVE'), L('R4181.gate', 'r4181_suite.js', 'R4181', 'a parsed sentence above 0.80 still recenters and does not write', 'ADVERSARIAL'), L('R4181.ver', 'r4181_suite.js', 'R4181', 'version registry CONFLICTS NEXT_BUILD name 4.9.181', 'REGRESSION')] }
    ] },
        { schema: SCHEMA, release: '4.9.180', requirements: [
      { id: 'R4180-ATHENA-DOC', statement: 'Athena document tools that fit the no-LLM loop are built. A fetched sentence that fails a raw parse is normalized and admitted when drift is at or under 0.35. The next Ask recalls it. Bleach mixed with ammonia is chloramine gas. ProtoForge has a local definition. Packs stay gated. No LLM.', falsify: 'A parseable fetched answer stays out of the bank, a re-ask misses an admitted sentence, bleach is only nitrogen trichloride, protoforge has no definition, community nodes publish a pack, or a payment tool is built.', tests: [L('R4180.athena', 'r4180_suite.js', 'R4180', 'seventeen Athena tools are wired and sixty-seven stays are skipped', 'POSITIVE'), L('R4180.gates', 'r4180_suite.js', 'R4180', 'hard drift, a locked passcode, and pack publish stay refused', 'ADVERSARIAL'), L('R4180.ver', 'r4180_suite.js', 'R4180', 'version registry CONFLICTS NEXT_BUILD name 4.9.180', 'REGRESSION')] }
    ] },
        { schema: SCHEMA, release: '4.9.178', requirements: [
      { id: 'R4178-GILLIGAN-CODEX', statement: 'Gilligan Codex engines run on the learning loop. A measured Ask is admitted and later recalled. ChristPing stays armed and Gilligan-only. Dream rehearsal and resurrection do not write until the gates pass. Token payouts, biometric sensors, a phase skip, and a bare sigil stay refused. No LLM. Packs stay gated. Pattern Reflection is not the Codex.', falsify: 'A lawful admit is not recalled, Athena initiates ChristPing, a dream row becomes the hosted bank, a payout or a sensor reading is accepted, or the version docs omit 4.9.178.', tests: [L('R4178.inventory', 'r4178_suite.js', 'R4178', 'Codex inventory builds the engines and skips money and hardware', 'POSITIVE'), L('R4178.christ', 'r4178_suite.js', 'R4178', 'hard drift arms ChristPing and Athena cannot initiate it', 'ADVERSARIAL'), L('R4178.dream', 'r4178_suite.js', 'R4178', 'dream rehearsal and resurrection do not write until the gates pass', 'ADVERSARIAL'), L('R4178.refuse', 'r4178_suite.js', 'R4178', 'goal, token, biometric, phase skip, and a bare sigil stay refused', 'NEGATIVE'), L('R4178.ver', 'r4178_suite.js', 'R4178', 'version registry CONFLICTS NEXT_BUILD name 4.9.178', 'REGRESSION')] }
    ] },
        { schema: SCHEMA, release: '4.9.177', requirements: [
      { id: 'R4177-FORGE-TOOLS', statement: 'Forge phase parse and hosted recall run on the learning loop. Search and read stay inside the session bank. A hosted method sentence is reused without a fetch. Shell, payments, vector search, and a model call stay refused. No LLM. Packs stay gated.', falsify: 'Phase parse disagrees with Forge, an unrelated row outranks the hosted method, a device path or a vector backend is read, a fetch runs when the bank already has the method, or a shell or payment tool executes.', tests: [L('R4177.phase', 'r4177_suite.js', 'R4177', 'phase parse matches Forge and the word or inside before is not a polarity hit', 'POSITIVE'), L('R4177.bank', 'r4177_suite.js', 'R4177', 'session search stays on the hosted bank and shell, patch, payment, and vector search are refused', 'ADVERSARIAL'), L('R4177.ver', 'r4177_suite.js', 'R4177', 'version registry CONFLICTS NEXT_BUILD name 4.9.177', 'REGRESSION')] }
    ] },
        { schema: SCHEMA, release: '4.9.176', requirements: [
      { id: 'R4176-HELD-ADMIT', statement: 'A tap admits a contested held shared-knowledge row into the session bank when the write key is already held. A quarantine row stays held. Phone DB and letter packs are not written. Ask recalls the admitted sentence. No LLM.', falsify: 'A contested row stays held after the key and a tap, a quarantine row is admitted, the phone DB gains a fact, or recall starts AQ-1.', tests: [L('R4176.nokey', 'r4176_suite.js', 'R4176', 'a tap without a held write key leaves the contested row held', 'ADVERSARIAL'), L('R4176.ver', 'r4176_suite.js', 'R4176', 'version registry CONFLICTS NEXT_BUILD name 4.9.176', 'REGRESSION')] }
    ] },
        { schema: SCHEMA, release: '4.9.175', requirements: [
      { id: 'R4175-PIPELINE-TOOLS', statement: 'A session write-key grant lets a measured claim admit into the hosted bank. research.web returns a method excerpt without reading the vault. A parseable excerpt is recalled before AQ-1. An open crawl is not admitted. No LLM. Packs stay gated.', falsify: 'A lawful admit stays at 0 after the key is held, a how/method fetch returns no excerpt or reads the vault, an open URL is promoted, or recall starts AQ-1.', tests: [L('R4175.key', 'r4175_suite.js', 'R4175', 'write key grant lets a measured claim admit and a missing key leaves the bank at 0', 'POSITIVE'), L('R4175.fetch', 'r4175_suite.js', 'R4175', 'research tool returns a method excerpt and does not answer from the vault', 'ADVERSARIAL'), L('R4175.refuse', 'r4175_suite.js', 'R4175', 'an open crawl and an unparsed excerpt are not admitted', 'ADVERSARIAL'), L('R4175.cold', 'r4175_suite.js', 'R4175', 'Gilligan cold re-curate writes the same hosted bank with the granted key', 'POSITIVE'), L('R4175.phone', 'r4175_suite.js', 'R4175', 'phone access holds the key in the session, packs stay gated, and the portable file skips the tools', 'REGRESSION'), L('R4175.ver', 'r4175_suite.js', 'R4175', 'version registry CONFLICTS NEXT_BUILD name 4.9.175', 'REGRESSION')] }
    ] },
        { schema: SCHEMA, release: '4.9.174', requirements: [
      { id: 'R4174-LEARNING-LOOP', statement: 'Ask answers a how/method question from web excerpts. That measured evidence can be admitted to the hosted bank and later recalled. Unmeasured quarantine stays custody. No LLM. Packs stay gated.', falsify: 'How do lightbulbs work ends as NO_LAWFUL_CANDIDATE when a Wikipedia-class source states the method, or a lawful admit is not recalled before AQ-1, or a crawl-shaped payload is promoted.', tests: [L('R4174.admit', 'r4174_suite.js', 'R4174', 'research callback plus write key admits and the hosted bank grows from the write', 'POSITIVE'), L('R4174.bridge', 'r4174_suite.js', 'R4174', 'Ask research evidence becomes an Athena gap with curated extracts and a crawl shape is refused', 'ADVERSARIAL'), L('R4174.cold', 'r4174_suite.js', 'R4174', 'unmeasured quarantine stays Gilligan custody and a promoteable cold row uses the write key', 'ADVERSARIAL'), L('R4174.law', 'r4174_suite.js', 'R4174', 'no LLM, always on, packs gated, and the portable file still leaves the mesh out', 'REGRESSION'), L('R4174.ver', 'r4174_suite.js', 'R4174', 'version registry CONFLICTS NEXT_BUILD name 4.9.174', 'REGRESSION')] }
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
      { id: 'R4168-RESONANCE-PACKETS', statement: 'Every hosted confirmed_shared row that participates in RPMC gather carries a minimal resonance packet {Phi,eps,mu} (Axiom 4; §1 RPM; §3.4 Grace Integral). Attach-on-admit when pack omits packet; packet-only backfill allowed; RPMC priors to research carry sfe. Zero canned answers; continuous fill stays paused.', falsify: 'Packs lack sfe and pull does not attach; priors drop sfe; or a Roe/quartz/autism/laceration canned answer patch ships.', tests: [L('R4168.packs', 'r4168_suite.js', 'R4168', 'hosted packs carry minimal resonance packets {Phi,eps,mu} (Axiom 4 / §3.4)', 'POSITIVE'), L('R4168.pull', 'r4168_suite.js', 'R4168', 'pull preserves pack sfe; missing pack packet attaches default on admit', 'POSITIVE'), L('R4168.ver', 'r4168_suite.js', 'R4168', 'version registry CONFLICTS NEXT_BUILD name 4.9.171', 'REGRESSION')] }
    ] },
        { schema: SCHEMA, release: '4.9.167', requirements: [
      { id: 'R4167-PUBLIC-RESEARCH', statement: 'Public what-is: RPMC domain/archive ancestors → research.web vault-optional → RSOC/Panini; vault only for vault_write; no canned molecule pack.', falsify: 'h2s passphrase / RPMC-NONE with no Name, or capture.page loses vault, or canned H2S pack.', tests: [L('R4167.formula', 'r4167_suite.js', 'R4167', 'CHEM-FORMULA case-insensitive: h2s / H2S → chemistry domain + entity', 'POSITIVE'), L('R4167.auth', 'r4167_suite.js', 'R4167', 'research.web authorize locked: allow (network_read only); capture.page still vault-gated', 'POSITIVE'), L('R4167.ver', 'r4167_suite.js', 'R4167', 'version registry CONFLICTS NEXT_BUILD name 4.9.171', 'REGRESSION')] }
    ]},
{ schema: SCHEMA, release: '4.9.166', requirements: [
      { id: 'R4166-TRACE-QUOTA', statement: 'MemoryStore.save never throws uncaught QuotaExceeded on soft cats (esp. kernel.trace); shrinks/evicts and soft-fails so the answer path completes. Chemical what-is exact CS miss logs RPMC-ANCESTOR-* then AUTH-AQ1 (research) — not a canned pack row; no per-question pack thicken.', falsify: 'Huge-trace save throws QuotaExceeded into UI, or What is h2s? answers from a canned H2S pack / skips RPMC+AQ-1.', tests: [L('R4166.quota', 'r4166_suite.js', 'R4166', 'MemoryStore.save: huge trace under QuotaExceeded never throws; shrinks / soft-fails', 'POSITIVE'), L('R4166.ver', 'r4166_suite.js', 'R4166', 'version registry CONFLICTS NEXT_BUILD name 4.9.171', 'REGRESSION')] }
    ]},
    { schema: SCHEMA, release: '4.9.165', requirements: [
      { id: 'R4165-RESONATE-ANCESTOR', statement: 'When exact CS misses on a factual WH, FIND related CS, RPMC grace/phase-gate them as candidates into AUTH-AQ1/research (RSOC-COMPOSE-EVIDENCE), then RSOC select + Panini NL — never class-dump or canned Naming; silence only for no-basis novelty. Exact First/Fifth richer paths unchanged.', falsify: 'Second what-is dumps class text or a canned Second string, skips AQ-1 on civics miss, invents bear-arms substance, or First/Fifth lose CS-RECALL/COMPOSE-PRESENCE.', tests: [L('R4165.grace', 'r4165_suite.js', 'R4165', 'RPMC graceOverAncestors: phase-align + G_min gate (pass / fail-closed)', 'POSITIVE'), L('R4165.ver', 'r4165_suite.js', 'R4165', 'version registry CONFLICTS NEXT_BUILD name 4.9.171', 'REGRESSION')] }
    ]},
    { schema: SCHEMA, release: '4.9.161', requirements: [
      { id: 'R4128-HOSTED', statement: 'Hosted A–Z shared knowledge pulls into session RAM for invent/compose. Phone DB is not the product brain. Scrapbook stays empty.', falsify: 'Pull writes thousands of facts into phone confirmed_shared or scrapbook, or invent ignores hosted anchors.', tests: [L('R4128.pull', 'r4128_suite.js', 'R4128', N.pull, 'POSITIVE')] },
      { id: 'R4128-WRITE-KEY', statement: 'Write to shared knowledge refuses without Nic write key. Read/pull needs no key.', falsify: 'admitConfirmedShared or writeSharedKnowledge succeeds with only productCurator true, or pull requires a key.', tests: [L('R4128.write', 'r4128_suite.js', 'R4128', N.write, 'ADVERSARIAL')] },
      { id: 'R4128-AZ', statement: 'Index 4.9.163 hosts all 26 letters with ≥1890 admitted items (6518 / 6756 curated); UI/Audit name Shared knowledge base.', falsify: 'Letters missing, count below floor, or UI still hides shared knowledge naming.', tests: [L('R4128.az', 'r4128_suite.js', 'R4128', N.az, 'POSITIVE'), L('R4128.ver', 'r4128_suite.js', 'R4128', N.ver, 'REGRESSION')] }
    ] }
  ];
  /* 4.9.215 (Release C4, Nic approved): requirement links whose tests drove the deleted old JS answer path (Kernel.process /
   * ForgeKernel.process, recallHosted, recallFromBank) are retired, not renamed. Each one is listed here with why; the full test names
   * and reasons are in data/c4_retired_tests.json, CONFLICTS.md and the R4215-C4-OLD-PATH-DELETED registry entry. */
  const RETIRED_LINKS = [
    { id: "R4116.ack", requirement: "R4116-LEXICON", why: "old JS answer path deleted" },
    { id: "R4116.noun", requirement: "R4116-LEXICON", why: "old JS answer path deleted" },
    { id: "R4116.recall", requirement: "R4116-LEXICON", why: "old JS answer path deleted" },
    { id: "R4116.stems", requirement: "R4116-LEXICON", why: "old JS answer path deleted" },
    { id: "R4116.ack", requirement: "R4116-FRAMES", why: "old JS answer path deleted" },
    { id: "R4116.smell", requirement: "R4116-FRAMES", why: "old JS answer path deleted" },
    { id: "R4116.block", requirement: "R4116-FRAMES", why: "old JS answer path deleted" },
    { id: "R4116.echo", requirement: "R4116-FRAMES", why: "old JS answer path deleted" },
    { id: "R4116.receipt", requirement: "R4116-FRAMES", why: "old JS answer path deleted" },
    { id: "R4118.echo", requirement: "R4118-NONEQ", why: "old JS Echo surfaces retired" },
    { id: "R4119.propose", requirement: "R4119-DREAM", why: "old JS answer path deleted" },
    { id: "R4119.commit", requirement: "R4119-DREAM", why: "old JS answer path deleted" },
    { id: "R4119.phrase", requirement: "R4119-DREAM", why: "old JS answer path deleted" },
    { id: "R4119.inspect", requirement: "R4119-DREAM", why: "old JS answer path deleted" },
    { id: "R4119.quiet", requirement: "R4119-DREAM", why: "old JS answer path deleted" },
    { id: "R4120.unbound", requirement: "R4120-IDEA", why: "old JS answer path deleted" },
    { id: "R4120.project", requirement: "R4120-IDEA", why: "old JS answer path deleted" },
    { id: "R4120.quarantine", requirement: "R4120-IDEA", why: "old JS answer path deleted" },
    { id: "R4120.hard", requirement: "R4120-IDEA", why: "old JS answer path deleted" },
    { id: "R4120.guard", requirement: "R4120-IDEA", why: "old JS answer path deleted" },
    { id: "R4121.none", requirement: "R4121-COMPOSE", why: "old JS answer path deleted" },
    { id: "R4121.project", requirement: "R4121-COMPOSE", why: "old JS answer path deleted" },
    { id: "R4121.quarantine", requirement: "R4121-COMPOSE", why: "old JS answer path deleted" },
    { id: "R4121.unbound", requirement: "R4121-COMPOSE", why: "old JS answer path deleted" },
    { id: "R4121.express", requirement: "R4121-COMPOSE", why: "old JS answer path deleted" },
    { id: "R4121.meaning", requirement: "R4121-COMPOSE", why: "old JS answer path deleted" },
    { id: "R4121.guard", requirement: "R4121-COMPOSE", why: "old JS answer path deleted" },
    { id: "R4122.open", requirement: "R4122-SUPPOSE", why: "old JS answer path deleted" },
    { id: "R4122.cont", requirement: "R4122-SUPPOSE", why: "old JS answer path deleted" },
    { id: "R4122.park", requirement: "R4122-SUPPOSE", why: "old JS answer path deleted" },
    { id: "R4122.world", requirement: "R4122-SUPPOSE", why: "old JS answer path deleted" },
    { id: "R4122.unbound", requirement: "R4122-SUPPOSE", why: "old JS answer path deleted" },
    { id: "R4122.none", requirement: "R4122-SUPPOSE", why: "old JS answer path deleted" },
    { id: "R4122.echo", requirement: "R4122-SUPPOSE", why: "old JS answer path deleted" },
    { id: "R4122.guard", requirement: "R4122-SUPPOSE", why: "old JS answer path deleted" },
    { id: "R4123.expand", requirement: "R4123-COMPOSE", why: "old JS answer path deleted" },
    { id: "R4123.phrase", requirement: "R4123-COMPOSE", why: "old JS answer path deleted" },
    { id: "R4123.quarantine", requirement: "R4123-COMPOSE", why: "old JS answer path deleted" },
    { id: "R4123.refuse", requirement: "R4123-COMPOSE", why: "old JS answer path deleted" },
    { id: "R4123.meaning", requirement: "R4123-COMPOSE", why: "old JS answer path deleted" },
    { id: "R4123.echo", requirement: "R4123-COMPOSE", why: "old JS answer path deleted" },
    { id: "R4124.seed", requirement: "R4124-SEED", why: "old JS answer path deleted" },
    { id: "R4124.compose", requirement: "R4124-SEED", why: "old JS answer path deleted" },
    { id: "R4124.clear", requirement: "R4124-SEED", why: "old JS answer path deleted" },
    { id: "R4124.audit", requirement: "R4124-SEED", why: "old JS answer path deleted" },
    { id: "R4125.admit", requirement: "R4125-IMPORT", why: "old JS answer path deleted" },
    { id: "R4125.hold", requirement: "R4125-IMPORT", why: "old JS answer path deleted" },
    { id: "R4125.anchor", requirement: "R4125-IMPORT", why: "old JS answer path deleted" },
    { id: "R4125.quiet", requirement: "R4125-IMPORT", why: "old JS answer path deleted" },
    { id: "R4126.next", requirement: "R4126-COPY", why: "old JS answer path deleted" },
    { id: "R4126.reach", requirement: "R4126-REACH", why: "old JS answer path deleted" },
    { id: "R4127.quiet", requirement: "R4127-GATE", why: "old JS answer path deleted" },
    { id: "R4127.memory", requirement: "R4127-GATE", why: "old JS answer path deleted" },
    { id: "R4127.invent", requirement: "R4127-LETTER-A", why: "old JS answer path deleted" },
    { id: "R4181.recall", requirement: "R4181-ASK-KEYS", why: "old JS answer path deleted" },
    { id: "R4180.proto", requirement: "R4180-ATHENA-DOC", why: "old JS answer path deleted" },
    { id: "R4180.parse", requirement: "R4180-ATHENA-DOC", why: "old JS answer path deleted" },
    { id: "R4180.hazard", requirement: "R4180-ATHENA-DOC", why: "old JS answer path deleted" },
    { id: "R4179.core", requirement: "R4179-FORGE2-WIRING", why: "old JS answer path deleted" },
    { id: "R4179.loop", requirement: "R4179-FORGE2-WIRING", why: "old JS answer path deleted" },
    { id: "R4178.loop", requirement: "R4178-GILLIGAN-CODEX", why: "old JS answer path deleted" },
    { id: "R4177.recall", requirement: "R4177-FORGE-TOOLS", why: "recallHosted deleted" },
    { id: "R4177.loop", requirement: "R4177-FORGE-TOOLS", why: "recallFromBank deleted" },
    { id: "R4176.admit", requirement: "R4176-HELD-ADMIT", why: "old JS answer path deleted" },
    { id: "R4176.quar", requirement: "R4176-HELD-ADMIT", why: "old JS answer path deleted" },
    { id: "R4175.recall", requirement: "R4175-PIPELINE-TOOLS", why: "old JS answer path deleted" },
    { id: "R4175.ask", requirement: "R4175-PIPELINE-TOOLS", why: "old JS answer path deleted" },
    { id: "R4175.receipt", requirement: "R4175-PIPELINE-TOOLS", why: "old JS answer path deleted" },
    { id: "R4175.hazard", requirement: "R4175-PIPELINE-TOOLS", why: "old JS answer path deleted" },
    { id: "R4174.recall", requirement: "R4174-LEARNING-LOOP", why: "old JS answer path deleted" },
    { id: "R4174.web", requirement: "R4174-LEARNING-LOOP", why: "old JS answer path deleted" },
    { id: "R4168.grace", requirement: "R4168-RESONANCE-PACKETS", why: "old JS answer path deleted" },
    { id: "R4168.gather", requirement: "R4168-RESONANCE-PACKETS", why: "old JS answer path deleted" },
    { id: "R4168.attach", requirement: "R4168-RESONANCE-PACKETS", why: "old JS answer path deleted" },
    { id: "R4167.h2s", requirement: "R4167-PUBLIC-RESEARCH", why: "old JS answer path deleted" },
    { id: "R4167.hs", requirement: "R4167-PUBLIC-RESEARCH", why: "old JS answer path deleted" },
    { id: "R4167.photo", requirement: "R4167-PUBLIC-RESEARCH", why: "old JS answer path deleted" },
    { id: "R4167.forge", requirement: "R4167-PUBLIC-RESEARCH", why: "old JS answer path deleted" },
    { id: "R4167.cos", requirement: "R4167-PUBLIC-RESEARCH", why: "old JS answer path deleted" },
    { id: "R4167.second", requirement: "R4167-PUBLIC-RESEARCH", why: "old JS answer path deleted" },
    { id: "R4166.process", requirement: "R4166-TRACE-QUOTA", why: "old JS answer path deleted" },
    { id: "R4166.h2s", requirement: "R4166-TRACE-QUOTA", why: "old JS answer path deleted" },
    { id: "R4166.hs", requirement: "R4166-TRACE-QUOTA", why: "old JS answer path deleted" },
    { id: "R4165.second", requirement: "R4165-RESONATE-ANCESTOR", why: "old JS answer path deleted" },
    { id: "R4165.miss", requirement: "R4165-RESONATE-ANCESTOR", why: "old JS answer path deleted" },
    { id: "R4163.whatis", requirement: "R4164-GZIP-LEAVE", why: "old JS answer path deleted" },
    { id: "R4163.whatis", requirement: "R4163-CIVICS-WH", why: "old JS answer path deleted" },
    { id: "R4163.rights", requirement: "R4163-CIVICS-WH", why: "old JS answer path deleted" },
    { id: "R4163.disc", requirement: "R4163-DISCOURSE-CS", why: "old JS answer path deleted" },
    { id: "R4163.miss", requirement: "R4163-DISCOURSE-CS", why: "old JS answer path deleted" },
    { id: "R4162.fa", requirement: "R4162-READ-CONNECT", why: "old JS answer path deleted" },
    { id: "R4162.yn", requirement: "R4162-READ-CONNECT", why: "old JS answer path deleted" },
    { id: "R4162.miss", requirement: "R4162-CS-BEFORE-AQ1", why: "old JS answer path deleted" },
    { id: "R4128.invent", requirement: "R4128-HOSTED", why: "old JS answer path deleted" }
  ];
  const RETIRED_REQUIREMENTS = [
    { id: "R4163-CIVICS-WH", release: "4.9.163", why: 'every linked test drove the deleted old JS answer path' },
    { id: "R4162-READ-CONNECT", release: "4.9.162", why: 'every linked test drove the deleted old JS answer path' },
    { id: "R4116-LEXICON", release: "4.9.116", why: 'only a version/registry check (R4116.record) was left after its behaviour links were retired' },
    { id: "R4116-FRAMES", release: "4.9.116", why: 'only a version/registry check (R4116.record) was left after its behaviour links were retired' },
    { id: "R4120-IDEA", release: "4.9.120", why: 'only a version/registry check (R4120.ver) was left after its behaviour links were retired' },
    { id: "R4121-COMPOSE", release: "4.9.121", why: 'only a version/registry check (R4121.ver) was left after its behaviour links were retired' },
    { id: "R4122-SUPPOSE", release: "4.9.122", why: 'only a version/registry check (R4122.ver) was left after its behaviour links were retired' },
    { id: "R4123-COMPOSE", release: "4.9.123", why: 'only a version/registry check (R4123.ver) was left after its behaviour links were retired' },
    { id: "R4124-SEED", release: "4.9.124", why: 'only a version/registry check (R4124.ver) was left after its behaviour links were retired' },
    { id: "R4179-FORGE2-WIRING", release: "4.9.179", why: 'only a version/registry check (R4179.ver) was left after its behaviour links were retired' },
    { id: "R4164-GZIP-LEAVE", release: "4.9.164", why: 'only a version/registry check (R4163.ver) was left after its behaviour links were retired' },
    { id: "R4163-DISCOURSE-CS", release: "4.9.163", why: 'only a version/registry check (R4163.ver) was left after its behaviour links were retired' },
    { id: "R4162-CS-BEFORE-AQ1", release: "4.9.162", why: 'only a version/registry check (R4162.ver) was left after its behaviour links were retired' }
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
    return '<div class="card"><div class="cardhead">Requirement packet</div><div class="small">Schema ' + SCHEMA + '.</div>' + body + '<div class="small">A passing behavior run does not override a failed gate.</div><div class="small" data-req-retired>Retired in 4.9.215 with the old JS answer path: ' + RETIRED_LINKS.length + ' test links and ' + RETIRED_REQUIREMENTS.length + ' requirements (' + RETIRED_REQUIREMENTS.map(r => r.id).join(', ') + ').</div></div>';
  }
  const api = { SCHEMA, RECEIPT_SCHEMA: RECEIPT, DOC9_CLASSES, PACKETS, RETIRED_LINKS, RETIRED_REQUIREMENTS, TEMPLATE, OUTSIDE_TARGETED, packet, releaseDecision, evidence, linksMissing, auditCard };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.KReqPacket = api;
})(typeof self !== 'undefined' ? self : this);
