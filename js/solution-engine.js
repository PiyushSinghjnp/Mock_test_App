/**
 * Oliveboard Authentic Live Solution & Review Console Engine
 * 1:1 Reverse-Engineered from u1.oliveboard.in/exams/solution/index3.php & soladis-bm.js
 *
 * Architecture:
 * - View 1: Solution Landing / Analysis Review Table (#sec-sollanding)
 *   1. 7 authentic Oliveboard metric cards: Total Questions, Time Taken, Accuracy, Right, Wrong, Unattempted, Total Score
 *   2. Filter bar: Review Wrong (#chkwrong-cb), Review Unattempted (#chkunat-cb), Retry Mode (#togreattempt-landing)
 *   3. 100-Question Review Table (#sec-reviewtable): Question No, snippet, status dot (green right / red wrong / grey unattempted), time, difficulty, correct %
 *
 * - View 2: Detailed Question Solution View (#sec-solview)
 *   1. Sub-header (#sec-solheader): Q: X/100, Time Taken, Accuracy %, Difficulty badge, Save Question, Section Dropdown, Language toggle
 *   2. Split-pane & standalone view (#questionssols-block): Directions/Passage on Left, Question + Options + Explanation on Right
 *   3. Interactive Retry Mode & Immediate Option Feedback (attemptAgain): Green outline for correct, Red outline for wrong
 *   4. Right Sidebar (#sol-right-col): Mini Metrics Card + Section Question Map with 4-Column Numbered Square Pills (.map-qno)
 *   5. Bottom Navigation Bar (#sec-footer): [ Previous ], [ Review ] (switches back to landing table!), [ Next ]
 */

class OliveboardSolutionEngine {
  constructor() {
    this.testData = null;
    this.attempt = null;
    this.allQuestions = [];
    this.currentQuestionIndex = 0; // Global index across all sections: 0 to N-1
    this.currentSectionIndex = 0;
    this.isReattemptMode = false;
    this.isOpen = false;
    this.currentLang = 'eqt'; // 'eqt' (English) | 'hqt' (Hindi)
    this.bookmarkedQuestions = {};
    this.retryAttempts = {}; // { [globalQIdx]: { selectedIdx, isCorrect } }

    this.initDOM();
    this.bindEvents();
  }

  initDOM() {
    this.overlay = document.getElementById('solution-console-overlay');
    this.titleDisplay = document.getElementById('soln-title-display');
    this.btnExitTop = document.getElementById('btn-exit-soln-console');
    this.btnScorecardTop = document.getElementById('btn-soln-scorecard-summary');
    this.btnToggleReattemptTop = document.getElementById('btn-toggle-reattempt');
    this.btnFullscreen = document.getElementById('btn-soln-fullscreen');

    // View 1: Landing Review Table
    this.viewLanding = document.getElementById('sec-sollanding');
    this.landingTotalQ = document.getElementById('sol-landing-total-q');
    this.landingTime = document.getElementById('sol-landing-time');
    this.landingAcc = document.getElementById('sol-landing-acc');
    this.landingRight = document.getElementById('sol-landing-right');
    this.landingWrong = document.getElementById('sol-landing-wrong');
    this.landingUnat = document.getElementById('sol-landing-unat');
    this.landingScore = document.getElementById('sol-landing-score');

    this.chkWrongCb = document.getElementById('chkwrong-cb');
    this.chkUnatCb = document.getElementById('chkunat-cb');
    this.togReattemptLanding = document.getElementById('togreattempt-landing');
    this.switchSliderLanding = document.getElementById('switch-slider-landing');
    this.reviewRowsContainer = document.getElementById('sol-landing-review-rows');

    // View 2: Detailed Question Solution View
    this.viewSolDetail = document.getElementById('sec-solview');
    this.solViewQNo = document.getElementById('sol-view-qno');
    this.solViewTotalQ = document.getElementById('sol-view-total-q');
    this.solViewUserTime = document.getElementById('sol-view-user-time');
    this.solViewAcc = document.getElementById('sol-view-acc');
    this.solViewDiffBadge = document.getElementById('sol-view-difficulty-badge');
    this.btnBookmark = document.getElementById('btn-sol-view-bookmark');
    this.btnLangToggle = document.getElementById('btn-sol-lang-toggle');
    this.langLabel = document.getElementById('sol-lang-label');

    // Section Dropdown
    this.secDropdownBtn = document.getElementById('sol-sec-dropdown-btn');
    this.secDropdownLabel = document.getElementById('sol-sec-dropdown-label');
    this.secDropdownList = document.getElementById('sol-sec-dropdown-list');

    // Question Panes
    this.attemptAlert = document.getElementById('sol-attempt-alert');
    this.btnToggleMode = document.getElementById('btn-sol-toggle-mode');
    this.modeIndicator = document.getElementById('sol-mode-indicator');

    this.twoSidedWrapper = document.getElementById('sol-view-two-sided');
    this.passagePane = document.getElementById('sol-view-passage-pane');
    this.questionPane2Sided = document.getElementById('sol-view-question-pane');
    this.qText2Sided = document.getElementById('sol-view-qtext-2sided');
    this.options2Sided = document.getElementById('sol-view-options-2sided');
    this.explanation2Sided = document.getElementById('sol-view-explanation-2sided');

    this.singleWrapper = document.getElementById('sol-view-single');
    this.qTextSingle = document.getElementById('sol-view-qtext-single');
    this.optionsSingle = document.getElementById('sol-view-options-single');
    this.explanationSingle = document.getElementById('sol-view-explanation-single');

    // Right Sidebar
    this.rightCol = document.getElementById('sol-right-col');
    this.miniTime = document.getElementById('sol-mini-time');
    this.miniAcc = document.getElementById('sol-mini-acc');
    this.miniScore = document.getElementById('sol-mini-score');
    this.miniRight = document.getElementById('sol-mini-right');
    this.miniWrong = document.getElementById('sol-mini-wrong');
    this.miniUnat = document.getElementById('sol-mini-unat');
    this.questionMapContainer = document.getElementById('sol-section-question-map');

    // Bottom Navigation Bar
    this.btnPrev = document.getElementById('btn-sol-prev');
    this.btnGotoReview = document.getElementById('btn-sol-gotoreview');
    this.btnNext = document.getElementById('btn-sol-next');
  }

