const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const worker=fs.readFileSync(path.join(__dirname,'..','public','_worker.js'),'utf8');
const answer=worker.slice(worker.indexOf('async function submitAnswer'),worker.indexOf('async function submitStage3Calibration'));
const legacy=worker.slice(worker.indexOf('async function submitPracticeSession'),worker.indexOf('async function practiceState'));

test('folded practice has one durable event copy while legacy endpoint remains compatible',()=>{
 assert.match(answer,/practiceSession:storedPractice/);
 assert.match(answer,/SERVER_PRACTICE\.buildIntervention/);
 assert.doesNotMatch(answer,/practiceSessions\//);
 assert.match(legacy,/practiceSessions\/\$\{session\.practiceId\}/);
});
