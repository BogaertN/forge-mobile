/* KMEAPanels (4.9.213, Release C2): the MEA panels moved out of kernel.js with the same API — manifest proposals (mea_data.js),
 * the MEA-P problem lane (cycle, supply, tap-only commit, archive, requeue, hand-off), MEA-K grammar manifests and MEA-K meta.
 * The kernel calls MeaPanels(ctx) with the services it already owns (store, permissions, containment, TMS, lexicon) and
 * returns the same functions (forge.meaDetail, meaCycle, adoptManifest, ...). Moved verbatim; no behaviour change. No LLM. */
(function (root) {
const isNode = typeof module !== 'undefined' && module.exports;
function MeaPanels(ctx) {
  const { opts, MEAD, MEAKD, store, MEA, perm, now, sha256, canon, WR, TMS, cont, tmsSync, G, lex, activeFacts, QC, MEAP, entKeys, MEAPD, MEAK } = ctx;
  /* M5 (4.9.64) MEA: manifest proposals (mea_data.js, judged by tools/mea_eval.js on the held-out, mutation and world-state suites) are listed;
     one is adopted ONLY by a user tap, ONLY if its route is approvable (no regression, drift ε_s ≤ 0.35); shadow / held / rejected never adopt.
     Adoption is an M2 ledger item (kind rule, governed) justified by the fitness record and the user's approval, with a receipt; withdrawal is
     a governed write that restores the shipped rows and withdraws the ledger item (it never comes back on its own). One manifest is active. */
  const activeManifest = () => { const r = store.load('admitted_manifests').filter(x => x.status === 'adopted').pop(); return r ? r.deltas : null; };
  const MEAX = (opts && opts.meaData) || MEAD; /* a test may supply its own proposal set; the app uses the shipped one */
  const meaCandidates = () => { const ad = store.load('admitted_manifests'); return (MEAX.candidates || []).map(c => Object.assign({}, c, { status: (ad.filter(x => x.id === c.id).pop() || {}).status || 'proposed' })); };
  function adoptManifest(id, userTap) { const c = (MEAX.candidates || []).find(x => x.id === id); if (!c) return { ok: false, rule: 'MEA-UNKNOWN' }; if (MEA.legality(c.deltas).length) return { ok: false, rule: 'MEA-ILLEGAL', violations: MEA.legality(c.deltas) }; /* legality gate (4.9.65) */
    if (c.fitness.route !== 'approvable') return { ok: false, rule: 'MEA-NOT-APPROVABLE', route: c.fitness.route, drift: c.fitness.drift };
    if (MEA.idOf(c.deltas) !== c.id) return { ok: false, rule: 'MEA-ID-MISMATCH' };
    const d = perm.authorize('hypothesis.write', { userTap, subject: id }); if (d.decision !== 'allow') return { ok: false, rule: d.rule, decision: d.decision };
    const ad = store.load('admitted_manifests'), prev = ad.filter(x => x.status === 'adopted'); for (const p of prev) Object.assign(p, { status: 'withdrawn', withdrawn_at: now(), withdrawn_by: 'superseded by ' + id });
    const body = { schema: MEA.SCHEMA, id, deltas: c.deltas, fitness: c.fitness, suites: c.suites, approval: d.id || null }; const rec = Object.assign({}, body, { status: 'adopted', adopted_at: now(), receipt_sha256: sha256(canon(body)) });
    ad.push(rec); store.save('admitted_manifests', ad); WR.setManifest(c.deltas);
    TMS.justify({ id, kind: 'rule', text: 'manifest ' + id + ': ' + MEA.describe(c), external: true }, { premises: [{ id: 'mea-adopt:' + id, text: 'adopted by user tap (receipt ' + rec.receipt_sha256.slice(0, 12) + ')' }], rules: ['MEA-ADOPT'], replay: { deltas: c.deltas, fitness: { passed: c.fitness.passed, regressions: c.fitness.regressions, eps_s: c.fitness.drift.eps_s } } });
    cont.receipt('manifest.adopt', { id, receipt: rec.receipt_sha256, superseded: prev.map(p => p.id) }); const tm = tmsSync({ op: 'manifest.adopt', id }); return { ok: true, adopted: id, receipt: rec.receipt_sha256, superseded: prev.map(p => p.id), tms: { withdrawn: tm.withdrawn.map(x => x.id) }, mea_requeue: meaRequeue('kernel:manifest:' + id) }; }
  /* MEA problem lane (4.9.72): problem manifests (data) → cycle (pure, session) → tap-only commit → archive (cold storage) / requeue → RMC handoff. No per-problem code here. */
  const meaCyc = new Map(), meaDraft = new Map(), meaPending = new Map(); /* a draft is kept only when its reading is the SELECTED meaning of the turn */
  /* MEAP-PROBLEM-DIRECTIVE (4.9.79): an open problem is recognised from the clause's lexical classes, never from its words: the karma is a
     cognition artefact (a WordNet noun.cognition sense among its first two: an explanation, method, proof, theory), or the clause carries a
     purpose infinitive whose goal the karma serves ("a way to X"), or the verb itself is a cognition verb (verb.cognition among its first two
     senses: solve, prove, estimate) with an object. The problem is opened as a DRAFT manifest in the MEA lane: the goal is the realized clause,
     the unknown is the karma, the user's relevant working facts are its given facts; cycles are pure and a commit needs the user's tap. */
  function problemOf(c) { if (!c || !c.verb || c.verb.pol === 'neg' || c.coord) return null; const ro = c.roles || {}, k = ro.karma, v = c.verb.lemma;
    const cls = (w, pos) => (lex.senses(w) || []).filter(s => s.pos === pos).slice(0, 2).map(s => s.lexname);
    const hd = n => n && n.head && !n.pron && !n.pron3 ? n.head[n.head.length - 1] : null;
    const kh = hd(k), basis = kh && cls(kh, 'n').includes('noun.cognition') ? 'karma noun.cognition' : (ro.prayojana && ro.prayojana.purpose && kh && !k.owner) ? 'purpose infinitive' : (k && (cls(v, 'v')[0] === 'verb.cognition' || (k.clause && cls(v, 'v').includes('verb.cognition')))) ? 'verb.cognition' : null; /* a cognition verb by its first sense, or any cognition sense over a proposition ("prove that …") */
    if (!basis) return null; const goal = G.vpText(Object.assign({}, c, { subj: undefined, verb: Object.assign({}, c.verb, { mod: 'asserted', tense: 'none', nf: 'inf' }) }), null, 'kernel').replace(/^to /, '');
    const inf = ro.prayojana && ro.prayojana.purpose ? ro.prayojana.inf : null, unknown = k ? (k.clause ? 'whether ' + G.clauseText(k.clause, 'kernel') : G.npText(k, 'kernel') + (inf ? ' ' + G.vpText(Object.assign({}, inf, { subj: undefined, verb: Object.assign({}, inf.verb, { mod: 'asserted', tense: 'none', nf: 'inf' }) }), null, 'kernel') : '')) : goal; /* the purpose belongs to the unknown: "a way to X" */ return { goal, unknown, basis, clause: c }; }
  function openProblem(pb) { const ro0 = pb.clause.roles || {}, inf0 = ro0.prayojana && ro0.prayojana.inf, kc = ro0.karma && ro0.karma.clause; /* the problem's entities: its karma, the purpose clause's participants, a proposition's participants */
    const parts = n => !n ? [] : [n.roles && n.roles.karma, n.subj, n.pred && n.pred.np, ...(n.adj || []).map(a => a.np)]; const ents = new Set([].concat(...[ro0.karma && !ro0.karma.clause ? ro0.karma : null, ...parts(inf0), ...parts(kc)].filter(Boolean).filter(n => !n.pron && !n.pron3).map(n => { try { return entKeys(n); } catch (e) { return []; } })));
    const recs = activeFacts().filter(r => !r.sensitive && (r.entities || []).some(e => ents.has(e))), facts = recs.map((r, i) => ({ id: 'f' + (i + 1), text: G.clauseText(r.clause, 'user'), tier: 'given' }));
    /* MEAP-OPTIONS-FROM-FACTS (4.9.80): each related working fact names another participant of the problem's entity (its karma, predicate noun or
       PP noun that is not the problem's own entity): that participant is one OPTION of a choice unknown, with the fact as its assumption and a
       falsifier derived from the goal. Two or more distinct options make the unknown a choice (the cycle hypothesizes each); fewer stay a value. */
    const opts = []; recs.forEach((r, i) => { const c = r.clause || {}, ro = c.roles || {}; for (const n of [ro.karma, c.pred && c.pred.np, c.pred && c.pred.type !== 'pp' && c.pred.head ? c.pred : null, ...(c.adj || []).map(a => a.np)].filter(Boolean)) { let ks = []; try { ks = entKeys(n); } catch (e) { ks = []; } if (!ks.length || ks.some(x => ents.has(x)) || n.pron || n.pron3 || n.clause) continue; const text = G.npText(n, 'user'); if (!opts.some(o => o.text === text)) opts.push({ id: 'o' + (opts.length + 1), text, assumptions: [facts[i].text], falsifier: text + ' does not ' + pb.goal.replace(/^(?:find|devise|propose|suggest) (?:a|an|the) \w+ to /, ''), uses: [facts[i].id] }); } });
    /* MEAP-OPTION-RANK (4.9.81): options are ordered by how many goal words (the goal's content words that are not the problem's entities) the
       WordNet glosses of the option's head noun (first two noun senses) share by stem ("heater: … supplies warmth" for "keep … warm"); ties keep
       the order of the facts. The ranking only orders the hypotheses; every option is still tested. */
    if (opts.length >= 2) { const STOP = /^(a|an|the|to|of|for|and|or|in|on|at|by|with|way|find|devise|propose|suggest|something|that|which|is|are|be|it)$/; const entW = new Set([...ents].map(e => String(e).split(/[^a-z]+/)).flat());
      const gw = (String(pb.goal).toLowerCase().match(/[a-z]+/g) || []).filter(w => !STOP.test(w) && !entW.has(w) && w.length >= 3); const sm = (a, b) => a === b || (Math.min(a.length, b.length) >= 4 && (a.startsWith(b) || b.startsWith(a)));
      const score = o => { const hd = (o.text.toLowerCase().match(/[a-z]+/g) || []).pop() || ''; const gl = (lex.senses(hd) || []).filter(s => s.pos === 'n').slice(0, 2).map(s => s.gloss.toLowerCase()).join(' ').match(/[a-z]+/g) || []; return gw.filter(g => gl.some(x => sm(x, g))).length; };
      const sc = opts.map((o, i) => [score(o), i]); if (sc.some(x => x[0] > 0)) { sc.sort((a, b) => b[0] - a[0] || a[1] - b[1]); const re = sc.map(x => opts[x[1]]); re.forEach((o, i) => { o.id = 'o' + (i + 1); }); opts.splice(0, opts.length, ...re); } }
    /* MEAP-OPTION-RANK slice 1 (4.9.96): when archive evidence is already on the consult path, re-score options with RSOC_STANDING + DRIFT_TABLE; hold when every option is above the projectable band */
    let option_ranking = null; if (opts.length >= 2 && pb.evidence && pb.evidence.length && QC && QC.rankOptions) { option_ranking = QC.rankOptions(opts, pb.evidence, null); if (option_ranking && option_ranking.options) { const order = option_ranking.options.map(o => o.id); opts.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id)); opts.forEach((o, i) => { o.id = 'o' + (i + 1); }); } }
    const u1 = opts.length >= 2 ? { id: 'u1', text: pb.unknown, kind: 'choice', options: opts } : { id: 'u1', text: pb.unknown, kind: 'measurement' };
    const pid = 'user:' + sha256(canon({ goal: pb.goal })).slice(0, 12), M = MEAP.normalize({ problem_id: pid, goal: pb.goal, known_facts: facts, unknowns: [u1], success_conditions: [{ id: 's1', text: pb.goal, unknown: 'u1' }], required_next_action: opts.length >= 2 ? 'test_required' : 'supply_value' });
    if (!meaCurrent(pid)) meaPending.set(pid, M); return Object.assign({ kind: 'mea_problem_opened', problem_id: pid, goal: pb.goal, unknown: pb.unknown, facts: facts.length }, opts.length >= 2 ? { options: opts.map(o => o.text) } : {}, option_ranking ? { option_ranking, hold: !!option_ranking.hold } : {}); }
  function meaCurrent(pid) { if (meaDraft.has(pid)) return meaDraft.get(pid); const st = store.load('mea_problems').filter(x => x.problem_id === pid); if (st.length) return st[st.length - 1]; const seed = (MEAPD.problems || []).find(p => p.id === pid); return seed ? MEAP.normalize(seed) : null; }
  function meaProblems() { const st = store.load('mea_problems'), ids = []; for (const p of (MEAPD.problems || [])) ids.push(p.id); for (const m of st) if (!ids.includes(m.problem_id)) ids.push(m.problem_id); for (const k of meaDraft.keys()) if (!ids.includes(k)) ids.push(k);
    return ids.map(id => { const M = meaCurrent(id); return M && { problem_id: id, sub_of: M.sub_of || null, sub_manifests: st.filter(x => x.sub_of === id).map(x => x.problem_id).filter((x, i, a) => a.indexOf(x) === i), goal: M.goal, phase_state: M.phase_state, claim_status: M.claim_status, required_next_action: M.required_next_action, output_permissions: M.output_permissions, cycle: M.cycle || 0, draft: meaDraft.has(id), parent_hash: M.parent_hash || null, value_unknowns: M.unknowns.filter(u => u.kind !== 'choice' && u.value == null).map(u => ({ id: u.id, text: u.text })), hash: M.hash }; }).filter(Boolean); }
  /* Memory → MEA panel (4.9.74, MEA build-plan step 8): one read-only view per problem — manifest fields, unknown vector, proof debt, convergence,
     claim-status history, the last cycle's candidates with every gate result, the lineage / audit chain (hash chain, operator history, receipts) and
     the archive. Reads only; every write stays behind its own tap-gated function (meaCycle is pure, meaSupply is a session draft, meaCommit needs a tap). */
  function meaDetail(pid) { const M = meaCurrent(pid); if (!M) return { ok: false, rule: 'MEAP-UNKNOWN' }; const seed = (MEAPD.problems || []).find(p => p.id === pid);
    const versions = (seed ? [MEAP.normalize(seed)] : []).concat(store.load('mea_problems').filter(x => x.problem_id === pid)), hashes = new Set(versions.map(v => v.hash)), e = meaCyc.get(pid);
    const cy = e ? e.cy : null, res = cy && cy.resolution, und = res ? (res.premises || []).filter(q => !MEAP.DISCHARGED.includes(q.tier)) : null;
    return { ok: true, problem_id: pid, proposed: !!(seed && seed.proposed), sub_of: M.sub_of || null,
      manifest: { goal: M.goal, domain: M.domain || (seed && seed.domain) || null, phase_state: M.phase_state, claim_status: M.claim_status, required_next_action: M.required_next_action, output_permissions: M.output_permissions, known_facts: M.known_facts, unknowns: M.unknowns, derivations: M.derivations, success_conditions: M.success_conditions, constraints: M.constraints, contradictions: M.contradictions, claims: M.claims, hash: M.hash, parent_hash: M.parent_hash || null },
      unknown_vector: MEAP.unknownVector(M),
      proof_debt: { manifest_micro: M.proof_debt_micro == null ? null : M.proof_debt_micro, cycle_B_micro: res ? res.terms.B : null, formula: res ? res.terms.formula.B : null, undischarged: und, rule: 'internal facts count as unproven; published / primary evidence as proven (ruling 3, 4.9.74)' },
      convergence: versions.map(v => ({ cycle: v.cycle || 0, phase_state: v.phase_state, claim_status: v.claim_status, next: v.required_next_action, open_unknowns: MEAP.unknownVector(v).filter(u => !u.resolved).length, hash: v.hash })),
      claim_history: versions.map(v => ({ cycle: v.cycle || 0, claim_status: v.claim_status, claims: (v.claims || []).map(c => ({ text: c.text, status: c.status })) })),
      candidates: cy ? cy.candidates.concat(res ? [res] : []).map(c => ({ id: c.candidate_id, op: c.op, kind: c.kind, route: c.route, claim_status: c.claim_status, claim: c.claim, terms: c.terms, gates: c.gates.map(g => ({ gate: g.gate, ok: g.ok, note: g.note || g.detail || null })), rank: c.rank || null, favoured: !!c.favoured })) : [],
      lineage: { chain: versions.map(v => ({ hash: v.hash, parent: v.parent_hash || null, cycle: v.cycle || 0 })), operator_history: M.operator_history || [], receipts: store.load('mea_receipts').filter(r => hashes.has(r.parent_manifest_hash) || hashes.has(r.manifest_hash)), sub_manifests: store.load('mea_problems').filter(x => x.sub_of === pid).map(x => x.problem_id).filter((x, i, a) => a.indexOf(x) === i) },
      archive: store.load('mea_archive').filter(a => a.problem_id === pid) }; }
  function meaCycle(pid) { const M = meaCurrent(pid); if (!M) return { ok: false, rule: 'MEAP-UNKNOWN' }; const ms = MEAK ? MEAK.metaSettings(activeMeta()).MEAP : null; const cy = ms ? MEAP.cycle(M, { budget: ms.budget, costs: ms.costs, order: ms.order }) : MEAP.cycle(M); meaCyc.set(pid, { M, cy }); return { ok: true, cycle: cy }; }
  /* 4.9.104: the same cycle as meaCycle, but not cached and not stored. The propose turn caches it only after Echo. */
  function mutableCells() { if (!MEAK || !MEAK.cells) return []; const all = MEAK.cells();
    const frame = all.find(c => c.fam === 'frame' && c.row === 'ADJ_INF' && c.type === 'role'), parser = all.find(c => c.fam === 'parser' && c.type === 'bool' && c.growth);
    const spec = c => { if (!c) return null; const base = MEAK.baseVal(c), proposed = c.type === 'bool' ? !base : (c.values || []).find(v => v !== base); if (proposed === undefined || proposed === base) return null;
      const legal = MEAK.legality([{ fam: c.fam, row: c.row, key: c.key, value: proposed }]).length === 0; return { fam: c.fam, row: c.row, key: c.key, base, proposed, legal, eps: 0 }; };
    return MEAP.mutableCandidates([spec(frame), spec(parser)].filter(Boolean)); }
  function proposePacked(pid) { const M = meaCurrent(pid); if (!M) return null; const ms = MEAK ? MEAK.metaSettings(activeMeta()).MEAP : null;
    const prior = (store.load('mea_archive') || []).filter(a => a && a.problem_id === pid).map(a => ({ claim: a.claim, op: a.op, blocked_on: (a.blocked_on || []).slice() }));
    const continued = (M.cycle || 0) >= 1, o = { prior, carry_claims: continued }; if (ms) { o.budget = ms.budget; o.costs = ms.costs; o.order = ms.order; }
    const cy = MEAP.cycle(M, o); return { pid, M, cy, screen: MEAP.screen(M, cy), mutable: continued ? mutableCells() : [] }; }
  function appendMeaArchive(rows) { if (!rows || !rows.length) return 0; const ar = store.load('mea_archive'), have = new Set(ar.map(a => a.id)); let n = 0; for (const a of rows) if (a && a.id && !have.has(a.id)) { ar.push(a); have.add(a.id); n++; } if (n) store.save('mea_archive', ar); return n; }
  function meaSupply(pid, uid, value) { const M = meaCurrent(pid); if (!M) return { ok: false, rule: 'MEAP-UNKNOWN' }; const r = MEAP.supply(M, uid, value); if (r.ok) { meaDraft.set(pid, r.manifest); meaCyc.delete(pid); } return r; }
  function meaCommit(pid, candId, userTap) { const e = meaCyc.get(pid); if (!e) return { ok: false, rule: 'MEAP-NO-CYCLE' };
    const d = perm.authorize('hypothesis.write', { userTap, subject: 'mea:' + pid }); if (d.decision !== 'allow') return { ok: false, rule: d.rule, decision: d.decision };
    const r = MEAP.commit(e.M, e.cy, candId, userTap === true); if (!r.ok) return r;
    const ps = store.load('mea_problems'); ps.push(r.manifest); for (const ch of r.children) ps.push(ch); store.save('mea_problems', ps);
    const cs = store.load('mea_candidates'); cs.push({ problem_id: pid, cycle_hash: e.cy.cycle_hash, at: now(), candidates: e.cy.candidates.map(c => ({ id: c.candidate_id, op: c.op, kind: c.kind, route: c.route, claim_status: c.claim_status, rank: c.rank || null, terms: c.terms })) }); store.save('mea_candidates', cs.slice(-200));
    appendMeaArchive(r.archive);
    const rc = store.load('mea_receipts'); rc.push(r.receipt); for (const w of r.withdrawn) rc.push(w); store.save('mea_receipts', rc);
    meaDraft.delete(pid); meaCyc.delete(pid); cont.receipt('mea.commit', { problem_id: pid, receipt: r.receipt.receipt_sha256, claim_status: r.manifest.claim_status });
    return { ok: true, manifest: r.manifest, children: r.children.map(c => c.problem_id), archived: r.archive.length, withdrawn: r.withdrawn.length, receipt: r.receipt }; }
  const meaRequeue = cap => MEAP.requeue(store.load('mea_archive'), cap); function meaHandoffOf(pid) { const M = meaCurrent(pid); return M ? MEAP.handoff(M) : { ok: false, rule: 'MEAP-UNKNOWN' }; }
  function withdrawManifest(id, userTap) { const ad = store.load('admitted_manifests'), r = ad.find(x => x.id === id && x.status === 'adopted'); if (!r) return { ok: false, rule: 'MEA-NOT-ADOPTED' };
    const d = perm.authorize('hypothesis.write', { userTap, subject: id }); if (d.decision !== 'allow') return { ok: false, rule: d.rule, decision: d.decision };
    Object.assign(r, { status: 'withdrawn', withdrawn_at: now(), withdrawn_by: 'user' }); store.save('admitted_manifests', ad); WR.setManifest(activeManifest());
    cont.receipt('manifest.withdraw', { id }); const tm = tmsSync({ op: 'manifest.withdraw', id }); return { ok: true, withdrawn: id, tms: { withdrawn: tm.withdrawn.map(x => x.id), receipts: tm.receipts.map(x => x.id) } }; }
  /* MEA-K (4.9.75, MEA build-plan step 6): grammar manifests — lexicon classes, frames, open parser categories (src/mea_k.js). Exactly like the
     relation-property manifests above: build-time evaluated proposals (src/mea_k_data.js), adopted ONLY by a user tap, ONLY when approvable (legal,
     a non-vacuous evidence delta, 0 regressions, ε_s ≤ 0.35, structure-dependence guard intact); one active; re-applied at every process();
     withdrawal restores the shipped tables. Adoption is a capability change: archived MEA-P problems and archived MEA-K candidates are requeued
     as PROPOSALS citing it (step 7) — nothing is re-run or adopted on its own. */
  const activeManifestK = () => { const r = store.load('admitted_manifests_k').filter(x => x.status === 'adopted').pop(); return r ? r.deltas : null; };
  const MEAKX = (opts && opts.meaKData) || MEAKD;
  const meaCandidatesK = () => { const ad = store.load('admitted_manifests_k'); return (MEAKX.candidates || []).map(c => Object.assign({}, c, { status: (ad.filter(x => x.id === c.id).pop() || {}).status || 'proposed' })); };
  const meaArchiveK = () => (MEAKX.archive || []).slice();
  const meaRequeueK = cap => (MEAKX.archive || []).filter(a => a.blocked_on && /^capability:/.test(a.blocked_on)).map(a => ({ id: a.id, route: 'proposal', reason: 'capability changed: ' + cap + ' (was: ' + a.reason + ')', cites: cap, anchors: a.anchors, adopt: false }));
  /* MEA-K META (4.9.74, step 7): MEA's own data — MEA-P budget / operator schedule / operator costs, MEA-K proposal budget and pool size — evolves only
     through approvable meta manifests adopted by tap; gates, thresholds and the drift ruling have no cell. The active MEA-P settings drive every meaCycle. */
  const activeMeta = () => { const r = store.load('admitted_meta').filter(x => x.status === 'adopted').pop(); return r ? r.deltas : []; };
  const meaMetaK = () => { const ad = store.load('admitted_meta'); return (((MEAKX.meta || {}).candidates) || []).map(c => Object.assign({}, c, { status: (ad.filter(x => x.id === c.id).pop() || {}).status || 'proposed' })); };
  function adoptMetaK(id, userTap) { const c = (((MEAKX.meta || {}).candidates) || []).find(x => x.id === id); if (!c) return { ok: false, rule: 'MEAK-META-UNKNOWN' };
    const lg = MEAK.metaLegality(c.deltas); if (lg.length) return { ok: false, rule: 'MEAK-META-ILLEGAL', violations: lg }; if (c.fitness.route !== 'approvable') return { ok: false, rule: 'MEAK-META-NOT-APPROVABLE', route: c.fitness.route };
    if (MEAK.metaId(c.deltas) !== c.id) return { ok: false, rule: 'MEAK-ID-MISMATCH' }; const d = perm.authorize('hypothesis.write', { userTap, subject: id }); if (d.decision !== 'allow') return { ok: false, rule: d.rule, decision: d.decision };
    const ad = store.load('admitted_meta'), prev = ad.filter(x => x.status === 'adopted'); for (const p of prev) Object.assign(p, { status: 'withdrawn', withdrawn_at: now(), withdrawn_by: 'superseded by ' + id });
    const body = { schema: 'FORGE-MEA-META/v1', id, deltas: c.deltas, fitness: c.fitness, approval: d.id || null }, rec = Object.assign({}, body, { status: 'adopted', adopted_at: now(), receipt_sha256: sha256(canon(body)) }); ad.push(rec); store.save('admitted_meta', ad);
    cont.receipt('meta.adopt', { id, receipt: rec.receipt_sha256 }); const cap = 'kernel:meta:' + id; return { ok: true, adopted: id, receipt: rec.receipt_sha256, settings: MEAK.metaSettings(c.deltas), mea_requeue: meaRequeue(cap), meak_requeue: meaRequeueK(cap) }; }
  function withdrawMetaK(id, userTap) { const ad = store.load('admitted_meta'), r = ad.find(x => x.id === id && x.status === 'adopted'); if (!r) return { ok: false, rule: 'MEAK-NOT-ADOPTED' };
    const d = perm.authorize('hypothesis.write', { userTap, subject: id }); if (d.decision !== 'allow') return { ok: false, rule: d.rule, decision: d.decision };
    Object.assign(r, { status: 'withdrawn', withdrawn_at: now(), withdrawn_by: 'user' }); store.save('admitted_meta', ad); cont.receipt('meta.withdraw', { id }); return { ok: true, withdrawn: id }; }
  function adoptManifestK(id, userTap) { const c = (MEAKX.candidates || []).find(x => x.id === id); if (!c) return { ok: false, rule: 'MEAK-UNKNOWN' };
    const lg = MEAK.legality(c.deltas); if (lg.length) return { ok: false, rule: 'MEAK-ILLEGAL', violations: lg };
    if (c.fitness.route !== 'approvable') return { ok: false, rule: 'MEAK-NOT-APPROVABLE', route: c.fitness.route, drift: c.fitness.drift };
    if (c.fitness.structure_guard_regressions) return { ok: false, rule: 'MEAK-STRUCTURE-GUARD' };
    if (MEAK.idOf(c.deltas) !== c.id) return { ok: false, rule: 'MEAK-ID-MISMATCH' };
    const d = perm.authorize('hypothesis.write', { userTap, subject: id }); if (d.decision !== 'allow') return { ok: false, rule: d.rule, decision: d.decision };
    const ad = store.load('admitted_manifests_k'), prev = ad.filter(x => x.status === 'adopted'); for (const p of prev) Object.assign(p, { status: 'withdrawn', withdrawn_at: now(), withdrawn_by: 'superseded by ' + id });
    const body = { schema: MEAK.SCHEMA, id, deltas: c.deltas, fitness: c.fitness, suites: c.suites, approval: d.id || null }; const rec = Object.assign({}, body, { status: 'adopted', adopted_at: now(), receipt_sha256: sha256(canon(body)) });
    ad.push(rec); store.save('admitted_manifests_k', ad); MEAK.apply(c.deltas);
    TMS.justify({ id, kind: 'rule', text: 'grammar manifest ' + id + ': ' + MEAK.describe(c), external: true }, { premises: [{ id: 'meak-adopt:' + id, text: 'adopted by user tap (receipt ' + rec.receipt_sha256.slice(0, 12) + ')' }], rules: ['MEAK-ADOPT'], replay: { deltas: c.deltas, fitness: { passed: c.fitness.passed, regressions: c.fitness.regressions, eps_s_micro: c.fitness.drift.eps_s_micro } } });
    cont.receipt('manifest_k.adopt', { id, receipt: rec.receipt_sha256, superseded: prev.map(p => p.id) }); const tm = tmsSync({ op: 'manifest_k.adopt', id }); const cap = 'kernel:grammar:' + id;
    return { ok: true, adopted: id, receipt: rec.receipt_sha256, superseded: prev.map(p => p.id), tms: { withdrawn: tm.withdrawn.map(x => x.id) }, mea_requeue: meaRequeue(cap), meak_requeue: meaRequeueK(cap) }; }
  function withdrawManifestK(id, userTap) { const ad = store.load('admitted_manifests_k'), r = ad.find(x => x.id === id && x.status === 'adopted'); if (!r) return { ok: false, rule: 'MEAK-NOT-ADOPTED' };
    const d = perm.authorize('hypothesis.write', { userTap, subject: id }); if (d.decision !== 'allow') return { ok: false, rule: d.rule, decision: d.decision };
    Object.assign(r, { status: 'withdrawn', withdrawn_at: now(), withdrawn_by: 'user' }); store.save('admitted_manifests_k', ad); MEAK.apply(activeManifestK());
    cont.receipt('manifest_k.withdraw', { id }); const tm = tmsSync({ op: 'manifest_k.withdraw', id }); return { ok: true, withdrawn: id, tms: { withdrawn: tm.withdrawn.map(x => x.id), receipts: tm.receipts.map(x => x.id) } }; }
  return { meaDetail, meaMetaK, adoptMetaK, withdrawMetaK, meaCandidatesK, meaArchiveK, meaRequeueK, adoptManifestK, withdrawManifestK, meaProblems, meaCycle, meaSupply, meaCommit, meaRequeue, meaHandoffOf, meaCandidates, adoptManifest, withdrawManifest, proposePacked, problemOf, openProblem, activeManifest, activeManifestK, meaPending, meaDraft, meaCyc, appendMeaArchive }; }
const api = { MeaPanels };
if (isNode) module.exports = api; else root.KMEAPanels = api;
})(this);
