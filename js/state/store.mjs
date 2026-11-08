/**
 * Lightweight Global State Store (Context + Reducer Pattern)
 * Vanilla JS implementation - no external dependencies
 */

// Action Types
export const ActionTypes = {
  // Auth
  SET_ACTIVE_USER: 'SET_ACTIVE_USER',
  LOGOUT_USER: 'LOGOUT_USER',

  // Exam
  SET_CURRENT_EXAM: 'SET_CURRENT_EXAM',
  SET_EXAM_LIST: 'SET_EXAM_LIST',

  // Tests
  SET_TESTS_CACHE: 'SET_TESTS_CACHE',
  UPDATE_TEST_STATUS: 'UPDATE_TEST_STATUS',
  SET_FILTER_TAB: 'SET_FILTER_TAB',
  SET_STATUS_FILTER: 'SET_STATUS_FILTER',

  // Analytics
  SET_ANALYTICS: 'SET_ANALYTICS',
  SET_LEADERBOARD: 'SET_LEADERBOARD',

  // Bookmarks
  SET_BOOKMARKS: 'SET_BOOKMARKS',
  ADD_BOOKMARK: 'ADD_BOOKMARK',
  REMOVE_BOOKMARK: 'REMOVE_BOOKMARK',
  UPDATE_BOOKMARK_TAGS: 'UPDATE_BOOKMARK_TAGS',
  UPDATE_BOOKMARK_SUBJECT: 'UPDATE_BOOKMARK_SUBJECT',
  SET_BOOKMARK_FILTERS: 'SET_BOOKMARK_FILTERS',

  // Quizzes
  SET_QUIZ_SUBJECTS: 'SET_QUIZ_SUBJECTS',
  SET_QUIZ_STREAK: 'SET_QUIZ_STREAK',

  // UI State
  SET_LOADING: 'SET_LOADING',
  SET_ERROR: 'SET_ERROR',
  CLEAR_ERROR: 'CLEAR_ERROR',
  SET_MODAL_OPEN: 'SET_MODAL_OPEN',
  SET_ACTIVE_VIEW: 'SET_ACTIVE_VIEW',

  // Candidate Profiles
  SET_CANDIDATES_LIST: 'SET_CANDIDATES_LIST',
  SWITCH_CANDIDATE: 'SWITCH_CANDIDATE',
};

// Initial State
export const initialState = {
  // Auth
  activeUser: null,
  isAuthenticated: false,

  // Exam
  currentExamId: 'ibps-so',
  exams: [],

  // Tests
  testsCache: [],
  currentFilterTab: 'all',
  currentStatusFilter: 'all',

  // Analytics
  analytics: null,
  leaderboard: [],

  // Bookmarks
  bookmarks: [],
  bookmarkFilters: {
    subject: 'ALL',
    tag: 'ALL',
    searchQuery: '',
  },
  bookmarkAttempts: {},

  // Quizzes
  quizSubjects: [],
  quizStreak: 1,
  quizCoins: 300,

  // UI
  isLoading: false,
  error: null,
  modals: {
    login: false,
    examSwitcher: false,
    userProfile: false,
    scorecard: false,
    liveBrowser: false,
  },
  activeView: 'tests',

  // Candidates
  candidatesList: [],
  activeCandidateId: null,
};

