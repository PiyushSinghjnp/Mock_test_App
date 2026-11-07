require('dotenv').config();

// Production must never open or seed the legacy SQLite database. Keep the
// existing SQLite server as the local development path until cutover.
if (process.env.NODE_ENV === 'production') {
  const postgresServer = require('./server-postgres');
  if (require.main === module) postgresServer.start();
  module.exports = postgresServer;
} else {
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
const crypto = require('node:crypto');

// Load environment variables from .env file (for local development)
require('dotenv').config();

const app = express();
// Keep the API on a dedicated port so Vite can own the frontend port in dev.
const PORT = process.env.PORT || 3001;
const DB_PATH = path.join(__dirname, 'database.sqlite');
const UPLOADS_DIR = path.join(__dirname, 'images', 'uploads');

// Admin token: MUST be set via environment variable in production.
// In development, a default is allowed for convenience but logged as a warning.
let ADMIN_TOKEN;
if (process.env.OLIVEBOARD_ADMIN_TOKEN) {
  ADMIN_TOKEN = String(process.env.OLIVEBOARD_ADMIN_TOKEN).trim();
} else if (process.env.NODE_ENV === 'production') {
  console.error('FATAL: OLIVEBOARD_ADMIN_TOKEN must be set in production environment.');
  process.exit(1);
} else {
  ADMIN_TOKEN = 'admin';
  console.warn('⚠️  WARNING: Using default admin token "admin". Set OLIVEBOARD_ADMIN_TOKEN for production!');
}
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

function requireAdmin(req, res, next) {
  if (!ADMIN_TOKEN) {
    return res.status(503).json({ success: false, error: 'Admin uploads are disabled until OLIVEBOARD_ADMIN_TOKEN is configured.' });
  }
  const supplied = String(req.get('x-admin-token') || req.query.admin_token || '').trim();
  if (!supplied || supplied.length !== ADMIN_TOKEN.length || !require('node:crypto').timingSafeEqual(Buffer.from(supplied), Buffer.from(ADMIN_TOKEN))) {
    return res.status(401).json({ success: false, error: 'Admin authorization required.' });
  }
  next();
}

function toPublicUser(user) {
  if (!user) return user;
  const { password_hash, ...publicUser } = user;
  return publicUser;
}

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Serve application assets only. Never expose SQLite, source captures, cookies,
// browser profiles, scripts, or repository metadata through the project root.
for (const directory of ['css', 'js', 'images', 'img', 'oliveimg', 'public']) {
  app.use(`/${directory}`, express.static(path.join(__dirname, directory), {
    dotfiles: 'deny',
    index: false
  }));
}
app.get(['/', '/index.html'], (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'admin.html')));
const RUNTIME_ROOT = process.env.OB_RUNTIME_DIR || path.join(process.env.LOCALAPPDATA || path.dirname(__dirname), 'oliveboard-clone-runtime');
app.use('/scraped', express.static(path.join(RUNTIME_ROOT, 'scraped'), { dotfiles: 'deny', index: false }));

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
    password_hash TEXT,
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
  CREATE TABLE IF NOT EXISTS admin_audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    action TEXT NOT NULL,
    test_id TEXT,
    details_json TEXT,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS quiz_questions (
    id TEXT PRIMARY KEY,
    subject TEXT NOT NULL,
    question_text TEXT NOT NULL,
    passage_html TEXT DEFAULT '',
    image_urls_json TEXT DEFAULT '[]',
    options_json TEXT NOT NULL,
    correct_answer TEXT NOT NULL,
    explanation_html TEXT DEFAULT '',
    marks REAL DEFAULT 1.0,
    negative_marks REAL DEFAULT 0.25,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS candidate_quiz_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    subject TEXT NOT NULL,
    question_id TEXT NOT NULL,
    attempted_at TEXT NOT NULL,
    UNIQUE(user_id, question_id)
  );
`);

console.log('SQLite database schema verified.');

// Migration: Ensure password_hash, coins, streak_days, last_quiz_date exist in users table
try {
  const userCols = db.prepare('PRAGMA table_info(users)').all().map(c => c.name);
  if (!userCols.includes('password_hash')) {
    db.exec('ALTER TABLE users ADD COLUMN password_hash TEXT;');
    console.log('Added password_hash column to users table.');
  }
  if (!userCols.includes('coins')) {
    db.exec('ALTER TABLE users ADD COLUMN coins INTEGER DEFAULT 300;');
    console.log('Added coins column to users table.');
  }
  if (!userCols.includes('streak_days')) {
    db.exec('ALTER TABLE users ADD COLUMN streak_days INTEGER DEFAULT 1;');
    console.log('Added streak_days column to users table.');
  }
  if (!userCols.includes('last_quiz_date')) {
    db.exec('ALTER TABLE users ADD COLUMN last_quiz_date TEXT;');
    console.log('Added last_quiz_date column to users table.');
  }
} catch (e) {
  console.warn('Migration note:', e.message);
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  if (!stored) return false;
  const parts = stored.split(':');
  if (parts.length !== 2) return false;
  const [salt, hash] = parts;
  const testHash = crypto.scryptSync(password, salt, 64).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(testHash, 'hex'));
}

// Keep development compatibility for old local profiles. Never assign a known
// shared password to an account during a production startup.
try {
  if (process.env.NODE_ENV !== 'production') {
    const defaultHash = hashPassword('password123');
    db.prepare("UPDATE users SET password_hash = ? WHERE password_hash IS NULL OR password_hash = ''").run(defaultHash);
  }
} catch (e) {
  console.warn('Default password migration note:', e.message);
}

// ==========================================
// 2. SEED INITIAL USERS (ISOLATION DEMO)
// ==========================================
function seedUsers() {
  if (process.env.NODE_ENV === 'production') return;
  const checkUserStmt = db.prepare('SELECT COUNT(*) as count FROM users');
  const userCount = checkUserStmt.get().count;

  if (userCount === 0) {
    console.log('Seeding demo candidates for multi-user isolation...');
    const defaultHash = hashPassword('password123');
    const insertUser = db.prepare(`
      INSERT INTO users (id, username, name, email, avatar, roll_no, target_exam, password_hash, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insertUser.run(
      'user-rahul',
      'rahul',
      'Aspirant Rahul Sharma',
      'rahul@oliveboard.test',
      'R',
      'OB-2026-9041',
      'ibps-so',
      defaultHash,
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
      defaultHash,
      new Date().toISOString()
    );

    insertUser.run(
      'user-vikram',
      'vikram',
      'Vikram Malhotra',
      'vikram@oliveboard.test',
      'V',
      'OB-2026-7245',
      'ssc-cgl',
      defaultHash,
      new Date().toISOString()
    );

    console.log('Seeded 3 demo candidate profiles with credentials.');
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

}

// ==========================================
// 3.3 BACKEND-ONLY AUTO-INGESTION OF /papers/*.json WITH 2026 OFFICIAL TIMINGS
// ==========================================
const examPatterns2026 = require('./js/exam-patterns-2026');
const PAPERS_DIR = path.join(__dirname, 'papers');
if (!fs.existsSync(PAPERS_DIR)) {
  fs.mkdirSync(PAPERS_DIR, { recursive: true });
}

