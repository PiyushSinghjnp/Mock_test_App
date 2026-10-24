const fs = require('fs');

const appJs = fs.readFileSync('js/app.js', 'utf8');
const idMatches = [...appJs.matchAll(/document\.getElementById\(['"]([^'"]+)['"]\)/g)].map(m => m[1]);
console.log('IDs accessed in js/app.js:');
const uniqueIds = [...new Set(idMatches)];
uniqueIds.forEach(id => console.log('  ' + id));
