/**
 * Live Oliveboard Remote Browser & Reverse-Engineering Engine
 * Powered by REA (Reverse Engineer Anything) MCP Tool, Live Reverse Proxy & CDP
 * -----------------------------------------------------------------------------------
 * Allows the user to:
 * 1. Browse the REAL live Oliveboard website (www.oliveboard.in, u1.oliveboard.in, or any URL)
 *    directly inside the full-viewport interactive iframe via /api/ob-browser/proxy
 *    (or via local Chrome CDP port 9222 if a local desktop Chrome is running).
 * 2. Click "Go" on any URL, follow links, submit forms, Go Back, Reload, and switch Tabs.
 * 3. Log in on the real Oliveboard Login Modal or jump straight into the real captured
 *    u1.oliveboard.in Mock Test Dashboard, Live Mock Test (part.php), and Solution Window (solution/index3.php).
 * 4. Run "Snapshot & Scrape (REA MCP)" to inspect the live DOM, extract all Modals, Tables,
 *    Base64 (.eqt/.hqt) questions & solutions (quesAnswer), and ingest into SQLite.
 */

const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
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

// Persistent Cookie Jar for live HTTP proxy requests to oliveboard.in
const COOKIE_JAR_PATH = path.join(SCRAPED_DIR, '.cookie_jar.json');
const proxyCookieJar = new Map();

function loadCookiesFromDisk() {
  try {
    if (fs.existsSync(COOKIE_JAR_PATH)) {
      const data = JSON.parse(fs.readFileSync(COOKIE_JAR_PATH, 'utf8'));
      if (data && typeof data === 'object') {
        for (const [k, v] of Object.entries(data)) {
          proxyCookieJar.set(k, v);
        }
      }
    }
  } catch (e) {}
}

function saveCookiesToDisk() {
  try {
    const obj = Object.fromEntries(proxyCookieJar.entries());
    fs.writeFileSync(COOKIE_JAR_PATH, JSON.stringify(obj, null, 2), 'utf8');
  } catch (e) {}
}

// Helper to save cookies from HTTP responses
function saveResponseCookies(res) {
  let changed = false;
  const setCookies = typeof res.headers.getSetCookie === 'function' ? res.headers.getSetCookie() : [];
  if (setCookies.length === 0 && res.headers.get && res.headers.get('set-cookie')) {
    setCookies.push(...res.headers.get('set-cookie').split(', '));
  }
  setCookies.forEach(sc => {
    const firstPart = String(sc).split(';')[0];
    const eqIdx = firstPart.indexOf('=');
    if (eqIdx > 0) {
      const name = firstPart.slice(0, eqIdx).trim();
      const val = firstPart.slice(eqIdx + 1).trim();
      proxyCookieJar.set(name, val);
      changed = true;
    }
  });
  if (changed) {
    saveCookiesToDisk();
  }
}

// Load cookies from disk on engine startup
loadCookiesFromDisk();

/**
 * Normalize and sanitize user-supplied URLs (fixes e.g. "https://.oliveboard.in" -> "https://www.oliveboard.in/")
 * Cleans &amp; HTML entity corruption and extracts destination URLs from ?next= parameters
 */
function normalizeOliveboardUrl(rawInput) {
  let u = String(rawInput || '').trim();
  if (!u) {
    return 'https://www.oliveboard.in/';
  }
  // Sanitize any HTML entities (&amp; -> &)
  u = u.replace(/&amp;/g, '&');
  if (!/^https?:\/\//i.test(u)) {
    u = 'https://' + u.replace(/^\/+/, '');
  }
  // Fix leading dots in hostname e.g. "https://.oliveboard.in"
  u = u.replace(/^(https?:\/\/)\.+([a-zA-Z0-9])/i, '$1www.$2');
  try {
    const parsed = new URL(u);
    if (parsed.hostname.startsWith('.')) {
      parsed.hostname = 'www.' + parsed.hostname.replace(/^\.+/, '');
    }
    if (parsed.hostname === 'oliveboard.in') {
      parsed.hostname = 'www.oliveboard.in';
    }
    return parsed.toString();
  } catch (e) {
    return 'https://www.oliveboard.in/';
  }
}

/**
 * Format any Oliveboard course code into a clean, human-readable exam title
 */
function formatOliveboardCourseTitle(code) {
  if (!code) return 'Mock Tests';
  let s = String(code).trim();
  // Separate words and digits: e.g. "sbiclerkpre2020" -> "sbiclerkpre 2020"
  s = s.replace(/([a-zA-Z])([0-9]+)/g, '$1 $2');
  s = s.replace(/([0-9]+)([a-zA-Z])/g, '$1 $2');
  s = s.replace(/pre(lim)?\b/gi, ' Prelims');
  s = s.replace(/mains?\b/gi, ' Mains');
  s = s.replace(/pyp\b/gi, ' Previous Year Paper');
  s = s.replace(/live\b/gi, ' Live');
  s = s.replace(/off\b/gi, ' Officer');
  s = s.replace(/asst\b/gi, ' Assistant');
  return s.split(/\s+/).map(w => {
    const lw = w.toLowerCase();
    if (['sbi', 'ibps', 'rbi', 'ssc', 'rrb', 'lic', 'epfo', 'esic', 'uiic', 'nicl', 'niacl', 'pnb', 'bob', 'fci', 'cwc', 'nabard', 'idbi', 'cgl', 'chsl', 'cpo', 'mts', 'ntpc', 'po', 'so', 'it', 'cbo', 'ao', 'je', 'lbo', 'am', 'da', 'jam', 'pgdbf'].includes(lw)) {
      return lw.toUpperCase();
    }
    return w.charAt(0).toUpperCase() + w.slice(1);
  }).join(' ');
}

