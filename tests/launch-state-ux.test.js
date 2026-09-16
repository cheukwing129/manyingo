const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');

const launch=require('../public/launch-state-runtime.js');
const theme=require('../public/theme-runtime.js');

test('homepage stays local-first while cloud plan loads asynchronously',()=>{
  const html=read('public/index.html');
  const renderIndex=html.lastIndexOf('render();');
  const localIndex=html.lastIndexOf('applyLocalPlan();');
  const revealIndex=html.lastIndexOf('revealApp();');
  const cloudIndex=html.lastIndexOf('scheduleCloudPlanLoad();');
  assert.ok(renderIndex>=0&&localIndex>renderIndex,'local render should be prepared first');
  assert.ok(revealIndex>localIndex,'app should reveal after local plan is ready');
  assert.ok(cloudIndex>revealIndex,'cloud plan should be scheduled after reveal');
  assert.match(html,/requestIdleCallback\(run,\{timeout:700\}\)/);
});

test('sync retry only reports success when syncNow confirms ok',()=>{
  const source=read('public/account-ui.js');
  assert.match(source,/result&&result\.ok===true/);
  assert.doesNotMatch(source,/await manager\.syncNow\(\);lastSync='synced'/);
  assert.match(source,/lastSync==='local-only'/);
  assert.match(source,/雲端暫未更新，資料仍保存在本機/);
  assert.match(source,/syncNeedsAttention/);
  assert.match(source,/重試同步/);
});

test('logout preserves local progress until answer, practice and account sync are confirmed',()=>{
  const source=read('public/account-ui.js');
  assert.match(source,/flushAnswerOutbox\(\{force:true\}\)/);
  assert.match(source,/flushPracticeOutbox\(\{force:true\}\)/);
  assert.match(source,/Number\(answerResult\.pending\)>0/);
  assert.match(source,/Number\(practiceResult\.pending\)>0/);
  assert.match(source,/const synced=await flushBeforeLogout\(fb,manager\)/);
  assert.match(source,/if\(!synced\)/);
  assert.match(source,/同步未完成，已取消登出；本機進度仍保留/);
  const guard=source.indexOf('const synced=await flushBeforeLogout(fb,manager)');
  const signOut=source.indexOf('await fb.signOutAccount()',guard);
  const clearLocal=source.indexOf('manager.clearLocal()',signOut);
  assert.ok(guard>=0&&signOut>guard&&clearLocal>signOut,'local data must only clear after a confirmed pre-logout sync and sign-out');
});

test('completion can return to a fresh today plan without reloading',()=>{
  const source=read('public/launch-state-runtime.js');
  assert.match(source,/\.session-summary\.done,\.done/);
  assert.match(source,/\[data-home-tab="today"\]/);
  assert.match(source,/plan\.classList\.remove\('hidden'\)/);
  assert.match(source,/quiz\.classList\.add\('hidden'\)/);
  assert.match(source,/updateDailyCta/);
  assert.match(source,/refreshTodayPlanHero/);
});

test('cloud reconciliation refreshes learning path, weakness and results after sync settles',()=>{
  const source=read('public/launch-state-runtime.js');
  assert.match(source,/ManjingoLearningEvents/);
  assert.match(source,/events\.refresh/);
  assert.match(source,/manjingo:account-sync-state/);
  assert.match(source,/status&&status!=='syncing'/);
  assert.match(source,/manjingo:answer-sync-complete/);
  assert.match(source,/scheduleLearningViewsRefresh/);
});

test('launch state runtime is homepage-only and loaded progressively',()=>{
  assert.equal(launch.isHomepage(),true);
  assert.equal(typeof launch.restoreTodayPlanFromCompletion,'function');
  assert.equal(typeof launch.scheduleLearningViewsRefresh,'function');
  assert.equal(typeof theme.loadLaunchStateRuntime,'function');
  const source=read('public/theme-runtime.js');
  assert.match(source,/\.\/launch-state-runtime\.js/);
  assert.match(source,/loadLaunchStateRuntime\(\)/);
});
