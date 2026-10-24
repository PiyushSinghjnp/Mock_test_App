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
        params: { expression: '(() => { const el = document.getElementById("status-filter-bar"); const r = el.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, height: r.height, display: getComputedStyle(el).display, parentDisplay: getComputedStyle(el.parentElement).display }; })()' , returnByValue: true }
      }));
    };
    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id === 1) {
        console.log('status-filter-bar rect:', msg.result.result.value);
        ws.close();
      }
    };
  });
});
