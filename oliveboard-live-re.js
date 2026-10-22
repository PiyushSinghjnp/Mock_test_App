/**
 * Live Oliveboard Remote Browser & Reverse-Engineering Engine
 *
 * Uses Playwright Chromium to open https://www.oliveboard.in & https://u1.oliveboard.in
 * in a persistent session streamed to the browser UI so the user can:
 * 1. Log in manually to their Oliveboard account
 * 2. Open the Mock Test Dashboard (u1.oliveboard.in/exams/) and reverse-engineer it
 * 3. Start any Live Mock Test (u1.oliveboard.in/exams/tests/part.php) and reverse-engineer 100% of its DOM, CSS, JS, and encrypted Base64 questions
 * 4. Submit the test to open the Solution Window (u1.oliveboard.in/exams/solution/index3.php) and reverse-engineer 100% of the Solution UI, official answer keys (quesAnswer), and explanations
 */

const fs = require('fs');
const path = require('path');

let playwrightPkg = null;
try {
  playwrightPkg = require('/root/.bun/install/global/node_modules/playwright');
} catch (e) {
  try {
    playwrightPkg = require('playwright');
  } catch (e2) {
    console.warn('Playwright package not found:', e2.message);
  }
}

const PROFILE_DIR = path.join(__dirname, '.oliveboard-profile');
const SCRAPED_DIR = path.join(__dirname, 'scraped');
const PAPERS_DIR = path.join(__dirname, 'papers');

if (!fs.existsSync(SCRAPED_DIR)) fs.mkdirSync(SCRAPED_DIR, { recursive: true });
if (!fs.existsSync(PAPERS_DIR)) fs.mkdirSync(PAPERS_DIR, { recursive: true });

let browserContext = null;
let activePageIndex = 0;
let isStarting = false;
let lastCapturedArtifacts = [];

function getPages() {
  if (!browserContext) return [];
  return browserContext.pages().filter(p => !p.isClosed());
}

function getActivePage() {
  const pages = getPages();
  if (pages.length === 0) return null;
  if (activePageIndex >= pages.length || activePageIndex < 0) {
    activePageIndex = pages.length - 1;
  }
  return pages[activePageIndex];
}

