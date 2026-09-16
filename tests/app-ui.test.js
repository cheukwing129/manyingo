const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');

test('homepage and lesson share one UI foundation',()=>{
  const shell=read('public/home-shell.js'),lesson=read('public/lesson.html');
  assert.match(shell,/function installUiFoundation\(\)/);
  assert.match(shell,/link\.href='\.\/app-ui\.css'/);
  assert.match(shell,/function install\(\)\{if\(shellInstalled\)return false;shellInstalled=true;installUiFoundation\(\);enhancePlayerStatus\(\);enhanceAppNav\(\)/);
  assert.match(shell,/revealHomepageShell\(\);loadStage3Reading\(\);return true/);
  assert.match(shell,/\ninstall\(\);\n\}\)\(\);/);
  assert.match(lesson,/rel="stylesheet" href="\.\/app-ui\.css"/);
});

test('shared UI foundation normalizes cards controls headings and empty states',()=>{
  const css=read('public/app-ui.css');
  assert.match(css,/--ui-radius-card:20px/);
  assert.match(css,/--ui-radius-control:14px/);
  assert.match(css,/--ui-touch:48px/);
  assert.match(css,/#lessonApp \.lesson-head/);
  assert.match(css,/#learningPath \.lp-title,#weaknessPanel \.weak-title,#masteryDashboard \.dashboard-title/);
  assert.match(css,/#weaknessPanel \.weak-empty/);
  assert.match(css,/#masteryDashboard \.dashboard-empty/);
});

test('shared UI foundation protects narrow phones accessibility and motion preferences',()=>{
  const css=read('public/app-ui.css');
  assert.match(css,/@media\(max-width:430px\)/);
  assert.match(css,/@media\(max-width:370px\)/);
  assert.match(css,/min-height:50px/);
  assert.match(css,/button:focus-visible/);
  assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
  assert.match(css,/grid-template-columns:1fr!important/);
});