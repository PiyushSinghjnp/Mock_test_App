/**
 * Oliveboard Mock Test App - Real Model Context Protocol (MCP) Server
 *
 * Supports:
 * 1. Stdio Transport (`node mcp-server.js` or `npm run mcp`) for Claude Desktop, Cursor, Windsurf, MCP Inspector
 * 2. Streamable HTTP Transport & SSE Transport mounted in Express (`server.js` at `/mcp` and `/mcp/sse`)
 * 3. Direct JSON-RPC 2.0 & REST Introspection for the in-app MCP Inspector Console
 *
 * Backed by the shared Neon PostgreSQL pool and
 * Official Exam Notifications (`data/official_exam_notifications.json`).
 */

const path = require('path');
const fs = require('fs');
require('dotenv').config();
const { getPool, closePool, transaction } = require('./db/postgres');
const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { SSEServerTransport } = require('@modelcontextprotocol/sdk/server/sse.js');
const { StreamableHTTPServerTransport } = require('@modelcontextprotocol/sdk/server/streamableHttp.js');
const { z } = require('zod');

const NOTIFICATIONS_PATH = path.join(__dirname, 'data', 'official_exam_notifications.json');

function pgSql(sql) {
  let index = 0;
  return sql.replace(/\?/g, () => `$${++index}`);
}

function createPgAdapter(client = getPool()) {
  const adapter = {
    query: (sql, values = []) => client.query(pgSql(sql), values),
    prepare(sql) {
      const statement = pgSql(sql);
      return {
        all: async (...values) => (await client.query(statement, values)).rows,
        get: async (...values) => (await client.query(statement, values)).rows[0],
        run: async (...values) => {
          const result = await client.query(statement, values);
          return { changes: result.rowCount, lastInsertRowid: result.rows[0]?.id };
        }
      };
    },
    transaction(work) {
      return transaction(async tx => work(createPgAdapter(tx)));
    }
  };
  return adapter;
}

function getNotificationsData() {
  try {
    if (fs.existsSync(NOTIFICATIONS_PATH)) {
      return JSON.parse(fs.readFileSync(NOTIFICATIONS_PATH, 'utf8'));
    }
  } catch (err) {
    // ignore read error
  }
  return { version: '1.0', exams: {} };
}

/**
 * Strip HTML tags to provide clean text alongside raw HTML for LLM consumption
 */
function stripHtml(html) {
  if (!html) return '';
  return String(html)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim();
}

/**
 * Core MCP Tool Handlers (shared between SDK McpServer and direct JSON-RPC/Inspector)
 */
