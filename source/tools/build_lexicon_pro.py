# Professional/complete tier (4.9.50): every remaining single-word Princeton WordNet 3.0 lemma not in the core or extended tier
# (medical, legal, engineering and rare common words), the first sense per POS, plus the noun-hypernym closure for those senses.
# Same entry shape as the other tiers; lazily loaded; Doc 8 state 'admitted-complete (lowest assurance)'. WordNet 3.0 licence.
import json, gzip, re, sys, os, collections
WN = sys.argv[1] if len(sys.argv) > 1 else '/workspace/wn/dict'
D = os.path.join(os.path.dirname(__file__), '..', 'data')
core = json.load(open(os.path.join(D, 'lexicon.json'))); ext = json.load(open(os.path.join(D, 'lexicon-ext.json')))
syn, hyp, head = {}, {}, {}
for f, p in [('data.noun', 'n'), ('data.verb', 'v'), ('data.adj', 'a'), ('data.adv', 'r')]:
    for line in open(os.path.join(WN, f), encoding='latin-1'):
        if line.startswith('  '): continue
        h, gloss = line.split('|', 1); t = h.split(); off = t[0]; lex = int(t[1]); ss = t[2]
        nw = int(t[3], 16); words = [t[4 + 2 * k] for k in range(nw)]; i = 4 + 2 * nw; npt = int(t[i]); i += 1; hs = []
        for k in range(npt):
            sym, tgt, pos = t[i], t[i + 1], t[i + 2]; i += 4
            if p == 'n' and sym in ('@', '@i') and pos == 'n': hs.append(tgt + 'n')
        fr = []
        if p == 'v' and i < len(t):
            nf = int(t[i]); i += 1
            for k in range(nf): fr.append(int(t[i + 1])); i += 3
        key = off + ('a' if ss == 's' else ss)
        syn[key] = (lex, gloss.strip().split(';')[0].strip()[:64], sorted(set(fr)))
        if p == 'n': hyp[key] = hs; head[key] = words[0].lower().replace('_', ' ')
senses = collections.defaultdict(list)
for line in open(os.path.join(WN, 'index.sense')):
    key, off, sn, tc = line.split(); lemma, rest = key.split('%'); st = int(rest.split(':')[0]); p = {1: 'n', 2: 'v', 3: 'a', 4: 'r', 5: 'a'}[st]
    if not re.fullmatch(r"[a-z][a-z\-]*[a-z]", lemma) or len(lemma) > 22: continue
    senses[(lemma, p)].append((int(sn), off + p))
X = {}
for (lemma, p), ss in sorted(senses.items()):
    if any(e[0] == p for t in (core, ext) for e in t['L'].get(lemma, [])): continue  # a part of speech the core/ext tiers lack (deliberate: adj there, verb here) is added
    ss = sorted(set(ss))
    out = [[k, syn[k][0], syn[k][1], ''.join(chr(48 + x) for x in syn[k][2])] for sn, k in ss[:1] if k in syn]
    if out: X.setdefault(lemma, []).append([p, out, max(0, len(ss) - 1)])
have = set(core['H']) | set(ext['H']); H, N = {}, {}
stack = [s[0] for e in X.values() for (pos, ss, *_) in e if pos == 'n' for s in ss]
while stack:
    x = stack.pop()
    if x in H or x in have or x not in hyp: continue
    H[x] = hyp[x]; N[x] = head[x]; stack.extend(hyp[x])
meta = {'source': 'Princeton WordNet 3.0', 'license': core['meta']['license'], 'tier': 'complete (every remaining single-word lemma and part of speech; first sense per POS; lowest assurance)', 'lemmas': len(X), 'hypernyms': len(H)}
s = json.dumps({'meta': meta, 'L': X, 'H': H, 'N': N}, separators=(',', ':'), ensure_ascii=False)
open(os.path.join(D, 'lexicon-pro.json'), 'w').write(s); gzip.GzipFile(os.path.join(D, 'lexicon-pro.json.gz'), 'wb', 9, mtime=0).write(s.encode())  # deterministic bytes
print(len(X), len(H), len(s), len(gzip.compress(s.encode(), 9)))
