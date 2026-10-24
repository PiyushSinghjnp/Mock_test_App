const fs = require('fs');
const path = require('path');

const files = fs.readdirSync('scraped').filter(f => f.endsWith('.html'));
files.forEach(f => {
  const content = fs.readFileSync(path.join('scraped', f), 'utf8');
  ['Solution', 'Solutions', 'Analytics', 'Analysis', 'Re-attempt', 'Rank', 'Percentile', 'tpc-card', 'score'].forEach(kw => {
    let idx = 0;
    while ((idx = content.indexOf(kw, idx)) !== -1) {
      console.log(`[${f}] Found "${kw}" at ${idx}`);
      console.log(content.slice(Math.max(0, idx - 100), Math.min(content.length, idx + 200)));
      break; // just first
    }
  });
});
