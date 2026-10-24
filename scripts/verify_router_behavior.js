// Test harness to verify Router & Solution Engine navigation behavior
const assert = require('assert');

// Mock browser environment
let historyStack = [];
let currentIndex = -1;

const mockWindow = {
  location: {
    pathname: '/',
    search: '',
    hash: ''
  },
  history: {
    get state() {
      return historyStack[currentIndex] ? historyStack[currentIndex].state : null;
    },
    get length() {
      return historyStack.length;
    },
    pushState(state, title, url) {
      // Discard any forward history if pushing from middle
      historyStack = historyStack.slice(0, currentIndex + 1);
      historyStack.push({ state, url });
      currentIndex = historyStack.length - 1;
      mockWindow.location.hash = url.includes('#') ? '#' + url.split('#')[1] : '';
    },
    replaceState(state, title, url) {
      if (currentIndex >= 0 && currentIndex < historyStack.length) {
        historyStack[currentIndex] = { state, url };
      } else {
        historyStack.push({ state, url });
        currentIndex = 0;
      }
      mockWindow.location.hash = url.includes('#') ? '#' + url.split('#')[1] : '';
    },
    back() {
      if (currentIndex > 0) {
        currentIndex--;
        mockWindow.location.hash = historyStack[currentIndex].url.includes('#') ? '#' + historyStack[currentIndex].url.split('#')[1] : '';
        const event = { state: historyStack[currentIndex].state };
        popListeners.forEach(fn => fn(event));
      }
    },
    forward() {
      if (currentIndex < historyStack.length - 1) {
        currentIndex++;
        mockWindow.location.hash = historyStack[currentIndex].url.includes('#') ? '#' + historyStack[currentIndex].url.split('#')[1] : '';
        const event = { state: historyStack[currentIndex].state };
        popListeners.forEach(fn => fn(event));
      }
    }
  }
};

const popListeners = [];
mockWindow.addEventListener = function(event, fn) {
  if (event === 'popstate') popListeners.push(fn);
};

// Simulate App Controller router
class MockAppController {
  constructor() {
    this._currentStep = 0;
    this.currentViewTab = 'tests';
    this.testEngine = null;
    this.initHistoryRouter();
  }

  initHistoryRouter() {
    this._currentStep = 0;
    mockWindow.history.replaceState({ view: 'tests', navStep: 0, appInitialized: true }, '', '/');
    mockWindow.addEventListener('popstate', (e) => this.handlePopState(e));
  }

  parseLocationToState() {
    const hash = mockWindow.location.hash || '';
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
    return { view: 'tests' };
  }

  pushNavState(stateObj, url) {
    this._currentStep = (typeof this._currentStep === 'number' ? this._currentStep : 0) + 1;
    const finalState = {
      ...stateObj,
      navStep: this._currentStep,
      appInitialized: true
    };
    mockWindow.history.pushState(finalState, '', url);
  }

  replaceNavState(stateObj, url) {
    const finalState = {
      ...stateObj,
      navStep: (typeof this._currentStep === 'number' ? this._currentStep : 0),
      appInitialized: true
    };
    mockWindow.history.replaceState(finalState, '', url);
  }

  handlePopState(e) {
    const rawState = e.state;
    const prevStep = (typeof this._currentStep === 'number' ? this._currentStep : 0);
    if (rawState && typeof rawState.navStep === 'number') {
      this._currentStep = rawState.navStep;
    } else {
      this._currentStep = 0;
    }

    const state = (rawState && rawState.appInitialized) ? rawState : this.parseLocationToState();

    if (prevStep > this._currentStep && mockSolutionEngine && mockSolutionEngine.isOpen) {
      if (state.view === 'solutions' || state.view === 'solution-detail') {
        this.exitSolutionsToTests();
        return;
      }
    }

    this.applyState(state);
  }

  applyState(state) {
    this.currentViewTab = state.view || 'tests';
    if (state.view === 'solutions') {
      mockSolutionEngine.isOpen = true;
      if (state.qIndex !== undefined) {
        mockSolutionEngine.goToQuestion(state.qIndex, false);
      } else {
        mockSolutionEngine.gotoreview(false);
      }
    } else {
      mockSolutionEngine._doExit();
    }
  }

  exitSolutionsToTests() {
    mockSolutionEngine._doExit();
    this.currentViewTab = 'tests';
    this.replaceNavState({ view: 'tests' }, '/');
  }

  goBack() {
    if (mockSolutionEngine.isOpen) {
      this.exitSolutionsToTests();
      return;
    }
    if (this._currentStep > 0) {
      mockWindow.history.back();
    }
  }
}

