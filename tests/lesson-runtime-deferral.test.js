'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const bundles=require('../scripts/build_startup_bundles.cjs').bundles;

const LESSON_RUNTIME=[
  'reorder-question.js','curriculum-v1.js','question-metadata-v1.js','question-rotation.js',
  'skill-evidence-v1.js','skill-mastery-v1.js','skill-results-v1.js','learning-path.js',
  'practice-effectiveness.js','mascot-runtime.js','session-summary.js'
];

test('lesson page uses its dedicated runtime instead of the full app runtime',()=>{
  const html=read('public/lesson.html');
  const shell=html.indexOf('./lesson-shell.js'),catalog=html.indexOf('./catalog-runtime.js'),runtime=html.indexOf('./lesson-runtime.js'),localLearning=html.indexOf('./local-learning.js');
  assert.ok(shell>=0&&catalog>shell&&runtime>catalog&&localLearning>runtime,'lesson runtime must be established before local lesson code');
  assert.doesNotMatch(html,/app-runtime\.js/);
});

test('content catalog skips app runtime injection when lesson runtime is supplied',()=>{
  const source=read('public/content-catalog.js');
  assert.match(source,/if\(window\.ManjingoLessonRuntimeBundled\)/);
  assert.match(source,/else if\(window\.ManjingoUseAppRuntimeBundle\)document\.write\('<script src="\.\/app-runtime\.js/);
});

test('lesson runtime contains only lesson-critical shared modules',()=>{
  assert.deepEqual(bundles['lesson-runtime.js'],LESSON_RUNTIME);
  const source=read('public/lesson-runtime.js');
  assert.match(source,/window\.ManjingoStartupRuntimeBundled=true/);
  for(const file of LESSON_RUNTIME)assert.match(source,new RegExp('/\\* '+file.replaceAll('.','\\.')+' \\*/'));
  for(const file of ['learning-path-ui.js','weakness-panel.js','mastery-dashboard.js','account-ui.js','question-pack-adaptive-01.js','difficulty-observability.js'])assert.doesNotMatch(source,new RegExp('/\\* '+file.replaceAll('.','\\.')+' \\*/'));
});

test('lesson parser-blocking shared runtime is materially smaller than app runtime',()=>{
  const lessonBytes=fs.statSync(path.join(root,'public/lesson-runtime.js')).size;
  const appBytes=fs.statSync(path.join(root,'public/app-runtime.js')).size;
  assert.ok(lessonBytes<130000,'lesson runtime unexpectedly grew to '+lessonBytes+' bytes');
  assert.ok(lessonBytes<appBytes*.5,'lesson runtime '+lessonBytes+' is not materially smaller than app runtime '+appBytes);
});

test('lesson defers account synchronization until idle and yields to recent input',()=>{
  const source=read('public/lesson-shell.js');
  assert.match(source,/window\.ManjingoLessonRuntimeBundled=true/);
  assert.match(source,/const DEFERRED_RUNTIME=\['\.\/remote-sync-guard\.js','\.\/account-sync\.js'\]/);
  assert.doesNotMatch(source,/account-ui\.js/);
  assert.match(source,/Date\.now\(\)-lastInteractionAt<900/);
  assert.match(source,/requestIdleCallback\(run,\{timeout:3500\}\)/);
  assert.match(source,/setTimeout\(run,1200\)/);
});
