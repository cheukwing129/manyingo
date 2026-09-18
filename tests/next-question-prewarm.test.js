const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');

test('today quiz prepares the next question during browser idle time',()=>{
  const home=read('public/index.html');
  assert.match(home,/function schedulePreparedQuestion\(targetIndex\)/);
  assert.match(home,/requestIdleCallback\(run,\{timeout:180\}\)/);
  assert.match(home,/takePreparedQuestion\(index\)\|\|buildQuestionFragment\(q,index,questions\.length\)/);
  assert.match(home,/box\.replaceChildren\(fragment\)/);
});

test('adaptive replanning invalidates stale prepared DOM before rebuilding the tail',()=>{
  const home=read('public/index.html');
  const start=home.indexOf('function replanWithCandidates');
  const end=home.indexOf('function refreshRemainingLocal',start);
  assert.ok(start>=0&&end>start,'replan function missing');
  const replan=home.slice(start,end);
  assert.match(replan,/questions=merged\.questions/);
  assert.match(replan,/invalidatePreparedQuestion\(\)/);
  assert.match(replan,/schedulePreparedQuestion\(index\+1\)/);
  assert.ok(replan.indexOf('invalidatePreparedQuestion()')<replan.indexOf('schedulePreparedQuestion(index+1)'),'stale prepared question must be invalidated before replacement prewarm');
});

test('detached prepared controls resolve the live quiz host after activation',()=>{
  const home=read('public/index.html');
  assert.match(home,/function liveQuiz\(\)\{return document\.getElementById\('quiz'\)\}/);
  assert.match(home,/const box=liveQuiz\(\);if\(box\)answer\(box,q,value\)/);
  assert.match(home,/const box=liveQuiz\(\);if\(box\)answer\(box,q,x\)/);
  assert.match(home,/invalidatePreparedQuestion\(\);if\(!questions\.length&&currentPlanSource!=='cloud'\)/);
  const start=home.match(/document\.getElementById\('start'\)\.onclick=async function\(\)\{[\s\S]*?\};/)[0];
  assert.ok(start.indexOf('rebuildStartPlan()')<start.indexOf('invalidatePreparedQuestion()'),'final start plan must be selected before detached prepared DOM is invalidated');
});
