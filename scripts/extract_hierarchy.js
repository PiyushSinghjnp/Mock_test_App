const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'scraped', 'live_capture_oliveboard_banking_amp_insurance_sbi_po_2026_prelims_1792765731570.html'), 'utf8');

// Let's print out the body and its direct child elements
const cheerio = null; // We can use simple regex / string slices
const body = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i)[1];

// Find all top level elements under body (depth 1)
// Let's do a quick parser
function getTopLevelSections(content) {
  const sections = [];
  // look for <header, <nav, <aside, <div class="main-wrapper", <div class="modal", etc.
  const regex = /<(header|nav|aside|div|section|main)\s+([^>]*?)>/g;
  let m;
  while ((m = regex.exec(content)) !== null) {
    const tag = m[1];
    const attrs = m[2];
    const classMatch = attrs.match(/class="([^"]+)"/);
    const idMatch = attrs.match(/id="([^"]+)"/);
    sections.push({ tag, class: classMatch ? classMatch[1] : '', id: idMatch ? idMatch[1] : '', index: m.index });
  }
  return sections;
}

const allTags = getTopLevelSections(body);
console.log('Top elements found:', allTags.length);
allTags.slice(0, 35).forEach(t => {
  console.log(`<${t.tag} id="${t.id}" class="${t.class}">`);
});
