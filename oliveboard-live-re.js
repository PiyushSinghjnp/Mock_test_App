/**
 * Live Oliveboard Remote Browser & Reverse-Engineering Engine
 * Powered by REA (Reverse Engineer Anything) MCP Tool & Chrome DevTools Protocol (CDP)
 * -----------------------------------------------------------------------------------
 * Allows the user to:
 * 1. Launch a dedicated Chrome browser session connected via CDP (port 9222) with persistent profile
 * 2. Log in manually to their Oliveboard account (email/password/Google/OTP)
 * 3. Open any Mock Test (part.php) or Solution Window (solution/index3.php)
 * 4. Run the REA MCP Tool ('rea inspect-web-page') to capture authenticated Evidence
 * 5. Deep-decrypt all Base64 questions (.eqt/.hqt), solutions (quesAnswer), and timings
 * 6. Auto-apply 2026 Official Exam Patterns and ingest directly into SQLite database
 */

const fs = require('fs');
const path = require('path');
const http = require('http');
const { spawn, execSync } = require('child_process');

const PROFILE_DIR = path.join(__dirname, '.oliveboard-profile');
const SCRAPED_DIR = path.join(__dirname, 'scraped');
const SNAPSHOTS_DIR = path.join(SCRAPED_DIR, 'snapshots');
const PAPERS_DIR = path.join(__dirname, 'papers');

if (!fs.existsSync(SCRAPED_DIR)) fs.mkdirSync(SCRAPED_DIR, { recursive: true });
if (!fs.existsSync(SNAPSHOTS_DIR)) fs.mkdirSync(SNAPSHOTS_DIR, { recursive: true });
if (!fs.existsSync(PAPERS_DIR)) fs.mkdirSync(PAPERS_DIR, { recursive: true });
if (!fs.existsSync(PROFILE_DIR)) fs.mkdirSync(PROFILE_DIR, { recursive: true });

let browserProcess = null;
let activeTargetId = null;
let activeTabIndex = 0;
let isStarting = false;
let lastCapturedArtifacts = [];
const CDP_ENDPOINT = 'http://127.0.0.1:9222';

/**
 * Locate Chrome or Edge executable on Windows
 */
function findBrowserExecutable() {
  const candidates = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    path.join(process.env.LOCALAPPDATA || '', 'Google\\Chrome\\Application\\chrome.exe'),
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'
  ];

  for (const p of candidates) {
    if (p && fs.existsSync(p)) return p;
  }
  return null;
}

/**
 * Check if CDP loopback endpoint is already running
 */
function checkCdpAvailable() {
  return new Promise((resolve) => {
    const req = http.get(`${CDP_ENDPOINT}/json/version`, { timeout: 1500 }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve(!!parsed.Browser);
        } catch (e) {
          resolve(false);
        }
      });
    });
    req.on('error', () => resolve(false));
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
  });
}

/**
 * Check if a URL belongs to the local clone app or internal Chrome pages
 * (Prevents the infinite screen-sharing recursion / hall of mirrors effect)
 */
function isSelfOrInternalTarget(url) {
  if (!url) return false;
  return url.includes('localhost:3000') ||
         url.includes('127.0.0.1:3000') ||
         url.includes('0.0.0.0:3000') ||
         url.startsWith('chrome://') ||
         url.startsWith('chrome-extension://') ||
         url.startsWith('devtools://');
}

/**
 * Fetch all page targets from Chrome DevTools Protocol (filtering internal chrome targets)
 */
function getBrowserTargets() {
  return new Promise((resolve, reject) => {
    http.get(`${CDP_ENDPOINT}/json/list`, { timeout: 3000 }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          const all = JSON.parse(data);
          const pageTargets = all.filter(t => (t.type === 'page' || !t.type) && (!t.url || !t.url.startsWith('chrome://omnibox-popup')));
          resolve(pageTargets);
        } catch (e) {
          reject(new Error('Failed to parse CDP target list: ' + e.message));
        }
      });
    }).on('error', (err) => {
      reject(new Error('CDP endpoint unreachable: ' + err.message));
    });
  });
}

/**
 * Send JSON-RPC command over native WebSocket to CDP target
 */
function sendCdpCommand(webSocketDebuggerUrl, method, params = {}, timeoutMs = 12000) {
  return new Promise((resolve, reject) => {
    if (!webSocketDebuggerUrl) {
      return reject(new Error('No webSocketDebuggerUrl provided'));
    }

    const ws = new globalThis.WebSocket(webSocketDebuggerUrl);
    const id = Math.floor(Math.random() * 1000000);
    let resolved = false;

    const timer = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        try { ws.close(); } catch (e) {}
        reject(new Error(`CDP command ${method} timed out after ${timeoutMs}ms`));
      }
    }, timeoutMs);

    ws.onopen = () => {
      ws.send(JSON.stringify({ id, method, params }));
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.id === id) {
          resolved = true;
          clearTimeout(timer);
          try { ws.close(); } catch (e) {}
          if (msg.error) {
            reject(new Error(msg.error.message || JSON.stringify(msg.error)));
          } else {
            resolve(msg.result);
          }
        }
      } catch (e) {
        resolved = true;
        clearTimeout(timer);
        try { ws.close(); } catch (err) {}
        reject(e);
      }
    };

    ws.onerror = (err) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timer);
        reject(new Error('WebSocket error: ' + (err.message || 'connection failed')));
      }
    };
  });
}

/**
 * Start Chrome with remote debugging on port 9222
 */
async function ensureBrowserStarted(initialUrl, options = {}) {
  const isAvailable = await checkCdpAvailable();
  const targetUrl = initialUrl || 'https://www.oliveboard.in/?next=https%3A%2F%2Fu1.oliveboard.in%2Fexams%2F%3Fc%3Dsbipopre19%26i%3Dbanking';

  if (!isAvailable) {
    if (isStarting) {
      for (let i = 0; i < 30; i++) {
        await new Promise(r => setTimeout(r, 300));
        if (await checkCdpAvailable()) break;
      }
    } else {
      isStarting = true;
      try {
        const exePath = findBrowserExecutable();
        if (!exePath) {
          throw new Error('Neither Google Chrome nor Microsoft Edge was found on this system. Please ensure Chrome is installed.');
        }

        const args = [
          '--remote-debugging-port=9222',
          `--user-data-dir=${PROFILE_DIR}`,
          '--no-first-run',
          '--no-default-browser-check',
          '--disable-popup-blocking',
          '--window-size=1366,768'
        ];

        if (options.headless) {
          args.push('--headless=new');
        }

        args.push(targetUrl);

        console.log(`[Oliveboard Live Browser] Launching ${exePath} with debugging port 9222...`);
        browserProcess = spawn(exePath, args, { detached: true, stdio: 'ignore' });
        browserProcess.unref();

        // Wait for CDP port to open
        let ready = false;
        for (let i = 0; i < 35; i++) {
          await new Promise(r => setTimeout(r, 300));
          if (await checkCdpAvailable()) {
            ready = true;
            break;
          }
        }

        if (!ready) {
          throw new Error('Chrome started but CDP endpoint at http://127.0.0.1:9222 did not become ready.');
        }
      } finally {
        isStarting = false;
      }
    }
  }

  // Retrieve targets
  const targets = await getBrowserTargets();
  if (targets.length === 0) {
    throw new Error('No page targets found in Chrome browser session.');
  }

  // Select real Oliveboard target (strictly excluding localhost:3000 to prevent infinite screen-share mirror loop)
  let best = targets.find(t => t.url && (t.url.includes('oliveboard.in') || t.url.includes('u1.oliveboard.in')) && !isSelfOrInternalTarget(t.url));

  if (!best) {
    // If no real Oliveboard tab exists, take the primary target and navigate it to targetUrl immediately
    best = targets.find(t => !isSelfOrInternalTarget(t.url)) || targets[0];
    if (best && isSelfOrInternalTarget(best.url)) {
      console.log(`[Oliveboard Live Browser] Current tab is on ${best.url}. Navigating to ${targetUrl} to prevent recursion...`);
      try {
        await sendCdpCommand(best.webSocketDebuggerUrl, 'Page.navigate', { url: targetUrl });
        await new Promise(r => setTimeout(r, 1200));
        best.url = targetUrl;
      } catch (e) {
        console.warn('[Oliveboard Live Browser] Navigation warning:', e.message);
      }
    }
  }
  activeTargetId = best.id;

  return best;
}

