/* Seed Concept Lexicon — Doc 4 (Concept Lexicon & Semantic Relation Graph v1):
 * every entry has a concept id + sense id; surfaces map to concepts; anything not
 * here is in the UNKNOWN-CONCEPT state (Doc 4 unknown-concept state; Doc 3 §41).
 * Format: "CONCEPT_ID|surface,surface|category|gloss|source"
 * Project-term glosses are drawn from the user's papers (source column). */
(function (root) {
const SEED = `
F.I|i,me|function|first-person speaker|
F.MY|my,mine|function|possessive of the speaker|
F.YOU|you|function|the addressee (this kernel)|
F.YOUR|your,yours|function|possessive of the addressee|
F.THE|the,a,an|function|determiner|
F.THAT|that,this,these,those|function|demonstrative / complementiser|
F.IS|is,are,am,be,been,being|function|copula, present|Doc3 §17
F.WAS|was,were|function|copula, past|Doc3 §17
F.WILL|will,shall|function|future auxiliary|Doc3 §17
F.NOT|not,never,no,none,nothing|function|negation operator|Doc3 §15
F.DO|do,does,did|function|auxiliary do|
F.IF|if,unless|function|condition operator|Doc3 §16
F.THEN|then|function|consequent marker|Doc3 §16
F.AND|and|function|conjunction|
F.OR|or|function|disjunction|
F.OF|of,in,on,at,to,for,from,with,about,by,as,into|function|preposition|
F.WHAT|what,which|function|interrogative (thing)|Doc5 §15
F.WHO|who,whom,whose|function|interrogative (person)|Doc5 §15
F.WHERE|where|function|interrogative (place)|
F.WHEN|when|function|interrogative (time)|
F.HOW|how|function|interrogative (manner/amount)|
F.WHY|why|function|interrogative (reason)|
F.CAN|can,could|function|ability / capability modal|Doc3 §18
F.MAY|may,might,maybe,perhaps,possibly,probably|function|possibility modal|Doc3 §18
F.MUST|must,definitely,certainly,surely|function|necessity / certainty modal|Doc3 §18
F.SHOULD|should,would|function|obligation / conditional modal|Doc3 §18
F.ALL|all,every,each|function|universal quantifier|Doc3 §19
F.SOME|some,any,several|function|existential quantifier|Doc3 §19
F.MANY|many,much,more,most,few|function|vague quantity|Doc3 §19
F.IT|it,its,they,them,their,he,she,him,her,his,we,us,our|function|pronoun (referent must be resolved)|Doc6 §23
F.THERE|there,here|function|locative pro-form|
F.PLEASE|please,just,also,too,very,really,now|function|politeness / degree particle|
F.YES|yes,yeah,yep,ok,okay,sure,correct|function|affirmation|
F.NO_ANS|nope,wrong|function|denial|
F.HAVE|have,has,had|function|possession auxiliary|
F.THINK|think,believe,guess|function|epistemic hedge (lowers certainty)|Doc3 §18
A.REMEMBER|remember,store,save,keep,memorize,memorise|action|admit a statement into governed memory (explicit user authorization)|Doc7
A.RECALL|recall,retrieve,remind|action|read a stored memory record with provenance|Doc7
A.FORGET|forget,erase,remove,delete|action|remove a memory record (requires explicit Memory-screen action)|Doc7
A.NOTE|note,notes,jot,write|action|add a free-text note|
A.LIST|list,show,display,tell,give|action|enumerate records|
A.COUNT|count|action|count records|
A.DEFINE|define,definition,mean,means,meaning,explain|action|ask for the controlled definition of a term|Doc4
A.CALC|calculate,compute,evaluate,solve|action|evaluate arithmetic (GP-014 math lane)|GP-014
A.ADD|add,plus,sum|math|addition +_Φ|RPMC O_phase
A.SUB|subtract,minus,less|math|subtraction −_Φ|RPMC O_phase
A.MUL|multiply,multiplied,times,product|math|multiplication ×_Φ|RPMC O_phase
A.DIV|divide,divided,over,quotient|math|phase-constrained division ÷_Φ (only when the quotient is valid)|RPMC O_phase
A.POW|power,squared,cubed,raised|math|exponentiation|
A.SQRT|square,root,sqrt|math|square root|
A.PCT|percent,percentage|math|percent|
A.SAY|say,repeat,echo,print,output|action|project text outward verbatim|RMC §6.6
A.SEND|send,email,mail,text,message,post,share,publish,tweet|action|external communication (no capability)|Doc1
A.BUY|buy,purchase,order,pay,book|action|financial transaction (no capability)|Doc1
A.OPEN|open,launch,run,execute,install,download,upload,call,browse,search|action|external tool / execution (no capability)|Doc1
A.KNOW|know,understand|action|epistemic state|
A.WANT|want,need,like,love,hate,prefer|action|preference / desire|
A.LIVE|live,lives,lived|action|reside|
A.GO|go,going,went,come|action|motion|
A.RAIN|rain,rains,raining,snow,snows|action|weather event|
A.WORK|work,works,working|action|work|
A.HELP|help|action|request usage guidance|
A.START|start,begin,reset|action|begin|
A.STOP|stop,end,quit|action|end|
I.HELLO|hello,hi,hey,greetings|social|greeting|Doc5 §15
I.BYE|bye,goodbye,farewell|social|farewell|Doc5 §15
I.THANKS|thanks,thank,cheers|social|thanks|Doc5 §15
I.MORNING|morning,afternoon,evening,night|time|part of day|
N.NAME|name,names|entity|name of a person or thing|
N.PERSON|person,people,man,woman,child,kid,kids,baby|entity|person|
N.SISTER|sister,brother,mother,father,mom,dad,parent,parents,son,daughter,wife,husband,partner,friend,friends,boss,uncle,aunt,cousin,grandmother,grandfather|entity|kin / social relation|
N.PET|dog,cat,pet,bird,fish,horse,dogs,cats|entity|animal|
N.ANIMAL|animal,animals,mammal,mammals|entity|animal class|
N.CAR|car,bike,bus,train,truck|entity|vehicle|
N.COLOR|color,colour,colors|entity|colour attribute|
N.RED|red,blue,green,yellow,black,white,orange,purple,pink,brown,gray,grey,silver,gold|attribute|colour value|
N.PLACE|city,town,country,home,house,office,school,park,museum,beach,store,shop,street,address,place|entity|place|
N.TIMEW|birthday,date,day,week,month,year,today,tomorrow,yesterday,time,hour,minute|entity|time expression|Doc3 §17
N.WEEKDAY|monday,tuesday,wednesday,thursday,friday,saturday,sunday|entity|weekday|
N.MONTH|january,february,march,april,june,july,august,september,october,november,december|entity|month|
N.FOOD|food,coffee,tea,pizza,bread,water,meal,dinner,lunch,breakfast|entity|food / drink|
N.FAV|favorite,favourite|attribute|preferred|
N.NUMBERW|number,numbers,phone,pin,code,password,secret|entity|number / credential (credentials are output-restricted)|Doc3 §20
N.PLAN|plan,plans,meeting,appointment,goal,task,project|entity|plan / task|
N.BOOK|book,movie,song,game,show,music|entity|work of culture|
N.JOB|job,work,career|entity|occupation|
N.AGE|age,old,years|entity|age|
N.MEMORY|memory,memories,fact,facts,record,records|entity|governed memory record|Doc7
N.WORD|word,words,term,terms,concept,concepts|entity|lexical item|Doc4
N.SECRET|pin,pins,password,passwords,passcode,passcodes,passphrase,passphrases,ssn,cvv,cvc,iban,api,token,tokens,login,logins,combination,combinations,secret,secrets,routing,passport,license,licence,seed,phrase|entity|credential / sensitive identifier (value sealed in the Identity Vault)|Doc7
N.QUESTION|question,answer|entity|question / answer|
N.EMAILN|inbox,file,files,folder,website,internet,web|entity|external resource|Doc8
N.WEATHER|weather,sun,sunny,cloudy,cold,hot,warm|attribute|weather|
N.SIZE|big,small,large,tall,short,long,new,good,bad,happy,sad,tired,busy,free,sealed,locked,hidden,private|attribute|quality|
N.TRUE|true,false|attribute|truth value|
NUM.ZERO|zero|number|0|
NUM.ONE|one|number|1|
NUM.TWO|two|number|2|
NUM.THREE|three|number|3|
NUM.FOUR|four|number|4|
NUM.FIVE|five|number|5|
NUM.SIX|six|number|6|
NUM.SEVEN|seven|number|7|
NUM.EIGHT|eight|number|8|
NUM.NINE|nine|number|9|
NUM.TEN|ten|number|10|
NUM.ELEVEN|eleven|number|11|
NUM.TWELVE|twelve|number|12|
NUM.TWENTY|twenty|number|20|
NUM.HUNDRED|hundred|number|100|
NUM.THOUSAND|thousand|number|1000|
T.FORGE|forge|term|AI.Web Forge: the governed, deterministic cognition runtime whose language core is specified by the ten-document series; LLMs hold no authority in its core path.|Doc1; RMC Addendum §6
T.RMC|rmc|term|Recursive Manifest Compiler: a traceable symbolic architecture that compiles meaning into a manifest before rendering, bounds novelty by drift, and validates output by Echo round-trip.|RMC §1
T.MSM|msm|term|MeaningStructureManifest v1: the shared intermediate object between human language and Forge cognition, holding purpose, meaning, uncertainty, limits, capability relation and evidence/trace links (Doc 2; file not located, fields inferred from Docs 1, 3, R0).|Doc1; R0
T.MANIFEST|manifest|term|The compiled, renderer-independent meaning state of a candidate, including phase, drift posture, limitations and authority conditions.|RMC §5.9
T.DRIFT|drift|term|Measured departure of a loop from its lawful phase trajectory and originating meaning; scored by ε_s = (σ_res + D_score + |ΔΦ|)/ρ.|RMC Addendum §3; RSOC §4.1
T.EPS|epsilon,ε_s,eps|term|Composite drift functional ε_s = (σ_res + D_score + |ΔΦ|)/ρ; bands (Nic's drift ruling, one table): ≤0.35 clean (projectable, may be written), 0.35–0.40 correct (χ correction step, not written), 0.40–0.80 elevated (quarantine-only exploration, never written or projected), >0.80 hard stop. 0.72 is a reference value only.|RMC Addendum §3; Nic ruling 2026-10-14
T.PHASE|phase,phases,Φ|term|One of the nine phase constants Φ1–Φ9 of the recursive cycle (RPMC): Initiation, Polarity, Desire, Friction, Entropy, Grace/Correction, Naming, Projection, Return.|RPMC §1.4; RMC §4
T.PHI1|phi1,Φ1,initiation|term|Φ1 Initiation: the originating pulse ψ₁; input is received and ψ_id is fixed.|RPMC §1.4
T.PHI2|phi2,Φ2,polarity|term|Φ2 Polarity: first boundary — contrast, negation and tension are detected.|RPMC §1.4
T.PHI3|phi3,Φ3,desire|term|Φ3 Desire: harmonic drive — the purpose / speech act is recovered.|RPMC §1.4
T.PHI4|phi4,Φ4,friction|term|Φ4 Friction: structural resistance — constraints and gates are applied.|RPMC §1.4
T.PHI5|phi5,Φ5,entropy|term|Φ5 Entropy: test point of maximum divergence; drift is measured; the only lawful collapse point.|RPMC §1.4
T.PHI6|phi6,Φ6,grace,correction|term|Φ6 Grace / Correction: the only phase where χ(t) may be invoked.|RPMC §1.4
T.PHI7|phi7,Φ7,naming|term|Φ7 Naming: identity assignment; echo validation is required before naming.|RPMC §1.4
T.PHI8|phi8,Φ8,projection|term|Φ8 Power / Projection: outward expression. Φ5→Φ8 (projection without correction and naming) is forbidden.|RPMC §1.4; RMC Addendum §4
T.PHI9|phi9,Φ9,return,closure|term|Φ9 Return: loop closure; echo(ψ,Φ9) must equal ψ(Φ1).|RPMC §1.4
T.CHI|chi,χ|term|χ(t), the correction function: the only entropy-reducing operator. The χ correction step runs for 0.35 < ε_s < 0.40; the χ override fires at most once per loop binding when ε_s > 0.80 (or a forbidden transition), Ê(τ)=1, χ flag = 0 and |ΔΦ_avg| ≤ π/3. In the runtime it re-routes; it does not by itself authorize output.|RSOC §3.2; RMC Addendum §4
T.ECHO|echo|term|Echo validation Ê: the rendered output is re-parsed and must return the same material meaning as the manifest; failure blocks output.|RMC §5.12, §6.7; RSOC §3.1
T.SPC|spc,capacitor|term|Symbolic Phase Capacitor: lossless cold storage for a sealed loop (Ĉ); erasure is never the lawful response to collapse.|RSOC §5; RPMC
T.COLD|cold,archival,archive|term|Controlled archival Ĉ: an unresolvable state is sealed into cold storage with its phase, echo and entropy metadata.|RSOC §3.1; Symbolic Cold Storage Theory
T.SFE|sfe|term|Symbolic Field Element ψ = (Φ, ρ, Δ, ν, μ | ψ_id, τ, ε, λ, χ).|RSOC §2.2
T.PSI|psi,ψ|term|ψ: a symbolic memory carrier / SFE; ψ_id is its immutable identity hash.|RSOC §2.2
T.MU|mu,μ,charge|term|μ, memory charge: created only by the memory integral ⧜, fused by ⟁ merge, conserved by Ĉ.|RSOC §2.2, §3.1
T.RHO|rho,ρ,depth|term|ρ, recursion depth; in the drift functional ρ = max(1, depth).|RSOC §2.2; RMC Addendum §3
T.SIGMA|sigma,σ_res,resonance|term|σ_res, resonance variance: standard deviation of phase history.|RMC Addendum §3
T.THETA|theta,Θ|term|Θ(t) grace integral: ∫(1 − ε/ε_max)·cos²(Φ − Φ₁)·μ ds over the loop.|RSOC §3.2.1
T.MERGE|merge,⟁|term|⟁ Merge: fuses two coherent SFEs when phase misalignment δ ≤ π/4; μ′ = μ₁ + μ₂ + ζcos²δ.|RSOC §3.1.1
T.LOCK|lock,⧙|term|⧙ Lock: permanent binding (Naming); allowed only if predicted ε_s < 0.6.|RSOC §3.1.2
T.INTEGRAL|integral,⧜|term|⧜ Memory integral: the only lawful source of new memory charge.|RSOC §3.1
T.SCORE|score,scoring|term|Candidate coherence Score(c) = αM(c) + βP(c) + γU(c) + δN(c) − λD(c); hard gates override soft scores.|RMC §5.7; Addendum §3
T.CANDIDATE|candidate,candidates|term|A possible meaning for an input, scored and gated before selection.|RMC §5.6; Doc6 §31
T.GATE|gate,gates|term|Verbal Cognition Gates (Doc 6): expectancy, congruity, connectedness and recoverable purpose.|Doc6 §1
T.EXPECT|expectancy|term|Expectancy gate: required roles of the predicate frame must be filled.|Doc6 §9
T.CONGRUITY|congruity|term|Congruity gate: concepts must fit the roles they fill.|Doc6 §15
T.CONNECT|connectedness|term|Connectedness gate: every scope and modifier must attach.|Doc6 §21
T.PURPORT|purport,purpose|term|Recoverable purpose gate: the intended purpose must be recoverable without guessing hidden intent.|Doc6 §25
T.LAW|law|term|Language Law (Doc 3): binding rules for scope of negation, condition, time, modality, quantity and output boundaries.|Doc3 §14–20
T.LEXICON|lexicon|term|Concept Lexicon (Doc 4): controlled concept and sense identities with an explicit unknown-concept state.|Doc4
T.FRAME|frame,frames,registry|term|Predicate–Role Frame Registry (Doc 5): action roots, roles and speech-act types.|Doc5 §12–16
T.KERNEL|kernel|term|Bidirectional Language Kernel: language → MSM inward, MSM → language outward, with reversibility checks.|Doc1; Doc9
T.GP014|gp-014,gp014|term|GP-014 (LANG-EXPR-001): operator-guided language realizer for verified mathematical output — the accepted live language-path baseline.|Corrected Roadmap 2026-07-26
T.AUTH|authorization,authority|term|Understanding is not authorization: a selected meaning never by itself permits action, memory write or projection.|Doc1; Doc6 §36.15
T.PROVENANCE|provenance|term|Source, time and path record attached to every memory and evidence item.|Doc7
T.EVIDENCE|evidence|term|Records of what the user stated, kept separate from memory, language examples and traces.|Doc7
T.TRACE|trace|term|The ordered record of rules, gates, phases, scores and echo results for a turn.|Doc6 §41
`;
function parseSeed() {
  const out = [];
  for (const line of SEED.split('\n')) {
    if (!line.trim()) continue;
    const parts = line.split('|'); const [id, surf, cat] = parts; const src = parts[parts.length - 1]; const gloss = parts.slice(3, -1).join('|');
    out.push({ id, senses: [{ sid: id + '.s1', gloss }], surfaces: surf.split(','), category: cat, source: src || '', status: 'seed', version: 1, history: [] });
  }
  return out;
}
const api = { SEED_CONCEPTS: parseSeed() };
if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.KLexicon = api;
})(this);
