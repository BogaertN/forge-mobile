/* athena_doc.js — 4.9.180 Athena investor-guide tools on the learning loop.
 * Doc 1cAGNfVakKlS-mGFb59BAnalJRomDc-w7Vf3Ys1nU6nI is a list. Seventeen rows are built.
 * Sixty-seven rows are skipped. No LLM. Packs stay gated. Payments stay disabled.
 * The portable single file does not inline this file. */
(function (root) {
  const isNode = typeof module !== 'undefined' && module.exports;
  const sha256 = isNode ? require('./sha256.js').sha256 : root.KSha.sha256;
  const KM = isNode ? require('./kmath.js') : root.KMath;
  const SCHEMA = 'FORGE-ATHENA-DOC/v1';
  const DOC = '1cAGNfVakKlS-mGFb59BAnalJRomDc-w7Vf3Ys1nU6nI';
  const PROJECT_MAX = KM.DRIFT_RULING.project_max;
  const HARD = KM.DRIFT_RULING.explore_max;

  function row(ref, name, status, reason, caller) {
    return { ref: ref, name: name, status: status, reason: reason || null, caller: caller || null };
  }
  const B = (ref, name, caller) => row(ref, name, 'built', null, caller);
  const S = (ref, name, reason) => row(ref, name, 'skipped', reason, null);

  const INVENTORY = [
    S('1.1', 'Overview of Athena AI', 'intro/descriptive, no tool'),
    S('1.2', 'Athena’s Purpose on the AI.Web Investor Site', 'money/investment/token/Web3 — payments disabled'),
    S('1.3', 'How Athena AI Empowers Investors', 'money/investment/token/Web3 — payments disabled'),
    S('1.4', 'AI-Driven Conversational Assistance', 'requires LLM/generative AI'),
    S('1.5', 'Athena AI vs. Traditional Chatbots', 'intro/descriptive, no tool'),
    S('1.6', 'How Athena Adapts to Investor Queries', 'money/investment/token/Web3 — payments disabled'),
    S('1.7', 'AI-Powered Learning & Real-Time Updates', 'requires LLM/generative AI'),
    B('1.8', 'Understanding Athena’s Role in AI.Web’s Ecosystem', 'roleMap — dream_idle custody and pass'),
    S('1.9', 'AI-Driven Business Intelligence & Market Analysis', 'money/investment/token/Web3 — payments disabled'),
    S('1.10', 'Web3, AI-Generated Insights & AI-Web Hosting', 'money/investment/token/Web3 — payments disabled'),
    S('2.1', 'Accessing Athena AI on the Investor Dashboard', 'money/investment/token/Web3 — payments disabled'),
    B('2.2', 'How to Interact with Athena', 'interact — bridgeAskEvidence'),
    S('2.3', 'AI-Powered Personalized Investor Assistance', 'money/investment/token/Web3 — payments disabled'),
    B('2.4', 'Navigating Athena’s Dashboard Interface', 'dashboard — dream_idle custody'),
    S('2.5', 'Understanding Investor Tier-Based Access', 'money/investment/token/Web3 — payments disabled'),
    S('2.6', 'Using Athena for AI-Powered Investment Research', 'money/investment/token/Web3 — payments disabled'),
    S('2.7', 'AI-Generated Reports & Market Trends', 'money/investment/token/Web3 — payments disabled'),
    S('2.8', 'AI-Powered Personalized Investor Suggestions', 'money/investment/token/Web3 — payments disabled'),
    S('2.9', 'Managing Your Investor Preferences with Athena', 'money/investment/token/Web3 — payments disabled'),
    S('2.10', 'AI-Generated Security & Privacy for Investor Chats', 'money/investment/token/Web3 — payments disabled'),
    S('3.1', 'How Athena Adapts Based on Your Investment Tier', 'money/investment/token/Web3 — payments disabled'),
    S('3.2', 'Free Tier ($0 Investment)', 'money/investment/token/Web3 — payments disabled'),
    S('3.3', 'AI Supporter ($1 - $500 Investment)', 'money/investment/token/Web3 — payments disabled'),
    S('3.4', 'AI Enthusiast ($500 - $1,000 Investment)', 'money/investment/token/Web3 — payments disabled'),
    S('3.5', 'Community Supporter ($1,000 - $9,999 Investment)', 'money/investment/token/Web3 — payments disabled'),
    S('3.6', 'Early Backer ($10,000 - $49,999 Investment)', 'money/investment/token/Web3 — payments disabled'),
    S('3.7', 'Strategic Partner ($50,000 - $99,999 Investment)', 'money/investment/token/Web3 — payments disabled'),
    S('3.8', 'Visionary Investor ($100,000+ Investment)', 'money/investment/token/Web3 — payments disabled'),
    S('4.1', 'AI-Powered Award System Overview', 'money/investment/token/Web3 — payments disabled'),
    S('4.2', 'How Athena Tracks Investor Contributions & AI-Generated Insights', 'money/investment/token/Web3 — payments disabled'),
    S('4.3', 'Web3 Tokenized Award Prizes & Staking Incentives', 'money/investment/token/Web3 — payments disabled'),
    S('4.4', 'AI-Web Quarterly Award Categories', 'money/investment/token/Web3 — payments disabled'),
    S('4.4.1', 'Best AI-Generated Website', 'award/prize program (money/tokens disabled) + generative AI'),
    S('4.4.2', 'Best AI-Generated Article', 'award/prize program + generative AI'),
    S('4.4.3', 'Best AI-Generated Art Piece', 'award + graphics/generative media'),
    S('4.4.4', 'Best AI-Generated Video or Short Film', 'award + video/generative media'),
    S('4.4.5', 'Best AI-Generated Music or Sound Design', 'award + audio/generative media'),
    S('4.4.6', 'Best AI-Powered Business Innovation', 'award/Web3 business — money disabled'),
    S('4.4.7', 'AI-Web Community MVP Award', 'award tied to investors/prizes — money disabled'),
    S('4.4.8', 'Athena’s Wildcard Award', 'award/prize program — money disabled'),
    B('5.1', 'How Athena AI Knowledge Nodes Work', 'node — onAdmit'),
    B('5.2', 'Private Investor Knowledge Nodes (User-Specific)', 'node private — onAdmit local store'),
    B('5.3', 'Community AI Knowledge Nodes (Shared User Intelligence)', 'node community — onAdmit, publishPacks false'),
    B('5.4', 'Global AI Knowledge Nodes (Athena’s Verified AI-Generated Intelligence)', 'node global — onAdmit, drift <= 0.35'),
    B('5.5', 'Investor Warnings & User-Controlled Information Sharing', 'setShare — onAdmit'),
    B('5.6', 'AI-Generated Investor Data Encryption & Cybersecurity', 'sealChat — onAdmit, WebCrypto, no network'),
    S('5.7', 'Athena’s Real-Time AI Knowledge Updates on AI-Web Financial Growth', 'money/investment/token/Web3 — payments disabled'),
    B('5.8', 'How Athena AI Knowledge Nodes Function Like Advanced Cookies', 'persist — onAdmit store.save'),
    S('5.9', 'Web3 Integration for AI-Generated Investment Insights', 'money/investment/token/Web3 — payments disabled'),
    S('6.1', 'AI-Powered Web3 Investment Ecosystem Mapping', 'money/investment/token/Web3 — payments disabled'),
    S('6.2', 'AI-Generated AI/Web IPO & Public Market Intelligence', 'money/investment/token/Web3 — payments disabled'),
    S('6.3', 'AI-Powered Smart Voting Assistant for Decentralized Governance', 'requires LLM/generative AI'),
    S('6.4', 'AI-Based AI/Web Competitor Disruption Tracking', 'requires LLM/generative AI'),
    S('6.5', 'AI-Powered Investment Growth Simulations & Risk Modeling', 'money/investment/token/Web3 — payments disabled'),
    S('6.6', 'AI-Driven Decentralized Investor Knowledge Base', 'money/investment/token/Web3 — payments disabled'),
    S('6.7', 'AI-Powered Portfolio Diversification & Risk Assessment', 'money/investment/token/Web3 — payments disabled'),
    S('6.8', 'AI-Generated Private Investor Conferences & AI-Powered Networking', 'money/investment/token/Web3 — payments disabled'),
    S('6.9', 'AI-Powered Autonomous Investor Reports with Multi-Format Options', 'money/investment/token/Web3 — payments disabled'),
    S('6.10', 'AI-Powered Augmented Reality (AR) AI-Web Investment Visualization', 'graphics/media runtime or generative media'),
    S('7.1', 'AI-Generated Real-Time Market Forecasting', 'money/investment/token/Web3 — payments disabled'),
    S('7.2', 'AI-Powered Predictive Investor Queries', 'money/investment/token/Web3 — payments disabled'),
    S('7.3', 'AI-Based Sentiment Analysis for Investment Behavior', 'money/investment/token/Web3 — payments disabled'),
    B('7.4', 'AI-Generated Conversational AI Flow Optimization', 'tune — interact'),
    B('7.5', 'AI-Powered Adaptive Learning for Investor Needs', 'adapt — onAdmit'),
    S('7.6', 'AI-Based Real-Time AI/Web Competitor Financial Reports', 'money/investment/token/Web3 — payments disabled'),
    S('7.7', 'AI-Generated Investor Voting & AI-Powered Web3 Governance Assistance', 'money/investment/token/Web3 — payments disabled'),
    S('7.8', 'AI-Powered Personalized Portfolio Insights', 'money/investment/token/Web3 — payments disabled'),
    S('7.9', 'AI-Based AI-Web Business Expansion Recommendations', 'requires LLM/generative AI'),
    S('7.10', 'AI-Generated AI/Web Revenue Stream Optimization', 'money/investment/token/Web3 — payments disabled'),
    B('8.1', 'AI-Based Data Encryption for Investor Chats', 'sealChat — onAdmit'),
    B('8.2', 'AI-Powered Secure Data Storage for Investment Insights', 'secure store — sealChat'),
    S('8.3', 'AI-Generated Web3-Based Investor ID Verification', 'money/investment/token/Web3 — payments disabled'),
    B('8.4', 'AI-Powered AI-Web Account Security & Authentication', 'setPasscode / unlock — local hash'),
    S('8.5', 'AI-Based Smart Contract Security for AI-Web Tokenized Investments', 'money/investment/token/Web3 — payments disabled'),
    S('8.6', 'AI-Powered AI/Web Account Fraud Protection', 'requires LLM/generative AI'),
    S('8.7', 'AI-Based Web3 Identity Protection for Investors', 'money/investment/token/Web3 — payments disabled'),
    S('8.8', 'AI-Powered Investment Risk Management Alerts', 'money/investment/token/Web3 — payments disabled'),
    S('8.9', 'AI-Generated AI-Web Investor Fraud Prevention Measures', 'money/investment/token/Web3 — payments disabled'),
    B('8.10', 'AI-Powered AI-Web Cybersecurity Defense System', 'defend — onAdmit, drift and chi'),
    B('9.1', 'Persistent investor memory and evolving knowledge nodes', 'evolve — onAdmit'),
    S('9.2', 'AI-powered Web3 tokenized investment growth simulations', 'money/investment/token/Web3 — payments disabled'),
    S('9.3', 'Investor governance voting and AI-powered decentralized decision-making', 'money/investment/token/Web3 — payments disabled'),
    S('9.4', 'AI-generated investment coaching for both beginners and advanced investors', 'money/investment/token/Web3 — payments disabled'),
    S('9.5', 'Live AI-generated investor networking, exclusive AI-powered investor strategy sessions', 'money/investment/token/Web3 — payments disabled')
  ];

  function counts() {
    return {
      built: INVENTORY.filter(x => x.status === 'built').length,
      skipped: INVENTORY.filter(x => x.status === 'skipped').length,
      total: INVENTORY.length
    };
  }

  function subtle() {
    const c = typeof crypto !== 'undefined' ? crypto : null;
    return (c && c.subtle) || (c && c.webcrypto && c.webcrypto.subtle) || null;
  }
  function rnd(n) {
    const u = new Uint8Array(n);
    const c = typeof crypto !== 'undefined' ? crypto : null;
    const g = (c && c.getRandomValues) || (c && c.webcrypto && c.webcrypto.getRandomValues);
    if (!g) throw new Error('ATHENA-NO-WEBCRYPTO');
    g.call(c.webcrypto || c, u);
    return u;
  }
  function b64(u) {
    if (typeof Buffer !== 'undefined') return Buffer.from(u).toString('base64');
    let s = '';
    for (let i = 0; i < u.length; i++) s += String.fromCharCode(u[i]);
    return btoa(s);
  }
  function unb64(s) {
    if (typeof Buffer !== 'undefined') return new Uint8Array(Buffer.from(s, 'base64'));
    const bin = atob(s);
    const u = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    return u;
  }

  function create(opts) {
    opts = opts || {};
    const store = opts.store || null;
    const publishPacks = opts.publishPacks === true;
    const blank = () => ({
      schema: SCHEMA, doc: DOC, calls_llm: false, publish_packs: false,
      nodes: [], secure: [], warnings: [], flows: {}, weights: {},
      shares: { private: true, community: false, global: true },
      passHash: null, unlocked: true, keyRaw: null
    });
    let state = blank();
    function load() {
      if (!store || typeof store.load !== 'function') return;
      const saved = store.load('athena_doc');
      if (saved && saved.schema === SCHEMA) state = Object.assign(blank(), saved, { publish_packs: false, calls_llm: false });
    }
    function persist() {
      state.publish_packs = false;
      if (store && typeof store.save === 'function') store.save('athena_doc', state);
    }
    load();

    function roleMap() {
      return {
        ref: '1.8',
        neo: 'Ask surface. Neo does not spawn.',
        athena: 'Admit and coherence. Research is measured, then admitted or quarantined.',
        gilligan: 'Cold re-curate and ChristPing. Only Gilligan initiates χ.',
        protoforge: 'Separate desktop runtime. Not this phone app.',
        calls_llm: false
      };
    }
    function dashboard() {
      return { ref: '2.4', tabs: ['Ask', 'Custody', 'Memory', 'Ideas', 'Audit', 'Vault', 'Tools', 'Dry-Run', 'Library', 'Status'], calls_llm: false };
    }
    function tune(lane) {
      const k = String(lane || 'route');
      state.flows[k] = (state.flows[k] || 0) + 1;
      persist();
      return { ref: '7.4', lane: k, n: state.flows[k], calls_llm: false };
    }
    function interact(question) {
      const q = String(question || '').toLowerCase().trim();
      const lane = /^(how|why)\b/.test(q) ? 'research' : /^(what|who|where|when)\b/.test(q) ? 'ask' : 'route';
      const flow = tune(lane);
      return { ref: '2.2', lane: lane, flow: flow, calls_llm: false, network: false };
    }
    function adapt(subject) {
      const k = String(subject || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().split(/\s+/).slice(0, 4).join(' ');
      if (!k) return { ref: '7.5', n: 0, calls_llm: false };
      state.weights[k] = (state.weights[k] || 0) + 1;
      persist();
      return { ref: '7.5', subject: k, n: state.weights[k], calls_llm: false };
    }
    function prefer(subjects) {
      const list = (subjects || []).slice().sort((a, b) => (state.weights[String(b).toLowerCase()] || 0) - (state.weights[String(a).toLowerCase()] || 0));
      return { ref: '7.5', order: list, calls_llm: false };
    }
    function defend(eps) {
      const n = Number(eps);
      if (!Number.isFinite(n)) return { ref: '8.10', route: 'unmeasured', write_global: false, calls_llm: false };
      if (n > HARD) return { ref: '8.10', route: 'hard_stop', write_global: false, calls_llm: false };
      if (n > PROJECT_MAX) return { ref: '8.10', route: n <= 0.40 ? 'chi' : 'quarantine', write_global: false, calls_llm: false };
      return { ref: '8.10', route: 'project', write_global: true, calls_llm: false };
    }
    function setShare(scope, on) {
      if (!Object.prototype.hasOwnProperty.call(state.shares, scope)) return { ok: false, rule: 'SHARE-SCOPE' };
      state.shares[scope] = on === true;
      if (scope === 'community' && on === true) state.warnings.push({ ref: '5.5', rule: 'COMMUNITY-PACK-GATED', at: opts.clock ? opts.clock() : null });
      persist();
      return { ok: true, ref: '5.5', shares: Object.assign({}, state.shares), calls_llm: false };
    }
    function setPasscode(code) {
      const c = String(code || '');
      if (c.length < 4) return { ok: false, rule: 'PASSCODE-SHORT', calls_llm: false };
      state.passHash = sha256('athena-pass|' + c);
      state.unlocked = false;
      persist();
      return { ok: true, ref: '8.4', unlocked: false, calls_llm: false, network: false };
    }
    function unlock(code) {
      if (!state.passHash) { state.unlocked = true; return { ok: true, ref: '8.4', unlocked: true, calls_llm: false }; }
      state.unlocked = sha256('athena-pass|' + String(code || '')) === state.passHash;
      persist();
      return { ok: state.unlocked, ref: '8.4', rule: state.unlocked ? 'PASSCODE-OPEN' : 'PASSCODE-REFUSED', unlocked: state.unlocked, calls_llm: false };
    }
    async function keyBytes() {
      if (!state.keyRaw) state.keyRaw = b64(rnd(32));
      persist();
      return unb64(state.keyRaw);
    }
    async function sealChat(text) {
      const sub = subtle();
      if (!sub) return { ok: false, rule: 'ATHENA-NO-WEBCRYPTO', calls_llm: false };
      const raw = await keyBytes();
      const key = await sub.importKey('raw', raw, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
      const iv = rnd(12);
      const ct = new Uint8Array(await sub.encrypt({ name: 'AES-GCM', iv: iv }, key, new TextEncoder().encode(String(text))));
      const box = { iv: b64(iv), ct: b64(ct) };
      if (box.ct.indexOf(String(text)) >= 0) return { ok: false, rule: 'ATHENA-PLAINTEXT-LEAK' };
      state.secure.push({ id: sha256(String(text)).slice(0, 12), box: box });
      if (state.secure.length > 40) state.secure.splice(0, state.secure.length - 40);
      persist();
      return { ok: true, ref: '8.1', store: '8.2', plaintext_stored: false, network: false, calls_llm: false, box: box };
    }
    async function openChat(box) {
      const sub = subtle();
      if (!sub || !box) return { ok: false, rule: 'ATHENA-NO-WEBCRYPTO' };
      const raw = await keyBytes();
      const key = await sub.importKey('raw', raw, { name: 'AES-GCM' }, false, ['decrypt']);
      const text = new TextDecoder().decode(await sub.decrypt({ name: 'AES-GCM', iv: unb64(box.iv) }, key, unb64(box.ct)));
      return { ok: true, text: text, calls_llm: false, network: false };
    }
    function evolve(claim, eps, packet) {
      const key = String(claim || '').toLowerCase().replace(/\s+/g, ' ').trim();
      const prior = state.nodes.filter(n => n && String(n.text || '').toLowerCase().replace(/\s+/g, ' ').trim() === key);
      const better = prior.length ? prior.every(n => !Number.isFinite(Number(n.eps)) || Number(eps) <= Number(n.eps)) : true;
      return { ref: '9.1', evolved: better && prior.length > 0, prior: prior.length, calls_llm: false, packet: packet || null };
    }
    function node(scope, claim, eps, packet) {
      const gate = defend(eps);
      if (scope === 'private' && state.passHash && !state.unlocked) return { ok: false, ref: '5.2', rule: 'PASSCODE-LOCKED', calls_llm: false };
      if (scope === 'global' && !gate.write_global) return { ok: false, ref: '5.4', rule: 'GLOBAL-DRIFT-HELD', route: gate.route, calls_llm: false };
      if (scope === 'global' && state.shares.global !== true) {
        state.warnings.push({ ref: '5.5', scope: scope, rule: 'SHARE-OFF' });
        persist();
        return { ok: false, ref: '5.5', rule: 'SHARE-OFF', calls_llm: false };
      }
      const evolved = evolve(claim, eps, packet);
      const rec = {
        id: 'node:' + sha256(scope + '|' + String(claim || '')).slice(0, 12),
        scope: scope, text: String(claim || ''), eps: Number(eps), packet: packet || null,
        published: false, calls_llm: false
      };
      if (scope === 'community') {
        rec.rule = 'COMMUNITY-PACK-GATED';
        rec.published = false;
        state.warnings.push({ ref: '5.5', scope: 'community', rule: 'COMMUNITY-PACK-GATED' });
      }
      const i = state.nodes.findIndex(n => n.id === rec.id);
      if (i >= 0) state.nodes[i] = rec; else state.nodes.push(rec);
      persist();
      const ref = scope === 'community' ? '5.3' : scope === 'global' ? '5.4' : scope === 'private' ? '5.2' : '5.1';
      return { ok: true, ref: ref, rule: rec.rule || 'NODE-KEPT', node: rec, evolved: evolved, published: false, calls_llm: false };
    }
    function noteAdmit(rec) {
      rec = rec || {};
      const claim = String(rec.claim || '').trim();
      const eps = rec.eps;
      const packet = rec.packet && rec.packet.sfe ? rec.packet.sfe : (rec.sfe || null);
      const head = claim.split(/\s+/).slice(0, 3).join(' ');
      const learned = adapt(head);
      const defense = defend(eps);
      const priv = claim ? node('private', claim, eps, packet) : { ok: false, rule: 'DREAM-IDLE-NO-CLAIM' };
      const community = claim ? node('community', claim, eps, packet) : { ok: false, rule: 'DREAM-IDLE-NO-CLAIM' };
      const global = claim ? node('global', claim, eps, packet) : { ok: false, rule: 'DREAM-IDLE-NO-CLAIM' };
      return {
        ref: '9.1', calls_llm: false, network: false, publish_packs: false,
        learned: learned, defense: defense, private: priv, community: community, global: global,
        nodes: state.nodes.length
      };
    }
    async function onAdmit(rec) {
      const noted = noteAdmit(rec);
      if (noted.private && noted.private.ok && rec && rec.claim) {
        try { noted.sealed = await sealChat(rec.claim); } catch (e) { noted.sealed = { ok: false, rule: 'ATHENA-SEAL-FAILED' }; }
      }
      return noted;
    }
    function pass(info) {
      return {
        schema: SCHEMA, doc: DOC, calls_llm: false, publish_packs: publishPacks === true ? false : false,
        role: roleMap(), dashboard: dashboard(), defense: defend(info && info.eps),
        nodes: state.nodes.length, flows: Object.assign({}, state.flows), counts: counts()
      };
    }
    function view() {
      const hide = !!(state.passHash && !state.unlocked);
      return {
        schema: SCHEMA, doc: DOC, calls_llm: false, publish_packs: false,
        role: roleMap(), dashboard: dashboard().tabs, counts: counts(),
        nodes: state.nodes.map(n => hide && n.scope === 'private' ? Object.assign({}, n, { text: 'sealed' }) : Object.assign({}, n)),
        warnings: state.warnings.slice(-8),
        shares: Object.assign({}, state.shares),
        unlocked: state.unlocked, secure: state.secure.length, flows: Object.assign({}, state.flows), weights: Object.assign({}, state.weights)
      };
    }
    return {
      schema: SCHEMA, doc: DOC, calls_llm: false,
      roleMap: roleMap, dashboard: dashboard, interact: interact, tune: tune, adapt: adapt, prefer: prefer,
      defend: defend, setShare: setShare, setPasscode: setPasscode, unlock: unlock,
      sealChat: sealChat, openChat: openChat, node: node, noteAdmit: noteAdmit, onAdmit: onAdmit, pass: pass, view: view, persist: persist
    };
  }

  const api = { SCHEMA: SCHEMA, DOC: DOC, INVENTORY: INVENTORY, counts: counts, create: create };
  if (isNode) module.exports = api; else root.KAthenaDoc = api;
})(typeof self !== 'undefined' ? self : this);
