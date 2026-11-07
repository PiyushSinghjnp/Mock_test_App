/**
 * Oliveboard Mock Test App - Controller v2.6
 * Full-Stack SQLite Backend, Multi-User Isolation & 2026 Official Exam Auto-Pattern Upload Engine
 */

class OliveboardAppController {
  constructor() {
    this.currentExamId = "ibps-so"; // default to the full 150-Q IBPS SO IT exam
    this.currentFilterTab = "all";
    this.currentStatusFilter = "all"; // 'all' | 'unattempted' | 'attempted' | 'free' (Spec 1.2)
    this.currentSort = "recommended";
    this.currentSearchQuery = "";
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
    // Bind static shell interactions before slow API calls complete.
    this.bindEvents();
    await this.loadAndRenderMockCards();
    await Promise.all([
      this.renderLeaderboard(),
      this.renderAnalytics()
    ]);
    this.renderBackendStatus();

    // Initialize History & Deep-Linking Router (prevents about:blank back-button exit)
    this.initHistoryRouter();

    // Guests can browse the catalog. Authentication is requested when a protected action starts.
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

  renderBackendStatus() {
    const banner = document.getElementById('app-status-banner');
    const message = document.getElementById('app-status-message');
    if (!banner || !message) return;

    const manager = window.obDataManager;
    const unavailable = manager && manager.backendAvailable === false;
    banner.hidden = !unavailable;
    banner.classList.toggle('is-visible', unavailable);
    if (unavailable) {
      message.textContent = 'Some live data is temporarily unavailable. You can still browse the local test catalog.';
    }
  }

  toggleMobileMoreMenu(event) {
    event?.preventDefault();
    event?.stopPropagation();
    const trigger = document.getElementById('mobile-more-trigger');
    const menu = document.getElementById('mobile-more-menu');
    if (!trigger || !menu) return;
    const nextOpen = menu.hidden;
    menu.hidden = !nextOpen;
    menu.classList.toggle('is-open', nextOpen);
    trigger.setAttribute('aria-expanded', String(nextOpen));
  }

  selectMobileMoreView(view, event) {
    event?.preventDefault();
    event?.stopPropagation();
    this.switchAppView(view);
    const menu = document.getElementById('mobile-more-menu');
    const trigger = document.getElementById('mobile-more-trigger');
    if (menu) {
      menu.hidden = true;
      menu.classList.remove('is-open');
    }
    trigger?.setAttribute('aria-expanded', 'false');
  }

  getCurrentExam() {
    return window.OB_TEST_APP.exams.find(e => e.id === this.currentExamId) || window.OB_TEST_APP.exams[0];
  }

  loadScriptOnce(src) {
    this._lazyScripts = this._lazyScripts || new Map();
    if (this._lazyScripts.has(src)) return this._lazyScripts.get(src);

    const promise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.async = true;
      script.dataset.lazyScript = src;
      script.onload = resolve;
      script.onerror = () => reject(new Error(`Unable to load ${src}.`));
      document.body.appendChild(script);
    });
    this._lazyScripts.set(src, promise);
    return promise;
  }

  loadStylesheetOnce(href) {
    this._lazyStyles = this._lazyStyles || new Map();
    if (this._lazyStyles.has(href)) return this._lazyStyles.get(href);

    const promise = new Promise((resolve, reject) => {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = href;
      link.dataset.lazyStylesheet = href;
      link.onload = resolve;
      link.onerror = () => reject(new Error(`Unable to load ${href}.`));
      document.head.appendChild(link);
    });
    this._lazyStyles.set(href, promise);
    return promise;
  }

  async ensureTestEngineLoaded(includeSolutions = false) {
    await this.loadScriptOnce('js/test-engine.js?v=20261103_5');
    if (includeSolutions) {
      await this.loadStylesheetOnce('css/style4.css?v=20261026_1');
      await this.loadScriptOnce('js/solution-engine.js?v=20261103_2');
    }
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

    if (hash === '#quizzes' || hash === '#quiz' || hash === '#daily-quiz') {
      return { view: 'quizzes' };
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
      const loginModal = document.getElementById('login-modal-overlay');
      const currentUserForModal = window.obDataManager ? window.obDataManager.getActiveUser() : null;
      if (targetModal === 'login') {
        if (!currentUserForModal && loginModal && !loginModal.classList.contains('active')) {
          this.openLoginModal(false);
        }
      } else {
        if (loginModal && loginModal.classList.contains('active')) {
          this.closeLoginModal(false);
        }
      }

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
    const loginModal = document.getElementById('login-modal-overlay');
    const obLiveModal = document.getElementById('ob-live-browser-modal');
    const userModal = document.getElementById('user-profile-modal');
    const examModal = document.getElementById('exam-switcher-modal');
    const scorecardModal = document.getElementById('scorecard-modal-overlay');
    const solnOverlay = document.getElementById('solution-console-overlay');
    const testOverlay = document.getElementById('test-modal-overlay');

    return Boolean(
      (loginModal && (loginModal.classList.contains('active') || loginModal.style.display === 'flex' || loginModal.style.display === 'block')) ||
      (obLiveModal && obLiveModal.style.display === 'flex') ||
      (userModal && userModal.classList.contains('active')) ||
      (examModal && examModal.classList.contains('active')) ||
      (scorecardModal && scorecardModal.classList.contains('active')) ||
      (solnOverlay && solnOverlay.classList.contains('active')) ||
      (testOverlay && testOverlay.classList.contains('active'))
    );
  }

  closeAllModalsAndOverlays() {
    const loginModal = document.getElementById('login-modal-overlay');
    if (loginModal) {
      loginModal.classList.remove('active');
      loginModal.style.display = 'none';
    }

    const profileDropdown = document.getElementById('profileDropdownMenu');
    if (profileDropdown) {
      profileDropdown.classList.remove('is-open');
      profileDropdown.style.display = 'none';
      profileDropdown.style.visibility = 'hidden';
      profileDropdown.style.opacity = '0';
    }

    const obLiveModal = document.getElementById('ob-live-browser-modal');
    if (obLiveModal) {
      this.closeOliveboardLiveBrowser(false);
    }

    const userModal = document.getElementById('user-profile-modal');
    if (userModal) {
      userModal.classList.remove('active');
      userModal.style.display = 'none';
    }

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
    const loginModal = document.getElementById('login-modal-overlay');
    if (loginModal && (loginModal.classList.contains('active') || loginModal.style.display === 'flex' || loginModal.style.display === 'block')) {
      this.closeLoginModal(false);
      return;
    }

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

    const hasModalOpen = (loginModal && (loginModal.classList.contains('active') || loginModal.style.display === 'flex' || loginModal.style.display === 'block')) ||
                         (obLiveModal && obLiveModal.style.display === 'flex') ||
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
  // DAILY 10-MINUTE MINI QUIZZES & STREAK
  // ==========================================

  async renderDailyQuizzesView() {
    const container = document.getElementById('quiz-subjects-container');
    const heroStreak = document.getElementById('quiz-hero-streak');
    const heroCoins = document.getElementById('quiz-hero-coins');
    if (!container) return;

    const activeUser = window.obDataManager ? window.obDataManager.getActiveUser() : null;
    const userId = activeUser ? activeUser.id : null;

    if (activeUser) {
      if (heroStreak) heroStreak.textContent = `${activeUser.streak_days || 1} Day${(activeUser.streak_days || 1) > 1 ? 's' : ''}`;
      if (heroCoins) heroCoins.textContent = activeUser.coins !== undefined ? activeUser.coins : 300;
    } else {
      if (heroStreak) heroStreak.textContent = 'Sign in to track';
      if (heroCoins) heroCoins.textContent = '—';
    }

    try {
      const url = userId ? `/api/quizzes/subjects?userId=${encodeURIComponent(userId)}` : '/api/quizzes/subjects';
      const requestJson = window.obDataManager?.requestJson
        ? window.obDataManager.requestJson.bind(window.obDataManager)
        : async (path) => {
            const response = await fetch(path);
            const raw = await response.text();
            const data = raw ? JSON.parse(raw) : {};
            if (!response.ok) throw new Error(data.error || `Request failed (${response.status}).`);
            return data;
          };
      const data = await requestJson(url);

      if (!data.success || !Array.isArray(data.subjects) || data.subjects.length === 0) {
        container.innerHTML = `
          <div class="empty-state-card">
            <div class="empty-state-icon" aria-hidden="true">📚</div>
            <h4>No quiz subjects available yet</h4>
            <p>Once question pools are added, your daily speed drills will appear here.</p>
            <a class="btn-secondary-action" href="/admin#sec-quiz-bank">Open Admin Console</a>
          </div>
        `;
        return;
      }

      if (data.userStreak !== undefined && heroStreak) {
        heroStreak.textContent = `${data.userStreak} Day${data.userStreak > 1 ? 's' : ''}`;
      }
      if (data.userCoins !== undefined && heroCoins) {
        heroCoins.textContent = data.userCoins;
      }

      const iconMap = {
        'reasoning': '🧩',
        'quant': '📐',
        'math': '📐',
        'english': '📖',
        'general': '🌍',
        'awareness': '🌍',
        'current': '📰',
        'computer': '💻',
        'professional': '⚡'
      };

      const getSubjectIcon = (subName) => {
        const lower = subName.toLowerCase();
        for (const [k, ic] of Object.entries(iconMap)) {
          if (lower.includes(k)) return ic;
        }
        return '📝';
      };

      container.innerHTML = data.subjects.map(sub => {
        const icon = getSubjectIcon(sub.subject);
        const solved = sub.solvedCount || 0;
        const total = Math.max(0, Number(sub.totalQuestions) || 0);
        const quizSize = Math.min(10, total);
        const pct = total > 0 ? Math.min(100, Math.round((solved / total) * 100)) : 0;

        return `
          <div class="quiz-subject-card">
            <div>
              <div class="quiz-card-top">
                <div class="quiz-subject-icon">${icon}</div>
                <div style="flex: 1;">
                  <h4 class="quiz-subject-title">${sub.subject}</h4>
                  <div style="font-size: 12px; color: #64748b;">${quizSize} available question${quizSize === 1 ? '' : 's'} • up to 10 minutes</div>
                </div>
              </div>

              <div class="quiz-meta-row">
                <span><b>${Math.max(0, total - solved)} remaining</b> of ${total}</span>
                <span>•</span>
                <span style="color: #008479; font-weight: 700;">${solved} Solved</span>
              </div>

              <div style="display: flex; justify-content: space-between; font-size: 11px; color: #64748b; font-weight: 600;">
                <span>Subject progress</span>
                <span>${pct}%</span>
              </div>
              <div class="quiz-progress-track">
                <div class="quiz-progress-fill" style="width: ${pct}%;"></div>
              </div>
            </div>

            <div style="margin-top: 10px;">
              <button type="button" class="quiz-btn-start" data-app-action="start-daily-quiz" data-subject="${sub.subject.replace(/"/g, '&quot;')}" ${quizSize === 0 ? 'disabled' : ''}>
                <span>${quizSize > 0 ? `Start ${quizSize}-Question Quiz` : 'No practice available'}</span>
              </button>
            </div>
          </div>
        `;
      }).join('');
    } catch (err) {
      console.error('Failed to render daily quizzes:', err);
      container.innerHTML = `
        <div class="empty-state-card empty-state-card-error" role="alert">
          <div class="empty-state-icon" aria-hidden="true">⚠️</div>
          <h4>Quiz subjects are temporarily unavailable</h4>
          <p>Check your connection and try again. Your saved progress is not affected.</p>
          <button type="button" class="btn-secondary-action" id="btn-retry-quizzes">Try again</button>
        </div>
      `;
      this.renderBackendStatus();
    }
  }

  async startDailyQuiz(subject) {
    if (!window.obDataManager || !window.obDataManager.getActiveUser()) {
      this.showToast('Please sign in to attempt daily quizzes & track your streak.', 'info');
      this.openLoginModal();
      return;
    }

    const user = window.obDataManager.getActiveUser();
    this.showToast(`Generating 10-Question ${subject} speed quiz...`, 'info');

    try {
      const data = await window.obDataManager.requestJson('/api/quizzes/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          subject: subject
        })
      });

      if (!data.success || !data.test) {
        throw new Error(data.error || 'Failed to generate quiz');
      }

      // Start test engine with the generated 10-question, 10-minute quiz
      await this.startMockTest(data.test.id, true);
    } catch (err) {
      console.error('Error starting daily quiz:', err);
      this.showToast(`Error: ${err.message}`, 'error');
    }
  }

  // ==========================================
  // CANDIDATE LOGIN & AUTHENTICATION MODAL
  // ==========================================

  openLoginModal(pushHistory = false) {
    const modal = document.getElementById('login-modal-overlay');
    if (!modal) return;
    this.switchLoginTab('signin');
    const alertBox = document.getElementById('login-alert-box');
    if (alertBox) {
      alertBox.textContent = '';
      alertBox.style.display = 'none';
      alertBox.className = 'login-alert';
    }
    const usernameInput = document.getElementById('login-username');
    const passwordInput = document.getElementById('login-password');
    if (usernameInput) usernameInput.value = '';
    if (passwordInput) passwordInput.value = '';

    this.loginModalReturnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    modal.style.display = 'flex';
    modal.classList.add('active');
    modal.setAttribute('aria-hidden', 'false');
    if (usernameInput) {
      setTimeout(() => usernameInput.focus(), 50);
    }

    if (pushHistory && window.location.hash !== '#login') {
      window.history.replaceState({ ...window.history.state, modal: 'login' }, '', '#login');
    }
  }

  closeLoginModal(updateHistory = true) {
    const modal = document.getElementById('login-modal-overlay');
    if (modal) {
      modal.classList.remove('active');
      modal.style.display = 'none';
      modal.setAttribute('aria-hidden', 'true');
    }
    const alertBox = document.getElementById('login-alert-box');
    if (alertBox) {
      alertBox.textContent = '';
      alertBox.style.display = 'none';
      alertBox.className = 'login-alert';
    }
    if (updateHistory && window.location.hash === '#login') {
      const cleanUrl = window.location.pathname + window.location.search;
      window.history.replaceState({ ...(window.history.state || {}), modal: null }, '', cleanUrl);
    }
    if (this.loginModalReturnFocus && document.contains(this.loginModalReturnFocus)) {
      this.loginModalReturnFocus.focus();
    }
    this.loginModalReturnFocus = null;
  }

  switchLoginTab(mode) {
    const tabLogin = document.getElementById('tab-login-mode');
    const tabRegister = document.getElementById('tab-register-mode');
    const groupName = document.getElementById('group-register-name');
    const metaRow = document.getElementById('login-meta-row');
    const submitBtn = document.getElementById('btn-login-submit');
    const demoHint = document.getElementById('login-demo-hint');
    const modalTitle = document.getElementById('login-modal-title');
    const modalSubtitle = document.getElementById('login-modal-subtitle');
    const alertBox = document.getElementById('login-alert-box');

    if (alertBox) {
      alertBox.textContent = '';
      alertBox.style.display = 'none';
      alertBox.className = 'login-alert';
    }

    if (mode === 'register') {
      if (tabLogin) tabLogin.classList.remove('active');
      if (tabRegister) tabRegister.classList.add('active');
      if (tabLogin) tabLogin.setAttribute('aria-selected', 'false');
      if (tabRegister) tabRegister.setAttribute('aria-selected', 'true');
      if (groupName) groupName.style.display = 'block';
      if (metaRow) metaRow.style.display = 'none';
      if (demoHint) demoHint.style.display = 'none';
      if (submitBtn) submitBtn.textContent = 'Create Candidate Account';
      if (modalTitle) modalTitle.textContent = 'Create Candidate Account';
      if (modalSubtitle) modalSubtitle.textContent = 'Register to unlock personalized mocks and analytics';
    } else {
      if (tabLogin) tabLogin.classList.add('active');
      if (tabRegister) tabRegister.classList.remove('active');
      if (tabLogin) tabLogin.setAttribute('aria-selected', 'true');
      if (tabRegister) tabRegister.setAttribute('aria-selected', 'false');
      if (groupName) groupName.style.display = 'none';
      if (metaRow) metaRow.style.display = 'flex';
      if (demoHint) demoHint.style.display = 'block';
      if (submitBtn) submitBtn.textContent = 'Sign In';
      if (modalTitle) modalTitle.textContent = 'Candidate Login';
      if (modalSubtitle) modalSubtitle.textContent = 'Sign in to access mock tests, saved scores & analytics';
    }
  }

  async logoutCandidate() {
    const profileDropdown = document.getElementById('profileDropdownMenu');
    if (profileDropdown) profileDropdown.style.display = 'none';

    if (window.obDataManager) {
      window.obDataManager.logout();
    }

    this._resetPerCandidateUIState();
    this.renderUserProfileHeader();
    this.renderHeader();
    this.renderExamHero();
    await this.loadAndRenderMockCards();
    await this.renderAnalytics();

    this.showToast('You have been signed out.', 'info');
    this.openLoginModal();
  }

  // ==========================================
  // CANDIDATE PROFILE & MULTI-USER ISOLATION
  // ==========================================

  renderUserProfileHeader() {
    const user = window.obDataManager ? window.obDataManager.getActiveUser() : null;
    const profileWrap = document.querySelector('.upd-relative-wrapper');
    const loginBtn = document.getElementById('btn-header-login');

    if (!user) {
      if (profileWrap) profileWrap.style.display = 'none';
      if (loginBtn) loginBtn.style.display = 'inline-flex';
      const tagEl = document.getElementById('analytics-user-tag');
      if (tagEl) tagEl.textContent = 'Sign in to track your personal performance & analytics';
      return;
    }

    if (loginBtn) loginBtn.style.display = 'none';
    if (profileWrap) profileWrap.style.display = 'block';

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

    const activeUser = window.obDataManager ? window.obDataManager.getActiveUser() : null;
    const allUsers = (window.obDataManager && window.obDataManager.users) || [];
    if (!activeUser) {
      this.openLoginModal(pushHistory);
      return;
    }

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
      <button type="button" class="user-item-card ${u.id === activeUser.id ? 'selected' : ''}" data-app-action="switch-candidate" data-user-id="${u.id}">
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
      </button>
    `).join('');

    modal.style.display = 'flex';
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
    this.testsCache = [];

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

  async handleCreateCandidate(name, rollNo) {
    try {
      await window.obDataManager.createUser({
        name: name,
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
      `;
      btnSelector.insertAdjacentHTML('beforeend', '<i class="fa-solid fa-chevron-down exam-category-chevron"></i>');
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

    let mainTestId = 'sbi-po-pre-01';
    if (this.currentMockTests && this.currentMockTests.length > 0) {
      const freeTest = this.currentMockTests.find(t => t.is_free || t.isFree) || this.currentMockTests[0];
      if (freeTest && freeTest.id) mainTestId = freeTest.id;
    } else if (exam.id === 'ibps-so') {
      mainTestId = 'ibps-so-it-mains-1';
    }
    const mainBtnText = exam.id === 'ibps-so' ? 'Attempt 150-Q Full Mains Mock 🚀' : `Attempt Free ${exam.name || 'Live'} Mock 🚀`;

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
        <button type="button" class="btn-attempt-live-hero" data-app-action="start-test" data-test-id="${mainTestId}">
          ${mainBtnText}
        </button>
      </div>
    `;
  }

  renderFilterTabs() {
    const tabsContainer = document.getElementById('filter-tabs-bar');
    if (!tabsContainer) return;

    const tabs = [
      { id: "all", label: "All types" },
      { id: "prelims", label: "Prelims" },
      { id: "mains", label: "Mains" },
      { id: "sectional", label: "Sectional" },
      { id: "topic", label: "Topic drills" }
    ];

    tabsContainer.setAttribute('role', 'group');
    tabsContainer.setAttribute('aria-label', 'Filter by test type');
    tabsContainer.innerHTML = tabs.map(tab => `
      <button type="button" aria-pressed="${tab.id === this.currentFilterTab}" class="fltr-tab-link ${tab.id === this.currentFilterTab ? 'active' : ''}" data-tab="${tab.id}">
        ${tab.label}
      </button>
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
      { id: "all", label: "Any status" },
      { id: "unattempted", label: "Not started" },
      { id: "attempted", label: "Attempted" },
      { id: "free", label: "Free" }
    ];

    statusContainer.setAttribute('role', 'group');
    statusContainer.setAttribute('aria-label', 'Filter tests by status');
    statusContainer.innerHTML = pills.map(p => `
      <button type="button" aria-pressed="${p.id === this.currentStatusFilter}" class="fltr-lang-btn ${p.id === this.currentStatusFilter ? 'active' : ''}" data-status="${p.id}">
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

    let tests = this.testsCache.length
      ? this.testsCache
      : await window.obDataManager.getTestsList(this.currentExamId);
    if (!tests || tests.length === 0) {
      tests = window.OB_TEST_APP.testPacks.filter(p => p.examId === this.currentExamId);
    }

    this.testsCache = tests;

    const continueBanner = document.getElementById('continue-test-banner');
    const activeUser = window.obDataManager?.getActiveUser();
    const pausedTest = activeUser ? tests.find(test => test.isPaused && test.pausedAttempt) : null;
    if (continueBanner) {
      continueBanner.hidden = !pausedTest;
      if (pausedTest) {
        const paused = pausedTest.pausedAttempt || {};
        const questionIndex = Number(paused.currentQuestionIndex ?? paused.current_question_index ?? 0) + 1;
        continueBanner.innerHTML = `
          <div>
            <span>CONTINUE YOUR TEST</span>
            <strong>${pausedTest.title}</strong>
            <small>Resume at question ${questionIndex}; your saved timer and answers will be restored.</small>
          </div>
          <button type="button" data-app-action="resume-test" data-test-id="${pausedTest.id}">Resume test</button>
        `;
      }
    }

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

    const searchQuery = this.currentSearchQuery.trim().toLowerCase();
    if (searchQuery) {
      displayPacks = displayPacks.filter(pack => {
        const searchable = [
          pack.title,
          pack.subtitle,
          pack.type,
          ...(pack.sections_summary || pack.sections || [])
        ].filter(Boolean).join(' ').toLowerCase();
        return searchable.includes(searchQuery);
      });
    }

    if (this.currentSort === 'duration-asc') {
      displayPacks.sort((a, b) => Number(a.duration_minutes || a.durationMinutes || 0) - Number(b.duration_minutes || b.durationMinutes || 0));
    } else if (this.currentSort === 'questions-asc') {
      displayPacks.sort((a, b) => Number(a.questions_count || a.questionsCount || 0) - Number(b.questions_count || b.questionsCount || 0));
    } else if (this.currentSort === 'title-asc') {
      displayPacks.sort((a, b) => String(a.title || '').localeCompare(String(b.title || '')));
    }

    if (countLabel) {
      countLabel.textContent = searchQuery
        ? `${displayPacks.length} matching test${displayPacks.length === 1 ? '' : 's'}`
        : `${displayPacks.length} test${displayPacks.length === 1 ? '' : 's'}`;
    }

    if (displayPacks.length === 0) {
      cardsContainer.innerHTML = `
        <div style="grid-column: span 2; text-align: center; padding: 48px; background: #ffffff; border-radius: 12px; border: 1px solid var(--ob-app-border);">
          <div class="empty-state-icon" aria-hidden="true">⌕</div>
          <h4 style="font-size: 16px; font-weight: 700; color: #1e293b;">No matching tests</h4>
          <p style="font-size: 13px; color: #64748b; margin-bottom: 12px;">Try a different search, test type, or attempt status.</p>
          <button type="button" class="btn-secondary-action" data-app-action="reset-test-filters">Clear search and filters</button>
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
      const lastAttemptedRaw = att && (att.completed_at || att.submitted_at || att.created_at);
      const lastAttemptedLabel = lastAttemptedRaw && !Number.isNaN(new Date(lastAttemptedRaw).getTime())
        ? new Date(lastAttemptedRaw).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
        : '';

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
            <div class="mock-section-chips">
              ${(pack.sections_summary || pack.sections || []).map(s => `
                <span class="mock-section-chip">${s}</span>
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
                ${lastAttemptedLabel ? `<div class="card-last-attempt">Last attempt: ${lastAttemptedLabel}</div>` : ''}
              </div>
            ` : ''}
          </div>

          <div class="mock-card-footer">
            <span class="active-takers">🌐 English, Hindi • 👥 ${Number(displayActiveUsers).toLocaleString()}</span>
            
            <div class="mock-card-actions">
              ${isPaused ? `
                <button type="button" class="btn-attempt-card test-action-resume" data-app-action="resume-test" data-test-id="${pack.id}">
                  Resume Test ▶
                </button>
                <button type="button" class="btn-view-scorecard" data-app-action="start-test" data-test-id="${pack.id}" data-force-fresh="true">
                  Start Fresh
                </button>
              ` : isAttempted ? `
                <button type="button" class="btn-attempt-card test-action-solutions" data-app-action="view-solutions" data-attempt-id="${att.attempt_id}" data-test-id="${pack.id}">
                  Solutions
                </button>
                <button type="button" class="btn-view-scorecard" data-app-action="view-scorecard" data-attempt-id="${att.attempt_id}" data-test-id="${pack.id}">
                  Analytics
                </button>
                <button type="button" class="btn-view-scorecard" data-app-action="start-test" data-test-id="${pack.id}" data-force-fresh="true">
                  Re-attempt
                </button>
              ` : `
                <button type="button" class="btn-attempt-card" data-app-action="start-test" data-test-id="${pack.id}">
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

    const hasAttempts = Number(stats.testsAttempted || 0) > 0 || (stats.sectionBreakdowns && stats.sectionBreakdowns.length > 0);
    if (!hasAttempts) {
      container.innerHTML = `
        <div class="analytics-empty-state">
          <div class="analytics-empty-icon" aria-hidden="true">📈</div>
          <h4>Your performance story starts with one mock test</h4>
          <p>Attempt a test to unlock accuracy trends, sectional strengths, percentile movement, and your estimated rank.</p>
          <button type="button" class="btn-analytics-start" id="btn-analytics-start-test">Browse mock tests</button>
          <div class="analytics-preview-grid" aria-label="Analytics preview">
            <span>Accuracy trends</span>
            <span>Weakness heatmap</span>
            <span>All India percentile</span>
          </div>
        </div>
      `;
      return;
    }

    const sectionBreakdowns = Array.isArray(stats.sectionBreakdowns) ? stats.sectionBreakdowns : [];
    const strongestSection = sectionBreakdowns.slice().sort((a, b) => parseFloat(b.accuracy) - parseFloat(a.accuracy))[0];
    const weakestSection = sectionBreakdowns.slice().sort((a, b) => parseFloat(a.accuracy) - parseFloat(b.accuracy))[0];
    const recentAttempts = Array.isArray(stats.recentAttempts) ? stats.recentAttempts : [];

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

      <div class="analytics-insight-grid">
        <div class="analytics-insight-card analytics-insight-positive">
          <span class="analytics-insight-label">Strongest section</span>
          <strong>${strongestSection ? strongestSection.sectionName : 'Building momentum'}</strong>
          <span>${strongestSection ? `${strongestSection.accuracy}% accuracy` : 'Complete another mock to unlock this insight'}</span>
        </div>
        <div class="analytics-insight-card analytics-insight-warning">
          <span class="analytics-insight-label">Focus next</span>
          <strong>${weakestSection ? weakestSection.sectionName : 'Your next weak area'}</strong>
          <span>${weakestSection ? `${weakestSection.accuracy}% accuracy · revise incorrect answers` : 'Your section heatmap will appear here'}</span>
        </div>
      </div>

      ${recentAttempts.length > 0 ? `
        <div class="analytics-trend-card">
          <div class="analytics-panel-heading">
            <div>
              <h4>Recent performance trend</h4>
              <p>Latest representative attempt per mock test</p>
            </div>
            <span class="analytics-trend-legend">Score %</span>
          </div>
          <div class="analytics-trend-chart" role="img" aria-label="Recent mock test score trend">
            ${recentAttempts.map(attempt => `
              <div class="analytics-trend-column" title="${attempt.testTitle}: ${attempt.score}% score, ${attempt.accuracy}% accuracy">
                <div class="analytics-trend-bar-wrap"><div class="analytics-trend-bar" style="height: ${Math.max(8, Math.min(100, attempt.score))}%;"></div></div>
                <strong>${attempt.score}%</strong>
                <span>${attempt.completedAt ? new Date(attempt.completedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : 'Recent'}</span>
              </div>
            `).join('')}
          </div>
        </div>
      ` : ''}

      <div class="analytics-breakdown-card">
        <h4>Sectional strength &amp; weakness breakdown</h4>
        
        ${sectionBreakdowns.length > 0 ? `
          <div class="analytics-breakdown-list">
            ${sectionBreakdowns.map(sec => `
              <div class="analytics-breakdown-row">
                <div class="analytics-breakdown-label">
                  <span>${sec.sectionName}</span>
                  <span class="analytics-accuracy-value ${parseFloat(sec.accuracy) >= 80 ? 'is-strong' : (parseFloat(sec.accuracy) >= 60 ? 'is-steady' : 'is-focus')}">
                    ${sec.accuracy}% Accuracy (${sec.correct} Correct, ${sec.wrong} Wrong)
                  </span>
                </div>
                <div class="analytics-progress-track">
                  <div class="analytics-progress-fill ${parseFloat(sec.accuracy) >= 80 ? 'is-strong' : (parseFloat(sec.accuracy) >= 60 ? 'is-steady' : 'is-focus')}" style="width: ${sec.accuracy}%;"></div>
                </div>
              </div>
            `).join('')}
          </div>
        ` : `
          <div class="analytics-breakdown-empty">
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
      <article class="leaderboard-row ${u.isCurrentUser ? 'is-current-user' : ''} ${u.isRegisteredCandidate ? 'is-registered-candidate' : ''}">
        <div class="leaderboard-identity">
          <div class="leaderboard-rank rank-${Math.min(u.rank, 4)}">${u.rank}</div>
          <div>
            <div class="leaderboard-name">${u.name}</div>
            <div class="leaderboard-time">Time taken: ${u.time}</div>
          </div>
        </div>
        <div class="leaderboard-score">
          <div class="leaderboard-score-value">${u.rawScoreDisplay}</div>
          <span class="leaderboard-accuracy">Accuracy: ${u.accuracy}</span>
        </div>
      </article>
    `).join('');
  }

  switchAppView(viewName, pushHistory = true, preserveScroll = false) {
    let target = viewName;
    if (target === 'dashboard') target = 'analytics';

    // Handle Previous Year Papers tab link
    if (target === 'pyp') {
      this.currentFilterTab = 'pyp';
      const title = document.querySelector('#view-tests .catalog-heading h1');
      const description = document.querySelector('#view-tests .catalog-heading p');
      const typeTabs = document.getElementById('test-tabs-wrapper');
      const typeLabel = document.getElementById('test-type-filter-label');
      if (title) title.textContent = 'Previous Year Papers';
      if (description) description.textContent = 'Practice official-style papers and review your attempt status.';
      if (typeTabs) typeTabs.hidden = true;
      if (typeLabel) typeLabel.hidden = true;
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
    if (target === 'tests' && this.currentFilterTab !== 'pyp') {
      const title = document.querySelector('#view-tests .catalog-heading h1');
      const description = document.querySelector('#view-tests .catalog-heading p');
      const typeTabs = document.getElementById('test-tabs-wrapper');
      const typeLabel = document.getElementById('test-type-filter-label');
      if (title) title.textContent = 'Mock Tests';
      if (description) description.textContent = 'Choose a test type, then narrow it by your attempt status.';
      if (typeTabs) typeTabs.hidden = false;
      if (typeLabel) typeLabel.hidden = false;
    }

    const validViews = ['tests', 'analytics', 'courses', 'mentorship', 'bookmarks', 'subscription', 'leaderboard', 'quizzes'];
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
    const viewQuizzes = document.getElementById('view-quizzes');

    if (viewTests) viewTests.classList.toggle('active', target === 'tests');
    if (viewAnalytics) viewAnalytics.classList.toggle('active', target === 'analytics');
    if (viewCourses) viewCourses.classList.toggle('active', target === 'courses');
    if (viewMentorship) viewMentorship.classList.toggle('active', target === 'mentorship');
    if (viewBookmarks) viewBookmarks.classList.toggle('active', target === 'bookmarks');
    if (viewSubscription) viewSubscription.classList.toggle('active', target === 'subscription');
    if (viewLeaderboard) viewLeaderboard.classList.toggle('active', target === 'leaderboard');
    if (viewQuizzes) viewQuizzes.classList.toggle('active', target === 'quizzes');

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
      if (isActive) item.setAttribute('aria-current', 'page');
      else item.removeAttribute('aria-current');
      const img = item.querySelector('img');
      if (img && v === 'tests') {
        img.src = isActive ? 'img/Tests_active.svg' : 'img/Tests.svg';
      }
    });

    // Update Bottom Navigation items (for mobile)
    document.querySelectorAll('#bottom-app-bar .app-nav-item').forEach(item => {
      const isActive = item.dataset.view === target || (item.dataset.view === 'dashboard' && target === 'analytics');
      item.classList.toggle('active', isActive);
      if (isActive) item.setAttribute('aria-current', 'page');
      else item.removeAttribute('aria-current');
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

    if (target === 'quizzes') {
      this.renderDailyQuizzesView();
    } else if (target === 'analytics') {
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
            <div class="course-card-header" style="--course-gradient: ${c.gradient};">
              <span class="course-badge-live">${c.tag}</span>
              <h4 class="course-card-title">${c.title}</h4>
              <div class="course-card-instructor">${c.instructor}</div>
            </div>
            <div class="course-card-body">
              <div class="course-card-facts">
                <div class="course-fact">
                  <span>⏱️</span> <span><b>${c.duration}</b> interactive learning</span>
                </div>
                <div class="course-fact">
                  <span>📚</span> <span><b>${c.lectures}</b></span>
                </div>
                <div style="display: flex; align-items: center; gap: 8px;">
                  <span>⭐</span> <span style="color: #d97706; font-weight: 700;">${c.rating}</span>
                </div>
              </div>
              <div class="course-card-footer">
                <div>
                  <div class="course-fee-label">Course fee</div>
                  <div class="course-fee">${c.price}</div>
                </div>
                <button type="button" class="course-enroll-btn" data-app-action="enroll-course" data-course-id="${c.id}" data-course-title="${c.title.replace(/"/g, '&quot;')}">
                  Start learning
                </button>
              </div>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }

  enrollCourse(courseId, courseTitle) {
    if (!window.obDataManager?.getActiveUser()) {
      this.showToast('Sign in to view course availability.', 'info');
      this.openLoginModal();
      return;
    }
    this.showToast(`Enrollment for "${courseTitle}" is unavailable in this demo. No enrollment was created.`, 'info');
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
          <button type="button" class="mentorship-cta" data-app-action="book-mentor" data-mentor="Assigned Mentor">
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
          <button type="button" class="mentorship-action-primary" data-app-action="mentor-video">
            🎥 Join Video Room
          </button>
          <button type="button" class="mentorship-action-secondary" data-app-action="mentor-plan">
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
          <button type="button" class="mentor-slot-btn" data-app-action="book-mentor" data-mentor="Vikram Malhotra">Request 1-on-1 Slot</button>
        </div>

        <div class="mentor-card">
          <div class="mentor-avatar">👩‍🏫</div>
          <h4 style="font-size: 15px; font-weight: 800; color: #0f172a; margin: 0 0 4px 0;">Ananya Deshmukh</h4>
          <span style="font-size: 12px; color: #008479; font-weight: 600; margin-bottom: 8px;">RBI Grade B Officer (Rank 9)</span>
          <p style="font-size: 12px; color: #64748b; margin-bottom: 14px;">Specialist in High-Speed Quant DI & Elimination shortcuts under intense exam timer pressure.</p>
          <button type="button" class="mentor-slot-btn" data-app-action="book-mentor" data-mentor="Ananya Deshmukh">Request 1-on-1 Slot</button>
        </div>

        <div class="mentor-card">
          <div class="mentor-avatar">👨‍🏫</div>
          <h4 style="font-size: 15px; font-weight: 800; color: #0f172a; margin: 0 0 4px 0;">Rajeev Nambiar</h4>
          <span style="font-size: 12px; color: #008479; font-weight: 600; margin-bottom: 8px;">Chief Mock Interview Evaluator</span>
          <p style="font-size: 12px; color: #64748b; margin-bottom: 14px;">Specialist in Personality, Banking Awareness, and official IBPS / SBI interview preparation.</p>
          <button type="button" class="mentor-slot-btn" data-app-action="book-mentor" data-mentor="Rajeev Nambiar">Request 1-on-1 Slot</button>
        </div>
      </div>
    `;
  }

  bookMentorSession(mentorName = 'Assigned Mentor') {
    if (!window.obDataManager?.getActiveUser()) {
      this.showToast('Sign in to view mentor availability.', 'info');
      this.openLoginModal();
      return;
    }
    this.showToast(`Booking with ${mentorName} is unavailable in this demo. No request was sent.`, 'info');
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
          <button type="button" data-app-action="switch-view" data-view="tests" class="bm-empty-cta">
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
          <button type="button" class="bm-subject-tab ${this.activeBookmarkSubject === 'ALL' ? 'active' : ''}"
                  data-app-action="bookmark-subject" data-subject="ALL">
            <span>All Subjects</span>
            <span class="bm-tab-count">${subjectCounts.ALL}</span>
          </button>
          ${canonicalSubjects.map(subj => {
            const count = subjectCounts[subj] || 0;
            const isActive = this.activeBookmarkSubject === subj;
            const safeSubj = subj.replace(/'/g, "\\'");
            return `
              <button type="button" class="bm-subject-tab ${isActive ? 'active' : ''}"
                      data-app-action="bookmark-subject" data-subject="${safeSubj}">
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
                   data-app-action="bookmark-search" />
            ${this.bookmarkSearchQuery ? `
              <button type="button" class="bm-search-clear" data-app-action="bookmark-search-clear" title="Clear search">✕</button>
            ` : ''}
          </div>
          <div class="bm-tag-filters">
            <span class="bm-tag-filter-label">Tag Filter:</span>
            <button type="button" class="bm-tag-chip-filter ${this.activeBookmarkTag === 'ALL' ? 'active' : ''}"
                    data-app-action="bookmark-tag" data-tag="ALL">
              All (${bookmarks.length})
            </button>
            ${allCustomTags.map(tag => {
              const safeTag = String(tag).replace(/'/g, "\\'");
              const isAct = this.activeBookmarkTag === tag;
              return `
                <button type="button" class="bm-tag-chip-filter ${isAct ? 'active' : ''}"
                        data-app-action="bookmark-tag" data-tag="${safeTag}">
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
            <button type="button" class="bm-reset-btn" data-app-action="bookmark-reset-filters">
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
                          data-app-action="bookmark-subject-change" data-bookmark-id="${safeQId}">
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
                  <button type="button" data-app-action="bookmark-start-test" data-test-id="${safeTestId}"
                          style="padding: 4px 10px; background: #f1f5f9; color: #0f172a; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 11px; font-weight: 700; cursor: pointer;">
                    Open Test
                  </button>
                  <button type="button" data-app-action="bookmark-remove" data-bookmark-id="${safeQId}"
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
                      <button type="button" data-app-action="bookmark-remove-tag" data-bookmark-id="${safeQId}" data-tag="${safeTag}" title="Remove tag">×</button>
                    </span>
                  `;
                }).join('')}
                <div class="bm-preset-tags-group">
                  ${presetTags.filter(pt => !tagsArr.includes(pt)).map(pt => `
                    <button type="button" class="bm-add-preset-btn" data-app-action="bookmark-add-tag" data-bookmark-id="${safeQId}" data-tag="${pt}">
                      + ${pt}
                    </button>
                  `).join('')}
                  <input type="text"
                         class="bm-custom-tag-input"
                         placeholder="+ Custom tag & Enter"
                         data-app-action="bookmark-add-tag-input" data-bookmark-id="${safeQId}" />
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
                            data-app-action="bookmark-attempt" data-bookmark-id="${safeQId}" data-option-index="${idx}">
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
                            data-app-action="bookmark-reset-attempt" data-bookmark-id="${safeQId}">
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
                        data-app-action="bookmark-toggle-solution" data-bookmark-id="${safeQId}">
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
    const activeUser = window.obDataManager?.getActiveUser();

    container.innerHTML = `
      <div class="feature-state-banner ${activeUser ? 'state-unavailable' : 'state-demo'}">
        <div>
          <span class="feature-state-label">${activeUser ? 'STATUS UNAVAILABLE' : 'DEMO CATALOGUE'}</span>
          <h2>${activeUser ? 'Subscription data is not connected' : 'Browse plan examples'}</h2>
          <p>${activeUser ? 'Your account is signed in, but this demo cannot verify an active plan or expiry date.' : 'Sign in to access account-specific features. Plans below are examples and cannot be purchased here.'}</p>
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
          <button type="button" class="sub-plan-btn sub-plan-btn-muted" data-app-action="subscription-info">
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
          <button type="button" class="sub-plan-btn sub-plan-btn-active" aria-disabled="true">
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
          <button type="button" class="sub-plan-btn sub-plan-btn-dark" data-app-action="subscription-upgrade">
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
    const retryConnection = document.getElementById('btn-retry-connection');
    if (retryConnection) {
      retryConnection.addEventListener('click', async () => {
        retryConnection.disabled = true;
        retryConnection.textContent = 'Retrying…';
        try {
          await window.obDataManager?.loadUsers();
          await this.loadAndRenderMockCards();
          await this.renderLeaderboard();
          await this.renderAnalytics();
          await this.renderDailyQuizzesView();
          this.renderBackendStatus();
          this.showToast('Connection check complete.', 'success');
        } finally {
          retryConnection.disabled = false;
          retryConnection.textContent = 'Retry connection';
        }
      });
    }

    document.addEventListener('click', (event) => {
      const actionButton = event.target.closest('[data-app-action]');
      if (actionButton) {
        const action = actionButton.dataset.appAction;
        if (action === 'enroll-course') {
          this.enrollCourse(actionButton.dataset.courseId, actionButton.dataset.courseTitle || 'course');
        } else if (action === 'start-daily-quiz') {
          this.startDailyQuiz(actionButton.dataset.subject || 'General Awareness');
        } else if (action === 'switch-candidate') {
          this.switchCandidate(actionButton.dataset.userId);
        } else if (action === 'start-test') {
          this.startMockTest(actionButton.dataset.testId, actionButton.dataset.forceFresh === 'true');
        } else if (action === 'resume-test') {
          this.resumeMockTest(actionButton.dataset.testId);
        } else if (action === 'view-solutions') {
          this.viewSolutions(actionButton.dataset.attemptId, actionButton.dataset.testId);
        } else if (action === 'view-scorecard') {
          this.viewAttemptScorecard(actionButton.dataset.attemptId, actionButton.dataset.testId);
        } else if (action === 'select-exam') {
          this.selectExam(actionButton.dataset.examId);
        } else if (action === 'switch-view') {
          this.switchAppView(actionButton.dataset.view);
        } else if (action === 'go-back') {
          this.goBack();
        } else if (action === 'book-mentor') {
          this.bookMentorSession(actionButton.dataset.mentor || 'Assigned Mentor');
        } else if (action === 'mentor-video') {
          this.showToast('Video sessions are unavailable in this demo.', 'info');
        } else if (action === 'mentor-plan') {
          this.showToast('Study-plan downloads are unavailable in this demo.', 'info');
        } else if (action === 'subscription-info') {
          this.showToast('Subscription status is unavailable in this demo.', 'info');
        } else if (action === 'subscription-upgrade') {
          this.showToast('Purchases are unavailable in this demo. No plan was changed.', 'info');
        } else if (action === 'reset-test-filters') {
          this.currentFilterTab = 'all';
          this.currentStatusFilter = 'all';
          this.currentSort = 'recommended';
          this.currentSearchQuery = '';
          const search = document.getElementById('app-search-input');
          const sort = document.getElementById('test-sort');
          if (search) search.value = '';
          if (sort) sort.value = 'recommended';
          this.renderFilterTabs();
          this.renderStatusFilterPills();
          this.loadAndRenderMockCards();
        } else if (action === 'bookmark-subject') {
          this.setBookmarkSubjectFilter(actionButton.dataset.subject || 'ALL');
        } else if (action === 'bookmark-search-clear') {
          this.setBookmarkSearchQuery('');
        } else if (action === 'bookmark-tag') {
          this.setBookmarkTagFilter(actionButton.dataset.tag || 'ALL');
        } else if (action === 'bookmark-reset-filters') {
          this.resetBookmarkFilters();
        } else if (action === 'bookmark-start-test') {
          this.startMockTest(actionButton.dataset.testId);
        } else if (action === 'bookmark-remove') {
          this.removeBookmarkFromView(actionButton.dataset.bookmarkId);
        } else if (action === 'bookmark-remove-tag') {
          this.removeTagFromBookmark(actionButton.dataset.bookmarkId, actionButton.dataset.tag);
        } else if (action === 'bookmark-add-tag') {
          this.addTagToBookmark(actionButton.dataset.bookmarkId, actionButton.dataset.tag);
        } else if (action === 'bookmark-attempt') {
          this.attemptBookmarkQuestion(actionButton.dataset.bookmarkId, Number(actionButton.dataset.optionIndex));
        } else if (action === 'bookmark-reset-attempt') {
          this.resetBookmarkAttempt(actionButton.dataset.bookmarkId);
        } else if (action === 'bookmark-toggle-solution') {
          this.toggleBookmarkSolution(actionButton.dataset.bookmarkId);
        }
      }
      if (event.target.closest('#btn-retry-quizzes')) {
        this.renderDailyQuizzesView();
      }
      if (event.target.closest('#btn-analytics-start-test')) {
        this.switchAppView('tests');
      }
    });

    document.addEventListener('input', (event) => {
      const input = event.target.closest('[data-app-action="bookmark-search"]');
      if (input) this.setBookmarkSearchQuery(input.value);
    });

    document.addEventListener('change', (event) => {
      const select = event.target.closest('[data-app-action="bookmark-subject-change"]');
      if (select) this.changeBookmarkSubject(select.dataset.bookmarkId, select.value);
    });

    document.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter') return;
      const input = event.target.closest('[data-app-action="bookmark-add-tag-input"]');
      if (!input) return;
      event.preventDefault();
      this.addTagToBookmark(input.dataset.bookmarkId, input.value);
    });

    // Exam selector modal
    const btnSelector = document.getElementById('btn-active-exam-selector');
    const examModal = document.getElementById('exam-switcher-modal');
    const btnCloseExamModal = document.getElementById('btn-close-exam-switcher');

    if (btnSelector && examModal) {
      btnSelector.addEventListener('click', () => {
        this.renderExamSwitcherList();
        examModal.classList.add('active');
        btnSelector.setAttribute('aria-expanded', 'true');
        this.pushNavState({ modal: 'exam-switcher', view: this.currentViewTab }, '#exam-switcher');
      });
    }

    if (btnCloseExamModal && examModal) {
      btnCloseExamModal.addEventListener('click', () => {
        if (btnSelector) btnSelector.setAttribute('aria-expanded', 'false');
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
      searchInput.addEventListener('input', async (e) => {
        const query = e.target.value.toLowerCase().trim();
        this.currentSearchQuery = query;
        if (query && this.currentViewTab !== 'tests') {
          this.switchAppView('tests', false, true);
        }
        await this.loadAndRenderMockCards();
      });
    }

    const sortSelect = document.getElementById('test-sort');
    if (sortSelect) {
      sortSelect.value = this.currentSort;
      sortSelect.addEventListener('change', async (event) => {
        this.currentSort = event.target.value;
        await this.loadAndRenderMockCards();
      });
    }

    // Candidate Login Modal & Authentication Event Bindings
    const btnHeaderLogin = document.getElementById('btn-header-login');
    const btnUserLogout = document.getElementById('btn-user-logout');
    const btnCloseLoginModal = document.getElementById('btn-close-login-modal');
    const loginModal = document.getElementById('login-modal-overlay');
    const tabLoginMode = document.getElementById('tab-login-mode');
    const tabRegisterMode = document.getElementById('tab-register-mode');
    const btnTogglePwd = document.getElementById('btn-toggle-pwd');
    const formLoginCandidate = document.getElementById('form-login-candidate');

    if (btnHeaderLogin) {
      btnHeaderLogin.addEventListener('click', (e) => {
        e.preventDefault();
        this.openLoginModal();
      });
    }

    if (btnUserLogout) {
      btnUserLogout.addEventListener('click', async (e) => {
        e.preventDefault();
        await this.logoutCandidate();
      });
    }

    if (btnCloseLoginModal) {
      btnCloseLoginModal.addEventListener('click', () => {
        this.closeLoginModal(true);
      });
    }

    if (loginModal) {
      loginModal.addEventListener('click', (e) => {
        if (e.target === loginModal) {
          this.closeLoginModal(true);
        }
      });
    }

    if (tabLoginMode) {
      tabLoginMode.addEventListener('click', () => {
        this.switchLoginTab('signin');
      });
    }

    if (tabRegisterMode) {
      tabRegisterMode.addEventListener('click', () => {
        this.switchLoginTab('register');
      });
    }

    if (btnTogglePwd) {
      btnTogglePwd.addEventListener('click', () => {
        const pwdInput = document.getElementById('login-password');
        if (pwdInput) {
          const isPassword = pwdInput.type === 'password';
          pwdInput.type = isPassword ? 'text' : 'password';
          btnTogglePwd.textContent = isPassword ? '🙈' : '👁️';
        }
      });
    }

    if (formLoginCandidate) {
      formLoginCandidate.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = (document.getElementById('login-username')?.value || '').trim();
        const password = document.getElementById('login-password')?.value || '';
        const isRegister = tabRegisterMode && tabRegisterMode.classList.contains('active');
        const alertBox = document.getElementById('login-alert-box');
        const submitBtn = document.getElementById('btn-login-submit');

        if (!username || !password) {
          if (alertBox) {
            alertBox.textContent = 'Please enter both username and password.';
            alertBox.className = 'login-alert danger';
            alertBox.style.display = 'block';
          }
          return;
        }

        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.textContent = isRegister ? 'Creating Account...' : 'Signing In...';
        }

        try {
          let user;
          if (isRegister) {
            const name = (document.getElementById('register-fullname')?.value || '').trim();
            user = await window.obDataManager.register(username, password, name);
            this.showToast(`Account created! Welcome, ${user.name}!`, 'success');
          } else {
            user = await window.obDataManager.login(username, password);
            this.showToast(`Welcome back, ${user.name}!`, 'success');
          }

          // Instantly close the modal so it never lingers on screen
          this.closeLoginModal(true);

          // Update header and active candidate UI state immediately
          this._resetPerCandidateUIState();
          this.renderUserProfileHeader();
          this.renderHeader();
          this.renderExamHero();

          // Refresh mocks & statistics
          this.loadAndRenderMockCards().catch(console.error);
          this.renderAnalytics().catch(console.error);
          this.renderLeaderboard().catch(console.error);
        } catch (err) {
          if (alertBox) {
            alertBox.textContent = err.message || 'Authentication failed. Please check credentials.';
            alertBox.className = 'login-alert danger';
            alertBox.style.display = 'block';
          }
        } finally {
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = isRegister ? 'Create Candidate Account' : 'Sign In';
          }
        }
      });
    }

    // Candidate profile dropdown & switcher modal
    const btnUserProfile = document.getElementById('btn-user-profile');
    const profileDropdown = document.getElementById('profileDropdownMenu');
    const dropdownHeaderUser = document.getElementById('dropdown-header-user');
    const btnOpenCandidateModal = document.getElementById('btn-open-candidate-modal');
    const userModal = document.getElementById('user-profile-modal');
    const btnCloseUserModal = document.getElementById('btn-close-user-modal');
    const formCreateUser = document.getElementById('form-create-user');

    const toggleProfileDropdown = (forceState) => {
      if (!profileDropdown) return;
      const shouldOpen = typeof forceState === 'boolean'
        ? forceState
        : !profileDropdown.classList.contains('is-open');

      if (shouldOpen) {
        profileDropdown.style.display = 'flex';
        profileDropdown.style.visibility = 'visible';
        profileDropdown.style.opacity = '1';
        profileDropdown.style.pointerEvents = 'auto';
        profileDropdown.classList.add('is-open');
      } else {
        profileDropdown.classList.remove('is-open');
        profileDropdown.style.visibility = 'hidden';
        profileDropdown.style.opacity = '0';
        profileDropdown.style.pointerEvents = 'none';
        setTimeout(() => {
          if (!profileDropdown.classList.contains('is-open')) {
            profileDropdown.style.display = 'none';
          }
        }, 150);
      }
    };

    if (btnUserProfile) {
      btnUserProfile.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const user = window.obDataManager ? window.obDataManager.getActiveUser() : null;
        if (!user) {
          this.openLoginModal();
          return;
        }
        toggleProfileDropdown();
      });
    }

    if (profileDropdown) {
      profileDropdown.querySelectorAll('.upd-nav-item').forEach(item => {
        item.addEventListener('click', () => {
          toggleProfileDropdown(false);
        });
      });
      document.addEventListener('click', (e) => {
        if (profileDropdown.classList.contains('is-open') && !profileDropdown.contains(e.target) && (!btnUserProfile || !btnUserProfile.contains(e.target))) {
          toggleProfileDropdown(false);
        }
      });
    }

    if (dropdownHeaderUser) {
      dropdownHeaderUser.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleProfileDropdown(false);
        this.renderUserProfileModal();
      });
    }

    if (btnOpenCandidateModal) {
      btnOpenCandidateModal.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleProfileDropdown(false);
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
        const rollNo = document.getElementById('new-user-roll').value;
        this.handleCreateCandidate(name, rollNo);
      });
    }

    // Sidebar navigation clicks
    document.querySelectorAll('#sm-nav-container .sm-nav-item:not(.sm-nav-more), #ob-sidebar-nav .ob-nav-item').forEach(btn => {
      btn.addEventListener('click', () => {
        const view = btn.dataset.view;
        this.switchAppView(view);
      });
    });

    const mobileMoreTrigger = document.getElementById('mobile-more-trigger');
    const mobileMoreMenu = document.getElementById('mobile-more-menu');
    const closeMobileMoreMenu = () => {
      if (!mobileMoreMenu || !mobileMoreTrigger) return;
      mobileMoreMenu.hidden = true;
      mobileMoreMenu.classList.remove('is-open');
      mobileMoreTrigger.setAttribute('aria-expanded', 'false');
    };

    if (mobileMoreTrigger && mobileMoreMenu) {
      mobileMoreTrigger.addEventListener('click', (event) => {
        this.toggleMobileMoreMenu(event);
      });

      mobileMoreMenu.querySelectorAll('[data-view]').forEach(item => {
        item.addEventListener('click', (event) => {
          this.selectMobileMoreView(item.dataset.view, event);
        });
      });

      document.addEventListener('click', (event) => {
        if (!mobileMoreMenu.hidden && !mobileMoreMenu.contains(event.target) && !mobileMoreTrigger.contains(event.target)) {
          closeMobileMoreMenu();
        }
      });
    }

    // Bottom Navigation switching (mobile)
    document.querySelectorAll('#bottom-app-bar .app-nav-item').forEach(btn => {
      btn.addEventListener('click', () => {
        const view = btn.dataset.view;
        this.switchAppView(view);
      });
    });

    // ESC key closes modals
    document.addEventListener('keydown', (e) => {
      const loginModal = document.getElementById('login-modal-overlay');
      const loginIsOpen = loginModal && loginModal.classList.contains('active');
      if (loginIsOpen) {
        if (e.key === 'Escape') {
          e.preventDefault();
          this.closeLoginModal(true);
          return;
        }
        if (e.key === 'Tab') {
          const focusable = loginModal.querySelectorAll('button:not([disabled]), input:not([disabled]), select:not([disabled]), [href], [tabindex]:not([tabindex="-1"])');
          if (!focusable.length) return;
          const first = focusable[0];
          const last = focusable[focusable.length - 1];
          if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last.focus();
          } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
      const mobileMoreMenu = document.getElementById('mobile-more-menu');
      if (e.key === 'Escape' && mobileMoreMenu && !mobileMoreMenu.hidden) {
        mobileMoreMenu.hidden = true;
        mobileMoreMenu.classList.remove('is-open');
        document.getElementById('mobile-more-trigger')?.setAttribute('aria-expanded', 'false');
        document.getElementById('mobile-more-trigger')?.focus();
        return;
      }
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
    if (this._obEventsBound) return;
    this._obEventsBound = true;
    const on = (id, event, handler) => document.getElementById(id)?.addEventListener(event, handler);
    on('btn-open-ob-live-browser', 'click', () => this.openOliveboardLiveBrowser());
    on('btn-close-ob-live-browser', 'click', () => this.closeOliveboardLiveBrowser());
    on('btn-ob-nav-go', 'click', () => this.navigateLiveOliveboard(document.getElementById('ob-live-url-input').value));
    on('ob-live-url-input', 'keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); this.navigateLiveOliveboard(e.target.value); }
    });
    on('btn-ob-nav-back', 'click', () => this.sendObBrowserInput({ action: 'goBack' }));
    on('btn-ob-nav-reload', 'click', () => this.sendObBrowserInput({ action: 'reload' }));
    on('btn-ob-bring-front', 'click', () => this.sendObBrowserInput({ action: 'bringToFront' }));
    on('btn-ob-scrape-now', 'click', () => this.scrapeOliveboardLivePage());
    const sendText = () => {
      const input = document.getElementById('ob-live-type-input');
      if (!input?.value) return;
      const text = input.value;
      input.value = '';
      this.sendObBrowserInput({ action: 'typeText', text });
    };
    on('btn-ob-send-text', 'click', sendText);
    on('ob-live-type-input', 'keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); sendText(); }
    });
    for (const [id, key] of [['btn-ob-press-enter', 'Enter'], ['btn-ob-press-backspace', 'Backspace'], ['btn-ob-press-tab', 'Tab']]) {
      on(id, 'click', () => this.sendObBrowserInput({ action: 'key', key }));
    }
    const screen = document.getElementById('ob-live-screen-img');
    screen?.addEventListener('click', e => {
      const point = this._obPointFromEvent(e, screen);
      if (point) {
        document.getElementById('ob-live-viewport-wrapper')?.focus();
        this.sendObBrowserInput({ action: 'click', ...point });
      }
    });
    screen?.addEventListener('wheel', e => {
      const point = this._obPointFromEvent(e, screen);
      if (!point) return;
      e.preventDefault();
      const multiplier = e.deltaMode === 1 ? 16 : (e.deltaMode === 2 ? this._obViewport?.height || 720 : 1);
      this._obScrollDelta = (this._obScrollDelta || 0) + e.deltaY * multiplier;
      clearTimeout(this._obScrollTimer);
      this._obScrollTimer = setTimeout(() => {
        const deltaY = Math.max(-2000, Math.min(2000, this._obScrollDelta || 0));
        this._obScrollDelta = 0;
        if (this._obBrowserActive) this.sendObBrowserInput({ action: 'scroll', ...point, deltaY });
      }, 100);
    }, { passive: false });
    on('ob-live-viewport-wrapper', 'keydown', e => {
      if (e.ctrlKey || e.altKey || e.metaKey || e.key === 'Escape') return;
      if (['Enter', 'Backspace', 'Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Delete', 'Home', 'End', 'PageUp', 'PageDown'].includes(e.key)) {
        e.preventDefault();
        this.sendObBrowserInput({ action: 'key', key: e.key });
      }
    });
  }

  _obPointFromEvent(event, image) {
    if (!image?.naturalWidth || !image.naturalHeight) return null;
    const rect = image.getBoundingClientRect();
    const scale = Math.min(rect.width / image.naturalWidth, rect.height / image.naturalHeight);
    if (!Number.isFinite(scale) || scale <= 0) return null;
    const width = image.naturalWidth * scale;
    const height = image.naturalHeight * scale;
    const x = event.clientX - rect.left - (rect.width - width) / 2;
    const y = event.clientY - rect.top - (rect.height - height) / 2;
    if (x < 0 || y < 0 || x >= width || y >= height) return null;
    return {
      x: Math.floor(x / width * (this._obViewport?.width || image.naturalWidth)),
      y: Math.floor(y / height * (this._obViewport?.height || image.naturalHeight))
    };
  }

  async _obRequest(endpoint, payload, timeout = 20000) {
    const response = await fetch('/api/ob-browser/' + endpoint, {
      method: payload === undefined ? 'GET' : 'POST',
      credentials: 'same-origin',
      ...(payload === undefined ? {} : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }),
      signal: AbortSignal.timeout(timeout)
    });
    let data;
    try { data = await response.json(); } catch (_) { throw new Error('The live browser returned an invalid response.'); }
    if (!response.ok || !data.success) throw new Error(data.error || `Live browser request failed (${response.status}).`);
    return data;
  }

  _setObStatus(message) {
    const status = document.getElementById('ob-live-status-msg');
    if (status) status.textContent = message;
  }

  _applyObBrowserFrameData(data) {
    if (!data?.success) return;
    this._obActiveTargetId = data.activeTargetId || null;
    this._obViewport = data.viewport || this._obViewport;
    const image = document.getElementById('ob-live-screen-img');
    if (image && typeof data.imageBase64 === 'string' && data.imageBase64) {
      image.src = data.imageBase64.startsWith('data:image/') ? data.imageBase64 : 'data:image/png;base64,' + data.imageBase64;
      image.style.display = 'block';
      document.getElementById('ob-live-empty-state')?.setAttribute('hidden', '');
    }
    const input = document.getElementById('ob-live-url-input');
    if (input && data.url && document.activeElement !== input) input.value = data.url;
    const badge = document.getElementById('ob-live-stage-badge');
    if (badge) badge.textContent = data.stage?.label || data.title || 'Browser connected';
    this._renderObBrowserTabs(data.tabs || [], data.activeTargetId);
  }

  async openOliveboardLiveBrowser(pushHistory = true) {
    const modal = document.getElementById('ob-live-browser-modal');
    if (!modal || this._obOpening) return;
    this._obOpening = true;
    modal.style.display = 'flex';
    this._obBrowserActive = true;
    const epoch = this._obEpoch = (this._obEpoch || 0) + 1;
    if (pushHistory) this.pushNavState({ modal: 'live-browser', view: this.currentViewTab }, '#live-browser');
    this._setObStatus('Opening the original Oliveboard browser?');
    try {
      const data = await this._obRequest('start', {}, 60000);
      if (epoch !== this._obEpoch || !this._obBrowserActive) return;
      this._applyObBrowserFrameData(data);
      this._setObStatus('Sign in and open the tests or solutions in the real browser. Capture saves all open Oliveboard tabs.');
      this._scheduleObFrame();
    } catch (error) {
      if (epoch === this._obEpoch) this._setObStatus(error.message);
      this.showToast(error.message, 'error');
    } finally { this._obOpening = false; }
  }

  closeOliveboardLiveBrowser(popHistory = true) {
    const modal = document.getElementById('ob-live-browser-modal');
    if (modal) modal.style.display = 'none';
    this._obBrowserActive = false;
    this._obEpoch = (this._obEpoch || 0) + 1;
    clearTimeout(this._obFrameTimer);
    clearTimeout(this._obScrollTimer);
    this._obScrollDelta = 0;
    if (popHistory) this.goBack();
  }

  _scheduleObFrame() {
    clearTimeout(this._obFrameTimer);
    if (this._obBrowserActive) this._obFrameTimer = setTimeout(() => this._pollObBrowserFrame(), 1500);
  }

  async _pollObBrowserFrame() {
    if (!this._obBrowserActive) return;
    if (this._obPolling || this._obInputPending || this._obScraping || document.hidden) {
      this._scheduleObFrame();
      return;
    }
    this._obPolling = true;
    const epoch = this._obEpoch;
    const revision = this._obInputRevision || 0;
    try {
      const data = await this._obRequest('frame');
      if (epoch === this._obEpoch && this._obBrowserActive && revision === (this._obInputRevision || 0)) this._applyObBrowserFrameData(data);
    } catch (error) {
      if (epoch === this._obEpoch && this._obBrowserActive) this._setObStatus('Preview unavailable: ' + error.message);
    } finally {
      this._obPolling = false;
      this._scheduleObFrame();
    }
  }

  _renderObBrowserTabs(tabs, activeTargetId) {
    const bar = document.getElementById('ob-live-tabs-bar');
    if (!bar) return;
    const key = JSON.stringify([activeTargetId, tabs.map(t => [t.id, t.title, t.url, t.active])]);
    if (this._lastTabsKey === key) return;
    this._lastTabsKey = key;
    bar.replaceChildren();
    const label = document.createElement('span');
    label.textContent = 'Open Oliveboard tabs:';
    bar.append(label);
    for (const tab of tabs) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = (tab.title || tab.url || 'Untitled').slice(0, 60);
      button.title = tab.url || '';
      button.style.cssText = `padding:5px 9px;border:1px solid #475569;border-radius:4px;color:#fff;cursor:pointer;background:${tab.id === activeTargetId || tab.active ? '#0284c7' : '#1e293b'}`;
      button.addEventListener('click', () => this.sendObBrowserInput({ action: 'switchTab', targetId: tab.id }));
      bar.append(button);
      if (tabs.length > 1) {
        const close = document.createElement('button');
        close.type = 'button';
        close.textContent = '?';
        close.title = 'Close ' + (tab.title || 'tab');
        close.setAttribute('aria-label', close.title);
        close.style.cssText = 'border:0;background:transparent;color:#fca5a5;cursor:pointer';
        close.addEventListener('click', () => this.sendObBrowserInput({ action: 'closeTab', targetId: tab.id }));
        bar.append(close);
      }
    }
  }

  async navigateLiveOliveboard(rawUrl) {
    try {
      const url = new URL(/^https?:\/\//i.test(rawUrl) ? rawUrl : 'https://' + rawUrl);
      if (url.protocol !== 'https:' || !(url.hostname === 'oliveboard.in' || url.hostname.endsWith('.oliveboard.in'))) {
        throw new Error('Enter an HTTPS Oliveboard address.');
      }
      await this.sendObBrowserInput({ action: 'navigate', url: url.href });
    } catch (error) { this.showToast(error.message, 'error'); }
  }

  sendObBrowserInput(payload) {
    const epoch = this._obEpoch;
    const request = { ...payload, targetId: payload.targetId || this._obActiveTargetId };
    this._obInputPending = (this._obInputPending || 0) + 1;
    this._obInputRevision = (this._obInputRevision || 0) + 1;
    this._obInputQueue = (this._obInputQueue || Promise.resolve()).then(async () => {
      if (epoch !== this._obEpoch || !this._obBrowserActive) return;
      try {
        const data = await this._obRequest('input', request);
        if (epoch === this._obEpoch && this._obBrowserActive) this._applyObBrowserFrameData(data);
      } catch (error) {
        if (epoch === this._obEpoch) {
          this._setObStatus(error.message);
          this.showToast(error.message, 'error');
        }
      }
    }).finally(() => {
      this._obInputPending--;
      this._scheduleObFrame();
    });
    return this._obInputQueue;
  }

  _obArtifactUrl(value) {
    if (!value || typeof value !== 'string') return null;
    try {
      const url = new URL(value, window.location.origin);
      return url.origin === window.location.origin && url.pathname.startsWith('/api/ob-browser/artifacts/') ? url.href : null;
    } catch (_) { return null; }
  }

  async scrapeOliveboardLivePage() {
    if (this._obScraping || !this._obBrowserActive) return;
    this._obScraping = true;
    const button = document.getElementById('btn-ob-scrape-now');
    const summary = document.getElementById('ob-live-scrape-summary');
    if (button) { button.disabled = true; button.textContent = 'Capturing?'; }
    if (summary) summary.textContent = 'Capturing open Oliveboard tabs and checking completeness?';
    this._setObStatus('Collecting page content and actual REA screenshot evidence. Keep the source tabs open.');
    try {
      await (this._obInputQueue || Promise.resolve());
      const data = await this._obRequest('scrape', { targetId: this._obActiveTargetId, allTabs: true }, 180000);
      const result = data.result;
      if (!result || typeof result !== 'object') throw new Error('The capture returned no report.');
      const imported = Array.isArray(result.importedTests) ? result.importedTests : (result.ingestedTestId ? [result.ingestedTestId] : []);
      const warnings = Array.isArray(result.warnings) ? result.warnings : [];
      const pages = Array.isArray(result.capturedPages) ? result.capturedPages.length : (Number(result.capturedPages) || 1);
      const message = `Captured ${pages} page(s), ${Number(result.decryptedQuestionsCount) || 0} questions, ${Number(result.extractedSolutionsCount) || 0} answers. ${imported.length ? `Applied ${imported.length} validated test(s).` : 'No tests applied; capture saved for review.'}`;
      if (summary) summary.textContent = message;
      this._setObStatus(warnings.length ? warnings.map(w => typeof w === 'string' ? w : w.message || JSON.stringify(w)).join(' ? ') : message);
      const bar = document.getElementById('ob-live-snapshot-bar');
      if (bar) bar.style.display = 'flex';
      const screenshot = this._obArtifactUrl(result.screenshotUrl);
      const report = this._obArtifactUrl(result.specFile);
      const thumb = document.getElementById('ob-snapshot-thumb');
      if (thumb) { thumb.hidden = !screenshot; if (screenshot) thumb.src = screenshot; }
      for (const [id, href] of [['ob-snapshot-link', screenshot], ['btn-view-snapshot-full', screenshot], ['btn-view-report-json', report]]) {
        const link = document.getElementById(id);
        if (link) { link.hidden = !href; if (href) link.href = href; else link.removeAttribute('href'); }
      }
      const info = document.getElementById('ob-snapshot-info');
      if (info) info.textContent = result.title || result.url || 'Capture saved';
      const badges = document.getElementById('ob-snapshot-badges');
      if (badges) {
        badges.replaceChildren();
        const values = [result.reaEvidenceId ? `REA evidence: ${result.reaEvidenceId}` : 'No REA evidence returned', result.complete ? 'Complete capture' : 'Partial capture', `${Number(result.modalsDetectedCount) || 0} dialogs`, `${Number(result.tablesDetectedCount) || 0} tables`];
        for (const text of values) {
          const badge = document.createElement('span');
          badge.textContent = text;
          badge.style.cssText = 'padding:3px 7px;border:1px solid #475569;border-radius:4px;color:#e2e8f0;overflow-wrap:anywhere';
          badges.append(badge);
        }
      }
      this.showToast(message, warnings.length || !imported.length ? 'info' : 'success');
      if (imported.length) await this.loadAndRenderMockCards();
    } catch (error) {
      this._setObStatus('Capture failed: ' + error.message);
      if (summary) summary.textContent = 'Capture failed. No successful import was confirmed.';
      this.showToast('Capture failed: ' + error.message, 'error');
    } finally {
      this._obScraping = false;
      if (button) { button.disabled = false; button.textContent = 'Capture & apply complete tests'; }
      this._scheduleObFrame();
    }
  }

  renderExamSwitcherList() {
    const list = document.getElementById('exam-switcher-list');
    if (!list) return;

    list.innerHTML = window.OB_TEST_APP.exams.map(ex => `
      <button type="button" class="exam-select-item ${ex.id === this.currentExamId ? 'selected' : ''}" data-app-action="select-exam" data-exam-id="${ex.id}">
        <div class="exam-select-info">
          <div class="exam-badge-circ">${ex.icon}</div>
          <div>
            <div style="font-size: 14px; font-weight: 700; color: #0f172a;">${ex.name}</div>
            <div style="font-size: 12px; color: #64748b;">${ex.category} • ${ex.totalMocks} Tests</div>
          </div>
        </div>
        ${ex.id === this.currentExamId ? '<span style="color: #008479; font-weight: 800; font-size: 18px;">✓</span>' : ''}
      </button>
    `).join('');
  }

  async selectExam(examId) {
    this.currentExamId = examId;
    this.testsCache = [];
    if (window.obDataManager && typeof window.obDataManager.updateUserTargetExam === 'function') {
      await window.obDataManager.updateUserTargetExam(examId);
    }
    const modal = document.getElementById('exam-switcher-modal');
    if (modal) modal.classList.remove('active');
    document.getElementById('btn-active-exam-selector')?.setAttribute('aria-expanded', 'false');

    this.renderHeader();
    this.renderExamHero();
    await this.loadAndRenderMockCards();
    await this.renderLeaderboard();
  }

  // ==========================================
  // TEST ENGINE LAUNCH & SCORECARD REVIEW
  // ==========================================

  async startMockTest(testId, forceFresh = false, pushHistory = true) {
    if (!window.obDataManager || !window.obDataManager.getActiveUser()) {
      this.showToast('Please sign in to take this mock test.', 'info');
      this.openLoginModal();
      return;
    }

    // If live browser modal was open, close it cleanly so it never obstructs the mock test engine
    const liveModal = document.getElementById('ob-live-browser-modal');
    if (liveModal && (liveModal.style.display === 'flex' || liveModal.style.display === 'block')) {
      this.closeOliveboardLiveBrowser(false);
    }

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

    try {
      await this.ensureTestEngineLoaded();
    } catch (error) {
      this.showToast(error.message, 'error');
      return;
    }

    if (window.initTestEngine) {
      this.testEngine = window.initTestEngine(testData);
      this.testEngine.startTest(null);
    }
  }

  async resumeMockTest(testId, pushHistory = true) {
    if (!window.obDataManager || !window.obDataManager.getActiveUser()) {
      this.showToast('Please sign in to resume this mock test.', 'info');
      this.openLoginModal();
      return;
    }

    // If live browser modal was open, close it cleanly so it never obstructs the mock test engine
    const liveModal = document.getElementById('ob-live-browser-modal');
    if (liveModal && (liveModal.style.display === 'flex' || liveModal.style.display === 'block')) {
      this.closeOliveboardLiveBrowser(false);
    }

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
    try {
      await this.ensureTestEngineLoaded();
    } catch (error) {
      this.showToast(error.message, 'error');
      return;
    }

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
      await this.ensureTestEngineLoaded(true);

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
      await this.ensureTestEngineLoaded();

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
    this.testsCache = [];
    await this.loadAndRenderMockCards(targetId);
    await this.renderAnalytics();
    await this.renderLeaderboard();
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.appController = new OliveboardAppController();
});
