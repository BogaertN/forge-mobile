/* Fresh composites for 4.9.256. Not a golden. Product code must not mention these strings. */
module.exports = {
  schema: 'forge.novel_composite/v1',
  held_out: true,
  fit_forbidden: true,
  items: [
    { id: 'd-ability', expect: ['self', 'capability'],
      q: 'Can you derive a sentence and also answer a question from a remembered fact?' },
    { id: 'd-pulse', expect: ['self', 'entail'],
      q: 'Do you have a heartbeat?' },
    { id: 'd-ask', expect: ['ask'],
      setup: ['The brin weighs 2 kilograms.'],
      q: 'What happens if I push the brin near the top?' },
    { id: 'd-contra', expect: ['negation', 'geo'],
      setup: ['Mira is not inside Soln.', 'Pell is inside Soln.'],
      q: 'Is Mira inside Pell?' },
    { id: 'd-contra-no', expect: ['hold'],
      setup: ['Mira is not inside Pell.', 'Pell is inside Soln.'],
      q: 'Is Mira inside Soln?' },
    { id: 'd-niece', expect: ['kinship'],
      setup: ["Ivo's aunt is Rae."],
      q: "Who is Rae's niece?" },
    { id: 'd-half', expect: ['counterfactual'],
      q: 'What if the stool were twice as wide?' },
    { id: 'd-percent', expect: ['derive', 'compute'],
      setup: ['A lom is 8 centimeters long.', 'A tiv is twice a lom.'],
      q: 'What is 25 percent of a tiv?' }
  ]
};
