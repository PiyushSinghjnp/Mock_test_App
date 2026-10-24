const http = require('http');

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
        params: { expression: 'document.getElementById("status-filter-bar") ? document.getElementById("status-filter-bar").outerHTML : "NOT FOUND"' }
      }));
    };
    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id === 1) {
        console.log('status-filter-bar DOM:\n', msg.result.result.value);
        ws.close();
      }
    };
  });
});
