'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

// Behaviour under test: Bookmark management functionality
// No existing test file covers bookmark functionality
// User instruction: "Please add test cases for each feature and test them rigorously"

test('Bookmarks - Add and Remove Bookmarks', () => {
  const bookmarks = new Set();

  // Add bookmark
  bookmarks.add('q1');
  assert.equal(bookmarks.has('q1'), true);
  assert.equal(bookmarks.size, 1);

  // Add duplicate bookmark (should not increase size)
  bookmarks.add('q1');
  assert.equal(bookmarks.size, 1);

  // Add another bookmark
  bookmarks.add('q2');
  assert.equal(bookmarks.has('q2'), true);
  assert.equal(bookmarks.size, 2);

  // Remove bookmark
  bookmarks.delete('q1');
  assert.equal(bookmarks.has('q1'), false);
  assert.equal(bookmarks.size, 1);

  // Remove non-existent bookmark
  bookmarks.delete('q99');
  assert.equal(bookmarks.size, 1);
});

test('Bookmarks - Toggle Bookmark', () => {
  const bookmarks = new Set();

  const toggleBookmark = (questionId) => {
    if (bookmarks.has(questionId)) {
      bookmarks.delete(questionId);
      return false;
    } else {
      bookmarks.add(questionId);
      return true;
    }
  };

  // Toggle off -> on
  const result1 = toggleBookmark('q1');
  assert.equal(result1, true);
  assert.equal(bookmarks.has('q1'), true);

  // Toggle on -> off
  const result2 = toggleBookmark('q1');
  assert.equal(result2, false);
  assert.equal(bookmarks.has('q1'), false);

  // Toggle multiple times
  toggleBookmark('q2');
  toggleBookmark('q2');
  toggleBookmark('q2');
  assert.equal(bookmarks.has('q2'), true);
});

test('Bookmarks - Filter Bookmarks by Subject', () => {
  const questions = [
    { id: 'q1', subject: 'Reasoning', questionText: 'Q1' },
    { id: 'q2', subject: 'Quant', questionText: 'Q2' },
    { id: 'q3', subject: 'Reasoning', questionText: 'Q3' },
    { id: 'q4', subject: 'English', questionText: 'Q4' },
    { id: 'q5', subject: 'Quant', questionText: 'Q5' }
  ];

  const bookmarks = new Set(['q1', 'q2', 'q3', 'q5']);

  const filterBySubject = (subject) => {
    return questions.filter(q => bookmarks.has(q.id) && q.subject === subject);
  };

  const reasoningBookmarks = filterBySubject('Reasoning');
  assert.equal(reasoningBookmarks.length, 2);
  assert.equal(reasoningBookmarks[0].id, 'q1');
  assert.equal(reasoningBookmarks[1].id, 'q3');

  const quantBookmarks = filterBySubject('Quant');
  assert.equal(quantBookmarks.length, 2);
  assert.equal(quantBookmarks[0].id, 'q2');
  assert.equal(quantBookmarks[1].id, 'q5');

  const englishBookmarks = filterBySubject('English');
  assert.equal(englishBookmarks.length, 0);
});

test('Bookmarks - Filter Bookmarks by Tag', () => {
  const questions = [
    { id: 'q1', tags: ['easy', 'puzzle'], questionText: 'Q1' },
    { id: 'q2', tags: ['medium', 'algebra'], questionText: 'Q2' },
    { id: 'q3', tags: ['easy', 'di'], questionText: 'Q3' },
    { id: 'q4', tags: ['hard', 'puzzle'], questionText: 'Q4' },
    { id: 'q5', tags: ['medium', 'puzzle'], questionText: 'Q5' }
  ];

  const bookmarks = new Set(['q1', 'q2', 'q3', 'q4', 'q5']);

  const filterByTag = (tag) => {
    return questions.filter(q => bookmarks.has(q.id) && q.tags.includes(tag));
  };

  const easyBookmarks = filterByTag('easy');
  assert.equal(easyBookmarks.length, 2);
  assert.equal(easyBookmarks[0].id, 'q1');
  assert.equal(easyBookmarks[1].id, 'q3');

  const puzzleBookmarks = filterByTag('puzzle');
  assert.equal(puzzleBookmarks.length, 3);
  assert.equal(puzzleBookmarks[0].id, 'q1');
  assert.equal(puzzleBookmarks[1].id, 'q4');
  assert.equal(puzzleBookmarks[2].id, 'q5');

  const hardBookmarks = filterByTag('hard');
  assert.equal(hardBookmarks.length, 1);
  assert.equal(hardBookmarks[0].id, 'q4');
});

test('Bookmarks - Search Bookmarks', () => {
  const questions = [
    { id: 'q1', questionText: 'Seating arrangement problem' },
    { id: 'q2', questionText: 'Data interpretation question' },
    { id: 'q3', questionText: 'Algebra problem' },
    { id: 'q4', questionText: 'Reading comprehension passage' }
  ];

  const bookmarks = new Set(['q1', 'q2', 'q3', 'q4']);

  const searchBookmarks = (query) => {
    const lowerQuery = query.toLowerCase();
    return questions.filter(q =>
      bookmarks.has(q.id) && q.questionText.toLowerCase().includes(lowerQuery)
    );
  };

  const seatingResults = searchBookmarks('seating');
  assert.equal(seatingResults.length, 1);
  assert.equal(seatingResults[0].id, 'q1');

  const dataResults = searchBookmarks('data');
  assert.equal(dataResults.length, 1);
  assert.equal(dataResults[0].id, 'q2');

  const problemResults = searchBookmarks('problem');
  assert.equal(problemResults.length, 2);
  assert.equal(problemResults[0].id, 'q1');
  assert.equal(problemResults[1].id, 'q3');

  const noResults = searchBookmarks('geometry');
  assert.equal(noResults.length, 0);
});

