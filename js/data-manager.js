/**
 * Oliveboard Mock Test App - Full-Stack Data Manager & SQLite Client
 * 
 * Responsibilities:
 * 1. Multi-User Isolation: Manages active candidate profile & guarantees data isolation
 * 2. Permanent Result Storage: Saves test attempts to backend SQLite DB (/api/attempts)
 * 3. Dynamic Test Loading: Fetches 150-question IBPS SO IT Mains & other tests from DB
 * 4. User-Isolated Analytics: Fetches individual candidate stats & heatmaps
 */

class OBTestDataManager {
  constructor() {
    this.API_BASE = ''; // Same origin
    this.STORAGE_KEY_ACTIVE_USER = 'ob_active_user_id';
    this.activeUser = null;
    this.users = [];
  }

  async init() {
    await this.loadUsers();
    // Retrieve saved user ID from localStorage or pick the first user
    const savedUserId = localStorage.getItem(this.STORAGE_KEY_ACTIVE_USER);
    if (savedUserId && this.users.find(u => u.id === savedUserId)) {
      this.activeUser = this.users.find(u => u.id === savedUserId);
    } else if (this.users.length > 0) {
      this.activeUser = this.users[0];
      localStorage.setItem(this.STORAGE_KEY_ACTIVE_USER, this.activeUser.id);
    }
    return this.activeUser;
  }

  getActiveUser() {
    return this.activeUser;
  }

  getActiveUserId() {
    return this.activeUser ? this.activeUser.id : 'user-rahul';
  }

  setActiveUser(userId) {
    const user = this.users.find(u => u.id === userId);
    if (user) {
      this.activeUser = user;
      localStorage.setItem(this.STORAGE_KEY_ACTIVE_USER, user.id);
      return user;
    }
    return null;
  }

  // ===============================================
  // USER MANAGEMENT (MULTI-USER ISOLATION)
  // ===============================================

  async loadUsers() {
    try {
      const res = await fetch(`${this.API_BASE}/api/users`);
      const data = await res.json();
      if (data.success) {
        this.users = data.users;
        return this.users;
      }
    } catch (e) {
      console.warn('Failed to fetch users from backend, using fallback:', e);
      this.users = [
        { id: 'user-rahul', name: 'Aspirant Rahul Sharma', roll_no: 'OB-2026-9041', avatar: 'R', target_exam: 'ibps-so', attempts_count: 0 },
        { id: 'user-priya', name: 'Priya Verma', roll_no: 'OB-2026-8812', avatar: 'P', target_exam: 'sbi-po', attempts_count: 0 },
        { id: 'user-vikram', name: 'Vikram Malhotra', roll_no: 'OB-2026-4421', avatar: 'V', target_exam: 'ssc-cgl', attempts_count: 0 }
      ];
    }
    return this.users;
  }

  async createUser(candidateData) {
    try {
      const res = await fetch(`${this.API_BASE}/api/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(candidateData)
      });
      const data = await res.json();
      if (data.success) {
        await this.loadUsers();
        this.setActiveUser(data.user.id);
        return data.user;
      }
      throw new Error(data.error || 'Failed to create user');
    } catch (e) {
      console.error('Error creating candidate:', e);
      throw e;
    }
  }

  // ===============================================
  // TEST CATALOG (WITH USER-SPECIFIC ATTEMPT STATUS)
  // ===============================================

  async getTestsList(examId = 'all') {
    const userId = this.getActiveUserId();
    try {
      const url = `${this.API_BASE}/api/tests?examId=${encodeURIComponent(examId)}&userId=${encodeURIComponent(userId)}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.success) {
        return data.tests;
      }
    } catch (e) {
      console.warn('Failed to load tests from backend API, using local fallback:', e);
    }
    return [];
  }

  async getTestById(testId) {
    try {
      const res = await fetch(`${this.API_BASE}/api/tests/${encodeURIComponent(testId)}`);
      const data = await res.json();
      if (data.success) {
        return data.test;
      }
    } catch (e) {
      console.error(`Failed to load test details for ${testId}:`, e);
    }
    return null;
  }

  // ===============================================
  // PERMANENT RESULT STORAGE (NEVER DELETES DATA)
  // ===============================================

  /**
   * Save a completed test attempt to SQLite database.
   * Every attempt is permanently recorded and keyed to the active user.
   */
  async saveResult(result) {
    const activeUserId = this.getActiveUserId();
    
    const payload = {
      userId: activeUserId,
      testId: result.testId,
      testTitle: result.testTitle,
      totalQuestions: result.totalQuestions,
      score: result.score.netScore || result.score.total || 0,
      maxScore: result.score.maxScore || 100,
      correctCount: result.score.correct || 0,
      wrongCount: result.score.wrong || 0,
      unansweredCount: result.score.unanswered || 0,
      accuracy: result.score.accuracy || 0,
      percentile: result.score.percentile || 0,
      estimatedAir: result.score.estimatedAIR || 1000,
      timeSpentSeconds: result.timing.totalTimeSeconds || 0,
      sectionBreakdown: result.sectionBreakdown || [],
      responses: result.responses || {},
      startedAt: result.timing.startedAt,
      completedAt: result.timing.completedAt
    };

    try {
      const res = await fetch(`${this.API_BASE}/api/attempts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        console.log(`[Permanent DB] Test result saved successfully in SQLite: ${data.attemptId}`);
        result.attemptId = data.attemptId;
      }
    } catch (e) {
      console.error('Failed to save result to backend DB, saving to localStorage as fallback:', e);
      // Local fallback
      const key = `ob_attempts_${activeUserId}`;
      const existing = JSON.parse(localStorage.getItem(key) || '[]');
      existing.push(payload);
      localStorage.setItem(key, JSON.stringify(existing));
    }

    return result;
  }

  // ===============================================
  // USER ISOLATED ATTEMPTS & ANALYTICS
  // ===============================================

  async getUserAttempts(userId = null) {
    const uId = userId || this.getActiveUserId();
    try {
      const res = await fetch(`${this.API_BASE}/api/attempts?userId=${encodeURIComponent(uId)}`);
      const data = await res.json();
      if (data.success) {
        return data.attempts;
      }
    } catch (e) {
      console.warn('Failed to load user attempts from API:', e);
    }
    return [];
  }

  async getUserAnalytics(userId = null) {
    const uId = userId || this.getActiveUserId();
    try {
      const res = await fetch(`${this.API_BASE}/api/analytics?userId=${encodeURIComponent(uId)}`);
      const data = await res.json();
      if (data.success) {
        return data.stats;
      }
    } catch (e) {
      console.warn('Failed to load user analytics from API:', e);
    }
    return {
      testsAttempted: 0,
      avgScore: '0 / 0',
      avgAccuracy: '0.0%',
      overallPercentile: '0.0%ile',
      predictedAIR: '#--',
      streakDays: 0,
      sectionBreakdowns: []
    };
  }
}

// Instantiate globally
window.OBTestDataManager = OBTestDataManager;
window.obDataManager = new OBTestDataManager();