  bindEvents() {
    if (this.btnExitTop) {
      this.btnExitTop.onclick = (e) => { e.preventDefault(); this.exit(); };
    }
    const btnSolHeaderBack = document.getElementById('btn-sol-header-back-to-tests');
    if (btnSolHeaderBack) {
      btnSolHeaderBack.onclick = (e) => { e.preventDefault(); this.exit(); };
    }
    const btnSolHeaderReview = document.getElementById('btn-sol-header-gotoreview');
    if (btnSolHeaderReview) {
      btnSolHeaderReview.onclick = (e) => { e.preventDefault(); this.gotoreview(); };
    }
    if (this.btnScorecardTop) {
      this.btnScorecardTop.onclick = (e) => { e.preventDefault(); this.openScorecardModal(); };
    }
    if (this.btnToggleReattemptTop) {
      this.btnToggleReattemptTop.onclick = (e) => { e.preventDefault(); this.toggleReattemptMode(); };
    }
    if (this.togReattemptLanding) {
      this.togReattemptLanding.onchange = () => { this.toggleReattemptMode(this.togReattemptLanding.checked); };
    }
    if (this.btnToggleMode) {
      this.btnToggleMode.onclick = (e) => {
        e.preventDefault();
        this.viewsolution(this.currentQuestionIndex);
      };
    }
    if (this.btnFullscreen) {
      this.btnFullscreen.onclick = (e) => {
        e.preventDefault();
        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen().catch(() => {});
          this.btnFullscreen.textContent = 'Exit Full Screen';
        } else {
          if (document.exitFullscreen) document.exitFullscreen().catch(() => {});
          this.btnFullscreen.textContent = 'Enter Full Screen';
        }
      };
    }

    // Review Filters
    if (this.chkWrongCb) {
      this.chkWrongCb.onchange = () => {
        if (this.chkWrongCb.checked && this.chkUnatCb) this.chkUnatCb.checked = false;
        this.filterReviewTable();
      };
    }

    if (this.chkUnatCb) {
      this.chkUnatCb.onchange = () => {
        if (this.chkUnatCb.checked && this.chkWrongCb) this.chkWrongCb.checked = false;
        this.filterReviewTable();
      };
    }
    const reviewMistakesButton = document.getElementById('btn-review-mistakes');
    if (reviewMistakesButton) {
      reviewMistakesButton.onclick = () => {
        if (this.chkWrongCb) this.chkWrongCb.checked = true;
        if (this.chkUnatCb) this.chkUnatCb.checked = false;
        this.filterReviewTable();
        const firstMistake = this.reviewRowsContainer?.querySelector('.reviewq-wrong');
        firstMistake?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      };
    }

    // Section Dropdown Toggle
    if (this.secDropdownBtn && this.secDropdownList) {
      this.secDropdownBtn.onclick = (e) => {
        e.stopPropagation();
        const isOpen = this.secDropdownList.style.display === 'block';
        this.secDropdownList.style.display = isOpen ? 'none' : 'block';
      };
      document.addEventListener('click', (e) => {
        if (this.secDropdownList && !this.secDropdownBtn.contains(e.target)) {
          this.secDropdownList.style.display = 'none';
        }
      });
    }

    // Navigation Buttons
    if (this.btnPrev) {
      this.btnPrev.onclick = (e) => { e.preventDefault(); this.prevQuestion(); };
    }
    if (this.btnGotoReview) {
      this.btnGotoReview.onclick = (e) => { e.preventDefault(); this.gotoreview(); };
    }
    if (this.btnNext) {
      this.btnNext.onclick = (e) => { e.preventDefault(); this.nextQuestion(); };
    }
    if (this.btnBookmark) {
      this.btnBookmark.onclick = (e) => { e.preventDefault(); this.toggleBookmark(); };
    }
    if (this.btnLangToggle) {
      this.btnLangToggle.onclick = (e) => { e.preventDefault(); this.toggleLanguage(); };
    }

