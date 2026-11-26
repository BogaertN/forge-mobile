/* Experimental visual of an RKM packet. The plate is a sum of cosines at the packet's carrier
 * frequencies. It is not a measurement and it does not decode the packet. A future condenser or
 * piezo diaphragm can take the same frequency list; this build does not drive one. */
(function (root) {
  const isNode = typeof module !== 'undefined' && module.exports;
  const LABEL = 'experimental';
  function carriers(packet) {
    const hz = [];
    const push = n => { const x = Number(n); if (x > 0 && hz.indexOf(x) < 0) hz.push(x); };
    if (packet) {
      push(packet.root_frequency_hz);
      (packet.music || []).forEach(n => push(n && (n.hz || n.frequency)));
      const mem = packet.forge_memory;
      (mem && mem.records || []).forEach(r => push(r && r.address && r.address.carrier_hz));
    }
    if (!hz.length) push(144);
    return hz.sort((a, b) => a - b);
  }
  function plate(packet, n) {
    /* The displacement is the hfield-cymatics reader-surface sum:
     * sin(2π · (hz/root) · t + x·π·(1+frac(hz/root)·4)), then signed_sum/sqrt(n)·0.42.
     * Visual only. It does not decode the packet. */
    const size = n || 48;
    const tones = carriers(packet);
    const root = tones[0] || 144;
    const timeMs = 250;
    const seconds = timeMs / 1000;
    const norm = Math.sqrt(tones.length) || 1;
    const grid = [];
    for (let y = 0; y < size; y++) {
      const row = [];
      const yy = y / (size - 1);
      for (let x = 0; x < size; x++) {
        const xx = x / (size - 1);
        let signed = 0;
        tones.forEach(hz => {
          const ratio = hz / Math.max(root, 1);
          const spatial = xx * Math.PI * (1 + ((ratio % 1) * 4));
          const wave = Math.sin(2 * Math.PI * ratio * seconds + yy * Math.PI + spatial);
          signed += wave;
        });
        const displacement = Math.max(-0.9, Math.min(0.9, (signed / norm) * 0.42));
        row.push(Math.round(displacement * 1000) / 1000);
      }
      grid.push(row);
    }
    return { label: LABEL, decodes: false, carriers: tones, grid: grid, calls_llm: false, source: 'hfield-cymatics reader surface' };
  }
  /* Extension point. A condenser or piezo diaphragm would subscribe here. Nothing is connected. */
  const transducer = { status: 'not_connected', kind: 'condenser_or_piezo', drive: null };
  function mount(doc) {
    if (!doc || doc.getElementById('rkmCymatic')) return;
    const panel = doc.getElementById('rkmPanel');
    if (!panel) return;
    const el = doc.createElement('div');
    el.id = 'rkmCymatic';
    el.innerHTML = '<div class="small" data-cymatic-label="experimental">Cymatic plate · experimental · not a decoding</div><canvas id="rkmPlate" width="160" height="160"></canvas>';
    panel.appendChild(el);
    const canvas = doc.getElementById('rkmPlate');
    const draw = () => {
      const live = root.KRKMLive;
      const pkt = live && live.exportPacket ? live.exportPacket() : { root_frequency_hz: 144, music: [{ hz: 144 }] };
      const pic = plate(pkt, 40);
      const ctx = canvas.getContext('2d');
      const g = pic.grid, w = canvas.width, h = canvas.height;
      const img = ctx.createImageData(w, h);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const v = g[Math.floor(y * g.length / h)][Math.floor(x * g.length / w)];
        const ink = Math.abs(v) < 0.08 ? 240 : Math.round(20 + 80 * Math.abs(v));
        const k = (y * w + x) * 4;
        img.data[k] = ink; img.data[k + 1] = ink; img.data[k + 2] = ink + 10; img.data[k + 3] = 255;
      }
      ctx.putImageData(img, 0, 0);
    };
    draw();
    const exp = doc.getElementById('rkmExport');
    if (exp) exp.addEventListener('click', () => setTimeout(draw, 0));
  }
  const api = { LABEL, carriers, plate, transducer, mount, calls_llm: false };
  if (isNode) module.exports = api;
  else {
    root.KRKMCymatic = api;
    const go = () => mount(root.document);
    if (root.document) { if (root.document.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', go); else go(); }
  }
})(typeof self !== 'undefined' ? self : this);
