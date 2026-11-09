'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

test('Scorecard - Score Calculation with Marking Scheme', () => {
  const markingScheme = {
    positiveMarks: 2,
    negativeMarks: 0.5,
    totalQuestions: 100,
    totalMarks: 200
  };

  const attempt = {
    correct: 75,
    wrong: 15,
    unanswered: 10
  };

  // Calculate raw score
  const rawScore = (attempt.correct * markingScheme.positiveMarks) -
                   (attempt.wrong * markingScheme.negativeMarks);

  assert.equal(rawScore, 75 * 2 - 15 * 0.5);
  assert.equal(rawScore, 150 - 7.5);
  assert.equal(rawScore, 142.5);

  // Calculate percentage
  const percentage = (rawScore / markingScheme.totalMarks) * 100;
  assert.equal(percentage, (142.5 / 200) * 100);
  assert.equal(percentage, 71.25);
});

test('Scorecard - Section-wise Breakdown', () => {
  const sections = [
    { id: 's1', title: 'Reasoning', positiveMarks: 2, negativeMarks: 0.5, questions: 30 },
    { id: 's2', title: 'Quant', positiveMarks: 2, negativeMarks: 0.5, questions: 30 },
    { id: 's3', title: 'English', positiveMarks: 1, negativeMarks: 0.25, questions: 40 }
  ];

  const sectionAttempts = {
    s1: { correct: 20, wrong: 5, unanswered: 5 },
    s2: { correct: 25, wrong: 3, unanswered: 2 },
    s3: { correct: 30, wrong: 5, unanswered: 5 }
  };

  // Calculate section scores
  const sectionScores = sections.map(section => {
    const attempt = sectionAttempts[section.id];
    const score = (attempt.correct * section.positiveMarks) -
                  (attempt.wrong * section.negativeMarks);
    return { id: section.id, score, maxScore: section.questions * section.positiveMarks };
  });

  assert.equal(sectionScores[0].score, 20 * 2 - 5 * 0.5); // Reasoning
  assert.equal(sectionScores[0].score, 40 - 2.5);
  assert.equal(sectionScores[0].score, 37.5);

  assert.equal(sectionScores[1].score, 25 * 2 - 3 * 0.5); // Quant
  assert.equal(sectionScores[1].score, 50 - 1.5);
  assert.equal(sectionScores[1].score, 48.5);

  assert.equal(sectionScores[2].score, 30 * 1 - 5 * 0.25); // English
  assert.equal(sectionScores[2].score, 30 - 1.25);
  assert.equal(sectionScores[2].score, 28.75);
});

test('Scorecard - Accuracy Calculation', () => {
  const attempt = {
    correct: 80,
    wrong: 10,
    unanswered: 10
  };

  const attempted = attempt.correct + attempt.wrong;
  const accuracy = (attempt.correct / attempted * 100);

  assert.equal(accuracy, (80 / 90 * 100));
  assert.equal(accuracy.toFixed(2), '88.89');
});

test('Scorecard - Percentile Calculation', () => {
  // Percentile formula: (number of candidates below you / total candidates) * 100
  const userScore = 150;
  const allScores = [120, 130, 140, 145, 150, 155, 160, 170, 180, 190];

  // Count candidates with score <= user
  const candidatesBelow = allScores.filter(score => score < userScore).length;
  const totalCandidates = allScores.length;

  const percentile = (candidatesBelow / totalCandidates) * 100;

  assert.equal(candidatesBelow, 4); // 120, 130, 140, 145
  assert.equal(percentile, (4 / 10) * 100);
  assert.equal(percentile, 40);
});

test('Scorecard - All India Rank (AIR) Calculation', () => {
  const allScores = [190, 180, 170, 160, 155, 150, 145, 140, 130, 120];
  const userScore = 150;

  // Sort in descending order and find rank
  const sortedScores = [...allScores].sort((a, b) => b - a);
  const rank = sortedScores.findIndex(score => score === userScore) + 1;

  assert.equal(rank, 6); // 150 is the 6th highest score
});

test('Scorecard - Topper Comparison', () => {
  const userScore = 150;
  const topperScore = 190;
  const maxScore = 200;

  // Calculate difference from topper
  const difference = topperScore - userScore;
  const percentageBehind = (difference / maxScore) * 100;

  assert.equal(difference, 40);
  assert.equal(percentageBehind, (40 / 200) * 100);
  assert.equal(percentageBehind, 20);
});

