/* KRelationEcho (4.9.217): the browser copy of engine/rmc_engine_v1/relation_echo.py, line for line, so the 4.9.200 renderer card's
 * Echo reads the asked relation exactly as the engine's Echo does (parity in r4217). Does a sentence realise the relation the question
 * asked (definition, identity, attribute, cause, quantity, place, time, agent, manner), about the asked subject? The Pāṇinian kāraka
 * readings (kartṛ of FR.BE.COP, hetu / apādāna, adhikaraṇa, saṅkhyā); the copular atom as world_model_v1.parse_sentence reads it.
 * Word overlap is never the relation decision. Deterministic, no LLM, no network. The engine decides Ask; this copy only renders. */
(function (root) {
  const W = '[\\p{L}\\p{N}_]';
  const DET = new Set(['the', 'a', 'an']);
  const OWNER = { my: '@owner', your: '@owner', our: '@owner' };
  const COPULA = ['is', 'are', 'was', 'were'];
  const NAMING = ['refers to', 'is defined as', 'are defined as', 'is called', 'are called', 'is known as', 'are known as', 'means', 'denotes', 'is the name of'];
  const NEG = new Set(['not', 'never', 'no']);
  const ADV = new Set(['also', 'now', 'often', 'usually', 'generally', 'sometimes', 'still', 'actually', 'really', 'always']);
  const IRREG_PART = new Set(['found', 'made', 'known', 'seen', 'given', 'built', 'held', 'born', 'taken', 'done', 'used', 'thought', 'said', 'kept', 'left', 'brought', 'caught', 'put', 'set', 'sent', 'shown', 'grown', 'drawn', 'worn', 'written', 'spoken', 'driven', 'eaten', 'fallen', 'hidden', 'broken', 'chosen', 'frozen', 'stolen']);
  const NAMING_PART = new Set(['called', 'named', 'known', 'defined', 'termed']);
  const NP_OPEN = new Set(['one', 'any', 'each', 'some', 'two', 'three', 'his', 'her', 'its', 'their', 'our', 'my', 'your']);
  const LOCATIVE = new Set(['in', 'at', 'on', 'near', 'inside', 'between', 'beneath', 'under', 'above', 'within', 'located', 'lies', 'situated', 'found', 'north', 'south', 'east', 'west', 'orbit', 'orbits', 'around']);
  const MONTHS = new Set(['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december']);
  const TIME = new Set(['century', 'centuries', 'ago', 'bc', 'bce', 'ad', 'ce', 'year', 'years', 'decade', 'today', 'yesterday', 'during']);
  const NUMWORDS = new Set(['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'hundred', 'hundreds', 'thousand', 'thousands', 'million', 'millions', 'billion', 'billions', 'dozen', 'half', 'twice', 'double', 'triple']);
  const QUANT_ADJ = ['hot', 'cold', 'far', 'long', 'big', 'old', 'tall', 'fast', 'heavy', 'large', 'deep', 'high', 'wide', 'warm', 'small', 'short', 'bright', 'loud'];
  const SUPERLATIVE_EXTRA = new Set(['best', 'worst', 'most', 'least', 'first', 'last', 'main', 'biggest']);
  const IRREG_VERB = { wrote: 'writ', written: 'writ', write: 'writ', writes: 'writ', painted: 'paint', built: 'build', made: 'make', found: 'find', discovered: 'discover', invented: 'invent', drew: 'draw', drawn: 'draw', sang: 'sing', sung: 'sing', began: 'begin', begun: 'begin', took: 'take', taken: 'take', led: 'lead', founded: 'found' };
  const STOP = new Set(['the', 'and', 'for', 'with', 'from', 'that', 'this', 'what', 'which', 'when', 'where', 'who', 'whom', 'why', 'how', 'are', 'was', 'were', 'you', 'your', 'does', 'did', 'can', 'could', 'into', 'about', 'have', 'has', 'not', 'but', 'is', 'do', 'a', 'an', 'of', 'to', 'in', 'on', 'my', 'our', 'it']);
  const PY_STRIP_WS = /^[\s\u001c-\u001f\u0085]+|[\s\u001c-\u001f\u0085]+$/g;
  const strip = (s, chars) => { s = String(s); if (chars == null) return s.replace(PY_STRIP_WS, ''); let a = 0, b = s.length; while (a < b && chars.indexOf(s[a]) >= 0) a++; while (b > a && chars.indexOf(s[b - 1]) >= 0) b--; return s.slice(a, b); };
  const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  function words(text) { return (String(text == null ? '' : text).toLowerCase().replace(/’/g, "'").match(/[a-z0-9]+(?:['’][a-z]+)?/g) || []).map(w => w.replace(/'s$/, '')); }
  const content = ws => ws.filter(w => !STOP.has(w) && w.length > 1);
  function normNp(text) { let ws = words(text); while (ws.length && DET.has(ws[0])) ws = ws.slice(1); return ws.map(w => OWNER[w] || w); }
  function sameNp(a, b) { if (!a.length || !b.length || a.length !== b.length) return false; for (let i = 0; i < a.length; i++) { const x = a[i], y = b[i]; if (x === y) continue; if (x + 's' === y || y + 's' === x || x + 'es' === y || y + 'es' === x) continue; return false; } return true; }
  function hasWord(word, ws) { for (const w of ws) { if (w === word || w === word + 's' || w + 's' === word || w === word + 'es' || w + 'es' === word) return true; if (word.length > 4 && word.endsWith('y') && w === word.slice(0, -1)) return true; } return false; }
  function stripParens(text) { let out = String(text == null ? '' : text); for (let i = 0; i < 3; i++) out = out.replace(/\([^()]*\)/g, ' '); return strip(out.replace(/\s+/g, ' ')); }
  function clauses(text) { const out = []; for (const sentence of strip(String(text == null ? '' : text)).split(/(?<=[.!?])\s+(?=[A-Z0-9"'])/)) for (const part of sentence.split(';')) { const p = strip(stripParens(part), ' .!?'); if (p) out.push(p); } return out.slice(0, 12); }
  const subjectHead = subj => subj.indexOf(',') >= 0 ? strip(subj.split(',')[0]) : strip(subj);
  function parseIs(clause) { // world_model_v1.parse_sentence, the "is not" / "is" atom (contract §7)
    const sentence = strip(strip(String(clause).replace(/\s+/g, ' ')), ' .'); if (!sentence || sentence.length > 100000) return null;
    for (const verb of ['is not', 'is']) { const m = new RegExp('^(.+?) ' + esc(verb) + ' (.+)$', 'i').exec(sentence); if (!m) continue; const s = strip(m[1]), o = strip(m[2]); if (!s || !o) continue; return [s, o]; }
    return null; }
  const WB = '(?:(?<=' + W + ')(?!' + W + ')|(?<!' + W + ')(?=' + W + '))';
  const NP_RE = new RegExp('^[^\\p{L}\\p{N}_]*(?:[A-Z][\\p{L}\\p{N}_-]*|[\\p{L}\\p{N}_-]+[\'’]s)' + WB, 'u');
  function copular(clause) {
    const low = ' ' + clause.toLowerCase() + ' '; let best = null;
    for (const verb of NAMING.concat(COPULA)) { const m = new RegExp('\\s' + esc(verb) + '\\s').exec(low); if (m && (best === null || m.index < best[0] || (m.index === best[0] && verb.length > best[1].length))) best = [m.index, verb]; }
    if (!best) return null;
    const start = best[0], verb = best[1];
    let subj = strip(clause.slice(0, Math.max(0, start)), ' ,'), pred = strip(clause.slice(start + verb.length + 1), ' ,');
    if (verb === 'is') { const a = parseIs(clause); if (a) { subj = strip(a[0], ' ,'); pred = strip(a[1], ' ,'); } }
    if (!subj || !pred) return null;
    let pw = words(pred); const cl = clause.toLowerCase(), isNot = cl.indexOf(' is not ');
    const neg = (pw.length > 0 && NEG.has(pw[0])) || (verb === 'is' && isNot >= 0 && isNot <= start);
    while (pw.length && (NEG.has(pw[0]) || ADV.has(pw[0]))) pw = pw.slice(1);
    let kind;
    if (NAMING.indexOf(verb) >= 0) kind = 'naming';
    else if (!pw.length) kind = 'none';
    else if (DET.has(pw[0]) || NP_OPEN.has(pw[0]) || NP_RE.test(pred.replace(/^(?:(?:not|also|now|often|usually|generally|sometimes|still|actually|really|always)\s+)+/, ''))) kind = 'np';
    else if (NAMING_PART.has(pw[0]) && (pw[0] === 'called' || pw[0] === 'named' || pw[0] === 'termed' || pw[1] === 'as')) kind = 'naming';
    else if (pw[0].endsWith('ing') && pw[0].length > 4) kind = 'progressive';
    else if ((pw[0].endsWith('ed') && pw[0].length > 3) || IRREG_PART.has(pw[0])) kind = 'passive';
    else kind = 'attribute';
    return { subject: subjectHead(subj), subject_full: subj, verb, predicate: pred, kind, negated: !!neg };
  }
  function asked(question, slotOf) {
    const q = strip(String(question == null ? '' : question).replace(/\s+/g, ' ')).replace(/[ ?.!]+$/, ''); const low = q.toLowerCase(); const w = words(low);
    const out = { relation: 'unclassified', subject: [], head: '', about: [], verb: '' };
    if (!w.length) return out;
    const slot = slotOf ? slotOf(question) : null; let m = new RegExp('^(?:what|which)\\s+(' + W + '+)\\s+(?:is|are|was|were)\\s+(.+)$', 'u').exec(low);
    if (slot && m && m[1] === slot.word) { const np = normNp(m[2]); return { relation: 'attribute', subject: np, head: np.length ? np[np.length - 1] : '', about: content(np), slot: slot.word, verb: '' }; }
    m = /^(?:what|who)\s+(?:is|are|was|were)\s+(.+)$/.exec(low);
    if (m) { const np = normNp(m[1]);
      if (!np.length || ['of', 'in', 'on', 'for', 'with', 'from', 'about', 'like', 'made', 'called'].indexOf(np[np.length - 1]) >= 0 || ['it', 'that', 'this', 'there', 'you', 'i', 'we', 'they', 'he', 'she'].indexOf(np[0]) >= 0) return out;
      let head, rel;
      if (np.indexOf('of') >= 0) { const i = np.indexOf('of'); head = i > 0 ? np[i - 1] : np[np.length - 1]; rel = 'identify'; }
      else if (np[0] === '@owner' || np[0].endsWith('est') || SUPERLATIVE_EXTRA.has(np[0]) || (np.length > 1 && (np[0] === 'tallest' || np[0] === 'longest'))) { head = np[np.length - 1]; rel = 'identify'; }
      else { head = np[np.length - 1]; rel = 'definition'; }
      return { relation: rel, subject: np, head, about: content(np), verb: '' }; }
    m = /^why\s+(is|are|was|were|do|does|did|can|could|would|will|has|have)\s+(.+)$/.exec(low);
    if (m) { const rest = content(normNp(m[2])); const about = COPULA.indexOf(m[1]) >= 0 && rest.length > 1 ? rest.slice(0, -1) : rest.slice(0, 1); return { relation: 'cause', subject: about, head: about[0] || '', about, verb: '' }; }
    m = /^how\s+(many|much)\s+(.+)$/.exec(low) || new RegExp('^how\\s+(' + QUANT_ADJ.slice().sort().join('|') + ')\\s+(?:is|are|was|were|does|do|did)?\\s*(.+)$').exec(low);
    if (m) { const about = content(normNp(m[2])); return { relation: 'quantity', subject: about, head: about[0] || '', about, verb: '' }; }
    for (const [wh, rel] of [['where', 'location'], ['when', 'time']]) { m = new RegExp('^' + wh + '\\s+(is|are|was|were|do|does|did)\\s+(.+)$').exec(low);
      if (m) { let about = content(normNp(m[2])); if (['do', 'does', 'did'].indexOf(m[1]) >= 0 && about.length > 1) about = about.slice(0, -1); return { relation: rel, subject: about, head: about[0] || '', about, verb: '' }; } }
    m = new RegExp('^who\\s+(' + W + '+)\\s+(.+)$', 'u').exec(low);
    if (m && COPULA.concat(['do', 'does', 'did', 'can', 'could', 'will', 'would', 'has', 'have']).indexOf(m[1]) < 0) { const about = content(normNp(m[2])); return { relation: 'agent', subject: about, head: about[0] || '', about, verb: m[1] }; }
    m = /^how\s+(?:do|does|did|is|are|was|were|can)\s+(.+)$/.exec(low);
    if (m) { let about = content(normNp(m[1])); if (about.length > 1) about = about.slice(0, -1); return { relation: 'manner', subject: about, head: about[0] || '', about, verb: '' }; }
    return out;
  }
  function verbKey(word) { if (IRREG_VERB[word]) return IRREG_VERB[word]; for (const suf of ['ing', 'ed', 'es', 's']) if (word.endsWith(suf) && word.length - suf.length >= 4) return word.slice(0, -suf.length); return word; }
  function about(ask, ws) { const a = (ask.about || []).filter(x => x !== '@owner'); return a.length > 0 && a.every(x => hasWord(x, ws)); }
  function defineRank(ask, text) {
    const rel = ask.relation; if (['definition', 'identify', 'attribute'].indexOf(rel) < 0) return { rank: 0, frame: null };
    const subj = ask.subject || []; let best = { rank: 0, frame: null };
    for (const clause of clauses(text)) {
      if (rel === 'definition') { const app = /^([^,]+),\s*((?:a|an|the)\s[^,]+),/i.exec(clause); if (app && sameNp(normNp(app[1]), subj)) return { rank: 2, frame: 'FR.BE.COP', role: 'karta', kind: 'appositive', clause: clause.slice(0, 200) }; }
      const cop = copular(clause); if (!cop || cop.negated) continue; const sNp = normNp(cop.subject);
      if (rel === 'definition') {
        if (sameNp(sNp, subj) && (cop.kind === 'np' || cop.kind === 'naming')) return { rank: 2, frame: 'FR.BE.COP', role: 'karta', kind: cop.kind, clause: clause.slice(0, 200) };
        if (sameNp(sNp, subj) && cop.kind === 'attribute' && best.rank < 1) best = { rank: 1, frame: 'FR.BE.COP', role: 'karta', kind: 'attribute', clause: clause.slice(0, 200) };
      } else if (rel === 'identify') {
        const pNp = normNp(cop.predicate); const cw = words(clause).map(x => OWNER[x] || x); const sides = [sNp, pNp];
        for (let i = 0; i < sides.length; i++) { const side = sides[i];
          if (ask.head && hasWord(ask.head, side) && (ask.about || []).filter(a => a !== '@owner').every(a => hasWord(a, cw)) && (subj[0] !== '@owner' || side.indexOf('@owner') >= 0)) {
            if (['np', 'naming', 'attribute'].indexOf(cop.kind) >= 0) return { rank: 2, frame: 'FR.BE.COP', role: i === 0 ? 'karta' : 'karma', kind: cop.kind, clause: clause.slice(0, 200) }; } }
      } else if (ask.head && sNp.length && hasWord(ask.head, sNp.slice(-1)) && (subj[0] !== '@owner' || sNp.indexOf('@owner') >= 0) && (cop.kind === 'attribute' || cop.kind === 'np')) {
        return { rank: 2, frame: 'FR.BE.COP', role: 'karta', kind: cop.kind, clause: clause.slice(0, 200) }; } }
    return best;
  }
  /* opts.slot(question) -> { word, fills(text) } | null and opts.statesCause(text) are the caller's frame-aware Echo helpers
   * (the renderer's VALUE_SLOTS and CAUSE, generated from the same concept lexicon as echo_question.py). */
  function realises(question, answer, opts) {
    const o = opts || {}; const ask = asked(question, o.slot); const rel = ask.relation; const ws = words(answer).map(x => OWNER[x] || x);
    const out = { asked: rel, subject: (ask.subject || []).join(' '), realised: null, method: 'relation_reparse' };
    if (rel === 'unclassified') return out;
    if (rel === 'definition' || rel === 'identify') { const d = defineRank(ask, answer); out.realised = d.rank >= 1; out.define_rank = d.rank; out.frame = d.frame || null; out.role = d.role || null; out.kind = d.kind || null; return out; }
    if (rel === 'attribute') { const slot = o.slot ? o.slot(question) : null; const d = defineRank(ask, answer); out.realised = !!(d.rank >= 1 && slot && slot.fills(d.clause || '')); out.frame = d.frame || null; return out; }
    const ab = about(ask, ws);
    if (rel === 'cause') { const stated = !!(o.statesCause && o.statesCause(answer)); out.realised = !!(ab && stated); out.stated = stated; }
    else if (rel === 'quantity') out.realised = !!(ab && ws.some(w => /^[0-9]+$/.test(w) || /^[0-9]/.test(w) || NUMWORDS.has(w)));
    else if (rel === 'location') out.realised = !!(ab && ws.some(w => LOCATIVE.has(w)));
    else if (rel === 'time') out.realised = !!(ab && ws.some(w => /^(1[0-9]{3}|20[0-9]{2})s?$/.test(w) || MONTHS.has(w) || TIME.has(w)));
    else if (rel === 'agent') { const key = verbKey(ask.verb || ''); out.realised = !!(ab && key && ws.some(w => verbKey(w) === key)); }
    else if (rel === 'manner') out.realised = !!ab;
    out.about = ab;
    return out;
  }
  const api = { asked, copular, clauses, defineRank, realises, words };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.KRelationEcho = api;
})(this);