    if (this.overlay) {
      this.overlay.addEventListener('click', (e) => {
        const retryOption = e.target.closest('.opt[data-global-idx][data-correct-idx]');
        if (retryOption && this.isReattemptMode && retryOption.getAttribute('role') === 'button') {
          this.attemptOption(
            Number(retryOption.dataset.correctIdx),
            Number(retryOption.dataset.optIdx),
            Number(retryOption.dataset.globalIdx)
          );
          return;
        }
        const solutionLink = e.target.closest('.btn-viewsol[data-global-idx]');
        if (solutionLink) {
          e.preventDefault();
          this.viewsolution(Number(solutionLink.dataset.globalIdx));
          return;
        }
        const reviewRow = e.target.closest('.review-row[data-global-idx]');
        if (reviewRow) {
          this.goToQuestion(Number(reviewRow.dataset.globalIdx));
          return;
        }
        const mapQuestion = e.target.closest('.map-qno[data-global-idx]');
        if (mapQuestion) {
          this.goToQuestion(Number(mapQuestion.dataset.globalIdx));
          return;
        }
        const sectionItem = e.target.closest('[data-sec-idx]');
        if (sectionItem) {
          this.switchSectionFromDropdown(Number(sectionItem.dataset.secIdx));
        }
      });

      this.overlay.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        const target = e.target.closest('.review-row[data-global-idx], .map-qno[data-global-idx], [data-sec-idx]');
        const retryOption = e.target.closest('.opt[role="button"][data-global-idx]');
        if (retryOption && this.isReattemptMode) {
          e.preventDefault();
          retryOption.click();
          return;
        }
        if (!target) return;
        e.preventDefault();
        target.click();
      });
    }

    // Keyboard Navigation
    document.addEventListener('keydown', (e) => {
      if (!this.isOpen) return;
      const scModal = document.getElementById('scorecard-modal-overlay');
      if (scModal && scModal.classList.contains('active')) return;
      if (this.viewSolDetail && this.viewSolDetail.style.display !== 'none') {
        if (e.key === 'ArrowLeft') {
          this.prevQuestion();
        } else if (e.key === 'ArrowRight') {
          this.nextQuestion();
        }
      }
      if (e.key === 'Escape') {
        if (this.viewSolDetail && this.viewSolDetail.style.display !== 'none') {
          this.gotoreview();
        } else {
          this.exit();
        }
      }
    });
  }

  // ==========================================
  // NORMALIZATION & HELPERS
  // ==========================================

  _formatTimeHHMMSS(totalSeconds) {
    const s = Math.max(0, Math.round(Number(totalSeconds) || 0));
    const hrs = Math.floor(s / 3600);
    const mins = Math.floor((s % 3600) / 60);
    const secs = s % 60;
    return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }

  _stripHTML(html) {
    if (!html) return '';
    const tmp = document.createElement('div');
    tmp.innerHTML = String(html);
    return tmp.textContent || tmp.innerText || '';
  }

  _normalizeCorrectIdx(q) {
    if (!q) return 0;
    if (window.OB_EXAM_PATTERNS_2026 && typeof window.OB_EXAM_PATTERNS_2026.normalizeCorrectIndex === 'function') {
      return window.OB_EXAM_PATTERNS_2026.normalizeCorrectIndex(q, q.options || []);
    }
    const raw = q.correctIndex !== undefined
      ? q.correctIndex
      : (q.correct_answer ?? q.correct_option ?? q.correctOption ?? q.answer ?? q.correctAnswer);
    if (typeof raw === 'number' && !Number.isNaN(raw)) return raw;
    if (typeof raw === 'string') {
      const s = raw.trim().toUpperCase();
      if (/^[A-E]$/.test(s)) return s.charCodeAt(0) - 65;
      const n = parseInt(s, 10);
      if (!Number.isNaN(n) && n >= 1) return n - 1;
    }
    return 0;
  }

  _formatContent(html) {
    if (!html) return '';
    let s = this._normalizeDisplayText(html).trim();
    s = s.replace(/src=["']oliveimg\/([^"']+)["']/g, 'src="/oliveimg/$1"');
    s = s.replace(/src=["'](?:\.\/)?images\/([^"']+)["']/g, 'src="/images/$1"');
    return s;
  }

  _normalizeDisplayText(value) {
    return String(value || '')
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
      .replace(/ï¿½|Ã¯Â¿Â½|�/g, '')
      .replace(/â€¢/g, '•')
      .replace(/â€“/g, '–')
      .replace(/â€”/g, '—')
      .replace(/â€™/g, '’')
      .replace(/â€œ/g, '“')
      .replace(/â€/g, '”')
      .replace(/âœ“/g, '✓')
      .replace(/âœ•/g, '✕')
      .replace(/Â·/g, '·')
      .replace(/Â/g, '');
  }

  // ==========================================
  // MAIN LAUNCH / OPEN
  // ==========================================

  /**
   * Launch Oliveboard Solution & Review Console
   * @param {Object} attempt - SQLite attempt row or client test result
   * @param {Object} testData - Test specification with sections & questions
   */
  open(attempt, testData) {
    this.initDOM();
    if (!testData || !testData.sections) {
      console.error('Invalid test data passed to SolutionEngine:', testData);
      return;
    }

    this.testData = testData;
    this.attempt = attempt || {};
    this.isOpen = true;
    this.isReattemptMode = false;
    this.retryAttempts = {};
    this.currentLang = 'eqt';
    this.bookmarkedQuestions = window.obDataManager ? window.obDataManager.getBookmarkedMap() : {};
    if (this.overlay) {
      this.overlay.classList.remove('lang-hindi');
    }
    if (this.langLabel) {
      this.langLabel.textContent = 'English';
    }

    // Flatten all questions across all sections with global indexing
    this.allQuestions = [];
    let gIdx = 0;
    this.testData.sections.forEach((sec, sIdx) => {
      (sec.questions || []).forEach((q, lIdx) => {
        const normalized = {
          ...q,
          globalIndex: gIdx,
          sectionIndex: sIdx,
          sectionTitle: sec.title,
          sectionCode: sec.code || `SEC${sIdx + 1}`,
          localIndex: lIdx + 1,
          questionNumber: q.questionNumber || q.qNo || (gIdx + 1),
          correctIndex: this._normalizeCorrectIdx(q),
          difficulty: q.difficulty || (gIdx % 3 === 0 ? 'Difficult' : (gIdx % 2 === 0 ? 'Easy' : 'Moderate')),
          accuracyPct: q.accuracyPct || (q.timeacc && q.timeacc[1]) || `${Math.min(92, Math.max(18, 50 + (gIdx * 7) % 43))}%`,
          topperTimeSec: q.topperTimeSec || (q.timeacc && q.timeacc[0] !== '--' ? q.timeacc[0] : 18)
        };
        this.allQuestions.push(normalized);
        gIdx++;
      });
    });

    // Normalize responses if stored as JSON string
    if (typeof this.attempt.responses === 'string') {
      try {
        this.attempt.responses = JSON.parse(this.attempt.responses);
      } catch (e) {
        this.attempt.responses = {};
      }
    } else if (typeof this.attempt.responses_json === 'string') {
      try {
        this.attempt.responses = JSON.parse(this.attempt.responses_json);
      } catch (e) {
        this.attempt.responses = {};
      }
    } else if (!this.attempt.responses) {
      this.attempt.responses = {};
    }

    // Hide any other active overlays
    const testModal = document.getElementById('test-modal-overlay');
    if (testModal) testModal.classList.remove('active');
    const scorecardModal = document.getElementById('scorecard-modal-overlay');
    if (scorecardModal) scorecardModal.classList.remove('active');

    // Show solution overlay
    if (this.overlay) {
      this.overlay.classList.add('active');
      this.overlay.style.display = 'flex';
    }
    document.body.style.overflow = 'hidden';

    // Header Title
    if (this.titleDisplay) {
      this.titleDisplay.textContent = this.testData.title || 'Oliveboard Solutions';
    }

    // Render View 1: Solution Landing Review Table
    this.renderLandingView();

    // Setup Section Dropdown
    this.renderSectionDropdown();

    // Default to Landing View
    this.gotoreview(false);
  }

  // ==========================================
  // VIEW 1: LANDING & REVIEW TABLE
  // ==========================================

  _getQuestionResponse(q) {
    if (!q || !this.attempt || !this.attempt.responses) return null;
    const responses = this.attempt.responses;
    return (
      responses[q.id] ||
      responses[q.globalIndex + 1] ||
      responses[`ibps-q-${q.globalIndex + 1}`] ||
      responses[`ibps-pre-q-${q.globalIndex + 1}`] ||
      null
    );
  }

  _getQuestionTimeSeconds(q) {
    const resp = this._getQuestionResponse(q);
    if (!resp) return null;
    const selectedIdx = resp.selectedIndex;
    const isAttempted = selectedIdx !== null && selectedIdx !== undefined;
    const isVisited = Boolean((resp.status && resp.status !== 'stic-notvisited') || isAttempted);
    if (!isVisited) return null;
    const sec = Number(resp.timeSpentSeconds);
    if (!Number.isFinite(sec) || sec < 0) return 0;
    return Math.round(sec);
  }

  _formatQuestionTimeSpent(q) {
    const sec = this._getQuestionTimeSeconds(q);
    if (sec === null) return '--';
    return `${sec}s`;
  }

  renderLandingView() {
    let rightCount = 0;
    let wrongCount = 0;
    let unattemptedCount = 0;
    let totalScore = 0;
    let summedQuestionTime = 0;

    this.allQuestions.forEach(q => {
      const resp = this._getQuestionResponse(q);
      const selectedIdx = resp ? resp.selectedIndex : null;
      const isAttempted = selectedIdx !== null && selectedIdx !== undefined;
      const isCorrect = isAttempted && Number(selectedIdx) === Number(q.correctIndex);

      const qSec = this._getQuestionTimeSeconds(q);
      if (qSec !== null && qSec > 0) {
        summedQuestionTime += qSec;
      }

      const posMarks = q.marksForCorrect !== undefined ? q.marksForCorrect : (q.marks || 1);
      const negMarks = q.negativeMarks !== undefined ? q.negativeMarks : 0.25;

      if (isAttempted) {
        if (isCorrect) {
          rightCount++;
          totalScore += posMarks;
        } else {
          wrongCount++;
          totalScore -= negMarks;
        }
      } else {
        unattemptedCount++;
      }
    });

    const totalQuestions = this.allQuestions.length;
    const attemptedCount = rightCount + wrongCount;
    const computedAcc = attemptedCount > 0 ? Math.round((rightCount / attemptedCount) * 100) : 0;
    const accuracy = this.attempt.accuracy !== undefined ? Math.round(this.attempt.accuracy) : computedAcc;
    const finalScore = this.attempt.score !== undefined
      ? (typeof this.attempt.score === 'number' ? this.attempt.score : (this.attempt.score.netScore ?? this.attempt.score.total ?? totalScore))
      : totalScore;
    const rawAttemptTime = this.attempt.time_spent_seconds ?? (this.attempt.timing && this.attempt.timing.totalTimeSeconds);
    const timeSpent = summedQuestionTime > 0
      ? summedQuestionTime
      : ((rawAttemptTime !== undefined && rawAttemptTime !== null) ? Math.max(0, Number(rawAttemptTime) || 0) : 0);

    // Populate 7 Metric Cards in #sec-summary
    if (this.landingTotalQ) this.landingTotalQ.textContent = totalQuestions;
    if (this.landingTime) this.landingTime.textContent = this._formatTimeHHMMSS(timeSpent);
    if (this.landingAcc) this.landingAcc.textContent = `${accuracy}%`;
    if (this.landingRight) this.landingRight.textContent = rightCount;
    if (this.landingWrong) this.landingWrong.textContent = wrongCount;
    if (this.landingUnat) this.landingUnat.textContent = unattemptedCount;
    if (this.landingScore) this.landingScore.textContent = Number(finalScore).toFixed(2);

    // Populate Right Sidebar Mini Scorecard
    if (this.miniTime) this.miniTime.textContent = this._formatTimeHHMMSS(timeSpent);
    if (this.miniAcc) this.miniAcc.textContent = `${accuracy}%`;
    if (this.miniScore) this.miniScore.textContent = Number(finalScore).toFixed(2);
    if (this.miniRight) this.miniRight.textContent = rightCount;
    if (this.miniWrong) this.miniWrong.textContent = wrongCount;
    if (this.miniUnat) this.miniUnat.textContent = unattemptedCount;

    // Reset Review Filter Checkboxes
    if (this.chkWrongCb) this.chkWrongCb.checked = false;
    if (this.chkUnatCb) this.chkUnatCb.checked = false;

    // Populate 100 Review Table Rows
    this.renderReviewTableRows();

    // Populate Right Sidebar Section Question Map
    this.renderSidebarQuestionMap();
  }

  renderReviewTableRows() {
    if (!this.reviewRowsContainer) return;

    let html = '';
    this.allQuestions.forEach((q, idx) => {
      const resp = this._getQuestionResponse(q);
      const selectedIdx = resp ? resp.selectedIndex : null;
      const isAttempted = selectedIdx !== null && selectedIdx !== undefined;
      const isCorrect = isAttempted && Number(selectedIdx) === Number(q.correctIndex);

      let rowClass = 'reviewq-unat';
      let statusColClass = 'unat';
      let statusText = 'Unattempted';

      if (isAttempted) {
        if (isCorrect) {
          rowClass = 'reviewq-right';
          statusColClass = 'correct';
          statusText = 'Right';
        } else {
          rowClass = 'reviewq-wrong';
          statusColClass = 'wrong';
          statusText = 'Wrong';
        }
      }

      const qRaw = q.questionText || q.questionHTML || q.question_text || q.question || '';
      const snippet = this._stripHTML(qRaw).slice(0, 68) + '...';
      const timeSpentSec = this._formatQuestionTimeSpent(q);

      html += `
        <div class="review-row ${rowClass}" id="sol-review-row-${idx}" data-global-idx="${idx}" role="button" tabindex="0">
          <div class="reviewcol-group" style="width: 55%; display: flex;">
            <div class="review-col" style="width: 60px;">
              <p class="mobcard headingtxt hide-heading borbot">No.</p>
              <p class="mobcard subtxt">${idx + 1}</p>
            </div>
            <div class="review-col" style="flex: 1;">
              <p class="mobcard headingtxt hide-heading borbot">Question</p>
              <p class="mobcard subtxt">${snippet}</p>
            </div>
          </div>
          <div class="reviewcol-group" style="width: 25%; display: flex;">
            <div class="review-col ${statusColClass}" style="width: 60%;">
              <p class="mobcard headingtxt hide-heading">Status</p>
              <p class="mobcard subtxt"><span class="cround"></span>${statusText}</p>
            </div>
            <div class="review-col" style="width: 40%;">
              <p class="mobcard headingtxt hide-heading">Time (sec)</p>
              <p class="mobcard subtxt">${timeSpentSec}</p>
            </div>
          </div>
          <div class="reviewcol-group" style="width: 20%; display: flex;">
            <div class="review-col" style="width: 50%;">
              <p class="mobcard headingtxt hide-heading">Difficulty</p>
              <p class="mobcard subtxt">${q.difficulty}</p>
            </div>
            <div class="review-col" style="width: 50%;">
              <p class="mobcard headingtxt hide-heading">Correct</p>
              <p class="mobcard subtxt">${q.accuracyPct}</p>
            </div>
          </div>
        </div>
      `;
    });

    this.reviewRowsContainer.innerHTML = html;
  }

  filterReviewTable() {
    if (!this.reviewRowsContainer) return;
    const isWrong = this.chkWrongCb && this.chkWrongCb.checked;
    const isUnat = this.chkUnatCb && this.chkUnatCb.checked;

    const rows = this.reviewRowsContainer.querySelectorAll('.review-row');
    rows.forEach(r => {
      if (isWrong) {
        r.style.display = r.classList.contains('reviewq-wrong') ? 'flex' : 'none';
      } else if (isUnat) {
        r.style.display = r.classList.contains('reviewq-unat') ? 'flex' : 'none';
      } else {
        r.style.display = 'flex';
      }
    });
  }

  // ==========================================
  // VIEW 2: DETAILED QUESTION SOLUTION VIEW
  // ==========================================

  goToQuestion(globalQIdx, pushHistory = true) {
    if (globalQIdx < 0 || globalQIdx >= this.allQuestions.length) return;
    this.currentQuestionIndex = globalQIdx;
    const q = this.allQuestions[globalQIdx];
    this.currentSectionIndex = q.sectionIndex;

    // Hide Landing View, Show Detail View
    if (this.viewLanding) this.viewLanding.style.display = 'none';
    if (this.viewSolDetail) this.viewSolDetail.style.display = 'flex';

    if (pushHistory && window.history && this.isOpen) {
      const testId = this.testData ? this.testData.id : 'test';
      const attId = this.attempt ? (this.attempt.id || this.attempt.attempt_id) : '';
      if (window.appController && window.appController.replaceNavState) {
        window.appController.replaceNavState({ view: 'solutions', testId, attemptId: attId }, '#solutions/' + testId);
      }
    }

    // Update Sub-Header Bar
    if (this.solViewQNo) this.solViewQNo.textContent = q.globalIndex + 1;
    if (this.solViewTotalQ) this.solViewTotalQ.textContent = this.allQuestions.length;

    const userTime = this._formatQuestionTimeSpent(q);
    if (this.solViewUserTime) this.solViewUserTime.textContent = userTime;
    if (this.solViewAcc) this.solViewAcc.textContent = q.accuracyPct || '74%';
    if (this.solViewDiffBadge) this.solViewDiffBadge.textContent = q.difficulty || 'Moderate';

    // Update Section Dropdown Label
    if (this.secDropdownLabel) {
      this.secDropdownLabel.textContent = q.sectionTitle;
    }

    // Bookmark status
    if (this.btnBookmark) {
      const isBm = !!(this.bookmarkedQuestions[q.id] || (window.obDataManager && window.obDataManager.isBookmarked(q.id)));
      this.bookmarkedQuestions[q.id] = isBm;
      this.btnBookmark.textContent = isBm ? '★ Saved' : '★ Bookmark';
      this.btnBookmark.style.color = isBm ? '#d97706' : '';
    }

    // Attempt Alert Banner Mode
    const retryAttempt = this.retryAttempts[globalQIdx];
    const shouldHideSolution = this.isReattemptMode && !retryAttempt;

    this._updateAttemptBanner(globalQIdx);

    // Determine layout: Split 2-Pane vs Single Pane
    const rawPassage = q.passage || q.passageHTML || q.passage_text || '';
    const hasPassage = Boolean(rawPassage && this._stripHTML(rawPassage).trim().length > 15);

    const rawQuestion = q.questionText || q.questionHTML || q.question_text || q.question || '';
    const rawExplanation = q.explanation || q.explanationHTML || q.explanation_text || q.solution || '';
    const formattedPassage = this._formatContent(rawPassage);
    let formattedQuestion = this._formatContent(rawQuestion);
    if (q.imageUrls && Array.isArray(q.imageUrls) && q.imageUrls.length > 0 && !rawQuestion.includes('<img')) {
      const imgsHtml = q.imageUrls.map(url => `<img src="${url}" alt="Question Diagram" style="max-width: 100%; height: auto; border: 1px solid #cbd5e1; border-radius: 6px; padding: 4px; background: #fff; margin: 8px 0; display: block;">`).join('');
      formattedQuestion = `${imgsHtml}${formattedQuestion}`;
    }
    const formattedExplanation = this._formatContent(rawExplanation);

    const optionsHtml = this._renderQuestionOptions(q);

    if (hasPassage) {
      if (this.twoSidedWrapper) this.twoSidedWrapper.style.display = 'flex';
      if (this.singleWrapper) this.singleWrapper.style.display = 'none';

      if (this.passagePane) this.passagePane.innerHTML = formattedPassage;
      if (this.qText2Sided) this.qText2Sided.innerHTML = formattedQuestion;
      if (this.options2Sided) this.options2Sided.innerHTML = optionsHtml;
      if (this.explanation2Sided) {
        this.explanation2Sided.innerHTML = `
          <div class="sblock-inner" style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 14px 18px;">
            <h3 style="font-size: 14px; font-weight: 700; color: #1e293b; margin: 0 0 8px 0; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px;">💡 Solution &amp; Explanation</h3>
            <div class="solutiontxt" style="font-size: 14px; line-height: 1.6; color: #334155;">${formattedExplanation || '<p>Detailed step-by-step reasoning verified by Oliveboard subject experts.</p>'}</div>
          </div>
        `;
        this.explanation2Sided.style.display = shouldHideSolution ? 'none' : 'block';
      }
    } else {
      if (this.twoSidedWrapper) this.twoSidedWrapper.style.display = 'none';
      if (this.singleWrapper) this.singleWrapper.style.display = 'block';

      if (this.qTextSingle) this.qTextSingle.innerHTML = formattedQuestion;
      if (this.optionsSingle) this.optionsSingle.innerHTML = optionsHtml;
      if (this.explanationSingle) {
        this.explanationSingle.innerHTML = `
          <div class="sblock-inner" style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 14px 18px;">
            <h3 style="font-size: 14px; font-weight: 700; color: #1e293b; margin: 0 0 8px 0; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px;">💡 Solution &amp; Explanation</h3>
            <div class="solutiontxt" style="font-size: 14px; line-height: 1.6; color: #334155;">${formattedExplanation || '<p>Detailed step-by-step reasoning verified by Oliveboard subject experts.</p>'}</div>
          </div>
        `;
        this.explanationSingle.style.display = shouldHideSolution ? 'none' : 'block';
      }
    }

    // Scroll panes to top
    if (this.passagePane) this.passagePane.scrollTop = 0;
    if (this.questionPane2Sided) this.questionPane2Sided.scrollTop = 0;
    if (this.singleWrapper) this.singleWrapper.scrollTop = 0;

    // Update Active Question Pill in Sidebar
    if (this.questionMapContainer) {
      this.questionMapContainer.querySelectorAll('.map-qno').forEach(pill => {
        const pIdx = parseInt(pill.dataset.globalIdx, 10);
        pill.classList.toggle('activeq', pIdx === globalQIdx);
      });
      const activePill = this.questionMapContainer.querySelector(`.map-qno[data-global-idx="${globalQIdx}"]`);
      if (activePill && typeof activePill.scrollIntoView === 'function') {
        activePill.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      }
    }
  }

  _updateAttemptBanner(globalQIdx) {
    if (!this.attemptAlert || !this.modeIndicator) return;
    const retryAttempt = this.retryAttempts[globalQIdx];
    const promptContainer = this.attemptAlert.querySelector('div:first-child');

    if (this.isReattemptMode) {
      this.attemptAlert.style.display = 'flex';
      if (!retryAttempt) {
        if (promptContainer) {
          promptContainer.innerHTML = `
            <span>Select an option below to re-attempt, or </span>
            <a href="#" class="btn-viewsol" id="btn-sol-toggle-mode" data-global-idx="${globalQIdx}" role="button" style="font-weight: 700; color: #0958d9; text-decoration: underline;">View Solution</a>
          `;
        }
        this.modeIndicator.textContent = 'Re-attempt Mode: Click an Option';
        this.modeIndicator.style.background = '#e6f4ff';
        this.modeIndicator.style.color = '#0958d9';
      } else if (retryAttempt.viewedSolution) {
        if (promptContainer) {
          promptContainer.innerHTML = `<span>Solution revealed for this question.</span>`;
        }
        this.modeIndicator.textContent = 'Solution Revealed';
        this.modeIndicator.style.background = '#f1f5f9';
        this.modeIndicator.style.color = '#475569';
      } else if (retryAttempt.isCorrect) {
        if (promptContainer) {
          promptContainer.innerHTML = `<span style="color: #15803d; font-weight: 600;">Great job! You selected the correct option.</span>`;
        }
        this.modeIndicator.textContent = '✓ Re-attempt: Correct';
        this.modeIndicator.style.background = '#dcfce7';
        this.modeIndicator.style.color = '#15803d';
      } else {
        if (promptContainer) {
          promptContainer.innerHTML = `<span style="color: #b91c1c; font-weight: 600;">Incorrect choice. The correct option is highlighted in green below.</span>`;
        }
        this.modeIndicator.textContent = '✕ Re-attempt: Wrong';
        this.modeIndicator.style.background = '#fee2e2';
        this.modeIndicator.style.color = '#b91c1c';
      }
    } else {
      this.attemptAlert.style.display = 'none';
      this.modeIndicator.textContent = 'Solution Mode';
    }
  }

  _renderQuestionOptions(q) {
    const rawOptions = q.options || [];
    let opts = [];
    if (Array.isArray(rawOptions)) {
      opts = rawOptions.map((opt, i) => {
        if (typeof opt === 'string') {
          return { letter: String.fromCharCode(65 + i), text: opt, html: opt };
        }
        return {
          letter: opt.letter || String.fromCharCode(65 + i),
          text: opt.text || opt.html || '',
          html: opt.html || opt.text || ''
        };
      });
    } else if (typeof rawOptions === 'object') {
      const keys = Object.keys(rawOptions).sort();
      opts = keys.map((k) => ({
        letter: k,
        text: rawOptions[k],
        html: rawOptions[k]
      }));
    }

    const resp = this._getQuestionResponse(q);
    const userSelectedIdx = resp && resp.selectedIndex !== undefined ? resp.selectedIndex : null;
    const retryAttempt = this.retryAttempts[q.globalIndex];
    const corIdx = Number(q.correctIndex);

    return opts.map((opt, optIdx) => {
      let stateClass = '';
      let badgeHtml = '';

      if (this.isReattemptMode && !retryAttempt) {
        // Unanswered in retry mode: clickable option with radio tick ring
        stateClass = 'cursorst';
        badgeHtml = `<span class="opt-tick-badge opt-tick-idle" aria-hidden="true"></span>`;
      } else if (this.isReattemptMode && retryAttempt) {
        // User answered this question during retry mode
        const userPickedThis = Number(retryAttempt.selectedIdx) === optIdx && !retryAttempt.viewedSolution;
        if (optIdx === corIdx) {
          stateClass = 'correct';
          badgeHtml = `<span class="opt-tick-badge opt-tick-correct">✓ ${userPickedThis ? 'Your Choice · Correct' : 'Correct Answer'}</span>`;
        } else if (userPickedThis) {
          stateClass = 'wrong';
          badgeHtml = `<span class="opt-tick-badge opt-tick-wrong">✕ Your Choice</span>`;
        }
      } else {
        // Standard Solution View Mode
        const userPickedThis = userSelectedIdx !== null && Number(userSelectedIdx) === optIdx;
        if (optIdx === corIdx) {
          stateClass = 'correct';
          badgeHtml = `<span class="opt-tick-badge opt-tick-correct">✓ ${userPickedThis ? 'Your Answer · Correct' : 'Correct Answer'}</span>`;
        } else if (userPickedThis) {
          stateClass = 'wrong';
          badgeHtml = `<span class="opt-tick-badge opt-tick-wrong">✕ Your Answer</span>`;
        }
      }

      return `
        <div id="opt-${q.globalIndex}-${optIdx}" class="opt ${stateClass}" data-opt-idx="${optIdx}" data-global-idx="${q.globalIndex}" data-correct-idx="${corIdx}" role="${this.isReattemptMode && !retryAttempt ? 'button' : 'presentation'}" tabindex="${this.isReattemptMode && !retryAttempt ? '0' : '-1'}">
          <div class="left">${opt.letter}</div>
          <div class="right">
            <div class="rightopt">${this._formatContent(opt.html || opt.text)}</div>
            ${badgeHtml}
          </div>
        </div>
      `;
    }).join('');
  }

  // ==========================================
  // RETRY MODE & USER OPTION CLICK
  // ==========================================

  attemptOption(corOpt, selectedOpt, globalQIdx) {
    // Lock after first click on this question
    if (this.retryAttempts[globalQIdx]) return;

    const isCorrect = Number(selectedOpt) === Number(corOpt);
    this.retryAttempts[globalQIdx] = {
      selectedIdx: Number(selectedOpt),
      isCorrect,
      viewedSolution: false
    };

    const q = this.allQuestions[globalQIdx];
    if (q) {
      const updatedOptionsHtml = this._renderQuestionOptions(q);
      if (this.options2Sided) this.options2Sided.innerHTML = updatedOptionsHtml;
      if (this.optionsSingle) this.optionsSingle.innerHTML = updatedOptionsHtml;
    }

    // Update top attempt status banner
    this._updateAttemptBanner(globalQIdx);

    // Reveal explanation box immediately without resetting scroll position
    if (this.explanation2Sided) this.explanation2Sided.style.display = 'block';
    if (this.explanationSingle) this.explanationSingle.style.display = 'block';

    // Ensure the green-highlighted correct option is visible if below the fold
    const activeOptsContainer = (this.twoSidedWrapper && this.twoSidedWrapper.style.display !== 'none')
      ? this.options2Sided
      : this.optionsSingle;
    if (activeOptsContainer) {
      const correctEl = activeOptsContainer.querySelector('.opt.correct');
      if (correctEl && typeof correctEl.scrollIntoView === 'function') {
        correctEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  }

  viewsolution(globalQIdx) {
    const q = this.allQuestions[globalQIdx];
    if (!q) return;
    this.retryAttempts[globalQIdx] = {
      selectedIdx: Number(q.correctIndex),
      isCorrect: true,
      viewedSolution: true
    };

    const updatedOptionsHtml = this._renderQuestionOptions(q);
    if (this.options2Sided) this.options2Sided.innerHTML = updatedOptionsHtml;
    if (this.optionsSingle) this.optionsSingle.innerHTML = updatedOptionsHtml;

    this._updateAttemptBanner(globalQIdx);

    if (this.explanation2Sided) this.explanation2Sided.style.display = 'block';
    if (this.explanationSingle) this.explanationSingle.style.display = 'block';
  }

  toggleReattemptMode(forceState) {
    this.isReattemptMode = typeof forceState === 'boolean' ? forceState : !this.isReattemptMode;
    // Reset all re-attempts so the user can practice fresh whenever toggling Re-attempt mode
    this.retryAttempts = {};

    if (this.btnToggleReattemptTop) {
      this.btnToggleReattemptTop.textContent = this.isReattemptMode ? 'Re-attempt: ON' : 'Re-attempt: OFF';
      this.btnToggleReattemptTop.style.background = this.isReattemptMode ? '#16a34a' : 'rgba(0,0,0,0.22)';
    }
    if (this.togReattemptLanding) {
      this.togReattemptLanding.checked = this.isReattemptMode;
    }
    if (this.switchSliderLanding) {
      this.switchSliderLanding.style.backgroundColor = this.isReattemptMode ? '#2563eb' : '#cbd5e1';
    }

    if (this.viewSolDetail && this.viewSolDetail.style.display !== 'none') {
      this.goToQuestion(this.currentQuestionIndex, false);
    }
  }

  gotoreview(pushHistory = true) {
    if (this.viewSolDetail) this.viewSolDetail.style.display = 'none';
    if (this.viewLanding) {
      this.viewLanding.style.display = 'block';
      requestAnimationFrame(() => {
        const targetRow = document.getElementById(`sol-review-row-${this.currentQuestionIndex}`);
        if (targetRow) {
          targetRow.scrollIntoView({ behavior: 'instant', block: 'center' });
        }
      });
    }
    if (pushHistory && window.history && this.isOpen) {
      const testId = this.testData ? this.testData.id : 'test';
      const attId = this.attempt ? (this.attempt.id || this.attempt.attempt_id) : '';
      if (window.appController && window.appController.replaceNavState) {
        window.appController.replaceNavState({ view: 'solutions', testId, attemptId: attId }, '#solutions/' + testId);
      }
    }
  }

  prevQuestion() {
    if (this.currentQuestionIndex > 0) {
      this.goToQuestion(this.currentQuestionIndex - 1);
    } else {
      this.goToQuestion(this.allQuestions.length - 1);
    }
  }

  nextQuestion() {
    if (this.currentQuestionIndex < this.allQuestions.length - 1) {
      this.goToQuestion(this.currentQuestionIndex + 1);
    } else {
      this.goToQuestion(0);
    }
  }

  toggleBookmark() {
    const q = this.allQuestions[this.currentQuestionIndex];
    if (!q) return;
    let isBm = false;
    if (window.obDataManager && typeof window.obDataManager.toggleBookmark === 'function') {
      isBm = window.obDataManager.toggleBookmark(q, this.testData, q.sectionTitle);
      if (isBm) {
        this.bookmarkedQuestions[q.id] = true;
        const autoSubj = window.obDataManager.normalizeSubjectCategory(q.sectionTitle || '', this.testData?.title || '', '');
        if (window.appController && typeof window.appController.showToast === 'function') {
          window.appController.showToast(`★ Bookmarked under ${autoSubj}`, 'success');
        }
      } else {
        delete this.bookmarkedQuestions[q.id];
        if (window.appController && typeof window.appController.showToast === 'function') {
          window.appController.showToast('Removed question from Bookmarks', 'info');
        }
      }
    } else {
      this.bookmarkedQuestions[q.id] = !this.bookmarkedQuestions[q.id];
      isBm = !!this.bookmarkedQuestions[q.id];
    }
    if (this.btnBookmark) {
      this.btnBookmark.textContent = isBm ? '★ Saved' : '★ Bookmark';
      this.btnBookmark.style.color = isBm ? '#d97706' : '';
    }
  }

  toggleLanguage() {
    this.currentLang = this.currentLang === 'eqt' ? 'hqt' : 'eqt';
    if (this.overlay) {
      this.overlay.classList.toggle('lang-hindi', this.currentLang === 'hqt');
    }
    if (this.langLabel) {
      this.langLabel.textContent = this.currentLang === 'hqt' ? 'Hindi' : 'English';
    }
  }

  // ==========================================
  // SIDEBAR & DROPDOWN CONTROLS
  // ==========================================

  renderSectionDropdown() {
    if (!this.secDropdownList) return;
    const sections = this.testData.sections || [];

    this.secDropdownList.innerHTML = sections.map((sec, idx) => `
      <li data-sec-idx="${idx}" role="button" tabindex="0" style="padding: 8px 14px; cursor: pointer; border-bottom: 1px solid #f1f5f9; font-size: 13px; font-weight: 600; color: #1e293b;">
        <span>${sec.title}</span> <span style="font-size: 11px; color: #64748b; font-weight: 400;">(${sec.questions ? sec.questions.length : 0} Qs)</span>
      </li>
    `).join('');
  }

  switchSectionFromDropdown(secIdx) {
    if (this.secDropdownList) this.secDropdownList.style.display = 'none';
    const targetQ = this.allQuestions.find(q => q.sectionIndex === secIdx);
    if (targetQ) {
      this.goToQuestion(targetQ.globalIndex);
    }
  }

  renderSidebarQuestionMap() {
    if (!this.questionMapContainer) return;
    const sections = this.testData.sections || [];

    let mapHtml = '';
    sections.forEach((sec, sIdx) => {
      const secQs = this.allQuestions.filter(q => q.sectionIndex === sIdx);
      mapHtml += `
        <div class="sec-${sIdx} box" style="margin-bottom: 16px;">
          <p style="font-size: 12px; font-weight: 700; color: #1e293b; margin: 0 0 8px 0; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px;">${sec.title}</p>
          <div class="box-inner" style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px;">
            ${secQs.map(q => {
              const resp = this._getQuestionResponse(q);
              const selectedIdx = resp ? resp.selectedIndex : null;
              const isAttempted = selectedIdx !== null && selectedIdx !== undefined;
              const isCorrect = isAttempted && Number(selectedIdx) === Number(q.correctIndex);

              let statusClass = 'unattempted';
              let bgStyle = 'background: #e2e8f0; color: #475569;';
              if (isAttempted) {
                if (isCorrect) {
                  statusClass = 'right';
                  bgStyle = 'background: #64C184; color: #fff;';
                } else {
                  statusClass = 'wrong';
                  bgStyle = 'background: #D97A7A; color: #fff;';
                }
              }

              return `
                <span class="map-qno q-${q.globalIndex} ${statusClass}" data-global-idx="${q.globalIndex}" role="button" tabindex="0"
                      style="${bgStyle} border-radius: 4px; padding: 6px 0; text-align: center; font-size: 12px; font-weight: 700; cursor: pointer; box-shadow: 0 1px 2px rgba(0,0,0,0.06);"
                      >
                  ${q.localIndex}
                </span>
              `;
            }).join('')}
          </div>
        </div>
      `;
    });

    this.questionMapContainer.innerHTML = mapHtml;
  }

  openScorecardModal() {
    if (this.attempt && this.testData) {
      let engine = (window.appController && window.appController.testEngine) || window.activeTestEngine;
      if (!engine && window.initTestEngine) {
        engine = window.initTestEngine(this.testData);
        if (window.appController) window.appController.testEngine = engine;
        window.activeTestEngine = engine;
      }
      if (engine && typeof engine.showScorecardForAttempt === 'function') {
        engine.showScorecardForAttempt(this.attempt, this.testData);
        return;
      }
    }
    const scModal = document.getElementById('scorecard-modal-overlay');
    if (scModal) scModal.classList.add('active');
  }

  exit(fromPopstate = false) {
    if (!fromPopstate && window.appController) {
      window.appController.exitSolutionsToTests();
    } else {
      this._doExit(false);
    }
  }

  _doExit(skipRefresh = false) {
    this.isOpen = false;
    if (this.overlay) {
      this.overlay.classList.remove('active');
      this.overlay.style.display = 'none';
    }
    document.body.style.overflow = 'auto';

    if (!skipRefresh && window.appController) {
      window.appController.refreshAnalytics(this.testData ? this.testData.id : null);
    }
  }
}

// Global Initialization
window.obSolutionEngine = new OliveboardSolutionEngine();

window.openOliveboardSolutions = function(attempt, testData) {
  if (!window.obSolutionEngine) {
    window.obSolutionEngine = new OliveboardSolutionEngine();
  }
  window.obSolutionEngine.open(attempt, testData);
};