function createToolHandlers(db) {
  return {
    list_exams: async ({ examId } = {}) => {
      const notif = getNotificationsData();
      const testCounts = await db.prepare(`
        SELECT exam_id, COUNT(*) as count, SUM(questions_count) as total_questions
        FROM tests
        GROUP BY exam_id
      `).all();
      const countMap = {};
      testCounts.forEach(r => {
        countMap[r.exam_id] = { testsInDb: r.count, questionsInDb: r.total_questions };
      });

      const examsObj = notif.exams || {};
      const entries = examId && examsObj[examId]
        ? [[examId, examsObj[examId]]]
        : Object.entries(examsObj);

      const exams = entries.map(([id, info]) => ({
        examId: id,
        examName: info.exam_name,
        authority: info.authority,
        databaseStats: countMap[id] || { testsInDb: 0, questionsInDb: 0 },
        stages: info.stages
      }));

      return {
        totalExams: exams.length,
        source: notif.source || 'Official Exam Notifications',
        exams
      };
    },

    list_mock_tests: async ({ examId, type, userId } = {}) => {
      let query = `
        SELECT id, exam_id, exam_name, type, title, subtitle, marks,
               questions_count, duration_minutes, marks_per_correct,
               negative_marks, is_free, sections_summary_json, created_at
        FROM tests
        WHERE 1=1
      `;
      const params = [];
      if (examId && examId !== 'all') {
        query += ' AND exam_id = ?';
        params.push(examId);
      }
      if (type && type !== 'all') {
        query += ' AND type = ?';
        params.push(type);
      }
      query += ' ORDER BY is_free DESC, id ASC';

      const rows = await db.prepare(query).all(...params);

      let attemptsMap = {};
      if (userId) {
        const attempts = await db.prepare(`
          SELECT id as attempt_id, test_id, score, max_score, accuracy, percentile, estimated_air, completed_at
          FROM test_attempts
          WHERE user_id = ?
          ORDER BY completed_at DESC
        `).all(userId);
        attempts.forEach(a => {
          if (!attemptsMap[a.test_id]) attemptsMap[a.test_id] = a;
        });
      }

      const tests = rows.map(r => ({
        id: r.id,
        examId: r.exam_id,
        examName: r.exam_name,
        type: r.type,
        title: r.title,
        subtitle: r.subtitle,
        marks: r.marks,
        questionsCount: r.questions_count,
        durationMinutes: r.duration_minutes,
        marksPerCorrect: r.marks_per_correct,
        negativeMarks: r.negative_marks,
        isFree: Boolean(r.is_free),
        sectionsSummary: JSON.parse(r.sections_summary_json || '[]'),
        userAttempt: attemptsMap[r.id] || null
      }));

      return { count: tests.length, tests };
    },

    get_test_details: async ({ testId }) => {
      if (!testId) throw new Error('testId is required');
      const row = await db.prepare('SELECT * FROM tests WHERE id = ?').get(testId);
      if (!row) {
        throw new Error(`Test '${testId}' not found in PostgreSQL`);
      }
      const data = JSON.parse(row.test_data_json || '{}');
      const sections = (data.sections || []).map((sec, idx) => ({
        sectionIndex: idx + 1,
        id: sec.id,
        title: sec.title,
        questionCount: sec.questions ? sec.questions.length : (sec.questionCount || 0),
        durationMinutes: sec.durationMinutes || Math.round((sec.durationSeconds || 1200) / 60),
        durationSeconds: sec.durationSeconds || 1200,
        maxMarks: sec.maxMarks || (sec.questions ? sec.questions.length : 0),
        positiveMarks: sec.positiveMarks ?? row.marks_per_correct,
        negativeMarks: sec.negativeMarks ?? row.negative_marks,
        language: sec.language || 'English & Hindi',
        isSectionalLocked: Boolean(sec.isSectionalLocked)
      }));

      return {
        id: row.id,
        examId: row.exam_id,
        examName: row.exam_name,
        type: row.type,
        title: row.title,
        subtitle: row.subtitle,
        marks: row.marks,
        questionsCount: row.questions_count,
        durationMinutes: row.duration_minutes,
        marksPerCorrect: row.marks_per_correct,
        negativeMarks: row.negative_marks,
        hasSectionalTiming: Boolean(data.hasSectionalTiming),
        isSectionalLocked: Boolean(data.isSectionalLocked),
        sections
      };
    },

    get_test_questions: async ({ testId, section, limit = 10, offset = 0, search, includeSolutions = true }) => {
      if (!testId) throw new Error('testId is required');
      const row = await db.prepare('SELECT test_data_json, title FROM tests WHERE id = ?').get(testId);
      if (!row) {
        throw new Error(`Test '${testId}' not found in PostgreSQL`);
      }
      const data = JSON.parse(row.test_data_json || '{}');
      let allQuestions = [];

      (data.sections || []).forEach(sec => {
        if (section && sec.id !== section && !sec.title.toLowerCase().includes(section.toLowerCase())) {
          return;
        }
        (sec.questions || []).forEach(q => {
          allQuestions.push({
            id: q.id,
            questionNumber: q.questionNumber || q.globalIndex,
            sectionId: sec.id,
            sectionTitle: sec.title,
            hasPassage: Boolean(q.hasPassage),
            passageText: stripHtml(q.passageHTML || q.passage_text),
            questionText: stripHtml(q.questionHTML || q.question_text || q.text),
            options: (q.options || []).map((opt, idx) => ({
              index: idx,
              letter: opt.letter || String.fromCharCode(65 + idx),
              text: stripHtml(typeof opt === 'object' ? (opt.text || opt.html) : opt)
            })),
            marksForCorrect: q.marksForCorrect ?? 1.0,
            negativeMarks: q.negativeMarks ?? 0.25,
            ...(includeSolutions ? {
              correctIndex: q.correctIndex,
              correctAnswer: q.correctAnswer || String.fromCharCode(65 + (q.correctIndex ?? 0)),
              explanationText: stripHtml(q.explanationHTML || q.explanation)
            } : {})
          });
        });
      });

      if (search && search.trim()) {
        const qLower = search.trim().toLowerCase();
        allQuestions = allQuestions.filter(q =>
          q.questionText.toLowerCase().includes(qLower) ||
          q.passageText.toLowerCase().includes(qLower) ||
          (q.explanationText && q.explanationText.toLowerCase().includes(qLower))
        );
      }

      const totalMatched = allQuestions.length;
      const safeLimit = Math.min(50, Math.max(1, Number(limit) || 10));
      const safeOffset = Math.max(0, Number(offset) || 0);
      const sliced = allQuestions.slice(safeOffset, safeOffset + safeLimit);

      return {
        testId,
        testTitle: row.title,
        totalMatched,
        offset: safeOffset,
        limit: safeLimit,
        returnedCount: sliced.length,
        questions: sliced
      };
    },

    list_candidates: async () => {
      const users = await db.prepare(`
        SELECT u.id, u.username, u.name, u.email, u.avatar, u.roll_no, u.target_exam, u.created_at,
          u.coins, u.streak_days, u.last_quiz_date,
          (SELECT COUNT(*) FROM test_attempts a WHERE a.user_id = u.id) as attempts_count,
          (SELECT MAX(score) FROM test_attempts a WHERE a.user_id = u.id) as best_score
        FROM users u
        ORDER BY u.created_at ASC
      `).all();

      return {
        totalCandidates: users.length,
        candidates: users
      };
    },

    create_candidate: async ({ name, targetExam = 'ibps-so', rollNo }) => {
      if (!name || !name.trim()) {
        throw new Error('Candidate name is required');
      }
      const id = `user-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      const username = name.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + Math.floor(1000 + Math.random() * 9000);
      const avatar = name.trim().charAt(0).toUpperCase();
      const finalRollNo = rollNo || `OB-2026-${Math.floor(1000 + Math.random() * 9000)}`;
      const createdAt = new Date().toISOString();

      await db.prepare(`
        INSERT INTO users (id, username, name, email, avatar, roll_no, target_exam, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(id, username, name.trim(), `${username}@oliveboard.test`, avatar, finalRollNo, targetExam, createdAt);

      const user = await db.prepare('SELECT id, username, name, email, avatar, roll_no, target_exam, created_at FROM users WHERE id = ?').get(id);
      return {
        created: true,
        candidate: user
      };
    },

    submit_test_attempt: async ({ userId, testId, responses = {}, timeSpentSeconds = 1800, submissionKey }) => {
      if (!userId || !testId) {
        throw new Error('Both userId and testId are required');
      }
      const user = await db.prepare('SELECT id, username, name, email, avatar, roll_no, target_exam, coins, streak_days, last_quiz_date, created_at FROM users WHERE id = ?').get(userId);
      if (!user) {
        throw new Error(`Candidate '${userId}' not found`);
      }
      const testRow = await db.prepare('SELECT * FROM tests WHERE id = ?').get(testId);
      if (!testRow) {
        throw new Error(`Test '${testId}' not found`);
      }

      const testData = JSON.parse(testRow.test_data_json || '{}');
      const allQuestions = [];
      (testData.sections || []).forEach(sec => {
        (sec.questions || []).forEach(q => allQuestions.push({ ...q, sectionTitle: sec.title }));
      });

      let correctCount = 0;
      let wrongCount = 0;
      let unansweredCount = 0;
      let netScore = 0;
      const secMap = {};
      const normalizedResponses = {};

      allQuestions.forEach(q => {
        const secName = q.section || q.sectionTitle || 'General';
        if (!secMap[secName]) {
          secMap[secName] = { sectionName: secName, correct: 0, wrong: 0, unanswered: 0, score: 0, total: 0 };
        }
        secMap[secName].total++;

        const rawResp = responses[q.id] ?? responses[String(q.questionNumber)] ?? null;
        let selectedIdx = null;
        if (rawResp !== null && rawResp !== undefined) {
          if (typeof rawResp === 'number') {
            selectedIdx = rawResp;
          } else if (typeof rawResp === 'string') {
            const upper = rawResp.trim().toUpperCase();
            const letterMap = { A: 0, B: 1, C: 2, D: 3, E: 4 };
            selectedIdx = letterMap[upper] !== undefined ? letterMap[upper] : parseInt(upper, 10);
          } else if (typeof rawResp === 'object' && rawResp.selectedIndex !== undefined) {
            selectedIdx = rawResp.selectedIndex;
          }
        }

        const pos = q.marksForCorrect ?? testRow.marks_per_correct ?? 1.0;
        const neg = q.negativeMarks ?? testRow.negative_marks ?? 0.25;

        if (selectedIdx !== null && !Number.isNaN(selectedIdx) && selectedIdx >= 0) {
          normalizedResponses[q.id] = {
            selectedIndex: selectedIdx,
            status: 'stic-answered',
            timeSpentSeconds: Math.round(timeSpentSeconds / Math.max(1, allQuestions.length))
          };
          if (selectedIdx === q.correctIndex) {
            correctCount++;
            netScore += pos;
            secMap[secName].correct++;
            secMap[secName].score += pos;
          } else {
            wrongCount++;
            netScore -= neg;
            secMap[secName].wrong++;
            secMap[secName].score -= neg;
          }
        } else {
          unansweredCount++;
          secMap[secName].unanswered++;
          normalizedResponses[q.id] = {
            selectedIndex: null,
            status: 'stic-notvisited',
            timeSpentSeconds: 0
          };
        }
      });

      const maxScore = testRow.marks || allQuestions.length;
      const attempted = correctCount + wrongCount;
      const accuracy = attempted > 0 ? Number(((correctCount / attempted) * 100).toFixed(1)) : 0;
      const percentile = Number(Math.min(99.9, Math.max(12.0, (Math.max(0, netScore) / Math.max(1, maxScore)) * 100 * 1.15)).toFixed(1));
      const estimatedAir = Math.max(1, Math.round(1500 - (percentile * 14.5)));

      const sectionBreakdown = Object.values(secMap).map(s => ({
        ...s,
        score: Number(s.score.toFixed(2)),
        accuracy: s.correct + s.wrong > 0 ? ((s.correct / (s.correct + s.wrong)) * 100).toFixed(1) : '0.0'
      }));

      const attemptId = `att-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const idempotencyKey = submissionKey || require('node:crypto').randomUUID();
      const now = new Date().toISOString();

      const savedAttemptId = await db.transaction(async tx => {
        const existing = await tx.prepare('SELECT id FROM test_attempts WHERE user_id = ? AND submission_key = ?').get(userId, idempotencyKey);
        if (existing) return existing.id;
        const inserted = await tx.prepare(`
        INSERT INTO test_attempts (
          id, user_id, test_id, test_title, total_questions,
          score, max_score, correct_count, wrong_count, unanswered_count,
          accuracy, percentile, estimated_air, time_spent_seconds,
          section_breakdown_json, responses_json, started_at, completed_at, submission_key
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT (user_id, submission_key) WHERE submission_key IS NOT NULL DO NOTHING
        RETURNING id
      `).get(
        attemptId,
        userId,
        testId,
        testRow.title,
        allQuestions.length,
        Number(netScore.toFixed(2)),
        maxScore,
        correctCount,
        wrongCount,
        unansweredCount,
        accuracy,
        percentile,
        estimatedAir,
        timeSpentSeconds,
        JSON.stringify(sectionBreakdown),
        JSON.stringify(normalizedResponses),
        now,
        now,
        idempotencyKey
      );
        if (inserted) {
          await tx.prepare('DELETE FROM paused_attempts WHERE user_id = ? AND test_id = ?').run(userId, testId);
          return inserted.id;
        }
        const retry = await tx.prepare('SELECT id FROM test_attempts WHERE user_id = ? AND submission_key = ?').get(userId, idempotencyKey);
        return retry.id;
      });

      return {
        attemptId: savedAttemptId,
        candidate: { id: user.id, name: user.name, rollNo: user.roll_no },
        testId,
        testTitle: testRow.title,
        score: Number(netScore.toFixed(2)),
        maxScore,
        correctCount,
        wrongCount,
        unansweredCount,
        accuracy: `${accuracy}%`,
        percentile: `${percentile}%ile`,
        estimatedAIR: `#${estimatedAir}`,
        sectionBreakdown
      };
    },

    get_candidate_analytics: async ({ userId }) => {
      if (!userId) throw new Error('userId is required');
      const user = await db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
      if (!user) throw new Error(`Candidate '${userId}' not found`);

      const attempts = await db.prepare('SELECT * FROM test_attempts WHERE user_id = ? ORDER BY completed_at DESC').all(userId);
      if (attempts.length === 0) {
        return {
          candidate: user,
          testsAttempted: 0,
          avgScore: 0,
          avgAccuracy: '0.0%',
          overallPercentile: '0.0%ile',
          predictedAIR: '#--',
          sectionBreakdowns: [],
          recentAttempts: []
        };
      }

      const totalTests = attempts.length;
      const avgScore = Number((attempts.reduce((s, a) => s + a.score, 0) / totalTests).toFixed(2));
      const avgAccuracy = Number((attempts.reduce((s, a) => s + a.accuracy, 0) / totalTests).toFixed(1));
      const avgPercentile = Number((attempts.reduce((s, a) => s + a.percentile, 0) / totalTests).toFixed(1));
      const bestAIR = Math.min(...attempts.map(a => a.estimated_air));

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
        const acc = attempted > 0 ? Number(((data.correct / attempted) * 100).toFixed(1)) : 0;
        return {
          sectionName: name,
          correct: data.correct,
          wrong: data.wrong,
          total: data.total,
          accuracy: `${acc}%`,
          status: acc >= 80 ? 'STRONG' : (acc >= 60 ? 'MODERATE' : 'NEEDS_IMPROVEMENT')
        };
      });

      return {
        candidate: user,
        testsAttempted: totalTests,
        avgScore,
        avgAccuracy: `${avgAccuracy}%`,
        overallPercentile: `${avgPercentile}%ile`,
        predictedAIR: `#${bestAIR}`,
        sectionBreakdowns,
        recentAttempts: attempts.slice(0, 10).map(a => ({
          attemptId: a.id,
          testId: a.test_id,
          testTitle: a.test_title,
          score: a.score,
          maxScore: a.max_score,
          accuracy: `${a.accuracy}%`,
          percentile: `${a.percentile}%ile`,
          estimatedAIR: a.estimated_air,
          completedAt: a.completed_at
        }))
      };
    },

    get_attempt_scorecard: async ({ attemptId }) => {
      if (!attemptId) throw new Error('attemptId is required');
      const row = await db.prepare('SELECT * FROM test_attempts WHERE id = ?').get(attemptId);
      if (!row) throw new Error(`Attempt '${attemptId}' not found`);

      const user = await db.prepare('SELECT id, name, roll_no, target_exam FROM users WHERE id = ?').get(row.user_id);
      return {
        attemptId: row.id,
        candidate: user || { id: row.user_id },
        testId: row.test_id,
        testTitle: row.test_title,
        totalQuestions: row.total_questions,
        score: row.score,
        maxScore: row.max_score,
        correctCount: row.correct_count,
        wrongCount: row.wrong_count,
        unansweredCount: row.unanswered_count,
        accuracy: `${row.accuracy}%`,
        percentile: `${row.percentile}%ile`,
        estimatedAIR: row.estimated_air,
        timeSpentSeconds: row.time_spent_seconds,
        sectionBreakdown: JSON.parse(row.section_breakdown_json || '[]'),
        completedAt: row.completed_at
      };
    }
  };
}

