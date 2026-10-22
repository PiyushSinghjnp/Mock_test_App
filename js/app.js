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
      { id: "topic", label: "Topic Tests" },
      { id: "pyq", label: "Previous Year Papers" }
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

  renderStatusFilterPills() {
    const statusContainer = document.getElementById('status-filter-bar');
    if (!statusContainer) return;

    const pills = [
      { id: "all", label: "All" },
      { id: "unattempted", label: "Unattempted" },
      { id: "attempted", label: "Attempted" },
      { id: "free", label: "Free Tests" }
    ];

    statusContainer.innerHTML = pills.map(p => `
      <button class="status-pill ${p.id === this.currentStatusFilter ? 'active' : ''}" data-status="${p.id}">
        ${p.label}
      </button>
    `).join('');

    statusContainer.querySelectorAll('.status-pill').forEach(btn => {
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
      displayPacks = displayPacks.filter(p => p.type === this.currentFilterTab);
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
              <div class="spec-entry"><span class="spec-icon">❓</span> ${totalQs} Qs</div>
              <div class="spec-entry"><span class="spec-icon">✓</span> ${pack.marks} Marks</div>
              <div class="spec-entry"><span class="spec-icon">⏱</span> ${pack.duration_minutes || pack.durationMinutes} Mins</div>
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
    const textInput = document.getElementById('ob-live-text-input');
    const btnSendText = document.getElementById('btn-ob-send-text');
    const btnPressEnter = document.getElementById('btn-ob-press-enter');
    const btnPressBackspace = document.getElementById('btn-ob-press-backspace');
    const btnPressTab = document.getElementById('btn-ob-press-tab');
    const btnScrapeNow = document.getElementById('btn-ob-scrape-now');

    if (btnOpen && modal) {
      btnOpen.addEventListener('click', () => this.openOliveboardLiveBrowser());
    }

    if (btnClose && modal) {
      btnClose.addEventListener('click', () => this.closeOliveboardLiveBrowser());
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
        const scaleX = 1280 / Math.max(1, rect.width);
        const scaleY = 760 / Math.max(1, rect.height);
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
        if (dot) {
          dot.style.left = `${e.clientX - viewportWrapper.getBoundingClientRect().left}px`;
          dot.style.top = `${e.clientY - viewportWrapper.getBoundingClientRect().top}px`;
          dot.style.display = 'block';
          setTimeout(() => { dot.style.display = 'none'; }, 350);
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
        // Don't hijack typing if user is focused on the URL bar or text box
        if (document.activeElement === urlInput || document.activeElement === textInput) return;
        e.preventDefault();
        this.sendObBrowserInput({ type: 'keydown', key: e.key });
      });
    }

    if (btnScrapeNow) {
      btnScrapeNow.addEventListener('click', () => this.scrapeOliveboardLivePage());
    }
  }

  async openOliveboardLiveBrowser() {
    const modal = document.getElementById('ob-live-browser-modal');
    const statusBanner = document.getElementById('ob-live-status-banner');
    if (!modal) return;
    modal.style.display = 'flex';
    this._obBrowserActive = true;

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

  closeOliveboardLiveBrowser() {
    const modal = document.getElementById('ob-live-browser-modal');
    if (modal) modal.style.display = 'none';
    this._obBrowserActive = false;
    if (this._obFrameTimer) clearTimeout(this._obFrameTimer);
  }

  async _pollObBrowserFrame() {
    if (!this._obBrowserActive) return;
    try {
      const res = await fetch('/api/ob-browser/frame');
      const data = await res.json();
      const imgSrc = data.imageBase64 || (data.image ? `data:image/jpeg;base64,${data.image}` : '');
      if (data.success && imgSrc) {
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
      // Trigger immediate frame refresh
      if (this._obFrameTimer) clearTimeout(this._obFrameTimer);
      this._pollObBrowserFrame();
    } catch (e) {
      console.error('OB browser input error:', e);
    }
  }

  async scrapeOliveboardLivePage() {
    const statusBanner = document.getElementById('ob-live-status-banner');
    const btnScrape = document.getElementById('btn-ob-scrape-now');
    if (statusBanner) {
      statusBanner.textContent = '⏳ Reverse-engineering current Oliveboard page (extracting DOM, CSS, Base64 questions & solutions)...';
    }
    if (btnScrape) btnScrape.disabled = true;

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
        const saved = r.specFile || data.savedFile || 'scraped/';
        const msg = `✅ Reverse-Engineered "${r.title || 'Oliveboard Page'}" (${qCount} questions, ${sCount} solutions, ${r.uiElementsMatched || 0} UI rules)! Saved to ${saved}${r.ingestedTestId ? ' & auto-imported into Mock Dashboard!' : ''}`;
        if (statusBanner) statusBanner.textContent = msg;
        this.showToast(msg, 'success');
        if (r.ingestedTestId) {
          await this.loadAndRenderMockCards();
        }
      } else {
        throw new Error(data.error || 'Scrape failed');
      }
    } catch (e) {
      if (statusBanner) statusBanner.textContent = '❌ Scrape error: ' + e.message;
      this.showToast('Scrape error: ' + e.message, 'error');
    } finally {
      if (btnScrape) btnScrape.disabled = false;
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

  async startMockTest(testId, forceFresh = false) {
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

    if (window.initTestEngine) {
      this.testEngine = window.initTestEngine(testData);
      this.testEngine.startTest(null);
    }
  }

  async resumeMockTest(testId) {
    let testData = await window.obDataManager.getTestById(testId);
    if (!testData && window.OB_TEST_APP.mockQuestions && window.OB_TEST_APP.mockQuestions[testId]) {
      testData = window.OB_TEST_APP.mockQuestions[testId];
    }
    if (!testData) return;

    const pausedState = window.obDataManager ? await window.obDataManager.getPausedAttempt(testId) : null;
    if (window.initTestEngine) {
      this.testEngine = window.initTestEngine(testData);
      this.testEngine.startTest(pausedState);
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
      this.showToast('Failed to load solutions: ' + e.message, 'error');
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
