/**
 * question_builder.js
 * Core builder helpers for constructing normalized Oliveboard questions, sections, and test payloads.
 */

function createQuestion({
  id,
  globalIndex,
  localIndex,
  section,
  questionHTML,
  passageHTML = '',
  options = [],
  correctAnswer = 'A',
  correctIndex = 0,
  explanationHTML = '',
  marksForCorrect = 1.0,
  negativeMarks = 0.25
}) {
  const normOptions = options.map((opt, idx) => {
    const letters = ['A', 'B', 'C', 'D', 'E'];
    const letter = letters[idx] || String(idx + 1);
    if (typeof opt === 'string') {
      return { letter, text: opt, html: opt };
    }
    return {
      letter: opt.letter || letter,
      text: opt.text || opt.html || '',
      html: opt.html || opt.text || ''
    };
  });

  const letterMap = { A: 0, B: 1, C: 2, D: 3, E: 4 };
  const cIdx = correctIndex !== undefined ? correctIndex : (letterMap[correctAnswer.toUpperCase()] ?? 0);
  const cAns = correctAnswer || ['A', 'B', 'C', 'D', 'E'][cIdx] || 'A';

  return {
    id: String(id),
    globalIndex: Number(globalIndex),
    localIndex: Number(localIndex),
    questionNumber: Number(globalIndex),
    section: String(section),
    questionHTML: String(questionHTML),
    passageHTML: String(passageHTML),
    hasPassage: !!(passageHTML && passageHTML.trim().length > 20),
    imageUrls: [],
    options: normOptions,
    correctAnswer: cAns,
    correctIndex: cIdx,
    explanationHTML: String(explanationHTML),
    marksForCorrect: Number(marksForCorrect),
    negativeMarks: Number(negativeMarks)
  };
}

function createSection({
  id,
  title,
  durationMinutes = 20,
  maxMarks = null,
  positiveMarks = 1.0,
  negativeMarks = 0.25,
  language = 'English & Hindi',
  questions = []
}) {
  const qCount = questions.length;
  const marks = maxMarks !== null ? maxMarks : qCount * positiveMarks;
  return {
    id,
    title,
    questionCount: qCount,
    durationMinutes,
    durationSeconds: durationMinutes * 60,
    maxMarks: marks,
    positiveMarks,
    negativeMarks,
    language,
    isSectionalLocked: true,
    questions
  };
}

function createTestPayload({
  id,
  examId,
  examName,
  type,
  title,
  subtitle,
  durationMinutes,
  sections,
  marks = null,
  isFree = true
}) {
  const totalQuestions = sections.reduce((sum, s) => sum + s.questions.length, 0);
  const totalMarks = marks !== null ? marks : sections.reduce((sum, s) => sum + s.maxMarks, 0);
  const totalDurationSeconds = durationMinutes * 60;
  const positiveMarks = sections[0]?.positiveMarks || 1.0;
  const negativeMarks = sections[0]?.negativeMarks || 0.25;

  return {
    id,
    examId,
    examName,
    type,
    title,
    subtitle,
    marks: totalMarks,
    questionsCount: totalQuestions,
    durationMinutes,
    totalDurationSeconds,
    hasSectionalTiming: sections.length > 1,
    isSectionalLocked: true,
    markingScheme: { positive: positiveMarks, negative: negativeMarks },
    marksPerCorrect: positiveMarks,
    negativeMarks,
    isFree: isFree ? 1 : 0,
    sections
  };
}

module.exports = {
  createQuestion,
  createSection,
  createTestPayload
};
