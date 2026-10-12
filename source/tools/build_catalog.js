// Generated command / route catalog (Capability Register B-11): frames from the kernel source, bench tools, permission actions, node ops.
const fs = require('fs'); const path = require('path'); const ROOT = path.join(__dirname, '..');
function build() { const k = fs.readFileSync(ROOT + '/src/kernel.js', 'utf8'); const frames = Array.from(new Set(k.match(/FR\.[A-Z][A-Z0-9_.]*[A-Z0-9]/g))).sort();
  const TB = require(ROOT + '/src/toolbench.js'); const GV = require(ROOT + '/src/governance.js'); const node = fs.readFileSync(ROOT + '/tools/forge_node.py', 'utf8'); const ops = (node.match(/OPS = \(([^)]*)\)/)[1].match(/"([a-z.]+)"/g) || []).map(s => s.slice(1, -1));
  const tools = TB.MANIFESTS.map(m => ({ id: m.id, frames: m.frames, effect: m.effect, side_effects: m.side_effects, network: !!m.network }));
  return { schema: 'forge-command-catalog/v1', generated_from: ['src/kernel.js', 'src/toolbench.js', 'src/governance.js', 'tools/forge_node.py'], frames, tools, permission_actions: Object.keys(GV.ACTIONS).sort(), node_ops: ops, switches: Object.keys(GV.SWITCHES).sort() }; }
if (require.main === module) { fs.writeFileSync(ROOT + '/data/command_catalog.json', JSON.stringify(build(), null, 1)); console.log('catalog written'); }
module.exports = { build };
