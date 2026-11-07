'use strict';
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
module.exports = { parseQuizQuestions };
