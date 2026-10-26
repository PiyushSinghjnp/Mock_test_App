/**
 * Oliveboard Test Engine - Authentic 1:1 Live Exam Player
 * Reverse-Engineered from u1.oliveboard.in (oliveboard_live_player.html & style_pallet.css)
 *
 * Features:
 * - 2-Sided Test Window (Directions/Passage on Left, Question & Options on Right)
 * - Single Pane View for standalone questions
 * - Authentic clearme() Radio Selection & Click-Again-to-Deselect (draftSelectedIndex vs committed selectedIndex)
 * - Official Oliveboard 4-Column Sprite Button Palette with auto-scroll (stic-notvisited, stic-answered, stic-notanswered, stic-marked, stic-answered-marked)
 * - Locked Banking Prelims Section Tabs with live hover breakdown (#hover-con) & Next Section / Timer Expiry transitions
 * - End-of-Section Save & Next / Mark for Review & Next automatic Next Section / Submit prompt
 * - Partial Right-Sidebar Collapse (.darr-rightslide / .darr-leftslide) keeping Candidate Info, Timer & Pause visible at top-right
 * - In-Pane Question Paper (#b1), Instructions (#b2), Profile (#b3), and Submit Summary (#submit-pane & #sure)
 * - First-scroll Mousewheel Warning Banner (.scrolltooltip) & Opacity-Dimmed Pause Modal (#calert)
 * - 2026 Official Exam Marking Scheme & Sectional Timing support + SQLite Persistence
 */

class OliveboardTestEngine {
  constructor(testData) {
    this.testData = testData;
    this.currentSectionIndex = 0;
    this.currentQuestionIndex = 0;
    // userResponses[qId] = { selectedIndex: number|null, draftSelectedIndex: number|null, status: string, timeSpentSeconds: number, timeEntries: [] }
    this.userResponses = {};
    this.pendingSelectedIndex = null;
    this.timerInterval = null;
    this.completedSections = new Set();
    this.bookmarkedQuestions = {};
    this.isSectionAdvanceConfirm = false;
    this.scrollTooltipShown = false;
    this.isPaletteCollapsed = false;

    const firstSec = this.testData.sections && this.testData.sections[0];
    this.sectionRemainingSeconds = (firstSec && firstSec.durationSeconds)
      ? firstSec.durationSeconds
      : (testData.totalDurationSeconds || 1200);
    this.remainingSeconds = testData.totalDurationSeconds || 3600;

    this.isExamActive = false;
    this.isPaused = false;
    this.startTime = null;

    this.initDOM();
  }

  initDOM() {
    this.modalOverlay = document.getElementById('test-modal-overlay');
    this.mainContainer = document.getElementById('main-container');
    this.examTitleEl = document.getElementById('exam-title-display');
    this.sectionTabsContainer = document.getElementById('exam-section-tabs');
    this.timerDisplayEl = document.getElementById('exam-timer-display');
    this.hourEl = document.getElementById('hour');
    this.minsEl = document.getElementById('mins');
    this.secsEl = document.getElementById('secs');
    this.qnoDispEl = document.getElementById('qno-disp');
    this.qNumLabelEl = document.getElementById('exam-q-num-label');
    this.marksInfoEl = document.getElementById('exam-marks-info');
    this.secOtherEl = document.getElementById('sec-other');

    // Pre-Exam & In-Exam Submit Containers (#left-container & #right-container)
    this.leftContainerPre = document.getElementById('left-container');
    this.rightContainerPre = document.getElementById('right-container');
    this.instructionPane = document.getElementById('instruction-pane-1');
    this.instrFooterBar = document.getElementById('instr-footer-bar');
    this.instrTotalQEl = document.getElementById('instr-total-q');
    this.instrTotalTimeEl = document.getElementById('instr-total-time');
    this.instrSectionMatrixTbody = document.getElementById('in-tab-body');
    this.disclaimerCheck = document.getElementById('disclaimer-check');
    this.disclaimerWarning = document.getElementById('disclaimer-warning');
    this.btnStartTest = document.getElementById('start-test');
    this.instrDropdownMenu = document.getElementById('instrDropdownMenu');
    this.instrLangMenu = document.getElementById('instr-lang-menu');

    // In-Exam Submit Summary Elements (#submit-pane & #sure - Spec 4.2)
    this.submitPane = document.getElementById('submit-pane');
    this.submitPaneHeading = document.getElementById('submit-pane-heading');
    this.fTbody = document.getElementById('f-tbody');
    this.sureBox = document.getElementById('sure');
    this.sureWarningText = document.getElementById('sure-warning-text');
    this.sureSectionLockNote = document.getElementById('sure-section-lock-note');
    this.btnSBack = document.getElementById('btn-s-back');
    this.btnSSubmit = document.getElementById('btn-s-submit');
    this.sSubmitSpan = document.getElementById('s-submit');
    this.plsWaitBox = document.getElementById('plswait');

    // Active Exam Containers (#left-container-post & #right-container-post)
    this.leftContainerPost = document.getElementById('left-container-post');
    this.rightContainerPost = document.getElementById('right-container-post');
    this.rightLowHalfOuter = document.getElementById('right-low-half-outer');
    this.questionOuterPane = document.getElementById('question-outer-pane');
    this.questionNoBar = document.getElementById('question-no-bar');
    this.questionInnerPane = document.getElementById('question-inner-pane');
    this.buttonHolder = document.getElementById('button-holder');

    // In-Pane Utility Views (#b1 Question Paper, #b2 Instructions, #b3 Profile, #back - Spec 3.7)
    this.instructionsOnButton = document.getElementById('instructions-onbutton');
    this.questionListOnButton = document.getElementById('question-list-onbutton');
    this.candidateDetailsOnButton = document.getElementById('candidate-details-onbutton');
    this.mainBackButton = document.getElementById('main-back-button');
    this.btnGetAllBack = document.getElementById('btn-get-all-back');

    // 2-Sided View Elements (Variant 2 - Spec 3.3)
    this.twoSidedWrapper = document.getElementById('exam-two-sided-wrapper');
    this.leftPane = document.getElementById('exam-leftpane');
    this.passagePanel = document.getElementById('exam-passage-panel');
    this.rightPane = document.getElementById('exam-rightpane');
    this.questionText2SidedEl = document.getElementById('exam-question-text-2sided');
    this.optionsTable2Sided = document.getElementById('exam-options-table-2sided');

    // Single Pane Elements (Variant 1 - Spec 3.3)
    this.singleWrapper = document.getElementById('exam-single-wrapper');
    this.questionTextEl = document.getElementById('exam-question-text');
    this.optionsContainer = document.getElementById('exam-options-container');
    this.questionImageEl = document.getElementById('exam-question-image');

    // Action Buttons (#button-holder - Spec 3.6)
    this.btnSaveNext = document.getElementById('btn-save-next');
    this.btnMarkReview = document.getElementById('btn-mark-review');
    this.btnClearResponse = document.getElementById('btn-clear-response');
    this.btnSubmitExam = document.getElementById('btn-submit-exam');
    this.btnExitExam = document.getElementById('btn-exit-exam');
    this.btnHeaderExit = document.getElementById('btn-header-exit-test');
    this.btnScreenToggle = document.getElementById('btn-screen-toggle');

    // Bookmark Toggle Button
    this.btnBookmarkToggle = document.getElementById('btn-toggle-bookmark');

    // Palette & Legend
    this.paletteMainScrollEl = document.getElementById('question-main-pallette');
    this.paletteGridEl = document.getElementById('palette-numbers-grid');

    // Pause Dialog (#calert & #dummy-black - Spec 4.1)
    this.btnPauseTest = document.getElementById('btn-pause-test');
    this.btnPauseOk = document.getElementById('pauseok');
    this.btnResumeTest = document.getElementById('btn-resume-test');
    this.pauseModal = document.getElementById('calert');
    this.dummyBlack = document.getElementById('dummy-black');

    // Bottom Navigation Buttons (#b1, #b2, #b3, #b4)
    this.btnBottomPaper = document.getElementById('btn-bottom-paper');
    this.btnBottomInstructions = document.getElementById('btn-bottom-instructions');
    this.btnBottomProfile = document.getElementById('btn-bottom-profile');
    this.b1El = document.getElementById('b1');
    this.b2El = document.getElementById('b2');
    this.b3El = document.getElementById('b3');
    this.b4El = document.getElementById('b4');

    // Scorecard Overlay
    this.scorecardOverlay = document.getElementById('scorecard-modal-overlay');
    this.btnCloseScorecard = document.getElementById('btn-close-scorecard');

    this.bindEvents();
  }

