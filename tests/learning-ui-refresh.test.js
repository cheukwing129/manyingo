const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const read=file=>fs.readFileSync(path.join(__dirname,'..','public',file),'utf8');

function runtime({views=true,calibration=false}={}){
  const listeners=new Map(),classes=new Set(),store=new Map(),timers=[];
  let weaknessRenders=0,dashboardRenders=0;
  const document={readyState:'complete',body:{classList:{contains:name=>classes.has(name)}},head:{appendChild(){}},getElementById(){return null},querySelectorAll(){return[]},addEventListener(){},createElement(){return{}}};
  const context={document,console,URLSearchParams,
    localStorage:{getItem:key=>store.get(key)||null,setItem:(key,value)=>store.set(key,String(value))},
    ManjingoContent:{knowledgePoints:[],questions:[{id:'q1',kpId:'kp_virtual_yi',difficultyTier:'foundation'}],getKnowledgePointIds(){return[]},selectQuestionsForPlan(){return[]}},
    ManjingoLearningPath:{buildStages(){return[]},availableSkillIds(){return[]},currentStage(){return null}},
    ManjingoQuestionMetadataV1:{annotate(question){return question}},
    ManjingoSkillResultsV1:{allItems(){return[]},coreSkills(){return[]},kpIdsForSkill(){return[]},skill(){return null}},
    ManjingoWeaknessPanel:{render(){weaknessRenders++}},
    ManjingoMasteryDashboard:{mount(){dashboardRenders++}},
    addEventListener(name,fn){const list=listeners.get(name)||[];list.push(fn);listeners.set(name,list)},
    dispatchEvent(event){(listeners.get(event.type)||[]).forEach(fn=>fn(event));return true},
    setTimeout(fn,delay){timers.push({fn,delay});return timers.length},clearTimeout(){},
    CustomEvent:function(type,options){this.type=type;this.detail=options&&options.detail}
  };
  context.window=context;
  vm.createContext(context);
  const load=file=>vm.runInContext(read(file),context,{filename:file});
  load('learning-policy.js');load('local-learning.js');
  if(calibration)load('difficulty-calibration.js');
  if(views)load('learning-path-ui.js');
  return{learning:context.ManjingoLocalLearning,window:context,classes,store,timers,load,getWeaknessRenders:()=>weaknessRenders,getDashboardRenders:()=>dashboardRenders};
}
function listen(r,callback){r.window.addEventListener('manjingo:learning-state-changed',callback)}

test('engine notifies after persisting an answer without loading path UI',()=>{
  const r=runtime({views:false}),events=[];
  assert.equal(r.window.ManjingoLearningEvents,undefined);
  listen(r,event=>{
    events.push(event.detail);
    const saved=JSON.parse(r.store.get('manjingo_progress_cache'));
    assert.equal(saved.knowledge.kp_virtual_yi.attempts,1);
    assert.equal(saved.totalXp,8);
  });
  const result=r.learning.submit('kp_virtual_yi',true,{questionId:'q1'});
  assert.equal(events.length,1);
  assert.equal(events[0].source,'submit');
  assert.equal(events[0].kpId,'kp_virtual_yi');
  assert.equal(result.xpEarned,8);
});

test('learning state mutations emit one shared browser event and refresh all loaded views',()=>{
  const r=runtime(),events=[];
  listen(r,event=>events.push(event.detail));
  r.learning.submit('kp_virtual_yi',true);
  assert.equal(events.length,1);
  assert.equal(events[0].source,'submit');
  assert.equal(events[0].kpId,'kp_virtual_yi');
  assert.equal(r.getWeaknessRenders(),1);
  assert.equal(r.getDashboardRenders(),1);
});

