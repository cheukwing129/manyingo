const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const ux=require('../public/ux-runtime.js');
const theme=require('../public/theme-runtime.js');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');

test('UX runtime supports homepage and lesson routes only',()=>{
  assert.equal(ux.isSupportedPage('/'),true);
  assert.equal(ux.isSupportedPage('/index.html'),true);
  assert.equal(ux.isSupportedPage('/lesson.html'),true);
  assert.equal(ux.isSupportedPage('/mascot-sheet.html'),false);
  assert.equal(ux.pageName('/courses/lesson.html'),'lesson.html');
});

test('UX status text maps to clear presentation states',()=>{
  assert.equal(ux.classifyStatus('☁️ 已同步學習進度'),'cloud');
  assert.equal(ux.classifyStatus('📱 本機學習模式'),'local');
  assert.equal(ux.classifyStatus('📱 今日學習完成'),'complete');
});

test('daily XP parser supports homepage progress text',()=>{
  assert.deepEqual(ux.parseDaily('12 / 20 XP'),{current:12,target:20});
  assert.deepEqual(ux.parseDaily('0 / 20 XP'),{current:0,target:20});
  assert.deepEqual(ux.parseDaily('準備中'),{current:0,target:0});
});

test('question progress parser recognizes current and total counts',()=>{
  const quiz={querySelector(selector){
    if(selector!=='.category')return null;
    return{textContent:'複習 · 3 / 10'};
  }};
  assert.deepEqual(ux.questionProgress(quiz),{current:3,total:10});
  assert.equal(ux.questionProgress({querySelector(){return null}}),null);
});

test('shared runtime carries keyboard and feedback affordances into lesson and stage 3 flows',()=>{
  const source=read('public/ux-runtime.js');
  assert.match(source,/lessonInput/);
  assert.match(source,/lessonCheck/);
  assert.match(source,/lessonNext/);
  assert.match(source,/data-stage3-option/);
  assert.match(source,/stage3Next/);
  assert.match(source,/aria-live/);
  assert.match(source,/aria-keyshortcuts/);
  assert.match(source,/event\.key==='Enter'/);
  assert.match(source,/event\.key==='n'\|\|event\.key==='N'/);
});

test('answered lesson input is locked and question changes return content to view',()=>{
  const source=read('public/ux-runtime.js');
  assert.match(source,/if\(input\)input\.disabled=true/);
  assert.match(source,/if\(check\)check\.disabled=true/);
  assert.match(source,/syncQuestionViewport\(app,'\.lesson-question'/);
  assert.match(source,/safeScroll\(app,'start'\)/);
  assert.match(source,/syncQuestionViewport\(host,'\.stage3-prompt'/);
});

test('mobile guardrails stack narrow dashboard and weakness actions instead of squeezing them',()=>{
  const source=read('public/ux-runtime.js');
  assert.match(source,/@media\(max-width:430px\)/);
  assert.match(source,/#masteryDashboard \.dashboard-kp>a\{width:100%\}/);
  assert.match(source,/#masteryDashboard \.dashboard-trend-row\{flex-direction:column/);
  assert.match(source,/#weaknessPanel \.weak-more-item a\{display:flex/);
});

test('lesson error state always offers a recovery route',()=>{
  const source=read('public/ux-runtime.js');
  assert.match(source,/找不到這個知識點/);
  assert.match(source,/返回首頁/);
  assert.match(source,/href=\"\.\/index\.html\"/);
});

test('theme runtime exposes UX loader for both homepage and lesson pages',()=>{
  assert.equal(typeof theme.loadUxRuntime,'function');
  assert.equal(typeof theme.isLessonPage,'function');
  assert.equal(theme.loadUxRuntime(),false);
});