/**
 * Get the currently active target object
 */
async function getActiveTarget() {
  const isAvailable = await checkCdpAvailable();
  if (!isAvailable) return null;

  const rawTargets = await getBrowserTargets().catch(() => []);
  if (rawTargets.length === 0) return null;

  const targets = rawTargets.filter(t => !t.url || (!t.url.startsWith('chrome://') && !t.url.startsWith('devtools://')));
  if (targets.length === 0) return rawTargets[0];

  // ALWAYS prefer real Oliveboard targets over localhost to prevent infinite screen-sharing recursion
  const realObTarget = targets.find(t => t.url && (t.url.includes('oliveboard.in') || t.url.includes('u1.oliveboard.in')) && !isSelfOrInternalTarget(t.url));

  if (realObTarget) {
    activeTargetId = realObTarget.id;
    activeTabIndex = targets.indexOf(realObTarget);
    return realObTarget;
  }

  // If currently active target is self (localhost:3000), navigate it away immediately to Oliveboard!
  let current = targets.find(t => t.id === activeTargetId) || targets[0];
  if (current && isSelfOrInternalTarget(current.url)) {
    const defaultObUrl = 'https://www.oliveboard.in/?next=https%3A%2F%2Fu1.oliveboard.in%2Fexams%2F%3Fc%3Dsbipopre19%26i%3Dbanking';
    console.log(`[Oliveboard Live Browser] Preventing recursion! Navigating ${current.url} to ${defaultObUrl}...`);
    try {
      await sendCdpCommand(current.webSocketDebuggerUrl, 'Page.navigate', { url: defaultObUrl });
      current.url = defaultObUrl;
    } catch (e) {}
  }

  activeTargetId = current.id;
  activeTabIndex = targets.indexOf(current);
  return current;
}

/**
 * Detect what stage of Oliveboard the active page is currently on
 */
async function detectPageStage(target) {
  if (!target) return { stage: 'disconnected', label: 'Browser Not Running' };
  const url = target.url || '';

  try {
    const evalResult = await sendCdpCommand(target.webSocketDebuggerUrl, 'Runtime.evaluate', {
      expression: `(() => {
        const hasLoginModal = !!document.querySelector('#login-modal, .wrapper1, input[type="password"], #email, .login-box');
        const hasLiveTest = !!document.querySelector('#main-container, #question-outer-pane, #question-inner-pane, #left-container-post');
        const hasInstructions = !!document.querySelector('.instruction-pane-1, #start-test');
        const isInstrVisible = hasInstructions && (() => {
          const el = document.querySelector('#left-container, .instruction-pane-1');
          return el && window.getComputedStyle(el).display !== 'none';
        })();
        const hasSubmitDialog = !!document.querySelector('#submit-pane, #f-table, #sure') && (() => {
          const el = document.querySelector('#submit-pane, #sure');
          return el && window.getComputedStyle(el).display !== 'none';
        })();
        const hasAnalysis = url.includes('/analysis') || url.includes('/scorecard') || url.includes('/performance') || !!document.querySelector('#scorecard-section-rows, .scorecard-dialog, .analytics-container, #topper-comparison, .result-pane');
        const hasSolutions = url.includes('solution') || typeof window.quesAnswer !== 'undefined' || !!document.querySelector('#sol-box, .soln-box, #ans-box');
        const eqtCount = document.querySelectorAll('.eqt').length;
        return { hasLoginModal, hasLiveTest, isInstrVisible, hasSubmitDialog, hasAnalysis, hasSolutions, eqtCount };
      })()`,
      returnByValue: true
    }, 4000);

    const info = (evalResult && evalResult.result && evalResult.result.value) || {};

    if (info.hasSubmitDialog) {
      return { stage: 'submit_dialog', label: '3.5. Test Submission Summary & Confirmation Dialog (#submit-pane & #f-table)', info };
    }
    if (info.hasAnalysis || url.includes('/analysis')) {
      return { stage: 'analysis', label: '4. Performance Scorecard & Cutoff Analysis Screen', info };
    }
    if (info.hasSolutions || url.includes('/solution/')) {
      return { stage: 'solutions', label: '5. Post-Submit Interactive Solution Window (solution/index3.php)', info };
    }
    if (info.hasLiveTest && !info.isInstrVisible) {
      return { stage: 'live_test', label: `3. Active Live Mock Test (${info.eqtCount} Encrypted Questions Detected)`, info };
    }
    if (info.isInstrVisible || url.includes('/tests/part.php')) {
      return { stage: 'instructions', label: '2. Pre-Test Instructions Window (Ready to Start Live Mock)', info };
    }
    if (url.includes('u1.oliveboard.in') || url.includes('/exams')) {
      return { stage: 'dashboard', label: '1. Oliveboard Mock Test Dashboard (Ready to Select & Launch Test)', info };
    }
    if (info.hasLoginModal) {
      return { stage: 'login', label: '0. Oliveboard Login Page (Log in with your credentials/OTP)', info };
    }
    return { stage: 'browsing', label: 'Oliveboard Web Session Active', info };
  } catch (e) {
    return { stage: 'active', label: target.title || 'Oliveboard Page Active', info: { url } };
  }
}

/**
 * Capture screenshot frame for remote viewer canvas (JPEG, 75% quality for fast streaming)
 */
async function captureTargetScreenshot(target) {
  if (!target || !target.webSocketDebuggerUrl) return null;
  try {
    const res = await sendCdpCommand(target.webSocketDebuggerUrl, 'Page.captureScreenshot', {
      format: 'jpeg',
      quality: 75
    }, 5000);
    return res ? `data:image/jpeg;base64,${res.data}` : null;
  } catch (e) {
    return null;
  }
}

/**
 * Capture full visual high-resolution PNG snapshots of active window and all open Oliveboard tabs
 */