function sanitizeQuestionContent(value) {
  if (typeof value !== 'string') return value;

  return value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .replace(/ï¿½|Ã¯Â¿Â½|�/g, '')
    .replace(/â€¢/g, '•')
    .replace(/â€“/g, '–')
    .replace(/â€”/g, '—')
    .replace(/â€™/g, '’')
    .replace(/â€œ/g, '“')
    .replace(/â€/g, '”')
    .replace(/Â/g, '');
}

function sanitizeQuestion(question) {
  if (!question || typeof question !== 'object') return question;
  for (const field of ['questionHTML', 'passageHTML', 'explanationHTML']) {
    question[field] = sanitizeQuestionContent(question[field]);
  }
  if (Array.isArray(question.options)) {
    question.options = question.options.map(option => ({
      ...option,
      text: sanitizeQuestionContent(option?.text)
    }));
  }
  return question;
}

function repairKnownCapturedPaper(filename, parsedPaper) {
  if (filename !== 'sbi-po-pre-01.json' || !parsedPaper || !Array.isArray(parsedPaper.sections)) {
    return parsedPaper;
  }

  const cleanSourcePath = path.join(__dirname, 'scraped', 'sbi_po_prelims_1_full.json');
  if (!fs.existsSync(cleanSourcePath)) return parsedPaper;

  try {
    const cleanPaper = JSON.parse(fs.readFileSync(cleanSourcePath, 'utf8'));
    const targetQuestions = parsedPaper.sections.flatMap(section => section.questions || []);
    const cleanQuestions = Array.isArray(cleanPaper.questions) ? cleanPaper.questions : [];
    if (targetQuestions.length !== cleanQuestions.length || targetQuestions.length === 0) {
      return parsedPaper;
    }

    targetQuestions.forEach((question, index) => {
      const cleanQuestion = cleanQuestions[index];
      if (!cleanQuestion) return;
      Object.assign(question, {
        questionHTML: cleanQuestion.questionHTML || question.questionHTML,
        passageHTML: cleanQuestion.passageHTML || '',
        hasPassage: Boolean(cleanQuestion.hasPassage),
        imageUrls: Array.isArray(cleanQuestion.imageUrls) ? cleanQuestion.imageUrls : [],
        options: Array.isArray(cleanQuestion.options) ? cleanQuestion.options : question.options,
        correctAnswer: cleanQuestion.correctAnswer || question.correctAnswer,
        correctIndex: cleanQuestion.correctIndex ?? question.correctIndex,
        explanationHTML: cleanQuestion.explanationHTML || question.explanationHTML
      });
      sanitizeQuestion(question);
    });
    console.log(`[Backend Repair] Restored clean question content for ${filename} (${targetQuestions.length} questions).`);
  } catch (error) {
    console.warn(`[Backend Repair] Could not repair ${filename}:`, error.message);
  }
  return parsedPaper;
}

