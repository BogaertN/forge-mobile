/* neo.js: the idle scheduler of Athena's gap queue. Gilligan still validates each gap.
 * One tick, logged. A repeated question is deduped. A gap that is not ready waits out its backoff.
 * Ask pauses the tick and it resumes afterward. This file does not spawn and it does not write. */
(function (root) {
  function create(o) {
    o = o || {};
    let answering = false, last = 0, running = false, log = [];
    const now = () => (o.now ? o.now() : Date.now());
    const note = (rule, extra) => {
      log.push(Object.assign({ at: now(), who: 'neo', rule: rule, calls_llm: false }, extra || {}));
      if (log.length > 40) log = log.slice(-40);
    };
    function setAnswering(on) {
      const next = on === true;
      if (next !== answering) note(next ? 'NEO-PAUSED' : 'NEO-RESUMED');
      answering = next;
      if (o.onAnswering) o.onAnswering(next);
    }
    function curators() { return o.curators ? o.curators() : null; }
    function noteHeld(question, row, extra) {
      const c = curators();
      if (!c || !c.noteHeld) return { ok: false, rule: 'NEO-NO-QUEUE' };
      const r = c.noteHeld(question, row, extra);
      if (r && r.rule === 'CURATE-GAP-KNOWN') note('NEO-DEDUPED', { question: question });
      else if (r && r.ok) note('NEO-QUEUED', { question: question });
      return r;
    }
    async function tick() {
      if (answering) { note('NEO-PAUSED'); return { ok: false, rule: 'NEO-PAUSED', scheduler: 'neo', calls_llm: false }; }
      if (running) return { ok: false, rule: 'NEO-BUSY', scheduler: 'neo', calls_llm: false };
      const c = curators();
      if (!c || !c.tick) { note('NEO-NO-QUEUE'); return { ok: false, rule: 'NEO-NO-QUEUE', scheduler: 'neo', calls_llm: false }; }
      running = true;
      try {
        const out = await c.tick();
        const rule = out && out.rule || 'NEO-TICK';
        note(rule === 'ATHENA-BACKOFF' ? 'NEO-BACKOFF' : 'NEO-TICK', { result: rule, to: out && out.to, question: out && out.rec && out.rec.question });
        return Object.assign({ scheduler: 'neo', calls_llm: false }, out || {});
      } finally { running = false; }
    }
    async function step() {
      const enabled = !o.enabled || o.enabled() !== false;
      const visible = !o.visible || o.visible() !== false;
      if (!enabled || !visible || answering || running) return { ok: false, rule: answering ? 'NEO-PAUSED' : 'NEO-IDLE', scheduler: 'neo', calls_llm: false };
      if (now() - last < (o.intervalMs || 15000)) return { ok: false, rule: 'NEO-WAIT', scheduler: 'neo', calls_llm: false };
      last = now();
      return tick();
    }
    return { step: step, tick: tick, setAnswering: setAnswering, noteHeld: noteHeld, log: () => log.slice(), answering: () => answering };
  }
  const api = { create: create };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.KNeoLib = api;
})(typeof self !== 'undefined' ? self : this);
