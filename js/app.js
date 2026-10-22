/**
 * Oliveboard Mock Test App - Controller v2
 * Full-Stack SQLite Backend & Multi-User Isolation Engine
 */

class OliveboardAppController {
  constructor() {
    this.currentExamId = "ibps-so"; // default to the full 150-Q IBPS SO IT exam
    this.currentFilterTab = "all";
    this.currentViewTab = "tests"; // 'tests' | 'analytics' | 'leaderboard'
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
    await this.loadAndRenderMockCards();
    this.renderLeaderboard();
    await this.renderAnalytics();

    // 3. Bind UI events
    this.bindEvents();
  }

  getCurrentExam() {
    return window.OB_TEST_APP.exams.find(e => e.id === this.currentExamId) || window.OB_TEST_APP.exams[0];
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
    if (tagEl) tagEl.textContent = `Showing isolated attempts for: ${user.name} (${user.roll_no})`;
  }

  renderUserProfileModal() {
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
  }

  async switchCandidate(userId) {
    window.obDataManager.setActiveUser(userId);
    const modal = document.getElementById('user-profile-modal');
    if (modal) modal.classList.remove('active');

    this.renderUserProfileHeader();
    await this.loadAndRenderMockCards();
    await this.renderAnalytics();
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
    } catch (e) {
      alert('Failed to create candidate profile: ' + e.message);
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
        <span>🏦 ${exam.name}</span>
        <span class="chevron">▼</span>
      `;
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
        <p>Comprehensive Online Test Series formulated by All India Rankers & Subject Specialists.</p>
        <div class="exam-metrics-pills">
          <span class="metric-pill">📝 ${exam.prelimsCount} Prelims Mocks</span>
          <span class="metric-pill">⚡ ${exam.mainsCount} Mains Mocks</span>
          <span class="metric-pill">⏱️ ${exam.sectionalsCount} Sectional Tests</span>
          <span class="metric-pill">🎯 ${exam.topicTestsCount} Topic Drills</span>
          <span class="metric-pill" style="background: rgba(46, 125, 50, 0.4); border: 1px solid #81c784;">🎁 ${exam.freeMocks} Free Tests Available</span>
        </div>
      </div>
      <div>
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
      { id: "sectional", label: "Sectional Speed Tests" }
    ];

    tabsContainer.innerHTML = tabs.map(tab => `
      <button class="tab-pill ${tab.id === this.currentFilterTab ? 'active' : ''}" data-tab="${tab.id}">
        ${tab.label}
      </button>
    `).join('');

    tabsContainer.querySelectorAll('.tab-pill').forEach(btn => {
      btn.addEventListener('click', async () => {
        this.currentFilterTab = btn.dataset.tab;
        this.renderFilterTabs();
        await this.loadAndRenderMockCards();
      });
    });
  }

  async loadAndRenderMockCards() {
    const cardsContainer = document.getElementById('mock-cards-container');
    const countLabel = document.getElementById('active-tab-tests-count');
    if (!cardsContainer) return;

    // Fetch tests list from backend SQLite API for current user
    let tests = await window.obDataManager.getTestsList(this.currentExamId);

    // If no backend tests found for currentExamId, fallback to OB_TEST_APP data
    if (!tests || tests.length === 0) {
      tests = window.OB_TEST_APP.testPacks.filter(p => p.examId === this.currentExamId);
    }

    this.testsCache = tests;

    let displayPacks = [...tests];
    if (this.currentFilterTab !== "all") {
      displayPacks = displayPacks.filter(p => p.type === this.currentFilterTab);
    }

    if (countLabel) {
      countLabel.textContent = `${displayPacks.length} Tests Available`;
    }

    if (displayPacks.length === 0) {
      cardsContainer.innerHTML = `
        <div style="grid-column: span 2; text-align: center; padding: 48px; background: #ffffff; border-radius: 12px; border: 1px solid var(--ob-app-border);">
          <div style="font-size: 32px; margin-bottom: 8px;">📋</div>
          <h4 style="font-size: 16px; font-weight: 700; color: #1e293b;">No tests found for this category</h4>
          <p style="font-size: 13px; color: #64748b;">Select 'All Tests' or switch exams using the top exam selector.</p>
        </div>
      `;
      return;
    }

    cardsContainer.innerHTML = displayPacks.map(pack => {
      const isAttempted = !!pack.isAttempted && !!pack.userAttempt;
      const att = pack.userAttempt;

      return `
        <div class="mock-test-card ${isAttempted ? 'card-attempted' : ''}">
          <div>
            <div class="card-top-row">
              <h4 class="mock-title">${pack.title}</h4>
              ${pack.is_free || pack.isFree 
                ? '<span class="badge-tag-free">Free Mock</span>' 
                : '<span class="badge-tag-locked">PRO Mock</span>'}
            </div>
            <p class="mock-desc">${pack.subtitle || 'TCS iON authentic exam simulation'}</p>

            <div class="mock-specs-row">
              <div class="spec-entry"><span class="spec-icon">✓</span> ${pack.marks} Marks</div>
              <div class="spec-entry"><span class="spec-icon">❓</span> ${pack.questions_count || pack.questionsCount} Qs</div>
              <div class="spec-entry"><span class="spec-icon">⏱</span> ${pack.duration_minutes || pack.durationMinutes} Mins</div>
            </div>

            <!-- Sections chips -->
            <div style="display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 12px;">
              ${(pack.sections_summary || pack.sections || []).map(s => `
                <span style="font-size: 11px; background: #f1f5f9; color: #475569; padding: 2px 8px; border-radius: 4px; font-weight: 500;">${s}</span>
              `).join('')}
            </div>

            <!-- Multi-User Isolated Attempt Status Banner -->
            ${isAttempted ? `
              <div class="card-attempt-banner">
                <div>
                  <span style="font-weight: 700; color: #15803d;">✅ Attempted by Active Candidate</span>
                  <div style="font-size: 11px; color: #64748b; margin-top: 2px;">
                    Score: <span class="attempt-score-val">${att.score.toFixed(2)} / ${pack.marks}</span> | Acc: <strong>${att.accuracy}%</strong> | AIR: <strong>#${att.estimated_air}</strong>
                  </div>
                </div>
              </div>
            ` : ''}
          </div>

          <div class="mock-card-footer">
            <span class="active-takers">👥 ${(pack.activeUsers || 24800).toLocaleString()} Aspirants</span>
            
            <div class="mock-card-actions">
              ${isAttempted ? `
                <button class="btn-attempt-card" style="background: #3476BB; color: #ffffff;" onclick="window.appController.viewSolutions('${att.attempt_id}', '${pack.id}')">
                  View Solutions 📘
                </button>
                <button class="btn-view-scorecard" onclick="window.appController.viewAttemptScorecard('${att.attempt_id}', '${pack.id}')">
                  Scorecard 📊
                </button>
                <button class="btn-attempt-card" style="background: #007bb5;" onclick="window.appController.startMockTest('${pack.id}')">
                  Re-take ↺
                </button>
              ` : `
                <button class="btn-attempt-card" onclick="window.appController.startMockTest('${pack.id}')">
                  Attempt Now 🚀
                </button>
              `}
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  // ==========================================
  // USER ISOLATED ANALYTICS TAB
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
          <div class="desc">Tests Attempted (Persistent in DB)</div>
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
      });
    }

    if (btnCloseExamModal && examModal) {
      btnCloseExamModal.addEventListener('click', () => {
        examModal.classList.remove('active');
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
        userModal.classList.remove('active');
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

    // Bottom Navigation switching
    document.querySelectorAll('.app-nav-item').forEach(btn => {
      btn.addEventListener('click', () => {
        const view = btn.dataset.view;
        this.switchAppView(view);
      });
    });

    // ESC key closes modals
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (examModal) examModal.classList.remove('active');
        if (userModal) userModal.classList.remove('active');
      }
    });
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

  switchAppView(viewId) {
    this.currentViewTab = viewId;

    document.querySelectorAll('.app-nav-item').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.view === viewId);
    });

    document.querySelectorAll('.app-view-tab').forEach(tab => {
      tab.classList.toggle('active', tab.id === `view-${viewId}`);
    });

    window.scrollTo({ top: 0, behavior: 'smooth' });

    if (viewId === 'analytics') {
      this.renderAnalytics();
    }
  }

  // ==========================================
  // TEST ENGINE LAUNCH & SCORECARD REVIEW
  // ==========================================

  async startMockTest(testId) {
    console.log('Loading test payload for:', testId);
    
    // Fetch test questions from backend SQLite API
    let testData = await window.obDataManager.getTestById(testId);

    // Fallback if not loaded via API
    if (!testData) {
      if (window.OB_TEST_APP.mockQuestions && window.OB_TEST_APP.mockQuestions[testId]) {
        testData = window.OB_TEST_APP.mockQuestions[testId];
      } else {
        alert('Test data loading... please wait');
        return;
      }
    }

    if (window.initTestEngine) {
      this.testEngine = window.initTestEngine(testData);
      this.testEngine.startTest();
    }
  }

  async viewSolutions(attemptId, testId) {
    try {
      const res = await fetch(`/api/attempts/${encodeURIComponent(attemptId)}`);
      const data = await res.json();
      if (!data.success) throw new Error('Attempt not found');

      const testData = await window.obDataManager.getTestById(testId);

      if (window.openOliveboardSolutions) {
        window.openOliveboardSolutions(data.attempt, testData);
      }
    } catch (e) {
      console.error('Failed to view solutions:', e);
      alert('Failed to load solutions: ' + e.message);
    }
  }

  async viewAttemptScorecard(attemptId, testId) {
    try {
      const res = await fetch(`/api/attempts/${encodeURIComponent(attemptId)}`);
      const data = await res.json();
      if (!data.success) throw new Error('Attempt not found');

      const testData = await window.obDataManager.getTestById(testId);

      if (!this.testEngine) {
        this.testEngine = window.initTestEngine(testData);
      }
      this.testEngine.showScorecardForAttempt(data.attempt, testData);
    } catch (e) {
      console.error('Failed to view scorecard:', e);
      alert('Failed to load scorecard: ' + e.message);
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
