/**
 * Oliveboard Test Engine - Authentic 1:1 Live Exam Player
 * Reverse-Engineered from u1.oliveboard.in
 * 
 * Features:
 * - 2-Sided Test Window (Directions/Passage on Left, Question & Options on Right)
 * - Single Pane View for standalone questions
 * - Official Oliveboard 4-Column Sprite Button Palette (stic-notvisited, stic-answered, stic-notanswered, stic-marked, stic-answered-marked)
 * - Authentic Oliveboard Header (#header-top) with Logo, Test Title, Fullscreen & Exit
 * - Oliveboard Sections Bar (#section-name-container) with .secgen & .currclass
 * - Real-time Countdown Timer with Pause/Resume capability (#calert)
 * - Official Legend with live status counts
 * - Question Paper, Instructions, Profile, and Submit Modals
 * - Permanent SQLite Result Storage via OBTestDataManager & Multi-User Isolation
 * - Post-Test AI Performance Scorecard with HTML solutions
 */

class OliveboardTestEngine {
  constructor(testData) {
    this.testData = testData;
    this.currentSectionIndex = 0;
    this.currentQuestionIndex = 0;
    this.userResponses = {}; // { questionId: { selectedIndex: number|null, status: string } }
    this.timerInterval = null;
    this.completedSections = new Set(); // Track locked/completed section indices
    this.bookmarkedQuestions = {}; // { [questionId]: boolean }
    this.isSectionAdvanceConfirm = false; // Next Section modal vs Final submit
    
    // Sectional timing: default 1200s (20 mins) per section for Banking mocks
    const firstSec = this.testData.sections && this.testData.sections[0];
    this.sectionRemainingSeconds = (firstSec && firstSec.durationSeconds) ? firstSec.durationSeconds : (testData.totalDurationSeconds || 1200);
    this.remainingSeconds = testData.totalDurationSeconds || 7200;
    
    this.isExamActive = false;
    this.isPaused = false;
    this.startTime = null;

    this.initDOM();
  }

  initDOM() {
    this.modalOverlay = document.getElementById('test-modal-overlay');
    this.examTitleEl = document.getElementById('exam-title-display');
    this.sectionTabsContainer = document.getElementById('exam-section-tabs');
    this.timerDisplayEl = document.getElementById('exam-timer-display');
    this.qNumLabelEl = document.getElementById('exam-q-num-label');
    this.marksInfoEl = document.getElementById('exam-marks-info');

    // 2-Sided View Elements
    this.twoSidedWrapper = document.getElementById('exam-two-sided-wrapper');
    this.leftPane = document.getElementById('exam-leftpane');
    this.passagePanel = document.getElementById('exam-passage-panel');
    this.rightPane = document.getElementById('exam-rightpane');
    this.questionText2SidedEl = document.getElementById('exam-question-text-2sided');
    this.optionsTable2Sided = document.getElementById('exam-options-table-2sided');

    // Single Pane Elements
    this.singleWrapper = document.getElementById('exam-single-wrapper');
    this.questionTextEl = document.getElementById('exam-question-text');
    this.optionsContainer = document.getElementById('exam-options-container');
    this.questionImageEl = document.getElementById('exam-question-image');

    // Action Buttons (#button-holder)
    this.btnSaveNext = document.getElementById('btn-save-next');
    this.btnMarkReview = document.getElementById('btn-mark-review');
    this.btnClearResponse = document.getElementById('btn-clear-response');
    this.btnPrev = document.getElementById('btn-prev-question');
    this.btnSubmitExam = document.getElementById('btn-submit-exam');
    this.btnExitExam = document.getElementById('btn-exit-exam');
    this.btnScreenToggle = document.getElementById('btn-screen-toggle');

    // Bookmark Toggle Button
    this.btnBookmarkToggle = document.getElementById('btn-toggle-bookmark');

    // Palette & Legend
    this.paletteGridEl = document.getElementById('palette-numbers-grid');

    // Pause Dialog (#calert)
    this.btnPauseTest = document.getElementById('btn-pause-test');
    this.btnResumeTest = document.getElementById('btn-resume-test');
    this.pauseModal = document.getElementById('calert');
    this.dummyBlack = document.getElementById('dummy-black');

    // Bottom Navigation Modals
    this.btnBottomPaper = document.getElementById('btn-bottom-paper');
    this.paperModal = document.getElementById('paper-modal-overlay');
    this.paperModalContent = document.getElementById('paper-modal-content');
    this.btnClosePaperModal = document.getElementById('btn-close-paper-modal');
    this.btnClosePaperFooter = document.getElementById('btn-close-paper-modal-footer');

    this.btnBottomInstructions = document.getElementById('btn-bottom-instructions');
    this.instructionsModal = document.getElementById('instructions-modal-overlay');
    this.btnCloseInstructions = document.getElementById('btn-close-instructions-modal');
    this.btnCloseInstructionsFooter = document.getElementById('btn-close-instructions-footer');

    this.btnBottomProfile = document.getElementById('btn-bottom-profile');
    this.profileModal = document.getElementById('profile-modal-overlay');
    this.btnCloseProfileModal = document.getElementById('btn-close-profile-modal');
    this.btnCloseProfileFooter = document.getElementById('btn-close-profile-footer');

    // Submit / Next Section Confirmation Modal
    this.submitConfirmModal = document.getElementById('submit-confirm-overlay');
    this.submitSummaryTbody = document.getElementById('submit-summary-tbody');
    this.submitConfirmTitle = document.getElementById('submit-confirm-modal-title');
    this.submitConfirmLead = document.getElementById('submit-confirm-lead-text');
    this.submitConfirmWarning = document.getElementById('submit-confirm-warning');
    this.btnSubmitCancel = document.getElementById('btn-submit-cancel');
    this.btnSubmitFinal = document.getElementById('btn-submit-final');
    this.btnCloseSubmitConfirm = document.getElementById('btn-close-submit-confirm');

    // Scorecard Overlay
    this.scorecardOverlay = document.getElementById('scorecard-modal-overlay');
    this.btnCloseScorecard = document.getElementById('btn-close-scorecard');

    // Pre-Exam Instructions Pane (Specs 2.2 & 2.3)
    this.instructionPane = document.getElementById('instruction-pane-1');
    this.mainContainer = document.getElementById('main-container');
    this.disclaimerCheck = document.getElementById('disclaimer-check');
    this.disclaimerWarning = document.getElementById('disclaimer-warning');
    this.btnStartTest = document.getElementById('start-test');
    this.instrSectionMatrixTbody = document.getElementById('in-tab-body');
    this.instrDropdownMenu = document.getElementById('instrDropdownMenu');
    this.instrLangMenu = document.getElementById('instr-lang-menu');

    this.bindEvents();
  }

