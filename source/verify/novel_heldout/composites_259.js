/* 4.9.259 held-out composites. Fresh wording. Not a golden.
 * Product code does not import this file. These strings are not in the regression suites. */
module.exports = {
  schema: 'forge.novel_composite/v1',
  held_out: true,
  fit_forbidden: true,
  version: '4.9.259',
  items: [
    { id: 'c259-induce', expect: ['derive'],
      setup: ['A marten is a mammal.', 'A marten has whiskers.', 'A mink is a mammal.', 'A mink has whiskers.', 'A ferret is a mammal.', 'A ferret has whiskers.', 'A genet is a mammal.'],
      q: 'Does a genet have whiskers?' },
    { id: 'c259-recall-sim', expect: ['recall', 'simulate'],
      setup: ['The quillon weighs 4.2 kilograms and is 0.62 meters tall and 0.18 meters wide and 0.18 meters deep.'],
      q: 'What happens if I push the quillon near the top?' },
    { id: 'c259-math', expect: ['compute'],
      q: 'What is 17 percent of 640?' },
    { id: 'c259-recall', expect: ['recall'],
      setup: ['A marten is a mammal.', 'A marten has whiskers.', 'A mink is a mammal.', 'A mink has whiskers.', 'A ferret is a mammal.', 'A ferret has whiskers.', 'A genet is a mammal.'],
      q: 'Is a genet a mammal?' },
    { id: 'c259-chain', expect: ['derive'],
      setup: ['A serval is a cat.', 'A cat is a mammal.'],
      q: 'Is a serval a mammal?' },
    { id: 'c259-handoff', expect: ['derive', 'recall', 'simulate', 'compute', 'hold'], turns: [
      { setup: ['A marten is a mammal.', 'A marten has whiskers.', 'A mink is a mammal.', 'A mink has whiskers.', 'A ferret is a mammal.', 'A ferret has whiskers.', 'A genet is a mammal.', 'The quillon weighs 4.2 kilograms and is 0.62 meters tall and 0.18 meters wide and 0.18 meters deep.'],
        q: 'Does a genet have whiskers?' },
      { q: 'Is a genet a mammal?' },
      { q: 'What happens if I push the quillon near the top?' },
      { q: 'What is 17 percent of 640?' },
      { setup: ['A civet is a mammal.', 'A civet has no whiskers.'], q: 'Does a genet have whiskers?' }
    ]}
  ]
};
