'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.join(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');

test('mobile study-start smoke uses runner Chrome without adding browser dependencies',()=>{
  const script=read('scripts/smoke_study_start_mobile.mjs');
  const pkg=JSON.parse(read('package.json'));
  assert.match(script,/google-chrome/);
  assert.match(script,/Emulation\.setDeviceMetricsOverride/);
  assert.match(script,/Emulation\.setTouchEmulationEnabled/);
  assert.match(script,/Input\.dispatchTouchEvent/);
  assert.match(script,/Network\.setCacheDisabled/);
  assert.match(script,/Network\.clearBrowserCache/);
  assert.match(script,/window\.ManjingoStudyStartMetrics\|\|null/);
  assert.match(script,/pointerDownState==='cold'/);
  assert.match(script,/pointerDownToFirstQuestionMs<=budgetMs/);
  assert.equal(pkg.scripts['smoke:study-start-mobile'],'node scripts/smoke_study_start_mobile.mjs');
  const deps={...(pkg.dependencies||{}),...(pkg.devDependencies||{})};
  assert.equal(deps.playwright,undefined);
  assert.equal(deps.puppeteer,undefined);
});

test('production smoke waits for the diagnostic asset and runs mobile cold-start guard',()=>{
  const workflow=read('.github/workflows/pages-production-smoke.yml');
  assert.match(workflow,/grep -q 'studyPerfPanel'/);
  assert.match(workflow,/Smoke test mobile cold study start/);
  assert.match(workflow,/npm run smoke:study-start-mobile/);
  assert.ok(workflow.indexOf('Wait for Pages reliability assets after main')<workflow.indexOf('Smoke test mobile cold study start'));
});

test('mobile smoke keeps a generous hard budget and logs the measured metrics',()=>{
  const script=read('scripts/smoke_study_start_mobile.mjs');
  assert.match(script,/MANJINGO_STUDY_START_BUDGET_MS/);
  assert.match(script,/\|\|6000/);
  assert.match(script,/MANJINGO_STUDY_START_WARN_MS/);
  assert.match(script,/\|\|2500/);
  assert.match(script,/MOBILE_STUDY_START=/);
  assert.match(script,/pointerDownToFirstQuestionMs/);
  assert.match(script,/clickToFirstQuestionMs/);
  assert.match(script,/planSource/);
});