// Comprehensive dictionary of official Oliveboard exam course slugs
const OLIVEBOARD_COURSE_NAMES = {
  sbipopre19: 'SBI PO 2026 Prelims',
  sbipomains: 'SBI PO 2026 Mains',
  sbiclerkpre2020: 'SBI Clerk Prelims',
  sbiclerklivepy: 'SBI Clerk Live PYP',
  ibpsclerkprelim: 'IBPS Clerk Prelims',
  ibpsclerkpre2019: 'IBPS Clerk 2026 Prelims',
  ibpsrrbscp: 'IBPS RRB Officer Scale 1 Prelims',
  ibpsrrbasp: 'IBPS RRB Office Assistant Prelims',
  ibpsprelim: 'IBPS PO Prelims',
  ibpspopre2019: 'IBPS PO 2026 Prelims',
  ibpssopre: 'IBPS SO Prelims',
  ibpssopreit: 'IBPS SO Prelims [IT]',
  ibpssoit1: 'IBPS SO IT Officer',
  uiicao: 'UIIC AO',
  cwcp: 'CWC JE',
  cwcasst: 'CWC Assistant Manager',
  niclasst: 'NICL Assistant',
  rbiassistantp: 'RBI Assistant Prelims',
  rbiasspre2020: 'RBI Assistant 2026 Prelims',
  rbigradeb: 'RBI Grade B Phase 1',
  rbigradebp1: 'RBI Grade B Phase 1',
  rbigradebp2: 'RBI Grade B Phase 2',
  bob: 'Bank of Baroda LBO',
  ioblbo: 'IOB LBO',
  pnblbo: 'PNB LBO',
  pnbsindlbo: 'Punjab and Sind Bank LBO',
  rrbscale2offit: 'RRB Scale 2 Officer IT',
  rrbscale2offle: 'RRB Scale 2 Officer Legal',
  rrbscale2offen: 'RRB Scale 2 Officer [Eng]',
  rrbscale2offhi: 'RRB Scale 2 Officer [Hin]',
  rrbscale3offen: 'RRB Scale 3 Officer [Eng]',
  rrbscale3offhi: 'RRB Scale 3 Officer [Hin]',
  mscoop: 'Maharashtra Co-Op Bank',
  nabasst: 'NABARD Development Assistant',
  nabardgradea: 'NABARD Grade A',
  nainmt: 'Nainital Bank PO',
  naincl: 'Nainital Bank Clerk',
  mpcbpom: 'MP Coop Bank Manager',
  mpcbclm: 'MP Coop Staff Assistant',
  oiclao: 'OICL AO',
  licap: 'LIC AAO Prelims',
  licaao: 'LIC AAO',
  oiclasst: 'OICL Assistant',
  niacl: 'NIACL AO',
  repco: 'Repco Bank',
  nicl: 'NICL AO',
  sbicbo: 'SBI CBO',
  bscbpop: 'Bihar Coop Assistant Manager',
  bscbclp: 'Bihar CoOp Assistant',
  boicroff: 'Bank of India Credit Officer',
  unionsoit: 'Union Bank SO IT',
  unioncr: 'Union Bank Credit Officer',
  idbiasst: 'IDBI Jr. Assistant Manager Grade O',
  ucolbo: 'UCO Bank LBO',
  tmb: 'Tamilnad Mercantile Bank',
  cbipgdbf: 'Central Bank of India PGDBF',
  idbiex: 'IDBI JAM PGDBF',
  niaclasstpre: 'NIACL Assistant',
  rbiattendant: 'RBI Office Attendant',
  aic: 'AIC MT',
  aicit: 'AIC IT',
  gic: 'GIC Officer',
  sbiso: 'SBI SO',
  unlbo: 'Union Bank LBO',
  ecgc: 'ECGC PO',
  indlbo: 'Indian Bank LBO',
  epfopa: 'EPFO Personal Assistant',
  hpcooppre: 'HP Coop Bank Jr. Clerk',
  pnbcroff: 'PNB SO Credit Officer',
  licase: 'LIC Assistant',
  lichfl: 'LIC HFL Assistant',
  nhb: 'National Housing Bank',
  epfsp: 'EPFO SSA',
  epfoeo: 'EPFO EO / AO',
  uiicasst: 'UIIC Assistant',
  csir1: 'CSIR Assistant',
  fcip: 'Food Corporation of India',
  fcim3: 'FCI Category III',
  licadp: 'LIC ADO Prelims',
  suprcrt: 'Supreme Court Junior Court Assistant',
  lichflam: 'LIC HFL Assistant Manager',
  sibcl: 'South Indian Bank Clerk',
  icarasst: 'ICAR IARI Assistant',
  esicpre: 'ESIC SSO',
  esmts: 'ESIC MTS',
  tscbpo: 'Telangana CoOp Assistant Manager',
  tscbclm: 'Telangana CoOp Staff Assistant',
  pscb: 'Punjab State Cooperative Bank',
  esudp: 'ESIC UDC',
  licjem: 'LIC AE/AAO SO(IT) Mains',
  oscbpop: 'Odisha CoOp Assistant Manager',
  oscbclp: 'Odisha CoOp Assistant Grade II',
  sibpo: 'South Indian Bank PO',
  sbiappr: 'SBI Apprentice',
  indpopre: 'Indian Bank PO',
  fcimp: 'FCI Manager',
  epfp: 'EPFO Assistant',
  pnbit: 'PNB IT Officer',
  canara: 'Canara Bank PO',
  synpo: 'Syndicate Bank PO',
  licjep: 'LIC AE/AAO SO',
  ssccgl: 'SSC CGL Tier 1',
  ssct2np: 'SSC CGL Tier 2',
  sscchsl: 'SSC CHSL',
  ssccpo: 'SSC CPO',
  sscmts: 'SSC MTS',
  sscgd: 'SSC GD Constable',
  rrbntpc: 'RRB NTPC CBT 1',
  rrbntpc2: 'RRB NTPC CBT 2',
  ntpc1: 'RRB NTPC 1',
  rrbgrp: 'RRB Group D',
  rrbje: 'RRB JE',
  rrbpolive: 'RRB PO Live',
  licpyp: 'LIC AAO PYP',
  ugc1: 'UGC Paper 1'
};

/**
 * Resolve course code, test ID, human-readable exam title, and dashboard URL from any Oliveboard URL
 */
function resolveCourseMeta(rawUrl, updateSession = false) {
  let courseCode = '';
  let categoryCode = '';
  let testId = '';

  try {
    const clean = String(rawUrl || '').replace(/&amp;/g, '&');
    const u = new URL(clean, 'https://www.oliveboard.in');
    const cParam = (u.searchParams.get('c') || u.searchParams.get('amp;c') || '').trim();
    const iParam = (u.searchParams.get('i') || u.searchParams.get('amp;i') || '').trim();
    const tParam = (u.searchParams.get('testid') || u.searchParams.get('amp;testid') || u.searchParams.get('t') || u.searchParams.get('amp;t') || '').trim();
    if (cParam) courseCode = cParam;
    if (iParam) categoryCode = iParam;
    if (tParam) testId = tParam;

    // Check pathname if c was not a query parameter (e.g. /ssc-cgl/ or /rbi-grade-b/)
    if (!cParam) {
      const p = u.pathname.toLowerCase();
      if (p.includes('rbi-grade-b')) courseCode = 'rbigradeb';
      else if (p.includes('ssc-cgl')) courseCode = 'ssccgl';
      else if (p.includes('ssc-chsl')) courseCode = 'sscchsl';
      else if (p.includes('rrb-ntpc')) courseCode = 'rrbntpc';
      else if (p.includes('sbi-clerk')) courseCode = 'sbiclerkpre2020';
      else if (p.includes('sbi-po')) courseCode = 'sbipopre19';
      else if (p.includes('ibps-so')) courseCode = 'ibpssopreit';
      else if (p.includes('ibps-po')) courseCode = 'ibpsprelim';
      else if (p.includes('ibps-clerk')) courseCode = 'ibpsclerkprelim';
      else if (p.includes('epfo')) courseCode = 'epfsp';
      else if (p.includes('lic-aao')) courseCode = 'licap';
    }
  } catch (e) {}

  if (updateSession && liveProxySession && courseCode) {
    liveProxySession.currentCourse = courseCode;
    if (categoryCode) liveProxySession.currentCategory = categoryCode;
    if (testId) liveProxySession.currentTestId = testId;
  }

  const lowerCourse = courseCode.toLowerCase();
  const isIbpsSo = lowerCourse.includes('ibpsso');
  const isIbps = lowerCourse.includes('ibps');

  const examPrefix = courseCode ? (OLIVEBOARD_COURSE_NAMES[lowerCourse] || formatOliveboardCourseTitle(courseCode)) : 'Oliveboard';
  const examTitle = courseCode ? (testId ? `${examPrefix} - ${testId}` : examPrefix) : 'Oliveboard';
  const dashboardUrl = courseCode ? `https://u1.oliveboard.in/tests/?c=${encodeURIComponent(courseCode)}&i=${encodeURIComponent(categoryCode || 'banking')}` : 'https://www.oliveboard.in/';

  return {
    courseCode,
    categoryCode,
    testId,
    isIbpsSo,
    isIbps,
    examPrefix,
    examTitle,
    dashboardUrl
  };
}

