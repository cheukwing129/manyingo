const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const sync=require('../public/account-sync.js');

test('large account state merges knowledge skill and concept records in one batch',()=>{
 const knowledgeState={};
 for(let i=0;i<500;i++)knowledgeState['kp_'+i]={attempts:1,mastery:i%100,lastAnsweredAt:'2026-09-16T05:00:00Z'};
 const local={totalXp:120,todayXp:8,todayDate:'2026-09-16',streak:4,knowledge:{kp_0:{attempts:2,mastery:99,lastAnsweredAt:'2026-09-16T06:00:00Z'}},skillMastery:{},conceptMastery:{},practiceHistory:[],interventionState:{}};
 const merged=sync.mergeAccountState(local,{knowledgeState,skillState:{'fw.zhi':{skillId:'fw.zhi',attempts:3,mastery:55,lastAnsweredAt:'2026-09-16T05:30:00Z'}},conceptState:{'zhi.verb':{conceptKey:'zhi.verb',attempts:2,mastery:45,lastAnsweredAt:'2026-09-16T05:20:00Z'}}},null);
 assert.equal(Object.keys(merged.knowledge).length,500);
 assert.equal(merged.knowledge.kp_0.mastery,99);
 assert.equal(merged.knowledge.kp_499.attempts,1);
 assert.equal(merged.skillMastery['fw.zhi'].mastery,55);
 assert.equal(merged.conceptMastery['zhi.verb'].mastery,45);
});

test('startup sync does not loop through remote KPs with per-record local-learning writes',()=>{
 const source=fs.readFileSync(path.join(__dirname,'..','public','account-sync.js'),'utf8');
 assert.match(source,/local=mergeAccountState\(local,accountState,game\)/);
 assert.doesNotMatch(source,/Object\.entries\(knowledgeState\|\|\{\}\)\.forEach/);
 assert.doesNotMatch(source,/engine\.syncRemoteResult/);
});