/**
 * Tool Definitions Metadata (used for MCP tools/list & UI Inspector)
 */
const MCP_TOOLS_CATALOG = [
  {
    name: 'list_exams',
    description: 'List official Indian competitive exams (IBPS SO IT, SBI PO, IBPS PO, SSC CGL, RBI Grade B, RRB NTPC) with official stage patterns, sectional timings, marking schemes, and PostgreSQL question counts.',
    inputSchema: {
      type: 'object',
      properties: {
        examId: { type: 'string', description: 'Optional exam ID filter (e.g., ibps-so, sbi-po, ssc-cgl, ibps-po, rbi-grade-b, rrb-ntpc)' }
      }
    }
  },
  {
    name: 'list_mock_tests',
    description: 'Query all mock tests stored in the PostgreSQL database with optional filtering by examId, test type, and isolated candidate userId.',
    inputSchema: {
      type: 'object',
      properties: {
        examId: { type: 'string', description: 'Optional exam ID (e.g., ibps-so, sbi-po, all)' },
        type: { type: 'string', description: 'Optional test stage type (prelims, mains, sectional, all)' },
        userId: { type: 'string', description: 'Optional candidate userId to attach isolated attempt status (e.g., user-rahul)' }
      }
    }
  },
  {
    name: 'get_test_details',
    description: 'Get full structural metadata, section-by-section timing, marking rules, and question counts for a specific mock test.',
    inputSchema: {
      type: 'object',
      required: ['testId'],
      properties: {
        testId: { type: 'string', description: 'Test ID (e.g., ibps-so-it-mains-1 or sbi-po-pre-01)' }
      }
    }
  },
  {
    name: 'get_test_questions',
    description: 'Fetch mock test questions, reading passages, options, correct answers, and official step-by-step explanations from PostgreSQL.',
    inputSchema: {
      type: 'object',
      required: ['testId'],
      properties: {
        testId: { type: 'string', description: 'Test ID (e.g., ibps-so-it-mains-1 or sbi-po-pre-01)' },
        section: { type: 'string', description: 'Optional section name or ID filter (e.g., Professional Knowledge, English Language)' },
        limit: { type: 'number', description: 'Max number of questions to return (default 10, max 50)' },
        offset: { type: 'number', description: 'Pagination offset (default 0)' },
        search: { type: 'string', description: 'Optional keyword search across question text, passage, and explanation' },
        includeSolutions: { type: 'boolean', description: 'Whether to include correct answer and explanation (default true)' }
      }
    }
  },
  {
    name: 'list_candidates',
    description: 'List all isolated candidate profiles registered in PostgreSQL with their roll numbers, target exams, and total attempts.',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'create_candidate',
    description: 'Register a new candidate profile in PostgreSQL for isolated mock test attempts and analytics.',
    inputSchema: {
      type: 'object',
      required: ['name'],
      properties: {
        name: { type: 'string', description: 'Full name of the candidate' },
        targetExam: { type: 'string', description: 'Target exam ID (ibps-so, sbi-po, ssc-cgl, ibps-po)' },
        rollNo: { type: 'string', description: 'Optional custom Roll Number (e.g., OB-2026-9901)' }
      }
    }
  },
  {
    name: 'submit_test_attempt',
    description: 'Evaluate and permanently save a candidate mock test attempt in PostgreSQL using official marking (+1.00 / -0.25), calculating sectional breakdown, accuracy, percentile, and All India Rank.',
    inputSchema: {
      type: 'object',
      required: ['userId', 'testId', 'responses'],
      properties: {
        userId: { type: 'string', description: 'Candidate user ID (e.g., user-rahul)' },
        testId: { type: 'string', description: 'Test ID (e.g., ibps-so-it-mains-1 or sbi-po-pre-01)' },
        responses: { type: 'object', description: 'Map of questionId (or questionNumber) to selected option index (0-4) or letter (A-E)' },
        timeSpentSeconds: { type: 'number', description: 'Total time spent in seconds (default 1800)' },
        submissionKey: { type: 'string', description: 'Stable key to make retries idempotent' }
      }
    }
  },
  {
    name: 'get_candidate_analytics',
    description: 'Retrieve isolated AI performance analytics, sectional strength/weakness heatmap, predicted AIR, and attempt history for a candidate.',
    inputSchema: {
      type: 'object',
      required: ['userId'],
      properties: {
        userId: { type: 'string', description: 'Candidate user ID (e.g., user-rahul, user-priya, user-vikram)' }
      }
    }
  },
  {
    name: 'get_attempt_scorecard',
    description: 'Retrieve the detailed scorecard and sectional cutoff analysis for a specific test attempt ID.',
    inputSchema: {
      type: 'object',
      required: ['attemptId'],
      properties: {
        attemptId: { type: 'string', description: 'Unique attempt ID from PostgreSQL' }
      }
    }
  }
];

