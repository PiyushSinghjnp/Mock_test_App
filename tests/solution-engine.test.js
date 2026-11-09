'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

test('Solution Engine - Solution Viewing and Navigation', () => {
  const questions = [
    { id: 'q1', questionText: 'Q1', correctAnswer: 'A', explanation: 'Explanation 1' },
    { id: 'q2', questionText: 'Q2', correctAnswer: 'B', explanation: 'Explanation 2' },
    { id: 'q3', questionText: 'Q3', correctAnswer: 'C', explanation: 'Explanation 3' }
  ];

  const userAnswers = { q1: 'A', q2: 'A', q3: 'C' };

  // Filter questions by answer status
  const correctAnswers = questions.filter((q, index) => {
    const questionId = `q${index + 1}`;
    return userAnswers[questionId] === q.correctAnswer;
  });

  assert.equal(correctAnswers.length, 2); // q1 and q3

  const wrongAnswers = questions.filter((q, index) => {
    const questionId = `q${index + 1}`;
    return userAnswers[questionId] !== undefined && userAnswers[questionId] !== q.correctAnswer;
  });

  assert.equal(wrongAnswers.length, 1); // q2

  const unanswered = questions.filter((q, index) => {
    const questionId = `q${index + 1}`;
    return userAnswers[questionId] === undefined;
  });

  assert.equal(unanswered.length, 0);
});

test('Solution Engine - Bookmark Management', () => {
  const bookmarks = new Set();

  // Add bookmark
  bookmarks.add('q1');
  assert.equal(bookmarks.has('q1'), true);
  assert.equal(bookmarks.size, 1);

  // Add another bookmark
  bookmarks.add('q2');
  assert.equal(bookmarks.has('q2'), true);
  assert.equal(bookmarks.size, 2);

  // Remove bookmark
  bookmarks.delete('q1');
  assert.equal(bookmarks.has('q1'), false);
  assert.equal(bookmarks.size, 1);

  // Toggle bookmark
  const toggleBookmark = (questionId) => {
    if (bookmarks.has(questionId)) {
      bookmarks.delete(questionId);
    } else {
      bookmarks.add(questionId);
    }
  };

  toggleBookmark('q3');
  assert.equal(bookmarks.has('q3'), true);

  toggleBookmark('q3');
  assert.equal(bookmarks.has('q3'), false);
});

test('Solution Engine - Filter by Subject', () => {
  const questions = [
    { id: 'q1', subject: 'Reasoning', questionText: 'Q1' },
    { id: 'q2', subject: 'Quant', questionText: 'Q2' },
    { id: 'q3', subject: 'Reasoning', questionText: 'Q3' },
    { id: 'q4', subject: 'English', questionText: 'Q4' },
    { id: 'q5', subject: 'Reasoning', questionText: 'Q5' }
  ];

  const filterBySubject = (subject) => {
    return questions.filter(q => q.subject === subject);
  };

  const reasoningQuestions = filterBySubject('Reasoning');
  assert.equal(reasoningQuestions.length, 3);
  assert.equal(reasoningQuestions[0].id, 'q1');
  assert.equal(reasoningQuestions[1].id, 'q3');
  assert.equal(reasoningQuestions[2].id, 'q5');

  const quantQuestions = filterBySubject('Quant');
  assert.equal(quantQuestions.length, 1);
  assert.equal(quantQuestions[0].id, 'q2');
});

test('Solution Engine - Filter by Answer Status', () => {
  const questions = [
    { id: 'q1', correctAnswer: 'A' },
    { id: 'q2', correctAnswer: 'B' },
    { id: 'q3', correctAnswer: 'C' },
    { id: 'q4', correctAnswer: 'D' }
  ];

  const userAnswers = { q1: 'A', q2: 'A', q4: 'D' }; // q3 unanswered

  const categorizeQuestions = (questions, userAnswers) => {
    return questions.reduce((acc, q) => {
      const userAnswer = userAnswers[q.id];

      if (userAnswer === undefined) {
        acc.unanswered.push(q);
      } else if (userAnswer === q.correctAnswer) {
        acc.correct.push(q);
      } else {
        acc.wrong.push(q);
      }

      return acc;
    }, { correct: [], wrong: [], unanswered: [] });
  };

  const categorized = categorizeQuestions(questions, userAnswers);

  assert.equal(categorized.correct.length, 2); // q1, q4
  assert.equal(categorized.wrong.length, 1); // q2
  assert.equal(categorized.unanswered.length, 1); // q3
});

