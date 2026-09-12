const test=require('node:test');
const assert=require('node:assert/strict');
const evidence=require('../public/skill-evidence-v1.js');

const question=(id,sourceTextId)=>({id,sourceTextId,skillIds:['fw.zhi'],skillContractVersion:'question-skill-contract-v1'});
function add(previous,{id,text,date,correct=true}){return evidence.update(previous,{localDate:date.slice(0,10),isCorrect:correct},question(id,text),'fw.zhi',date)}

test('a high mastery aggregate without versioned evidence is provisional, never mastered',()=>{
 const result=evidence.assess({mastery:100,attempts:99,lastCorrect:true,source:'legacy-projection'});
 assert.equal(result.verified,false);
 assert.equal(result.state,'provisional');
 assert.equal(result.checks.version,false);
});

test('repeating one question cannot produce a verified green light',()=>{
 let value;
 for(const date of ['2026-09-10T08:00:00Z','2026-09-10T09:00:00Z','2026-09-11T09:00:00Z','2026-09-11T10:00:00Z','2026-09-11T11:00:00Z'])value=add(value,{id:'q1',text:'lunyu',date});
 const result=evidence.assess({mastery:100,lastCorrect:true,evidence:value});
 assert.equal(result.verified,false);
 assert.equal(result.checks.questions,false);
 assert.equal(result.checks.contexts,false);
});

test('verified mastery requires independent questions, contexts, sessions and delayed retrieval',()=>{
 let value;
 for(const row of [
  {id:'q1',text:'lunyu',date:'2026-09-10T08:00:00Z'},
  {id:'q2',text:'lunyu',date:'2026-09-10T09:00:00Z'},
  {id:'q3',text:'mengzi',date:'2026-09-10T10:00:00Z'},
  {id:'q2',text:'lunyu',date:'2026-09-11T07:00:00Z'},
  {id:'q3',text:'mengzi',date:'2026-09-11T09:00:00Z'}
 ])value=add(value,row);
 const result=evidence.assess({mastery:94,lastCorrect:true,evidence:value});
 assert.equal(result.verified,true);
 assert.equal(result.evidence.eligibleAttempts,5);
 assert.equal(result.evidence.questionIds.length,3);
 assert.equal(result.evidence.contextIds.length,2);
 assert.ok(result.evidence.delayedCorrectAt);
});

test('unversioned question metadata cannot backfill trustworthy evidence',()=>{
 const value=evidence.update(null,{localDate:'2026-09-10',isCorrect:true},{id:'q1',sourceTextId:'lunyu',skillIds:['fw.zhi']},'fw.zhi','2026-09-10T08:00:00Z');
 assert.equal(value.version,'');
 assert.equal(value.eligibleAttempts,0);
});