const MCP_RESOURCES_CATALOG = [
  {
    uri: 'oliveboard://exams/notifications',
    name: 'Official Exam Notifications & Timings',
    description: 'Complete official notification specifications for SBI PO, IBPS SO IT, IBPS PO, SSC CGL, RBI Grade B, and RRB NTPC.',
    mimeType: 'application/json'
  },
  {
    uri: 'oliveboard://tests/catalog',
    name: 'PostgreSQL Mock Test Catalog',
    description: 'Live catalog of all seeded mock tests, question counts, marking schemes, and sectional summaries in PostgreSQL.',
    mimeType: 'application/json'
  },
  {
    uri: 'oliveboard://candidates/profiles',
    name: 'Registered Candidate Profiles',
    description: 'All multi-user isolated candidate profiles and their attempt counts stored in PostgreSQL.',
    mimeType: 'application/json'
  },
  {
    uri: 'oliveboard://database/schema',
    name: 'PostgreSQL Database Schema & Telemetry',
    description: 'Table definitions and live row counts for users, tests, and test_attempts.',
    mimeType: 'application/json'
  }
];

const MCP_PROMPTS_CATALOG = [
  {
    name: 'analyze_candidate_weaknesses',
    description: 'Generate a personalized exam study plan and weakness remediation strategy from a candidate\'s PostgreSQL analytics.',
    arguments: [
      { name: 'userId', description: 'Candidate user ID (e.g., user-rahul)', required: true }
    ]
  },
  {
    name: 'explain_exam_question',
    description: 'Fetch a specific question from a mock test and prompt an expert tutor walkthrough with shortcut tricks.',
    arguments: [
      { name: 'testId', description: 'Test ID (e.g., ibps-so-it-mains-1)', required: true },
      { name: 'questionNumber', description: 'Question number (1-150)', required: true }
    ]
  }
];

