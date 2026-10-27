const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const papersDir = path.join(__dirname, '..', 'papers');
if (fs.existsSync(papersDir)) {
  const files = fs.readdirSync(papersDir);
  files.forEach(f => {
    if (f.startsWith('live_scraped_')) {
      fs.unlinkSync(path.join(papersDir, f));
      console.log('Deleted papers/' + f);
    }
  });
}

const dbPath = path.join(__dirname, '..', 'database.sqlite');
if (fs.existsSync(dbPath)) {
  const db = new DatabaseSync(dbPath);
  const res = db.prepare("DELETE FROM tests WHERE id LIKE 'live-ob-%'").run();
  console.log('Removed live-ob tests from database.sqlite, changes:', res.changes);

  const remaining = db.prepare('SELECT id, exam_id, title FROM tests').all();
  console.log('Remaining tests count:', remaining.length);
}
