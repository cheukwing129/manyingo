'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const read=file=>fs.readFileSync(path.join(__dirname,'..','public',file),'utf8');

function load(state={}){
  const RealDate=Date,fixed=Date.parse('2026-09-11T02:00:00.000Z');
  class FakeDate extends RealDate{constructor(...args){super(...(args.length?args:[fixed]))}static now(){return fixed}}
  const now=new FakeDate(),today=now.getFullYear()+'-'+String(now.getMonth()+1).padStart(2,'0')+'-'+String(now.getDate()).padStart(2,'0');
  const initial={totalXp:24,todayXp:16,streak:2,lastGoalDate:'2026-09-11',todayDate:today,knowledge:{},skillMastery:{},practiceHistory:[],conceptMastery:{},...(state.progress||{}),knowledge:state.knowledge||{}};
  const store=new Map([['manjingo_progress_cache',JSON.stringify(initial)]]);
  const context={Date:FakeDate,console,localStorage:{getItem:key=>store.get(key)||null,setItem:(key,value)=>store.set(key,String(value))},setTimeout(){throw new Error('Local reconciliation must not schedule installation retries')}};
  context.window=context;
  vm.createContext(context);
  vm.runInContext(read('learning-policy.js'),context);
  vm.runInContext(read('local-learning.js'),context);
  return{learning:context.ManjingoLocalLearning,store};
}
const known={attempts:3,mastery:64,lastCorrect:true,lastAnsweredAt:'2026-09-11T01:10:00.000Z'};

test('the first remote response cannot roll back local knowledge or XP before any account runtime loads',()=>{
  const{learning,store}=load({knowledge:{kp1:known}});
  const response={attempts:2,mastery:30,lastCorrect:false,lastAnsweredAt:'2026-09-11T01:05:00.000Z',totalXp:8,todayXp:8,streak:1,conceptMastery:{conceptKey:'c1',mastery:40,attempts:2,lastAnsweredAt:'2026-09-11T01:05:00.000Z'}};
  const original=JSON.stringify(response),result=learning.syncRemoteResult('kp1',response);
  assert.equal(result.mastery,64);
  assert.equal(result.attempts,3);
  assert.equal(result.lastAnsweredAt,known.lastAnsweredAt);
  assert.equal(result.totalXp,24);
  assert.equal(result.todayXp,16);
  assert.equal(result.streak,2);
  assert.equal(result.conceptMastery.conceptKey,'c1','concept recency remains independent from KP recency');
  assert.equal(JSON.stringify(response),original,'reconciliation must not mutate the incoming response');
  const saved=JSON.parse(store.get('manjingo_progress_cache'));
  assert.equal(saved.knowledge.kp1.mastery,64);
  assert.equal(saved.totalXp,24);
});

test('a genuinely newer wrong answer may still reduce mastery',()=>{
  const{learning}=load({knowledge:{kp1:{...known,mastery:78}}});
  const result=learning.syncRemoteResult('kp1',{attempts:4,mastery:55,lastCorrect:false,lastAnsweredAt:'2026-09-11T01:12:00.000Z',totalXp:24,todayXp:16,streak:2});
  assert.equal(result.attempts,4);
  assert.equal(result.mastery,55);
  assert.equal(result.lastCorrect,false);
});

test('equal attempts use answer time to reject only the older response',()=>{
  const{learning}=load({knowledge:{kp1:{...known,attempts:4,mastery:60}}});
  learning.syncRemoteResult('kp1',{attempts:4,mastery:30,lastAnsweredAt:'2026-09-11T01:09:59.000Z'});
  assert.equal(learning.getKnowledge('kp1').mastery,60);
  learning.syncRemoteResult('kp1',{attempts:4,mastery:65,lastAnsweredAt:'2026-09-11T01:10:01.000Z'});
  assert.equal(learning.getKnowledge('kp1').mastery,65);
});

test('stale standalone gamification sync cannot move totals backwards',()=>{
  const{learning}=load({progress:{totalXp:80,todayXp:24,streak:5}});
  const result=learning.syncGamification({totalXp:72,todayXp:16,streak:4,lastGoalDate:'2026-09-10'});
  assert.equal(result.totalXp,80);
  assert.equal(result.todayXp,24);
  assert.equal(result.streak,5);
  assert.equal(result.lastGoalDate,'2026-09-11');
});

test('an unknown knowledge point and larger cloud XP still synchronize normally',()=>{
  const{learning}=load();
  const result=learning.syncRemoteResult('new',{attempts:1,mastery:22,lastCorrect:true,totalXp:40,todayXp:24,streak:3});
  assert.equal(result.mastery,22);
  assert.equal(result.attempts,1);
  assert.equal(result.totalXp,40);
  assert.equal(learning.getProgress().streak,3);
});

test('an out-of-order sequence keeps the newest KP record while reconciling cloud rewards',()=>{
  const{learning}=load({knowledge:{kp1:known}});
  learning.syncRemoteResult('kp1',{attempts:5,mastery:80,totalXp:40,lastAnsweredAt:'2026-09-11T01:15:00.000Z'});
  learning.syncRemoteResult('kp1',{attempts:4,mastery:55,totalXp:32,lastAnsweredAt:'2026-09-11T01:12:00.000Z'});
  assert.equal(learning.getKnowledge('kp1').attempts,5);
  assert.equal(learning.getKnowledge('kp1').mastery,80);
  assert.equal(learning.getProgress().totalXp,40);
});

test('reconciliation rejects stale Firestore timestamps as well as ISO strings',()=>{
  const{learning}=load({knowledge:{kp1:{...known,attempts:4,lastAnsweredAt:{seconds:Date.parse(known.lastAnsweredAt)/1000}}}});
  learning.syncRemoteResult('kp1',{attempts:4,mastery:30,lastAnsweredAt:{_seconds:Date.parse('2026-09-11T01:09:59.000Z')/1000}});
  assert.equal(learning.getKnowledge('kp1').mastery,64);
});
