const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const worker=fs.readFileSync(path.join(__dirname,'..','public','_worker.js'),'utf8');

test('answer submission opens its read-write transaction in batchGet',()=>{
 assert.match(worker,/function beginBatchGetDocuments\(env,token,paths\)/);
 assert.match(worker,/JSON\.stringify\(\{documents:names,newTransaction:\{readWrite:\{\}\}\}\)/);
 assert.match(worker,/return\{transaction,documents:/);
 const answer=worker.slice(worker.indexOf('async function submitAnswer'),worker.indexOf('async function submitStage3Calibration'));
 assert.match(answer,/let tx=null/);
 assert.match(answer,/tx=begun\.transaction/);
 assert.doesNotMatch(answer,/beginTransaction\(/);
});
