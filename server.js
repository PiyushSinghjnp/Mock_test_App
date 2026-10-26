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

  CREATE TABLE IF NOT EXISTS paused_attempts (
    user_id TEXT NOT NULL,
    test_id TEXT NOT NULL,
    current_section_index INTEGER DEFAULT 0,
    current_question_index INTEGER DEFAULT 0,
    last_question_number INTEGER DEFAULT 1,
    section_remaining_seconds INTEGER DEFAULT 1200,
    remaining_seconds INTEGER DEFAULT 3600,
    completed_sections_json TEXT,
    responses_json TEXT,
    bookmarked_json TEXT,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (user_id, test_id)
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
  const checkTestStmt = db.prepare('SELECT id, questions_count FROM tests WHERE id = ?');

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

  // 3.2 Seed or Upgrade SBI PO Prelims Free Mock 1 & Sectionals with full 100 Qs & verified solutions
  try {
    const { runSeed } = require('./scripts/seed_sbi_po');
    runSeed();
  } catch (err) {
    console.error('Failed to run SBI PO seed script:', err);
  }

  // 3.2b Seed authentic 100-Question IBPS SO IT Prelims 1 test
  try {
    const { runSeedIbpsSo } = require('./scripts/seed_ibps_so_prelims');
    runSeedIbpsSo();
  } catch (err) {
    console.error('Failed to run IBPS SO seed script:', err);
  }
}

// ==========================================
// 3.3 BACKEND-ONLY AUTO-INGESTION OF /papers/*.json WITH 2026 OFFICIAL TIMINGS
// ==========================================
const examPatterns2026 = require('./js/exam-patterns-2026');
const PAPERS_DIR = path.join(__dirname, 'papers');
if (!fs.existsSync(PAPERS_DIR)) {
  fs.mkdirSync(PAPERS_DIR, { recursive: true });
}

