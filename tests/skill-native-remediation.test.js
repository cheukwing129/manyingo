const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const policy=require('../public/practice-effectiveness.js');
const accountSync=require('../public/account-sync.js');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');

function learningWith(history,records){return{
 getPracticeHistory(){return history.slice()},
 getKnowledge(id){return records[id]||{mastery:0,attempts:0,misconceptions:{}}},
 getMisconceptionConcepts(){return[]},
 getConceptMastery(){return{mastery:0}}
}}

test('skill remediation combines tagged practice across route KPs',()=>{
 const history=[
  {skillId:'fw.zhi',kpId:'kp_a',strategy:'targeted',delta:2,accuracy:50,completedAt:'2026-09-12T10:00:00Z'},
  {skillId:'fw.zhi',kpId:'kp_b',strategy:'targeted',delta:2,accuracy:60,completedAt:'2026-09-11T10:00:00Z'},
  {skillId:'fw.er',kpId:'kp_a',strategy:'targeted',delta:20,accuracy:100,completedAt:'2026-09-12T11:00:00Z'}
 ],learning=learningWith(history,{kp_a:{mastery:40,attempts:2},kp_b:{mastery:45,attempts:2}}),status=policy.remediationStatusForSkill('fw.zhi',['kp_a','kp_b'],learning);
 assert.equal(status.sessions,2);assert.equal(status.totalDelta,4);assert.equal(status.averageAccuracy,55);assert.equal(status.needsRemediation,true);assert.equal(status.learningState.key,'remedial');
});

test('tagged shared-KP practice cannot bleed into another skill',()=>{
 const history=[{skillId:'fw.nai',kpId:'kp_shared',strategy:'targeted',delta:1,accuracy:40,completedAt:'2026-09-12T10:00:00Z'}],learning=learningWith(history,{kp_shared:{mastery:35,attempts:2}});
 assert.equal(policy.historyForSkill('fw.ze',['kp_shared'],learning).length,0);
 assert.equal(policy.historyForSkill('fw.nai',['kp_shared'],learning).length,1);
});

test('legacy untagged practice still migrates through KP membership',()=>{
 const history=[{kpId:'kp_shared',strategy:'targeted',delta:3,accuracy:60,completedAt:'2026-09-12T10:00:00Z'}],learning=learningWith(history,{kp_shared:{mastery:40,attempts:2}});
 assert.equal(policy.historyForSkill('fw.nai',['kp_shared'],learning).length,1);
});

test('skill-first plan promotes one skill intervention without changing its route identity',()=>{
 const history=[
  {skillId:'fw.zhi',kpId:'kp_a',strategy:'targeted',delta:2,accuracy:50,completedAt:'2026-09-12T10:00:00Z'},
  {skillId:'fw.zhi',kpId:'kp_b',strategy:'targeted',delta:2,accuracy:50,completedAt:'2026-09-11T10:00:00Z'}
 ],learning=learningWith(history,{kp_a:{mastery:40,attempts:2,misconceptions:{}},kp_b:{mastery:42,attempts:2,misconceptions:{}},kp_other:{mastery:50,attempts:2,misconceptions:{}}}),plan={targetCount:2,skillFirst:true,items:[{skillId:'fw.er',kpIds:['kp_other'],kpId:'kp_other',category:'review',priority:100},{skillId:'fw.zhi',kpIds:['kp_a','kp_b'],kpId:'kp_a',category:'weak',priority:80}]},adjusted=policy.prioritizeDailyPlan(plan,['kp_a','kp_b','kp_other'],2,learning);
 assert.equal(adjusted.skillInterventionAdaptive,true);assert.equal(adjusted.items[0].skillId,'fw.zhi');assert.equal(adjusted.items[0].kpId,'kp_a');assert.deepEqual(adjusted.items[0].kpIds,['kp_a','kp_b']);assert.equal(adjusted.items[0].interventionState,'remedial');assert.equal(adjusted.interventions[0].skillId,'fw.zhi');
});

test('practice session metadata preserves skill and concrete route',()=>{
 const store=new Map(),context={window:{},localStorage:{getItem:key=>store.get(key)||null,setItem:(key,value)=>store.set(key,String(value))}};vm.createContext(context);vm.runInContext(read('public/local-learning.js'),context);
 const meta=context.window.ManjingoLocalLearning.recordPracticeSession({kpId:'kp_read_context_clues',skillId:'read.context-clues',routeKpId:'kp_read_context_clues',strategy:'reteach'});
 assert.equal(meta.skillId,'read.context-clues');assert.equal(meta.routeKpId,'kp_read_context_clues');assert.equal(meta.strategy,'reteach');
});

test('targeted lesson question pool spans KP routes for one skill',()=>{
 const questions=[{id:'a1',kpId:'kp_a',skillIds:['fw.zhi'],normalCore:true},{id:'b1',kpId:'kp_b',skillIds:['fw.zhi'],normalCore:true},{id:'e1',kpId:'kp_a',skillIds:['fw.er'],normalCore:true}],window={ManjingoContent:{questions,knowledgePoints:[]},ManjingoSkillResultsV1:{annotatedQuestions(){return questions},kpIdsForSkill(id){return id==='fw.zhi'?['kp_a','kp_b']:['kp_a']}},ManjingoLocalLearning:{getKnowledge(){return{misconceptions:{}}}},ManjingoQuestionRotation:{rank(list){return list.slice()}}},context={window,console,Map,Set,Array,Object,Number,String,Math,RegExp,Date,URLSearchParams};vm.createContext(context);vm.runInContext(read('public/local-lesson.js'),context);const selected=context.window.ManjingoLocalLesson.targetedQuestions('kp_a',5,'fw.zhi');assert.deepEqual(Array.from(selected,x=>x.id),['a1','b1']);
});

test('weakness and results practice links carry the exact selected skill',()=>{
 const weakness=read('public/weakness-panel.js'),dashboard=read('public/mastery-dashboard.js'),lesson=read('public/local-lesson.js');
 assert.match(weakness,/function href\(kpId,skillId\)/);assert.match(weakness,/&skillId='\+encodeURIComponent\(skillId\)/);assert.match(weakness,/href\(item\.kpId,item\.skillId\)/);
 assert.match(dashboard,/function href\(item\)/);assert.match(dashboard,/&skillId='\+encodeURIComponent\(item\.skillId\)/);
 assert.match(lesson,/requestedSkillId=params\.get\('skillId'\)\|\|''/);assert.match(lesson,/resolveTargetSkill\(kpId,requestedSkillId\)/);
});

test('cross-device practice merge keeps different skills distinct on a shared route',()=>{
 const completedAt='2026-09-12T12:00:00Z',base={kpId:'kp_shared',routeKpId:'kp_shared',completedAt,strategy:'targeted',beforeMastery:40,afterMastery:44},merged=accountSync.mergePracticeHistory([{...base,skillId:'fw.nai'}],[{...base,skillId:'fw.ze'}]);
 assert.equal(merged.length,2);assert.deepEqual(new Set(merged.map(x=>x.skillId)),new Set(['fw.nai','fw.ze']));
});
