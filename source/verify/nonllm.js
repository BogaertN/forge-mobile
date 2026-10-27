/* Doc 9 class NON-LLM SCAN. One file list and one pattern list.
 * verify/run.js and the release receipt both call scan(). */
const fs = require('fs'), path = require('path');
const FILES = ['src/kernel.js', 'src/grammar.js', 'src/derive.js', 'src/reason.js', 'src/algebra.js', 'src/kmath.js', 'src/lexicon.js', 'src/sha256.js', 'src/infer.js', 'src/selfmodel.js', 'src/forge_spine.js', 'src/forge.js', 'src/app.js', 'sw.js', 'index.html'];
const BANNED = [['network: XMLHttpRequest', /XMLHttpRequest/], ['network: WebSocket', /WebSocket/], ['network: EventSource', /EventSource/], ['network: sendBeacon', /sendBeacon/], ['LLM vendor/API names', /openai|anthropic|api\.x\.ai|huggingface|gemini|ollama|llama|mistral|completions/i], ['embeddings / similarity', /embedding|cosine|similarity\(|word2vec|vectoriz/i], ['randomness', /Math\.random|crypto\.getRandomValues/], ['dynamic code', /\beval\(|new Function\(|import\(/], ['statistics as authority (4.9.37: no frequency / edit-distance / n-gram path in the language core; UG substrate decides)', /levenshtein|editDistance|damerau|\bn-?grams?\b|bigram|trigram|frequenc|probabilit|corpusCount|wordFreq/i], ['model files', /\.onnx|\.gguf|\.safetensors|tensorflow|tfjs|wasm/i]];
function scanSource(name, src) {
  const code = String(src).replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  const checks = [];
  for (const [n, re] of BANNED) { const m = code.match(re); checks.push({ name: name + ': no ' + n, ok: !m, detail: m ? 'found ' + m[0] : '' }); }
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
module.exports = { FILES: FILES, BANNED: BANNED, scanSource: scanSource, scan: scan };
