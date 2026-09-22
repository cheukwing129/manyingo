const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');

test('Stage 3 production smoke validates deployed pack runtime diagnostics rotation and summary',()=>{
  const source=read('scripts/smoke_stage3_ui.mjs');
  assert.match(source,/readTextAsset\('\/', 'homepage'\)/);
  assert.match(source,/readTextAsset\('\/home-shell\.js', 'home shell asset'\)/);
  assert.match(source,/readTextAsset\('\/theme-runtime\.js', 'theme runtime asset'\)/);
  assert.match(source,/readTextAsset\('\/curriculum-v1\.js', 'curriculum asset'\)/);
  assert.match(source,/readTextAsset\('\/stage3-diagnostics\.js', 'Stage 3 diagnostics asset'\)/);
  assert.match(source,/readTextAsset\('\/stage3-reading\.js', 'Stage 3 reading asset'\)/);
  assert.match(source,/readTextAsset\('\/question-pack-transfer-07\.js', 'Stage 3 question pack'\)/);
  assert.match(source,/readTextAsset\('\/question-pack-passage-set-01\.js', 'passage-set question pack'\)/);
  assert.match(source,/passageSetPack\.passageSets\.length === 6/);
  assert.match(source,/passageSetPack\.questions\.length === 18/);
  assert.match(source,/stage3\.buildPassageSet/);
  assert.match(source,/homeShellSource\.includes\("script\.src='\.\/stage3-reading\.js'"\)/);
  assert.match(source,/homeShellSource\.includes\('loadStage3Reading\(\);'\)/);
  assert.match(source,/themeSource\.includes\("script\.src='\.\/stage3-diagnostics\.js'"\)/);
  assert.match(source,/vm\.runInContext\(diagnosticsSource/);
  assert.match(source,/vm\.runInContext\(stage3Source/);
  assert.match(source,/vm\.runInContext\(packSource/);
  assert.match(source,/Object\.keys\(diagnostics\.DIAGNOSTIC_MAP \|\| \{\}\)\.length === 36/);
  assert.match(source,/one Stage 3 miss incorrectly became a core weakness signal/);
  assert.match(source,/recordVerification\('read\.logical-relation'/);
  assert.match(source,/typeof stage3\.buildChallenge === 'function'/);
  assert.match(source,/typeof stage3\.summarizeResults === 'function'/);
  assert.match(source,/pack\.questions\.length === 36/);
  assert.match(source,/questions\.length === 12/);
  assert.match(source,/sourceTextId\)\)\.size >= 5/);
  assert.match(source,/skillIds = \['read\.argumentation', 'transfer\.short-passage', 'transfer\.mixed'\]/);
  assert.match(source,/for \(let run = 0; run < 6; run \+= 1\)/);
  assert.match(source,/built\.questions\.length === 6/);
  assert.match(source,/counts\[id\] === 2/);
  assert.match(source,/seen\.size === 36/);
  assert.match(source,/summary\.total === 6 && summary\.correct === 4 && summary\.rows\.length === 3/);
});

test('Stage 3 smoke stays separate and runs before the isolated production smoke stages',()=>{
  const pkg=JSON.parse(read('package.json'));
  const workflow=read('.github/workflows/pages-production-smoke.yml');
  assert.equal(pkg.scripts['smoke:stage3'],'node scripts/smoke_stage3_ui.mjs');
  assert.equal(pkg.scripts['smoke:pages'],'node scripts/smoke_sync_guard.mjs && node scripts/smoke_answer_outbox.mjs && node scripts/smoke_practice_reliability.mjs && node scripts/smoke_pages_api.mjs');
  const stage3=workflow.indexOf('run: npm run smoke:stage3');
  const syncGuard=workflow.indexOf('run: node scripts/smoke_sync_guard.mjs');
  const answerOutbox=workflow.indexOf('run: node scripts/smoke_answer_outbox.mjs');
  const practiceReliability=workflow.indexOf('run: node scripts/smoke_practice_reliability.mjs');
  const learningApi=workflow.indexOf('run: node scripts/smoke_pages_api.mjs');
  assert.ok(stage3>=0 && syncGuard>stage3 && answerOutbox>syncGuard && practiceReliability>answerOutbox && learningApi>practiceReliability);
});

test('Pages deployment wait includes Stage 3 diagnostics runtime and expanded question pack',()=>{
  const workflow=read('.github/workflows/pages-production-smoke.yml');
  assert.match(workflow,/stage3-reading\.js/);
  assert.match(workflow,/ManjingoStage3Reading/);
  assert.match(workflow,/stage3-diagnostics\.js/);
  assert.match(workflow,/ManjingoStage3Diagnostics/);
  assert.match(workflow,/theme-runtime\.js/);
  assert.match(workflow,/home-shell\.js/);
  assert.match(workflow,/question-pack-transfer-07\.js/);
  assert.match(workflow,/question-pack-passage-set-01\.js/);
  assert.match(workflow,/tr10q036/);
});
