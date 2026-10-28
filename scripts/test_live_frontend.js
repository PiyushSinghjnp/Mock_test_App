'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const { test } = require('node:test');

function fixture() {
  const elements = new Map();
  const element = () => ({
    style: {}, children: [], events: {},
    append(child) { this.children.push(child); },
    replaceChildren() { this.children = []; },
    setAttribute(name, value) { this[name] = value; },
    removeAttribute(name) { delete this[name]; },
    addEventListener(name, callback) { this.events[name] = callback; }
  });
  const document = {
    hidden: false, addEventListener() {},
    getElementById(id) { return elements.get(id); },
    createElement: element
  };
  const context = vm.createContext({ document, window: { location: { origin: 'http://localhost:3000' } }, URL, AbortSignal, setTimeout, clearTimeout, console });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', 'app.js'), 'utf8'), context);
  const Controller = vm.runInContext('OliveboardAppController', context);
  const controller = Object.create(Controller.prototype);
  controller.showToast = () => {};
  controller._scheduleObFrame = () => {};
  controller._obBrowserActive = true;
  controller._obEpoch = 1;
  return { controller, context, elements, element };
}

test('preview coordinates account for letterboxing and device scale', () => {
  const { controller } = fixture();
  controller._obViewport = { width: 1000, height: 500 };
  const image = { naturalWidth: 2000, naturalHeight: 1000, getBoundingClientRect: () => ({ left: 10, top: 20, width: 800, height: 800 }) };
  assert.equal(controller._obPointFromEvent({ clientX: 410, clientY: 120 }, image), null);
  const point = controller._obPointFromEvent({ clientX: 410, clientY: 420 }, image);
  assert.equal(point.x, 500);
  assert.equal(point.y, 250);
});

test('remote tab names are text and handlers use stable target identities', async () => {
  const { controller, elements, element } = fixture();
  const bar = element();
  Object.defineProperty(bar, 'innerHTML', { set() { throw new Error('Remote text must not become markup'); } });
  elements.set('ob-live-tabs-bar', bar);
  let sent;
  controller.sendObBrowserInput = payload => { sent = payload; };
  const title = '<img src=x onerror=alert(1)>';
  controller._renderObBrowserTabs([{ id: 'real-target', title, url: 'https://www.oliveboard.in/' }], 'real-target');
  assert.equal(bar.children[1].textContent, title);
  bar.children[1].events.click();
  assert.equal(sent.targetId, 'real-target');
});

test('artifact links reject remote and non-artifact paths', () => {
  const { controller } = fixture();
  assert.equal(controller._obArtifactUrl('https://example.com/api/ob-browser/artifacts/report'), null);
  assert.equal(controller._obArtifactUrl('/scraped/unsafe.html'), null);
  assert.equal(controller._obArtifactUrl('javascript:alert(1)'), null);
  assert.equal(controller._obArtifactUrl('/api/ob-browser/artifacts/capture/report.json'), 'http://localhost:3000/api/ob-browser/artifacts/capture/report.json');
});

test('HTTP errors cannot be accepted as capture success', async () => {
  const { controller, context } = fixture();
  context.fetch = async () => ({ ok: false, status: 503, json: async () => ({ success: true, error: 'REA unavailable' }) });
  await assert.rejects(controller._obRequest('scrape', {}), /REA unavailable/);
});

test('a stale poll cannot overwrite the selected tab after an input request', async () => {
  const { controller } = fixture();
  let resolve;
  let applied = false;
  controller._obRequest = () => new Promise(done => { resolve = done; });
  controller._applyObBrowserFrameData = () => { applied = true; };
  const poll = controller._pollObBrowserFrame();
  controller._obInputRevision = 1;
  resolve({ success: true, activeTargetId: 'old-tab' });
  await poll;
  assert.equal(applied, false);
});

test('input commands are serialized and pending commands stop after closing', async () => {
  const { controller } = fixture();
  const calls = [];
  let release;
  controller._applyObBrowserFrameData = () => {};
  controller._obRequest = async (_, payload) => {
    calls.push(payload.action);
    if (calls.length === 1) await new Promise(done => { release = done; });
    return { success: true };
  };
  const first = controller.sendObBrowserInput({ action: 'click' });
  const second = controller.sendObBrowserInput({ action: 'typeText', text: 'hello' });
  await new Promise(done => setImmediate(done));
  assert.deepEqual(calls, ['click']);
  controller._obEpoch++;
  controller._obBrowserActive = false;
  release();
  await Promise.all([first, second]);
  assert.deepEqual(calls, ['click']);
});
