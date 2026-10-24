const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'scraped', 'live_capture_oliveboard_banking_amp_insurance_sbi_po_2026_prelims_1792765731570.html'), 'utf8');

const searchIdx = html.indexOf('hdr-search-area');
if (searchIdx !== -1) {
  console.log('--- HDR SEARCH & ACTION AREA ---');
  console.log(html.slice(searchIdx - 15, searchIdx + 2500));
}
