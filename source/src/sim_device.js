/* 4.9.245 sim_device.js — on-device simulators, and the optional Home PC Simulator slot.
 * A simulation question is compiled by the engine (sim_device.py in the Pyodide worker), then measured on this phone:
 * Python families (SymPy, SciPy, Biopython, astropy) load from the pinned Pyodide lock; WASM families (MuJoCo, RDKit,
 * ngspice) run in src/sim_wasm_worker.js with pinned SHA-384 files. Each run returns a sealed FORGE-SIM-RECEIPT/v1
 * whose rows are this turn's measured premises (never stored). Heavy solvers (OpenFOAM CFD, PySCF Hartree-Fock/DFT)
 * need a computer: they go to the Home PC Simulator when the user set one (localStorage forge.sim_router), else they
 * hold and say so. No Google Cloud, no third-party backend. No model. */
(function (root) {
  'use strict';
  const LS_ROUTER = 'forge.sim_router', LS_ASSETS = 'forge.sim_assets';
  const GATE = /^\s*what\s+(?:will\s+)?happens?\s+(?:if|when)\s+|\b(?:molecular|molar)\s+(?:weight|mass|formula|structure)\s+of\b|\b(?:cfd|navier[- ]stokes|air ?flow|wind tunnel|hartree[- ]fock|density functional|ab initio)\b/i;
  let pyc = null, ww = null, wn = 0; const wpend = new Map();
  let lastScene = null;
  const okUrl = u => /^https:\/\/[^\s]+$/.test(u) || /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?(\/|$)/.test(u);
  function get(k) { try { return String(root.localStorage.getItem(k) || '').trim(); } catch (e) { return ''; } }
  function routerBase() { const u = get(LS_ROUTER); return okUrl(u) ? u.replace(/\/+$/, '') : null; }
  function assetsBase() { const u = get(LS_ASSETS); return okUrl(u) || /^\/[^/]/.test(u) ? u.replace(/\/+$/, '') : null; }
  function bundle() {
    const B = root.KRMC && root.KRMC.BUNDLE; if (!B) throw new Error('rmc_client_missing');
    const o = { bundleUrl: new URL(B.url, root.location.href).href, bundleSri: B.sri };
    const local = assetsBase(); if (local) o.base = new URL(local + '/pyodide/v0.27.7/full/', root.location.href).href;
    return o;
  }
  function pyCall(arg) {
    if (!root.KPyCheck || !root.KPyCheck.Client) return Promise.reject(new Error('pyodide_client_missing'));
    pyc = pyc || root.KPyCheck.Client({ workerUrl: 'src/py_worker.js' });
    const call = Object.assign({}, arg, {
      grammarUrl: new URL('src/grammar.js', root.location.href).href,
      realizeUrl: new URL('src/realize_atom.js', root.location.href).href,
    });
    return pyc.sim(call, bundle());
  }
  function wasmCall(cmd, arg) {
    if (!ww) {
      if (root.location.protocol === 'file:' || root.KSIM_NO_WASM_WORKER) return Promise.reject(new Error('wasm_needs_installed_site'));
      ww = new root.Worker(new URL('src/sim_wasm_worker.js', root.location.href), { type: 'module' });
      ww.onmessage = e => { const p = wpend.get(e.data.id); if (!p) return; wpend.delete(e.data.id); e.data.ok ? p.res(e.data.out) : p.rej(new Error(e.data.error)); };
      ww.onerror = e => { for (const p of wpend.values()) p.rej(new Error('sim_wasm_worker_error ' + (e && e.message || ''))); wpend.clear(); ww = null; };
    }
    const local = assetsBase();
    return new Promise((res, rej) => { const id = ++wn; wpend.set(id, { res, rej }); ww.postMessage({ id, cmd, arg, local: local ? new URL(local, root.location.href).href : null }); });
  }
  async function homePc(problem, frame) {
    const base = routerBase();
    if (!base) return pyCall({ op: 'hold', problem, reason: 'home_pc_required' });
    const ac = root.AbortController ? new AbortController() : null; const timer = ac ? setTimeout(() => ac.abort(), 180000) : null;
    try {
      const r = await root.fetch(base + '/v1/simulate', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ question: String(problem.question).slice(0, 400), frame: frame || null }), signal: ac ? ac.signal : undefined, credentials: 'omit' });
      const j = r.ok ? await r.json() : null;
      if (j && j.schema === 'FORGE-SIM-RECEIPT/v1') { j.where = j.where || 'home_pc'; return j; }
      return pyCall({ op: 'hold', problem, reason: 'home_pc_bad_reply' });
    } catch (e) { return pyCall({ op: 'hold', problem, reason: 'home_pc_unreachable' }); }
    finally { if (timer) clearTimeout(timer); }
  }
  function frameOf(q) {
    try {
      const Q = root.KQFrame, forge = root.forge;
      if (Q && forge && typeof Q.compile === 'function') return Q.compile(q, forge);
    } catch (e) { /* the engine still receives the question; a missing frame holds */ }
    return null;
  }
  function fetchT(url, ms) {
    const ac = root.AbortController ? new AbortController() : null;
    const timer = ac ? setTimeout(() => ac.abort(), ms || 4000) : null;
    return root.fetch(url, { credentials: 'omit', signal: ac ? ac.signal : undefined }).finally(() => { if (timer) clearTimeout(timer); });
  }
  async function athenaFacts(problem) {
    let timer;
    const cap = new Promise(res => { timer = setTimeout(() => res(null), 20000); });
    try { return await Promise.race([athenaLookup(problem), cap]); }
    finally { if (timer) clearTimeout(timer); }
  }
  async function athenaLookup(problem) {
    const reason = problem && problem.reason;
    if (!reason || !/unknown_substance|unknown_body|property_missing/.test(reason)) return null;
    const scene = problem.scene || {};
    const name = problem.substance || problem.body || (typeof scene.body === 'string' ? scene.body : (scene.body && scene.body.noun));
    if (!name || !root.fetch) return null;
    const kind = reason === 'unknown_substance' || problem.substance ? 'chemical' : (problem.missing === 'radius' ? 'body' : 'object');
    try {
      if (kind === 'chemical') {
        const pub = await (await fetchT('https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/' + encodeURIComponent(name) + '/property/MolecularFormula,MolecularWeight,InChIKey,IsomericSMILES/JSON', 4000)).text();
        const search = await (await fetchT('https://www.ebi.ac.uk/ols4/api/search?ontology=chebi&exact=true&q=' + encodeURIComponent(name), 4000)).json();
        const obo = (((search.response || {}).docs || []).find(d => d && String(d.obo_id || '').indexOf('CHEBI:') === 0) || {}).obo_id;
        if (!obo) return null;
        const term = await (await fetchT('https://www.ebi.ac.uk/ols4/api/ontologies/chebi/terms?obo_id=' + encodeURIComponent(obo), 4000)).text();
        const agreed = await pyCall({ op: 'chem', name: name, pub: pub, term: term });
        if (agreed && (agreed.held || []).some(h => h && h.reason === 'publishers_disagree')) return agreed;
        return agreed && agreed.ok && agreed.ok.length ? agreed.ok : null;
      }
      if (kind === 'body' || problem.missing === 'radius') {
        const cardUrl = 'https://ssp.imcce.fr/webservices/ssodnet/api/ssocard/' + encodeURIComponent(name);
        const quaeroUrl = 'https://api.ssodnet.imcce.fr/quaero/1/sso?q=' + encodeURIComponent(name) + '&type=Satellite&limit=1';
        const card = await fetchT(cardUrl, 8000).then(r => r.text()).catch(() => '');
        const quaero = await fetchT(quaeroUrl, 8000).then(r => r.text()).catch(() => '');
        const agreed = await pyCall({ op: 'body', name: name, card: card, card_url: cardUrl, quaero: quaero });
        return agreed && agreed.ok && agreed.ok.length ? agreed.ok : null;
      }
      if (problem.vehicle) {
        const phrase = String((problem.scene && problem.scene.phrase) || name);
        const qn = encodeURIComponent(phrase);
        const nhtsaUrl = 'https://vpic.nhtsa.dot.gov/api/vehicles/GetCanadianVehicleSpecifications/?year=2020&make=' + qn + '&model=' + qn + '&format=json';
        const epaUrl = 'https://www.fueleconomy.gov/ws/rest/vehicle/menu/model?year=2020&make=' + qn;
        const nhtsaRaw = await fetchT(nhtsaUrl, 8000).then(r => r.text()).catch(() => '');
        const epaRaw = await fetchT(epaUrl, 8000).then(r => r.text()).catch(() => '');
        const parsed = await pyCall({ op: 'vehicle', name: phrase, nhtsa_url: nhtsaUrl, epa_url: epaUrl, nhtsa_raw: nhtsaRaw, epa_raw: epaRaw });
        return parsed && parsed.ok && parsed.ok.length ? parsed.ok : null;
      }
      if (kind === 'object') {
        const phrase = String((problem.scene && problem.scene.phrase) || name);
        const qn = encodeURIComponent(phrase);
        const vamUrl = 'https://api.vam.ac.uk/v2/objects/search?q=' + qn + '&page_size=10';
        const articUrl = 'https://api.artic.edu/api/v1/artworks/search?q=' + qn + '&limit=20&fields=id,title,dimensions,classification_title,medium_display,description';
        const cmaUrl = 'https://openaccess-api.clevelandart.org/api/artworks/?q=' + qn + '&limit=8&has_image=0';
        const gentUrl = 'https://data.designmuseumgent.be/v2/id/objects?q=' + qn + '&itemsPerPage=4';
        const smgUrl = 'https://collection.sciencemuseumgroup.org.uk/search/objects?q=' + qn + '&page[size]=20';
        const pack = await Promise.all([
          fetchT(vamUrl, 12000).then(r => r.json()).catch(() => null),
          fetchT(articUrl, 12000).then(r => r.json()).catch(() => null),
          fetchT(cmaUrl, 12000).then(r => r.json()).catch(() => null),
          fetchT(gentUrl, 12000).then(r => r.json()).catch(() => null),
          fetchT(smgUrl, 12000).then(r => r.json()).catch(() => null)
        ]);
        const hits = (((pack[0] && pack[0].records) || []).filter(h => h && h.systemNumber)).slice(0, 8);
        const objs = await Promise.all(hits.map(hit => fetchT('https://api.vam.ac.uk/v2/object/' + encodeURIComponent(hit.systemNumber), 4000).then(r => r.json()).catch(() => null)));
        const records = [];
        objs.forEach((obj, i) => {
          if (!obj) return;
          const rec = obj.record || {};
          const desc = [rec.briefDescription, rec.physicalDescription].filter(Boolean).join(' ').slice(0, 400);
          const mats = (rec.materials || []).map(m => (m && m.text) || m).filter(Boolean);
          records.push({ title: rec._primaryTitle || hits[i]._primaryTitle || '', objectType: rec.objectType || hits[i].objectType || '', description: desc, materials: mats,
            dimensions: (rec.dimensions || []).filter(d => !/crate/i.test(d.part || '')).map(d => ({ dimension: d.dimension, value: d.value, unit: d.unit, part: d.part || '' })) });
        });
        const arecs = [];
        for (const a of ((pack[1] && pack[1].data) || [])) {
          const m = String(a.dimensions || '').match(/(\d+(?:\.\d+)?)\s*[×x]\s*(\d+(?:\.\d+)?)(?:\s*[×x]\s*(\d+(?:\.\d+)?))?\s*cm/i);
          if (!m) continue;
          const dims = [{ dimension: 'Height', value: m[1], unit: 'cm', part: '' }, { dimension: 'Width', value: m[2], unit: 'cm', part: '' }];
          if (m[3]) dims.push({ dimension: 'Depth', value: m[3], unit: 'cm', part: '' });
          const desc = String(a.description || '').replace(/<[^>]+>/g, ' ');
          arecs.push({ title: a.title || '', objectType: a.classification_title || '', description: (desc + ' ' + (a.medium_display || '')).slice(0, 600), dimension_text: a.dimensions || '', materials: [a.medium_display || ''], dimensions: dims });
        }
        const crecs = [];
        for (const a of ((pack[2] && pack[2].data) || [])) {
          const o = (a.dimensions || {}).overall || {};
          const dims = [];
          if (o.height) dims.push({ dimension: 'Height', value: o.height, unit: 'm', part: '' });
          if (o.width) dims.push({ dimension: 'Width', value: o.width, unit: 'm', part: '' });
          if (o.depth) dims.push({ dimension: 'Depth', value: o.depth, unit: 'm', part: '' });
          if (!dims.length) continue;
          crecs.push({ title: a.title || '', objectType: a.type || '', description: a.technique || '', materials: [a.technique || ''], dimensions: dims });
        }
        const members = (pack[3] && (pack[3]['hydra:member'] || pack[3].member)) || [];
        const gids = members.map(m => m && (m['@id'] || m.id)).filter(Boolean).slice(0, 4);
        const gobjs = await Promise.all(gids.map(id => fetchT(id, 4000).then(r => r.json()).catch(() => null)));
        const grecs = [];
        gobjs.forEach(g => {
          if (!g) return;
          const dims = [];
          for (const d of g['crm:P43_has_dimension'] || []) {
            const lab = ((d['crm:P2_has_type'] || {})['rdfs:label'] || '').toString();
            const unit = ((d['crm:P91_has_unit'] || {})['rdfs:label'] || '').toString();
            if (d['crm:P90_has_value'] == null || !lab) continue;
            dims.push({ dimension: lab, value: d['crm:P90_has_value'], unit: unit || 'cm', part: '' });
          }
          if (!dims.length) return;
          const label = g['rdfs:label'];
          const title = Array.isArray(label) ? String((label[0] && (label[0]['@value'] || label[0])) || '') : String((label && (label['@value'] || label)) || '');
          grecs.push({ title: title, objectType: '', description: '', dimensions: dims });
        });
        const srecs = [];
        const numish = v => { const s = String(v == null ? '' : v).trim(); const m = s.match(/^(\d+)(?:\s+(\d+)\s*\/\s*(\d+))?$/); if (!m) { const n = parseFloat(s); return isNaN(n) ? null : n; } return parseFloat(m[1]) + (m[2] ? parseFloat(m[2]) / parseFloat(m[3]) : 0); };
        const walk = (o, dims) => {
          if (!o) return;
          if (Array.isArray(o)) { o.forEach(x => walk(x, dims)); return; }
          if (typeof o !== 'object') return;
          if (o.dimension && o.units && o.value != null) {
            const n = numish(o.value);
            if (n != null) dims.push({ dimension: o.dimension, value: n, unit: o.units, part: '' });
          }
          Object.keys(o).forEach(k => { if (k !== 'dimension' && k !== 'units' && k !== 'value') walk(o[k], dims); });
        };
        for (const item of ((pack[4] && pack[4].data) || [])) {
          const a = item.attributes || {};
          const dims = [];
          walk(a.measurements, dims);
          const metric = dims.filter(d => /^(mm|cm|m|kg)$/i.test(d.unit));
          const raw = a.description;
          const desc = Array.isArray(raw) ? raw.map(x => (x && (x.value || x)) || '').join(' ') : ((raw && (raw.value || raw)) || '');
          srecs.push({ title: (a.summary && a.summary.title) || '', objectType: '', description: String(desc).slice(0, 400), dimensions: metric.length ? metric : dims });
        }
        const agreed = await pyCall({ op: 'objects', name: name, phrase: phrase, specific: !!problem.specific, sides: [
          { id: 'vam', url: vamUrl, records: records }, { id: 'artic', url: articUrl, records: arecs },
          { id: 'cleveland', url: cmaUrl, records: crecs }, { id: 'gent', url: gentUrl, records: grecs },
          { id: 'smg', url: smgUrl, records: srecs }
        ] });
        if (agreed && agreed.ask) return { ask: true, word: agreed.word || phrase };
        return agreed && agreed.ok && agreed.ok.length ? agreed.ok : null;
      }
    } catch (e) { return null; }
    return null;
  }
  function clauseNodes(c, out) {
    if (!c || typeof c !== 'object') return;
    if (Array.isArray(c.clauses)) c.clauses.forEach(x => clauseNodes(x, out));
    if (Array.isArray(c.sentences)) c.sentences.forEach(x => clauseNodes(x, out));
    out.push(c);
  }
  function rememberedAbove(memory, head) {
    const want = String(head || '').toLowerCase();
    if (!want) return false;
    return memoryRows(memory).some(r => {
      const all = [];
      clauseNodes(r.clause, all);
      return all.some(c => c && c.kriya === 'sit' && c.kartr && String(c.kartr.head || '').toLowerCase() === want && (c.adj || []).some(a => a && a.prep === 'above' && a.np));
    });
  }
  function memoryRows(memory) {
    const phone = memory && Array.isArray(memory.phone) ? memory.phone : [];
    return phone.filter(r => r && (r.clause || r.text)).slice(-32).map(r => ({ text: r.text, clause: r.clause || null }));
  }
  function materialWords(question, name) {
    const words = String(question || '').toLowerCase().split(/[^a-z]+/).filter(Boolean);
    const lex = root.forge && root.forge.lexicon;
    if (lex && typeof lex.senses === 'function' && name) {
      const senses = lex.senses(name) || [];
      const art = senses.find(s => s && s.lexname === 'noun.artifact') || senses.find(s => s && s.pos === 'n');
      if (art && art.gloss) art.gloss.toLowerCase().split(/[^a-z]+/).forEach(w => { if (w && words.indexOf(w) < 0) words.push(w); });
    }
    return words;
  }
  function simAsk(question, problem, word) {
    const scene = (problem && problem.scene) || {};
    const ask = { kind: 'sim', question: String(question || ''), word: String(word || scene.phrase || ''), patientText: String(scene.patient_text || ''), options: [], tries: 0 };
    if (problem && problem.ambiguous) { ask.ambiguous = true; ask.material_class = problem.material_class || ''; }
    return ask;
  }
  async function simulate(question, memory, specific, supplement) {
    const q = String(question || '');
    const frame0 = frameOf(q);
    const property = frame0 && frame0.kriya === 'be' && frame0.kartr && /^(weight|mass|formula|structure)$/.test(String(frame0.kartr.head || ''));
    const orbit = frame0 && frame0.kartr && frame0.kartr.head === 'period' && frame0.kartr.of && frame0.kartr.of.head === 'satellite';
    const placed = frame0 && frame0.kartr && frame0.kartr.head === 'period' && frame0.kartr.owner && rememberedAbove(memory, frame0.kartr.owner.head);
    if (!(frame0 && (frame0.rule === 'QF-WHAT-HAPPENS-IF' || frame0.conditional || property || orbit || placed)) && !GATE.test(q)) return null;
    const t0 = Date.now();
    let out;
    let refitAfter = false;
    let continued = false;
    let cf = null;
    try {
      let frame = frameOf(q.slice(0, 400));
      let question = q.slice(0, 400);
      if (supplement && root.KQFrame && typeof root.KQFrame.supplement === 'function') {
        const sup = root.KQFrame.supplement(supplement, root.forge);
        const resumed = await pyCall({ op: 'resume', question: question, frame: frame, supplement: sup });
        if (resumed && resumed.ok && resumed.question) {
          question = resumed.question;
          frame = frameOf(question);
          if (resumed.specific) specific = true;
          if (resumed.derive_missing && frame) frame.derive_missing = true;
        }
      } else if (lastScene && frame && (/^what\s+if\b/i.test(question) || (frame.cond && frame.cond.karma && frame.cond.karma.head === 'it'))) {
        const cont = await pyCall({ op: 'continue', frame: frame, prior: lastScene });
        if (cont && cont.question) { question = cont.question; frame = frameOf(question); continued = true; }
      }
      const priorScene = continued && lastScene ? lastScene.scene : null;
      /* The Ask itself does not fetch. Neo's tick researches a held gap, and the admitted clause comes back as a premise. */
      let pl = await pyCall({ op: 'plan', question: question, frame: frame, memory: memoryRows(memory) });
      let p = pl && pl.problem;
      if (p && !p.ok && /unknown_substance|unknown_body|property_missing|altitude_missing/.test(String(p.reason || ''))) {
        const found = await athenaFacts(p);
        if (found && found.length) {
          const again = await pyCall({ op: 'plan', question: question, frame: frame, memory: memoryRows(memory), facts: found });
          if (again && again.problem && again.problem.ok) { pl = again; p = again.problem; }
        }
      }
      if (p && !p.ok && p.missing === 'density' && (p.body || p.patient)) {
        const who = p.body || p.patient;
        const hit = await pyCall({ op: 'material_density', words: materialWords(question, who) });
        if (hit && hit.ok && hit.rho && !hit.ambiguous) {
          const facts = [{ head: who, property: 'density', value: hit.rho }, { head: who, property: 'material', value: hit.material }];
          const again = await pyCall({ op: 'plan', question: question, frame: frame, memory: memoryRows(memory), facts: facts });
          if (again && again.problem && again.problem.ok) { pl = again; p = again.problem; }
        } else if (hit && hit.ambiguous) {
          p = Object.assign({}, p, { ambiguous: true, materials: hit.materials || [], material_class: hit.class || '' });
        }
      }
      if (p && p.ok && p.scene) lastScene = { question: question, scene: p.scene };
      const decision = (p && p.ok && root.KMechanisms && typeof root.KMechanisms.prepare === 'function')
        ? root.KMechanisms.prepare(p, root.KMechanisms.admitted()) : null;
      if (continued && priorScene && decision && decision.law && p && p.scene && typeof root.KMechanisms.counterfactual === 'function') {
        cf = root.KMechanisms.counterfactual(decision.law, root.KMechanisms.sceneValues(priorScene), root.KMechanisms.sceneValues(p.scene));
      }
      if (out && out.status === 'ask') { /* the follow-up turn owns this question */ }
      else if (!p || !p.ok) {
        const reason = String((p && p.reason) || '');
        const ask = /property_missing|unknown_body|altitude_missing|sequence_missing/.test(reason) ? simAsk(question, p, (p && (p.substance || p.body)) || '') : null;
        if (ask) ask.missing = p && p.missing;
        out = { schema: 'FORGE-SIM-RECEIPT/v1', ok: false, status: ask ? 'ask' : 'no_problem', ask: ask, problem: p || null, reason: reason || null, missing: (p && p.missing) || null, calls_llm: false };
      }
      else if (decision && decision.applied && decision.kind === 'quantitative') {
        out = await pyCall({ op: 'derive_quantitative', problem: p, law: decision.law, derived: decision });
        if (out) out.method = 'learned_mechanism';
      }
      else if (decision && decision.applied) {
        out = await pyCall({ op: 'derive_mechanism', problem: p, law: decision.law, derived: decision });
        if (out) out.method = 'learned_mechanism';
      }
      else if (p.runtime === 'home_pc') out = await homePc(p, frame);
      else if (p.runtime === 'pyodide') out = await pyCall({ op: 'solve', problem: p });
      else {
        let raw;
        try { raw = p.solver === 'mujoco_wasm' ? await wasmCall('mujoco', pl.job) : p.solver === 'rdkit_wasm' ? await wasmCall('rdkit', { smiles: p.smiles }) : await wasmCall('spice', { netlist: p.netlist }); }
        catch (e) { raw = null; out = await pyCall({ op: 'hold', problem: p, reason: 'wasm_failed: ' + String(e && e.message || e).slice(0, 160) }); }
        if (raw) { out = await pyCall({ op: 'finish', problem: p, raw }); out.assets_loaded = raw.assets_loaded; out.wasm_ms = raw.ms; out.raw = Object.assign({}, raw, { assets_loaded: undefined }); }
        if (decision && decision.reason === 'out_of_range') refitAfter = true;
      }
      if (out && cf) out.counterfactual = cf;
      if (out) out.asked = question;
    } catch (e) { out = { schema: 'FORGE-SIM-RECEIPT/v1', ok: false, status: 'sim_error', error: String(e && e.message || e).slice(0, 240), calls_llm: false, asked: q }; }
    out.elapsed_ms = Date.now() - t0;
    root.__lastSim = out;
    if (out && out.ok && out.method !== 'learned_mechanism' && root.KSimReceipts && typeof root.KSimReceipts.record === 'function') {
      try { root.KSimReceipts.record(out); } catch (e) { /* the turn still has the receipt */ }
    }
    if (refitAfter && out && out.ok && root.KMechanisms && typeof root.KMechanisms.refit === 'function' && root.KSimReceipts) {
      try { out.refit = root.KMechanisms.refit(root.KSimReceipts.list()); } catch (e) { /* the measurement still stands */ }
    }
    return out;
  }
  function propertyHold(rec) {
    const p = rec && rec.problem;
    if (!p || p.ok) return '';
    const reason = String(p.reason || '');
    if (!/unknown_substance|unknown_body|property_missing|altitude_missing|sequence_missing/.test(reason)) return '';
    const scene = p.scene || {};
    const name = p.substance || p.body || (typeof scene.body === 'string' ? scene.body : '') || '';
    let slot = String(p.missing || 'measured property');
    if (reason === 'unknown_substance') slot = 'formula and structure';
    if (reason === 'unknown_body' && (slot === 'shape' || slot === 'karma')) slot = 'shape, dimensions, and mass';
    if (reason === 'unknown_body' && slot === 'radius') slot = 'radius and mass';
    if (reason === 'property_missing') slot = slot === 'karma' ? 'mass, height, and width' : slot;
    if (reason === 'altitude_missing') slot = 'altitude';
    if (reason === 'sequence_missing') slot = 'sequence';
    return 'Athena held this. Two independent trusted publishers did not agree on the ' + slot + (name ? ' of ' + name : '') + '. Nothing was guessed.';
  }
  function holdNote(rec) {
    if (!rec || rec.ok || !rec.home_pc_required) return '';
    const what = rec.needs || 'a Home PC solver';
    if (rec.reason === 'home_pc_required') return 'This needs the Home PC Simulator (' + what + '). It is too heavy for a phone. Set one in Custody → Home PC Simulator.';
    if (rec.reason === 'home_pc_unreachable') return 'This needs the Home PC Simulator (' + what + '), and the one set in Custody did not answer.';
    return 'The Home PC Simulator could not run this (' + String(rec.reason || 'hold') + ').';
  }
  async function testConnection(url) {
    const base = String(url || routerBase() || '').trim().replace(/\/+$/, '');
    if (!okUrl(base)) return { ok: false, status: 'bad_address' };
    try { const r = await root.fetch(base + '/v1/health', { credentials: 'omit' }); const j = r.ok ? await r.json() : null; return j ? { ok: !!j.ok, status: 'reachable', health: j } : { ok: false, status: 'http_' + r.status }; }
    catch (e) { return { ok: false, status: 'unreachable' }; }
  }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]); }
  function renderSettings() {
    const el = root.document && root.document.getElementById('homePcSim'); if (!el) return;
    const cur = get(LS_ROUTER);
    el.innerHTML = '<div class="card" data-home-pc data-settings="home-pc"><div class="cardhead">Settings · Home PC Simulator (Optional)</div>'
      + '<div class="small">Most simulations run right on this phone: physics, math, chemistry, biology, astronomy, quantum and circuits. Two kinds are too heavy for a phone: airflow (CFD with OpenFOAM) and Hartree-Fock / DFT chemistry (PySCF). If you run the FORGE simulator on a computer at home, put its address here. Leave it empty and those questions are held. Nothing else is sent to it.</div>'
      + '<form id="homePcForm" class="row"><input id="homePcUrl" type="url" inputmode="url" autocomplete="off" placeholder="https://my-pc.example:8765" value="' + esc(cur) + '" aria-label="Home PC Simulator address">'
      + '<button type="submit">Save</button><button type="button" id="homePcTest">Test Connection</button><button type="button" id="homePcClear">Clear</button></form>'
      + '<div class="small" id="homePcStatus" data-home-pc-status>' + (cur ? 'Saved: ' + esc(cur) : 'Not set. Heavy simulations are held.') + '</div></div>';
    const $ = id => root.document.getElementById(id), status = t => { const s = $('homePcStatus'); if (s) s.textContent = t; };
    $('homePcForm').onsubmit = ev => { ev.preventDefault(); const v = $('homePcUrl').value.trim(); if (v && !okUrl(v)) { status('That address is not allowed. Use an https:// address (a phone page cannot reach plain http on another computer), or http://localhost when the simulator runs on this same device.'); return; } try { v ? root.localStorage.setItem(LS_ROUTER, v) : root.localStorage.removeItem(LS_ROUTER); } catch (e) {} status(v ? 'Saved: ' + v : 'Not set. Heavy simulations are held.'); };
    $('homePcTest').onclick = async () => { status('Testing…'); const r = await testConnection($('homePcUrl').value); status(r.ok ? 'Connected. Solvers: ' + ((r.health.solvers || []).map(s => s.name + (s.installed === false ? ' (not installed)' : '')).join(', ') || 'none') : r.status === 'bad_address' ? 'That address is not allowed.' : 'Could not reach it (' + r.status + ').'); };
    $('homePcClear').onclick = () => { try { root.localStorage.removeItem(LS_ROUTER); } catch (e) {} $('homePcUrl').value = ''; status('Cleared. Heavy simulations are held.'); };
  }
  async function book(arg) {
    const booked = await pyCall(Object.assign({ op: 'ledger', method: 'lookup' }, arg || {}));
    if (booked && booked.ledger) root.FORGE_LEDGER = booked.ledger;
    return booked || { ledger: root.FORGE_LEDGER || null, calls_llm: false, supabase_write: false };
  }
  function sceneGap(problem) {
    if (!problem || problem.ok) return false;
    const reason = String(problem.reason || '');
    const missing = String(problem.missing || '');
    return (reason === 'property_missing' || reason === 'unknown_body') && ['mass', 'height', 'width', 'depth', 'radius', 'shape', 'karma', 'scene', 'dimensions'].indexOf(missing) >= 0;
  }
  async function research(gap) {
    const sim = (gap && gap.gap && gap.gap.sim) || (gap && gap.sim) || {};
    const frame = gap && gap.gap && gap.gap.qframe;
    const owned = np => np && (np.user || np.owner === 'user' || owned(np.of) || owned(np.owner));
    if (owned(frame && frame.kartr) || owned(frame && frame.karma)) return { rule: 'ATHENA-PERSONAL', proposals: [], calls_llm: false, supabase_write: false };
    const phone = (gap && gap.phone) || [];
    const question = (gap && gap.question) || '';
    const ledger = root.FORGE_LEDGER || null;
    let planned = null;
    try { planned = await pyCall({ op: 'plan', question: question, frame: frame, memory: memoryRows({ phone: phone }) }); } catch (e) { planned = null; }
    const problem = planned && planned.problem;
    const onDevice = !!(problem && problem.ok && problem.runtime && problem.runtime !== 'home_pc');
    if (onDevice || sceneGap(problem)) {
      if (!problem || !problem.ok) return { rule: 'ATHENA-PROPERTY-MISSING', method: 'simulate', proposals: [], calls_llm: false, supabase_write: false };
      const receipt = await simulate(question, { phone: phone });
      const rows = receipt && Array.isArray(receipt.rows) ? receipt.rows : [];
      if (!receipt || !receipt.ok || receipt.may_store_as_fact !== false || !rows.length) return { rule: 'ATHENA-SIMULATED', method: 'simulate', proposals: [], receipt: receipt || null, calls_llm: false, supabase_write: false };
      return { rule: 'ATHENA-SIMULATED', method: 'simulate', proposals: [], receipt: receipt, simulated: true, phone_remember: false, supabase_write: false, calls_llm: false };
    }
    const facts = await athenaLookup(sim);
    if (facts && !Array.isArray(facts) && (facts.held || []).some(h => h && h.reason === 'publishers_disagree')) {
      const held = (facts.held || []).find(h => h && h.publishers);
      const booked = await book({ facts: held ? [{ publishers: held.publishers }] : [], question: question, ledger: ledger, disagreed: true, rule: 'ATHENA-DISAGREEMENT', method: 'lookup' });
      return { rule: 'ATHENA-DISAGREEMENT', proposals: [], held: facts.held, ledger: booked && booked.ledger, calls_llm: false, supabase_write: false };
    }
    if (!facts || !facts.length) {
      const booked = await book({ facts: [], question: question, ledger: ledger, rule: 'ATHENA-NO-AGREEMENT', method: 'lookup' });
      return { rule: 'ATHENA-NO-AGREEMENT', proposals: [], ledger: booked && booked.ledger, calls_llm: false, supabase_write: false };
    }
    const proposed = await pyCall({ op: 'propose', facts: facts, question: question, ledger: ledger, method: 'lookup' });
    if (proposed && proposed.ledger) root.FORGE_LEDGER = proposed.ledger;
    return proposed && proposed.proposals ? proposed : { rule: 'ATHENA-NO-AGREEMENT', proposals: [], ledger: proposed && proposed.ledger, calls_llm: false, supabase_write: false };
  }
  function sharesQuestion(question, text) {
    const stop = { write: 1, poem: 1, about: 1, what: 1, times: 1, with: 1, from: 1, that: 1, this: 1, your: 1, have: 1, does: 1 };
    const words = s => String(s || '').toLowerCase().match(/[a-z]{4,}/g) || [];
    const q = {};
    words(question).forEach(w => { if (!stop[w]) q[w] = 1; });
    return words(text).some(w => q[w]);
  }
  function topicHeads(frame) {
    const found = [];
    function add(np) {
      if (!np || typeof np !== 'object') return;
      const head = String(np.head || '').trim().toLowerCase();
      if (head && found.indexOf(head) < 0 && head !== 'you' && head !== 'kernel' && head !== 'poem' && head !== 'story') found.push(head);
      (np.conj || []).forEach(add);
    }
    if (frame) {
      add(frame.karma);
      add(frame.kartr);
      (frame.adj || []).forEach(a => add(a && a.np));
      (frame.prefer_options || []).forEach(name => { const w = String(name || '').trim().toLowerCase(); if (w && found.indexOf(w) < 0) found.push(w); });
    }
    return found;
  }
  function contentWords(text) {
    const stop = { write: 1, poem: 1, story: 1, about: 1, tell: 1, describe: 1, with: 1, from: 1, that: 1, this: 1, have: 1, your: 1 };
    return (String(text || '').toLowerCase().match(/[a-z]{4,}/g) || []).filter(w => !stop[w]);
  }
  function chooseSense(topic, prompt, texts) {
    const lex = root.forge && root.forge.lexicon;
    if (!lex || typeof lex.senses !== 'function') return null;
    const senses = (lex.senses(topic) || []).filter(s => s && s.pos === 'n' && s.gloss);
    if (!senses.length) return null;
    const promptWords = contentWords(prompt).filter(w => w !== topic);
    const personCue = promptWords.some(w => ({ born: 1, mathematician: 1, resident: 1, inventor: 1, native: 1, professor: 1 })[w]);
    const blobs = (texts || []).map(t => String(t || '').toLowerCase());
    let best = null, bestScore = -1;
    senses.forEach((sense, index) => {
      const words = contentWords(sense.gloss);
      const others = {};
      senses.forEach((other, j) => { if (j !== index) contentWords(other.gloss).forEach(w => { others[w] = 1; }); });
      const distinctive = words.filter(w => !others[w]);
      const votes = blobs.filter(blob => distinctive.some(w => blob.indexOf(w) >= 0)).length;
      const context = promptWords.filter(w => words.indexOf(w) >= 0).length;
      let frequency = senses.length - index;
      if (sense.lexname === 'noun.person' && !personCue && senses.length > 1) frequency = 0;
      const score = frequency + context * 3 + votes * 5;
      if (score > bestScore) { best = sense; bestScore = score; }
    });
    return best;
  }
  async function fetchText(url) {
    const ctl = root.AbortController ? new AbortController() : null;
    const timer = ctl ? setTimeout(() => ctl.abort(), 6000) : null;
    try {
      const r = await root.fetch(url, { credentials: 'omit', signal: ctl ? ctl.signal : undefined });
      if (!r.ok) throw new Error('http');
      return await r.text();
    } catch (e) {
      const fp = root.forge && root.forge.fetchPath && root.forge.fetchPath();
      if (!fp || !fp.url) throw e;
      const via = String(fp.url).replace(/\/$/, '') + '/fetch?url=' + encodeURIComponent(url);
      if (fp.kind === 'node' && fp.rpc) {
        const o = await fp.rpc('fetch', { url: url });
        if (!o || !o.ok) throw e;
        return o.text;
      }
      const r2 = await root.fetch(via, { credentials: 'omit' });
      if (!r2.ok) throw e;
      return await r2.text();
    } finally { if (timer) clearTimeout(timer); }
  }
  function stripTags(s) { return String(s || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(); }
  async function openDocuments(topic) {
    const label = topic.charAt(0).toUpperCase() + topic.slice(1);
    const jobs = [
      ['wikipedia', 'Wikimedia', 'wikimedia', false, 'https://en.wikipedia.org/api/rest_v1/page/summary/' + encodeURIComponent(label), raw => {
        const data = JSON.parse(raw);
        if (!data || data.type === 'disambiguation' || !data.extract) return '';
        return String(data.extract).split(/(?<=[.!?])\s+/)[0];
      }],
      ['wikidata', 'Wikimedia', 'wikimedia', false, 'https://www.wikidata.org/w/api.php?action=wbsearchentities&language=en&format=json&limit=5&type=item&search=' + encodeURIComponent(topic), raw => {
        const hit = ((JSON.parse(raw).search) || []).find(h => h && String(h.label || '').toLowerCase() === topic && h.description);
        return hit ? label + ' is ' + hit.description + '.' : '';
      }],
      ['wiktionary', 'Wikimedia', 'wikimedia', false, 'https://en.wiktionary.org/api/rest_v1/page/definition/' + encodeURIComponent(topic), raw => {
        const block = ((JSON.parse(raw).en) || [])[0] || {};
        const def = (block.definitions || []).map(d => stripTags(d && d.definition)).find(t => t && !/^plural of/i.test(t));
        return def ? label + ' is ' + def.charAt(0).toLowerCase() + def.slice(1) : '';
      }],
      ['gbif', 'GBIF', 'gbif', true, 'https://api.gbif.org/v1/species/match?verbose=false&name=' + encodeURIComponent(topic), raw => {
        const data = JSON.parse(raw);
        if (!data || !data.canonicalName || data.confidence < 80) return '';
        if (String(data.canonicalName).toLowerCase() === topic) return '';
        return label + ' is a ' + String(data.rank || 'species').toLowerCase() + ', ' + data.canonicalName + '.';
      }],
      ['eol', 'Encyclopedia of Life', 'eol', true, 'https://eol.org/api/search/1.0.json?page=1&exact=true&q=' + encodeURIComponent(topic), raw => {
        const hit = ((JSON.parse(raw).results) || []).find(r => r && (String(r.content || '').toLowerCase().indexOf(topic) >= 0 || String(r.title || '').toLowerCase().indexOf(topic) >= 0));
        const content = hit ? stripTags(hit.content || hit.title) : '';
        if (!content || !/\b(is|are|was|were)\b/i.test(content)) return '';
        return content.toLowerCase().indexOf(topic) >= 0 ? content : label + ' is ' + content + '.';
      }],
      ['pubchem_desc', 'NLM', 'nlm', true, 'https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/' + encodeURIComponent(topic) + '/description/JSON', raw => {
        const info = ((((JSON.parse(raw).InformationList) || {}).Information) || [])[0];
        return info && info.Description ? String(info.Description).split(/(?<=[.!?])\s+/)[0] : '';
      }]
    ];
    const docs = [];
    const queried = [];
    await Promise.all(jobs.map(async job => {
      const [sid, publisher, lineage, counts, url, read] = job;
      queried.push(sid);
      try {
        const text = read(await fetchText(url));
        const kind = root.KQFrame && KQFrame.kindSentence ? KQFrame.kindSentence(topic, text, root.forge) : '';
        const spoken = kind || text;
        if (spoken && spoken.toLowerCase().indexOf(topic) >= 0) docs.push({ text: spoken, publisher: publisher, source_id: sid, lineage: lineage, counts: counts, asked: 'What is a ' + topic + '?', url: url });
      } catch (e) { /* a source the browser cannot reach is recorded by its absence; the user's proxy is tried inside fetchText */ }
    }));
    return { docs: docs, queried: queried };
  }
  async function gatherCreative(frame, question) {
    const heads = topicHeads(frame);
    const topic = heads[0] || '';
    if (!topic) return null;
    const fetched = await openDocuments(topic);
    const sense = chooseSense(topic, question || (frame && frame.text) || '', (fetched.docs || []).map(d => d.text));
    const glosses = sense && root.KQFrame && KQFrame.glossClauses ? KQFrame.glossClauses(topic, sense.gloss, root.forge) : [];
    const docs = (fetched.docs || []).slice();
    glosses.forEach(text => docs.push({ text: text, publisher: 'Open English WordNet', source_id: 'oewn', lineage: 'oewn', counts: true, asked: 'What is a ' + topic + '?' }));
    try {
      const got = await pyCall({ op: 'gather', topic: topic, prompt: question || '', budget: 4, timeout: 2, network: false, lexicon: false, documents: docs });
      if (got && Array.isArray(got.clauses)) {
        got.queried = (fetched.queried || []).concat(got.queried || []).filter((s, i, a) => a.indexOf(s) === i);
        got.gloss = sense && sense.gloss || got.gloss;
        if (!got.clauses.length && glosses.length) got.clauses = glosses.map(text => ({ text: text, source_count: 1, publishers: ['oewn'], admitted: false, single_source: true, fact: false, gilligan: 'GILLIGAN-STRUCTURE-OK', scale: 'ok', drift: 'clean' }));
        if (root.KClauseFit) got.clauses = KClauseFit.fitList(topic, got.clauses, root.forge, sense);
        return got;
      }
    } catch (e) { /* the split gloss is still imagery */ }
    const bare = glosses.map(text => ({ text: text, source_count: 1, publishers: ['oewn'], admitted: false, single_source: true, fact: false, gilligan: 'GILLIGAN-STRUCTURE-OK', scale: 'ok', drift: 'clean', store: null, hosted_eligible: false }));
    const fitted = root.KClauseFit ? KClauseFit.fitList(topic, bare, root.forge, sense) : bare;
    return { topic: topic, atoms: [], queried: fetched.queried || ['oewn'], admitted: 0, single: fitted.length, clauses: fitted, calls_llm: false, supabase_write: false, creative_persisted: false };
  }
  async function prepareCreative(memory, question, frame) {
    /* Scene questions from the cited clauses, then the same on-page plan/solve/WASM path a factual sim uses.
     * The worker does not start Node and does not run WASM itself.
     * Only rows about the parsed topic heads are measured. A later noun in the same prompt is not a topic. */
    const heads = topicHeads(frame);
    const rows = memoryRows(memory).filter(r => {
      if (heads.length) return heads.some(h => String(r.text || '').toLowerCase().indexOf(h) >= 0);
      return !question || sharesQuestion(question, r.text);
    });
    let questions = [];
    try {
      const got = await pyCall({ op: 'scenes', rows: rows });
      questions = (got && got.questions) || [];
    } catch (e) { questions = []; }
    const sims = [];
    const seen = {};
    for (const q of questions) {
      let rec = null;
      try { rec = await simulate(q, memory); } catch (e) { rec = null; }
      if (!rec || !rec.ok) continue;
      const solver = rec.primary_solver || (rec.problem && rec.problem.solver) || '';
      if (!solver || seen[solver]) continue;
      const row = (rec.rows || [])[0];
      const sim = row && row.sim;
      if (!sim || !sim.solver) continue;
      seen[solver] = 1;
      sims.push(sim);
      if (sims.length >= 4) break;
    }
    return sims;
  }
  root.KSimDevice = { simulate, prepareCreative, gatherCreative, research, book, routerBase, assetsBase, testConnection, holdNote, propertyHold, renderSettings, GATE, LS_ROUTER, LS_ASSETS };
  if (root.document) { if (root.document.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', renderSettings); else renderSettings(); }
})(typeof self !== 'undefined' ? self : this);
