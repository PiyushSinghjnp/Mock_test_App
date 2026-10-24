/**
 * Oliveboard Mock Test App - Controller v2.6
 * Full-Stack SQLite Backend, Multi-User Isolation & 2026 Official Exam Auto-Pattern Upload Engine
 */

class OliveboardAppController {
  constructor() {
    this.currentExamId = "ibps-so"; // default to the full 150-Q IBPS SO IT exam
    this.currentFilterTab = "all";
    this.currentStatusFilter = "all"; // 'all' | 'unattempted' | 'attempted' | 'free' (Spec 1.2)
    this.currentViewTab = "tests"; // 'tests' | 'analytics' | 'leaderboard' | 'mcp'
    this.testsCache = [];

    this.init();
  }

  async init() {
    // 1. Initialize user management from database
    if (window.obDataManager) {
      await window.obDataManager.init();
    }

    // 2. Initial renders
    this.renderUserProfileHeader();
    this.renderHeader();
    this.renderExamHero();
    this.renderFilterTabs();
    this.renderStatusFilterPills();
    await this.loadAndRenderMockCards();
    this.renderLeaderboard();
    await this.renderAnalytics();

    // 3. Bind UI events
    this.bindEvents();

    // 4. Initialize History & Deep-Linking Router (prevents about:blank back-button exit)
    this.initHistoryRouter();
  }

