# PROPER-NOUN FLAG (4.9.92): WordNet writes a proper noun with its capital in the synset ("Jupiter", "Lena"); the lexicon tiers store lemmas
# lowercased, so the flag is recorded separately: P = the tier's lemmas whose every WordNet word form is capitalised (no common-noun, verb,
# adjective or adverb form). The grammar keeps such a word a name at the start of a sentence. WordNet 3.0 licence.
import json, gzip, base64, os, sys, collections
WN = sys.argv[1] if len(sys.argv) > 1 else '/workspace/wn/dict'
D = os.path.join(os.path.dirname(__file__), '..', 'data'); B = os.path.join(os.path.dirname(__file__), '..', '..', 'data')
cap, low = collections.Counter(), collections.Counter()
for f in ('data.noun', 'data.verb', 'data.adj', 'data.adv'):
    for line in open(os.path.join(WN, f), encoding='latin-1'):
        if line.startswith('  '): continue
        t = line.split('|', 1)[0].split(); nw = int(t[3], 16)
        for k in range(nw):
            w = t[4 + 2 * k].split('(')[0]
            if '_' in w: continue
            (cap if f == 'data.noun' and w[:1].isupper() and w[1:] == w[1:].lower() else low)[w.lower()] += 1
P = {w for w in cap if not low[w]}
for name in ('lexicon', 'lexicon-ext', 'lexicon-pro'):
    p = os.path.join(D, name + '.json'); d = json.load(open(p))
    d['P'] = sorted(w for w in d['L'] if w in P)
    s = json.dumps(d, ensure_ascii=False, separators=(',', ':')).encode('utf-8'); open(p, 'wb').write(s)
    gz = gzip.compress(s, 9, mtime=0); open(p + '.gz', 'wb').write(gz)
    open(os.path.join(B, name + '.json.gz.b64'), 'w').write(base64.b64encode(gz).decode('ascii'))
    print(name, len(d['P']), 'proper-only lemmas')
