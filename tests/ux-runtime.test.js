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

test('daily task completion is derived from the finished quiz rather than XP',()=>{
  const incomplete={getElementById(id){return id==='quiz'?{querySelector(){return null}}:null}};
  const complete={getElementById(id){return id==='quiz'?{querySelector(selector){return selector==='.session-summary.done,.done'?{}:null}}:null}};
  assert.equal(ux.dailyTaskComplete(incomplete),false);
  assert.equal(ux.dailyTaskComplete(complete),true);
  const source=read('public/ux-runtime.js');
  assert.match(source,/streakGoalComplete=state\.target>0&&state\.current>=state\.target/);
  assert.match(source,/taskComplete=dailyTaskComplete\(d\)/);
  assert.match(source,/start\.textContent=taskComplete\?'再練一輪':started\?'繼續今日學習':'開始學習'/);
  assert.match(source,/streak-goal-complete/);
  assert.doesNotMatch(source,/start\.textContent=complete\?'再練一輪'/);
});

test('question progress parser recognizes current and total counts',()=>{
  const quiz={querySelector(selector){
    if(selector!=='.category')return null;
    return{textContent:'複習 · 3 / 10'};
  }};
  assert.deepEqual(ux.questionProgress(quiz),{current:3,total:10});
  assert.equal(ux.questionProgress({querySelector(){return null}}),null);
});

test('observer callbacks do not rewrite unchanged DOM state',()=>{
  let textWrites=0,disabledWrites=0;
  const textNode={_text:'下一題',get textContent(){return this._text},set textContent(value){textWrites+=1;this._text=String(value)}};
  const control={_disabled:true,get disabled(){return this._disabled},set disabled(value){disabledWrites+=1;this._disabled=!!value}};
  assert.equal(ux.setTextIfChanged(textNode,'下一題'),false);
  assert.equal(ux.setDisabledIfChanged(control,true),false);
  assert.equal(textWrites,0,'same label must not retrigger a child-list observer');
  assert.equal(disabledWrites,0,'same disabled state must not retrigger an attribute observer');
  assert.equal(ux.setTextIfChanged(textNode,'完成本輪'),true);
  assert.equal(ux.setDisabledIfChanged(control,false),true);
  assert.equal(textWrites,1);
  assert.equal(disabledWrites,1);
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
  assert.match(source,/setDisabledIfChanged\(input,true\)/);
  assert.match(source,/setDisabledIfChanged\(check,true\)/);
  assert.match(source,/setTextIfChanged\(next,/);
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

test('first-time learners are distinguished from learners with no current weaknesses',()=>{
  const previous=globalThis.ManjingoSkillResultsV1;
  globalThis.ManjingoSkillResultsV1={build:()=>({attempted:0})};
  assert.equal(ux.learningEvidenceCount(),0);
  globalThis.ManjingoSkillResultsV1={build:()=>({attempted:7})};
  assert.equal(ux.learningEvidenceCount(),7);
  if(previous===undefined)delete globalThis.ManjingoSkillResultsV1;else globalThis.ManjingoSkillResultsV1=previous;
  const source=read('public/ux-runtime.js');
  assert.match(source,/完成第一輪學習後，這裡會開始整理你的弱點/);
  assert.match(source,/先建立第一批學習證據/);
  assert.match(source,/href=\"#homeToday\"/);
});

test('stage 3 unavailable state provides retry and return actions',()=>{
  const source=read('public/ux-runtime.js');
  assert.match(source,/進階題庫尚未載入/);
  assert.match(source,/重新檢查題庫/);
  assert.match(source,/返回學習路徑/);
  assert.match(source,/ManjingoStage3Reading/);
  assert.match(source,/startChallenge/);
});

test('account sync failure exposes an explicit retry action without discarding local progress',()=>{
  const source=read('public/account-ui.js');
  assert.match(source,/function retrySync\(\)/);
  assert.match(source,/lastSync==='error'/);
  assert.match(source,/重試同步/);
  assert.match(source,/暫時無法同步，資料仍保存在本機/);
  assert.match(source,/setAttribute\('role','status'\)/);
  assert.match(source,/ManjingoAccountUI=\{install,render,retrySync,buttonLabel\}/);
});

test('theme runtime exposes UX loader for both homepage and lesson pages',()=>{
  assert.equal(typeof theme.loadUxRuntime,'function');
  assert.equal(typeof theme.isLessonPage,'function');
  assert.equal(theme.loadUxRuntime(),false);
});