function ingestBackendPaperFile(filePath, options = {}) {
  try {
    if (!filePath.endsWith('.json')) return null;
    const filename = path.basename(filePath);
    const rawContent = fs.readFileSync(filePath, 'utf8');
    if (!rawContent || !rawContent.trim()) return null;

    const parsedPaper = repairKnownCapturedPaper(filename, JSON.parse(rawContent));
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

    const provenance = parsedPaper.source?.provider === 'oliveboard' ? 'Preserved captured source settings' : 'Applied configured exam pattern';
    console.log(`[Backend Auto-Ingest] ${provenance} for "${normalizedTest.title}" (${normalizedTest.id}): ${normalizedTest.questionsCount} Qs, ${normalizedTest.durationMinutes} mins`);
    return normalizedTest;
  } catch (err) {
    console.error(`[Backend Auto-Ingest] Failed to ingest ${filePath}:`, err.message);
    if (options.throwOnError) throw err;
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
  const pendingPaperImports = new Map();
  fs.watch(PAPERS_DIR, (eventType, filename) => {
    if (filename && filename.toLowerCase().endsWith('.json')) {
      clearTimeout(pendingPaperImports.get(filename));
      pendingPaperImports.set(filename, setTimeout(() => {
        pendingPaperImports.delete(filename);
        const fullPath = path.join(PAPERS_DIR, filename);
        if (fs.existsSync(fullPath)) {
          ingestBackendPaperFile(fullPath);
        }
      }, 300));
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
    res.json({ success: true, users: users.map(toPublicUser) });
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
    res.json({ success: true, user: toPublicUser(newUser) });
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
    res.json({ success: true, user: toPublicUser(updated) });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 4.1b AUTHENTICATION API (LOGIN, REGISTER, SESSION)
app.post('/api/auth/login', (req, res) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !username.trim() || !password) {
      return res.status(400).json({ success: false, error: 'Username and password are required.' });
    }
    const cleanUser = username.trim().toLowerCase();
    if (process.env.NODE_ENV === 'production' && password === 'password123') {
      return res.status(403).json({ success: false, error: 'This shared demo password is disabled in production. Contact an administrator to set a private password.' });
    }
    const user = db.prepare('SELECT * FROM users WHERE LOWER(username) = ?').get(cleanUser);
    if (!user) {
      return res.status(401).json({ success: false, error: 'Invalid username or password.' });
    }
    if (!user.password_hash || !verifyPassword(password, user.password_hash)) {
      return res.status(401).json({ success: false, error: 'Invalid username or password.' });
    }
    const token = crypto.randomBytes(32).toString('hex');
    const safeUser = {
      id: user.id,
      username: user.username,
      name: user.name,
      email: user.email,
      avatar: user.avatar,
      roll_no: user.roll_no,
      target_exam: user.target_exam,
      coins: user.coins !== undefined && user.coins !== null ? user.coins : 300,
      streak_days: user.streak_days !== undefined && user.streak_days !== null ? user.streak_days : 1,
      last_quiz_date: user.last_quiz_date || null,
      created_at: user.created_at
    };
    res.json({
      success: true,
      message: 'Login successful',
      token,
      user: safeUser
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/auth/register', (req, res) => {
  try {
    const { username, password, name, target_exam } = req.body || {};
    const minimumPasswordLength = process.env.NODE_ENV === 'production' ? 12 : 4;
    if (!username || !username.trim() || !password || password.length < minimumPasswordLength) {
      return res.status(400).json({ success: false, error: `Username and password (min ${minimumPasswordLength} characters) are required.` });
    }
    const cleanUser = username.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
    if (!cleanUser) {
      return res.status(400).json({ success: false, error: 'Invalid username format. Use letters, numbers, hyphens.' });
    }
    const existing = db.prepare('SELECT id FROM users WHERE LOWER(username) = ?').get(cleanUser);
    if (existing) {
      return res.status(409).json({ success: false, error: 'Username already taken. Please choose another or sign in.' });
    }
    const id = `user-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const fullName = (name && name.trim()) ? name.trim() : (cleanUser.charAt(0).toUpperCase() + cleanUser.slice(1));
    const avatar = fullName.charAt(0).toUpperCase();
    const rollNo = `OB-2026-${Math.floor(1000 + Math.random() * 9000)}`;
    const targetExam = target_exam || 'sbi-po';
    const createdAt = new Date().toISOString();
    const passwordHash = hashPassword(password);

    db.prepare(`
      INSERT INTO users (id, username, name, email, avatar, roll_no, target_exam, password_hash, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, cleanUser, fullName, `${cleanUser}@oliveboard.test`, avatar, rollNo, targetExam, passwordHash, createdAt);

    const newUser = db.prepare('SELECT id, username, name, email, avatar, roll_no, target_exam, coins, streak_days, last_quiz_date, created_at FROM users WHERE id = ?').get(id);
    const token = crypto.randomBytes(32).toString('hex');
    res.json({
      success: true,
      message: 'Account created successfully',
      token,
      user: newUser
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/auth/me', (req, res) => {
  try {
    const userId = req.query.userId || req.headers['x-user-id'];
    if (!userId) {
      return res.json({ success: true, authenticated: false, user: null });
    }
    const user = db.prepare('SELECT id, username, name, email, avatar, roll_no, target_exam, coins, streak_days, last_quiz_date, created_at FROM users WHERE id = ?').get(userId);
    if (!user) {
      return res.json({ success: true, authenticated: false, user: null });
    }
    res.json({ success: true, authenticated: true, user });
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
      test = db.prepare('SELECT * FROM tests WHERE LOWER(id) = LOWER(?)').get(reqId);
    }
    if (!test) {
      const lowerId = reqId.toLowerCase();
      let matchedId = null;
      if (lowerId.includes('ssc-cgl')) matchedId = 'ssc-cgl-pre-01';
      else if (lowerId.includes('rbi')) matchedId = 'rbi-phase1-01';
      else if (lowerId.includes('rrb')) matchedId = 'rrb-ntpc-cbt1-01';
      else if (lowerId.includes('ibps-po')) matchedId = 'ibps-po-pre-01';
      else if (lowerId.includes('ibps-so')) matchedId = lowerId.includes('mains') ? 'ibps-so-it-mains-1' : 'ibps-so-it-prelims-1';
      else if (lowerId.includes('sbi-clerk')) matchedId = 'sbi-po-pre-02';
      else if (lowerId.includes('ibps-clerk')) matchedId = 'sbi-po-pre-03';
      else matchedId = 'sbi-po-pre-01';

      test = db.prepare('SELECT * FROM tests WHERE id = ?').get(matchedId);
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

// 4.3c ADMIN-ONLY QUESTION PAPER UPLOAD
app.put('/api/admin/users/:id/password', requireAdmin, (req, res) => {
  const password = req.body?.password;
  if (typeof password !== 'string' || password.length < 12) {
    return res.status(400).json({ success: false, error: 'A new password of at least 12 characters is required.' });
  }
  try {
    const result = db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hashPassword(password), req.params.id);
    if (!result.changes) return res.status(404).json({ success: false, error: 'User not found.' });
    res.json({ success: true });
  } catch {
    res.status(500).json({ success: false, error: 'Unable to update the candidate password.' });
  }
});

app.get('/api/admin/tests', requireAdmin, (req, res) => {
  const tests = db.prepare('SELECT id, exam_id, exam_name, type, title, questions_count, duration_minutes, created_at FROM tests ORDER BY created_at DESC').all();
  res.json({ success: true, tests });
});

app.post('/api/tests/upload-json', requireAdmin, (req, res) => {
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
    db.prepare('INSERT INTO admin_audit_log (action, test_id, details_json, created_at) VALUES (?, ?, ?, ?)').run(
      'upload_or_update_test', normalizedTest.id, JSON.stringify({ title: normalizedTest.title, examId: normalizedTest.examId, questions: normalizedTest.questionsCount }), now
    );
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

// 4.3d ADMIN IMAGE ASSETS & INSERTER FOR MOCK MAKING
app.post('/api/admin/upload-image', requireAdmin, (req, res) => {
  try {
    const { filename, imageData, dataUrl, caption } = req.body;
    const rawData = dataUrl || imageData;
    if (!rawData) {
      return res.status(400).json({ success: false, error: 'Image data is required (base64 string or data URL).' });
    }

    let buffer;
    let ext = '.png';
    const matches = String(rawData).match(/^data:image\/([a-zA-Z0-9+]+);base64,(.+)$/);
    if (matches) {
      const mimeSub = matches[1].toLowerCase();
      ext = mimeSub === 'jpeg' ? '.jpg' : mimeSub === 'svg+xml' ? '.svg' : `.${mimeSub}`;
      buffer = Buffer.from(matches[2], 'base64');
    } else {
      buffer = Buffer.from(rawData, 'base64');
    }

    if (filename && path.extname(filename)) {
      ext = path.extname(filename).toLowerCase();
    }

    const allowedExts = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg']);
    if (!allowedExts.has(ext)) {
      return res.status(400).json({ success: false, error: `Unsupported image format: ${ext}. Supported: PNG, JPG, JPEG, GIF, WEBP, SVG.` });
    }

    if (buffer.length > 25 * 1024 * 1024) {
      return res.status(400).json({ success: false, error: 'Image size exceeds maximum limit of 25MB.' });
    }

    const baseName = filename ? path.basename(filename, path.extname(filename)).replace(/[^a-zA-Z0-9_-]/g, '_') : 'figure';
    const safeFilename = `mock_${Date.now()}_${baseName.slice(0, 40)}${ext}`;
    const targetPath = path.join(UPLOADS_DIR, safeFilename);

    fs.writeFileSync(targetPath, buffer);

    const relativeUrl = `/images/uploads/${safeFilename}`;
    const altText = caption && caption.trim() ? caption.trim() : (baseName || 'Question Diagram');
    const imgTag = `<img src="${relativeUrl}" alt="${altText}" style="max-width:100%;height:auto;display:block;margin:8px 0;border:1px solid #cbd5e1;border-radius:6px;padding:4px;background:#fff;">`;

    console.log(`[Admin Image Uploaded] Saved ${safeFilename} (${buffer.length} bytes) to ${relativeUrl}`);
    res.json({
      success: true,
      url: relativeUrl,
      filename: safeFilename,
      size: buffer.length,
      caption: altText,
      tag: imgTag,
      markdown: `![${altText}](${relativeUrl})`
    });
  } catch (err) {
    console.error('Failed to upload image:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/admin/images', requireAdmin, (req, res) => {
  try {
    if (!fs.existsSync(UPLOADS_DIR)) {
      return res.json({ success: true, images: [] });
    }
    const files = fs.readdirSync(UPLOADS_DIR);
    const images = [];
    for (const f of files) {
      const ext = path.extname(f).toLowerCase();
      if (!['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'].includes(ext)) continue;
      const stat = fs.statSync(path.join(UPLOADS_DIR, f));
      images.push({
        filename: f,
        url: `/images/uploads/${f}`,
        size: stat.size,
        createdAt: stat.birthtime || stat.mtime,
        tag: `<img src="/images/uploads/${f}" alt="Mock Figure" style="max-width:100%;height:auto;display:block;margin:8px 0;">`
      });
    }
    images.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.json({ success: true, images });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.delete('/api/admin/images/:filename', requireAdmin, (req, res) => {
  try {
    const rawName = path.basename(req.params.filename);
    const targetPath = path.join(UPLOADS_DIR, rawName);
    if (!fs.existsSync(targetPath)) {
      return res.status(404).json({ success: false, error: 'Image file not found.' });
    }
    fs.unlinkSync(targetPath);
    res.json({ success: true, message: `Image ${rawName} deleted.` });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 4.3e ADMIN MOCK MAKER - FETCH AND SAVE QUESTIONS
app.get('/api/admin/tests/:id', requireAdmin, (req, res) => {
  try {
    const test = db.prepare('SELECT * FROM tests WHERE id = ?').get(req.params.id);
    if (!test) {
      return res.status(404).json({ success: false, error: 'Test not found' });
    }
    res.json({ success: true, test: JSON.parse(test.test_data_json) });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/admin/save-mock-question', requireAdmin, (req, res) => {
  try {
    const {
      testId,
      examId,
      examName,
      testTitle,
      testType,
      sectionTitle,
      question
    } = req.body;

    if (!testId || !testTitle || !question) {
      return res.status(400).json({ success: false, error: 'testId, testTitle, and question object are required.' });
    }

    let existingRow = db.prepare('SELECT * FROM tests WHERE id = ?').get(testId);
    let testData;

    if (existingRow) {
      testData = JSON.parse(existingRow.test_data_json);
    } else {
      testData = {
        id: testId,
        examId: examId || 'custom-exam',
        examName: examName || 'Custom Exam',
        title: testTitle,
        subtitle: 'Created via Oliveboard Admin Mock Maker',
        type: testType || 'prelims',
        marks: 0,
        questionsCount: 0,
        durationMinutes: 60,
        marksPerCorrect: 1.0,
        negativeMarks: 0.25,
        isFree: 1,
        sections: [],
        sectionsSummary: []
      };
    }

    if (!Array.isArray(testData.sections)) {
      testData.sections = [];
    }

    const secTitle = (sectionTitle || 'General').trim();
    let targetSection = testData.sections.find(s => (s.title || '').toLowerCase() === secTitle.toLowerCase());
    if (!targetSection) {
      targetSection = {
        id: `sec-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        title: secTitle,
        durationMinutes: 20,
        durationSeconds: 1200,
        maxMarks: 0,
        questions: []
      };
      testData.sections.push(targetSection);
    }

    if (!Array.isArray(targetSection.questions)) {
      targetSection.questions = [];
    }

    const qid = question.qid || question.id || `q_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const marksForCorrect = Number(question.marksForCorrect) || 1.0;
    const negativeMarks = Number(question.negativeMarks) >= 0 ? Number(question.negativeMarks) : 0.25;

    const existingQIndex = targetSection.questions.findIndex(q => String(q.id) === String(qid) || String(q.qid) === String(qid));

    const finalQuestion = {
      id: String(qid),
      qid: qid,
      sourceQuestionId: String(qid),
      section: secTitle,
      questionHTML: question.questionHTML || '<p>Question statement</p>',
      passageHTML: question.passageHTML || '',
      hasPassage: Boolean(question.passageHTML && question.passageHTML.trim().length > 10),
      imageUrls: Array.isArray(question.imageUrls) ? question.imageUrls : (question.imageUrls ? [question.imageUrls] : []),
      options: Array.isArray(question.options) ? question.options : [
        { letter: 'A', text: 'Option A', html: 'Option A' },
        { letter: 'B', text: 'Option B', html: 'Option B' },
        { letter: 'C', text: 'Option C', html: 'Option C' },
        { letter: 'D', text: 'Option D', html: 'Option D' }
      ],
      correctAnswer: question.correctAnswer || 'A',
      correctIndex: typeof question.correctIndex === 'number' ? question.correctIndex :
        (question.correctAnswer ? Math.max(0, question.correctAnswer.toUpperCase().charCodeAt(0) - 65) : 0),
      explanationHTML: question.explanationHTML || '',
      marksForCorrect: marksForCorrect,
      negativeMarks: negativeMarks
    };

    if (existingQIndex >= 0) {
      targetSection.questions[existingQIndex] = { ...targetSection.questions[existingQIndex], ...finalQuestion };
    } else {
      targetSection.questions.push(finalQuestion);
    }

    let globalCounter = 0;
    let totalMarks = 0;
    testData.sections.forEach(sec => {
      let secMarks = 0;
      sec.questions.forEach((q, idx) => {
        globalCounter++;
        q.globalIndex = globalCounter;
        q.localIndex = idx + 1;
        q.questionNumber = globalCounter;
        q.section = sec.title;
        secMarks += (Number(q.marksForCorrect) || 1);
      });
      sec.maxMarks = secMarks;
      sec.expectedQuestions = sec.questions.length;
      totalMarks += secMarks;
    });

    testData.questionsCount = globalCounter;
    testData.marks = totalMarks;
    testData.sectionsSummary = testData.sections.map(s => ({
      id: s.id,
      title: s.title,
      questionsCount: s.questions.length,
      maxMarks: s.maxMarks,
      durationMinutes: s.durationMinutes || 20
    }));

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
      testData.id,
      testData.examId,
      testData.examName,
      testData.type,
      testData.title,
      testData.subtitle,
      testData.marks,
      testData.questionsCount,
      testData.durationMinutes,
      testData.marksPerCorrect || 1.0,
      testData.negativeMarks || 0.25,
      1,
      JSON.stringify(testData.sectionsSummary),
      JSON.stringify(testData),
      now
    );

    db.prepare('INSERT INTO admin_audit_log (action, test_id, details_json, created_at) VALUES (?, ?, ?, ?)').run(
      'save_mock_question', testData.id, JSON.stringify({ questionId: finalQuestion.id, totalQuestions: testData.questionsCount, section: secTitle }), now
    );

    res.json({
      success: true,
      testId: testData.id,
      questionId: finalQuestion.id,
      questionNumber: finalQuestion.questionNumber,
      totalQuestions: testData.questionsCount,
      totalMarks: testData.marks,
      test: testData
    });
  } catch (err) {
    console.error('Failed to save mock question:', err);
    res.status(500).json({ success: false, error: err.message });
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

    // Streak & Coins reward calculation for Daily Quiz attempts
    let streakReward = null;
    if (String(testId).startsWith('quiz-')) {
      try {
        const userRow = db.prepare('SELECT coins, streak_days, last_quiz_date FROM users WHERE id = ?').get(userId);
        if (userRow) {
          const todayStr = (completedAt ? new Date(completedAt) : new Date()).toISOString().slice(0, 10);
          const lastDate = userRow.last_quiz_date || null;
          let streakDays = Number(userRow.streak_days) || 1;
          let coinsAwarded = 50;

          if (lastDate) {
            const last = new Date(lastDate + 'T00:00:00Z');
            const today = new Date(todayStr + 'T00:00:00Z');
            const diffDays = Math.round((today - last) / (1000 * 60 * 60 * 24));

            if (diffDays === 0) {
              coinsAwarded = 25; // Same-day practice bonus
            } else if (diffDays === 1) {
              streakDays += 1; // Consecutive day streak
              coinsAwarded = 50;
            } else {
              streakDays = 1; // Streak restarted
              coinsAwarded = 50;
            }
          } else {
            streakDays = 1;
            coinsAwarded = 50;
          }

          const currentCoins = Number(userRow.coins !== undefined && userRow.coins !== null ? userRow.coins : 300);
          const updatedCoins = currentCoins + coinsAwarded;

          db.prepare('UPDATE users SET coins = ?, streak_days = ?, last_quiz_date = ? WHERE id = ?').run(
            updatedCoins,
            streakDays,
            todayStr,
            userId
          );

          streakReward = {
            coinsAwarded,
            streakDays,
            totalCoins: updatedCoins
          };
          console.log(`[Quiz Streak Reward] User ${userId} awarded ${coinsAwarded} coins. Streak: ${streakDays}d, Total Coins: ${updatedCoins}`);
        }
      } catch (e) {
        console.warn('Streak reward calculation error:', e.message);
      }
    }

    res.json({
      success: true,
      attemptId,
      percentile: rankData.percentile,
      estimatedAir: rankData.estimatedAIR,
      totalCandidates: rankData.totalCandidates,
      streakReward,
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
          sectionBreakdowns: [],
          recentAttempts: []
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

    const recentAttempts = representativeAttempts
      .slice()
      .reverse()
      .slice(-6)
      .map(a => {
        const completedAt = a.completed_at || a.started_at || a.submitted_at;
        const date = completedAt ? new Date(completedAt) : null;
        const scorePct = ((Number(a.score) || 0) / Math.max(1, Number(a.max_score) || 100)) * 100;
        return {
          testTitle: a.test_title || 'Mock test',
          score: Number(scorePct.toFixed(1)),
          accuracy: Number((Number(a.accuracy) || 0).toFixed(1)),
          completedAt: date && !Number.isNaN(date.getTime()) ? date.toISOString() : null
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
        sectionBreakdowns: sectionBreakdowns,
        recentAttempts
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
// 4.6 DAILY 10-QUESTION MINI QUIZZES & QUESTION BANK
// ==========================================

// Helper: Parse questions from JSON or formatted plain text
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
      const qText = q.questionHTML || q.questionText || q.question || q.text || q.title || '';
      if (!qText.trim()) return;

      let opts = [];
      if (Array.isArray(q.options)) {
        opts = q.options.map((opt, oIdx) => {
          if (typeof opt === 'string') {
            const letter = String.fromCharCode(65 + oIdx);
            return { letter, text: opt, html: opt };
          }
          const letter = opt.letter || String.fromCharCode(65 + oIdx);
          const htmlContent = opt.html !== undefined ? opt.html : (opt.text || opt.title || `Option ${letter}`);
          const txt = opt.text || opt.html || `Option ${letter}`;
          return { letter, text: txt, html: htmlContent };
        });
      } else if (typeof q.options === 'object' && q.options !== null) {
        opts = Object.entries(q.options).map(([key, val]) => {
          const valStr = typeof val === 'object' && val !== null ? (val.html || val.text || JSON.stringify(val)) : String(val);
          return {
            letter: key.toUpperCase(),
            text: valStr,
            html: valStr
          };
        });
      }

      if (opts.length < 2) {
        opts = [
          { letter: 'A', text: 'Option A', html: 'Option A' },
          { letter: 'B', text: 'Option B', html: 'Option B' },
          { letter: 'C', text: 'Option C', html: 'Option C' },
          { letter: 'D', text: 'Option D', html: 'Option D' }
        ];
      }

      let correct = 'A';
      if (typeof q.correctAnswer === 'string' && q.correctAnswer.trim()) {
        correct = q.correctAnswer.trim().toUpperCase().charAt(0);
      } else if (typeof q.correctIndex === 'number' && q.correctIndex >= 0 && q.correctIndex < opts.length) {
        correct = opts[q.correctIndex].letter;
      } else if (typeof q.answer === 'string') {
        correct = q.answer.trim().toUpperCase().charAt(0);
      }

      questions.push({
        id: `quiz-q-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 7)}`,
        subject: (q.subject || subjectName).trim(),
        questionText: qText.trim(),
        passageHTML: q.passageHTML || q.passage || q.directions || '',
        imageUrls: Array.isArray(q.imageUrls) ? q.imageUrls : (q.imageUrl ? [q.imageUrl] : []),
        options: opts,
        correctAnswer: correct,
        explanationHTML: q.explanationHTML || q.explanation || q.solution || q.solutionHTML || '',
        marks: Number(q.marks) || 1.0,
        negativeMarks: Number(q.negativeMarks) || 0.25
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

      let qText = '';
      let opts = [];
      let correct = 'A';
      let explanation = '';
      let parsingOptions = false;
      let parsingExplanation = false;

      const firstLine = lines[0].replace(/^(?:Q(?:uestion)?\s*\d+[\.\:\)]|\d+[\.\)]\s*)/i, '').trim();
      qText = firstLine;

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i];

        const ansMatch = line.match(/^(?:Answer|Ans|Correct(?:\s+Answer)?)\s*[\:\-\=]\s*\(?([A-Ea-e1-5])\)?/i);
        if (ansMatch) {
          const rawAns = ansMatch[1].toUpperCase();
          if (['1', '2', '3', '4', '5'].includes(rawAns)) {
            correct = String.fromCharCode(64 + parseInt(rawAns, 10));
          } else {
            correct = rawAns;
          }
          parsingOptions = false;
          continue;
        }

        const expMatch = line.match(/^(?:Explanation|Solution|Soln|Exp)\s*[\:\-\=]\s*(.*)$/i);
        if (expMatch) {
          explanation = expMatch[1] || '';
          parsingExplanation = true;
          parsingOptions = false;
          continue;
        }

        if (parsingExplanation) {
          explanation += ' ' + line;
          continue;
        }

        const optMatch = line.match(/^[\(\[]?([A-Ea-e])[\.\)\]]\s*(.*)$/i);
        if (optMatch) {
          parsingOptions = true;
          const letter = optMatch[1].toUpperCase();
          const optText = optMatch[2].trim();
          opts.push({ letter, text: optText, html: optText });
          continue;
        }

        if (parsingOptions && opts.length > 0) {
          opts[opts.length - 1].text += ' ' + line;
          opts[opts.length - 1].html += ' ' + line;
        } else if (!parsingOptions && !parsingExplanation) {
          qText += ' ' + line;
        }
      }

      if (opts.length < 2) {
        opts = [
          { letter: 'A', text: 'Option A', html: 'Option A' },
          { letter: 'B', text: 'Option B', html: 'Option B' },
          { letter: 'C', text: 'Option C', html: 'Option C' },
          { letter: 'D', text: 'Option D', html: 'Option D' }
        ];
      }

      if (qText) {
        questions.push({
          id: `quiz-q-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 7)}`,
          subject: subjectName,
          questionText: qText.trim(),
          passageHTML: '',
          imageUrls: [],
          options: opts,
          correctAnswer: correct,
          explanationHTML: explanation.trim(),
          marks: 1.0,
          negativeMarks: 0.25
        });
      }
    });
  }

  return questions;
}

// GET /api/quizzes/subjects - List available subjects with question counts and user progress
app.get('/api/quizzes/subjects', (req, res) => {
  try {
    const userId = req.query.userId || null;
    const subjectMap = new Map();

    // 1. Scan quiz_questions bank
    const bankCounts = db.prepare('SELECT subject, COUNT(*) as count FROM quiz_questions GROUP BY subject').all();
    bankCounts.forEach(row => {
      const cleanSub = row.subject.trim();
      subjectMap.set(cleanSub, {
        subject: cleanSub,
        bankCount: row.count,
        totalQuestions: row.count,
        solvedCount: 0
      });
    });

    // 2. Scan sections from uploaded mock tests in tests table
    const mockTests = db.prepare('SELECT test_data_json FROM tests').all();
    mockTests.forEach(row => {
      try {
        const tData = JSON.parse(row.test_data_json || '{}');
        if (Array.isArray(tData.sections)) {
          tData.sections.forEach(sec => {
            const title = (sec.title || '').trim();
            if (title && sec.questions && sec.questions.length > 0) {
              if (!subjectMap.has(title)) {
                subjectMap.set(title, {
                  subject: title,
                  bankCount: 0,
                  totalQuestions: sec.questions.length,
                  solvedCount: 0
                });
              } else {
                const cur = subjectMap.get(title);
                cur.totalQuestions = Math.max(cur.totalQuestions, cur.bankCount + sec.questions.length);
              }
            }
          });
        }
      } catch (e) {}
    });

    // 3. If userId provided, calculate isolated solved questions count for this candidate
    if (userId) {
      const solvedCounts = db.prepare(`
        SELECT subject, COUNT(DISTINCT question_id) as solved_count
        FROM candidate_quiz_history
        WHERE user_id = ?
        GROUP BY subject
      `).all(userId);
      solvedCounts.forEach(row => {
        const cleanSub = row.subject.trim();
        if (subjectMap.has(cleanSub)) {
          subjectMap.get(cleanSub).solvedCount = row.solved_count;
        } else {
          subjectMap.set(cleanSub, {
            subject: cleanSub,
            bankCount: 0,
            totalQuestions: Math.max(row.solved_count, 10),
            solvedCount: row.solved_count
          });
        }
      });
    }

    // Default subjects if database is fresh
    const defaultSubjectNames = ['Reasoning Ability', 'Quantitative Aptitude', 'English Language', 'General Awareness'];
    defaultSubjectNames.forEach(name => {
      if (!subjectMap.has(name)) {
        subjectMap.set(name, {
          subject: name,
          bankCount: 0,
          totalQuestions: 15,
          solvedCount: 0
        });
      }
    });

    const subjects = Array.from(subjectMap.values());

    let userCoins = 300;
    let userStreak = 1;
    if (userId) {
      const u = db.prepare('SELECT coins, streak_days FROM users WHERE id = ?').get(userId);
      if (u) {
        userCoins = u.coins !== undefined ? u.coins : 300;
        userStreak = u.streak_days !== undefined ? u.streak_days : 1;
      }
    }

    res.json({
      success: true,
      subjects,
      userStreak,
      userCoins
    });
  } catch (err) {
    console.error('Failed to get quiz subjects:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/quizzes/generate - Generates a 10-Question, 10-Min Quiz with multi-candidate non-repeating isolation
app.post('/api/quizzes/generate', (req, res) => {
  try {
    const { userId, subject } = req.body || {};
    if (!userId || !subject) {
      return res.status(400).json({ success: false, error: 'userId and subject are required' });
    }

    const cleanSubject = String(subject).trim();

    // 1. Gather all questions available for this subject from quiz_questions table
    let pool = db.prepare(`
      SELECT id, subject, question_text, passage_html, image_urls_json, options_json, correct_answer, explanation_html, marks, negative_marks
      FROM quiz_questions
      WHERE LOWER(subject) = LOWER(?)
    `).all(cleanSubject);

    // Map quiz_questions rows to standard test question structure
    let formattedPool = pool.map(row => {
      let options = [];
      let imageUrls = [];
      try { options = JSON.parse(row.options_json); } catch (e) { options = []; }
      try { imageUrls = JSON.parse(row.image_urls_json); } catch (e) { imageUrls = []; }
      return {
        id: row.id,
        section: cleanSubject,
        question: row.question_text,
        questionText: row.question_text,
        questionHTML: row.question_text,
        passageHTML: row.passage_html || '',
        hasPassage: Boolean(row.passage_html && row.passage_html.trim().length > 10),
        imageUrls: Array.isArray(imageUrls) ? imageUrls : [],
        options: options,
        correctAnswer: row.correct_answer || 'A',
        explanationHTML: row.explanation_html || '',
        marksForCorrect: Number(row.marks) || 1.0,
        negativeMarks: Number(row.negative_marks) || 0.25
      };
    });

    // 2. If quiz_questions bank has < 10 questions for this subject, pull questions from tests table sections
    if (formattedPool.length < 10) {
      const mockTests = db.prepare('SELECT test_data_json FROM tests').all();
      mockTests.forEach(row => {
        try {
          const tData = JSON.parse(row.test_data_json || '{}');
          if (Array.isArray(tData.sections)) {
            tData.sections.forEach(sec => {
              const secTitle = (sec.title || '').trim().toLowerCase();
              const targetTitle = cleanSubject.toLowerCase();
              if (secTitle && (secTitle.includes(targetTitle) || targetTitle.includes(secTitle))) {
                if (Array.isArray(sec.questions)) {
                  sec.questions.forEach(q => {
                    const qText = q.questionText || q.question || q.questionHTML || '';
                    if (qText && !formattedPool.some(existing => (existing.questionText || existing.question || existing.questionHTML) === qText)) {
                      formattedPool.push({
                        ...q,
                        id: q.id || `mock-q-${Math.random().toString(36).substring(2, 7)}`,
                        section: cleanSubject,
                        question: qText,
                        questionText: qText,
                        questionHTML: q.questionHTML || qText,
                        options: Array.isArray(q.options) ? q.options : [],
                        correctAnswer: q.correctAnswer || (typeof q.correctIndex === 'number' ? String.fromCharCode(65 + q.correctIndex) : 'A'),
                        explanationHTML: q.explanationHTML || ''
                      });
                    }
                  });
                }
              }
            });
          }
        } catch (e) {}
      });
    }

    if (formattedPool.length === 0) {
      return res.status(404).json({ success: false, error: `No questions found for subject "${cleanSubject}". Please upload questions in /admin.` });
    }

    // 3. User-isolated non-repeat check
    const solvedRows = db.prepare(`
      SELECT question_id FROM candidate_quiz_history
      WHERE user_id = ? AND LOWER(subject) = LOWER(?)
    `).all(userId, cleanSubject);
    const solvedSet = new Set(solvedRows.map(r => r.question_id));

    let unsolved = formattedPool.filter(q => !solvedSet.has(q.id));

    // "Only repeat when all of the questions of that section is solved by a candidate."
    if (unsolved.length < 10) {
      // Pool exhausted for this specific candidate: reset candidate's history for this subject
      db.prepare('DELETE FROM candidate_quiz_history WHERE user_id = ? AND LOWER(subject) = LOWER(?)').run(userId, cleanSubject);
      unsolved = [...formattedPool];
      console.log(`[Quiz Engine] Reset solved history for user ${userId} on "${cleanSubject}" (All ${formattedPool.length} questions completed)`);
    }

    // 4. Randomly shuffle and select up to 10 questions
    const shuffled = [...unsolved];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    const selectedQuestions = shuffled.slice(0, Math.min(10, shuffled.length));

    // 5. Record selected question IDs in candidate_quiz_history for this isolated user
    const now = new Date().toISOString();
    const insertHistoryStmt = db.prepare(`
      INSERT OR IGNORE INTO candidate_quiz_history (user_id, subject, question_id, attempted_at)
      VALUES (?, ?, ?, ?)
    `);
    selectedQuestions.forEach(q => {
      insertHistoryStmt.run(userId, cleanSubject, q.id, now);
    });

    // 6. Format into an authentic 10-Question, 10-Minute Test Data object
    const quizTestId = `quiz-${cleanSubject.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now()}`;
    selectedQuestions.forEach((q, idx) => {
      q.globalIndex = idx + 1;
      q.localIndex = idx + 1;
      q.questionNumber = idx + 1;
      q.section = cleanSubject;
    });

    const quizTestData = {
      id: quizTestId,
      examId: 'daily-quiz',
      examName: 'Daily Mini Quiz',
      type: 'daily-quiz',
      title: `Daily Quiz: ${cleanSubject}`,
      subtitle: `Daily Speed Drill • ${selectedQuestions.length} Questions • 10 Minutes`,
      marks: selectedQuestions.length * 1.0,
      questionsCount: selectedQuestions.length,
      durationMinutes: 10,
      totalDurationSeconds: 600,
      marksPerCorrect: 1.0,
      negativeMarks: 0.25,
      isQuiz: true,
      subject: cleanSubject,
      sectionsSummary: [{
        id: 'sec-quiz',
        title: cleanSubject,
        questionsCount: selectedQuestions.length,
        maxMarks: selectedQuestions.length * 1.0,
        durationMinutes: 10
      }],
      sections: [{
        id: 'sec-quiz',
        title: cleanSubject,
        durationMinutes: 10,
        durationSeconds: 600,
        expectedQuestions: selectedQuestions.length,
        maxMarks: selectedQuestions.length * 1.0,
        questions: selectedQuestions
      }]
    };

    // 7. Persist temporarily into tests table so testEngine & scorecard work seamlessly
    db.prepare(`
      INSERT INTO tests (
        id, exam_id, exam_name, type, title, subtitle,
        marks, questions_count, duration_minutes,
        marks_per_correct, negative_marks, is_free,
        sections_summary_json, test_data_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET test_data_json = excluded.test_data_json
    `).run(
      quizTestData.id,
      quizTestData.examId,
      quizTestData.examName,
      quizTestData.type,
      quizTestData.title,
      quizTestData.subtitle,
      quizTestData.marks,
      quizTestData.questionsCount,
      quizTestData.durationMinutes,
      1.0,
      0.25,
      1,
      JSON.stringify(quizTestData.sectionsSummary),
      JSON.stringify(quizTestData),
      now
    );

    res.json({
      success: true,
      test: quizTestData,
      testId: quizTestData.id,
      selectedCount: selectedQuestions.length,
      unsolvedRemaining: Math.max(0, unsolved.length - selectedQuestions.length)
    });
  } catch (err) {
    console.error('Failed to generate daily quiz:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/quizzes/import - Admin endpoint to push JSON or plain text questions for a subject
app.post('/api/quizzes/import', requireAdmin, (req, res) => {
  try {
    const { subject, format, content } = req.body || {};
    if (!subject || !subject.trim()) {
      return res.status(400).json({ success: false, error: 'Subject is required.' });
    }
    if (!content) {
      return res.status(400).json({ success: false, error: 'Question content (JSON or formatted text) is required.' });
    }

    const cleanSubject = subject.trim();
    const questions = parseQuizQuestions(content, format || 'json', cleanSubject);

    if (questions.length === 0) {
      return res.status(400).json({ success: false, error: 'No valid questions could be parsed from the provided input.' });
    }

    const now = new Date().toISOString();
    const insertStmt = db.prepare(`
      INSERT INTO quiz_questions (
        id, subject, question_text, passage_html, image_urls_json,
        options_json, correct_answer, explanation_html, marks, negative_marks, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    let imported = 0;
    for (const q of questions) {
      insertStmt.run(
        q.id,
        cleanSubject,
        q.questionText,
        q.passageHTML || '',
        JSON.stringify(q.imageUrls || []),
        JSON.stringify(q.options || []),
        q.correctAnswer || 'A',
        q.explanationHTML || '',
        q.marks || 1.0,
        q.negativeMarks || 0.25,
        now
      );
      imported++;
    }

    const totalInSubject = db.prepare('SELECT COUNT(*) as count FROM quiz_questions WHERE LOWER(subject) = LOWER(?)').get(cleanSubject).count;

    db.prepare('INSERT INTO admin_audit_log (action, test_id, details_json, created_at) VALUES (?, ?, ?, ?)').run(
      'import_quiz_questions', cleanSubject, JSON.stringify({ imported, totalInSubject, format }), now
    );

    res.json({
      success: true,
      message: `Successfully imported ${imported} questions for "${cleanSubject}".`,
      importedCount: imported,
      totalInSubject,
      subject: cleanSubject
    });
  } catch (err) {
    console.error('Failed to import quiz questions:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/quizzes/bank-summary - Admin summary of questions per subject
app.get('/api/quizzes/bank-summary', (req, res) => {
  try {
    const summary = db.prepare(`
      SELECT subject, COUNT(*) as count, MIN(created_at) as first_added, MAX(created_at) as last_added
      FROM quiz_questions
      GROUP BY subject
      ORDER BY count DESC
    `).all();
    res.json({ success: true, summary });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/quizzes/clear-subject - Admin endpoint to clear questions for a subject
app.post('/api/quizzes/clear-subject', requireAdmin, (req, res) => {
  try {
    const { subject } = req.body || {};
    if (!subject) return res.status(400).json({ success: false, error: 'Subject is required' });
    const cleanSubject = subject.trim();
    db.prepare('DELETE FROM quiz_questions WHERE LOWER(subject) = LOWER(?)').run(cleanSubject);
    db.prepare('DELETE FROM candidate_quiz_history WHERE LOWER(subject) = LOWER(?)').run(cleanSubject);
    res.json({ success: true, message: `Cleared questions for "${cleanSubject}".` });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Pre-seed initial quiz bank with quality questions if empty
function seedQuizQuestionsIfEmpty() {
  try {
    const count = db.prepare('SELECT COUNT(*) as cnt FROM quiz_questions').get().cnt;
    if (count === 0) {
      console.log('Pre-seeding initial daily quiz questions bank...');
      const seedData = [
        // Reasoning
        {
          subject: 'Reasoning Ability',
          question: 'In a certain code, "BANKING" is written as "OBKLMHJ". How is "PO" written in that code?',
          options: ['QP', 'PQ', 'OP', 'QO'],
          correctAnswer: 'A',
          explanation: 'Each letter is shifted by +1.'
        },
        {
          subject: 'Reasoning Ability',
          question: 'Pointing to a photograph, a woman says, "He is the son of the only son of my grandfather." How is the man in photograph related to the woman?',
          options: ['Brother', 'Uncle', 'Cousin', 'Father'],
          correctAnswer: 'A',
          explanation: 'Only son of grandfather = father. Son of father = brother.'
        },
        {
          subject: 'Reasoning Ability',
          question: 'Statements: All cats are dogs. All dogs are birds. Conclusions: I. All cats are birds. II. All birds are cats.',
          options: ['Only I follows', 'Only II follows', 'Either I or II follows', 'Neither I nor II follows'],
          correctAnswer: 'A',
          explanation: 'Since Cats ⊂ Dogs ⊂ Birds, all cats are definitely birds.'
        },
        {
          subject: 'Reasoning Ability',
          question: 'Find the next term in the series: 4, 9, 19, 39, 79, ?',
          options: ['159', '149', '169', '158'],
          correctAnswer: 'A',
          explanation: 'Pattern: x 2 + 1. 79 x 2 + 1 = 159.'
        },
        {
          subject: 'Reasoning Ability',
          question: 'If North becomes South-East, what will West become?',
          options: ['North-East', 'South-West', 'North-West', 'East'],
          correctAnswer: 'A',
          explanation: 'North turns 135 degrees clockwise to become South-East. West turned 135 degrees clockwise becomes North-East.'
        },
        // Quantitative Aptitude
        {
          subject: 'Quantitative Aptitude',
          question: 'A train 180 meters long is running at 54 km/hr. How much time does it take to pass an electric pole?',
          options: ['12 seconds', '10 seconds', '15 seconds', '8 seconds'],
          correctAnswer: 'A',
          explanation: 'Speed = 54 x 5/18 = 15 m/s. Time = Distance / Speed = 180 / 15 = 12 seconds.'
        },
        {
          subject: 'Quantitative Aptitude',
          question: 'What is the compound interest on Rs 8,000 at 5% per annum for 2 years, compounded annually?',
          options: ['Rs 820', 'Rs 800', 'Rs 840', 'Rs 810'],
          correctAnswer: 'A',
          explanation: 'Amount = 8000 x (1.05)^2 = 8000 x 1.1025 = 8820. CI = 8820 - 8000 = 820.'
        },
        {
          subject: 'Quantitative Aptitude',
          question: 'A shopkeeper marks an article 25% above cost price and allows a discount of 10%. Find the profit percentage.',
          options: ['12.5%', '15%', '10%', '14%'],
          correctAnswer: 'A',
          explanation: 'CP = 100, MP = 125, SP = 125 x 0.90 = 112.5. Profit = 12.5%.'
        },
        {
          subject: 'Quantitative Aptitude',
          question: 'The average age of 24 students and their teacher is 15 years. If teacher is excluded, average decreases by 1. What is the teacher age?',
          options: ['39 years', '40 years', '38 years', '42 years'],
          correctAnswer: 'A',
          explanation: 'Total with teacher = 25 x 15 = 375. Total without teacher = 24 x 14 = 336. Teacher age = 375 - 336 = 39 years.'
        },
        {
          subject: 'Quantitative Aptitude',
          question: 'Solve for x: (x / 7) + (x / 5) = 24',
          options: ['70', '65', '75', '80'],
          correctAnswer: 'A',
          explanation: '(5x + 7x) / 35 = 24 => 12x = 24 x 35 => x = 70.'
        },
        // English Language
        {
          subject: 'English Language',
          question: 'Choose the antonym of the word: DILIGENT',
          options: ['Lazy', 'Industrious', 'Clever', 'Honest'],
          correctAnswer: 'A',
          explanation: 'Diligent means hard-working; its exact antonym is lazy.'
        },
        {
          subject: 'English Language',
          question: 'Fill in the blank: Neither the teacher nor the students ____ present yesterday.',
          options: ['were', 'was', 'is', 'are'],
          correctAnswer: 'A',
          explanation: 'When subjects are connected by neither/nor, the verb agrees with the closer subject ("students" -> plural -> "were").'
        },
        {
          subject: 'English Language',
          question: 'Identify the correctly spelt word:',
          options: ['Accommodate', 'Acommodate', 'Accomodate', 'Acomodate'],
          correctAnswer: 'A',
          explanation: 'Accommodate has double "c" and double "m".'
        },
        {
          subject: 'English Language',
          question: 'Select the meaning of the idiom: "To spill the beans"',
          options: ['To reveal a secret prematurely', 'To drop food', 'To be clumsy', 'To cook a meal'],
          correctAnswer: 'A',
          explanation: '"Spill the beans" means to disclose secret information.'
        },
        {
          subject: 'English Language',
          question: 'Spot the error: "He is one of the tallest boy in the classroom."',
          options: ['tallest boy', 'He is', 'one of the', 'in the classroom'],
          correctAnswer: 'A',
          explanation: '"One of the" is always followed by a plural noun ("tallest boys").'
        }
      ];

      const now = new Date().toISOString();
      const insertStmt = db.prepare(`
        INSERT INTO quiz_questions (
          id, subject, question_text, passage_html, image_urls_json,
          options_json, correct_answer, explanation_html, marks, negative_marks, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      seedData.forEach((q, idx) => {
        const opts = q.options.map((opt, oIdx) => ({
          letter: String.fromCharCode(65 + oIdx),
          text: opt,
          html: opt
        }));
        insertStmt.run(
          `seed-q-${idx + 1}`,
          q.subject,
          q.question,
          '',
          '[]',
          JSON.stringify(opts),
          q.correctAnswer,
          q.explanation,
          1.0,
          0.25,
          now
        );
      });
      console.log(`Pre-seeded ${seedData.length} daily quiz questions across Reasoning, Quant, and English.`);
    }
  } catch (e) {
    console.warn('Quiz questions seeding note:', e.message);
  }
}
seedQuizQuestionsIfEmpty();

// ==========================================
// 5. MODEL CONTEXT PROTOCOL (MCP) SERVER
// ==========================================
const { mountMcpRoutes } = require('./mcp-server');
mountMcpRoutes(app, db);

// Fallback to index.html for SPA routing
app.use((req, res) => {
  if (req.method !== 'GET' || req.path.startsWith('/api/') || req.path.startsWith('/scraped/') || path.extname(req.path)) {
    return res.status(404).json({ success: false, error: 'Not found' });
  }
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
}
