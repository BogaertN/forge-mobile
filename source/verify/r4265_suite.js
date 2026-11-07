/* R4265 (4.9.249): a math wrapper is the operation frame, and a cabinet keeps its stated axes.
 * can/could you in front of an operation asks for the calculation. The same words in front of
 * another verb do not. A missing depth is not filled from height or width. */
const cp = require('child_process');
const path = require('path');
const A = require('./ask_path.js');
const Q = require('../src/qframe.js');
const ROOT = path.join(__dirname, '..');
function register(C, expect) {
  C('LC-NO-ROUTES', 'a wrapper computes the operation and does not write', () => {
    const rows = [
      ['what is the derivative of x^2', /is 2x\./, '2x'],
      ['could you differentiate x^3', /is 3x\^2\./, '3x^2'],
      ['d/dx x^3', /is 3x\^2\./, '3x^2'],
      ['please solve 2x+3=7', /gives x = 2\./, 'x = 2'],
      ['solve the system x+y=3, x-y=1', /x = 2 and y = 1/, 'x = 2 and y = 1'],
      ['can you convert 5 km to m', /5 km is 5000 m\./, '5000 m']
    ];
    for (const [q, re, value] of rows) {
      const s = A.session();
      const frame = Q.compile(q, A.kernel());
      const r = A.ask(s, q);
      const text = r.computed && r.computed.receipt && r.computed.receipt.result && r.computed.receipt.result.text;
      expect(frame.mood === 'operation' && frame.speech_act === 'compute' && re.test(r.reply || '') && text === value && r.computed.status === 'ok' && r.echo && r.echo.pass === true && s.phone.length === 0, q + ' ' + (r.reply || r.route));
    }
    const polite = Q.compile('could you differentiate x^3', A.kernel());
    const asked = Q.compile('can you convert 5 km to m', A.kernel());
    expect(polite.modality === 'possible' && asked.modality === 'able' && asked.op === 'convert', 'the modal was dropped');
    const fly = A.ask(A.session(), 'can you fly a plane');
    expect(fly.product_reply !== true && fly.computed == null && !/yes/i.test(fly.reply || ''), fly.reply);
    const half = A.ask(A.session(), 'solve the system x+y=3');
    expect(half.product_reply !== true && half.computed && half.computed.status === 'unparsed' && !/y = /.test(half.reply || ''), half.computed && half.computed.status);
  });
  C('LC-NO-ROUTES', 'a stated cabinet keeps high, wide, and deep, and a missing depth holds', () => {
    const open = 'What happens if you push a 12 kilogram cabinet 1.8 meters high and 0.9 meters wide near the top?';
    const shut = 'What happens if you push a 12 kilogram cabinet 1.8 meters high and 0.9 meters wide and 0.4 meters deep near the top?';
    const k = A.kernel();
    const code = `import json,sys
from rmc_engine_v1.sim_device import plan, tip_check
rows=json.load(sys.stdin)
out=[]
for q,fr in rows:
    p=plan(q, fr)
    sc=p.get("scene") if isinstance(p.get("scene"), dict) else {}
    body=sc.get("body") if isinstance(sc.get("body"), dict) else {}
    chk=tip_check(sc) if sc.get("action")=="push" else None
    out.append({"ok":p.get("ok"),"reason":p.get("reason"),"missing":p.get("missing"),"h":body.get("height"),"w":body.get("width"),"d":body.get("depth"),"m":body.get("mass"),"noun":body.get("noun"),"outcome":(chk or {}).get("outcome"),"defaulted":sc.get("defaulted")})
print(json.dumps(out))`;
    const run = cp.spawnSync(process.env.PYTHON || 'python3', ['-c', code], {
      cwd: ROOT, encoding: 'utf8', input: JSON.stringify([[open, Q.compile(open, k)], [shut, Q.compile(shut, k)]]),
      env: Object.assign({}, process.env, { PYTHONPATH: path.join(ROOT, 'engine') })
    });
    expect(run.status === 0, (run.stderr || '').slice(-400));
    const [miss, full] = JSON.parse(run.stdout);
    expect(miss.ok === false && miss.reason === 'property_missing' && miss.missing === 'depth' && miss.d == null, JSON.stringify(miss));
    expect(full.ok === true && full.noun === 'cabinet' && full.h === 1.8 && full.w === 0.9 && full.d === 0.4 && full.m === 12 && full.outcome === 'topple' && JSON.stringify(full.defaulted) === '["shape"]', JSON.stringify(full));
    const s = A.session();
    A.ask(s, open); A.ask(s, shut);
    expect(s.phone.length === 0, 'a simulation question wrote');
  });
}
module.exports = register;
if (require.main === module) {
  const results = [];
  register((cls, name, fn) => { let ok = false, why = ''; try { fn(); ok = true; } catch (e) { why = String(e.message || e).slice(0, 500); } results.push({ cls, name, ok, why }); }, (c, m) => { if (!c) throw new Error(m || 'fail'); });
  console.log(JSON.stringify(results, null, 1));
  if (results.some(r => !r.ok)) process.exit(1);
}
