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

test('home and lesson explicitly select their startup bundles', () => {
  for (const [page, runtime] of [['public/index.html','home-runtime.js'],['public/lesson.html','lesson-runtime.js']]) {
    const html = read(page);
    const scripts = Array.from(html.matchAll(/<script[^>]*src="([^"?]+)(?:[^"\s]*)"/g), match => match[1]);
    const catalog = scripts.indexOf('./catalog-runtime.js'), entry = scripts.indexOf('./'+runtime);
    assert.ok(catalog >= 0 && entry > catalog && scripts.indexOf('./local-learning.js') > entry);
    assert.ok(!scripts.includes('./app-runtime.js'));
    assert.ok(!scripts.includes('./content-catalog.js'));
  }
});

test('catalog bundle has no runtime loading side effects during parser startup', () => {
  const writes = [];
  const context = { window: {}, document: { readyState:'loading', write(value) { writes.push(value); } } };
  vm.createContext(context);
  vm.runInContext(read('public/catalog-runtime.js'), context);
  assert.deepEqual(writes, []);
  assert.equal(context.window.ManjingoContent.questions.length, 607);
  assert.equal(context.window.ManjingoContent.passageSets.length, 6);
  for (const file of ['public/content-catalog.js','public/question-rotation.js','public/feedback-ui.js','public/home-shell.js',...Object.keys(bundles).map(name=>'public/'+name)]) {
    assert.doesNotMatch(read(file), /(?:document|doc)\.write\(/,file+' must not inject dependencies');
  }
});


test('large startup assets use a short browser cache while HTML revalidates', () => {
  const headers = read('public/_headers');
  for (const asset of ['catalog-runtime.js', 'home-runtime.js', 'lesson-runtime.js', 'app-ui.css']) {
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
  assert.match(accountSync, /function startupDelay\(\)\{const runtime=root\.window\|\|root;return runtime&&runtime\.ManjingoHomeRuntime\?0:4000\}/);
  assert.match(accountSync, /setTimeout\(ready,startupDelay\(\)\)/);
  assert.match(accountSync, /if\(studyActive\(\)\)\{schedule\(\);return\}/);
  assert.match(firebase, /if \(loginPromise\) return loginPromise/);
  assert.match(firebase, /if \(currentUserId && auth && auth\.currentUser\) return currentUserId/);
});