/**
 * Read an MCP Resource by URI
 */
async function readMcpResource(db, uri) {
  if (uri === 'oliveboard://exams/notifications') {
    return getNotificationsData();
  }
  if (uri === 'oliveboard://tests/catalog') {
    const tests = await db.prepare(`
      SELECT id, exam_id, exam_name, type, title, subtitle, marks, questions_count, duration_minutes, marks_per_correct, negative_marks, is_free, sections_summary_json
      FROM tests ORDER BY id ASC
    `).all();
    return { tests };
  }
  if (uri === 'oliveboard://candidates/profiles') {
    const users = await db.prepare(`
      SELECT u.id, u.username, u.name, u.email, u.avatar, u.roll_no, u.target_exam, u.created_at,
        u.coins, u.streak_days, u.last_quiz_date,
        (SELECT COUNT(*) FROM test_attempts a WHERE a.user_id = u.id) as attempts_count
      FROM users u ORDER BY u.created_at ASC
    `).all();
    return { users };
  }
  if (uri === 'oliveboard://database/schema') {
    const usersCount = (await db.prepare('SELECT COUNT(*) as c FROM users').get()).c;
    const testsCount = (await db.prepare('SELECT COUNT(*) as c FROM tests').get()).c;
    const attemptsCount = (await db.prepare('SELECT COUNT(*) as c FROM test_attempts').get()).c;
    return {
      engine: 'PostgreSQL (Neon)',
      counts: { users: usersCount, tests: testsCount, test_attempts: attemptsCount },
      tables: ['users', 'tests', 'test_attempts', 'paused_attempts', 'quiz_questions', 'candidate_quiz_history']
    };
  }
  throw new Error(`Unknown MCP resource URI: ${uri}`);
}

