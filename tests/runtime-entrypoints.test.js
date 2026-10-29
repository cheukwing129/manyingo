'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, 'public', file), 'utf8');

// Run the entry scripts named by the real HTML, then execute lazy scripts in the
// same VM. DOM mounting and background timers are held while learning APIs run.
function loadEntry(page) {
  const values = new Map(), requests = [], scripts = [], listeners = {}, timers = [];
  const document = {
    readyState: 'loading', scripts, body: { classList: { contains: () => false } },
    documentElement: {},
    write() { throw new Error('Entry points must not use document.write'); },
    getElementById() { return null; }, querySelectorAll() { return []; },
    addEventListener(name, fn) { (listeners[name] ||= []).push(fn); },
    createElement(tag) {
      const callbacks = {};
      return { tag, src: '', setAttribute() {}, getAttribute(name) { return name === 'src' ? this.src : null; },
        addEventListener(name, fn) { callbacks[name] = fn; }, callbacks,
        remove() { const i = scripts.indexOf(this); if (i >= 0) scripts.splice(i, 1); } };
    },
    head: { appendChild(node) {
      if (node.tag !== 'script') return;
      requests.push(node.src); scripts.push(node);
      queueMicrotask(() => {
        try { run(node.src); node.callbacks.load?.(); }
        catch (error) { node.callbacks.error?.(error); }
      });
    } }
  };
  const context = {
    document, console, URLSearchParams, queueMicrotask,
    location: { pathname: page === 'index.html' ? '/' : '/lesson.html', hash: '', search: '' },
    localStorage: { getItem: key => values.get(key) || null, setItem: (key, value) => values.set(key, String(value)), removeItem: key => values.delete(key) },
    setTimeout(fn) { timers.push(fn); return timers.length; }, clearTimeout() {},
    addEventListener() {}, dispatchEvent() {},
    CustomEvent: function CustomEvent(type, options) { this.type = type; this.detail = options?.detail; }
  };
  context.window = context;
  vm.createContext(context);
  function run(src) { const file = src.replace(/^\.\//, '').split('?')[0]; vm.runInContext(read(file), context, { filename: file }); }
  const entries = Array.from(read(page).matchAll(/<script[^>]*src="([^"]+)"/g), match => match[1]);
  for (const src of entries) {
    if (src.includes('theme-runtime.js')) continue;
    scripts.push({ src, getAttribute() { return src; } });
    run(src);
  }
  // The shell is intentionally mounted separately from these API checks.
  document.querySelector = () => null;
  document.readyState = 'complete';
  return { context, requests, values };
}

test('cold homepage loads real study and results modules once and retains local learning', async () => {
  const { context: app, requests, values } = loadEntry('index.html');
  assert.equal(app.ManjingoContent.questions.length, 607);
  assert.ok(app.ManjingoQuestionRotation);
  assert.equal(app.ManjingoQuestionDifficulty, undefined, 'adaptive work stays off parser startup');
  const first = app.ManjingoHomeShell.ensureStudyPlanRuntime();
  await Promise.all([first, app.ManjingoHomeShell.ensureStudyPlanRuntime(), app.ManjingoHomeShell.prewarmStudyRuntime()]);
  assert.equal(app.ManjingoContent.questions.length, 677);
  assert.ok(app.ManjingoQuestionDifficulty);
  assert.ok(app.ManjingoFeedbackUI);
  const learning = app.ManjingoLocalLearning, catalog = app.ManjingoContent;
  const plan = learning.buildDailyPlan(catalog.getKnowledgePointIds({ teachableOnly: true }), 10);
  const questions = app.ManjingoDailyPlanRuntime.selectQuestionsForPlan(plan, catalog.questions, 10);
  assert.equal(questions.length, 10);
  const question = questions[0];
  assert.equal(learning.submit(question.kpId, true, { questionId: question.id, baseXp: 8 }).xpEarned, 8);
  const before = JSON.parse(values.get('manjingo_progress_cache'));
  await Promise.all([app.ManjingoHomeShell.ensureViewRuntime('results'), app.ManjingoHomeShell.ensureViewRuntime('weakness')]);
  assert.ok(app.ManjingoMasteryDashboard);
  assert.ok(app.ManjingoWeaknessPanel);
  assert.equal(app.ManjingoMasteryDashboard.build().total, 49);
  const after = JSON.parse(values.get('manjingo_progress_cache'));
  for (const field of ['totalXp','todayXp','streak','knowledge','conceptMastery','practiceHistory']) assert.deepEqual(after[field], before[field], field+' must survive lazy view loading');
  assert.equal(app.ManjingoMasteryDashboard.build().mastered, 0, 'a single answer must not become verified mastery');
  assert.equal(requests.length, new Set(requests).size, 'shared modules must load once across concurrent groups');
  assert.ok(!requests.some(src => /app-runtime|catalog-runtime|account-ui/.test(src)));
});

test('lesson entry provides practice and skill evidence without loading the home runtime', () => {
  const { context: app, requests } = loadEntry('lesson.html');
  assert.equal(app.ManjingoContent.questions.length, 607);
  for (const api of ['ManjingoLocalLearning', 'ManjingoLocalLesson', 'ManjingoSkillEvidenceV1', 'ManjingoSkillMasteryV1', 'ManjingoSessionSummary']) assert.ok(app[api], api);
  const question = app.ManjingoContent.questions.find(q => q.type === 'choice');
  const result = app.ManjingoLocalLearning.submit(question.kpId, false, { questionId: question.id, selectedAnswer: 'wrong', correctAnswer: question.a });
  assert.equal(result.xpEarned, 0);
  assert.equal(app.ManjingoLocalLearning.getKnowledge(question.kpId).wrongCount, 1);
  assert.equal(app.ManjingoHomeShell, undefined);
  assert.equal(app.ManjingoAccountUI, undefined);
  assert.deepEqual(requests, [], 'lesson startup must not request injected dependencies');
});
