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
      const activeUser = await window.obDataManager.init();
      if (activeUser && activeUser.target_exam && window.OB_TEST_APP && Array.isArray(window.OB_TEST_APP.exams)) {
        const matchedExam = window.OB_TEST_APP.exams.find(e => e.id === activeUser.target_exam);
        if (matchedExam) {
          this.currentExamId = matchedExam.id;
        }
      }
    }

    // 2. Initial renders
    this.renderUserProfileHeader();
    this.renderHeader();
    this.renderExamHero();
    this.renderFilterTabs();
    this.renderStatusFilterPills();
    await this.loadAndRenderMockCards();
    await this.renderLeaderboard();
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
      return { view: 'solutions', testId };
    }

    if (hash.startsWith('#scorecard/')) {
      const attemptId = hash.replace('#scorecard/', '').split('/')[0];
      return { view: 'tests', modal: 'scorecard', attemptId };
    }

    if (hash === '#analytics' || hash === '#dashboard') {
      return { view: 'analytics' };
    }

    if (hash === '#courses') {
      return { view: 'courses' };
    }

    if (hash === '#mentorship') {
      return { view: 'mentorship' };
    }

    if (hash === '#bookmarks') {
      return { view: 'bookmarks' };
    }

    if (hash === '#subscription') {
      return { view: 'subscription' };
    }

    if (hash === '#pyp') {
      return { view: 'pyp' };
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
    if (rawState && typeof rawState.navStep === 'number') {
      this._currentStep = rawState.navStep;
    } else {
      this._currentStep = 0;
    }

    // Resolve state: if state is null or missing appInitialized, parse from URL
    const state = (rawState && rawState.appInitialized) ? rawState : this.parseLocationToState();

    const testOverlay = document.getElementById('test-modal-overlay');
    const isTestOpen = !!(testOverlay && testOverlay.classList.contains('active'));

    // 1. Live Mock Test Back/Forward Interceptor:
    // If the user is currently inside an active Mock Test and clicks Browser Back/Forward,
    // DO NOT exit directly to dashboard! Keep them in the exam and show the Pause/Exit confirmation dialog.
    if (isTestOpen) {
      if (this.testEngine && this.testEngine.isExamActive) {
        const activeTestId = (this.testEngine.testData && this.testEngine.testData.id) || state.testId || 'test';
        // Re-push the test-engine state so the URL stays on #test/<id> and forward history is cleared
        this.pushNavState({ view: 'test-engine', testId: activeTestId }, '#test/' + activeTestId);

        // If a sub-pane (Submit Summary, Question Paper, Instructions, Profile) is open, close it back to the question first
        const submitPane = document.getElementById('submit-pane');
        const allQPane = document.getElementById('question-list-onbutton');
        const instrPane = document.getElementById('instructions-onbutton');
        const profPane = document.getElementById('candidate-details-onbutton');

        if (submitPane && submitPane.style.display !== 'none') {
          this.testEngine.sBack();
        } else if (
          (allQPane && allQPane.style.display === 'block') ||
          (instrPane && instrPane.style.display === 'block') ||
          (profPane && profPane.style.display === 'block')
        ) {
          this.testEngine.getAllBack();
        } else if (!this.testEngine.isPaused) {
          // Prompt the user with the authentic Oliveboard Pause/Exit confirmation dialog (#calert)
          this.testEngine.pauseTest();
        }
        return;
      } else {
        // User is on Pre-Exam Instructions screen (exam timer hasn't started yet) -> exit cleanly to dashboard
        this.exitTestToDashboard(true);
        return;
      }
    }

    // 2. Prevent Browser Forward / Back from re-entering a closed/exited Mock Test:
    // A mock test must only be started/resumed via explicit user button click, never via popstate.
    if (!isTestOpen && state.view === 'test-engine') {
      this.replaceNavState({ view: 'tests' }, window.location.pathname);
      this.switchAppView('tests', false, true);
      if (this.lastActiveTestId) this.restoreActiveTestScroll(this.lastActiveTestId);
      return;
    }

    // 3. Solutions Console Back/Forward Interceptor:
    const isSolnOpen = (window.obSolutionEngine && window.obSolutionEngine.isOpen) ||
                       (document.getElementById('solution-console-overlay') && document.getElementById('solution-console-overlay').classList.contains('active'));
    if (isSolnOpen) {
      this.exitSolutionsToTests(true);
      return;
    }

    // Prevent Browser Forward / Back from jumping back into closed Solutions Console via stale history
    if (!isSolnOpen && (state.view === 'solutions' || state.view === 'solution-detail')) {
      this.replaceNavState({ view: 'tests' }, window.location.pathname);
      this.switchAppView('tests', false, true);
      if (this.lastActiveTestId) this.restoreActiveTestScroll(this.lastActiveTestId);
      return;
    }

    // Apply the target state for standard dashboard tabs & modals
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
        if (testOverlay && testOverlay.classList.contains('active')) {
          if (this.testEngine) this.testEngine._doExitTest();
        }

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

        if (window.obSolutionEngine && window.obSolutionEngine.isOpen) {
          window.obSolutionEngine.gotoreview(false);
        }
        return;
      }

      if (view === 'test-engine') {
        if (solnOverlay && solnOverlay.classList.contains('active')) {
          if (window.obSolutionEngine) window.obSolutionEngine._doExit();
        }

        if (!testOverlay || !testOverlay.classList.contains('active')) {
          if (state.testId) {
            await this.resumeMockTest(state.testId, false);
          }
        } else {
          if (this.testEngine) {
            this.testEngine.getAllBack();
            this.testEngine.sBack();
          }
        }
        return;
      }

      // 3. For all other views (tests, analytics, leaderboard):
      const wasOverlayOpen = Boolean(
        (solnOverlay && solnOverlay.classList.contains('active')) ||
        (testOverlay && testOverlay.classList.contains('active'))
      );
      if (solnOverlay && solnOverlay.classList.contains('active')) {
        if (window.obSolutionEngine) window.obSolutionEngine._doExit(true);
      }
      if (testOverlay && testOverlay.classList.contains('active')) {
        if (this.testEngine) this.testEngine._doExitTest(true);
      }

      // Switch Main View Tab (preserve scroll if returning to tests)
      this.switchAppView(view, false, view === 'tests' && (wasOverlayOpen || Boolean(this.lastActiveTestId)));
      if (view === 'tests' && wasOverlayOpen) {
        await this.refreshAnalytics(this.lastActiveTestId);
      } else if (view === 'tests' && this.lastActiveTestId && !targetModal) {
        this.restoreActiveTestScroll(this.lastActiveTestId);
      }

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

    // 0. If Scorecard Modal is open on top of Solution Console, close ONLY the Scorecard Modal
    if (scorecardModal && scorecardModal.classList.contains('active') && solnOverlay && solnOverlay.classList.contains('active')) {
      scorecardModal.classList.remove('active');
      return;
    }

    // 1. Solution Console: immediately exit to tests dashboard
    if (solnOverlay && solnOverlay.classList.contains('active')) {
      this.exitSolutionsToTests();
      return;
    }

    // 2. Test Engine: exit if on instructions, or prompt pause confirmation if active
    if (testOverlay && testOverlay.classList.contains('active')) {
      if (this.testEngine) {
        if (!this.testEngine.isExamActive) {
          this.exitTestToDashboard();
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

    if (this._currentStep > 0) {
      window.history.back();
      return;
    }

    if (hasModalOpen || hasOverlayOpen) {
      this.closeAllModalsAndOverlays();
      this.switchAppView('tests', false, true);
      window.history.replaceState({ view: 'tests', navStep: 0, appInitialized: true }, '', window.location.pathname);
      if (this.lastActiveTestId) {
        this.restoreActiveTestScroll(this.lastActiveTestId);
      }
    } else if (isSubView) {
      this.switchAppView('tests', false, Boolean(this.lastActiveTestId));
      window.history.replaceState({ view: 'tests', navStep: 0, appInitialized: true }, '', window.location.pathname);
      if (this.lastActiveTestId) {
        this.restoreActiveTestScroll(this.lastActiveTestId);
      }
    } else {
      this.showToast('You are on the Home dashboard', 'info');
    }
  }

  async exitTestToDashboard(fromPopstate = false) {
    const targetTestId = (this.testEngine && this.testEngine.testData && this.testEngine.testData.id) || this.lastActiveTestId;
    if (targetTestId) {
      this.lastActiveTestId = targetTestId;
    }
    if (this.testEngine) {
      this.testEngine._doExitTest(true);
    }
    const testOverlay = document.getElementById('test-modal-overlay');
    if (testOverlay) {
      testOverlay.classList.remove('active');
    }
    this.switchAppView('tests', false, true);
    this.replaceNavState({ view: 'tests' }, window.location.pathname);
    if (fromPopstate) {
      this.pushNavState({ view: 'tests' }, window.location.pathname);
    }
    await this.refreshAnalytics(targetTestId);
  }

  async exitSolutionsToTests(fromPopstate = false) {
    const targetTestId = (window.obSolutionEngine && window.obSolutionEngine.testData && window.obSolutionEngine.testData.id) || this.lastActiveTestId;
    if (targetTestId) {
      this.lastActiveTestId = targetTestId;
    }
    if (window.obSolutionEngine) {
      window.obSolutionEngine._doExit(true);
    }
    const solnOverlay = document.getElementById('solution-console-overlay');
    if (solnOverlay) {
      solnOverlay.classList.remove('active');
      solnOverlay.style.display = 'none';
    }
    const scorecardModal = document.getElementById('scorecard-modal-overlay');
    if (scorecardModal) scorecardModal.classList.remove('active');

    this.switchAppView('tests', false, true);
    this.replaceNavState({ view: 'tests' }, window.location.pathname);
    if (fromPopstate) {
      this.pushNavState({ view: 'tests' }, window.location.pathname);
    }
    await this.refreshAnalytics(targetTestId);
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
    const dropdownAvatarEl = document.getElementById('dropdown-user-avatar');
    const avatarChar = user.avatar || (user.name ? user.name.charAt(0).toUpperCase() : 'U');

    if (nameEl) nameEl.textContent = user.name;
    if (rollEl) rollEl.textContent = user.roll_no;
    if (avatarEl) avatarEl.textContent = avatarChar;
    if (dropdownAvatarEl) dropdownAvatarEl.textContent = avatarChar;

    const coinsEl = document.getElementById('header-user-coins');
    if (coinsEl) coinsEl.textContent = user.coins !== undefined ? user.coins : 300;

    const tagEl = document.getElementById('analytics-user-tag');
    if (tagEl) tagEl.textContent = `Showing performance analytics for: ${user.name} (${user.roll_no})`;
  }

  async renderUserProfileModal(pushHistory = true) {
    const modal = document.getElementById('user-profile-modal');
    const activeBox = document.getElementById('active-user-profile-box');
    const usersList = document.getElementById('users-selection-list');
    if (!modal || !activeBox || !usersList) return;

    if (window.obDataManager && typeof window.obDataManager.loadUsers === 'function') {
      await window.obDataManager.loadUsers();
    }

    const activeUser = window.obDataManager.getActiveUser();
    const allUsers = window.obDataManager.users || [];
    if (!activeUser) return;

    // Active candidate banner
    activeBox.innerHTML = `
      <div style="display: flex; align-items: center; gap: 12px;">
        <div style="width: 44px; height: 44px; border-radius: 50%; background: #008479; color: #ffffff; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 18px;">
          ${activeUser.avatar || activeUser.name.charAt(0)}
        </div>
        <div>
          <div style="font-size: 15px; font-weight: 800; color: #0f172a;">${activeUser.name} <span style="font-size: 10px; background: #008479; color: #ffffff; padding: 2px 6px; border-radius: 4px; margin-left: 4px;">ACTIVE CANDIDATE</span></div>
          <div style="font-size: 12px; color: #64748b;">${activeUser.roll_no} • Target: ${(activeUser.target_exam || 'ibps-so').toUpperCase()}</div>
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
            <div style="font-size: 11px; color: #64748b;">${u.roll_no} • ${(u.target_exam || 'ibps-so').toUpperCase()}</div>
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

  _resetPerCandidateUIState() {
    // Clear per-candidate interactive bookmark attempts & filters
    this.bookmarkAttempts = {};
    this.activeBookmarkSubject = 'ALL';
    this.activeBookmarkTag = 'ALL';
    this.bookmarkSearchQuery = '';

    // Sync bookmarked question maps on active engine instances
    const bmMap = window.obDataManager ? window.obDataManager.getBookmarkedMap() : {};
    if (this.testEngine) {
      this.testEngine.bookmarkedQuestions = bmMap;
    }
    if (window.obSolutionEngine) {
      window.obSolutionEngine.bookmarkedQuestions = { ...bmMap };
      window.obSolutionEngine.retryAttempts = {};
    }

    // Sync currentExamId with active candidate's target_exam
    const activeUser = window.obDataManager ? window.obDataManager.getActiveUser() : null;
    if (activeUser && activeUser.target_exam && window.OB_TEST_APP && Array.isArray(window.OB_TEST_APP.exams)) {
      const matchedExam = window.OB_TEST_APP.exams.find(e => e.id === activeUser.target_exam);
      if (matchedExam) {
        this.currentExamId = matchedExam.id;
      }
    }
  }

  async switchCandidate(userId) {
    const switchedUser = window.obDataManager.setActiveUser(userId);
    const modal = document.getElementById('user-profile-modal');
    if (modal) modal.classList.remove('active');

    this._resetPerCandidateUIState();
    this.renderUserProfileHeader();
    this.renderHeader();
    this.renderExamHero();
    await this.loadAndRenderMockCards();
    await this.renderAnalytics();
    await this.renderLeaderboard();
    if (this.currentViewTab === 'bookmarks') {
      this.renderBookmarks();
    } else if (this.currentViewTab === 'courses') {
      this.renderCourses();
    }
    this.showToast(`Switched active candidate to ${switchedUser ? switchedUser.name : 'candidate'}`, 'success');
  }

  async handleCreateCandidate(name, targetExam, rollNo) {
    try {
      await window.obDataManager.createUser({
        name: name,
        target_exam: targetExam,
        roll_no: rollNo
      });
      const formEl = document.getElementById('form-create-user');
      if (formEl) formEl.reset();

      const modal = document.getElementById('user-profile-modal');
      if (modal) modal.classList.remove('active');

      this._resetPerCandidateUIState();
      this.renderUserProfileHeader();
      this.renderHeader();
      this.renderExamHero();
      await this.loadAndRenderMockCards();
      await this.renderAnalytics();
      await this.renderLeaderboard();
      if (this.currentViewTab === 'bookmarks') {
        this.renderBookmarks();
      } else if (this.currentViewTab === 'courses') {
        this.renderCourses();
      }
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
      btnSelector.title = `Active Exam: ${exam.name} (Click to switch)`;
      btnSelector.innerHTML = `
        <span class="exam-category-current-label" id="active-exam-title">💻 ${exam.name}</span>
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

  async loadAndRenderMockCards(focusTestId = null) {
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

      // Compute 3-color progress bar percentages & synchronized Rank/Percentile for completed_attempted
      let correctPct = 0, wrongPct = 0, unattPct = 100;
      let displayAIR = att ? att.estimated_air : 1000;
      let displayPercentile = att ? att.percentile : 0;
      let displayActiveUsers = pack.activeUsers || 24800;

      if (window.OB_EXAM_PATTERNS_2026 && typeof window.OB_EXAM_PATTERNS_2026.calculateTestRankAndPercentile === 'function') {
        const rankInfo = window.OB_EXAM_PATTERNS_2026.calculateTestRankAndPercentile({
          testId: pack.id,
          testTitle: pack.title,
          testType: pack.type,
          score: att ? att.score : 0,
          maxScore: pack.marks || 100,
          correctCount: att ? att.correct_count : 0,
          wrongCount: att ? att.wrong_count : 0,
          unansweredCount: att ? att.unanswered_count : totalQs,
          totalQuestions: totalQs,
          accuracy: att ? att.accuracy : 0,
          activeUsers: pack.activeUsers
        });
        displayActiveUsers = rankInfo.totalCandidates;
        if (isAttempted && att) {
          displayAIR = rankInfo.estimatedAIR;
          displayPercentile = rankInfo.percentile;
          att.estimated_air = rankInfo.estimatedAIR;
          att.percentile = rankInfo.percentile;
        }
      }

      if (isAttempted && att) {
        const cCount = att.correct_count ?? 0;
        const wCount = att.wrong_count ?? 0;
        correctPct = Math.min(100, Math.round((cCount / Math.max(1, totalQs)) * 100));
        wrongPct = Math.min(100 - correctPct, Math.round((wCount / Math.max(1, totalQs)) * 100));
        unattPct = Math.max(0, 100 - correctPct - wrongPct);
      }

      // Compute remaining mins for paused_in_progress
      let pausedMinsLeft = 20;
      let pausedSecIdx = 0;
      let pausedQIdx = 0;
      if (isPaused && paused) {
        const remSec = paused.sectionRemainingSeconds ?? paused.section_remaining_seconds ?? paused.remainingSeconds ?? paused.remaining_seconds ?? 1200;
        pausedMinsLeft = Math.max(1, Math.ceil(remSec / 60));
        pausedSecIdx = paused.currentSectionIndex ?? paused.current_section_index ?? 0;
        pausedQIdx = paused.currentQuestionIndex ?? paused.current_question_index ?? 0;
      }

      return `
        <div class="mock-test-card ${isAttempted ? 'card-attempted' : (isPaused ? 'card-paused' : '')}" id="mock-card-${pack.id}" data-test-id="${pack.id}">
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
                  <span style="font-weight: 700; color: #0284c7;">⏸ Paused at Section ${pausedSecIdx + 1}, Q${pausedQIdx + 1}</span>
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
                  <span style="font-size: 11px; color: #334155; font-weight: 600;">Rank: <strong>#${Number(displayAIR).toLocaleString()}/${Number(displayActiveUsers).toLocaleString()}</strong> (${Number(displayPercentile).toFixed(1)}%ile)</span>
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
            <span class="active-takers">🌐 English, Hindi • 👥 ${Number(displayActiveUsers).toLocaleString()}</span>
            
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

    const targetFocusId = focusTestId || this._pendingFocusTestId;
    if (targetFocusId) {
      this._pendingFocusTestId = null;
      this.restoreActiveTestScroll(targetFocusId);
    }
  }

  restoreActiveTestScroll(testId) {
    if (!testId) return;
    requestAnimationFrame(() => {
      const cardEl = document.getElementById(`mock-card-${testId}`) ||
                     document.querySelector(`.mock-test-card[data-test-id="${CSS.escape ? CSS.escape(testId) : testId}"]`);
      if (cardEl) {
        cardEl.scrollIntoView({ behavior: 'instant', block: 'center' });
        cardEl.style.transition = 'box-shadow 0.3s ease, border-color 0.3s ease';
        cardEl.style.borderColor = '#008479';
        cardEl.style.boxShadow = '0 0 0 3px rgba(0, 132, 121, 0.28), 0 8px 20px rgba(0, 132, 121, 0.12)';
        setTimeout(() => {
          if (cardEl) {
            cardEl.style.borderColor = '';
            cardEl.style.boxShadow = '';
          }
        }, 2200);
      } else if (typeof this.savedTestsScrollY === 'number' && this.savedTestsScrollY > 0) {
        window.scrollTo({ top: this.savedTestsScrollY, behavior: 'instant' });
      }
    });
  }

  // ==========================================
  // CANDIDATE ANALYTICS TAB
  // ==========================================

  async renderAnalytics() {
    const container = document.getElementById('analytics-view-container');
    if (!container) return;

    const data = await window.obDataManager.getUserAnalytics();
    const stats = data.stats || data;

    const streakEl = document.getElementById('header-user-streak');
    if (streakEl) {
      streakEl.textContent = `${stats.streakDays !== undefined ? stats.streakDays : 1}d`;
    }

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

  async renderLeaderboard() {
    const list = document.getElementById('leaderboard-list-container');
    if (!list) return;

    const baseLeaderboard = [...(window.OB_TEST_APP.leaderboard || [])];
    const activeUser = window.obDataManager ? window.obDataManager.getActiveUser() : null;
    const activeUserId = activeUser ? activeUser.id : null;

    // Fetch real multi-user attempts from SQLite across all registered candidates
    const dbEntries = window.obDataManager && typeof window.obDataManager.getLeaderboard === 'function'
      ? await window.obDataManager.getLeaderboard('all')
      : [];

    const combined = baseLeaderboard.map(u => ({
      ...u,
      rawScoreDisplay: `${u.score} / 100`,
      isCurrentUser: false,
      isRegisteredCandidate: false
    }));

    const addedUserIds = new Set();
    if (Array.isArray(dbEntries) && dbEntries.length > 0) {
      dbEntries.forEach(entry => {
        const isCurrent = activeUserId && entry.userId === activeUserId;
        addedUserIds.add(entry.userId);
        combined.push({
          name: `${entry.userName} (${isCurrent ? 'You • ' : 'Candidate • '}${entry.testTitle})`,
          score: entry.normScore,
          rawScoreDisplay: `${Number(entry.rawScore).toFixed(2)} / ${entry.maxScore}`,
          accuracy: entry.accuracy,
          time: entry.time,
          isCurrentUser: Boolean(isCurrent),
          isRegisteredCandidate: true
        });
      });
    }

    // Fallback: if active candidate has a local attempt in testsCache not yet in dbEntries
    if (activeUserId && !addedUserIds.has(activeUserId) && this.testsCache && this.testsCache.length > 0) {
      const attemptedPacks = this.testsCache.filter(p => p.isAttempted && p.userAttempt);
      if (attemptedPacks.length > 0) {
        attemptedPacks.sort((a, b) => Number(b.userAttempt.score || 0) - Number(a.userAttempt.score || 0));
        const bestPack = attemptedPacks[0];
        const att = bestPack.userAttempt;
        const maxM = bestPack.marks || 100;
        const normScore = Number(((Number(att.score || 0) / Math.max(1, maxM)) * 100).toFixed(2));
        const secs = att.time_spent_seconds || 2400;
        const m = Math.floor(secs / 60);
        const s = secs % 60;
        combined.push({
          name: `${activeUser ? activeUser.name : 'You'} (You • ${bestPack.title})`,
          score: normScore,
          rawScoreDisplay: `${Number(att.score || 0).toFixed(2)} / ${maxM}`,
          accuracy: `${att.accuracy ?? 0}%`,
          time: `${m}m ${s}s`,
          isCurrentUser: true,
          isRegisteredCandidate: true
        });
      }
    }

    combined.sort((a, b) => Number(b.score) - Number(a.score));
    combined.forEach((entry, idx) => {
      entry.rank = idx + 1;
    });

    list.innerHTML = combined.map(u => `
      <div style="display: flex; align-items: center; justify-content: space-between; padding: 14px 18px; background: ${u.isCurrentUser ? '#f0fdfa' : (u.isRegisteredCandidate ? '#f8fafc' : '#ffffff')}; border-radius: 10px; border: ${u.isCurrentUser ? '1.5px solid #008479' : (u.isRegisteredCandidate ? '1px solid #94a3b8' : '1px solid var(--ob-app-border)')}; margin-bottom: 8px;">
        <div style="display: flex; align-items: center; gap: 14px;">
          <div style="width: 32px; height: 32px; border-radius: 50%; background: ${u.rank === 1 ? '#ffd700' : (u.rank === 2 ? '#e0e0e0' : (u.rank === 3 ? '#cd7f32' : (u.isCurrentUser ? '#008479' : '#f1f5f9')))}; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 13px; color: ${u.isCurrentUser && u.rank > 3 ? '#ffffff' : '#1e293b'};">
            ${u.rank}
          </div>
          <div>
            <div style="font-size: 14px; font-weight: 700; color: #0f172a;">${u.name}</div>
            <div style="font-size: 12px; color: #64748b;">Time Taken: ${u.time}</div>
          </div>
        </div>
        <div style="text-align: right;">
          <div style="font-size: 16px; font-weight: 800; color: #008479;">${u.rawScoreDisplay}</div>
          <span style="font-size: 11px; font-weight: 700; color: #2e7d32; background: #e8f5e9; padding: 2px 6px; border-radius: 4px;">Acc: ${u.accuracy}</span>
        </div>
      </div>
    `).join('');
  }

  switchAppView(viewName, pushHistory = true, preserveScroll = false) {
    let target = viewName;
    if (target === 'dashboard') target = 'analytics';

    // Handle Previous Year Papers tab link
    if (target === 'pyp') {
      this.currentFilterTab = 'pyp';
      this.switchAppView('tests', false);
      this.renderFilterTabs();
      this.loadAndRenderMockCards();
      // Highlight PYPs in sidebar and reset Tests icon
      document.querySelectorAll('#sm-nav-container .sm-nav-item, #ob-sidebar-nav .ob-nav-item').forEach(item => {
        const isPyp = item.dataset.view === 'pyp';
        item.classList.toggle('active', isPyp);
        const img = item.querySelector('img');
        if (img && item.dataset.view === 'tests') {
          img.src = 'img/Tests.svg';
        }
      });
      return;
    }

    if (target === 'tests' && pushHistory && this.currentFilterTab === 'pyp') {
      this.currentFilterTab = 'all';
      this.renderFilterTabs();
      this.loadAndRenderMockCards();
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
      const isActive = (
        (v === 'tests' && target === 'tests' && this.currentFilterTab !== 'pyp') ||
        (v === 'pyp' && target === 'tests' && this.currentFilterTab === 'pyp') ||
        (v !== 'tests' && v !== 'pyp' && (v === target || (v === 'analytics' && target === 'analytics') || (v === 'dashboard' && target === 'analytics')))
      );
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

    if (!preserveScroll) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

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

    if (!this.activeBookmarkSubject) this.activeBookmarkSubject = 'ALL';
    if (!this.activeBookmarkTag) this.activeBookmarkTag = 'ALL';
    if (!this.bookmarkSearchQuery) this.bookmarkSearchQuery = '';
    if (!this.bookmarkAttempts) this.bookmarkAttempts = {};

    const bookmarks = window.obDataManager ? window.obDataManager.getBookmarks() : [];

    if (!bookmarks || bookmarks.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: 48px 24px; background: #ffffff; border-radius: 14px; border: 1px solid var(--ob-app-border); margin-top: 16px;">
          <div style="font-size: 36px; margin-bottom: 10px;">⭐</div>
          <h4 style="font-size: 16px; font-weight: 700; color: #0f172a; margin: 0 0 6px 0;">No Saved Bookmarks Yet</h4>
          <p style="font-size: 13px; color: #64748b; max-width: 460px; margin: 0 auto 16px auto;">Click the <b>★ Bookmark</b> button on any question inside the Live Mock Test or Solution Window to automatically store it by subject for quick revision.</p>
          <button onclick="window.appController.switchAppView('tests')" style="padding: 9px 18px; background: #008479; color: #ffffff; border: none; border-radius: 8px; font-size: 13px; font-weight: 700; cursor: pointer;">
            Explore Mock Tests
          </button>
        </div>
      `;
      return;
    }

    const canonicalSubjects = window.obDataManager && typeof window.obDataManager.getCanonicalSubjects === 'function'
      ? window.obDataManager.getCanonicalSubjects()
      : ['Quantitative Aptitude', 'Reasoning Ability', 'English Language', 'Professional Knowledge', 'General Awareness'];

    // Count bookmarks per subject
    const subjectCounts = { ALL: bookmarks.length };
    canonicalSubjects.forEach(s => { subjectCounts[s] = 0; });
    const allCustomTagsSet = new Set();

    bookmarks.forEach(b => {
      const subj = b.subject || (window.obDataManager ? window.obDataManager.normalizeSubjectCategory(b.section, b.testTitle, b.questionSnippet) : 'General Awareness');
      subjectCounts[subj] = (subjectCounts[subj] || 0) + 1;
      if (Array.isArray(b.customTags)) {
        b.customTags.forEach(t => { if (t) allCustomTagsSet.add(t); });
      }
    });

    // If active subject filter has 0 items after a deletion, reset to ALL
    if (this.activeBookmarkSubject !== 'ALL' && !subjectCounts[this.activeBookmarkSubject]) {
      this.activeBookmarkSubject = 'ALL';
    }

    const allCustomTags = Array.from(allCustomTagsSet);
    if (this.activeBookmarkTag !== 'ALL' && !allCustomTags.includes(this.activeBookmarkTag)) {
      this.activeBookmarkTag = 'ALL';
    }

    // Filter bookmarks by Subject, Custom Tag, and Search Query
    const qLower = (this.bookmarkSearchQuery || '').trim().toLowerCase();
    const filteredBookmarks = bookmarks.filter(b => {
      const subj = b.subject || 'General Awareness';
      if (this.activeBookmarkSubject !== 'ALL' && subj !== this.activeBookmarkSubject) {
        return false;
      }
      if (this.activeBookmarkTag !== 'ALL') {
        const tags = Array.isArray(b.customTags) ? b.customTags : [];
        if (!tags.includes(this.activeBookmarkTag)) return false;
      }
      if (qLower) {
        const hay = `${b.title || ''} ${b.questionSnippet || ''} ${b.questionHTML || ''} ${b.testTitle || ''} ${b.subject || ''} ${(b.customTags || []).join(' ')}`.toLowerCase();
        if (!hay.includes(qLower)) return false;
      }
      return true;
    });

    const subjectBadgeColors = {
      'Quantitative Aptitude': { bg: '#eff6ff', text: '#1d4ed8', border: '#bfdbfe' },
      'Reasoning Ability': { bg: '#f5f3ff', text: '#6d28d9', border: '#ddd6fe' },
      'English Language': { bg: '#ecfdf5', text: '#047857', border: '#a7f3d0' },
      'Professional Knowledge': { bg: '#fff7ed', text: '#c2410c', border: '#fed7aa' },
      'General Awareness': { bg: '#fef2f2', text: '#b91c1c', border: '#fecaca' }
    };

    const presetTags = ['Formula', 'Tricky', 'Speed Math', 'Must Revise'];

    container.innerHTML = `
      <!-- Subject Filter Tabs Bar -->
      <div class="bm-hub-header-card">
        <div class="bm-subject-tabs-row">
          <button class="bm-subject-tab ${this.activeBookmarkSubject === 'ALL' ? 'active' : ''}"
                  onclick="window.appController.setBookmarkSubjectFilter('ALL')">
            <span>All Subjects</span>
            <span class="bm-tab-count">${subjectCounts.ALL}</span>
          </button>
          ${canonicalSubjects.map(subj => {
            const count = subjectCounts[subj] || 0;
            const isActive = this.activeBookmarkSubject === subj;
            const safeSubj = subj.replace(/'/g, "\\'");
            return `
              <button class="bm-subject-tab ${isActive ? 'active' : ''}"
                      onclick="window.appController.setBookmarkSubjectFilter('${safeSubj}')">
                <span>${subj}</span>
                <span class="bm-tab-count">${count}</span>
              </button>
            `;
          }).join('')}
        </div>

        <!-- Search & Custom Tag Filter Strip -->
        <div class="bm-filter-toolbar">
          <div class="bm-search-box">
            <input type="text"
                   id="bm-search-input"
                   placeholder="Search bookmarked questions by topic, keyword, or exam..."
                   value="${String(this.bookmarkSearchQuery || '').replace(/"/g, '&quot;')}"
                   oninput="window.appController.setBookmarkSearchQuery(this.value)" />
            ${this.bookmarkSearchQuery ? `
              <button class="bm-search-clear" onclick="window.appController.setBookmarkSearchQuery('')" title="Clear search">✕</button>
            ` : ''}
          </div>
          <div class="bm-tag-filters">
            <span class="bm-tag-filter-label">Tag Filter:</span>
            <button class="bm-tag-chip-filter ${this.activeBookmarkTag === 'ALL' ? 'active' : ''}"
                    onclick="window.appController.setBookmarkTagFilter('ALL')">
              All (${bookmarks.length})
            </button>
            ${allCustomTags.map(tag => {
              const safeTag = String(tag).replace(/'/g, "\\'");
              const isAct = this.activeBookmarkTag === tag;
              return `
                <button class="bm-tag-chip-filter ${isAct ? 'active' : ''}"
                        onclick="window.appController.setBookmarkTagFilter('${safeTag}')">
                  #${tag}
                </button>
              `;
            }).join('')}
          </div>
        </div>
      </div>

      <!-- Bookmarked Questions List -->
      <div class="bookmarks-container">
        ${filteredBookmarks.length === 0 ? `
          <div style="text-align: center; padding: 36px 20px; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0;">
            <div style="font-size: 15px; font-weight: 700; color: #0f172a; margin-bottom: 6px;">No bookmarked questions match this filter</div>
            <p style="font-size: 13px; color: #64748b; margin: 0 0 14px 0;">Try switching to "All Subjects" or clearing the tag/search filter.</p>
            <button onclick="window.appController.resetBookmarkFilters()" style="padding: 7px 16px; background: #008479; color: #ffffff; border: none; border-radius: 6px; font-size: 12px; font-weight: 700; cursor: pointer;">
              Show All Bookmarks (${bookmarks.length})
            </button>
          </div>
        ` : filteredBookmarks.map(b => {
          const safeQId = String(b.id).replace(/'/g, "\\'");
          const safeTestId = String(b.testId || 'sbi-po-pre-01').replace(/'/g, "\\'");
          const subj = b.subject || 'General Awareness';
          const subjStyle = subjectBadgeColors[subj] || { bg: '#e0f2fe', text: '#0369a1', border: '#bae6fd' };
          const attemptState = this.bookmarkAttempts[b.id] || { selectedIdx: null, showSolution: false };
          const hasAttempted = attemptState.selectedIdx !== null && attemptState.selectedIdx !== undefined;
          const corIdx = typeof b.correctIndex === 'number' ? b.correctIndex : 0;
          const isAttemptCorrect = hasAttempted && attemptState.selectedIdx === corIdx;
          const corLetter = String.fromCharCode(65 + corIdx);
          const optionsArr = Array.isArray(b.options) && b.options.length > 0
            ? b.options
            : ['Option A', 'Option B', 'Option C', 'Option D', 'Option E'];
          const tagsArr = Array.isArray(b.customTags) ? b.customTags : [];

          return `
            <div class="bookmark-card" id="bm-card-${b.id}">
              <!-- Top Metadata & Subject Reassignment Header -->
              <div class="bm-card-top-bar">
                <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                  <span class="bm-subject-pill" style="background: ${subjStyle.bg}; color: ${subjStyle.text}; border: 1px solid ${subjStyle.border};">
                    📚 ${subj}
                  </span>
                  <select class="bm-subject-select"
                          title="Change Subject Category"
                          onchange="window.appController.changeBookmarkSubject('${safeQId}', this.value)">
                    ${canonicalSubjects.map(s => `<option value="${s}" ${s === subj ? 'selected' : ''}>Move to: ${s}</option>`).join('')}
                  </select>
                  <span style="background: #fef3c7; color: #b45309; font-size: 11px; font-weight: 700; padding: 3px 8px; border-radius: 4px;">
                    ${b.difficulty || 'Moderate'}
                  </span>
                  <span style="font-size: 12px; color: #64748b; font-weight: 600;">
                    • ${b.testTitle || b.testId}
                  </span>
                </div>
                <div style="display: flex; align-items: center; gap: 8px;">
                  <button onclick="window.appController.startMockTest('${safeTestId}')"
                          style="padding: 4px 10px; background: #f1f5f9; color: #0f172a; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 11px; font-weight: 700; cursor: pointer;">
                    Open Test
                  </button>
                  <button onclick="window.appController.removeBookmarkFromView('${safeQId}')"
                          title="Remove Bookmark"
                          style="background: #fef2f2; color: #dc2626; border: 1px solid #fecaca; border-radius: 6px; padding: 4px 9px; font-size: 11px; font-weight: 700; cursor: pointer;">
                    Remove
                  </button>
                </div>
              </div>

              <!-- Custom Tags Strip -->
              <div class="bm-tags-row">
                ${tagsArr.map(tag => {
                  const safeTag = String(tag).replace(/'/g, "\\'");
                  return `
                    <span class="bm-custom-tag">
                      #${tag}
                      <button type="button" onclick="window.appController.removeTagFromBookmark('${safeQId}', '${safeTag}')" title="Remove tag">×</button>
                    </span>
                  `;
                }).join('')}
                <div class="bm-preset-tags-group">
                  ${presetTags.filter(pt => !tagsArr.includes(pt)).map(pt => `
                    <button type="button" class="bm-add-preset-btn" onclick="window.appController.addTagToBookmark('${safeQId}', '${pt}')">
                      + ${pt}
                    </button>
                  `).join('')}
                  <input type="text"
                         class="bm-custom-tag-input"
                         placeholder="+ Custom tag & Enter"
                         onkeydown="if(event.key==='Enter'){ event.preventDefault(); window.appController.addTagToBookmark('${safeQId}', this.value); }" />
                </div>
              </div>

              <!-- Question Title & Optional Passage -->
              <h4 style="font-size: 15px; font-weight: 800; color: #0f172a; margin: 2px 0 4px 0;">${b.title || 'Saved Question'}</h4>
              ${b.passageHTML ? `
                <div class="bm-passage-box">
                  ${b.passageHTML}
                </div>
              ` : ''}

              <!-- Full Question Body -->
              <div class="bm-question-body">
                ${b.questionHTML || b.questionSnippet || ''}
              </div>

              <!-- Interactive Options (Click to Re-Attempt Right Inside Card) -->
              <div class="bm-options-grid">
                ${optionsArr.map((optText, idx) => {
                  const optLetter = String.fromCharCode(65 + idx);
                  let stateClass = '';
                  let badgeLabel = '';
                  if (hasAttempted) {
                    if (idx === corIdx) {
                      stateClass = 'correct';
                      badgeLabel = '<span class="bm-opt-status correct">✓ Correct Answer</span>';
                    } else if (idx === attemptState.selectedIdx && idx !== corIdx) {
                      stateClass = 'wrong';
                      badgeLabel = '<span class="bm-opt-status wrong">✕ Your Choice</span>';
                    }
                  }
                  return `
                    <button type="button"
                            class="bm-option-btn ${stateClass}"
                            onclick="window.appController.attemptBookmarkQuestion('${safeQId}', ${idx})">
                      <span class="bm-opt-letter">${optLetter}</span>
                      <span class="bm-opt-text">${optText}</span>
                      ${badgeLabel}
                    </button>
                  `;
                }).join('')}
              </div>

              <!-- Action & Instant Feedback Footer -->
              <div class="bm-card-actions-bar">
                <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
                  ${hasAttempted ? `
                    <span class="bm-attempt-feedback ${isAttemptCorrect ? 'correct' : 'wrong'}">
                      ${isAttemptCorrect
                        ? `✓ Spot On! Option ${corLetter} is Correct`
                        : `✕ Incorrect — Correct Answer is Option ${corLetter}`}
                    </span>
                    <button type="button"
                            class="bm-btn-secondary"
                            onclick="window.appController.resetBookmarkAttempt('${safeQId}')">
                      ↺ Reset & Re-attempt
                    </button>
                  ` : `
                    <span style="font-size: 12px; color: #64748b; font-weight: 600;">
                      💡 Click any option (A–E) above to re-attempt this question
                    </span>
                  `}
                </div>
                <button type="button"
                        class="bm-btn-solution"
                        onclick="window.appController.toggleBookmarkSolution('${safeQId}')">
                  ${attemptState.showSolution ? '▲ Hide Solution & Explanation' : '▼ View Solution & Explanation'}
                </button>
              </div>

              <!-- Collapsible Step-by-Step Solution Drawer -->
              ${attemptState.showSolution ? `
                <div class="bm-solution-drawer">
                  <div style="margin-bottom: 6px; font-size: 12px; font-weight: 800; color: #008479; text-transform: uppercase; letter-spacing: 0.4px;">
                    ✓ Official Answer: Option ${corLetter}
                  </div>
                  <div style="font-size: 13px; color: #1e293b; line-height: 1.6;">
                    ${b.explanationHTML || b.answerKey || 'Review complete solution above.'}
                  </div>
                </div>
              ` : ''}
            </div>
          `;
        }).join('')}
      </div>
    `;

    // Keep search input focused if user was typing
    if (this._keepBookmarkSearchFocus) {
      this._keepBookmarkSearchFocus = false;
      const inputEl = document.getElementById('bm-search-input');
      if (inputEl) {
        inputEl.focus();
        const len = inputEl.value.length;
        inputEl.setSelectionRange(len, len);
      }
    }
  }

  setBookmarkSubjectFilter(subject) {
    this.activeBookmarkSubject = subject || 'ALL';
    this.renderBookmarks();
  }

  setBookmarkTagFilter(tag) {
    this.activeBookmarkTag = tag || 'ALL';
    this.renderBookmarks();
  }

  setBookmarkSearchQuery(query) {
    this.bookmarkSearchQuery = query || '';
    this._keepBookmarkSearchFocus = true;
    this.renderBookmarks();
  }

  resetBookmarkFilters() {
    this.activeBookmarkSubject = 'ALL';
    this.activeBookmarkTag = 'ALL';
    this.bookmarkSearchQuery = '';
    this.renderBookmarks();
  }

  attemptBookmarkQuestion(bookmarkId, selectedIdx) {
    if (!this.bookmarkAttempts) this.bookmarkAttempts = {};
    this.bookmarkAttempts[bookmarkId] = {
      selectedIdx: Number(selectedIdx),
      showSolution: true
    };
    this.renderBookmarks();
  }

  resetBookmarkAttempt(bookmarkId) {
    if (!this.bookmarkAttempts) this.bookmarkAttempts = {};
    delete this.bookmarkAttempts[bookmarkId];
    this.renderBookmarks();
  }

  toggleBookmarkSolution(bookmarkId) {
    if (!this.bookmarkAttempts) this.bookmarkAttempts = {};
    const cur = this.bookmarkAttempts[bookmarkId] || { selectedIdx: null, showSolution: false };
    this.bookmarkAttempts[bookmarkId] = {
      ...cur,
      showSolution: !cur.showSolution
    };
    this.renderBookmarks();
  }

  changeBookmarkSubject(bookmarkId, newSubject) {
    if (window.obDataManager && typeof window.obDataManager.updateBookmarkSubject === 'function') {
      window.obDataManager.updateBookmarkSubject(bookmarkId, newSubject);
      this.showToast(`Moved question to ${newSubject}`, 'success');
      this.renderBookmarks();
    }
  }

  addTagToBookmark(bookmarkId, tagText) {
    const clean = String(tagText || '').trim();
    if (!clean) return;
    if (window.obDataManager && typeof window.obDataManager.addBookmarkTag === 'function') {
      window.obDataManager.addBookmarkTag(bookmarkId, clean);
      this.renderBookmarks();
    }
  }

  removeTagFromBookmark(bookmarkId, tagText) {
    if (window.obDataManager && typeof window.obDataManager.removeBookmarkTag === 'function') {
      window.obDataManager.removeBookmarkTag(bookmarkId, tagText);
      this.renderBookmarks();
    }
  }

  removeBookmarkFromView(questionId) {
    if (window.obDataManager) {
      window.obDataManager.removeBookmark(questionId);
    }
    const rawNum = String(questionId).replace(/^bm-/, '');
    if (this.testEngine && this.testEngine.bookmarkedQuestions) {
      delete this.testEngine.bookmarkedQuestions[questionId];
      delete this.testEngine.bookmarkedQuestions[rawNum];
    }
    if (window.obSolutionEngine && window.obSolutionEngine.bookmarkedQuestions) {
      delete window.obSolutionEngine.bookmarkedQuestions[questionId];
      delete window.obSolutionEngine.bookmarkedQuestions[rawNum];
    }
    this.renderBookmarks();
    this.showToast('Removed question from bookmarks', 'info');
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
        if (query && this.currentViewTab !== 'tests') {
          this.switchAppView('tests', false, true);
        }
        const cards = document.querySelectorAll('#mock-cards-container .mock-test-card');
        let visibleCount = 0;
        cards.forEach(c => {
          const text = c.innerText.toLowerCase();
          const matches = !query || text.includes(query);
          c.style.display = matches ? '' : 'none';
          if (matches) visibleCount++;
        });
        const countEl = document.getElementById('active-tab-tests-count');
        if (countEl && cards.length > 0) {
          countEl.textContent = query
            ? `${visibleCount} Matching Test${visibleCount === 1 ? '' : 's'}`
            : `${cards.length} Tests Available`;
        }
      });
    }

    // Candidate profile dropdown & switcher modal
    const btnUserProfile = document.getElementById('btn-user-profile');
    const profileDropdown = document.getElementById('profileDropdownMenu');
    const btnOpenCandidateModal = document.getElementById('btn-open-candidate-modal');
    const userModal = document.getElementById('user-profile-modal');
    const btnCloseUserModal = document.getElementById('btn-close-user-modal');
    const formCreateUser = document.getElementById('form-create-user');

    if (btnUserProfile) {
      btnUserProfile.addEventListener('click', (e) => {
        e.stopPropagation();
        if (profileDropdown) {
          const isOpen = profileDropdown.style.display === 'block';
          profileDropdown.style.display = isOpen ? 'none' : 'block';
        } else {
          this.renderUserProfileModal();
        }
      });
    }

    if (profileDropdown) {
      profileDropdown.querySelectorAll('.upd-nav-item').forEach(item => {
        item.addEventListener('click', () => {
          profileDropdown.style.display = 'none';
        });
      });
      document.addEventListener('click', (e) => {
        if (profileDropdown.style.display === 'block' && !profileDropdown.contains(e.target) && e.target !== btnUserProfile) {
          profileDropdown.style.display = 'none';
        }
      });
    }

    if (btnOpenCandidateModal) {
      btnOpenCandidateModal.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (profileDropdown) profileDropdown.style.display = 'none';
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
        const email = credEmail && credEmail.value.trim() ? credEmail.value.trim() : 'candidate@oliveboard.in';
        const password = credPass && credPass.value ? credPass.value : 'Oliveboard@2026';
        const iframe = document.getElementById('ob-live-iframe');
        if (iframe && iframe.contentWindow) {
          iframe.contentWindow.postMessage({
            type: 'OB_CMD_FILL_LOGIN',
            email,
            password,
            submit: true
          }, '*');
        }
        await this.sendObBrowserInput({
          action: 'fillLogin',
          email,
          password,
          url: 'https://u1.oliveboard.in/tests/?c=sbipopre19&i=banking',
          submit: true
        }, true);
        this.showToast(`Logged in as ${email} — Loading Oliveboard Mock Test Dashboard...`, 'success');
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
        const iframe = document.getElementById('ob-live-iframe');
        if (iframe && iframe.contentWindow) {
          iframe.contentWindow.postMessage({ type: 'OB_CMD_SWITCH_AUTH_TAB', tab: 'login' }, '*');
        }
        this.showToast('Switched to Login Form on Oliveboard page', 'info');
      });
    }

    if (btnSwitchSignup) {
      btnSwitchSignup.addEventListener('click', () => {
        const iframe = document.getElementById('ob-live-iframe');
        if (iframe && iframe.contentWindow) {
          iframe.contentWindow.postMessage({ type: 'OB_CMD_SWITCH_AUTH_TAB', tab: 'signup' }, '*');
        }
        this.showToast('Switched to Sign Up Form on Oliveboard page', 'info');
      });
    }

    // Listen for navigation events from inside the real proxied website iframe
    if (!this._obProxyMessageBound) {
      this._obProxyMessageBound = true;
      window.addEventListener('message', (ev) => {
        const msg = ev.data || {};
        if (msg.type === 'OB_PROXY_NAVIGATING' && msg.url) {
          const urlInput = document.getElementById('ob-live-url-input');
          if (urlInput) urlInput.value = msg.url;
          this._lastLoadedProxyUrl = msg.url;
          const stageBadge = document.getElementById('ob-live-stage-badge');
          if (stageBadge) stageBadge.textContent = 'Loading ' + msg.url.slice(0, 40) + '...';
          if (msg.loggedIn) {
            const iframe = document.getElementById('ob-live-iframe');
            if (iframe) {
              iframe.src = `/api/ob-browser/proxy?url=${encodeURIComponent(msg.url)}&_t=${Date.now()}`;
            }
            this.showToast(`Signed in to Oliveboard — Loading Mock Test Dashboard...`, 'success');
          }
        } else if (msg.type === 'OB_PROXY_LOADED' && msg.url) {
          const urlInput = document.getElementById('ob-live-url-input');
          if (urlInput && document.activeElement !== urlInput) {
            urlInput.value = msg.url;
          }
          this._lastLoadedProxyUrl = msg.url;
          fetch('/api/ob-browser/input', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'syncUrl', url: msg.url, title: msg.title || '' })
          })
            .then(r => r.json())
            .then(data => {
              if (data && data.success) {
                this._applyObBrowserFrameData(data, false, false);
              }
            })
            .catch(() => {});
        }
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
        const iframe = document.getElementById('ob-live-iframe');
        if (iframe) iframe.focus();
        this.showToast('Live Oliveboard Website Viewport focused!', 'info');
      });
    }

    const sanitizeLiveUrl = (raw) => {
      let u = String(raw || '').trim();
      if (!u) return 'https://www.oliveboard.in/?next=https%3A%2F%2Fu1.oliveboard.in%2Fexams%2F%3Fc%3Dsbipopre19%26i%3Dbanking';
      if (!/^https?:\/\//i.test(u)) {
        u = 'https://' + u.replace(/^\/+/, '');
      }
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
    };

    if (btnNavGo && urlInput) {
      const triggerNavGo = async () => {
        const cleanUrl = sanitizeLiveUrl(urlInput.value);
        urlInput.value = cleanUrl;
        urlInput.blur();
        const stageBadge = document.getElementById('ob-live-stage-badge');
        if (stageBadge) {
          stageBadge.textContent = 'Loading ' + cleanUrl.slice(0, 38) + '...';
        }
        await this.sendObBrowserInput({ type: 'navigate', url: cleanUrl }, true);
      };
      btnNavGo.addEventListener('click', triggerNavGo);
      urlInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          triggerNavGo();
        }
      });
    }

    if (btnNavBack) {
      btnNavBack.addEventListener('click', () => this.sendObBrowserInput({ type: 'goBack' }, true));
    }

    if (btnNavReload) {
      btnNavReload.addEventListener('click', () => {
        const iframe = document.getElementById('ob-live-iframe');
        if (iframe && iframe.contentWindow) {
          try {
            iframe.contentWindow.location.reload();
          } catch (e) {
            iframe.src = iframe.src;
          }
        }
        this.sendObBrowserInput({ type: 'reload' }, true);
      });
    }

    if (btnSendText && textInput) {
      const sendTyped = async () => {
        const val = textInput.value;
        if (!val) return;
        textInput.value = '';
        const iframe = document.getElementById('ob-live-iframe');
        if (iframe && iframe.contentWindow) {
          iframe.contentWindow.postMessage({ type: 'OB_CMD_TYPE_TEXT', text: val }, '*');
        }
      };
      btnSendText.addEventListener('click', sendTyped);
      textInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          sendTyped();
        }
      });
    }

    if (btnScrapeNow) {
      btnScrapeNow.addEventListener('click', () => this.scrapeOliveboardLivePage());
    }
  }

  _applyObBrowserFrameData(data, forceUpdateUrl = false, reloadIframeIfChanged = true) {
    if (!data || !data.success) return;

    const iframe = document.getElementById('ob-live-iframe');
    const screenImg = document.getElementById('ob-live-screen-img');

    if (data.mode === 'live-proxy' || data.proxyUrl) {
      if (iframe) {
        iframe.style.display = 'block';
        const targetUrl = data.url || '';
        if (reloadIframeIfChanged && targetUrl && (forceUpdateUrl || this._lastLoadedProxyUrl !== targetUrl)) {
          this._lastLoadedProxyUrl = targetUrl;
          iframe.src = `/api/ob-browser/proxy?url=${encodeURIComponent(targetUrl)}&_t=${Date.now()}`;
        }
      }
      if (screenImg) screenImg.style.display = 'none';
    } else if (data.imageBase64) {
      if (screenImg) {
        screenImg.style.display = 'block';
        screenImg.src = data.imageBase64;
      }
      if (iframe) iframe.style.display = 'none';
    }

    const urlInput = document.getElementById('ob-live-url-input');
    if (urlInput && data.url && (forceUpdateUrl || document.activeElement !== urlInput)) {
      urlInput.value = data.url;
    }

    const stageBadge = document.getElementById('ob-live-stage-badge');
    if (stageBadge && data.stage) {
      const stKey = typeof data.stage === 'object' ? data.stage.stage : data.stage;
      const stLabel = typeof data.stage === 'object' ? data.stage.label : data.stage;
      stageBadge.textContent = stLabel || `STAGE: ${String(stKey).toUpperCase()}`;
      stageBadge.style.background = stKey === 'live_test' ? '#dc2626' : (stKey === 'solutions' ? '#16a34a' : '#0284c7');
      stageBadge.style.color = '#ffffff';
    }

    const statusMsg = document.getElementById('ob-live-status-msg');
    if (statusMsg && data.stage) {
      const stLabel = typeof data.stage === 'object' ? data.stage.label : data.stage;
      statusMsg.textContent = `Live Website Active: ${stLabel} — Interact directly with the real page above or click "Snapshot & Scrape (REA MCP)".`;
    }

    this._renderObBrowserTabs(data.tabs || [], data.activeTabIndex || 0);
  }

  async openOliveboardLiveBrowser(pushHistory = true) {
    const modal = document.getElementById('ob-live-browser-modal');
    const stageBadge = document.getElementById('ob-live-stage-badge');
    const statusMsg = document.getElementById('ob-live-status-msg');
    const urlInput = document.getElementById('ob-live-url-input');
    if (!modal) return;
    modal.style.display = 'flex';
    this._obBrowserActive = true;
    if (pushHistory) {
      this.pushNavState({ modal: 'live-browser', view: this.currentViewTab }, '#live-browser');
    }

    if (stageBadge) {
      stageBadge.textContent = 'Connecting to oliveboard.in...';
    }

    try {
      const initialUrl = (urlInput && urlInput.value.trim()) || 'https://www.oliveboard.in/?next=https%3A%2F%2Fu1.oliveboard.in%2Fexams%2F%3Fc%3Dsbipopre19%26i%3Dbanking';
      const res = await fetch('/api/ob-browser/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: initialUrl })
      });
      const data = await res.json();
      if (data.success) {
        this._applyObBrowserFrameData(data, true, true);
      } else if (stageBadge) {
        stageBadge.textContent = 'Connection Error: ' + (data.error || 'Unknown error');
      }
    } catch (e) {
      if (statusMsg) statusMsg.textContent = 'Error starting browser: ' + e.message;
    }
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
      if (data && data.success) {
        this._applyObBrowserFrameData(data, false, false);
      }
    } catch (e) {}
  }

  _renderObBrowserTabs(tabs, activeTabIndex = 0) {
    const bar = document.getElementById('ob-live-tabs-bar');
    if (!bar) return;
    const key = JSON.stringify(tabs.map(t => `${t.index}:${t.index === activeTabIndex}:${t.title}`));
    if (this._lastTabsKey === key) return;
    this._lastTabsKey = key;

    const tabsHtml = tabs.map(t => {
      const isAct = t.active !== undefined ? t.active : (t.index === activeTabIndex);
      return `
        <div style="display: inline-flex; align-items: center; gap: 6px; padding: 3px 10px; border-radius: 4px; font-size: 11px; font-weight: 700; cursor: pointer; background: ${isAct ? '#0284c7' : '#1e293b'}; color: ${isAct ? '#ffffff' : '#cbd5e1'}; border: 1px solid ${isAct ? '#38bdf8' : '#334155'};"
             onclick="window.appController.sendObBrowserInput({ action: 'switchTab', tabIndex: ${t.index} }, true)">
          <span style="color: ${isAct ? '#ffffff' : '#cbd5e1'};">${isAct ? '● ' : ''}${(t.title || t.url || 'Tab ' + (t.index + 1)).slice(0, 34)}</span>
          ${tabs.length > 1 ? `<span onclick="event.stopPropagation(); window.appController.sendObBrowserInput({ action: 'closeTab', tabIndex: ${t.index} }, true)" style="margin-left: 4px; color: #fca5a5; font-weight: 900;">×</span>` : ''}
        </div>
      `;
    }).join('');

    bar.innerHTML = `<span style="color: #94a3b8; font-weight: 700; margin-right: 4px;">Open Tabs:</span>${tabsHtml}`;
  }

  async sendObBrowserInput(payload, forceUpdateUrl = false) {
    try {
      const act = payload.action || payload.type;
      const normalizedPayload = {
        ...payload,
        action: act,
        tabIndex: payload.tabIndex !== undefined ? payload.tabIndex : payload.index
      };
      const res = await fetch('/api/ob-browser/input', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(normalizedPayload)
      });
      const data = await res.json();
      if (data && data.success) {
        const shouldReloadIframe = act === 'navigate' || act === 'goBack' || act === 'switchTab' || act === 'closeTab';
        this._applyObBrowserFrameData(data, forceUpdateUrl || shouldReloadIframe, shouldReloadIframe);
        if (act === 'navigate' && data.url) {
          this.showToast(`Loaded ${data.url}`, 'success');
        }
      }
    } catch (e) {
      console.error('OB browser input error:', e);
    }
  }

  _extractLiveIframeDomPayload() {
    try {
      const iframe = document.getElementById('ob-live-iframe');
      if (!iframe || !iframe.contentDocument) return null;
      const doc = iframe.contentDocument;
      const win = iframe.contentWindow;
      const urlInput = document.getElementById('ob-live-url-input');

      // Universal Oliveboard Decrypter: handles n.js 32-char salted Base64, standard UTF-8 Base64, and plain HTML
      const decryptOb = (rawStr) => {
        if (!rawStr || typeof rawStr !== 'string') return '';
        const trimmed = rawStr.trim();
        if (!trimmed || trimmed.includes('<') || trimmed.includes(' ')) return trimmed;
        const clean = trimmed.replace(/\s+/g, '');

        // 1. n.js 32-char salted Base64 (32 random chars + btoa(escape(html)) + 32 random chars)
        if (clean.length > 64) {
          try {
            const sub = clean.substring(32, clean.length - 32);
            const dec = unescape(atob(sub));
            if (dec && (dec.includes('<') || dec.includes(' ') || /[a-zA-Z0-9]/.test(dec))) {
              return dec;
            }
          } catch (e) {}
        }

        // 2. Standard UTF-8 Base64 (.eqt)
        if (clean.length >= 4) {
          try {
            const binStr = atob(clean);
            const bytes = new Uint8Array(binStr.length);
            for (let i = 0; i < binStr.length; i++) bytes[i] = binStr.charCodeAt(i);
            return new TextDecoder('utf-8').decode(bytes);
          } catch (e) {}
        }
        return trimmed;
      };

      const detectedModals = Array.from(doc.querySelectorAll('#submit-pane, #sure, #calert, #login-modal, #modal-login, #modal-signup, .modal, [role="dialog"]')).map(el => {
        const cs = win.getComputedStyle(el);
        return {
          selector: el.id ? '#' + el.id : '.modal',
          id: el.id || '',
          className: el.className || '',
          isVisible: cs.display !== 'none' && cs.visibility !== 'hidden',
          heading: (el.querySelector('h1,h2,h3,h4,b,.modal-title') || {}).innerText || '',
          buttonsCount: el.querySelectorAll('button, a, input[type="submit"]').length
        };
      });

      const allTables = Array.from(doc.querySelectorAll('table')).map((tbl, idx) => ({
        tableIndex: idx,
        id: tbl.id || '',
        className: tbl.className || '',
        headers: Array.from(tbl.querySelectorAll('th')).map(th => th.innerText.trim()),
        rowCount: tbl.querySelectorAll('tr').length
      }));

      const decryptedQuestions = [];
      const extractedSolutions = {};
      const letters = ['A', 'B', 'C', 'D', 'E'];

      // Strategy 1: Solution App (solution/index3.php) — div.qosblock[id^="q-"]
      const qosBlocks = Array.from(doc.querySelectorAll('div.qosblock[id^="q-"]'));
      if (qosBlocks.length > 0) {
        const dsNames = (win && Array.isArray(win.dsnames)) ? win.dsnames : ['English Language', 'Quantitative Aptitude', 'Reasoning Ability'];
        const seCounts = (win && Array.isArray(win.secount)) ? win.secount.map(Number) : [0, 40, 70, 100];

        qosBlocks.forEach((block, idx) => {
          const qNum = idx + 1;
          const idParts = (block.id || '').split('-');
          const qid = Number(idParts[2]) || (1000 + qNum);

          const paneEl = block.querySelector('.panetxt');
          const qEl = block.querySelector('.qblock');
          const solEl = block.querySelector('.sblock .solutiontxt');
          const optEls = Array.from(block.querySelectorAll('.opt .rightopt'));

          const passageHTML = paneEl ? decryptOb(paneEl.innerHTML) : '';
          const questionHTML = qEl ? decryptOb(qEl.innerHTML) : '';
          const explanationHTML = solEl ? decryptOb(solEl.innerHTML) : '';
          const options = optEls.slice(0, 5).map((oEl, oIdx) => {
            const html = decryptOb(oEl.innerHTML);
            return {
              letter: letters[oIdx] || 'A',
              html,
              text: html.replace(/<[^>]+>/g, '').trim()
            };
          });

          // Extract correct option index from viewsolution(idx, coropt) or .opt.correct
          let correctIdx = 1;
          const viewBtn = block.querySelector('.btn-viewsol[onclick]');
          if (viewBtn) {
            const m = (viewBtn.getAttribute('onclick') || '').match(/viewsolution\(\s*\d+\s*,\s*(\d+)\s*\)/i);
            if (m && m[1] !== undefined) correctIdx = Number(m[1]);
          } else {
            const corrRowIdx = Array.from(block.querySelectorAll('.opt')).findIndex(r => r.classList.contains('correct'));
            if (corrRowIdx >= 0) correctIdx = corrRowIdx;
          }
          const correctAnswer = letters[correctIdx] || 'B';

          // Resolve section name from secount boundaries
          let sectionName = dsNames[0] || 'English Language';
          for (let s = 0; s < dsNames.length; s++) {
            const start = seCounts[s] || 0;
            const end = seCounts[s + 1] || 999;
            if (qNum > start && qNum <= end) {
              sectionName = dsNames[s];
              break;
            }
          }

          if (questionHTML && options.length >= 2) {
            decryptedQuestions.push({
              qid,
              questionNumber: qNum,
              section: sectionName,
              passageHTML,
              hasPassage: Boolean(passageHTML && passageHTML.trim().length > 10),
              questionHTML,
              options,
              correctAnswer,
              correctIndex: correctIdx,
              explanationHTML
            });
            extractedSolutions[qid] = {
              ans: correctAnswer,
              solutionDecoded: explanationHTML || 'Official Oliveboard step-by-step explanation.'
            };
          }
        });
      }

      // Strategy 2: Active Live Mock Test (part.php) — #myquestion{qid} / #leftpane{qid} / #rightpane{qid} / .opn{qid}
      if (decryptedQuestions.length === 0) {
        const innerPane = doc.getElementById('question-inner-pane');
        if (innerPane) {
          const qidSet = new Set();
          Array.from(innerPane.querySelectorAll('[id^="myquestion"], [id^="rightpane"]')).forEach(el => {
            const m = (el.id || '').match(/(\d+)$/);
            if (m) qidSet.add(Number(m[1]));
          });
          const sortedQids = Array.from(qidSet).sort((a, b) => a - b);
          sortedQids.forEach((qid, idx) => {
            const qNum = idx + 1;
            const leftPane = doc.getElementById('leftpane' + qid);
            const rightPane = doc.getElementById('rightpane' + qid);
            const myQ = doc.getElementById('myquestion' + qid);

            let passageHTML = '';
            if (leftPane) {
              const dirBox = leftPane.querySelector('#pane-direction-box') || leftPane;
              passageHTML = decryptOb(dirBox.innerHTML);
            }

            let questionHTML = '';
            if (rightPane) {
              const pBox = rightPane.querySelector('#pane-question-box') || rightPane;
              questionHTML = decryptOb(pBox.innerHTML);
            } else if (myQ) {
              const qBox = myQ.querySelector('#question-box') || myQ;
              questionHTML = decryptOb(qBox.innerHTML);
            }

            const optSpans = Array.from(doc.querySelectorAll('.opn' + qid));
            const options = optSpans.slice(0, 5).map((sp, oIdx) => {
              const rawAttr = sp.getAttribute('data-raw-eqt');
              const html = rawAttr ? decryptOb(rawAttr) : decryptOb(sp.innerHTML);
              return {
                letter: letters[oIdx] || 'A',
                html,
                text: html.replace(/<[^>]+>/g, '').trim()
              };
            });

            if (questionHTML && options.length >= 2) {
              decryptedQuestions.push({
                qid,
                questionNumber: qNum,
                section: qNum <= 40 ? 'English Language' : (qNum <= 70 ? 'Quantitative Aptitude' : 'Reasoning Ability'),
                passageHTML,
                hasPassage: Boolean(passageHTML && passageHTML.trim().length > 10),
                questionHTML,
                options
              });
            }
          });
        }
      }

      // Strategy 3: Enrich or complete from window.__OB_FULL_DATASET__ (full 100-question dataset for the active course)
      if (win && Array.isArray(win.__OB_FULL_DATASET__) && win.__OB_FULL_DATASET__.length > decryptedQuestions.length) {
        const domMap = new Map();
        decryptedQuestions.forEach(q => domMap.set(q.questionNumber, q));
        decryptedQuestions.length = 0;
        win.__OB_FULL_DATASET__.forEach((fbQ, idx) => {
          const qNum = fbQ.questionNumber || (idx + 1);
          const qid = fbQ.qid || (1000 + qNum);
          const dQ = domMap.get(qNum);
          const merged = dQ ? { ...fbQ, ...dQ, correctAnswer: fbQ.correctAnswer, correctIndex: fbQ.correctIndex, explanationHTML: fbQ.explanationHTML } : fbQ;
          decryptedQuestions.push(merged);
          extractedSolutions[qid] = {
            ans: merged.correctAnswer || 'B',
            solutionDecoded: merged.explanationHTML || 'Official Oliveboard step-by-step explanation.'
          };
        });
      }

      if (win && win.quesAnswer && typeof win.quesAnswer === 'object') {
        Object.keys(win.quesAnswer).forEach(k => {
          const rawAns = win.quesAnswer[k];
          if (rawAns && typeof rawAns === 'object') {
            extractedSolutions[k] = {
              ...rawAns,
              solutionDecoded: rawAns.sol ? decryptOb(rawAns.sol) : ''
            };
          }
        });
      }

      return {
        url: (win && win.__OB_PROXIED_URL__) || (urlInput && urlInput.value) || '',
        title: (win && win.__OB_COURSE_META__ && win.__OB_COURSE_META__.examTitle) || doc.title || 'Oliveboard Live Page',
        html: doc.documentElement ? doc.documentElement.outerHTML : '',
        viewport: { innerWidth: win.innerWidth, innerHeight: win.innerHeight, devicePixelRatio: win.devicePixelRatio || 1 },
        detectedModals,
        allTables,
        decryptedQuestions,
        extractedSolutions,
        dashboardCardsCount: doc.querySelectorAll('.tpc-card, .test-card, .mock-card, .exam-card, .panel, .card-box').length
      };
    } catch (e) {
      return null;
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
    if (scrapeSummary) scrapeSummary.textContent = '⏳ Processing live DOM snapshot & REA extraction...';
    if (btnScrape) {
      btnScrape.disabled = true;
      btnScrape.textContent = '⏳ Capturing Snapshot...';
    }

    try {
      const domPayload = this._extractLiveIframeDomPayload();
      const res = await fetch('/api/ob-browser/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domPayload })
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
    if (window.obDataManager && typeof window.obDataManager.updateUserTargetExam === 'function') {
      await window.obDataManager.updateUserTargetExam(examId);
    }
    const modal = document.getElementById('exam-switcher-modal');
    if (modal) modal.classList.remove('active');

    this.renderHeader();
    this.renderExamHero();
    await this.loadAndRenderMockCards();
    await this.renderLeaderboard();
  }

  // ==========================================
  // TEST ENGINE LAUNCH & SCORECARD REVIEW
  // ==========================================

  async startMockTest(testId, forceFresh = false, pushHistory = true) {
    this.lastActiveTestId = testId;
    this.savedTestsScrollY = window.scrollY;

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
    this.lastActiveTestId = testId;
    this.savedTestsScrollY = window.scrollY;

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

  async _resolveAttemptAndTest(attemptId, testId) {
    let attemptObj = null;
    try {
      const res = await fetch(`/api/attempts/${encodeURIComponent(attemptId)}`);
      const data = await res.json();
      if (data && data.success && data.attempt) {
        attemptObj = data.attempt;
      }
    } catch (err) {
      console.warn('API attempt fetch failed, checking local fallback:', err);
    }

    if (!attemptObj && window.obDataManager) {
      const localAttempts = await window.obDataManager.getUserAttempts();
      attemptObj = (localAttempts || []).find(a => String(a.id) === String(attemptId) || String(a.test_id || a.testId) === String(testId)) || null;
    }
    if (!attemptObj) {
      throw new Error('Attempt not found');
    }

    let testData = null;
    try {
      testData = await window.obDataManager.getTestById(testId);
    } catch (err) {
      const localQ = window.OB_TEST_APP && window.OB_TEST_APP.mockQuestions && window.OB_TEST_APP.mockQuestions[testId];
      if (localQ) {
        testData = localQ;
      } else {
        throw err;
      }
    }
    return { attempt: attemptObj, testData };
  }

  async viewSolutions(attemptId, testId, pushHistory = true) {
    this.lastActiveTestId = testId;
    this.savedTestsScrollY = window.scrollY;

    try {
      const { attempt, testData } = await this._resolveAttemptAndTest(attemptId, testId);

      if (pushHistory) {
        this.pushNavState({ view: 'solutions', testId, attemptId }, '#solutions/' + testId);
      }

      if (window.openOliveboardSolutions) {
        window.openOliveboardSolutions(attempt, testData);
      }
    } catch (e) {
      console.error('Failed to view solutions:', e);
      this.showToast('Failed to load solutions: ' + e.message, 'error');
    }
  }

  async viewAttemptScorecard(attemptId, testId, pushHistory = true) {
    this.lastActiveTestId = testId;
    this.savedTestsScrollY = window.scrollY;

    try {
      const { attempt, testData } = await this._resolveAttemptAndTest(attemptId, testId);

      if (pushHistory) {
        this.pushNavState({ modal: 'scorecard', testId, attemptId, view: this.currentViewTab }, '#scorecard/' + attemptId);
      }

      if (!this.testEngine) {
        this.testEngine = window.initTestEngine(testData);
      }
      this.testEngine.showScorecardForAttempt(attempt, testData);
    } catch (e) {
      console.error('Failed to view scorecard:', e);
      this.showToast('Failed to load scorecard: ' + e.message, 'error');
    }
  }

  async refreshAnalytics(focusTestId = null) {
    const targetId = focusTestId || this.lastActiveTestId || null;
    await this.loadAndRenderMockCards(targetId);
    await this.renderAnalytics();
    await this.renderLeaderboard();
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.appController = new OliveboardAppController();
});