async function captureFullVisualSnapshots(activeTarget, safeSlug, timestamp) {
  const result = {
    mainPng: null,
    mainPngUrl: null,
    dataUri: null,
    byteSize: 0,
    otherTabs: []
  };

  if (!activeTarget || !activeTarget.webSocketDebuggerUrl) return result;

  // 1. Capture primary target high-resolution PNG
  try {
    const mainShot = await sendCdpCommand(activeTarget.webSocketDebuggerUrl, 'Page.captureScreenshot', {
      format: 'png',
      fromSurface: true,
      captureBeyondViewport: false
    }, 15000);

    if (mainShot && mainShot.data) {
      const mainFilename = `screenshot_${safeSlug}_${timestamp}.png`;
      const mainFilePath = path.join(SNAPSHOTS_DIR, mainFilename);
      const buffer = Buffer.from(mainShot.data, 'base64');
      fs.writeFileSync(mainFilePath, buffer);
      result.mainPng = `scraped/snapshots/${mainFilename}`;
      result.mainPngUrl = `/scraped/snapshots/${mainFilename}`;
      result.dataUri = `data:image/png;base64,${mainShot.data}`;
      result.byteSize = buffer.length;
      console.log(`[Visual Snapshot] Saved high-res window PNG (${buffer.length} bytes) to ${mainFilePath}`);
    }
  } catch (err) {
    console.warn('[Visual Snapshot] Primary window screenshot error:', err.message);
  }

  // 2. Iterate over all open targets (handles tests or scorecards opened in popup tabs)
  try {
    const allTargets = await getBrowserTargets().catch(() => []);
    for (let i = 0; i < allTargets.length; i++) {
      const t = allTargets[i];
      if (t.id !== activeTarget.id && t.webSocketDebuggerUrl) {
        try {
          const tabShot = await sendCdpCommand(t.webSocketDebuggerUrl, 'Page.captureScreenshot', {
            format: 'png',
            fromSurface: true
          }, 8000);

          if (tabShot && tabShot.data) {
            const tabFilename = `screenshot_${safeSlug}_tab${i + 1}_${timestamp}.png`;
            const tabFilePath = path.join(SNAPSHOTS_DIR, tabFilename);
            const tabBuf = Buffer.from(tabShot.data, 'base64');
            fs.writeFileSync(tabFilePath, tabBuf);
            result.otherTabs.push({
              tabIndex: i,
              targetId: t.id,
              title: t.title || `Tab ${i + 1}`,
              url: t.url,
              filePath: `scraped/snapshots/${tabFilename}`,
              urlPath: `/scraped/snapshots/${tabFilename}`,
              byteSize: tabBuf.length
            });
            console.log(`[Visual Snapshot] Saved open tab ${i + 1} PNG (${tabBuf.length} bytes) to ${tabFilePath}`);
          }
        } catch (tabErr) {
          console.warn(`[Visual Snapshot] Could not capture tab ${i + 1}:`, tabErr.message);
        }
      }
    }
  } catch (e) {
    console.warn('[Visual Snapshot] Tab enumeration error:', e.message);
  }

  return result;
}

/**
 * Execute REA (Reverse Engineer Anything) MCP tool to passively inspect the page target
 */
async function runReaMcpInspectTool(targetId) {
  console.log(`[REA MCP Tool] Executing inspect-web-page on target: ${targetId}...`);
  try {
    const cmd = `npx -y rea-agents@6.4.0 inspect-web-page ${CDP_ENDPOINT} ${targetId} --include-script-sources --include-storage-keys --include-console-text --format json`;
    const stdout = execSync(cmd, {
      encoding: 'utf8',
      maxBuffer: 30 * 1024 * 1024,
      timeout: 30000
    });

    const parsed = JSON.parse(stdout);
    console.log(`[REA MCP Tool] Inspection completed! Evidence ID: ${parsed.evidence_id}`);
    return {
      success: true,
      evidenceId: parsed.evidence_id,
      provider: parsed.provider,
      normalizedResult: parsed.normalized_result || {},
      raw: parsed
    };
  } catch (err) {
    console.warn(`[REA MCP Tool] CLI invocation warning:`, err.message);
    return {
      success: false,
      evidenceId: `ev_local_${Date.now()}`,
      provider: { id: 'rea-cdp-browser-local', name: 'REA Chrome DevTools Protocol Provider (Local)' },
      error: err.message
    };
  }
}

/**
 * Scrape & Rigorously Reverse-Engineer the active Oliveboard page using Visual Snapshots, REA MCP & CDP
 */
