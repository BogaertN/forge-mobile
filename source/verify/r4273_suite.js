/* Resonant Key Memory. Tuning is an index. It does not speak, store, or move a gate. */
const path = require('path');
const ROOT = path.join(__dirname, '..');
const R = require(ROOT + '/src/rkm.js');
const A = require(ROOT + '/src/rkm_acoustic.js');
const K = require(ROOT + '/src/kernel.js');
const FK = require(ROOT + '/src/forge.js');
const Q = require(ROOT + '/src/qframe.js');
const LEX = require(ROOT + '/data/lexicon.json');
const EXT = require(ROOT + '/data/lexicon-ext.json');
function forge() { return FK.ForgeKernel({ store: K.MemoryStore(), lexicon: LEX, lexiconExt: EXT, clock: () => '2026-11-25T00:00:00Z' }); }
function memStore() { const mem = {}; return { mem, store: { get: k => mem[k], set: (k, v) => { mem[k] = JSON.parse(JSON.stringify(v)); } } }; }
function register(C, expect) {
  C('RKM', 'a remembered clause gets an address and recalls by tuning, and scoring does not change the store', () => {
    const f = forge(); const box = memStore(); let t = 0;
    const r = R.create({ store: box.store, now: () => t, forge: f });
    const a = Q.clause('A wren is a bird.', f), b = Q.clause('A bird is an animal.', f);
    const one = r.noteRemember({ text: 'A wren is a bird.', clause: a }, f);
    const two = r.noteRemember({ text: 'A bird is an animal.', clause: b }, f);
    const asked = Q.clause('A wren is a bird.', f);
    const before = r.storeHash();
    const hit = r.recall(asked, f);
    expect(one.ok && one.address && one.address.compact_hex && two.theta_slot === 1 && hit.lit.length === 1 && hit.lit[0].M >= 0.5 && hit.chain.length === 2 && hit.chain[0].theta_slot === 0 && hit.chain[1].theta_slot === 1 && r.storeHash() === before, JSON.stringify({ one, two, hit }));
  });
  C('RKM', 'a verified fact keeps its floor after a long silence, and a near miss is a lead that is not stored by recall', () => {
    const f = forge(); const box = memStore(); let t = 0;
    const r = R.create({ store: box.store, now: () => t, forge: f });
    const a = Q.clause('A wren is a bird.', f);
    const kept = r.noteRemember({ text: 'A wren is a bird.', clause: a }, f);
    r.advance(52 * 168 * 3600 * 1000 * 8);
    const faded = r.amplitude(kept.fact_id);
    const again = r.recall(a, f);
    const before = r.storeHash();
    const miss = r.recall(Q.clause('A wren is a mineral.', f), f);
    expect(faded <= 0.25 + 1e-9 && faded >= 0.25 - 1e-6 && again.lit.length === 1 && miss.lead && miss.lead.rule === 'RKM-ATHENA-LEAD' && miss.lead.spoken === false && r.storeHash() === before, JSON.stringify({ faded, again: again.lit[0], miss: miss.lead }));
  });
  C('RKM', 'recall reinforcement is a later log event, a bad trace is rejected, and re-admission stops at five', () => {
    const f = forge(); const box = memStore(); let t = 0;
    const r = R.create({ store: box.store, now: () => t, forge: f });
    const a = Q.clause('A wren is a bird.', f);
    const kept = r.noteRemember({ text: 'A wren is a bird.', clause: a }, f);
    const up = r.reinforce(kept.fact_id, 0.1);
    const trace = r.acceptTrace([{ event: 'held' }, { event: 'neo' }, { event: 'athena' }, { event: 'gilligan' }, { event: 'resumed' }]);
    const bad = r.acceptTrace([{ event: 'held' }, { event: 'gilligan' }]);
    let last = null; for (let i = 0; i < 6; i++) last = r.readmit(kept.fact_id);
    expect(up.ok && up.A > 0.25 && trace.ok && bad.rule === 'RKM-TRACE-INCOMPLETE' && last.rule === 'RKM-READMIT-CAP', JSON.stringify({ up, trace, bad, last }));
  });
  C('RKM', 'an imported packet rebuilds the address as a claim, and a foreign fingerprint is refused', () => {
    const f = forge(); const a = memStore(); const b = memStore();
    const left = R.create({ store: a.store, now: () => 0, forge: f });
    const right = R.create({ store: b.store, now: () => 0, forge: f });
    const clause = Q.clause('A wren is a bird.', f);
    const kept = left.noteRemember({ text: 'A wren is a bird.', clause: clause }, f);
    const pkt = left.exportPacket();
    const got = right.importPacket(pkt);
    const wrong = JSON.parse(JSON.stringify(pkt)); wrong.forge_memory.key.structure_fp = 'deadbeef';
    const refused = right.importPacket(wrong);
    expect(got.ok && got.persisted === false && got.claims[0].address === kept.address.compact_hex && got.claims[0].alpha === 'quarantine_peer' && refused.rule === 'RKM-KEY-MISMATCH' && pkt.packet.forge_bridge.status === 'bound' && pkt.root_frequency_hz === 144, JSON.stringify({ got, refused: refused.rule }));
  });
  C('RKM', 'a paired peer can stretch a half-life once, and four damaged acoustic bytes still decode', () => {
    const f = forge(); const box = memStore();
    const r = R.create({ store: box.store, now: () => 0, forge: f });
    const clause = Q.clause('A wren is a bird.', f);
    const kept = r.noteRemember({ text: 'A wren is a bird.', clause: clause }, f);
    const no = r.peerStretch(kept.fact_id, 'stranger');
    r.pair('friend', 'ab'.repeat(32));
    const yes = r.peerStretch(kept.fact_id, 'friend');
    const twice = r.peerStretch(kept.fact_id, 'friend');
    const key = 'cd'.repeat(32);
    const trip = A.roundTrip([1, 2, 3, 4, 5, 6, 7, 8, 9], key);
    const bare = A.frame(0x10, [1, 2, 3], {});
    expect(no.rule === 'RKM-PEER-UNPAIRED' && yes.ok && yes.publisher === false && twice.rule === 'RKM-PEER-WINDOW' && trip.ok && bare.rule === 'RKM-MAC-REQUIRED' && R.structureFp === R.structureHash.slice(0, 8), JSON.stringify({ no, yes, twice, trip, bare: bare.rule, fp: R.structureFp }));
  });
}
module.exports = register;
if (require.main === module) {
  const results = [];
  register((cls, name, fn) => { let ok = false, why = ''; try { fn(); ok = true; } catch (e) { why = String(e.message || e).slice(0, 500); } results.push({ cls, name, ok, why }); }, (c, m) => { if (!c) throw new Error(m || 'fail'); });
  console.log(JSON.stringify(results, null, 1));
  if (results.some(r => !r.ok)) process.exit(1);
}
