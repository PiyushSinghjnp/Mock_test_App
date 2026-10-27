async function runChecks() {
  console.log('--- Testing Isolated Scraper & Proxy Engine ---');

  // 1. Check frame state
  const frameRes = await fetch('http://localhost:3000/api/ob-browser/frame');
  const frame = await frameRes.json();
  console.log('Frame success:', frame.success);
  console.log('Active URL:', frame.url);
  console.log('Tabs count:', frame.tabs.length);
  console.log('Tabs:', frame.tabs.map(t => ({ index: t.index, url: t.url, title: t.title })));

  // 2. Check input syncUrl
  const syncRes = await fetch('http://localhost:3000/api/ob-browser/input', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'syncUrl', url: 'https://www.oliveboard.in/' })
  });
  const syncData = await syncRes.json();
  console.log('syncUrl success:', syncData.success);

  // 3. Test scraping with sample DOM payload
  const scrapeRes = await fetch('http://localhost:3000/api/ob-browser/scrape', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      domPayload: {
        url: 'https://www.oliveboard.in/',
        title: 'Oliveboard Live Mock Test',
        decryptedQuestions: [
          {
            qid: 101,
            questionNumber: 1,
            questionHTML: '<p>What is the primary function of an operating system?</p>',
            options: [
              { letter: 'A', text: 'Resource management', html: 'Resource management' },
              { letter: 'B', text: 'Compiling code', html: 'Compiling code' }
            ]
          }
        ],
        extractedSolutions: {
          101: { ans: 'A', solutionDecoded: 'Resource management is core to OS.' }
        }
      }
    })
  });
  const scrapeData = await scrapeRes.json();
  console.log('scrape success:', scrapeData.success);
  console.log('decryptedQuestionsCount:', scrapeData.result.decryptedQuestionsCount);
  console.log('ingestedTestId (must be null):', scrapeData.result.ingestedTestId);

  // 4. Verify papers directory still has NO live_scraped_ files
  const fs = require('fs');
  const path = require('path');
  const papers = fs.readdirSync(path.join(__dirname, '..', 'papers'));
  const scrapedInPapers = papers.filter(p => p.startsWith('live_scraped_'));
  console.log('live_scraped files in papers/ (must be 0):', scrapedInPapers.length);

  // 5. Verify database tests catalog has NO live-ob tests
  const { DatabaseSync } = require('node:sqlite');
  const db = new DatabaseSync('database.sqlite');
  const liveObTests = db.prepare("SELECT count(*) as count FROM tests WHERE id LIKE 'live-ob-%'").get();
  console.log('live-ob tests in database (must be 0):', liveObTests.count);

  console.log('All verification checks complete!');
}

runChecks().catch(console.error);