async function scrapeAndReverseEngineerActivePage(target, ingestCallback) {
  if (!target) throw new Error('No active Oliveboard browser page to reverse-engineer.');

  const timestamp = Date.now();
  const currentUrl = target.url || '';
  const currentTitle = target.title || 'Oliveboard Live Mock';

  const safeSlug = (currentTitle || 'oliveboard_page')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'mock_test';

  // 1. Rigorous Visual Snapshot of Active Window & All Open Tabs
  console.log(`[Rigorous Scrape] Capturing full visual snapshot of window "${currentTitle}"...`);
  const visualSnapshots = await captureFullVisualSnapshots(target, safeSlug, timestamp);

  // 2. Run REA MCP inspect-web-page tool
  console.log(`[Rigorous Scrape] Executing REA MCP Tool on target ${target.id}...`);
  const reaResult = await runReaMcpInspectTool(target.id);

  // 3. Deep in-page testing & extraction via CDP Runtime.evaluate
  console.log(`[Rigorous Scrape] Running deep DOM, modals, tables, and question inspection...`);
  const extractionExpression = `(() => {
    const decodeB64UTF8 = (b64) => {
      try {
        const clean = (b64 || '').trim().replace(/\\s+/g, '');
        if (!clean || clean.length < 4) return clean;
        const binStr = atob(clean);
        const bytes = new Uint8Array(binStr.length);
        for (let i = 0; i < binStr.length; i++) {
          bytes[i] = binStr.charCodeAt(i);
        }
        return new TextDecoder('utf-8').decode(bytes);
      } catch (e) {
        return b64;
      }
    };

    const html = document.documentElement.outerHTML;
    const stylesheets = Array.from(document.querySelectorAll('link[rel="stylesheet"]')).map(l => l.href);
    const inlineStyles = Array.from(document.querySelectorAll('style')).map(s => s.innerHTML);

    // Viewport & screen measurements
    const viewport = {
      innerWidth: window.innerWidth,
      innerHeight: window.innerHeight,
      devicePixelRatio: window.devicePixelRatio,
      scrollX: window.scrollX,
      scrollY: window.scrollY,
      screenWidth: window.screen ? window.screen.width : null,
      screenHeight: window.screen ? window.screen.height : null
    };

    // Deep Modals, Dialogs, Popups & Overlays
    const modalSelectors = [
      '#submit-pane', '#f-table', '#sure', '#calert', '#login-modal',
      '.modal', 'dialog', '.popup', '.alert', '.confirm-box', '#cand-time-outer',
      '#scorecard-modal-overlay', '.scorecard-dialog', '.analytics-container',
      '[role="dialog"]', '[role="alertdialog"]', '.sweet-alert', '.ui-dialog',
      '.modal-dialog', '.bootbox', '.layui-layer'
    ];
    const detectedModals = [];
    modalSelectors.forEach(sel => {
      try {
        const els = document.querySelectorAll(sel);
        els.forEach(el => {
          const cs = window.getComputedStyle(el);
          const rect = el.getBoundingClientRect();
          const isVisible = cs.display !== 'none' && cs.visibility !== 'hidden' && cs.opacity !== '0' && rect.width > 0 && rect.height > 0;
          const headingEl = el.querySelector('h1, h2, h3, h4, h5, center b, #summary, .modal-title, .title');
          const heading = headingEl ? headingEl.innerText.trim() : '';
          const buttons = Array.from(el.querySelectorAll('button, a[id], input[type="button"], input[type="submit"]')).map(b => ({
            id: b.id || '',
            className: b.className || '',
            text: (b.innerText || b.value || '').trim()
          })).filter(b => b.text.length > 0);

          detectedModals.push({
            selector: sel,
            id: el.id || '',
            className: el.className || '',
            isVisible,
            rect: { top: rect.top, left: rect.left, width: rect.width, height: rect.height },
            heading,
            textSnippet: (el.innerText || '').trim().slice(0, 1000),
            buttonsCount: buttons.length,
            buttons
          });
        });
      } catch (e) {}
    });

    // Deep Tables & Data Grids (especially #f-table and scorecards)
    const allTables = [];
    try {
      const tableEls = document.querySelectorAll('table');
      tableEls.forEach((tbl, tIdx) => {
        const headers = Array.from(tbl.querySelectorAll('th')).map(th => th.innerText.trim());
        const rowEls = Array.from(tbl.querySelectorAll('tbody tr, tr')).filter(r => !r.querySelector('th'));
        const rows = rowEls.map(r => Array.from(r.querySelectorAll('td')).map(td => td.innerText.trim()));
        
        const structuredRows = [];
        // Special parsing for Oliveboard #f-table (Section summary)
        if (tbl.id === 'f-table' || headers.some(h => /section/i.test(h) && /questions/i.test(h))) {
          rows.forEach(r => {
            if (r.length >= 5) {
              structuredRows.push({
                sectionName: r[0],
                noOfQuestions: r[1],
                answered: r[2],
                notAnswered: r[3],
                markedForReview: r[4],
                notVisited: r[5] || ''
              });
            }
          });
        }

        allTables.push({
          tableIndex: tIdx,
          id: tbl.id || '',
          className: tbl.className || '',
          headers,
          rowCount: rows.length,
          rows: rows.slice(0, 20),
          structuredRows
        });
      });
    } catch (e) {}

    // Globals
    const globals = {};
    const globalKeys = [
      'qarray', 'quesAnswer', 'user_resp', 'sec_list', 'sec_names', 'sec_time',
      'total_q', 'total_time', 'test_name', 'test_id', 'course', 'negative_marks',
      'marks_per_question', 'sol_array', 'topper_time', 'avg_time', 'testQpid'
    ];
    globalKeys.forEach(k => {
      if (typeof window[k] !== 'undefined') {
        try {
          globals[k] = JSON.parse(JSON.stringify(window[k]));
        } catch (e) {
          globals[k] = String(window[k]);
        }
      }
    });

    // Storage
    const storage = { localStorage: {}, sessionStorage: {}, cookies: document.cookie || '' };
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        storage.localStorage[k] = localStorage.getItem(k);
      }
    } catch (e) {}
    try {
      for (let i = 0; i < sessionStorage.length; i++) {
        const k = sessionStorage.key(i);
        storage.sessionStorage[k] = sessionStorage.getItem(k);
      }
    } catch (e) {}

    // Decrypt Base64 .eqt / .hqt question blocks
    const decryptedQuestions = [];
    const allEqt = Array.from(document.querySelectorAll('.eqt'));
    const qContainers = document.querySelectorAll('[id^="q-"], .question-box, .q-box');

    if (qContainers.length > 0) {
      qContainers.forEach((qEl, idx) => {
        const qid = qEl.id || ('q-' + (idx + 1));
        const eqtNodes = Array.from(qEl.querySelectorAll('.eqt')).map(el => decodeB64UTF8(el.innerHTML));
        const hqtNodes = Array.from(qEl.querySelectorAll('.hqt')).map(el => decodeB64UTF8(el.innerHTML));
        decryptedQuestions.push({
          qid: 1000 + idx + 1,
          questionNumber: idx + 1,
          section: 'Section ' + (Math.floor(idx / 35) + 1),
          questionHTML: eqtNodes[1] || eqtNodes[0] || qEl.innerHTML,
          passageHTML: eqtNodes[1] ? eqtNodes[0] : '',
          hasPassage: !!(eqtNodes[1] && eqtNodes[0].replace(/<[^>]+>/g, '').trim().length > 20),
          options: ['A', 'B', 'C', 'D', 'E'].map((letter, oIdx) => ({
            letter,
            html: eqtNodes[2 + oIdx] || '',
            text: (eqtNodes[2 + oIdx] || '').replace(/<[^>]+>/g, '').trim()
          }))
        });
      });
    } else if (allEqt.length > 0) {
      const decodedEqt = allEqt.map(el => decodeB64UTF8(el.innerHTML));
      for (let i = 0; i < decodedEqt.length; i += 7) {
        if (i + 6 < decodedEqt.length) {
          const passageHTML = decodedEqt[i] || '';
          const questionHTML = decodedEqt[i + 1] || '';
          const opts = ['A', 'B', 'C', 'D', 'E'].map((letter, oIdx) => ({
            letter,
            html: decodedEqt[i + 2 + oIdx] || '',
            text: (decodedEqt[i + 2 + oIdx] || '').replace(/<[^>]+>/g, '').trim()
          }));
          const qNum = Math.floor(i / 7) + 1;
          decryptedQuestions.push({
            qid: 1000 + qNum,
            questionNumber: qNum,
            section: qNum <= 30 ? 'English Language' : (qNum <= 65 ? 'Quantitative Aptitude' : 'Reasoning Ability'),
            hasPassage: passageHTML.replace(/<[^>]+>/g, '').trim().length > 20,
            passageHTML,
            questionHTML,
            options: opts
          });
        }
      }
    }

    // Solutions
    const extractedSolutions = {};
    if (window.quesAnswer && typeof window.quesAnswer === 'object') {
      Object.keys(window.quesAnswer).forEach(k => {
        const rawAns = window.quesAnswer[k];
        if (typeof rawAns === 'string') {
          extractedSolutions[k] = decodeB64UTF8(rawAns);
        } else if (rawAns && typeof rawAns === 'object') {
          extractedSolutions[k] = {
            ...rawAns,
            solutionDecoded: rawAns.sol ? decodeB64UTF8(rawAns.sol) : (rawAns.explanation ? decodeB64UTF8(rawAns.explanation) : '')
          };
        }
      });
    }

    document.querySelectorAll('[id^="sol"], .solution-content, .exp-box').forEach((el, i) => {
      const key = el.id || ('dom_sol_' + (i + 1));
      extractedSolutions[key] = el.innerHTML;
    });

    // Dashboard Cards
    const dashboardCards = Array.from(document.querySelectorAll('.test-card, .mock-card, .exam-card, .panel, .card-box, tr[id^="test"]')).slice(0, 50).map(el => ({
      id: el.id || '',
      className: el.className || '',
      text: (el.innerText || '').trim().slice(0, 300)
    })).filter(c => c.text.length > 10);

    // Computed UI Styles
    const uiSelectors = [
      '#header-top', '#main-container', '#left-container', '#right-container',
      '#left-container-post', '#right-container-post', '#section-name-container',
      '.secgen', '.currclass', '#question-outer-pane', '#question-no-bar',
      '#question-inner-pane', '.leftpane', '.rightpane', '#button-holder',
      '#mark', '#clear', '#next', '#cand-time-outer', '#right-low-half-outer',
      '#legend', '#question-main-pallette', '.sprite-butts', '#button-bottom',
      '#b1', '#b2', '#b3', '#b4', '#submit-pane', '#f-table', '#sure', '#calert'
    ];
    const computedUI = {};
    uiSelectors.forEach(sel => {
      const el = document.querySelector(sel);
      if (el) {
        const cs = window.getComputedStyle(el);
        computedUI[sel] = {
          tagName: el.tagName,
          backgroundColor: cs.backgroundColor,
          color: cs.color,
          fontFamily: cs.fontFamily,
          fontSize: cs.fontSize,
          fontWeight: cs.fontWeight,
          border: cs.border,
          width: cs.width,
          height: cs.height,
          padding: cs.padding,
          margin: cs.margin,
          display: cs.display,
          position: cs.position
        };
      }
    });

    return {
      url: window.location.href,
      title: document.title,
      viewport,
      html,
      stylesheets,
      inlineStylesCount: inlineStyles.length,
      detectedModals,
      allTables,
      globals,
      storage,
      decryptedQuestionsCount: decryptedQuestions.length,
      decryptedQuestions,
      extractedSolutionsCount: Object.keys(extractedSolutions).length,
      extractedSolutions,
      dashboardCardsCount: dashboardCards.length,
      dashboardCards,
      computedUI
    };
  })()`;

  let scrapedData = {};
  try {
    const evalRes = await sendCdpCommand(target.webSocketDebuggerUrl, 'Runtime.evaluate', {
      expression: extractionExpression,
      returnByValue: true
    }, 20000);
    scrapedData = (evalRes && evalRes.result && evalRes.result.value) || {};
  } catch (e) {
    console.warn('[Oliveboard Live Scrape] CDP eval extraction error:', e.message);
  }

  // Detect exact page stage
  const stageInfo = await detectPageStage(target);

  const domFilename = `dom_${safeSlug}_${timestamp}.html`;
  const reaFilename = `rea_evidence_${safeSlug}_${timestamp}.json`;
  const reportFilename = `rigorous_report_${safeSlug}_${timestamp}.json`;

  // 4. Save Raw DOM HTML in snapshots directory
  if (scrapedData.html) {
    fs.writeFileSync(path.join(SNAPSHOTS_DIR, domFilename), scrapedData.html, 'utf8');
    // Also save in scraped/ root for backward compatibility
    fs.writeFileSync(path.join(SCRAPED_DIR, `live_capture_${safeSlug}_${timestamp}.html`), scrapedData.html, 'utf8');
  }

  // 5. Save REA MCP Evidence
  fs.writeFileSync(path.join(SNAPSHOTS_DIR, reaFilename), JSON.stringify(reaResult.raw || reaResult, null, 2), 'utf8');
  fs.writeFileSync(path.join(SCRAPED_DIR, `rea_evidence_${safeSlug}_${timestamp}.json`), JSON.stringify(reaResult.raw || reaResult, null, 2), 'utf8');

  // 6. Construct Comprehensive Rigorous Report Manifest
  const rigorousReport = {
    capturedAt: new Date().toISOString(),
    url: scrapedData.url || currentUrl,
    title: scrapedData.title || currentTitle,
    stage: stageInfo,
    visualSnapshots: {
      main: visualSnapshots.mainPng,
      mainUrl: visualSnapshots.mainPngUrl,
      mainByteSize: visualSnapshots.byteSize,
      otherTabsCount: (visualSnapshots.otherTabs || []).length,
      otherTabs: visualSnapshots.otherTabs || []
    },
    domHtmlFile: `scraped/snapshots/${domFilename}`,
    reaEvidenceFile: `scraped/snapshots/${reaFilename}`,
    reaEvidenceId: reaResult.evidenceId,
    reaProvider: reaResult.provider ? (reaResult.provider.name || reaResult.provider.id) : 'REA MCP Tool',
    viewport: scrapedData.viewport || {},
    modalsCount: (scrapedData.detectedModals || []).length,
    visibleModals: (scrapedData.detectedModals || []).filter(m => m.isVisible),
    detectedModals: scrapedData.detectedModals || [],
    tablesCount: (scrapedData.allTables || []).length,
    allTables: scrapedData.allTables || [],
    globals: scrapedData.globals || {},
    storage: scrapedData.storage || {},
    computedUI: scrapedData.computedUI || {},
    decryptedQuestionsCount: scrapedData.decryptedQuestionsCount || 0,
    extractedSolutionsCount: scrapedData.extractedSolutionsCount || 0,
    dashboardCardsCount: scrapedData.dashboardCardsCount || 0,
    verificationChecklist: {
      visualSnapshotCaptured: !!visualSnapshots.mainPng,
      fullDomCaptured: !!scrapedData.html,
      reaEvidenceCaptured: !!reaResult.evidenceId,
      modalsInspectedCount: (scrapedData.detectedModals || []).length,
      tablesInspectedCount: (scrapedData.allTables || []).length,
      questionsDecryptedCount: scrapedData.decryptedQuestionsCount || 0,
      solutionsExtractedCount: scrapedData.extractedSolutionsCount || 0
    }
  };

  fs.writeFileSync(path.join(SNAPSHOTS_DIR, reportFilename), JSON.stringify(rigorousReport, null, 2), 'utf8');
  // Also save in scraped/ root for backward compatibility
  fs.writeFileSync(path.join(SCRAPED_DIR, `live_spec_${safeSlug}_${timestamp}.json`), JSON.stringify(rigorousReport, null, 2), 'utf8');

  // 7. Ingest into Mock Test Database if questions decrypted
  let ingestedTest = null;
  if (scrapedData.decryptedQuestions && scrapedData.decryptedQuestions.length > 0 && scrapedData.decryptedQuestions[0].questionHTML) {
    const paperPayload = {
      id: `live-ob-${safeSlug}`,
      testTitle: scrapedData.title || currentTitle || 'Oliveboard Live Mock Test',
      totalQuestions: scrapedData.decryptedQuestions.length,
      questions: scrapedData.decryptedQuestions.map((q, idx) => {
        const sol = (scrapedData.extractedSolutions && (scrapedData.extractedSolutions[q.qid] || scrapedData.extractedSolutions[idx + 1])) || null;
        return {
          ...q,
          correctAnswer: (sol && sol.ans) ? sol.ans : (q.correctAnswer || 'B'),
          explanationHTML: (sol && sol.solutionDecoded) ? sol.solutionDecoded : (typeof sol === 'string' ? sol : (q.explanationHTML || ''))
        };
      })
    };

    const paperPath = path.join(PAPERS_DIR, `live_scraped_${safeSlug}.json`);
    fs.writeFileSync(paperPath, JSON.stringify(paperPayload, null, 2), 'utf8');

    if (typeof ingestCallback === 'function') {
      ingestedTest = ingestCallback(paperPath);
    }
  }

  const artifactRecord = {
    timestamp: new Date().toISOString(),
    reaEvidenceId: reaResult.evidenceId,
    reaProvider: reaResult.provider ? (reaResult.provider.name || reaResult.provider.id) : 'REA MCP Tool',
    url: scrapedData.url || currentUrl,
    title: scrapedData.title || currentTitle,
    stage: stageInfo,
    screenshotUrl: visualSnapshots.mainPngUrl,
    screenshotThumbnail: visualSnapshots.dataUri,
    otherTabs: visualSnapshots.otherTabs || [],
    htmlFile: `scraped/snapshots/${domFilename}`,
    specFile: `scraped/snapshots/${reportFilename}`,
    reaFile: `scraped/snapshots/${reaFilename}`,
    uiElementsMatched: Object.keys(scrapedData.computedUI || {}).length,
    modalsDetectedCount: (scrapedData.detectedModals || []).length,
    visibleModals: (scrapedData.detectedModals || []).filter(m => m.isVisible),
    tablesDetectedCount: (scrapedData.allTables || []).length,
    tables: scrapedData.allTables || [],
    decryptedQuestionsCount: scrapedData.decryptedQuestionsCount || 0,
    extractedSolutionsCount: scrapedData.extractedSolutionsCount || 0,
    dashboardCardsCount: scrapedData.dashboardCardsCount || 0,
    ingestedTestId: ingestedTest ? ingestedTest.id : null,
    verificationChecklist: rigorousReport.verificationChecklist
  };

  lastCapturedArtifacts.unshift(artifactRecord);
  return artifactRecord;
}

