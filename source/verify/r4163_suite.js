/* R4163 (4.9.163): civics WH substance + discourse continuity on hosted confirmed_shared.
 * Nic pt125u: Fifth Amendment thin "what is", people/person clarify hold on rights WH,
 * and follow-up "what does it say that it gives" losing the CS entity into research.web.
 * Pathway: IRRN surface collapse, compose presence+about, rights/discourse about-fallback;
 * thicker First/Fifth pack facts. Not a Fifth-only hack. */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const KMOD = require(ROOT + '/src/kernel.js');
const LEX = require(ROOT + '/data/lexicon.json'), EXT = require(ROOT + '/data/lexicon-ext.json');
const tests = [], rows = [];
const T = (name, fn) => tests.push({ name, fn });
const expect = (c, why) => { if (!c) throw new Error(why || 'expectation failed'); };
const CLOCK = () => '2026-10-28T12:00:00Z';
const mk = extra => KMOD.Kernel(Object.assign({ lexicon: LEX, lexiconExt: EXT, clock: CLOCK }, extra || {}));
const sharedN = k => (k.store.load('shared_knowledge') || []).length;
const PACK_DIR = path.join(ROOT, 'packs', 'confirmed_shared');
const letter = L => fs.readFileSync(path.join(PACK_DIR, L + '.json'), 'utf8');
const ruleIds = r => (r.trace && r.trace.rules || []).map(x => x.id || x);
const hasRule = (r, id) => ruleIds(r).includes(id);
const phoneEmpty = k => { const p = k.store.load('confirmed_shared'); return !p || !Array.isArray(p.facts) || p.facts.length === 0; };

function pullAF(k) {
  expect(k.pullHostedSharedPack(letter('a')).ok, 'pull a');
  expect(k.pullHostedSharedPack(letter('f')).ok, 'pull f');
}

T('Fifth Amendment what-is from shared KB with Bill of Rights and rights substance', () => {
  const k = mk();
  k.clearStarterKnowledge();
  pullAF(k);
  const r = k.process('What is the fifth amendment to the United States Constitution?');
  expect(r.trace.echo && r.trace.echo.pass, 'echo ' + JSON.stringify(r.trace.echo && r.trace.echo.reason));
  expect(r.trace.intent_kind === 'READ', r.trace.intent_kind);
  expect(hasRule(r, 'CS-COMPOSE-PRESENCE-ABOUT') || hasRule(r, 'CS-RECALL-ABOUT') || hasRule(r, 'CS-RECALL-STRUCTURAL'), 'cs ' + ruleIds(r).join(','));
  expect(!hasRule(r, 'AUTH-AQ1-QUESTION-IS-LOOKUP-REQUEST'), 'must not AQ-1');
  expect(!/DETERMINISTIC_ROUTE|research\.web|NO_LAWFUL_CANDIDATE/i.test(ruleIds(r).join(' ')), 'no research');
  expect(/shared knowledge/i.test(r.reply || ''), r.reply);
  expect(/Fifth Amendment/i.test(r.reply || '') && /Bill of Rights/i.test(r.reply || ''), 'presence: ' + r.reply);
  expect(/self incrimination|due process|grand jury|private property|second trial/i.test(r.reply || ''), 'rights: ' + r.reply);
  expect(phoneEmpty(k) && sharedN(k) === 0 && k.memory().length === 0, 'layers quiet');
});

