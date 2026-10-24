const http = require('http');
const fs = require('fs');
const path = require('path');

http.get('http://127.0.0.1:9222/json', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', async () => {
    const targets = JSON.parse(data);
    const pageTarget = targets.find(t => t.url.includes('localhost:3000') || t.title.includes('Oliveboard Mock Tests'));
    if (!pageTarget) {
      console.log('No matching localhost:3000 target found! Available targets:');
      targets.forEach(t => console.log('  ' + t.title + ' -> ' + t.url));
      return;
    }

    console.log('Found target:', pageTarget.title, 'ws:', pageTarget.webSocketDebuggerUrl);
    const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);

    ws.onopen = () => {
      console.log('Connected to target via WS. Reloading page...');
      ws.send(JSON.stringify({ id: 1, method: 'Page.reload', params: { ignoreCache: true } }));
      
      // Scroll to top and wait 2 seconds then capture screenshot
      setTimeout(() => {
        ws.send(JSON.stringify({
          id: 3,
          method: 'Runtime.evaluate',
          params: { expression: 'window.scrollTo(0, 0)' }
        }));
        setTimeout(() => {
          console.log('Capturing screenshot...');
          ws.send(JSON.stringify({ id: 2, method: 'Page.captureScreenshot', params: { format: 'png' } }));
        }, 500);
      }, 2000);
    };

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id === 2 && msg.result && msg.result.data) {
        const buf = Buffer.from(msg.result.data, 'base64');
        const outPath = path.join(__dirname, '..', 'authentic_oliveboard_ui.png');
        fs.writeFileSync(outPath, buf);
        console.log('Screenshot saved to:', outPath, 'Bytes:', buf.length);
        ws.close();
      }
    };
  });
});
