/* app_custody.js — 4.9.175 phone custody monitor.
 * One learning loop: Ask research → Athena measure → admit or quarantine → Gilligan cold → hosted KB → Ask recall.
 * The portable single file does not inline dream_idle.js. This screen does not publish letter packs.
 * The write key is granted here when Nic supplies it. It is not hardcoded. Packs stay gated.
 * sessionStorage researchExcerpt: KPipeline.attachCustody holds the key and fetches before the tick. */
(function (root) {
  if (typeof document === 'undefined' || !root.document) return;
  const $ = s => document.querySelector(s);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  let mesh = null, asking = false, lastSchedule = null, timer = null;
  function engine() { return root.KDreamIdle || null; }
  function holdWriteKey(key) {
    boot();
    const forge = root.forge;
    const auth = forge && forge.setSharedKbWriteKey ? forge.setSharedKbWriteKey(key) : { ok: false, rule: 'DREAM-IDLE-NO-HOST' };
    if (!auth || auth.ok === false) return auth || { ok: false, rule: 'SHARED-KB-WRITE-KEY-REQUIRED' };
    return mesh && mesh.setWriteKey ? mesh.setWriteKey(key) : { ok: false, rule: 'DREAM-IDLE-NO-HOST' };
  }
  function boot() {
    const D = engine();
    const forge = root.forge;
    if (root.KNextLayer && root.KNextLayer.enabled('dream_idle') === false) return null;
    if (!D || !D.createIdleDream || !forge || mesh) return mesh;
    mesh = D.createIdleDream({ host: forge, publishPacks: false, research: function (gap) { return D.curatedResearch(gap); }, clock: () => new Date().toISOString() });
    return mesh;
  }
  function noteAsk(on) { asking = on === true; if (mesh && mesh.setAnswering) mesh.setAnswering(asking); }
  function seed() {
    const D = engine();
    const forge = root.forge;
    if (!mesh || !D || !forge || !forge.sharedKnowledgeView) return;
    const view = forge.sharedKnowledgeView();
    const covered = [];
    for (const row of view.admitted || []) {
      const ch = String(row.text || '').trim().toLowerCase().charAt(0);
      if (ch >= 'a' && ch <= 'z') covered.push(ch);
    }
    mesh.enqueue(D.enumerateGaps({ lettersCovered: covered }));
  }
  function kbCount() {
    const forge = root.forge;
    if (!forge || !forge.sharedKnowledgeView) return null;
    const v = forge.sharedKnowledgeView();
    return v && Number.isFinite(Number(v.count)) ? Number(v.count) : ((v && v.admitted) || []).length;
  }
  function step() {
    boot();
    if (!mesh) { paint(null); return; }
    seed();
    lastSchedule = mesh.schedule({ answering: asking, publishPacks: false });
    paint(mesh.custody({ kb_count: kbCount() }));
  }
  function line(k, v) { return '<tr><td>' + esc(k) + '</td><td>' + esc(v) + '</td></tr>'; }
  function ruleOf(x) { return x && x.rule ? x.rule : '—'; }
  function card(title, cls, rows) {
    return '<div class="card daemon-card ' + cls + '" data-daemon="' + cls + '"><div class="cardhead">' + esc(title) + '</div><table>' + rows.map(r => line(r[0], r[1])).join('') + '</table></div>';
  }
  function paint(c) {
    const strip = $('#custodyStrip');
    const body = $('#custodyBody');
    if (!c) {
      const off = root.KNextLayer && root.KNextLayer.enabled && root.KNextLayer.enabled('dream_idle') === false;
      const msg = off
        ? 'dream_idle is switched off. The mesh is not running. Packs stay gated. Money stays disabled.'
        : 'Always-on workers. This portable file does not inline the mesh. The installed site binds this monitor to dream_idle.js. Letter packs stay gated.';
      if (strip) strip.innerHTML = '<b>Custody</b> ' + esc(msg);
      if (body) body.innerHTML = '<div class="card"><div class="cardhead">Custody <span class="pill' + (off ? '' : ' ok') + '">' + (off ? 'switched off' : 'always on') + '</span></div><div class="small">' + esc(msg) + '</div></div>';
      return;
    }
    const a = c.athena || {}, g = c.gilligan || {}, kb = c.kb || {};
    const sched = (lastSchedule && lastSchedule.rule) || c.schedule_law;
    const delta = kb.delta == null ? '' : (kb.delta > 0 ? ' (+' + kb.delta + ')' : ' (' + kb.delta + ')');
    const summary = 'Athena ' + ruleOf(a.last) + ' · Gilligan ' + ruleOf(g.last) + ' · KB ' + (kb.count == null ? '—' : kb.count) + delta;
    if (strip) strip.innerHTML = '<b>Custody</b> ' + esc(summary) + ' <button type="button" id="custodyOpen">Open</button>';
    const open = $('#custodyOpen');
    if (open) open.onclick = () => { if (root.KUI && root.KUI.openTab) root.KUI.openTab('custody'); };
    if (!body) return;
    const alast = a.last || {};
    const draft = document.activeElement && document.activeElement.id === 'custodyKeyIn' ? document.activeElement.value : '';
    body.innerHTML = '<div class="card"><div class="cardhead">Daemon custody <span class="pill ok">always on</span><span class="pill">no LLM</span></div>'
      + '<div class="small">Learning loop: research → measure → admit or quarantine → cold → hosted KB → Ask. Athena measures. Gilligan re-curates cold. Neo is Ask. Neo is not Neil. Ask pauses helpers, then they resume. Codex 3.24 idle text is yield etiquette only. The schedule is DREAM-ALWAYS-ON. Packs stay gated.</div>'
      + '<table>' + line('schedule', sched) + line('always_on', c.always_on) + line('idle_gated', c.idle_gated) + line('answering', c.answering) + line('fill', c.continuous_fill) + line('packs', c.phone_pack_publish) + line('queued', c.queued) + line('novel open', c.novel_open) + line('codex', c.codex ? ((c.codex.echo_confirmed ? 'echo open' : 'boot locked') + ' · ' + c.codex.engines_built + ' engines · χ armed') : '—') + '</table></div>'
      + '<div class="daemon-grid">'
      + card('Athena', 'athena', [['duty', a.duty], ['runs', a.runs], ['research ticks', a.research_ticks], ['admits', a.admits], ['staged', a.staged], ['quarantine', a.quarantine], ['last', ruleOf(a.last) + (alast.gap_id ? ' · ' + alast.gap_id : '') + (alast.lane ? ' · ' + alast.lane : '')]])
      + card('Gilligan', 'gilligan', [['duty', g.duty], ['runs', g.runs], ['cold re-curate', g.cold_recurate], ['cold keep', g.cold_keep], ['cold checks', g.cold_quiet], ['novel ticks', g.novel_ticks], ['novel open', g.novel_open], ['ChristPing', g.christ_pings], ['last', ruleOf(g.last)]])
      + '</div>'
      + '<div class="card"><div class="cardhead">Hosted KB</div><table>'
      + line('loop', 'research → measure → admit/quarantine → cold → KB → Ask')
      + line('write key', c.write_key_held ? 'held' : 'not held')
      + line('session count', (kb.count == null ? '—' : kb.count) + delta)
      + line('lawful admits', kb.admits)
      + line('phone db', kb.phone_db)
      + line('pack stuffed', kb.pack_stuffed)
      + '</table><form id="custodyKey" class="row"><input id="custodyKeyIn" type="password" autocomplete="off" placeholder="write key"><button type="submit">Grant</button><button type="button" id="custodyKeyClear">Clear</button></form><div class="small">' + (c.write_key_held ? 'The write key is held. A promote-candidate writes the session hosted bank. The count is those writes plus anything already pulled.' : 'The write key is not held. Lawful admits stay at 0 until Nic grants it. This page does not contain the key.') + ' Phone and Pages letter packs stay gated.</div></div>';
    const form = $('#custodyKey');
    if (form) form.onsubmit = ev => { ev.preventDefault(); const input = $('#custodyKeyIn'); const r = root.KCustody.holdWriteKey(input ? input.value : ''); if (input) input.value = ''; const msg = r && (r.held || r.ok) ? 'write key held' : (r && (r.rule || 'refused')); const small = body.querySelector('.card:last-child .small'); if (small) small.textContent = msg; root.KCustody.step(); };
    const clear = $('#custodyKeyClear');
    if (clear) clear.onclick = () => { if (root.KCustody.clearWriteKey) root.KCustody.clearWriteKey(); const input = $('#custodyKeyIn'); if (input) input.value = ''; root.KCustody.step(); };
    const input = $('#custodyKeyIn');
    if (input && draft) { input.value = draft; input.focus(); }
  }
  root.KCustody = { noteAsk: noteAsk, step: step, boot: boot, holdWriteKey: holdWriteKey };
  root.renderCustody = function () { root.KCustody.step(); };
  const prev = root.afterSay;
  function noteResearch(r) {
    boot();
    const D = engine();
    if (!mesh || !D || !D.bridgeAskEvidence || !r) return;
    const bridged = D.bridgeAskEvidence(r);
    if (bridged && bridged.ok && bridged.gap) { mesh.enqueue([bridged.gap]); if (mesh.prefer) mesh.prefer(bridged.gap.id); }
  }
  root.afterSay = function (r, el) {
    if (prev) prev(r, el);
    if (r && r.toolJob && typeof r.toolJob.then === 'function') r.toolJob.then(noteResearch);
    else noteResearch(r);
  };
  if (root.KPipeline && root.KPipeline.attachCustody) root.KPipeline.attachCustody(root);
  function kick() { root.KCustody.step(); if (!timer) timer = root.setInterval(() => root.KCustody.step(), 2000); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', kick); else kick();
})(typeof self !== 'undefined' ? self : this);
