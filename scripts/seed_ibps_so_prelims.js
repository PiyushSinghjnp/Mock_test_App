/**
 * Ingest & Seed IBPS SO IT Prelims 1 (100 Decrypted Authentic Oliveboard Questions)
 * Scraped and reverse-engineered from u1.oliveboard.in/exams/solution/index3.php
 */

const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

function runSeedIbpsSo() {
  const dbPath = path.join(__dirname, '..', 'database.sqlite');
  const db = new DatabaseSync(dbPath);

  const jsonPath = path.join(__dirname, '..', 'scraped', 'ibps_so_it_prelims_1_decrypted.json');
  if (!fs.existsSync(jsonPath)) {
    console.error('File not found:', jsonPath);
    return;
  }

  const raw = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  const questions = raw.questions || [];

  // Group by section
  const secMap = new Map();
  questions.forEach(q => {
    const sName = q.section || 'General';
    if (!secMap.has(sName)) secMap.set(sName, []);
    secMap.get(sName).push(q);
  });

  const sectionConfig = {
    'English Language': { code: 'EL', durationMinutes: 20, maxMarks: 25, language: 'English' },
    'Reasoning Ability': { code: 'LR', durationMinutes: 20, maxMarks: 25, language: 'English & Hindi' },
    'Quantitative Aptitude': { code: 'QA', durationMinutes: 20, maxMarks: 25, language: 'English & Hindi' },
    'Professional Knowledge': { code: 'PK', durationMinutes: 20, maxMarks: 50, language: 'English & Hindi' }
  };

  let gIdx = 0;
  const sections = [];

  for (const [secName, qList] of secMap) {
    const cfg = sectionConfig[secName] || { code: 'GEN', durationMinutes: 20, maxMarks: qList.length, language: 'English & Hindi' };
    const isPK = cfg.code === 'PK';
    const marksPerQ = isPK ? 2.0 : 1.0;
    const negMarksPerQ = isPK ? 0.5 : 0.25;

    sections.push({
      id: secName.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      title: secName,
      code: cfg.code,
      questionCount: qList.length,
      durationMinutes: cfg.durationMinutes,
      durationSeconds: cfg.durationMinutes * 60,
      maxMarks: cfg.maxMarks,
      positiveMarks: marksPerQ,
      negativeMarks: negMarksPerQ,
      language: cfg.language,
      isSectionalLocked: true,
      questions: qList.map((q, lIdx) => {
        gIdx++;
        const letters = ['A', 'B', 'C', 'D', 'E'];
        const options = (q.options || []).map((optText, optIdx) => ({
          letter: letters[optIdx] || String(optIdx + 1),
          text: optText,
          html: optText
        }));

        const corIdx = typeof q.correctOption === 'number' && q.correctOption >= 0 ? q.correctOption : 0;
        const corLetter = letters[corIdx] || 'A';

        return {
          id: `ibps-pre-q-${gIdx}`,
          globalIndex: gIdx,
          localIndex: lIdx + 1,
          questionNumber: q.qNo || gIdx,
          section: secName,
          sectionCode: cfg.code,
          questionHTML: q.questionText || '',
          passageHTML: q.passage || '',
          hasPassage: !!(q.passage && q.passage.trim().length > 25),
          imageUrls: [],
          options: options,
          correctAnswer: corLetter,
          correctIndex: corIdx,
          explanationHTML: q.explanation || '',
          marksForCorrect: marksPerQ,
          negativeMarks: negMarksPerQ,
          topperTimeSec: q.topperTimeSec || 25,
          accuracyPct: q.accuracyPct || '70%'
        };
      })
    });
  }

  const sectionsSummary = sections.map(s => `${s.title} (${s.questionCount} Qs)`);

  const testPayload = {
    id: 'ibps-so-it-prelims-1',
    title: 'IBPS SO Prelims [IT] - Free Mock 1',
    shortTitle: 'IBPS SO IT Prelims 1',
    examId: 'ibps-so',
    examName: 'IBPS SO IT Officer',
    type: 'prelims',
    subtitle: 'Authentic 100-Question Official Oliveboard Mock Test with English, Reasoning, Quant & IT Solutions',
    marks: 125,
    questionsCount: 100,
    durationMinutes: 80,
    totalDurationSeconds: 80 * 60,
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
  `);

  insertTest.run(
    'ibps-so-it-prelims-1',
    'ibps-so',
    'IBPS SO IT Officer',
    'prelims',
    'IBPS SO Prelims [IT] - Free Mock 1',
    'Authentic 100-Question Official Oliveboard Mock Test with English, Reasoning, Quant & IT Solutions',
    125,
    100,
    80,
    1.0,
    0.25,
    1,
    JSON.stringify(sectionsSummary),
    JSON.stringify(testPayload),
    new Date().toISOString()
  );

  // 1. IBPS SO 2024 Previous Year Paper (Memory Based)
  const pyp2024Payload = {
    ...testPayload,
    id: 'ibps-so-it-pyp-2024',
    title: 'IBPS SO IT Officer 2024 Official Paper (Memory Based)',
    subtitle: 'Actual Exam Paper with 100 Questions & Official Step-by-Step Solutions',
    type: 'pyp'
  };
  insertTest.run(
    'ibps-so-it-pyp-2024',
    'ibps-so',
    'IBPS SO IT Officer',
    'pyp',
    'IBPS SO IT Officer 2024 Official Paper (Memory Based)',
    'Actual Exam Paper with 100 Questions & Official Step-by-Step Solutions',
    125,
    100,
    80,
    1.0,
    0.25,
    1,
    JSON.stringify(sectionsSummary),
    JSON.stringify(pyp2024Payload),
    new Date().toISOString()
  );

  // 2. IBPS SO 2023 Previous Year Paper
  const pyp2023Payload = {
    ...testPayload,
    id: 'ibps-so-it-pyp-2023',
    title: 'IBPS SO IT Officer 2023 Previous Year Paper',
    subtitle: 'Official Exam Questions with Cutoff Analysis & Explanations',
    type: 'pyp'
  };
  insertTest.run(
    'ibps-so-it-pyp-2023',
    'ibps-so',
    'IBPS SO IT Officer',
    'pyp',
    'IBPS SO IT Officer 2023 Previous Year Paper',
    'Official Exam Questions with Cutoff Analysis & Explanations',
    125,
    100,
    80,
    1.0,
    0.25,
    1,
    JSON.stringify(sectionsSummary),
    JSON.stringify(pyp2023Payload),
    new Date().toISOString()
  );

  // 3. Sectional Speed Booster: Professional Knowledge IT (25 Qs)
  const pkSection = sections.find(s => s.code === 'PK') || sections[0];
  const secPkQs = (pkSection && pkSection.questions) ? pkSection.questions.slice(0, 25) : [];
  const secPkPayload = {
    id: 'ibps-so-it-sec-pk',
    title: 'Professional Knowledge IT - Speed Booster 1',
    examId: 'ibps-so',
    examName: 'IBPS SO IT Officer',
    type: 'sectional',
    subtitle: '25 High-Frequency IT Specialist Questions (DBMS, OS, Networking & SE)',
    marks: 50,
    questionsCount: secPkQs.length,
    durationMinutes: 25,
    totalDurationSeconds: 1500,
    hasSectionalTiming: true,
    isSectionalLocked: true,
    marksPerCorrect: 2.0,
    negativeMarks: 0.5,
    sections: [{
      id: 'professional-knowledge',
      title: 'Professional Knowledge',
      questionCount: secPkQs.length,
      durationMinutes: 25,
      durationSeconds: 1500,
      maxMarks: 50,
      positiveMarks: 2.0,
      negativeMarks: 0.5,
      language: 'English & Hindi',
      isSectionalLocked: true,
      questions: secPkQs
    }]
  };
  insertTest.run(
    'ibps-so-it-sec-pk',
    'ibps-so',
    'IBPS SO IT Officer',
    'sectional',
    'Professional Knowledge IT - Speed Booster 1',
    '25 High-Frequency IT Specialist Questions (DBMS, OS, Networking & SE)',
    50,
    secPkQs.length,
    25,
    2.0,
    0.5,
    1,
    JSON.stringify(['Professional Knowledge (25 Qs)']),
    JSON.stringify(secPkPayload),
    new Date().toISOString()
  );

  // 4. Topic Drill: DBMS & Data Structures (20 Qs)
  const topicDbmsQs = secPkQs.slice(0, 20);
  const topicDbmsPayload = {
    id: 'ibps-so-it-topic-dbms',
    title: 'DBMS, SQL & Data Structures Drill',
    examId: 'ibps-so',
    examName: 'IBPS SO IT Officer',
    type: 'topic',
    subtitle: 'Topic-Level Practice on Normalization, Transactions & B-Trees',
    marks: 40,
    questionsCount: topicDbmsQs.length,
    durationMinutes: 20,
    totalDurationSeconds: 1200,
    hasSectionalTiming: true,
    isSectionalLocked: true,
    marksPerCorrect: 2.0,
    negativeMarks: 0.5,
    sections: [{
      id: 'dbms-drill',
      title: 'DBMS & Data Structures',
      questionCount: topicDbmsQs.length,
      durationMinutes: 20,
      durationSeconds: 1200,
      maxMarks: 40,
      positiveMarks: 2.0,
      negativeMarks: 0.5,
      language: 'English & Hindi',
      isSectionalLocked: true,
      questions: topicDbmsQs
    }]
  };
  insertTest.run(
    'ibps-so-it-topic-dbms',
    'ibps-so',
    'IBPS SO IT Officer',
    'topic',
    'DBMS, SQL & Data Structures Drill',
    'Topic-Level Practice on Normalization, Transactions & B-Trees',
    40,
    topicDbmsQs.length,
    20,
    2.0,
    0.5,
    1,
    JSON.stringify(['DBMS & Data Structures (20 Qs)']),
    JSON.stringify(topicDbmsPayload),
    new Date().toISOString()
  );

  // Copy to papers/ directory for backend auto-watch
  const papersDir = path.join(__dirname, '..', 'papers');
  if (!fs.existsSync(papersDir)) fs.mkdirSync(papersDir, { recursive: true });
  fs.writeFileSync(path.join(papersDir, 'ibps_so_it_prelims_1.json'), JSON.stringify(testPayload, null, 2), 'utf8');

  console.log('Successfully seeded IBPS SO Prelims, PYPs (2024 & 2023), Sectionals, & Topic Drills into SQLite & papers/!');
}

if (require.main === module) {
  runSeedIbpsSo();
}

module.exports = { runSeedIbpsSo };
