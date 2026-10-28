'use strict';

// Kept self-contained: the browser adapter serializes this function into Runtime.evaluate.
// It only reads DOM/source variables and builds detached nodes; it never navigates or
// invokes the source application's handlers (including its decryption functions).
function extractPage(settings) {
  function decodeText(value, encoding = 'plain') {
    const raw = String(value ?? '');
    if (encoding === 'plain') return raw;
    let input = raw.trim();
    if (encoding === 'oliveboard-salted') {
      if (input.length <= 64 || !/^[a-zA-Z0-9]{32}/.test(input) || !/[a-zA-Z0-9]{32}$/.test(input)) return null;
      input = input.slice(32, -32);
    }
    if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(input) || !input) return null;
    try {
      const bin = atob(input);
      if (encoding === 'oliveboard-salted') {
        // n.js uses btoa(escape(html)); requiring its escape signature avoids
        // silently accepting the middle of an ordinary UTF-8 base64 value.
        if (!/%(?:[0-9a-f]{2}|u[0-9a-f]{4})/i.test(bin)) return null;
        return unescape(bin);
      }
      const bytes = Uint8Array.from(bin, c => c.charCodeAt(0));
      const decoded = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
      return /[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(decoded) ? null : decoded;
    } catch { return null; }
  }

  function sectionRanges(names, values, expected, mode = 'counts') {
    if (!Array.isArray(names) || !names.length || !Array.isArray(values)) return [];
    const counts = values.map(Number);
    if (counts.some(n => !Number.isInteger(n) || n < 0)) return [];
    if (mode === 'boundaries') {
      if (counts.length !== names.length + 1 || counts[0] !== 0 || counts.some((n, i) => i && n <= counts[i - 1])) return [];
      if (expected && counts.at(-1) !== expected) return [];
      return names.map((title, i) => ({ id: `section-${i + 1}`, title: String(title), start: counts[i], end: counts[i + 1], expectedQuestions: counts[i + 1] - counts[i] }));
    }
    if (counts.length !== names.length || counts.some(n => n === 0)) return [];
    if (expected && counts.reduce((a, b) => a + b, 0) !== expected) return [];
    let start = 0;
    return names.map((title, i) => { const item = { id: `section-${i + 1}`, title: String(title), start, end: start + counts[i], expectedQuestions: counts[i] }; start = item.end; return item; });
  }

  function answerIndex(raw, count, numericBase = null) {
    if (raw == null || raw === '') return null;
    const text = String(raw).trim().toUpperCase();
    if (/^[A-Z]$/.test(text)) { const index = text.charCodeAt(0) - 65; return index < count ? index : null; }
    if (!/^\d+$/.test(text) || numericBase == null) return null;
    const n = Number(text) - numericBase;
    return Number.isInteger(n) && n >= 0 && n < count ? n : null;
  }

  function durationSeconds(text) {
    if (typeof text !== 'string') return null;
    const match = text.trim().match(/^(\d+(?:\.\d+)?)\s*(hours?|hrs?|minutes?|mins?|seconds?|secs?)$/i);
    if (!match) return null;
    return Number(match[1]) * (/^h/i.test(match[2]) ? 3600 : /^m/i.test(match[2]) ? 60 : 1);
  }

  if (settings && settings.helpersOnly) return { decodeText, sectionRanges, answerIndex, durationSeconds };

  const doc = document;
  const warnings = [];
  const url = new URL(location.href);
  const safeUrl = raw => {
    try {
      const u = new URL(raw, url.href);
      if (!['https:', 'http:'].includes(u.protocol)) return null;
      u.username = ''; u.password = '';
      for (const k of [...u.searchParams.keys()]) if (/token|password|passwd|session|auth|secret|email|phone|mobile/i.test(k)) u.searchParams.delete(k);
      return u.href;
    } catch { return null; }
  };
  const textOf = node => String(node?.textContent || '').trim();
  const readGlobal = key => { try { const v = window[key]; return typeof v === 'string' || typeof v === 'number' || Array.isArray(v) ? v : null; } catch { return null; } };
  const assets = new Map();
  const addAsset = (raw, kind) => { const href = safeUrl(raw); if (href) assets.set(href, { url: href, kind }); return href; };

  function cleanTree(root, collectAssets) {
    root.querySelectorAll('script,iframe,object,embed,base,meta[http-equiv],form input[type="hidden"]').forEach(el => el.remove());
    root.querySelectorAll('input,textarea,select').forEach(el => {
      el.removeAttribute('value'); el.removeAttribute('checked');
      if (el.tagName === 'TEXTAREA') el.textContent = '';
      el.querySelectorAll('option').forEach(o => o.removeAttribute('selected'));
    });
    root.querySelectorAll('*').forEach(el => {
      for (const attr of Array.from(el.attributes || [])) {
        if (/^on/i.test(attr.name) || /^(srcdoc|nonce|integrity)$/i.test(attr.name) || /token|password|session|secret/i.test(attr.name)) el.removeAttribute(attr.name);
      }
      for (const attr of ['src', 'href', 'poster']) {
        if (!el.hasAttribute(attr)) continue;
        const raw = el.getAttribute(attr);
        if (attr === 'href' && raw.startsWith('#')) continue;
        const href = safeUrl(raw);
        if (!href) el.removeAttribute(attr);
        else {
          el.setAttribute(attr, href);
          if (collectAssets && attr !== 'href') addAsset(href, 'image');
        }
      }
      // A srcset can contain a second remote URL; retain only the resolved src.
      el.removeAttribute('srcset');
      if (/url\s*\(|expression\s*\(|@import/i.test(el.getAttribute('style') || '')) el.removeAttribute('style');
    });
    return root;
  }

  function fragment(raw, encoding, label) {
    const decoded = decodeText(raw, encoding);
    if (decoded === null) { warnings.push(`Cannot decode ${label} (${encoding}); kept as an incomplete capture.`); return ''; }
    const template = doc.createElement('template');
    template.innerHTML = decoded;
    cleanTree(template.content, true);
    return template.innerHTML;
  }

  function nodeHtml(node, salted, label) {
    if (!node) return '';
    const explicit = node.getAttribute('data-encoding');
    const raw = node.getAttribute('data-raw-eqt');
    if (raw !== null) return fragment(raw, 'base64', label);
    const html = node.innerHTML || '';
    if (explicit === 'base64') return fragment(html, 'base64', label);
    if (explicit === 'oliveboard-salted') return fragment(html, 'oliveboard-salted', label);
    // Rendering leaves ordinary text/HTML intact. A salted decode is accepted
    // only in known solution nodes and with the n.js percent-escape signature.
    if (salted && !html.includes('<') && decodeText(html, 'oliveboard-salted') !== null) return fragment(html, 'oliveboard-salted', label);
    if (node.classList.contains('eqt') && !html.includes('<')) return fragment(html, 'base64', label);
    return fragment(html, 'plain', label);
  }

  const names = readGlobal('dsnames') || readGlobal('secList') || [];
  const sourceCounts = readGlobal('secount') || readGlobal('secTracker') || [];
  const knownExpected = Number(readGlobal('totalnq')) || (Array.isArray(sourceCounts) && sourceCounts.length ? sourceCounts.map(Number).reduce((a, b) => a + b, 0) : null);
  // Both secount (solutions) and secTracker (live player) are per-section counts.
  const sections = sectionRanges(names, sourceCounts, knownExpected, 'counts');
  if (names.length && !sections.length) warnings.push('Source section counts are inconsistent; section mapping was not guessed.');
  const sourceTitle = readGlobal('testQpid') || readGlobal('examid') || textOf(doc.querySelector('[data-test-title]')) || doc.title;
  const metadata = {
    courseId: url.searchParams.get('c') || readGlobal('coursename') || null,
    testId: url.searchParams.get('testid') || url.searchParams.get('t') || null,
    title: String(sourceTitle || ''),
    examName: null,
    expectedQuestions: knownExpected,
    hasSectionalTiming: null,
    totalDurationSeconds: null,
    sections,
    provenance: { sectionCounts: readGlobal('secount') ? 'window.secount (counts)' : readGlobal('secTracker') ? 'window.secTracker (counts)' : null }
  };
  // timeTotal is a static labelled duration in the saved player; totalTime is
  // a mutable countdown and must never become the imported original duration.
  const sourceDuration = durationSeconds(readGlobal('timeTotal'));
  if (sourceDuration && sections.length === 1) sections[0].durationSeconds = sourceDuration;

  const config = doc.querySelector('[data-exam-name][data-test-id]');
  if (config) {
    metadata.examName = config.getAttribute('data-exam-name');
    metadata.examId = config.getAttribute('data-exam-id');
    metadata.testId = config.getAttribute('data-test-id') || metadata.testId;
    metadata.type = config.getAttribute('data-test-type');
    const mode = config.getAttribute('data-sectional-timing');
    if (mode === 'true' || mode === 'false') metadata.hasSectionalTiming = mode === 'true';
    const seconds = Number(config.getAttribute('data-duration-seconds'));
    if (seconds > 0) metadata.totalDurationSeconds = seconds;
  }

  // Read explicitly labelled instruction rows. Do not infer units or apply an
  // external exam registry when the source omits marks or timing.
  for (const table of doc.querySelectorAll('table')) {
    const rows = Array.from(table.querySelectorAll('tr'));
    const headers = Array.from(rows[0]?.querySelectorAll('th,td') || []).map(el => textOf(el).toLowerCase());
    const nameCol = headers.findIndex(h => /section|subject/.test(h));
    const timeCol = headers.findIndex(h => /time|duration/.test(h));
    const positiveCol = headers.findIndex(h => /marks?\s*(?:per|for).*correct|positive\s*marks?/.test(h));
    const negativeCol = headers.findIndex(h => /negative|penalty|marks?\s*(?:per|for).*wrong/.test(h));
    if (nameCol < 0) continue;
    for (const row of rows.slice(1)) {
      const cells = Array.from(row.querySelectorAll('td,th')).map(textOf);
      const sec = sections.find(s => s.title.toLowerCase() === String(cells[nameCol] || '').toLowerCase());
      if (!sec) continue;
      if (timeCol >= 0) {
        const value = cells[timeCol] || '';
        const headerUnit = headers[timeCol].match(/\b(minutes?|mins?|seconds?|secs?|hours?|hrs?)\b/i)?.[0];
        const duration = durationSeconds(value) || (headerUnit ? durationSeconds(`${value} ${headerUnit}`) : null);
        if (duration > 0) sec.durationSeconds = duration;
      }
      if (positiveCol >= 0 && /^\+?\d+(\.\d+)?$/.test(cells[positiveCol] || '')) sec.marksForCorrect = Number(cells[positiveCol]);
      if (negativeCol >= 0 && /^-?\d+(\.\d+)?$/.test(cells[negativeCol] || '')) sec.negativeMarks = Math.abs(Number(cells[negativeCol]));
    }
  }

  const questions = [];
  function addQuestion(data, index) {
    const sec = sections.find(s => index >= s.start && index < s.end);
    data.section = sec?.title || null;
    data.sectionId = sec?.id || null;
    data.questionNumber = index + 1;
    data.hasPassage = !!data.passageHTML;
    if (data.correctIndex !== null) data.correctAnswer = String.fromCharCode(65 + data.correctIndex);
    if (!data.questionHTML || data.options.length < 2) warnings.push(`Question ${data.qid} is incomplete.`);
    questions.push(data);
  }

  const solutionBlocks = Array.from(doc.querySelectorAll('div.qosblock[id^="q-"]'));
  solutionBlocks.forEach((block, position) => {
    const id = block.id.match(/^q-(\d+)-([^-]+)/);
    if (!id) { warnings.push('Solution block without stable question identity was skipped.'); return; }
    const sourceIndex = Number(id[1]);
    const options = Array.from(block.querySelectorAll('.opt .rightopt')).map((el, i) => {
      const html = nodeHtml(el, true, `question ${id[2]} option ${i + 1}`);
      return { letter: String.fromCharCode(65 + i), html, text: html.replace(/<[^>]*>/g, '').trim() };
    });
    const handler = block.querySelector('.btn-viewsol[onclick]')?.getAttribute('onclick') || '';
    const match = handler.match(/viewsolution\(\s*\d+\s*,\s*(\d+)\s*\)/);
    let correctIndex = match ? answerIndex(match[1], options.length, 0) : null;
    const correctRows = Array.from(block.querySelectorAll('.opt')).map((el, i) => el.classList.contains('correct') ? i : -1).filter(i => i >= 0);
    if (correctIndex == null && correctRows.length === 1) correctIndex = correctRows[0];
    if (correctIndex != null && correctRows.length === 1 && correctRows[0] !== correctIndex) { correctIndex = null; warnings.push(`Conflicting source answers for question ${id[2]}.`); }
    addQuestion({ qid: id[2], questionHTML: nodeHtml(block.querySelector('.qblock'), true, `question ${id[2]}`), passageHTML: nodeHtml(block.querySelector('.panetxt'), true, `passage ${id[2]}`), options, correctIndex, explanationHTML: nodeHtml(block.querySelector('.sblock .solutiontxt'), true, `solution ${id[2]}`) }, Number.isInteger(sourceIndex) ? sourceIndex : position);
  });

  if (!questions.length) {
    const pane = doc.getElementById('question-inner-pane') || doc;
    const ids = [...new Set(Array.from(pane.querySelectorAll('[id^="myquestion"],[id^="rightpane"]')).map(el => el.id.match(/(?:myquestion|rightpane)(\d+)$/)?.[1]).filter(Boolean))];
    ids.forEach((qid, index) => {
      const left = doc.getElementById(`leftpane${qid}`);
      const right = doc.getElementById(`rightpane${qid}`);
      const single = doc.getElementById(`myquestion${qid}`);
      const options = Array.from(doc.querySelectorAll(`.opn${qid}`)).map((el, i) => {
        const html = nodeHtml(el, true, `question ${qid} option ${i + 1}`);
        return { letter: String.fromCharCode(65 + i), html, text: html.replace(/<[^>]*>/g, '').trim() };
      });
      let correctIndex = null;
      let explanationHTML = '';
      const answer = window.quesAnswer && typeof window.quesAnswer === 'object' ? window.quesAnswer[qid] : null;
      if (answer && typeof answer === 'object') {
        // Letter answers are unambiguous; numeric answers require an explicit base.
        correctIndex = answerIndex(answer.ans, options.length, null);
        if (answer.sol) explanationHTML = fragment(String(answer.sol), 'plain', `solution ${qid}`);
      }
      addQuestion({ qid, questionHTML: nodeHtml(right?.querySelector('#pane-question-box') || single?.querySelector('#question-box'), true, `question ${qid}`), passageHTML: nodeHtml(left?.querySelector('#pane-direction-box'), true, `passage ${qid}`), options, correctIndex, explanationHTML }, index);
    });
  }

  const detectedModals = Array.from(doc.querySelectorAll('#submit-pane,#sure,#calert,.modal,[role="dialog"]')).map(el => {
    const style = window.getComputedStyle(el);
    return { id: el.id || '', selector: el.id ? `#${el.id}` : '[role="dialog"]', isVisible: style.display !== 'none' && style.visibility !== 'hidden' && el.getClientRects().length > 0, heading: textOf(el.querySelector('h1,h2,h3,h4,.modal-title')), buttonsCount: el.querySelectorAll('button,a,input[type="submit"]').length };
  });
  const allTables = Array.from(doc.querySelectorAll('table')).map((table, tableIndex) => ({ tableIndex, id: table.id || '', headers: Array.from(table.querySelectorAll('th')).map(textOf), rows: Array.from(table.querySelectorAll('tr')).map(row => Array.from(row.querySelectorAll('td,th')).map(textOf)), rowCount: table.querySelectorAll('tr').length }));
  const cards = Array.from(doc.querySelectorAll('.tpc-card,.test-card,.mock-card,.exam-card')).map(el => ({ title: textOf(el.querySelector('h2,h3,h4,.tpc-title,.test-title')) || textOf(el).slice(0,200), url: safeUrl(el.getAttribute('data-url') || el.querySelector('a[href]')?.getAttribute('href') || '') }));
  const links = [...new Set(Array.from(doc.querySelectorAll('a[href],[data-url]')).map(el => safeUrl(el.getAttribute('href') || el.getAttribute('data-url'))).filter(Boolean))];
  for (const el of doc.querySelectorAll('link[rel="stylesheet"][href]')) addAsset(el.href, 'stylesheet');
  for (const el of doc.querySelectorAll('script[src]')) addAsset(el.src, 'script');
  for (const el of doc.querySelectorAll('img[src]')) addAsset(el.currentSrc || el.src, 'image');
  const clone = doc.documentElement.cloneNode(true);
  cleanTree(clone, false);
  if (!questions.length) warnings.push('No supported question blocks on this page; dashboard and page evidence only.');
  return { url: safeUrl(url.href), title: doc.title, html: clone.outerHTML, htmlSanitized: true, viewport: { innerWidth: window.innerWidth, innerHeight: window.innerHeight, devicePixelRatio: window.devicePixelRatio }, detectedModals, allTables, questions, metadata, dashboardCards: cards, dashboardCardsCount: cards.length, links, assets: [...assets.values()], warnings };
}

const { decodeText, sectionRanges, answerIndex, durationSeconds } = extractPage({ helpersOnly: true });

function toSourcePaper(capture) {
  const crypto = require('node:crypto');
  const m = capture.metadata || {};
  const warnings = [];
  const questions = Array.isArray(capture.questions) ? capture.questions : [];
  const expected = m.expectedQuestions;
  if (!m.courseId || !m.testId) warnings.push('Missing source course/test identity.');
  if (!Number.isInteger(expected) || expected < 1 || expected !== questions.length) warnings.push('Captured question count does not match a known source total.');
  if (!m.examName || !m.examId || !m.type || !m.title) warnings.push('Missing explicit source exam identity, test type, or title.');
  if (typeof m.hasSectionalTiming !== 'boolean') warnings.push('Source timing mode is unknown.');
  if (!m.hasSectionalTiming && !(m.totalDurationSeconds > 0)) warnings.push('Missing original total duration.');
  const ids = new Set();
  for (const q of questions) {
    if (!q.qid || ids.has(String(q.qid))) warnings.push('Missing or duplicated question identity.');
    ids.add(String(q.qid));
    if (!q.questionHTML || !Array.isArray(q.options) || q.options.length < 2 || q.options.some(o => !(o.html || o.text))) warnings.push(`Question ${q.qid} has missing text/options.`);
    if (!Number.isInteger(q.correctIndex) || q.correctIndex < 0 || q.correctIndex >= (q.options?.length || 0)) warnings.push(`Question ${q.qid} has no verified answer.`);
    if (q.correctAnswer != null && answerIndex(q.correctAnswer, q.options?.length || 0) !== q.correctIndex) warnings.push(`Question ${q.qid} has conflicting answers.`);
  }
  const sections = Array.isArray(m.sections) ? m.sections.map(s => ({ ...s, questions: questions.filter(q => q.sectionId === s.id || (!q.sectionId && q.section === s.title)) })) : [];
  if (!sections.length || sections.reduce((n, s) => n + s.questions.length, 0) !== questions.length) warnings.push('Some questions have no unambiguous section.');
  for (const s of sections) {
    if (!s.title || !s.questions.length) warnings.push('Missing or empty source section.');
    if (s.expectedQuestions != null && s.expectedQuestions !== s.questions.length) warnings.push(`Section ${s.title} is incomplete.`);
    if (m.hasSectionalTiming && !(s.durationSeconds > 0)) warnings.push(`Missing original duration for ${s.title}.`);
    if (!(s.marksForCorrect > 0) || !(typeof s.negativeMarks === 'number' && s.negativeMarks >= 0)) warnings.push(`Missing source marking scheme for ${s.title}.`);
  }
  if (warnings.length) return { paper: null, complete: false, warnings: [...new Set(warnings)] };
  const identity = `${m.courseId}\n${m.testId}`;
  const id = `live-ob-${crypto.createHash('sha256').update(identity).digest('hex').slice(0, 24)}`;
  return { complete: true, warnings: [], paper: { schemaVersion: 1, id, source: { provider: 'oliveboard', url: capture.url, courseId: m.courseId, testId: m.testId, evidenceId: capture.reaEvidenceId || capture.evidenceId }, examId: m.examId, examName: m.examName, title: m.title, type: m.type, hasSectionalTiming: m.hasSectionalTiming, totalDurationSeconds: m.totalDurationSeconds, expectedQuestions: expected, completeness: { complete: true }, sections } };
}

module.exports = { extractPage, toSourcePaper, decodeText, sectionRanges, answerIndex, durationSeconds };
