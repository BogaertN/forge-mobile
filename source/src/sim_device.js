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
  function pyCall(arg) { if (!root.KPyCheck || !root.KPyCheck.Client) return Promise.reject(new Error('pyodide_client_missing')); pyc = pyc || root.KPyCheck.Client({ workerUrl: 'src/py_worker.js' }); return pyc.sim(arg, bundle()); }
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
    const cap = new Promise(res => { timer = setTimeout(() => res(null), 4000); });
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
        return agreed && agreed.ok && agreed.ok.length ? agreed.ok : null;
      }
      if (kind === 'object') {
        const qn = encodeURIComponent(name);
        const vamUrl = 'https://api.vam.ac.uk/v2/objects/search?q=' + qn + '&page_size=6';
        const articUrl = 'https://api.artic.edu/api/v1/artworks/search?q=' + qn + '&limit=15&fields=id,title,dimensions,classification_title';
        const pair = await Promise.all([
          fetchT(vamUrl, 4000).then(r => r.json()).catch(() => null),
          fetchT(articUrl, 4000).then(r => r.json()).catch(() => null)
        ]);
        const vam = pair[0];
        const hits = ((vam && vam.records) || []).filter(h => h && h.systemNumber).slice(0, 4);
        const objs = await Promise.all(hits.map(hit => fetchT('https://api.vam.ac.uk/v2/object/' + encodeURIComponent(hit.systemNumber), 4000).then(r => r.json()).catch(() => null)));
        const records = [];
        objs.forEach((obj, i) => {
          if (!obj) return;
          const hit = hits[i];
          const rec = obj.record || {};
          records.push({ title: rec._primaryTitle || hit._primaryTitle || '', objectType: rec.objectType || hit.objectType || '',
            dimensions: (rec.dimensions || []).filter(d => !/crate/i.test(d.part || '')).map(d => ({ dimension: d.dimension, value: d.value, unit: d.unit, part: d.part || '' })) });
        });
        const artic = pair[1];
        const arecs = [];
        for (const a of (artic && artic.data) || []) {
          const m = String(a.dimensions || '').match(/(\d+(?:\.\d+)?)\s*[×x]\s*(\d+(?:\.\d+)?)(?:\s*[×x]\s*(\d+(?:\.\d+)?))?\s*cm/i);
          if (!m) continue;
          const dims = [{ dimension: 'Height', value: m[1], unit: 'cm', part: '' }, { dimension: 'Width', value: m[2], unit: 'cm', part: '' }];
          if (m[3]) dims.push({ dimension: 'Depth', value: m[3], unit: 'cm', part: '' });
          arecs.push({ title: a.title || '', objectType: a.classification_title || '', dimensions: dims });
        }
        const agreed = await pyCall({ op: 'objects', name: name, sides: [{ id: 'vam', url: vamUrl, records: records }, { id: 'artic', url: articUrl, records: arecs }] });
        return agreed && agreed.ok && agreed.ok.length ? agreed.ok : null;
      }
    } catch (e) { return null; }
    return null;
  }
  async function simulate(question) {
    const q = String(question || '');
    const frame0 = frameOf(q);
    const property = frame0 && frame0.kriya === 'be' && frame0.kartr && /^(weight|mass|formula|structure)$/.test(String(frame0.kartr.head || ''));
    const orbit = frame0 && frame0.kartr && frame0.kartr.head === 'period' && frame0.kartr.of && frame0.kartr.of.head === 'satellite';
    if (!(frame0 && (frame0.rule === 'QF-WHAT-HAPPENS-IF' || frame0.conditional || property || orbit)) && !GATE.test(q)) return null;
    const t0 = Date.now();
    let out;
    try {
      const frame = frameOf(q.slice(0, 400));
      let pl = await pyCall({ op: 'plan', question: q.slice(0, 400), frame: frame });
      if (pl && pl.problem && !pl.problem.ok) {
        const facts = await athenaFacts(pl.problem);
        if (facts) pl = await pyCall({ op: 'plan', question: q.slice(0, 400), frame: frame, facts: facts });
      }
      const p = pl && pl.problem;
      if (!p || !p.ok) out = { schema: 'FORGE-SIM-RECEIPT/v1', ok: false, status: 'no_problem', problem: p || null, reason: (p && p.reason) || null, missing: (p && p.missing) || null, calls_llm: false };
      else if (p.runtime === 'home_pc') out = await homePc(p, frame);
      else if (p.runtime === 'pyodide') out = await pyCall({ op: 'solve', problem: p });
      else {
        let raw;
        try { raw = p.solver === 'mujoco_wasm' ? await wasmCall('mujoco', pl.job) : p.solver === 'rdkit_wasm' ? await wasmCall('rdkit', { smiles: p.smiles }) : await wasmCall('spice', { netlist: p.netlist }); }
        catch (e) { raw = null; out = await pyCall({ op: 'hold', problem: p, reason: 'wasm_failed: ' + String(e && e.message || e).slice(0, 160) }); }
        if (raw) { out = await pyCall({ op: 'finish', problem: p, raw }); out.assets_loaded = raw.assets_loaded; out.wasm_ms = raw.ms; out.raw = Object.assign({}, raw, { assets_loaded: undefined }); }
      }
    } catch (e) { out = { schema: 'FORGE-SIM-RECEIPT/v1', ok: false, status: 'sim_error', error: String(e && e.message || e).slice(0, 240), calls_llm: false }; }
    out.elapsed_ms = Date.now() - t0;
    root.__lastSim = out;
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
    el.innerHTML = '<div class="card" data-home-pc><div class="cardhead">Home PC Simulator (Optional)</div>'
      + '<div class="small">Most simulations run right on this phone: physics, math, chemistry, biology, astronomy, quantum and circuits. Two kinds are too heavy for a phone: airflow (CFD with OpenFOAM) and Hartree-Fock / DFT chemistry (PySCF). If you run the FORGE simulator on a computer at home, put its address here. Leave it empty and those questions are held. Nothing else is sent to it.</div>'
      + '<form id="homePcForm" class="row"><input id="homePcUrl" type="url" inputmode="url" autocomplete="off" placeholder="https://my-pc.example:8765" value="' + esc(cur) + '" aria-label="Home PC Simulator address">'
      + '<button type="submit">Save</button><button type="button" id="homePcTest">Test Connection</button><button type="button" id="homePcClear">Clear</button></form>'
      + '<div class="small" id="homePcStatus" data-home-pc-status>' + (cur ? 'Saved: ' + esc(cur) : 'Not set. Heavy simulations are held.') + '</div></div>';
    const $ = id => root.document.getElementById(id), status = t => { const s = $('homePcStatus'); if (s) s.textContent = t; };
    $('homePcForm').onsubmit = ev => { ev.preventDefault(); const v = $('homePcUrl').value.trim(); if (v && !okUrl(v)) { status('That address is not allowed. Use an https:// address (a phone page cannot reach plain http on another computer), or http://localhost when the simulator runs on this same device.'); return; } try { v ? root.localStorage.setItem(LS_ROUTER, v) : root.localStorage.removeItem(LS_ROUTER); } catch (e) {} status(v ? 'Saved: ' + v : 'Not set. Heavy simulations are held.'); };
    $('homePcTest').onclick = async () => { status('Testing…'); const r = await testConnection($('homePcUrl').value); status(r.ok ? 'Connected. Solvers: ' + ((r.health.solvers || []).map(s => s.name + (s.installed === false ? ' (not installed)' : '')).join(', ') || 'none') : r.status === 'bad_address' ? 'That address is not allowed.' : 'Could not reach it (' + r.status + ').'); };
    $('homePcClear').onclick = () => { try { root.localStorage.removeItem(LS_ROUTER); } catch (e) {} $('homePcUrl').value = ''; status('Cleared. Heavy simulations are held.'); };
  }
  root.KSimDevice = { simulate, routerBase, assetsBase, testConnection, holdNote, propertyHold, renderSettings, GATE, LS_ROUTER, LS_ASSETS };
  if (root.document) { if (root.document.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', renderSettings); else renderSettings(); }
})(typeof self !== 'undefined' ? self : this);