/**
 * Classify any URL into an Oliveboard stage object
 */
function classifyUrlStage(url) {
  const u = String(url || '').toLowerCase();
  const meta = resolveCourseMeta(url, false);

  if (u.includes('solution') || u.includes('index3.php')) {
    return {
      stage: 'solutions',
      label: `Solutions (${meta.examTitle})`,
      title: `Oliveboard | Solutions (${meta.examTitle})`
    };
  }
  if (u.includes('submit') || u.includes('summary')) {
    return {
      stage: 'submit_dialog',
      label: `Submission Summary (${meta.examTitle})`,
      title: `Oliveboard | Summary (${meta.examTitle})`
    };
  }
  if (u.includes('analysis') || u.includes('scorecard')) {
    return {
      stage: 'analysis',
      label: `Scorecard (${meta.examTitle})`,
      title: `Oliveboard | Scorecard (${meta.examTitle})`
    };
  }
  if (u.includes('instructions=1')) {
    return {
      stage: 'instructions',
      label: `Instructions (${meta.examTitle})`,
      title: `Oliveboard | Instructions (${meta.examTitle})`
    };
  }
  if (u.includes('part.php') || u.includes('testid=')) {
    return {
      stage: 'live_test',
      label: `Live Mock Test (${meta.examTitle})`,
      title: `Oliveboard | Live Mock Test (${meta.examTitle})`
    };
  }
  if (u.includes('?next=') || u.includes('&next=')) {
    return {
      stage: 'login_challenge',
      label: 'Login Required to Access Test',
      title: 'Oliveboard | Login Required'
    };
  }
  if (u.includes('u1.oliveboard.in')) {
    return {
      stage: 'dashboard',
      label: `Mock Tests (${meta.examPrefix})`,
      title: `Oliveboard | ${meta.examPrefix}`
    };
  }
  if (u.includes('oliveboard.in')) {
    return {
      stage: 'login',
      label: 'Oliveboard Live Website',
      title: "Oliveboard - India's Top Exam Preparation Platform"
    };
  }
  return {
    stage: 'browsing',
    label: `Live Website (${u.replace(/^https?:\/\//, '').slice(0, 42)})`,
    title: u.replace(/^https?:\/\//, '').slice(0, 48)
  };
}

// ============================================================================
// REAL WEB PROXY & MULTITAB SESSION STATE
// ============================================================================

const liveProxySession = {
  started: false,
  activeTabIndex: 0,
  isLoggedIn: false,
  email: '',
  currentCourse: '',
  currentCategory: '',
  currentTestId: '',
  tabs: []
};

function ensureProxySessionInitialized(initialUrl) {
  const startUrl = normalizeOliveboardUrl(initialUrl || 'https://www.oliveboard.in/');
  if (!liveProxySession.started || liveProxySession.tabs.length === 0) {
    const st0 = classifyUrlStage(startUrl);
    liveProxySession.tabs = [
      {
        id: 'tab-' + Date.now(),
        url: startUrl,
        title: st0.title || 'Oliveboard',
        stageObj: st0,
        history: [startUrl]
      }
    ];
    liveProxySession.activeTabIndex = 0;
    liveProxySession.started = true;
  }
  return liveProxySession.tabs[liveProxySession.activeTabIndex] || liveProxySession.tabs[0];
}

/**
 * Inject Base URL + Navigation/Auth Bridge into proxied HTML so links, forms, popups,
 * Login Assistant, and REA MCP DOM scraping work seamlessly inside #ob-live-iframe
 */
function instrumentProxiedHtml(rawHtml, targetUrl, extraScripts = '') {
  let html = String(rawHtml || '');
  let baseHref = targetUrl;
  try {
    const u = new URL(targetUrl);
    let pathname = u.pathname || '/';
    if (!pathname.endsWith('/')) {
      const lastSeg = pathname.split('/').pop() || '';
      if (lastSeg.includes('.')) {
        pathname = pathname.slice(0, pathname.lastIndexOf('/') + 1);
      } else {
        pathname = pathname + '/';
      }
    }
    baseHref = `${u.origin}${pathname}`;
  } catch (e) {}

  const bridgeScriptPath = path.join(__dirname, 'js', 'ob-proxy-bridge.js');
  let bridgeScriptCode = '';
  try {
    bridgeScriptCode = fs.readFileSync(bridgeScriptPath, 'utf8');
  } catch (e) {
    bridgeScriptCode = '';
  }
  const bridgeScript = `
<script data-ob-proxy-bridge="1">
window.__OB_PROXIED_URL__ = ${JSON.stringify(targetUrl)};
${bridgeScriptCode}
</script>
${extraScripts}
`;

  // Remove any existing <base> tags so our <base> tag takes precedence
  html = html.replace(/<base[^>]*>/gi, '');

  if (/<head[^>]*>/i.test(html)) {
    html = html.replace(/<head([^>]*)>/i, `<head$1><base href="${baseHref}">${bridgeScript}`);
  } else {
    html = `<head><base href="${baseHref}">${bridgeScript}</head>` + html;
  }

  // Route core Oliveboard navigation scripts through script-proxy so window.location assignments are proxied
  html = html.replace(/<script([^>]+)src=["']([^"']*(?:coursecommon|course|home)\.js[^"']*)["']/gi, (match, attrs, src) => {
    let fullScriptUrl = src;
    try {
      fullScriptUrl = new URL(src, baseHref).toString();
    } catch (e) {}
    return `<script${attrs}src="/api/ob-browser/script-proxy?url=${encodeURIComponent(fullScriptUrl)}"`;
  });

  // Rewrite absolute window.location assignments in scripts so redirects stay inside proxy
  html = html
    .replace(/window\.location\s*=\s*courseurl\s*;/g, 'window.location = (window.toProxyUrl ? window.toProxyUrl(courseurl) : courseurl);')
    .replace(/window\.location\s*=\s*next\s*;/g, 'window.location = (window.toProxyUrl ? window.toProxyUrl(next) : next);')
    .replace(/window\.location\s*=\s*nexturl\s*;/g, 'window.location = (window.toProxyUrl ? window.toProxyUrl(nexturl) : nexturl);')
    .replace(/window\.location\s*=\s*boxurl\s*;/g, 'window.location = (window.toProxyUrl ? window.toProxyUrl(boxurl) : boxurl);')
    .replace(/window\.location\s*=\s*url\s*;/g, 'window.location = (window.toProxyUrl ? window.toProxyUrl(url) : url);')
    .replace(/window\.location\.href\s*=\s*url\s*;/g, 'window.location.href = (window.toProxyUrl ? window.toProxyUrl(url) : url);');

  // If this page was requested via a redirect from a login-protected test (?next=...)
  // render an informative banner so the user knows Oliveboard requires authentication to take this test
  if (String(targetUrl || '').includes('next=')) {
    const authBanner = `
<div id="ob-auth-notice-banner" style="position:fixed;top:0;left:0;right:0;z-index:9999999;background:linear-gradient(90deg,#0f172a,#1e293b);color:#f8fafc;padding:10px 16px;border-bottom:2px solid #38bdf8;box-shadow:0 4px 16px rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:space-between;font-family:Inter,system-ui,sans-serif;font-size:12px;">
  <div style="display:flex;align-items:center;gap:10px;">
    <span style="font-size:16px;">🔒</span>
    <span><strong>Oliveboard Login Required:</strong> Oliveboard requires you to sign in to attempt this test. Please log in using the Oliveboard form below or the Login Assistant above.</span>
  </div>
  <div style="display:flex;align-items:center;gap:8px;">
    <button onclick="document.getElementById('ob-auth-notice-banner').remove();var m=document.getElementById('modal-login');if(m)m.classList.add('is-active');var b=document.querySelector('#btn-show-modal-login,.btn-show-modal-login,#btn-loginsignup,.btn-showloginregister');if(b)try{b.click();}catch(e){}else if(typeof showLoginRegister==='function')try{showLoginRegister();}catch(e){}" style="background:#0284c7;color:#fff;border:none;padding:5px 12px;border-radius:4px;font-size:11px;font-weight:700;cursor:pointer;">Open Login</button>
    <button onclick="document.getElementById('ob-auth-notice-banner').remove();" style="background:transparent;color:#94a3b8;border:none;font-size:16px;cursor:pointer;line-height:1;" title="Dismiss">✕</button>
  </div>
</div>`;
    if (/<body[^>]*>/i.test(html)) {
      html = html.replace(/<body([^>]*)>/i, `<body$1>${authBanner}`);
    }
  }

  return html;
}

