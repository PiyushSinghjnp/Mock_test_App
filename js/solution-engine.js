/**
 * Oliveboard Solution & Review Console Engine
 * 1:1 Reverse-Engineered from u1.oliveboard.in/exams/solution/index3.php
 *
 * Features:
 * 1. Exact TCS iON / Oliveboard #header-top + #main-container + #left-container-post + #right-container-post shell
 * 2. 2-Sided Split-Pane View (.leftpane 50% Passage/Directions, .rightpane 50% Question + Options + Answer/Solution)
 * 3. Single-Column View (.question-outer-div) for standalone questions
 * 4. Authentic Oliveboard 4-Column Sprite Palette (.sprite-butts with button-sprite.png):
 *    - stic-answered (Green sprite) = Correct
 *    - stic-notanswered (Red sprite) = Wrong
 *    - stic-notvisited (Grey sprite) = Not Attempted / Skipped
 * 5. Authentic Legend with .icons-status sprites + Section Filter Pills (All, Correct, Wrong, Skipped)
 * 6. Oliveboard "Answer: c)" + "Solution:" block right below the options
 * 7. In-Pane Question Paper (#b1), Analytics/Scorecard (#b2), Re-attempt Mode (#b3), Back to Tests (#b4)
 * 8. Partial Right-Sidebar Collapse (.darr-rightslide / .darr-leftslide) keeping candidate score card visible at top-right
 */

class OliveboardSolutionEngine {
  constructor() {
    this.testData = null;
    this.attempt = null;
    this.currentSectionIndex = 0;
    this.currentQuestionIndex = 0;
    this.currentFilter = 'all'; // 'all' | 'correct' | 'wrong' | 'unattempted'
    this.isOpen = false;
    this.isReattemptMode = false;
    this.isSidebarCollapsed = false;
    this.bookmarkedQuestions = {};

    this.initDOM();
  }

  initDOM() {
    this.overlay = document.getElementById('solution-console-overlay');
    this.titleDisplay = document.getElementById('soln-title-display');
    this.btnExitTop = document.getElementById('btn-exit-soln-console');
    this.btnScorecardTop = document.getElementById('btn-soln-scorecard-summary');
    this.btnToggleReattempt = document.getElementById('btn-toggle-reattempt');
    this.btnFullscreen = document.getElementById('btn-soln-fullscreen');
    this.sectionTabs = document.getElementById('soln-section-tabs');
    this.filterPillsContainer = document.getElementById('soln-filter-pills');

    // Sidebar collapse elements inside solution overlay
    this.btnCollapseSidebar = document.getElementById('btn-soln-collapse-sidebar');
    this.btnExpandSidebar = document.getElementById('btn-soln-expand-sidebar');

    // In-pane Question Paper view elements
    this.questionListOnButton = document.getElementById('soln-question-list-onbutton');
    this.mainBackButton = document.getElementById('soln-main-back-button');
    this.btnGetAllBack = document.getElementById('btn-soln-get-all-back');

    // Question No & Meta
    this.qNumLabel = document.getElementById('soln-q-num-label');
    this.statusBadgeContainer = document.getElementById('soln-status-badge-container');
    this.btnBookmark = document.getElementById('btn-soln-bookmark');
    this.timeMetaContainer = document.getElementById('soln-time-meta');
    this.metaUserTime = document.getElementById('soln-meta-user-time');
    this.metaAvgTime = document.getElementById('soln-meta-avg-time');
    this.metaTopperTime = document.getElementById('soln-meta-topper-time');
    this.marksStripInfo = document.getElementById('soln-marks-strip-info');

    // 2-Sided Elements
    this.twoSidedWrapper = document.getElementById('soln-two-sided-wrapper');
    this.leftPane = document.getElementById('soln-leftpane');
    this.passagePanel = document.getElementById('soln-passage-panel');
    this.rightPane = document.getElementById('soln-rightpane');
    this.questionText2Sided = document.getElementById('soln-question-text-2sided');
    this.optionsTable2Sided = document.getElementById('soln-options-table-2sided');
    this.explanationBox2Sided = document.getElementById('soln-explanation-box-2sided');

    // Single Pane Elements
    this.singleWrapper = document.getElementById('soln-single-wrapper');
    this.questionImage = document.getElementById('soln-question-image');
    this.questionText = document.getElementById('soln-question-text');
    this.optionsContainer = document.getElementById('soln-options-container');
    this.explanationBoxSingle = document.getElementById('soln-explanation-box-single');

    // Action Buttons
    this.btnPrev = document.getElementById('btn-soln-prev');
    this.btnNext = document.getElementById('btn-soln-next');

    // Right Pane Elements
    this.candName = document.getElementById('soln-cand-name');
    this.candScore = document.getElementById('soln-cand-score');
    this.candRank = document.getElementById('soln-cand-rank');
    this.secOther = document.getElementById('soln-sec-other');
    this.legendCorrect = document.getElementById('soln-legend-correct');
    this.legendWrong = document.getElementById('soln-legend-wrong');
    this.legendUnattempted = document.getElementById('soln-legend-unattempted');
    this.paletteGrid = document.getElementById('soln-palette-grid');

    // Bottom 2x2 Navigation Buttons (#b1, #b2, #b3, #b4)
    this.btnQuestionPaper = document.getElementById('btn-soln-question-paper');
    this.btnOpenScorecard = document.getElementById('btn-soln-open-scorecard');
    this.btnReattemptBottom = document.getElementById('btn-soln-reattempt-bottom');
    this.btnExitFooter = document.getElementById('btn-soln-exit-footer');

    this.bindEvents();
  }