/**
 * Resolve an MCP Prompt by name
 */
async function getMcpPrompt(db, name, args = {}) {
  const handlers = createToolHandlers(db);
  if (name === 'analyze_candidate_weaknesses') {
    const userId = args.userId || 'user-rahul';
    const analytics = await handlers.get_candidate_analytics({ userId });
    return {
      description: `Personalized performance diagnosis for ${analytics.candidate.name}`,
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
      text: `You are an expert Banking & Government Exam Mentor. Analyze the following PostgreSQL performance telemetry for candidate ${analytics.candidate.name} (Roll No: ${analytics.candidate.roll_no}, Target Exam: ${analytics.candidate.target_exam}) and provide a concrete 7-day sectional improvement plan:\n\n${JSON.stringify(analytics, null, 2)}`
          }
        }
      ]
    };
  }
  if (name === 'explain_exam_question') {
    const testId = args.testId || 'ibps-so-it-mains-1';
    const qNum = Math.max(1, parseInt(args.questionNumber || '1', 10));
    const qData = await handlers.get_test_questions({
      testId,
      limit: 1,
      offset: qNum - 1,
      includeSolutions: true
    });
    const question = qData.questions[0] || null;
    return {
      description: `Expert walkthrough for ${testId} Question #${qNum}`,
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: `Explain the following exam question step-by-step, including why the correct option is right, why each distractor is wrong, and the fastest exam-hall shortcut to solve it under 45 seconds:\n\n${JSON.stringify(question, null, 2)}`
          }
        }
      ]
    };
  }
  throw new Error(`Unknown MCP prompt: ${name}`);
}

/**
 * Build an official @modelcontextprotocol/sdk McpServer instance wired to PostgreSQL
 */
