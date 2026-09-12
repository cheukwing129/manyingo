const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const verify=require('../public/answer-verification-v1.js');
const read=file=>fs.readFileSync(path.join(__dirname,'..',file),'utf8');

const choice={id:'q001',type:'choice',answer:'貶官',options:['提拔','貶官','辭職','退休']};

test('server verifier derives correctness from authoritative question metadata',()=>{
 assert.equal(verify.verify(choice,'貶官').isCorrect,true);
 assert.equal(verify.verify(choice,'提拔').isCorrect,false);
});

test('answer normalization preserves existing punctuation and whitespace tolerance',()=>{
 assert.equal(verify.verify({id:'fill1',type:'fill',answer:'先天下之憂而憂，後天下之樂而樂'},'先天下之憂而憂 後天下之樂而樂').isCorrect,true);
});

test('choice submission rejects values outside the reviewed option set',()=>{
 assert.throws(()=>verify.verify(choice,'客戶端偽造答案'),error=>error&&error.status===400);
});

test('worker overwrites client correctness before every learning update',()=>{
 const worker=read('public/_worker.js');
 assert.match(worker,/import '\.\/answer-verification-v1\.js'/);
 assert.match(worker,/const verified=ANSWER_VERIFICATION\.verify\(questionData,answer\.selectedAnswer\)/);
 assert.match(worker,/answer\.isCorrect=verified\.isCorrect/);
 assert.match(worker,/answer\.correctAnswer=verified\.correctAnswer/);
 assert.match(worker,/correctnessMismatch:answer\.clientClaimedCorrect!=null&&answer\.clientClaimedCorrect!==answer\.isCorrect/);
});

test('browser cloud payload sends the selected answer but no correctness claim or answer key',()=>{
 const html=read('public/index.html'),cloud=html.match(/function cloudSubmit\([\s\S]*?\nfunction createAnswerId/);
 assert.ok(cloud);
 assert.match(cloud[0],/selectedAnswer:value/);
 assert.doesNotMatch(cloud[0],/isCorrect:/);
 assert.doesNotMatch(cloud[0],/correctAnswer:/);
 assert.match(html,/confirmedCorrect=result\.isCorrect===true/);
});

test('difficulty telemetry consumes server-confirmed correctness',()=>{
 const firebase=read('public/firebase-config.js');
 assert.match(firebase,/calibration\.recordAnswer\(\{ \.\.\.answer, isCorrect:result\.isCorrect===true \}\)/);
});

test('server derives concept attribution from reviewed question metadata',()=>{
 const worker=read('public/_worker.js');
 assert.match(worker,/function reviewedConcept\(questionData\)/);
 assert.match(worker,/\(\{conceptKey,conceptLabel\}=reviewedConcept\(question\.data\)\)/);
 assert.match(worker,/conceptAttributionMismatch:answer\.clientClaimedConceptKey!=null&&answer\.clientClaimedConceptKey!==conceptKey/);
 assert.doesNotMatch(worker,/let baseXp = 8, conceptKey = answer\.conceptKey/);
});