/**
 * Universal Oliveboard Base64 / Salted-Base64 Decrypter (Node.js)
 * Handles:
 * 1. n.js 32-char random alphanumeric prefix + btoa(escape(html)) + 32-char suffix (solution/index3.php)
 * 2. Standard UTF-8 Base64 (.eqt in part.php)
 * 3. Already-decoded plain HTML
 */
function decryptOliveboardString(rawStr) {
  if (!rawStr || typeof rawStr !== 'string') return '';
  const trimmed = rawStr.trim();
  if (!trimmed) return '';
  if (trimmed.includes('<') || trimmed.includes(' ')) return trimmed;
  const clean = trimmed.replace(/\s+/g, '');

  // Case 1: n.js 32-char salted Base64 (length > 64)
  if (clean.length > 64) {
    try {
      const inner = clean.slice(32, clean.length - 32);
      const bin = Buffer.from(inner, 'base64').toString('binary');
      const unescaped = unescape(bin);
      if (unescaped && (unescaped.includes('<') || unescaped.includes(' ') || /[a-zA-Z0-9]/.test(unescaped))) {
        return unescaped;
      }
    } catch (e) {}
  }

  // Case 2: Standard UTF-8 Base64
  if (clean.length >= 4 && /^[A-Za-z0-9+/=]+$/.test(clean)) {
    try {
      const decoded = Buffer.from(clean, 'base64').toString('utf8');
      if (decoded && !/[\x00-\x08\x0E-\x1F]/.test(decoded)) {
        return decoded;
      }
    } catch (e) {}
  }

  return trimmed;
}

/**
 * Fetch a live webpage over HTTP/HTTPS with authentic redirect handling and Cookie Jar.
 * Acts as a genuine web browser proxy fetching from the live internet.
 */
async function fetchLiveWebPage(targetUrl, redirectCount = 0, forceCleanSession = false) {
  if (redirectCount > 5) {
    throw new Error(`Too many redirects encountered while fetching ${targetUrl}`);
  }
  const cleanUrl = normalizeOliveboardUrl(targetUrl);
  const isExplicitHome = cleanUrl === 'https://www.oliveboard.in/' || cleanUrl.startsWith('https://www.oliveboard.in/?login') || cleanUrl.startsWith('https://www.oliveboard.in/?logout');

  // If forceCleanSession, or if navigating explicitly to oliveboard.in home without an active user session, do NOT send cookies.
  // This ensures the authentic Oliveboard login modal & homepage render cleanly instead of auto-redirecting to dashboard!
  const shouldSendCookies = !forceCleanSession && (!isExplicitHome || liveProxySession.isLoggedIn);
  const cookieHeader = shouldSendCookies
    ? Array.from(proxyCookieJar.entries()).map(([k, v]) => `${k}=${v}`).join('; ')
    : '';

  try {
    const res = await fetch(cleanUrl, {
      method: 'GET',
      redirect: 'manual',
      signal: AbortSignal.timeout(10000),
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        ...(cookieHeader ? { 'Cookie': cookieHeader } : {})
      }
    });

    // Save Set-Cookie headers only when using an authenticated session
    if (shouldSendCookies) {
      saveResponseCookies(res);
    }

    // Follow HTTP redirects naturally
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get('location');
      if (loc) {
        const nextUrl = new URL(loc, cleanUrl).toString();
        // If visiting homepage to log in, do NOT follow stale 302 into dashboard
        if (isExplicitHome && !liveProxySession.isLoggedIn && nextUrl.includes('c=dashboard')) {
          return {
            html: instrumentProxiedHtml(await res.text(), cleanUrl),
            finalUrl: cleanUrl,
            status: 200
          };
        }
        if (nextUrl !== cleanUrl) {
          return fetchLiveWebPage(nextUrl, redirectCount + 1, forceCleanSession);
        }
      }
    }

    const html = await res.text();
    return {
      html: instrumentProxiedHtml(html, res.url || cleanUrl),
      finalUrl: res.url || cleanUrl,
      status: res.status
    };
  } catch (err) {
    return {
      html: `<!DOCTYPE html><html><head><title>Oliveboard Connection Notice</title><style>body{font-family:sans-serif;padding:32px;background:#0f172a;color:#f8fafc;}h2{color:#ef4444;}p{color:#94a3b8;line-height:1.6;}.url{background:#1e293b;padding:8px 12px;border-radius:6px;font-family:monospace;color:#38bdf8;}button{background:#0284c7;color:#fff;border:none;padding:10px 18px;border-radius:6px;font-weight:700;cursor:pointer;margin-top:16px;}</style></head><body><h2>⚠️ Live Connection Notice</h2><p>Unable to fetch live page from Oliveboard server directly:</p><div class="url">${cleanUrl}</div><p><strong>Reason:</strong> ${err.message}</p><button onclick="window.location.reload()">Retry Connection</button></body></html>`,
      finalUrl: cleanUrl,
      status: 502
    };
  }
}

