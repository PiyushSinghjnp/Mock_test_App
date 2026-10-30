/**
 * Oliveboard Mock Test App - Full-Stack Data Manager & SQLite Client
 * 
 * Responsibilities:
 * 1. Multi-User Isolation: Manages active candidate profile & guarantees data isolation
 * 2. Permanent Result Storage: Saves test attempts to backend SQLite DB (/api/attempts)
 * 3. Dynamic Test Loading: Fetches 150-question IBPS SO IT Mains & other tests from DB
 * 4. User-Isolated Analytics: Fetches individual candidate stats & heatmaps
 * 5. Question Paper JSON Upload: Uploads JSON and auto-applies 2026 official marking scheme & sectional timings
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
    // Retrieve saved user ID from localStorage ONLY if authenticated with token
    const savedUserId = localStorage.getItem(this.STORAGE_KEY_ACTIVE_USER);
    const authToken = localStorage.getItem('ob_auth_token');

    if (savedUserId && authToken && this.users.find(u => u.id === savedUserId)) {
      this.activeUser = this.users.find(u => u.id === savedUserId);
    } else {
      this.activeUser = null;
    }
    return this.activeUser;
  }

  getActiveUser() {
    return this.activeUser;
  }

  getActiveUserId() {
    return this.activeUser ? this.activeUser.id : (this.users[0] ? this.users[0].id : 'user-rahul');
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

  async login(username, password) {
    const res = await fetch(`${this.API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Login failed');
    }
    this.activeUser = data.user;
    localStorage.setItem(this.STORAGE_KEY_ACTIVE_USER, data.user.id);
    localStorage.removeItem('ob_explicit_logout');
    if (data.token) {
      localStorage.setItem('ob_auth_token', data.token);
    }
    await this.loadUsers();
    return data.user;
  }

  async register(username, password, name, target_exam) {
    const res = await fetch(`${this.API_BASE}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password, name, target_exam })
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Registration failed');
    }
    this.activeUser = data.user;
    localStorage.setItem(this.STORAGE_KEY_ACTIVE_USER, data.user.id);
    localStorage.removeItem('ob_explicit_logout');
    if (data.token) {
      localStorage.setItem('ob_auth_token', data.token);
    }
    await this.loadUsers();
    return data.user;
  }

  logout() {
    this.activeUser = null;
    localStorage.removeItem(this.STORAGE_KEY_ACTIVE_USER);
    localStorage.removeItem('ob_auth_token');
    localStorage.setItem('ob_explicit_logout', 'true');
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
        if (this.activeUser) {
          const freshActive = this.users.find(u => u.id === this.activeUser.id);
          if (freshActive) this.activeUser = freshActive;
        }
        return this.users;
      }
    } catch (e) {
      console.warn('Failed to fetch users from backend, using fallback:', e);
      if (!this.users || this.users.length === 0) {
        this.users = [
          { id: 'user-rahul', name: 'Aspirant Rahul Sharma', roll_no: 'OB-2026-9041', avatar: 'R', target_exam: 'ibps-so', attempts_count: 0 },
          { id: 'user-priya', name: 'Priya Verma', roll_no: 'OB-2026-8812', avatar: 'P', target_exam: 'sbi-po', attempts_count: 0 },
          { id: 'user-vikram', name: 'Vikram Malhotra', roll_no: 'OB-2026-4421', avatar: 'V', target_exam: 'ssc-cgl', attempts_count: 0 }
        ];
      }
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

  async updateUserTargetExam(examId) {
    if (!examId) return null;
    const active = this.getActiveUser();
    if (!active) return null;
    active.target_exam = examId;
    try {
      const res = await fetch(`${this.API_BASE}/api/users/${encodeURIComponent(active.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target_exam: examId })
      });
      const data = await res.json();
      if (data && data.success && data.user) {
        const idx = this.users.findIndex(u => u.id === active.id);
        if (idx !== -1) this.users[idx] = data.user;
        this.activeUser = data.user;
        return data.user;
      }
    } catch (e) {
      console.warn('Could not persist target_exam update:', e);
    }
    return active;
  }

  // ===============================================
  // TEST CATALOG & 2026 JSON UPLOAD
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

  async get2026ExamPatterns() {
    if (window.OB_EXAM_PATTERNS_2026 && window.OB_EXAM_PATTERNS_2026.EXAM_PATTERNS_2026) {
      return window.OB_EXAM_PATTERNS_2026.EXAM_PATTERNS_2026;
    }
    try {
      const res = await fetch(`${this.API_BASE}/api/exam-patterns-2026`);
      const data = await res.json();
      if (data.success) return data.patterns || data.exams || {};
    } catch (e) {
      console.warn('Failed to fetch 2026 exam patterns:', e);
    }
    return {};
  }

  async uploadQuestionPaperJson({ rawPaper, examId, stage, customTitle, customTestId, title, testId, subtitle, filename }) {
    const res = await fetch(`${this.API_BASE}/api/tests/upload-json`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        rawPaper,
        examId,
        stage,
        title: customTitle || title,
        testId: customTestId || testId,
        customTitle: customTitle || title,
        customTestId: customTestId || testId,
        subtitle,
        filename
      })
    });
    const data = await res.json();
    if (!data.success) {
      throw new Error(data.error || 'Failed to upload question paper JSON');
    }
    return data;
  }

  // ===============================================
  // PERMANENT RESULT STORAGE (NEVER DELETES DATA)
  // ===============================================

  async saveResult(result) {
    const activeUserId = this.getActiveUserId();
    
    const payload = {
      userId: activeUserId,
      testId: result.testId,
      testTitle: result.testTitle,
      totalQuestions: result.totalQuestions,
      score: result.score.netScore ?? result.score.total ?? 0,
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
        await this.loadUsers();
      }
    } catch (e) {
      console.error('Failed to save result to backend DB, saving to localStorage as fallback:', e);
      const key = `ob_attempts_${activeUserId}`;
      const existing = JSON.parse(localStorage.getItem(key) || '[]');
      payload.id = payload.id || `local-att-${Date.now()}`;
      existing.push(payload);
      localStorage.setItem(key, JSON.stringify(existing));
      result.attemptId = payload.id;
    }

    // Clear local paused state
    localStorage.removeItem(`ob_paused_${activeUserId}_${result.testId}`);

    return result;
  }

  // ===============================================
  // PAUSED TEST PERSISTENCE (Spec 4.1 & 1.3)
  // ===============================================

  async savePausedAttempt(pausedState) {
    const activeUserId = this.getActiveUserId();
    const payload = {
      userId: activeUserId,
      testId: pausedState.testId,
      currentSectionIndex: pausedState.currentSectionIndex ?? 0,
      currentQuestionIndex: pausedState.currentQuestionIndex ?? 0,
      lastQuestionNumber: pausedState.lastQuestionNumber ?? 1,
      sectionRemainingSeconds: pausedState.sectionRemainingSeconds ?? 1200,
      remainingSeconds: pausedState.remainingSeconds ?? 3600,
      completedSections: pausedState.completedSections || [],
      responses: pausedState.responses || {},
      bookmarkedQuestions: pausedState.bookmarkedQuestions || {}
    };

    localStorage.setItem(`ob_paused_${activeUserId}_${pausedState.testId}`, JSON.stringify(payload));

    try {
      await fetch(`${this.API_BASE}/api/paused-attempts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    } catch (e) {
      console.warn('Saved paused state to localStorage fallback:', e);
    }
    return payload;
  }

  async getPausedAttempt(testId) {
    const activeUserId = this.getActiveUserId();
    try {
      const res = await fetch(`${this.API_BASE}/api/paused-attempts?userId=${encodeURIComponent(activeUserId)}&testId=${encodeURIComponent(testId)}`);
      const data = await res.json();
      if (data.success && data.pausedAttempt) {
        return data.pausedAttempt;
      }
    } catch (e) {
      // fallback to localStorage
    }
    const local = localStorage.getItem(`ob_paused_${activeUserId}_${testId}`);
    return local ? JSON.parse(local) : null;
  }

  async clearPausedAttempt(testId) {
    const activeUserId = this.getActiveUserId();
    localStorage.removeItem(`ob_paused_${activeUserId}_${testId}`);
    try {
      await fetch(`${this.API_BASE}/api/paused-attempts?userId=${encodeURIComponent(activeUserId)}&testId=${encodeURIComponent(testId)}`, {
        method: 'DELETE'
      });
    } catch (e) {
      // ignore
    }
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
      console.warn('Failed to load user attempts from API, checking localStorage fallback:', e);
    }
    try {
      const localRaw = localStorage.getItem(`ob_attempts_${uId}`);
      if (localRaw) {
        return JSON.parse(localRaw);
      }
    } catch (err) {
      // ignore
    }
    return [];
  }

  async getLeaderboard(examId = 'all') {
    try {
      const res = await fetch(`${this.API_BASE}/api/leaderboard?examId=${encodeURIComponent(examId)}`);
      const data = await res.json();
      if (data && data.success && Array.isArray(data.entries)) {
        return data.entries;
      }
    } catch (e) {
      console.warn('Failed to load multi-user leaderboard from API:', e);
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

  // ===============================================
  // PERSISTENT CANDIDATE BOOKMARKS (SUBJECT-WISE REVISION HUB)
  // ===============================================

  _getBookmarkStorageKey(userId = null) {
    const uId = userId || this.getActiveUserId();
    return `ob_bookmarks_${uId}`;
  }

  getCanonicalSubjects() {
    return [
      'Quantitative Aptitude',
      'Reasoning Ability',
      'English Language',
      'Professional Knowledge',
      'General Awareness'
    ];
  }

  normalizeSubjectCategory(rawSection = '', testTitle = '', questionText = '') {
    const combined = `${rawSection} ${testTitle} ${questionText}`.toLowerCase();
    const secLower = String(rawSection || '').toLowerCase();

    if (
      secLower.includes('quant') ||
      secLower.includes('numerical') ||
      secLower.includes('data interpretation') ||
      secLower.includes('arithmetic') ||
      secLower.includes('math') ||
      /\bdi\b/.test(secLower)
    ) {
      return 'Quantitative Aptitude';
    }
    if (
      secLower.includes('reason') ||
      secLower.includes('analytical') ||
      secLower.includes('puzzle') ||
      secLower.includes('seating') ||
      secLower.includes('logic') ||
      secLower.includes('intelligence')
    ) {
      return 'Reasoning Ability';
    }
    if (
      secLower.includes('english') ||
      secLower.includes('verbal') ||
      secLower.includes('reading comprehension') ||
      secLower.includes('grammar') ||
      secLower.includes('vocab')
    ) {
      return 'English Language';
    }
    if (
      secLower.includes('professional') ||
      secLower.includes('it officer') ||
      secLower.includes('specialist') ||
      secLower.includes('dbms') ||
      secLower.includes('network') ||
      secLower.includes('agriculture') ||
      secLower.includes('marketing') ||
      secLower.includes('law')
    ) {
      return 'Professional Knowledge';
    }
    if (
      secLower.includes('general') ||
      secLower.includes('banking') ||
      secLower.includes('financial') ||
      secLower.includes('awareness') ||
      secLower.includes('current affairs') ||
      secLower.includes('economy') ||
      secLower.includes('computer') ||
      secLower.includes('gk')
    ) {
      return 'General Awareness';
    }

    // Secondary inference from combined test title + question text
    if (combined.includes('quant') || combined.includes('number series') || combined.includes('profit') || combined.includes('interest')) {
      return 'Quantitative Aptitude';
    }
    if (combined.includes('reasoning') || combined.includes('syllogism') || combined.includes('arrangement')) {
      return 'Reasoning Ability';
    }
    if (combined.includes('english') || combined.includes('sentence') || combined.includes('parajumble')) {
      return 'English Language';
    }
    if (combined.includes('b+ tree') || combined.includes('sql') || combined.includes('osi model') || combined.includes('it officer')) {
      return 'Professional Knowledge';
    }
    return 'General Awareness';
  }

  _getDefaultStarterBookmarks() {
    return [
      {
        id: 'bm-1032',
        questionId: 1032,
        testId: 'sbi-po-sec-quant',
        testTitle: 'SBI PO Quantitative Aptitude Speed Sectional',
        section: 'Quantitative Aptitude',
        subject: 'Quantitative Aptitude',
        customTags: ['Number Series', 'Speed Math', 'Must Revise'],
        title: 'Missing Number Series with Alternating Odd Squares',
        passageHTML: '',
        questionHTML: 'What value will come in place of the question mark (?) in the following number series?<br><br><b>7, 16, 41, 90, 171, ?</b>',
        questionSnippet: 'Find the missing number in the series: 7, 16, 41, 90, 171, ?',
        options: [
          '272',
          '284',
          '292',
          '305',
          '312'
        ],
        correctIndex: 2,
        explanationHTML: '<b>Step-by-Step Solution:</b><br>Examine the first-level differences between consecutive terms:<br>• 16 − 7 = <b>+9</b> (3²)<br>• 41 − 16 = <b>+25</b> (5²)<br>• 90 − 41 = <b>+49</b> (7²)<br>• 171 − 90 = <b>+81</b> (9²)<br>The differences are squares of consecutive odd numbers (3², 5², 7², 9²).<br>Next difference = 11² = <b>+121</b>.<br>Therefore, ? = 171 + 121 = <b>292</b> (Option C).',
        answerKey: 'Pattern: +9 (+3²), +25 (+5²), +49 (+7²), +81 (+9²), +121 (+11²) => 292',
        difficulty: 'Tricky',
        savedAt: new Date().toISOString()
      },
      {
        id: 'bm-1044',
        questionId: 1044,
        testId: 'ibps-po-pre-01',
        testTitle: 'IBPS PO 2026 Prelims - Full Mock 1',
        section: 'Quantitative Aptitude',
        subject: 'Quantitative Aptitude',
        customTags: ['Arithmetic', 'Compound Interest', 'Formula'],
        title: 'Compound vs Simple Interest 3-Year Difference Shortcut',
        passageHTML: '',
        questionHTML: 'The difference between Compound Interest and Simple Interest on a certain sum of money invested at <b>10% per annum for 3 years</b> is <b>₹ 930</b>. Find the principal sum invested.',
        questionSnippet: 'The difference between CI and SI on a sum at 10% p.a. for 3 years is ₹ 930. Find the principal sum.',
        options: [
          '₹ 25,000',
          '₹ 28,500',
          '₹ 30,000',
          '₹ 31,000',
          '₹ 32,500'
        ],
        correctIndex: 2,
        explanationHTML: '<b>Direct 3-Year CI − SI Shortcut Formula:</b><br>For 3 years at rate R% p.a.:<br><code>CI − SI = P × (R / 100)² × ((300 + R) / 100)</code><br>Substitute R = 10% and Difference = ₹ 930:<br>• 930 = P × (10 / 100)² × (310 / 100)<br>• 930 = P × (1 / 100) × (31 / 10) = P × (31 / 1000)<br>• P = (930 × 1000) / 31 = <b>₹ 30,000</b> (Option C).',
        answerKey: '3-Yr CI-SI = 3.1% of P => 3.1% of P = 930 => P = ₹ 30,000',
        difficulty: 'Moderate',
        savedAt: new Date().toISOString()
      },
      {
        id: 'bm-1018',
        questionId: 1018,
        testId: 'sbi-po-sec-reas',
        testTitle: 'SBI PO Reasoning Ability Sectional Mock',
        section: 'Reasoning Ability',
        subject: 'Reasoning Ability',
        customTags: ['Syllogism', 'Only A Few', 'Tricky'],
        title: 'Only A Few Syllogism with Possibility Conclusion',
        passageHTML: '<b>Directions:</b> In the question below are given three statements followed by two conclusions numbered I and II. You have to take the given statements to be true even if they seem to be at variance with commonly known facts.',
        questionHTML: '<b>Statements:</b><br>I. Only a few Rivers are Oceans.<br>II. All Oceans are Glaciers.<br>III. No Glacier is a Desert.<br><br><b>Conclusions:</b><br>I. All Rivers can never be Deserts.<br>II. Some Rivers are definitely not Oceans.',
        questionSnippet: 'Statements: Only a few Rivers are Oceans. All Oceans are Glaciers. No Glacier is a Desert...',
        options: [
          'Only Conclusion I follows',
          'Only Conclusion II follows',
          'Either Conclusion I or II follows',
          'Neither Conclusion I nor II follows',
          'Both Conclusions I and II follow'
        ],
        correctIndex: 4,
        explanationHTML: '<b>Venn Diagram Deduction:</b><br>1. <i>"Only a few Rivers are Oceans"</i> means <b>Some Rivers are Oceans</b> AND <b>Some Rivers are NOT Oceans</b>. Thus, <b>Conclusion II definitely follows</b>.<br>2. Since Some Rivers are Oceans, and All Oceans are Glaciers, that overlapping portion of Rivers is inside Glaciers. Since No Glacier is a Desert, that part of Rivers can NEVER be Deserts. Hence <i>"All Rivers can never be Deserts"</i> is 100% true — <b>Conclusion I also follows</b>.<br>Therefore, <b>Both Conclusions I and II follow</b> (Option E).',
        answerKey: 'Option E — Both Conclusions I and II follow ("Only a few" implies both Some and Some Not)',
        difficulty: 'Tricky',
        savedAt: new Date().toISOString()
      },
      {
        id: 'bm-1003',
        questionId: 1003,
        testId: 'sbi-po-pre-01',
        testTitle: 'SBI PO 2026 Prelims - Full Mock 1',
        section: 'English Language',
        subject: 'English Language',
        customTags: ['Parajumble', 'Reading Skill'],
        title: 'Parajumble Rearrangement Sequence (Great Pacific Patch)',
        passageHTML: '<b>Directions:</b> Rearrange the following six sentences (A), (B), (C), (D), (E), and (F) in a proper sequence to form a meaningful paragraph, then answer the question given below.',
        questionHTML: '<b>(A)</b> However, unlike biodegradable debris, synthetic polymers merely photodegrade into microplastics.<br><b>(B)</b> Consequently, marine organisms ingest these toxic particles, introducing pollutants into the food chain.<br><b>(C)</b> Spanning millions of square kilometers, the Great Pacific Garbage Patch is the largest accumulation of ocean plastic.<br><b>(D)</b> International treaties must therefore mandate strict source-reduction targets.<br><b>(E)</b> Most of this debris originates from land-based industrial runoff and fishing vessels.<br><b>(F)</b> Once inside the gyre, rotational currents trap the waste indefinitely.<br><br><b>Which of the following should be the FIRST (opening) sentence after rearrangement?</b>',
        questionSnippet: 'Rearrange sentences C, E, A, F, B, D to form a coherent paragraph on the Great Pacific Garbage Patch...',
        options: [
          'Sentence A',
          'Sentence C',
          'Sentence E',
          'Sentence F',
          'Sentence D'
        ],
        correctIndex: 1,
        explanationHTML: '<b>Logical Flow Analysis:</b><br>• <b>Sentence C</b> introduces the independent theme ("the Great Pacific Garbage Patch") and defines its scale, making it the clear opening sentence.<br>• <b>C → E</b> ("this debris" refers to the ocean plastic in C).<br>• <b>E → F → A → B → D</b> completes the cause-and-effect chain.<br>Correct sequence: <b>C - E - F - A - B - D</b>. Opening sentence is <b>Sentence C</b> (Option B).',
        answerKey: 'Option B (Sentence C is the opening sentence; full sequence: C-E-F-A-B-D)',
        difficulty: 'Moderate',
        savedAt: new Date().toISOString()
      },
      {
        id: 'bm-1025',
        questionId: 1025,
        testId: 'ibps-so-it-mains-1',
        testTitle: 'IBPS SO IT Officer Mains - Full Mock 1',
        section: 'Professional Knowledge',
        subject: 'Professional Knowledge',
        customTags: ['DBMS', 'B+ Tree', 'Formula'],
        title: 'B+ Tree Indexing & Page Splitting Order',
        passageHTML: '',
        questionHTML: 'In a <b>B+ tree of order <i>m = 4</i></b> (where order <i>m</i> denotes the maximum number of child pointers per internal node), what is the maximum number of search key values that can be stored in a single internal node before a node split is triggered?',
        questionSnippet: 'In a B+ tree of order 4, what is the maximum number of search keys that can be stored in an internal node before splitting occurs?',
        options: [
          '2 keys',
          '3 keys',
          '4 keys',
          '5 keys',
          '7 keys'
        ],
        correctIndex: 1,
        explanationHTML: '<b>DBMS B+ Tree Property:</b><br>• In a B+ tree of order <i>m</i>, each internal node can hold at most <b><i>m</i> child pointers</b> and at most <b><i>m − 1</i> search keys</b>.<br>• Given order <i>m</i> = 4:<br>  Max child pointers = 4<br>  Max search keys before split = 4 − 1 = <b>3 keys</b> (Option B).',
        answerKey: 'Order m = 4 => max child pointers = 4, max search keys = m - 1 = 3 (Option B)',
        difficulty: 'Hard',
        savedAt: new Date().toISOString()
      }
    ];
  }

  _hydrateLegacyBookmark(item) {
    if (!item || typeof item !== 'object') return item;

    const defaults = this._getDefaultStarterBookmarks();
    const matchedStarter = defaults.find(
      d => String(d.id) === String(item.id) || String(d.questionId) === String(item.questionId)
    );

    if (matchedStarter) {
      return {
        ...matchedStarter,
        ...item,
        subject: item.subject || matchedStarter.subject,
        customTags: Array.isArray(item.customTags) ? item.customTags : matchedStarter.customTags,
        questionHTML: item.questionHTML || matchedStarter.questionHTML,
        passageHTML: item.passageHTML !== undefined ? item.passageHTML : matchedStarter.passageHTML,
        options: (Array.isArray(item.options) && item.options.length >= 2) ? item.options : matchedStarter.options,
        correctIndex: typeof item.correctIndex === 'number' ? item.correctIndex : matchedStarter.correctIndex,
        explanationHTML: item.explanationHTML || matchedStarter.explanationHTML
      };
    }

    const subject = item.subject || this.normalizeSubjectCategory(
      item.section || '',
      item.testTitle || '',
      item.questionSnippet || item.title || ''
    );
    const customTags = Array.isArray(item.customTags)
      ? item.customTags
      : (item.difficulty ? [item.difficulty] : ['Revision']);

    // Ensure options array is always present so card is interactive
    let options = Array.isArray(item.options) && item.options.length >= 2 ? item.options : null;
    let correctIndex = typeof item.correctIndex === 'number' ? item.correctIndex : 0;

    if (!options) {
      // Check if answerKey mentions Option A..E
      const m = String(item.answerKey || '').match(/Option\s+([A-E])/i);
      if (m) {
        correctIndex = Math.max(0, Math.min(4, m[1].toUpperCase().charCodeAt(0) - 65));
      }
      options = ['Option A', 'Option B', 'Option C', 'Option D', 'Option E'];
      if (item.answerKey) {
        options[correctIndex] = item.answerKey.replace(/^Option\s+[A-E]\s*/i, '').replace(/^\(|\)$/g, '').trim() || `Option ${String.fromCharCode(65 + correctIndex)}`;
      }
    }

    return {
      ...item,
      subject,
      customTags,
      passageHTML: item.passageHTML || '',
      questionHTML: item.questionHTML || item.questionSnippet || item.title || 'Saved exam question.',
      options,
      correctIndex,
      explanationHTML: item.explanationHTML || item.answerKey || 'Step-by-step verification available.'
    };
  }

  getBookmarks(userId = null) {
    const key = this._getBookmarkStorageKey(userId);
    try {
      const raw = localStorage.getItem(key);
      if (raw !== null) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const hydrated = parsed.map(item => this._hydrateLegacyBookmark(item));
          // Ensure all 4 starter subjects are represented if only the old 3 starter items existed
          if (hydrated.length === 3 && hydrated.every(b => ['bm-1003', 'bm-1025', 'bm-1032'].includes(String(b.id)))) {
            const fullDefaults = this._getDefaultStarterBookmarks();
            this.saveBookmarksList(fullDefaults, userId);
            return fullDefaults;
          }
          return hydrated;
        }
      }
    } catch (e) {
      console.warn('Error reading bookmarks from localStorage:', e);
    }
    const defaults = this._getDefaultStarterBookmarks();
    try {
      localStorage.setItem(key, JSON.stringify(defaults));
    } catch (e) {
      // ignore storage quota errors
    }
    return defaults;
  }

  saveBookmarksList(list, userId = null) {
    const key = this._getBookmarkStorageKey(userId);
    try {
      localStorage.setItem(key, JSON.stringify(list));
    } catch (e) {
      console.warn('Error saving bookmarks to localStorage:', e);
    }
    return list;
  }

  getBookmarkedMap(userId = null) {
    const list = this.getBookmarks(userId);
    const map = {};
    list.forEach(item => {
      if (item.questionId !== undefined) map[String(item.questionId)] = true;
      if (item.id !== undefined) map[String(item.id)] = true;
    });
    return map;
  }

  isBookmarked(questionId, userId = null) {
    if (questionId === undefined || questionId === null) return false;
    const qStr = String(questionId);
    const list = this.getBookmarks(userId);
    return list.some(item => String(item.questionId) === qStr || String(item.id) === qStr);
  }

  _stripHtmlToText(html) {
    if (!html) return '';
    const tmp = document.createElement('div');
    tmp.innerHTML = String(html);
    tmp.querySelectorAll('.hqt').forEach(el => el.remove());
    return (tmp.textContent || tmp.innerText || '').replace(/\s+/g, ' ').trim();
  }

  _cleanQuestionHtml(html) {
    if (!html) return '';
    const tmp = document.createElement('div');
    tmp.innerHTML = String(html);
    tmp.querySelectorAll('.hqt').forEach(el => el.remove());
    return tmp.innerHTML.trim();
  }

  toggleBookmark(questionObj, testData = null, sectionTitle = '') {
    if (!questionObj) return false;
    const qId = questionObj.id !== undefined ? questionObj.id : questionObj.questionNumber;
    const qStr = String(qId);
    const list = this.getBookmarks();
    const existingIdx = list.findIndex(item => String(item.questionId) === qStr || String(item.id) === qStr);

    if (existingIdx !== -1) {
      list.splice(existingIdx, 1);
      this.saveBookmarksList(list);
      return false; // unbookmarked
    }

    const rawPassage = questionObj.passageHTML || questionObj.passage_text || '';
    const cleanPassageHTML = this._cleanQuestionHtml(rawPassage);

    const rawQ = questionObj.questionHTML || questionObj.questionText || questionObj.question_text || questionObj.question || '';
    const cleanQ = this._stripHtmlToText(rawQ);
    const cleanQHTML = this._cleanQuestionHtml(rawQ) || cleanQ;

    const rawExp = questionObj.explanationHTML || questionObj.explanation || '';
    const cleanExp = this._stripHtmlToText(rawExp);
    const cleanExpHTML = this._cleanQuestionHtml(rawExp) || cleanExp;

    const corIdx = typeof questionObj.correctIndex === 'number' ? questionObj.correctIndex : 0;
    const corLetter = String.fromCharCode(65 + Math.max(0, corIdx));

    // Extract normalized array of options A-E
    let normalizedOptions = [];
    if (Array.isArray(questionObj.options)) {
      normalizedOptions = questionObj.options.map(o => {
        if (typeof o === 'string') return this._cleanQuestionHtml(o) || this._stripHtmlToText(o);
        return this._cleanQuestionHtml(o.html || o.text || '') || this._stripHtmlToText(o.text || o.html || '');
      });
    } else if (questionObj.options && typeof questionObj.options === 'object') {
      const keys = Object.keys(questionObj.options).sort();
      normalizedOptions = keys.map(k => this._cleanQuestionHtml(questionObj.options[k]));
    }
    if (normalizedOptions.length === 0) {
      normalizedOptions = ['Option A', 'Option B', 'Option C', 'Option D', 'Option E'];
    }

    const optText = this._stripHtmlToText(normalizedOptions[corIdx] || '');
    const secName = sectionTitle || questionObj.sectionTitle || questionObj.section || 'General';
    const testTitleStr = (testData && testData.title) || questionObj.testTitle || 'Mock Test';
    const canonicalSubject = this.normalizeSubjectCategory(secName, testTitleStr, cleanQ);

    const qNumLabel = questionObj.localIndex || questionObj.questionNumber || '';
    const title = cleanQ.length > 72
      ? `${secName}${qNumLabel ? ` (Q${qNumLabel})` : ''}: ${cleanQ.slice(0, 70)}...`
      : (cleanQ || `${secName} Question ${qNumLabel}`);

    const answerSummary = optText
      ? `Option ${corLetter} (${optText.slice(0, 80)})${cleanExp ? ' — ' + cleanExp.slice(0, 120) : ''}`
      : (cleanExp ? cleanExp.slice(0, 140) : `Correct Answer: Option ${corLetter}`);

    const autoTags = [];
    if (questionObj.topic) autoTags.push(String(questionObj.topic));
    if (secName && secName !== canonicalSubject) autoTags.push(secName);
    autoTags.push('Must Revise');

    const newEntry = {
      id: `bm-${qStr}`,
      questionId: qId,
      testId: (testData && testData.id) || questionObj.testId || 'sbi-po-pre-01',
      testTitle: testTitleStr,
      section: secName,
      subject: canonicalSubject,
      customTags: Array.from(new Set(autoTags)).slice(0, 4),
      title,
      passageHTML: cleanPassageHTML,
      questionHTML: cleanQHTML || cleanQ || 'Saved exam question for revision.',
      questionSnippet: cleanQ.slice(0, 220) || 'Saved exam question for revision.',
      options: normalizedOptions,
      correctIndex: Math.max(0, Math.min(normalizedOptions.length - 1, corIdx)),
      explanationHTML: cleanExpHTML || answerSummary,
      answerKey: answerSummary,
      difficulty: questionObj.difficulty || 'Moderate',
      savedAt: new Date().toISOString()
    };

    list.unshift(newEntry);
    this.saveBookmarksList(list);
    return true; // bookmarked
  }

  updateBookmarkSubject(bookmarkId, newSubject, userId = null) {
    if (!newSubject) return null;
    const qStr = String(bookmarkId);
    const list = this.getBookmarks(userId);
    const item = list.find(b => String(b.id) === qStr || String(b.questionId) === qStr);
    if (item) {
      item.subject = newSubject;
      this.saveBookmarksList(list, userId);
    }
    return item;
  }

  addBookmarkTag(bookmarkId, tagText, userId = null) {
    const cleanTag = String(tagText || '').trim();
    if (!cleanTag) return null;
    const qStr = String(bookmarkId);
    const list = this.getBookmarks(userId);
    const item = list.find(b => String(b.id) === qStr || String(b.questionId) === qStr);
    if (item) {
      if (!Array.isArray(item.customTags)) item.customTags = [];
      if (!item.customTags.some(t => t.toLowerCase() === cleanTag.toLowerCase())) {
        item.customTags.push(cleanTag);
        this.saveBookmarksList(list, userId);
      }
    }
    return item;
  }

  removeBookmarkTag(bookmarkId, tagText, userId = null) {
    const cleanTag = String(tagText || '').trim().toLowerCase();
    const qStr = String(bookmarkId);
    const list = this.getBookmarks(userId);
    const item = list.find(b => String(b.id) === qStr || String(b.questionId) === qStr);
    if (item && Array.isArray(item.customTags)) {
      item.customTags = item.customTags.filter(t => String(t).toLowerCase() !== cleanTag);
      this.saveBookmarksList(list, userId);
    }
    return item;
  }

  removeBookmark(questionId, userId = null) {
    const qStr = String(questionId);
    const list = this.getBookmarks(userId).filter(
      item => String(item.questionId) !== qStr && String(item.id) !== qStr
    );
    this.saveBookmarksList(list, userId);
    return list;
  }
}

// Instantiate globally
window.OBTestDataManager = OBTestDataManager;
window.obDataManager = new OBTestDataManager();


