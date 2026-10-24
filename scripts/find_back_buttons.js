const fs = require('fs');

['index.html', 'js/app.js', 'js/test-engine.js', 'js/solution-engine.js'].forEach(f => {
  const content = fs.readFileSync(f, 'utf8');
  const matches = [...content.matchAll(/(back|prev|return|exit)[^"'<>\n]{0,30}(button|btn)/gi)].map(m => m[0]);
  console.log('=== ' + f + ' ===');
  console.log([...new Set(matches)]);
});
