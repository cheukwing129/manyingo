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
  assert.match(source,/practiceSessions\/\$\{practice\.practiceId\}/);
  assert.match(source,/SERVER_PRACTICE\.buildIntervention/);
  assert.match(source,/writes\.push\(updateWrite\(env,practicePath,storedPractice\),updateWrite\(env,interventionPath,interventionUpdate\)\)/);
  assert.match(source,/practiceSession:existing\.practiceSession\|\|null/);
});