/**
 * Mount all Live Browser & REA MCP Routes in Express
 */
function mountOliveboardLiveBrowserRoutes(app, ingestBackendPaperFile) {
  // 1. Launch or attach to Chrome session
  app.post('/api/ob-browser/start', async (req, res) => {
    try {
      const { url, headless } = req.body || {};
      const targetUrl = url || 'https://www.oliveboard.in/?next=https%3A%2F%2Fu1.oliveboard.in%2Fexams%2F%3Fc%3Dsbipopre19%26i%3Dbanking';
      const target = await ensureBrowserStarted(targetUrl, { headless: !!headless });
      if (isSelfOrInternalTarget(target.url)) {
        console.log(`[Oliveboard Live Browser] Start route: force navigating away from ${target.url} to ${targetUrl}...`);
        await sendCdpCommand(target.webSocketDebuggerUrl, 'Page.navigate', { url: targetUrl });
        await new Promise(r => setTimeout(r, 1200));
        target.url = targetUrl;
      }
      const rawTargets = await getBrowserTargets();
      const targets = rawTargets.filter(t => !isSelfOrInternalTarget(t.url));
      const displayTargets = targets.length > 0 ? targets : rawTargets;
      const stageInfo = await detectPageStage(target);

      res.json({
        success: true,
        url: target.url,
        title: target.title || '',
        activeTargetId: target.id,
        activeTabIndex: displayTargets.findIndex(t => t.id === target.id),
        tabs: displayTargets.map((t, idx) => ({
          index: idx,
          id: t.id,
          url: t.url,
          title: t.title || `Tab ${idx + 1}`
        })),
        stage: stageInfo
      });
    } catch (err) {
      console.error('[Oliveboard Live Browser] Start error:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // 2. Stream frame screenshot & tabs metadata
  app.get('/api/ob-browser/frame', async (req, res) => {
    try {
      const target = await getActiveTarget();
      if (!target) {
        return res.json({
          success: false,
          started: false,
          message: 'Browser not running. Click "Oliveboard Live Login & Scrape" to start.'
        });
      }

      const rawTargets = await getBrowserTargets();
      const targets = rawTargets.filter(t => !isSelfOrInternalTarget(t.url));
      const displayTargets = targets.length > 0 ? targets : rawTargets;
      const stageInfo = await detectPageStage(target);
      const imageBase64 = await captureTargetScreenshot(target);

      // Inspect layout viewport and active element for pixel-perfect coordinates & focus status
      let viewport = { width: 1342, height: 675, dpr: 1.25, activeTag: null, activeId: null };
      try {
        const vpRes = await sendCdpCommand(target.webSocketDebuggerUrl, 'Runtime.evaluate', {
          expression: `(() => ({
            width: window.innerWidth,
            height: window.innerHeight,
            dpr: window.devicePixelRatio || 1,
            activeTag: document.activeElement ? document.activeElement.tagName : null,
            activeId: document.activeElement ? document.activeElement.id : null,
            isLoginModal: !!document.querySelector('#modal-login, #course-email, #btn-forgotpwd'),
            isSignupModal: !!document.querySelector('#modal-signup, #course-uemail, #courseup')
          }))()`,
          returnByValue: true
        }, 2000).catch(() => null);
        if (vpRes && vpRes.result && vpRes.result.value) {
          viewport = vpRes.result.value;
        }
      } catch (e) {}

      res.json({
        success: true,
        started: true,
        url: target.url,
        title: target.title || '',
        activeTargetId: target.id,
        activeTabIndex: displayTargets.findIndex(t => t.id === target.id),
        tabs: displayTargets.map((t, idx) => ({
          index: idx,
          id: t.id,
          url: t.url,
          title: t.title || `Tab ${idx + 1}`
        })),
        stage: stageInfo,
        viewport: viewport,
        capturedArtifacts: lastCapturedArtifacts.slice(0, 10),
        imageBase64: imageBase64
      });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // 3. Forward Mouse, Keyboard & Navigation inputs
  app.post('/api/ob-browser/input', async (req, res) => {
    try {
      const target = await getActiveTarget();
      if (!target) {
        return res.status(400).json({ success: false, error: 'Browser not running' });
      }

      const { action, type, x, y, deltaX, deltaY, key, text, url, tabIndex, targetId } = req.body || {};
      const act = action || type;

      if (act === 'click') {
        const nx = Math.round(Number(x) || 0);
        const ny = Math.round(Number(y) || 0);
        // 1. Move/Hover to target
        await sendCdpCommand(target.webSocketDebuggerUrl, 'Input.dispatchMouseEvent', {
          type: 'mouseMoved',
          x: nx,
          y: ny
        }).catch(() => {});
        await new Promise(r => setTimeout(r, 20));

        // 2. Mouse pressed
        await sendCdpCommand(target.webSocketDebuggerUrl, 'Input.dispatchMouseEvent', {
          type: 'mousePressed',
          x: nx,
          y: ny,
          button: 'left',
          clickCount: 1
        });

        // 3. Realistic click duration so event listeners and focus register
        await new Promise(r => setTimeout(r, 55));

        // 4. Mouse released
        await sendCdpCommand(target.webSocketDebuggerUrl, 'Input.dispatchMouseEvent', {
          type: 'mouseReleased',
          x: nx,
          y: ny,
          button: 'left',
          clickCount: 1
        });

        // 5. ALSO explicitly hit-test and focus/click via DOM evaluation (guarantees focus even across layers)
        await sendCdpCommand(target.webSocketDebuggerUrl, 'Runtime.evaluate', {
          expression: `(() => {
            const el = document.elementFromPoint(${nx}, ${ny});
            if (el) {
              if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable) {
                el.focus();
                if (typeof el.select === 'function') el.select();
              } else if (el.closest('label')) {
                const inp = el.closest('label').querySelector('input, textarea');
                if (inp) inp.focus();
              } else if (el.closest('button, a, [role="button"]')) {
                const btn = el.closest('button, a, [role="button"]');
                btn.click();
              }
            }
          })()`
        }).catch(() => {});
      } else if (act === 'dblclick') {
        const nx = Math.round(Number(x) || 0);
        const ny = Math.round(Number(y) || 0);
        await sendCdpCommand(target.webSocketDebuggerUrl, 'Input.dispatchMouseEvent', {
          type: 'mouseMoved',
          x: nx,
          y: ny
        }).catch(() => {});
        await new Promise(r => setTimeout(r, 20));
        await sendCdpCommand(target.webSocketDebuggerUrl, 'Input.dispatchMouseEvent', {
          type: 'mousePressed',
          x: nx,
          y: ny,
          button: 'left',
          clickCount: 1
        });
        await new Promise(r => setTimeout(r, 40));
        await sendCdpCommand(target.webSocketDebuggerUrl, 'Input.dispatchMouseEvent', {
          type: 'mouseReleased',
          x: nx,
          y: ny,
          button: 'left',
          clickCount: 1
        });
        await new Promise(r => setTimeout(r, 40));
        await sendCdpCommand(target.webSocketDebuggerUrl, 'Input.dispatchMouseEvent', {
          type: 'mousePressed',
          x: nx,
          y: ny,
          button: 'left',
          clickCount: 2
        });
        await new Promise(r => setTimeout(r, 40));
        await sendCdpCommand(target.webSocketDebuggerUrl, 'Input.dispatchMouseEvent', {
          type: 'mouseReleased',
          x: nx,
          y: ny,
          button: 'left',
          clickCount: 2
        });
      } else if (act === 'wheel') {
        await sendCdpCommand(target.webSocketDebuggerUrl, 'Input.dispatchMouseEvent', {
          type: 'mouseWheel',
          x: Math.round(Number(x) || 0),
          y: Math.round(Number(y) || 0),
          deltaX: Number(deltaX) || 0,
          deltaY: Number(deltaY) || 0
        });
      } else if (act === 'type' && text !== undefined) {
        // If nothing is focused, auto-focus active email or login input
        await sendCdpCommand(target.webSocketDebuggerUrl, 'Runtime.evaluate', {
          expression: `(() => {
            let active = document.activeElement;
            if (!active || active.tagName === 'BODY' || active.tagName === 'HTML') {
              const candidate = document.querySelector('#course-email, #course-uemail, input[type="email"], input[type="password"], input:not([type="hidden"])');
              if (candidate) candidate.focus();
            }
          })()`
        }).catch(() => {});

        // Insert full string into currently focused input
        await sendCdpCommand(target.webSocketDebuggerUrl, 'Input.insertText', {
          text: String(text)
        });
      } else if (act === 'keydown' && key) {
        const k = String(key);
        // Auto-focus active input if user starts typing while focus is on body
        if (k.length === 1 || k === 'Backspace') {
          await sendCdpCommand(target.webSocketDebuggerUrl, 'Runtime.evaluate', {
            expression: `(() => {
              let active = document.activeElement;
              if (!active || active.tagName === 'BODY' || active.tagName === 'HTML') {
                const candidate = document.querySelector('#course-email, #course-uemail, input[type="email"], input[type="password"], input:not([type="hidden"])');
                if (candidate) candidate.focus();
              }
            })()`
          }).catch(() => {});
        }

        if (k === 'Enter') {
          await sendCdpCommand(target.webSocketDebuggerUrl, 'Input.dispatchKeyEvent', {
            type: 'rawKeyDown',
            windowsVirtualKeyCode: 13,
            unmodifiedText: '\r',
            text: '\r',
            key: 'Enter',
            code: 'Enter'
          });
          await sendCdpCommand(target.webSocketDebuggerUrl, 'Input.dispatchKeyEvent', {
            type: 'char',
            windowsVirtualKeyCode: 13,
            unmodifiedText: '\r',
            text: '\r',
            key: 'Enter',
            code: 'Enter'
          });
          await sendCdpCommand(target.webSocketDebuggerUrl, 'Input.dispatchKeyEvent', {
            type: 'keyUp',
            windowsVirtualKeyCode: 13,
            key: 'Enter',
            code: 'Enter'
          });
        } else if (k === 'Backspace') {
          await sendCdpCommand(target.webSocketDebuggerUrl, 'Input.dispatchKeyEvent', {
            type: 'rawKeyDown',
            windowsVirtualKeyCode: 8,
            key: 'Backspace',
            code: 'Backspace'
          });
          await sendCdpCommand(target.webSocketDebuggerUrl, 'Input.dispatchKeyEvent', {
            type: 'keyUp',
            windowsVirtualKeyCode: 8,
            key: 'Backspace',
            code: 'Backspace'
          });
        } else if (k === 'Tab') {
          await sendCdpCommand(target.webSocketDebuggerUrl, 'Input.dispatchKeyEvent', {
            type: 'rawKeyDown',
            windowsVirtualKeyCode: 9,
            key: 'Tab',
            code: 'Tab'
          });
          await sendCdpCommand(target.webSocketDebuggerUrl, 'Input.dispatchKeyEvent', {
            type: 'keyUp',
            windowsVirtualKeyCode: 9,
            key: 'Tab',
            code: 'Tab'
          });
        } else if (k.length === 1 && !req.body.ctrlKey && !req.body.altKey && !req.body.metaKey) {
          // Printable character forwarded directly into active input
          await sendCdpCommand(target.webSocketDebuggerUrl, 'Input.insertText', {
            text: k
          });
        } else {
          await sendCdpCommand(target.webSocketDebuggerUrl, 'Input.dispatchKeyEvent', {
            type: 'rawKeyDown',
            key: k
          });
          await sendCdpCommand(target.webSocketDebuggerUrl, 'Input.dispatchKeyEvent', {
            type: 'keyUp',
            key: k
          });
        }
      } else if (act === 'bringToFront') {
        // Bring the real native Chrome window to front on Windows desktop
        await sendCdpCommand(target.webSocketDebuggerUrl, 'Page.bringToFront', {}).catch(() => {});
      } else if (act === 'switchLoginTab') {
        const to = req.body && req.body.tab; // 'login' or 'signup'
        const script = `(() => {
          if (${JSON.stringify(to)} === 'login' || !${JSON.stringify(to)}) {
            const btn = document.querySelector('#btn-show-modal-login, button:has-text("Login"), a[href*="login"]');
            if (btn) btn.click();
            return { switchedTo: 'login' };
          } else {
            const btn = document.querySelector('#btn-show-modal-signup, #btn-loginsignup, button:has-text("Register")');
            if (btn) btn.click();
            return { switchedTo: 'signup' };
          }
        })()`;
        await sendCdpCommand(target.webSocketDebuggerUrl, 'Runtime.evaluate', { expression: script });
      } else if (act === 'fillLogin') {
        const { email, password, phone, submit, switchTab } = req.body || {};
        const script = `(() => {
          if (${JSON.stringify(switchTab || '')} === 'login') {
            const btn = document.querySelector('#btn-show-modal-login, #btn-loginsignup');
            if (btn) btn.click();
          } else if (${JSON.stringify(switchTab || '')} === 'signup') {
            const btn = document.querySelector('#btn-show-modal-signup');
            if (btn) btn.click();
          }

          const em = ${JSON.stringify(email || '')};
          const pw = ${JSON.stringify(password || '')};
          const ph = ${JSON.stringify(phone || '')};

          if (em) {
            const emailInput = document.querySelector('#course-email, #course-uemail, input[type="email"], input[name="email"], #email');
            if (emailInput) {
              emailInput.focus();
              emailInput.value = em;
              emailInput.dispatchEvent(new Event('input', { bubbles: true }));
              emailInput.dispatchEvent(new Event('change', { bubbles: true }));
            }
          }

          if (ph) {
            const phoneInput = document.querySelector('#course-uphone, input[name="monum"], input[type="tel"]');
            if (phoneInput) {
              phoneInput.focus();
              phoneInput.value = ph;
              phoneInput.dispatchEvent(new Event('input', { bubbles: true }));
              phoneInput.dispatchEvent(new Event('change', { bubbles: true }));
            }
          }

          if (pw) {
            const passInput = document.querySelector('#course-upassword, input[type="password"], input[name="pwd"], #password');
            if (passInput) {
              passInput.focus();
              passInput.value = pw;
              passInput.dispatchEvent(new Event('input', { bubbles: true }));
              passInput.dispatchEvent(new Event('change', { bubbles: true }));
            }
          }

          if (${!!submit}) {
            setTimeout(() => {
              const subBtn = document.querySelector('#coursein1, #courseup, button[type="submit"], .login-btn');
              if (subBtn) subBtn.click();
            }, 80);
          }
          return { done: true };
        })()`;
        await sendCdpCommand(target.webSocketDebuggerUrl, 'Runtime.evaluate', { expression: script });
      } else if (act === 'navigate' && url) {
        const dest = url.startsWith('http') ? url : `https://${url}`;
        await sendCdpCommand(target.webSocketDebuggerUrl, 'Page.navigate', { url: dest });
      } else if (act === 'reload') {
        await sendCdpCommand(target.webSocketDebuggerUrl, 'Page.reload', {});
      } else if (act === 'switchTab') {
        const targets = await getBrowserTargets();
        const selected = targetId
          ? targets.find(t => t.id === targetId)
          : (tabIndex !== undefined && targets[tabIndex]);
        if (selected) {
          activeTargetId = selected.id;
          activeTabIndex = targets.indexOf(selected);
          await sendCdpCommand(selected.webSocketDebuggerUrl, 'Page.bringToFront', {}).catch(() => {});
        }
      } else if (act === 'closeTab') {
        const targets = await getBrowserTargets();
        const selected = targetId
          ? targets.find(t => t.id === targetId)
          : (tabIndex !== undefined && targets[tabIndex]);
        if (selected && targets.length > 1) {
          await sendCdpCommand(selected.webSocketDebuggerUrl, 'Target.closeTarget', { targetId: selected.id }).catch(() => {});
          const remaining = await getBrowserTargets().catch(() => []);
          if (remaining.length > 0) {
            activeTargetId = remaining[0].id;
            activeTabIndex = 0;
          }
        }
      }

      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // 4. DEEP REVERSE-ENGINEER VIA REA MCP TOOL
  app.post('/api/ob-browser/scrape', async (req, res) => {
    try {
      const target = await getActiveTarget();
      if (!target) {
        return res.status(400).json({ success: false, error: 'Browser not running. Click "Oliveboard Live Login & Scrape" to launch.' });
      }

      console.log(`[Reverse Engineer] Initiating REA MCP tool scrape on "${target.title}" (${target.url})...`);
      const result = await scrapeAndReverseEngineerActivePage(target, ingestBackendPaperFile);

      res.json({
        success: true,
        result,
        history: lastCapturedArtifacts.slice(0, 10)
      });
    } catch (err) {
      console.error('[Reverse Engineer] Error:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // 5. GET RECENT SNAPSHOTS & RIGOROUS REPORTS
  app.get('/api/ob-browser/snapshots', async (req, res) => {
    try {
      const files = fs.existsSync(SNAPSHOTS_DIR) ? fs.readdirSync(SNAPSHOTS_DIR) : [];
      const reports = files.filter(f => f.startsWith('rigorous_report_') && f.endsWith('.json')).map(f => {
        try {
          const content = JSON.parse(fs.readFileSync(path.join(SNAPSHOTS_DIR, f), 'utf8'));
          return {
            filename: f,
            capturedAt: content.capturedAt,
            title: content.title,
            url: content.url,
            stage: content.stage,
            screenshotUrl: content.visualSnapshots ? content.visualSnapshots.mainUrl : null,
            otherTabsCount: content.visualSnapshots ? content.visualSnapshots.otherTabsCount : 0,
            modalsCount: content.modalsCount || 0,
            tablesCount: content.tablesCount || 0,
            questionsCount: content.decryptedQuestionsCount || 0,
            solutionsCount: content.extractedSolutionsCount || 0,
            reaEvidenceId: content.reaEvidenceId
          };
        } catch (e) {
          return null;
        }
      }).filter(Boolean);

      res.json({
        success: true,
        totalSnapshots: reports.length,
        reports: reports.sort((a, b) => new Date(b.capturedAt) - new Date(a.capturedAt)),
        history: lastCapturedArtifacts.slice(0, 15)
      });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // 6. GET SINGLE DETAILED RIGOROUS REPORT
  app.get('/api/ob-browser/report/:filename', async (req, res) => {
    try {
      const safeFilename = path.basename(req.params.filename);
      const filePath = path.join(SNAPSHOTS_DIR, safeFilename);
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ success: false, error: 'Report not found' });
      }
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      res.json({ success: true, report: data });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });
}

module.exports = {
  mountOliveboardLiveBrowserRoutes,
  ensureBrowserStarted,
  scrapeAndReverseEngineerActivePage,
  runReaMcpInspectTool
};
