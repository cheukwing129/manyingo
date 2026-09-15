const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');

test('production smoke downloads and verifies the beta UX coordination assets',()=>{
  const source=read('scripts/smoke_sync_guard.mjs');
  assert.match(source,/read\('\/ux-runtime\.js','shared UX runtime asset'\)/);
  assert.match(source,/read\('\/launch-state-runtime\.js','launch state runtime asset'\)/);
  assert.match(source,/read\('\/account-ui\.js','account UI asset'\)/);
  assert.match(source,/themeSource\.includes\('\.\/ux-runtime\.js'\)/);
  assert.match(source,/themeSource\.includes\('\.\/launch-state-runtime\.js'\)/);
  assert.match(source,/uxSource\.includes\('enhanceEmptyLearningStates'\)/);
  assert.match(source,/uxSource\.includes\('enhanceStage3Recovery'\)/);
  assert.match(source,/launchSource\.includes\('restoreTodayPlanFromCompletion'\)/);
  assert.match(source,/launchSource\.includes\('manjingo:account-sync-state'\)/);
  assert.match(source,/launchSource\.includes\('manjingo:answer-sync-complete'\)/);
  assert.match(source,/accountSource\.includes\("result&&result\.ok===true"\)/);
  assert.match(source,/accountSource\.includes\("lastSync==='local-only'"\)/);
  assert.match(source,/雲端暫未更新，資料仍保存在本機/);
  assert.match(source,/重試同步/);
});

test('production workflow waits for the latest beta UX assets before smoke execution',()=>{
  const workflow=read('.github/workflows/pages-production-smoke.yml');
  assert.match(workflow,/\$MANJINGO_BASE_URL\/ux-runtime\.js/);
  assert.match(workflow,/enhanceEmptyLearningStates/);
  assert.match(workflow,/\$MANJINGO_BASE_URL\/launch-state-runtime\.js/);
  assert.match(workflow,/restoreTodayPlanFromCompletion/);
  assert.match(workflow,/\$MANJINGO_BASE_URL\/account-ui\.js/);
  assert.match(workflow,/result&&result\.ok===true/);
  assert.match(workflow,/theme-runtime\.js/);
  assert.match(workflow,/launch-state-runtime\.js/);
  const wait=workflow.indexOf('Wait for Pages reliability assets after main');
  const smoke=workflow.indexOf('Smoke test deployed Stage 3 learning path UI');
  assert.ok(wait>=0&&smoke>wait,'deployment freshness gate must run before production smoke');
});