  showToast(message, type = 'info') {
    let toast = document.getElementById('ob-global-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'ob-global-toast';
      toast.style.cssText = 'position: fixed; bottom: 68px; right: 20px; z-index: 99999; padding: 11px 18px; border-radius: 8px; font-size: 13px; font-weight: 700; color: #fff; box-shadow: 0 8px 24px rgba(0,0,0,0.22); transition: opacity 0.25s ease; pointer-events: none;';
      document.body.appendChild(toast);
    }
    toast.style.background = type === 'error' ? '#dc2626' : (type === 'success' ? '#15803d' : '#0f172a');
    toast.textContent = message;
    toast.style.opacity = '1';
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => {
      if (toast) toast.style.opacity = '0';
    }, 3600);
  }

  getCurrentExam() {
    return window.OB_TEST_APP.exams.find(e => e.id === this.currentExamId) || window.OB_TEST_APP.exams[0];
  }

  // ==========================================
  // UNIFIED SYMMETRIC HISTORY ROUTER (BACK & FORWARD)
  // ==========================================

  initHistoryRouter() {
    this._currentStep = 0;
    this._isApplyingState = false;

    // 1. Initial State Resolution from URL
    const parsedState = this.parseLocationToState();

    // Set initial history state cleanly without destroying or pushing extra entries
    window.history.replaceState({
      ...parsedState,
      navStep: 0,
      appInitialized: true
    }, '', window.location.pathname + window.location.search + window.location.hash);

    // Apply initial state to render UI immediately
    this.applyState(window.history.state);

    // 2. Global popstate interceptor (Single Source of Truth for Back AND Forward)
    window.addEventListener('popstate', (e) => {
      this.handlePopState(e);
    });
  }

  parseLocationToState() {
    const hash = window.location.hash || '';

    if (hash.startsWith('#test/')) {
      const testId = hash.replace('#test/', '').split('/')[0];
      return { view: 'test-engine', testId };
    }

    if (hash.startsWith('#solutions/')) {
      const rest = hash.replace('#solutions/', '');
      const parts = rest.split('/');
      const testId = parts[0];
      let qIndex = undefined;
      if (parts[1] === 'q' && parts[2]) {
        const qNum = parseInt(parts[2], 10);
        qIndex = !isNaN(qNum) ? Math.max(0, qNum - 1) : 0;
      }
      return { view: 'solutions', testId, qIndex };
    }

    if (hash.startsWith('#scorecard/')) {
      const attemptId = hash.replace('#scorecard/', '').split('/')[0];
      return { view: 'tests', modal: 'scorecard', attemptId };
    }

    if (hash === '#analytics' || hash === '#dashboard') {
      return { view: 'analytics' };
    }

    if (hash === '#leaderboard') {
      return { view: 'leaderboard' };
    }

    if (hash === '#exam-switcher') {
      return { view: 'tests', modal: 'exam-switcher' };
    }

    if (hash === '#profile') {
      return { view: 'tests', modal: 'user-profile' };
    }

    if (hash === '#live-browser') {
      return { view: 'tests', modal: 'live-browser' };
    }

    return { view: 'tests' };
  }

  pushNavState(stateObj, url) {
    if (!window.history) return;
    this._currentStep = (typeof this._currentStep === 'number' ? this._currentStep : 0) + 1;
    const finalState = {
      ...stateObj,
      navStep: this._currentStep,
      appInitialized: true
    };
    window.history.pushState(finalState, '', url);
  }

  replaceNavState(stateObj, url) {
    if (!window.history) return;
    const finalState = {
      ...stateObj,
      navStep: (typeof this._currentStep === 'number' ? this._currentStep : 0),
      appInitialized: true
    };
    window.history.replaceState(finalState, '', url);
  }

  handlePopState(e) {
    const rawState = e.state;
    const prevStep = (typeof this._currentStep === 'number' ? this._currentStep : 0);
    if (rawState && typeof rawState.navStep === 'number') {
      this._currentStep = rawState.navStep;
    } else {
      this._currentStep = 0;
    }

    // Resolve state: if state is null or missing appInitialized, parse from URL
    const state = (rawState && rawState.appInitialized) ? rawState : this.parseLocationToState();

    // Bulletproof Back Interceptor for Solutions Console:
    // When the solutions console is currently open and a popstate event occurs,
    // if the target state still points to ANY solutions state (e.g. from lingering question entries in history),
    // NEVER move questions backward—immediately exit solutions to the tests dashboard!
    const isSolnOpen = (window.obSolutionEngine && window.obSolutionEngine.isOpen) ||
                       (document.getElementById('solution-console-overlay') && document.getElementById('solution-console-overlay').classList.contains('active'));
    if (isSolnOpen && (state.view === 'solutions' || state.view === 'solution-detail')) {
      this.exitSolutionsToTests();
      return;
    }

    // Apply the target state (never call pushState here so Forward stack is preserved!)
    this.applyState(state);
  }

  async applyState(state) {
    if (!state) return;
    this._isApplyingState = true;

    try {
      const targetModal = state.modal || null;

      // 1. Modals Handling (Bidirectional: open when navigating forward to modal, close when popping)
      const obLiveModal = document.getElementById('ob-live-browser-modal');
      if (targetModal === 'live-browser') {
        if (obLiveModal && obLiveModal.style.display !== 'flex') {
          this.openOliveboardLiveBrowser(false);
        }
      } else {
        if (obLiveModal && obLiveModal.style.display === 'flex') {
          this.closeOliveboardLiveBrowser(false);
        }
      }

      const userModal = document.getElementById('user-profile-modal');
      if (targetModal === 'user-profile') {
        if (userModal && !userModal.classList.contains('active')) {
          this.renderUserProfileModal(false);
        }
      } else {
        if (userModal && userModal.classList.contains('active')) {
          userModal.classList.remove('active');
        }
      }

      const examModal = document.getElementById('exam-switcher-modal');
      if (targetModal === 'exam-switcher') {
        if (examModal && !examModal.classList.contains('active')) {
          this.renderExamSwitcherList();
          examModal.classList.add('active');
        }
      } else {
        if (examModal && examModal.classList.contains('active')) {
          examModal.classList.remove('active');
        }
      }

      const scorecardModal = document.getElementById('scorecard-modal-overlay');
      if (targetModal === 'scorecard') {
        if (scorecardModal && !scorecardModal.classList.contains('active')) {
          if (state.attemptId && state.testId) {
            await this.viewAttemptScorecard(state.attemptId, state.testId, false);
          } else {
            scorecardModal.classList.add('active');
          }
        }
      } else {
        if (scorecardModal && scorecardModal.classList.contains('active')) {
          scorecardModal.classList.remove('active');
        }
      }

      // 2. Overlays Handling (Solution Console vs Test Engine vs Main View Tabs)
      const view = state.view || 'tests';
      const solnOverlay = document.getElementById('solution-console-overlay');
      const testOverlay = document.getElementById('test-modal-overlay');

      if (view === 'solutions' || view === 'solution-detail') {
        // Close Test Engine if open
        if (testOverlay && testOverlay.classList.contains('active')) {
          if (this.testEngine) this.testEngine._doExitTest();
        }

        // If solution console is NOT open, open it
        if (!solnOverlay || !solnOverlay.classList.contains('active')) {
          let attId = state.attemptId;
          const tId = state.testId;
          if (!attId && tId) {
            const user = window.obDataManager ? (window.obDataManager.getActiveUser() || { id: 'user-rahul' }) : { id: 'user-rahul' };
            if (user) {
              try {
                const res = await fetch(`/api/attempts?userId=${encodeURIComponent(user.id)}&testId=${encodeURIComponent(tId)}`);
                const data = await res.json();
                if (data.success && data.attempts && data.attempts.length > 0) {
                  const att = data.attempts[0];
                  attId = att.id || att.attempt_id;
                } else {
                  const res2 = await fetch(`/api/attempts?userId=${encodeURIComponent(user.id)}`);
                  const data2 = await res2.json();
                  if (data2.success && data2.attempts && data2.attempts.length > 0) {
                    const att = data2.attempts.find(a => a.test_id === tId) || data2.attempts[0];
                    attId = att.id || att.attempt_id;
                  }
                }
              } catch (err) {
                console.warn('Attempt lookup error:', err);
              }
            }
          }
          if (attId && tId) {
            await this.viewSolutions(attId, tId, false);
          }
        }

        // If solution engine is open, set correct subview
        if (window.obSolutionEngine && window.obSolutionEngine.isOpen) {
          if (state.qIndex !== undefined && state.qIndex !== null) {
            window.obSolutionEngine.goToQuestion(state.qIndex, false);
          } else {
            window.obSolutionEngine.gotoreview(false);
          }
        }
        return;
      }

      if (view === 'test-engine') {
        // Close Solution Console if open
        if (solnOverlay && solnOverlay.classList.contains('active')) {
          if (window.obSolutionEngine) window.obSolutionEngine._doExit();
        }

        // If test overlay is NOT open, open it
        if (!testOverlay || !testOverlay.classList.contains('active')) {
          if (state.testId) {
            await this.resumeMockTest(state.testId, false);
          }
        } else {
          // If already open, return to active question view
          if (this.testEngine) {
            this.testEngine.getAllBack();
            this.testEngine.sBack();
          }
        }
        return;
      }

      // 3. For all other views (tests, analytics, leaderboard):
      if (solnOverlay && solnOverlay.classList.contains('active')) {
        if (window.obSolutionEngine) window.obSolutionEngine._doExit();
      }
      if (testOverlay && testOverlay.classList.contains('active')) {
        if (this.testEngine) this.testEngine._doExitTest();
      }

      // Switch Main View Tab
      this.switchAppView(view, false);

    } finally {
      this._isApplyingState = false;
    }
  }

  hasAnyModalOrOverlayOpen() {
    const obLiveModal = document.getElementById('ob-live-browser-modal');
    const userModal = document.getElementById('user-profile-modal');
    const examModal = document.getElementById('exam-switcher-modal');
    const scorecardModal = document.getElementById('scorecard-modal-overlay');
    const solnOverlay = document.getElementById('solution-console-overlay');
    const testOverlay = document.getElementById('test-modal-overlay');

    return (obLiveModal && obLiveModal.style.display === 'flex') ||
           (userModal && userModal.classList.contains('active')) ||
           (examModal && examModal.classList.contains('active')) ||
           (scorecardModal && scorecardModal.classList.contains('active')) ||
           (solnOverlay && solnOverlay.classList.contains('active')) ||
           (testOverlay && testOverlay.classList.contains('active'));
  }

  closeAllModalsAndOverlays() {
    const obLiveModal = document.getElementById('ob-live-browser-modal');
    if (obLiveModal) {
      obLiveModal.style.display = 'none';
      this._obBrowserActive = false;
      if (this._obFrameTimer) clearTimeout(this._obFrameTimer);
    }

    const userModal = document.getElementById('user-profile-modal');
    if (userModal) userModal.classList.remove('active');

    const examModal = document.getElementById('exam-switcher-modal');
    if (examModal) examModal.classList.remove('active');

    const scorecardModal = document.getElementById('scorecard-modal-overlay');
    if (scorecardModal) scorecardModal.classList.remove('active');

    const solnOverlay = document.getElementById('solution-console-overlay');
    if (solnOverlay && solnOverlay.classList.contains('active')) {
      if (window.obSolutionEngine) window.obSolutionEngine._doExit();
    }

    const testOverlay = document.getElementById('test-modal-overlay');
    if (testOverlay && testOverlay.classList.contains('active')) {
      if (this.testEngine) this.testEngine._doExitTest();
    }
  }

  goBack() {
    const obLiveModal = document.getElementById('ob-live-browser-modal');
    const userModal = document.getElementById('user-profile-modal');
    const examModal = document.getElementById('exam-switcher-modal');
    const scorecardModal = document.getElementById('scorecard-modal-overlay');
    const solnOverlay = document.getElementById('solution-console-overlay');
    const testOverlay = document.getElementById('test-modal-overlay');

    // 1. Solution Console: immediately exit to tests dashboard
    if (solnOverlay && solnOverlay.classList.contains('active')) {
      this.exitSolutionsToTests();
      return;
    }

    // 2. Test Engine: exit or pause safely
    if (testOverlay && testOverlay.classList.contains('active')) {
      if (this.testEngine) {
        if (!this.testEngine.isExamActive) {
          this.testEngine.exitTest();
        } else {
          this.testEngine.pauseTest();
        }
      }
      return;
    }

    const hasModalOpen = (obLiveModal && obLiveModal.style.display === 'flex') ||
                         (userModal && userModal.classList.contains('active')) ||
                         (examModal && examModal.classList.contains('active')) ||
                         (scorecardModal && scorecardModal.classList.contains('active'));

    const hasOverlayOpen = (solnOverlay && solnOverlay.classList.contains('active')) ||
                           (testOverlay && testOverlay.classList.contains('active'));

    const isSubView = (this.currentViewTab !== 'tests');

    // If we have history steps within our app session, go back in history
    if (this._currentStep > 0) {
      window.history.back();
      return;
    }

    // Fallback if at the session root (prevents navigating out of app to about:blank)
    if (hasModalOpen || hasOverlayOpen) {
      this.closeAllModalsAndOverlays();
      this.switchAppView('tests', false);
      window.history.replaceState({ view: 'tests', navStep: 0, appInitialized: true }, '', window.location.pathname);
    } else if (isSubView) {
      this.switchAppView('tests', false);
      window.history.replaceState({ view: 'tests', navStep: 0, appInitialized: true }, '', window.location.pathname);
    } else {
      this.showToast('You are on the Home dashboard', 'info');
    }
  }

  exitSolutionsToTests() {
    if (window.obSolutionEngine) {
      window.obSolutionEngine._doExit();
    }
    const solnOverlay = document.getElementById('solution-console-overlay');
    if (solnOverlay) {
      solnOverlay.classList.remove('active');
      solnOverlay.style.display = 'none';
    }
    const scorecardModal = document.getElementById('scorecard-modal-overlay');
    if (scorecardModal) scorecardModal.classList.remove('active');

    this.switchAppView('tests', false);
    this.replaceNavState({ view: 'tests' }, window.location.pathname);
  }

  // ==========================================
  // CANDIDATE PROFILE & MULTI-USER ISOLATION
  // ==========================================

  renderUserProfileHeader() {
    const user = window.obDataManager ? window.obDataManager.getActiveUser() : null;
    if (!user) return;

    const nameEl = document.getElementById('header-user-name');
    const rollEl = document.getElementById('header-user-roll');
    const avatarEl = document.getElementById('header-user-avatar');

    if (nameEl) nameEl.textContent = user.name;
    if (rollEl) rollEl.textContent = user.roll_no;
    if (avatarEl) avatarEl.textContent = user.avatar || user.name.charAt(0).toUpperCase();

    const tagEl = document.getElementById('analytics-user-tag');
    if (tagEl) tagEl.textContent = `Showing performance analytics for: ${user.name} (${user.roll_no})`;
  }

  renderUserProfileModal(pushHistory = true) {
    const modal = document.getElementById('user-profile-modal');
    const activeBox = document.getElementById('active-user-profile-box');
    const usersList = document.getElementById('users-selection-list');
    if (!modal || !activeBox || !usersList) return;

    const activeUser = window.obDataManager.getActiveUser();
    const allUsers = window.obDataManager.users || [];

    // Active candidate banner
    activeBox.innerHTML = `
      <div style="display: flex; align-items: center; gap: 12px;">
        <div style="width: 44px; height: 44px; border-radius: 50%; background: #008479; color: #ffffff; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 18px;">
          ${activeUser.avatar || activeUser.name.charAt(0)}
        </div>
        <div>
          <div style="font-size: 15px; font-weight: 800; color: #0f172a;">${activeUser.name} <span style="font-size: 10px; background: #008479; color: #ffffff; padding: 2px 6px; border-radius: 4px; margin-left: 4px;">ACTIVE CANDIDATE</span></div>
          <div style="font-size: 12px; color: #64748b;">${activeUser.roll_no} • Target: ${activeUser.target_exam.toUpperCase()}</div>
        </div>
      </div>
    `;

    // Candidate selection list
    usersList.innerHTML = allUsers.map(u => `
      <div class="user-item-card ${u.id === activeUser.id ? 'selected' : ''}" onclick="window.appController.switchCandidate('${u.id}')">
        <div style="display: flex; align-items: center; gap: 12px;">
          <div style="width: 34px; height: 34px; border-radius: 50%; background: ${u.id === activeUser.id ? '#008479' : '#e2e8f0'}; color: ${u.id === activeUser.id ? '#ffffff' : '#475569'}; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 13px;">
            ${u.avatar || u.name.charAt(0)}
          </div>
          <div>
            <div style="font-size: 13px; font-weight: 700; color: #1e293b;">${u.name}</div>
            <div style="font-size: 11px; color: #64748b;">${u.roll_no}</div>
          </div>
        </div>
        <div style="text-align: right;">
          <span style="font-size: 11px; background: #f1f5f9; color: #475569; padding: 3px 8px; border-radius: 4px; font-weight: 600;">
            ${u.attempts_count !== undefined ? `${u.attempts_count} Mocks` : 'Candidate'}
          </span>
          ${u.id === activeUser.id ? '<span style="color: #008479; font-weight: 800; margin-left: 6px;">✓</span>' : ''}
        </div>
      </div>
    `).join('');

    modal.classList.add('active');
    if (pushHistory) {
      this.pushNavState({ modal: 'user-profile', view: this.currentViewTab }, '#profile');
    }
  }

  async switchCandidate(userId) {
    window.obDataManager.setActiveUser(userId);
    const modal = document.getElementById('user-profile-modal');
    if (modal) modal.classList.remove('active');

    this.renderUserProfileHeader();
    await this.loadAndRenderMockCards();
    await this.renderAnalytics();
    this.showToast('Switched active candidate profile', 'success');
  }

  async handleCreateCandidate(name, targetExam, rollNo) {
    try {
      await window.obDataManager.createUser({
        name: name,
        target_exam: targetExam,
        roll_no: rollNo
      });
      const modal = document.getElementById('user-profile-modal');
      if (modal) modal.classList.remove('active');

      this.renderUserProfileHeader();
      await this.loadAndRenderMockCards();
      await this.renderAnalytics();
      this.showToast(`Created candidate profile for ${name}`, 'success');
    } catch (e) {
      this.showToast('Failed to create candidate profile: ' + e.message, 'error');
    }
  }

  // ==========================================
  // EXAM & CARDS RENDERING
  // ==========================================

  renderHeader() {
    const exam = this.getCurrentExam();
    const btnSelector = document.getElementById('btn-active-exam-selector');
    if (btnSelector) {
      btnSelector.innerHTML = `
        <span class="exam-category-current-label">💻 ${exam.name}</span>
        <i class="fa-solid fa-chevron-down exam-category-chevron"></i>
      `;
    }
    const catName = document.getElementById('current-category-name');
    if (catName) {
      catName.textContent = exam.category || 'Banking & Insurance';
    }
  }

  renderExamHero() {
    const exam = this.getCurrentExam();
    const banner = document.getElementById('exam-hero-banner');
    if (!banner) return;

    const isIbps = exam.id === 'ibps-so';
    const mainTestId = isIbps ? 'ibps-so-it-mains-1' : 'sbi-po-pre-01';
    const mainBtnText = isIbps ? 'Attempt 150-Q Full Mains Mock 🚀' : 'Attempt Free Live Mock 🚀';

    banner.innerHTML = `
      <div class="exam-summary-info">
        <h2>${exam.name} Mock Test Series</h2>
        <p>Comprehensive Online Test Series with Official 2026 Sectional Timings & Marking Schemes.</p>
        <div class="exam-metrics-pills">
          <span class="metric-pill">📝 ${exam.prelimsCount} Prelims Mocks</span>
          <span class="metric-pill">⚡ ${exam.mainsCount} Mains Mocks</span>
          <span class="metric-pill">⏱️ ${exam.sectionalsCount} Sectional Tests</span>
          <span class="metric-pill">🎯 ${exam.topicTestsCount} Topic Drills</span>
          <span class="metric-pill" style="background: rgba(46, 125, 50, 0.4); border: 1px solid #81c784;">🎁 ${exam.freeMocks} Free Tests Available</span>
        </div>
      </div>
      <div style="display: flex; gap: 10px; align-items: center; flex-wrap: wrap;">
        <button class="btn-attempt-live-hero" onclick="window.appController.startMockTest('${mainTestId}')">
          ${mainBtnText}
        </button>
      </div>
    `;
  }

  renderFilterTabs() {
    const tabsContainer = document.getElementById('filter-tabs-bar');
    if (!tabsContainer) return;

    const tabs = [
      { id: "all", label: "All Tests" },
      { id: "prelims", label: "Prelims Full Tests" },
      { id: "mains", label: "Mains Full Tests" },
      { id: "sectional", label: "Sectional Speed Tests" },
      { id: "topic", label: "Topic Tests & Drills" },
      { id: "pyp", label: "Previous Year Papers" }
    ];

    tabsContainer.innerHTML = tabs.map(tab => `
      <a href="javascript:void(0)" class="fltr-tab-link ${tab.id === this.currentFilterTab ? 'active' : ''}" data-tab="${tab.id}">
        ${tab.label}
      </a>
    `).join('');

    tabsContainer.querySelectorAll('.fltr-tab-link').forEach(btn => {
      btn.addEventListener('click', async () => {
        this.currentFilterTab = btn.dataset.tab;
        this.renderFilterTabs();
        await this.loadAndRenderMockCards();
      });
    });
  }

  renderStatusFilterPills() {
    const statusContainer = document.getElementById('status-filter-bar');
    if (!statusContainer) return;

    const pills = [
      { id: "all", label: "All Tests" },
      { id: "unattempted", label: "Unattempted" },
      { id: "attempted", label: "Attempted" },
      { id: "free", label: "Free Tests" }
    ];

    statusContainer.innerHTML = pills.map(p => `
      <button class="fltr-lang-btn ${p.id === this.currentStatusFilter ? 'active' : ''}" data-status="${p.id}">
        ${p.label}
      </button>
    `).join('');

    statusContainer.querySelectorAll('.fltr-lang-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        this.currentStatusFilter = btn.dataset.status;
        this.renderStatusFilterPills();
        await this.loadAndRenderMockCards();
      });
    });
  }

  async loadAndRenderMockCards() {
    const cardsContainer = document.getElementById('mock-cards-container');
    const countLabel = document.getElementById('active-tab-tests-count');
    if (!cardsContainer) return;

    let tests = await window.obDataManager.getTestsList(this.currentExamId);
    if (!tests || tests.length === 0) {
      tests = window.OB_TEST_APP.testPacks.filter(p => p.examId === this.currentExamId);
    }

    this.testsCache = tests;

    let displayPacks = [...tests];
    if (this.currentFilterTab !== "all") {
      displayPacks = displayPacks.filter(p => {
        if (this.currentFilterTab === 'pyp' || this.currentFilterTab === 'pyq') {
          return p.type === 'pyp' || p.type === 'pyq';
        }
        return p.type === this.currentFilterTab;
      });
    }

    if (this.currentStatusFilter === "unattempted") {
      displayPacks = displayPacks.filter(p => !p.isAttempted && !p.isPaused);
    } else if (this.currentStatusFilter === "attempted") {
      displayPacks = displayPacks.filter(p => !!p.isAttempted || !!p.isPaused);
    } else if (this.currentStatusFilter === "free") {
      displayPacks = displayPacks.filter(p => !!(p.is_free || p.isFree));
    }

    if (countLabel) {
      countLabel.textContent = `${displayPacks.length} Tests Available`;
    }

    if (displayPacks.length === 0) {
      cardsContainer.innerHTML = `
        <div style="grid-column: span 2; text-align: center; padding: 48px; background: #ffffff; border-radius: 12px; border: 1px solid var(--ob-app-border);">
          <div style="font-size: 32px; margin-bottom: 8px;">📋</div>
          <h4 style="font-size: 16px; font-weight: 700; color: #1e293b;">No tests found for this filter</h4>
          <p style="font-size: 13px; color: #64748b; margin-bottom: 12px;">Select 'All Tests' or switch status filters above to view available mock tests.</p>
        </div>
      `;
      return;
    }

    cardsContainer.innerHTML = displayPacks.map(pack => {
      const isAttempted = !!pack.isAttempted && !!pack.userAttempt;
      const isPaused = !!pack.isPaused && !!pack.pausedAttempt;
      const att = pack.userAttempt;
      const paused = pack.pausedAttempt;
      const isFree = !!(pack.is_free || pack.isFree);
      const totalQs = pack.questions_count || pack.questionsCount || 100;

      // Determine Top-Right Badge (Spec 1.3: 4 card state variants)
      let topBadgeHTML = '';
      if (isAttempted) {
        topBadgeHTML = '<span class="badge-tag-completed">COMPLETED</span>';
      } else if (isPaused) {
        topBadgeHTML = '<span class="badge-tag-paused">IN PROGRESS</span>';
      } else if (isFree) {
        topBadgeHTML = '<span class="badge-tag-free">FREE</span>';
      } else {
        topBadgeHTML = '<span class="badge-tag-locked">🔒 PRO</span>';
      }

      // Compute 3-color progress bar percentages for completed_attempted
      let correctPct = 0, wrongPct = 0, unattPct = 100;
      if (isAttempted && att) {
        const cCount = att.correct_count ?? 0;
        const wCount = att.wrong_count ?? 0;
        correctPct = Math.min(100, Math.round((cCount / Math.max(1, totalQs)) * 100));
        wrongPct = Math.min(100 - correctPct, Math.round((wCount / Math.max(1, totalQs)) * 100));
        unattPct = Math.max(0, 100 - correctPct - wrongPct);
      }

      // Compute remaining mins for paused_in_progress
      let pausedMinsLeft = 20;
      if (isPaused && paused) {
        const remSec = paused.section_remaining_seconds || paused.remaining_seconds || 1200;
        pausedMinsLeft = Math.max(1, Math.ceil(remSec / 60));
      }

      return `
        <div class="mock-test-card ${isAttempted ? 'card-attempted' : (isPaused ? 'card-paused' : '')}">
          <div>
            <div class="card-top-row">
              <h4 class="mock-title">${pack.title}</h4>
              ${topBadgeHTML}
            </div>
            <p class="mock-desc">${pack.subtitle || 'TCS iON authentic exam simulation'}</p>

            <div class="mock-specs-row">
              <div class="spec-entry"><img class="spec-icon-img" src="img/numq.svg" alt=""> ${totalQs} Questions</div>
              <div class="spec-entry"><img class="spec-icon-img" src="img/marks.svg" alt=""> ${pack.marks} Marks</div>
              <div class="spec-entry"><img class="spec-icon-img" src="img/duration.svg" alt=""> ${pack.duration_minutes || pack.durationMinutes} Mins</div>
            </div>

            <!-- Sections chips -->
            <div style="display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 12px;">
              ${(pack.sections_summary || pack.sections || []).map(s => `
                <span style="font-size: 11px; background: #f1f5f9; color: #475569; padding: 2px 8px; border-radius: 4px; font-weight: 500;">${s}</span>
              `).join('')}
            </div>

            <!-- Variant 3: Paused In-Progress Banner (Spec 1.3) -->
            ${isPaused ? `
              <div class="card-paused-banner">
                <div>
                  <span style="font-weight: 700; color: #0284c7;">⏸ Paused at Section ${(paused.current_section_index ?? 0) + 1}, Q${(paused.current_question_index ?? 0) + 1}</span>
                  <div style="font-size: 11px; color: #475569; margin-top: 2px;">
                    Time Remaining: <strong>${pausedMinsLeft} mins left</strong>
                  </div>
                </div>
              </div>
            ` : ''}

            <!-- Variant 4: Oliveboard Completed Attempted Banner with 3-Color Progress Bar & Legend Dots (course.js renderCompletedTest) -->
            ${isAttempted ? `
              <div class="card-attempt-banner" style="display: block;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                  <div>
                    <span style="font-weight: 800; color: #15803d; font-size: 13px;">${Number(att.score).toFixed(2)}/${pack.marks} <span style="font-weight: 600; color: #475569; font-size: 11px;">Score</span></span>
                    <span style="margin-left: 10px; font-weight: 700; color: #0f172a; font-size: 12px;">${att.accuracy ?? 0}% <span style="font-weight: 600; color: #475569; font-size: 11px;">Accuracy</span></span>
                  </div>
                  <span style="font-size: 11px; color: #334155; font-weight: 600;">Rank: <strong>#${att.estimated_air}</strong> (${att.percentile}%ile)</span>
                </div>
                <div class="attempt-3color-bar" title="Green: Correct (${att.correct_count ?? 0}) | Red: Wrong (${att.wrong_count ?? 0}) | Grey: Skipped (${att.unanswered_count ?? 0})">
                  <div class="seg-correct" style="width: ${correctPct}%;"></div>
                  <div class="seg-wrong" style="width: ${wrongPct}%;"></div>
                  <div class="seg-unattempted" style="width: ${unattPct}%;"></div>
                </div>
                <div style="display: flex; align-items: center; gap: 14px; margin-top: 6px; font-size: 11px; font-weight: 600; color: #334155;">
                  <span style="display: inline-flex; align-items: center; gap: 4px;"><span style="width: 8px; height: 8px; border-radius: 50%; background: #16a34a; display: inline-block;"></span> ${att.correct_count ?? 0} Correct</span>
                  <span style="display: inline-flex; align-items: center; gap: 4px;"><span style="width: 8px; height: 8px; border-radius: 50%; background: #dc2626; display: inline-block;"></span> ${att.wrong_count ?? 0} Wrong</span>
                  <span style="display: inline-flex; align-items: center; gap: 4px;"><span style="width: 8px; height: 8px; border-radius: 50%; background: #94a3b8; display: inline-block;"></span> ${att.unanswered_count ?? 0} Skipped</span>
                </div>
              </div>
            ` : ''}
          </div>

          <div class="mock-card-footer">
            <span class="active-takers">🌐 English, Hindi • 👥 ${(pack.activeUsers || 24800).toLocaleString()}</span>
            
            <div class="mock-card-actions">
              ${isPaused ? `
                <button class="btn-attempt-card" style="background: #0284c7; color: #ffffff;" onclick="window.appController.resumeMockTest('${pack.id}')">
                  Resume Test ▶
                </button>
                <button class="btn-view-scorecard" onclick="window.appController.startMockTest('${pack.id}', true)">
                  Start Fresh
                </button>
              ` : isAttempted ? `
                <button class="btn-attempt-card" style="background: #3476BB; color: #ffffff;" onclick="window.appController.viewSolutions('${att.attempt_id}', '${pack.id}')">
                  Solutions
                </button>
                <button class="btn-view-scorecard" onclick="window.appController.viewAttemptScorecard('${att.attempt_id}', '${pack.id}')">
                  Analytics
                </button>
                <button class="btn-view-scorecard" onclick="window.appController.startMockTest('${pack.id}', true)">
                  Re-attempt
                </button>
              ` : `
                <button class="btn-attempt-card" onclick="window.appController.startMockTest('${pack.id}')">
                  Take Test
                </button>
              `}
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  // ==========================================
  // CANDIDATE ANALYTICS TAB
  // ==========================================

  async renderAnalytics() {
    const container = document.getElementById('analytics-view-container');
    if (!container) return;

    const data = await window.obDataManager.getUserAnalytics();
    const stats = data.stats || data;

    container.innerHTML = `
      <div class="analytics-top-grid">
        <div class="analytics-stat-card">
          <div class="val">${stats.testsAttempted}</div>
          <div class="desc">Tests Attempted</div>
        </div>
        <div class="analytics-stat-card">
          <div class="val" style="color: #008479;">${stats.overallPercentile}</div>
          <div class="desc">Candidate Percentile</div>
        </div>
        <div class="analytics-stat-card">
          <div class="val" style="color: #007bb5;">${stats.avgAccuracy}</div>
          <div class="desc">Average Accuracy</div>
        </div>
        <div class="analytics-stat-card">
          <div class="val" style="color: #ff7a00;">${stats.predictedAIR}</div>
          <div class="desc">Predicted AIR</div>
        </div>
      </div>

      <div style="background: #ffffff; border-radius: 14px; border: 1px solid var(--ob-app-border); padding: 20px; margin-bottom: 20px;">
        <h4 style="font-size: 15px; font-weight: 700; margin-bottom: 14px; color: #0f172a;">Sectional Strength & Weakness Breakdown (Active Candidate)</h4>
        
        ${stats.sectionBreakdowns && stats.sectionBreakdowns.length > 0 ? `
          <div style="display: flex; flex-direction: column; gap: 14px;">
            ${stats.sectionBreakdowns.map(sec => `
              <div>
                <div style="display: flex; justify-content: space-between; font-size: 13px; font-weight: 600; margin-bottom: 4px;">
                  <span>${sec.sectionName}</span>
                  <span style="color: ${parseFloat(sec.accuracy) >= 80 ? '#2e7d32' : (parseFloat(sec.accuracy) >= 60 ? '#008479' : '#e53935')};">
                    ${sec.accuracy}% Accuracy (${sec.correct} Correct, ${sec.wrong} Wrong)
                  </span>
                </div>
                <div style="height: 8px; background: #f1f5f9; border-radius: 999px; overflow: hidden;">
                  <div style="width: ${sec.accuracy}%; height: 100%; background: ${parseFloat(sec.accuracy) >= 80 ? '#2e7d32' : (parseFloat(sec.accuracy) >= 60 ? '#008479' : '#e53935')}; border-radius: 999px;"></div>
                </div>
              </div>
            `).join('')}
          </div>
        ` : `
          <div style="text-align: center; padding: 24px; color: #64748b;">
            <p>No attempts recorded yet for this candidate. Attempt a mock test above to view AI performance analytics and sectional heatmaps!</p>
          </div>
        `}
      </div>
    `;
  }

  renderLeaderboard() {
    const list = document.getElementById('leaderboard-list-container');
    if (!list) return;

    list.innerHTML = window.OB_TEST_APP.leaderboard.map(u => `
      <div style="display: flex; align-items: center; justify-content: space-between; padding: 14px 18px; background: #ffffff; border-radius: 10px; border: 1px solid var(--ob-app-border); margin-bottom: 8px;">
        <div style="display: flex; align-items: center; gap: 14px;">
          <div style="width: 32px; height: 32px; border-radius: 50%; background: ${u.rank === 1 ? '#ffd700' : (u.rank === 2 ? '#e0e0e0' : (u.rank === 3 ? '#cd7f32' : '#f1f5f9'))}; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 13px; color: #1e293b;">
            ${u.rank}
          </div>
          <div>
            <div style="font-size: 14px; font-weight: 700; color: #0f172a;">${u.name}</div>
            <div style="font-size: 12px; color: #64748b;">Time Taken: ${u.time}</div>
          </div>
        </div>
        <div style="text-align: right;">
          <div style="font-size: 16px; font-weight: 800; color: #008479;">${u.score} / 100</div>
          <span style="font-size: 11px; font-weight: 700; color: #2e7d32; background: #e8f5e9; padding: 2px 6px; border-radius: 4px;">Acc: ${u.accuracy}</span>
        </div>
      </div>
    `).join('');
  }

  switchAppView(viewName, pushHistory = true) {
    let target = viewName;
    if (target === 'dashboard') target = 'analytics';

    // Handle Previous Year Papers tab link
    if (target === 'pyp') {
      this.currentFilterTab = 'pyp';
      this.switchAppView('tests', false);
      this.renderFilterTabs();
      this.loadAndRenderMockCards();
      // Highlight PYPs in sidebar
      document.querySelectorAll('#sm-nav-container .sm-nav-item, #ob-sidebar-nav .ob-nav-item').forEach(item => {
        item.classList.toggle('active', item.dataset.view === 'pyp');
      });
      return;
    }

    const validViews = ['tests', 'analytics', 'courses', 'mentorship', 'bookmarks', 'subscription', 'leaderboard'];
    if (!validViews.includes(target)) {
      target = 'tests';
    }

    const isSameView = (target === this.currentViewTab);
    const hasActiveOverlay = this.hasAnyModalOrOverlayOpen();

    this.currentViewTab = target;

    // Toggle main views
    const viewTests = document.getElementById('view-tests');
    const viewAnalytics = document.getElementById('view-analytics');
    const viewCourses = document.getElementById('view-courses');
    const viewMentorship = document.getElementById('view-mentorship');
    const viewBookmarks = document.getElementById('view-bookmarks');
    const viewSubscription = document.getElementById('view-subscription');
    const viewLeaderboard = document.getElementById('view-leaderboard');

    if (viewTests) viewTests.classList.toggle('active', target === 'tests');
    if (viewAnalytics) viewAnalytics.classList.toggle('active', target === 'analytics');
    if (viewCourses) viewCourses.classList.toggle('active', target === 'courses');
    if (viewMentorship) viewMentorship.classList.toggle('active', target === 'mentorship');
    if (viewBookmarks) viewBookmarks.classList.toggle('active', target === 'bookmarks');
    if (viewSubscription) viewSubscription.classList.toggle('active', target === 'subscription');
    if (viewLeaderboard) viewLeaderboard.classList.toggle('active', target === 'leaderboard');

    // Update Header Back Button
    const hdrBackBtn = document.getElementById('hdr-global-back-btn');
    if (hdrBackBtn) {
      hdrBackBtn.style.display = (target !== 'tests') ? 'inline-flex' : 'none';
    }

    // Update Sidebar Navigation state
    document.querySelectorAll('#sm-nav-container .sm-nav-item, #ob-sidebar-nav .ob-nav-item').forEach(item => {
      const v = item.dataset.view;
      const isActive = (v === target || (v === 'analytics' && target === 'analytics') || (v === 'dashboard' && target === 'analytics'));
      item.classList.toggle('active', isActive);
      const img = item.querySelector('img');
      if (img && v === 'tests') {
        img.src = isActive ? 'img/Tests_active.svg' : 'img/Tests.svg';
      }
    });

    // Update Bottom Navigation items (for mobile)
    document.querySelectorAll('#bottom-app-bar .app-nav-item').forEach(item => {
      item.classList.toggle('active', item.dataset.view === target || (item.dataset.view === 'dashboard' && target === 'analytics'));
    });

    // History routing
    if (pushHistory && window.history) {
      if (!isSameView || hasActiveOverlay) {
        const hash = (target === 'tests') ? '' : '#' + target;
        this.pushNavState({ view: target }, window.location.pathname + hash);
      }
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });

    if (target === 'analytics') {
      this.renderAnalytics();
    } else if (target === 'leaderboard') {
      this.renderLeaderboard();
    } else if (target === 'courses') {
      this.renderCourses();
    } else if (target === 'mentorship') {
      this.renderMentorship();
    } else if (target === 'bookmarks') {
      this.renderBookmarks();
    } else if (target === 'subscription') {
      this.renderSubscription();
    }
  }

  // ==========================================
  // DEDICATED APP VIEWS: COURSES, MENTORSHIP, BOOKMARKS, SUBSCRIPTION
  // ==========================================

  renderCourses() {
    const container = document.getElementById('courses-view-container');
    if (!container) return;

    const exam = this.getCurrentExam();
    const courses = [
      {
        id: 'course-selection-2026',
        title: `${exam.name} - Complete Selection Batch 2026`,
        tag: 'LIVE BATCH',
        instructor: 'Deepak Sir & Faculty Team (Ex-SBI / Bank POs)',
        duration: '180+ Hours Live',
        lectures: '150 Live Lectures + 60 Mock Tests',
        rating: '4.9 ★ (12.4k students)',
        price: '₹ 2,499',
        gradient: 'linear-gradient(135deg, #008479 0%, #064e3b 100%)'
      },
      {
        id: 'course-quant-mastery',
        title: 'Quantitative Aptitude & High-Level DI Special Course',
        tag: 'SPECIAL CRASH COURSE',
        instructor: 'Dr. Vivek Sharma (Quantitative Genius)',
        duration: '65+ Hours',
        lectures: '70 Video Classes + 25 Sectionals',
        rating: '4.8 ★ (8.1k students)',
        price: '₹ 1,199',
        gradient: 'linear-gradient(135deg, #1e3a8a 0%, #0f172a 100%)'
      },
      {
        id: 'course-reasoning-puzzles',
        title: 'Reasoning Ability: Advanced Puzzles & Seating Drills',
        tag: 'RECORDED + LIVE SESSIONS',
        instructor: 'Sheetal Ma\'am (Reasoning Specialist)',
        duration: '50+ Hours',
        lectures: '55 Sessions + 400 Puzzle Sets',
        rating: '4.9 ★ (14.2k students)',
        price: '₹ 999',
        gradient: 'linear-gradient(135deg, #581c87 0%, #1e1b4b 100%)'
      },
      {
        id: 'course-super-elite',
        title: 'Banking Super Elite Complete All-Access Pass',
        tag: 'ALL-IN-ONE',
        instructor: 'Oliveboard Master Panel (All Subjects)',
        duration: '500+ Hours',
        lectures: 'Access to All 25+ Bank Courses & 1000+ Mocks',
        rating: '5.0 ★ (45k+ students)',
        price: '₹ 3,999',
        gradient: 'linear-gradient(135deg, #0f172a 0%, #008479 100%)'
      }
    ];

    container.innerHTML = `
      <div class="courses-grid">
        ${courses.map(c => `
          <div class="course-card">
            <div class="course-card-header" style="background: ${c.gradient};">
              <span class="course-badge-live">${c.tag}</span>
              <h4 style="font-size: 16px; font-weight: 700; color: #ffffff; margin: 0 0 6px 0;">${c.title}</h4>
              <div style="font-size: 12px; color: rgba(255,255,255,0.85);">${c.instructor}</div>
            </div>
            <div class="course-card-body">
              <div style="display: flex; flex-direction: column; gap: 8px; margin-bottom: 16px; font-size: 13px; color: #475569;">
                <div style="display: flex; align-items: center; gap: 8px;">
                  <span>⏱️</span> <span><b>${c.duration}</b> interactive learning</span>
                </div>
                <div style="display: flex; align-items: center; gap: 8px;">
                  <span>📚</span> <span><b>${c.lectures}</b></span>
                </div>
                <div style="display: flex; align-items: center; gap: 8px;">
                  <span>⭐</span> <span style="color: #d97706; font-weight: 700;">${c.rating}</span>
                </div>
              </div>
              <div style="display: flex; align-items: center; justify-content: space-between; border-top: 1px solid #f1f5f9; padding-top: 14px;">
                <div>
                  <div style="font-size: 11px; color: #64748b; text-transform: uppercase; font-weight: 600;">Course Fee</div>
                  <div style="font-size: 18px; font-weight: 800; color: #0f172a;">${c.price}</div>
                </div>
                <button onclick="window.appController.enrollCourse('${c.id}', '${c.title}')" style="padding: 9px 18px; background: #008479; color: #ffffff; border: none; border-radius: 8px; font-weight: 700; font-size: 13px; cursor: pointer; transition: all 0.15s ease;">
                  Start Learning 🚀
                </button>
              </div>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }

  enrollCourse(courseId, courseTitle) {
    this.showToast(`Enrolled in "${courseTitle}"! Access unlocked.`, 'success');
  }

  renderMentorship() {
    const container = document.getElementById('mentorship-view-container');
    if (!container) return;

    container.innerHTML = `
      <div class="mentorship-banner">
        <div style="max-width: 600px;">
          <span style="background: rgba(0, 132, 121, 0.3); border: 1px solid #008479; color: #2dd4bf; font-size: 11px; font-weight: 800; padding: 4px 10px; border-radius: 999px; text-transform: uppercase;">Premium 1-on-1 Mentorship</span>
          <h2 style="font-size: 22px; font-weight: 800; color: #ffffff; margin: 10px 0 6px 0;">Accelerate Your Selection with an Assigned Bank Officer Mentor</h2>
          <p style="font-size: 13px; color: #94a3b8; line-height: 1.5; margin: 0;">Get customized daily schedules, 1-on-1 mock interview preparation, weakness diagnosis, and personal doubt resolution every week.</p>
        </div>
        <div>
          <button onclick="window.appController.bookMentorSession()" style="padding: 12px 22px; background: #008479; color: #ffffff; border: none; border-radius: 10px; font-weight: 800; font-size: 14px; cursor: pointer; box-shadow: 0 4px 14px rgba(0,132,121,0.4);">
            📅 Schedule 1-on-1 Call
          </button>
        </div>
      </div>

      <div style="margin-bottom: 24px; background: #ffffff; border-radius: 14px; border: 1.5px solid #008479; padding: 20px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 16px;">
        <div style="display: flex; align-items: center; gap: 16px;">
          <div style="width: 56px; height: 56px; border-radius: 50%; background: #e0f2fe; color: #0284c7; display: flex; align-items: center; justify-content: center; font-size: 24px; font-weight: 800; border: 2px solid #008479;">
            👩‍💼
          </div>
          <div>
            <div style="display: flex; align-items: center; gap: 8px;">
              <h4 style="font-size: 16px; font-weight: 800; color: #0f172a; margin: 0;">S. Priyadarshini Rao</h4>
              <span style="background: #e8f5e9; color: #2e7d32; font-size: 11px; font-weight: 700; padding: 2px 6px; border-radius: 4px;">Assigned Mentor</span>
            </div>
            <div style="font-size: 12px; color: #64748b; margin-top: 2px;">Ex-SBI PO (AIR 18) • 6+ Years Coaching Bank & Specialist Aspirants</div>
            <div style="font-size: 12px; color: #008479; font-weight: 600; margin-top: 4px;">Next Session: Tomorrow at 7:00 PM IST (Strategy & Weakness Review)</div>
          </div>
        </div>
        <div style="display: flex; gap: 10px;">
          <button onclick="window.appController.showToast('Connecting to Google Meet Video Room...', 'info')" style="padding: 9px 16px; background: #008479; color: #ffffff; border: none; border-radius: 8px; font-size: 13px; font-weight: 700; cursor: pointer;">
            🎥 Join Video Room
          </button>
          <button onclick="window.appController.showToast('Customized 30-Day Study Plan PDF downloaded', 'success')" style="padding: 9px 16px; background: #f1f5f9; border: 1px solid #cbd5e1; color: #1e293b; border-radius: 8px; font-size: 13px; font-weight: 700; cursor: pointer;">
            📄 Study Timetable
          </button>
        </div>
      </div>

      <h4 style="font-size: 16px; font-weight: 700; color: #1e293b; margin-bottom: 14px;">Available Top Mentors & Subject Specialists</h4>
      <div class="mentors-grid">
        <div class="mentor-card">
          <div class="mentor-avatar">👨‍💼</div>
          <h4 style="font-size: 15px; font-weight: 800; color: #0f172a; margin: 0 0 4px 0;">Vikram Malhotra</h4>
          <span style="font-size: 12px; color: #008479; font-weight: 600; margin-bottom: 8px;">Ex-IBPS SO IT Officer Scale-II</span>
          <p style="font-size: 12px; color: #64748b; margin-bottom: 14px;">Specialist in Professional Knowledge (DBMS, Networking, OS) & Mains descriptive guidance.</p>
          <button onclick="window.appController.bookMentorSession('Vikram Malhotra')" style="width: 100%; padding: 8px; background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 6px; font-weight: 700; font-size: 12px; cursor: pointer;">Request 1-on-1 Slot</button>
        </div>

        <div class="mentor-card">
          <div class="mentor-avatar">👩‍🏫</div>
          <h4 style="font-size: 15px; font-weight: 800; color: #0f172a; margin: 0 0 4px 0;">Ananya Deshmukh</h4>
          <span style="font-size: 12px; color: #008479; font-weight: 600; margin-bottom: 8px;">RBI Grade B Officer (Rank 9)</span>
          <p style="font-size: 12px; color: #64748b; margin-bottom: 14px;">Specialist in High-Speed Quant DI & Elimination shortcuts under intense exam timer pressure.</p>
          <button onclick="window.appController.bookMentorSession('Ananya Deshmukh')" style="width: 100%; padding: 8px; background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 6px; font-weight: 700; font-size: 12px; cursor: pointer;">Request 1-on-1 Slot</button>
        </div>

        <div class="mentor-card">
          <div class="mentor-avatar">👨‍🏫</div>
          <h4 style="font-size: 15px; font-weight: 800; color: #0f172a; margin: 0 0 4px 0;">Rajeev Nambiar</h4>
          <span style="font-size: 12px; color: #008479; font-weight: 600; margin-bottom: 8px;">Chief Mock Interview Evaluator</span>
          <p style="font-size: 12px; color: #64748b; margin-bottom: 14px;">Specialist in Personality, Banking Awareness, and official IBPS / SBI interview preparation.</p>
          <button onclick="window.appController.bookMentorSession('Rajeev Nambiar')" style="width: 100%; padding: 8px; background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 6px; font-weight: 700; font-size: 12px; cursor: pointer;">Request 1-on-1 Slot</button>
        </div>
      </div>
    `;
  }

  bookMentorSession(mentorName = 'Assigned Mentor') {
    this.showToast(`Session slot requested with ${mentorName}. Check your email for invite!`, 'success');
  }

  renderBookmarks() {
    const container = document.getElementById('bookmarks-view-container');
    if (!container) return;

    const sampleBookmarks = [
      {
        id: 1003,
        testId: 'sbi-po-pre-01',
        section: 'English Language',
        title: 'Parajumble Rearrangement Sequence',
        questionSnippet: 'Rearrange sentences C, E, A, F, B, D to form a coherent paragraph on the Great Pacific Garbage Patch...',
        answerKey: 'Option B (C is opening sentence)',
        difficulty: 'Moderate'
      },
      {
        id: 1025,
        testId: 'ibps-so-it-mains-1',
        section: 'Professional Knowledge',
        title: 'B+ Tree Indexing & Page Splitting Order',
        questionSnippet: 'In a B+ tree of order 4, what is the maximum number of pointers that can be stored in an internal node before splitting occurs?',
        answerKey: 'Order = 4, max pointers = 4, max keys = 3',
        difficulty: 'Hard'
      },
      {
        id: 1032,
        testId: 'sbi-po-sec-quant',
        section: 'Quantitative Aptitude',
        title: 'Missing Number Series with Alternating Cubes & Primes',
        questionSnippet: 'Find the missing number in the series: 7, 16, 41, 90, 171, ?',
        answerKey: 'Pattern: +9 (+3²), +25 (+5²), +49 (+7²), +81 (+9²), +121 (+11²) => 292',
        difficulty: 'Tricky'
      }
    ];

    container.innerHTML = `
      <div class="bookmarks-container">
        ${sampleBookmarks.map(b => `
          <div class="bookmark-card">
            <div style="display: flex; align-items: center; justify-content: space-between;">
              <div style="display: flex; align-items: center; gap: 8px;">
                <span style="background: #e0f2fe; color: #0369a1; font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 4px;">${b.section}</span>
                <span style="background: #fef3c7; color: #b45309; font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 4px;">${b.difficulty}</span>
                <span style="font-size: 12px; color: #64748b;">Source: ${b.testId}</span>
              </div>
              <span style="color: #d97706; font-size: 16px;">★ Saved</span>
            </div>
            <h4 style="font-size: 15px; font-weight: 700; color: #0f172a; margin: 4px 0;">${b.title}</h4>
            <p style="font-size: 13px; color: #475569; margin: 0; line-height: 1.4;">${b.questionSnippet}</p>
            <div style="background: #f8fafc; border-left: 3px solid #008479; padding: 8px 12px; font-size: 12px; color: #1e293b; border-radius: 0 4px 4px 0;">
              <b>Key Takeaway:</b> ${b.answerKey}
            </div>
            <div style="display: flex; justify-content: flex-end; gap: 8px; margin-top: 6px;">
              <button onclick="window.appController.startMockTest('${b.testId}')" style="padding: 6px 14px; background: #008479; color: #ffffff; border: none; border-radius: 6px; font-size: 12px; font-weight: 700; cursor: pointer;">
                Practice Test
              </button>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }

  renderSubscription() {
    const container = document.getElementById('subscription-view-container');
    if (!container) return;

    container.innerHTML = `
      <div style="background: linear-gradient(135deg, #008479 0%, #064e3b 100%); color: #ffffff; border-radius: 16px; padding: 24px 28px; margin-bottom: 24px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 16px;">
        <div>
          <span style="background: rgba(255,255,255,0.2); font-size: 11px; font-weight: 800; padding: 4px 10px; border-radius: 999px; text-transform: uppercase;">Active Membership</span>
          <h2 style="font-size: 24px; font-weight: 800; margin: 8px 0 4px 0;">Banking Super Elite (12 Months)</h2>
          <p style="font-size: 13px; color: rgba(255,255,255,0.9); margin: 0;">Unlimited access to All 25+ Bank & Insurance Mock Tests, Live Video Classes, Sectional Speed Drills, and OliveScore AI Analytics.</p>
        </div>
        <div style="text-align: right;">
          <div style="font-size: 12px; color: rgba(255,255,255,0.8);">Validity Expires</div>
          <div style="font-size: 18px; font-weight: 800;">Oct 24, 2027</div>
          <span style="display: inline-block; margin-top: 4px; background: #22c55e; color: #ffffff; font-size: 11px; font-weight: 800; padding: 2px 8px; border-radius: 4px;">ACTIVE</span>
        </div>
      </div>

      <h3 style="font-size: 18px; font-weight: 800; color: #0f172a; margin-bottom: 16px;">Available Subscription Plans & Upgrades</h3>
      <div class="subscription-plans-grid">
        <div class="sub-plan-card">
          <div>
            <h4 style="font-size: 18px; font-weight: 800; color: #0f172a; margin: 0 0 6px 0;">Banking Elite (Test Series Only)</h4>
            <div style="font-size: 24px; font-weight: 800; color: #008479; margin-bottom: 12px;">₹ 1,999 <span style="font-size: 13px; color: #64748b; font-weight: 500;">/ 12 Months</span></div>
            <ul style="padding-left: 18px; font-size: 13px; color: #475569; display: flex; flex-direction: column; gap: 8px; margin-bottom: 20px;">
              <li>All Prelims & Mains Full Tests for 20+ Bank Exams</li>
              <li>Sectional Tests & Topic Drills</li>
              <li>Previous Year Papers with Official Answers</li>
              <li>OliveScore AIR & Percentile Analytics</li>
            </ul>
          </div>
          <button onclick="window.appController.showToast('You already have higher Super Elite plan active!', 'info')" style="padding: 10px; background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 8px; font-weight: 700; font-size: 13px; color: #475569; cursor: pointer;">
            Included in Current Plan
          </button>
        </div>

        <div class="sub-plan-card featured">
          <div class="sub-badge-popular">MOST POPULAR • CURRENT ACTIVE</div>
          <div>
            <h4 style="font-size: 18px; font-weight: 800; color: #0f172a; margin: 0 0 6px 0;">Banking Super Elite (Courses + Mocks)</h4>
            <div style="font-size: 24px; font-weight: 800; color: #008479; margin-bottom: 12px;">₹ 3,999 <span style="font-size: 13px; color: #64748b; font-weight: 500;">/ 12 Months</span></div>
            <ul style="padding-left: 18px; font-size: 13px; color: #475569; display: flex; flex-direction: column; gap: 8px; margin-bottom: 20px;">
              <li><b>Everything in Banking Elite</b></li>
              <li>All Live Video Classes & Foundation Batches</li>
              <li>High-Level DI & Puzzle Special Sessions</li>
              <li>1-on-1 Mentor Guidance & Doubt Rooms</li>
              <li>Complete PDF Notes & Descriptive Tests</li>
            </ul>
          </div>
          <button style="padding: 10px; background: #008479; color: #ffffff; border: none; border-radius: 8px; font-weight: 800; font-size: 13px; cursor: default;">
            ✓ Active Plan
          </button>
        </div>

        <div class="sub-plan-card">
          <div>
            <h4 style="font-size: 18px; font-weight: 800; color: #0f172a; margin: 0 0 6px 0;">Regulatory Super Elite</h4>
            <div style="font-size: 24px; font-weight: 800; color: #008479; margin-bottom: 12px;">₹ 5,499 <span style="font-size: 13px; color: #64748b; font-weight: 500;">/ 12 Months</span></div>
            <ul style="padding-left: 18px; font-size: 13px; color: #475569; display: flex; flex-direction: column; gap: 8px; margin-bottom: 20px;">
              <li>RBI Grade B Phase 1 & 2 Full Tests</li>
              <li>SEBI Grade A & NABARD Grade A Batches</li>
              <li>ESI & FM Comprehensive Video Classes</li>
              <li>Descriptive English Evaluation with Faculty</li>
            </ul>
          </div>
          <button onclick="window.appController.showToast('Regulatory Pack add-on activated for testing!', 'success')" style="padding: 10px; background: #0f172a; color: #ffffff; border: none; border-radius: 8px; font-weight: 700; font-size: 13px; cursor: pointer;">
            Add Regulatory Pack 🚀
          </button>
        </div>
      </div>
    `;
  }

  // ==========================================
  // EVENT BINDINGS
  // ==========================================

  bindEvents() {
    // Exam selector modal
    const btnSelector = document.getElementById('btn-active-exam-selector');
    const examModal = document.getElementById('exam-switcher-modal');
    const btnCloseExamModal = document.getElementById('btn-close-exam-switcher');

    if (btnSelector && examModal) {
      btnSelector.addEventListener('click', () => {
        this.renderExamSwitcherList();
        examModal.classList.add('active');
        this.pushNavState({ modal: 'exam-switcher', view: this.currentViewTab }, '#exam-switcher');
      });
    }

    if (btnCloseExamModal && examModal) {
      btnCloseExamModal.addEventListener('click', () => {
        this.goBack();
      });
    }

    // Category button
    const btnCategory = document.getElementById('btn-category-selector');
    if (btnCategory && examModal) {
      btnCategory.addEventListener('click', () => {
        this.renderExamSwitcherList();
        examModal.classList.add('active');
        this.pushNavState({ modal: 'exam-switcher', view: this.currentViewTab }, '#exam-switcher');
      });
    }

    // Modal background clicks
    if (examModal) {
      examModal.addEventListener('click', (e) => {
        if (e.target === examModal) this.goBack();
      });
    }

    // App search box
    const searchInput = document.getElementById('app-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase().trim();
        const cards = document.querySelectorAll('#mock-cards-container .mock-test-card');
        cards.forEach(c => {
          const text = c.innerText.toLowerCase();
          c.style.display = text.includes(query) ? '' : 'none';
        });
      });
    }

    // Candidate profile switcher modal
    const btnUserProfile = document.getElementById('btn-user-profile');
    const userModal = document.getElementById('user-profile-modal');
    const btnCloseUserModal = document.getElementById('btn-close-user-modal');
    const formCreateUser = document.getElementById('form-create-user');

    if (btnUserProfile) {
      btnUserProfile.addEventListener('click', () => {
        this.renderUserProfileModal();
      });
    }

    if (btnCloseUserModal && userModal) {
      btnCloseUserModal.addEventListener('click', () => {
        this.goBack();
      });
    }

    if (userModal) {
      userModal.addEventListener('click', (e) => {
        if (e.target === userModal) this.goBack();
      });
    }

    if (formCreateUser) {
      formCreateUser.addEventListener('submit', (e) => {
        e.preventDefault();
        const name = document.getElementById('new-user-name').value;
        const targetExam = document.getElementById('new-user-exam').value;
        const rollNo = document.getElementById('new-user-roll').value;
        this.handleCreateCandidate(name, targetExam, rollNo);
      });
    }

    // Sidebar navigation clicks
    document.querySelectorAll('#sm-nav-container .sm-nav-item, #ob-sidebar-nav .ob-nav-item').forEach(btn => {
      btn.addEventListener('click', () => {
        const view = btn.dataset.view;
        this.switchAppView(view);
      });
    });

    // Bottom Navigation switching (mobile)
    document.querySelectorAll('#bottom-app-bar .app-nav-item').forEach(btn => {
      btn.addEventListener('click', () => {
        const view = btn.dataset.view;
        this.switchAppView(view);
      });
    });

    // ESC key closes modals
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        const obLiveModal = document.getElementById('ob-live-browser-modal');
        const scorecardModal = document.getElementById('scorecard-modal-overlay');
        if ((examModal && examModal.classList.contains('active')) ||
            (userModal && userModal.classList.contains('active')) ||
            (scorecardModal && scorecardModal.classList.contains('active')) ||
            (obLiveModal && obLiveModal.style.display === 'flex')) {
          this.goBack();
        }
      }
    });

    // Bind Interactive Oliveboard Live Browser & RE Engine
    this.bindOliveboardLiveBrowserEvents();
  }

  // ==========================================
  // INTERACTIVE OLIVEBOARD LIVE BROWSER & RE
  // ==========================================

  bindOliveboardLiveBrowserEvents() {
    const btnOpen = document.getElementById('btn-open-ob-live-browser');
    const btnClose = document.getElementById('btn-close-ob-live-browser');
    const modal = document.getElementById('ob-live-browser-modal');
    const screenImg = document.getElementById('ob-live-screen-img');
    const viewportWrapper = document.getElementById('ob-live-viewport-wrapper');
    const urlInput = document.getElementById('ob-live-url-input');
    const btnNavGo = document.getElementById('btn-ob-nav-go');
    const btnNavBack = document.getElementById('btn-ob-nav-back');
    const btnNavReload = document.getElementById('btn-ob-nav-reload');
    const textInput = document.getElementById('ob-live-type-input') || document.getElementById('ob-live-text-input');
    const btnSendText = document.getElementById('btn-ob-send-text');
    const btnPressEnter = document.getElementById('btn-ob-press-enter');
    const btnPressBackspace = document.getElementById('btn-ob-press-backspace');
    const btnPressTab = document.getElementById('btn-ob-press-tab');
    const btnBringFront = document.getElementById('btn-ob-bring-front');
    const btnScrapeNow = document.getElementById('btn-ob-scrape-now');

    // Login Assistant Form Controls
    const credEmail = document.getElementById('ob-cred-email');
    const credPass = document.getElementById('ob-cred-pass');
    const btnFillLogin = document.getElementById('btn-ob-fill-login');
    const btnSwitchLogin = document.getElementById('btn-ob-switch-login-tab');
    const btnSwitchSignup = document.getElementById('btn-ob-switch-signup-tab');

    if (btnFillLogin) {
      const executeFill = async () => {
        const email = credEmail ? credEmail.value.trim() : '';
        const password = credPass ? credPass.value : '';
        if (!email && !password) return;
        await this.sendObBrowserInput({
          action: 'fillLogin',
          email,
          password,
          submit: true
        });
      };
      btnFillLogin.addEventListener('click', executeFill);
      if (credPass) {
        credPass.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            executeFill();
          }
        });
      }
      if (credEmail) {
        credEmail.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            executeFill();
          }
        });
      }
    }

    if (btnSwitchLogin) {
      btnSwitchLogin.addEventListener('click', () => {
        this.sendObBrowserInput({ action: 'switchLoginTab', tab: 'login' });
      });
    }

    if (btnSwitchSignup) {
      btnSwitchSignup.addEventListener('click', () => {
        this.sendObBrowserInput({ action: 'switchLoginTab', tab: 'signup' });
      });
    }

    if (btnOpen && modal) {
      btnOpen.addEventListener('click', () => this.openOliveboardLiveBrowser());
    }

    if (btnClose && modal) {
      btnClose.addEventListener('click', () => this.closeOliveboardLiveBrowser());
    }

    if (btnBringFront) {
      btnBringFront.addEventListener('click', async () => {
        await this.sendObBrowserInput({ action: 'bringToFront' });
      });
    }

    if (btnNavGo && urlInput) {
      btnNavGo.addEventListener('click', () => {
        const target = urlInput.value.trim();
        if (target) this.sendObBrowserInput({ type: 'navigate', url: target });
      });
      urlInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          const target = urlInput.value.trim();
          if (target) this.sendObBrowserInput({ type: 'navigate', url: target });
        }
      });
    }

    if (btnNavBack) {
      btnNavBack.addEventListener('click', () => this.sendObBrowserInput({ type: 'goBack' }));
    }

    if (btnNavReload) {
      btnNavReload.addEventListener('click', () => this.sendObBrowserInput({ type: 'reload' }));
    }

    if (btnSendText && textInput) {
      const sendTyped = async () => {
        const val = textInput.value;
        if (!val) return;
        textInput.value = '';
        await this.sendObBrowserInput({ type: 'type', text: val });
      };
      btnSendText.addEventListener('click', sendTyped);
      textInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          sendTyped();
        }
      });
    }

    if (btnPressEnter) {
      btnPressEnter.addEventListener('click', () => this.sendObBrowserInput({ type: 'keydown', key: 'Enter' }));
    }
    if (btnPressBackspace) {
      btnPressBackspace.addEventListener('click', () => this.sendObBrowserInput({ type: 'keydown', key: 'Backspace' }));
    }
    if (btnPressTab) {
      btnPressTab.addEventListener('click', () => this.sendObBrowserInput({ type: 'keydown', key: 'Tab' }));
    }

    if (screenImg) {
      const getScaledCoords = (e) => {
        const rect = screenImg.getBoundingClientRect();
        // Exact CSS pixel viewport dimensions of the Chromium page (correcting for devicePixelRatio)
        const dpr = this._lastDpr || 1.25;
        const cssW = (this._lastViewport && this._lastViewport.width) || Math.round((screenImg.naturalWidth || 1677) / dpr) || 1342;
        const cssH = (this._lastViewport && this._lastViewport.height) || Math.round((screenImg.naturalHeight || 844) / dpr) || 675;
        const scaleX = cssW / Math.max(1, rect.width);
        const scaleY = cssH / Math.max(1, rect.height);
        return {
          x: Math.round((e.clientX - rect.left) * scaleX),
          y: Math.round((e.clientY - rect.top) * scaleY),
          rawX: e.clientX - rect.left,
          rawY: e.clientY - rect.top
        };
      };

      screenImg.addEventListener('click', (e) => {
        const coords = getScaledCoords(e);
        const dot = document.getElementById('ob-live-click-dot');
        if (dot && viewportWrapper) {
          const wrapperRect = viewportWrapper.getBoundingClientRect();
          dot.style.left = `${e.clientX - wrapperRect.left}px`;
          dot.style.top = `${e.clientY - wrapperRect.top}px`;
          dot.style.display = 'block';
          dot.style.opacity = '1';
          setTimeout(() => {
            dot.style.opacity = '0';
            setTimeout(() => { dot.style.display = 'none'; }, 200);
          }, 300);
        }
        if (viewportWrapper) viewportWrapper.focus();
        this.sendObBrowserInput({ type: 'click', x: coords.x, y: coords.y });
      });

      screenImg.addEventListener('dblclick', (e) => {
        const coords = getScaledCoords(e);
        this.sendObBrowserInput({ type: 'dblclick', x: coords.x, y: coords.y });
      });

      screenImg.addEventListener('wheel', (e) => {
        e.preventDefault();
        this.sendObBrowserInput({ type: 'wheel', deltaX: e.deltaX, deltaY: e.deltaY });
      }, { passive: false });
    }

    if (viewportWrapper) {
      viewportWrapper.addEventListener('keydown', (e) => {
        // Don't hijack typing if user is focused on the URL bar or text input box
        if (document.activeElement === urlInput || document.activeElement === textInput) return;
        // Don't prevent Ctrl+C or DevTools shortcuts
        if ((e.ctrlKey || e.metaKey) && (e.key === 'c' || e.key === 'C' || e.key === 'v' || e.key === 'V' || e.key === 'i' || e.key === 'I')) return;
        e.preventDefault();
        this.sendObBrowserInput({
          type: 'keydown',
          key: e.key,
          ctrlKey: e.ctrlKey,
          altKey: e.altKey,
          metaKey: e.metaKey
        });
      });
    }

    if (btnScrapeNow) {
      btnScrapeNow.addEventListener('click', () => this.scrapeOliveboardLivePage());
    }
  }

  async openOliveboardLiveBrowser(pushHistory = true) {
    const modal = document.getElementById('ob-live-browser-modal');
    const statusBanner = document.getElementById('ob-live-status-banner');
    if (!modal) return;
    modal.style.display = 'flex';
    this._obBrowserActive = true;
    if (pushHistory) {
      this.pushNavState({ modal: 'live-browser', view: this.currentViewTab }, '#live-browser');
    }

    if (statusBanner) {
      statusBanner.textContent = 'Launching persistent Oliveboard Chromium session...';
    }

    try {
      const res = await fetch('/api/ob-browser/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: 'https://www.oliveboard.in/?next=https%3A%2F%2Fu1.oliveboard.in%2Fexams%2F%3Fc%3Dsbipopre19%26i%3Dbanking' })
      });
      const data = await res.json();
      if (data.success && statusBanner) {
        statusBanner.textContent = 'Connected to Oliveboard Live Session! Log in manually on the screen below, open any Mock Test or Solution window, and click "⚡ Reverse-Engineer Current Page".';
      }
    } catch (e) {
      if (statusBanner) statusBanner.textContent = 'Error starting browser: ' + e.message;
    }

    this._pollObBrowserFrame();
  }

  closeOliveboardLiveBrowser(popHistory = true) {
    const modal = document.getElementById('ob-live-browser-modal');
    if (modal) modal.style.display = 'none';
    this._obBrowserActive = false;
    if (this._obFrameTimer) clearTimeout(this._obFrameTimer);

    if (popHistory) {
      this.goBack();
    }
  }

  async _pollObBrowserFrame() {
    if (!this._obBrowserActive) return;
    try {
      const res = await fetch('/api/ob-browser/frame');
      const data = await res.json();
      const imgSrc = data.imageBase64 || (data.image ? `data:image/jpeg;base64,${data.image}` : '');
      if (data.success && imgSrc) {
        if (data.viewport) {
          this._lastViewport = data.viewport;
          this._lastDpr = data.viewport.dpr || 1.25;
        }
        const screenImg = document.getElementById('ob-live-screen-img');
        if (screenImg) {
          screenImg.src = imgSrc;
        }
        const urlInput = document.getElementById('ob-live-url-input');
        if (urlInput && document.activeElement !== urlInput && data.url) {
          urlInput.value = data.url;
        }
        const stageBadge = document.getElementById('ob-live-stage-badge');
        if (stageBadge && data.stage) {
          const stKey = typeof data.stage === 'object' ? data.stage.stage : data.stage;
          const stLabel = typeof data.stage === 'object' ? data.stage.label : data.stage;
          stageBadge.textContent = stLabel || `STAGE: ${String(stKey).toUpperCase()}`;
          stageBadge.style.background = stKey === 'live_test' ? '#dc2626' : (stKey === 'solutions' ? '#16a34a' : '#0284c7');
        }
        this._renderObBrowserTabs(data.tabs || [], data.activeTabIndex || 0);
      }
    } catch (e) {
      // Ignore transient frame poll errors
    }
    if (this._obBrowserActive) {
      this._obFrameTimer = setTimeout(() => this._pollObBrowserFrame(), 450);
    }
  }

  _renderObBrowserTabs(tabs, activeTabIndex = 0) {
    const bar = document.getElementById('ob-live-tabs-bar');
    if (!bar) return;
    const key = JSON.stringify(tabs.map(t => `${t.index}:${t.index === activeTabIndex}:${t.title}`));
    if (this._lastTabsKey === key) return;
    this._lastTabsKey = key;

    bar.innerHTML = tabs.map(t => {
      const isAct = t.active !== undefined ? t.active : (t.index === activeTabIndex);
      return `
        <div style="display: inline-flex; align-items: center; gap: 6px; padding: 3px 10px; border-radius: 4px; font-size: 11px; font-weight: 700; cursor: pointer; background: ${isAct ? '#0284c7' : '#1e293b'}; color: ${isAct ? '#ffffff' : '#94a3b8'}; border: 1px solid ${isAct ? '#38bdf8' : '#334155'};"
             onclick="window.appController.sendObBrowserInput({ action: 'switchTab', tabIndex: ${t.index} })">
          <span>${isAct ? '● ' : ''}${(t.title || t.url || 'Tab ' + (t.index + 1)).slice(0, 32)}</span>
          ${tabs.length > 1 ? `<span onclick="event.stopPropagation(); window.appController.sendObBrowserInput({ action: 'closeTab', tabIndex: ${t.index} })" style="margin-left: 4px; color: #fca5a5; font-weight: 900;">×</span>` : ''}
        </div>
      `;
    }).join('');
  }

  async sendObBrowserInput(payload) {
    try {
      const normalizedPayload = {
        ...payload,
        action: payload.action || payload.type,
        tabIndex: payload.tabIndex !== undefined ? payload.tabIndex : payload.index
      };
      await fetch('/api/ob-browser/input', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(normalizedPayload)
      });
      // Trigger immediate frame refresh after brief render tick
      if (this._obFrameTimer) clearTimeout(this._obFrameTimer);
      setTimeout(() => this._pollObBrowserFrame(), 40);
    } catch (e) {
      console.error('OB browser input error:', e);
    }
  }

  async scrapeOliveboardLivePage() {
    const statusBanner = document.getElementById('ob-live-status-banner');
    const statusFooter = document.getElementById('ob-live-status-msg');
    const scrapeSummary = document.getElementById('ob-live-scrape-summary');
    const btnScrape = document.getElementById('btn-ob-scrape-now');

    const loadingText = '📸 Capturing visual snapshot of active window & deep inspecting all DOM, modals, tables, and questions with REA MCP...';
    if (statusBanner) statusBanner.textContent = loadingText;
    if (statusFooter) statusFooter.textContent = loadingText;
    if (scrapeSummary) scrapeSummary.textContent = '⏳ Processing CDP snapshot & REA extraction...';
    if (btnScrape) {
      btnScrape.disabled = true;
      btnScrape.textContent = '⏳ Capturing Snapshot...';
    }

    try {
      const res = await fetch('/api/ob-browser/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await res.json();
      if (data.success) {
        const r = data.result || data;
        const qCount = r.decryptedQuestionsCount ?? data.questionsExtracted ?? 0;
        const sCount = r.extractedSolutionsCount ?? data.solutionsExtracted ?? 0;
        const mCount = r.modalsDetectedCount ?? 0;
        const tCount = r.tablesDetectedCount ?? 0;
        const saved = r.specFile || data.savedFile || 'scraped/snapshots/';
        const reaEv = r.reaEvidenceId ? ` [REA Evidence: ${r.reaEvidenceId.slice(0, 16)}...]` : '';
        const stageLabel = r.stage ? (r.stage.label || r.stage) : 'Active Screen';

        // Update Snapshot Inspection Bar
        const snapshotBar = document.getElementById('ob-live-snapshot-bar');
        const snapshotThumb = document.getElementById('ob-snapshot-thumb');
        const snapshotLink = document.getElementById('ob-snapshot-link');
        const btnViewSnapshotFull = document.getElementById('btn-view-snapshot-full');
        const btnViewReportJson = document.getElementById('btn-view-report-json');
        const snapshotInfo = document.getElementById('ob-snapshot-info');
        const snapshotBadges = document.getElementById('ob-snapshot-badges');

        if (snapshotBar) {
          snapshotBar.style.display = 'flex';
        }
        if (snapshotThumb && (r.screenshotThumbnail || r.screenshotUrl)) {
          snapshotThumb.src = r.screenshotThumbnail || r.screenshotUrl;
        }
        if (snapshotLink && r.screenshotUrl) {
          snapshotLink.href = r.screenshotUrl;
        }
        if (btnViewSnapshotFull && r.screenshotUrl) {
          btnViewSnapshotFull.href = r.screenshotUrl;
        }
        if (btnViewReportJson && r.specFile) {
          btnViewReportJson.href = '/' + r.specFile;
        }
        if (snapshotInfo) {
          snapshotInfo.innerHTML = `<strong>${stageLabel}</strong> • Snapshot: <a href="${r.screenshotUrl}" target="_blank" style="color: #38bdf8; text-decoration: underline;">${r.screenshotUrl ? r.screenshotUrl.split('/').pop() : 'screenshot.png'}</a>`;
        }
        if (snapshotBadges) {
          const tabsCount = (r.otherTabs ? r.otherTabs.length : 0);
          snapshotBadges.innerHTML = `
            <span style="background: #0284c7; color: #fff; padding: 2px 7px; border-radius: 4px; font-weight: 700; font-size: 10px;">📸 Snapshot Saved</span>
            ${tabsCount > 0 ? `<span style="background: #7c3aed; color: #fff; padding: 2px 7px; border-radius: 4px; font-weight: 700; font-size: 10px;">🗂️ +${tabsCount} Tabs Captured</span>` : ''}
            <span style="background: #1e293b; color: #38bdf8; border: 1px solid #0284c7; padding: 2px 7px; border-radius: 4px; font-size: 10px;">📑 ${mCount} Modals/Dialogs</span>
            <span style="background: #1e293b; color: #4ade80; border: 1px solid #16a34a; padding: 2px 7px; border-radius: 4px; font-size: 10px;">📊 ${tCount} Tables</span>
            <span style="background: #1e293b; color: #fde047; border: 1px solid #ca8a04; padding: 2px 7px; border-radius: 4px; font-size: 10px;">❓ ${qCount} Questions</span>
            <span style="background: #1e293b; color: #a78bfa; border: 1px solid #7c3aed; padding: 2px 7px; border-radius: 4px; font-size: 10px;">📝 ${sCount} Solutions</span>
            ${r.reaEvidenceId ? `<span style="background: #059669; color: #fff; padding: 2px 7px; border-radius: 4px; font-weight: 700; font-size: 10px;" title="${r.reaEvidenceId}">🛡️ REA Verified</span>` : ''}
          `;
        }

        const msg = `✅ Snapshot & Scrape Complete: "${r.title || 'Oliveboard'}" (${qCount} Qs, ${sCount} Solns, ${mCount} Modals, ${tCount} Tables)!${reaEv}`;
        if (statusBanner) statusBanner.textContent = msg;
        if (statusFooter) statusFooter.textContent = msg;
        if (scrapeSummary) scrapeSummary.textContent = `Snapshot saved to ${r.screenshotUrl || 'scraped/snapshots/'}`;
        this.showToast(msg, 'success');

        if (r.ingestedTestId) {
          await this.loadAndRenderMockCards();
        }
      } else {
        throw new Error(data.error || 'Scrape failed');
      }
    } catch (e) {
      if (statusBanner) statusBanner.textContent = '❌ REA Scrape error: ' + e.message;
      if (statusFooter) statusFooter.textContent = '❌ REA Scrape error: ' + e.message;
      this.showToast('REA Scrape error: ' + e.message, 'error');
    } finally {
      if (btnScrape) {
        btnScrape.disabled = false;
        btnScrape.textContent = '📸 Capture Window Snapshot & Rigorous Scrape (REA MCP)';
      }
    }
  }

  renderExamSwitcherList() {
    const list = document.getElementById('exam-switcher-list');
    if (!list) return;

    list.innerHTML = window.OB_TEST_APP.exams.map(ex => `
      <div class="exam-select-item ${ex.id === this.currentExamId ? 'selected' : ''}" onclick="window.appController.selectExam('${ex.id}')">
        <div class="exam-select-info">
          <div class="exam-badge-circ">${ex.icon}</div>
          <div>
            <div style="font-size: 14px; font-weight: 700; color: #0f172a;">${ex.name}</div>
            <div style="font-size: 12px; color: #64748b;">${ex.category} • ${ex.totalMocks} Tests</div>
          </div>
        </div>
        ${ex.id === this.currentExamId ? '<span style="color: #008479; font-weight: 800; font-size: 18px;">✓</span>' : ''}
      </div>
    `).join('');
  }

  async selectExam(examId) {
    this.currentExamId = examId;
    const modal = document.getElementById('exam-switcher-modal');
    if (modal) modal.classList.remove('active');

    this.renderHeader();
    this.renderExamHero();
    await this.loadAndRenderMockCards();
  }

  // ==========================================
  // TEST ENGINE LAUNCH & SCORECARD REVIEW
  // ==========================================

  async startMockTest(testId, forceFresh = false, pushHistory = true) {
    if (forceFresh && window.obDataManager) {
      await window.obDataManager.clearPausedAttempt(testId);
    }

    let testData = await window.obDataManager.getTestById(testId);
    if (!testData) {
      if (window.OB_TEST_APP.mockQuestions && window.OB_TEST_APP.mockQuestions[testId]) {
        testData = window.OB_TEST_APP.mockQuestions[testId];
      } else {
        this.showToast('Unable to load test data for ' + testId, 'error');
        return;
      }
    }

    if (pushHistory) {
      this.pushNavState({ view: 'test-engine', testId }, '#test/' + testId);
    }

    if (window.initTestEngine) {
      this.testEngine = window.initTestEngine(testData);
      this.testEngine.startTest(null);
    }
  }

  async resumeMockTest(testId, pushHistory = true) {
    let testData = await window.obDataManager.getTestById(testId);
    if (!testData && window.OB_TEST_APP.mockQuestions && window.OB_TEST_APP.mockQuestions[testId]) {
      testData = window.OB_TEST_APP.mockQuestions[testId];
    }
    if (!testData) return;

    if (pushHistory) {
      this.pushNavState({ view: 'test-engine', testId }, '#test/' + testId);
    }

    const pausedState = window.obDataManager ? await window.obDataManager.getPausedAttempt(testId) : null;
    if (window.initTestEngine) {
      this.testEngine = window.initTestEngine(testData);
      this.testEngine.startTest(pausedState);
    }
  }

  async viewSolutions(attemptId, testId, pushHistory = true) {
    try {
      const res = await fetch(`/api/attempts/${encodeURIComponent(attemptId)}`);
      const data = await res.json();
      if (!data.success) throw new Error('Attempt not found');

      const testData = await window.obDataManager.getTestById(testId);

      if (pushHistory) {
        this.pushNavState({ view: 'solutions', testId, attemptId }, '#solutions/' + testId);
      }

      if (window.openOliveboardSolutions) {
        window.openOliveboardSolutions(data.attempt, testData);
      }
    } catch (e) {
      console.error('Failed to view solutions:', e);
      this.showToast('Failed to load solutions: ' + e.message, 'error');
    }
  }

  async viewAttemptScorecard(attemptId, testId, pushHistory = true) {
    try {
      const res = await fetch(`/api/attempts/${encodeURIComponent(attemptId)}`);
      const data = await res.json();
      if (!data.success) throw new Error('Attempt not found');

      const testData = await window.obDataManager.getTestById(testId);

      if (pushHistory) {
        this.pushNavState({ modal: 'scorecard', testId, attemptId, view: this.currentViewTab }, '#scorecard/' + attemptId);
      }

      if (!this.testEngine) {
        this.testEngine = window.initTestEngine(testData);
      }
      this.testEngine.showScorecardForAttempt(data.attempt, testData);
    } catch (e) {
      console.error('Failed to view scorecard:', e);
      this.showToast('Failed to load scorecard: ' + e.message, 'error');
    }
  }

  async refreshAnalytics() {
    await this.loadAndRenderMockCards();
    await this.renderAnalytics();
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.appController = new OliveboardAppController();
});