  bindEvents() {
    // Pre-Exam Instructions "I am ready to begin" Button
    if (this.btnStartTest) {
      this.btnStartTest.onclick = (e) => {
        e.preventDefault();
        if (this.disclaimerCheck && !this.disclaimerCheck.checked) {
          if (this.disclaimerWarning) {
            this.disclaimerWarning.style.display = 'block';
            this.disclaimerWarning.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
          return;
        }
        if (this.disclaimerWarning) {
          this.disclaimerWarning.style.display = 'none';
        }
        this.startActiveExam();
      };
    }

    // Disclaimer Checkbox Change Listener
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
      document.addEventListener('click', () => {
        if (this.instrLangMenu) this.instrLangMenu.style.display = 'none';
      });
    }

    // Action buttons
    if (this.btnSaveNext) {
      this.btnSaveNext.onclick = (e) => { e.preventDefault(); this.handleSaveAndNext(); };
    }
    if (this.btnMarkReview) {
      this.btnMarkReview.onclick = (e) => { e.preventDefault(); this.handleMarkForReview(); };
    }
    if (this.btnClearResponse) {
      this.btnClearResponse.onclick = (e) => { e.preventDefault(); this.handleClearResponse(); };
    }
    if (this.btnPrev) {
      this.btnPrev.onclick = (e) => { e.preventDefault(); this.handlePrevQuestion(); };
    }
    const handleSubmit = (e) => { e.preventDefault(); this.handleNextSectionOrSubmit(); };
    if (this.btnSubmitExam) {
      this.btnSubmitExam.onclick = handleSubmit;
    }
    const b4 = document.getElementById('b4');
    if (b4) b4.onclick = handleSubmit;
    if (this.btnExitExam) {
      this.btnExitExam.onclick = (e) => { e.preventDefault(); this.confirmExit(); };
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

    // Pause / Resume
    if (this.btnPauseTest) {
      this.btnPauseTest.onclick = (e) => { e.preventDefault(); this.pauseTest(); };
    }
    if (this.btnResumeTest) {
      this.btnResumeTest.onclick = (e) => { e.preventDefault(); this.resumeTest(); };
    }

    // Question Paper Modal
    // Question Paper Modal
    const handlePaper = (e) => { e.preventDefault(); this.openQuestionPaperModal(); };
    if (this.btnBottomPaper) this.btnBottomPaper.onclick = handlePaper;
    const b1 = document.getElementById('b1');
    if (b1) b1.onclick = handlePaper;
    if (this.btnClosePaperModal) {
      this.btnClosePaperModal.onclick = () => { this.paperModal.classList.remove('active'); };
    }
    if (this.btnClosePaperFooter) {
      this.btnClosePaperFooter.onclick = () => { this.paperModal.classList.remove('active'); };
    }

    // Instructions Modal
    const handleInstructions = (e) => { e.preventDefault(); this.openInstructionsModal(); };
    if (this.btnBottomInstructions) this.btnBottomInstructions.onclick = handleInstructions;
    const b2 = document.getElementById('b2');
    if (b2) b2.onclick = handleInstructions;
    if (this.btnCloseInstructions) {
      this.btnCloseInstructions.onclick = () => { this.instructionsModal.classList.remove('active'); };
    }
    if (this.btnCloseInstructionsFooter) {
      this.btnCloseInstructionsFooter.onclick = () => { this.instructionsModal.classList.remove('active'); };
    }

    // Profile Modal
    const handleProfile = (e) => { e.preventDefault(); this.openProfileModal(); };
    if (this.btnBottomProfile) this.btnBottomProfile.onclick = handleProfile;
    const b3 = document.getElementById('b3');
    if (b3) b3.onclick = handleProfile;
    if (this.btnCloseProfileModal) {
      this.btnCloseProfileModal.onclick = () => { if (this.profileModal) this.profileModal.classList.remove('active'); };
    }
    if (this.btnCloseProfileFooter) {
      this.btnCloseProfileFooter.onclick = () => { if (this.profileModal) this.profileModal.classList.remove('active'); };
    }

    // Submit / Next Section Confirmation Modal
    if (this.btnSubmitCancel) {
      this.btnSubmitCancel.onclick = () => { this.submitConfirmModal.classList.remove('active'); };
    }
    if (this.btnCloseSubmitConfirm) {
      this.btnCloseSubmitConfirm.onclick = () => { this.submitConfirmModal.classList.remove('active'); };
    }
    if (this.btnSubmitFinal) {
      this.btnSubmitFinal.onclick = () => {
        this.submitConfirmModal.classList.remove('active');
        if (this.isSectionAdvanceConfirm) {
          this.advanceToNextSection();
        } else {
          this.submitTest();
        }
      };
    }

    // Drawer Slide Collapse / Expand
    const btnCollapse = document.getElementById('btn-collapse-sidebar');
    const btnExpand = document.getElementById('btn-expand-sidebar');
    const leftContainer = document.getElementById('left-container-post');
    const rightContainer = document.getElementById('right-container-post');

    if (btnCollapse) {
      btnCollapse.onclick = () => {
        if (leftContainer) leftContainer.style.width = '100%';
        if (rightContainer) rightContainer.style.display = 'none';
        if (btnExpand) btnExpand.style.display = 'block';
      };
    }
    if (btnExpand) {
      btnExpand.onclick = () => {
        if (leftContainer) leftContainer.style.width = '78%';
        if (rightContainer) rightContainer.style.display = 'block';
        if (btnExpand) btnExpand.style.display = 'none';
      };
    }

    // Language Dropdown Toggle
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
          const text = li.textContent;
          const selectedItem = btnLangDrop.querySelector('.dd-selected-item');
          if (selectedItem) selectedItem.textContent = text;
          langMenu.style.display = 'none';
          this.setLanguage(lang);
        };
      });
      document.addEventListener('click', () => {
        if (langMenu) langMenu.style.display = 'none';
      });
    }

    // Scorecard Close Button
    if (this.btnCloseScorecard) {
      this.btnCloseScorecard.onclick = () => {
        this.scorecardOverlay.classList.remove('active');
        this.exitTest();
      };
    }

    // Fullscreen change listener
    document.addEventListener('fullscreenchange', () => {
      if (!document.fullscreenElement && this.btnScreenToggle) {
        this.btnScreenToggle.textContent = 'Enter Full Screen';
      }
    });
  }

  startTest() {
    this.initDOM();
    this.isExamActive = false; // Exam is not active until "I am ready to begin" is clicked
    this.isPaused = false;
    this.completedSections = new Set();
    this.bookmarkedQuestions = {};
    this.isSectionAdvanceConfirm = false;
    this.currentSectionIndex = 0;
    this.currentQuestionIndex = 0;
    this.userResponses = {};

    // Sectional timer setup (default 1200s / 20 mins per section)
    const firstSec = this.testData.sections && this.testData.sections[0];
    this.sectionRemainingSeconds = (firstSec && firstSec.durationSeconds) ? firstSec.durationSeconds : 1200;
    this.remainingSeconds = this.testData.totalDurationSeconds || 7200;

    // Initialize all questions as not-visited with time tracking
    this.testData.sections.forEach(sec => {
      sec.questions.forEach(q => {
        this.userResponses[q.id] = {
          selectedIndex: null,
          status: 'stic-notvisited',
          timeSpentSeconds: 0,
          timeEntries: []
        };
      });
    });

    // Update Header Test Title
    if (this.examTitleEl) {
      this.examTitleEl.textContent = this.testData.title;
    }

    // Populate Section Matrix Table in Instructions Pane (Spec 2.2)
    if (this.instrSectionMatrixTbody) {
      this.instrSectionMatrixTbody.innerHTML = this.testData.sections.map((sec, i) => `
        <tr>
          <td>${i + 1}</td>
          <td style="text-align: left; font-weight: 600; color: #1c4b79;">${sec.title}</td>
          <td>${sec.questions ? sec.questions.length : (sec.questionCount || 30)}</td>
          <td style="color: #2b8a3e; font-weight: bold;">${sec.maxMarks || (sec.questions ? sec.questions.length : 30)}</td>
          <td style="color: #D9534F; font-weight: bold;">${sec.durationMinutes || Math.round((sec.durationSeconds || 1200) / 60)}</td>
          <td>${sec.language || 'English & Hindi'}</td>
        </tr>
      `).join('');
    }

    // Reset declaration checkbox and warning
    if (this.disclaimerCheck) this.disclaimerCheck.checked = false;
    if (this.disclaimerWarning) this.disclaimerWarning.style.display = 'none';

    // Show Test Console Modal Fullscreen
    if (this.modalOverlay) {
      this.modalOverlay.classList.add('active');
    }
    document.body.style.overflow = 'hidden';

    // Directly start active exam so Question Palette, Countdown Timer,
    // Two-sided Duplex panes, and Action Buttons are 100% visible immediately!
    this.startActiveExam();
  }

  /**
   * Start Active Exam - Ensures Question Palette is 100% visible and interactive
   */
  startActiveExam() {
    this.isExamActive = true;
    this.startTime = Date.now();
    this.currentQuestionEntryTime = Date.now();

    // Transition DOM: Hide instructions pane, ensure main exam container is visible
    if (this.instructionPane) this.instructionPane.style.display = 'none';
    if (this.mainContainer) this.mainContainer.style.display = 'block';

    // Ensure left & right containers are explicitly visible with proper 78% / 22% widths
    const leftContainer = document.getElementById('left-container-post');
    const rightContainer = document.getElementById('right-container-post');
    const btnExpand = document.getElementById('btn-expand-sidebar');
    if (leftContainer) {
      leftContainer.style.width = '78%';
      leftContainer.style.display = 'block';
    }
    if (rightContainer) {
      rightContainer.style.display = 'block';
      rightContainer.style.visibility = 'visible';
    }
    if (btnExpand) btnExpand.style.display = 'none';

    // Start Realtime Countdown Timer
    this.startTimer();

    // Render Section Tabs and First Question
    this.renderSectionTabs();
    this.loadQuestion(0, 0);

    // Guarantee Question Palette grid is rendered immediately
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
    if (!this.timerDisplayEl) return;

    const hours = Math.floor(this.sectionRemainingSeconds / 3600);
    const mins = Math.floor((this.sectionRemainingSeconds % 3600) / 60);
    const secs = this.sectionRemainingSeconds % 60;

    const hStr = String(hours).padStart(2, '0');
    const mStr = String(mins).padStart(2, '0');
    const sStr = String(secs).padStart(2, '0');

    this.timerDisplayEl.textContent = `${hStr}:${mStr}:${sStr}`;

    // Highlight critical time (< 2 mins)
    if (this.sectionRemainingSeconds <= 120) {
      this.timerDisplayEl.style.color = '#e03131';
    } else {
      this.timerDisplayEl.style.color = '#D9534F';
    }

    // Section title & allotted timing indicator
    const secLabelEl = document.getElementById('exam-sectional-label');
    const secNameEl = document.getElementById('exam-sec-timer-name');
    const curSec = this.testData.sections && this.testData.sections[this.currentSectionIndex];
    if (secNameEl && curSec) {
      const allottedMins = curSec.durationMinutes || Math.round((curSec.durationSeconds || 1200) / 60);
      secNameEl.textContent = `${curSec.title} (${allottedMins}m)`;
    }
    if (secLabelEl) {
      secLabelEl.textContent = this.testData.hasSectionalTiming !== false ? 'Section Time Left' : 'Time Left';
    }
  }

  handleSectionTimeout() {
    const isLastSection = this.currentSectionIndex >= this.testData.sections.length - 1;
    if (!isLastSection) {
      const curSec = this.testData.sections[this.currentSectionIndex];
      alert(`⏰ Section Time is up! ${curSec ? curSec.title : 'Current Section'} has ended and is now locked.\nMoving directly to the next section.`);
      this.completedSections.add(this.currentSectionIndex);
      this.switchSection(this.currentSectionIndex + 1);
    } else {
      alert('⏰ Total Exam Time is up! Your exam has been automatically submitted.');
      this.submitTest();
    }
  }

  pauseTest() {
    this._recordCurrentQuestionTime();
    this.isPaused = true;
    if (this.pauseModal) this.pauseModal.style.display = 'block';
    if (this.dummyBlack) this.dummyBlack.style.display = 'block';
  }

  resumeTest() {
    this.isPaused = false;
    this.currentQuestionEntryTime = Date.now();
    if (this.pauseModal) this.pauseModal.style.display = 'none';
    if (this.dummyBlack) this.dummyBlack.style.display = 'none';
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
    this.currentLang = lang;
    if (lang === 'hqt') {
      document.querySelectorAll('.hqt').forEach(el => el.style.setProperty('display', 'inline', 'important'));
      document.querySelectorAll('.eqt').forEach(el => el.style.setProperty('display', 'none', 'important'));
    } else {
      document.querySelectorAll('.hqt').forEach(el => el.style.setProperty('display', 'none', 'important'));
      document.querySelectorAll('.eqt').forEach(el => el.style.setProperty('display', 'inline', 'important'));
    }
  }

  renderSectionTabs() {
    if (!this.sectionTabsContainer) return;

    this.sectionTabsContainer.innerHTML = this.testData.sections.map((sec, idx) => {
      const isLocked = this.completedSections.has(idx);
      const isCurrent = idx === this.currentSectionIndex;
      return `
        <td>
          <span class="secgen ${isCurrent ? 'currclass' : ''} ${isLocked ? 'locked-section' : ''}" 
                data-sec-idx="${idx}"
                title="${sec.title} (${sec.questions.length} Questions)${isLocked ? ' - Completed & Locked' : ''}">
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
      const secIdx = parseInt(tab.dataset.secIdx);
      const sec = this.testData.sections[secIdx];

      tab.addEventListener('click', () => {
        if (this.completedSections.has(secIdx)) {
          alert(`Section "${sec.title}" is already completed and locked.\nIn banking exams, candidate responses cannot be modified once a section is submitted.`);
          return;
        }
        if (secIdx !== this.currentSectionIndex) {
          if (secIdx > this.currentSectionIndex) {
            if (confirm(`You are currently on "${this.testData.sections[this.currentSectionIndex].title}".\nDo you want to submit this section and advance to "${sec.title}"?`)) {
              this.handleNextSectionOrSubmit();
            }
            return;
          }
          this.switchSection(secIdx);
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

        const durationMin = sec.durationMinutes || Math.round((sec.durationSeconds || 1200) / 60);
        const marksCount = sec.maxMarks || (sec.questions ? sec.questions.length : 30);
        if (hoverChild) hoverChild.textContent = `${sec.title} (${durationMin}m | ${marksCount}M)`;
        if (ansEl) ansEl.textContent = ansCount;
        if (unansEl) unansEl.textContent = notAnsCount;
        if (markedEl) markedEl.textContent = markedCount;
        if (ansMarkedEl) ansMarkedEl.textContent = ansMarkedCount;
        if (notVisitedEl) notVisitedEl.textContent = notVisitedCount;

        const rect = tab.getBoundingClientRect();
        hoverCon.style.left = Math.max(10, rect.left + (rect.width / 2) - 85) + 'px';
        hoverCon.style.top = (rect.bottom + 6) + 'px';
        hoverCon.style.display = 'block';
      });

      tab.addEventListener('mouseleave', () => {
        if (hoverCon) hoverCon.style.display = 'none';
      });
    });
  }

  switchSection(sectionIndex) {
    if (this.completedSections.has(sectionIndex)) {
      alert(`Section "${this.testData.sections[sectionIndex].title}" has already been submitted and locked.`);
      return;
    }
    this.currentSectionIndex = sectionIndex;
    this.currentQuestionIndex = 0;
    
    // Update sectional countdown timer
    const sec = this.testData.sections[sectionIndex];
    this.sectionRemainingSeconds = (sec && sec.durationSeconds) ? sec.durationSeconds : 1200;
    this.startTimer();

    this.renderSectionTabs();
    this.loadQuestion(sectionIndex, 0);
  }

  loadQuestion(sectionIndex, questionIndex) {
    this._recordCurrentQuestionTime();
    this.currentQuestionEntryTime = Date.now();

    const section = this.testData.sections[sectionIndex];
    if (!section) return;
    const question = section.questions[questionIndex];
    if (!question) return;

    this.currentSectionIndex = sectionIndex;
    this.currentQuestionIndex = questionIndex;

    // Mark as visited (if not-visited)
    const response = this.userResponses[question.id];
    if (response && response.status === 'stic-notvisited') {
      response.status = 'stic-notanswered';
    }

    // Update Question Number Label
    if (this.qNumLabelEl) {
      this.qNumLabelEl.textContent = question.questionNumber || (question.globalIndex || (questionIndex + 1));
    }

    // Dynamic Oliveboard #b4 Button Label (Next Section vs Submit)
    const b4El = document.getElementById('b4');
    if (b4El) {
      if (this.currentSectionIndex < this.testData.sections.length - 1) {
        b4El.textContent = 'Next Section';
      } else {
        b4El.textContent = 'Submit';
      }
    }

    // Update Bookmark Button State
    this.updateBookmarkButtonState(question.id);

    // Update Marks Strip
    if (this.marksInfoEl) {
      const posMarks = question.marksForCorrect !== undefined ? question.marksForCorrect : 1;
      const negMarks = question.negativeMarks !== undefined ? question.negativeMarks : 0.25;
      this.marksInfoEl.innerHTML = `Marks for correct answer: <strong class="pos">+${posMarks}</strong> | Negative mark: <strong class="neg">-${negMarks}</strong>`;
    }

    const selectedIdx = response ? response.selectedIndex : null;

    // Retrieve passage & question HTML from JSON
    const rawPassage = question.passageHTML || question.passage_text || '';
    const rawQuestion = question.questionHTML || question.question_text || '';

    // DUPLEX UI ENGINE:
    // Follow authentic 2-sided Duplex UI universally:
    // Left Pane: Problem stimulus, passage, directions, alphanumeric series, charts, or question statement.
    // Right Pane: Question prompt (for passage questions) + Options radio choices table.
    // Question & options are NEVER crammed together on one page.
    const hasPassage = Boolean(
      (question.hasPassage && rawPassage && rawPassage.trim().length > 10) ||
      (rawPassage && rawPassage.trim().length > 25)
    );

    const formattedPassage = this._formatContentHTML(rawPassage);
    const formattedQuestion = this._formatContentHTML(rawQuestion);

    // Format any images associated with question
    const imgs = question.imageUrls || question.image_urls || [];
    let imageHtml = '';
    if (imgs.length > 0 && !rawQuestion.includes('<img')) {
      imageHtml = imgs.map(url => {
        const cleanUrl = url.replace(/^[a-zA-Z]:\\.*\\images\\/i, '/images/').replace(/\\/g, '/');
        return `<img src="${cleanUrl}" style="max-width: 100%; border: 1px solid #ccc; margin: 8px 0; display: block;" onerror="this.style.display='none'">`;
      }).join('');
    }

    // Always ensure Duplex 2-Sided Wrapper is active
    if (this.twoSidedWrapper) this.twoSidedWrapper.style.display = 'block';
    if (this.singleWrapper) this.singleWrapper.style.display = 'none';

    if (hasPassage) {
      // Left Pane: Directions / Reading Passage / Comprehension
      if (this.passagePanel) {
        this.passagePanel.innerHTML = formattedPassage;
      }
      // Right Pane: Question prompt above options
      if (this.questionText2SidedEl) {
        this.questionText2SidedEl.style.display = 'block';
        this.questionText2SidedEl.innerHTML = (imageHtml ? imageHtml : '') + formattedQuestion;
        const parentTr = this.questionText2SidedEl.closest('tr');
        if (parentTr) parentTr.style.display = '';
      }
    } else {
      // Left Pane: Full Question statement, series, formulas, code or tables
      if (this.passagePanel) {
        this.passagePanel.innerHTML = (imageHtml ? imageHtml : '') + formattedQuestion;
      }
      // Right Pane: No duplicate question text, hide prompt row so options sit at top
      if (this.questionText2SidedEl) {
        this.questionText2SidedEl.style.display = 'none';
        this.questionText2SidedEl.innerHTML = '';
        const parentTr = this.questionText2SidedEl.closest('tr');
        if (parentTr) parentTr.style.display = 'none';
      }
    }

    // Right Pane: Options Table
    if (this.optionsTable2Sided) {
      this.optionsTable2Sided.innerHTML = this._generateOptionsHTML(question, selectedIdx);
      this._bindOptionEvents(this.optionsTable2Sided, question.id);
    }

    // Fallback sync for singleWrapper if ever inspected
    if (this.questionTextEl) this.questionTextEl.innerHTML = formattedQuestion;
    if (this.optionsContainer) {
      this.optionsContainer.innerHTML = this._generateOptionsHTML(question, selectedIdx);
      this._bindOptionEvents(this.optionsContainer, question.id);
    }

    // Reset independent scroll positions on each question load
    if (this.leftPane) this.leftPane.scrollTop = 0;
    if (this.rightPane) this.rightPane.scrollTop = 0;

    // Safety fallback: if any image in the question pane fails to load, gracefully hide it to avoid broken icon outline
    if (this.modalOverlay) {
      this.modalOverlay.querySelectorAll('#question-inner-pane img').forEach(img => {
        img.onerror = () => { img.style.display = 'none'; };
      });
    }

    // Re-render Palette & Legend Summary
    this.renderPalette();
    this.renderSectionTabs();
  }

  _formatContentHTML(html) {
    if (!html) return '';
    let formatted = String(html).trim();

    // Map any relative oliveimg path so it loads from local server static folder
    formatted = formatted.replace(/src=["']oliveimg\/([^"']+)["']/g, 'src="/oliveimg/$1"');
    formatted = formatted.replace(/src=["'](?:\.\/)?images\/([^"']+)["']/g, 'src="/images/$1"');

    // If content does not have block-level tags like <p>, <table>, <div>, wrap in <p>
    if (!/<(?:p|table|div|ol|ul|h[1-6]|tbody|blockquote)/i.test(formatted)) {
      formatted = `<p>${formatted}</p>`;
    }

    return formatted;
  }

  _generateOptionsHTML(question, selectedIndex) {
    if (!question.options) return '';

    // Normalize options (support both Array of objects and Map/Object of letters)
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

  _bindOptionEvents(container, questionId) {
    container.querySelectorAll('tr').forEach(row => {
      row.addEventListener('click', (e) => {
        const optIdx = parseInt(row.dataset.optIdx);
        this.selectOption(questionId, optIdx);
      });
      const radio = row.querySelector('input[type="radio"]');
      if (radio) {
        radio.addEventListener('change', (e) => {
          e.stopPropagation();
          const optIdx = parseInt(row.dataset.optIdx);
          this.selectOption(questionId, optIdx);
        });
      }
    });
  }

  selectOption(questionId, optionIndex) {
    const response = this.userResponses[questionId];
    if (!response) return;

    response.selectedIndex = optionIndex;

    // Update active radio buttons visually across both tables
    [this.optionsContainer, this.optionsTable2Sided].forEach(container => {
      if (!container) return;
      container.querySelectorAll('tr').forEach((row, idx) => {
        const radio = row.querySelector('input[type="radio"]');
        if (idx === optionIndex) {
          row.classList.add('selected');
          if (radio) radio.checked = true;
        } else {
          row.classList.remove('selected');
          if (radio) radio.checked = false;
        }
      });
    });
  }

  handleSaveAndNext() {
    const section = this.testData.sections[this.currentSectionIndex];
    const question = section.questions[this.currentQuestionIndex];
    const response = this.userResponses[question.id];

    if (response.selectedIndex !== null) {
      if (response.status === 'stic-marked' || response.status === 'stic-answered-marked') {
        response.status = 'stic-answered-marked';
      } else {
        response.status = 'stic-answered';
      }
    } else {
      if (response.status !== 'stic-marked') {
        response.status = 'stic-notanswered';
      }
    }

    this.moveToNextQuestion();
  }

  handleMarkForReview() {
    const section = this.testData.sections[this.currentSectionIndex];
    const question = section.questions[this.currentQuestionIndex];
    const response = this.userResponses[question.id];

    if (response.selectedIndex !== null) {
      response.status = 'stic-answered-marked';
    } else {
      response.status = 'stic-marked';
    }

    this.moveToNextQuestion();
  }

  handleClearResponse() {
    const section = this.testData.sections[this.currentSectionIndex];
    const question = section.questions[this.currentQuestionIndex];
    const response = this.userResponses[question.id];

    response.selectedIndex = null;
    response.status = 'stic-notanswered';

    // Reload question to clear visual state
    this.loadQuestion(this.currentSectionIndex, this.currentQuestionIndex);
  }

  handlePrevQuestion() {
    if (this.currentQuestionIndex > 0) {
      this.loadQuestion(this.currentSectionIndex, this.currentQuestionIndex - 1);
    }
  }

  moveToNextQuestion() {
    const section = this.testData.sections[this.currentSectionIndex];

    if (this.currentQuestionIndex < section.questions.length - 1) {
      this.loadQuestion(this.currentSectionIndex, this.currentQuestionIndex + 1);
    } else {
      // Last question of current section
      if (this.currentSectionIndex < this.testData.sections.length - 1) {
        // Prompt to advance to next section
        this.handleNextSectionOrSubmit();
      } else {
        // Last question of last section - refresh palette
        this.renderPalette();
      }
    }
  }

  /**
   * Toggle Question Bookmark state
   */
  toggleQuestionBookmark() {
    const section = this.testData.sections[this.currentSectionIndex];
    if (!section) return;
    const question = section.questions[this.currentQuestionIndex];
    if (!question) return;

    if (this.bookmarkedQuestions[question.id]) {
      delete this.bookmarkedQuestions[question.id];
    } else {
      this.bookmarkedQuestions[question.id] = true;
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
   * Candidate Profile Modal (#b3)
   */
  openProfileModal() {
    if (!this.profileModal) return;
    const user = window.obDataManager ? window.obDataManager.getCurrentUser() : null;
    const nameEl = document.getElementById('profile-modal-name');
    const rollEl = document.getElementById('profile-modal-roll');
    const examEl = document.getElementById('profile-modal-exam');
    const sysEl = document.getElementById('profile-modal-sysid');

    if (nameEl) nameEl.textContent = user ? user.name : 'Piyush Singh';
    if (rollEl) rollEl.textContent = user && user.rollNumber ? user.rollNumber : 'OB-2026-98412';
    if (examEl) examEl.textContent = this.testData.title || 'SBI PO 2026 Prelims';
    if (sysEl) sysEl.textContent = 'C23-LAB-NODE-04';

    this.profileModal.classList.add('active');
  }

  /**
   * Render Oliveboard's signature 4-column palette of sprite buttons
   */
  renderPalette() {
    if (!this.paletteGridEl) {
      this.paletteGridEl = document.getElementById('palette-numbers-grid');
    }
    if (!this.paletteGridEl) return;

    const section = this.testData.sections && this.testData.sections[this.currentSectionIndex];
    if (!section || !section.questions) return;
    const questions = section.questions;

    // Build 4-column table rows
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

    // Attach click handlers
    this.paletteGridEl.querySelectorAll('.sprite-butts').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const qIdx = parseInt(btn.dataset.qIdx);
        this.loadQuestion(this.currentSectionIndex, qIdx);
      });
    });

    // Update Legend Summary Counts
    this._updateLegendCounts();
  }

  _updateLegendCounts() {
    const counts = {
      answered: 0,
      notAnswered: 0,
      notVisited: 0,
      marked: 0,
      answeredMarked: 0
    };

    // Calculate across all sections
    this.testData.sections.forEach(sec => {
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
    setVal('count-answered', counts.answered);
    setVal('count-not-answered', counts.notAnswered);
    setVal('count-not-visited', counts.notVisited);
    setVal('count-review', counts.marked);
    setVal('count-review-answered', counts.answeredMarked);
  }

  /**
   * Question Paper Modal: Displays all questions with Direct Jump support
   */
  openQuestionPaperModal() {
    if (!this.paperModal || !this.paperModalContent) return;

    let paperHTML = `<div style="max-width: 100%;">`;
    this.testData.sections.forEach((sec, sIdx) => {
      const isLocked = this.completedSections.has(sIdx);
      const isCurrent = sIdx === this.currentSectionIndex;
      paperHTML += `
        <div style="background: ${isLocked ? '#94a3b8' : '#3476BB'}; color: #FFF; padding: 8px 12px; margin-top: 16px; border-radius: 4px; display: flex; justify-content: space-between; align-items: center;">
          <span style="font-weight: 700; font-size: 14px;">${sec.title}</span>
          <span style="font-size: 11px;">${isLocked ? '🔒 Completed & Locked' : (isCurrent ? '▶ Current Active Section' : '')}</span>
        </div>
      `;
      sec.questions.forEach((q, qIdx) => {
        const isBookmarked = !!this.bookmarkedQuestions[q.id];
        paperHTML += `
          <div class="qp-question-item" data-sec-idx="${sIdx}" data-q-idx="${qIdx}" style="border-bottom: 1px solid #e2e8f0; padding: 12px 10px; ${isLocked ? 'opacity: 0.65; background: #f8fafc;' : 'cursor: pointer; transition: background 0.15s;'}" onmouseover="if(!${isLocked}) this.style.background='#f0f7ff';" onmouseout="if(!${isLocked}) this.style.background='transparent';">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
              <span style="font-weight: bold; color: #1c4b79;">
                Question Q${q.questionNumber || (qIdx + 1)} ${isBookmarked ? '<span style="color: #f59e0b;">★</span>' : ''}
              </span>
              ${!isLocked ? `<button class="qp-jump-btn" data-sec-idx="${sIdx}" data-q-idx="${qIdx}" style="padding: 3px 10px; font-size: 11px; background: #3476BB; color: #fff; border: none; border-radius: 3px; cursor: pointer; font-weight: 600;">Jump to Q${q.questionNumber || (qIdx + 1)} &rarr;</button>` : `<span style="font-size: 11px; color: #64748b; font-weight: 600;">Locked</span>`}
            </div>
            ${q.hasPassage && q.passageHTML ? `<div style="background: #f7f9fb; padding: 10px; border-left: 3px solid #3476BB; margin-bottom: 8px; font-size: 12px;">${q.passageHTML}</div>` : ''}
            <div style="font-size: 13px;">${q.questionHTML || q.question_text || q.text || ''}</div>
            <div style="margin-top: 8px; padding-left: 12px; font-size: 12px;">
              ${(q.options || []).map((opt, oIdx) => `<div><strong>${opt.letter || String.fromCharCode(65 + oIdx)}.</strong> ${typeof opt === 'object' ? (opt.html || opt.text) : opt}</div>`).join('')}
            </div>
          </div>
        `;
      });
    });
    paperHTML += `</div>`;

    this.paperModalContent.innerHTML = paperHTML;

    // Attach click listeners to jump directly to questions
    this.paperModalContent.querySelectorAll('.qp-question-item, .qp-jump-btn').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const sIdx = parseInt(el.dataset.secIdx);
        const qIdx = parseInt(el.dataset.qIdx);
        if (this.completedSections.has(sIdx)) {
          alert(`This section has already been completed and locked.`);
          return;
        }
        this.paperModal.classList.remove('active');
        if (sIdx !== this.currentSectionIndex) {
          this.switchSection(sIdx);
        }
        this.loadQuestion(sIdx, qIdx);
      });
    });

    this.paperModal.classList.add('active');
  }

  /**
   * Instructions Modal: Displays official section matrix, marking scheme, and sectional timing
   */
  openInstructionsModal() {
    if (!this.instructionsModal) return;
    const contentEl = document.getElementById('instructions-modal-content');
    if (contentEl && this.testData && this.testData.sections) {
      const marking = this.testData.markingScheme || { positive: 1.0, negative: 0.25 };
      const totalQ = this.testData.questionsCount || 100;
      const totalTimeMin = this.testData.durationMinutes || 60;

      contentEl.innerHTML = `
        <div style="font-family: verdana, helvetica, sans-serif; font-size: 14px; line-height: 22px; color: #222;">
          <center><b style="font-size: 15px; color: #1e3a8a;">Please read the following instructions carefully</b></center>
          <br>
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; padding: 10px 14px; border-radius: 6px; margin-bottom: 14px; display: flex; justify-content: space-between; flex-wrap: wrap; gap: 8px;">
            <span><b>Total Number of Questions:</b> <span style="color: #0284c7; font-weight: bold;">${totalQ}</span></span>
            <span><b>Total Time Available:</b> <span style="color: #dc2626; font-weight: bold;">${totalTimeMin} minutes</span></span>
            <span><b>Negative Marking:</b> <span style="color: #dc2626; font-weight: bold;">-${marking.negative || 0.25}</span></span>
          </div>

          <h4 style="margin: 12px 0 6px 0; color: #334155; font-size: 14px;">Section-wise Structure & Sectional Timing:</h4>
          <table class="tab-in" style="width: 100%; border-collapse: collapse; margin-bottom: 16px; font-size: 13px;">
            <thead>
              <tr style="background: #3476BB; color: #fff;">
                <th style="padding: 8px 10px; border: 1px solid #cbd5e1; text-align: center;">Section #</th>
                <th style="padding: 8px 10px; border: 1px solid #cbd5e1; text-align: left;">Section Name</th>
                <th style="padding: 8px 10px; border: 1px solid #cbd5e1; text-align: center;">Total Questions</th>
                <th style="padding: 8px 10px; border: 1px solid #cbd5e1; text-align: center;">Max Score</th>
                <th style="padding: 8px 10px; border: 1px solid #cbd5e1; text-align: center;">Time (minutes)</th>
                <th style="padding: 8px 10px; border: 1px solid #cbd5e1; text-align: center;">Language</th>
              </tr>
            </thead>
            <tbody>
              ${this.testData.sections.map((sec, i) => `
                <tr style="background: ${i % 2 === 0 ? '#fff' : '#f8fafc'}; text-align: center;">
                  <td style="padding: 8px 10px; border: 1px solid #cbd5e1; font-weight: bold;">${i + 1}</td>
                  <td style="padding: 8px 10px; border: 1px solid #cbd5e1; text-align: left; font-weight: 600; color: #1e40af;">${sec.title}</td>
                  <td style="padding: 8px 10px; border: 1px solid #cbd5e1;">${sec.questions ? sec.questions.length : sec.questionCount}</td>
                  <td style="padding: 8px 10px; border: 1px solid #cbd5e1; font-weight: bold; color: #15803d;">${sec.maxMarks || (sec.questions ? sec.questions.length : 30)}</td>
                  <td style="padding: 8px 10px; border: 1px solid #cbd5e1; font-weight: bold; color: #dc2626;">${sec.durationMinutes || Math.round((sec.durationSeconds || 1200) / 60)}</td>
                  <td style="padding: 8px 10px; border: 1px solid #cbd5e1;">${sec.language || 'English & Hindi'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <h4 style="margin: 12px 0 6px 0; color: #334155; font-size: 14px;">General Exam Rules:</h4>
          <ol style="margin-left: 20px; padding: 0;">
            <li>The clock has been set at the server and the <strong>sectional countdown timer</strong> at the top right corner displays the remaining time for the active section.</li>
            <li>In banking examinations (SBI PO, IBPS SO, IBPS PO), <strong>sectional timing is strictly enforced</strong>. Once a section's time expires or is submitted, it is locked and you cannot return to it.</li>
            <li><strong>Marking Scheme:</strong> Each correct response awards <strong>+${marking.positive || 1.0} mark</strong>. Each incorrect response incurs a penalty of <strong>-${marking.negative || 0.25} mark</strong> (1/4th negative marking). Unattempted questions carry 0.0 marks.</li>
            <li>The Question Palette uses official TCS / Oliveboard color-coded symbol badges for Not Visited (gray), Not Answered (orange), Answered (green), Marked for Review (purple), and Answered & Marked (purple with green tick - evaluated for marks).</li>
          </ol>
        </div>
      `;
    }
    this.instructionsModal.classList.add('active');
  }

  /**
   * Handle Next Section vs Submit on #b4
   */
  handleNextSectionOrSubmit() {
    const isLastSection = this.currentSectionIndex >= this.testData.sections.length - 1;
    if (!isLastSection) {
      this.showNextSectionConfirmation();
    } else {
      this.showSubmitConfirmation();
    }
  }

  /**
   * Section Summary Confirmation before locking section and advancing
   */
  showNextSectionConfirmation() {
    if (!this.submitConfirmModal || !this.submitSummaryTbody) return;
    this.isSectionAdvanceConfirm = true;

    const currentSec = this.testData.sections[this.currentSectionIndex];
    if (this.submitConfirmTitle) {
      this.submitConfirmTitle.textContent = `Section Summary - ${currentSec.title}`;
    }
    if (this.submitConfirmLead) {
      this.submitConfirmLead.textContent = `Please review your attempt summary for "${currentSec.title}" before proceeding to the next section:`;
    }

    let secAns = 0, secNotAns = 0, secMarked = 0, secNotVis = 0;
    currentSec.questions.forEach(q => {
      const r = this.userResponses[q.id];
      if (!r) return;
      if (r.status === 'stic-answered' || r.status === 'stic-answered-marked') secAns++;
      else if (r.status === 'stic-notanswered') secNotAns++;
      else if (r.status === 'stic-marked') secMarked++;
      else secNotVis++;
    });

    this.submitSummaryTbody.innerHTML = `
      <tr style="background: #eef6ff;">
        <td style="text-align: left; font-weight: 700; padding: 8px 12px; color: #1c4b79;">${currentSec.title}</td>
        <td style="font-weight: 700;">${currentSec.questions.length}</td>
        <td style="color: #2b8a3e; font-weight: bold;">${secAns}</td>
        <td style="color: #e03131; font-weight: bold;">${secNotAns}</td>
        <td style="color: #6a1b9a; font-weight: bold;">${secMarked}</td>
        <td style="color: #4D4D4D;">${secNotVis}</td>
      </tr>
    `;

    if (this.submitConfirmWarning) {
      this.submitConfirmWarning.innerHTML = `⚠️ <strong>Section Locking Notice:</strong> Once you proceed to the next section, <strong>${currentSec.title}</strong> will be permanently locked and you will NOT be able to return or change your answers.`;
      this.submitConfirmWarning.style.color = '#c2410c';
    }

    if (this.btnSubmitFinal) {
      this.btnSubmitFinal.textContent = 'Proceed to Next Section';
      this.btnSubmitFinal.style.background = '#2563eb';
      this.btnSubmitFinal.style.borderColor = '#1d4ed8';
    }

    this.submitConfirmModal.classList.add('active');
  }

  /**
   * Lock current section and advance to the next
   */
  advanceToNextSection() {
    this.completedSections.add(this.currentSectionIndex);
    const nextSecIdx = this.currentSectionIndex + 1;
    if (nextSecIdx < this.testData.sections.length) {
      this.switchSection(nextSecIdx);
    } else {
      this.submitTest();
    }
  }

  /**
   * Final Exam Submission Confirmation with cumulative totals
   */
  showSubmitConfirmation() {
    if (!this.submitConfirmModal || !this.submitSummaryTbody) return;
    this.isSectionAdvanceConfirm = false;

    if (this.submitConfirmTitle) {
      this.submitConfirmTitle.textContent = 'Final Exam Submission Summary';
    }
    if (this.submitConfirmLead) {
      this.submitConfirmLead.textContent = 'Please review your complete test summary across all sections before final submission:';
    }

    let tbodyHTML = '';
    let totQs = 0, totAns = 0, totNotAns = 0, totMarked = 0, totNotVis = 0;

    this.testData.sections.forEach(sec => {
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

      tbodyHTML += `
        <tr>
          <td style="text-align: left; font-weight: 600; padding: 6px 12px;">${sec.title}</td>
          <td>${sec.questions.length}</td>
          <td style="color: #2b8a3e; font-weight: bold;">${secAns}</td>
          <td style="color: #e03131; font-weight: bold;">${secNotAns}</td>
          <td style="color: #6a1b9a; font-weight: bold;">${secMarked}</td>
          <td style="color: #4D4D4D;">${secNotVis}</td>
        </tr>
      `;
    });

    // Total summary row
    tbodyHTML += `
      <tr style="background: #f1f5f9; font-weight: bold; border-top: 2px solid #cbd5e1;">
        <td style="text-align: left; padding: 8px 12px; color: #0f172a;">Total</td>
        <td>${totQs}</td>
        <td style="color: #2b8a3e;">${totAns}</td>
        <td style="color: #e03131;">${totNotAns}</td>
        <td style="color: #6a1b9a;">${totMarked}</td>
        <td style="color: #4D4D4D;">${totNotVis}</td>
      </tr>
    `;

    this.submitSummaryTbody.innerHTML = tbodyHTML;

    if (this.submitConfirmWarning) {
      this.submitConfirmWarning.textContent = 'Are you sure you want to submit the test?';
      this.submitConfirmWarning.style.color = '#d32f2f';
    }

    if (this.btnSubmitFinal) {
      this.btnSubmitFinal.textContent = 'Yes, Submit Test';
      this.btnSubmitFinal.style.background = '#2e7d32';
      this.btnSubmitFinal.style.borderColor = '#1b5e20';
    }

    this.submitConfirmModal.classList.add('active');
  }

  autoSubmit() {
    alert('⏰ Time is up! Your exam has been automatically submitted.');
    this.submitTest();
  }

  confirmExit() {
    if (confirm('Are you sure you want to exit the exam? Your current progress and attempted answers will be retained.')) {
      this.exitTest();
    }
  }

  submitTest() {
    this._recordCurrentQuestionTime();
    clearInterval(this.timerInterval);
    this.isExamActive = false;

    const endTime = Date.now();
    const totalTimeSeconds = Math.round((endTime - this.startTime) / 1000);

    // Compute detailed scoring
    const allQuestions = [];
    this.testData.sections.forEach(sec => {
      sec.questions.forEach(q => allQuestions.push(q));
    });

    let correct = 0, wrong = 0, unanswered = 0;
    let totalScore = 0;
    const solutionsHTML = [];
    const sectionBreakdown = {};

    allQuestions.forEach((q, idx) => {
      const response = this.userResponses[q.id];
      const selectedIdx = response ? response.selectedIndex : null;
      const isAttempted = selectedIdx !== null && selectedIdx !== undefined;
      const isCorrect = isAttempted && selectedIdx === q.correctIndex;

      const marksPos = q.marksForCorrect !== undefined ? q.marksForCorrect : 1;
      const marksNeg = q.negativeMarks !== undefined ? q.negativeMarks : 0.25;

      // Section tracking
      if (!sectionBreakdown[q.section]) {
        sectionBreakdown[q.section] = { correct: 0, wrong: 0, unanswered: 0, score: 0, total: 0 };
      }
      sectionBreakdown[q.section].total++;

      if (isAttempted) {
        if (isCorrect) {
          correct++;
          totalScore += marksPos;
          sectionBreakdown[q.section].correct++;
          sectionBreakdown[q.section].score += marksPos;
        } else {
          wrong++;
          totalScore -= marksNeg;
          sectionBreakdown[q.section].wrong++;
          sectionBreakdown[q.section].score -= marksNeg;
        }
      } else {
        unanswered++;
        sectionBreakdown[q.section].unanswered++;
      }

      // Format solutions HTML
      const selectedLetter = isAttempted ? (q.options[selectedIdx]?.letter || String.fromCharCode(65 + selectedIdx)) : 'Not Attempted';
      const correctLetter = q.options[q.correctIndex]?.letter || String.fromCharCode(65 + (q.correctIndex || 0));
      const statusClass = isAttempted ? (isCorrect ? 'correct' : 'wrong') : 'skipped';
      const statusIcon = isAttempted ? (isCorrect ? '✅' : '❌') : '⬜';

      solutionsHTML.push(`
        <div class="solution-card ${statusClass}" style="background: #fff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px 18px; margin-bottom: 16px;">
          <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #eee; padding-bottom: 8px; margin-bottom: 10px;">
            <div style="font-weight: bold; color: #1c4b79;">
              <span>${statusIcon}</span> Question ${q.questionNumber || (idx + 1)}
              <span style="font-size: 11px; background: #e0f2fe; color: #0284c7; padding: 2px 6px; border-radius: 4px; margin-left: 6px;">${q.section}</span>
            </div>
            <div style="font-weight: bold;">
              ${isAttempted ? (isCorrect ? `<span style="color: #2e7d32;">+${marksPos.toFixed(2)}</span>` : `<span style="color: #e03131;">-${marksNeg.toFixed(2)}</span>`) : '<span style="color: #64748b;">0.00</span>'}
            </div>
          </div>
          ${q.hasPassage && q.passageHTML ? `<div style="background: #f8fafc; border-left: 3px solid #3476BB; padding: 10px; margin-bottom: 12px; font-size: 13px;">${q.passageHTML}</div>` : ''}
          <div style="margin-bottom: 12px; font-size: 14px; line-height: 22px;">${q.questionHTML}</div>
          <div style="display: flex; gap: 20px; font-size: 13px; margin-bottom: 12px; background: #f1f5f9; padding: 8px 12px; border-radius: 4px;">
            <div>Your Answer: <strong style="${isAttempted ? (isCorrect ? 'color: #2e7d32;' : 'color: #e03131;') : 'color: #64748b;'}">${selectedLetter}</strong></div>
            <div>Correct Answer: <strong style="color: #2e7d32;">${correctLetter}</strong></div>
          </div>
          ${q.explanationHTML ? `
            <div style="background: #fdfaf3; border: 1px solid #fde68a; border-radius: 6px; padding: 10px 14px; font-size: 13px; line-height: 20px;">
              <div style="font-weight: bold; color: #b45309; margin-bottom: 4px;">📝 Solution Explanation</div>
              ${q.explanationHTML}
            </div>
          ` : ''}
        </div>
      `);
    });

    const maxScore = allQuestions.length * (this.testData.marksPerCorrect || 1);
    const accuracy = correct + wrong > 0 ? ((correct / (correct + wrong)) * 100).toFixed(1) : 0;
    const percentile = Math.min(99.9, Math.max(12.0, (totalScore / maxScore) * 100 * 1.15)).toFixed(1);
    const estimatedAIR = Math.max(1, Math.round(1500 - (parseFloat(percentile) * 14.5)));

    const sectionBreakdownArr = Object.entries(sectionBreakdown).map(([name, data]) => ({
      sectionName: name,
      ...data,
      accuracy: data.correct + data.wrong > 0 ? ((data.correct / (data.correct + data.wrong)) * 100).toFixed(1) : '0'
    }));

    // Build Attempt Object for Persistence in SQLite DB
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
        estimatedAIR
      },
      timing: {
        startedAt: new Date(this.startTime).toISOString(),
        completedAt: new Date(endTime).toISOString(),
        totalTimeSeconds,
        timePerQuestion: (totalTimeSeconds / allQuestions.length).toFixed(1)
      },
      sectionBreakdown: sectionBreakdownArr
    };

    // Save to Permanent SQLite Database (Multi-User Isolation)
    if (window.obDataManager) {
      window.obDataManager.saveResult(resultObj);
    }

    // Populate AI Scorecard Modal
    const setEl = (id, val) => { const e = document.getElementById(id); if (e) e.textContent = val; };
    setEl('scorecard-test-title', this.testData.title);
    setEl('metric-score', `${totalScore.toFixed(2)} / ${maxScore}`);
    setEl('metric-percentile', `${percentile}%ile`);
    setEl('metric-accuracy', `${accuracy}%`);
    setEl('metric-rank', `#${estimatedAIR} / 14,680`);
    setEl('metric-correct', correct);
    setEl('metric-wrong', wrong);
    setEl('metric-unanswered', unanswered);
    setEl('metric-time', this._formatTime(totalTimeSeconds));

    // Render Section Breakdown in Scorecard
    this._renderScorecardSectionalTable(sectionBreakdownArr, totalTimeSeconds);
    this._renderScorecardTopicBreakdown(sectionBreakdownArr, allQuestions);
    this._renderTopperComparisonModule(totalScore, maxScore, parseFloat(accuracy), totalTimeSeconds, allQuestions.length, sectionBreakdownArr);

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

    // Render Detailed Solutions
    const solutionsContainer = document.getElementById('scorecard-solutions-list');
    if (solutionsContainer) {
      solutionsContainer.innerHTML = solutionsHTML.join('');
    }

    // Hide Test Overlay and Show Scorecard
    if (this.modalOverlay) {
      this.modalOverlay.classList.remove('active');
    }
    if (this.scorecardOverlay) {
      this.scorecardOverlay.classList.add('active');
    }

    // Connect Launch Oliveboard Solutions Button
    const btnLaunchSol = document.getElementById('btn-scorecard-launch-solutions');
    if (btnLaunchSol) {
      btnLaunchSol.onclick = () => {
        if (this.scorecardOverlay) this.scorecardOverlay.classList.remove('active');
        if (window.openOliveboardSolutions) {
          window.openOliveboardSolutions(resultObj, this.testData);
        }
      };
    }
  }

  showScorecardForAttempt(attempt, testData) {
    const setEl = (id, val) => { const e = document.getElementById(id); if (e) e.textContent = val; };
    setEl('scorecard-test-title', attempt.test_title || attempt.testTitle || 'Mock Test');
    setEl('metric-score', `${(attempt.score || 0).toFixed(2)} / ${attempt.max_score || 100}`);
    setEl('metric-percentile', `${(attempt.percentile || 0).toFixed(1)}%ile`);
    setEl('metric-accuracy', `${(attempt.accuracy || 0).toFixed(1)}%`);
    setEl('metric-rank', `#${attempt.estimated_air || 1000} / 14,680`);
    setEl('metric-correct', attempt.correct_count ?? 0);
    setEl('metric-wrong', attempt.wrong_count ?? 0);
    setEl('metric-unanswered', attempt.unanswered_count ?? 0);
    setEl('metric-time', this._formatTime(attempt.time_spent_seconds || 0));

    // Render section breakdown
    const breakdown = attempt.section_breakdown || [];
    const netScore = attempt.score !== undefined ? (typeof attempt.score === 'number' ? attempt.score : (attempt.score.total ?? 0)) : 0;
    const maxScore = attempt.max_score || (testData && testData.marks) || 100;
    const accuracy = attempt.accuracy !== undefined ? attempt.accuracy : 0;
    const timeSpent = attempt.time_spent_seconds || 0;

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

    // Render solutions if questions available
    const solutionsContainer = document.getElementById('scorecard-solutions-list');
    if (solutionsContainer && testData && testData.sections) {
      const allQuestions = [];
      testData.sections.forEach(sec => sec.questions.forEach(q => allQuestions.push(q)));

      this._renderScorecardTopicBreakdown(breakdown, allQuestions);
      this._renderTopperComparisonModule(netScore, maxScore, parseFloat(accuracy), timeSpent, allQuestions.length, breakdown);

      const responses = attempt.responses || {};
      const solutionsHTML = allQuestions.map((q, idx) => {
        const resp = responses[q.id];
        const selectedIdx = resp ? resp.selectedIndex : null;
        const isAttempted = selectedIdx !== null && selectedIdx !== undefined;
        const isCorrect = isAttempted && selectedIdx === q.correctIndex;

        const selectedLetter = isAttempted ? (q.options[selectedIdx]?.letter || String.fromCharCode(65 + selectedIdx)) : 'Not Attempted';
        const correctLetter = q.options[q.correctIndex]?.letter || String.fromCharCode(65 + (q.correctIndex || 0));
        const statusClass = isAttempted ? (isCorrect ? 'correct' : 'wrong') : 'skipped';
        const statusIcon = isAttempted ? (isCorrect ? '✅' : '❌') : '⬜';

        return `
          <div class="solution-card ${statusClass}" style="background: #fff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px 18px; margin-bottom: 16px;">
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #eee; padding-bottom: 8px; margin-bottom: 10px;">
              <div style="font-weight: bold; color: #1c4b79;">
                <span>${statusIcon}</span> Question ${q.questionNumber || (idx + 1)}
                <span style="font-size: 11px; background: #e0f2fe; color: #0284c7; padding: 2px 6px; border-radius: 4px; margin-left: 6px;">${q.section}</span>
              </div>
              <div style="font-weight: bold;">
                ${isAttempted ? (isCorrect ? `<span style="color: #2e7d32;">+${(q.marksForCorrect || 1).toFixed(2)}</span>` : `<span style="color: #e03131;">-${(q.negativeMarks || 0.25).toFixed(2)}</span>`) : '<span style="color: #64748b;">0.00</span>'}
              </div>
            </div>
            ${q.hasPassage && q.passageHTML ? `<div style="background: #f8fafc; border-left: 3px solid #3476BB; padding: 10px; margin-bottom: 12px; font-size: 13px;">${q.passageHTML}</div>` : ''}
            <div style="margin-bottom: 12px; font-size: 14px; line-height: 22px;">${q.questionHTML}</div>
            <div style="display: flex; gap: 20px; font-size: 13px; margin-bottom: 12px; background: #f1f5f9; padding: 8px 12px; border-radius: 4px;">
              <div>Your Answer: <strong style="${isAttempted ? (isCorrect ? 'color: #2e7d32;' : 'color: #e03131;') : 'color: #64748b;'}">${selectedLetter}</strong></div>
              <div>Correct Answer: <strong style="color: #2e7d32;">${correctLetter}</strong></div>
            </div>
            ${q.explanationHTML ? `
              <div style="background: #fdfaf3; border: 1px solid #fde68a; border-radius: 6px; padding: 10px 14px; font-size: 13px; line-height: 20px;">
                <div style="font-weight: bold; color: #b45309; margin-bottom: 4px;">📝 Solution Explanation</div>
                ${q.explanationHTML}
              </div>
            ` : ''}
          </div>
        `;
      });
      solutionsContainer.innerHTML = solutionsHTML.join('');
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

  /**
   * Render Authentic Sectional Analysis Table with Cutoff & Status (Spec 5.2)
   */
  _renderScorecardSectionalTable(sectionBreakdownArr, totalTimeSeconds) {
    const rowsEl = document.getElementById('scorecard-section-rows');
    if (!rowsEl || !sectionBreakdownArr || !sectionBreakdownArr.length) return;

    rowsEl.innerHTML = sectionBreakdownArr.map(sec => {
      const totalQ = sec.total || (sec.questions ? sec.questions.length : 30);
      const attempted = (sec.correct || 0) + (sec.wrong || 0);
      const cutoff = (totalQ * 0.35).toFixed(2);
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

  /**
   * Render Topic-wise Mastery Breakdown Grid (Spec 5.2)
   */
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

  _generateTopicStats(sectionArr, allQuestions) {
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
      kwList.forEach((kw, idx) => {
        const topicTotal = (idx === kwList.length - 1) ? ((sec.total || 30) - perTopicCount * (kwList.length - 1)) : perTopicCount;
        const topicCorrect = Math.min(topicTotal, Math.round((sec.correct || 0) * (topicTotal / Math.max(1, (sec.total || 30)))));
        const acc = topicTotal > 0 ? Math.round((topicCorrect / topicTotal) * 100) : 0;
        const avgSpeed = Math.floor(25 + ((idx * 7) % 35));
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

  /**
   * Render Topper vs You Comparative Module with Interactive Tabs (Spec 5.3)
   */
  _renderTopperComparisonModule(userScore, maxScore, userAcc, userTimeSec, totalQ, sectionArr) {
    const container = document.getElementById('comp-cards-container');
    if (!container) return;

    // Benchmark stats
    const avgScore = Math.max(10, (maxScore * 0.442)).toFixed(2);
    const topperScore = (maxScore * 0.898).toFixed(2);
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
            <div class="bar-bg"><div class="bar-fill you" style="width: ${Math.min(100, Math.max(5, (userScore / maxScore) * 100))}%;"></div></div>
            <span class="val">${Number(userScore).toFixed(2)}</span>
          </div>
          <div class="bar-row">
            <span class="lbl">Avg:</span>
            <div class="bar-bg"><div class="bar-fill avg" style="width: ${Math.min(100, (parseFloat(avgScore) / maxScore) * 100)}%;"></div></div>
            <span class="val">${avgScore}</span>
          </div>
          <div class="bar-row">
            <span class="lbl">Topper:</span>
            <div class="bar-bg"><div class="bar-fill topper" style="width: ${Math.min(100, (parseFloat(topperScore) / maxScore) * 100)}%;"></div></div>
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
        const secMax = sec.total || 30;
        const secScore = sec.score !== undefined ? sec.score : 0;
        const secAvg = (secMax * 0.45).toFixed(1);
        const secTop = (secMax * 0.88).toFixed(1);
        return `
          <div class="comp-card">
            <div class="comp-title">
              <span>${sec.sectionName}</span>
              <span style="font-size: 11px; color: #15803d;">Score: ${secScore.toFixed(2)}</span>
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

    // Default to score tab
    renderScoreTab();

    // Bind tab clicks
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

  exitTest() {
    clearInterval(this.timerInterval);
    this.isExamActive = false;
    this.isPaused = false;
    if (this.modalOverlay) {
      this.modalOverlay.classList.remove('active');
    }
    document.body.style.overflow = 'auto';

    if (window.appController) {
      window.appController.refreshAnalytics();
    }
  }
}

// Global initialization
window.initTestEngine = function(testData) {
  return new OliveboardTestEngine(testData);
};
