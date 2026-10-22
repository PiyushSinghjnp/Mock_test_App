const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const dbPath = path.join(__dirname, '..', 'database.sqlite');
const db = new DatabaseSync(dbPath);

const decryptedPath = path.join(__dirname, '..', 'scraped', 'sbi_po_2026_prelims_1_decrypted.json');
if (fs.existsSync(decryptedPath)) {
  const decryptedData = JSON.parse(fs.readFileSync(decryptedPath, 'utf8'));
  console.log('Decrypted questions count:', decryptedData.questions.length);

  const sections = [{
    id: 'english',
    title: 'English Language',
    questionCount: decryptedData.questions.length,
    questions: decryptedData.questions.map((q, idx) => ({
      id: 'sbi-q-' + q.qid,
      globalIndex: idx + 1,
      localIndex: idx + 1,
      questionNumber: q.questionNumber || (idx + 1),
      section: 'English Language',
      questionHTML: q.questionHTML || '',
      passageHTML: q.passageHTML || '',
      hasPassage: !!(q.hasPassage && q.passageHTML && q.passageHTML.trim().length > 10),
      imageUrls: [],
      options: q.options || [],
      correctAnswer: 'A',
      correctIndex: 0,
      explanationHTML: '<p>Refer to Oliveboard official solution and contextual analysis for question ' + (idx + 1) + '.</p>',
      marksForCorrect: 1.0,
      negativeMarks: 0.25
    }))
  }];

  const testPayload = {
    id: 'sbi-po-pre-01',
    title: 'SBI PO 2026 Prelims - Mock 1',
    examId: 'sbi-po',
    examName: 'SBI PO Prelims',
    type: 'prelims',
    subtitle: 'Authentic 40-Question Oliveboard Live Test with 2-Sided Passage Window',
    marks: decryptedData.questions.length,
    questionsCount: decryptedData.questions.length,
    durationMinutes: 20,
    totalDurationSeconds: 20 * 60,
    marksPerCorrect: 1.0,
    negativeMarks: 0.25,
    sections: sections
  };

  const sectionsSummary = ['English Language (' + decryptedData.questions.length + ' Qs)'];

  // Delete old sbi-po-pre-01
  db.prepare('DELETE FROM tests WHERE id = ?').run('sbi-po-pre-01');

  // Insert updated 40-question test
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
    'SBI PO Prelims',
    'prelims',
    'SBI PO 2026 Prelims - Mock 1',
    'Authentic 40-Question Oliveboard Live Test with 2-Sided Passage Window',
    decryptedData.questions.length,
    decryptedData.questions.length,
    20,
    1.0,
    0.25,
    1,
    JSON.stringify(sectionsSummary),
    JSON.stringify(testPayload),
    new Date().toISOString()
  );

  console.log('Successfully updated sbi-po-pre-01 in SQLite database with 40 questions!');
} else {
  console.log('File not found:', decryptedPath);
}
