'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { OliveboardTestEngine } = require('../js/test-engine.js');

function deferred() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
}

function setup(t, savedAttempt = { attemptId: 'attempt-42' }) {
  const events = [];
  const elements = new Map();
  const element = id => {
    if (!elements.has(id)) {
      const classes = new Set(id === 'test-modal-overlay' ? ['active'] : []);
      elements.set(id, {
        textContent: '', innerHTML: '',
        classList: {
          add(value) { classes.add(value); events.push(`${id}:add:${value}`); },
          remove(value) {
            classes.delete(value);
            events.push(`${id}:remove:${value}`);
            if (id === 'test-modal-overlay') {
              assert.ok(element('scorecard-modal-overlay').classList.contains('active'), 'analysis must cover the dashboard before the exam closes');
            }
          },
          contains: value => classes.has(value)
        },
        click() { events.push(`${id}:click`); }
      });
    }
    return elements.get(id);
  };
  const previousWindow = global.window;
  const previousDocument = global.document;
  t.after(() => { global.window = previousWindow; global.document = previousDocument; });
  const saving = deferred();
  let result;
  global.document = { getElementById: element, body: { style: {} } };
  global.window = {
    obDataManager: { saveResult: async value => { result = value; await saving.promise; return savedAttempt; } },
    openOliveboardSolutions() { assert.fail('submission must not automatically open solutions'); },
    appController: {
      currentViewTab: 'tests',
      replaceNavState(state, url) { events.push({ state, url }); },
      refreshAnalytics() { events.push('refresh'); },
      async viewSolutions(attemptId, testId) {
        events.push({ solutions: { attemptId, testId } });
        window.obSolutionEngine = { isOpen: true };
        element('scorecard-modal-overlay').classList.remove('active');
      }
    }
  };
  const engine = Object.create(OliveboardTestEngine.prototype);
  Object.assign(engine, {
    testData: { id: 'live-mock', title: 'Live Mock', marks: 3, sections: [{ title: 'Reasoning', questions: [
      { id: 'q1', correctIndex: 0 }, { id: 'q2', correctIndex: 1 }, { id: 'q3', correctIndex: 0 }
    ] }] },
    isExamActive: true, isConfirmPaneOpen: true, startTime: Date.now() - 60000,
    userResponses: {
      q1: { selectedIndex: 0, timeSpentSeconds: 15 },
      q2: { selectedIndex: 0, timeSpentSeconds: 10 },
      q3: { selectedIndex: null, status: 'stic-notvisited', timeSpentSeconds: 0 }
    },
    modalOverlay: element('test-modal-overlay'), scorecardOverlay: element('scorecard-modal-overlay'),
    _recordCurrentQuestionTime() {}, stopTimer() {},
    _renderScorecardSectionalTable() {}, _renderScorecardInsights() {},
    _renderScorecardTopicBreakdown() {}, _renderTopperComparisonModule() {}
  });
  return { engine, events, element, saving, getResult: () => result };
}

for (const idKey of ['attemptId', 'id', 'attempt_id']) {
  test(`live mock submission opens analysis first using saved ${idKey}`, async t => {
    const h = setup(t, { [idKey]: 'attempt-42' });
    const submitting = h.engine.submitTest();
    assert.ok(h.engine.modalOverlay.classList.contains('active'), 'exam remains visible while saving');
    assert.equal(h.engine.scorecardOverlay.classList.contains('active'), false);
    await h.engine.submitTest(); // A repeated submit must not save again.
    h.saving.resolve();
    await submitting;
    assert.equal(h.engine.modalOverlay.classList.contains('active'), false);
    assert.ok(h.engine.scorecardOverlay.classList.contains('active'));
    assert.equal(document.body.style.overflow, 'hidden');
    assert.equal(h.element('metric-score').textContent, '0.75 / 3');
    assert.equal(h.getResult().score.correct, 1);
    assert.equal(h.getResult().score.wrong, 1);
    assert.equal(h.getResult().score.unanswered, 1);
    assert.equal(h.getResult().attemptId, 'attempt-42');
    const navigation = h.events.filter(e => e.state);
    assert.deepEqual(navigation, [{ state: { view: 'tests', modal: 'scorecard', testId: 'live-mock', attemptId: 'attempt-42' }, url: '#scorecard/attempt-42' }]);
    assert.equal(h.events.some(e => e.solutions), false);
    await h.element('btn-scorecard-launch-solutions').onclick();
    assert.deepEqual(h.events.find(e => e.solutions), { solutions: { attemptId: 'attempt-42', testId: 'live-mock' } });
  });
}

test('authoritative scores appear in analysis and review mistakes opens the saved attempt', async t => {
  const h = setup(t, { attemptId: 'official-attempt', authoritative: true,
    score: { netScore: 2, correct: 2, wrong: 0, unanswered: 1, maxScore: 3, accuracy: 100, percentile: 95, estimatedAIR: 10 } });
  h.saving.resolve();
  await h.engine.submitTest();
  assert.equal(h.element('metric-score').textContent, '2.00 / 3');
  await h.element('btn-scorecard-review-mistakes').onclick();
  assert.deepEqual(h.events.find(e => e.solutions), { solutions: { attemptId: 'official-attempt', testId: 'live-mock' } });
  assert.ok(h.events.includes('btn-review-mistakes:click'));
});

test('analysis stays visible while solutions load and after a failed load', async t => {
  const h = setup(t);
  h.engine.scorecardOverlay.classList.add('active');
  const loading = deferred();
  window.appController.viewSolutions = () => loading.promise;
  const opening = h.engine._openScorecardSolutions('attempt-42', 'live-mock');
  assert.ok(h.engine.scorecardOverlay.classList.contains('active'));
  loading.resolve(); // viewSolutions catches load errors without opening the console.
  assert.equal(await opening, false);
  assert.ok(h.engine.scorecardOverlay.classList.contains('active'));
  assert.equal(await h.engine._openScorecardSolutions(null, 'live-mock'), false);
  assert.ok(h.engine.scorecardOverlay.classList.contains('active'));
});

test('analysis closes to reveal an already open solution console', async t => {
  const h = setup(t);
  h.engine.scorecardOverlay.classList.add('active');
  window.obSolutionEngine = { isOpen: true };
  assert.equal(await h.engine._openScorecardSolutions('attempt-42', 'live-mock'), true);
  assert.equal(h.engine.scorecardOverlay.classList.contains('active'), false);
});
