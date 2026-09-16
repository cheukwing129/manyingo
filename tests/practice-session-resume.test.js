const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

function makeStorage(data=new Map()){
  return{
    get length(){return data.size},
    key:index=>Array.from(data.keys())[index]??null,
    getItem:key=>data.has(key)?data.get(key):null,
    setItem:(key,value)=>data.set(key,String(value)),
    removeItem:key=>data.delete(key)
  };
}
function loadLesson(){
  const data=new Map();
  const localStorage=makeStorage(data);
  const context={localStorage,Date,Math,JSON,String,Number,Array,Object,Set,Map,URLSearchParams,window:null};
  context.window=context;
  context.ManjingoContent={questions:[{id:'q1',kpId:'kp1'},{id:'q2',kpId:'kp1'},{id:'q3',kpId:'kp1'}]};
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(__dirname,'..','public','local-lesson.js'),'utf8'),context,{filename:'local-lesson.js'});
  return{api:context.ManjingoLocalLesson,context,localStorage,data};
}

function state(overrides={}){
  return{targeted:true,sessionRecorded:false,kp:{kpId:'kp1'},skillId:'skill1',questions:[{id:'q1'},{id:'q2'},{id:'q3'}],index:1,answeredCount:2,correctCount:1,startMastery:24,startConceptMastery:18,remedial:false,reteach:false,focus:null,...overrides};
}

test('targeted practice checkpoint resumes at the next unanswered question with original counters',()=>{
  const{api}=loadLesson();
  const original=state();
  assert.equal(api.saveTargetedCheckpoint(original),true);
  const fresh=state({questions:[{id:'other'}],index:0,answeredCount:0,correctCount:0,startMastery:70,startConceptMastery:null});
  assert.equal(api.restoreTargetedCheckpoint(fresh),true);
  assert.equal(fresh.index,2);
  assert.deepEqual(Array.from(fresh.questions,q=>q.id),['q1','q2','q3']);
  assert.equal(fresh.answeredCount,2);
  assert.equal(fresh.correctCount,1);
  assert.equal(fresh.startMastery,24);
  assert.equal(fresh.startConceptMastery,18);
  assert.equal(fresh.resumed,true);
});

test('checkpoint never resumes into a different skill or practice strategy',()=>{
  const{api}=loadLesson();
  assert.equal(api.saveTargetedCheckpoint(state()),true);
  assert.equal(api.restoreTargetedCheckpoint(state({skillId:'skill2',index:0})),false);
  assert.equal(api.restoreTargetedCheckpoint(state({remedial:true,index:0})),false);
});

test('parallel targeted sessions keep independent checkpoints on one shared route',()=>{
  const{api,data}=loadLesson();
  const first=state({skillId:'skill1',index:0,answeredCount:1,correctCount:1});
  const second=state({skillId:'skill2',index:1,answeredCount:2,correctCount:0,startMastery:11});
  assert.equal(api.saveTargetedCheckpoint(first),true);
  assert.equal(api.saveTargetedCheckpoint(second),true);
  assert.ok(data.has(api.checkpointKey(first)));
  assert.ok(data.has(api.checkpointKey(second)));
  assert.notEqual(api.checkpointKey(first),api.checkpointKey(second));
  const resumeFirst=state({skillId:'skill1',questions:[{id:'other'}],index:0,answeredCount:0,correctCount:0});
  const resumeSecond=state({skillId:'skill2',questions:[{id:'other'}],index:0,answeredCount:0,correctCount:0});
  assert.equal(api.restoreTargetedCheckpoint(resumeFirst),true);
  assert.equal(api.restoreTargetedCheckpoint(resumeSecond),true);
  assert.equal(resumeFirst.index,1);
  assert.equal(resumeSecond.index,2);
  assert.equal(resumeFirst.correctCount,1);
  assert.equal(resumeSecond.correctCount,0);
});

test('legacy single checkpoint migrates into its matching v2 session key',()=>{
  const{api,localStorage}=loadLesson();
  const legacy={version:1,kpId:'kp1',skillId:'skill1',strategy:'targeted',questionIds:['q1','q2','q3'],nextIndex:2,answeredCount:2,correctCount:1,startMastery:24,startConceptMastery:18,updatedAt:Date.now()};
  localStorage.setItem(api.TARGETED_CHECKPOINT_KEY,JSON.stringify(legacy));
  const fresh=state({questions:[{id:'other'}],index:0,answeredCount:0,correctCount:0});
  assert.equal(api.restoreTargetedCheckpoint(fresh),true);
  assert.equal(localStorage.getItem(api.TARGETED_CHECKPOINT_KEY),null);
  assert.ok(localStorage.getItem(api.checkpointKey(fresh)));
  assert.equal(fresh.index,2);
});

test('recording one completed targeted session clears only its own resume checkpoint',()=>{
  const{api,context,localStorage}=loadLesson();
  const original=state({skillId:'skill1',index:0,answeredCount:1,correctCount:1});
  const other=state({skillId:'skill2',index:0,answeredCount:1,correctCount:0});
  assert.equal(api.saveTargetedCheckpoint(original),true);
  assert.equal(api.saveTargetedCheckpoint(other),true);
  const originalKey=api.checkpointKey(original),otherKey=api.checkpointKey(other);
  const sessions=[];
  context.ManjingoLocalLearning={getKnowledge:()=>({mastery:42}),recordPracticeSession:value=>{sessions.push(value);return value}};
  assert.equal(api.recordTargetedSession(original),true);
  assert.equal(sessions.length,1);
  assert.equal(localStorage.getItem(originalKey),null);
  assert.ok(localStorage.getItem(otherKey));
  assert.equal(api.recordTargetedSession(original),false);
  assert.equal(sessions.length,1);
});

test('account local-state cleanup removes legacy and all per-session targeted checkpoints',()=>{
  const sync=require('../public/account-sync.js');
  const data=new Map();
  global.localStorage=makeStorage(data);
  try{
    global.localStorage.setItem(sync.LEARNING_KEY,'{}');
    global.localStorage.setItem(sync.ROTATION_KEY,'{}');
    global.localStorage.setItem(sync.TARGETED_CHECKPOINT_KEY,'{"kpId":"kp1"}');
    global.localStorage.setItem(sync.TARGETED_CHECKPOINT_PREFIX+'kp1|skill1|targeted','{}');
    global.localStorage.setItem(sync.TARGETED_CHECKPOINT_PREFIX+'kp1|skill2|targeted','{}');
    assert.equal(sync.clearLocal(),true);
    assert.equal(global.localStorage.getItem(sync.LEARNING_KEY),null);
    assert.equal(global.localStorage.getItem(sync.ROTATION_KEY),null);
    assert.equal(global.localStorage.getItem(sync.TARGETED_CHECKPOINT_KEY),null);
    assert.equal(Array.from(data.keys()).filter(key=>key.startsWith(sync.TARGETED_CHECKPOINT_PREFIX)).length,0);
  }finally{delete global.localStorage}
});
