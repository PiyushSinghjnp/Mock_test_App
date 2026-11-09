'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const testEngineSource = fs.readFileSync(path.join(__dirname, '..', 'js', 'test-engine.js'), 'utf8');
const appSource = fs.readFileSync(path.join(__dirname, '..', 'js', 'app.js'), 'utf8');
const solutionEngineSource = fs.readFileSync(path.join(__dirname, '..', 'js', 'solution-engine.js'), 'utf8');

test('scorecard close button reveals solution console when open', () => {
  // Test that the btnCloseScorecard onclick handler checks for obSolutionEngine.isOpen
  assert.match(testEngineSource, /btnCloseScorecard\.onclick = \(\) => \{[\s\S]*?if \(window\.obSolutionEngine\?\.isOpen\) \{[\s\S]*?this\.scorecardOverlay\.classList\.remove\('active'\);[\s\S]*?return;/);
});

test('app.goBack closes only scorecard when solution console is open underneath', () => {
  // Test that goBack() handles scorecard on top of solution console
  assert.match(appSource, /If Scorecard Modal is open on top of Solution Console, close ONLY the Scorecard Modal/);
  // Check the specific condition and action
  assert.ok(appSource.includes("scorecardModal && scorecardModal.classList.contains('active') && solnOverlay && solnOverlay.classList.contains('active')"));
  assert.ok(appSource.includes("scorecardModal.classList.remove('active')"));
  assert.ok(appSource.includes("return;"));
});

test('solution engine _doExit hides overlay and restores body overflow', () => {
  // Test solution engine exit behavior
  assert.match(solutionEngineSource, /_doExit\(skipRefresh = false\) \{[\s\S]*?this\.isOpen = false;/);
  assert.match(solutionEngineSource, /this\.overlay\.classList\.remove\('active'\);[\s\S]*?this\.overlay\.style\.display = 'none';/);
  assert.match(solutionEngineSource, /document\.body\.style\.overflow = 'auto';/);
});

test('test engine _doExitTest stops timer and clears autosave interval', () => {
  // Test test engine cleanup on exit
  assert.match(testEngineSource, /_doExitTest\(skipRefresh = false\) \{[\s\S]*?this\.stopTimer\(\);[\s\S]*?clearInterval\(this\.autosaveInterval\);/);
  assert.match(testEngineSource, /this\.isExamActive = false;/);
  assert.match(testEngineSource, /this\.isPaused = false;/);
});

test('solution engine open() hides scorecard modal', () => {
  // Test that opening solution console hides scorecard
  assert.match(solutionEngineSource, /const scorecardModal = document\.getElementById\('scorecard-modal-overlay'\);[\s\S]*?if \(scorecardModal\) scorecardModal\.classList\.remove\('active'\);/);
});

test('app exitSolutionsToTests calls _doExit with skipRefresh=true', () => {
  // Test that exitSolutionsToTests properly exits solution engine
  assert.match(appSource, /async exitSolutionsToTests\(fromPopstate = false\) \{[\s\S]*?window\.obSolutionEngine\._doExit\(true\);/);
  assert.match(appSource, /solnOverlay\.classList\.remove\('active'\);[\s\S]*?solnOverlay\.style\.display = 'none';/);
});

test('scorecard launch solutions button calls _openScorecardSolutions', () => {
  // Test scorecard solution button handler
  assert.match(testEngineSource, /btnLaunchSol\.onclick = async \(\) => \{[\s\S]*?await this\._openScorecardSolutions\(attemptId, testData\.id\);/);
  // Should check if solution engine is already open
  assert.match(testEngineSource, /async _openScorecardSolutions\(attemptId, testId\) \{[\s\S]*?if \(window\.obSolutionEngine\?\.isOpen\) return true;/);
});