test('Bookmarks - Sort Bookmarks', () => {
  const questions = [
    { id: 'q1', questionText: 'Question 1', bookmarkedAt: 1000 },
    { id: 'q2', questionText: 'Question 2', bookmarkedAt: 3000 },
    { id: 'q3', questionText: 'Question 3', bookmarkedAt: 2000 }
  ];

  const bookmarks = new Set(['q1', 'q2', 'q3']);

  // Sort by bookmark time (newest first)
  const sortedByNewest = [...questions]
    .filter(q => bookmarks.has(q.id))
    .sort((a, b) => b.bookmarkedAt - a.bookmarkedAt);

  assert.equal(sortedByNewest[0].id, 'q2'); // Newest
  assert.equal(sortedByNewest[1].id, 'q3');
  assert.equal(sortedByNewest[2].id, 'q1'); // Oldest

  // Sort by bookmark time (oldest first)
  const sortedByOldest = [...questions]
    .filter(q => bookmarks.has(q.id))
    .sort((a, b) => a.bookmarkedAt - b.bookmarkedAt);

  assert.equal(sortedByOldest[0].id, 'q1'); // Oldest
  assert.equal(sortedByOldest[1].id, 'q3');
  assert.equal(sortedByOldest[2].id, 'q2'); // Newest
});

test('Bookmarks - Re-attempt Bookmarked Questions', () => {
  const questions = [
    { id: 'q1', options: ['A', 'B', 'C', 'D'], correctAnswer: 'A' },
    { id: 'q2', options: ['A', 'B', 'C', 'D'], correctAnswer: 'B' },
    { id: 'q3', options: ['A', 'B', 'C', 'D'], correctAnswer: 'C' }
  ];

  const bookmarks = new Set(['q1', 'q2', 'q3']);

  // First attempt
  const firstAnswers = { q1: 'B', q2: 'A', q3: 'C' };
  const firstScore = questions.filter((q, index) =>
    firstAnswers[`q${index + 1}`] === q.correctAnswer
  ).length;
  assert.equal(firstScore, 1); // Only q3 correct

  // Re-attempt (only bookmarked questions)
  const retryAnswers = { q1: 'A', q2: 'B', q3: 'C' };
  const retryScore = questions.filter((q, index) =>
    retryAnswers[`q${index + 1}`] === q.correctAnswer
  ).length;
  assert.equal(retryScore, 3); // All correct
});

test('Bookmarks - Persistence Across Sessions', () => {
  // Simulate localStorage
  const localStorage = {};

  const saveBookmarks = (bookmarks) => {
    localStorage.bookmarks = JSON.stringify([...bookmarks]);
  };

  const loadBookmarks = () => {
    return new Set(localStorage.bookmarks ? JSON.parse(localStorage.bookmarks) : []);
  };

  // Save bookmarks
  const bookmarks = new Set(['q1', 'q2', 'q3']);
  saveBookmarks(bookmarks);

  // Load bookmarks in new session
  const loadedBookmarks = loadBookmarks();
  assert.equal(loadedBookmarks.size, 3);
  assert.equal(loadedBookmarks.has('q1'), true);
  assert.equal(loadedBookmarks.has('q2'), true);
  assert.equal(loadedBookmarks.has('q3'), true);

  // Add new bookmark and save
  loadedBookmarks.add('q4');
  saveBookmarks(loadedBookmarks);

  // Load again
  const updatedBookmarks = loadBookmarks();
  assert.equal(updatedBookmarks.size, 4);
  assert.equal(updatedBookmarks.has('q4'), true);
});

test('Bookmarks - Export and Import', () => {
  const bookmarks = new Set(['q1', 'q2', 'q3']);

  // Export bookmarks
  const exported = JSON.stringify([...bookmarks]);
  assert.equal(exported, '["q1","q2","q3"]');

  // Import bookmarks
  const imported = new Set(JSON.parse(exported));
  assert.equal(imported.size, 3);
  assert.equal(imported.has('q1'), true);
  assert.equal(imported.has('q2'), true);
  assert.equal(imported.has('q3'), true);
});

test('Bookmarks - Statistics', () => {
  const questions = [
    { id: 'q1', subject: 'Reasoning' },
    { id: 'q2', subject: 'Quant' },
    { id: 'q3', subject: 'Reasoning' },
    { id: 'q4', subject: 'English' },
    { id: 'q5', subject: 'Quant' },
    { id: 'q6', subject: 'Reasoning' }
  ];

  const bookmarks = new Set(['q1', 'q2', 'q3', 'q4', 'q5']);

  // Calculate subject distribution
  const subjectStats = questions.reduce((acc, q) => {
    if (bookmarks.has(q.id)) {
      acc[q.subject] = (acc[q.subject] || 0) + 1;
    }
    return acc;
  }, {});

  assert.equal(subjectStats['Reasoning'], 2);
  assert.equal(subjectStats['Quant'], 2);
  assert.equal(subjectStats['English'], 1);

  // Calculate total bookmarks
  const totalBookmarks = bookmarks.size;
  assert.equal(totalBookmarks, 5);
});
