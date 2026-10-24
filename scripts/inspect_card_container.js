const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'scraped', 'live_capture_oliveboard_banking_amp_insurance_sbi_po_2026_prelims_1792765731570.html'), 'utf8');

const cardIdx = html.indexOf('start_test_card');
if (cardIdx !== -1) {
  console.log('--- START TEST CARD CONTAINER ---');
  console.log(html.slice(cardIdx - 1200, cardIdx + 800));
}