test('remote knowledge, skills, concepts, repair, gamification and practice each notify once',()=>{
  const r=runtime(),sources=[];
  listen(r,event=>sources.push(event.detail.source));
  r.learning.syncRemoteResult('kp_virtual_yi',{mastery:44});
  r.learning.resolveQuestionMisconceptions('kp_virtual_yi','q1');
  r.learning.syncRemoteConceptState({concept:{mastery:25,attempts:1}});
  r.learning.syncRemoteSkillState({'fw.yi':{mastery:35,attempts:1}});
  r.learning.syncGamification({totalXp:8});
  r.learning.recordPracticeSession({kpId:'kp_virtual_yi'});
  assert.deepEqual(sources,['syncRemoteResult','resolveQuestionMisconceptions','syncRemoteConceptState','syncRemoteSkillState','syncGamification','recordPracticeSession']);
  assert.equal(r.getWeaknessRenders(),6);
  assert.equal(r.getDashboardRenders(),6);
});

test('study mode coalesces hidden learning view work until the learner exits',()=>{
  const r=runtime();
  r.classes.add('study-focus');
  r.learning.submit('kp_virtual_yi',true);
  r.learning.syncRemoteResult('kp_virtual_yi',{});
  assert.equal(r.getWeaknessRenders(),0);
  assert.equal(r.getDashboardRenders(),0);
  r.classes.delete('study-focus');
  r.window.dispatchEvent({type:'manjingo:study-mode-exit'});
  assert.equal(r.getWeaknessRenders(),1);
  assert.equal(r.getDashboardRenders(),1);
});

test('loading path UI preserves engine methods and does not duplicate notifications',()=>{
  const r=runtime({views:false});
  const methods=['submit','syncRemoteResult','syncGamification','syncRemoteSkillState','syncRemoteConceptState','resolveQuestionMisconceptions','recordPracticeSession'];
  const originals=new Map(methods.map(name=>[name,r.learning[name]])),sources=[];
  listen(r,event=>sources.push(event.detail.source));
  r.learning.submit('kp_virtual_yi',true);
  r.load('learning-path-ui.js');
  for(const name of methods)assert.equal(r.learning[name],originals.get(name),name);
  r.learning.submit('kp_virtual_yi',false);
  assert.deepEqual(sources,['submit','submit']);
  assert.equal(r.getWeaknessRenders(),1);
});

test('engine calibration completes before its single notification; standalone calibration still notifies',()=>{
  const r=runtime({views:false,calibration:true}),sources=[];
  listen(r,event=>{
    sources.push(event.detail.source);
    const saved=JSON.parse(r.store.get('manjingo_progress_cache'));
    assert.ok(saved.knowledge.kp_virtual_yi.tierStats.foundation.attempts>0);
  });
  const result=r.learning.submit('kp_virtual_yi',true,{questionId:'q1'});
  assert.equal(result.tierStats.foundation.attempts,1);
  assert.deepEqual(sources,['submit']);
  r.window.ManjingoDifficultyCalibration.recordAnswer({kpId:'kp_virtual_yi',questionId:'q1',isCorrect:false});
  assert.deepEqual(sources,['submit','difficulty-calibration']);
});

test('ordinary lesson answers schedule account sync without path UI or calibration',()=>{
  const r=runtime({views:false}),submit=r.learning.submit;
  r.load('account-sync.js');
  assert.equal(r.window.ManjingoLearningEvents,undefined);
  assert.equal(r.window.ManjingoDifficultyCalibration,undefined);
  assert.equal(r.learning.submit,submit);
  r.timers.length=0; // Hold startup/cloud work; observe scheduling only.
  r.learning.submit('kp_virtual_yi',true);
  assert.equal(r.timers.length,1);
  assert.equal(r.timers[0].delay,1800);
});

test('read operations and rejected mutation inputs do not publish state changes',()=>{
  const r=runtime({views:false}),events=[];
  listen(r,event=>events.push(event));
  r.learning.getProgress();r.learning.getKnowledge('kp_virtual_yi');r.learning.getPracticeHistory();
  r.learning.syncRemoteResult('kp_virtual_yi',null);r.learning.recordPracticeSession(null);
  assert.equal(events.length,0);
});
