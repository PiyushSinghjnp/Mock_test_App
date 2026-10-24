const http = require('http');
const fs = require('fs');
const path = require('path');

const imgDir = path.join(__dirname, 'images', 'oliveboard_solution');
if (!fs.existsSync(imgDir)) {
  fs.mkdirSync(imgDir, { recursive: true });
}

http.get('http://127.0.0.1:9222/json', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const targets = JSON.parse(data);
    const solTarget = targets.find(t => t.title.includes('Solution') || t.url.includes('solution'));
    if (!solTarget) return console.log('No sol target');
    const ws = new WebSocket(solTarget.webSocketDebuggerUrl);
    ws.onopen = async () => {
      const svgs = [
        'totalquestion.svg',
        'timetaken.svg',
        'accuracy.svg',
        'right.svg',
        'wrong.svg',
        'unattempted.svg',
        'totalscore.svg',
        'ic-uncheck.svg',
        'ic-moveup.svg',
        'ic-movedown.svg',
        'dlogo.svg',
        'mlogo.svg',
        'ic-dropdown.svg'
      ];
      for (let i = 0; i < svgs.length; i++) {
        const svg = svgs[i];
        const expr = `fetch('img/${svg}').then(r => r.text()).catch(e => '')`;
        ws.send(JSON.stringify({
          id: 100 + i,
          method: 'Runtime.evaluate',
          params: { expression: expr, awaitPromise: true, returnByValue: true }
        }));
      }
    };
    let received = 0;
    ws.onmessage = (event) => {
      const resp = JSON.parse(event.data);
      if (resp.id >= 100) {
        const idx = resp.id - 100;
        const svgs = [
          'totalquestion.svg',
          'timetaken.svg',
          'accuracy.svg',
          'right.svg',
          'wrong.svg',
          'unattempted.svg',
          'totalscore.svg',
          'ic-uncheck.svg',
          'ic-moveup.svg',
          'ic-movedown.svg',
          'dlogo.svg',
          'mlogo.svg',
          'ic-dropdown.svg'
        ];
        const svg = svgs[idx];
        if (resp.result && resp.result.result && resp.result.result.value) {
          const content = resp.result.result.value;
          fs.writeFileSync(path.join(imgDir, svg), content, 'utf8');
          console.log(`Saved ${svg} (${content.length} bytes)`);
        }
        received++;
        if (received >= svgs.length) {
          console.log('All SVGs processed!');
          ws.close();
        }
      }
    };
  });
});
