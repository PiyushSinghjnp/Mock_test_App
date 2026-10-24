const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'scraped', 'live_capture_oliveboard_banking_amp_insurance_sbi_po_2026_prelims_1792765731570.html'), 'utf8');

// Extract Header HTML
const headerStart = html.indexOf('<header class="hdr-main"');
const headerEnd = html.indexOf('</header>') + 9;
const headerHtml = html.slice(headerStart, headerEnd);
console.log('--- HEADER HTML (length:', headerHtml.length, ') ---');
console.log(headerHtml.slice(0, 1500));

// Extract Nav HTML
const navStart = html.indexOf('<nav class="sm-nav-container"');
const navEnd = html.indexOf('</nav>', navStart) + 6;
const navHtml = html.slice(navStart, navEnd);
console.log('\n--- NAV HTML (length:', navHtml.length, ') ---');
console.log(navHtml);

// Extract Tabs & Card Section HTML
const mainStart = html.indexOf('<div class="main-wrapper">');
const mainEnd = html.indexOf('<div class="tpc-card start_test_card locked"');
const mainSection = html.slice(mainStart, mainEnd + 200);
console.log('\n--- MAIN WRAPPER START (length:', mainSection.length, ') ---');
console.log(mainSection.slice(0, 2000));