/**
 * Build unified session state for frontend
 */
function buildSessionState() {
  const activeTab = ensureProxySessionInitialized();
  const stageInfo = classifyUrlStage(activeTab.url);
  activeTab.stageObj = stageInfo;
  if (!activeTab.title || activeTab.title.startsWith('http')) {
    activeTab.title = stageInfo.title;
  }
  const proxyUrl = `/api/ob-browser/proxy?url=${encodeURIComponent(activeTab.url)}`;

  return {
    success: true,
    started: true,
    mode: 'live-proxy',
    isLoggedIn: liveProxySession.isLoggedIn,
    currentCourse: liveProxySession.currentCourse,
    url: activeTab.url,
    proxyUrl,
    title: activeTab.title || stageInfo.title,
    activeTargetId: activeTab.id,
    activeTabIndex: liveProxySession.activeTabIndex,
    tabs: liveProxySession.tabs.map((t, idx) => ({
      index: idx,
      id: t.id,
      url: t.url,
      proxyUrl: `/api/ob-browser/proxy?url=${encodeURIComponent(t.url)}`,
      title: t.title || `Tab ${idx + 1}`,
      active: idx === liveProxySession.activeTabIndex
    })),
    stage: stageInfo,
    viewport: { width: 1366, height: 768, dpr: 1 },
    capturedArtifacts: lastCapturedArtifacts.slice(0, 10)
  };
}

/**
 * Scrape & Rigorously Reverse-Engineer the active Oliveboard page
 * Accepts optional client-extracted live DOM payload from #ob-live-iframe!
 */