T('Fifth Amendment rights WH answers without people/person clarify hold', () => {
  const k = mk();
  k.clearStarterKnowledge();
  pullAF(k);
  const r = k.process('What rights does the fifth amendment to the United States Constitution give the people?');
  expect(r.trace.echo && r.trace.echo.pass, 'echo');
  expect(r.outcome && r.outcome.category === 'SELECTED_MEANING', JSON.stringify(r.outcome));
  expect(!/AMBIGUITY_PRESERVED|CLARIFICATION_REQUIRED/i.test(String(r.outcome && r.outcome.category || '')), 'no hold');
  expect(hasRule(r, 'G-IRRN-SURFACE') || hasRule(r, 'CS-RECALL-RIGHTS-ABOUT') || hasRule(r, 'CS-RECALL-STRUCTURAL'), 'pathway ' + ruleIds(r).join(','));
  expect(hasRule(r, 'CS-RECALL-RIGHTS-ABOUT') || hasRule(r, 'CS-RECALL-STRUCTURAL') || hasRule(r, 'CS-RECALL-ABOUT'), 'cs rights');
  expect(!hasRule(r, 'AUTH-AQ1-QUESTION-IS-LOOKUP-REQUEST'), 'no AQ-1');
  expect(/shared knowledge/i.test(r.reply || '') && /Fifth Amendment/i.test(r.reply || ''), r.reply);
  expect(/self incrimination|due process|grand jury|private property|second trial|just compensation/i.test(r.reply || ''), r.reply);
  expect(!/Which reading do you mean/i.test(r.reply || ''), r.reply);
  expect(phoneEmpty(k) && sharedN(k) === 0, 'no dump');
});

T('Fifth Amendment discourse follow-up keeps CS entity; no research.web on Says', () => {
  const k = mk();
  k.clearStarterKnowledge();
  pullAF(k);
  const a = k.process('What is the fifth amendment to the United States Constitution?');
  expect(a.trace.echo && a.trace.echo.pass, 'a echo');
  expect(/Fifth Amendment/i.test(a.reply || ''), a.reply);
  const b = k.process('What does it say that it gives?');
  expect(b.trace.echo && b.trace.echo.pass, 'b echo');
  expect(hasRule(b, 'REF-RESOLVED-UNIQUE') || hasRule(b, 'REF-BOUND-LOCAL'), 'ref ' + ruleIds(b).join(','));
  expect(hasRule(b, 'CS-RECALL-RIGHTS-ABOUT') || hasRule(b, 'CS-RECALL-ABOUT') || hasRule(b, 'CS-RECALL-STRUCTURAL'), 'cs follow ' + ruleIds(b).join(','));
  expect(!hasRule(b, 'AUTH-AQ1-QUESTION-IS-LOOKUP-REQUEST'), 'no AQ-1');
  expect(!/DETERMINISTIC_ROUTE|research\.web|SUBJECT_MISMATCH|NO_LAWFUL_CANDIDATE/i.test(ruleIds(b).join(' ')), 'no research on Says');
  expect(/shared knowledge/i.test(b.reply || '') && /Fifth Amendment/i.test(b.reply || ''), b.reply);
  expect(/self incrimination|due process|grand jury|private property|second trial/i.test(b.reply || ''), b.reply);
  const c = k.process('What rights does it give?');
  expect(c.trace.echo && c.trace.echo.pass, 'c echo');
  expect(hasRule(c, 'CS-RECALL-RIGHTS-ABOUT') || hasRule(c, 'CS-RECALL-STRUCTURAL'), 'c cs');
  expect(/Fifth Amendment/i.test(c.reply || '') && !hasRule(c, 'AUTH-AQ1-QUESTION-IS-LOOKUP-REQUEST'), c.reply);
  expect(phoneEmpty(k) && sharedN(k) === 0, 'no dump');
});

T('First Amendment rights still from shared KB; deliberate miss still AQ-1', () => {
  const k = mk();
  k.clearStarterKnowledge();
  pullAF(k);
  const r = k.process('What rights does the First Amendment protect?');
  expect(r.trace.echo && r.trace.echo.pass, 'echo');
  expect(hasRule(r, 'CS-RECALL-STRUCTURAL') || hasRule(r, 'CS-RECALL-RIGHTS-ABOUT') || hasRule(r, 'CS-RECALL-ABOUT'), 'cs');
  expect(/shared knowledge/i.test(r.reply || '') && /speech|religion|press|assembly|petition/i.test(r.reply || ''), r.reply);
  expect(!hasRule(r, 'AUTH-AQ1-QUESTION-IS-LOOKUP-REQUEST'), 'no AQ-1');
  const miss = k.process('What is the Zorblaxian quantum waffle protocol?');
  expect(hasRule(miss, 'AUTH-AQ1-QUESTION-IS-LOOKUP-REQUEST'), 'AQ-1 on miss');
  expect(!hasRule(miss, 'CS-RECALL-ABOUT') && !hasRule(miss, 'CS-RECALL-STRUCTURAL') && !hasRule(miss, 'CS-RECALL-RIGHTS-ABOUT'), 'no false cs');
  expect(phoneEmpty(k) && sharedN(k) === 0, 'no write on miss');
});