  bindEvents() {
    // Pre-Exam "Start Test" Button (#start-test - Spec 2.3)
    if (this.btnStartTest) {
      this.btnStartTest.onclick = (e) => {
        e.preventDefault();
        if (this.disclaimerCheck && !this.disclaimerCheck.checked) {
          if (this.disclaimerWarning) {
            this.disclaimerWarning.style.display = 'block';
          }
          return;
        }
        if (this.disclaimerWarning) {
          this.disclaimerWarning.style.display = 'none';
        }
        this.startActiveExam(false);
      };
    }

    if (this.disclaimerCheck) {
      this.disclaimerCheck.onchange = () => {
        if (this.disclaimerCheck.checked && this.disclaimerWarning) {
          this.disclaimerWarning.style.display = 'none';
        }
      };
    }

    // Instructions Language Selector
    if (this.instrDropdownMenu && this.instrLangMenu) {
      this.instrDropdownMenu.onclick = (e) => {
        e.stopPropagation();
        this.instrLangMenu.style.display = this.instrLangMenu.style.display === 'none' ? 'block' : 'none';
      };
      this.instrLangMenu.querySelectorAll('li').forEach(li => {
        li.onclick = (e) => {
          e.stopPropagation();
          const lang = li.dataset.lang;
          const text = li.textContent;
          const selectedItem = this.instrDropdownMenu.querySelector('.dd-selected-item');
          if (selectedItem) selectedItem.textContent = text;
          this.instrLangMenu.style.display = 'none';
          this.setLanguage(lang);
        };
      });
    }

    // Primary Question Action Buttons (#mark, #clear, #next - Spec 3.6)
    if (this.btnSaveNext) {
      this.btnSaveNext.onclick = (e) => { e.preventDefault(); this.displayQuestionsSave(); };
    }
    if (this.btnMarkReview) {
      this.btnMarkReview.onclick = (e) => { e.preventDefault(); this.displayQuestionsMark(); };
    }
    if (this.btnClearResponse) {
      this.btnClearResponse.onclick = (e) => { e.preventDefault(); this.clearOption(); };
    }

    // Bottom 2x2 Utility Grid (#b1 Question Paper, #b2 Instructions, #b3 Profile, #b4 Next Section / Submit - Spec 3.7 & 4.2)
    // Note: #b1..#b4 are inside #btn-bottom-paper..#btn-submit-exam; bind only on the outer anchor (or stopPropagation) so handlers never fire twice
    const handleB1 = (e) => { e.preventDefault(); e.stopPropagation(); this.getQuestionPaper(); };
    if (this.btnBottomPaper) this.btnBottomPaper.onclick = handleB1;
    else if (this.b1El) this.b1El.onclick = handleB1;

    const handleB2 = (e) => { e.preventDefault(); e.stopPropagation(); this.getInstructions(); };
    if (this.btnBottomInstructions) this.btnBottomInstructions.onclick = handleB2;
    else if (this.b2El) this.b2El.onclick = handleB2;

    const handleB3 = (e) => { e.preventDefault(); e.stopPropagation(); this.getCandProfile(); };
    if (this.btnBottomProfile) this.btnBottomProfile.onclick = handleB3;
    else if (this.b3El) this.b3El.onclick = handleB3;

    const handleB4 = (e) => {
      e.preventDefault();
      e.stopPropagation();
      const isLastSection = this.currentSectionIndex >= this.testData.sections.length - 1;
      if (!isLastSection) {
        this.targetSectionIndexForAdvance = this.currentSectionIndex + 1;
        this.finalSubmit(true);
      } else {
        this.finalSubmit(false);
      }
    };
    if (this.btnSubmitExam) this.btnSubmitExam.onclick = handleB4;
    else if (this.b4El) this.b4El.onclick = handleB4;

    if (this.btnGetAllBack) {
      this.btnGetAllBack.onclick = (e) => { e.preventDefault(); this.getAllBack(); };
    }

    // In-Pane Submit Confirmation (#s-back & #s-submit - Spec 4.2)
    if (this.btnSBack) {
      this.btnSBack.onclick = (e) => { e.preventDefault(); this.sBack(); };
    }
    if (this.btnSSubmit) {
      this.btnSSubmit.onclick = (e) => { e.preventDefault(); this.sendData(); };
    }

    // Header Exit & Fullscreen
    if (this.btnHeaderExit) {
      this.btnHeaderExit.onclick = (e) => {
        e.preventDefault();
        if (!this.isExamActive) {
          this.exitTest();
        } else {
          this.pauseTest();
        }
      };
    }
    if (this.btnExitExam) {
      this.btnExitExam.onclick = (e) => { e.preventDefault(); this.pauseTest(); };
    }
    if (this.btnScreenToggle) {
      this.btnScreenToggle.onclick = (e) => { e.preventDefault(); this.toggleFullscreen(); };
    }

    // Bookmark Toggle Button
    if (this.btnBookmarkToggle) {
      this.btnBookmarkToggle.onclick = (e) => {
        e.preventDefault();
        this.toggleQuestionBookmark();
      };
    }

    // Pause / Resume (#calert - Spec 4.1)
    if (this.btnPauseTest) {
      this.btnPauseTest.onclick = (e) => { e.preventDefault(); this.pauseTest(); };
    }
    if (this.btnPauseOk) {
      this.btnPauseOk.onclick = async (e) => {
        e.preventDefault();
        await this.savePausedStateAndExit();
      };
    }
    if (this.btnResumeTest) {
      this.btnResumeTest.onclick = (e) => { e.preventDefault(); this.resumeTest(); };
    }

    // Authentic Partial Right-Sidebar Collapse / Expand (.darr-rightslide & .darr-leftslide - oliveboard_live_player.html lines 1361-1374)
    // Hides ONLY #right-low-half-outer while keeping #cand-time-outer (Candidate Photo, Timer, Pause button) visible at top-right!
    const btnCollapse = document.getElementById('btn-collapse-sidebar');
    const btnExpand = document.getElementById('btn-expand-sidebar');
    if (btnCollapse) {
      btnCollapse.onclick = () => {
        this.collapsePaletteSidebar();
      };
    }
    if (btnExpand) {
      btnExpand.onclick = () => {
        this.expandPaletteSidebar();
      };
    }

    // Scrollbar tooltip close (#tclose) & first-mousewheel trigger (oliveboard_live_player.html lines 1376-1394)
    const tClose = document.getElementById('tclose');
    const scrollTooltip = document.getElementById('ob-scrolltooltip');
    if (tClose && scrollTooltip) {
      tClose.onclick = () => { scrollTooltip.style.display = 'none'; };
    }

    const triggerWheelTooltip = () => {
      const activeEngine = window.currentTestEngine || this;
      if (!activeEngine.isExamActive || activeEngine.scrollTooltipShown) return;
      activeEngine.scrollTooltipShown = true;
      if (scrollTooltip) {
        scrollTooltip.style.display = 'block';
        setTimeout(() => {
          scrollTooltip.style.display = 'none';
        }, 5000);
      }
    };
    [this.questionInnerPane, this.leftPane, this.rightPane, this.singleWrapper].forEach(pane => {
      if (pane) {
        pane.onwheel = triggerWheelTooltip;
      }
    });

    // Question Bar Language Dropdown Toggle
    const btnLangDrop = document.getElementById('dropdownMenu2');
    const langMenu = document.getElementById('lang-dropdown-menu');
    if (btnLangDrop && langMenu) {
      btnLangDrop.onclick = (e) => {
        e.stopPropagation();
        langMenu.style.display = langMenu.style.display === 'none' ? 'block' : 'none';
      };
      langMenu.querySelectorAll('li').forEach(li => {
        li.onclick = (e) => {
          e.stopPropagation();
          const lang = li.dataset.lang;
          langMenu.style.display = 'none';
          this.setLanguage(lang);
        };
      });
    }

    if (!window._obTestEngineDocListenersBound) {
      window._obTestEngineDocListenersBound = true;
      document.addEventListener('click', () => {
        const lMenu = document.getElementById('lang-dropdown-menu');
        const iMenu = document.getElementById('instr-lang-menu');
        if (lMenu) lMenu.style.display = 'none';
        if (iMenu) iMenu.style.display = 'none';
      });
      document.addEventListener('fullscreenchange', () => {
        const btnToggle = document.getElementById('btn-screen-toggle');
        if (!document.fullscreenElement && btnToggle) {
          btnToggle.textContent = 'Enter Full Screen';
        }
      });
    }

    // Scorecard Close Button
    if (this.btnCloseScorecard) {
      this.btnCloseScorecard.onclick = () => {
        if (window.appController) {
          window.appController.goBack();
        } else {
          this.scorecardOverlay.classList.remove('active');
          if (!window.obSolutionEngine || !window.obSolutionEngine.isOpen) {
            this.exitTest();
          }
        }
      };
    }
  }

  /**
   * Collapse ONLY #right-low-half-outer while keeping #cand-time-outer visible at top-right
   * Exact 1:1 with oliveboard_live_player.html lines 1361-1374
   */
  collapsePaletteSidebar() {
    this.isPaletteCollapsed = true;
    if (this.rightLowHalfOuter) this.rightLowHalfOuter.style.display = 'none';
    if (this.rightContainerPost) this.rightContainerPost.classList.add('palette-collapsed');
    if (this.questionOuterPane) this.questionOuterPane.classList.add('expanded-full-lower');
    const btnExpand = document.getElementById('btn-expand-sidebar');
    if (btnExpand) btnExpand.style.display = 'flex';
  }

  /**
   * Expand #right-low-half-outer and restore #question-outer-pane width
   */
  expandPaletteSidebar() {
    this.isPaletteCollapsed = false;
    if (this.rightLowHalfOuter) this.rightLowHalfOuter.style.display = '';
    if (this.rightContainerPost) this.rightContainerPost.classList.remove('palette-collapsed');
    if (this.questionOuterPane) this.questionOuterPane.classList.remove('expanded-full-lower');
    const btnExpand = document.getElementById('btn-expand-sidebar');
    if (btnExpand) btnExpand.style.display = 'none';
  }

  /**
   * Normalize correctIndex for any question object (supports 0..4, 1..5, or 'A'..'E')
   */
  _getNormalizedCorrectIndex(q) {
    if (window.OB_EXAM_PATTERNS_2026 && typeof window.OB_EXAM_PATTERNS_2026.normalizeCorrectIndex === 'function') {
      return window.OB_EXAM_PATTERNS_2026.normalizeCorrectIndex(q, q.options || []);
    }
    if (typeof q.correctIndex === 'number' && q.correctIndex >= 0) return q.correctIndex;
    const raw = q.correct_answer ?? q.correctAnswer ?? q.answer;
    if (raw !== undefined && raw !== null) {
      const map = { A: 0, B: 1, C: 2, D: 3, E: 4 };
      const str = String(raw).trim().toUpperCase();
      if (map[str] !== undefined) return map[str];
      const n = parseInt(str, 10);
      if (!isNaN(n) && n >= 1) return n - 1;
    }
    return 0;
  }

  /**
   * Launch Test Console (Spec 2.2 & 2.3):
   * - Fresh Start: Shows Pre-Exam Instructions (#left-container + #right-container) first; clicking #start-test enters the active exam.
   * - Resume Test: If pausedState is provided, restores all state and immediately opens #left-container-post + #right-container-post.
   */
  startTest(pausedState = null) {
    this.initDOM();
    this.isExamActive = false;
    this.isPaused = false;
    this.completedSections = new Set();
    this.bookmarkedQuestions = window.obDataManager ? window.obDataManager.getBookmarkedMap() : {};
    this.isSectionAdvanceConfirm = false;
    this.currentSectionIndex = 0;
    this.currentQuestionIndex = 0;
    this.userResponses = {};
    this.pendingSelectedIndex = null;
    this.scrollTooltipShown = false;

    const firstSec = this.testData.sections && this.testData.sections[0];
    this.sectionRemainingSeconds = (firstSec && firstSec.durationSeconds)
      ? firstSec.durationSeconds
      : (this.testData.totalDurationSeconds || 1200);
    this.remainingSeconds = this.testData.totalDurationSeconds || 3600;

    // Initialize all questions as stic-notvisited
    this.testData.sections.forEach(sec => {
      sec.questions.forEach(q => {
        q.correctIndex = this._getNormalizedCorrectIndex(q);
        this.userResponses[q.id] = {
          selectedIndex: null,
          draftSelectedIndex: null,
          status: 'stic-notvisited',
          timeSpentSeconds: 0,
          timeEntries: []
        };
      });
    });

    // Update Header Test Title & Candidate info
    if (this.examTitleEl) {
      this.examTitleEl.textContent = this.testData.title;
    }
    const activeUser = window.obDataManager ? window.obDataManager.getActiveUser() : null;
    const preNameEl = document.getElementById('pre-cand-name');
    const preRollEl = document.getElementById('pre-cand-roll');
    if (preNameEl && activeUser) preNameEl.textContent = activeUser.name;
    if (preRollEl && activeUser) preRollEl.textContent = activeUser.roll_no || 'OB-2026-9041';

    // Populate Section Matrix Table (#in-tab) in Instructions Pane (Spec 2.2)
    let totalQCount = 0;
    let totalTimeMins = 0;
    this.testData.sections.forEach(sec => {
      totalQCount += (sec.questions ? sec.questions.length : (sec.questionCount || 0));
      totalTimeMins += (sec.durationMinutes || Math.round((sec.durationSeconds || 1200) / 60));
    });
    if (!this.testData.hasSectionalTiming && this.testData.durationMinutes) {
      totalTimeMins = this.testData.durationMinutes;
    }

    if (this.instrTotalQEl) this.instrTotalQEl.textContent = totalQCount || this.testData.questionsCount || 100;
    if (this.instrTotalTimeEl) this.instrTotalTimeEl.textContent = `${totalTimeMins || this.testData.durationMinutes || 60} minutes`;

    if (this.instrSectionMatrixTbody) {
      this.instrSectionMatrixTbody.innerHTML = this.testData.sections.map((sec, i) => `
        <tr>
          <td>${i + 1}</td>
          <td style="text-align: left; font-weight: bold;">${sec.title}</td>
          <td>${sec.questions ? sec.questions.length : (sec.questionCount || 30)}</td>
          <td>${sec.maxMarks || (sec.questions ? sec.questions.length : 30)}</td>
          <td>${this.testData.hasSectionalTiming === false ? `${this.testData.durationMinutes || 60} (Composite)` : (sec.durationMinutes || Math.round((sec.durationSeconds || 1200) / 60))}</td>
          <td>${sec.language || 'English and Hindi'}</td>
        </tr>
      `).join('');
    }

    // Ensure opacity is reset
    if (this.questionInnerPane) this.questionInnerPane.style.opacity = '1';
    if (this.mainContainer) this.mainContainer.style.opacity = '1';

    // Show Test Console Overlay
    if (this.modalOverlay) {
      this.modalOverlay.classList.add('active');
    }
    document.body.style.overflow = 'hidden';

    // Check if resuming from a paused state
    if (pausedState) {
      this.currentSectionIndex = pausedState.currentSectionIndex ?? pausedState.current_section_index ?? 0;
      this.currentQuestionIndex = pausedState.currentQuestionIndex ?? pausedState.current_question_index ?? 0;
      this.sectionRemainingSeconds = pausedState.sectionRemainingSeconds ?? pausedState.section_remaining_seconds ?? this.sectionRemainingSeconds;
      this.remainingSeconds = pausedState.remainingSeconds ?? pausedState.remaining_seconds ?? this.remainingSeconds;
      const savedCompleted = pausedState.completedSections || pausedState.completed_sections || [];
      if (Array.isArray(savedCompleted)) {
        this.completedSections = new Set(savedCompleted);
      }
      if (pausedState.responses && typeof pausedState.responses === 'object') {
        Object.keys(pausedState.responses).forEach(qId => {
          const savedR = pausedState.responses[qId];
          this.userResponses[qId] = {
            ...this.userResponses[qId],
            ...savedR,
            draftSelectedIndex: savedR.draftSelectedIndex !== undefined ? savedR.draftSelectedIndex : savedR.selectedIndex
          };
        });
      }
      if (pausedState.bookmarkedQuestions || pausedState.bookmarked_questions) {
        this.bookmarkedQuestions = {
          ...this.bookmarkedQuestions,
          ...(pausedState.bookmarkedQuestions || pausedState.bookmarked_questions || {})
        };
      }
      this.startActiveExam(true);
      return;
    }

    // Show Pre-Exam Instructions Screen (#left-container + #right-container) first
    if (this.leftContainerPre) this.leftContainerPre.style.display = 'block';
    if (this.rightContainerPre) this.rightContainerPre.style.display = 'block';
    if (this.instructionPane) this.instructionPane.style.display = 'block';
    if (this.instrFooterBar) this.instrFooterBar.style.display = 'block';
    if (this.submitPane) this.submitPane.style.display = 'none';
    if (this.sureBox) this.sureBox.style.display = 'none';
    if (this.plsWaitBox) this.plsWaitBox.style.display = 'none';
    if (this.leftContainerPost) this.leftContainerPost.style.display = 'none';
    if (this.rightContainerPost) this.rightContainerPost.style.display = 'none';
    if (this.disclaimerCheck) this.disclaimerCheck.checked = true;
    if (this.disclaimerWarning) this.disclaimerWarning.style.display = 'none';
  }

