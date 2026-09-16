const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const read=file=>fs.readFileSync(path.join(__dirname,'..',file),'utf8');

test('targeted lesson attaches its final answer to the local practice record',()=>{
  const lesson=read('public/local-lesson.js'),learning=read('public/local-learning.js');
  assert.match(lesson,/state\.index\+1===state\.questions\.length/);
  assert.match(lesson,/state\.finalAnswer=\{answerId:'practiceanswer'/);
  assert.match(lesson,/finalAnswer:state\.finalAnswer\|\|null/);
  assert.match(learning,/session\.finalAnswer\?\{finalAnswer:\{\.\.\.session\.finalAnswer\}\}/);
});

test('final targeted answer durably records the practice before the completion click',()=>{
  const lesson=read('public/local-lesson.js');
  assert.match(lesson,/function recordTargetedSession\(state\)/);
  assert.match(lesson,/state\.sessionRecorded/);
  const answerStart=lesson.indexOf('function answer(app,state,q,value)');
  const localSubmit=lesson.indexOf('window.ManjingoLocalLearning.submit',answerStart);
  const durableRecord=lesson.indexOf('recordTargetedSession(state)',localSubmit);
  const feedback=lesson.indexOf('const concept=',localSubmit);
  assert.ok(answerStart>=0&&localSubmit>answerStart,'answer must write local learning state');
  assert.ok(durableRecord>localSubmit&&durableRecord<feedback,'final practice must be recorded immediately after the local answer and before feedback/completion UI');
  const finishStart=lesson.indexOf('function finish(app,state)');
  const finishFallback=lesson.indexOf('recordTargetedSession(state)',finishStart);
  assert.ok(finishFallback>finishStart,'completion keeps an idempotent practice-record fallback');
});

test('account sync uses one answer request for new practice and keeps legacy fallback',()=>{
  const source=read('public/account-sync.js');
  assert.match(source,/if\(session\.finalAnswer\)/);
  assert.match(source,/fb\.submitAnswer\(\{\.\.\.session\.finalAnswer,practiceSession\}\)/);
  assert.match(source,/api\.submitPracticeSession\(session\)/);
});

test('answer transaction validates and atomically persists attached practice',()=>{
  const source=read('public/_worker.js');
  assert.match(source,/raw\.practiceSession\?validatePracticeSession/);
  assert.match(source,/practice summary does not match final answer route/);
  assert.match(source,/SERVER_PRACTICE\.buildIntervention/);
  assert.match(source,/writes\.push\(updateWrite\(env,interventionPath,interventionUpdate\)\)/);
  assert.doesNotMatch(source,/practicePath=practice/);
  assert.match(source,/practiceSession:existing\.practiceSession\|\|null/);
});
