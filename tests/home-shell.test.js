const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');

test('homepage separates learning, path, weakness, and results into focused views',()=>{
  const html=read('public/index.html');
  for(const view of ['today','path','weakness','results'])assert.match(html,new RegExp('data-home-tab="'+view+'"'));
  assert.match(html,/id="homeToday" data-home-view="today"/);
  assert.match(html,/id="homePath" data-home-view="path" hidden/);
  assert.match(html,/id="homeWeakness" data-home-view="weakness" hidden/);
  assert.match(html,/id="homeResults" data-home-view="results" hidden/);
  assert.match(html,/id="learningPath"/);
  assert.match(html,/id="weaknessPanel"/);
  assert.match(html,/id="masteryDashboard"/);
});

test('quiz lives inside the today view and start focuses it instead of leaving it below other panels',()=>{
  const html=read('public/index.html');
  const todayStart=html.indexOf('id="homeToday"'),todayEnd=html.indexOf('</section>',todayStart),plan=html.indexOf('id="plan"',todayStart),quiz=html.indexOf('id="quiz"',todayStart);
  assert.ok(todayStart>=0&&todayEnd>todayStart);
  assert.ok(plan>todayStart&&quiz>plan&&quiz<todayEnd);
  assert.match(html,/document\.getElementById\('plan'\)\.classList\.add\('hidden'\)/);
  assert.match(html,/document\.getElementById\('quiz'\)\.classList\.remove\('hidden'\)/);
  assert.match(html,/shell\.focusQuiz\(\)/);
});

test('home shell opens result tab for mastery dashboard return links',()=>{
  const source=read('public/home-shell.js');
  assert.match(source,/#masteryDashboard'\)return'results'/);
  assert.match(source,/#weaknessPanel'\)return'weakness'/);
  assert.match(source,/#learningPath'\)return'path'/);
  assert.match(source,/scrollIntoView\(\{behavior:'smooth',block:'start'\}\)/);
  assert.match(source,/\[data-home-view\]/);
  assert.match(source,/\[data-home-tab\]/);
});

test('homepage presents XP as streak progress rather than a second daily completion goal',()=>{
  const source=read('public/home-shell.js');
  assert.match(source,/function enhancePlayerStatus\(\)/);
  assert.match(source,/card\.classList\.add\('player-status'\)/);
  assert.match(source,/dailyBlock\.appendChild\(daily\)/);
  assert.match(source,/dailyBlock\.appendChild\(dailyBar\)/);
  assert.match(source,/card\.appendChild\(levelBlock\)/);
  assert.match(source,/card\.appendChild\(streak\)/);
  assert.match(source,/details\.appendChild\(levelBar\)/);
  assert.match(source,/detailCard\.remove\(\)/);
  assert.match(source,/今日 XP · 連續紀錄/);
  assert.match(source,/等級進度/);
  const html=read('public/index.html');
  assert.match(html,/今日 XP · 連續紀錄/);
  assert.doesNotMatch(html,/今日目標/);
});

test('primary sections become a mobile app bottom navigation with icons and safe-area spacing',()=>{
  const source=read('public/home-shell.js');
  assert.match(source,/const NAV_ITEMS=\{today:\{icon:'🏠',label:'今日'\}/);
  assert.match(source,/function enhanceAppNav\(\)/);
  assert.match(source,/nav\.classList\.add\('app-bottom-nav'\)/);
  assert.match(source,/document\.body\.classList\.add\('app-nav-ready'\)/);
  assert.match(source,/position:fixed;top:auto;bottom:max\(10px,env\(safe-area-inset-bottom,10px\)\)/);
  assert.match(source,/padding-bottom:calc\(104px \+ env\(safe-area-inset-bottom,0px\)\)/);
  assert.match(source,/class="app-nav-icon"/);
  assert.match(source,/class="app-nav-label"/);
  assert.match(source,/button\.setAttribute\('aria-controls',panelId\)/);
  assert.match(source,/function scrollViewTop\(view\)/);
  assert.match(source,/showView\(view\);scrollViewTop\(view\)/);
});

test('starting a quiz enters a distraction-free study shell with progress and exit controls',()=>{
  const source=read('public/home-shell.js');
  assert.match(source,/const STUDY_CLASS='study-focus'/);
  assert.match(source,/function focusQuiz\(\)\{enterStudy\(\)/);
  assert.match(source,/id='studyFocusBar'/);
  assert.match(source,/退出本輪學習/);
  assert.match(source,/學習進度/);
  assert.match(source,/role="progressbar"/);
  assert.match(source,/body\.'\+STUDY_CLASS\+'>\.home-tabs\{display:none!important\}/);
  assert.match(source,/body\.'\+STUDY_CLASS\+'>\.player-status/);
  assert.match(source,/padding-bottom:0!important/);
  assert.match(source,/\[data-home-view\]:not\(\[data-home-view="today"\]\)/);
});

test('study shell tracks question position and restores the homepage after completion',()=>{
  const source=read('public/home-shell.js');
  assert.match(source,/text\.match\(\/\(\\d\+\)\\s\*\\\/\\s\*\(\\d\+\)\//);
  assert.match(source,/updateStudyProgress\(progress\.current,progress\.total\)/);
  assert.match(source,/if\(progress\.done\)\{exitStudy\(\);return\}/);
  assert.match(source,/new MutationObserver\(syncStudyProgress\)/);
  assert.match(source,/document\.body\.classList\.remove\(STUDY_CLASS\)/);
  assert.match(source,/manjingo:study-mode-enter/);
  assert.match(source,/manjingo:study-mode-exit/);
  assert.match(source,/已完成的進度會保留/);
});

test('homepage hides placeholder zero-state until local learning hydration is rendered',()=>{
  const html=read('public/index.html');
  assert.match(html,/<html lang="zh-Hant" class="app-booting">/);
  assert.match(html,/html\.app-booting body\{visibility:hidden\}/);
  assert.match(html,/載入學習進度…/);
  assert.match(html,/function revealApp\(\)\{document\.documentElement\.classList\.remove\('app-booting'\)\}/);
  assert.match(html,/render\(\);applyLocalPlan\(\);revealApp\(\);scheduleCloudPlanLoad\(\);/);
  assert.ok(html.indexOf('render();applyLocalPlan();revealApp()')<html.lastIndexOf('scheduleCloudPlanLoad()'));
});