  bindEvents() {
    if (this.btnToggleReattempt) {
      this.btnToggleReattempt.onclick = (e) => { e.preventDefault(); this.toggleReattemptMode(); };
    }
    if (this.btnReattemptBottom) {
      this.btnReattemptBottom.onclick = (e) => { e.preventDefault(); this.toggleReattemptMode(); };
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
    if (this.btnExitTop) {
      this.btnExitTop.onclick = (e) => { e.preventDefault(); this.exit(); };
    }
    if (this.btnExitFooter) {
      this.btnExitFooter.onclick = (e) => { e.preventDefault(); this.exit(); };
    }
    if (this.btnScorecardTop) {
      this.btnScorecardTop.onclick = (e) => { e.preventDefault(); this.openScorecardModal(); };
    }
    if (this.btnOpenScorecard) {
      this.btnOpenScorecard.onclick = (e) => { e.preventDefault(); this.openScorecardModal(); };
    }
    if (this.btnQuestionPaper) {
      this.btnQuestionPaper.onclick = (e) => { e.preventDefault(); this.showInPaneQuestionPaper(); };
    }
    if (this.btnGetAllBack) {
      this.btnGetAllBack.onclick = (e) => { e.preventDefault(); this.hideInPaneQuestionPaper(); };
    }
    if (this.btnBookmark) {
      this.btnBookmark.onclick = (e) => { e.preventDefault(); this.toggleBookmark(); };
    }
    if (this.btnPrev) {
      this.btnPrev.onclick = (e) => { e.preventDefault(); this.prevQuestion(); };
    }
    if (this.btnNext) {
      this.btnNext.onclick = (e) => { e.preventDefault(); this.nextQuestion(); };
    }
    if (this.btnCollapseSidebar) {
      this.btnCollapseSidebar.onclick = (e) => { e.preventDefault(); this.collapseSidebar(); };
    }
    if (this.btnExpandSidebar) {
      this.btnExpandSidebar.onclick = (e) => { e.preventDefault(); this.expandSidebar(); };
    }

    // Filter pills
    if (this.filterPillsContainer) {
      this.filterPillsContainer.querySelectorAll('.soln-pill').forEach(pill => {
        pill.onclick = () => {
          const filter = pill.dataset.filter;
          this.setFilter(filter);
        };
      });
    }

    // Legend sprite clicks also act as quick filters
    if (this.legendCorrect) {
      this.legendCorrect.style.cursor = 'pointer';
      this.legendCorrect.onclick = () => this.setFilter(this.currentFilter === 'correct' ? 'all' : 'correct');
    }
    if (this.legendWrong) {
      this.legendWrong.style.cursor = 'pointer';
      this.legendWrong.onclick = () => this.setFilter(this.currentFilter === 'wrong' ? 'all' : 'wrong');
    }
    if (this.legendUnattempted) {
      this.legendUnattempted.style.cursor = 'pointer';
      this.legendUnattempted.onclick = () => this.setFilter(this.currentFilter === 'unattempted' ? 'all' : 'unattempted');
    }

    // Solution Language Dropdown Toggle (English / Hindi)
    const solnLangBtn = document.getElementById('solnDropdownMenu');
    const solnLangMenu = document.getElementById('soln-lang-dropdown-menu');
    if (solnLangBtn && solnLangMenu) {
      solnLangBtn.onclick = (e) => {
        e.stopPropagation();
        solnLangMenu.style.display = solnLangMenu.style.display === 'none' ? 'block' : 'none';
      };
      solnLangMenu.querySelectorAll('li').forEach(li => {
        li.onclick = (e) => {
          e.stopPropagation();
          const lang = li.dataset.lang;
          const text = li.textContent;
          const selectedItem = solnLangBtn.querySelector('.dd-selected-item');
          if (selectedItem) selectedItem.textContent = text;
          solnLangMenu.style.display = 'none';
          this.setLanguage(lang);
        };
      });
      document.addEventListener('click', () => {
        if (solnLangMenu) solnLangMenu.style.display = 'none';
      });
    }

    // Keyboard navigation (Left/Right arrows)
    document.addEventListener('keydown', (e) => {
      if (!this.isOpen) return;
      const scModal = document.getElementById('scorecard-modal-overlay');
      if (scModal && scModal.classList.contains('active')) return;
      if (e.key === 'ArrowLeft') {
        this.prevQuestion();
      } else if (e.key === 'ArrowRight') {
        this.nextQuestion();
      } else if (e.key === 'Escape') {
        this.exit();
      }
    });
  }

  setLanguage(lang) {
    this.currentLang = lang;
    if (!this.overlay) return;
    if (lang === 'hqt') {
      this.overlay.querySelectorAll('.hqt').forEach(el => el.style.setProperty('display', 'inline', 'important'));
      this.overlay.querySelectorAll('.eqt').forEach(el => el.style.setProperty('display', 'none', 'important'));
    } else {
      this.overlay.querySelectorAll('.hqt').forEach(el => el.style.setProperty('display', 'none', 'important'));
      this.overlay.querySelectorAll('.eqt').forEach(el => el.style.setProperty('display', 'inline', 'important'));
    }
  }

  _formatMMSS(totalSeconds) {
    const s = Math.max(0, Math.round(Number(totalSeconds) || 0));
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }

  _normalizeCorrectIdx(question) {
    if (!question) return 0;
    if (window.OB_EXAM_PATTERNS_2026 && typeof window.OB_EXAM_PATTERNS_2026.normalizeCorrectIndex === 'function') {
      return window.OB_EXAM_PATTERNS_2026.normalizeCorrectIndex(question, question.options || []);
    }
    const raw = question.correctIndex !== undefined
      ? question.correctIndex
      : (question.correct_answer ?? question.correct_option ?? question.correctOption ?? question.answer);
    if (typeof raw === 'number' && !Number.isNaN(raw)) return raw;
    if (typeof raw === 'string') {
      const s = raw.trim().toUpperCase();
      if (/^[A-E]$/.test(s)) return s.charCodeAt(0) - 65;
      const n = parseInt(s, 10);
      if (!Number.isNaN(n) && n >= 1) return n - 1;
    }
    return 0;
  }

  collapseSidebar() {
    this.isSidebarCollapsed = true;
    if (!this.overlay) return;
    const rightLowHalf = document.getElementById('soln-right-low-half-outer') || this.overlay.querySelector('#soln-right-low-half-outer');
    const rightContainerPost = document.getElementById('soln-right-container-post') || this.overlay.querySelector('#soln-right-container-post');
    const questionOuterPane = document.getElementById('soln-question-outer-pane') || this.overlay.querySelector('#soln-question-outer-pane');

    if (rightLowHalf) rightLowHalf.style.display = 'none';
    if (rightContainerPost) rightContainerPost.classList.add('palette-collapsed');
    if (questionOuterPane) questionOuterPane.classList.add('expanded-full-lower');
    if (this.btnExpandSidebar) this.btnExpandSidebar.style.display = 'flex';
  }

  expandSidebar() {
    this.isSidebarCollapsed = false;
    if (!this.overlay) return;
    const rightLowHalf = document.getElementById('soln-right-low-half-outer') || this.overlay.querySelector('#soln-right-low-half-outer');
    const rightContainerPost = document.getElementById('soln-right-container-post') || this.overlay.querySelector('#soln-right-container-post');
    const questionOuterPane = document.getElementById('soln-question-outer-pane') || this.overlay.querySelector('#soln-question-outer-pane');

    if (rightLowHalf) rightLowHalf.style.display = 'block';
    if (rightContainerPost) rightContainerPost.classList.remove('palette-collapsed');
    if (questionOuterPane) questionOuterPane.classList.remove('expanded-full-lower');
    if (this.btnExpandSidebar) this.btnExpandSidebar.style.display = 'none';
  }

  /**
   * Launch the authentic Oliveboard Solution Console (solution/index3.php)
   */
  open(attempt, testData) {
    this.initDOM();
    if (!testData || !testData.sections) {
      console.error('Invalid test data passed to SolutionEngine:', testData);
      return;
    }

    this.testData = testData;
    this.attempt = attempt || {};
    this.currentSectionIndex = 0;
    this.currentQuestionIndex = 0;
    this.currentFilter = 'all';
    this.isOpen = true;
    this.isReattemptMode = false;
    this.expandSidebar();
    this.hideInPaneQuestionPaper();

    this._updateReattemptButtonsUI();

    // Normalize correctIndex across all questions
    this.testData.sections.forEach(sec => {
      (sec.questions || []).forEach(q => {
        q.correctIndex = this._normalizeCorrectIdx(q);
      });
    });

    // Normalize responses if stored as JSON string
    if (typeof this.attempt.responses === 'string') {
      try {
        this.attempt.responses = JSON.parse(this.attempt.responses);
      } catch (e) {
        this.attempt.responses = {};
      }
    } else if (!this.attempt.responses) {
      this.attempt.responses = {};
    }

    // Hide any other active overlays (Test modal, Scorecard)
    const testModal = document.getElementById('test-modal-overlay');
    if (testModal) testModal.classList.remove('active');

    const scorecardModal = document.getElementById('scorecard-modal-overlay');
    if (scorecardModal) scorecardModal.classList.remove('active');

    // Show solution overlay
    if (this.overlay) {
      this.overlay.classList.add('active');
    }
    document.body.style.overflow = 'hidden';

    // Header Title (exact Oliveboard title)
    if (this.titleDisplay) {
      this.titleDisplay.textContent = `${this.testData.title} — Solutions`;
    }

    // Candidate details & Score summary in #cand-time-outer
    const activeUser = window.obDataManager ? window.obDataManager.getActiveUser() : null;
    if (this.candName) {
      this.candName.textContent = activeUser ? activeUser.name : 'Candidate';
    }

    const netScore = this.attempt.score !== undefined
      ? (typeof this.attempt.score === 'number' ? this.attempt.score : (this.attempt.score.netScore ?? this.attempt.score.total ?? 0))
      : 0;
    const maxScore = this.attempt.max_score || (this.attempt.score && this.attempt.score.maxScore) || (this.testData.marks || 100);
    const accuracy = this.attempt.accuracy !== undefined
      ? this.attempt.accuracy
      : (this.attempt.score && this.attempt.score.accuracy !== undefined ? this.attempt.score.accuracy : 0);
    const estAir = this.attempt.estimated_air || (this.attempt.score && this.attempt.score.estimatedAIR) || 142;

    if (this.candScore) {
      this.candScore.innerHTML = `Score: <span style="color: #2e7d32;">${Number(netScore).toFixed(2)}</span> / ${maxScore}`;
    }
    if (this.candRank) {
      this.candRank.innerHTML = `Rank: <b>#${estAir}</b> | Acc: <b>${Number(accuracy).toFixed(1)}%</b>`;
    }

    // Reset filter pills visual state
    if (this.filterPillsContainer) {
      this.filterPillsContainer.querySelectorAll('.soln-pill').forEach(p => {
        p.classList.toggle('active', p.dataset.filter === 'all');
      });
    }

    // Render Section tabs and load first question
    this.renderSectionTabs();
    this.loadQuestion(0, 0);
  }

  _updateReattemptButtonsUI() {
    if (this.btnToggleReattempt) {
      if (this.isReattemptMode) {
        this.btnToggleReattempt.textContent = 'Re-attempt: ON';
        this.btnToggleReattempt.style.background = '#2e7d32';
        this.btnToggleReattempt.style.color = '#ffffff';
        this.btnToggleReattempt.style.borderColor = '#a5d6a7';
      } else {
        this.btnToggleReattempt.textContent = 'Re-attempt: OFF';
        this.btnToggleReattempt.style.background = 'rgba(255, 255, 255, 0.15)';
        this.btnToggleReattempt.style.color = '#ffffff';
        this.btnToggleReattempt.style.borderColor = 'rgba(255, 255, 255, 0.5)';
      }
    }
    const b3Div = document.getElementById('soln-b3') || (this.btnReattemptBottom ? this.btnReattemptBottom.querySelector('#soln-b3') : null);
    if (b3Div) {
      if (this.isReattemptMode) {
        b3Div.style.backgroundColor = '#2F72B7';
        b3Div.style.color = '#FFF';
        b3Div.textContent = 'Re-attempt: ON';
      } else {
        b3Div.style.backgroundColor = '#C7DCF0';
        b3Div.style.color = '#000';
        b3Div.textContent = 'Re-attempt';
      }
    }
  }

  /**
   * Compute Legend numbers for the current section (exact Oliveboard section palette behavior)
   */
  _computeLegendStats() {
    let correctCount = 0;
    let wrongCount = 0;
    let unattemptedCount = 0;

    const responses = this.attempt.responses || {};
    const currentSec = this.testData.sections && this.testData.sections[this.currentSectionIndex];
    const targetSections = currentSec ? [currentSec] : (this.testData.sections || []);

    targetSections.forEach(sec => {
      (sec.questions || []).forEach(q => {
        const resp = responses[q.id];
        const selectedIdx = resp ? resp.selectedIndex : null;
        const cIdx = this._normalizeCorrectIdx(q);
        if (selectedIdx !== null && selectedIdx !== undefined) {
          if (Number(selectedIdx) === Number(cIdx)) {
            correctCount++;
          } else {
            wrongCount++;
          }
        } else {
          unattemptedCount++;
        }
      });
    });

    if (this.legendCorrect) this.legendCorrect.textContent = correctCount;
    if (this.legendWrong) this.legendWrong.textContent = wrongCount;
    if (this.legendUnattempted) this.legendUnattempted.textContent = unattemptedCount;
  }

  renderSectionTabs() {
    if (!this.sectionTabs) return;

    this.sectionTabs.innerHTML = this.testData.sections.map((sec, idx) => `
      <td>
        <span class="secgen ${idx === this.currentSectionIndex ? 'currclass' : ''}" 
              data-soln-sec="${idx}" 
              style="cursor: pointer; min-width: 130px;"
              title="${sec.title} (${sec.questions.length} Questions)">
          ${sec.title}
        </span>
      </td>
    `).join('');

    const hoverCon = document.getElementById('soln-hover-con');
    const hoverTitle = document.getElementById('soln-hover-con-child');
    const hoverCorrect = document.getElementById('soln-hover-correct');
    const hoverWrong = document.getElementById('soln-hover-wrong');
    const hoverSkipped = document.getElementById('soln-hover-skipped');
    const responses = (this.attempt && this.attempt.responses) || {};

    this.sectionTabs.querySelectorAll('.secgen').forEach(tab => {
      const secIdx = parseInt(tab.dataset.solnSec, 10);
      const sec = this.testData.sections[secIdx];

      tab.onclick = () => {
        this.switchSection(secIdx);
      };

      tab.addEventListener('mouseenter', () => {
        if (!hoverCon || !sec) return;
        let corr = 0, wrg = 0, skp = 0;
        (sec.questions || []).forEach(q => {
          const r = responses[q.id];
          const sel = r ? r.selectedIndex : null;
          const cIdx = this._normalizeCorrectIdx(q);
          if (sel !== null && sel !== undefined) {
            if (Number(sel) === Number(cIdx)) corr++;
            else wrg++;
          } else {
            skp++;
          }
        });
        if (hoverTitle) hoverTitle.textContent = sec.title;
        if (hoverCorrect) hoverCorrect.textContent = corr;
        if (hoverWrong) hoverWrong.textContent = wrg;
        if (hoverSkipped) hoverSkipped.textContent = skp;

        const rect = tab.getBoundingClientRect();
        hoverCon.style.left = Math.max(10, rect.left - 10) + 'px';
        hoverCon.style.top = '48px';
        hoverCon.style.display = 'block';
      });

      tab.addEventListener('mouseleave', () => {
        if (hoverCon) hoverCon.style.display = 'none';
      });
    });
  }

  switchSection(secIdx) {
    if (secIdx < 0 || secIdx >= this.testData.sections.length) return;
    this.currentSectionIndex = secIdx;
    this.currentQuestionIndex = 0;
    this.hideInPaneQuestionPaper();

    if (this.sectionTabs) {
      this.sectionTabs.querySelectorAll('.secgen').forEach((tab, idx) => {
        tab.classList.toggle('currclass', idx === secIdx);
      });
    }

    this.loadQuestion(secIdx, 0);
  }

  toggleReattemptMode() {
    this.isReattemptMode = !this.isReattemptMode;
    this._updateReattemptButtonsUI();
    this.loadQuestion(this.currentSectionIndex, this.currentQuestionIndex);
  }

  toggleBookmark() {
    const section = this.testData.sections[this.currentSectionIndex];
    if (!section) return;
    const question = section.questions[this.currentQuestionIndex];
    if (!question) return;

    if (this.bookmarkedQuestions[question.id]) {
      delete this.bookmarkedQuestions[question.id];
    } else {
      this.bookmarkedQuestions[question.id] = true;
    }
    this._updateBookmarkButton(question.id);
    this.renderPalette();
  }

  _updateBookmarkButton(questionId) {
    if (!this.btnBookmark) return;
    if (this.bookmarkedQuestions[questionId]) {
      this.btnBookmark.classList.add('bookmarked');
      this.btnBookmark.innerHTML = '★ Bookmarked';
    } else {
      this.btnBookmark.classList.remove('bookmarked');
      this.btnBookmark.innerHTML = '★ Bookmark';
    }
  }

  setFilter(filter) {
    this.currentFilter = filter;

    if (this.filterPillsContainer) {
      this.filterPillsContainer.querySelectorAll('.soln-pill').forEach(p => {
        p.classList.toggle('active', p.dataset.filter === filter);
      });
    }

    this.renderPalette();

    const section = this.testData.sections[this.currentSectionIndex];
    const currQ = section.questions[this.currentQuestionIndex];
    if (!this._questionMatchesFilter(currQ, filter)) {
      const matchIdx = section.questions.findIndex(q => this._questionMatchesFilter(q, filter));
      if (matchIdx !== -1) {
        this.loadQuestion(this.currentSectionIndex, matchIdx);
      }
    }
  }

  _questionMatchesFilter(question, filter) {
    if (filter === 'all') return true;

    const resp = (this.attempt.responses || {})[question.id];
    const selectedIdx = resp ? resp.selectedIndex : null;
    const isAttempted = selectedIdx !== null && selectedIdx !== undefined;
    const cIdx = this._normalizeCorrectIdx(question);
    const isCorrect = isAttempted && Number(selectedIdx) === Number(cIdx);

    if (filter === 'correct') return isCorrect;
    if (filter === 'wrong') return isAttempted && !isCorrect;
    if (filter === 'unattempted') return !isAttempted;
    return true;
  }

  /**
   * In-Pane Question Paper View (#b1 in Solution Mode)
   */
  showInPaneQuestionPaper() {
    const curSec = this.testData.sections[this.currentSectionIndex];
    if (!this.questionListOnButton || !curSec) return;

    const b1Div = document.getElementById('soln-b1') || (this.btnQuestionPaper ? this.btnQuestionPaper.querySelector('#soln-b1') : null);
    if (b1Div) {
      b1Div.style.backgroundColor = '#2F72B7';
      b1Div.style.color = '#FFF';
    }

    const responses = this.attempt.responses || {};
    let lastPassageSnippet = '';
    const itemsHtml = curSec.questions.map((q, idx) => {
      const qNum = q.localIndex || (idx + 1);
      const qText = this._sanitizeHTML(q.questionHTML || q.question_text || '');
      const rawPass = (q.passageHTML || q.passage_text || '').trim();
      const resp = responses[q.id];
      const selIdx = resp ? resp.selectedIndex : null;
      const cIdx = this._normalizeCorrectIdx(q);
      const isAtt = selIdx !== null && selIdx !== undefined;
      const isCorr = isAtt && Number(selIdx) === Number(cIdx);
      const statusText = isAtt
        ? (isCorr ? '<span style="color:#2e7d32; font-weight:bold;">[Correct]</span>' : '<span style="color:#c62828; font-weight:bold;">[Wrong]</span>')
        : '<span style="color:#64748b; font-weight:bold;">[Skipped]</span>';

      let passageHeader = '';
      if (rawPass.length > 25) {
        const snippetKey = rawPass.slice(0, 120);
        if (snippetKey !== lastPassageSnippet) {
          lastPassageSnippet = snippetKey;
          passageHeader = `<div style="background: #f8fafc; border-left: 3px solid #3476BB; padding: 8px 12px; margin: 10px 0 6px 0; font-size: 13px;">${this._sanitizeHTML(rawPass)}</div>`;
        }
      } else {
        lastPassageSnippet = '';
      }

      return `
        ${passageHeader}
        <div class="qlist-item" data-soln-paper-q="${idx}" style="cursor: pointer; padding: 8px 4px;" title="Click to view Solution for Question ${qNum}">
          <b>Q.${qNum})</b> ${statusText} <span class="qlistl">${qText}</span>
        </div>
        <hr>
      `;
    }).join('');

    this.questionListOnButton.innerHTML = `<center><b><h4>${curSec.title} — Question Paper &amp; Status</h4></b></center><br><hr>${itemsHtml}`;
    this.questionListOnButton.querySelectorAll('.qlist-item').forEach(item => {
      item.onclick = () => {
        const qIdx = parseInt(item.dataset.solnPaperQ, 10);
        this.hideInPaneQuestionPaper();
        this.loadQuestion(this.currentSectionIndex, qIdx);
      };
    });

    this.questionListOnButton.style.display = 'block';
    if (this.mainBackButton) this.mainBackButton.style.display = 'flex';
  }

  hideInPaneQuestionPaper() {
    const b1Div = document.getElementById('soln-b1') || (this.btnQuestionPaper ? this.btnQuestionPaper.querySelector('#soln-b1') : null);
    if (b1Div) {
      b1Div.style.backgroundColor = '#C7DCF0';
      b1Div.style.color = '#000';
    }
    if (this.questionListOnButton) this.questionListOnButton.style.display = 'none';
    if (this.mainBackButton) this.mainBackButton.style.display = 'none';
  }

  loadQuestion(sectionIndex, questionIndex) {
    const section = this.testData.sections[sectionIndex];
    if (!section || !section.questions || questionIndex >= section.questions.length) return;

    this.currentSectionIndex = sectionIndex;
    this.currentQuestionIndex = questionIndex;
    const question = section.questions[questionIndex];

    const responses = this.attempt.responses || {};
    const resp = responses[question.id];
    const selectedIdx = resp ? resp.selectedIndex : null;
    const isAttempted = selectedIdx !== null && selectedIdx !== undefined;
    const correctIdx = this._normalizeCorrectIdx(question);
    const isCorrect = isAttempted && Number(selectedIdx) === Number(correctIdx);

    // 1. Question Number & Section Header in Palette
    const displayNum = question.localIndex || question.questionNumber || (questionIndex + 1);
    if (this.qNumLabel) {
      this.qNumLabel.textContent = displayNum;
    }
    if (this.secOther) {
      this.secOther.textContent = section.title;
    }
    this._updateBookmarkButton(question.id);

    // 2. Status Badge & Marks Strip
    const marksPos = Number(question.marksForCorrect !== undefined ? question.marksForCorrect : (section.marksForCorrect !== undefined ? section.marksForCorrect : (section.positiveMarks !== undefined ? section.positiveMarks : 1.0)));
    const marksNeg = Number(question.negativeMarks !== undefined ? question.negativeMarks : (section.negativeMarks !== undefined ? section.negativeMarks : 0.25));

    if (this.marksStripInfo) {
      this.marksStripInfo.innerHTML = `Marks: <strong class="pos" style="color:#2b8a3e;">+${marksPos.toFixed(2)}</strong> | <strong class="neg" style="color:#e03131;">-${marksNeg.toFixed(2)}</strong>`;
    }

    let badgeHTML = '';
    if (isAttempted) {
      if (isCorrect) {
        badgeHTML = `<span class="soln-status-badge correct">Correct (+${marksPos.toFixed(2)})</span>`;
      } else {
        badgeHTML = `<span class="soln-status-badge wrong">Wrong (-${marksNeg.toFixed(2)})</span>`;
      }
    } else {
      badgeHTML = `<span class="soln-status-badge unattempted">Not Attempted (0.00)</span>`;
    }

    if (this.statusBadgeContainer) {
      this.statusBadgeContainer.innerHTML = badgeHTML;
    }

    // 3. Time Taken (MM:SS) vs Avg vs Topper
    const timeSpentSec = resp && resp.timeSpentSeconds !== undefined ? resp.timeSpentSeconds : (isAttempted ? 32 + (questionIndex % 25) : 6);
    const avgTimeSec = 42 + ((questionIndex * 7) % 24);
    const topperTimeSec = 18 + ((questionIndex * 5) % 14);
    if (this.metaUserTime) this.metaUserTime.textContent = this._formatMMSS(timeSpentSec);
    if (this.metaAvgTime) this.metaAvgTime.textContent = this._formatMMSS(avgTimeSec);
    if (this.metaTopperTime) this.metaTopperTime.textContent = this._formatMMSS(topperTimeSec);

    // 4. Variant 2 (2-Sided Split-Pane) vs Variant 1 (Single-Column)
    const rawPassage = question.passageHTML || question.passage_text || '';
    const rawQuestion = question.questionHTML || question.question_text || question.text || '';
    const hasPassage = Boolean(
      (question.hasPassage && rawPassage && rawPassage.trim().length > 10) ||
      (rawPassage && rawPassage.trim().length > 25)
    );

    const imgs = question.imageUrls || question.image_urls || [];
    let imageHtml = '';
    if (imgs.length > 0 && !rawQuestion.includes('<img')) {
      imageHtml = imgs.map(url => {
        const cleanUrl = url.replace(/^[a-zA-Z]:\\.*\\images\\/i, '/images/').replace(/\\/g, '/');
        return `<img src="${cleanUrl}" style="max-width: 100%; border: 1px solid #ccc; margin: 8px 0; display: block;" onerror="this.style.display='none'">`;
      }).join('');
    }

    if (hasPassage) {
      if (this.twoSidedWrapper) this.twoSidedWrapper.style.display = 'block';
      if (this.singleWrapper) this.singleWrapper.style.display = 'none';

      if (this.passagePanel) {
        this.passagePanel.innerHTML = this._sanitizeHTML(rawPassage);
      }
      if (this.questionText2Sided) {
        this.questionText2Sided.style.display = 'block';
        this.questionText2Sided.innerHTML = (imageHtml ? imageHtml : '') + this._sanitizeHTML(rawQuestion);
      }
      if (this.optionsTable2Sided) {
        this.optionsTable2Sided.innerHTML = this._generateSolutionOptionsHTML(question, selectedIdx);
      }
      if (this.explanationBox2Sided) {
        this.explanationBox2Sided.innerHTML = this._generateExplanationHTML(question, selectedIdx);
        this.explanationBox2Sided.style.display = this.isReattemptMode ? 'none' : 'block';
      }
    } else {
      if (this.twoSidedWrapper) this.twoSidedWrapper.style.display = 'none';
      if (this.singleWrapper) this.singleWrapper.style.display = 'block';

      if (this.questionImage) {
        if (imageHtml) {
          this.questionImage.style.display = 'block';
          this.questionImage.innerHTML = imageHtml;
        } else {
          this.questionImage.style.display = 'none';
          this.questionImage.innerHTML = '';
        }
      }
      if (this.questionText) {
        this.questionText.innerHTML = this._sanitizeHTML(rawQuestion);
      }
      if (this.optionsContainer) {
        this.optionsContainer.innerHTML = this._generateSolutionOptionsHTML(question, selectedIdx);
      }
      if (this.explanationBoxSingle) {
        this.explanationBoxSingle.innerHTML = this._generateExplanationHTML(question, selectedIdx);
        this.explanationBoxSingle.style.display = this.isReattemptMode ? 'none' : 'block';
      }
    }

    // Reset independent scroll positions
    if (this.leftPane) this.leftPane.scrollTop = 0;
    if (this.rightPane) this.rightPane.scrollTop = 0;
    if (this.singleWrapper) this.singleWrapper.scrollTop = 0;

    // Attach Re-attempt "Check Answer" Handler if active
    if (this.isReattemptMode) {
      if (this.statusBadgeContainer) {
        this.statusBadgeContainer.innerHTML = `<span class="soln-status-badge" style="background:#e0f2fe; color:#0284c7; border: 1px solid #7dd3fc;">Re-attempt Mode (Select an option)</span>`;
      }
      const activeOptionsTable = hasPassage ? this.optionsTable2Sided : this.optionsContainer;
      const activeExpBox = hasPassage ? this.explanationBox2Sided : this.explanationBoxSingle;
      const checkBtn = activeOptionsTable ? activeOptionsTable.querySelector('#btn-check-reattempt-ans') : document.getElementById('btn-check-reattempt-ans');

      if (activeOptionsTable) {
        activeOptionsTable.querySelectorAll('.reattempt-row').forEach(row => {
          row.onclick = () => {
            const radio = row.querySelector('input[type="radio"]');
            if (radio && !radio.disabled) {
              radio.checked = true;
              activeOptionsTable.querySelectorAll('.reattempt-row').forEach(r => r.classList.remove('selected'));
              row.classList.add('selected');
            }
          };
        });
      }

      if (checkBtn && activeOptionsTable) {
        checkBtn.onclick = (e) => {
          e.preventDefault();
          const checkedRadio = activeOptionsTable.querySelector('input[name="soln_reattempt_radio"]:checked');
          if (!checkedRadio) return;
          const chosenIdx = parseInt(checkedRadio.value, 10);

          activeOptionsTable.querySelectorAll('.reattempt-row').forEach((r, idx) => {
            const input = r.querySelector('input');
            if (input) input.disabled = true;
            if (idx === correctIdx) {
              r.classList.add('is-correct-ans');
              const pill = r.querySelector('.opt-pill-reattempt');
              if (pill) {
                pill.className = 'opt-pill correct';
                pill.textContent = (idx === chosenIdx) ? '✔ Correct (Your Re-attempt)' : '✔ Correct Option';
                pill.style.display = 'inline-block';
              }
            } else if (idx === chosenIdx) {
              r.classList.add('is-user-wrong');
              const pill = r.querySelector('.opt-pill-reattempt');
              if (pill) {
                pill.className = 'opt-pill wrong';
                pill.textContent = '✖ Your Re-attempt';
                pill.style.display = 'inline-block';
              }
            }
          });

          if (activeExpBox) activeExpBox.style.display = 'block';
          checkBtn.style.display = 'none';
        };
      }
    }

    // 5. Update Legend & 4-Column Sprite Palette Grid
    this._computeLegendStats();
    this.renderPalette();

    if (this.overlay) {
      const innerPane = this.overlay.querySelector('#soln-question-inner-pane');
      if (innerPane) innerPane.scrollTop = 0;

      this.overlay.querySelectorAll('#soln-left-container-post img').forEach(img => {
        img.onerror = () => { img.style.display = 'none'; };
      });
    }

    if (this.currentLang) {
      this.setLanguage(this.currentLang);
    }
  }

  _sanitizeHTML(raw) {
    if (!raw) return '';
    let formatted = String(raw).replace(/src=["']oliveimg\/([^"']+)["']/g, 'src="/oliveimg/$1"');
    formatted = formatted.replace(/src=["'](?:\.\/)?images\/([^"']+)["']/g, 'src="/images/$1"');
    return formatted;
  }

  _generateSolutionOptionsHTML(question, selectedIndex) {
    if (!question.options) return '';

    let optionsList = [];
    if (Array.isArray(question.options)) {
      optionsList = question.options.map((opt, idx) => {
        if (typeof opt === 'string') {
          return { letter: String.fromCharCode(65 + idx), text: opt, html: opt };
        }
        return opt;
      });
    } else if (typeof question.options === 'object') {
      const keys = Object.keys(question.options).sort();
      optionsList = keys.map(k => ({
        letter: k,
        text: question.options[k],
        html: question.options[k]
      }));
    }

    if (!optionsList.length) return '';

    const correctIdx = this._normalizeCorrectIdx(question);

    if (this.isReattemptMode) {
      return `
        <tbody>
          ${optionsList.map((opt, idx) => {
            const letterStr = (opt.letter || String.fromCharCode(65 + idx)).toLowerCase();
            let optHTML = opt.html !== undefined ? opt.html : (opt.text || '');
            optHTML = this._sanitizeHTML(optHTML);

            return `
              <tr class="vtop soln-opt-row reattempt-row" data-opt-idx="${idx}" style="cursor: pointer;">
                <td style="width: 25px;">
                  <input type="radio" name="soln_reattempt_radio" value="${idx}">
                </td>
                <td style="width: 25px;">
                  <span class="optcl">${letterStr}) </span>
                </td>
                <td>
                  <span class="optcl lpad">${optHTML}</span>
                  <span class="opt-pill-reattempt" style="display:none;"></span>
                </td>
              </tr>
            `;
          }).join('')}
          <tr>
            <td colspan="3" style="padding-top: 10px;">
              <button type="button" class="btn-check-reattempt-ans" id="btn-check-reattempt-ans">Check Answer</button>
            </td>
          </tr>
        </tbody>
      `;
    }

    return `
      <tbody>
        ${optionsList.map((opt, idx) => {
          const isUserChoice = selectedIndex !== null && selectedIndex !== undefined && Number(selectedIndex) === idx;
          const isCorrectChoice = Number(correctIdx) === idx;

          let rowClass = 'vtop soln-opt-row';
          let statusBadge = '';

          if (isCorrectChoice) {
            rowClass += ' is-correct-ans';
            if (isUserChoice) {
              statusBadge = `<span class="opt-pill correct">✔ Correct (Your Answer)</span>`;
            } else {
              statusBadge = `<span class="opt-pill correct">✔ Correct Answer</span>`;
            }
          } else if (isUserChoice) {
            rowClass += ' is-user-wrong';
            statusBadge = `<span class="opt-pill wrong">✖ Your Answer</span>`;
          }

          const letterStr = (opt.letter || String.fromCharCode(65 + idx)).toLowerCase();
          let optHTML = opt.html !== undefined ? opt.html : (opt.text || '');
          optHTML = this._sanitizeHTML(optHTML);

          return `
            <tr class="${rowClass}">
              <td style="width: 25px;">
                <input type="radio" disabled ${isUserChoice ? 'checked' : ''} style="cursor: default;">
              </td>
              <td style="width: 25px;">
                <span class="optcl" style="${isCorrectChoice ? 'font-weight:bold; color:#155724;' : (isUserChoice ? 'font-weight:bold; color:#721c24;' : '')}">${letterStr}) </span>
              </td>
              <td>
                <span class="optcl lpad">${optHTML}</span>
                ${statusBadge}
              </td>
            </tr>
          `;
        }).join('')}
      </tbody>
    `;
  }

  /**
   * Generate authentic Oliveboard Solution block ("Answer: c)" + "Solution:")
   */
  _generateExplanationHTML(question, selectedIndex) {
    const correctIdx = this._normalizeCorrectIdx(question);
    const correctLetter = String.fromCharCode(97 + correctIdx); // 'a', 'b', 'c', 'd', 'e'
    const isAttempted = selectedIndex !== null && selectedIndex !== undefined;
    const userLetter = isAttempted ? String.fromCharCode(97 + Number(selectedIndex)) : null;

    const rawExplanation = question.explanationHTML || question.explanation;
    const explanationBody = (rawExplanation && String(rawExplanation).trim().length > 0)
      ? this._sanitizeHTML(rawExplanation)
      : `<p>Comparing the given options with the context and rules of the question, option <b>(${correctLetter})</b> is the correct answer.</p>`;

    return `
      <div style="margin-bottom: 10px; padding-bottom: 8px; border-bottom: 1px solid #d0d7de; font-family: verdana, helvetica, sans-serif; font-size: 14px;">
        <span style="font-weight: bold; color: #2e7d32;">Answer: ${correctLetter})</span>
        ${isAttempted
          ? `<span style="margin-left: 16px; font-size: 13px; color: ${Number(selectedIndex) === correctIdx ? '#2e7d32' : '#c62828'}; font-weight: bold;">Your Response: ${userLetter})</span>`
          : `<span style="margin-left: 16px; font-size: 13px; color: #64748b;">Your Response: Not Attempted</span>`
        }
      </div>
      <div class="soln-explanation-header">
        <span>Solution:</span>
      </div>
      <div class="soln-explanation-content">
        ${explanationBody}
      </div>
    `;
  }

  /**
   * Render Oliveboard's authentic 4-column Sprite Question Palette in Solution Mode
   * Uses the exact same .sprite-butts classes as Live Test Mode:
   * - stic-answered (Green hexagon sprite) = Correct
   * - stic-notanswered (Red shield sprite) = Wrong
   * - stic-notvisited (Grey box sprite) = Skipped / Unattempted
   */
  renderPalette() {
    if (!this.paletteGrid) return;

    const section = this.testData.sections[this.currentSectionIndex];
    if (!section || !section.questions) return;

    const responses = this.attempt.responses || {};
    const questions = section.questions;

    let tableHTML = '<tbody>';
    for (let i = 0; i < questions.length; i += 4) {
      tableHTML += '<tr>';
      for (let j = 0; j < 4; j++) {
        const qIdx = i + j;
        if (qIdx < questions.length) {
          const q = questions[qIdx];
          const resp = responses[q.id];
          const selectedIdx = resp ? resp.selectedIndex : null;
          const isAttempted = selectedIdx !== null && selectedIdx !== undefined;
          const cIdx = this._normalizeCorrectIdx(q);
          const isCorrect = isAttempted && Number(selectedIdx) === Number(cIdx);
          const isCurrent = qIdx === this.currentQuestionIndex;
          const isBookmarked = !!this.bookmarkedQuestions[q.id];

          let spriteClass = 'stic-notvisited';
          let statusLabel = 'Not Attempted';
          if (isAttempted) {
            if (isCorrect) {
              spriteClass = 'stic-answered';
              statusLabel = 'Correct';
            } else {
              spriteClass = 'stic-notanswered';
              statusLabel = 'Wrong';
            }
          }

          const matchesFilter = this._questionMatchesFilter(q, this.currentFilter);
          const opacityStyle = matchesFilter ? '' : 'opacity: 0.22; pointer-events: none;';
          const displayNum = q.localIndex || (qIdx + 1);

          tableHTML += `
            <td>
              <a class="sprite-butts ${spriteClass} ${isCurrent ? 'current' : ''} ${isBookmarked ? 'bookmarked' : ''}" 
                 style="${opacityStyle}"
                 data-soln-q-idx="${qIdx}" 
                 title="Question ${displayNum} (${statusLabel})">
                <br>${displayNum}
              </a>
            </td>
          `;
        } else {
          tableHTML += '<td></td>';
        }
      }
      tableHTML += '</tr>';
    }
    tableHTML += '</tbody>';

    this.paletteGrid.innerHTML = tableHTML;

    this.paletteGrid.querySelectorAll('.sprite-butts').forEach(btn => {
      btn.onclick = (e) => {
        e.preventDefault();
        const qIdx = parseInt(btn.dataset.solnQIdx, 10);
        this.hideInPaneQuestionPaper();
        this.loadQuestion(this.currentSectionIndex, qIdx);
      };
    });

    const currentBtn = this.paletteGrid.querySelector('.sprite-butts.current');
    if (currentBtn && typeof currentBtn.scrollIntoView === 'function') {
      currentBtn.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
  }

  prevQuestion() {
    this.hideInPaneQuestionPaper();
    if (this.currentQuestionIndex > 0) {
      this.loadQuestion(this.currentSectionIndex, this.currentQuestionIndex - 1);
    } else if (this.currentSectionIndex > 0) {
      const prevSecIdx = this.currentSectionIndex - 1;
      const prevSection = this.testData.sections[prevSecIdx];
      this.switchSection(prevSecIdx);
      this.loadQuestion(prevSecIdx, prevSection.questions.length - 1);
    }
  }

  nextQuestion() {
    this.hideInPaneQuestionPaper();
    const section = this.testData.sections[this.currentSectionIndex];
    if (this.currentQuestionIndex < section.questions.length - 1) {
      this.loadQuestion(this.currentSectionIndex, this.currentQuestionIndex + 1);
    } else if (this.currentSectionIndex < this.testData.sections.length - 1) {
      this.switchSection(this.currentSectionIndex + 1);
      this.loadQuestion(this.currentSectionIndex, 0);
    }
  }

  openScorecardModal() {
    const scorecardModal = document.getElementById('scorecard-modal-overlay');
    if (scorecardModal) {
      scorecardModal.classList.add('active');
    }
  }

  exit() {
    this.isOpen = false;
    if (this.overlay) {
      this.overlay.classList.remove('active');
    }
    document.body.style.overflow = 'auto';

    if (window.appController) {
      window.appController.refreshAnalytics();
    }
  }
}

// Global initialization
window.obSolutionEngine = new OliveboardSolutionEngine();

window.openOliveboardSolutions = function(attempt, testData) {
  if (!window.obSolutionEngine) {
    window.obSolutionEngine = new OliveboardSolutionEngine();
  }
  window.obSolutionEngine.open(attempt, testData);
};
