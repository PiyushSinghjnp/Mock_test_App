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

test('authoritative scoring normalizes answer formats and clamps invalid time values', () => {
  const testRow = { marks: 4, marks_per_correct: 2, negative_marks: 0.5, test_data_json: JSON.stringify({
    sections: [{ title: 'Mixed', questions: [
      { id: 'letter', correctAnswer: 'B', options: ['a', 'b', 'c'] },
      { id: 'index', correctIndex: 2, options: ['a', 'b', 'c'] },
      { id: 'number', correctAnswer: '0', options: ['a', 'b', 'c'] }
    ] }]
  }) };
  const result = scorePaper(testRow, {
    letter: { selectedIndex: 1, timeSpentSeconds: -20 },
    index: '2',
    number: { answerIndex: 2, timeSpentSeconds: 100_000 }
  });
  assert.deepEqual(result.counts, { correct: 2, wrong: 1, unanswered: 0 });
  assert.equal(result.score, 3.5);
  assert.deepEqual(result.normalizedResponses.letter, { selectedIndex: 1, status: 'stic-answered', timeSpentSeconds: 0 });
  assert.equal(result.normalizedResponses.index.timeSpentSeconds, 0);
  assert.equal(result.normalizedResponses.number.timeSpentSeconds, 86400);
});

test('authoritative scoring rejects out-of-range answers and invalid trusted answer keys', () => {
  const base = { marks: 1, marks_per_correct: 1, negative_marks: 0, test_data_json: JSON.stringify({
    sections: [{ questions: [{ id: 'q1', correctIndex: 0, options: ['a', 'b'] }] }]
  }) };
  assert.throws(() => scorePaper(base, { q1: 2 }), /outside the trusted question options/);
  const invalidKey = { ...base, test_data_json: JSON.stringify({ sections: [{ questions: [
    { id: 'q1', correctAnswer: 'Z', options: ['a', 'b'] }
  ] }] }) };
  assert.throws(() => scorePaper(invalidKey, { q1: 0 }), /Trusted test answer data is invalid/);
});

test('unsubmitted papers omit correct answers and explanations recursively', () => {
  const paper = { sections: [{ questions: [{ correctAnswer: 'B', explanationHTML: 'private', options: ['a', 'b'] }] }] };
  const hidden = scrubSolutions(paper);
  assert.equal(hidden.sections[0].questions[0].correctAnswer, undefined);
  assert.equal(hidden.sections[0].questions[0].explanationHTML, undefined);
  assert.deepEqual(hidden.sections[0].questions[0].options, ['a', 'b']);
});
