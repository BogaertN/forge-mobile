/* Symbol index (mobile plan: GitHub read via vault token + symbol index). Deterministic regex extraction per language;
 * no execution, no model. Index rows: { repo, path, line, name, kind, lang }. Query is exact (case-sensitive, then case-insensitive). */
(function (root) {
'use strict';
const LANG = [[/\.py$/, 'python'], [/\.(m?js|cjs|jsx)$/, 'javascript'], [/\.tsx?$/, 'typescript'], [/\.go$/, 'go'], [/\.rs$/, 'rust'], [/\.(java|kt)$/, 'jvm'], [/\.(c|h|cc|cpp|hpp)$/, 'c'], [/\.sh$/, 'shell'], [/\.md$/, 'markdown']];
const RULES = {
  python: [[/^\s*(?:async\s+)?def\s+([A-Za-z_]\w*)\s*\(/, 'function'], [/^\s*class\s+([A-Za-z_]\w*)/, 'class'], [/^([A-Z][A-Z0-9_]{2,})\s*(?::[^=]+)?=/, 'constant']],
  javascript: [[/^\s*(?:export\s+)?(?:async\s+)?function\s*\*?\s*([A-Za-z_$][\w$]*)\s*\(/, 'function'], [/^\s*(?:export\s+)?class\s+([A-Za-z_$][\w$]*)/, 'class'], [/^\s*(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:function|\([^)]*\)\s*=>|[A-Za-z_$][\w$]*\s*=>)/, 'function'], [/^\s{0,4}([A-Za-z_$][\w$]*)\s*\([^)]*\)\s*\{\s*$/, 'method']],
  typescript: null, go: [[/^func\s+(?:\([^)]*\)\s*)?([A-Za-z_]\w*)\s*\(/, 'function'], [/^type\s+([A-Za-z_]\w*)\s+(?:struct|interface)/, 'type']],
  rust: [[/^\s*(?:pub(?:\([^)]*\))?\s+)?fn\s+([A-Za-z_]\w*)/, 'function'], [/^\s*(?:pub\s+)?(?:struct|enum|trait)\s+([A-Za-z_]\w*)/, 'type']],
  jvm: [[/^\s*(?:public|private|protected)?\s*(?:static\s+)?(?:final\s+)?class\s+([A-Za-z_]\w*)/, 'class']], c: [[/^[A-Za-z_][\w\s\*]*\s\**([A-Za-z_]\w*)\s*\([^;]*\)\s*\{?\s*$/, 'function']],
  shell: [[/^\s*(?:function\s+)?([A-Za-z_][\w-]*)\s*\(\)\s*\{/, 'function']], markdown: [[/^#{1,3}\s+(.{1,80})$/, 'heading']] };
RULES.typescript = RULES.javascript.concat([[/^\s*(?:export\s+)?(?:interface|type)\s+([A-Za-z_$][\w$]*)/, 'type']]);
const langOf = p => { const m = LANG.find(([re]) => re.test(p)); return m ? m[1] : null; };
const KEYWORDS = new Set(['if', 'for', 'while', 'switch', 'catch', 'return', 'function', 'else']);
function extract(repo, path, text) { const lang = langOf(path); if (!lang) return []; const out = []; const lines = String(text).split('\n');
  for (let i = 0; i < lines.length && i < 20000; i++) for (const [re, kind] of RULES[lang]) { const m = lines[i].match(re); if (m && !KEYWORDS.has(m[1])) { out.push({ repo, path, line: i + 1, name: m[1].trim(), kind, lang }); break; } }
  return out; }
function find(index, name) { const n = String(name || '').trim(); let hits = index.filter(r => r.name === n); if (!hits.length) hits = index.filter(r => r.name.toLowerCase() === n.toLowerCase()); return hits.slice(0, 12); }
const pickFiles = (paths, max) => paths.filter(p => langOf(p) && langOf(p) !== 'markdown' && !/(^|\/)(node_modules|vendor|dist|build|backups?|\.git)\//.test(p)).sort((a, b) => a.split('/').length - b.split('/').length || (a < b ? -1 : 1)).slice(0, max || 40);
const api = { extract, find, langOf, pickFiles, RULES };
if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.KSymbols = api;
})(typeof self !== 'undefined' ? self : this);
