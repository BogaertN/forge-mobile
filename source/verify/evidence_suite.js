/* EVIDENCE ENGINE (4.9.62, M3 part 2): every assessed excerpt becomes an evidence object { claim, source, source rank class, excerpt hash,
 * retrieved-at } sealed in the Identity Vault only. The answer states its support level, read from the objects alone: corroborated by N
 * independent ranked sources / single source ("probably") / conflicting (both sides with their ranks) / none ("No source decided the
 * question"). Rank order primary authority > peer reviewed > structured reference > Wikipedia; evidence counts over majority (source counts
 * are never compared). Evidence is never a fact, never memory, never shared knowledge. */
module.exports = ({ C, expect, ROOT }) => {
  const fs = require('fs'), EV = require(ROOT + '/src/evidence.js'), FK = require(ROOT + '/src/forge.js'), KM = require(ROOT + '/src/kernel.js'), LEX = require(ROOT + '/data/lexicon.json');
  const Q = 'is aspirin safe', AT = '2026-10-18T12:00:00Z';
  const e = (archive, name, cls, title, verdict, extra) => Object.assign({ archive, name, cls, title, url: 'https://' + archive + '.example/' + encodeURIComponent(title), excerpt: title + ' excerpt text.', verdict: verdict ? { answer: verdict, check: 'fixture' } : undefined, captured_at: AT }, extra || {});
  const O = xs => xs.map(x => EV.object(x, Q, AT));
  const fda = (t, v) => e('fda', 'FDA', 'primary_authority', t, v), pub = (t, v) => e('pubmed', 'PubMed', 'peer_reviewed', t, v), wd = (t, v) => e('wikidata', 'Wikidata', 'structured_reference', t, v), wk = (t, v) => e('wikipedia', 'Wikipedia', 'encyclopedia', t, v);
  C('EVIDENCE', 'evidence object shape: claim, source, rank class, excerpt hash, retrieved-at; content-addressed id; evidence_only; no excerpt text inside', () => {
    const x = fda('Aspirin label', 'Yes'), o = EV.object(x, Q, AT), sha = require(ROOT + '/src/sha256.js').sha256;
    expect(o.schema === 'FORGE-EVIDENCE/v1' && /^evd:[0-9a-f]{24}$/.test(o.id) && o.claim.kind === 'verdict' && o.claim.answer === 'yes' && o.source.archive === 'fda' && o.source.name === 'FDA' && o.rank_class === 'primary_authority' && o.excerpt_sha256 === sha(x.excerpt) && o.retrieved_at === AT && o.evidence_only === true, JSON.stringify(o));
    expect(!JSON.stringify(o).includes(x.excerpt), 'excerpt text leaked into the object');
    expect(EV.object(x, Q, AT).id === o.id && EV.object(Object.assign({}, x, { excerpt: 'other' }), Q, AT).id !== o.id, 'id not content-addressed');
    expect(EV.object(e('x', 'X', 'blog', 'b'), Q, AT).rank_class === 'encyclopedia' && EV.object(wk('prose only'), Q, AT).claim === null, 'unranked/prose handling');
    expect(EV.object(wd('Aspirin dose', null, ), Q, AT).claim === null && EV.object(Object.assign(wd('Aspirin dose'), { value: '  81 MG ' }), Q, AT).claim.answer === '81 mg', 'typed value not normalized'); });
  C('EVIDENCE', 'rank order is declared data: primary authority > peer reviewed > structured reference > Wikipedia', () => {
    expect(JSON.stringify(EV.RANK_ORDER) === '["primary_authority","peer_reviewed","structured_reference","encyclopedia"]' && EV.outranks('primary_authority', 'peer_reviewed') && EV.outranks('peer_reviewed', 'structured_reference') && EV.outranks('structured_reference', 'encyclopedia') && !EV.outranks('encyclopedia', 'primary_authority') && EV.RANK_NAME.encyclopedia === 'Wikipedia'); });
  C('EVIDENCE', 'support levels: none / single / corroborated (N independent) / conflicting with ranks', () => {
    expect(EV.support([]).level === 'none' && EV.support(O([wk('prose')])).level === 'none', 'none');
    const s1 = EV.support(O([fda('Label', 'Yes'), wk('prose')])); expect(s1.level === 'single' && s1.n === 1 && s1.answer === 'yes', JSON.stringify(s1));
    const s2 = EV.support(O([fda('Label', 'Yes'), pub('Trial A', 'Yes'), wd('Q18216', 'Yes')])); expect(s2.level === 'corroborated' && s2.n === 3 && s2.answer === 'yes', JSON.stringify(s2));
    const s3 = EV.support(O([fda('Label', 'No'), wk('Aspirin', 'Yes')])); expect(s3.level === 'conflicting' && s3.decided && s3.answer === 'no' && s3.sides[0].top === 'primary_authority' && s3.sides[1].top === 'encyclopedia' && /outranks/.test(s3.rule), JSON.stringify(s3));
    const s4 = EV.support(O([pub('Trial A', 'Yes'), pub('Trial B', 'No')])); expect(s4.level === 'conflicting' && !s4.decided && s4.answer === null && /undetermined/.test(s4.rule), JSON.stringify(s4)); });
  C('EVIDENCE', 'evidence counts over majority: one primary authority "No" beats three agreeing lower-ranked "Yes"; two peer-reviewed against one peer-reviewed stays undetermined', () => {
    const s = EV.support(O([fda('Label', 'No'), wk('Aspirin', 'Yes'), wd('Q18216', 'Yes'), pub('Trial A', 'Yes')])); expect(s.level === 'conflicting' && s.decided && s.answer === 'no', JSON.stringify(s));
    const t = EV.support(O([pub('Trial A', 'Yes'), pub('Trial B', 'Yes'), pub('Trial C', 'No')])); expect(t.level === 'conflicting' && !t.decided && t.answer === null, JSON.stringify(t));
    expect(!/\.sources\s*[-<>]=?\s*\w+(\[\d\])?\.sources|\.sources\s*[-<>]=?\s*\w+\.sources|sort\([^)]*\.sources/.test(fs.readFileSync(ROOT + '/src/evidence.js', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')), 'support compares source counts'); });
  C('EVIDENCE', 'independence: two articles of one encyclopedia (or one structured archive) are one witness; two primary documents are two', () => {
    const a = EV.support(O([wk('Aspirin', 'Yes'), wk('Acetylsalicylic acid', 'Yes')])); expect(a.level === 'single' && a.n === 1, JSON.stringify(a));
    const b = EV.support(O([wd('Q1', 'Yes'), wd('Q2', 'Yes')])); expect(b.level === 'single', JSON.stringify(b));
    const c = EV.support(O([fda('Label', 'Yes'), fda('Guidance', 'Yes')])); expect(c.level === 'corroborated' && c.n === 2, JSON.stringify(c));
    const d = EV.support(O([wk('Aspirin', 'Yes'), wk('Aspirin', 'Yes')])); expect(d.level === 'single', 'duplicate counted twice'); });
  C('EVIDENCE', 'deterministic: the same objects in any order give the same support', () => {
    const xs = O([fda('Label', 'No'), wk('Aspirin', 'Yes'), pub('Trial A', 'Yes'), wd('Q1', 'No')]); const a = JSON.stringify(EV.support(xs)), b = JSON.stringify(EV.support(xs.slice().reverse()));
    expect(a === b, a + ' / ' + b); });
  /* the derived reply states the support level and passes Echo (structural reparse) */
  const f = FK.ForgeKernel({ lexicon: LEX, store: KM.MemoryStore(), clock: () => AT });
  const base = { kind: 'research_answer', excerpt: 'Aspirin is safe for most adults at low doses.', source: 'Aspirin', archive: 'FDA', cls: 'primary_authority', items: ['FDA: Aspirin', 'Wikipedia: Aspirin'], sealed: true };
  const say = (sup, extra) => { const m = Object.assign({}, base, { support: sup }, extra || {}); const r = f.realize(m); return { text: r.text, echo: f.echo(r.text, m) }; };
  C('EVIDENCE', 'reply: corroborated states N independent ranked sources; single source is hedged "Probably …"; both Echo-verified', () => {
    const a = say({ level: 'corroborated', n: 3 }, { answer: 'Yes' }); expect(/^Yes\./.test(a.text) && /3 independent ranked sources agree\./.test(a.text) && a.echo.pass, a.text + ' ' + a.echo.reason);
    const b = say({ level: 'single', n: 1 }, { answer: 'probably Yes' }); expect(/^Probably yes\./.test(b.text) && /1 source decided it\./.test(b.text) && b.echo.pass, b.text + ' ' + b.echo.reason);
    const m = Object.assign({}, base, { support: { level: 'single', n: 1 }, answer: 'probably Yes' }); expect(!f.echo(b.text.replace(/^Probably yes/, 'Yes'), m).pass, 'Echo does not bind the hedge'); });
  C('EVIDENCE', 'reply: conflicting shows both sides with their ranks; decided by rank or "No source decided the question"; none says so; Echo-verified', () => {
    const c = say({ level: 'conflicting', n: 0, decided: true, sides: [{ answer: 'no', rank: 'primary authority', names: ['FDA'], sources: 1 }, { answer: 'yes', rank: 'Wikipedia', names: ['Wikipedia'], sources: 1 }] }, { answer: 'No' });
    expect(/The sources disagree\./.test(c.text) && /primary authority/.test(c.text) && /Wikipedia \(Wikipedia\)|“Wikipedia/.test(c.text) && !/No source decided/.test(c.text) && c.echo.pass, c.text + ' ' + c.echo.reason);
    const d = say({ level: 'conflicting', n: 0, decided: false, sides: [{ answer: 'yes', rank: 'peer reviewed', names: ['PubMed'], sources: 1 }, { answer: 'no', rank: 'peer reviewed', names: ['OpenAlex', 'Crossref'], sources: 2 }] });
    expect(/The sources disagree\./.test(d.text) && /No source decided the question\./.test(d.text) && !/^(Yes|No)\./.test(d.text) && d.echo.pass, d.text + ' ' + d.echo.reason);
    const n = say({ level: 'none', n: 0 }); expect(/No source decided the question\./.test(n.text) && n.echo.pass, n.text + ' ' + n.echo.reason); });
  C('EVIDENCE', 'firewall: evidence.js is pure (no store, memory, shared KB, sync or network); the kernel never imports it or sb_sync.js', () => {
    const src = fs.readFileSync(ROOT + '/src/evidence.js', 'utf8'), k = fs.readFileSync(ROOT + '/src/kernel.js', 'utf8');
    expect(!/require\((?!'\.\/sha256\.js')/.test(src) && !/fetch|localStorage|store\.|remember|gks_|shared|sb_sync|supabase/i.test(src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')), 'evidence.js reaches outside');
    expect(!/evidence\.js|sb_sync/.test(k), 'kernel imports evidence.js or sb_sync.js');
    const html = fs.readFileSync(ROOT + '/index.html', 'utf8'), sw = fs.readFileSync(ROOT + '/sw.js', 'utf8'); expect(/src\/evidence\.js/.test(html) && /evidence\.js/.test(sw) && html.indexOf('evidence.js') < html.indexOf('forge.js'), 'evidence.js not shipped before forge.js'); });
};
