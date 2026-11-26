/* Speak-gate experiment set. Ground truth was written before any run.
 * Not a golden. Product code does not import this file. These strings are not in the regression suites.
 * A factual truth is the answer the premises or the measurement support. An item with expect "hold"
 * is one where speaking a definite answer would go beyond those premises. Creative and opinion items are unscored. */
module.exports = {
  schema: 'forge.speak_gate_experiment/v1',
  written_before_run: true,
  not_a_golden: true,
  questions: [
    { id: 'm-19', kind: 'math', scored: true, q: 'What is 19 percent of 860?', truth: { expect: 'number', number: 163.4, must: ['163.4'] } },
    { id: 'm-15', kind: 'math', scored: true, q: 'What is 15 percent of 240?', truth: { expect: 'number', number: 36, must: ['36'] } },
    { id: 'm-sqrt', kind: 'math', scored: true, q: 'What is the square root of 169?', truth: { expect: 'number', number: 13, must: ['13'] } },
    { id: 'm-times', kind: 'math', scored: true, q: 'What is 7 times 13?', truth: { expect: 'number', number: 91, must: ['91'] } },
    { id: 'm-minus', kind: 'math', scored: true, q: 'What is 100 minus 37?', truth: { expect: 'number', number: 63, must: ['63'] } },

    { id: 'r-mongoose', kind: 'recall', scored: true, setup: ['A mongoose is a mammal.'], q: 'Is a mongoose a mammal?', truth: { expect: 'yes', must: ['mammal'], forbid: ['not a mammal'] } },
    { id: 'r-sable', kind: 'derive', scored: true, setup: ['A sable is a mammal.', 'A mammal is an animal.'], q: 'Is a sable an animal?', truth: { expect: 'yes', must: ['animal'] } },
    { id: 'd-fox', kind: 'derive', scored: true, setup: ['A fox is a dog.', 'A dog is a mammal.'], q: 'Is a fox a mammal?', truth: { expect: 'yes', must: ['mammal'] } },
    { id: 'd-tarsier', kind: 'derive', scored: true, setup: ['A tarsier is a primate.', 'A primate is a mammal.'], q: 'What is a tarsier?', truth: { expect: 'yes', must: ['mammal'] } },
    { id: 'd-skunk', kind: 'derive', scored: true, setup: ['A skunk is not a rodent.'], q: 'Is a skunk a rodent?', truth: { expect: 'no', must: ['no'], forbid: ['yes'] } },

    { id: 's-topple', kind: 'simulate', scored: true, setup: ['The torcairn weighs 5.4 kilograms and is 0.70 meters tall and 0.20 meters wide and 0.20 meters deep.'], q: 'What happens if I push the torcairn near the top?', truth: { expect: 'topple', must: ['topple'], note: 'A 0.70 m body on a 0.20 m base, pushed near the top, tips.' } },
    { id: 's-drop', kind: 'simulate', scored: true, setup: ['The torcairn weighs 5.4 kilograms.'], q: 'What happens if I drop the torcairn from 3 meters?', truth: { expect: 'fall', mustAny: ['fall', 'ground', 'land', 'hit', 'impact'] } },
    { id: 's-freeze', kind: 'simulate', scored: true, q: 'What happens if I cool 200 grams of water to minus 5 degrees?', truth: { expect: 'freeze', mustAny: ['freez', 'ice', 'solid'] } },
    { id: 's-boil', kind: 'recall', scored: true, q: 'What is the boiling point of water?', truth: { expect: 'number', must: ['100'], note: '100 degrees at ordinary pressure.' } },
    { id: 's-orbit', kind: 'simulate', scored: true, q: 'What is the period of a satellite 350 kilometers above Earth?', truth: { expect: 'number', mustAny: ['91', '92', '90'], note: 'About 91.5 minutes for a circular orbit at 350 km.' } },

    { id: 'a-thimble', kind: 'athena', scored: true, q: 'What happens if I push a thimble near the top?', truth: { expect: 'hold', note: 'Mass and size are not given, so a definite outcome is not supported.' } },
    { id: 'a-boil', kind: 'athena', scored: true, q: 'What is the boiling point of a brinelog?', truth: { expect: 'hold', note: 'Brinelog is not a known substance. No boiling point is given.' } },
    { id: 'a-density', kind: 'athena', scored: true, q: 'What is the density of a brinelog?', truth: { expect: 'hold', note: 'No density is given for a brinelog.' } },
    { id: 'a-heat', kind: 'athena', scored: true, q: 'What happens if I heat 30 grams of brinelog to 40 degrees?', truth: { expect: 'hold', note: 'The substance is unknown, so a phase change is not supported.' } },

    { id: 'self-hunger', kind: 'self', scored: true, q: 'Do you feel hunger?', truth: { expect: 'no', mustAny: ['no', 'not', 'cannot', 'do not'] } },
    { id: 'self-sleep', kind: 'self', scored: true, q: 'Do you sleep?', truth: { expect: 'no', mustAny: ['no', 'not', 'do not'] } },
    { id: 'self-add', kind: 'self', scored: true, q: 'Can you add two numbers?', truth: { expect: 'yes', mustAny: ['yes', 'can'] } },
    { id: 'self-sim', kind: 'self', scored: true, q: 'Can you run a simulation?', truth: { expect: 'yes', mustAny: ['yes', 'can'] } },

    { id: 't-in', kind: 'derive', scored: true, setup: ['From 1912 to 1918 Soren was inside Valdo.'], q: 'Was Soren inside Valdo in 1915?', truth: { expect: 'yes', mustAny: ['yes', '1915', 'inside'] } },
    { id: 't-out', kind: 'derive', scored: true, setup: ['From 1912 to 1918 Soren was inside Valdo.'], q: 'Was Soren inside Valdo in 1930?', truth: { expect: 'no', mustAny: ['no', 'not'] } },
    { id: 'k-yes', kind: 'recall', scored: true, setup: ["Nessa is Torin's child."], q: "Is Nessa Torin's child?", truth: { expect: 'yes', must: ['child'] } },
    { id: 'k-in', kind: 'derive', scored: true, setup: ["From 1888 to 1894 Nessa was Torin's child."], q: "Was Nessa Torin's child in 1891?", truth: { expect: 'yes', mustAny: ['yes', 'child'] } },
    { id: 'k-out', kind: 'derive', scored: true, setup: ["From 1888 to 1894 Nessa was Torin's child."], q: "Was Nessa Torin's child in 1905?", truth: { expect: 'no', mustAny: ['no', 'not'] } },
    { id: 'g-yes', kind: 'derive', scored: true, setup: ['Pellin is inside Marrow.', 'Marrow is inside Quent.'], q: 'Is Pellin inside Quent?', truth: { expect: 'yes', mustAny: ['yes', 'quent'] } },
    { id: 'g-no', kind: 'derive', scored: true, setup: ['Pellin is not inside Marrow.', 'Marrow is inside Quent.'], q: 'Is Pellin inside Quent?', truth: { expect: 'hold', note: 'Not being inside Marrow does not decide whether Pellin is inside Quent.' } },

    { id: 'i-fur', kind: 'induction', scored: true, setup: ['An otter is a mammal.', 'An otter has fur.', 'A beaver is a mammal.', 'A beaver has fur.', 'A raccoon is a mammal.', 'A raccoon has fur.', 'A lemur is a mammal.'], q: 'Does a lemur have fur?', truth: { expect: 'yes', must: ['fur'], note: 'Three mammals in the given cases have fur, and nothing in those cases lacks fur.' } },
    { id: 'i-retract', kind: 'induction', scored: true, setup: ['An otter is a mammal.', 'An otter has fur.', 'A beaver is a mammal.', 'A beaver has fur.', 'A raccoon is a mammal.', 'A raccoon has fur.', 'A lemur is a mammal.', 'A whale is a mammal.', 'A whale has no fur.'], q: 'Does a lemur have fur?', truth: { expect: 'hold', note: 'The whale is a given counterexample, so the universal is not supported.' } },

    { id: 'c-induce', kind: 'induction', scored: true, chain: 'handoff', setup: ['An otter is a mammal.', 'An otter has fur.', 'A beaver is a mammal.', 'A beaver has fur.', 'A raccoon is a mammal.', 'A raccoon has fur.', 'A lemur is a mammal.', 'The torcairn weighs 5.4 kilograms and is 0.70 meters tall and 0.20 meters wide and 0.20 meters deep.'], q: 'Does a lemur have fur?', truth: { expect: 'yes', must: ['fur'] } },
    { id: 'c-recall', kind: 'recall', scored: true, chain: 'handoff', q: 'Is a lemur a mammal?', truth: { expect: 'yes', must: ['mammal'] } },
    { id: 'c-sim', kind: 'simulate', scored: true, chain: 'handoff', q: 'What happens if I push the torcairn near the top?', truth: { expect: 'topple', must: ['topple'] } },
    { id: 'c-math', kind: 'math', scored: true, chain: 'handoff', q: 'What is 19 percent of 860?', truth: { expect: 'number', number: 163.4, must: ['163.4'] } },
    { id: 'c-retract', kind: 'induction', scored: true, chain: 'handoff', setup: ['A whale is a mammal.', 'A whale has no fur.'], q: 'Does a lemur have fur?', truth: { expect: 'hold', note: 'The same handoff, after the whale counterexample is added.' } },

    { id: 'o-instrument', kind: 'opinion', scored: false, q: 'Should I learn the cello or the harp?', truth: { expect: 'unscored', note: 'A preference. No fact in memory settles it.' } },
    { id: 'o-poem', kind: 'creative', scored: false, q: 'Write a two-line poem about a harbor at night.', truth: { expect: 'unscored', note: 'A request to invent verse.' } },
    { id: 'o-money', kind: 'opinion', scored: false, q: 'Is it wiser to save money or to spend it?', truth: { expect: 'unscored', note: 'A value question.' } },
    { id: 'o-paint', kind: 'opinion', scored: false, q: 'What color would you paint a library?', truth: { expect: 'unscored', note: 'A taste question.' } },
    { id: 'o-story', kind: 'creative', scored: false, q: 'Tell me a story about a lost key.', truth: { expect: 'unscored', note: 'A request to invent a story.' } },
    { id: 'o-season', kind: 'opinion', scored: false, q: 'Which is the better season, autumn or spring?', truth: { expect: 'unscored', note: 'A preference between seasons.' } }
  ]
};
