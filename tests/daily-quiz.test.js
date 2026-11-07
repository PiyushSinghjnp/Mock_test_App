'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { DatabaseSync } = require('node:sqlite');

function parseQuizQuestions(data, format, defaultSubject) {
  const questions = [];
  const subjectName = (defaultSubject || 'General').trim();

  if (format === 'json' || (typeof data === 'object')) {
    let rawList = [];
    if (typeof data === 'string') {
      try {
        const parsed = JSON.parse(data);
        rawList = Array.isArray(parsed) ? parsed : (Array.isArray(parsed.questions) ? parsed.questions : [parsed]);
      } catch (e) {
        throw new Error('Invalid JSON format: ' + e.message);
      }
    } else if (Array.isArray(data)) {
      rawList = data;
    } else if (data && Array.isArray(data.questions)) {
      rawList = data.questions;
    }

    rawList.forEach((q, idx) => {
      const qText = q.question || q.questionText || q.text || q.title || '';
      if (!qText.trim()) return;

      let opts = [];
      if (Array.isArray(q.options)) {
        opts = q.options.map((opt, oIdx) => {
          if (typeof opt === 'string') {
            const letter = String.fromCharCode(65 + oIdx);
            return { letter, text: opt, html: opt };
          }
          const letter = opt.letter || String.fromCharCode(65 + oIdx);
          const txt = opt.text || opt.html || `Option ${letter}`;
          return { letter, text: txt, html: opt.html || txt };
        });
      }

      if (opts.length < 2) {
        opts = [
          { letter: 'A', text: 'Option A', html: 'Option A' },
          { letter: 'B', text: 'Option B', html: 'Option B' }
        ];
      }

      let correct = 'A';
      if (typeof q.correctAnswer === 'string' && q.correctAnswer.trim()) {
        correct = q.correctAnswer.trim().toUpperCase().charAt(0);
      }

      questions.push({
        id: `quiz-q-${idx}`,
        subject: (q.subject || subjectName).trim(),
        questionText: qText.trim(),
        options: opts,
        correctAnswer: correct,
        explanationHTML: q.explanation || ''
      });
    });
  } else {
    // TEXT FORMAT PARSER
    const text = String(data || '');
    const qBlocks = text.split(/(?=(?:^|\n)\s*(?:Q(?:uestion)?\s*\d+[\.\:\)]|\d+[\.\)]\s+))/i);
    qBlocks.forEach((block, idx) => {
      const cleanBlock = block.trim();
      if (!cleanBlock) return;

      const lines = cleanBlock.split('\n').map(l => l.trim()).filter(Boolean);
      if (lines.length < 2) return;

      let qText = lines[0].replace(/^(?:Q(?:uestion)?\s*\d+[\.\:\)]|\d+[\.\)]\s*)/i, '').trim();
      let opts = [];
      let correct = 'A';
      let explanation = '';
      let parsingOptions = false;

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        const ansMatch = line.match(/^(?:Answer|Ans|Correct)\s*[\:\-\=]\s*\(?([A-Ea-e1-5])\)?/i);
        if (ansMatch) {
          correct = ansMatch[1].toUpperCase();
          parsingOptions = false;
          continue;
        }

        const expMatch = line.match(/^(?:Explanation|Solution)\s*[\:\-\=]\s*(.*)$/i);
        if (expMatch) {
          explanation = expMatch[1] || '';
          parsingOptions = false;
          continue;
        }

        const optMatch = line.match(/^[\(\[]?([A-Ea-e])[\.\)\]]\s*(.*)$/i);
        if (optMatch) {
          parsingOptions = true;
          opts.push({ letter: optMatch[1].toUpperCase(), text: optMatch[2].trim() });
          continue;
        }

        if (parsingOptions && opts.length > 0) {
          opts[opts.length - 1].text += ' ' + line;
        } else if (!parsingOptions) {
          qText += ' ' + line;
        }
      }

      if (opts.length >= 2 && qText) {
        questions.push({
          id: `quiz-q-${idx}`,
          subject: subjectName,
          questionText: qText.trim(),
          options: opts,
          correctAnswer: correct,
          explanationHTML: explanation.trim()
        });
      }
    });
  }

  return questions;
}

