// node --experimental-websocket test/cdp-shots.js <url> <outdir> [mobile]
// Headless Chrome via CDP: loads the app, waits for the full lexicon, runs a sample chat, checks manifest + service worker, screenshots every tab.
const { spawn } = require('child_process'); const fs = require('fs'); const http = require('http');
const [url, out = 'screens'] = process.argv.slice(2); fs.mkdirSync(out, { recursive: true });
const port = 9333; const chrome = spawn('google-chrome', ['--headless=new', '--no-sandbox', '--disable-gpu', '--remote-debugging-port=' + port, '--user-data-dir=/tmp/cdp-prof-' + Date.now(), 'about:blank'], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const getJSON = u => new Promise((res, rej) => http.get(u, r => { let d = ''; r.on('data', c => d += c); r.on('end', () => { try { res(JSON.parse(d)); } catch (e) { rej(e); } }); }).on('error', rej));
(async () => { let tabs; for (let i = 0; i < 50; i++) { try { tabs = await getJSON('http://127.0.0.1:' + port + '/json'); break; } catch (e) { await sleep(200); } }
  const page = tabs.find(t => t.type === 'page'); const ws = new WebSocket(page.webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
  let id = 0; const pend = {}; const errors = []; ws.onmessage = m => { const d = JSON.parse(m.data); if (d.id && pend[d.id]) { pend[d.id](d); delete pend[d.id]; } if (d.method === 'Runtime.exceptionThrown') errors.push(d.params.exceptionDetails.exception ? d.params.exceptionDetails.exception.description : d.params.exceptionDetails.text); if (d.method === 'Runtime.consoleAPICalled' && d.params.type === 'error') errors.push(d.params.args.map(a => a.value || a.description).join(' ')); };
  const send = (method, params = {}) => new Promise(r => { id++; pend[id] = r; ws.send(JSON.stringify({ id, method, params })); });
  const ev = async (expr) => { const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }); return r.result && r.result.result ? r.result.result.value : r; };
  await send('Runtime.enable'); await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 412, height: 915, deviceScaleFactor: 2, mobile: true }); await send('Emulation.setUserAgentOverride', { userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36' });
  await send('Page.navigate', { url }); 
  let st; for (let i = 0; i < 150; i++) { await sleep(300); st = await ev('window.LEX_STATE ? JSON.stringify(window.LEX_STATE) : null'); if (st && /"ext":"(ok|unavailable)"/.test(st)) break; }
  const report = { url, lexicon: st, badge: await ev('document.querySelector("#lexBadge").textContent') };
  const chat = ['remember that my sister lives in Paris', 'remember that Paris is in France', 'does my sister live in France?', 'remember that my dog is a poodle', 'is my dog an animal?', 'the cake was eaten by my brother', 'solve 2x^2 + 3x - 1 = 0', 'factor x^2 - 5x + 6', 'define bank', 'forge-command-implement x', 'remember that my pin is 4321', 'forget that my dog is a poodle', 'yes'];
  report.chat = []; for (const q of chat) report.chat.push({ q, a: await ev('(()=>{const r=window.say(' + JSON.stringify(q) + ');return r?(r.reply||("BLOCKED: "+r.block_reason)):"queued"})()') });
  report.manifest = await ev('fetch("manifest.json").then(r=>r.ok?r.json():null).then(j=>j&&j.name).catch(()=>null)');
  report.sw = await ev('navigator.serviceWorker ? navigator.serviceWorker.getRegistrations().then(rs=>rs.length+" registration(s); controller "+(!!navigator.serviceWorker.controller)) : "no sw api"');
  report.audit = await ev('JSON.stringify(window.forge.verifyAudit())');
  const shot = async name => { await sleep(400); const r = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false }); fs.writeFileSync(out + '/' + name + '.png', Buffer.from(r.result.data, 'base64')); };
  await ev('window.scrollTo(0,0)'); await shot('01-forge-output'); await ev('document.querySelector("#log").lastElementChild.scrollIntoView()'); await shot('01b-forge-output-chat');
  const tabsList = [['protoforge', '02-protoforge'], ['vault', '03-identity-vault'], ['echoforge', '04-echoforge-disabled'], ['memory', '05-rmc-memory'], ['dryrun', '06-deep-dry-run'], ['library', '07-context-library'], ['audit', '08-audit-receipts'], ['status', '09-system-status']];
  for (const [t, n] of tabsList) { await ev('window.openTab(' + JSON.stringify(t) + ')'); if (t === 'dryrun') await ev('document.querySelector("#scen button:nth-child(2)").click()'); if (t === 'library') await ev('(()=>{const i=document.querySelector("#lexFilter");i.value="bank";i.oninput()})()'); await shot(n); }
  await ev('window.openTab("output");document.querySelector("#railBtn").click()'); await shot('10-left-rail');
  report.errors = errors; fs.writeFileSync(out + '/report.json', JSON.stringify(report, null, 1)); console.log(JSON.stringify(report, null, 1));
  ws.close(); chrome.kill(); process.exit(0); })().catch(e => { console.error(e); chrome.kill(); process.exit(1); });
