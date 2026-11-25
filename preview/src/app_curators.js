/* app_curators.js (4.9.208): the Custody tab, now Athena and Gilligan as curators (curators_208.js). It replaces the old idle mesh
 * on the phone; app_custody.js defers to it. The switch is dream_idle (on since 4.9.208, Nic decision (f)); the tab has a toggle.
 * Neo (src/neo.js) ticks one gap while this page is open and visible, never while Ask is answering, at most once every 15 s. No LLM. */
(function (root) {
  if (typeof document === 'undefined' || !root.document) return;
  const $ = s => document.querySelector(s);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const PREF = 'forge.curators.on';
  let cur = null, lastFlush = 0, answering = false;
  try { const p = root.localStorage && root.localStorage.getItem(PREF); if (p === '0' && root.KNextLayer) root.KNextLayer.set('dream_idle', false); } catch (e) { /* private mode */ }
  const on = () => !root.KNextLayer || root.KNextLayer.enabled('dream_idle') !== false;
  function phoneRows() { try { const v = JSON.parse((root.localStorage && root.localStorage.getItem('forge.remembered.v1')) || '[]'); return Array.isArray(v) ? v : []; } catch (e) { return []; } }
  function make() {
    if (cur || !root.KCuratorsLib) return cur;
    const ls = root.localStorage;
    cur = root.KCuratorsLib.Curators({
      store: { get: k => { try { return JSON.parse(ls.getItem(k) || 'null'); } catch (e) { return null; } }, set: (k, v) => ls.setItem(k, JSON.stringify(v)) },
      run: p => (root.KRMCCore && root.KRMCCore.run ? root.KRMCCore.run(p) : Promise.resolve(null)),
      anchorsFor: q => (root.KAskAnchors ? root.KAskAnchors(q) : Promise.resolve([])),
      refreshAnchors: () => (root.KAnchorCache ? root.KAnchorCache.ensure({ force: true }) : null),
      digest: async () => { if (!root.KAnchorCache) return null; const s = await root.KAnchorCache.status(); return s && s.digest || null; },
      reparse: t => { const f = root.forge; return f && f.reparseClause ? f.reparseClause(t) : null; },
      insert: body => (root.KSb && root.KSb.insertAdmitted ? root.KSb.insertAdmitted(body, (uid, sha, nonce) => root.forge && root.forge.signer && root.forge.signer.writerProof ? root.forge.signer.writerProof(uid, sha, nonce) : null) : Promise.resolve({ ok: false, pending: true, rule: 'KB-WRITER-UNAVAILABLE' })),
      research: gap => (root.KSimDevice && root.KSimDevice.research ? root.KSimDevice.research(Object.assign({ phone: phoneRows() }, gap)) : Promise.resolve({ rule: 'ATHENA-NO-LOOKUP', proposals: [] })),
      rememberResearch: rows => { root.FORGE_RESEARCH = (root.FORGE_RESEARCH || []).concat(rows || []).slice(-32); },
      rememberSimulation: (q, rows) => { root.FORGE_SIM = rows || []; },
      phone: phoneRows,
      simulation: () => root.FORGE_SIM || [],
      book: arg => (root.KSimDevice && root.KSimDevice.book ? root.KSimDevice.book(arg) : Promise.resolve(null)),
      publishLedger: led => { root.FORGE_LEDGER = led; },
      premises: () => (root.athenaPremises ? root.athenaPremises(root.FORGE_RESEARCH || []) : []).concat((root.FORGE_SIM || []).filter(r => r && r.id).map(r => ({ id: r.id, text: r.text, provenance: { method: 'simulate', may_store_as_fact: false } }))).concat(phoneRows().filter(r => r && r.id).map(r => ({ id: r.id, text: r.text, clause: r.clause, provenance: r.provenance || { method: 'remembered', requested_by: 'user' } })))
    });
    root.FORGE_CURATORS = cur;
    try { const saved = cur.state(); if (saved && saved.ledger) root.FORGE_LEDGER = saved.ledger; } catch (e) { /* the ledger stays empty until a tick */ }
    return cur;
  }
  const neo = root.KNeoLib ? root.KNeoLib.create({
    curators: () => make(),
    enabled: on,
    visible: () => document.visibilityState !== 'hidden',
    onAnswering: v => { if (cur) cur.setAnswering(v); },
    intervalMs: 15000
  }) : null;
  if (neo) root.KNeo = neo;
  function noteHeld(question, row, extra) { return neo ? neo.noteHeld(question, row, extra) : { ok: false, rule: 'NEO-NO-QUEUE' }; }
  function setAnswering(v) { answering = v === true; if (neo) neo.setAnswering(answering); else if (cur) cur.setAnswering(answering); }
  async function step() {
    const c = make();
    if (neo) { try { await neo.step(); } catch (e) { /* the next tick retries */ } }
    if (c && c.status().pending && Date.now() - lastFlush > 300000) { lastFlush = Date.now(); try { await c.flushPending(); } catch (e) { /* the writer stays pending */ } }
    paint();
  }
  function rows(list, cols) { return list.slice(-6).reverse().map(r => '<div class="rec" data-curation-row><div>' + esc(r.question) + (r.reply ? ' → ' + esc(r.reply) : '') + '</div><div class="meta">' + cols.map(k => esc(k) + ' ' + esc(r[k] == null ? '—' : r[k])).join(' · ') + '</div></div>').join('') || '<div class="meta">none</div>'; }
  function paint() {
    const strip = $('#custodyStrip'), body = $('#custodyBody');
    const c = cur, s = c ? c.status() : null, st = c ? c.state() : null, isOn = on();
    const summary = !c ? 'curators not loaded' : (isOn ? 'Athena and Gilligan on' : 'curators switched off') + ' · queued ' + s.queued + ' · written ' + s.admitted + ' · pending ' + s.pending + ' · quarantine ' + s.quarantine;
    if (strip) strip.innerHTML = '<b>Custody</b> ' + esc(summary) + ' <button type="button" id="custodyOpen">Open</button>';
    const open = $('#custodyOpen'); if (open) open.onclick = () => { if (root.KUI && root.KUI.openTab) root.KUI.openTab('custody'); };
    if (!body || !c) return;
    if (body.contains(document.activeElement) && document.activeElement.tagName === 'INPUT') return;
    body.innerHTML = '<div class="card" data-curators><div class="cardhead">Curators <span class="pill' + (isOn ? ' ok' : '') + '">' + (isOn ? 'on' : 'off') + '</span><span class="pill">no LLM</span></div>'
      + '<div class="small" data-curators-truth>Athena takes the questions Ask held. It looks each one up through the same engine Ask uses (resonance packets, measured drift, coherence, Echo), using only the trusted anchors: the starter set and the Supabase anchors cached on this phone. Wikipedia is never used as a premise. An answer is admitted only at drift ≤ 0.35, C ≥ 0.87 and Echo ≥ 0.85, and only if the answer alone re-derives itself under Echo (re-parse). Gilligan checks every premise is a trusted anchor before any write, gives the 0.35–0.40 band one re-measure, keeps 0.40–0.80 in quarantine until the anchors change, and keeps the hard band cold. An admitted row is written to Supabase only through the locked-down writer (a linked account with the writer role and a verified device signature). Otherwise it stays on this phone as pending and is not used by Ask. The curators run only while this page is open, never while Ask is answering, one question at a time.</div>'
      + '<label class="row"><input type="checkbox" id="curatorsOn"' + (isOn ? ' checked' : '') + '> Curators on</label>'
      + '<div class="row"><button type="button" id="gapExport">Export held gaps</button></div>'
      + '<div class="small" data-gap-disclosure>' + esc(root.KCuratorsLib && root.KCuratorsLib.DISCLOSURE) + '</div>'
      + '<table><tr><td>queued</td><td>' + s.queued + '</td></tr><tr><td>written to Supabase</td><td>' + s.admitted + '</td></tr><tr><td>pending on this phone</td><td>' + s.pending + '</td></tr><tr><td>quarantine</td><td>' + s.quarantine + '</td></tr><tr><td>cold</td><td>' + s.cold + '</td></tr><tr><td>anchor digest</td><td>' + esc(s.digest || '—') + '</td></tr><tr><td>last</td><td>' + esc(s.last ? s.last.who + ' ' + s.last.rule + (s.last.question ? ' · ' + s.last.question : '') : '—') + '</td></tr></table></div>'
      + '<div class="card"><div class="cardhead">Queued (held Ask questions)</div>' + rows(st.queue, ['attempts', 'last']) + '</div>'
      + '<div class="card"><div class="cardhead">Written / pending</div>' + rows(st.admitted.concat(st.pending), ['rule', 'eps', 'C', 'echo']) + '</div>'
      + '<div class="card"><div class="cardhead">Quarantine / cold</div>' + rows(st.quarantine.concat(st.cold), ['rule', 'eps', 'lane']) + '</div>';
    const exp = $('#gapExport');
    if (exp) exp.onclick = () => {
      const live = root.KCurators && root.KCurators.curators ? root.KCurators.curators() : c;
      const doc = root.KCuratorsLib.exportDocument(live.state(), root.KGapOpen ? root.KGapOpen() : null);
      const blob = new Blob([JSON.stringify(doc, null, 1)], { type: 'application/json' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'forge-gap-export.json'; a.click();
    };
    const box = $('#curatorsOn');
    if (box) box.onchange = () => { if (root.KNextLayer) root.KNextLayer.set('dream_idle', box.checked); try { root.localStorage.setItem(PREF, box.checked ? '1' : '0'); } catch (e) { /* private mode */ } paint(); };
  }
  root.KCurators = { step, paint, noteHeld, setAnswering, curators: () => make() };
})(typeof self !== 'undefined' ? self : this);
