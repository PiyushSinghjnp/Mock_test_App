'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { EXAM_PATTERNS_2026, apply2026PatternToQuestionPaper, normalizeCorrectIndex } = require('../js/exam-patterns-2026');

test('2026 exam registry has valid prelims and mains timing and marking data', () => {
  assert.ok(Object.keys(EXAM_PATTERNS_2026).length >= 10);
  for (const [examId, exam] of Object.entries(EXAM_PATTERNS_2026)) {
    assert.equal(exam.examId, examId);
    for (const stageId of ['prelims', 'mains']) {
      const stage = exam.stages[stageId];
      assert.ok(stage, `${examId} should define ${stageId}`);
      assert.ok(stage.totalDurationSeconds > 0, `${examId}/${stageId} should define duration`);
      assert.ok(stage.totalQuestions > 0, `${examId}/${stageId} should define question count`);
      assert.ok(stage.markingScheme.positive > 0);
      assert.ok(stage.markingScheme.negative >= 0);
      assert.ok(stage.sections.length > 0);
      assert.ok(stage.sections.every(section => section.durationSeconds > 0 && section.questionCount > 0));
      if (stage.hasSectionalTiming) {
        assert.equal(stage.sections.reduce((sum, section) => sum + section.durationSeconds, 0), stage.totalDurationSeconds,
          `${examId}/${stageId} section durations should sum to total duration`);
      }
    }
  }
});

test('pattern application normalizes question answers, marking and section timing', () => {
  const normalized = apply2026PatternToQuestionPaper({
    title: 'SBI PO Prelims Mock',
    sections: [{ title: 'English Language', questions: [
      { id: 'q1', question: 'Pick B', options: ['A', 'B', 'C', 'D'], correctAnswer: 'B' },
      { id: 'q2', question: 'Pick A', options: { A: 'yes', B: 'no' }, answer: 'A', explanation: 'Because.' }
    ] }]
  }, { testId: 'pattern-regression' });

  assert.equal(normalized.id, 'pattern-regression');
  assert.equal(normalized.examId, 'sbi-po');
  assert.equal(normalized.type, 'prelims');
  assert.equal(normalized.hasSectionalTiming, true);
  assert.equal(normalized.isSectionalLocked, true);
  const [section] = normalized.sections;
  assert.equal(section.title, 'English Language');
  assert.equal(section.durationSeconds, 1200);
  assert.equal(section.negativeMarks, 0.25);
  assert.deepEqual(section.questions.map(question => question.correctIndex), [1, 0]);
  assert.deepEqual(section.questions[0].options.map(option => option.letter), ['A', 'B', 'C', 'D']);
  assert.equal(normalized.questionsCount, 2);
});

test('answer normalization rejects unknown answers rather than inventing a correct option', () => {
  assert.equal(normalizeCorrectIndex({ correctAnswer: 'Z' }, [{ letter: 'A' }, { letter: 'B' }]), null);
  assert.equal(normalizeCorrectIndex({ correctIndex: 1 }, [{ letter: 'A' }, { letter: 'B' }]), 1);
});

test('pattern application rejects malformed question paper structures', () => {
  assert.throws(() => apply2026PatternToQuestionPaper(null), /Invalid JSON question paper object/);
  assert.throws(() => apply2026PatternToQuestionPaper({ title: 'empty' }), /must contain either/);
});
