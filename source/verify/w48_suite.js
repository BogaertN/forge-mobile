/* W48 — robust parsing, generated partial replies, the self-model (4.9.48).
 * The hand-invented stress sentences used to test this release are NOT stored here or anywhere in the code: only their SHA-256 digests are kept, and the
 * first check proves no word window of the shipped source equals any of them. The remaining checks generate their own random sentences from the
 * lexicon (seeded), so no test sentence is a fixture either. */
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const ROOT = path.join(__dirname, '..');
const KMOD = require(ROOT + '/src/kernel.js'), G = require(ROOT + '/src/grammar.js'), SM = require(ROOT + '/src/selfmodel.js');
const LEX = require(ROOT + '/data/lexicon.json'), EXT = require(ROOT + '/data/lexicon-ext.json');
const rows = [], tests = []; const T = (name, fn) => tests.push({ name, fn }); const expect = (x, why) => { if (!x) throw new Error(why || 'expectation failed'); };
const open = () => KMOD.Kernel({ lexicon: LEX, lexiconExt: EXT, clock: () => '2026-10-16T00:00:00Z' });
const CANNED = /could not derive a sentence structure|Type “help” for a list|for a list of supported forms/i;
const norm = s => s.toLowerCase().replace(/[^a-z' ]+/g, ' ').replace(/\s+/g, ' ').trim();
const sha = s => crypto.createHash('sha256').update(s).digest('hex');
const SHIPPED = () => fs.readdirSync(path.join(ROOT, 'src')).filter(f => f.endsWith('.js')).map(f => 'src/' + f).concat(['index.html', 'sw.js']);
/* digests of the 52 hand-invented stress sentences (normalised: lower case, letters / apostrophes, single spaces) */
const STRESS = new Set(["a0b20e1966b24ea176841942834f68e1fcd346aa824d3d539e80255d299cad90","9430d3a3e3c2fd067faf582d26cb23906c2148ddc7c75056f421e06dd4def73c","66a5193d1dd2ec5bbd7b3891e9ffd12f43f92f6fe67fdc0268cda019be4c397c","0d5c446ac8bb5f1e214d78a14f034dcb7ddb540b8d9b1847b6bd26d2b6ff7d8d","ba16f4e98e5b05eb53f1221f26ce8d8a0ada127cb800b19a096a9c0611ddda79","0329d41aa4f9d2efd100101af7fbe2ceda7ee7706223927acc1ba5585c52a238","0fe6641e4f5ba7b18467f3fb804bd5dc524b77e2bd007084f640789f97f3b270","5e20622e5dfad6c09e54dff247e33a9296bf209779ba8eae4beb612956453d47","62dc47a726f74ab9f9dcd2625da985b1badb2ad23aea0f0878d01d3043add4cb","b8f820fb0861ad0ccee75afef816628e32735cd733c85577aa276c3ebd9ef6e0","d9e8f57610dbe538740c1f40fd138b8b4099516615d342b869e5f98feeb778b7","dc88b6b592c8b58f4454264f1c267cd92e5382043466a58affe6f68174f3c929","13bf54a066a9211ed6b386aa330150e23d7c151375f605844a3b119b00d1b7fb","a44de2040f4a7d03acd7cffae95a365aa3b9878423546c31c828f55cb742e3b2","d8f4964634e0938a2004481a9bd59426afcc47825936d4a108562489a355619a","074a7c72c1939f4ba3f77107448ec5614b095697c2e47a0afe3b494d9b399019","98df9f15eec05bad6e8cad7494f739e7f14b9d29841ed8b50984d66fef8bfecd","8d28e2d9c9998334f334971fed61f079a9118fa4f1b19ea1bb983ac44080fcba","7e5b15d5d880d88c2b4de6b35b9e3d1f218653b6c69869b79713e042f77d2912","c4d44a96734720c92447361b1aaff55e9cd5fc378f601985804b97713e0aeec2","c6c63b881f957ce394b1d2cbdd2c430c16b73a23de87a400b0a068c13244d02f","4ccc5e3f3956c46fb30334b51d5b39164464674b76c036cc540d1d4409d5e222","7d39229e13da53730e8ef6dcceecae118e4de9ba88f6081dfff700e8f66e9d55","522e6c592a34b13781783bfb47dcdd83c596c306ed012bea728de27185d09924","7740765f9460a99855f23d3db0514b7a7febe0b3293fa15ca9228f5fd5260676","02062c601741449baaa82b6458546138b4caf5230ce0c0aa1e49b311353eb023","1283d0cd7e782079bb2942e39361eef5f647a7079765d2696771947b05142112","0486bd38c37b67abf13efabedd284139b49b34d9734fd309dfd8d5d38d435348","fbaa99e3704273cb70d89607e9bffd2bca3a3c45c78c6c6b30d9df69fb0451a5","b836883e1b9d69fc157e60f9765ea8f8a4c9f9de7af99e0e4a7ec52cd8b97df7","3062982e384fb9f411a813e6b413cf18f699bfd6fb549d64826f1c375ff8369c","32f75173968813bdcff1cf78fba71c97245e0ea4d9d8029d256fe81298dbbae4","ff3a0ba2211a2843fffd70a8a699c7cf2b6b330b67054fdefab779c22a2d44e8","1f3ecd2ba25aa98ed488468f485861bc50026eab4ac6dccbb40f405f0803c07c","024a2e87df6db4c404e3bdb29e894f162809d6e60f2459fa56be8cbf1b346c01","39500ab8f4c0de5a2e5eeb0b53d0ea208db1068921b5cd15caf1a17a0b3692eb","9dddc007047c17a7851bb7d90d744f00a3ef49d4b13fe296c695cc40b70a2400","934d2de3c8266c3a45c725739aec547c7098b502b0fc552384aa5002e867cf13","b65609a3ff34166dd65c7957148107838004d103fd23461bf3a7de066d25e4c0","5cf93fee26827838b690b3272e24ee01e71d964ac33dd5f2cf77f304a5c97808","3a25fd16adecba8e8dae4e73de2bb2b84009f303b5ad6eb3853118003085392f","e9efc1f4cb9dd7895eb90b7250b47d01e0cff0bf35b26c87b6d5f409f1b5e09d","9f228a20253a071ccef22be6a0de9e737a485b912f134d84f6d647ee3d4f983e","be199f61d140538a1804734fd3a5a0e992c00fae553e9284faa686c3384f2ae8","b00f4ca5ae0d1099ab7b35f464bec1ce1cca31c14f81b79ff1f72d2a22daabdd","c40a6a42b082307898e6582ace9896c480199f396d742c46bf82429e25bd6e15","96136924e54d2077eed3013b3e52f7e5f7306fff50bb85e85b805beca9a6c3ed","c09dbe6a0f3b56585eba16d30aafbd27bd6905ee418a641f341a878d30d5fc61","625bb2d36c6c851cb9637e14cf5b8a6d76f0c35ed3622523c128eeef008d41ab","f07c6f3c69de701a31022b928dfacad47071e00a0916fca9924b5dccc535835e","b9eadd7251d4475e46fca781b4e4b6655437cdbe2372d1584953ef36c970190b","c1fdafb5f63ea3271f170dced26150a631b7d825021083d23be341100c3c756c"]);
T('W48 stress sentences are not stored in the shipped source (no word window of any shipped file hashes to one of the 52 digests)', () => {
  expect(STRESS.size >= 40, 'fewer than 40 stress digests'); const words = norm(SHIPPED().map(f => fs.readFileSync(path.join(ROOT, f), 'utf8')).join('\n')).split(' ');
  const hits = []; for (let L = 1; L <= 12; L++) for (let i = 0; i + L <= words.length; i++) { const w = words.slice(i, i + L).join(' '); if (STRESS.has(sha(w))) hits.push(w); }
  expect(!hits.length, 'stored stress sentence(s): ' + hits.slice(0, 3).join(' | ')); });
/* seeded generator over lexicon classes (WordNet core): nouns, adjectives, verbs by frame / lexicographer class */
function rng(seed) { let x = seed >>> 0; return () => { x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; x >>>= 0; return x / 4294967296; }; }
const LN = LEX.meta.lexnames; const pos = (w, p) => (LEX.L[w] || []).find(e => e[0] === p);
const simple = w => /^[a-z]{3,9}$/.test(w) && !G.CL[w];
const only = (w, p) => simple(w) && (LEX.L[w] || []).length === 1 && pos(w, p);
const words = Object.keys(LEX.L);
const NOUNS = words.filter(w => only(w, 'n') && /^noun\.(artifact|object|animal|food|plant|location)$/.test(LN[pos(w, 'n')[1][0][1]])).slice(0, 400);
const ADJS = words.filter(w => only(w, 'a')).slice(0, 200);
const vcls = w => { const e = pos(w, 'v'); return e ? LN[e[1][0][1]] : null; };
const VT = words.filter(w => only(w, 'v') && /^[a-z]+$/.test(w) && G.inflect(w, 'pres3') === w + 's' && pos(w, 'v')[1][0][3].includes('8')).slice(0, 200);
const VEXP = words.filter(w => only(w, 'v') && /^verb\.(emotion|perception)$/.test(vcls(w)) && pos(w, 'v')[1][0][3].includes('8')).slice(0, 80);
function sentences(seed, n) { const r = rng(seed), pick = a => a[Math.floor(r() * a.length)], out = [];
  for (let i = 0; i < n; i++) { const k = i % 6, N1 = pick(NOUNS), N2 = pick(NOUNS), A = pick(ADJS), V = pick(VT), E = pick(VEXP);
    out.push(k === 0 ? 'the ' + A + ' ' + N1 + ' ' + G.inflect(V, 'pres3') + ' the ' + N2
      : k === 1 ? 'do you ' + E + ' the ' + N1 + '?'
      : k === 2 ? 'the ' + N1 + ' the ' + A + ' ' + N2
      : k === 3 ? 'can you ' + E + ' ' + ['anything', 'something', 'the ' + N2][i % 3] + ' as a ' + N1 + '?'
      : k === 4 ? 'are you ' + A + '?'
      : 'of the ' + A + ' ' + N1); }
  return out; }
T('W48 generated sentences over lexicon classes: zero canned fallback, every reply derived (Echo-checked), seeded and not stored', () => {
  const seed = Number(process.env.W48_SEED || 4948), ss = sentences(seed, 72); let canned = 0, nul = 0; const bad = [];
  expect(NOUNS.length > 50 && ADJS.length > 50 && VT.length > 20 && VEXP.length > 5, 'lexicon classes too small');
  for (const s of ss) { const r = open().process(s); if (!r.reply) { nul++; bad.push(s + ' → (null) ' + (r.trace.block_reason || '')); } else if (CANNED.test(r.reply)) { canned++; bad.push(s + ' → ' + r.reply); } }
  expect(canned === 0 && nul === 0, 'seed ' + seed + ': canned ' + canned + ', null ' + nul + ' / ' + ss.length + ' :: ' + bad.slice(0, 3).join(' || ')); });
T('W48 no canned "could not derive … type help" line remains in any shipped file, and no_frame is generated from the partial structure', () => {
  for (const f of SHIPPED()) { const t = fs.readFileSync(path.join(ROOT, f), 'utf8'); expect(!/N\('form', \{ det: 'a', adj: \['supported'\]/.test(t) && !CANNED.test(t), f + ' still holds the canned fallback'); }
  const r = open().process('the tall man the small dog'); expect(r.trace.rules.some(x => x.id === 'G-PARTIAL-STRUCTURE') && /“the small dog”/.test(r.reply) && /role/.test(r.reply), r.reply); });
T('W48 verb complement frames come from lexicon classes (WordNet frames), not hand lists inside the parser', () => {
  const src = fs.readFileSync(path.join(ROOT, 'src/grammar.js'), 'utf8');
  expect(!/\['know', 'think', 'say', 'believe', 'hope', 'remember', 'tell'\]\.includes/.test(src) && !/\['tell', 'inform', 'remind', 'promise', 'show', 'teach', 'warn'\]\.includes/.test(src), 'hand verb list still decides a frame');
  const k = open(); const one = t => k.derive(t).parses.length;
  expect(one('I feel tired') === 1 && one('the soup tastes cold') >= 1 && one('you seem happy') === 1, 'adjective-complement frame (WordNet 6/7) not read');
  expect(one('she believes the bridge is old') >= 1 && one('we fear the winter') === 1, 'clause-complement frame (WordNet 26 + cognition/communication) misapplied'); });
T('W48 quantifier pronouns and as-phrases merge: indefinite + postposed adjective, upādhi role adjunct', () => {
  const k = open(); const c = k.derive('the children want something sweet').parses[0].node.clause; expect(c.roles.karma.indef === 'something' && c.roles.karma.adjs[0] === 'sweet', JSON.stringify(c.roles));
  const d = k.derive('the painter works as a teacher').parses[0].node.clause; expect(d.adj.some(a => a.prep === 'as' && a.role === 'upadhi'), JSON.stringify(d.adj)); });
T('W48 self-model: honest, generated from the question, wording varies with the question', () => {
  const r = rng(77), qs = []; for (let i = 0; i < 8; i++) qs.push('do you ' + VEXP[Math.floor(r() * VEXP.length)] + ' the ' + NOUNS[Math.floor(r() * NOUNS.length)] + '?');
  qs.push('are you conscious?', 'are you alive?', 'what are you?', 'can you think?');
  const replies = qs.map(q => { const x = open().process(q); expect(x.trace.rules.some(y => y.id === 'Q-SELF-MODEL'), q + ' not answered by the self-model: ' + x.reply); expect(!/^Yes\b/.test(x.reply) || /^Yes\. I am a computer program/.test(x.reply), q + ' claims an experience: ' + x.reply); expect(!/\bI (?:do )?(?:feel|love|fear|want|enjoy)\b(?! not)/.test(x.reply.replace(/I do not \w+/g, '')), q + ' asserts a feeling: ' + x.reply); return x.reply; });
  expect(new Set(replies).size === replies.length, 'two different questions got the same reply: ' + qs.map((q, i) => q + ' → ' + replies[i]).join(' || '));
  for (const f of Object.values(SM.FACTS)) expect(!['feel', 'love', 'want', 'fear'].includes(f.verb.lemma), 'a self-fact asserts an experience'); });
for (const t of tests) { try { t.fn(); rows.push({ cls: 'LANGUAGE-CORE', name: t.name, ok: true }); } catch (e) { rows.push({ cls: 'LANGUAGE-CORE', name: t.name, ok: false, why: String(e && e.stack || e).slice(0, 1400) }); } }
process.stdout.write(JSON.stringify(rows));
