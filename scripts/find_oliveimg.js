const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '..', '..', '..', '..', '..', 'd:', 'oliveboard-clone', 'IBPS SO IT mains questions', 'ibps_so_it_mains-1_solutions_20260924_142005.json');
// Let's use absolute path directly
const directPath = 'd:/oliveboard-clone/IBPS SO IT mains questions/ibps_so_it_mains-1_solutions_20260924_142005.json';
const data = JSON.parse(fs.readFileSync(directPath, 'utf8'));

const broken = [];
data.questions.forEach((q, idx) => {
  const str = JSON.stringify(q);
  const matches = str.match(/oliveimg\/[^"'\\<> ]+/g);
  if (matches) {
    broken.push({
      qNum: q.question_number || (idx + 1),
      section: q.section,
      images: Array.from(new Set(matches))
    });
  }
});
console.log('Total questions with oliveimg:', broken.length);
console.log(JSON.stringify(broken, null, 2));