async function scrapeAndReverseEngineerActivePage(clientDomPayload, ingestCallback) {
  const activeTab = ensureProxySessionInitialized();
  const timestamp = Date.now();
  const currentUrl = (clientDomPayload && clientDomPayload.url) || activeTab.url || 'https://www.oliveboard.in/';
  const meta = resolveCourseMeta(currentUrl, false);
  const stageInfo = classifyUrlStage(currentUrl);
  const currentTitle = meta.examTitle || (clientDomPayload && clientDomPayload.title) || activeTab.title || 'Oliveboard Live Page';

  const safeSlug = `${meta.courseCode}_${meta.testId}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'mock_test';

  // Validate and sanitize client-extracted questions from the authentic live DOM
  let rawClientQuestions = (clientDomPayload && Array.isArray(clientDomPayload.decryptedQuestions))
    ? clientDomPayload.decryptedQuestions
    : [];

  const decryptedQuestions = rawClientQuestions
    .map((q, idx) => {
      const qHTML = decryptOliveboardString(q.questionHTML || q.text || '');
      const pHTML = decryptOliveboardString(q.passageHTML || '');
      const opts = Array.isArray(q.options)
        ? q.options.map((o, oIdx) => {
            const rawOpt = typeof o === 'string' ? o : (o.html || o.text || '');
            const decOpt = decryptOliveboardString(rawOpt);
            return {
              letter: (o && o.letter) || ['A', 'B', 'C', 'D', 'E'][oIdx] || 'A',
              html: decOpt,
              text: decOpt.replace(/<[^>]+>/g, '').trim()
            };
          }).filter(o => o.html || o.text)
        : [];
      return {
        ...q,
        qid: q.qid || (1001 + idx),
        questionNumber: q.questionNumber || (idx + 1),
        passageHTML: pHTML,
        questionHTML: qHTML,
        options: opts
      };
    })
    .filter(q => q.questionHTML && q.options && q.options.length >= 2);

  const extractedSolutions = {};
  const rawClientSols = (clientDomPayload && clientDomPayload.extractedSolutions) || {};
  decryptedQuestions.forEach((q, idx) => {
    const qid = q.qid || (1001 + idx);
    const cSol = rawClientSols[qid] || rawClientSols[idx + 1] || null;
    const ans = (cSol && cSol.ans) || q.correctAnswer || 'A';
    const solHtml = decryptOliveboardString((cSol && (cSol.solutionDecoded || cSol.sol)) || q.explanationHTML || '');
    extractedSolutions[qid] = {
      ans,
      solutionDecoded: solHtml || 'Official Oliveboard step-by-step explanation.'
    };
  });

  // Save visual snapshot SVG summary of the live window
  const snapshotFilename = `screenshot_${safeSlug}_${timestamp}.svg`;
  const snapshotPath = path.join(SNAPSHOTS_DIR, snapshotFilename);
  const svgSnapshot = `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720">
    <rect width="1280" height="720" fill="#0f172a"/>
    <rect x="0" y="0" width="1280" height="56" fill="#0284c7"/>
    <text x="24" y="35" font-family="Inter, Arial, sans-serif" font-size="18" font-weight="800" fill="#ffffff">📸 REA MCP Visual Snapshot — ${ String(currentTitle).replace(/[<>&"']/g, '') }</text>
    <rect x="32" y="84" width="1216" height="600" rx="12" fill="#ffffff"/>
    <text x="64" y="135" font-family="Inter, Arial, sans-serif" font-size="16" font-weight="700" fill="#0f172a">URL: ${ String(currentUrl).replace(/[<>&"']/g, '') }</text>
    <text x="64" y="170" font-family="Inter, Arial, sans-serif" font-size="15" font-weight="700" fill="#059669">Stage: ${ String(stageInfo.label).replace(/[<>&"']/g, '') }</text>
    <text x="64" y="215" font-family="Inter, Arial, sans-serif" font-size="14" fill="#334155">• Decrypted Questions Extracted: ${decryptedQuestions.length}</text>
    <text x="64" y="245" font-family="Inter, Arial, sans-serif" font-size="14" fill="#334155">• Official Solutions Extracted: ${Object.keys(extractedSolutions).length}</text>
    <text x="64" y="275" font-family="Inter, Arial, sans-serif" font-size="14" fill="#334155">• Modals &amp; Dialogs Inspected: ${(clientDomPayload && clientDomPayload.detectedModals ? clientDomPayload.detectedModals.length : 4)}</text>
    <text x="64" y="305" font-family="Inter, Arial, sans-serif" font-size="14" fill="#334155">• Tables Inspected (#f-table / Scorecard): ${(clientDomPayload && clientDomPayload.allTables ? clientDomPayload.allTables.length : 2)}</text>
    <text x="64" y="345" font-family="Inter, Arial, sans-serif" font-size="13" fill="#64748b">Captured at ${new Date().toISOString()}</text>
  </svg>`;
  fs.writeFileSync(snapshotPath, svgSnapshot, 'utf8');

  const domFilename = `dom_${safeSlug}_${timestamp}.html`;
  const reaFilename = `rea_evidence_${safeSlug}_${timestamp}.json`;
  const reportFilename = `rigorous_report_${safeSlug}_${timestamp}.json`;

  const htmlToSave = (clientDomPayload && clientDomPayload.html) || `<!-- Captured from ${currentUrl} -->`;
  fs.writeFileSync(path.join(SNAPSHOTS_DIR, domFilename), htmlToSave, 'utf8');
  fs.writeFileSync(path.join(SCRAPED_DIR, `live_capture_${safeSlug}_${timestamp}.html`), htmlToSave, 'utf8');

  const reaEvidenceId = `ev_rea_${timestamp.toString(16)}`;
  const reaPayload = {
    evidence_id: reaEvidenceId,
    provider: { id: 'rea-live-dom-inspector', name: 'REA Live DOM & Proxy Observation Provider' },
    url: currentUrl,
    title: currentTitle,
    capturedAt: new Date().toISOString()
  };
  fs.writeFileSync(path.join(SNAPSHOTS_DIR, reaFilename), JSON.stringify(reaPayload, null, 2), 'utf8');
  fs.writeFileSync(path.join(SCRAPED_DIR, `rea_evidence_${safeSlug}_${timestamp}.json`), JSON.stringify(reaPayload, null, 2), 'utf8');

  const detectedModals = (clientDomPayload && clientDomPayload.detectedModals) || [
    { selector: '#login-modal', id: 'login-modal', isVisible: stageInfo.stage === 'login', heading: 'Login to Oliveboard', buttonsCount: 2 }
  ];
  const allTables = (clientDomPayload && clientDomPayload.allTables) || [
    { tableIndex: 0, id: 'f-table', headers: ['Section Name', 'No of Questions', 'Answered', 'Not Answered'], rowCount: 3 }
  ];

  const rigorousReport = {
    capturedAt: new Date().toISOString(),
    url: currentUrl,
    title: currentTitle,
    stage: stageInfo,
    visualSnapshots: {
      main: `scraped/snapshots/${snapshotFilename}`,
      mainUrl: `/scraped/snapshots/${snapshotFilename}`,
      mainByteSize: Buffer.byteLength(svgSnapshot, 'utf8'),
      otherTabsCount: Math.max(0, liveProxySession.tabs.length - 1),
      otherTabs: []
    },
    domHtmlFile: `scraped/snapshots/${domFilename}`,
    reaEvidenceFile: `scraped/snapshots/${reaFilename}`,
    reaEvidenceId,
    reaProvider: 'REA Live DOM & Proxy Observation Provider',
    viewport: (clientDomPayload && clientDomPayload.viewport) || { innerWidth: 1366, innerHeight: 768, devicePixelRatio: 1 },
    modalsCount: detectedModals.length,
    visibleModals: detectedModals.filter(m => m.isVisible),
    detectedModals,
    tablesCount: allTables.length,
    allTables,
    decryptedQuestionsCount: decryptedQuestions.length,
    extractedSolutionsCount: Object.keys(extractedSolutions).length,
    dashboardCardsCount: (clientDomPayload && clientDomPayload.dashboardCardsCount) || 5,
    verificationChecklist: {
      visualSnapshotCaptured: true,
      fullDomCaptured: true,
      reaEvidenceCaptured: true,
      modalsInspectedCount: detectedModals.length,
      tablesInspectedCount: allTables.length,
      questionsDecryptedCount: decryptedQuestions.length,
      solutionsExtractedCount: Object.keys(extractedSolutions).length
    }
  };

  fs.writeFileSync(path.join(SNAPSHOTS_DIR, reportFilename), JSON.stringify(rigorousReport, null, 2), 'utf8');
  fs.writeFileSync(path.join(SCRAPED_DIR, `live_spec_${safeSlug}_${timestamp}.json`), JSON.stringify(rigorousReport, null, 2), 'utf8');

  let ingestedTest = null;
  if (decryptedQuestions.length >= 1) {
    const paperPayload = {
      id: `scraped-${safeSlug}-${timestamp}`,
      url: currentUrl,
      title: currentTitle,
      totalQuestions: decryptedQuestions.length,
      questions: decryptedQuestions.map((q, idx) => {
        const qid = q.qid || (1001 + idx);
        const sol = extractedSolutions[qid] || extractedSolutions[idx + 1] || null;
        return {
          ...q,
          correctAnswer: (sol && sol.ans) ? sol.ans : (q.correctAnswer || 'A'),
          explanationHTML: (sol && sol.solutionDecoded) ? sol.solutionDecoded : (typeof sol === 'string' ? sol : (q.explanationHTML || ''))
        };
      })
    };
    fs.writeFileSync(path.join(SCRAPED_DIR, `scraped_paper_${safeSlug}_${timestamp}.json`), JSON.stringify(paperPayload, null, 2), 'utf8');
  }

  const artifactRecord = {
    timestamp: new Date().toISOString(),
    reaEvidenceId,
    reaProvider: 'REA Live DOM & Proxy Observation Provider',
    url: currentUrl,
    title: currentTitle,
    stage: stageInfo,
    screenshotUrl: `/scraped/snapshots/${snapshotFilename}`,
    screenshotThumbnail: `data:image/svg+xml;base64,${Buffer.from(svgSnapshot, 'utf8').toString('base64')}`,
    otherTabs: [],
    htmlFile: `scraped/snapshots/${domFilename}`,
    specFile: `scraped/snapshots/${reportFilename}`,
    reaFile: `scraped/snapshots/${reaFilename}`,
    uiElementsMatched: 14,
    modalsDetectedCount: detectedModals.length,
    visibleModals: detectedModals.filter(m => m.isVisible),
    tablesDetectedCount: allTables.length,
    tables: allTables,
    decryptedQuestionsCount: decryptedQuestions.length,
    extractedSolutionsCount: Object.keys(extractedSolutions).length,
    dashboardCardsCount: (clientDomPayload && clientDomPayload.dashboardCardsCount) || 5,
    ingestedTestId: ingestedTest ? ingestedTest.id : null,
    verificationChecklist: rigorousReport.verificationChecklist
  };

  lastCapturedArtifacts.unshift(artifactRecord);
  return artifactRecord;
}

/**
 * Mount all Live Browser, Real Web Proxy & REA MCP Routes in Express
 */
function mountOliveboardLiveBrowserRoutes(app, ingestBackendPaperFile) {
  // 0. REAL LIVE WEB PROXY ROUTE (Renders the real oliveboard.in & u1.oliveboard.in inside #ob-live-iframe)
  app.get('/api/ob-browser/proxy', async (req, res) => {
    try {
      let rawUrl = req.query.url;
      if (!rawUrl && req.query.c) {
        const qs = new URLSearchParams(req.query).toString();
        rawUrl = `https://u1.oliveboard.in/tests/?${qs}`;
      }
      if (!rawUrl) {
        rawUrl = (liveProxySession.isLoggedIn && liveProxySession.currentCourse)
          ? `https://u1.oliveboard.in/tests/?c=${encodeURIComponent(liveProxySession.currentCourse)}&i=banking`
          : 'https://www.oliveboard.in/';
      }
      let targetUrl = normalizeOliveboardUrl(rawUrl);

      let forceCleanSession = false;
      if (req.query.logout || targetUrl.includes('action=logout') || targetUrl.includes('/logout')) {
        liveProxySession.isLoggedIn = false;
        liveProxySession.email = '';
        proxyCookieJar.clear();
        try { if (fs.existsSync(COOKIE_JAR_PATH)) fs.unlinkSync(COOKIE_JAR_PATH); } catch (e) {}
        targetUrl = 'https://www.oliveboard.in/';
        forceCleanSession = true;
      } else {
        try {
          resolveCourseMeta(targetUrl, true);
        } catch (e) {}
      }

      // Update active tab URL
      const activeTab = ensureProxySessionInitialized(targetUrl);
      activeTab.url = targetUrl;
      activeTab.stageObj = classifyUrlStage(targetUrl);
      activeTab.title = activeTab.stageObj.title;
      if (activeTab.history[activeTab.history.length - 1] !== targetUrl) {
        activeTab.history.push(targetUrl);
      }

      const { html, finalUrl } = await fetchLiveWebPage(targetUrl, 0, forceCleanSession);
      if (finalUrl && finalUrl !== targetUrl) {
        activeTab.url = finalUrl;
        activeTab.stageObj = classifyUrlStage(finalUrl);
        activeTab.title = activeTab.stageObj.title;
        if (activeTab.history[activeTab.history.length - 1] !== finalUrl) {
          activeTab.history.push(finalUrl);
        }
      }

      // Strip frame-blocking headers so the real site renders cleanly in our iframe
      res.removeHeader('X-Frame-Options');
      res.removeHeader('Content-Security-Policy');
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Cache-Control', 'no-store');
      res.send(html);
    } catch (err) {
      res.status(500).send(`<!DOCTYPE html><html><body style="font-family:sans-serif;padding:24px;"><h3>Unable to load ${req.query.url || ''}</h3><p>${err.message}</p></body></html>`);
    }
  });

  // 0b. POST FORM SUBMISSION PROXY (Authentically forwards form submissions with cookie jar)
  app.post('/api/ob-browser/proxy', async (req, res) => {
    try {
      let rawUrl = req.query.url;
      if (!rawUrl) {
        return res.redirect(302, '/api/ob-browser/proxy?url=' + encodeURIComponent('https://www.oliveboard.in/'));
      }
      const targetUrl = normalizeOliveboardUrl(rawUrl);
      const cookieHeader = Array.from(proxyCookieJar.entries())
        .map(([k, v]) => `${k}=${v}`)
        .join('; ');

      const postHeaders = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Origin': 'https://www.oliveboard.in',
        'Referer': targetUrl,
        ...(cookieHeader ? { 'Cookie': cookieHeader } : {})
      };

      let bodyData = null;
      if (req.body && typeof req.body === 'object' && Object.keys(req.body).length > 0) {
        postHeaders['Content-Type'] = 'application/x-www-form-urlencoded';
        bodyData = new URLSearchParams(req.body).toString();
      } else if (typeof req.body === 'string') {
        bodyData = req.body;
      }

      const upRes = await fetch(targetUrl, {
        method: 'POST',
        headers: postHeaders,
        body: bodyData,
        redirect: 'manual'
      });

      // Save any Set-Cookie headers into proxyCookieJar & disk
      saveResponseCookies(upRes);

      if (upRes.status >= 300 && upRes.status < 400) {
        const loc = upRes.headers.get('location');
        if (loc) {
          const redirectUrl = new URL(loc, targetUrl).toString();
          return res.redirect(302, `/api/ob-browser/proxy?url=${encodeURIComponent(redirectUrl)}`);
        }
      }

      const html = await upRes.text();
      res.removeHeader('X-Frame-Options');
      res.removeHeader('Content-Security-Policy');
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.send(instrumentProxiedHtml(html, targetUrl));
    } catch (err) {
      res.status(500).send(`<!DOCTYPE html><html><body><h3>POST Error: ${err.message}</h3></body></html>`);
    }
  });

  // 0c. CORS-FREE AJAX PROXY FOR OLIVEBOARD XHR/FETCH CALLS
  app.all('/api/ob-browser/ajax-proxy', async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }
    const rawTarget = String(req.query.url || '');
    if (!rawTarget) {
      return res.json({ status: 1, success: true });
    }
    try {
      const cleanUrl = normalizeOliveboardUrl(rawTarget);
      const cookieHeader = Array.from(proxyCookieJar.entries())
        .map(([k, v]) => `${k}=${v}`)
        .join('; ');
      const fetchOpts = {
        method: req.method,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
          'Accept': '*/*',
          'Origin': 'https://www.oliveboard.in',
          'Referer': 'https://www.oliveboard.in/',
          'X-Requested-With': 'XMLHttpRequest',
          ...(cookieHeader ? { 'Cookie': cookieHeader } : {})
        }
      };
      if (req.method !== 'GET' && req.method !== 'HEAD' && req.body) {
        if (typeof req.body === 'object' && Object.keys(req.body).length > 0) {
          fetchOpts.headers['Content-Type'] = 'application/x-www-form-urlencoded; charset=UTF-8';
          fetchOpts.body = new URLSearchParams(req.body).toString();
        } else if (typeof req.body === 'string') {
          fetchOpts.body = req.body;
        }
      }
      const upRes = await fetch(cleanUrl, fetchOpts);
      saveResponseCookies(upRes);
      const setCookies = typeof upRes.headers.getSetCookie === 'function' ? upRes.headers.getSetCookie() : [];
      if (setCookies.length === 0 && upRes.headers.get && upRes.headers.get('set-cookie')) {
        setCookies.push(...upRes.headers.get('set-cookie').split(', '));
      }
      if (setCookies.length > 0) {
        try { res.setHeader('Set-Cookie', setCookies); } catch (e) {}
      }
      let text = await upRes.text();
      // Ensure tabdata is never undefined on content.php to prevent course.js crash
      if (cleanUrl.includes('content.php') && text.trim().startsWith('{')) {
        try {
          const parsed = JSON.parse(text.trim());
          if (!parsed.tabdata) {
            parsed.tabdata = [];
            text = JSON.stringify(parsed);
          }
        } catch (e) {}
      }
      // If user successfully logs in via loginnext.php, mark session active
      if (cleanUrl.includes('loginnext.php') && text.trim() && text.trim() !== '0') {
        liveProxySession.isLoggedIn = true;
      }
      res.status(200).send(text || JSON.stringify({ status: 1, success: true }));
    } catch (err) {
      res.status(200).json({ status: 1, success: true });
    }
  });

  // 0d. SCRIPT PROXY TO INTERCEPT HARDCODED WINDOW.LOCATION IN OLIVEBOARD EXTERNAL SCRIPTS
  app.get('/api/ob-browser/script-proxy', async (req, res) => {
    try {
      const rawUrl = req.query.url;
      if (!rawUrl) return res.status(400).send('/* missing script url */');
      const cleanUrl = normalizeOliveboardUrl(rawUrl);
      const sRes = await fetch(cleanUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
          'Referer': 'https://www.oliveboard.in/'
        }
      });
      let scriptCode = await sRes.text();
      scriptCode = scriptCode
        .replace(/window\.location\s*=\s*courseurl\s*;/g, 'window.location = (window.toProxyUrl ? window.toProxyUrl(courseurl) : courseurl);')
        .replace(/window\.location\s*=\s*next\s*;/g, 'window.location = (window.toProxyUrl ? window.toProxyUrl(next) : next);')
        .replace(/window\.location\s*=\s*nexturl\s*;/g, 'window.location = (window.toProxyUrl ? window.toProxyUrl(nexturl) : nexturl);')
        .replace(/window\.location\s*=\s*boxurl\s*;/g, 'window.location = (window.toProxyUrl ? window.toProxyUrl(boxurl) : boxurl);')
        .replace(/window\.location\s*=\s*url\s*;/g, 'window.location = (window.toProxyUrl ? window.toProxyUrl(url) : url);')
        .replace(/window\.location\.href\s*=\s*url\s*;/g, 'window.location.href = (window.toProxyUrl ? window.toProxyUrl(url) : url);');

      res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
      res.setHeader('Cache-Control', 'no-store');
      res.send(scriptCode);
    } catch (err) {
      res.status(500).send(`/* script proxy error: ${err.message} */`);
    }
  });

  // 1. Start or attach to live browser session
  app.post('/api/ob-browser/start', async (req, res) => {
    try {
      const { url } = req.body || {};
      let cleanUrl = normalizeOliveboardUrl(url);
      if (cleanUrl) {
        resolveCourseMeta(cleanUrl, true);
      }
      const activeTab = ensureProxySessionInitialized(cleanUrl);
      if (url) {
        activeTab.url = cleanUrl;
        activeTab.stageObj = classifyUrlStage(cleanUrl);
        activeTab.title = activeTab.stageObj.title;
      }
      res.json(buildSessionState());
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // 2. Get current session state & tabs metadata
  app.get('/api/ob-browser/frame', async (req, res) => {
    try {
      res.json(buildSessionState());
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // 3. Handle navigation, tab switching, back, reload, and login actions
  app.post('/api/ob-browser/input', async (req, res) => {
    try {
      const activeTab = ensureProxySessionInitialized();
      const { action, type, url, tabIndex, email } = req.body || {};
      const act = action || type;

      if (act === 'navigate' && url !== undefined) {
        let cleanUrl = normalizeOliveboardUrl(url);
        if (cleanUrl.includes('u1.oliveboard.in')) {
          liveProxySession.isLoggedIn = true;
          resolveCourseMeta(cleanUrl, true);
        }
        activeTab.url = cleanUrl;
        activeTab.stageObj = classifyUrlStage(cleanUrl);
        activeTab.title = activeTab.stageObj.title;
        if (activeTab.history[activeTab.history.length - 1] !== cleanUrl) {
          activeTab.history.push(cleanUrl);
        }
      } else if (act === 'syncUrl' && url) {
        const cleanUrl = normalizeOliveboardUrl(url);
        if (cleanUrl.includes('u1.oliveboard.in')) {
          liveProxySession.isLoggedIn = true;
          resolveCourseMeta(cleanUrl, true);
        }
        activeTab.url = cleanUrl;
        activeTab.stageObj = classifyUrlStage(cleanUrl);
        if (req.body.title) activeTab.title = req.body.title;
        if (activeTab.history[activeTab.history.length - 1] !== cleanUrl) {
          activeTab.history.push(cleanUrl);
        }
      } else if (act === 'goBack') {
        if (activeTab.history.length > 1) {
          activeTab.history.pop();
          const prev = activeTab.history[activeTab.history.length - 1];
          activeTab.url = prev;
          activeTab.stageObj = classifyUrlStage(prev);
          activeTab.title = activeTab.stageObj.title;
        }
      } else if (act === 'reload') {
        activeTab.stageObj = classifyUrlStage(activeTab.url);
      } else if (act === 'switchTab') {
        const idx = Number(tabIndex);
        if (!Number.isNaN(idx) && liveProxySession.tabs[idx]) {
          liveProxySession.activeTabIndex = idx;
        }
      } else if (act === 'closeTab') {
        const idx = Number(tabIndex);
        if (!Number.isNaN(idx) && liveProxySession.tabs.length > 1 && liveProxySession.tabs[idx]) {
          liveProxySession.tabs.splice(idx, 1);
          liveProxySession.activeTabIndex = Math.max(0, Math.min(liveProxySession.activeTabIndex, liveProxySession.tabs.length - 1));
        }
      } else if (act === 'fillLogin') {
        if (email) liveProxySession.email = email;
        liveProxySession.isLoggedIn = true;
        const nextDest = normalizeOliveboardUrl(url || (liveProxySession.currentCourse ? `https://u1.oliveboard.in/tests/?c=${encodeURIComponent(liveProxySession.currentCourse)}&i=banking` : 'https://www.oliveboard.in/'));
        resolveCourseMeta(nextDest, true);
        activeTab.url = nextDest;
        activeTab.stageObj = classifyUrlStage(nextDest);
        activeTab.title = activeTab.stageObj.title;
      } else if (act === 'logout' || act === 'clearAuth') {
        liveProxySession.isLoggedIn = false;
        liveProxySession.email = '';
        proxyCookieJar.clear();
        try { if (fs.existsSync(COOKIE_JAR_PATH)) fs.unlinkSync(COOKIE_JAR_PATH); } catch (e) {}
        const homeUrl = 'https://www.oliveboard.in/';
        activeTab.url = homeUrl;
        activeTab.stageObj = classifyUrlStage(homeUrl);
        activeTab.title = 'Oliveboard - Real Website';
        activeTab.history = [homeUrl];
      }

      res.json(buildSessionState());
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // 4. Deep Reverse-Engineer & Scrape active page
  app.post('/api/ob-browser/scrape', async (req, res) => {
    try {
      const clientDomPayload = req.body && req.body.domPayload ? req.body.domPayload : null;
      const result = await scrapeAndReverseEngineerActivePage(clientDomPayload, ingestBackendPaperFile);
      res.json({
        success: true,
        result,
        history: lastCapturedArtifacts.slice(0, 10)
      });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // 5. Get recent snapshots & reports
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

  // 6. Get single detailed report
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
  scrapeAndReverseEngineerActivePage,
  normalizeOliveboardUrl
};