  /**
   * Transition from #left-container/#right-container to #left-container-post/#right-container-post
   * Exact 1:1 with $('#start-test').click() in oliveboard_live_player.html lines 560-582
   */
  startActiveExam(isResume = false) {
    this.isExamActive = true;
    this.isConfirmPaneOpen = false;
    if (this.sendDataTimeoutId) {
      clearTimeout(this.sendDataTimeoutId);
      this.sendDataTimeoutId = null;
    }
    this.startTime = Date.now();
    this.currentQuestionEntryTime = Date.now();

    if (this.leftContainerPre) this.leftContainerPre.style.display = 'none';
    if (this.rightContainerPre) this.rightContainerPre.style.display = 'none';
    if (this.submitPane) this.submitPane.style.display = 'none';
    if (this.sureBox) this.sureBox.style.display = 'none';
    if (this.plsWaitBox) this.plsWaitBox.style.display = 'none';

    if (this.leftContainerPost) {
      this.leftContainerPost.style.setProperty('width', '80%', 'important');
      this.leftContainerPost.style.display = 'block';
    }
    if (this.rightContainerPost) {
      this.rightContainerPost.style.display = 'block';
      this.rightContainerPost.style.visibility = 'visible';
    }
    this.expandPaletteSidebar();

    // Ensure question view is restored (not utility views)
    this.getAllBack();

    // Start Realtime Countdown Timer
    this.startTimer();

    // Render Section Tabs and Load Current Question
    this.renderSectionTabs();
    this.loadQuestion(this.currentSectionIndex, this.currentQuestionIndex);
    this.renderPalette();
  }

  /**
   * Record time spent on the active question before navigating (Spec 3.2)
   */
  _recordCurrentQuestionTime() {
    if (!this.currentQuestionEntryTime || !this.isExamActive) return;
    const curSec = this.testData.sections && this.testData.sections[this.currentSectionIndex];
    if (!curSec) return;
    const curQ = curSec.questions && curSec.questions[this.currentQuestionIndex];
    if (!curQ) return;

    const elapsed = Math.max(1, Math.round((Date.now() - this.currentQuestionEntryTime) / 1000));
    const resp = this.userResponses[curQ.id];
    if (resp) {
      resp.timeSpentSeconds = (resp.timeSpentSeconds || 0) + elapsed;
      if (!resp.timeEntries) resp.timeEntries = [];
      resp.timeEntries.push({
        entry: new Date(this.currentQuestionEntryTime).toLocaleTimeString(),
        exit: new Date().toLocaleTimeString(),
        durationSeconds: elapsed
      });
    }
    this.currentQuestionEntryTime = Date.now();
  }

  startTimer() {
    clearInterval(this.timerInterval);
    this.updateTimerDisplay();

    this.timerInterval = setInterval(() => {
      if (this.isPaused) return;

      this.sectionRemainingSeconds--;
      this.remainingSeconds--;
      this.updateTimerDisplay();

      if (this.sectionRemainingSeconds <= 0) {
        clearInterval(this.timerInterval);
        this.handleSectionTimeout();
      }
    }, 1000);
  }

