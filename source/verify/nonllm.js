/* Doc 9 class NON-LLM SCAN. One file list and one pattern list.
 * verify/run.js and the release receipt both call scan(). */
const fs = require('fs'), path = require('path');
const FILES = ['src/kernel.js', 'src/grammar.js', 'src/derive.js', 'src/reason.js', 'src/algebra.js', 'src/kmath.js', 'src/lexicon.js', 'src/sha256.js', 'src/infer.js', 'src/selfmodel.js', 'src/forge_spine.js', 'src/forge.js', 'src/app.js', 'sw.js', 'index.html'];
const BANNED = [['network: XMLHttpRequest', /XMLHttpRequest/], ['network: WebSocket', /WebSocket/], ['network: EventSource', /EventSource/], ['network: sendBeacon', /sendBeacon/], ['LLM vendor/API names', /openai|anthropic|api\.x\.ai|huggingface|gemini|ollama|llama|mistral|completions/i], ['embeddings / similarity', /embedding|cosine|similarity\(|word2vec|vectoriz/i], ['randomness', /Math\.random|crypto\.getRandomValues/], ['dynamic code', /\beval\(|new Function\(|import\(/], ['statistics as authority (4.9.37: no frequency / edit-distance / n-gram path in the language core; UG substrate decides)', /levenshtein|editDistance|damerau|\bn-?grams?\b|bigram|trigram|frequenc|probabilit|corpusCount|wordFreq/i], ['model files', /\.onnx|\.gguf|\.safetensors|tensorflow|tfjs|\.wasm\b/i]];
// 4.9.204 deploy repair: "frequency" in 4.9.203/4.9.204 means an oscillator frequency in hertz (the 144 Hz phase ladder), not a
// word or n-gram count. The page shell (index.html) and the service-worker precache list (sw.js) name those modules and their cards.
// Only these exact strings, and only in those two shell files, are lifted before the statistics check. Every language-core source
// file keeps the full ban, and any other "frequenc" string in the shell files still fails. See CONFLICTS.md v4.9.204 deploy repair.
const HERTZ_SHELL_FILES = ['index.html', 'sw.js'];
const HERTZ_SENSE = [/(?:\.\/)?src\/frequency_20[34]\.js\b/g, /(?:\.\/)?data\/frequency_20[34]_proof\.json\b/g, /Phase \+ frequency(?= <span class="pill">4\.9\.203<)/g, /adds a decimal frequency signature\. The 144 Hz slot/g, /frequencies within ε=0\.02 of the band marker/g, /Loading the frequency signature\./g, /Frequency tuning(?= <span class="pill">4\.9\.204<)/g, /Only frequency offsets move\. The 144 Hz glyph master/g];
const STATS = BANNED.find(b => /^statistics as authority/.test(b[0]))[1];
function scanSource(name, src) {
  const code = String(src).replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  const hz = HERTZ_SHELL_FILES.includes(name) ? HERTZ_SENSE.reduce((t, re) => t.replace(re, ' '), code) : code;
  const checks = [];
  for (const [n, re] of BANNED) { const m = (re === STATS ? hz : code).match(re); checks.push({ name: name + ': no ' + n, ok: !m, detail: m ? 'found ' + m[0] : '' }); }
  const calls = [...String(src).matchAll(/fetch\(([^)]*)\)/g)].map(m => m[1]);
  const bad = calls.filter(a => /https?:|\/\//.test(a));
  checks.push({ name: name + ': every fetch() targets a local relative path', ok: bad.length === 0, detail: bad.join(' | ') });
  return checks;
}
function scan(root) {
  const files = FILES.filter(f => fs.existsSync(path.join(root, f)));
  const checks = files.flatMap(f => scanSource(f, fs.readFileSync(path.join(root, f), 'utf8')));
  let release = '';
  try { release = fs.readFileSync(path.join(root, 'VERSION'), 'utf8').trim(); } catch (e) { release = ''; }
  return { schema: 'FORGE-NONLLM-RECEIPT/v1', release: release, same_scan_as: 'NON-LLM SCAN', files: files, checks: checks, ok: checks.every(c => c.ok) };
}
module.exports = { FILES: FILES, BANNED: BANNED, HERTZ_SHELL_FILES: HERTZ_SHELL_FILES, HERTZ_SENSE: HERTZ_SENSE, scanSource: scanSource, scan: scan };
