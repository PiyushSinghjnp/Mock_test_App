const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..', 'scraped');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.html'));

files.forEach(f => {
  const content = fs.readFileSync(path.join(dir, f), 'utf8');
  const cssMatches = [...content.matchAll(/<link[^>]+rel=["']stylesheet["'][^>]*>/gi)].map(m => m[0]);
  const styleTags = [...content.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)].map(m => m[0].length);
  console.log(`${f}:`);
  cssMatches.forEach(m => console.log('  ' + m));
  if (styleTags.length) console.log(`  <style> blocks: ${styleTags.length} (total chars: ${styleTags.reduce((a,b)=>a+b,0)})`);
});
