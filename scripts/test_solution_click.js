const http = require('http');
const fs = require('fs');
const path = require('path');

http.get('http://127.0.0.1:9222/json', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const targets = JSON.parse(data);
    const target = targets.find(t => t.url.includes('localhost:3000'));
    const ws = new WebSocket(target.webSocketDebuggerUrl);
    ws.onopen = () => {
      // Find the second card's solutions button and click it
      const expr = `
        const btns = Array.from(document.querySelectorAll('.btn-attempt-card')).filter(b => b.textContent.includes('Solutions'));
        if (btns.length > 1) {
          btns[1].click();
          'Clicked second solutions button';
        } else if (btns.length === 1) {
          btns[0].click();
          'Clicked first solutions button';
        } else {
          'No solutions button found';
        }
      `;
      ws.send(JSON.stringify({ id: 1, method: 'Runtime.evaluate', params: { expression: expr, returnByValue: true } }));
      
      setTimeout(() => {
        ws.send(JSON.stringify({ id: 2, method: 'Page.captureScreenshot', params: { format: 'png' } }));
      }, 1500);
    };

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id === 1) {
        console.log('Click result:', msg.result.result.value);
      } else if (msg.id === 2 && msg.result && msg.result.data) {
        const outPath = path.join(__dirname, '..', 'solution_modal_verified_real.png');
        fs.writeFileSync(outPath, Buffer.from(msg.result.data, 'base64'));
        console.log('Saved solution_modal_verified_real.png');
        ws.close();
      }
    };
  });
});