// Mock Solution Engine
const mockSolutionEngine = {
  isOpen: false,
  currentQuestionIndex: 0,
  isReviewView: false,
  testData: { id: 'ibps-so-it-mains-1' },
  allQuestions: new Array(150).fill(0).map((_, i) => ({ id: `q-${i + 1}`, globalIndex: i })),

  goToQuestion(idx, updateHistory = true) {
    this.currentQuestionIndex = idx;
    this.isReviewView = false;
    if (updateHistory && this.isOpen) {
      mockApp.replaceNavState(
        { view: 'solutions', testId: this.testData.id, qIndex: idx },
        '#solutions/' + this.testData.id + '/q/' + (idx + 1)
      );
    }
  },

  gotoreview(updateHistory = true) {
    this.isReviewView = true;
    if (updateHistory && this.isOpen) {
      mockApp.replaceNavState(
        { view: 'solutions', testId: this.testData.id },
        '#solutions/' + this.testData.id
      );
    }
  },

  exit() {
    this._doExit();
    mockApp.exitSolutionsToTests();
  },

  _doExit() {
    this.isOpen = false;
  }
};

const mockApp = new MockAppController();

console.log('--- TEST 1: Initial state ---');
assert.strictEqual(mockApp.currentViewTab, 'tests');
assert.strictEqual(mockWindow.history.length, 1);
console.log('✔ Initial state: Tests view, history length: 1');

console.log('\n--- TEST 2: Open Solutions Console ---');
mockApp.pushNavState({ view: 'solutions', testId: 'ibps-so-it-mains-1' }, '#solutions/ibps-so-it-mains-1');
mockSolutionEngine.isOpen = true;
assert.strictEqual(mockWindow.history.length, 2);
console.log('✔ Solutions pushed: history length is 2');

console.log('\n--- TEST 3: Navigate Questions 1 through 22 (clicking Next or Palette) ---');
for (let q = 0; q < 22; q++) {
  mockSolutionEngine.goToQuestion(q, true);
}
assert.strictEqual(mockSolutionEngine.currentQuestionIndex, 21); // Question 22 (0-indexed 21)
assert.strictEqual(mockWindow.location.hash, '#solutions/ibps-so-it-mains-1/q/22');
assert.strictEqual(mockWindow.history.length, 2, 'History stack MUST NOT grow when moving between questions!');
console.log('✔ Navigated to Question 22: URL is #solutions/ibps-so-it-mains-1/q/22');
console.log('✔ History stack length is STILL 2 (replaceState used, no question history pollution!)');

console.log('\n--- TEST 4: Click Browser Back Button (popstate) ---');
mockWindow.history.back();
assert.strictEqual(mockSolutionEngine.isOpen, false, 'Solutions console MUST close when clicking browser Back button!');
assert.strictEqual(mockApp.currentViewTab, 'tests', 'Current view MUST be tests after browser Back!');
assert.notStrictEqual(mockSolutionEngine.currentQuestionIndex, 20, 'Question index must NOT move backward to Q21!');
console.log('✔ Browser Back button cleanly exited Solutions Console and returned to Tests Dashboard!');
console.log('✔ It did NOT move questions backward!');

console.log('\n--- TEST 5: Click Browser Forward Button ---');
mockWindow.history.forward();
assert.strictEqual(mockSolutionEngine.isOpen, true, 'Solutions console MUST re-open on browser Forward!');
assert.strictEqual(mockSolutionEngine.currentQuestionIndex, 21, 'Restored exact Question 22 where user left off!');
console.log('✔ Browser Forward button cleanly returned to Solutions Console at Question 22!');

console.log('\n--- TEST 6: In-App "Back to Tests" Button ---');
mockSolutionEngine.exit();
assert.strictEqual(mockSolutionEngine.isOpen, false, 'Solutions console MUST close on in-app Back to Tests!');
assert.strictEqual(mockApp.currentViewTab, 'tests', 'Returned to Tests dashboard!');
console.log('✔ In-app "Back to Tests" button immediately exited to dashboard!');

console.log('\n--- TEST 7: Legacy Dirty History Protection ---');
// Simulate legacy dirty history where previous bug pushed q/21 into history
mockApp.pushNavState({ view: 'solutions', testId: 'ibps-so-it-mains-1' }, '#solutions/ibps-so-it-mains-1/q/21');
mockApp.pushNavState({ view: 'solutions', testId: 'ibps-so-it-mains-1' }, '#solutions/ibps-so-it-mains-1/q/22');
mockSolutionEngine.isOpen = true;
// Now user clicks browser back while in dirty history
mockWindow.history.back();
assert.strictEqual(mockSolutionEngine.isOpen, false, 'Safeguard MUST close solutions even with dirty question history!');
assert.strictEqual(mockApp.currentViewTab, 'tests', 'Safeguard cleanly returned to Tests dashboard!');
console.log('✔ Safeguard successfully prevented stepping backward on legacy dirty history!');

console.log('\n========================================');
console.log('🎉 ALL 7 ROUTER & NAVIGATION TESTS PASSED 100%!');
console.log('========================================');
