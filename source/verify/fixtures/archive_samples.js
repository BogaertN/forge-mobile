/* Fixed sample lookup plans, one per archive (4.9.78): used by tools/archives_live_check.js (live, once each) and by verify/archives_suite.js
 * (offline, against the responses recorded from those same calls in verify/fixtures/archives). The shape is the language core's lookup plan. */
const P = (o) => Object.assign({ domains: [], key: null, yn: false, juris: null }, o);
module.exports = {
  medlineplus: P({ question: 'What is asthma?', entity: 'asthma', terms: ['asthma'], atype: 'description', domains: ['medical'] }),
  openfda: P({ question: 'Is ibuprofen safe in pregnancy?', drug: 'ibuprofen', terms: ['ibuprofen', 'pregnancy'], domains: ['medical'] }),
  pubmed: P({ question: 'Does aspirin prevent migraine?', terms: ['aspirin', 'migraine'], domains: ['medical'] }),
  courtlistener: P({ question: 'What did Miranda v. Arizona decide?', terms: ['miranda', 'arizona'], domains: ['legal'] }),
  ecfr: P({ question: 'What is a hazardous material?', terms: ['hazardous material'], domains: ['legal'] }),
  openalex: P({ question: 'What is graphene?', terms: ['graphene'], domains: ['science'] }),
  crossref: P({ question: 'What is graphene?', terms: ['graphene'], domains: ['science'] }),
  pubchem: P({ question: 'What is water made of?', terms: ['water', 'make'], key: ['water'], atype: 'description', subject: 'water', domains: ['chemistry'] }),
  chebi: P({ question: 'What is water made of?', terms: ['water', 'make'], key: ['water'], atype: 'description', subject: 'water', domains: ['chemistry'] }),
  mesh: P({ question: 'What is aspirin?', terms: ['aspirin'], drug: 'aspirin', atype: 'description', domains: ['medical'] }),
  uniprot: P({ question: 'What does insulin do?', terms: ['insulin'], atype: 'description', domains: ['biology'] }),
  ncbigene: P({ question: 'What does insulin do?', terms: ['insulin'], atype: 'description', domains: ['biology'] }),
  federalregister: P({ question: 'What is the federal tax code?', terms: ['tax code'], domains: ['legal'] }),
  legislationgovuk: P({ question: 'What is the UK Equality Act?', terms: ['equality act'], juris: 'britain', domains: ['legal'] }),
  europepmc: P({ question: 'Does aspirin prevent migraine?', terms: ['aspirin', 'migraine'], domains: ['medical'] }),
  rxclass: P({ question: 'Is aspirin an NSAID?', drug: 'aspirin', terms: ['aspirin', 'nsaid'], domains: ['medical'] }),
  gbif: P({ question: 'What is Canis lupus?', entity: 'canis lupus', terms: ['canis lupus'], domains: ['biology'] }),
  loc: P({ question: 'What is the Gettysburg Address?', entity: 'gettysburg address', terms: ['gettysburg address'], domains: [] }),
  wikipedia: P({ question: 'What is bronze made of?', entity: 'bronze', object: 'bronze', terms: ['bronze', 'make'], atype: 'description' }),
  wikidata: P({ question: 'Who wrote Hamlet?', entity: 'hamlet', object: 'hamlet', terms: ['hamlet', 'write'], atype: 'person', asked: 'write' }) };
