// node --experimental-websocket tools/headless_live.js <url> <outdir>  — raw CDP, no npm deps
const { spawn } = require('child_process'); const fs = require('fs'); const http = require('http');
const url = process.argv[2], out = process.argv[3]; fs.mkdirSync(out, { recursive: true });
const ch = spawn('google-chrome', ['--headless=new', '--no-sandbox', '--disable-gpu', '--remote-debugging-port=9333', '--window-size=412,915', '--user-data-dir=/tmp/hc-' + Date.now(), 'about:blank'], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const getJSON = u => new Promise((res, rej) => http.get(u, r => { let d = ''; r.on('data', c => d += c); r.on('end', () => { try { res(JSON.parse(d)); } catch (e) { rej(e); } }); }).on('error', rej));
(async () => { let tabs; for (let i = 0; i < 40; i++) { try { tabs = await getJSON('http://127.0.0.1:9333/json'); break; } catch (e) { await sleep(250); } }
  const ws = new WebSocket(tabs.find(t => t.type === 'page').webSocketDebuggerUrl); await new Promise(r => ws.onopen = r); let id = 0; const pend = {}; const logs = [];
  ws.onmessage = m => { const d = JSON.parse(m.data); if (d.id && pend[d.id]) { pend[d.id](d); delete pend[d.id]; } if (d.method === 'Runtime.exceptionThrown') logs.push('EXC ' + JSON.stringify(d.params.exceptionDetails).slice(0, 300)); if (d.method === 'Runtime.consoleAPICalled' && d.params.type === 'error') logs.push('ERR ' + JSON.stringify(d.params.args).slice(0, 300)); };
  const send = (method, params) => new Promise(r => { const i = ++id; pend[i] = r; ws.send(JSON.stringify({ id: i, method, params: params || {} })); });
  const ev = async e => { const r = await send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true }); return r.result && r.result.result ? r.result.result.value : r; };
  const shot = async n => { const r = await send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(out + '/' + n + '.png', Buffer.from(r.result.data, 'base64')); };
  await send('Runtime.enable'); await send('Page.enable'); await send('Emulation.setDeviceMetricsOverride', { width: 412, height: 915, deviceScaleFactor: 2, mobile: true });
  await send('Page.navigate', { url }); await sleep(5000);
  const r = await ev(`(async () => { localStorage.clear(); window.say('differentiate sin(x)*x^2'); await new Promise(r => setTimeout(r, 300)); window.KUI.openTab('echoforge'); await new Promise(r => setTimeout(r, 200));
    document.getElementById('pyCheck').click(); for (let i = 0; i < 240; i++) { const t = document.getElementById('pyMsg').textContent; if (!/loading/.test(t) && t) break; await new Promise(r => setTimeout(r, 500)); } const a = document.getElementById('pyMsg').textContent;
    document.getElementById('pyRmc').click(); for (let i = 0; i < 120; i++) { const t = document.getElementById('pyMsg').textContent; if (!/loading/.test(t) && t) break; await new Promise(r => setTimeout(r, 500)); } return JSON.stringify({ check: a, rmc: document.getElementById('pyMsg').textContent }); })()`);
  console.log(r, JSON.stringify(logs)); ws.close(); ch.kill(); process.exit(0); })();
