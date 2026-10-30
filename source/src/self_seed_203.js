/* 4.9.203 reference-prose self-seeding. No model.
 * The decision matches rmc_engine_v1.self_seed_203.evaluate.
 * Slot, subject, and claim checks stay the 4.9.202 checks.
 * Wikipedia is a pointer. Two hosts corroborate or the row is quarantined. */
(function (root) {
  'use strict';
  const Seed202 = typeof require === 'function' ? require('./self_seed_202.js') : root.SelfSeed;
  const STOP = {
    the: 1, and: 1, for: 1, with: 1, from: 1, that: 1, this: 1, what: 1, which: 1, when: 1,
    where: 1, who: 1, whom: 1, why: 1, how: 1, are: 1, was: 1, were: 1, you: 1, your: 1,
    does: 1, did: 1, can: 1, could: 1, into: 1, about: 1, have: 1, has: 1, not: 1, but: 1
  };
  const C_MIN = 0.87, ECHO_MIN = 0.85, WRITE_MAX = 0.35, HARD_STOP = 0.8;
  const PI4 = Math.PI / 4, TAU = Math.PI * 2, BACKOFF_BASE = 60;
  let BACKOFF = {};
  let TABLE = null, BASE = null, EXTRA = null;

  function round6(n) { return Math.round(n * 1e6) / 1e6; }
  function sha256(text) {
    if (typeof require === 'function') return require('crypto').createHash('sha256').update(String(text), 'utf8').digest('hex');
    if (root.KSha && root.KSha.sha256) return root.KSha.sha256(String(text));
    return '';
  }
  function readJson(rel) {
    if (typeof require !== 'function') return null;
    const fs = require('fs'), path = require('path');
    return JSON.parse(fs.readFileSync(path.join(__dirname, '..', rel), 'utf8'));
  }
  function base() {
    if (!BASE) BASE = readJson('engine/rmc_engine_v1/reference/trusted_sources_202.json');
    return BASE;
  }
  function extra() {
    if (!EXTRA) EXTRA = readJson('engine/rmc_engine_v1/reference/trusted_sources_203.json');
    return EXTRA;
  }
  function table() {
    if (!TABLE) TABLE = readJson('engine/rmc_engine_v1/reference/surface_phase_202.json');
    return TABLE;
  }
  function install(tableDoc, baseDoc, extraDoc) {
    if (tableDoc) TABLE = tableDoc;
    if (baseDoc) BASE = baseDoc;
    if (extraDoc) EXTRA = extraDoc;
    if (tableDoc && Seed202 && Seed202.install) Seed202.install(tableDoc, null);
  }
  function resetBackoff() { BACKOFF = {}; }
  function questionKey(question) { return sha256(String(question || '').trim().toLowerCase()).slice(0, 16); }
  function hostOf(url) {
    let raw = String(url || '').trim();
    if (!raw) return '';
    if (raw.indexOf('://') < 0) raw = 'https://' + raw;
    let host = '';
    try { host = new URL(raw).hostname.toLowerCase(); } catch (e) { return ''; }
    if (host.indexOf('www.') === 0) host = host.slice(4);
    return host;
  }
  function mergedSources() {
    const rows = {};
    ((base() || {}).sources || []).forEach(row => { rows[row.host] = Object.assign({}, row); });
    ((extra() || {}).sources || []).forEach(row => {
      rows[row.host] = Object.assign({}, rows[row.host] || {}, row);
    });
    return Object.keys(rows).filter(Boolean).map(host => rows[host]).sort((a, b) => (a.trust || 99) - (b.trust || 99) || String(a.host).localeCompare(String(b.host)));
  }
  function sourceFor(url) {
    const host = hostOf(url);
    if (!host) return null;
    let best = null, bestLen = -1;
    mergedSources().forEach(row => {
      const mark = String(row.host || '');
      if (host === mark || host.slice(-(mark.length + 1)) === '.' + mark) {
        if (mark.length > bestLen) { best = row; bestLen = mark.length; }
      }
    });
    if (!best || best.anchor === false) return null;
    return best;
  }
  function isPointer(url) {
    const host = hostOf(url);
    return (((base() || {}).pointer_hosts) || []).some(mark => host === mark || host.slice(-(mark.length + 1)) === '.' + mark);
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
  function echoTokens(text) {
    const out = {};
    (String(text || '').toLowerCase().match(/[a-z0-9]+/g) || []).forEach(w => { if (w.length > 2 && !STOP[w]) out[w] = 1; });
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
    let plain = String(text || '').replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ');
    plain = plain.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/\s+/g, ' ').trim();
    const out = [];
    plain.split(/(?<=[.!?])\s+/).forEach(part => {
      const sentence = part.trim();
      if (sentence.length >= 35 && sentence.length <= 420) out.push(sentence);
    });
    return out.slice(0, 40);
  }
  function extractUrls(text) {
    const found = String(text || '').match(/https?:\/\/[^\s<>"']+/g) || [];
    const out = [], seen = {};
    found.forEach(url => {
      const clean = url.replace(/[).,;\]]+$/g, '');
      if (!seen[clean]) { seen[clean] = 1; out.push(clean); }
    });
    return out;
  }
  const ROMAN = { i: '1', ii: '2', iii: '3', iv: '4', v: '5', vi: '6', vii: '7', viii: '8', ix: '9' };
  const WORD_ORD = { first: '1', second: '2', third: '3', fourth: '4', fifth: '5' };
  const WH = { who: 1, whom: 1, whose: 1, what: 1, when: 1, where: 1, why: 1, how: 1, which: 1 };
  const ENTITY_STOP = { the: 1, and: 1, for: 1, with: 1, from: 1, that: 1, this: 1, was: 1, were: 1, are: 1, you: 1, your: 1, did: 1, does: 1, can: 1, could: 1, into: 1, about: 1, have: 1, has: 1, not: 1, but: 1 };
  function norm(text) { return (String(text || '').toLowerCase().match(/[a-z0-9]+/g) || []).join(' '); }
  function words(text) { return String(text || '').toLowerCase().match(/[a-z0-9]+/g) || []; }
  function questionSlot(question) {
    const list = words(question), head = list[0] || '', toks = echoTokens(question);
    if (toks.indexOf('happens') >= 0 || toks.indexOf('mix') >= 0) return 'effect';
    if (head === 'who' || head === 'whom') return 'identity';
    if (head === 'when') return 'time';
    if (head === 'what' || head === 'which') return 'identity';
    return 'stated';
  }
  function entityTokens(question, slot) {
    const roles = ((base() || {}).time_roles) || [];
    const out = [];
    words(question).forEach(word => {
      const keepShort = !!ROMAN[word] || !!WORD_ORD[word] || /^\d{1,2}$/.test(word);
      if (WH[word] || ENTITY_STOP[word]) return;
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
  function yearsOf(sentence) { return String(sentence || '').match(/\b(?:1[5-9]\d{2}|20\d{2})\b/g) || []; }
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
      const marks = (((base() || {}).effect_marks) || []).filter(mark => sentence.toLowerCase().indexOf(mark) >= 0).sort();
      if (!marks.length) return { ok: false, rule: 'SHAPE', slot: slot };
      return { ok: true, rule: 'SHAPE-FIT', slot: slot, claim: 'effect|' + ent + '|' + marks.join(',') };
    }
    return { ok: false, rule: 'SHAPE', slot: slot };
  }
  function safetyOf(question, sentence) {
    const cfg = base() || {};
    const toks = echoTokens(question);
    const mix = toks.indexOf('mix') >= 0 || String(question || '').toLowerCase().indexOf('mixing') >= 0;
    const low = sentence.toLowerCase();
    const procedure = (cfg.procedure_marks || []).some(mark => low.indexOf(mark) >= 0);
    const safety = (cfg.safety_marks || []).some(mark => low.indexOf(mark) >= 0);
    const quantity = /\b\d+\s*(cup|tbsp|tablespoon|teaspoon|ml|gram|grams)\b/.test(low);
    if (mix && (quantity || (procedure && !safety))) return { ok: false, rule: 'SAFETY-RECIPE' };
    return { ok: true, rule: mix && safety ? 'SAFETY-FACT' : 'SAFETY-PLAIN' };
  }
  function catalogUrl(url) {
    const low = String(url || '').toLowerCase();
    const hit = (((base() || {}).catalog_url_marks) || []).some(mark => low.indexOf(mark) >= 0);
    if (!hit) return false;
    return !(((extra() || {}).narrative_url_marks) || []).some(mark => low.indexOf(mark) >= 0);
  }
  function captionText(sentence) {
    const low = sentence.toLowerCase();
    return (((base() || {}).caption_marks) || []).some(mark => low.indexOf(mark) >= 0);
  }
  function ownEntry(doc, entity) {
    if (doc && Object.prototype.hasOwnProperty.call(doc, 'own_entry') && doc.own_entry !== null && doc.own_entry !== undefined) return !!doc.own_entry;
    const title = norm((doc && (doc.title || doc.entry)) || '');
    const ent = norm(entity.join(' '));
    if (!ent || !title) return false;
    return title === ent || title.indexOf(ent) >= 0 || ent.indexOf(title) >= 0;
  }
  function periodOf(title, doc) {
    if (doc && doc.period_year) return Number(doc.period_year);
    const low = String(title || '').toLowerCase();
    const marks = ((extra() || {}).period_marks) || [];
    for (let i = 0; i < marks.length; i++) {
      if (marks[i].mark && low.indexOf(String(marks[i].mark).toLowerCase()) >= 0) return Number(marks[i].year);
    }
    return null;
  }
  function forClaim(sentence, entity, own) {
    if (!own) return [sentence, false];
    const bits = String(sentence || '').split(' ');
    if (bits.length < 2) return [sentence, false];
    const head = bits[0].replace(/[.,;:"']/g, '').toLowerCase();
    const pronouns = ((extra() || {}).pronouns) || [];
    if (pronouns.indexOf(head) < 0) return [sentence, false];
    return [entity.join(' ') + ' ' + bits.slice(1).join(' '), true];
  }
  function roleWord(question) {
    const roles = ((base() || {}).time_roles) || [];
    let found = '';
    words(question).forEach(word => { if (roles.indexOf(word) >= 0) found = word; });
    return found;
  }
  function roleBinds(question, sentence) {
    const role = roleWord(question);
    if (!role) return true;
    const forms = (((extra() || {}).role_forms) || {})[role] || [role];
    const have = words(sentence);
    return forms.some(form => have.indexOf(form) >= 0);
  }
  function timeSensitive(question, slot, sentence, period) {
    const present = ((extra() || {}).present_marks) || [];
    if (words(question).some(word => present.indexOf(word) >= 0)) return true;
    if (!period) return false;
    if (slot === 'identity') return false;
    if (slot === 'time') {
      const years = yearsOf(sentence);
      if (years.length === 1 && Number(years[0]) <= Number(period)) return false;
      return true;
    }
    return true;
  }
  function safetyHost(src) {
    const hosts = ((extra() || {}).safety_hosts) || [];
    if (hosts.indexOf(src.host) >= 0) return true;
    return src.kind === 'government-safety';
  }
  function placement(text) {
    if (Seed202 && Seed202.placement) {
      if (table() && Seed202.install) Seed202.install(table(), null);
      return Seed202.placement(text);
    }
    return { phi: null, concept: null };
  }
  function anchorFrom(question, row, loop, support) {
    const digest = sha256(question + '\n' + row.text).slice(0, 18);
    const sfe = { Phi: row.phi, eps: 0, mu: 1 };
    const hosts = Array.from(new Set(support.map(item => item.host))).sort();
    return {
      id: 'self-' + digest,
      text: row.text,
      sfe: sfe,
      packet: {
        schema: 'FORGE-RESONANCE-PACKET/v1', Phi: sfe.Phi, eps: 0, mu: 1, sfe: sfe,
        placed_by: 'athena', standing: 'anchor',
        phi_basis: 'lexicon packet phase-aligned with the question loop', concept: row.concept
      },
      tier: 'anchor', state: 'anchor', trust: 'trusted',
      license: row.license, license_url: row.license_url, source_url: row.url,
      revision: String(row.sha256 || '').slice(0, 12),
      provenance: {
        source: row.host, source_url: row.url, license: row.license, license_url: row.license_url,
        fetched_at: row.fetched_at, content_sha256: row.sha256, asking_question: question,
        tier: row.tier, independent_hosts: hosts, slot: row.slot, claim: row.claim,
        lexicon_concept: row.concept, lexicon_phi: row.phi, question_loop: loop, delta: row.delta, echo: row.echo,
        wikipedia_anchor: false, contributor: 'self-seed:' + row.host,
        ingestion_note: 'Reference prose. Slot, subject, and claim checks are the 4.9.202 checks. Not a hand-written seed.',
        fetch_sha256: row.fetch_sha256 || row.sha256, period_year: row.period_year, stale: false,
        historical_date: row.slot === 'time', own_entry: !!row.own_entry, coreference: !!row.coreference,
        page_class: 'reference', title: row.title || ''
      },
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
  function emptyReason(kept, skipped) {
    const rules = {};
    skipped.forEach(row => { rules[row.rule] = 1; });
    const echoPass = kept.some(row => row.echo_pass);
    if (kept.length && !echoPass) return 'SEED-ECHO';
    if (rules.BIND && !kept.length) return 'SEED-BIND';
    if (rules.ROLE && !kept.length) return 'SEED-ROLE';
    if (rules.STALE && !kept.length) return 'SEED-STALE';
    if (rules.SHAPE && !kept.length) return 'SEED-SHAPE';
    if (rules.CATALOG && !kept.length) return 'SEED-CATALOG';
    if (rules['FORBIDDEN-5-8'] && !kept.length) return 'SEED-FORBIDDEN';
    if (rules.PHASE && !kept.length) return 'SEED-PHASE';
    if (rules['SAFETY-RECIPE'] && !kept.length) return 'SEED-SAFETY';
    if (rules['SAFETY-HOST'] && !kept.length) return 'SEED-SAFETY-HOST';
    return 'SEED-NO-SOURCE';
  }
  function evaluate(payload) {
    payload = payload || {};
    if (payload.reset === true) resetBackoff();
    const question = String(payload.question || '').trim();
    const now = Number(payload.now || 0);
    let loop = payload.loop_phi === undefined || payload.loop_phi === null || payload.loop_phi === '' ? 1 : Number(payload.loop_phi);
    if (!(loop >= 1 && loop <= 9)) loop = 1;
    const baseRow = {
      ok: true, build: '4.9.203', question: question, loop_phi: loop, calls_llm: false, network: false,
      money: false, dream_idle: false, economy: false, packs_gated: true, christping: 'gilligan-only',
      christping_started: false, wikipedia_anchor: false, resonance_not_parsing: true,
      coherence_formula_unchanged: true, c_min: C_MIN, echo_min: ECHO_MIN, write_max: WRITE_MAX,
      hard_stop: HARD_STOP, admit_gate: false, anchor: null, route: 'correction_queue'
    };
    if (!question) return Object.assign({}, baseRow, { ok: false, rule: 'SEED-EMPTY' });
    const gap = payload.gap;
    const connected = Number(payload.anchors_connected || 0);
    if (gap === false || ((gap === undefined || gap === null) && connected > 0)) {
      return Object.assign({}, baseRow, { rule: 'SEED-NOT-A-GAP', gap: false, anchors_connected: connected });
    }
    const key = questionKey(question);
    const held = BACKOFF[key];
    if (held && now + 1e-9 < held.next_at) {
      return Object.assign({}, baseRow, {
        rule: 'SEED-BACKOFF', gap: true, quarantined: true,
        backoff: { blocked: true, rule: 'SEED-BACKOFF', fails: held.fails, next_at: held.next_at, wait: Math.round((held.next_at - now) * 1000) / 1000 }
      });
    }
    const slot = questionSlot(question);
    const entity = entityTokens(question, slot);
    const kept = [], skipped = [], pointers = [];
    (payload.documents || []).forEach(doc => {
      if (!doc) return;
      const url = String(doc.url || '');
      const text = String(doc.text || '');
      if (doc.sha256 && doc.sha256 !== sha256(text)) { skipped.push({ url: url, rule: 'INTEGRITY' }); return; }
      if (isPointer(url) || doc.role === 'pointer') {
        extractUrls(text).forEach(found => { if (sourceFor(found) && !isPointer(found)) pointers.push(found); });
        skipped.push({ url: url, rule: 'WIKIPEDIA-POINTER' });
        return;
      }
      const src = sourceFor(url);
      if (!src) { skipped.push({ url: url, rule: 'NOT-ALLOWLISTED' }); return; }
      if (catalogUrl(url)) { skipped.push({ url: url, rule: 'CATALOG' }); return; }
      const own = ownEntry(doc, entity);
      const period = periodOf(String(doc.title || ''), doc);
      const digest = String(doc.sha256 || sha256(text));
      const fetched = String(doc.fetched_at || '');
      splitSentences(text).forEach(sentence => {
        if (captionText(sentence)) { skipped.push({ url: url, rule: 'CATALOG', text: sentence.slice(0, 180) }); return; }
        const placed = placement(sentence);
        const phi = placed.phi;
        if (typeof phi === 'number' && Number(loop) === 5 && Number(phi) === 8) {
          skipped.push({ url: url, rule: 'FORBIDDEN-5-8', phi: phi, loop: loop });
          return;
        }
        if (typeof phi !== 'number' || !phaseAligned(loop, phi)) {
          skipped.push({ url: url, rule: 'PHASE', phi: phi, loop: loop });
          return;
        }
        const safe = safetyOf(question, sentence);
        if (!safe.ok) { skipped.push({ url: url, rule: safe.rule, text: sentence.slice(0, 180) }); return; }
        if (slot === 'effect' && !safetyHost(src)) { skipped.push({ url: url, rule: 'SAFETY-HOST', text: sentence.slice(0, 180) }); return; }
        const resolved = forClaim(sentence, entity, own);
        const fit = claimOf(question, resolved[0]);
        if (!fit || !fit.ok) { skipped.push({ url: url, rule: (fit && fit.rule) || 'SHAPE', text: sentence.slice(0, 180) }); return; }
        if (slot === 'time' && !roleBinds(question, sentence)) { skipped.push({ url: url, rule: 'ROLE', text: sentence.slice(0, 180) }); return; }
        if (timeSensitive(question, fit.slot || slot, sentence, period)) {
          skipped.push({ url: url, rule: 'STALE', text: sentence.slice(0, 180), period_year: period });
          return;
        }
        const echo = echoScore(question, sentence);
        kept.push({
          text: sentence, url: url, host: String(src.host), tier: Number(src.tier), trust: Number(src.trust),
          license: src.license, license_url: src.license_url, phi: phi, concept: placed.concept,
          grace: round6(Math.cos(circularDelta(loop, phi)) ** 2), delta: round6(circularDelta(loop, phi)),
          echo: echo, echo_pass: echo >= ECHO_MIN, sha256: digest, fetched_at: fetched,
          fetch_sha256: String(doc.fetch_sha256 || digest), safety: safe.rule, slot: fit.slot, claim: fit.claim,
          page_class: 'reference', own_entry: own, coreference: resolved[1], period_year: period, stale: false,
          title: String(doc.title || '')
        });
      });
    });
    const passing = kept.filter(row => row.echo_pass && row.claim);
    const groups = {};
    passing.forEach(row => { (groups[row.claim] = groups[row.claim] || []).push(row); });
    const skipRules = {};
    skipped.forEach(row => { skipRules[row.rule] = (skipRules[row.rule] || 0) + 1; });
    const phases = Array.from(new Set(kept.map(row => row.phi))).sort((a, b) => a - b);
    const trace = { kept: kept.length, echo_pass: passing.length, clusters: Object.keys(groups).length, pointers: pointers.slice(0, 12), skipped: skipped.slice(0, 24), skip_rules: skipRules, phases: phases };
    const claims = Object.keys(groups);
    if (claims.length > 1) return Object.assign({}, baseRow, { rule: 'SEED-DISAGREEMENT', gap: true, quarantined: true, trace: trace, backoff: remember(question, now, 'SEED-DISAGREEMENT'), route: 'correction_queue' });
    if (!claims.length) {
      const reason = emptyReason(kept, skipped);
      return Object.assign({}, baseRow, { rule: reason, gap: true, quarantined: true, trace: trace, backoff: remember(question, now, reason) });
    }
    const cluster = groups[claims[0]];
    const hosts = Array.from(new Set(cluster.map(row => row.host))).sort();
    if (hosts.length < 2) return Object.assign({}, baseRow, { rule: 'SEED-CORROBORATION', gap: true, quarantined: true, trace: trace, backoff: remember(question, now, 'SEED-CORROBORATION'), hosts: hosts, claim: claims[0] });
    cluster.sort((a, b) => a.tier - b.tier || a.trust - b.trust || b.grace - a.grace || (a.url < b.url ? -1 : a.url > b.url ? 1 : (a.text < b.text ? -1 : a.text > b.text ? 1 : 0)));
    const chosen = cluster[0];
    if (chosen.echo < ECHO_MIN) return Object.assign({}, baseRow, { rule: 'SEED-ECHO', gap: true, quarantined: true, trace: trace, backoff: remember(question, now, 'SEED-ECHO') });
    delete BACKOFF[key];
    return Object.assign({}, baseRow, {
      rule: 'SEED-CANDIDATE', gap: true, quarantined: false, anchor: anchorFrom(question, chosen, loop, cluster),
      trace: trace, hosts: hosts, tier: chosen.tier, echo: chosen.echo, claim: claims[0], route: 'anchor',
      corroborated: hosts.length >= 2, period_year: chosen.period_year, stale: false
    });
  }

  function linesFor(row) {
    const anchor = row.anchor;
    const trace = row.trace || {};
    return [
      'gap ' + (row.gap === false ? 'no' : 'yes') + ' · ' + row.rule,
      'hosts ' + ((row.hosts || []).join(', ') || 'none') + ' · pointers ' + ((trace.pointers || []).length),
      'corroborate ' + (row.corroborated ? 'yes' : 'no') + ' · stale ' + (row.stale === false ? 'no' : (row.rule === 'SEED-STALE' ? 'yes' : 'n/a')),
      anchor ? 'candidate · echo ' + row.echo + ' · ' + anchor.text : 'quarantine · ' + row.rule,
      'C_min 0.87 · two hosts · Wikipedia is not an anchor · no LLM'
    ];
  }
  function monitorLines(mode) {
    const shared = 'Cleopatra was a queen of Egypt in the ancient world.';
    let payload;
    if (mode === 'coref') {
      payload = { question: 'Who was Cleopatra?', gap: true, now: 1000, loop_phi: 1, reset: true, documents: [
        { url: 'https://www.gutenberg.org/ebooks/1', title: 'Cleopatra', own_entry: true, text: 'She was a queen of Egypt in the ancient world and Cleopatra ruled the Nile.' },
        { url: 'https://openstax.org/books/x', title: 'Cleopatra', own_entry: true, text: 'She was a queen of Egypt in the ancient world and Cleopatra ruled the Nile.' }
      ] };
    } else if (mode === 'outside') {
      payload = { question: 'Who was Cleopatra?', gap: true, now: 1000, loop_phi: 1, reset: true, documents: [
        { url: 'https://www.gutenberg.org/ebooks/1', title: 'Rome', own_entry: false, text: 'She was a queen of Egypt in the ancient world and Cleopatra ruled the Nile.' }
      ] };
    } else if (mode === 'stale') {
      payload = { question: 'When did World War II end?', gap: true, now: 1000, loop_phi: 1, reset: true, documents: [
        { url: 'https://www.gutenberg.org/ebooks/9', title: 'Encyclopaedia Britannica 11th Edition', period_year: 1911, text: 'World War II ended in 1945 after the recorded surrender.' },
        { url: 'https://history.state.gov/ww2', title: 'Office of the Historian', period_year: 1911, text: 'World War II ended in 1945 after the recorded surrender.' }
      ] };
    } else if (mode === 'catalog') {
      payload = { question: 'Who was Cleopatra?', gap: true, now: 1000, loop_phi: 1, reset: true, documents: [
        { url: 'http://www.loc.gov/item/2004675107/', text: 'DeMille\'s Cleopatra" showing headshots of stars Claudette Colbert, Warren William, and Henry Wilcoxon.' }
      ] };
    } else if (mode === 'safety') {
      payload = { question: 'What happens if you mix bleach and ammonia?', gap: true, now: 1000, loop_phi: 1, reset: true, documents: [
        { url: 'https://www.nlm.nih.gov/x', text: 'Add 1 cup of ammonia and stir the mixture until the reaction finishes in the bowl today.' },
        { url: 'https://www.cdc.gov/x', text: 'What happens if you mix bleach and ammonia produces toxic chloramine gas in a closed room.' },
        { url: 'https://medlineplus.gov/y', text: 'What happens if you mix bleach and ammonia produces toxic chloramine gas in a closed room.' }
      ] };
    } else if (mode === 'held') {
      payload = { question: 'Blargh floople zig?', gap: true, now: 1000, loop_phi: 1, reset: true, documents: [] };
    } else {
      payload = { question: 'Who was Cleopatra?', gap: true, now: 1000, loop_phi: 1, reset: true, documents: [
        { url: 'https://www.gutenberg.org/ebooks/1', title: 'Cleopatra', text: shared },
        { url: 'https://openstax.org/books/x', title: 'Cleopatra', text: shared }
      ] };
    }
    const row = evaluate(payload);
    return { mode: mode || 'agree', lines: linesFor(row), row: row };
  }
  function paintMonitor(mode) {
    if (typeof document === 'undefined') return;
    const card = document.getElementById('selfseed203');
    const host = document.getElementById('selfseed203Body');
    if (!card || !host) return;
    const ran = monitorLines(mode || 'agree');
    card.setAttribute('data-selfseed203-mode', ran.mode);
    card.setAttribute('data-selfseed203-rule', ran.row.rule);
    host.textContent = ran.lines.join('\n');
  }
  function bootMonitor() {
    if (typeof document === 'undefined' || !document.getElementById('selfseed203')) return;
    const paint = () => {
      paintMonitor('agree');
      const buttons = document.querySelectorAll('[data-selfseed203-run]');
      for (let i = 0; i < buttons.length; i++) {
        buttons[i].addEventListener('click', function (ev) {
          paintMonitor(ev.currentTarget.getAttribute('data-selfseed203-run'));
        });
      }
    };
    if (typeof fetch !== 'function') { paint(); return; }
    Promise.all([
      fetch('engine/rmc_engine_v1/reference/surface_phase_202.json').then(r => r.json()),
      fetch('engine/rmc_engine_v1/reference/trusted_sources_202.json').then(r => r.json()),
      fetch('engine/rmc_engine_v1/reference/trusted_sources_203.json').then(r => r.json()),
      fetch('data/chat_act_203.json').then(r => r.ok ? r.json() : {}).catch(() => ({}))
    ]).then(rows => {
      install(rows[0], rows[1], rows[2]);
      paint();
      const host = document.getElementById('chatAct203');
      const acts = rows[3] && rows[3].acts;
      if (host && acts) {
        host.textContent = acts.map(row => row.question + ' → ' + (row.reply || 'held')).join('\n');
      }
    }).catch(() => paint());
  }
  const api = { evaluate: evaluate, install: install, resetBackoff: resetBackoff, bootMonitor: bootMonitor, monitorLines: monitorLines };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.SelfSeed203 = api;
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bootMonitor);
    else bootMonitor();
  }
})(typeof self !== 'undefined' ? self : this);
