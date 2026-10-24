const http = require('http');
const fs = require('fs');

http.get('http://127.0.0.1:9222/json', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const targets = JSON.parse(data);
    const target = targets.find(t => t.url.includes('localhost:3000'));
    const ws = new WebSocket(target.webSocketDebuggerUrl);
    ws.onopen = () => {
      ws.send(JSON.stringify({
        id: 1,
        method: 'Runtime.evaluate',
        params: { expression: 'document.getElementById("btn-exit-soln-console").click(); "Closed solution console";', returnByValue: true }
      }));
      setTimeout(() => {
        ws.send(JSON.stringify({ id: 2, method: 'Page.captureScreenshot', params: { format: 'png' } }));
      }, 500);
    };
    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id === 1) {
        console.log(msg.result.result.value);
      } else if (msg.id === 2 && msg.result && msg.result.data) {
        fs.writeFileSync('back_to_dashboard_real.png', Buffer.from(msg.result.data, 'base64'));
        console.log('Saved back_to_dashboard_real.png');
        ws.close();
      }
    };
  });
});