test('Solution Engine - Retry Mode', () => {
  const questions = [
    { id: 'q1', options: ['A', 'B', 'C', 'D'], correctAnswer: 'A' },
    { id: 'q2', options: ['A', 'B', 'C', 'D'], correctAnswer: 'B' }
  ];

  const userAnswers = { q1: 'B', q2: 'A' }; // Both wrong

  // In retry mode, user can re-attempt
  const retryAnswers = {};

  // Select new answers
  retryAnswers['q1'] = 'A'; // Now correct
  retryAnswers['q2'] = 'B'; // Now correct

  // Calculate retry score
  const retryScore = questions.filter((q, index) => {
    const questionId = `q${index + 1}`;
    return retryAnswers[questionId] === q.correctAnswer;
  }).length;

  assert.equal(retryScore, 2);
});

test('Solution Engine - Explanation Display', () => {
  const question = {
    id: 'q1',
    questionText: 'What is 2+2?',
    options: ['A', 'B', 'C', 'D'],
    correctAnswer: 'A',
    explanation: '2 + 2 = 4',
    explanationHTML: '<p>2 + 2 = 4</p>'
  };

  // Verify explanation exists
  assert.ok(question.explanation);
  assert.ok(question.explanationHTML);

  // Check if explanation is not empty
  assert.ok(question.explanation.length > 0);
  assert.ok(question.explanationHTML.length > 0);
});

test('Solution Engine - Performance Metrics', () => {
  const questions = [
    { id: 'q1', subject: 'Reasoning', correctAnswer: 'A' },
    { id: 'q2', subject: 'Reasoning', correctAnswer: 'B' },
    { id: 'q3', subject: 'Quant', correctAnswer: 'C' },
    { id: 'q4', subject: 'Quant', correctAnswer: 'D' }
  ];

  const userAnswers = { q1: 'A', q2: 'A', q3: 'C', q4: 'D' };

  // Calculate subject-wise performance
  const subjectPerformance = questions.reduce((acc, q) => {
    const subject = q.subject;
    const isCorrect = userAnswers[q.id] === q.correctAnswer;

    if (!acc[subject]) {
      acc[subject] = { total: 0, correct: 0, wrong: 0 };
    }

    acc[subject].total++;
    if (isCorrect) {
      acc[subject].correct++;
    } else {
      acc[subject].wrong++;
    }

    return acc;
  }, {});

  assert.equal(subjectPerformance['Reasoning'].total, 2);
  assert.equal(subjectPerformance['Reasoning'].correct, 1);
  assert.equal(subjectPerformance['Reasoning'].wrong, 1);

  assert.equal(subjectPerformance['Quant'].total, 2);
  assert.equal(subjectPerformance['Quant'].correct, 2);
  assert.equal(subjectPerformance['Quant'].wrong, 0);
});

test('Solution Engine - Time Spent Analysis', () => {
  const questionTimings = {
    q1: { start: 1000, end: 2000 },
    q2: { start: 2000, end: 5000 },
    q3: { start: 5000, end: 6000 }
  };

  // Calculate time spent per question
  const timeSpent = Object.entries(questionTimings).map(([qid, timing]) => ({
    questionId: qid,
    timeSpent: timing.end - timing.start
  }));

  assert.equal(timeSpent[0].timeSpent, 1000); // q1: 1 second
  assert.equal(timeSpent[1].timeSpent, 3000); // q2: 3 seconds
  assert.equal(timeSpent[2].timeSpent, 1000); // q3: 1 second

  // Find slowest question
  const slowest = timeSpent.reduce((max, current) =>
    current.timeSpent > max.timeSpent ? current : max
  );

  assert.equal(slowest.questionId, 'q2');
  assert.equal(slowest.timeSpent, 3000);
});
