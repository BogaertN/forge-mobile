# Adds a WordNet 3.0 noun hypernym table (H) and synset head-words (N) to data/lexicon.json (core tier only).
# H[id] = [hypernym ids] using pointers "@" (hypernym) and "@i" (instance hypernym). Deterministic; WordNet 3.0 licence.
import json, gzip, sys, os
WN = sys.argv[1] if len(sys.argv) > 1 else '/workspace/lexbuild/wordnet'
LEX = os.path.join(os.path.dirname(__file__), '..', 'data', 'lexicon.json')
hyp, head = {}, {}
for line in open(os.path.join(WN, 'data.noun'), encoding='latin-1'):
    if line.startswith(' '): continue
    p = line.split(' | ')[0].split()
    off = p[0] + 'n'; wc = int(p[3], 16); words = [p[4 + 2 * i] for i in range(wc)]
    head[off] = words[0].lower().replace('_', ' ')
    i = 4 + 2 * wc; pc = int(p[i]); i += 1; hs = []
    for k in range(pc):
        sym, tgt, pos = p[i], p[i + 1], p[i + 2]; i += 4
        if sym in ('@', '@i') and pos == 'n': hs.append(tgt + 'n')
    hyp[off] = hs
d = json.load(open(LEX))
seeds = [s[0] for e in d['L'].values() for (pos, ss, *_) in e if pos == 'n' for s in ss]
H, N, stack = {}, {}, list(seeds)
while stack:
    x = stack.pop()
    if x in H or x not in hyp: continue
    H[x] = hyp[x]; N[x] = head[x]; stack.extend(hyp[x])
d['H'] = H; d['N'] = N
d['meta']['hypernyms'] = 'WordNet 3.0 noun hypernym (@) and instance-hypernym (@i) closure for core-tier noun senses: %d synsets' % len(H)
s = json.dumps(d, separators=(',', ':'), ensure_ascii=False)
open(LEX, 'w').write(s); gzip.open(LEX + '.gz', 'wb', 9).write(s.encode())
print(len(H), len(s))
# extended tier: closure for ext noun senses not already covered by core H
EXT = os.path.join(os.path.dirname(__file__), '..', 'data', 'lexicon-ext.json')
e = json.load(open(EXT)); seeds = [s[0] for en in e['L'].values() for (pos, ss, *_) in en if pos == 'n' for s in ss]
HE, NE, stack = {}, {}, list(seeds)
while stack:
    x = stack.pop()
    if x in HE or x in H or x not in hyp: continue
    HE[x] = hyp[x]; NE[x] = head[x]; stack.extend(hyp[x])
e['H'] = HE; e['N'] = NE
e['meta']['hypernyms'] = 'WordNet 3.0 noun hypernym closure for extended-tier senses not in core: %d synsets' % len(HE)
s = json.dumps(e, separators=(',', ':'), ensure_ascii=False)
open(EXT, 'w').write(s); gzip.open(EXT + '.gz', 'wb', 9).write(s.encode())
print('ext', len(HE), len(s))
