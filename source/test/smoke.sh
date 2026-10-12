#!/bin/sh
# Headless-Chrome smoke test: (1) kernel-app-full.html from file:// (inlined lexicon), (2) kernel-app.html + sidecar lexicon over http
set -e
cd "$(dirname "$0")/.."
INJ='<script>window.addEventListener("load",()=>{const qs=["remember that my sister lives in Paris","remember that she works at a bank","where does my sister live?","define bank","2","solve x^2 - 5x + 6 = 0","convert 5 km to miles","say hello"];let i=0;const tick=()=>{const b=document.querySelector("#lexBadge").textContent;if(!/core/.test(b)){return setTimeout(tick,200);}if(i<qs.length){document.querySelector("#q").value=qs[i++];document.querySelector("#f").dispatchEvent(new Event("submit",{cancelable:true}));return setTimeout(tick,100);}setTimeout(()=>{const out=[...document.querySelectorAll("#log .msg.bot > div:not(.tr)")].map(d=>d.textContent);const p=document.createElement("pre");p.id="SMOKE";p.textContent=JSON.stringify({badge:document.querySelector("#lexBadge").textContent,replies:out,traces:document.querySelectorAll("details").length});document.body.appendChild(p);},1500);};tick();});</script>'
export INJ
for F in kernel-app-full.html kernel-app.html; do
  python3 -c "import os,sys;s=open(sys.argv[1]).read();open('/tmp/smoke-'+sys.argv[1],'w').write(s.replace('</body>',os.environ['INJ']+'</body>'))" $F
done
cp /tmp/smoke-kernel-app.html ./smoke-served.html
google-chrome --headless=new --no-sandbox --disable-gpu --allow-file-access-from-files --virtual-time-budget=20000 --dump-dom file:///tmp/smoke-kernel-app-full.html 2>/dev/null | grep -o '<pre id="SMOKE">.*</pre>' > /tmp/smoke1.txt || true
(python3 -m http.server 8765 >/dev/null 2>&1 &) ; sleep 1
google-chrome --headless=new --no-sandbox --disable-gpu --virtual-time-budget=20000 --dump-dom http://localhost:8765/smoke-served.html 2>/dev/null | grep -o '<pre id="SMOKE">.*</pre>' > /tmp/smoke2.txt || true
pkill -f "http.server 8765" || true; rm -f smoke-served.html
echo "FULL (file://):"; cat /tmp/smoke1.txt; echo; echo "SERVED (http + sidecar):"; cat /tmp/smoke2.txt
