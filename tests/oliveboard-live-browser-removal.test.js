'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const appSource = fs.readFileSync(path.join(__dirname, '..', 'js', 'app.js'), 'utf8');

test('Oliveboard Live Browser code completely removed from app.js', () => {
  // These functions/variables should NOT exist
  const removedPatterns = [
    'bindOliveboardLiveBrowserEvents',
    'openOliveboardLiveBrowser',
    'closeOliveboardLiveBrowser',
    'sendObBrowserInput',
    'scrapeOliveboardLivePage',
    'navigateLiveOliveboard',
    '_obRequest',
    '_setObStatus',
    '_applyObBrowserFrameData',
    '_scheduleObFrame',
    '_pollObBrowserFrame',
    '_renderObBrowserTabs',
    '_obPointFromEvent',
    '_obArtifactUrl',
    '_obEventsBound',
    '_obOpening',
    '_obEpoch',
    '_obBrowserActive',
    '_obFrameTimer',
    '_obScrollTimer',
    '_obScrollDelta',
    '_obInputPending',
    '_obInputRevision',
    '_obInputQueue',
    '_obPolling',
    '_obScraping',
    '_obViewport',
    '_obActiveTargetId',
    '_lastTabsKey',
  ];

  for (const pattern of removedPatterns) {
    assert.ok(!appSource.includes(pattern), `Dead code '${pattern}' should be removed from app.js`);
  }
});

test('No ob-live-browser-modal references remain in app.js', () => {
  assert.ok(!appSource.includes('ob-live-browser-modal'), 'ob-live-browser-modal references should be removed');
  assert.ok(!appSource.includes('obLiveModal'), 'obLiveModal references should be removed');
});

test('hasAnyModalOrOverlayOpen no longer checks for obLiveModal', () => {
  // Should not check for ob-live-browser-modal
  assert.ok(!appSource.includes('ob-live-browser-modal') || !appSource.includes('obLiveModal'));
});

test('closeAllModalsAndOverlays no longer calls closeOliveboardLiveBrowser', () => {
  assert.ok(!appSource.includes('closeOliveboardLiveBrowser'));
});

test('goBack no longer checks for obLiveModal', () => {
  // goBack should handle scorecard on top of solution console, but not obLiveModal
  assert.ok(!appSource.includes('obLiveModal && obLiveModal.style.display'));
});

test('ESC key handler no longer checks for obLiveModal', () => {
  // ESC should handle examModal, userModal, scorecardModal but not obLiveModal
  const escHandlerMatch = appSource.match(/if \(e\.key === 'Escape'\) \{[\s\S]*?this\.goBack\(\)\;/);
  if (escHandlerMatch) {
    const handlerCode = escHandlerMatch[0];
    assert.ok(!handlerCode.includes('obLiveModal'), 'ESC handler should not check obLiveModal');
    assert.ok(!handlerCode.includes('ob-live-browser-modal'), 'ESC handler should not check ob-live-browser-modal');
  }
});

test('startMockTest and resumeMockTest no longer close live browser modal', () => {
  assert.ok(!appSource.includes('If live browser modal was open'));
  assert.ok(!appSource.includes('liveModal && (liveModal.style.display'));
});