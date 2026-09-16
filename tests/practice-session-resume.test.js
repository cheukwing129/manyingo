const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

function loadLesson(){
  const data=new Map();
  const localStorage={getItem:key=>data.has(key)?data.get(key):null,setItem:(key,value)=>data.set(key,String(value)),removeItem:key=>data.delete(key)};
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

test('recording the completed targeted session clears the resume checkpoint',()=>{
  const{api,context,localStorage}=loadLesson();
  const original=state({index:0,answeredCount:1,correctCount:1});
  assert.equal(api.saveTargetedCheckpoint(original),true);
  const sessions=[];
  context.ManjingoLocalLearning={getKnowledge:()=>({mastery:42}),recordPracticeSession:value=>{sessions.push(value);return value}};
  assert.equal(api.recordTargetedSession(original),true);
  assert.equal(sessions.length,1);
  assert.equal(localStorage.getItem(api.TARGETED_CHECKPOINT_KEY),null);
  assert.equal(api.recordTargetedSession(original),false);
  assert.equal(sessions.length,1);
});
