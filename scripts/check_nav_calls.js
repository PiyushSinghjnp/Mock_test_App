const fs = require('fs');

['js/app.js', 'js/test-engine.js', 'js/solution-engine.js', 'js/data-manager.js'].forEach(f => {
  const content = fs.readFileSync(f, 'utf8');
  ['window.open', 'location.href', 'window.location', 'target="_blank"'].forEach(term => {
    let idx = 0;
    while ((idx = content.indexOf(term, idx)) !== -1) {
      console.log(`${f} contains ${term} at ${idx}:`);
      console.log('  ' + content.slice(Math.max(0, idx - 40), Math.min(content.length, idx + 80)).replace(/\n/g, ' '));
      idx += term.length;
    }
  });
});
