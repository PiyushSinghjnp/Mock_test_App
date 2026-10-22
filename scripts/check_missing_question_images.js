const fs = require('fs');
const directPath = 'd:/oliveboard-clone/IBPS SO IT mains questions/ibps_so_it_mains-1_solutions_20260924_142005.json';
const data = JSON.parse(fs.readFileSync(directPath, 'utf8'));

const missingInQuestions = [];
data.questions.forEach((q, idx) => {
  // Check question_text, passage_text, options
  const targetText = [
    q.question_text || '',
    q.passage_text || '',
    JSON.stringify(q.options || {})
  ].join(' ');

  const matches = targetText.match(/oliveimg\/[^"'\\<> ]+/g);
  if (matches) {
    const missing = matches.filter(m => !fs.existsSync('d:/oliveboard-clone/' + m));
    if (missing.length > 0) {
      missingInQuestions.push({
        qNum: q.question_number || (idx + 1),
        section: q.section,
        missing: missing,
        questionSnippet: (q.question_text || '').substring(0, 100),
        explanationSnippet: (q.explanation || '').substring(0, 100)
      });
    }
  }
});

console.log('Total questions with missing images in question/passage/options:', missingInQuestions.length);
console.log(JSON.stringify(missingInQuestions, null, 2));
