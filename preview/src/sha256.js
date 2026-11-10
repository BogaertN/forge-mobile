/* Minimal synchronous SHA-256 (pure JS) used for ψ_id. RSOC §2.1 specifies BLAKE3;
 * BLAKE3 is not available offline in a no-dependency browser build, so SHA-256 is substituted (noted in trace). */
(function (root) {
function sha256(str) {
  const K = [0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];
  const bytes = []; const s = unescape(encodeURIComponent(str)); for (let i = 0; i < s.length; i++) bytes.push(s.charCodeAt(i));
  const l = bytes.length * 8; bytes.push(0x80); while (bytes.length % 64 !== 56) bytes.push(0);
  for (let i = 7; i >= 0; i--) bytes.push(i > 3 ? 0 : (l >>> (i * 8)) & 0xff);
  let H = [0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19];
  const W = new Array(64); const rotr = (x, n) => (x >>> n) | (x << (32 - n));
  for (let o = 0; o < bytes.length; o += 64) {
    for (let i = 0; i < 16; i++) W[i] = (bytes[o+4*i] << 24) | (bytes[o+4*i+1] << 16) | (bytes[o+4*i+2] << 8) | bytes[o+4*i+3];
    for (let i = 16; i < 64; i++) { const s0 = rotr(W[i-15],7)^rotr(W[i-15],18)^(W[i-15]>>>3), s1 = rotr(W[i-2],17)^rotr(W[i-2],19)^(W[i-2]>>>10); W[i] = (W[i-16]+s0+W[i-7]+s1)|0; }
    let [a,b,c,d,e,f,g,h] = H;
    for (let i = 0; i < 64; i++) { const S1 = rotr(e,6)^rotr(e,11)^rotr(e,25), ch = (e&f)^(~e&g), t1 = (h+S1+ch+K[i]+W[i])|0, S0 = rotr(a,2)^rotr(a,13)^rotr(a,22), mj = (a&b)^(a&c)^(b&c), t2 = (S0+mj)|0; h=g; g=f; f=e; e=(d+t1)|0; d=c; c=b; b=a; a=(t1+t2)|0; }
    H = [H[0]+a|0,H[1]+b|0,H[2]+c|0,H[3]+d|0,H[4]+e|0,H[5]+f|0,H[6]+g|0,H[7]+h|0];
  }
  return H.map(x => (x >>> 0).toString(16).padStart(8, '0')).join('');
}
if (typeof module !== 'undefined' && module.exports) module.exports = { sha256 }; else root.KSha = { sha256 };
})(this);
