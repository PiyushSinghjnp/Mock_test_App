const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'scraped', 'live_capture_oliveboard_banking_amp_insurance_sbi_po_2026_prelims_1792765731570.html'), 'utf8');

const fltrIdx = html.indexOf('fltr-nav-wrapper');
if (fltrIdx !== -1) {
  console.log('--- FLTR NAV WRAPPER ---');
  console.log(html.slice(fltrIdx - 15, fltrIdx + 2000));
} else {
  console.log('No fltr-nav-wrapper found, looking for filter');
}