async function ensureBrowserStarted(initialUrl) {
  if (!playwrightPkg) {
    throw new Error('Playwright Chromium is not available in this environment.');
  }
  if (browserContext) {
    const pages = getPages();
    if (pages.length > 0) {
      if (initialUrl) {
        const page = getActivePage();
        await page.goto(initialUrl, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
      }
      return getActivePage();
    }
  }

  if (isStarting) {
    // Wait briefly if already starting
    for (let i = 0; i < 30; i++) {
      await new Promise(r => setTimeout(r, 300));
      if (browserContext && getPages().length > 0) return getActivePage();
    }
  }

  isStarting = true;
  try {
    if (!fs.existsSync(PROFILE_DIR)) {
      fs.mkdirSync(PROFILE_DIR, { recursive: true });
    }

    browserContext = await playwrightPkg.chromium.launchPersistentContext(PROFILE_DIR, {
      headless: true,
      viewport: { width: 1280, height: 760 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled',
        '--disable-popup-blocking'
      ]
    });

    // Ensure popups (like Oliveboard's Take Test / Solutions window.open) automatically become the active tab
    browserContext.on('page', async (newPage) => {
      try {
        await newPage.setViewportSize({ width: 1280, height: 760 });
        const pages = getPages();
        activePageIndex = pages.indexOf(newPage);
        if (activePageIndex === -1) activePageIndex = pages.length - 1;
        console.log('[Oliveboard Live Browser] New popup/tab opened:', newPage.url());
      } catch (e) {
        // Ignore if page closed immediately
      }
    });

    browserContext.on('close', () => {
      browserContext = null;
      activePageIndex = 0;
    });

    let page = getPages()[0];
    if (!page) {
      page = await browserContext.newPage();
    }
    await page.setViewportSize({ width: 1280, height: 760 });
    activePageIndex = 0;

    const targetUrl = initialUrl || 'https://www.oliveboard.in/?next=https%3A%2F%2Fu1.oliveboard.in%2Fexams%2F%3Fc%3Dsbipopre19%26i%3Dbanking';
    if (page.url() === 'about:blank' || initialUrl) {
      await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(err => {
        console.warn('[Oliveboard Live Browser] Navigation warning:', err.message);
      });
    }

    return page;
  } finally {
    isStarting = false;
  }
}

async function detectPageStage(page) {
  if (!page) return { stage: 'disconnected', label: 'Browser Not Started' };
  const url = page.url() || '';
  try {
    const info = await page.evaluate(() => {
      const hasLoginModal = !!document.querySelector('#login-modal, .wrapper1, input[type="password"], #email, .login-box');
      const hasLiveTest = !!document.querySelector('#main-container, #question-outer-pane, #question-inner-pane, #left-container-post');
      const hasInstructions = !!document.querySelector('.instruction-pane-1, #start-test');
      const isInstrVisible = hasInstructions && (() => {
        const el = document.querySelector('#left-container, .instruction-pane-1');
        return el && window.getComputedStyle(el).display !== 'none';
      })();
      const hasSolutions = window.location.href.includes('solution') || typeof window.quesAnswer !== 'undefined' || !!document.querySelector('#sol-box, .soln-box, #ans-box');
      const eqtCount = document.querySelectorAll('.eqt').length;
      return { hasLoginModal, hasLiveTest, isInstrVisible, hasSolutions, eqtCount };
    });

    if (info.hasSolutions || url.includes('/solution/')) {
      return { stage: 'solutions', label: '4. Post-Submit Solution Window (Ready to Scrape Solutions)', info };
    }
    if (info.hasLiveTest && !info.isInstrVisible) {
      return { stage: 'live_test', label: `3. Active Live Mock Test (${info.eqtCount} Encrypted Nodes Detected)`, info };
    }
    if (info.isInstrVisible || url.includes('/tests/part.php')) {
      return { stage: 'instructions', label: '2. Pre-Test Instructions Window (Ready to Scrape & Start)', info };
    }
    if (url.includes('u1.oliveboard.in') || url.includes('/exams')) {
      return { stage: 'dashboard', label: '1. Oliveboard Mock Test Dashboard (Ready to Scrape & Launch Test)', info };
    }
    if (info.hasLoginModal) {
      return { stage: 'login', label: '0. Oliveboard Login Page (Log in manually below)', info };
    }
    return { stage: 'browsing', label: 'Oliveboard Web Session Active', info };
  } catch (e) {
    return { stage: 'loading', label: 'Page Loading...' };
  }
}

/**
 * Deep Reverse Engineering & Decryption of the currently open Oliveboard page
 */
async function scrapeAndReverseEngineerActivePage(page, ingestCallback) {
  if (!page) throw new Error('No active Oliveboard page to scrape.');

  const currentUrl = page.url();
  const title = await page.title().catch(() => 'Oliveboard Page');
  const timestamp = Date.now();

  const scrapedData = await page.evaluate(() => {
    const decodeB64UTF8 = (b64) => {
      try {
        const clean = (b64 || '').trim().replace(/\s+/g, '');
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

    // 1. Capture DOM Structure & Key Containers
    const html = document.documentElement.outerHTML;

    // 2. Capture Stylesheet links & inline styles
    const stylesheets = Array.from(document.querySelectorAll('link[rel="stylesheet"]')).map(l => l.href);
    const inlineStyles = Array.from(document.querySelectorAll('style')).map(s => s.innerHTML);

    // 3. Capture Global Window State (Oliveboard test & solution globals)
    const globals = {};
    const globalKeys = [
      'qarray', 'quesAnswer', 'user_resp', 'sec_list', 'sec_names', 'sec_time',
      'total_q', 'total_time', 'test_name', 'test_id', 'course', 'negative_marks',
      'marks_per_question', 'sol_array', 'topper_time', 'avg_time'
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

    // 4. Decrypt any Base64 .eqt / .hqt question blocks if on Live Test or Solution page
    const decryptedQuestions = [];
    const qContainers = document.querySelectorAll('[id^="q-"], .question-box, .q-box');

    // Check if Oliveboard standard #q-1, #q-2 ... or .eqt nodes exist
    const allEqt = Array.from(document.querySelectorAll('.eqt'));
    if (qContainers.length > 0) {
      qContainers.forEach((qEl, idx) => {
        const qid = qEl.id || `q-${idx + 1}`;
        const eqtNodes = Array.from(qEl.querySelectorAll('.eqt')).map(el => decodeB64UTF8(el.innerHTML));
        const hqtNodes = Array.from(qEl.querySelectorAll('.hqt')).map(el => decodeB64UTF8(el.innerHTML));
        decryptedQuestions.push({
          qid,
          index: idx + 1,
          eqtDecoded: eqtNodes,
          hqtDecoded: hqtNodes
        });
      });
    } else if (allEqt.length > 0) {
      // Group .eqt nodes (Oliveboard live player typically has 7 .eqt nodes per question: 1 passage, 1 question, 5 options)
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
            section: 'EL',
            hasPassage: passageHTML.replace(/<[^>]+>/g, '').trim().length > 20,
            passageHTML,
            questionHTML,
            options: opts
          });
        }
      }
    }

    // 5. Extract Solution explanations if on solution window
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

    // Also check DOM solution containers (#sol-1, .solution-text, etc.)
    document.querySelectorAll('[id^="sol"], .solution-content, .exp-box').forEach((el, i) => {
      const key = el.id || `dom_sol_${i + 1}`;
      extractedSolutions[key] = el.innerHTML;
    });

    // 6. Extract Mock Test Cards if on Dashboard
    const dashboardCards = Array.from(document.querySelectorAll('.test-card, .mock-card, .exam-card, .panel, .card-box, tr[id^="test"]')).slice(0, 50).map(el => ({
      id: el.id || '',
      className: el.className || '',
      text: (el.innerText || '').trim().slice(0, 300)
    })).filter(c => c.text.length > 10);

    // 7. Capture Computed Styles of Key Oliveboard Elements for 1:1 UI Parity
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
      html,
      stylesheets,
      inlineStylesCount: inlineStyles.length,
      globals,
      decryptedQuestionsCount: decryptedQuestions.length,
      decryptedQuestions,
      extractedSolutionsCount: Object.keys(extractedSolutions).length,
      extractedSolutions,
      dashboardCardsCount: dashboardCards.length,
      dashboardCards,
      computedUI
    };
  });

  // Save raw HTML snapshot & JSON spec to /scraped/
  const safeSlug = (title || 'oliveboard_page').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'page';
  const htmlFilename = `live_capture_${safeSlug}_${timestamp}.html`;
  const jsonFilename = `live_spec_${safeSlug}_${timestamp}.json`;

  fs.writeFileSync(path.join(SCRAPED_DIR, htmlFilename), scrapedData.html, 'utf8');

  const specSummary = {
    capturedAt: new Date().toISOString(),
    url: scrapedData.url,
    title: scrapedData.title,
    htmlFile: `scraped/${htmlFilename}`,
    stylesheets: scrapedData.stylesheets,
    globals: scrapedData.globals,
    computedUI: scrapedData.computedUI,
    decryptedQuestionsCount: scrapedData.decryptedQuestionsCount,
    extractedSolutionsCount: scrapedData.extractedSolutionsCount,
    dashboardCardsCount: scrapedData.dashboardCardsCount,
    dashboardCards: scrapedData.dashboardCards
  };
  fs.writeFileSync(path.join(SCRAPED_DIR, jsonFilename), JSON.stringify(specSummary, null, 2), 'utf8');

  let ingestedTest = null;
  // If questions were decrypted from the live test or solution window, save as a paper JSON and auto-ingest!
  if (scrapedData.decryptedQuestions && scrapedData.decryptedQuestions.length > 0 && scrapedData.decryptedQuestions[0].questionHTML) {
    const paperPayload = {
      id: `live-ob-${safeSlug}`,
      testTitle: scrapedData.title || 'Oliveboard Live Scraped Mock Test',
      totalQuestions: scrapedData.decryptedQuestions.length,
      questions: scrapedData.decryptedQuestions.map((q, idx) => {
        const sol = scrapedData.extractedSolutions[q.qid] || scrapedData.extractedSolutions[idx + 1] || null;
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
    url: scrapedData.url,
    title: scrapedData.title,
    htmlFile: `scraped/${htmlFilename}`,
    specFile: `scraped/${jsonFilename}`,
    uiElementsMatched: Object.keys(scrapedData.computedUI).length,
    decryptedQuestionsCount: scrapedData.decryptedQuestionsCount,
    extractedSolutionsCount: scrapedData.extractedSolutionsCount,
    dashboardCardsCount: scrapedData.dashboardCardsCount,
    ingestedTestId: ingestedTest ? ingestedTest.id : null
  };
  lastCapturedArtifacts.unshift(artifactRecord);

  return artifactRecord;
}

function mountOliveboardLiveBrowserRoutes(app, ingestBackendPaperFile) {
  // 1. Start or Attach to Live Oliveboard Browser Session
  app.post('/api/ob-browser/start', async (req, res) => {
    try {
      const { url } = req.body || {};
      const page = await ensureBrowserStarted(url);
      const pages = getPages();
      const stageInfo = await detectPageStage(page);
      res.json({
        success: true,
        url: page.url(),
        title: await page.title().catch(() => ''),
        activeTabIndex: activePageIndex,
        tabs: await Promise.all(pages.map(async (p, idx) => ({
          index: idx,
          url: p.url(),
          title: await p.title().catch(() => `Tab ${idx + 1}`)
        }))),
        stage: stageInfo
      });
    } catch (err) {
      console.error('[Oliveboard Live Browser] Start error:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // 2. Get Live Frame Screenshot & Tab/Stage Metadata
  app.get('/api/ob-browser/frame', async (req, res) => {
    try {
      const page = getActivePage();
      if (!page) {
        return res.json({
          success: false,
          started: false,
          message: 'Browser not started yet.'
        });
      }

      const screenshotBuffer = await page.screenshot({
        type: 'jpeg',
        quality: 75,
         animations: 'disabled'
      });
      const pages = getPages();
      const stageInfo = await detectPageStage(page);

      res.json({
        success: true,
        started: true,
        url: page.url(),
        title: await page.title().catch(() => ''),
        activeTabIndex: activePageIndex,
        tabs: await Promise.all(pages.map(async (p, idx) => ({
          index: idx,
          url: p.url(),
          title: await p.title().catch(() => `Tab ${idx + 1}`)
        }))),
        stage: stageInfo,
        capturedArtifacts: lastCapturedArtifacts.slice(0, 10),
        imageBase64: `data:image/jpeg;base64,${screenshotBuffer.toString('base64')}`
      });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // 3. Forward User Mouse / Keyboard / Navigation Input to Playwright Page
  app.post('/api/ob-browser/input', async (req, res) => {
    try {
      const page = getActivePage();
      if (!page) {
        return res.status(400).json({ success: false, error: 'Browser not running' });
      }

      const { action, x, y, deltaX, deltaY, key, text, url, tabIndex } = req.body || {};

      if (action === 'click') {
        await page.mouse.click(Number(x) || 0, Number(y) || 0);
      } else if (action === 'dblclick') {
        await page.mouse.dblclick(Number(x) || 0, Number(y) || 0);
      } else if (action === 'wheel') {
        await page.mouse.wheel(Number(deltaX) || 0, Number(deltaY) || 0);
      } else if (action === 'keydown' && key) {
        await page.keyboard.press(key);
      } else if (action === 'type' && text !== undefined) {
        await page.keyboard.type(String(text));
      } else if (action === 'navigate' && url) {
        const target = url.startsWith('http') ? url : `https://${url}`;
        await page.goto(target, { waitUntil: 'domcontentloaded', timeout: 25000 }).catch(() => {});
      } else if (action === 'reload') {
        await page.reload({ waitUntil: 'domcontentloaded', timeout: 25000 }).catch(() => {});
      } else if (action === 'goBack') {
        await page.goBack({ waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});
      } else if (action === 'switchTab' && tabIndex !== undefined) {
        const pages = getPages();
        if (tabIndex >= 0 && tabIndex < pages.length) {
          activePageIndex = Number(tabIndex);
          await pages[activePageIndex].bringToFront().catch(() => {});
        }
      } else if (action === 'closeTab' && tabIndex !== undefined) {
        const pages = getPages();
        if (pages.length > 1 && tabIndex >= 0 && tabIndex < pages.length) {
          await pages[tabIndex].close().catch(() => {});
          activePageIndex = Math.max(0, getPages().length - 1);
        }
      }

      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // 4. Deep Reverse-Engineer & Scrape Current Oliveboard Page
  app.post('/api/ob-browser/scrape', async (req, res) => {
    try {
      const page = getActivePage();
      if (!page) {
        return res.status(400).json({ success: false, error: 'Browser not running' });
      }
      const result = await scrapeAndReverseEngineerActivePage(page, ingestBackendPaperFile);
      res.json({
        success: true,
        result,
        history: lastCapturedArtifacts.slice(0, 10)
      });
    } catch (err) {
      console.error('[Oliveboard Live Browser] Scrape error:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });
}

module.exports = {
  mountOliveboardLiveBrowserRoutes,
  ensureBrowserStarted
};
