const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'scraped', 'live_capture_oliveboard_banking_amp_insurance_sbi_po_2026_prelims_1792765731570.html'), 'utf8');

// Find all HTML comments
const comments = html.match(/<!--[\s\S]*?-->/g) || [];
console.log('--- ALL COMMENTS IN SCRAPED DOM ---');
comments.forEach(c => {
  const clean = c.replace(/<!--|-->/g, '').trim();
  if (clean.length < 80) console.log('  COMMENT:', clean);
});

// Find major structural elements: header, sidebar, main, cards
console.log('\n--- STRUCTURAL ELEMENTS & CLASSES ---');
const classRegex = /class="([^"]+)"/g;
const classes = new Set();
let m;
while ((m = classRegex.exec(html)) !== null) {
  m[1].split(/\s+/).forEach(cls => {
    if (cls) classes.add(cls);
  });
}

console.log('Total unique classes:', classes.size);
const sampleClasses = Array.from(classes);
console.log('Header/Nav classes:', sampleClasses.filter(c => c.startsWith('hdr-') || c.startsWith('nav-') || c.startsWith('sb-') || c.startsWith('sidebar')));
console.log('Card/Test classes:', sampleClasses.filter(c => c.includes('card') || c.includes('test') || c.includes('exam') || c.includes('btn') || c.includes('sub-tab') || c.includes('subtab')));
console.log('Layout classes:', sampleClasses.filter(c => c.includes('layout') || c.includes('main') || c.includes('container') || c.includes('content') || c.includes('wrapper') || c.includes('body')));
