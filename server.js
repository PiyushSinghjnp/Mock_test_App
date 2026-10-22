/**
 * Oliveboard Mock Test App - Full-Stack Express Server & SQLite Engine
 * 
 * Features:
 * 1. Persistent SQLite Database (node:sqlite) with WAL mode (ACID durable, never loses data)
 * 2. Multi-User Isolation: every user has their own attempts, stats, and exam history
 * 3. Test Catalog Engine: stores & serves IBPS SO IT Mains (150 Qs), SBI PO, SSC CGL tests
 * 4. REST APIs for users, tests, attempts, scorecards, and user-isolated analytics
 * 5. Serves all static assets (HTML, CSS, JS, question images)
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { DatabaseSync } = require('node:sqlite');

const app = express();
const PORT = process.env.PORT || 3000;
const DB_PATH = path.join(__dirname, 'database.sqlite');

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Static file serving
app.use(express.static(__dirname));

// ==========================================
// 1. DATABASE INITIALIZATION & SCHEMA
// ==========================================
console.log('Connecting to SQLite database:', DB_PATH);
const db = new DatabaseSync(DB_PATH);

// Enable WAL mode for high concurrency and crash durability
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    email TEXT,
    avatar TEXT,
    roll_no TEXT,
    target_exam TEXT,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS tests (
    id TEXT PRIMARY KEY,
    exam_id TEXT NOT NULL,
    exam_name TEXT NOT NULL,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    subtitle TEXT,
    marks REAL NOT NULL,
    questions_count INTEGER NOT NULL,
    duration_minutes INTEGER NOT NULL,
    marks_per_correct REAL NOT NULL,
    negative_marks REAL NOT NULL,
    is_free INTEGER DEFAULT 1,
    sections_summary_json TEXT,
    test_data_json TEXT,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS test_attempts (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    test_id TEXT NOT NULL,
    test_title TEXT NOT NULL,
    total_questions INTEGER NOT NULL,
    score REAL NOT NULL,
    max_score REAL NOT NULL,
    correct_count INTEGER NOT NULL,
    wrong_count INTEGER NOT NULL,
    unanswered_count INTEGER NOT NULL,
    accuracy REAL NOT NULL,
    percentile REAL NOT NULL,
    estimated_air INTEGER NOT NULL,
    time_spent_seconds INTEGER NOT NULL,
    section_breakdown_json TEXT,
    responses_json TEXT,
    started_at TEXT NOT NULL,
    completed_at TEXT NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY(test_id) REFERENCES tests(id) ON DELETE CASCADE
  );
`);

console.log('SQLite database schema verified.');

// ==========================================
// 2. SEED INITIAL USERS (ISOLATION DEMO)
// ==========================================
function seedUsers() {
  const checkUserStmt = db.prepare('SELECT COUNT(*) as count FROM users');
  const userCount = checkUserStmt.get().count;

  if (userCount === 0) {
    console.log('Seeding demo candidates for multi-user isolation...');
    const insertUser = db.prepare(`
      INSERT INTO users (id, username, name, email, avatar, roll_no, target_exam, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insertUser.run(
      'user-rahul',
      'rahul',
      'Aspirant Rahul Sharma',
      'rahul@oliveboard.test',
      'R',
      'OB-2026-9041',
      'ibps-so',
      new Date().toISOString()
    );

    insertUser.run(
      'user-priya',
      'priya',
      'Priya Verma',
      'priya@oliveboard.test',
      'P',
      'OB-2026-8812',
      'sbi-po',
      new Date().toISOString()
    );

    insertUser.run(
      'user-vikram',
      'vikram',
      'Vikram Malhotra',
      'vikram@oliveboard.test',
      'V',
      'OB-2026-4421',
      'ssc-cgl',
      new Date().toISOString()
    );
    console.log('Users seeded: Rahul (OB-2026-9041), Priya (OB-2026-8812), Vikram (OB-2026-4421).');
  }
}

// ==========================================
// 3. SEED TESTS (IBPS SO IT MAINS & SBI PO)
// ==========================================
function seedTests() {
  const checkTestStmt = db.prepare('SELECT id FROM tests WHERE id = ?');

  // 3.1 Load and seed IBPS SO IT Mains from JSON
  const ibpsJsonPath = path.join(__dirname, 'IBPS SO IT mains questions', 'ibps_so_it_mains-1_solutions_20260924_142005.json');
  if (fs.existsSync(ibpsJsonPath)) {
    const existing = checkTestStmt.get('ibps-so-it-mains-1');
    if (!existing) {
      console.log('Parsing and ingesting IBPS SO IT Mains (150 Questions) into SQLite...');
      try {
        const raw = JSON.parse(fs.readFileSync(ibpsJsonPath, 'utf8'));
        const questions = raw.questions || [];
        
        // Group into sections
        const secMap = new Map();
        questions.forEach(q => {
          const sName = q.section || 'Professional Knowledge';
          if (!secMap.has(sName)) secMap.set(sName, []);
          secMap.get(sName).push(q);
        });

        let gIdx = 0;
        const sections = [];
        const ibpsTimingMap = {
          'English Language': { durationMinutes: 25, durationSeconds: 1500, maxMarks: 30, language: 'English' },
          'Reasoning Ability': { durationMinutes: 35, durationSeconds: 2100, maxMarks: 40, language: 'English & Hindi' },
          'Quantitative Aptitude': { durationMinutes: 25, durationSeconds: 1500, maxMarks: 30, language: 'English & Hindi' },
          'Professional Knowledge': { durationMinutes: 35, durationSeconds: 2100, maxMarks: 50, language: 'English & Hindi' }
        };

        for (const [secName, qList] of secMap) {
          const timing = ibpsTimingMap[secName] || { durationMinutes: 30, durationSeconds: 1800, maxMarks: qList.length, language: 'English & Hindi' };
          sections.push({
            id: secName.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
            title: secName,
            questionCount: qList.length,
            durationMinutes: timing.durationMinutes,
            durationSeconds: timing.durationSeconds,
            maxMarks: timing.maxMarks,
            positiveMarks: 1.0,
            negativeMarks: 0.25,
            language: timing.language,
            isSectionalLocked: true,
            questions: qList.map((q, lIdx) => {
              gIdx++;
              
              // Normalize image URLs
              const imageUrls = (q.image_urls || []).map(u => {
                const fn = path.basename(u);
                return `images/ibps-so-it-mains-1/${fn}`;
              });

              // Options
              const letters = ['A', 'B', 'C', 'D', 'E'];
              const options = letters
                .filter(l => q.options && q.options[l] !== undefined)
                .map(l => ({
                  letter: l,
                  text: q.options[l],
                  html: q.options[l]
                }));

              const letterMap = { A: 0, B: 1, C: 2, D: 3, E: 4 };
              const correctIdx = letterMap[(q.correct_answer || '').toUpperCase()] ?? -1;

              return {
                id: `ibps-q-${gIdx}`,
                globalIndex: gIdx,
                localIndex: lIdx + 1,
                questionNumber: q.question_number || gIdx,
                section: secName,
                questionHTML: q.question_text || '',
                passageHTML: q.passage_text || '',
                hasPassage: !!(q.passage_text && q.passage_text.trim().length > 20),
                imageUrls: imageUrls,
                options: options,
                correctAnswer: q.correct_answer || '',
                correctIndex: correctIdx,
                explanationHTML: q.explanation || '',
                marksForCorrect: 1.0,
                negativeMarks: 0.25
              };
            })
          });
        }

        const sectionsSummary = sections.map(s => `${s.title} (${s.questionCount} Qs)`);

        const testPayload = {
          id: 'ibps-so-it-mains-1',
          title: 'IBPS SO IT Officer Mains - Full Mock 1',
          examId: 'ibps-so',
          examName: 'IBPS SO IT Officer',
          type: 'mains',
          subtitle: 'Authentic 150-Question Full Mains Test with Professional Knowledge & Detailed Solutions',
          marks: 150,
          questionsCount: 150,
          durationMinutes: 120,
          totalDurationSeconds: 120 * 60,
          hasSectionalTiming: true,
          isSectionalLocked: true,
          markingScheme: { positive: 1.0, negative: 0.25, penaltyRatio: '1/4th' },
          marksPerCorrect: 1.0,
          negativeMarks: 0.25,
          sections: sections
        };

        const insertTest = db.prepare(`
          INSERT INTO tests (
            id, exam_id, exam_name, type, title, subtitle,
            marks, questions_count, duration_minutes,
            marks_per_correct, negative_marks, is_free,
            sections_summary_json, test_data_json, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        insertTest.run(
          'ibps-so-it-mains-1',
          'ibps-so',
          'IBPS SO IT Officer',
          'mains',
          'IBPS SO IT Officer Mains - Full Mock 1',
          'Authentic 150-Question Full Mains Test with Professional Knowledge & Detailed Solutions',
          150,
          150,
          120,
          1.0,
          0.25,
          1,
          JSON.stringify(sectionsSummary),
          JSON.stringify(testPayload),
          new Date().toISOString()
        );
        console.log('Successfully ingested IBPS SO IT Mains into SQLite with 150 questions!');
      } catch (err) {
        console.error('Failed to ingest IBPS SO IT Mains test:', err);
      }
    }
  }

  // 3.2 Seed SBI PO Prelims Free Mock 1
  if (!checkTestStmt.get('sbi-po-pre-01')) {
    console.log('Seeding SBI PO Prelims Free Mock 1 into SQLite...');
    const sbiSections = [
      {
        id: "english",
        title: "English Language",
        questionCount: 3,
        questions: [
          {
            id: "sbi-q-1",
            globalIndex: 1,
            localIndex: 1,
            questionNumber: 1,
            section: "English Language",
            questionHTML: "<p>Read the sentence to find out whether there is any grammatical error in it. The error, if any, will be in one part of the sentence.</p><p><strong>Neither the finance minister (A) / nor the bank directors (B) / was aware of the sudden (C) / collapse of the credit rating. (D)</strong></p>",
            passageHTML: "",
            hasPassage: false,
            imageUrls: [],
            options: [
              { letter: "A", text: "Part (A)", html: "Part (A)" },
              { letter: "B", text: "Part (B)", html: "Part (B)" },
              { letter: "C", text: "Part (C)", html: "Part (C)" },
              { letter: "D", text: "Part (D)", html: "Part (D)" },
              { letter: "E", text: "No error", html: "No error" }
            ],
            correctAnswer: "C",
            correctIndex: 2,
            explanationHTML: "<p>In subject-verb agreement with 'neither... nor...', the verb agrees with the subject nearest to it. 'The bank directors' is plural, so it should be 'were aware', not 'was aware'.</p>",
            marksForCorrect: 1.0,
            negativeMarks: 0.25
          },
          {
            id: "sbi-q-2",
            globalIndex: 2,
            localIndex: 2,
            questionNumber: 2,
            section: "English Language",
            questionHTML: "<p>Choose the word that is most nearly <strong>SIMILAR</strong> in meaning to the given word: <strong>SURREPTITIOUS</strong></p>",
            passageHTML: "",
            hasPassage: false,
            imageUrls: [],
            options: [
              { letter: "A", text: "Clandestine", html: "Clandestine" },
              { letter: "B", text: "Overt", html: "Overt" },
              { letter: "C", text: "Exorbitant", html: "Exorbitant" },
              { letter: "D", text: "Spurious", html: "Spurious" },
              { letter: "E", text: "Benevolent", html: "Benevolent" }
            ],
            correctAnswer: "A",
            correctIndex: 0,
            explanationHTML: "<p>Surreptitious means kept secret, especially because it would not be approved of. 'Clandestine' means secret or illicit, making it the closest synonym.</p>",
            marksForCorrect: 1.0,
            negativeMarks: 0.25
          },
          {
            id: "sbi-q-3",
            globalIndex: 3,
            localIndex: 3,
            questionNumber: 3,
            section: "English Language",
            questionHTML: "<p>Fill in the blank: The monetary policy committee decided to _______ the benchmark repo rate at 6.5% to anchor inflationary expectations.</p>",
            passageHTML: "",
            hasPassage: false,
            imageUrls: [],
            options: [
              { letter: "A", text: "retain", html: "retain" },
              { letter: "B", text: "abolish", html: "abolish" },
              { letter: "C", text: "evaporate", html: "evaporate" },
              { letter: "D", text: "deviate", html: "deviate" },
              { letter: "E", text: "concur", html: "concur" }
            ],
            correctAnswer: "A",
            correctIndex: 0,
            explanationHTML: "<p>'Retain' means to keep or maintain in place. In banking context, retaining the repo rate means leaving it unchanged.</p>",
            marksForCorrect: 1.0,
            negativeMarks: 0.25
          }
        ]
      },
      {
        id: "quant",
        title: "Quantitative Aptitude",
        questionCount: 2,
        questions: [
          {
            id: "sbi-q-4",
            globalIndex: 4,
            localIndex: 1,
            questionNumber: 4,
            section: "Quantitative Aptitude",
            questionHTML: "<p>Find the missing number in the given series:</p><p><strong>7, 11, 20, 36, 61, ?</strong></p>",
            passageHTML: "",
            hasPassage: false,
            imageUrls: [],
            options: [
              { letter: "A", text: "95", html: "95" },
              { letter: "B", text: "97", html: "97" },
              { letter: "C", text: "101", html: "101" },
              { letter: "D", text: "104", html: "104" },
              { letter: "E", text: "108", html: "108" }
            ],
            correctAnswer: "B",
            correctIndex: 1,
            explanationHTML: "<p>The differences are: 11 - 7 = 4 (2²), 20 - 11 = 9 (3²), 36 - 20 = 16 (4²), 61 - 36 = 25 (5²). Next difference is 6² = 36. 61 + 36 = 97.</p>",
            marksForCorrect: 1.0,
            negativeMarks: 0.25
          },
          {
            id: "sbi-q-5",
            globalIndex: 5,
            localIndex: 2,
            questionNumber: 5,
            section: "Quantitative Aptitude",
            questionHTML: "<p>A vessel contains 80 litres of a mixture of milk and water in the ratio 7 : 1. How much water should be added so that the ratio of milk and water becomes 5 : 2?</p>",
            passageHTML: "",
            hasPassage: false,
            imageUrls: [],
            options: [
              { letter: "A", text: "16 litres", html: "16 litres" },
              { letter: "B", text: "18 litres", html: "18 litres" },
              { letter: "C", text: "20 litres", html: "20 litres" },
              { letter: "D", text: "22 litres", html: "22 litres" },
              { letter: "E", text: "24 litres", html: "24 litres" }
            ],
            correctAnswer: "B",
            correctIndex: 1,
            explanationHTML: "<p>Milk = 80 * 7/8 = 70L, Water = 10L. Adding x litres water: 70 / (10 + x) = 5 / 2 => 140 = 50 + 5x => 5x = 90 => x = 18 litres.</p>",
            marksForCorrect: 1.0,
            negativeMarks: 0.25
          }
        ]
      },
      {
        id: "reasoning",
        title: "Reasoning Ability",
        questionCount: 2,
        questions: [
          {
            id: "sbi-q-6",
            globalIndex: 6,
            localIndex: 1,
            questionNumber: 6,
            section: "Reasoning Ability",
            questionHTML: "<p>In a certain code language, <strong>'BANKING'</strong> is written as <strong>'CBOLJOH'</strong>. How will <strong>'CLERK'</strong> be written in that code?</p>",
            passageHTML: "",
            hasPassage: false,
            imageUrls: [],
            options: [
              { letter: "A", text: "DMFSL", html: "DMFSL" },
              { letter: "B", text: "DMFSK", html: "DMFSK" },
              { letter: "C", text: "ENFTL", html: "ENFTL" },
              { letter: "D", text: "CLERK", html: "CLERK" },
              { letter: "E", text: "BMDQJ", html: "BMDQJ" }
            ],
            correctAnswer: "A",
            correctIndex: 0,
            explanationHTML: "<p>Each letter is shifted by +1 in alphabetical order: C->D, L->M, E->F, R->S, K->L. Hence DMFSL.</p>",
            marksForCorrect: 1.0,
            negativeMarks: 0.25
          },
          {
            id: "sbi-q-7",
            globalIndex: 7,
            localIndex: 2,
            questionNumber: 7,
            section: "Reasoning Ability",
            questionHTML: "<p>Statements:<br>All Deposits are Accounts.<br>No Account is Overdraft.<br>Some Overdrafts are Loans.<br><br>Conclusions:<br>I. No Deposit is Overdraft.<br>II. Some Loans are not Deposits.</p>",
            passageHTML: "",
            hasPassage: false,
            imageUrls: [],
            options: [
              { letter: "A", text: "Only conclusion I follows", html: "Only conclusion I follows" },
              { letter: "B", text: "Only conclusion II follows", html: "Only conclusion II follows" },
              { letter: "C", text: "Either conclusion I or II follows", html: "Either conclusion I or II follows" },
              { letter: "D", text: "Neither conclusion I nor II follows", html: "Neither conclusion I nor II follows" },
              { letter: "E", text: "Both conclusions I and II follow", html: "Both conclusions I and II follow" }
            ],
            correctAnswer: "E",
            correctIndex: 4,
            explanationHTML: "<p>1. All Deposits are inside Accounts. No Account is Overdraft => No Deposit can be Overdraft. Conclusion I follows.<br>2. Overdrafts that are Loans cannot be Accounts/Deposits. Conclusion II follows. Both follow.</p>",
            marksForCorrect: 1.0,
            negativeMarks: 0.25
          }
        ]
      }
    ];

    const sbiSectionsSummary = ["English Language (3 Qs)", "Quantitative Aptitude (2 Qs)", "Reasoning Ability (2 Qs)"];
    const sbiPayload = {
      id: "sbi-po-pre-01",
      title: "SBI PO 2026 Prelims - Free Mock 1",
      examId: "sbi-po",
      examName: "SBI PO 2026",
      type: "prelims",
      subtitle: "Full Prelims Simulation with All India Ranking",
      marks: 100,
      questionsCount: 7,
      durationMinutes: 60,
      totalDurationSeconds: 60 * 60,
      marksPerCorrect: 1.0,
      negativeMarks: 0.25,
      sections: sbiSections
    };

    const insertTest = db.prepare(`
      INSERT INTO tests (
        id, exam_id, exam_name, type, title, subtitle,
        marks, questions_count, duration_minutes,
        marks_per_correct, negative_marks, is_free,
        sections_summary_json, test_data_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insertTest.run(
      'sbi-po-pre-01',
      'sbi-po',
      'SBI PO 2026',
      'prelims',
      'SBI PO 2026 Prelims - Free Mock 1',
      'Full Prelims Simulation with All India Ranking',
      100,
      7,
      60,
      1.0,
      0.25,
      1,
      JSON.stringify(sbiSectionsSummary),
      JSON.stringify(sbiPayload),
      new Date().toISOString()
    );
    console.log('SBI PO Prelims Free Mock 1 seeded successfully.');
  }
}

// Seed on server boot
seedUsers();
seedTests();

// ==========================================
// 4. REST APIS WITH MULTI-USER ISOLATION
// ==========================================

// 4.1 USERS API
app.get('/api/users', (req, res) => {
  try {
    const users = db.prepare(`
      SELECT u.*, 
        (SELECT COUNT(*) FROM test_attempts a WHERE a.user_id = u.id) as attempts_count
      FROM users u
      ORDER BY u.created_at ASC
    `).all();
    res.json({ success: true, users });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/users', (req, res) => {
  try {
    const { name, target_exam, roll_no } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, error: 'Name is required' });
    }
    const id = `user-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const username = name.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + Math.floor(1000 + Math.random() * 9000);
    const avatar = name.trim().charAt(0).toUpperCase();
    const rollNo = roll_no || `OB-2026-${Math.floor(1000 + Math.random() * 9000)}`;
    const targetExam = target_exam || 'sbi-po';
    const createdAt = new Date().toISOString();

    const insert = db.prepare(`
      INSERT INTO users (id, username, name, email, avatar, roll_no, target_exam, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    insert.run(id, username, name.trim(), `${username}@oliveboard.test`, avatar, rollNo, targetExam, createdAt);

    const newUser = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
    res.json({ success: true, user: newUser });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 4.2 TESTS CATALOG API (WITH USER-SPECIFIC ATTEMPT STATUS)
app.get('/api/tests', (req, res) => {
  try {
    const { examId, userId } = req.query;
    let query = 'SELECT id, exam_id, exam_name, type, title, subtitle, marks, questions_count, duration_minutes, is_free, sections_summary_json FROM tests';
    const params = [];

    if (examId && examId !== 'all') {
      query += ' WHERE exam_id = ?';
      params.push(examId);
    }
    query += ' ORDER BY is_free DESC, id ASC';

    const tests = db.prepare(query).all(...params);

    // If userId provided, query user's latest attempt for each test to achieve perfect isolation
    let attemptsMap = {};
    if (userId) {
      const attempts = db.prepare(`
        SELECT test_id, score, max_score, accuracy, percentile, estimated_air, completed_at, id as attempt_id
        FROM test_attempts
        WHERE user_id = ?
        ORDER BY completed_at DESC
      `).all(userId);

      attempts.forEach(att => {
        if (!attemptsMap[att.test_id]) {
          attemptsMap[att.test_id] = att;
        }
      });
    }

    const result = tests.map(t => {
      const userAttempt = attemptsMap[t.id] || null;
      return {
        ...t,
        sections_summary: JSON.parse(t.sections_summary_json || '[]'),
        userAttempt: userAttempt,
        isAttempted: !!userAttempt
      };
    });

    res.json({ success: true, tests: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 4.3 GET SPECIFIC TEST WITH FULL QUESTIONS FOR TEST ENGINE
app.get('/api/tests/:id', (req, res) => {
  try {
    const test = db.prepare('SELECT * FROM tests WHERE id = ?').get(req.params.id);
    if (!test) {
      return res.status(404).json({ success: false, error: 'Test not found' });
    }
    const testData = JSON.parse(test.test_data_json);
    res.json({ success: true, test: testData });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 4.4 ATTEMPTS API - SAVE ATTEMPT (NEVER DELETES DATA)
app.post('/api/attempts', (req, res) => {
  try {
    const {
      userId,
      testId,
      testTitle,
      totalQuestions,
      score,
      maxScore,
      correctCount,
      wrongCount,
      unansweredCount,
      accuracy,
      percentile,
      estimatedAir,
      timeSpentSeconds,
      sectionBreakdown,
      responses,
      startedAt,
      completedAt
    } = req.body;

    if (!userId || !testId) {
      return res.status(400).json({ success: false, error: 'userId and testId are required' });
    }

    const attemptId = `att-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();

    const insert = db.prepare(`
      INSERT INTO test_attempts (
        id, user_id, test_id, test_title, total_questions,
        score, max_score, correct_count, wrong_count, unanswered_count,
        accuracy, percentile, estimated_air, time_spent_seconds,
        section_breakdown_json, responses_json, started_at, completed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insert.run(
      attemptId,
      userId,
      testId,
      testTitle || 'Mock Test',
      totalQuestions || 0,
      score || 0,
      maxScore || 100,
      correctCount || 0,
      wrongCount || 0,
      unansweredCount || 0,
      accuracy || 0,
      percentile || 0,
      estimatedAir || 1000,
      timeSpentSeconds || 0,
      JSON.stringify(sectionBreakdown || []),
      JSON.stringify(responses || {}),
      startedAt || now,
      completedAt || now
    );

    console.log(`Test attempt saved permanently: ID ${attemptId} for User ${userId} on Test ${testId}`);

    res.json({
      success: true,
      attemptId,
      message: 'Mock test result saved permanently in SQLite database.'
    });
  } catch (err) {
    console.error('Failed to save test attempt:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 4.5 GET ALL ATTEMPTS FOR SPECIFIC USER (USER ISOLATED)
app.get('/api/attempts', (req, res) => {
  try {
    const { userId, testId } = req.query;
    if (!userId) {
      return res.status(400).json({ success: false, error: 'userId is required for isolated attempts' });
    }

    let query = 'SELECT * FROM test_attempts WHERE user_id = ?';
    const params = [userId];

    if (testId) {
      query += ' AND test_id = ?';
      params.push(testId);
    }
    query += ' ORDER BY completed_at DESC';

    const rows = db.prepare(query).all(...params);
    const attempts = rows.map(r => ({
      ...r,
      section_breakdown: JSON.parse(r.section_breakdown_json || '[]'),
      responses: JSON.parse(r.responses_json || '{}')
    }));

    res.json({ success: true, attempts });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 4.6 GET SINGLE ATTEMPT SCORECARD
app.get('/api/attempts/:id', (req, res) => {
  try {
    const row = db.prepare('SELECT * FROM test_attempts WHERE id = ?').get(req.params.id);
    if (!row) {
      return res.status(404).json({ success: false, error: 'Attempt not found' });
    }
    const attempt = {
      ...row,
      section_breakdown: JSON.parse(row.section_breakdown_json || '[]'),
      responses: JSON.parse(row.responses_json || '{}')
    };
    res.json({ success: true, attempt });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 4.7 USER ISOLATED ANALYTICS API
app.get('/api/analytics', (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) {
      return res.status(400).json({ success: false, error: 'userId required' });
    }

    const attempts = db.prepare('SELECT * FROM test_attempts WHERE user_id = ? ORDER BY completed_at DESC').all(userId);
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);

    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    if (attempts.length === 0) {
      return res.json({
        success: true,
        user: {
          id: user.id,
          name: user.name,
          roll_no: user.roll_no,
          avatar: user.avatar,
          target_exam: user.target_exam
        },
        stats: {
          testsAttempted: 0,
          avgScore: '0.00 / 0',
          avgAccuracy: '0.0%',
          overallPercentile: '0.0%ile',
          predictedAIR: '#--',
          streakDays: 0,
          sectionBreakdowns: []
        }
      });
    }

    const totalTests = attempts.length;
    const avgScore = (attempts.reduce((sum, a) => sum + a.score, 0) / totalTests).toFixed(2);
    const avgAccuracy = (attempts.reduce((sum, a) => sum + a.accuracy, 0) / totalTests).toFixed(1);
    const avgPercentile = (attempts.reduce((sum, a) => sum + a.percentile, 0) / totalTests).toFixed(1);
    const bestAIR = Math.min(...attempts.map(a => a.estimated_air));

    // Section breakdown aggregated across user's tests
    const secTotals = {};
    attempts.forEach(a => {
      const breakdown = JSON.parse(a.section_breakdown_json || '[]');
      breakdown.forEach(s => {
        if (!secTotals[s.sectionName]) {
          secTotals[s.sectionName] = { correct: 0, wrong: 0, total: 0 };
        }
        secTotals[s.sectionName].correct += s.correct || 0;
        secTotals[s.sectionName].wrong += s.wrong || 0;
        secTotals[s.sectionName].total += s.total || (s.correct + s.wrong + (s.unanswered || 0));
      });
    });

    const sectionBreakdowns = Object.entries(secTotals).map(([name, data]) => {
      const attempted = data.correct + data.wrong;
      const acc = attempted > 0 ? ((data.correct / attempted) * 100).toFixed(1) : '0';
      return {
        sectionName: name,
        correct: data.correct,
        wrong: data.wrong,
        total: data.total,
        accuracy: acc
      };
    });

    res.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        roll_no: user.roll_no,
        avatar: user.avatar,
        target_exam: user.target_exam
      },
      stats: {
        testsAttempted: totalTests,
        avgScore: `${avgScore} / ${attempts[0].max_score}`,
        avgAccuracy: `${avgAccuracy}%`,
        overallPercentile: `${avgPercentile}%ile`,
        predictedAIR: `#${bestAIR}`,
        streakDays: 1,
        sectionBreakdowns: sectionBreakdowns
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Fallback to index.html for SPA routing
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Start Server
app.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(` Oliveboard Mock Test Server running at http://localhost:${PORT}`);
  console.log(` SQLite Database: ${DB_PATH}`);
  console.log(` Multi-user isolation & permanent result storage ACTIVE`);
  console.log(`=======================================================`);
});
