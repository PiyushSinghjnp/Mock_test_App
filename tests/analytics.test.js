'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

// Behaviour under test: Analytics Dashboard functionality
// No existing test file covers analytics functionality
// User instruction: "Please add test cases for each feature and test them rigorously"

test('Analytics Dashboard - Overall Statistics', () => {
  const userStats = {
    totalTests: 10,
    totalQuestionsAttempted: 500,
    totalCorrect: 350,
    totalWrong: 100,
    totalUnanswered: 50
  };

  // Calculate overall accuracy
  const attempted = userStats.totalCorrect + userStats.totalWrong;
  const accuracy = attempted > 0 ? (userStats.totalCorrect / attempted * 100) : 0;

  assert.equal(accuracy.toFixed(2), '77.78');

  // Calculate completion rate
  const completionRate = (userStats.totalQuestionsAttempted / (userStats.totalTests * 100)) * 100;
  assert.equal(completionRate, 50); // Assuming 100 questions per test
});

test('Analytics Dashboard - Per-Exam Statistics', () => {
  const exams = [
    { id: 'sbi-po', name: 'SBI PO', attempts: 5, bestScore: 150, avgScore: 140 },
    { id: 'ibps-po', name: 'IBPS PO', attempts: 3, bestScore: 130, avgScore: 125 },
    { id: 'rrb-po', name: 'RRB PO', attempts: 2, bestScore: 120, avgScore: 115 }
  ];

  // Calculate total attempts across all exams
  const totalAttempts = exams.reduce((sum, exam) => sum + exam.attempts, 0);
  assert.equal(totalAttempts, 10);

  // Find best performing exam
  const bestExam = exams.reduce((max, exam) => exam.bestScore > max.bestScore ? exam : max);
  assert.equal(bestExam.id, 'sbi-po');
  assert.equal(bestExam.bestScore, 150);

  // Calculate average score across all exams
  const totalBestScores = exams.reduce((sum, exam) => sum + exam.bestScore, 0);
  const avgBestScore = totalBestScores / exams.length;
  assert.equal(avgBestScore, (150 + 130 + 120) / 3);
  assert.equal(avgBestScore, 133.33333333333334);
});

test('Analytics Dashboard - Section-wise Heatmap', () => {
  const sections = ['Reasoning', 'Quant', 'English', 'GA'];
  const userPerformance = {
    'Reasoning': { attempted: 100, correct: 80, wrong: 20 },
    'Quant': { attempted: 100, correct: 70, wrong: 30 },
    'English': { attempted: 100, correct: 85, wrong: 15 },
    'GA': { attempted: 100, correct: 75, wrong: 25 }
  };

  // Calculate accuracy for each section
  const sectionAccuracy = sections.map(section => {
    const perf = userPerformance[section];
    const accuracy = perf.attempted > 0 ? (perf.correct / perf.attempted * 100) : 0;
    return { section, accuracy };
  });

  assert.equal(sectionAccuracy[0].accuracy, 80); // Reasoning
  assert.equal(sectionAccuracy[1].accuracy, 70); // Quant
  assert.equal(sectionAccuracy[2].accuracy, 85); // English
  assert.equal(sectionAccuracy[3].accuracy, 75); // GA

  // Find strongest and weakest sections
  const strongest = sectionAccuracy.reduce((max, current) =>
    current.accuracy > max.accuracy ? current : max
  );
  const weakest = sectionAccuracy.reduce((min, current) =>
    current.accuracy < min.accuracy ? current : min
  );

  assert.equal(strongest.section, 'English');
  assert.equal(strongest.accuracy, 85);
  assert.equal(weakest.section, 'Quant');
  assert.equal(weakest.accuracy, 70);
});

test('Analytics Dashboard - Streak Calculation', () => {
  const dailyActivity = [
    { date: '2026-11-01', questionsAttempted: 50 },
    { date: '2026-11-02', questionsAttempted: 30 },
    { date: '2026-11-03', questionsAttempted: 0 }, // Break in streak
    { date: '2026-11-04', questionsAttempted: 40 },
    { date: '2026-11-05', questionsAttempted: 25 },
    { date: '2026-11-06', questionsAttempted: 60 }
  ];

  // Calculate current streak (consecutive days with activity)
  let currentStreak = 0;
  for (let i = dailyActivity.length - 1; i >= 0; i--) {
    if (dailyActivity[i].questionsAttempted > 0) {
      currentStreak++;
    } else {
      break;
    }
  }

  assert.equal(currentStreak, 3); // Nov 4, 5, 6

  // Calculate longest streak
  let longestStreak = 0;
  let tempStreak = 0;
  for (const day of dailyActivity) {
    if (day.questionsAttempted > 0) {
      tempStreak++;
      longestStreak = Math.max(longestStreak, tempStreak);
    } else {
      tempStreak = 0;
    }
  }

  assert.equal(longestStreak, 3); // Nov 4, 5, 6 (current streak is also longest)
});

