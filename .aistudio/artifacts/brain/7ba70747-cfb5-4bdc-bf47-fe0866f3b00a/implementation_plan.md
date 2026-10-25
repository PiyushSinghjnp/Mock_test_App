# Logic Flaws Resolution Plan (All 9 Fixes)

## 1. Objective
Fix all 9 identified logic flaws across the Live Test Engine (`/js/test-engine.js`), Solution Window (`/js/solution-engine.js`), Dashboard Controller (`/js/app.js`), and Backend Analytics (`/server.js`), while strictly preserving the standard TCS iON rule where an option is only counted as answered when **Save & Next** or **Mark for Review & Next** is clicked.

---

## 2. Planned Fixes

### Fix 1: Prevent Timer/UI Race Condition on Submit & Next Section Confirmation (`test-engine.js`)
- Track when the in-pane confirmation screen (`#submit-pane` + `#sure`) is open (`this.isConfirmPaneOpen = true` in `finalSubmit()`, reset to `false` in `sBack()`, `startActiveExam()`, and `submitTest()`).
- Add a submission guard (`this.isSubmitting`) so `submitTest()` cannot be triggered twice if the timer expires at the exact moment the user clicks **Submit**.
- If `handleSectionTimeout()` fires while the user is viewing the confirmation screen (`#submit-pane`), automatically close the confirmation screen (`sBack()`) before advancing to the next section or submitting the exam so the UI never gets stuck on a stale summary pane.

### Fix 2: Accurate Total Exam Time Calculation Across Pause/Resume Sessions (`test-engine.js`)
- Compute `totalTimeSeconds` upon submission as the sum of recorded per-question `timeSpentSeconds` across all questions (with a fallback to `testData.totalDurationSeconds - this.remainingSeconds`), rather than `Date.now() - this.startTime`.
- Ensure `pauseTest()` clears `this.currentQuestionEntryTime = null` so time spent sitting on the Pause dialog is never added to the active question's timer if `finalSubmit` or `savePausedStateAndExit` is called.

### Fix 3: Strict TCS iON Rule with Unsaved Draft Warning on Confirmation Screen (`test-engine.js`)
- Enforce the strict TCS iON rule: only options committed via **Save & Next** or **Mark for Review & Next** (`response.selectedIndex`) are scored on timer expiry or exam submission.
- If the candidate has clicked a radio option on the current question (`pendingSelectedIndex !== null` and `pendingSelectedIndex !== response.selectedIndex`) and clicks **Next Section** or **Submit** without clicking **Save & Next**, display a clear warning banner on the confirmation screen alerting them that their current question has an unsaved selection so they can click **Back to Test** and press **Save & Next** if desired, while discarding uncommitted `draftSelectedIndex` if a section timer expires.

### Fix 4: Sectional Breakdown Fallback to Parent Section Title (`test-engine.js`)
- In `submitTest()` (`test-engine.js:1618-1647`), stamp `q.section = q.section || sec.title || 'General'` when iterating through `this.testData.sections` so every question is guaranteed to map to its actual section title in the scorecard table and analytics breakdown.

### Fix 5: Fix Paused Test Card Section & Question Number Display (`app.js`)
- In `loadAndRenderMockCards()` (`app.js:837, 867`), read both camelCase and snake_case keys from `pausedAttempt`:
  - `const pausedSecIdx = paused.currentSectionIndex ?? paused.current_section_index ?? 0;`
  - `const pausedQIdx = paused.currentQuestionIndex ?? paused.current_question_index ?? 0;`
  - `const remSec = paused.sectionRemainingSeconds ?? paused.section_remaining_seconds ?? paused.remainingSeconds ?? paused.remaining_seconds ?? 1200;`
- This ensures paused test cards accurately display `⏸ Paused at Section X, QY` and the exact remaining minutes.

### Fix 6: Normalize `avgScore` Across Mixed-Max-Marks Tests & Compute Real `streakDays` (`server.js`)
- In `/api/analytics` (`server.js:1060-1108`):
  - Compute normalized average score percentage and weighted/matched denominator (`avgMaxScore = representativeAttempts.reduce((sum, a) => sum + (a.max_score || 100), 0) / repCount`) so `avgScore` never produces an impossible ratio like `85.00 / 30` when mixing Mains (150 marks) and Sectional (30 marks) tests.
  - Calculate actual `streakDays` from distinct calendar dates (`YYYY-MM-DD`) in the user's `attempts` history instead of hardcoding `1`.

### Fix 7: Add Local Fallback in `viewSolutions` and `viewAttemptScorecard` (`app.js`)
- In `viewSolutions()` and `viewAttemptScorecard()` (`app.js:2421-2462`), if `/api/tests/:id` returns null or fails, fall back to `window.OB_TEST_APP.mockQuestions[testId]`, and if `/api/attempts/:id` is not found in SQLite, check the localStorage fallback (`ob_attempts_<userId>`).

### Fix 8: Prevent Duplicate Diagram Rendering in Solution Window (`solution-engine.js`)
- In `goToQuestion()` (`solution-engine.js:596`), check `if (q.imageUrls && Array.isArray(q.imageUrls) && q.imageUrls.length > 0 && !rawQuestion.includes('<img'))` before prepending `q.imageUrls`, matching `test-engine.js:913` so diagrams are never rendered twice.

### Fix 9: Synchronize Scorecard Engine Instance in Solution Window (`solution-engine.js`)
- In `openScorecardModal()` (`solution-engine.js:995`), use `window.appController.testEngine` (initializing and attaching it to `window.appController.testEngine` if needed) instead of a disconnected `window.activeTestEngine` variable.

---

## 3. Verification
- Compile the application and verify zero syntax or runtime errors.
- Verify pause/resume card metadata, timer behavior during the confirmation screen, strict TCS iON Save & Next behavior with unsaved-selection notice, solution image deduplication, and analytics score calculations.
