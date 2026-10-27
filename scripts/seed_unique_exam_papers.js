/**
 * seed_unique_exam_papers.js
 * Comprehensive Oliveboard Exam Question Bank & Seeder
 *
 * Ensures that EVERY test in the Oliveboard app:
 * 1. Has its OWN unique, realistic, authentic question set matching its exam syllabus and format.
 * 2. No two tests ever share the identical Q1 or clone of questions.
 * 3. Populates all test IDs defined in js/data.js in SQLite database.sqlite.
 * 4. Generates scraped/sbi_po_prelims_2_full.json, scraped/sbi_po_prelims_3_full.json,
 *    and scraped/sbi_po_prelims_4_full.json so Live Browser proxy serves distinct questions for testid=1..4.
 */

const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const DB_PATH = path.join(__dirname, '..', 'database.sqlite');
const SCRAPED_DIR = path.join(__dirname, '..', 'scraped');
const PAPERS_DIR = path.join(__dirname, '..', 'papers');

if (!fs.existsSync(SCRAPED_DIR)) fs.mkdirSync(SCRAPED_DIR, { recursive: true });
if (!fs.existsSync(PAPERS_DIR)) fs.mkdirSync(PAPERS_DIR, { recursive: true });

const { createQuestion, createSection, createTestPayload } = require('./question_builder');

// Flatten sections into a 1D questions array for scraped/*.json format
function flattenQuestions(sections) {
  const allQs = [];
  sections.forEach(s => {
    (s.questions || []).forEach(q => {
      allQs.push({
        ...q,
        section: s.title
      });
    });
  });
  return allQs;
}

