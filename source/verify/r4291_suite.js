/* 4.9.292: a follow-up is abduction, action, prediction over an admitted mechanism. */
const path = require('path');
const fs = require('fs');
const ROOT = path.join(__dirname, '..');
const M = require(ROOT + '/src/mechanisms.js');
function law() {
  return {
    status: 'admitted', fact: false, solver: 'mujoco_wasm',
    expression: '(fraction*height*mu)/radius',
    variables: ['fraction', 'height', 'mu', 'radius'],
    threshold: 1, above: 'topple', below: 'slide',
    range: {
      fraction: { min: 0.2, max: 0.9, unit: '1' },
      height: { min: 0.2, max: 0.4, unit: 'm' },
      mu: { min: 0.2, max: 0.5, unit: '1' },
      radius: { min: 0.03, max: 0.06, unit: 'm' }
    },
    atom: { predicate: 'exceed', args: ['(fraction*height*mu)/radius', '1'] }
  };
}
function values(fraction) {
  return {
    fraction: { value: fraction, unit: '1' },
    height: { value: 0.3, unit: 'm' },
    mu: { value: 0.35, unit: '1' },
    radius: { value: 0.045, unit: 'm' }
  };
}
function register(C, expect) {
  C('R4291', 'a counterfactual is abduction, then the action, then the mechanism prediction', () => {
    const row = law();
    const got = M.counterfactual(row, values(0.4), values(0.8));
    expect(got.fact === false && got.may_store_as_fact === false && got.steps.join(',') === 'abduction,action,prediction', JSON.stringify(got.steps));
    expect(got.abduction.applied === true && got.abduction.outcome === 'slide' && got.abduction.value < 1, JSON.stringify(got.abduction));
    expect(got.action.do.length === 1 && got.action.do[0].name === 'fraction' && got.action.do[0].from === 0.4 && got.action.do[0].to === 0.8 && got.action.do[0].unit === '1', JSON.stringify(got.action));
    expect(got.prediction.applied === true && got.prediction.outcome === 'topple' && got.prediction.value > 1 && got.prediction.fact === false, JSON.stringify(got.prediction));
    const far = M.counterfactual(row, values(0.4), values(0.05));
    expect(far.abduction.outcome === 'slide' && far.prediction.applied === false && far.prediction.reason === 'out_of_range' && far.action.do[0].to === 0.05, JSON.stringify(far.prediction));
    const src = fs.readFileSync(path.join(ROOT, 'src/sim_device.js'), 'utf8');
    const body = src.slice(src.indexOf('async function simulate'), src.indexOf('function propertyHold'));
    expect(body.indexOf('continued = true') >= 0 && body.indexOf('KMechanisms.counterfactual') > body.indexOf('continued = true'), 'the follow-up builds the three steps');
    expect(fs.readFileSync(path.join(ROOT, 'src/app.js'), 'utf8').includes('data-counterfactual'), 'label');
  });
}
module.exports = register;
if (require.main === module) {
  const results = [];
  register((cls, name, fn) => { let ok = false, why = ''; try { fn(); ok = true; } catch (e) { why = String(e.message || e).slice(0, 800); } results.push({ cls, name, ok, why }); }, (c, m) => { if (!c) throw new Error(m || 'fail'); });
  console.log(JSON.stringify(results, null, 1));
  if (results.some(r => !r.ok)) process.exit(1);
}
