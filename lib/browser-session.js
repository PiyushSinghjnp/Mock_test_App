'use strict';
const fs = require('node:fs');
const path = require('node:path');
const net = require('node:net');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');
const ROOT = path.join(__dirname, '..', '.oliveboard-profile', 'sessions');
const sessions = new Map();
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

function allowedUrl(value) {
  let u;
  try { u = new URL(value); } catch { throw new Error('Enter a full https:// Oliveboard URL.'); }
  if (u.protocol !== 'https:' || u.username || u.password || (u.port && u.port !== '443') ||
      !(u.hostname === 'oliveboard.in' || u.hostname.endsWith('.oliveboard.in'))) {
    throw new Error('Only HTTPS pages on oliveboard.in are supported.');
  }
  return u.href;
}
function isAllowed(value) { try { allowedUrl(value); return true; } catch { return false; } }
function browserExecutable() {
  const candidates = [process.env.OB_BROWSER_EXECUTABLE,
    path.join(process.env.PROGRAMFILES || 'C:/Program Files', 'Google/Chrome/Application/chrome.exe'),
    path.join(process.env['PROGRAMFILES(X86)'] || 'C:/Program Files (x86)', 'Microsoft/Edge/Application/msedge.exe'),
    '/usr/bin/google-chrome', '/usr/bin/chromium', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'];
  const found = candidates.find(p => p && fs.existsSync(p));
  if (!found) throw new Error('Chrome or Edge was not found. Set OB_BROWSER_EXECUTABLE to the installed browser.');
  return found;
}
async function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer(); server.on('error', reject);
    server.listen(0, '127.0.0.1', () => { const port = server.address().port; server.close(() => resolve(port)); });
  });
}
async function json(endpoint, route, options = {}) {
  const response = await fetch(endpoint + route, { ...options, signal: AbortSignal.timeout(4000) });
  if (!response.ok) throw new Error(`Browser connection failed (${response.status}).`);
  return response.json();
}
function getSession(req, res) {
  const cookie = String(req.headers.cookie || '').split(';').map(x => x.trim()).find(x => x.startsWith('ob_capture='));
  let id = cookie && cookie.slice('ob_capture='.length);
  if (!/^[a-f0-9]{48}$/.test(id || '') || !sessions.has(id)) {
    id = crypto.randomBytes(24).toString('hex');
    sessions.set(id, { id, endpoint: null, targetId: null, process: null, starting: null, busy: false });
    res.cookie('ob_capture', id, { httpOnly: true, sameSite: 'strict', path: '/api/ob-browser' });
  }
  return sessions.get(id);
}
async function targets(session) {
  if (!session.endpoint) throw new Error('Open the live browser first.');
  return (await json(session.endpoint, '/json/list')).filter(t => t.type === 'page' && isAllowed(t.url));
}
async function start(session, url = 'https://www.oliveboard.in/') {
  allowedUrl(url);
  if (session.starting) return session.starting;
  if (session.endpoint) { try { if ((await targets(session)).length) return; } catch {} }
  session.starting = (async () => {
    const port = await freePort();
    const profile = path.join(ROOT, session.id);
    fs.mkdirSync(profile, { recursive: true });
    const child = spawn(browserExecutable(), [`--remote-debugging-port=${port}`, '--remote-debugging-address=127.0.0.1',
      `--user-data-dir=${profile}`, '--no-first-run', '--no-default-browser-check', '--new-window', url],
    { stdio: 'ignore', windowsHide: false });
    // This window is intentionally visible: the user must be able to log in and solve CAPTCHA.
    let launchError; child.on('error', e => { launchError = e; });
    child.unref(); session.process = child; session.endpoint = `http://127.0.0.1:${port}`;
    for (let i = 0; i < 60; i++) {
      if (launchError) throw launchError;
      try {
        const list = await targets(session);
        if (list.length) { session.targetId = list[0].id; return; }
      } catch {}
      await wait(250);
    }
    session.endpoint = null;
    throw new Error('The browser did not open an Oliveboard page. Check its window and retry.');
  })().finally(() => { session.starting = null; });
  return session.starting;
}
async function selectTarget(session, targetId) {
  const list = await targets(session);
  const selected = list.find(t => t.id === (targetId || session.targetId)) || (!targetId && list[0]);
  if (!selected) throw new Error('That Oliveboard tab is closed or has navigated outside Oliveboard. Refresh the tabs.');
  session.targetId = selected.id;
  return selected;
}
async function withCdp(target, callback) {
  const endpoint = new URL(target.webSocketDebuggerUrl);
  if (endpoint.protocol !== 'ws:' || !['127.0.0.1', 'localhost', '[::1]'].includes(endpoint.hostname)) throw new Error('Invalid local browser endpoint.');
  const ws = new WebSocket(endpoint);
  const pending = new Map(); let seq = 0;
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => { ws.close(); reject(new Error('Browser connection timed out.')); }, 5000);
    ws.addEventListener('open', () => { clearTimeout(timer); resolve(); }, { once: true });
    ws.addEventListener('error', () => { clearTimeout(timer); reject(new Error('Cannot connect to browser tab.')); }, { once: true });
  });
  ws.addEventListener('message', event => {
    let msg; try { msg = JSON.parse(event.data); } catch { return; }
    const p = pending.get(msg.id); if (!p) return;
    clearTimeout(p.timer); pending.delete(msg.id);
    if (msg.error) p.reject(new Error(msg.error.message)); else p.resolve(msg.result);
  });
  const call = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++seq;
    const timer = setTimeout(() => { pending.delete(id); reject(new Error(`Browser ${method} timed out.`)); }, 20000);
    pending.set(id, { resolve, reject, timer }); ws.send(JSON.stringify({ id, method, params }));
  });
  const closed = () => { for (const p of pending.values()) { clearTimeout(p.timer); p.reject(new Error('Browser tab disconnected.')); } pending.clear(); };
  ws.addEventListener('close', closed);
  try { return await callback(call); } finally { closed(); ws.close(); }
}
async function evaluate(call, expression) {
  const r = await call('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error('Page extraction failed: ' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text));
  if (!r.result || !('value' in r.result)) throw new Error('The page did not return capture data.');
  return r.result.value;
}
module.exports = { allowedUrl, isAllowed, start, targets, selectTarget, withCdp, evaluate, getSession, wait, json };