function createOliveboardMcpServer(db) {
  const server = new McpServer({
    name: 'oliveboard-mock-test-mcp',
    version: '1.0.0'
  });

  const handlers = createToolHandlers(db);

  // Register Tools
  server.tool(
    'list_exams',
    'List official Indian competitive exams with stage patterns, sectional timings, marking schemes, and PostgreSQL question counts.',
    { examId: z.string().optional() },
    async (args) => ({
      content: [{ type: 'text', text: JSON.stringify(await handlers.list_exams(args), null, 2) }]
    })
  );

  server.tool(
    'list_mock_tests',
    'Query all mock tests stored in PostgreSQL with optional filtering by examId, test type, and isolated candidate userId.',
    {
      examId: z.string().optional(),
      type: z.string().optional(),
      userId: z.string().optional()
    },
    async (args) => ({
      content: [{ type: 'text', text: JSON.stringify(await handlers.list_mock_tests(args), null, 2) }]
    })
  );

  server.tool(
    'get_test_details',
    'Get full structural metadata, section-by-section timing, marking rules, and question counts for a specific mock test.',
    { testId: z.string() },
    async (args) => ({
      content: [{ type: 'text', text: JSON.stringify(await handlers.get_test_details(args), null, 2) }]
    })
  );

  server.tool(
    'get_test_questions',
    'Fetch mock test questions, reading passages, options, correct answers, and official explanations from PostgreSQL.',
    {
      testId: z.string(),
      section: z.string().optional(),
      limit: z.number().optional(),
      offset: z.number().optional(),
      search: z.string().optional(),
      includeSolutions: z.boolean().optional()
    },
    async (args) => ({
      content: [{ type: 'text', text: JSON.stringify(await handlers.get_test_questions(args), null, 2) }]
    })
  );

  server.tool(
    'list_candidates',
    'List all isolated candidate profiles registered in PostgreSQL with their roll numbers, target exams, and total attempts.',
    {},
    async () => ({
      content: [{ type: 'text', text: JSON.stringify(await handlers.list_candidates(), null, 2) }]
    })
  );

  server.tool(
    'create_candidate',
    'Register a new candidate profile in PostgreSQL for isolated mock test attempts and analytics.',
    {
      name: z.string(),
      targetExam: z.string().optional(),
      rollNo: z.string().optional()
    },
    async (args) => ({
      content: [{ type: 'text', text: JSON.stringify(await handlers.create_candidate(args), null, 2) }]
    })
  );

  server.tool(
    'submit_test_attempt',
    'Evaluate and permanently save a candidate mock test attempt in PostgreSQL using official marking (+1.00 / -0.25).',
    {
      userId: z.string(),
      testId: z.string(),
      responses: z.record(z.string(), z.any()),
      timeSpentSeconds: z.number().optional(),
      submissionKey: z.string().optional()
    },
    async (args) => ({
      content: [{ type: 'text', text: JSON.stringify(await handlers.submit_test_attempt(args), null, 2) }]
    })
  );

  server.tool(
    'get_candidate_analytics',
    'Retrieve isolated performance analytics, sectional strength/weakness breakdown, predicted AIR, and attempt history for a candidate.',
    { userId: z.string() },
    async (args) => ({
      content: [{ type: 'text', text: JSON.stringify(await handlers.get_candidate_analytics(args), null, 2) }]
    })
  );

  server.tool(
    'get_attempt_scorecard',
    'Retrieve the detailed scorecard and sectional cutoff analysis for a specific test attempt ID.',
    { attemptId: z.string() },
    async (args) => ({
      content: [{ type: 'text', text: JSON.stringify(await handlers.get_attempt_scorecard(args), null, 2) }]
    })
  );

  // Register Resources
  MCP_RESOURCES_CATALOG.forEach(resMeta => {
    server.resource(
      resMeta.name,
      resMeta.uri,
      { description: resMeta.description, mimeType: resMeta.mimeType },
      async (uri) => ({
        contents: [{
          uri: uri.href,
          mimeType: resMeta.mimeType,
          text: JSON.stringify(await readMcpResource(db, resMeta.uri), null, 2)
        }]
      })
    );
  });

  // Register Prompts
  server.prompt(
    'analyze_candidate_weaknesses',
    'Generate a personalized exam study plan from a candidate\'s PostgreSQL analytics.',
    { userId: z.string() },
    async (args) => getMcpPrompt(db, 'analyze_candidate_weaknesses', args)
  );

  server.prompt(
    'explain_exam_question',
    'Fetch a specific question from a mock test and prompt an expert tutor walkthrough.',
    { testId: z.string(), questionNumber: z.string() },
    async (args) => getMcpPrompt(db, 'explain_exam_question', args)
  );

  return server;
}

/**
 * Handle standard MCP JSON-RPC 2.0 requests over HTTP POST (/mcp)
 */
async function handleMcpJsonRpc(db, body) {
  const { jsonrpc = '2.0', id = null, method, params = {} } = body || {};
  const handlers = createToolHandlers(db);

  try {
    switch (method) {
      case 'initialize':
        return {
          jsonrpc,
          id,
          result: {
            protocolVersion: '2024-11-05',
            capabilities: {
              tools: { listChanged: false },
              resources: { subscribe: false, listChanged: false },
              prompts: { listChanged: false }
            },
            serverInfo: {
              name: 'oliveboard-mock-test-mcp',
              version: '1.0.0'
            }
          }
        };

      case 'notifications/initialized':
      case 'ping':
        return { jsonrpc, id, result: {} };

      case 'tools/list':
        return {
          jsonrpc,
          id,
          result: { tools: MCP_TOOLS_CATALOG }
        };

      case 'tools/call': {
        const toolName = params.name;
        const toolArgs = params.arguments || {};
        if (!handlers[toolName]) {
          throw new Error(`Unknown MCP tool: ${toolName}`);
        }
        const output = await handlers[toolName](toolArgs);
        return {
          jsonrpc,
          id,
          result: {
            content: [{ type: 'text', text: JSON.stringify(output, null, 2) }],
            structuredContent: output,
            isError: false
          }
        };
      }

      case 'resources/list':
        return {
          jsonrpc,
          id,
          result: { resources: MCP_RESOURCES_CATALOG }
        };

      case 'resources/read': {
        const data = await readMcpResource(db, params.uri);
        return {
          jsonrpc,
          id,
          result: {
            contents: [{
              uri: params.uri,
              mimeType: 'application/json',
              text: JSON.stringify(data, null, 2)
            }]
          }
        };
      }

      case 'prompts/list':
        return {
          jsonrpc,
          id,
          result: { prompts: MCP_PROMPTS_CATALOG }
        };

      case 'prompts/get': {
        const promptResult = await getMcpPrompt(db, params.name, params.arguments || {});
        return {
          jsonrpc,
          id,
          result: promptResult
        };
      }

      default:
        return {
          jsonrpc,
          id,
          error: {
            code: -32601,
            message: `Method not found: ${method}`
          }
        };
    }
  } catch (err) {
    return {
      jsonrpc,
      id,
      error: {
        code: -32000,
        message: err.message || 'MCP execution error'
      }
    };
  }
}