test('Scorecard - Topic-wise Breakdown', () => {
  const topics = [
    { id: 't1', name: 'Seating Arrangement', maxMarks: 20 },
    { id: 't2', name: 'Puzzles', maxMarks: 20 },
    { id: 't3', name: 'Data Interpretation', maxMarks: 20 },
    { id: 't4', name: 'Algebra', maxMarks: 20 },
    { id: 't5', name: 'Reading Comprehension', maxMarks: 20 }
  ];

  const topicScores = {
    t1: 15,
    t2: 18,
    t3: 12,
    t4: 16,
    t5: 14
  };

  // Calculate topic-wise performance
  const topicPerformance = topics.map(topic => {
    const score = topicScores[topic.id];
    const percentage = (score / topic.maxMarks) * 100;
    return { id: topic.id, score, maxMarks: topic.maxMarks, percentage };
  });

  assert.equal(topicPerformance[0].percentage, (15 / 20) * 100); // Seating Arrangement
  assert.equal(topicPerformance[0].percentage, 75);

  assert.equal(topicPerformance[1].percentage, (18 / 20) * 100); // Puzzles
  assert.equal(topicPerformance[1].percentage, 90);

  // Find strongest and weakest topics
  const strongest = topicPerformance.reduce((max, current) =>
    current.percentage > max.percentage ? current : max
  );
  const weakest = topicPerformance.reduce((min, current) =>
    current.percentage < min.percentage ? current : min
  );

  assert.equal(strongest.id, 't2'); // Puzzles
  assert.equal(weakest.id, 't3'); // Data Interpretation
});

test('Scorecard - Attempt Analysis', () => {
  const attempt = {
    totalQuestions: 100,
    attempted: 85,
    correct: 70,
    wrong: 15,
    unanswered: 15
  };

  // Calculate attempt percentage
  const attemptPercentage = (attempt.attempted / attempt.totalQuestions) * 100;
  assert.equal(attemptPercentage, 85);

  // Calculate correct percentage of attempted
  const correctPercentage = (attempt.correct / attempt.attempted) * 100;
  assert.equal(correctPercentage.toFixed(2), '82.35');

  // Calculate wrong percentage of attempted
  const wrongPercentage = (attempt.wrong / attempt.attempted) * 100;
  assert.equal(wrongPercentage.toFixed(2), '17.65');
});

test('Scorecard - Time Management Analysis', () => {
  const sectionTimings = {
    s1: { allocated: 20 * 60, spent: 18 * 60 }, // 20 min allocated, 18 min spent
    s2: { allocated: 40 * 60, spent: 35 * 60 }, // 40 min allocated, 35 min spent
    s3: { allocated: 30 * 60, spent: 28 * 60 }  // 30 min allocated, 28 min spent
  };

  // Calculate time utilization per section
  const timeUtilization = Object.entries(sectionTimings).map(([id, timing]) => ({
    id,
    allocated: timing.allocated,
    spent: timing.spent,
    utilization: (timing.spent / timing.allocated) * 100
  }));

  assert.equal(timeUtilization[0].utilization, (18 * 60 / (20 * 60)) * 100);
  assert.equal(timeUtilization[0].utilization, 90);

  assert.equal(timeUtilization[1].utilization, (35 * 60 / (40 * 60)) * 100);
  assert.equal(timeUtilization[1].utilization, 87.5);

  // Calculate total time spent vs allocated
  const totalAllocated = Object.values(sectionTimings).reduce((sum, t) => sum + t.allocated, 0);
  const totalSpent = Object.values(sectionTimings).reduce((sum, t) => sum + t.spent, 0);
  const overallUtilization = (totalSpent / totalAllocated) * 100;

  assert.equal(totalAllocated, (20 + 40 + 30) * 60);
  assert.equal(totalAllocated, 5400);
  assert.equal(totalSpent, (18 + 35 + 28) * 60);
  assert.equal(totalSpent, 4860);
  assert.equal(overallUtilization.toFixed(2), '90.00');
});

test('Scorecard - Strengths and Weaknesses Identification', () => {
  const sectionScores = [
    { id: 's1', score: 35, maxScore: 40, subject: 'Reasoning' },
    { id: 's2', score: 45, maxScore: 50, subject: 'Quant' },
    { id: 's3', score: 25, maxScore: 40, subject: 'English' }
  ];

  // Identify strengths (score >= 80% of max)
  const strengths = sectionScores.filter(s => (s.score / s.maxScore) >= 0.8);
  assert.equal(strengths.length, 2); // Reasoning and Quant

  // Identify weaknesses (score < 70% of max)
  const weaknesses = sectionScores.filter(s => (s.score / s.maxScore) < 0.7);
  assert.equal(weaknesses.length, 1); // English

  // Identify areas for improvement (70% <= score < 80%)
  const needsImprovement = sectionScores.filter(s =>
    (s.score / s.maxScore) >= 0.7 && (s.score / s.maxScore) < 0.8
  );
  assert.equal(needsImprovement.length, 0);
});