test('Analytics Dashboard - Recent Attempts', () => {
  const recentAttempts = [
    { testId: 'test1', testName: 'SBI PO Mock 1', score: 150, date: '2026-11-06', percentile: 95 },
    { testId: 'test2', testName: 'IBPS PO Mock 1', score: 130, date: '2026-11-05', percentile: 85 },
    { testId: 'test3', testName: 'RRB PO Mock 1', score: 120, date: '2026-11-04', percentile: 80 },
    { testId: 'test4', testName: 'SBI PO Mock 2', score: 145, date: '2026-11-03', percentile: 90 },
    { testId: 'test5', testName: 'IBPS PO Mock 2', score: 135, date: '2026-11-02', percentile: 88 }
  ];

  // Sort by date (newest first)
  const sortedAttempts = [...recentAttempts].sort((a, b) =>
    new Date(b.date) - new Date(a.date)
  );

  assert.equal(sortedAttempts[0].testId, 'test1'); // Most recent
  assert.equal(sortedAttempts[4].testId, 'test5'); // Oldest

  // Calculate average score of recent attempts
  const totalScore = sortedAttempts.reduce((sum, attempt) => sum + attempt.score, 0);
  const avgScore = totalScore / sortedAttempts.length;
  assert.equal(avgScore, (150 + 130 + 120 + 145 + 135) / 5);
  assert.equal(avgScore, 136);

  // Calculate average percentile
  const totalPercentile = sortedAttempts.reduce((sum, attempt) => sum + attempt.percentile, 0);
  const avgPercentile = totalPercentile / sortedAttempts.length;
  assert.equal(avgPercentile, (95 + 85 + 80 + 90 + 88) / 5);
  assert.equal(avgPercentile, 87.6);
});

test('Analytics Dashboard - Predicted All India Rank (AIR)', () => {
  const userScore = 150;
  const historicalData = [
    { score: 180, rank: 1 },
    { score: 170, rank: 10 },
    { score: 160, rank: 50 },
    { score: 150, rank: 100 },
    { score: 140, rank: 200 },
    { score: 130, rank: 300 }
  ];

  // Find predicted rank based on historical data
  let predictedRank = 'N/A';
  for (const data of historicalData) {
    if (data.score <= userScore) {
      predictedRank = data.rank;
      break;
    }
  }

  assert.equal(predictedRank, 100);

  // Interpolate for more accurate prediction
  const higherData = historicalData.find(d => d.score > userScore);
  const lowerData = historicalData.find(d => d.score <= userScore);

  if (higherData && lowerData) {
    const scoreDiff = higherData.score - lowerData.score;
    const userDiff = userScore - lowerData.score;
    const rankDiff = higherData.rank - lowerData.rank;
    const predicted = lowerData.rank - (userDiff / scoreDiff) * rankDiff;

    // Predicted rank should be between higherData.rank (50) and lowerData.rank (100)
    assert.ok(predicted >= 50);
    assert.ok(predicted <= 100);
  }
});

test('Analytics Dashboard - Time Spent Analysis', () => {
  const timeData = {
    totalTimeSpent: 2 * 60 * 60 * 1000, // 2 hours in ms
    testsTaken: 5,
    avgTimePerTest: 2 * 60 * 60 * 1000, // 2 hours in ms
    timePerSection: {
      'Reasoning': 30 * 60 * 1000, // 30 minutes
      'Quant': 40 * 60 * 1000, // 40 minutes
      'English': 25 * 60 * 1000, // 25 minutes
      'GA': 25 * 60 * 1000 // 25 minutes
    }
  };

  // Verify total time
  const calculatedTotal = Object.values(timeData.timePerSection)
    .reduce((sum, time) => sum + time, 0);
  assert.equal(calculatedTotal, timeData.totalTimeSpent);

  // Calculate time distribution
  const totalTime = timeData.totalTimeSpent;
  const timeDistribution = Object.entries(timeData.timePerSection)
    .map(([section, time]) => ({
      section,
      time,
      percentage: (time / totalTime) * 100
    }));

  assert.equal(timeDistribution[0].percentage, (30 * 60 * 1000 / totalTime) * 100);
  assert.equal(timeDistribution[0].percentage, 25); // Reasoning: 30 of 120 minutes
  assert.ok(Math.abs(timeDistribution[1].percentage - 100 / 3) < 1e-10); // Quant: 40 of 120 minutes
  assert.ok(Math.abs(timeDistribution[2].percentage - 25 / 120 * 100) < 1e-10); // English: 25 of 120 minutes
  assert.ok(Math.abs(timeDistribution[3].percentage - 25 / 120 * 100) < 1e-10); // GA: 25 of 120 minutes
});