  updateTimerDisplay() {
    const totalSecs = Math.max(0, this.sectionRemainingSeconds);
    const hours = Math.floor(totalSecs / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    const secs = totalSecs % 60;

    const hStr = String(hours).padStart(2, '0');
    const mStr = String(totalSecs >= 3600 ? mins : Math.floor(totalSecs / 60)).padStart(2, '0');
    const sStr = String(secs).padStart(2, '0');

    if (this.hourEl) {
      if (hours > 0) {
        this.hourEl.style.display = 'inline';
        this.hourEl.textContent = `${hStr}:`;
      } else {
        this.hourEl.style.display = 'none';
      }
    }
    if (this.minsEl) this.minsEl.textContent = hours > 0 ? String(mins).padStart(2, '0') : mStr;
    if (this.secsEl) this.secsEl.textContent = sStr;
    if (this.timerDisplayEl) {
      this.timerDisplayEl.textContent = `${hStr}:${String(mins).padStart(2, '0')}:${sStr}`;
    }

    const secNameEl = document.getElementById('exam-sec-timer-name');
    const curSec = this.testData.sections && this.testData.sections[this.currentSectionIndex];
    if (secNameEl && curSec) {
      secNameEl.textContent = this.testData.hasSectionalTiming === false
        ? `${curSec.title} (Composite)`
        : curSec.title;
    }
  }

  handleSectionTimeout() {
    if (!this.isExamActive) return;
    if (this.sendDataTimeoutId) {
      clearTimeout(this.sendDataTimeoutId);
      this.sendDataTimeoutId = null;
    }
    if (this.isConfirmPaneOpen) {
      this.sBack();
    }

    // Strict TCS iON rule: discard any uncommitted radio selection on the expiring section
    const expiringSec = this.testData.sections && this.testData.sections[this.currentSectionIndex];
    if (expiringSec && Array.isArray(expiringSec.questions)) {
      expiringSec.questions.forEach(q => {
        const r = this.userResponses[q.id];
        if (r) {
          r.draftSelectedIndex = r.selectedIndex;
        }
      });
    }
    this.pendingSelectedIndex = null;

    const isLastSection = this.currentSectionIndex >= this.testData.sections.length - 1;
    if (!isLastSection && this.testData.hasSectionalTiming !== false) {
      this._recordCurrentQuestionTime();
      this.completedSections.add(this.currentSectionIndex);
      this.switchSection(this.currentSectionIndex + 1);
    } else {
      this.submitTest();
    }
  }

  /**
   * Pause Test (#calert & #dummy-black - Spec 4.1 & oliveboard_live_player.html lines 1231-1288)
   */
  pauseTest() {
    this._recordCurrentQuestionTime();
    this.currentQuestionEntryTime = null;
    this.isPaused = true;
    if (this.questionInnerPane) this.questionInnerPane.style.opacity = '0.1';
    if (this.mainContainer) this.mainContainer.style.opacity = '0.3';
    if (this.pauseModal) this.pauseModal.style.display = 'block';
    if (this.dummyBlack) this.dummyBlack.style.display = 'block';
  }

  resumeTest() {
    this.isPaused = false;
    this.currentQuestionEntryTime = Date.now();
    if (this.questionInnerPane) this.questionInnerPane.style.opacity = '1';
    if (this.mainContainer) this.mainContainer.style.opacity = '1';
    if (this.pauseModal) this.pauseModal.style.display = 'none';
    if (this.dummyBlack) this.dummyBlack.style.display = 'none';
  }

  async savePausedStateAndExit() {
    this.isExamActive = false;
    this.isPaused = false;
    if (this.questionInnerPane) this.questionInnerPane.style.opacity = '1';
    if (this.mainContainer) this.mainContainer.style.opacity = '1';
    if (this.pauseModal) this.pauseModal.style.display = 'none';
    if (this.dummyBlack) this.dummyBlack.style.display = 'none';

    if (window.obDataManager) {
      await window.obDataManager.savePausedAttempt({
        testId: this.testData.id,
        currentSectionIndex: this.currentSectionIndex,
        currentQuestionIndex: this.currentQuestionIndex,
        sectionRemainingSeconds: this.sectionRemainingSeconds,
        remainingSeconds: this.remainingSeconds,
        completedSections: Array.from(this.completedSections),
        responses: this.userResponses,
        bookmarkedQuestions: this.bookmarkedQuestions
      });
    }

    this.exitTest();
  }

  toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      if (this.btnScreenToggle) this.btnScreenToggle.textContent = 'Exit Full Screen';
    } else {
      if (document.exitFullscreen) document.exitFullscreen().catch(() => {});
      if (this.btnScreenToggle) this.btnScreenToggle.textContent = 'Enter Full Screen';
    }
  }

  setLanguage(lang) {
    this.currentLang = lang === 'hqt' ? 'hqt' : 'eqt';
    const labelText = this.currentLang === 'hqt' ? 'Hindi' : 'English';
    const btnLangDrop = document.getElementById('dropdownMenu2');
    if (btnLangDrop) {
      const sel = btnLangDrop.querySelector('.dd-selected-item');
      if (sel) sel.textContent = labelText;
    }
    if (this.instrDropdownMenu) {
      const sel = this.instrDropdownMenu.querySelector('.dd-selected-item');
      if (sel) sel.textContent = labelText;
    }
    if (this.currentLang === 'hqt') {
      document.querySelectorAll('.hqt').forEach(el => el.style.setProperty('display', 'inline', 'important'));
      document.querySelectorAll('.eqt').forEach(el => el.style.setProperty('display', 'none', 'important'));
    } else {
      document.querySelectorAll('.hqt').forEach(el => el.style.setProperty('display', 'none', 'important'));
      document.querySelectorAll('.eqt').forEach(el => el.style.setProperty('display', 'inline', 'important'));
    }
  }

  /**
   * Render Section Tabs (#section-name-container)
   * - In Banking Prelims/Mains style (isSectionalLocked !== false), other section tabs are locked (cursor: default) and advancing happens ONLY via Next Section (#b4), end-of-section Save & Next, or timer expiry.
   * - In Composite Timer exams (e.g. SSC CGL Tier-1, isSectionalLocked === false), clicking a section tab switches freely without resetting the composite timer.
   * - Hovering over any section tab displays #hover-con with live status counts for that section.
   */
  renderSectionTabs() {
    if (!this.sectionTabsContainer) return;

    const isStrictSectionLock = this.testData.isSectionalLocked !== false && this.testData.hasSectionalTiming !== false;

    this.sectionTabsContainer.innerHTML = this.testData.sections.map((sec, idx) => {
      const isCompletedLocked = this.completedSections.has(idx);
      const isCurrent = idx === this.currentSectionIndex;
      const cursorStyle = (!isStrictSectionLock && !isCompletedLocked) ? 'cursor: pointer;' : 'cursor: default;';
      return `
        <td>
          <span class="secgen ${isCurrent ? 'currclass' : ''} ${isCompletedLocked ? 'locked-section' : ''}" 
                id="sec-${idx + 1}"
                data-sec-idx="${idx}"
                style="${cursorStyle}"
                title="${sec.title} (${sec.questions.length} Questions • ${sec.durationMinutes || 20} Mins)">
            ${sec.title}
          </span>
        </td>
      `;
    }).join('');

    const hoverCon = document.getElementById('hover-con');
    const hoverChild = document.getElementById('hover-con-child');
    const ansEl = document.getElementById('answ');
    const unansEl = document.getElementById('unansw');
    const markedEl = document.getElementById('marked');
    const ansMarkedEl = document.getElementById('ansmarked');
    const notVisitedEl = document.getElementById('notvisited');

    this.sectionTabsContainer.querySelectorAll('.secgen').forEach(tab => {
      const secIdx = parseInt(tab.dataset.secIdx, 10);
      const sec = this.testData.sections[secIdx];

      tab.addEventListener('click', () => {
        // In strict sectional-timed exams (Banking Prelims/Mains), section tabs are locked;
        // candidate advances only via Next Section (#b4) or timer expiry.
        if (isStrictSectionLock) {
          return;
        }
        if (this.completedSections.has(secIdx)) {
          return;
        }
        if (secIdx !== this.currentSectionIndex) {
          this.switchSection(secIdx, false);
        }
      });

      tab.addEventListener('mouseenter', () => {
        if (!hoverCon || !sec) return;
        let ansCount = 0, notAnsCount = 0, markedCount = 0, ansMarkedCount = 0, notVisitedCount = 0;
        sec.questions.forEach(q => {
          const st = this.userResponses[q.id]?.status;
          if (st === 'stic-answered') ansCount++;
          else if (st === 'stic-notanswered') notAnsCount++;
          else if (st === 'stic-marked') markedCount++;
          else if (st === 'stic-answered-marked') ansMarkedCount++;
          else notVisitedCount++;
        });

        if (hoverChild) hoverChild.textContent = sec.title;
        if (ansEl) ansEl.textContent = ansCount;
        if (unansEl) unansEl.textContent = notAnsCount;
        if (markedEl) markedEl.textContent = markedCount;
        if (ansMarkedEl) ansMarkedEl.textContent = ansMarkedCount;
        if (notVisitedEl) notVisitedEl.textContent = notVisitedCount;

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

  switchSection(sectionIndex, resetSectionTimer = true) {
    if (this.completedSections.has(sectionIndex)) return;
    this.currentSectionIndex = sectionIndex;
    this.currentQuestionIndex = 0;

    const sec = this.testData.sections[sectionIndex];
    if (resetSectionTimer && this.testData.hasSectionalTiming !== false) {
      this.sectionRemainingSeconds = (sec && sec.durationSeconds) ? sec.durationSeconds : 1200;
      this.startTimer();
    } else {
      this.updateTimerDisplay();
    }

    this.renderSectionTabs();
    this.loadQuestion(sectionIndex, 0);
  }

  /**
   * Load Question (displayQuestions(ko) in oliveboard_live_player.html lines 621-704)
   * - Restores question view if any utility pane (#b1/#b2/#b3) was open
   * - Restores draftSelectedIndex (DOM radio state) for this question without changing committed selectedIndex
   * - Updates #qno-disp, #sec-other, #b4 ('Next Section' vs 'Submit')
   * - Renders Variant 2 (.two-sided-wrapper) when question has passage/directions, or Variant 1 (.question-outer-div) when standalone
   */
  loadQuestion(sectionIndex, questionIndex) {
    this._recordCurrentQuestionTime();
    this.currentQuestionEntryTime = Date.now();

    // Ensure main question pane is visible if user clicked palette from Question Paper / Instructions / Profile view
    this.getAllBack();

    const section = this.testData.sections[sectionIndex];
    if (!section) return;
    const question = section.questions[questionIndex];
    if (!question) return;

    this.currentSectionIndex = sectionIndex;
    this.currentQuestionIndex = questionIndex;

    const response = this.userResponses[question.id];
    if (response && response.status === 'stic-notvisited') {
      response.status = 'stic-notanswered';
    }

    // Restore DOM radio selection (draftSelectedIndex if touched, else committed selectedIndex)
    this.pendingSelectedIndex = response
      ? (response.draftSelectedIndex !== undefined && response.draftSelectedIndex !== null
          ? response.draftSelectedIndex
          : response.selectedIndex)
      : null;

    // Update Question Number (#qno-disp) & Palette Section Header (#sec-other)
    const displayNum = question.localIndex || (questionIndex + 1);
    if (this.qnoDispEl) this.qnoDispEl.textContent = displayNum;
    if (this.qNumLabelEl) this.qNumLabelEl.textContent = displayNum;
    if (this.secOtherEl) this.secOtherEl.textContent = section.title;

    // Dynamic Oliveboard #b4 Button Label ('Next Section' vs 'Submit')
    if (this.b4El) {
      if (this.currentSectionIndex < this.testData.sections.length - 1) {
        this.b4El.textContent = 'Next Section';
      } else {
        this.b4El.textContent = 'Submit';
      }
    }

    // Update Bookmark Button State
    this.updateBookmarkButtonState(question.id);

    // Update Marks Strip from 2026 official marking scheme
    if (this.marksInfoEl) {
      const posMarks = question.marksForCorrect !== undefined
        ? question.marksForCorrect
        : (section.positiveMarks !== undefined ? section.positiveMarks : 1);
      const negMarks = question.negativeMarks !== undefined
        ? question.negativeMarks
        : (section.negativeMarks !== undefined ? section.negativeMarks : 0.25);
      this.marksInfoEl.innerHTML = `Marks for correct answer: <strong class="pos">+${posMarks}</strong> | Negative mark: <strong class="neg">-${negMarks}</strong>`;
    }

    const rawPassage = question.passageHTML || question.passage_text || '';
    const rawQuestion = question.questionHTML || question.question_text || '';

    const hasPassage = Boolean(
      (question.hasPassage && rawPassage && rawPassage.trim().length > 10) ||
      (rawPassage && rawPassage.trim().length > 25)
    );

    const formattedPassage = this._formatContentHTML(rawPassage);
    const formattedQuestion = this._formatContentHTML(rawQuestion);

    const imgs = question.imageUrls || question.image_urls || [];
    let imageHtml = '';
    if (imgs.length > 0 && !rawQuestion.includes('<img')) {
      imageHtml = imgs.map(url => {
        const cleanUrl = url.replace(/^[a-zA-Z]:\\.*\\images\\/i, '/images/').replace(/\\/g, '/');
        return `<img src="${cleanUrl}" style="max-width: 100%; border: 1px solid #ccc; margin: 8px 0; display: block;" onerror="this.style.display='none'">`;
      }).join('');
    }

    if (hasPassage) {
      // Variant 2: 2-Sided Split-Pane Window (.two-sided-wrapper - Spec 3.3)
      if (this.twoSidedWrapper) this.twoSidedWrapper.style.display = 'block';
      if (this.singleWrapper) this.singleWrapper.style.display = 'none';

      if (this.passagePanel) {
        this.passagePanel.innerHTML = formattedPassage;
      }
      if (this.questionText2SidedEl) {
        this.questionText2SidedEl.style.display = 'block';
        this.questionText2SidedEl.innerHTML = (imageHtml ? imageHtml : '') + formattedQuestion;
      }
      if (this.optionsTable2Sided) {
        this.optionsTable2Sided.innerHTML = this._generateOptionsHTML(question, this.pendingSelectedIndex);
        this._bindOptionEvents(this.optionsTable2Sided, question.id);
      }
    } else {
      // Variant 1: Single-Column Layout (.question-outer-div - Spec 3.3)
      if (this.twoSidedWrapper) this.twoSidedWrapper.style.display = 'none';
      if (this.singleWrapper) this.singleWrapper.style.display = 'block';

      if (this.questionImageEl) {
        if (imageHtml) {
          this.questionImageEl.style.display = 'block';
          this.questionImageEl.innerHTML = imageHtml;
        } else {
          this.questionImageEl.style.display = 'none';
          this.questionImageEl.innerHTML = '';
        }
      }
      if (this.questionTextEl) {
        this.questionTextEl.innerHTML = formattedQuestion;
      }
      if (this.optionsContainer) {
        this.optionsContainer.innerHTML = this._generateOptionsHTML(question, this.pendingSelectedIndex);
        this._bindOptionEvents(this.optionsContainer, question.id);
      }
    }

    if (this.leftPane) this.leftPane.scrollTop = 0;
    if (this.rightPane) this.rightPane.scrollTop = 0;
    if (this.singleWrapper) this.singleWrapper.scrollTop = 0;

    if (this.modalOverlay) {
      this.modalOverlay.querySelectorAll('#question-inner-pane img').forEach(img => {
        img.onerror = () => { img.style.display = 'none'; };
      });
    }

    // Apply current language filter if Hindi is active
    if (this.currentLang) {
      this.setLanguage(this.currentLang);
    }

    // Re-render Palette & Legend Summary and auto-scroll active question into view
    this.renderPalette();
    this.renderSectionTabs();
  }

  _formatContentHTML(html) {
    if (!html) return '';
    let formatted = String(html).trim();
    formatted = formatted.replace(/src=["']oliveimg\/([^"']+)["']/g, 'src="/oliveimg/$1"');
    formatted = formatted.replace(/src=["'](?:\.\/)?images\/([^"']+)["']/g, 'src="/images/$1"');
    if (!/<(?:p|table|div|ol|ul|h[1-6]|tbody|blockquote)/i.test(formatted)) {
      formatted = `<p>${formatted}</p>`;
    }
    return formatted;
  }

  _generateOptionsHTML(question, selectedIndex) {
    if (!question.options) return '';

    let optionsList = [];
    if (Array.isArray(question.options)) {
      optionsList = question.options;
    } else if (typeof question.options === 'object') {
      const keys = Object.keys(question.options).sort();
      optionsList = keys.map(k => ({
        letter: k,
        text: question.options[k],
        html: question.options[k]
      }));
    }

    if (!optionsList.length) return '';

    return `
      <tbody>
        ${optionsList.map((opt, idx) => {
          const isSelected = selectedIndex === idx;
          const letterStr = (opt.letter || String.fromCharCode(65 + idx)).toLowerCase();
          let optHTML = opt.html !== undefined ? opt.html : (opt.text || '');

          if (typeof optHTML === 'string') {
            optHTML = optHTML.replace(/src=["']oliveimg\/([^"']+)["']/g, 'src="/oliveimg/$1"');
          }

          return `
            <tr class="vtop ${isSelected ? 'selected' : ''}" data-opt-idx="${idx}">
              <td style="width: 25px;">
                <input type="radio" name="opt_choice_${question.id}" value="${idx}" id="radio_${question.id}_${idx}" ${isSelected ? 'checked' : ''} style="cursor: pointer;">
              </td>
              <td style="width: 25px;">
                <span class="optcl">${letterStr}) </span>
              </td>
              <td>
                <span class="optcl lpad opn${question.id}">${optHTML}</span>
              </td>
            </tr>
          `;
        }).join('')}
      </tbody>
    `;
  }

  /**
   * Bind option click events WITHOUT e.preventDefault() so native radio inputs and label spans
   * trigger clearme(optionNo) cleanly on the first click and deselect on the second click.
   */
  _bindOptionEvents(container, questionId) {
    container.querySelectorAll('tr.vtop').forEach(row => {
      row.addEventListener('click', () => {
        const optIdx = parseInt(row.dataset.optIdx, 10);
        this.toggleOrSelectOption(questionId, optIdx);
      });
    });
  }

  /**
   * Authentic Oliveboard Radio Option Click & Deselect (clearme(optionNo) in oliveboard_live_player.html lines 1099-1125):
   * - Clicking an unselected option sets pendingSelectedIndex = optionIndex and draftSelectedIndex = optionIndex
   *   (does NOT mark question Answered until Save & Next or Mark for Review & Next is clicked).
   * - Clicking an ALREADY-SELECTED option deselects the radio (pendingSelectedIndex = null, draftSelectedIndex = null),
   *   and if the question was previously Answered, Marked, or Answered & Marked, immediately reverts status to stic-notanswered
   *   and updates the palette and legend counters!
   */
  toggleOrSelectOption(questionId, optionIndex) {
    const response = this.userResponses[questionId];
    if (!response) return;

    if (this.pendingSelectedIndex === optionIndex) {
      // Deselect already-chosen option (clearme behavior in oliveboard_live_player.html lines 1106-1118)
      this.pendingSelectedIndex = null;
      response.draftSelectedIndex = null;
      response.selectedIndex = null;
      if (
        response.status === 'stic-answered' ||
        response.status === 'stic-marked' ||
        response.status === 'stic-answered-marked'
      ) {
        response.status = 'stic-notanswered';
      }
      this.renderPalette();
      this.renderSectionTabs();
    } else {
      this.pendingSelectedIndex = optionIndex;
      response.draftSelectedIndex = optionIndex;
    }

    // Synchronize radio buttons & row highlight in DOM
    [this.optionsContainer, this.optionsTable2Sided].forEach(container => {
      if (!container) return;
      container.querySelectorAll('tr.vtop').forEach((row, idx) => {
        const radio = row.querySelector('input[type="radio"]');
        if (idx === this.pendingSelectedIndex) {
          row.classList.add('selected');
          if (radio) radio.checked = true;
        } else {
          row.classList.remove('selected');
          if (radio) radio.checked = false;
        }
      });
    });
  }

  /**
   * Save & Next (displayQuestionsSave in oliveboard_live_player.html lines 799-879):
   * - Commits pendingSelectedIndex to response.selectedIndex
   * - Sets stic-answered if option selected, else stic-notanswered
   * - Advances to next question in current section; on the last question of a section, automatically opens Next Section / Submit prompt
   */
  displayQuestionsSave() {
    const section = this.testData.sections[this.currentSectionIndex];
    const question = section.questions[this.currentQuestionIndex];
    const response = this.userResponses[question.id];

    response.selectedIndex = this.pendingSelectedIndex;
    response.draftSelectedIndex = this.pendingSelectedIndex;
    if (response.selectedIndex !== null && response.selectedIndex !== undefined) {
      response.status = 'stic-answered';
    } else {
      response.status = 'stic-notanswered';
    }

    this.renderPalette();
    this.renderSectionTabs();

    if (this.currentQuestionIndex + 1 < section.questions.length) {
      this.loadQuestion(this.currentSectionIndex, this.currentQuestionIndex + 1);
    } else {
      // Last question of the current section: advance or prompt Next Section / Submit
      this._handleEndOfSectionNavigation();
    }
  }

  /**
   * Mark for Review & Next (displayQuestionsMark in oliveboard_live_player.html lines 705-797):
   * - Commits pendingSelectedIndex to response.selectedIndex
   * - Sets stic-answered-marked if option selected, else stic-marked
   * - Advances to next question in current section; on the last question of a section, automatically opens Next Section / Submit prompt
   */
  displayQuestionsMark() {
    const section = this.testData.sections[this.currentSectionIndex];
    const question = section.questions[this.currentQuestionIndex];
    const response = this.userResponses[question.id];

    response.selectedIndex = this.pendingSelectedIndex;
    response.draftSelectedIndex = this.pendingSelectedIndex;
    if (response.selectedIndex !== null && response.selectedIndex !== undefined) {
      response.status = 'stic-answered-marked';
    } else {
      response.status = 'stic-marked';
    }

    this.renderPalette();
    this.renderSectionTabs();

    if (this.currentQuestionIndex + 1 < section.questions.length) {
      this.loadQuestion(this.currentSectionIndex, this.currentQuestionIndex + 1);
    } else {
      // Last question of the current section: advance or prompt Next Section / Submit
      this._handleEndOfSectionNavigation();
    }
  }

  /**
   * Handle navigation when clicking Save & Next or Mark for Review & Next on the last question of a section
   */
  _handleEndOfSectionNavigation() {
    const isLastSection = this.currentSectionIndex >= this.testData.sections.length - 1;
    if (!isLastSection) {
      if (this.testData.hasSectionalTiming === false && this.testData.isSectionalLocked === false) {
        // Composite timer: smoothly advance directly to Question 1 of the next section
        this.switchSection(this.currentSectionIndex + 1, false);
      } else {
        // Sectional-locked exam: open Next Section confirmation summary
        this.targetSectionIndexForAdvance = this.currentSectionIndex + 1;
        this.finalSubmit(true);
      }
    } else {
      // Last question of the final section: open Exam Submit confirmation summary
      this.finalSubmit(false);
    }
  }

  /**
   * Clear Response (clearOption in oliveboard_live_player.html lines 1127-1150)
   */
  clearOption() {
    const section = this.testData.sections[this.currentSectionIndex];
    const question = section.questions[this.currentQuestionIndex];
    const response = this.userResponses[question.id];

    this.pendingSelectedIndex = null;
    response.draftSelectedIndex = null;
    response.selectedIndex = null;
    response.status = 'stic-notanswered';

    [this.optionsContainer, this.optionsTable2Sided].forEach(container => {
      if (!container) return;
      container.querySelectorAll('tr.vtop').forEach(row => {
        row.classList.remove('selected');
        const radio = row.querySelector('input[type="radio"]');
        if (radio) radio.checked = false;
      });
    });

    this.renderPalette();
    this.renderSectionTabs();
  }

  /**
   * In-Pane Utility View #b1: getQuestionPaper() (oliveboard_live_player.html lines 281-320 & 900-917)
   */
  getQuestionPaper() {
    if (this.b1El) { this.b1El.style.backgroundColor = '#2F72B7'; this.b1El.style.color = '#FFF'; }
    if (this.b2El) { this.b2El.style.backgroundColor = '#C7DCF0'; this.b2El.style.color = '#000'; }
    if (this.b3El) { this.b3El.style.backgroundColor = '#C7DCF0'; this.b3El.style.color = '#000'; }

    if (this.questionInnerPane) this.questionInnerPane.style.display = 'none';
    if (this.buttonHolder) this.buttonHolder.style.display = 'none';
    if (this.questionNoBar) this.questionNoBar.style.display = 'none';
    if (this.instructionsOnButton) this.instructionsOnButton.style.display = 'none';
    if (this.candidateDetailsOnButton) this.candidateDetailsOnButton.style.display = 'none';

    const curSec = this.testData.sections[this.currentSectionIndex];
    if (this.questionListOnButton && curSec) {
      let lastPassageSnippet = '';
      const itemsHtml = curSec.questions.map((q, idx) => {
        const qNum = q.localIndex || (idx + 1);
        const qText = this._formatContentHTML(q.questionHTML || q.question_text || '');
        const rawPass = (q.passageHTML || q.passage_text || '').trim();
        let passageHeader = '';
        if (rawPass.length > 25) {
          const snippetKey = rawPass.slice(0, 120);
          if (snippetKey !== lastPassageSnippet) {
            lastPassageSnippet = snippetKey;
            passageHeader = `<div style="background: #f8fafc; border-left: 3px solid #3476BB; padding: 8px 12px; margin: 10px 0 6px 0; font-size: 13px;">${this._formatContentHTML(rawPass)}</div>`;
          }
        } else {
          lastPassageSnippet = '';
        }

        return `
          ${passageHeader}
          <div class="qlist-item" data-q-idx="${idx}" style="cursor: pointer; padding: 6px 4px;" title="Click to jump to Question ${qNum}">
            Qno ${qNum}) <span class="qlistl">${qText}</span>
          </div>
          <hr>
        `;
      }).join('');
      this.questionListOnButton.innerHTML = `<center><b><h4>${curSec.title} — Question Paper</h4></b></center><br><hr>${itemsHtml}`;
      this.questionListOnButton.querySelectorAll('.qlist-item').forEach(item => {
        item.onclick = () => {
          const qIdx = parseInt(item.dataset.qIdx, 10);
          this.getAllBack();
          this.loadQuestion(this.currentSectionIndex, qIdx);
        };
      });
      this.questionListOnButton.style.display = 'block';
      this.setLanguage(this.currentLang);
    }
    if (this.mainBackButton) this.mainBackButton.style.display = 'flex';
  }

  /**
   * In-Pane Utility View #b2: getInstructions() (oliveboard_live_player.html lines 881-898)
   */
  getInstructions() {
    if (this.b2El) { this.b2El.style.backgroundColor = '#2F72B7'; this.b2El.style.color = '#FFF'; }
    if (this.b1El) { this.b1El.style.backgroundColor = '#C7DCF0'; this.b1El.style.color = '#000'; }
    if (this.b3El) { this.b3El.style.backgroundColor = '#C7DCF0'; this.b3El.style.color = '#000'; }

    if (this.questionInnerPane) this.questionInnerPane.style.display = 'none';
    if (this.buttonHolder) this.buttonHolder.style.display = 'none';
    if (this.questionNoBar) this.questionNoBar.style.display = 'none';
    if (this.questionListOnButton) this.questionListOnButton.style.display = 'none';
    if (this.candidateDetailsOnButton) this.candidateDetailsOnButton.style.display = 'none';

    const innerInstr = document.getElementById('instructions-inner-content');
    if (this.instructionsOnButton && innerInstr) {
      this.instructionsOnButton.innerHTML = innerInstr.innerHTML;
      this.instructionsOnButton.style.display = 'block';
      this.setLanguage(this.currentLang);
    }
    if (this.mainBackButton) this.mainBackButton.style.display = 'flex';
  }

  /**
   * In-Pane Utility View #b3: getCandProfile() (oliveboard_live_player.html lines 919-936)
   */
  getCandProfile() {
    if (this.b3El) { this.b3El.style.backgroundColor = '#2F72B7'; this.b3El.style.color = '#FFF'; }
    if (this.b1El) { this.b1El.style.backgroundColor = '#C7DCF0'; this.b1El.style.color = '#000'; }
    if (this.b2El) { this.b2El.style.backgroundColor = '#C7DCF0'; this.b2El.style.color = '#000'; }

    if (this.questionInnerPane) this.questionInnerPane.style.display = 'none';
    if (this.buttonHolder) this.buttonHolder.style.display = 'none';
    if (this.questionNoBar) this.questionNoBar.style.display = 'none';
    if (this.instructionsOnButton) this.instructionsOnButton.style.display = 'none';
    if (this.questionListOnButton) this.questionListOnButton.style.display = 'none';

    const user = window.obDataManager ? window.obDataManager.getActiveUser() : null;
    const uidEl = document.getElementById('giant-cand-userid');
    const nameEl = document.getElementById('giant-cand-name');
    const rollEl = document.getElementById('giant-cand-roll');
    const examEl = document.getElementById('giant-cand-exam');
    if (uidEl) uidEl.textContent = `: ${user ? user.id : 'OB-USER-01'}`;
    if (nameEl) nameEl.textContent = `: ${user ? user.name : 'Aspirant Rahul Sharma'}`;
    if (rollEl) rollEl.textContent = `: ${user ? (user.roll_no || 'OB-2026-9041') : 'OB-2026-9041'}`;
    if (examEl) examEl.textContent = `: ${this.testData.title}`;

    if (this.candidateDetailsOnButton) this.candidateDetailsOnButton.style.display = 'block';
    if (this.mainBackButton) this.mainBackButton.style.display = 'flex';
  }

  /**
   * In-Pane Back Button: getAllBack() (oliveboard_live_player.html lines 938-956)
   */
  getAllBack() {
    if (this.b1El) { this.b1El.style.backgroundColor = '#C7DCF0'; this.b1El.style.color = '#000'; }
    if (this.b2El) { this.b2El.style.backgroundColor = '#C7DCF0'; this.b2El.style.color = '#000'; }
    if (this.b3El) { this.b3El.style.backgroundColor = '#C7DCF0'; this.b3El.style.color = '#000'; }

    if (this.instructionsOnButton) this.instructionsOnButton.style.display = 'none';
    if (this.questionListOnButton) this.questionListOnButton.style.display = 'none';
    if (this.candidateDetailsOnButton) this.candidateDetailsOnButton.style.display = 'none';
    if (this.mainBackButton) this.mainBackButton.style.display = 'none';

    if (this.questionInnerPane) this.questionInnerPane.style.display = 'block';
    if (this.buttonHolder) this.buttonHolder.style.display = 'flex';
    if (this.questionNoBar) this.questionNoBar.style.display = 'flex';
  }

  /**
   * Toggle Question Bookmark state
   */
  toggleQuestionBookmark() {
    const section = this.testData.sections[this.currentSectionIndex];
    if (!section) return;
    const question = section.questions[this.currentQuestionIndex];
    if (!question) return;

    if (window.obDataManager && typeof window.obDataManager.toggleBookmark === 'function') {
      const nowSaved = window.obDataManager.toggleBookmark(question, this.testData, section.title);
      if (nowSaved) {
        this.bookmarkedQuestions[question.id] = true;
        const autoSubj = window.obDataManager.normalizeSubjectCategory(section.title, this.testData?.title || '', '');
        if (window.appController && typeof window.appController.showToast === 'function') {
          window.appController.showToast(`★ Bookmarked under ${autoSubj}`, 'success');
        }
      } else {
        delete this.bookmarkedQuestions[question.id];
        if (window.appController && typeof window.appController.showToast === 'function') {
          window.appController.showToast('Removed question from Bookmarks', 'info');
        }
      }
    } else {
      if (this.bookmarkedQuestions[question.id]) {
        delete this.bookmarkedQuestions[question.id];
      } else {
        this.bookmarkedQuestions[question.id] = true;
      }
    }

    this.updateBookmarkButtonState(question.id);
    this.renderPalette();
  }

  updateBookmarkButtonState(questionId) {
    if (!this.btnBookmarkToggle) return;
    const isBookmarked = !!this.bookmarkedQuestions[questionId];
    if (isBookmarked) {
      this.btnBookmarkToggle.classList.add('bookmarked');
      this.btnBookmarkToggle.innerHTML = '★ Bookmarked';
    } else {
      this.btnBookmarkToggle.classList.remove('bookmarked');
      this.btnBookmarkToggle.innerHTML = '★ Bookmark';
    }
  }

  /**
   * Render Oliveboard's signature 4-column palette of sprite buttons (Spec 3.5)
   * Includes auto-scrolling so the active question is always visible in #question-main-pallette
   */
  renderPalette() {
    if (!this.paletteGridEl) {
      this.paletteGridEl = document.getElementById('palette-numbers-grid');
    }
    if (!this.paletteGridEl) return;

    const section = this.testData.sections && this.testData.sections[this.currentSectionIndex];
    if (!section || !section.questions) return;
    const questions = section.questions;

    let tableHTML = '<tbody>';
    for (let i = 0; i < questions.length; i += 4) {
      tableHTML += '<tr>';
      for (let j = 0; j < 4; j++) {
        const qIdx = i + j;
        if (qIdx < questions.length) {
          const q = questions[qIdx];
          const response = this.userResponses[q.id];
          const statusClass = response ? response.status : 'stic-notvisited';
          const isCurrent = qIdx === this.currentQuestionIndex;
          const isBookmarked = !!this.bookmarkedQuestions[q.id];
          const displayNum = q.localIndex || (qIdx + 1);

          tableHTML += `
            <td>
              <a class="sprite-butts ${statusClass} ${isCurrent ? 'current' : ''} ${isBookmarked ? 'bookmarked' : ''}" 
                 id="pal-${q.id}"
                 data-q-idx="${qIdx}" 
                 title="Question ${displayNum}${isBookmarked ? ' (Bookmarked)' : ''}">
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

    this.paletteGridEl.innerHTML = tableHTML;

    // Attach click handlers (displayQuestions(ko) - does NOT commit draftSelectedIndex)
    this.paletteGridEl.querySelectorAll('.sprite-butts').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const qIdx = parseInt(btn.dataset.qIdx, 10);
        this.loadQuestion(this.currentSectionIndex, qIdx);
      });
    });

    // Auto-scroll active question sprite button into view inside #question-main-pallette
    const activeBtn = this.paletteGridEl.querySelector('.sprite-butts.current');
    if (activeBtn && typeof activeBtn.scrollIntoView === 'function') {
      activeBtn.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }

    this._updateLegendCounts();
  }

  /**
   * Update Legend Summary Counts for the current section (#stic-answered, #stic-notanswered, #stic-marked, #stic-notvisited, #stic-answered-marked - Spec 3.5)
   */
  _updateLegendCounts() {
    const counts = {
      answered: 0,
      notAnswered: 0,
      notVisited: 0,
      marked: 0,
      answeredMarked: 0
    };

    const currentSec = this.testData.sections && this.testData.sections[this.currentSectionIndex];
    const targetSections = currentSec ? [currentSec] : this.testData.sections;

    targetSections.forEach(sec => {
      sec.questions.forEach(q => {
        const r = this.userResponses[q.id];
        if (!r) return;
        switch (r.status) {
          case 'stic-answered': counts.answered++; break;
          case 'stic-notanswered': counts.notAnswered++; break;
          case 'stic-notvisited': counts.notVisited++; break;
          case 'stic-marked': counts.marked++; break;
          case 'stic-answered-marked': counts.answeredMarked++; break;
        }
      });
    });

    const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    setVal('stic-answered', counts.answered);
    setVal('stic-notanswered', counts.notAnswered);
    setVal('stic-notvisited', counts.notVisited);
    setVal('stic-marked', counts.marked);
    setVal('stic-answered-marked', counts.answeredMarked);
  }

  /**
   * In-Exam Submit / Next Section Summary Screen (finalSubmit() in oliveboard_live_player.html lines 958-1002 & Spec 4.2)
   * Hides #left-container-post & #right-container-post, shows #left-container (with #submit-pane & #sure) + #right-container
   */
  finalSubmit(forceSectionAdvance = false) {
    this._recordCurrentQuestionTime();
    this.isConfirmPaneOpen = true;
    const isLastSection = this.currentSectionIndex >= this.testData.sections.length - 1;
    this.isSectionAdvanceConfirm = forceSectionAdvance && !isLastSection;

    if (this.leftContainerPost) this.leftContainerPost.style.display = 'none';
    if (this.rightContainerPost) this.rightContainerPost.style.display = 'none';
    const btnExpand = document.getElementById('btn-expand-sidebar');
    if (btnExpand) btnExpand.style.display = 'none';

    if (this.leftContainerPre) this.leftContainerPre.style.display = 'block';
    if (this.rightContainerPre) this.rightContainerPre.style.display = 'block';
    if (this.instructionPane) this.instructionPane.style.display = 'none';
    if (this.instrFooterBar) this.instrFooterBar.style.display = 'none';
    if (this.plsWaitBox) this.plsWaitBox.style.display = 'none';

    // Populate #f-tbody summary rows
    let tbodyHTML = '';
    let totQs = 0, totAns = 0, totNotAns = 0, totMarked = 0, totNotVis = 0;

    this.testData.sections.forEach((sec, idx) => {
      let secAns = 0, secNotAns = 0, secMarked = 0, secNotVis = 0;
      sec.questions.forEach(q => {
        const r = this.userResponses[q.id];
        if (!r) return;
        if (r.status === 'stic-answered' || r.status === 'stic-answered-marked') secAns++;
        else if (r.status === 'stic-notanswered') secNotAns++;
        else if (r.status === 'stic-marked') secMarked++;
        else secNotVis++;
      });

      totQs += sec.questions.length;
      totAns += secAns;
      totNotAns += secNotAns;
      totMarked += secMarked;
      totNotVis += secNotVis;

      const isCurrentSec = idx === this.currentSectionIndex;
      tbodyHTML += `
        <tr style="${isCurrentSec ? 'background: #f0f7ff; font-weight: bold;' : ''}">
          <td>${sec.title}</td>
          <td>${sec.questions.length}</td>
          <td>${secAns}</td>
          <td>${secNotAns}</td>
          <td>${secMarked}</td>
          <td>${secNotVis}</td>
        </tr>
      `;
    });

    tbodyHTML += `
      <tr style="background: #E4EDF7; font-weight: bold;">
        <td>Total</td>
        <td>${totQs}</td>
        <td>${totAns}</td>
        <td>${totNotAns}</td>
        <td>${totMarked}</td>
        <td>${totNotVis}</td>
      </tr>
    `;

    if (this.fTbody) this.fTbody.innerHTML = tbodyHTML;

    // Check if current question has an uncommitted radio selection (strict TCS iON rule)
    const curSecObj = this.testData.sections[this.currentSectionIndex];
    const curQObj = curSecObj && curSecObj.questions ? curSecObj.questions[this.currentQuestionIndex] : null;
    const curResp = curQObj ? this.userResponses[curQObj.id] : null;
    const hasUncommittedSelection = Boolean(
      curResp &&
      this.pendingSelectedIndex !== null &&
      this.pendingSelectedIndex !== undefined &&
      this.pendingSelectedIndex !== curResp.selectedIndex
    );
    const uncommittedNote = hasUncommittedSelection
      ? `⚠️ Unsaved Selection on Q.${this.currentQuestionIndex + 1}: You selected an option without clicking "Save & Next". Per TCS iON rules, it will NOT be counted unless you go back and click "Save & Next".`
      : '';

    if (this.isSectionAdvanceConfirm) {
      const curSec = this.testData.sections[this.currentSectionIndex];
      const nextSec = this.testData.sections[this.targetSectionIndexForAdvance !== undefined ? this.targetSectionIndexForAdvance : (this.currentSectionIndex + 1)];
      if (this.submitPaneHeading) this.submitPaneHeading.textContent = `Section Summary — ${curSec ? curSec.title : 'Current Section'}`;
      if (this.sureWarningText) this.sureWarningText.textContent = `Are you sure you want to submit "${curSec ? curSec.title : 'this section'}" and move to "${nextSec ? nextSec.title : 'Next Section'}"?`;
      if (this.sureSectionLockNote) {
        this.sureSectionLockNote.style.display = 'block';
        const lockMsg = `Note: Once you proceed to the next section, you cannot return to "${curSec ? curSec.title : 'this section'}".`;
        this.sureSectionLockNote.textContent = uncommittedNote ? `${uncommittedNote} | ${lockMsg}` : lockMsg;
      }
      if (this.sSubmitSpan) this.sSubmitSpan.textContent = 'Submit Section';
    } else {
      if (this.submitPaneHeading) this.submitPaneHeading.textContent = 'Exam Summary';
      if (this.sureWarningText) this.sureWarningText.textContent = 'Are you sure you want to submit the exam?';
      if (this.sureSectionLockNote) {
        if (uncommittedNote) {
          this.sureSectionLockNote.style.display = 'block';
          this.sureSectionLockNote.textContent = uncommittedNote;
        } else {
          this.sureSectionLockNote.style.display = 'none';
        }
      }
      if (this.sSubmitSpan) this.sSubmitSpan.textContent = 'Submit';
    }

    if (this.submitPane) this.submitPane.style.display = 'block';
    if (this.sureBox) this.sureBox.style.display = 'block';
  }

  /**
   * Return from Submit Summary to Active Question Pane (sBack() in oliveboard_live_player.html lines 1004-1012)
   */
  sBack() {
    this.isConfirmPaneOpen = false;
    if (this.sendDataTimeoutId) {
      clearTimeout(this.sendDataTimeoutId);
      this.sendDataTimeoutId = null;
    }
    this.targetSectionIndexForAdvance = undefined;
    this.currentQuestionEntryTime = Date.now();
    if (this.leftContainerPre) this.leftContainerPre.style.display = 'none';
    if (this.rightContainerPre) this.rightContainerPre.style.display = 'none';
    if (this.submitPane) this.submitPane.style.display = 'none';
    if (this.sureBox) this.sureBox.style.display = 'none';
    if (this.plsWaitBox) this.plsWaitBox.style.display = 'none';

    if (this.leftContainerPost) this.leftContainerPost.style.display = 'block';
    if (this.rightContainerPost) this.rightContainerPost.style.display = 'block';
    if (this.isPaletteCollapsed) {
      const btnExpand = document.getElementById('btn-expand-sidebar');
      if (btnExpand) btnExpand.style.display = 'flex';
    }
  }

  /**
   * Confirm Section Advance or Final Exam Submit (sendData() in oliveboard_live_player.html lines 1014-1097)
   */
  sendData() {
    if (!this.isExamActive || this.sendDataTimeoutId) return;
    if (this.sureBox) this.sureBox.style.display = 'none';
    if (this.plsWaitBox) this.plsWaitBox.style.display = 'block';

    this.sendDataTimeoutId = setTimeout(() => {
      this.sendDataTimeoutId = null;
      if (!this.isExamActive) return;
      if (this.plsWaitBox) this.plsWaitBox.style.display = 'none';
      if (this.isSectionAdvanceConfirm) {
        // Strict TCS iON rule: clear uncommitted draft on the section being exited
        const curSec = this.testData.sections && this.testData.sections[this.currentSectionIndex];
        if (curSec && Array.isArray(curSec.questions)) {
          curSec.questions.forEach(q => {
            const r = this.userResponses[q.id];
            if (r) r.draftSelectedIndex = r.selectedIndex;
          });
        }
        this.pendingSelectedIndex = null;

        if (this.testData.isSectionalLocked !== false) {
          this.completedSections.add(this.currentSectionIndex);
        }
        const nextSecIdx = this.targetSectionIndexForAdvance !== undefined
          ? this.targetSectionIndexForAdvance
          : (this.currentSectionIndex + 1);
        this.targetSectionIndexForAdvance = undefined;
        this.sBack();
        if (nextSecIdx < this.testData.sections.length) {
          this.switchSection(nextSecIdx, true);
        } else {
          this.submitTest();
        }
      } else {
        this.isConfirmPaneOpen = false;
        this.submitTest();
      }
    }, 250);
  }

  async submitTest() {
    if (!this.isExamActive) return;
    this._recordCurrentQuestionTime();
    this.currentQuestionEntryTime = null;
    clearInterval(this.timerInterval);
    if (this.sendDataTimeoutId) {
      clearTimeout(this.sendDataTimeoutId);
      this.sendDataTimeoutId = null;
    }
    this.isExamActive = false;
    this.isConfirmPaneOpen = false;

    const endTime = Date.now();
    const summedQuestionSeconds = Object.values(this.userResponses || {}).reduce(
      (sum, r) => sum + (Number(r && r.timeSpentSeconds) || 0),
      0
    );
    const sessionWallSeconds = Math.max(1, Math.round((endTime - (this.startTime || endTime)) / 1000));
    const totalTimeSeconds = Math.max(1, summedQuestionSeconds > 0 ? summedQuestionSeconds : sessionWallSeconds);

    // Compute detailed scoring using 2026 official per-question / per-section marking scheme
    const allQuestions = [];
    this.testData.sections.forEach(sec => {
      sec.questions.forEach(q => {
        q.section = q.section || sec.title || 'General';
        q.correctIndex = this._getNormalizedCorrectIndex(q);
        if (q.marksForCorrect === undefined && sec.positiveMarks !== undefined) {
          q.marksForCorrect = sec.positiveMarks;
        }
        if (q.negativeMarks === undefined && sec.negativeMarks !== undefined) {
          q.negativeMarks = sec.negativeMarks;
        }
        allQuestions.push(q);
      });
    });

    let correct = 0, wrong = 0, unanswered = 0;
    let totalScore = 0;
    let computedMaxScore = 0;
    const solutionsHTML = [];
    const sectionBreakdown = {};

    allQuestions.forEach((q, idx) => {
      const response = this.userResponses[q.id];
      const selectedIdx = response ? response.selectedIndex : null;
      const isAttempted = selectedIdx !== null && selectedIdx !== undefined;
      const isCorrect = isAttempted && selectedIdx === q.correctIndex;

      const marksPos = q.marksForCorrect !== undefined ? q.marksForCorrect : (this.testData.marksPerCorrect || 1);
      const marksNeg = q.negativeMarks !== undefined ? q.negativeMarks : (this.testData.negativeMarks ?? 0.25);
      computedMaxScore += marksPos;

      const secName = q.section || 'General';
      if (!sectionBreakdown[secName]) {
        sectionBreakdown[secName] = { correct: 0, wrong: 0, unanswered: 0, score: 0, total: 0, maxMarks: 0, timeSpentSeconds: 0 };
      }
      sectionBreakdown[secName].total++;
      sectionBreakdown[secName].maxMarks += marksPos;
      sectionBreakdown[secName].timeSpentSeconds += (response && response.timeSpentSeconds ? response.timeSpentSeconds : 0);

      if (isAttempted) {
        if (isCorrect) {
          correct++;
          totalScore += marksPos;
          sectionBreakdown[secName].correct++;
          sectionBreakdown[secName].score += marksPos;
        } else {
          wrong++;
          totalScore -= marksNeg;
          sectionBreakdown[secName].wrong++;
          sectionBreakdown[secName].score -= marksNeg;
        }
      } else {
        unanswered++;
        sectionBreakdown[secName].unanswered++;
      }
    });

    const maxScore = this.testData.marks || Math.round(computedMaxScore) || 100;
    const accuracy = correct + wrong > 0 ? ((correct / (correct + wrong)) * 100).toFixed(1) : '0.0';
    const rankData = this._computeRankAndPercentile({
      testId: this.testData.id,
      testTitle: this.testData.title,
      testType: this.testData.type,
      score: totalScore,
      maxScore,
      correctCount: correct,
      wrongCount: wrong,
      unansweredCount: unanswered,
      totalQuestions: allQuestions.length,
      accuracy: parseFloat(accuracy),
      activeUsers: this.testData.activeUsers
    });
    const percentile = rankData.percentile.toFixed(1);
    const estimatedAIR = rankData.estimatedAIR;
    const totalCandidates = rankData.totalCandidates;

    const sectionBreakdownArr = Object.entries(sectionBreakdown).map(([name, data]) => ({
      sectionName: name,
      ...data,
      accuracy: data.correct + data.wrong > 0 ? ((data.correct / (data.correct + data.wrong)) * 100).toFixed(1) : '0'
    }));

    const resultObj = {
      testId: this.testData.id,
      testTitle: this.testData.title,
      totalQuestions: allQuestions.length,
      responses: { ...this.userResponses },
      score: {
        total: totalScore,
        correct,
        wrong,
        unanswered,
        netScore: totalScore,
        maxScore,
        accuracy: parseFloat(accuracy),
        percentile: parseFloat(percentile),
        estimatedAIR,
        totalCandidates
      },
      timing: {
        startedAt: new Date(this.startTime).toISOString(),
        completedAt: new Date(endTime).toISOString(),
        totalTimeSeconds,
        timePerQuestion: (totalTimeSeconds / Math.max(1, allQuestions.length)).toFixed(1)
      },
      sectionBreakdown: sectionBreakdownArr
    };

    let savedAttempt = null;
    if (window.obDataManager) {
      savedAttempt = await window.obDataManager.saveResult(resultObj);
    }

    const setEl = (id, val) => { const e = document.getElementById(id); if (e) e.textContent = val; };
    setEl('scorecard-test-title', this.testData.title);
    setEl('metric-score', `${totalScore.toFixed(2)} / ${maxScore}`);
    setEl('metric-percentile', `${percentile}%ile`);
    setEl('metric-accuracy', `${accuracy}%`);
    setEl('metric-rank', `#${estimatedAIR.toLocaleString()} / ${totalCandidates.toLocaleString()}`);
    setEl('metric-correct', correct);
    setEl('metric-wrong', wrong);
    setEl('metric-unanswered', unanswered);
    setEl('metric-time', this._formatTime(totalTimeSeconds));

    this._renderScorecardSectionalTable(sectionBreakdownArr, totalTimeSeconds);
    this._renderScorecardTopicBreakdown(sectionBreakdownArr, allQuestions);
    this._renderTopperComparisonModule(totalScore, maxScore, parseFloat(accuracy), totalTimeSeconds, allQuestions.length, sectionBreakdownArr, rankData);

    const breakdownEl = document.getElementById('scorecard-section-breakdown');
    if (breakdownEl) {
      breakdownEl.innerHTML = sectionBreakdownArr.map(sec => `
        <div style="display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; margin-bottom: 8px; font-size: 13px;">
          <div style="font-weight: bold; width: 140px;">${sec.sectionName}</div>
          <div>✅ ${sec.correct} | ❌ ${sec.wrong} | ⬜ ${sec.unanswered}</div>
          <div style="font-weight: bold; color: #1c4b79;">Score: ${sec.score.toFixed(2)}</div>
          <div style="font-weight: bold; color: #2e7d32;">Acc: ${sec.accuracy}%</div>
        </div>
      `).join('');
    }

    const solutionsContainer = document.getElementById('scorecard-solutions-list');
    if (solutionsContainer) {
      solutionsContainer.innerHTML = '';
    }

    if (this.modalOverlay) {
      this.modalOverlay.classList.remove('active');
    }

    const btnLaunchSol = document.getElementById('btn-scorecard-launch-solutions');
    if (btnLaunchSol) {
      btnLaunchSol.onclick = () => {
        if (this.scorecardOverlay) this.scorecardOverlay.classList.remove('active');
        if (window.openOliveboardSolutions) {
          window.openOliveboardSolutions(resultObj, this.testData);
        }
      };
    }

    // Refresh dashboard cards & analytics in the background
    if (window.appController && typeof window.appController.refreshAnalytics === 'function') {
      window.appController.refreshAnalytics();
    }

    // Launch Oliveboard Authentic Solution & Review Console immediately upon submission
    const resolvedAttemptId = (savedAttempt && (savedAttempt.attemptId || savedAttempt.id || savedAttempt.attempt_id)) || resultObj.attemptId;
    if (window.appController && window.appController.replaceNavState) {
      window.appController.replaceNavState(
        { view: 'solutions', testId: this.testData.id, attemptId: resolvedAttemptId },
        '#solutions/' + this.testData.id
      );
    }
    if (window.openOliveboardSolutions) {
      window.openOliveboardSolutions(resultObj, this.testData);
    } else if (this.scorecardOverlay) {
      this.scorecardOverlay.classList.add('active');
    }
  }

  _computeRankAndPercentile(params) {
    if (window.OB_EXAM_PATTERNS_2026 && typeof window.OB_EXAM_PATTERNS_2026.calculateTestRankAndPercentile === 'function') {
      return window.OB_EXAM_PATTERNS_2026.calculateTestRankAndPercentile(params);
    }
    const maxScore = Math.max(1, Number(params.maxScore) || 100);
    const score = Number(params.score) || 0;
    const totalCandidates = Number(params.activeUsers) || 24800;
    const pct = score <= 0 ? 2.1 : Math.min(99.9, Math.max(2.5, (score / maxScore) * 100));
    const air = Math.max(1, Math.min(totalCandidates, Math.round(totalCandidates * (1 - pct / 100))));
    return {
      percentile: Number(pct.toFixed(1)),
      estimatedAIR: air,
      totalCandidates,
      avgScore: Number((maxScore * 0.45).toFixed(2)),
      topperScore: Number((maxScore * 0.89).toFixed(2)),
      cutoffScore: Number((maxScore * 0.55).toFixed(2))
    };
  }

  showScorecardForAttempt(attempt, testData) {
    const setEl = (id, val) => { const e = document.getElementById(id); if (e) e.textContent = val; };
    const netScore = attempt.score !== undefined
      ? (typeof attempt.score === 'number' ? attempt.score : (attempt.score.netScore ?? attempt.score.total ?? 0))
      : 0;
    const maxScore = attempt.max_score || (attempt.score && attempt.score.maxScore) || (testData && testData.marks) || 100;
    const correctCount = attempt.correct_count ?? (attempt.score && attempt.score.correct) ?? 0;
    const wrongCount = attempt.wrong_count ?? (attempt.score && attempt.score.wrong) ?? 0;
    const unansweredCount = attempt.unanswered_count ?? (attempt.score && attempt.score.unanswered) ?? 0;
    const accuracy = attempt.accuracy !== undefined
      ? attempt.accuracy
      : (attempt.score && attempt.score.accuracy !== undefined ? attempt.score.accuracy : (correctCount + wrongCount > 0 ? ((correctCount / (correctCount + wrongCount)) * 100) : 0));
    const timeSpent = attempt.time_spent_seconds || (attempt.timing && attempt.timing.totalTimeSeconds) || 0;
    const totalQ = attempt.total_questions || attempt.totalQuestions || (testData && testData.questionsCount) || 100;

    const rankData = this._computeRankAndPercentile({
      testId: attempt.test_id || attempt.testId || (testData && testData.id),
      testTitle: attempt.test_title || attempt.testTitle || (testData && testData.title),
      testType: testData && testData.type,
      score: netScore,
      maxScore,
      correctCount,
      wrongCount,
      unansweredCount,
      totalQuestions: totalQ,
      accuracy: Number(accuracy),
      activeUsers: testData && testData.activeUsers
    });

    setEl('scorecard-test-title', attempt.test_title || attempt.testTitle || (testData && testData.title) || 'Mock Test');
    setEl('metric-score', `${Number(netScore).toFixed(2)} / ${maxScore}`);
    setEl('metric-percentile', `${Number(rankData.percentile).toFixed(1)}%ile`);
    setEl('metric-accuracy', `${Number(accuracy).toFixed(1)}%`);
    setEl('metric-rank', `#${rankData.estimatedAIR.toLocaleString()} / ${rankData.totalCandidates.toLocaleString()}`);
    setEl('metric-correct', correctCount);
    setEl('metric-wrong', wrongCount);
    setEl('metric-unanswered', unansweredCount);
    setEl('metric-time', this._formatTime(timeSpent));

    let breakdown = attempt.section_breakdown || attempt.sectionBreakdown || [];
    if (typeof breakdown === 'string') {
      try { breakdown = JSON.parse(breakdown); } catch (e) { breakdown = []; }
    }
    if ((!Array.isArray(breakdown) || breakdown.length === 0) && testData && Array.isArray(testData.sections)) {
      let respMap = attempt.responses || attempt.responses_json || {};
      if (typeof respMap === 'string') {
        try { respMap = JSON.parse(respMap); } catch (e) { respMap = {}; }
      }
      breakdown = testData.sections.map(sec => {
        const posMark = Number(sec.positiveMarks || testData.marksPerCorrect || 1);
        const negMark = Number(sec.negativeMarks !== undefined ? sec.negativeMarks : (testData.negativeMarks || 0.25));
        let sCorrect = 0, sWrong = 0, sUnans = 0, sTime = 0;
        (sec.questions || []).forEach(q => {
          const r = respMap[q.id];
          const corrIdx = this._getNormalizedCorrectIndex(q);
          if (r && r.timeSpentSeconds) sTime += r.timeSpentSeconds;
          if (!r || r.selectedIndex === null || r.selectedIndex === undefined) {
            sUnans++;
          } else if (Number(r.selectedIndex) === Number(corrIdx)) {
            sCorrect++;
          } else {
            sWrong++;
          }
        });
        const sScore = (sCorrect * posMark) - (sWrong * negMark);
        const sAcc = (sCorrect + sWrong) > 0 ? ((sCorrect / (sCorrect + sWrong)) * 100).toFixed(1) : '0.0';
        return {
          sectionId: sec.id,
          sectionName: sec.title,
          total: (sec.questions || []).length,
          maxMarks: Number(((sec.questions || []).length * posMark).toFixed(2)),
          correct: sCorrect,
          wrong: sWrong,
          unanswered: sUnans,
          score: Number(sScore.toFixed(2)),
          accuracy: sAcc,
          timeSpentSeconds: sTime
        };
      });
    }
    this._renderScorecardSectionalTable(breakdown, timeSpent);

    const breakdownEl = document.getElementById('scorecard-section-breakdown');
    if (breakdownEl) {
      breakdownEl.innerHTML = breakdown.map(sec => `
        <div style="display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; margin-bottom: 8px; font-size: 13px;">
          <div style="font-weight: bold; width: 140px;">${sec.sectionName}</div>
          <div>✅ ${sec.correct} | ❌ ${sec.wrong} | ⬜ ${sec.unanswered}</div>
          <div style="font-weight: bold; color: #1c4b79;">Score: ${(sec.score || 0).toFixed(2)}</div>
          <div style="font-weight: bold; color: #2e7d32;">Acc: ${sec.accuracy}%</div>
        </div>
      `).join('');
    }

    if (testData && testData.sections) {
      const allQuestions = [];
      testData.sections.forEach(sec => sec.questions.forEach(q => {
        q.correctIndex = this._getNormalizedCorrectIndex(q);
        allQuestions.push(q);
      }));

      this._renderScorecardTopicBreakdown(breakdown, allQuestions);
      this._renderTopperComparisonModule(netScore, maxScore, parseFloat(accuracy), timeSpent, allQuestions.length, breakdown, rankData);
    }

    const solutionsContainer = document.getElementById('scorecard-solutions-list');
    if (solutionsContainer) {
      solutionsContainer.innerHTML = '';
    }

    if (this.scorecardOverlay) {
      this.scorecardOverlay.classList.add('active');
    }

    const btnLaunchSol = document.getElementById('btn-scorecard-launch-solutions');
    if (btnLaunchSol) {
      btnLaunchSol.onclick = () => {
        if (this.scorecardOverlay) this.scorecardOverlay.classList.remove('active');
        if (window.openOliveboardSolutions) {
          window.openOliveboardSolutions(attempt, testData);
        }
      };
    }
  }

  _renderScorecardSectionalTable(sectionBreakdownArr, totalTimeSeconds) {
    const rowsEl = document.getElementById('scorecard-section-rows');
    if (!rowsEl || !sectionBreakdownArr || !sectionBreakdownArr.length) return;

    rowsEl.innerHTML = sectionBreakdownArr.map(sec => {
      const totalQ = sec.total || (sec.questions ? sec.questions.length : 30);
      const secMaxMarks = sec.maxMarks || totalQ;
      const attempted = (sec.correct || 0) + (sec.wrong || 0);
      const cutoff = (secMaxMarks * 0.35).toFixed(2);
      const score = sec.score !== undefined ? sec.score : 0;
      const isCleared = score >= parseFloat(cutoff);
      const statusHtml = isCleared
        ? `<span class="pill-cleared">CLEARED</span>`
        : `<span class="pill-missed">MISSED</span>`;
      const scoreStr = score >= 0 ? `+${score.toFixed(2)}` : score.toFixed(2);
      const timeSpentSec = sec.timeSpentSeconds || Math.round((totalTimeSeconds || 1200) / Math.max(1, sectionBreakdownArr.length));
      const timeStr = this._formatTime(timeSpentSec);

      return `
        <tr>
          <td style="text-align: left; font-weight: 700; color: #1c4b79;">${sec.sectionName}</td>
          <td>${totalQ}</td>
          <td>${attempted}</td>
          <td style="color: #15803d; font-weight: 700;">${sec.correct || 0}</td>
          <td style="color: #b91c1c; font-weight: 700;">${sec.wrong || 0}</td>
          <td><span class="badge-score">${scoreStr}</span></td>
          <td style="color: #64748b; font-weight: 600;">${cutoff}</td>
          <td>${statusHtml}</td>
          <td style="font-weight: 700; color: #1c4b79;">${sec.accuracy || '0'}%</td>
          <td style="color: #334155;">${timeStr}</td>
        </tr>
      `;
    }).join('');
  }

  _renderScorecardTopicBreakdown(sectionBreakdownArr, allQuestions) {
    const topicContainer = document.getElementById('scorecard-topic-breakdown');
    if (!topicContainer) return;
    const topicStats = this._generateTopicStats(sectionBreakdownArr, allQuestions);
    topicContainer.innerHTML = topicStats.map(t => `
      <div class="topic-card">
        <div class="topic-name">${t.name} <span style="font-size: 10px; font-weight: normal; color: #64748b;">(${t.section})</span></div>
        <div class="topic-stats">
          <span style="font-weight: 700; color: #15803d;">${t.correct}/${t.total} Correct</span>
          <span style="font-weight: 700; color: #1c4b79;">${t.accuracy}% Acc</span>
          <span>Avg ${t.avgSpeed}s/Q</span>
        </div>
        <div class="progress-bar-bg">
          <div class="fill-correct" style="width: ${t.accuracy}%;"></div>
        </div>
      </div>
    `).join('');
  }

  _generateTopicStats(sectionArr) {
    const topics = [];
    const topicKeywords = {
      'English Language': ['Reading Comprehension', 'Error Detection', 'Sentence Rearrangement', 'Cloze Test', 'Vocabulary'],
      'Quantitative Aptitude': ['Data Interpretation', 'Number Series', 'Simplification & Approx', 'Quadratic Equations', 'Arithmetic Word Problems'],
      'Reasoning Ability': ['Puzzles & Seating Arrangement', 'Syllogism', 'Inequality', 'Coding-Decoding', 'Blood Relations', 'Direction Sense'],
      'Professional Knowledge': ['DBMS & SQL', 'Data Structures & Algorithms', 'Computer Networks', 'Operating Systems', 'Software Engineering', 'Information Security']
    };

    sectionArr.forEach(sec => {
      const kwList = topicKeywords[sec.sectionName] || ['Concept Fundamentals', 'Application & Practice', 'Advanced Problem Solving'];
      const perTopicCount = Math.max(3, Math.floor((sec.total || 30) / kwList.length));
      const attemptedInSec = (sec.correct || 0) + (sec.wrong || 0);
      const secBaseSpeed = sec.timeSpentSeconds && sec.timeSpentSeconds > 0
        ? Math.max(5, Math.round(sec.timeSpentSeconds / Math.max(1, attemptedInSec || sec.total || 30)))
        : 24;
      kwList.forEach((kw, idx) => {
        const topicTotal = (idx === kwList.length - 1) ? ((sec.total || 30) - perTopicCount * (kwList.length - 1)) : perTopicCount;
        const topicCorrect = Math.min(topicTotal, Math.round((sec.correct || 0) * (topicTotal / Math.max(1, (sec.total || 30)))));
        const acc = topicTotal > 0 ? Math.round((topicCorrect / topicTotal) * 100) : 0;
        const avgSpeed = Math.max(4, secBaseSpeed + ((idx % 3) - 1) * 2);
        topics.push({
          name: kw,
          section: sec.sectionName,
          total: topicTotal,
          correct: topicCorrect,
          accuracy: acc,
          avgSpeed
        });
      });
    });

    return topics;
  }

  _renderTopperComparisonModule(userScore, maxScore, userAcc, userTimeSec, totalQ, sectionArr, rankData = null) {
    const container = document.getElementById('comp-cards-container');
    if (!container) return;

    const avgScore = rankData && rankData.avgScore !== undefined
      ? Number(rankData.avgScore).toFixed(2)
      : Math.max(10, (maxScore * 0.442)).toFixed(2);
    const topperScore = rankData && rankData.topperScore !== undefined
      ? Number(rankData.topperScore).toFixed(2)
      : (maxScore * 0.898).toFixed(2);
    const avgAcc = 68.2;
    const topperAcc = 96.5;
    const userSpeed = Math.round(userTimeSec / Math.max(1, totalQ));
    const avgSpeed = 48;
    const topperSpeed = 22;

    const renderScoreTab = () => {
      container.innerHTML = `
        <div class="comp-card">
          <div class="comp-title">
            <span>Total Score</span>
            <span style="font-size: 11px; color: #64748b;">Max: ${maxScore}</span>
          </div>
          <div class="bar-row">
            <span class="lbl">You:</span>
            <div class="bar-bg"><div class="bar-fill you" style="width: ${Math.min(100, Math.max(5, (userScore / Math.max(1, maxScore)) * 100))}%;"></div></div>
            <span class="val">${Number(userScore).toFixed(2)}</span>
          </div>
          <div class="bar-row">
            <span class="lbl">Avg:</span>
            <div class="bar-bg"><div class="bar-fill avg" style="width: ${Math.min(100, (parseFloat(avgScore) / Math.max(1, maxScore)) * 100)}%;"></div></div>
            <span class="val">${avgScore}</span>
          </div>
          <div class="bar-row">
            <span class="lbl">Topper:</span>
            <div class="bar-bg"><div class="bar-fill topper" style="width: ${Math.min(100, (parseFloat(topperScore) / Math.max(1, maxScore)) * 100)}%;"></div></div>
            <span class="val">${topperScore}</span>
          </div>
        </div>

        <div class="comp-card">
          <div class="comp-title">
            <span>Accuracy Rate</span>
            <span style="font-size: 11px; color: #64748b;">Target: 90%+</span>
          </div>
          <div class="bar-row">
            <span class="lbl">You:</span>
            <div class="bar-bg"><div class="bar-fill you" style="width: ${Math.min(100, userAcc)}%;"></div></div>
            <span class="val">${userAcc}%</span>
          </div>
          <div class="bar-row">
            <span class="lbl">Avg:</span>
            <div class="bar-bg"><div class="bar-fill avg" style="width: ${avgAcc}%;"></div></div>
            <span class="val">${avgAcc}%</span>
          </div>
          <div class="bar-row">
            <span class="lbl">Topper:</span>
            <div class="bar-bg"><div class="bar-fill topper" style="width: ${topperAcc}%;"></div></div>
            <span class="val">${topperAcc}%</span>
          </div>
        </div>
      `;
    };

    const renderTimeTab = () => {
      container.innerHTML = `
        <div class="comp-card">
          <div class="comp-title">
            <span>Average Speed per Question</span>
            <span style="font-size: 11px; color: #64748b;">Lower is faster</span>
          </div>
          <div class="bar-row">
            <span class="lbl">You:</span>
            <div class="bar-bg"><div class="bar-fill you" style="width: ${Math.min(100, (userSpeed / 90) * 100)}%;"></div></div>
            <span class="val">${userSpeed}s</span>
          </div>
          <div class="bar-row">
            <span class="lbl">Avg:</span>
            <div class="bar-bg"><div class="bar-fill avg" style="width: ${(avgSpeed / 90) * 100}%;"></div></div>
            <span class="val">${avgSpeed}s</span>
          </div>
          <div class="bar-row">
            <span class="lbl">Topper:</span>
            <div class="bar-bg"><div class="bar-fill topper" style="width: ${(topperSpeed / 90) * 100}%;"></div></div>
            <span class="val">${topperSpeed}s</span>
          </div>
        </div>

        <div class="comp-card">
          <div class="comp-title">
            <span>Total Exam Duration Spent</span>
          </div>
          <div class="bar-row">
            <span class="lbl">You:</span>
            <div class="bar-bg"><div class="bar-fill you" style="width: ${Math.min(100, (userTimeSec / 3600) * 100)}%;"></div></div>
            <span class="val">${Math.round(userTimeSec / 60)}m</span>
          </div>
          <div class="bar-row">
            <span class="lbl">Avg:</span>
            <div class="bar-bg"><div class="bar-fill avg" style="width: 85%;"></div></div>
            <span class="val">54m</span>
          </div>
          <div class="bar-row">
            <span class="lbl">Topper:</span>
            <div class="bar-bg"><div class="bar-fill topper" style="width: 72%;"></div></div>
            <span class="val">46m</span>
          </div>
        </div>
      `;
    };

    const renderSectionsTab = () => {
      container.innerHTML = (sectionArr || []).map(sec => {
        const secMax = sec.maxMarks || sec.total || 30;
        const secScore = sec.score !== undefined ? sec.score : 0;
        const secAvg = (secMax * 0.45).toFixed(1);
        const secTop = (secMax * 0.88).toFixed(1);
        return `
          <div class="comp-card">
            <div class="comp-title">
              <span>${sec.sectionName}</span>
              <span style="font-size: 11px; color: #15803d;">Score: ${secScore.toFixed(2)} / ${secMax}</span>
            </div>
            <div class="bar-row">
              <span class="lbl">You:</span>
              <div class="bar-bg"><div class="bar-fill you" style="width: ${Math.min(100, Math.max(5, (secScore / secMax) * 100))}%;"></div></div>
              <span class="val">${secScore.toFixed(2)}</span>
            </div>
            <div class="bar-row">
              <span class="lbl">Avg:</span>
              <div class="bar-bg"><div class="bar-fill avg" style="width: ${(parseFloat(secAvg) / secMax) * 100}%;"></div></div>
              <span class="val">${secAvg}</span>
            </div>
            <div class="bar-row">
              <span class="lbl">Topper:</span>
              <div class="bar-bg"><div class="bar-fill topper" style="width: ${(parseFloat(secTop) / secMax) * 100}%;"></div></div>
              <span class="val">${secTop}</span>
            </div>
          </div>
        `;
      }).join('');
    };

    renderScoreTab();

    const tabsBar = document.getElementById('comp-tabs-bar');
    if (tabsBar) {
      tabsBar.querySelectorAll('.comp-tab').forEach(tab => {
        tab.onclick = () => {
          tabsBar.querySelectorAll('.comp-tab').forEach(t => t.classList.remove('active'));
          tab.classList.add('active');
          const tabType = tab.dataset.tab;
          if (tabType === 'score') renderScoreTab();
          else if (tabType === 'time') renderTimeTab();
          else if (tabType === 'sections') renderSectionsTab();
        };
      });
    }
  }

  _formatTime(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}h ${m}m ${s}s`;
    return `${m}m ${s}s`;
  }

  exitTest(fromPopstate = false) {
    if (!fromPopstate && window.appController && window.appController.exitTestToDashboard) {
      window.appController.exitTestToDashboard(false);
    } else {
      this._doExitTest(false);
    }
  }

  _doExitTest(skipRefresh = false) {
    clearInterval(this.timerInterval);
    this.isExamActive = false;
    this.isPaused = false;
    if (this.questionInnerPane) this.questionInnerPane.style.opacity = '1';
    if (this.mainContainer) this.mainContainer.style.opacity = '1';
    if (this.modalOverlay) {
      this.modalOverlay.classList.remove('active');
    }
    document.body.style.overflow = 'auto';

    if (!skipRefresh && window.appController) {
      window.appController.refreshAnalytics(this.testData ? this.testData.id : null);
    }
  }
}

// Global initialization
window.initTestEngine = function (testData) {
  return new OliveboardTestEngine(testData);
};
