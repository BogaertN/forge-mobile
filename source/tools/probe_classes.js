/* 4.9.83: regrade a live-probe JSONL with the answer-part verdict and assign every failure a CLASS (never a per-question label).
 * usage: node tools/probe_classes.js <probe.tsv> <run.jsonl>...   Classes:
 *  a SUBJ-PARTICIPLE  "how are X made" style subject glued to its participle (SUBJECT_MISMATCH)
 *  b TOKEN-ALNUM      letters+digits in the question and SUBJECT_MISMATCH
 *  e SUBJ-CLAUSE      do-support / adjective-predicate subject (SUBJECT_MISMATCH)
 *  c GUARD-STRICT     any other SUBJECT_MISMATCH (aliases, redirects, word forms not tried)
 *  f WRONG-SENSE      an answer about another thing with the same name (film, album, book, other country) or an off-subject sentence
 *  g RELATION-UNFILLED the source is on topic but no sentence fills the asked relation (why / how / cause / when / who)
 *  h VERBATIM-ONLY    the right claim was found but refused for lack of a verbatim span ("Unsupported: …")
 *  i PARSE            no frame / clarify readings / unknown word before any lookup
 *  t TIMEOUT/ERROR    tool timeout or network error */
const fs = require('fs');
const tsv = process.argv[2], files = process.argv.slice(3);
const exp = {}; for (const l of fs.readFileSync(tsv, 'utf8').split('\n')) { if (!l.trim() || l.startsWith('#')) continue; const [cat, q, e] = l.split('\t'); exp[q] = new RegExp(e, 'i'); }
const answerPart = r => String(r).split(/\s(?=The source(?:s)? |It comes from |I checked |The provenance |The class is )/)[0];
const BAD = /SUBJECT_MISMATCH|ABOVE_DRIFT_BAND|drift of every source|no passage answered|does not (?:state|support)|not supported|unsupported|could not attach|found no (?:verb|subject)|no stored fact|cannot confirm|I do not know the word|no result|failed|not authorized/i;
const classOf = r => { const q = r.q, rep = String(r.reply || ''), ans = answerPart(rep);
  if (r.error || r.timeout) return 't';
  if (/SUBJECT_MISMATCH|drift of every source/.test(rep) || /SUBJECT_MISMATCH|ABOVE_DRIFT_BAND/.test(r.block || '')) { if (/\d/.test(q)) return 'b'; if (/^(how|why|when|where)\s+(is|are|was|were)\s.+\s\w+(ed|en|wn)\??$/i.test(q)) return 'a'; if (/^(how|why|when|where|what)\s+(do|does|did)\s/i.test(q) || /^(why)\s+(is|are)\s/i.test(q)) return 'e'; return 'c'; }
  if (/could not attach|I find \d+ readings|I do not know the word/i.test(rep) || /no_frame|clarify/.test(r.kind || '')) return 'i';
  if (/Unsupported:/.test(ans)) return 'h';
  if (/no passage answered/i.test(ans) || /^(how|why)\b|^what (causes|caused)\b/i.test(q)) return 'g';
  return 'f'; };
let pass = 0, tot = 0; const by = {}, cat = {}, ex = {};
for (const f of files) for (const l of fs.readFileSync(f, 'utf8').split('\n').filter(Boolean)) { const r = JSON.parse(l); tot++; const ans = answerPart(r.reply || '');
  const ok = !r.error && !r.timeout && !BAD.test(ans) && !!exp[r.q] && exp[r.q].test(ans); cat[r.cat] = cat[r.cat] || [0, 0]; cat[r.cat][1]++;
  if (ok) { pass++; cat[r.cat][0]++; continue; } const k = classOf(r); by[k] = (by[k] || 0) + 1; }
console.log(JSON.stringify({ passed: pass, total: tot, rate: tot ? +(pass / tot).toFixed(3) : 0, failures_by_class: by, by_category: cat }));
