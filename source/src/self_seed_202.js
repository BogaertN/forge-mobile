/* 4.9.202 self-seeding anchors. No model.
 * The decision matches rmc_engine_v1.self_seed_202.evaluate.
 * Wikipedia is a pointer. A failure backs off. The admit gate stays closed here;
 * the re-ask is the existing Ask path. */
(function (root) {
  'use strict';
  const STOP = {
    the: 1, and: 1, for: 1, with: 1, from: 1, that: 1, this: 1, what: 1, which: 1, when: 1,
    where: 1, who: 1, whom: 1, why: 1, how: 1, are: 1, was: 1, were: 1, you: 1, your: 1,
    does: 1, did: 1, can: 1, could: 1, into: 1, about: 1, have: 1, has: 1, not: 1, but: 1
  };
  const C_MIN = 0.87;
  const ECHO_MIN = 0.85;
  const WRITE_MAX = 0.35;
  const HARD_STOP = 0.8;
  const PI4 = Math.PI / 4;
  const TAU = Math.PI * 2;
  const BACKOFF_BASE = 60;
  let BACKOFF = {};
  let TABLE = null;
  let CONFIG = null;

  function round6(n) {
    return Math.round(n * 1e6) / 1e6;
  }

  function sha256(text) {
    if (typeof require === 'function') {
      return require('crypto').createHash('sha256').update(String(text), 'utf8').digest('hex');
    }
    if (root.KSha && root.KSha.sha256) return root.KSha.sha256(String(text));
    return '';
  }

  function readJson(rel) {
    if (typeof require !== 'function') return null;
    const fs = require('fs');
    const path = require('path');
    return JSON.parse(fs.readFileSync(path.join(__dirname, '..', rel), 'utf8'));
  }

  function table() {
    if (!TABLE) TABLE = readJson('engine/rmc_engine_v1/reference/surface_phase_202.json');
    return TABLE;
  }

  function config() {
    if (!CONFIG) CONFIG = readJson('engine/rmc_engine_v1/reference/trusted_sources_202.json');
    return CONFIG;
  }

  function install(tableDoc, configDoc) {
    if (tableDoc) TABLE = tableDoc;
    if (configDoc) CONFIG = configDoc;
  }

  function resetBackoff() { BACKOFF = {}; }

  function questionKey(question) {
    return sha256(String(question || '').trim().toLowerCase()).slice(0, 16);
  }

  function hostOf(url) {
    let raw = String(url || '').trim();
    if (!raw) return '';
    if (raw.indexOf('://') < 0) raw = 'https://' + raw;
    let host = '';
    try { host = new URL(raw).hostname.toLowerCase(); } catch (e) { return ''; }
    if (host.indexOf('www.') === 0) host = host.slice(4);
    return host;
  }

  function sourceFor(url) {
    const host = hostOf(url);
    if (!host) return null;
    const rows = (config() && config().sources) || [];
    for (let i = 0; i < rows.length; i++) {
      const mark = String(rows[i].host || '');
      if (host === mark || host.slice(-mark.length - 1) === '.' + mark) return rows[i];
    }
    return null;
  }

  function isPointer(url) {
    const host = hostOf(url);
    const marks = (config() && config().pointer_hosts) || [];
    for (let i = 0; i < marks.length; i++) {
      const mark = marks[i];
      if (host === mark || host.slice(-mark.length - 1) === '.' + mark) return true;
    }
    return false;
  }

  function angle(n) { return ((n - 1) / 9) * TAU; }

  function circularDelta(a, b) {
    let delta = Math.abs(angle(a) - angle(b)) % TAU;
    return Math.min(delta, TAU - delta);
  }

  function phaseAligned(a, b) {
    if (!(a >= 1 && a <= 9 && b >= 1 && b <= 9)) return false;
    return circularDelta(a, b) <= PI4 + 1e-12;
  }

  function lexTokens(text) {
    const out = [];
    let buf = '';
    const raw = String(text || '').toLowerCase();
    for (let i = 0; i < raw.length; i++) {
      const ch = raw[i];
      const code = raw.charCodeAt(i);
      const letter = (code >= 97 && code <= 122) || ch === "'" || ch === '-';
      if (letter) buf += ch;
      else if (buf) {
        const word = buf.replace(/^['-]+|['-]+$/g, '');
        if (word) out.push(word);
        buf = '';
      }
    }
    if (buf) {
      const word = buf.replace(/^['-]+|['-]+$/g, '');
      if (word) out.push(word);
    }
    return out;
  }

  function resultant(indexes) {
    if (!indexes.length) return null;
    const counts = {};
    indexes.forEach(n => { counts[n] = (counts[n] || 0) + 1; });
    const ranked = Object.keys(counts).map(k => [Number(k), counts[k]]).sort((a, b) => (b[1] - a[1]) || (a[0] - b[0]));
    if (ranked.length === 1 || ranked[0][1] > ranked[1][1]) return ranked[0][0];
    let sx = 0, sy = 0;
    indexes.forEach(n => { sx += Math.cos(angle(n)); sy += Math.sin(angle(n)); });
    let mean = Math.atan2(sy, sx) % TAU;
    if (mean < 0) mean += TAU;
    let best = null, gap = 1e9;
    for (let n = 1; n <= 9; n++) {
      const raw = Math.abs(angle(n) - mean);
      const dist = Math.min(raw, TAU - raw);
      if (dist < gap - 1e-12 || (Math.abs(dist - gap) < 1e-12 && (best === null || n < best))) {
        gap = dist;
        best = n;
      }
    }
    return best;
  }

  function letterPhi(text) {
    const letters = (table() && table().letters) || {};
    const indexes = [];
    lexTokens(text).forEach(tok => {
      for (let i = 0; i < tok.length; i++) {
        const n = letters[tok[i].toUpperCase()];
        if (n) indexes.push(n);
      }
    });
    return resultant(indexes);
  }

  function placement(text) {
    const words = (table() && table().words) || {};
    let best = null;
    lexTokens(text).forEach(tok => {
      const row = words[tok];
      if (!row) return;
      const anchor = String(row.concept || '').indexOf('A.') === 0 ? 0 : 1;
      const key = [anchor, -tok.length, row.concept];
      if (!best || key[0] < best.key[0] || (key[0] === best.key[0] && key[1] < best.key[1]) || (key[0] === best.key[0] && key[1] === best.key[1] && String(key[2]) < String(best.key[2]))) {
        best = { key: key, phi: row.phi, concept: row.concept };
      }
    });
    if (best && best.phi) return { phi: best.phi, concept: best.concept };
    return { phi: letterPhi(text), concept: null };
  }

  function echoTokens(text) {
    const out = {};
    const parts = String(text || '').toLowerCase().match(/[a-z0-9]+/g) || [];
    parts.forEach(w => { if (w.length > 2 && !STOP[w]) out[w] = 1; });
    return Object.keys(out);
  }

  function echoScore(question, output) {
    const left = echoTokens(question);
    const right = {};
    echoTokens(output).forEach(w => { right[w] = 1; });
    if (!left.length) return 0;
    let hit = 0;
    left.forEach(w => { if (right[w]) hit += 1; });
    return round6(hit / left.length);
  }

  function splitSentences(text) {
    let plain = String(text || '');
    plain = plain.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' ');
    plain = plain.replace(/<[^>]+>/g, ' ');
    plain = plain.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&#39;/g, "'");
    plain = plain.replace(/\s+/g, ' ').trim();
    const parts = plain.split(/(?<=[.!?])\s+/);
    const out = [];
    for (let i = 0; i < parts.length; i++) {
      const sentence = parts[i].trim();
      if (sentence.length >= 35 && sentence.length <= 420) out.push(sentence);
      if (out.length >= 40) break;
    }
    return out;
  }

  function extractUrls(text) {
    const found = String(text || '').match(/https?:\/\/[^\s<>"']+/g) || [];
    const out = [];
    const seen = {};
    found.forEach(url => {
      const clean = url.replace(/[).,;\]]+$/g, '');
      if (!seen[clean]) { seen[clean] = 1; out.push(clean); }
    });
    return out;
  }

  function dScore(prev, act) {
    return Number(prev) === 5 && Number(act) === 8 ? 1 : 0;
  }

  const ROMAN = { i: '1', ii: '2', iii: '3', iv: '4', v: '5', vi: '6', vii: '7', viii: '8', ix: '9' };
  const WORD_ORD = { first: '1', second: '2', third: '3', fourth: '4', fifth: '5' };
  const WH_WORDS = { who: 1, whom: 1, whose: 1, what: 1, when: 1, where: 1, why: 1, how: 1, which: 1 };
  const ENTITY_STOP = { the: 1, and: 1, for: 1, with: 1, from: 1, that: 1, this: 1, was: 1, were: 1, are: 1, you: 1, your: 1, did: 1, does: 1, can: 1, could: 1, into: 1, about: 1, have: 1, has: 1, not: 1, but: 1 };

  function norm(text) {
    return (String(text || '').toLowerCase().match(/[a-z0-9]+/g) || []).join(' ');
  }
  function words(text) {
    return String(text || '').toLowerCase().match(/[a-z0-9]+/g) || [];
  }
  function questionSlot(question) {
    const list = words(question);
    const head = list[0] || '';
    const toks = echoTokens(question);
    if (toks.indexOf('happens') >= 0 || toks.indexOf('mix') >= 0) return 'effect';
    if (head === 'who' || head === 'whom') return 'identity';
    if (head === 'when') return 'time';
    if (head === 'what' || head === 'which') return 'identity';
    return 'stated';
  }
  function entityTokens(question, slot) {
    const roles = ((config() || {}).time_roles) || [];
    const out = [];
    words(question).forEach(word => {
      const keepShort = !!ROMAN[word] || !!WORD_ORD[word] || /^\d{1,2}$/.test(word);
      if (WH_WORDS[word] || ENTITY_STOP[word]) return;
      if (word.length <= 2 && !keepShort) return;
      out.push(word);
    });
    if (slot === 'time' && out.length && roles.indexOf(out[out.length - 1]) >= 0) out.pop();
    return out;
  }
  function numeral(word) {
    if (ROMAN[word]) return ROMAN[word];
    if (WORD_ORD[word]) return WORD_ORD[word];
    if (/^\d{1,2}$/.test(word || '')) return String(Number(word));
    return null;
  }
  function numeralsBind(entity, sentence) {
    const wanted = entity.map(numeral).filter(Boolean);
    const found = words(sentence).map(numeral).filter(Boolean);
    if (!wanted.length) return true;
    if (wanted.some(value => found.indexOf(value) < 0)) return false;
    return found.every(value => wanted.indexOf(value) >= 0);
  }
  function copula(sentence) {
    const plain = String(sentence || '').replace(/\s+/g, ' ').replace(/^[\s."']+|[\s."']+$/g, '');
    const verbs = ['was not', 'is not', 'were not', 'was', 'were', 'is'];
    for (let i = 0; i < verbs.length; i++) {
      const match = new RegExp('^(.+?) ' + verbs[i] + ' (.+)$', 'i').exec(plain);
      if (match && match[1].trim() && match[2].trim()) return [match[1].trim(), verbs[i].split(' ')[0].toLowerCase(), match[2].trim()];
    }
    return null;
  }
  function subjectBinds(subject, entity) {
    const ent = norm(entity.join(' '));
    let sub = norm(subject);
    if (!ent || !sub) return false;
    const low = String(subject || '').toLowerCase();
    if (low.indexOf("'s") >= 0 || low.indexOf('’s') >= 0) return false;
    ['the ', 'a ', 'an '].forEach(art => { if (sub.indexOf(art) === 0) sub = sub.slice(art.length); });
    return sub === ent || sub.indexOf(ent + ' ') === 0;
  }
  function yearsOf(sentence) {
    return String(sentence || '').match(/\b(?:1[5-9]\d{2}|20\d{2})\b/g) || [];
  }
  function catalogUrl(url) {
    const low = String(url || '').toLowerCase();
    return (((config() || {}).catalog_url_marks) || []).some(mark => low.indexOf(mark) >= 0);
  }
  function captionText(sentence) {
    const low = sentence.toLowerCase();
    return (((config() || {}).caption_marks) || []).some(mark => low.indexOf(mark) >= 0);
  }
  function claimOf(question, sentence) {
    const slot = questionSlot(question);
    const entity = entityTokens(question, slot);
    const ent = norm(entity.join(' '));
    if (!ent) return null;
    if (!numeralsBind(entity, sentence)) return { ok: false, rule: 'BIND', slot: slot };
    if (slot === 'identity') {
      const parts = copula(sentence);
      if (!parts || !subjectBinds(parts[0], entity)) return { ok: false, rule: 'SHAPE', slot: slot };
      const karma = norm(parts[2]);
      if (!karma) return { ok: false, rule: 'SHAPE', slot: slot };
      return { ok: true, rule: 'SHAPE-FIT', slot: slot, claim: 'identity|' + ent + '|' + karma };
    }
    if (slot === 'time') {
      const years = yearsOf(sentence);
      const before = years.length === 1 ? norm(String(sentence).split(years[0])[0]) : '';
      if (years.length !== 1 || before.indexOf(ent) < 0) return { ok: false, rule: 'SHAPE', slot: slot };
      return { ok: true, rule: 'SHAPE-FIT', slot: slot, claim: 'time|' + ent + '|' + years[0] };
    }
    if (slot === 'effect') {
      const present = words(sentence);
      if (entity.some(word => !numeral(word) && word.length > 2 && present.indexOf(word) < 0)) return { ok: false, rule: 'SHAPE', slot: slot };
      const marks = (((config() || {}).effect_marks) || []).filter(mark => sentence.toLowerCase().indexOf(mark) >= 0).sort();
      if (!marks.length) return { ok: false, rule: 'SHAPE', slot: slot };
      return { ok: true, rule: 'SHAPE-FIT', slot: slot, claim: 'effect|' + ent + '|' + marks.join(',') };
    }
    return { ok: false, rule: 'SHAPE', slot: slot };
  }

  function safetyOf(question, sentence) {
    const cfg = config() || {};
    const toks = echoTokens(question);
    const mix = toks.indexOf('mix') >= 0 || String(question || '').toLowerCase().indexOf('mixing') >= 0;
    const low = sentence.toLowerCase();
    const procedure = (cfg.procedure_marks || []).some(mark => low.indexOf(mark) >= 0);
    const safety = (cfg.safety_marks || []).some(mark => low.indexOf(mark) >= 0);
    const quantity = /\b\d+\s*(cup|tbsp|tablespoon|teaspoon|ml|gram|grams)\b/.test(low);
    if (mix && (quantity || (procedure && !safety))) return { ok: false, rule: 'SAFETY-RECIPE' };
    return { ok: true, rule: mix && safety ? 'SAFETY-FACT' : 'SAFETY-PLAIN' };
  }

  function clustersOf(rows) {
    const clusters = [];
    rows.forEach(row => {
      let placed = false;
      for (let i = 0; i < clusters.length; i++) {
        if (clusters[i].every(other => phaseAligned(row.phi, other.phi))) {
          clusters[i].push(row);
          placed = true;
          break;
        }
      }
      if (!placed) clusters.push([row]);
    });
    return clusters;
  }

  function anchorFrom(question, row, loop, support) {
    const digest = sha256(question + '\n' + row.text).slice(0, 18);
    const sfe = { Phi: row.phi, eps: 0, mu: 1 };
    const hosts = Array.from(new Set(support.map(item => item.host))).sort();
    const provenance = {
      source: row.host,
      source_url: row.url,
      license: row.license,
      license_url: row.license_url,
      fetched_at: row.fetched_at,
      content_sha256: row.sha256,
      asking_question: question,
      tier: row.tier,
      independent_hosts: hosts,
      slot: row.slot,
      claim: row.claim,
      lexicon_concept: row.concept,
      lexicon_phi: row.phi,
      question_loop: loop,
      delta: row.delta,
      echo: row.echo,
      wikipedia_anchor: false,
      contributor: 'self-seed:' + row.host,
      ingestion_note: 'Sentence kept by lexicon phase alignment inside pi/4. Not a hand-written seed.'
    };
    return {
      id: 'self-' + digest,
      text: row.text,
      sfe: sfe,
      packet: {
        schema: 'FORGE-RESONANCE-PACKET/v1',
        Phi: sfe.Phi,
        eps: 0,
        mu: 1,
        sfe: sfe,
        placed_by: 'athena',
        standing: 'anchor',
        phi_basis: 'lexicon packet phase-aligned with the question loop',
        concept: row.concept
      },
      tier: 'anchor',
      state: 'anchor',
      trust: 'trusted',
      license: row.license,
      license_url: row.license_url,
      source_url: row.url,
      revision: String(row.sha256 || '').slice(0, 12),
      provenance: provenance,
      contributor: 'self-seed:' + row.host,
      concepts: row.concept ? [row.concept] : []
    };
  }

  function remember(question, now, rule) {
    const key = questionKey(question);
    const prev = BACKOFF[key] || { fails: 0 };
    const fails = prev.fails + 1;
    const wait = BACKOFF_BASE * Math.pow(2, fails - 1);
    BACKOFF[key] = { fails: fails, next_at: Number(now) + wait, rule: rule };
    return { fails: fails, next_at: BACKOFF[key].next_at, wait: wait };
  }

  function evaluate(payload) {
    payload = payload || {};
    if (payload.reset === true) resetBackoff();
    const question = String(payload.question || '').trim();
    const now = Number(payload.now || 0);
    const loop = payload.loop_phi === undefined || payload.loop_phi === null || payload.loop_phi === '' ? 1 : Number(payload.loop_phi);
    const base = {
      ok: true, build: '4.9.202', question: question, loop_phi: loop, calls_llm: false, network: false,
      money: false, dream_idle: false, economy: false, packs_gated: true, christping: 'gilligan-only',
      christping_started: false, wikipedia_anchor: false, resonance_not_parsing: true,
      coherence_formula_unchanged: true, c_min: C_MIN, echo_min: ECHO_MIN, write_max: WRITE_MAX,
      hard_stop: HARD_STOP, admit_gate: false, anchor: null, route: 'correction_queue'
    };
    if (!question) return Object.assign({}, base, { ok: false, rule: 'SEED-EMPTY' });
    const gap = payload.gap;
    const connected = Number(payload.anchors_connected || 0);
    if (gap === false || (gap === undefined && connected > 0)) {
      return Object.assign({}, base, { rule: 'SEED-NOT-A-GAP', gap: false, anchors_connected: connected });
    }
    const key = questionKey(question);
    const held = BACKOFF[key];
    if (held && now + 1e-9 < held.next_at) {
      return Object.assign({}, base, {
        rule: 'SEED-BACKOFF', gap: true, quarantined: true,
        backoff: { blocked: true, rule: 'SEED-BACKOFF', fails: held.fails, next_at: held.next_at, wait: round6(held.next_at - now) }
      });
    }
    const documents = payload.documents || [];
    const kept = [];
    const skipped = [];
    const pointers = [];
    documents.forEach(doc => {
      if (!doc) return;
      const url = String(doc.url || '');
      const text = String(doc.text || '');
      if (doc.sha256 && doc.sha256 !== sha256(text)) {
        skipped.push({ url: url, rule: 'INTEGRITY' });
        return;
      }
      if (isPointer(url) || doc.role === 'pointer') {
        extractUrls(text).forEach(found => {
          if (sourceFor(found) && !isPointer(found)) pointers.push(found);
        });
        skipped.push({ url: url, rule: 'WIKIPEDIA-POINTER' });
        return;
      }
      const src = sourceFor(url);
      if (!src) {
        skipped.push({ url: url, rule: 'NOT-ALLOWLISTED' });
        return;
      }
      if (catalogUrl(url)) {
        skipped.push({ url: url, rule: 'CATALOG' });
        return;
      }
      const digest = doc.sha256 || sha256(text);
      const fetched = String(doc.fetched_at || '');
      splitSentences(text).forEach(sentence => {
        if (captionText(sentence)) {
          skipped.push({ url: url, rule: 'CATALOG', text: sentence.slice(0, 180) });
          return;
        }
        const placed = placement(sentence);
        const phi = placed.phi;
        if (typeof phi === 'number' && dScore(loop, phi) === 1) {
          skipped.push({ url: url, rule: 'FORBIDDEN-5-8', phi: phi, loop: loop });
          return;
        }
        if (typeof phi !== 'number' || !phaseAligned(loop, phi)) {
          skipped.push({ url: url, rule: 'PHASE', phi: phi, loop: loop });
          return;
        }
        const safe = safetyOf(question, sentence);
        if (!safe.ok) {
          skipped.push({ url: url, rule: safe.rule, text: sentence.slice(0, 180) });
          return;
        }
        const fit = claimOf(question, sentence);
        if (!fit || !fit.ok) {
          skipped.push({ url: url, rule: (fit && fit.rule) || 'SHAPE', text: sentence.slice(0, 180) });
          return;
        }
        const echo = echoScore(question, sentence);
        kept.push({
          text: sentence, url: url, host: String(src.host), tier: Number(src.tier), trust: Number(src.trust),
          license: src.license, license_url: src.license_url, phi: phi, concept: placed.concept,
          grace: round6(Math.cos(circularDelta(loop, phi)) ** 2), delta: round6(circularDelta(loop, phi)),
          echo: echo, echo_pass: echo >= ECHO_MIN, sha256: digest, fetched_at: fetched, safety: safe.rule,
          slot: fit.slot, claim: fit.claim, page_class: 'reference'
        });
      });
    });
    const passing = kept.filter(row => row.echo_pass && row.claim);
    const groups = {};
    passing.forEach(row => {
      const claim = String(row.claim || '');
      groups[claim] = groups[claim] || [];
      groups[claim].push(row);
    });
    const phases = Array.from(new Set(kept.map(row => row.phi))).sort((a, b) => a - b);
    const trace = { kept: kept.length, echo_pass: passing.length, clusters: Object.keys(groups).length, pointers: pointers.slice(0, 12), skipped: skipped.slice(0, 24), phases: phases };
    function fail(rule, extra) {
      const failure = remember(question, now, rule);
      return Object.assign({}, base, extra || {}, { rule: rule, gap: true, quarantined: true, trace: trace, backoff: failure, route: 'correction_queue' });
    }
    const claims = Object.keys(groups);
    if (claims.length > 1) return fail('SEED-DISAGREEMENT');
    if (!claims.length) {
      const rules = {};
      skipped.forEach(row => { rules[row.rule] = 1; });
      let reason = 'SEED-NO-SOURCE';
      if (kept.length && !passing.length) reason = 'SEED-ECHO';
      else if (rules.BIND && !kept.length) reason = 'SEED-BIND';
      else if (rules.SHAPE && !kept.length) reason = 'SEED-SHAPE';
      else if (rules.CATALOG && !kept.length) reason = 'SEED-CATALOG';
      else if (rules['FORBIDDEN-5-8'] && !kept.length) reason = 'SEED-FORBIDDEN';
      else if (rules.PHASE && !kept.length) reason = 'SEED-PHASE';
      else if (rules['SAFETY-RECIPE'] && !kept.length) reason = 'SEED-SAFETY';
      return fail(reason);
    }
    const cluster = groups[claims[0]];
    const hosts = Array.from(new Set(cluster.map(row => row.host))).sort();
    if (hosts.length < 2) return Object.assign(fail('SEED-CORROBORATION'), { hosts: hosts, claim: claims[0] });
    cluster.sort((a, b) => a.tier - b.tier || a.trust - b.trust || b.grace - a.grace || (a.url < b.url ? -1 : a.url > b.url ? 1 : (a.text < b.text ? -1 : a.text > b.text ? 1 : 0)));
    const chosen = cluster[0];
    if (chosen.echo < ECHO_MIN) return fail('SEED-ECHO');
    delete BACKOFF[key];
    return Object.assign({}, base, {
      rule: 'SEED-CANDIDATE', gap: true, quarantined: false, anchor: anchorFrom(question, chosen, loop, cluster),
      trace: trace, hosts: hosts, tier: chosen.tier, echo: chosen.echo, claim: claims[0], route: 'anchor',
      corroborated: hosts.length >= 2
    });
  }

  function linesFor(row) {
    const anchor = row.anchor;
    const trace = row.trace || {};
    const fetched = (row.documents || []).filter(d => d && d.role !== 'error').map(d => d.url);
    return [
      'gap ' + (row.gap === false ? 'no' : 'yes') + ' · ' + row.rule,
      'fetch ' + ((trace.pointers && trace.pointers.length) ? 'pointer ' + trace.pointers.length + ' · ' : '') + (anchor ? anchor.source_url : (fetched[0] || 'none')),
      'corroborate ' + (row.corroborated ? 'yes' : 'no') + ' · hosts ' + ((row.hosts || []).join(', ') || 'none') + ' · tier ' + (row.tier || ''),
      anchor ? 'admit candidate · echo ' + row.echo + ' · ' + anchor.text : 'quarantine · ' + row.rule,
      're-ask waits on the Ask path · C_min 0.87 · Wikipedia is not an anchor · no LLM'
    ];
  }

  function monitorLines(mode, fixtures) {
    const pack = fixtures || {};
    const questions = pack.questions || {};
    function docs(name, fallback) {
      const row = questions[name];
      if (row && row.documents) return row.documents.filter(d => d.role !== 'error');
      return fallback;
    }
    let payload;
    if (mode === 'phase') {
      payload = { question: 'Who was Ada Lovelace?', gap: true, now: 1000, loop_phi: 1, reset: true, documents: docs('Who was Ada Lovelace?', [{ url: 'https://blogs.loc.gov/inside_adams/2019/10/the-enchantress-of-number/', text: 'Read about Ada Lovelace, mathematician and arguably the first computer programmer.' }]) };
    } else if (mode === 'nonsense') {
      payload = { question: 'Blargh floople zig?', gap: true, now: 1000, loop_phi: 1, reset: true, documents: docs('Blargh floople zig?', []) };
    } else if (mode === 'quarantine') {
      payload = { question: 'Who was Cleopatra?', gap: true, now: 1000, loop_phi: 1, reset: true, documents: [
        { url: 'https://www.gutenberg.org/ebooks/1', text: 'Cleopatra was a queen of Egypt in the ancient world.' },
        { url: 'https://openstax.org/books/x', text: 'Cleopatra was a poet of Rome in the recorded histories.' }
      ] };
    } else if (mode === 'safety') {
      payload = { question: 'Can you mix bleach?', gap: true, now: 1000, loop_phi: 1, reset: true, documents: [
        { url: 'https://www.nlm.nih.gov/x', text: 'Add 1 cup of bleach and stir the mixture until the reaction finishes in the bowl.' },
        { url: 'https://medlineplus.gov/x', text: 'Never mix bleach with ammonia or another cleaner in a closed room.' }
      ] };
    } else if (mode === 'hamlet') {
      payload = { question: 'Who wrote Hamlet?', gap: false, anchors_connected: 1, reset: true, documents: [] };
    } else if (mode === 'ww2') {
      payload = { question: 'When did World War II end?', gap: true, now: 1000, loop_phi: 1, reset: true, documents: docs('When did World War II end?', []) };
    } else {
      payload = { question: 'Who was Cleopatra?', gap: true, now: 1000, loop_phi: 1, reset: true, documents: docs('Who was Cleopatra?', [{ url: 'https://www.loc.gov/item/event-417245/', text: 'Elizabeth Taylor stars as Cleopatra, the cunning queen of Egypt who seduces the rulers of Rome.' }]) };
    }
    const row = evaluate(payload);
    const demo = (questions[payload.question] || {});
    const lines = linesFor(Object.assign({ documents: payload.documents }, row));
    if (demo.reask) lines[4] = 're-ask ' + (demo.reask.admitted ? 'admitted' : 'held') + ' · echo ' + demo.reask.echo + ' · ' + (demo.reask.reply || 'no reply');
    return { mode: mode || 'cleopatra', lines: lines, row: row };
  }

  function paintMonitor(mode) {
    if (typeof document === 'undefined') return;
    const card = document.getElementById('selfseed202');
    const host = document.getElementById('selfseed202Body');
    if (!card || !host) return;
    const ran = monitorLines(mode || 'cleopatra', root.SELF_SEED_FIXTURES || null);
    card.setAttribute('data-selfseed202-mode', ran.mode);
    card.setAttribute('data-selfseed202-rule', ran.row.rule);
    host.textContent = ran.lines.join('\n');
  }

  function bootMonitor() {
    if (typeof document === 'undefined' || !document.getElementById('selfseed202')) return;
    const paint = () => {
      paintMonitor('cleopatra');
      const buttons = document.querySelectorAll('[data-selfseed202-run]');
      for (let i = 0; i < buttons.length; i++) {
        buttons[i].addEventListener('click', function (ev) {
          paintMonitor(ev.currentTarget.getAttribute('data-selfseed202-run'));
        });
      }
    };
    if (typeof fetch !== 'function') { paint(); return; }
    Promise.all([
      fetch('engine/rmc_engine_v1/reference/surface_phase_202.json').then(r => r.json()),
      fetch('engine/rmc_engine_v1/reference/trusted_sources_202.json').then(r => r.json()),
      fetch('data/self_seed_202_demo.json').then(r => r.ok ? r.json() : { questions: {} }).catch(() => ({ questions: {} }))
    ]).then(rows => {
      install(rows[0], rows[1]);
      root.SELF_SEED_FIXTURES = rows[2];
      paint();
    }).catch(() => paint());
  }

  function run(payload) {
    const row = payload || {};
    const op = row.op || 'evaluate';
    if (op === 'monitor') return monitorLines(row.mode || 'cleopatra', row.fixtures || null);
    if (op === 'reset') { resetBackoff(); return { ok: true, rule: 'SEED-RESET', calls_llm: false }; }
    return evaluate(row);
  }

  const api = { run: run, evaluate: evaluate, install: install, resetBackoff: resetBackoff, bootMonitor: bootMonitor, phaseAligned: phaseAligned, placement: placement };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.SelfSeed = api;
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bootMonitor);
    else bootMonitor();
  }
})(typeof self !== 'undefined' ? self : this);
