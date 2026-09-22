'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { bundles, build } = require('../scripts/build_startup_bundles.cjs');

const root = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('generated startup bundles match their reviewed source modules', () => {
  for (const [name, sources] of Object.entries(bundles)) {
    assert.equal(read(`public/${name}`), build(name, sources));
  }
});

test('home and lesson load two startup bundles instead of the legacy script waterfall', () => {
  for (const page of ['public/index.html', 'public/lesson.html']) {
    const html = read(page);
    assert.match(html, /src="\.\/catalog-runtime\.js"/);
    assert.doesNotMatch(html, /src="\.\/content-catalog\.js"/);
  }
  assert.match(read('public/content-catalog.js'), /ManjingoUseAppRuntimeBundle/);
  assert.match(read('public/question-rotation.js'), /!root\.ManjingoStartupRuntimeBundled/);
});

test('catalog bundle requests exactly one app runtime during parser startup', () => {
  const writes = [];
  const context = {
    window: {},
    document: { readyState: 'loading', write(value) { writes.push(String(value)); } },
    Map, Set, Array, Object, Number, String, Math, RegExp
  };
  context.window.window = context.window;
  context.window.document = context.document;
  vm.createContext(context);
  vm.runInContext(read('public/catalog-runtime.js'), context);
  assert.equal(writes.length, 1);
  assert.match(writes[0], /app-runtime\.js/);
  assert.doesNotMatch(writes[0], /question-rotation\.js/);
});

test('app runtime installs the full reviewed catalog without nested script writes', () => {
  const writes = [];
  const listeners = {};
  const values = new Map();
  const document = {
    readyState: 'loading',
    body: {},
    documentElement: {},
    write(value) { writes.push(String(value)); },
    addEventListener(name, callback) { (listeners[name] ||= []).push(callback); },
    getElementById() { return null; },
    querySelector() { return null; },
    querySelectorAll() { return []; }
  };
  const window = {
    document,
    location: { pathname: '/', search: '', hash: '' },
    localStorage: {
      getItem(key) { return values.get(key) || null; },
      setItem(key, value) { values.set(key, String(value)); },
      removeItem(key) { values.delete(key); }
    },
    addEventListener() {},
    dispatchEvent() {},
    requestIdleCallback() {}
  };
  window.window = window;
  const context = {
    window, document, location: window.location, localStorage: window.localStorage,
    globalThis: window, Map, Set, Array, Object, Number, String, Math, RegExp, Date,
    JSON, URLSearchParams, Promise, setTimeout, clearTimeout, queueMicrotask,
    CustomEvent: function CustomEvent() {}
  };
  vm.createContext(context);
  vm.runInContext(read('public/catalog-runtime.js'), context);
  writes.length = 0;
  vm.runInContext(read('public/app-runtime.js'), context);
  assert.deepEqual(writes, []);
  assert.equal(window.ManjingoContent.questions.length, 677);
  assert.equal(window.ManjingoContent.passageSets.length, 6);
  assert.ok(window.ManjingoQuestionRotation);
  assert.ok(window.ManjingoSkillResultsV1);
});

test('large startup assets use a short browser cache while HTML revalidates', () => {
  const headers = read('public/_headers');
  for (const asset of ['catalog-runtime.js', 'app-runtime.js', 'app-ui.css']) {
    assert.match(headers, new RegExp(`/${asset.replaceAll('.', '\\.')}`));
  }
  assert.match(headers, /max-age=300, must-revalidate/);
  assert.match(headers, /\/\*\.html[\s\S]*Cache-Control: no-cache/);
});

test('cloud account work yields to the first interactive render and shares login startup', () => {
  const home = read('public/index.html');
  const accountSync = read('public/account-sync.js');
  const accountUi = read('public/account-ui.js');
  const firebase = read('public/firebase-config.js');
  assert.match(home, /setTimeout\(ready,4000\)/);
  assert.match(home, /if\(studyActive\(\)\)\{setTimeout\(ready,1200\);return\}/);
  assert.match(accountUi, /const pendingRedirect=hasPendingGoogleRedirect\(\)/);
  assert.match(accountUi, /requestIdleCallback\(run,\{timeout:1200\}\)/);
  assert.doesNotMatch(accountUi, /pendingRedirect\?0:4000/);
  assert.match(accountSync, /function startupDelay\(\)\{const runtime=root\.window\|\|root;return runtime&&runtime\.ManjingoHomeRuntimeDeferral\?0:4000\}/);
  assert.match(accountSync, /setTimeout\(ready,startupDelay\(\)\)/);
  assert.match(accountSync, /if\(studyActive\(\)\)\{schedule\(\);return\}/);
  assert.match(firebase, /if \(loginPromise\) return loginPromise/);
  assert.match(firebase, /if \(currentUserId && auth && auth\.currentUser\) return currentUserId/);
});