// Reducer
export function appReducer(state, action) {
  switch (action.type) {
    case ActionTypes.SET_ACTIVE_USER:
      return {
        ...state,
        activeUser: action.payload,
        isAuthenticated: !!action.payload,
        activeCandidateId: action.payload?.id || null,
      };

    case ActionTypes.LOGOUT_USER:
      return {
        ...state,
        activeUser: null,
        isAuthenticated: false,
        bookmarks: [],
        bookmarkAttempts: {},
        analytics: null,
        leaderboard: [],
        activeCandidateId: null,
      };

    case ActionTypes.SET_CURRENT_EXAM:
      return { ...state, currentExamId: action.payload };

    case ActionTypes.SET_EXAM_LIST:
      return { ...state, exams: action.payload };

    case ActionTypes.SET_TESTS_CACHE:
      return { ...state, testsCache: action.payload };

    case ActionTypes.UPDATE_TEST_STATUS: {
      const { testId, updates } = action.payload;
      return {
        ...state,
        testsCache: state.testsCache.map(t =>
          t.id === testId ? { ...t, ...updates } : t
        ),
      };
    }

    case ActionTypes.SET_FILTER_TAB:
      return { ...state, currentFilterTab: action.payload };

    case ActionTypes.SET_STATUS_FILTER:
      return { ...state, currentStatusFilter: action.payload };

    case ActionTypes.SET_ANALYTICS:
      return { ...state, analytics: action.payload };

    case ActionTypes.SET_LEADERBOARD:
      return { ...state, leaderboard: action.payload };

    case ActionTypes.SET_BOOKMARKS:
      return { ...state, bookmarks: action.payload };

    case ActionTypes.ADD_BOOKMARK:
      return {
        ...state,
        bookmarks: [...state.bookmarks, action.payload],
      };

    case ActionTypes.REMOVE_BOOKMARK:
      return {
        ...state,
        bookmarks: state.bookmarks.filter(b => b.id !== action.payload),
        bookmarkAttempts: Object.fromEntries(
          Object.entries(state.bookmarkAttempts).filter(([k]) => k !== action.payload)
        ),
      };

    case ActionTypes.UPDATE_BOOKMARK_TAGS: {
      const { bookmarkId, tags } = action.payload;
      return {
        ...state,
        bookmarks: state.bookmarks.map(b =>
          b.id === bookmarkId ? { ...b, customTags: tags } : b
        ),
      };
    }

    case ActionTypes.UPDATE_BOOKMARK_SUBJECT: {
      const { bookmarkId, subject } = action.payload;
      return {
        ...state,
        bookmarks: state.bookmarks.map(b =>
          b.id === bookmarkId ? { ...b, subject } : b
        ),
      };
    }

    case ActionTypes.SET_BOOKMARK_FILTERS:
      return {
        ...state,
        bookmarkFilters: { ...state.bookmarkFilters, ...action.payload },
      };

    case ActionTypes.SET_QUIZ_SUBJECTS:
      return { ...state, quizSubjects: action.payload };

    case ActionTypes.SET_QUIZ_STREAK:
      return {
        ...state,
        quizStreak: action.payload.streak,
        quizCoins: action.payload.coins,
      };

    case ActionTypes.SET_LOADING:
      return { ...state, isLoading: action.payload };

    case ActionTypes.SET_ERROR:
      return { ...state, error: action.payload, isLoading: false };

    case ActionTypes.CLEAR_ERROR:
      return { ...state, error: null };

    case ActionTypes.SET_MODAL_OPEN:
      return {
        ...state,
        modals: { ...state.modals, [action.payload.modal]: action.payload.open },
      };

    case ActionTypes.SET_ACTIVE_VIEW:
      return { ...state, activeView: action.payload };

    case ActionTypes.SET_CANDIDATES_LIST:
      return { ...state, candidatesList: action.payload };

    case ActionTypes.SWITCH_CANDIDATE:
      return { ...state, activeCandidateId: action.payload };

    default:
      return state;
  }
}

// Create Store
export function createStore(reducer, initialState) {
  let state = initialState;
  const listeners = new Set();

  return {
    getState: () => state,

    dispatch: (action) => {
      state = reducer(state, action);
      listeners.forEach(listener => listener(state));
      return action;
    },

    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    // Selectors for common derived state
    select: {
      activeUser: (s) => s.activeUser,
      isAuthenticated: (s) => s.isAuthenticated,
      currentExam: (s) => s.exams.find(e => e.id === s.currentExamId) || s.exams[0],
      filteredTests: (s) => {
        let tests = [...s.testsCache];

        // Filter by tab
        if (s.currentFilterTab !== 'all') {
          if (s.currentFilterTab === 'pyp' || s.currentFilterTab === 'pyq') {
            tests = tests.filter(t => t.type === 'pyp' || t.type === 'pyq');
          } else {
            tests = tests.filter(t => t.type === s.currentFilterTab);
          }
        }

        // Filter by status
        if (s.currentStatusFilter === 'unattempted') {
          tests = tests.filter(t => !t.isAttempted && !t.isPaused);
        } else if (s.currentStatusFilter === 'attempted') {
          tests = tests.filter(t => !!t.isAttempted || !!t.isPaused);
        } else if (s.currentStatusFilter === 'free') {
          tests = tests.filter(t => !!(t.is_free || t.isFree));
        }

        return tests;
      },
      bookmarks: (s) => s.bookmarks,
      filteredBookmarks: (s) => {
        const { subject, tag, searchQuery } = s.bookmarkFilters;
        const qLower = (searchQuery || '').trim().toLowerCase();

        return s.bookmarks.filter(b => {
          const subj = b.subject || 'General Awareness';
          if (subject !== 'ALL' && subj !== subject) return false;
          if (tag !== 'ALL') {
            const tags = Array.isArray(b.customTags) ? b.customTags : [];
            if (!tags.includes(tag)) return false;
          }
          if (qLower) {
            const hay = `${b.title || ''} ${b.questionSnippet || ''} ${b.questionHTML || ''} ${b.testTitle || ''} ${subj} ${(b.customTags || []).join(' ')}`.toLowerCase();
            if (!hay.includes(qLower)) return false;
          }
          return true;
        });
      },
      quizSubjects: (s) => s.quizSubjects,
      analytics: (s) => s.analytics,
      leaderboard: (s) => s.leaderboard,
      isLoading: (s) => s.isLoading,
      error: (s) => s.error,
      modals: (s) => s.modals,
      activeView: (s) => s.activeView,
      candidatesList: (s) => s.candidatesList,
    },
  };
}

// Singleton store instance
export const store = createStore(appReducer, initialState);

// Helper to connect components to store
export function connectStore(component, selectors) {
  const unsubscribe = store.subscribe((state) => {
    const props = {};
    for (const [key, selector] of Object.entries(selectors)) {
      props[key] = selector(state);
    }
    component.update(props);
  });

  return {
    ...component,
    unsubscribe,
    dispatch: store.dispatch,
    getState: store.getState,
  };
}