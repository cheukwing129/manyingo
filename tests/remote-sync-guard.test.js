const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'..','public','remote-sync-guard.js'),'utf8');

function load(state){
  const captured={results:[],games:[]};
  const knowledge={...(state&&state.knowledge||{})};
  const progress={totalXp:24,todayXp:16,streak:2,lastGoalDate:'2026-09-11',...(state&&state.progress||{})};
  const learning={
    getKnowledge:kpId=>knowledge[kpId]||{},
    getProgress:()=>({...progress}),
    syncRemoteResult:(kpId,result)=>{captured.results.push({kpId,result:{...result}});return result},
    syncGamification:game=>{captured.games.push({...game});return game}
  };
  const window={ManjingoLocalLearning:learning};
  const context={window,ManjingoLocalLearning:learning,console,Date,Number,Object,Array,String,setTimeout:fn=>{fn();return 1}};
  vm.createContext(context);
  vm.runInContext(source,context);
  return{guard:context.ManjingoRemoteSyncGuard||context.window.ManjingoRemoteSyncGuard,learning,captured};
}

test('stale answer response cannot roll back a newer knowledge record or gamification',()=>{
  const env=load({knowledge:{kp1:{attempts:3,mastery:64,lastAnsweredAt:'2026-09-11T01:10:00.000Z'}},progress:{totalXp:24,todayXp:16,streak:2}});
  env.learning.syncRemoteResult('kp1',{attempts:2,mastery:30,lastCorrect:false,lastAnsweredAt:'2026-09-11T01:05:00.000Z',totalXp:8,todayXp:8,streak:1,conceptMastery:{conceptKey:'c1',attempts:2,lastAnsweredAt:'2026-09-11T01:05:00.000Z'}});
  const sent=env.captured.results.at(-1).result;
  assert.equal(sent.mastery,undefined);
  assert.equal(sent.attempts,undefined);
  assert.equal(sent.lastAnsweredAt,undefined);
  assert.equal(sent.totalXp,24);
  assert.equal(sent.todayXp,16);
  assert.equal(sent.streak,2);
  assert.equal(sent.conceptMastery.conceptKey,'c1','concept merge remains available because it has its own recency guard');
});

test('a genuinely newer wrong answer may still reduce mastery',()=>{
  const env=load({knowledge:{kp1:{attempts:3,mastery:78,lastAnsweredAt:'2026-09-11T01:10:00.000Z'}},progress:{totalXp:24,todayXp:16,streak:2}});
  env.learning.syncRemoteResult('kp1',{attempts:4,mastery:55,lastCorrect:false,lastAnsweredAt:'2026-09-11T01:12:00.000Z',totalXp:24,todayXp:16,streak:2});
  const sent=env.captured.results.at(-1).result;
  assert.equal(sent.attempts,4);
  assert.equal(sent.mastery,55);
  assert.equal(sent.lastCorrect,false);
});

test('equal attempts use answer time to reject only the older response',()=>{
  const env=load({knowledge:{kp1:{attempts:4,mastery:60,lastAnsweredAt:'2026-09-11T01:10:00.000Z'}}});
  assert.equal(env.guard.remoteKnowledgeIsNewer(env.learning.getKnowledge('kp1'),{attempts:4,lastAnsweredAt:'2026-09-11T01:09:59.000Z'}),false);
  assert.equal(env.guard.remoteKnowledgeIsNewer(env.learning.getKnowledge('kp1'),{attempts:4,lastAnsweredAt:'2026-09-11T01:10:01.000Z'}),true);
});

test('stale standalone gamification sync cannot move totals backwards',()=>{
  const env=load({progress:{totalXp:80,todayXp:24,streak:5,lastGoalDate:'2026-09-11'}});
  env.learning.syncGamification({totalXp:72,todayXp:16,streak:4,lastGoalDate:'2026-09-10'});
  const sent=env.captured.games.at(-1);
  assert.equal(sent.totalXp,80);
  assert.equal(sent.todayXp,24);
  assert.equal(sent.streak,5);
  assert.equal(sent.lastGoalDate,'2026-09-11');
});

test('browser adaptive loader installs the remote sync guard',()=>{
  const rotation=fs.readFileSync(path.join(__dirname,'..','public','home-shell.js'),'utf8');
  assert.match(rotation,/remote-sync-guard\.js/);
  assert.ok(rotation.indexOf('difficulty-observability.js')<rotation.indexOf('remote-sync-guard.js'));
  assert.match(source,/__remoteSyncGuardInstalled/);
  assert.match(source,/remoteKnowledgeIsNewer/);
});
