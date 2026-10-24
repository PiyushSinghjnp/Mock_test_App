const fs = require('fs');

const css = fs.readFileSync('css/style.css', 'utf8');
const regex = /url\(['"]?([^'")]+)['"]?\)/gi;
const urls = new Set();
let m;
while ((m = regex.exec(css)) !== null) {
  urls.add(m[1]);
}
console.log('Unique URLs in css/style.css:');
for (const u of urls) {
  console.log('  ' + u);
}