function ingestBackendPaperFile(filePath) {
  try {
    if (!filePath.endsWith('.json')) return null;
    const filename = path.basename(filePath);
    const rawContent = fs.readFileSync(filePath, 'utf8');
    if (!rawContent || !rawContent.trim()) return null;

    const parsedPaper = JSON.parse(rawContent);
    const normalizedTest = examPatterns2026.apply2026PatternToQuestionPaper(parsedPaper, {
      filename
    });

    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO tests (
        id, exam_id, exam_name, type, title, subtitle,
        marks, questions_count, duration_minutes,
        marks_per_correct, negative_marks, is_free,
        sections_summary_json, test_data_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        exam_id = excluded.exam_id,
        exam_name = excluded.exam_name,
        type = excluded.type,
        title = excluded.title,
        subtitle = excluded.subtitle,
        marks = excluded.marks,
        questions_count = excluded.questions_count,
        duration_minutes = excluded.duration_minutes,
        marks_per_correct = excluded.marks_per_correct,
        negative_marks = excluded.negative_marks,
        sections_summary_json = excluded.sections_summary_json,
        test_data_json = excluded.test_data_json
    `).run(
      normalizedTest.id,
      normalizedTest.examId,
      normalizedTest.examName,
      normalizedTest.type,
      normalizedTest.title,
      normalizedTest.subtitle,
      normalizedTest.marks,
      normalizedTest.questionsCount,
      normalizedTest.durationMinutes,
      normalizedTest.marksPerCorrect,
      normalizedTest.negativeMarks,
      1,
      JSON.stringify(normalizedTest.sectionsSummary),
      JSON.stringify(normalizedTest),
      now
    );

    console.log(`[Backend Auto-Ingest] Applied 2026 Official Pattern to "${normalizedTest.title}" (${normalizedTest.id}): ${normalizedTest.questionsCount} Qs, ${normalizedTest.durationMinutes} mins, +${normalizedTest.marksPerCorrect}/-${normalizedTest.negativeMarks}`);
    return normalizedTest;
  } catch (err) {
    console.error(`[Backend Auto-Ingest] Failed to ingest ${filePath}:`, err.message);
    return null;
  }
}

function autoIngestBackendPapers() {
  if (!fs.existsSync(PAPERS_DIR)) return;
  const files = fs.readdirSync(PAPERS_DIR).filter(f => f.toLowerCase().endsWith('.json'));
  files.forEach(f => {
    ingestBackendPaperFile(path.join(PAPERS_DIR, f));
  });
}

// Seed on server boot & watch /papers for backend-only paper drops
seedUsers();
seedTests();
autoIngestBackendPapers();

try {
  let watchDebounce = null;
  fs.watch(PAPERS_DIR, (eventType, filename) => {
    if (filename && filename.toLowerCase().endsWith('.json')) {
      clearTimeout(watchDebounce);
      watchDebounce = setTimeout(() => {
        const fullPath = path.join(PAPERS_DIR, filename);
        if (fs.existsSync(fullPath)) {
          ingestBackendPaperFile(fullPath);
        }
      }, 300);
    }
  });
} catch (e) {
  // Ignore watch errors on unsupported filesystems
}

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

app.patch('/api/users/:id', (req, res) => {
  try {
    const { target_exam, name, roll_no } = req.body || {};
    const userId = req.params.id;
    const existing = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    const nextExam = target_exam || existing.target_exam;
    const nextName = (name && name.trim()) ? name.trim() : existing.name;
    const nextRoll = (roll_no && roll_no.trim()) ? roll_no.trim() : existing.roll_no;
    db.prepare(`
      UPDATE users
      SET target_exam = ?, name = ?, roll_no = ?
      WHERE id = ?
    `).run(nextExam, nextName, nextRoll, userId);

    const updated = db.prepare(`
      SELECT u.*, 
        (SELECT COUNT(*) FROM test_attempts a WHERE a.user_id = u.id) as attempts_count
      FROM users u
      WHERE u.id = ?
    `).get(userId);
    res.json({ success: true, user: updated });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 4.2 TESTS CATALOG API (WITH USER-SPECIFIC ATTEMPT & PAUSED STATUS)
app.get('/api/tests', (req, res) => {
  try {
    const examId = req.query.examId || req.query.exam;
    const userId = req.query.userId || req.query.user_id;
    let query = 'SELECT id, exam_id, exam_name, type, title, subtitle, marks, questions_count, duration_minutes, is_free, sections_summary_json FROM tests';
    const params = [];

    if (examId && examId !== 'all') {
      query += ' WHERE exam_id = ?';
      params.push(examId);
    }
    query += ' ORDER BY is_free DESC, id ASC';

    const tests = db.prepare(query).all(...params);

    let attemptsMap = {};
    let pausedMap = {};
    if (userId) {
      const attempts = db.prepare(`
        SELECT test_id, score, max_score, correct_count, wrong_count, unanswered_count, total_questions, accuracy, percentile, estimated_air, completed_at, id as attempt_id
        FROM test_attempts
        WHERE user_id = ?
        ORDER BY completed_at DESC
      `).all(userId);

      attempts.forEach(att => {
        if (!attemptsMap[att.test_id]) {
          const rankInfo = examPatterns2026.calculateTestRankAndPercentile({
            testId: att.test_id,
            score: att.score,
            maxScore: att.max_score,
            correctCount: att.correct_count,
            wrongCount: att.wrong_count,
            unansweredCount: att.unanswered_count,
            totalQuestions: att.total_questions,
            accuracy: att.accuracy
          });
          att.percentile = rankInfo.percentile;
          att.estimated_air = rankInfo.estimatedAIR;
          att.total_candidates = rankInfo.totalCandidates;
          attemptsMap[att.test_id] = att;
        }
      });

      const pausedRows = db.prepare(`
        SELECT * FROM paused_attempts WHERE user_id = ?
      `).all(userId);
      pausedRows.forEach(p => {
        pausedMap[p.test_id] = {
          currentSectionIndex: p.current_section_index,
          currentQuestionIndex: p.current_question_index,
          lastQuestionNumber: p.last_question_number,
          sectionRemainingSeconds: p.section_remaining_seconds,
          remainingSeconds: p.remaining_seconds,
          completedSections: JSON.parse(p.completed_sections_json || '[]'),
          responses: JSON.parse(p.responses_json || '{}'),
          bookmarkedQuestions: JSON.parse(p.bookmarked_json || '{}'),
          updatedAt: p.updated_at
        };
      });
    }

    const result = tests.map(t => {
      const userAttempt = attemptsMap[t.id] || null;
      const pausedAttempt = pausedMap[t.id] || null;
      const cohortInfo = examPatterns2026.calculateTestRankAndPercentile({
        testId: t.id,
        testTitle: t.title,
        testType: t.type,
        maxScore: t.marks
      });
      if (userAttempt) {
        const syncedRank = examPatterns2026.calculateTestRankAndPercentile({
          testId: t.id,
          testTitle: t.title,
          testType: t.type,
          score: userAttempt.score,
          maxScore: userAttempt.max_score || t.marks,
          correctCount: userAttempt.correct_count,
          wrongCount: userAttempt.wrong_count,
          unansweredCount: userAttempt.unanswered_count,
          totalQuestions: userAttempt.total_questions || t.questions_count,
          accuracy: userAttempt.accuracy
        });
        userAttempt.percentile = syncedRank.percentile;
        userAttempt.estimated_air = syncedRank.estimatedAIR;
        userAttempt.total_candidates = syncedRank.totalCandidates;
      }
      return {
        ...t,
        activeUsers: cohortInfo.totalCandidates,
        sections_summary: JSON.parse(t.sections_summary_json || '[]'),
        userAttempt: userAttempt,
        isAttempted: !!userAttempt,
        pausedAttempt: pausedAttempt,
        isPaused: !!pausedAttempt
      };
    });

    res.json({ success: true, tests: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 4.2b PAUSED ATTEMPTS API (Spec 4.1 & 1.3 paused_in_progress state)
app.post('/api/paused-attempts', (req, res) => {
  try {
    const {
      userId,
      testId,
      currentSectionIndex = 0,
      currentQuestionIndex = 0,
      lastQuestionNumber = 1,
      sectionRemainingSeconds = 1200,
      remainingSeconds = 3600,
      completedSections = [],
      responses = {},
      bookmarkedQuestions = {}
    } = req.body;

    if (!userId || !testId) {
      return res.status(400).json({ success: false, error: 'userId and testId are required' });
    }

    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO paused_attempts (
        user_id, test_id, current_section_index, current_question_index,
        last_question_number, section_remaining_seconds, remaining_seconds,
        completed_sections_json, responses_json, bookmarked_json, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id, test_id) DO UPDATE SET
        current_section_index = excluded.current_section_index,
        current_question_index = excluded.current_question_index,
        last_question_number = excluded.last_question_number,
        section_remaining_seconds = excluded.section_remaining_seconds,
        remaining_seconds = excluded.remaining_seconds,
        completed_sections_json = excluded.completed_sections_json,
        responses_json = excluded.responses_json,
        bookmarked_json = excluded.bookmarked_json,
        updated_at = excluded.updated_at
    `).run(
      userId,
      testId,
      currentSectionIndex,
      currentQuestionIndex,
      lastQuestionNumber,
      sectionRemainingSeconds,
      remainingSeconds,
      JSON.stringify(completedSections),
      JSON.stringify(responses),
      JSON.stringify(bookmarkedQuestions),
      now
    );

    res.json({ success: true, updatedAt: now });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/paused-attempts', (req, res) => {
  try {
    const { userId, testId } = req.query;
    if (!userId) return res.status(400).json({ success: false, error: 'userId required' });
    if (testId) {
      const row = db.prepare('SELECT * FROM paused_attempts WHERE user_id = ? AND test_id = ?').get(userId, testId);
      if (!row) return res.json({ success: true, pausedAttempt: null });
      return res.json({
        success: true,
        pausedAttempt: {
          currentSectionIndex: row.current_section_index,
          currentQuestionIndex: row.current_question_index,
          lastQuestionNumber: row.last_question_number,
          sectionRemainingSeconds: row.section_remaining_seconds,
          remainingSeconds: row.remaining_seconds,
          completedSections: JSON.parse(row.completed_sections_json || '[]'),
          responses: JSON.parse(row.responses_json || '{}'),
          bookmarkedQuestions: JSON.parse(row.bookmarked_json || '{}'),
          updatedAt: row.updated_at
        }
      });
    }
    const rows = db.prepare('SELECT * FROM paused_attempts WHERE user_id = ?').all(userId);
    res.json({ success: true, pausedAttempts: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.delete('/api/paused-attempts', (req, res) => {
  try {
    const { userId, testId } = req.query;
    if (userId && testId) {
      db.prepare('DELETE FROM paused_attempts WHERE user_id = ? AND test_id = ?').run(userId, testId);
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 4.3 GET SPECIFIC TEST WITH FULL QUESTIONS FOR TEST ENGINE
app.get('/api/tests/:id', (req, res) => {
  try {
    const reqId = String(req.params.id || '');
    let test = db.prepare('SELECT * FROM tests WHERE id = ?').get(reqId);
    if (!test) {
      const lowerId = reqId.toLowerCase();
      const fallbackId = lowerId.includes('ibps-so')
        ? (lowerId.includes('mains') ? 'ibps-so-it-mains-1' : 'ibps-so-it-prelims-1')
        : 'sbi-po-pre-01';
      test = db.prepare('SELECT * FROM tests WHERE id = ?').get(fallbackId);
      if (test) {
        const cloned = JSON.parse(test.test_data_json);
        cloned.id = reqId;
        return res.json({ success: true, test: cloned });
      }
      return res.status(404).json({ success: false, error: 'Test not found' });
    }
    const testData = JSON.parse(test.test_data_json);
    res.json({ success: true, test: testData });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 4.3b GET 2026 OFFICIAL EXAM MARKING SCHEMES & SECTIONAL TIMINGS
app.get('/api/exam-patterns-2026', (req, res) => {
  try {
    const notifPath = path.join(__dirname, 'data', 'official_exam_notifications.json');
    const rawNotif = fs.existsSync(notifPath) ? JSON.parse(fs.readFileSync(notifPath, 'utf8')) : {};
    res.json({
      success: true,
      patterns: examPatterns2026.EXAM_PATTERNS_2026,
      notifications: rawNotif
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 4.3c UPLOAD QUESTION PAPER JSON & AUTO-APPLY 2026 SECTIONAL TIMINGS & MARKING SCHEME
app.post('/api/tests/upload-json', (req, res) => {
  try {
    const { rawPaper, examId, stage, title, customTitle, subtitle, filename, testId, customTestId } = req.body;
    if (!rawPaper) {
      return res.status(400).json({ success: false, error: 'rawPaper JSON payload is required' });
    }

    const parsedPaper = typeof rawPaper === 'string' ? JSON.parse(rawPaper) : rawPaper;
    const normalizedTest = examPatterns2026.apply2026PatternToQuestionPaper(parsedPaper, {
      examId: examId || undefined,
      stage: stage || undefined,
      title: customTitle || title || undefined,
      testId: customTestId || testId || undefined,
      subtitle: subtitle || undefined,
      filename: filename || undefined
    });

    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO tests (
        id, exam_id, exam_name, type, title, subtitle,
        marks, questions_count, duration_minutes,
        marks_per_correct, negative_marks, is_free,
        sections_summary_json, test_data_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        exam_id = excluded.exam_id,
        exam_name = excluded.exam_name,
        type = excluded.type,
        title = excluded.title,
        subtitle = excluded.subtitle,
        marks = excluded.marks,
        questions_count = excluded.questions_count,
        duration_minutes = excluded.duration_minutes,
        marks_per_correct = excluded.marks_per_correct,
        negative_marks = excluded.negative_marks,
        sections_summary_json = excluded.sections_summary_json,
        test_data_json = excluded.test_data_json
    `).run(
      normalizedTest.id,
      normalizedTest.examId,
      normalizedTest.examName,
      normalizedTest.type,
      normalizedTest.title,
      normalizedTest.subtitle,
      normalizedTest.marks,
      normalizedTest.questionsCount,
      normalizedTest.durationMinutes,
      normalizedTest.marksPerCorrect,
      normalizedTest.negativeMarks,
      1,
      JSON.stringify(normalizedTest.sectionsSummary),
      JSON.stringify(normalizedTest),
      now
    );

    console.log(`[2026 Pattern Applied] Saved uploaded JSON test "${normalizedTest.title}" (${normalizedTest.id}) with ${normalizedTest.questionsCount} Qs, ${normalizedTest.durationMinutes} mins`);
    res.json({
      success: true,
      testId: normalizedTest.id,
      test: normalizedTest
    });
  } catch (err) {
    console.error('Failed to process uploaded JSON question paper:', err);
    res.status(400).json({ success: false, error: err.message });
  }
});

// Retroactively synchronize all existing test_attempts rows in SQLite with the psychometric rank & percentile engine and sanitize unvisited question times
function recalculateExistingAttemptsInDB() {
  try {
    const allAttempts = db.prepare(`
      SELECT a.*, t.type as test_type, t.title as catalog_title, t.marks as catalog_marks
      FROM test_attempts a
      LEFT JOIN tests t ON a.test_id = t.id
    `).all();
    const updateStmt = db.prepare(`
      UPDATE test_attempts
      SET percentile = ?, estimated_air = ?, responses_json = ?, time_spent_seconds = ?
      WHERE id = ?
    `);
    allAttempts.forEach(att => {
      const rankData = examPatterns2026.calculateTestRankAndPercentile({
        testId: att.test_id,
        testTitle: att.test_title || att.catalog_title,
        testType: att.test_type,
        score: att.score,
        maxScore: att.max_score || att.catalog_marks || 100,
        correctCount: att.correct_count,
        wrongCount: att.wrong_count,
        unansweredCount: att.unanswered_count,
        totalQuestions: att.total_questions,
        accuracy: att.accuracy
      });
      let respMap = {};
      try {
        respMap = JSON.parse(att.responses_json || '{}') || {};
      } catch (e) {
        respMap = {};
      }
      let summedSec = 0;
      Object.values(respMap).forEach(r => {
        if (!r || typeof r !== 'object') return;
        const isAttempted = r.selectedIndex !== null && r.selectedIndex !== undefined;
        const isVisited = Boolean((r.status && r.status !== 'stic-notvisited') || isAttempted);
        if (!isVisited) {
          r.timeSpentSeconds = 0;
          r.timeSpentMs = 0;
          r.timeEntries = [];
        } else {
          r.timeSpentSeconds = Math.max(0, Math.round(Number(r.timeSpentSeconds) || 0));
          summedSec += r.timeSpentSeconds;
        }
      });
      const updatedTotalTime = summedSec > 0 ? summedSec : Math.max(0, Number(att.time_spent_seconds) || 0);
      updateStmt.run(rankData.percentile, rankData.estimatedAIR, JSON.stringify(respMap), updatedTotalTime, att.id);
    });
    if (allAttempts.length > 0) {
      console.log(`[Rank & Percentile Engine] Synchronized ${allAttempts.length} existing attempt(s) in SQLite.`);
    }
  } catch (err) {
    console.warn('Failed to synchronize existing attempts on startup:', err.message);
  }
}
recalculateExistingAttemptsInDB();

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
      timeSpentSeconds,
      sectionBreakdown,
      responses,
      startedAt,
      completedAt
    } = req.body;

    if (!userId || !testId) {
      return res.status(400).json({ success: false, error: 'userId and testId are required' });
    }

    const testRow = db.prepare('SELECT type, title, marks FROM tests WHERE id = ?').get(testId);
    const rankData = examPatterns2026.calculateTestRankAndPercentile({
      testId,
      testTitle: testTitle || (testRow && testRow.title) || 'Mock Test',
      testType: testRow && testRow.type,
      score: score ?? 0,
      maxScore: maxScore || (testRow && testRow.marks) || 100,
      correctCount: correctCount ?? 0,
      wrongCount: wrongCount ?? 0,
      unansweredCount: unansweredCount ?? 0,
      totalQuestions: totalQuestions || 100,
      accuracy: accuracy ?? 0
    });

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
      testTitle || (testRow && testRow.title) || 'Mock Test',
      totalQuestions || 0,
      score ?? 0,
      maxScore || (testRow && testRow.marks) || 100,
      correctCount || 0,
      wrongCount || 0,
      unansweredCount || 0,
      accuracy || 0,
      rankData.percentile,
      rankData.estimatedAIR,
      timeSpentSeconds || 0,
      JSON.stringify(sectionBreakdown || []),
      JSON.stringify(responses || {}),
      startedAt || now,
      completedAt || now
    );

    // Clear any paused state for this user and test upon final submission
    db.prepare('DELETE FROM paused_attempts WHERE user_id = ? AND test_id = ?').run(userId, testId);

    console.log(`Test attempt saved permanently: ID ${attemptId} for User ${userId} on Test ${testId} (Percentile: ${rankData.percentile}%ile, AIR: #${rankData.estimatedAIR}/${rankData.totalCandidates})`);

    res.json({
      success: true,
      attemptId,
      percentile: rankData.percentile,
      estimatedAir: rankData.estimatedAIR,
      totalCandidates: rankData.totalCandidates,
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
    const userId = req.query.userId || req.query.user_id;
    const testId = req.query.testId || req.query.test_id;
    if (!userId) {
      return res.status(400).json({ success: false, error: 'userId is required for isolated attempts' });
    }

    let query = `
      SELECT a.*, t.type as test_type
      FROM test_attempts a
      LEFT JOIN tests t ON a.test_id = t.id
      WHERE a.user_id = ?
    `;
    const params = [userId];

    if (testId) {
      query += ' AND a.test_id = ?';
      params.push(testId);
    }
    query += ' ORDER BY a.completed_at DESC';

    const rows = db.prepare(query).all(...params);
    const attempts = rows.map(r => {
      const rankInfo = examPatterns2026.calculateTestRankAndPercentile({
        testId: r.test_id,
        testTitle: r.test_title,
        testType: r.test_type,
        score: r.score,
        maxScore: r.max_score,
        correctCount: r.correct_count,
        wrongCount: r.wrong_count,
        unansweredCount: r.unanswered_count,
        totalQuestions: r.total_questions,
        accuracy: r.accuracy
      });
      return {
        ...r,
        percentile: rankInfo.percentile,
        estimated_air: rankInfo.estimatedAIR,
        total_candidates: rankInfo.totalCandidates,
        section_breakdown: JSON.parse(r.section_breakdown_json || '[]'),
        responses: JSON.parse(r.responses_json || '{}')
      };
    });

    res.json({ success: true, attempts });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 4.6 GET SINGLE ATTEMPT SCORECARD
app.get('/api/attempts/:id', (req, res) => {
  try {
    const row = db.prepare(`
      SELECT a.*, t.type as test_type
      FROM test_attempts a
      LEFT JOIN tests t ON a.test_id = t.id
      WHERE a.id = ?
    `).get(req.params.id);
    if (!row) {
      return res.status(404).json({ success: false, error: 'Attempt not found' });
    }
    const rankInfo = examPatterns2026.calculateTestRankAndPercentile({
      testId: row.test_id,
      testTitle: row.test_title,
      testType: row.test_type,
      score: row.score,
      maxScore: row.max_score,
      correctCount: row.correct_count,
      wrongCount: row.wrong_count,
      unansweredCount: row.unanswered_count,
      totalQuestions: row.total_questions,
      accuracy: row.accuracy
    });
    const attempt = {
      ...row,
      percentile: rankInfo.percentile,
      estimated_air: rankInfo.estimatedAIR,
      total_candidates: rankInfo.totalCandidates,
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

    const rawAttempts = db.prepare(`
      SELECT a.*, t.type as test_type
      FROM test_attempts a
      LEFT JOIN tests t ON a.test_id = t.id
      WHERE a.user_id = ?
      ORDER BY a.completed_at DESC
    `).all(userId);
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);

    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    if (rawAttempts.length === 0) {
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

    // Enrich attempts with recalculated psychometric rank & percentile
    const attempts = rawAttempts.map(a => {
      const rankInfo = examPatterns2026.calculateTestRankAndPercentile({
        testId: a.test_id,
        testTitle: a.test_title,
        testType: a.test_type,
        score: a.score,
        maxScore: a.max_score,
        correctCount: a.correct_count,
        wrongCount: a.wrong_count,
        unansweredCount: a.unanswered_count,
        totalQuestions: a.total_questions,
        accuracy: a.accuracy
      });
      return {
        ...a,
        percentile: rankInfo.percentile,
        estimated_air: rankInfo.estimatedAIR,
        total_candidates: rankInfo.totalCandidates
      };
    });

    // Use the latest attempt per unique test_id for standing metrics so re-attempts replace older trial runs
    const latestPerTestMap = new Map();
    attempts.forEach(a => {
      if (!latestPerTestMap.has(a.test_id)) {
        latestPerTestMap.set(a.test_id, a);
      }
    });
    const representativeAttempts = Array.from(latestPerTestMap.values());

    const totalTests = attempts.length;
    const repCount = representativeAttempts.length;
    const avgScore = (representativeAttempts.reduce((sum, a) => sum + (Number(a.score) || 0), 0) / repCount).toFixed(2);
    const avgMaxScore = Math.round(representativeAttempts.reduce((sum, a) => sum + (Number(a.max_score) || 100), 0) / repCount);
    const avgScorePct = (
      representativeAttempts.reduce((sum, a) => {
        const maxS = Number(a.max_score) || 100;
        return sum + ((Number(a.score) || 0) / Math.max(1, maxS)) * 100;
      }, 0) / repCount
    ).toFixed(1);
    const allSameMaxScore = representativeAttempts.every(a => Number(a.max_score) === Number(representativeAttempts[0].max_score));
    const formattedAvgScore = allSameMaxScore
      ? `${avgScore} / ${representativeAttempts[0].max_score}`
      : `${avgScore} / ${avgMaxScore} (${avgScorePct}%)`;

    const avgAccuracy = (representativeAttempts.reduce((sum, a) => sum + a.accuracy, 0) / repCount).toFixed(1);
    const avgPercentile = (representativeAttempts.reduce((sum, a) => sum + a.percentile, 0) / repCount).toFixed(1);
    const bestAIR = Math.min(...representativeAttempts.map(a => a.estimated_air));

    // Calculate consecutive active day streak from attempt timestamps
    const uniqueDayNumbers = Array.from(new Set(
      attempts
        .map(a => {
          const rawTs = a.completed_at || a.started_at || a.submitted_at;
          const ts = rawTs ? new Date(rawTs) : null;
          if (!ts || isNaN(ts.getTime())) return null;
          return Math.floor(Date.UTC(ts.getUTCFullYear(), ts.getUTCMonth(), ts.getUTCDate()) / 86400000);
        })
        .filter(d => d !== null)
    )).sort((a, b) => b - a);

    let streakDays = uniqueDayNumbers.length > 0 ? 1 : 0;
    for (let i = 1; i < uniqueDayNumbers.length; i++) {
      if (uniqueDayNumbers[i - 1] - uniqueDayNumbers[i] === 1) {
        streakDays++;
      } else {
        break;
      }
    }

    // Section breakdown aggregated across user's representative attempts
    const secTotals = {};
    representativeAttempts.forEach(a => {
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
        avgScore: formattedAvgScore,
        avgAccuracy: `${avgAccuracy}%`,
        overallPercentile: `${avgPercentile}%ile`,
        predictedAIR: `#${bestAIR.toLocaleString()}`,
        streakDays: Math.max(1, streakDays),
        sectionBreakdowns: sectionBreakdowns
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 4.8 MULTI-USER LEADERBOARD API (AGGREGATES TOP ATTEMPT PER CANDIDATE FROM SQLITE)
app.get('/api/leaderboard', (req, res) => {
  try {
    const examId = req.query.examId || req.query.exam;
    let query = `
      SELECT a.*, u.name as user_name, u.roll_no as user_roll_no, u.avatar as user_avatar, t.exam_id as test_exam_id
      FROM test_attempts a
      JOIN users u ON a.user_id = u.id
      LEFT JOIN tests t ON a.test_id = t.id
    `;
    const params = [];
    if (examId && examId !== 'all') {
      query += ' WHERE (t.exam_id = ? OR t.exam_id IS NULL)';
      params.push(examId);
    }
    query += ' ORDER BY a.completed_at DESC';

    const rows = db.prepare(query).all(...params);

    // Pick best normalized score attempt per candidate
    const bestByUser = new Map();
    rows.forEach(r => {
      const maxS = Math.max(1, Number(r.max_score) || 100);
      const normScore = Number(((Number(r.score || 0) / maxS) * 100).toFixed(2));
      const prev = bestByUser.get(r.user_id);
      if (!prev || normScore > prev.normScore) {
        const secs = Math.max(1, Number(r.time_spent_seconds) || 1800);
        const m = Math.floor(secs / 60);
        const s = secs % 60;
        bestByUser.set(r.user_id, {
          userId: r.user_id,
          userName: r.user_name,
          rollNo: r.user_roll_no,
          avatar: r.user_avatar,
          testId: r.test_id,
          testTitle: r.test_title,
          rawScore: Number(r.score || 0),
          maxScore: maxS,
          normScore,
          accuracy: `${Number(r.accuracy || 0).toFixed(1)}%`,
          time: `${m}m ${s}s`,
          completedAt: r.completed_at
        });
      }
    });

    res.json({
      success: true,
      entries: Array.from(bestByUser.values())
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// 5. MODEL CONTEXT PROTOCOL (MCP) & LIVE OLIVEBOARD BROWSER
// ==========================================
const { mountMcpRoutes } = require('./mcp-server');
mountMcpRoutes(app, db);

const { mountOliveboardLiveBrowserRoutes } = require('./oliveboard-live-re');
mountOliveboardLiveBrowserRoutes(app, ingestBackendPaperFile);

// Fallback to index.html for SPA routing
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Start Server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`=======================================================`);
  console.log(` Oliveboard Mock Test Server running at http://0.0.0.0:${PORT}`);
  console.log(` SQLite Database: ${DB_PATH}`);
  console.log(` MCP Server Endpoints: POST /mcp | GET /mcp/sse | stdio: node mcp-server.js`);
  console.log(` Multi-user isolation & permanent result storage ACTIVE`);
  console.log(`=======================================================`);
});
