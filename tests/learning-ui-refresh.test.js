const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'..','public','learning-path-ui.js'),'utf8');

function runtime(){
  const listeners=new Map();
  const classes=new Set();
  let weaknessRenders=0,dashboardRenders=0;
  const learning={
    getKnowledge(){return{mastery:0}},
    submit(){return{kpId:'kp_virtual_yi',mastery:22}},
    syncRemoteResult(){return{kpId:'kp_virtual_yi',mastery:44}},
    syncGamification(){return{totalXp:8}},
    syncRemoteConceptState(){return[]},
    resolveQuestionMisconceptions(){return{kpId:'kp_virtual_yi'}},
    recordPracticeSession(){return{kpId:'kp_virtual_yi'}}
  };
  const window={
    ManjingoContent:{knowledgePoints:[],getKnowledgePointIds(){return[]},selectQuestionsForPlan(){return[]}},
    ManjingoLearningPath:{buildStages(){return[]},availableSkillIds(){return[]},currentStage(){return null}},
    ManjingoQuestionMetadataV1:{annotate(question){return question}},
    ManjingoSkillResultsV1:{allItems(){return[]},coreSkills(){return[]},kpIdsForSkill(){return[]},skill(){return null}},
    ManjingoLocalLearning:learning,
    ManjingoWeaknessPanel:{render(){weaknessRenders++}},
    ManjingoMasteryDashboard:{mount(){dashboardRenders++}},
    addEventListener(name,fn){const list=listeners.get(name)||[];list.push(fn);listeners.set(name,list)},
    dispatchEvent(event){(listeners.get(event.type)||[]).forEach(fn=>fn(event));return true}
  };
  const document={readyState:'complete',body:{classList:{contains:name=>classes.has(name),add:name=>classes.add(name),remove:name=>classes.delete(name)}},head:{appendChild(){}},getElementById(){return null},createElement(){return{}}};
  function CustomEvent(type,options){this.type=type;this.detail=options&&options.detail}
  const context={window,document,CustomEvent,Set,Array,Object,String,Number,Math,Map,encodeURIComponent};
  vm.createContext(context);vm.runInContext(source,context);
  return{learning,window,classes,getWeaknessRenders:()=>weaknessRenders,getDashboardRenders:()=>dashboardRenders};
}

test('learning state mutations emit one shared browser event and refresh all learning views',()=>{
  const r=runtime(),events=[];
  r.window.addEventListener('manjingo:learning-state-changed',event=>events.push(event.detail));
  r.learning.submit('kp_virtual_yi',true);
  assert.equal(events.length,1);
  assert.equal(events[0].source,'submit');
  assert.equal(events[0].kpId,'kp_virtual_yi');
  assert.equal(r.getWeaknessRenders(),1);
  assert.equal(r.getDashboardRenders(),1);
});

test('cloud sync, misconception repair, gamification and practice history use the same refresh channel',()=>{
  const r=runtime(),sources=[];
  r.window.addEventListener('manjingo:learning-state-changed',event=>sources.push(event.detail.source));
  r.learning.syncRemoteResult('kp_virtual_yi',{});
  r.learning.resolveQuestionMisconceptions('kp_virtual_yi','q1');
  r.learning.syncRemoteConceptState({});
  r.learning.syncGamification({});
  r.learning.recordPracticeSession({kpId:'kp_virtual_yi'});
  assert.deepEqual(sources,['syncRemoteResult','resolveQuestionMisconceptions','syncRemoteConceptState','syncGamification','recordPracticeSession']);
  assert.equal(r.getWeaknessRenders(),5);
  assert.equal(r.getDashboardRenders(),5);
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
  assert.equal(r.getWeaknessRenders(),1,'all study mutations should collapse into one refresh');
  assert.equal(r.getDashboardRenders(),1);
});

test('learning path UI exposes the shared event contract instead of the old path-only wrapper',()=>{
  assert.match(source,/manjingo:learning-state-changed/);
  assert.match(source,/MUTATING_METHODS=\['submit','syncRemoteResult','syncGamification','syncRemoteConceptState','resolveQuestionMisconceptions','recordPracticeSession'\]/);
  assert.match(source,/ManjingoLearningEvents/);
  assert.match(source,/ManjingoWeaknessPanel/);
  assert.match(source,/ManjingoMasteryDashboard/);
  assert.doesNotMatch(source,/__pathWrapped/);
});
