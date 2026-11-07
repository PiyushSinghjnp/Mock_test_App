'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { scorePaper, scrubSolutions } = require('../server-postgres');

test('authoritative scoring preserves negative marks, section totals and unanswered counts', () => {
  const paper = { test_data_json: JSON.stringify({ sections: [
    { title: 'Reasoning', positiveMarks: 2, negativeMarks: .5, questions: [
      { id: 'correct', options: ['a', 'b'], correctIndex: 0 },
      { id: 'wrong', options: ['a', 'b'], correctIndex: 1 }
    ] },
    { title: 'Quant', positiveMarks: 1, negativeMarks: .25, questions: [{ id: 'blank', options: ['a', 'b'], correctIndex: 0 }] }
  ] }), marks: 5, marks_per_correct: 1, negative_marks: .25 };
  const result = scorePaper(paper, { correct: 0, wrong: 0, blank: null });
  assert.equal(result.score, 1.5);
  assert.equal(result.maxScore, 5);
  assert.deepEqual(result.counts, { correct: 1, wrong: 1, unanswered: 1 });
  assert.deepEqual(result.sectionBreakdown.map(section => section.score), [1.5, 0]);
});

test('unsubmitted papers omit correct answers and explanations recursively', () => {
  const paper = { sections: [{ questions: [{ correctAnswer: 'B', explanationHTML: 'private', options: ['a', 'b'] }] }] };
  const hidden = scrubSolutions(paper);
  assert.equal(hidden.sections[0].questions[0].correctAnswer, undefined);
  assert.equal(hidden.sections[0].questions[0].explanationHTML, undefined);
  assert.deepEqual(hidden.sections[0].questions[0].options, ['a', 'b']);
});
