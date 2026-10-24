const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'scraped', 'live_capture_oliveboard_banking_amp_insurance_sbi_po_2026_prelims_1792765731570.html'), 'utf8');

// Search for test card occurrences
const keywords = ['start_test', 'scr-card', 'tpc-card', 'Free Mock', 'Mock 1', 'Test 1'];
keywords.forEach(kw => {
  let idx = 0;
  let found = 0;
  while ((idx = html.indexOf(kw, idx)) !== -1 && found < 2) {
    console.log(`\n=== Keyword "${kw}" at index ${idx} ===`);
    const start = Math.max(0, idx - 150);
    const end = Math.min(html.length, idx + 450);
    console.log(html.slice(start, end));
    idx += kw.length;
    found++;
  }
});