/**
 * Mount MCP endpoints onto the Express app (`/mcp`, `/mcp/sse`, `/mcp/messages`, `/api/mcp/*`)
 */
function mountMcpRoutes(app, db) {
  // The HTTP/SSE MCP surface has no candidate-bound auth contract today. Keep it
  // completely absent in production until that contract is implemented.
  if (process.env.NODE_ENV === 'production') return;
  const activeSseTransports = new Map();
  const pgDb = createPgAdapter();

  // 1. MCP Server Discovery & Manifest Endpoint
  app.get('/api/mcp/manifest', async (req, res) => {
    const schemaInfo = await readMcpResource(pgDb, 'oliveboard://database/schema');
    res.json({
      success: true,
      server: {
        name: 'oliveboard-mock-test-mcp',
        version: '1.0.0',
        protocolVersion: '2024-11-05',
        transports: {
          httpJsonRpc: '/mcp',
          sseEndpoint: '/mcp/sse',
          sseMessages: '/mcp/messages',
          stdioCommand: 'node mcp-server.js'
        },
        database: schemaInfo
      },
      tools: MCP_TOOLS_CATALOG,
      resources: MCP_RESOURCES_CATALOG,
      prompts: MCP_PROMPTS_CATALOG
    });
  });

  // 2. JSON-RPC 2.0 HTTP Endpoint (`/mcp`)
  app.post('/mcp', async (req, res) => {
    try {
      if (Array.isArray(req.body)) {
        const results = await Promise.all(req.body.map(item => handleMcpJsonRpc(pgDb, item)));
        return res.json(results);
      }
      const response = await handleMcpJsonRpc(pgDb, req.body);
      res.json(response);
    } catch (err) {
      res.status(500).json({
        jsonrpc: '2.0',
        id: null,
        error: { code: -32603, message: err.message }
      });
    }
  });

  app.get('/mcp', (req, res) => {
    res.json({
      name: 'oliveboard-mock-test-mcp',
      version: '1.0.0',
      protocol: 'Model Context Protocol (MCP)',
      endpoints: {
        jsonrpcPost: 'POST /mcp',
        sseStream: 'GET /mcp/sse',
        sseMessages: 'POST /mcp/messages',
        manifest: 'GET /api/mcp/manifest'
      },
      toolsCount: MCP_TOOLS_CATALOG.length,
      resourcesCount: MCP_RESOURCES_CATALOG.length,
      promptsCount: MCP_PROMPTS_CATALOG.length
    });
  });

  // 3. Official MCP SDK SSE Transport (`/mcp/sse` + `/mcp/messages`)
  app.get('/mcp/sse', async (req, res) => {
    try {
      const mcpServer = createOliveboardMcpServer(pgDb);
      const transport = new SSEServerTransport('/mcp/messages', res);
      activeSseTransports.set(transport.sessionId, { transport, mcpServer });

      res.on('close', () => {
        activeSseTransports.delete(transport.sessionId);
      });

      await mcpServer.connect(transport);
    } catch (err) {
      console.error('MCP SSE error:', err);
      if (!res.headersSent) {
        res.status(500).json({ error: err.message });
      }
    }
  });

  app.post('/mcp/messages', async (req, res) => {
    try {
      const sessionId = req.query.sessionId;
      const session = activeSseTransports.get(sessionId);
      if (!session) {
        return res.status(404).json({ error: 'Unknown or expired MCP SSE sessionId' });
      }
      await session.transport.handlePostMessage(req, res, req.body);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
}

// If executed directly via CLI (`node mcp-server.js`), start StdioServerTransport
if (require.main === module) {
  if (process.env.NODE_ENV === 'production') {
    console.error('MCP stdio mode is disabled in production.');
    process.exit(1);
  }
  const server = createOliveboardMcpServer(createPgAdapter());
  const transport = new StdioServerTransport();
  server.connect(transport).catch(err => {
    console.error('Failed to start Oliveboard MCP Stdio Server:', err.code || 'connection error');
    process.exit(1);
  });
  process.once('SIGINT', () => closePool().finally(() => process.exit(0)));
  process.once('SIGTERM', () => closePool().finally(() => process.exit(0)));
}

module.exports = {
  createOliveboardMcpServer,
  createToolHandlers,
  handleMcpJsonRpc,
  mountMcpRoutes,
  MCP_TOOLS_CATALOG,
  MCP_RESOURCES_CATALOG,
  MCP_PROMPTS_CATALOG,
  createPgAdapter,
  pgSql
};