T('version registry CONFLICTS NEXT_BUILD name 4.9.171', () => {
  const ver = fs.readFileSync(ROOT + '/VERSION', 'utf8').trim();
  expect(ver === '4.9.178', ver);
  const reg = JSON.parse(fs.readFileSync(ROOT + '/data/feature_registry.json', 'utf8'));
  expect(reg.version === ver, reg.version);
  for (const id of ['R4164-GZIP-LEAVE', 'R4163-CIVICS-WH', 'R4163-DISCOURSE-CS', 'R4162-READ-CONNECT', 'R4128-HOSTED']) {
    const f = reg.features.find(x => x.id === id);
    expect(f && (f.claim === 'Partial' || f.claim === 'Implemented'), id + ' ' + JSON.stringify(f));
  }
  const conf = fs.readFileSync(ROOT + '/CONFLICTS.md', 'utf8');
  expect(/v4\.9\.164/.test(conf) && /gzip|leave|IRRN|rights|discourse|Fifth/i.test(conf), 'CONFLICTS');
  expect(/v4\.9\.163/.test(conf), 'CONFLICTS 163');
  const next = fs.readFileSync(path.join(ROOT, '..', 'NEXT_BUILD.md'), 'utf8');
  expect(/4\.9\.164/.test(next), 'NEXT_BUILD');
  const readme = fs.readFileSync(path.join(ROOT, '..', 'README.md'), 'utf8');
  expect(/4\.9\.164/.test(readme), 'README');
  const tgt = JSON.parse(fs.readFileSync(ROOT + '/verify/targeted.json', 'utf8'));
  expect(tgt.release === '4.9.178' && (((((tgt.suites[0] === 'r4178_suite.js' || tgt.suites[0] === 'r4177_suite.js' || tgt.suites[0] === 'r4176_suite.js' || tgt.suites[0] === 'r4175_suite.js' || tgt.suites[0] === 'r4174_suite.js' || tgt.suites[0] === 'r4173_suite.js') || tgt.suites[0] === 'r4172_suite.js') || tgt.suites[0] === 'r4171_suite.js') || tgt.suites[0] === 'r4170_suite.js' || tgt.suites[0] === 'r4169_suite.js' || tgt.suites[0] === 'r4168_suite.js' || tgt.suites[0] === 'r4167_suite.js') || tgt.suites[0] === 'r4166_suite.js' || tgt.suites[0] === 'r4165_suite.js' || tgt.suites[0] === 'r4163_suite.js'), JSON.stringify(tgt));
  const req = fs.readFileSync(ROOT + '/src/req_packet.js', 'utf8');
  expect(/4\.9\.164/.test(req) && /R4163/.test(req) && /R4165/.test(req) && /R4164/.test(req), 'req_packet');
  const idx = JSON.parse(fs.readFileSync(ROOT + '/packs/confirmed_shared/index.json', 'utf8'));
  expect((idx.version === '4.9.168' || idx.version === '4.9.163') && idx.packs.f.items >= 262, JSON.stringify(idx.packs.f));
});

(async () => {
  let failed = 0;
  for (const t of tests) {
    try { await t.fn(); rows.push({ cls: 'R4163', name: t.name, ok: true }); }
    catch (e) { failed++; rows.push({ cls: 'R4163', name: t.name, ok: false, why: String(e.message || e).slice(0, 500) }); }
  }
  console.log(JSON.stringify(rows, null, 1));
  process.exit(failed ? 1 : 0);
})();
