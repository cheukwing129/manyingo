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
  const cloudIndex=html.lastIndexOf('void loadCloudPlan();');
  assert.ok(renderIndex>=0&&localIndex>renderIndex,'local render should be prepared first');
  assert.ok(revealIndex>localIndex,'app should reveal after local plan is ready');
  assert.ok(cloudIndex>revealIndex,'cloud plan should remain asynchronous after reveal');
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
