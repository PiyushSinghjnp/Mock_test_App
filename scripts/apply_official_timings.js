/**
 * Script: apply_official_timings.js
 * Ingests official notification sectional timing, duration, and marking schemes into database.sqlite
 */

const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, '..', 'database.sqlite');
const db = new DatabaseSync(dbPath);

const notifPath = path.join(__dirname, '..', 'data', 'official_exam_notifications.json');
const notifications = JSON.parse(fs.readFileSync(notifPath, 'utf8'));

console.log('Loaded official notifications from', notifPath);

// Fetch all existing tests
const tests = db.prepare('SELECT id, exam_id, type, title, test_data_json FROM tests').all();

const updateStmt = db.prepare('UPDATE tests SET test_data_json = ?, duration_minutes = ?, marks = ?, marks_per_correct = ?, negative_marks = ? WHERE id = ?');

for (const testRow of tests) {
  const testId = testRow.id;
  const examId = testRow.exam_id;
  const testType = testRow.type;
  let testData = JSON.parse(testRow.test_data_json);

  console.log(`Processing ${testId} (${testData.title})...`);

  // Default parameters
  testData.hasSectionalTiming = true;
  testData.isSectionalLocked = true;

  if (testId === 'ibps-so-it-mains-1') {
    const ibpsMainsTiming = {
      'english-language': { durationMinutes: 25, durationSeconds: 1500, maxMarks: 30, positiveMarks: 1.0, negativeMarks: 0.25, language: 'English' },
      'reasoning-ability': { durationMinutes: 35, durationSeconds: 2100, maxMarks: 40, positiveMarks: 1.0, negativeMarks: 0.25, language: 'English & Hindi' },
      'quantitative-aptitude': { durationMinutes: 25, durationSeconds: 1500, maxMarks: 30, positiveMarks: 1.0, negativeMarks: 0.25, language: 'English & Hindi' },
      'professional-knowledge': { durationMinutes: 35, durationSeconds: 2100, maxMarks: 50, positiveMarks: 1.0, negativeMarks: 0.25, language: 'English & Hindi' }
    };

    let totalDurationSec = 0;
    let totalMarks = 0;

    testData.sections.forEach((sec, idx) => {
      const secKey = sec.id || sec.title.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      const spec = ibpsMainsTiming[secKey] || { durationMinutes: 30, durationSeconds: 1800, maxMarks: sec.questions.length, positiveMarks: 1.0, negativeMarks: 0.25, language: 'English & Hindi' };

      sec.durationMinutes = spec.durationMinutes;
      sec.durationSeconds = spec.durationSeconds;
      sec.maxMarks = spec.maxMarks;
      sec.positiveMarks = spec.positiveMarks;
      sec.negativeMarks = spec.negativeMarks;
      sec.language = spec.language;
      sec.isSectionalLocked = true;
      sec.sectionIndex = idx + 1;

      totalDurationSec += sec.durationSeconds;
      totalMarks += sec.maxMarks;
    });

    testData.totalDurationSeconds = totalDurationSec;
    testData.durationMinutes = Math.round(totalDurationSec / 60);
    testData.marks = totalMarks;
    testData.markingScheme = { positive: 1.0, negative: 0.25, penaltyRatio: '1/4th' };

    updateStmt.run(
      JSON.stringify(testData),
      testData.durationMinutes,
      testData.marks,
      1.0,
      0.25,
      testId
    );
    console.log(`Updated ibps-so-it-mains-1: total ${testData.durationMinutes}m, 4 sections with 25m, 35m, 25m, 35m`);
  } else if (testId.startsWith('sbi-po-pre')) {
    // SBI PO Prelims
    const sbiPreTiming = {
      'english': { durationMinutes: 20, durationSeconds: 1200, maxMarks: 30, positiveMarks: 1.0, negativeMarks: 0.25, language: 'English' },
      'quant': { durationMinutes: 20, durationSeconds: 1200, maxMarks: 35, positiveMarks: 1.0, negativeMarks: 0.25, language: 'English & Hindi' },
      'reasoning': { durationMinutes: 20, durationSeconds: 1200, maxMarks: 35, positiveMarks: 1.0, negativeMarks: 0.25, language: 'English & Hindi' }
    };

    let totalDurationSec = 0;
    testData.sections.forEach((sec, idx) => {
      const secKey = (sec.id || '').toLowerCase();
      let spec = sbiPreTiming[secKey];
      if (!spec) {
        if (/quant|math/i.test(sec.title)) spec = sbiPreTiming['quant'];
        else if (/reason/i.test(sec.title)) spec = sbiPreTiming['reasoning'];
        else spec = sbiPreTiming['english'];
      }

      sec.durationMinutes = spec.durationMinutes;
      sec.durationSeconds = spec.durationSeconds;
      sec.maxMarks = spec.maxMarks;
      sec.positiveMarks = spec.positiveMarks;
      sec.negativeMarks = spec.negativeMarks;
      sec.language = spec.language;
      sec.isSectionalLocked = true;
      sec.sectionIndex = idx + 1;

      totalDurationSec += sec.durationSeconds;
    });

    testData.totalDurationSeconds = totalDurationSec || 3600;
    testData.durationMinutes = Math.round(testData.totalDurationSeconds / 60);
    testData.hasSectionalTiming = true;
    testData.isSectionalLocked = true;
    testData.markingScheme = { positive: 1.0, negative: 0.25, penaltyRatio: '1/4th' };

    updateStmt.run(
      JSON.stringify(testData),
      testData.durationMinutes,
      testData.marks || 100,
      1.0,
      0.25,
      testId
    );
    console.log(`Updated ${testId}: total ${testData.durationMinutes}m, 20m sectional timing`);
  } else if (testId.startsWith('sbi-po-mains')) {
    // SBI PO Mains
    const sbiMainsTiming = [
      { id: 'reasoning-computer', title: 'Reasoning & Computer Aptitude', durationMinutes: 50, durationSeconds: 3000, maxMarks: 60, positiveMarks: 1.5, negativeMarks: 0.25, language: 'English & Hindi' },
      { id: 'data-analysis', title: 'Data Analysis & Interpretation', durationMinutes: 45, durationSeconds: 2700, maxMarks: 60, positiveMarks: 1.71, negativeMarks: 0.25, language: 'English & Hindi' },
      { id: 'general-economy', title: 'General/Economy/Banking Awareness', durationMinutes: 45, durationSeconds: 2700, maxMarks: 60, positiveMarks: 1.0, negativeMarks: 0.25, language: 'English & Hindi' },
      { id: 'english-language', title: 'English Language', durationMinutes: 40, durationSeconds: 2400, maxMarks: 20, positiveMarks: 1.0, negativeMarks: 0.25, language: 'English' }
    ];

    let totalDurationSec = 0;
    testData.sections.forEach((sec, idx) => {
      const spec = sbiMainsTiming[idx] || sbiMainsTiming[0];
      sec.durationMinutes = spec.durationMinutes;
      sec.durationSeconds = spec.durationSeconds;
      sec.maxMarks = spec.maxMarks;
      sec.positiveMarks = spec.positiveMarks;
      sec.negativeMarks = spec.negativeMarks;
      sec.language = spec.language;
      sec.isSectionalLocked = true;
      sec.sectionIndex = idx + 1;
      totalDurationSec += sec.durationSeconds;
    });

    testData.totalDurationSeconds = totalDurationSec || 10800;
    testData.durationMinutes = Math.round(testData.totalDurationSeconds / 60);
    testData.hasSectionalTiming = true;
    testData.isSectionalLocked = true;

    updateStmt.run(
      JSON.stringify(testData),
      testData.durationMinutes,
      200,
      1.0,
      0.25,
      testId
    );
    console.log(`Updated ${testId}: total ${testData.durationMinutes}m, 50m, 45m, 45m, 40m sectional timing`);
  } else if (testId.startsWith('sbi-po-sec')) {
    testData.sections.forEach((sec, idx) => {
      sec.durationMinutes = 20;
      sec.durationSeconds = 1200;
      sec.maxMarks = 35;
      sec.positiveMarks = 1.0;
      sec.negativeMarks = 0.25;
      sec.isSectionalLocked = true;
      sec.sectionIndex = idx + 1;
    });
    testData.totalDurationSeconds = 1200;
    testData.durationMinutes = 20;
    testData.hasSectionalTiming = true;
    testData.isSectionalLocked = true;

    updateStmt.run(
      JSON.stringify(testData),
      20,
      35,
      1.0,
      0.25,
      testId
    );
    console.log(`Updated sectional test ${testId}: 20m sectional timing`);
  }
}

console.log('All official exam notification sectional timings and marking schemes applied!');