// Main seeder function
function runUniqueExamSeeder() {
  const db = new DatabaseSync(DB_PATH);
  const now = new Date().toISOString();

  // Import paper generators
  const banking = require('./question_banks/banking_papers');
  const ssc = require('./question_banks/ssc_cgl_papers');
  const rbi = require('./question_banks/rbi_grade_b_papers');
  const rrb = require('./question_banks/rrb_ntpc_papers');
  const ibpsSo = require('./question_banks/ibps_so_papers');

  console.log('--- Generating Unique, Authentic Question Papers for all Exams ---');

  const testsToUpsert = [
    // 1. SBI PO Prelims 2, 3, 4, PYP, Mains 1, 2, Sectionals & Topic Drills
    banking.buildSbiPoPrelims2(),
    banking.buildSbiPoPrelims3(),
    banking.buildSbiPoPrelims4(),
    banking.buildSbiPoPyp2024(),
    banking.buildSbiPoMains1(),
    banking.buildSbiPoMains2(),
    banking.buildSbiSectionalEnglish(),
    banking.buildSbiSectionalQuant(),
    banking.buildSbiSectionalReasoning(),
    banking.buildSbiTopicDi(),
    banking.buildSbiTopicPuzzles(),

    // 2. IBPS PO Prelims 1, Mains 1, Sectional DI, PYP 2024
    banking.buildIbpsPoPrelims1(),
    banking.buildIbpsPoMains1(),
    banking.buildIbpsPoPyp2024(),
    banking.buildIbpsPoSecDi(),

    // 3. SSC CGL Tier 1 (Mock 1, 2, 3), Mains 1, Sectional, PYP 2024
    ssc.buildSscCglTier1({
      id: 'ssc-cgl-pre-01',
      title: 'SSC CGL 2026 Tier 1 - Live Mock 1',
      subtitle: 'Official TCS Pattern with All India Live Ranks & Percentiles',
      seedOffset: 1
    }),
    ssc.buildSscCglTier1({
      id: 'ssc-cgl-pre-02',
      title: 'SSC CGL 2026 Tier 1 - Mock 2',
      subtitle: 'High Yield Questions on Advanced Math, History & Static GK',
      seedOffset: 2
    }),
    ssc.buildSscCglTier1({
      id: 'ssc-cgl-pre-03',
      title: 'SSC CGL 2026 Tier 1 - Mock 3',
      subtitle: 'Speed and Accuracy Calibration with Detailed Video Solutions',
      seedOffset: 3
    }),
    ssc.buildSscCglTier1({
      id: 'ssc-cgl-pyp-2024',
      title: 'SSC CGL Tier 1 2024 Official Shift 1 Paper',
      subtitle: 'Actual Exam Paper conducted in Sept 2024 with Official Answer Keys',
      seedOffset: 4,
      isPyp: true
    }),
    ssc.buildSscCglMains1(),
    ssc.buildSscCglSecReasoning(),

    // 4. RBI Grade B Phase 1, Phase 2, PYP 2024
    rbi.buildRbiPhase1({
      id: 'rbi-phase1-01',
      title: 'RBI Grade B 2026 Phase 1 - Live Mock 1',
      subtitle: '80 General Awareness Questions including Current Economic & Financial News',
      seedOffset: 1
    }),
    rbi.buildRbiPhase1({
      id: 'rbi-pyp-2024',
      title: 'RBI Grade B Phase 1 2024 (Memory Paper)',
      subtitle: 'Real Examination Questions Analyzed by Former RBI Officers',
      seedOffset: 2,
      isPyp: true
    }),
    rbi.buildRbiPhase2Esi(),

    // 5. RRB NTPC CBT 1, CBT 2, Sectional GA, PYP 2022
    rrb.buildRrbNtpcCbt1({
      id: 'rrb-ntpc-cbt1-01',
      title: 'RRB NTPC CBT 1 - All India Live Mock 1',
      subtitle: 'Railways Non-Technical Popular Categories Full 100 Question Paper',
      seedOffset: 1
    }),
    rrb.buildRrbNtpcCbt1({
      id: 'rrb-ntpc-pyp-2022',
      title: 'RRB NTPC CBT 1 Official Previous Year Paper',
      subtitle: 'Conducting Agency Shift Paper with Detailed Question Solutions',
      seedOffset: 2,
      isPyp: true
    }),
    rrb.buildRrbNtpcCbt2(),
    rrb.buildRrbNtpcSecGa(),

    // 6. IBPS SO IT PYP 2024, PYP 2023, Sectional PK, DBMS Drills
    ibpsSo.buildIbpsSoPyp2024(),
    ibpsSo.buildIbpsSoPyp2023(),
    ibpsSo.buildIbpsSoSecPk(),
    ibpsSo.buildIbpsSoTopicDbms(),
    ibpsSo.buildIbpsSoTopicDbmsSpecialist()
  ];

  const upsertStmt = db.prepare(`
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
      is_free = excluded.is_free,
      sections_summary_json = excluded.sections_summary_json,
      test_data_json = excluded.test_data_json
  `);

  let count = 0;
  testsToUpsert.forEach(testPayload => {
    const sectionsSummary = (testPayload.sections || []).map(s => `${s.title} (${s.questions.length} Qs)`);
    upsertStmt.run(
      testPayload.id,
      testPayload.examId,
      testPayload.examName,
      testPayload.type,
      testPayload.title,
      testPayload.subtitle,
      testPayload.marks,
      testPayload.questionsCount,
      testPayload.durationMinutes,
      testPayload.marksPerCorrect,
      testPayload.negativeMarks,
      testPayload.isFree,
      JSON.stringify(sectionsSummary),
      JSON.stringify(testPayload),
      now
    );
    count++;
  });

  console.log(`Successfully seeded/updated ${count} unique exam papers into SQLite database!`);

  // Write dedicated scraped files for Live Oliveboard Browser Proxy (testid=2, 3, 4)
  const pre2 = testsToUpsert.find(t => t.id === 'sbi-po-pre-02');
  if (pre2) {
    const qs = flattenQuestions(pre2.sections);
    const fullJson = {
      id: 'sbi-po-pre-02',
      testTitle: 'SBI PO 2026 Prelims - 2',
      totalQuestions: qs.length,
      questions: qs
    };
    fs.writeFileSync(path.join(SCRAPED_DIR, 'sbi_po_prelims_2_full.json'), JSON.stringify(fullJson, null, 2), 'utf8');
    console.log(`Wrote scraped/sbi_po_prelims_2_full.json (${qs.length} questions)`);
  }

  const pre3 = testsToUpsert.find(t => t.id === 'sbi-po-pre-03');
  if (pre3) {
    const qs = flattenQuestions(pre3.sections);
    const fullJson = {
      id: 'sbi-po-pre-03',
      testTitle: 'SBI PO 2026 Prelims - 3',
      totalQuestions: qs.length,
      questions: qs
    };
    fs.writeFileSync(path.join(SCRAPED_DIR, 'sbi_po_prelims_3_full.json'), JSON.stringify(fullJson, null, 2), 'utf8');
    console.log(`Wrote scraped/sbi_po_prelims_3_full.json (${qs.length} questions)`);
  }

  const pre4 = testsToUpsert.find(t => t.id === 'sbi-po-pre-04');
  if (pre4) {
    const qs = flattenQuestions(pre4.sections);
    const fullJson = {
      id: 'sbi-po-pre-04',
      testTitle: 'SBI PO 2026 Prelims - 4',
      totalQuestions: qs.length,
      questions: qs
    };
    fs.writeFileSync(path.join(SCRAPED_DIR, 'sbi_po_prelims_4_full.json'), JSON.stringify(fullJson, null, 2), 'utf8');
    console.log(`Wrote scraped/sbi_po_prelims_4_full.json (${qs.length} questions)`);
  }
}

if (require.main === module) {
  runUniqueExamSeeder();
}

module.exports = {
  createQuestion,
  createSection,
  createTestPayload,
  runUniqueExamSeeder
};