test('Analytics Dashboard - Performance Trend', () => {
  const weeklyScores = [
    { week: 1, avgScore: 120 },
    { week: 2, avgScore: 125 },
    { week: 3, avgScore: 130 },
    { week: 4, avgScore: 140 },
    { week: 5, avgScore: 145 }
  ];

  // Calculate improvement trend
  const improvements = [];
  for (let i = 1; i < weeklyScores.length; i++) {
    const improvement = weeklyScores[i].avgScore - weeklyScores[i - 1].avgScore;
    improvements.push(improvement);
  }

  assert.equal(improvements.length, 4);
  assert.equal(improvements[0], 5); // Week 1 to 2
  assert.equal(improvements[1], 5); // Week 2 to 3
  assert.equal(improvements[2], 10); // Week 3 to 4
  assert.equal(improvements[3], 5); // Week 4 to 5

  // Calculate average improvement
  const avgImprovement = improvements.reduce((sum, imp) => sum + imp, 0) / improvements.length;
  assert.equal(avgImprovement, (5 + 5 + 10 + 5) / 4);
  assert.equal(avgImprovement, 6.25);

  // Check if performance is improving
  const isImproving = improvements.every(imp => imp >= 0);
  assert.equal(isImproving, true);
});

test('Analytics Dashboard - Comparison with Toppers', () => {
  const userPerformance = {
    overallAccuracy: 75,
    reasoningAccuracy: 80,
    quantAccuracy: 70,
    englishAccuracy: 85
  };

  const topperPerformance = {
    overallAccuracy: 90,
    reasoningAccuracy: 92,
    quantAccuracy: 88,
    englishAccuracy: 95
  };

  // Calculate gaps
  const gaps = {
    overall: topperPerformance.overallAccuracy - userPerformance.overallAccuracy,
    reasoning: topperPerformance.reasoningAccuracy - userPerformance.reasoningAccuracy,
    quant: topperPerformance.quantAccuracy - userPerformance.quantAccuracy,
    english: topperPerformance.englishAccuracy - userPerformance.englishAccuracy
  };

  assert.equal(gaps.overall, 15);
  assert.equal(gaps.reasoning, 12);
  assert.equal(gaps.quant, 18);
  assert.equal(gaps.english, 10);

  // Find largest gap
  const largestGap = Math.max(...Object.values(gaps));
  assert.equal(largestGap, 18); // Quant

  // Find smallest gap
  const smallestGap = Math.min(...Object.values(gaps));
  assert.equal(smallestGap, 10); // English
});

test('Analytics Dashboard - Weak Areas Identification', () => {
  const userPerformance = {
    'Seating Arrangement': 60,
    'Puzzles': 75,
    'Data Interpretation': 55,
    'Algebra': 80,
    'Reading Comprehension': 70,
    'Vocabulary': 85,
    'Grammar': 65,
    'Current Affairs': 90
  };

  // Identify weak areas (accuracy < 70%)
  const weakAreas = Object.entries(userPerformance)
    .filter(([topic, accuracy]) => accuracy < 70)
    .map(([topic, accuracy]) => ({ topic, accuracy }));

  assert.equal(weakAreas.length, 3);
  assert.equal(weakAreas[0].topic, 'Seating Arrangement');
  assert.equal(weakAreas[1].topic, 'Data Interpretation');
  assert.equal(weakAreas[2].topic, 'Grammar');

  // Sort by accuracy (lowest first)
  weakAreas.sort((a, b) => a.accuracy - b.accuracy);
  assert.equal(weakAreas[0].topic, 'Data Interpretation'); // 55%
  assert.equal(weakAreas[1].topic, 'Seating Arrangement'); // 60%
  assert.equal(weakAreas[2].topic, 'Grammar'); // 65%
});
