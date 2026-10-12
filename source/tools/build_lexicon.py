# Build a controlled lexicon from Princeton WordNet 3.0 (WordNet 3.0 License — permissive, notice retained).
# Doc 8 governance: every entry carries provenance+license; senses with corpus tag count > 0 are ADMITTED,
# the remainder are QUARANTINED (counted, not used for meaning).
import json, re, gzip, collections
W='wordnet/'
lexnames=[l.split()[1] for l in open(W+'lexnames')]
FRAMES={1:'Something ----s',2:'Somebody ----s',3:'It is ----ing',4:'Something is ----ing PP',5:'Something ----s something Adjective/Noun',6:'Something ----s Adjective/Noun',7:'Somebody ----s Adjective',8:'Somebody ----s something',9:'Somebody ----s somebody',10:'Something ----s somebody',11:'Something ----s something',12:'Something ----s to somebody',13:'Somebody ----s on something',14:'Somebody ----s somebody something',15:'Somebody ----s something to somebody',16:'Somebody ----s something from somebody',17:'Somebody ----s somebody with something',18:'Somebody ----s somebody of something',19:'Somebody ----s something on somebody',20:'Somebody ----s somebody PP',21:'Somebody ----s something PP',22:'Somebody ----s PP',23:"Somebody's (body part) ----s",24:'Somebody ----s somebody to INFINITIVE',25:'Somebody ----s somebody INFINITIVE',26:'Somebody ----s that CLAUSE',27:'Somebody ----s to somebody',28:'Somebody ----s to INFINITIVE',29:'Somebody ----s whether INFINITIVE',30:'Somebody ----s somebody into V-ing something',31:'Somebody ----s something with something',32:'Somebody ----s INFINITIVE',33:'Somebody ----s VERB-ing',34:'It ----s that CLAUSE',35:'Something ----s INFINITIVE'}
PM={'n':'noun','v':'verb','a':'adj','s':'adj','r':'adv'}
syn={}
for f,p in [('data.noun','n'),('data.verb','v'),('data.adj','a'),('data.adv','r')]:
    for line in open(W+f,encoding='latin-1'):
        if line.startswith('  '): continue
        head,gloss=line.split('|',1); t=head.split(); off=t[0]; lex=int(t[1]); ss=t[2]
        nw=int(t[3],16); i=4+2*nw; npt=int(t[i]); i+=1+4*npt; fr=[]
        if p=='v' and i<len(t):
            nf=int(t[i]); i+=1
            for k in range(nf): fr.append(int(t[i+1])); i+=3
        g=gloss.strip().split(';')[0].strip()
        syn[(off,'a' if ss=='s' else ss)]=(lex,g[:140],sorted(set(fr)))
cnt=collections.Counter(); senses=collections.defaultdict(list)
for line in open(W+'index.sense'):
    key,off,sn,tc=line.split()
    lemma,rest=key.split('%'); ss=int(rest.split(':')[0]); p={1:'n',2:'v',3:'a',4:'r',5:'a'}[ss]
    if not re.fullmatch(r"[a-z][a-z'\-]*",lemma): continue
    tc=int(tc); cnt[lemma]+=tc; senses[(lemma,p)].append((int(sn),off,tc))
# selection: lemmas with corpus frequency >= threshold
TH=int(__import__('sys').argv[1]) if len(__import__('sys').argv)>1 else 6
keep=[l for l,c in cnt.items() if c>=TH]
L={}; adm=quar=0; pf=0
for lemma in sorted(keep):
    ent=[]
    for p in 'nvar':
        ss=sorted(senses.get((lemma,p),[]))
        if not ss: continue
        a=[s for s in ss if s[2]>0][:4]; q=len(ss)-len(a)
        out=[]
        for sn,off,tc in a:
            lex,g,fr=syn[(off,p)]
            out.append([off+p,lex,g,''.join(chr(48+x) for x in fr)])
            pf+=len(fr)
        adm+=len(out); quar+=q
        if out: ent.append([p,out,q])
    if ent: L[lemma]=ent
exc={}
for f in ['noun.exc','verb.exc','adj.exc']:
    for line in open(W+f):
        w,*b=line.split()
        if b and b[0] in L and re.fullmatch(r"[a-z]+",w): exc[w]=b[0]
meta={'source':'Princeton WordNet 3.0','license':'WordNet 3.0 License (Princeton University) — permission to use, copy, modify and distribute with notice','notice':'WordNet 3.0 Copyright 2006 by Princeton University. All rights reserved. THIS SOFTWARE AND DATABASE IS PROVIDED "AS IS" AND PRINCETON UNIVERSITY MAKES NO REPRESENTATIONS OR WARRANTIES, EXPRESS OR IMPLIED.','doc8_state':'admitted: senses with SemCor tag count>0 (max 4 per POS); quarantined: remaining senses (counted only)','threshold_tagcount':TH,'lexnames':lexnames,'verb_frames':FRAMES,'stats':{'lemmas':len(L),'admitted_senses':adm,'quarantined_senses':quar,'predicate_frames(verb sense × WN frame)':pf,'exceptions':len(exc)}}
d={'meta':meta,'L':L,'exc':exc}
s=json.dumps(d,separators=(',',':'),ensure_ascii=False)
open('/workspace/kernel-app/data/lexicon.json','w').write(s)
gzip.open('/workspace/kernel-app/data/lexicon.json.gz','wb',9).write(s.encode())
print(meta['stats'],len(s),len(gzip.compress(s.encode(),9)))
# ---- extended tier (lazy): every other single-word lemma, up to 3 senses, all marked 'extended' (Doc 8: admitted for
# recognition; lower assurance — no SemCor attestation). Kept in a separate lazily-loaded file.
X={}
gf=collections.Counter()
for (o,p),(lx,g,fr) in syn.items():
    for w in re.findall(r"[a-z]+",g.lower()): gf[w]+=1
GTH=int(__import__('sys').argv[2]) if len(__import__('sys').argv)>2 else 8
def gfreq(lemma): # count of surface or simple inflections in WordNet glosses (deterministic frequency proxy)
    return max(gf[lemma],gf[lemma+'s'],gf[lemma+'ed'],gf[lemma+'ing'],gf[lemma+'es'],gf[lemma[:-1]+'ies'] if lemma.endswith('y') else 0)
for (lemma,p),ss in senses.items():
    if lemma in L or len(lemma)>14 or '-' in lemma or "'" in lemma or gfreq(lemma)<GTH: continue
    ss=sorted(ss)[:2]
    out=[[off+p,syn[(off,p)][0],syn[(off,p)][1][:90],''.join(chr(48+x) for x in syn[(off,p)][2])] for sn,off,tc in ss]
    X.setdefault(lemma,[]).append([p,out,max(0,len(senses[(lemma,p)])-2)])
xs=json.dumps({'meta':{'source':'Princeton WordNet 3.0','license':meta['license'],'tier':'extended (no SemCor attestation; up to 2 senses per POS; selected by gloss-frequency ≥ GTH)','lemmas':len(X)},'L':X},separators=(',',':'),ensure_ascii=False)
gzip.open('/workspace/kernel-app/data/lexicon-ext.json.gz','wb',9).write(xs.encode())
open('/workspace/kernel-app/data/lexicon-ext.json','w').write(xs)
print('ext',len(X),len(xs),len(gzip.compress(xs.encode(),9)))
