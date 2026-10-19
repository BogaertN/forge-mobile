/* runs verify/world_state_suite.js (or the suite named in argv[2], e.g. relprop_guard_suite.js) standalone (as run.js does) and prints its rows; used by tools/mea_eval.js under mea_preload.js */
const path = require('path'), ROOT = path.join(__dirname, '..'); const { Kernel } = require(ROOT + '/src/kernel.js'); const LEX = require(ROOT + '/data/lexicon.json'), EXT = require(ROOT + '/data/lexicon-ext.json');
const rows = [], expect = (c, m) => { if (!c) throw new Error(m); }, K = () => Kernel({ clock: () => '2026-10-11T20:45:00Z', lexicon: LEX, lexiconExt: EXT });
const C = (cls, name, fn) => { let ok = false; try { const r = fn(); ok = r === true || r === undefined; } catch (e) { ok = false; } rows.push({ cls, name, ok }); };
require(ROOT + '/verify/' + (process.argv[2] || 'world_state_suite.js'))({ C, expect, K, ROOT, growth: process.argv[3] === 'growth' }); process.stdout.write(JSON.stringify(rows));