test('parseQuizQuestions correctly parses JSON question files', () => {
  const jsonInput = JSON.stringify([
    {
      question: "Which of the following is an Indian private sector bank?",
      options: ["HDFC Bank", "SBI", "PNB", "Bank of Baroda"],
      correctAnswer: "A",
      explanation: "HDFC is a private sector bank."
    }
  ]);

  const questions = parseQuizQuestions(jsonInput, 'json', 'Banking Awareness');
  assert.equal(questions.length, 1);
  assert.equal(questions[0].subject, 'Banking Awareness');
  assert.equal(questions[0].correctAnswer, 'A');
  assert.equal(questions[0].options.length, 4);
});

test('parseQuizQuestions correctly parses formatted plain text question files', () => {
  const textInput = `
Q1. What is the value of 25 * 4?
A) 100
B) 105
C) 90
D) 95
Answer: A
Explanation: 25 multiplied by 4 equals 100.
`;

  const questions = parseQuizQuestions(textInput, 'text', 'Quantitative Aptitude');
  assert.equal(questions.length, 1);
  assert.equal(questions[0].subject, 'Quantitative Aptitude');
  assert.equal(questions[0].correctAnswer, 'A');
  assert.equal(questions[0].options.length, 4);
  assert.equal(questions[0].explanationHTML, '25 multiplied by 4 equals 100.');
});

test('candidate quiz history isolates candidates and prevents duplicate questions', () => {
  const db = new DatabaseSync(':memory:');
  db.exec(`
    CREATE TABLE quiz_questions (
      id TEXT PRIMARY KEY,
      subject TEXT NOT NULL,
      question_text TEXT NOT NULL
    );
    CREATE TABLE candidate_quiz_history (
      user_id TEXT NOT NULL,
      subject TEXT NOT NULL,
      question_id TEXT NOT NULL,
      UNIQUE(user_id, question_id)
    );
  `);

  // Insert 20 questions
  for (let i = 1; i <= 20; i++) {
    db.prepare('INSERT INTO quiz_questions VALUES (?, ?, ?)').run(`q-${i}`, 'Reasoning', `Question ${i}`);
  }

  function pickQuizForUser(userId) {
    const all = db.prepare('SELECT id FROM quiz_questions WHERE subject = ?').all('Reasoning');
    const solved = db.prepare('SELECT question_id FROM candidate_quiz_history WHERE user_id = ?').all(userId).map(r => r.question_id);
    const solvedSet = new Set(solved);
    let unsolved = all.filter(q => !solvedSet.has(q.id));

    if (unsolved.length < 10) {
      db.prepare('DELETE FROM candidate_quiz_history WHERE user_id = ?').run(userId);
      unsolved = all;
    }

    const picked = unsolved.slice(0, 10).map(q => q.id);
    for (const qId of picked) {
      db.prepare('INSERT OR IGNORE INTO candidate_quiz_history VALUES (?, ?, ?)').run(userId, 'Reasoning', qId);
    }
    return picked;
  }

  // Rahul takes quiz 1 (gets questions 1-10)
  const rahul1 = pickQuizForUser('user-rahul');
  assert.equal(rahul1.length, 10);
  assert.equal(rahul1[0], 'q-1');

  // Priya takes quiz 1 (should also be able to get questions 1-10 because she is isolated!)
  const priya1 = pickQuizForUser('user-priya');
  assert.equal(priya1.length, 10);
  assert.equal(priya1[0], 'q-1');

  // Rahul takes quiz 2 (must NOT repeat questions 1-10, gets 11-20)
  const rahul2 = pickQuizForUser('user-rahul');
  assert.equal(rahul2.length, 10);
  assert.equal(rahul2[0], 'q-11');
  assert.ok(!rahul2.includes('q-1'));

  // Rahul takes quiz 3 (pool exhausted: resets and gets 10 again)
  const rahul3 = pickQuizForUser('user-rahul');
  assert.equal(rahul3.length, 10);
});
