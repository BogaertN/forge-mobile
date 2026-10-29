/* app_custody.js — 4.9.173 phone custody monitor.
 * Binds to the live KDreamIdle mesh (boundary, schedule, ticks, research, admit, cold re-curate, KB count).
 * The portable single file does not inline dream_idle.js. This screen does not publish letter packs.
 * Tools marketplace is not this ship. Nic builds tools and access after it. Hook: Tool Bench tab id echoforge. */
(function (root) {
  if (typeof document === 'undefined' || !root.document) return;
  const $ = s => document.querySelector(s);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  let mesh = null, asking = false, lastSchedule = null, timer = null;
  function engine() { return root.KDreamIdle || null; }
  function boot() {
    const D = engine();
    const forge = root.forge;
    if (!D || !D.createIdleDream || !forge || mesh) return mesh;
    /* Write key stays off this page. A later access tool may pass writeKey. publishPacks stays false. */
    mesh = D.createIdleDream({ host: forge, publishPacks: false, clock: () => new Date().toISOString() });
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
      const msg = 'Always-on workers. This portable file does not inline the mesh. The installed site binds this monitor to dream_idle.js. Letter packs stay gated.';
      if (strip) strip.innerHTML = '<b>Custody</b> ' + esc(msg);
      if (body) body.innerHTML = '<div class="card"><div class="cardhead">Custody <span class="pill ok">always on</span></div><div class="small">' + esc(msg) + '</div></div>';
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
    body.innerHTML = '<div class="card"><div class="cardhead">Daemon custody <span class="pill ok">always on</span><span class="pill">no LLM</span></div>'
      + '<div class="small">Athena researches and curates. Gilligan stays on cold storage and novel gaps. Neo is Ask. Neo is not Neil. Ask pauses helpers, then they resume. Codex 3.24 idle text is yield etiquette only. The schedule is DREAM-ALWAYS-ON. Opening this screen does not publish letter packs and does not require a KB click.</div>'
      + '<table>' + line('schedule', sched) + line('always_on', c.always_on) + line('idle_gated', c.idle_gated) + line('answering', c.answering) + line('fill', c.continuous_fill) + line('packs', c.phone_pack_publish) + line('queued', c.queued) + line('novel open', c.novel_open) + '</table></div>'
      + '<div class="daemon-grid">'
      + card('Athena', 'athena', [['duty', a.duty], ['runs', a.runs], ['research ticks', a.research_ticks], ['admits', a.admits], ['staged', a.staged], ['quarantine', a.quarantine], ['last', ruleOf(a.last) + (alast.gap_id ? ' · ' + alast.gap_id : '') + (alast.lane ? ' · ' + alast.lane : '')]])
      + card('Gilligan', 'gilligan', [['duty', g.duty], ['runs', g.runs], ['cold re-curate', g.cold_recurate], ['cold keep', g.cold_keep], ['cold checks', g.cold_quiet], ['novel ticks', g.novel_ticks], ['novel open', g.novel_open], ['ChristPing', g.christ_pings], ['last', ruleOf(g.last)]])
      + '</div>'
      + '<div class="card"><div class="cardhead">Hosted KB</div><table>'
      + line('session count', (kb.count == null ? '—' : kb.count) + delta)
      + line('lawful admits', kb.admits)
      + line('phone db', kb.phone_db)
      + line('pack stuffed', kb.pack_stuffed)
      + '</table><div class="small">The count is the session hosted bank. Athena writes it when this session holds the write key. This monitor does not carry that key. Phone and Pages letter packs stay gated.</div></div>';
  }
  root.KCustody = { noteAsk: noteAsk, step: step, boot: boot };
  root.renderCustody = function () { step(); };
  const prev = root.afterSay;
  root.afterSay = function (r, el) {
    if (prev) prev(r, el);
    if (!mesh || !r || !r.trace) return;
    const rules = r.trace.rules || [];
    if (!rules.some(x => x && /AQ1|AQ-1|AUTH-AQ1/.test(String(x.id || '')))) return;
    mesh.enqueue([{ id: 'gap:aq1:' + String(r.trace.turn == null ? rules.length : r.trace.turn), kind: 'aq1_miss', claim: null, extracts: [], calls_llm: false }]);
  };
  function kick() { step(); if (!timer) timer = root.setInterval(step, 2000); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', kick); else kick();
})(typeof self !== 'undefined' ? self : this);
