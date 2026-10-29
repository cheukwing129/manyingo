const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const policy=require('../public/practice-effectiveness.js');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');

test('high mastery with small gains and strong accuracy is protected from false remediation',()=>{
 const result=policy.evaluate([
  {kpId:'kp',beforeMastery:92,afterMastery:94,delta:2,accuracy:100,strategy:'targeted',completedAt:'2026-09-10T10:00:00Z'},
  {kpId:'kp',beforeMastery:90,afterMastery:92,delta:2,accuracy:80,strategy:'targeted',completedAt:'2026-09-09T10:00:00Z'}
 ],{currentMastery:94});
 assert.equal(result.sessions,2);assert.equal(result.totalDelta,4);assert.equal(result.highMastery,true);assert.equal(result.ceilingProtected,true);assert.equal(result.needsRemediation,false);
});

test('low mastery repeated low-yield practice still triggers remediation',()=>{
 const result=policy.evaluate([{beforeMastery:35,afterMastery:38,delta:3,accuracy:60,strategy:'targeted'},{beforeMastery:33,afterMastery:35,delta:2,accuracy:50,strategy:'targeted'}],{currentMastery:38});
 assert.equal(result.totalDelta,5);assert.equal(result.averageAccuracy,55);assert.equal(result.needsRemediation,true);
});

test('high mastery with poor practice accuracy can still trigger remediation',()=>{
 const result=policy.evaluate([{beforeMastery:91,afterMastery:90,delta:-1,accuracy:60,strategy:'targeted'},{beforeMastery:92,afterMastery:91,delta:-1,accuracy:50,strategy:'targeted'}],{currentMastery:90});
 assert.equal(result.highMastery,true);assert.equal(result.lowAccuracy,true);assert.equal(result.ceilingProtected,false);assert.equal(result.needsRemediation,true);
});

test('a remedial intervention resets older targeted low-yield evidence',()=>{
 const result=policy.evaluate([{delta:2,accuracy:80,strategy:'targeted',completedAt:'2026-09-10T12:00:00Z'},{delta:4,accuracy:100,strategy:'remedial',completedAt:'2026-09-10T11:00:00Z'},{delta:2,accuracy:50,strategy:'targeted',completedAt:'2026-09-09T12:00:00Z'},{delta:2,accuracy:50,strategy:'targeted',completedAt:'2026-09-08T12:00:00Z'}],{currentMastery:50});
 assert.equal(result.sessions,1);assert.equal(result.needsRemediation,false);
});

test('legacy practice records remain valid remediation evidence',()=>{const result=policy.evaluate([{delta:3,accuracy:60},{delta:2,accuracy:50}],{currentMastery:40});assert.equal(result.sessions,2);assert.equal(result.needsRemediation,true)});

test('successful remedial verification is measured as effective without escalating',()=>{
 const result=policy.interventionOutcome([{strategy:'remedial',beforeMastery:90,afterMastery:92,delta:2,accuracy:100,conceptBeforeMastery:60,conceptAfterMastery:69,conceptDelta:9,completedAt:'2026-09-10T12:00:00Z'}],{currentMastery:92});
 assert.equal(result.hasIntervention,true);assert.equal(result.strategy,'remedial');assert.equal(result.effective,true);assert.equal(result.conceptDelta,9);assert.equal(result.needsConceptReteach,false);
});

test('failed latest remedial verification escalates to concept reteaching',()=>{
 const result=policy.interventionOutcome([{strategy:'remedial',beforeMastery:55,afterMastery:48,delta:-7,accuracy:50,conceptBeforeMastery:40,conceptAfterMastery:28,conceptDelta:-12,completedAt:'2026-09-10T12:00:00Z'}],{currentMastery:48});
 assert.equal(result.strategy,'remedial');assert.equal(result.effective,false);assert.equal(result.needsConceptReteach,true);
});

test('newer targeted evidence clears a stale failed remedial escalation',()=>{
 const result=policy.interventionOutcome([{strategy:'targeted',delta:8,accuracy:100,completedAt:'2026-09-10T13:00:00Z'},{strategy:'remedial',delta:-6,accuracy:50,completedAt:'2026-09-10T12:00:00Z'}],{currentMastery:60});
 assert.equal(result.hasIntervention,false);assert.equal(result.needsConceptReteach,false);
});

test('reteach completion is measured but never recursively requests another reteach',()=>{
 const result=policy.interventionOutcome([{strategy:'reteach',delta:-5,accuracy:33,conceptDelta:-8,completedAt:'2026-09-10T12:00:00Z'}],{currentMastery:40});
 assert.equal(result.strategy,'reteach');assert.equal(result.effective,false);assert.equal(result.needsConceptReteach,false);
});

test('learning state names effective targeted remedial and reteach outcomes',()=>{
 const targeted=policy.learningState([{strategy:'targeted',beforeMastery:40,afterMastery:50,delta:10,accuracy:80,completedAt:'2026-09-10T12:00:00Z'}],{currentMastery:50});
 assert.equal(targeted.key,'targeted-effective');assert.equal(targeted.label,'補強有效');assert.equal(targeted.priority,0);
 const remedial=policy.learningState([{strategy:'remedial',beforeMastery:50,afterMastery:58,delta:8,accuracy:100,completedAt:'2026-09-10T12:00:00Z'}],{currentMastery:58});
 assert.equal(remedial.key,'remedial-effective');assert.equal(remedial.label,'補救後已穩定');
 const reteach=policy.learningState([{strategy:'reteach',beforeMastery:45,afterMastery:60,delta:15,accuracy:100,conceptDelta:18,completedAt:'2026-09-10T12:00:00Z'}],{currentMastery:60});
 assert.equal(reteach.key,'reteach-effective');assert.equal(reteach.label,'概念重教有效');
});

test('learning state gives failed remediation higher priority than ordinary remediation',()=>{
 const reteach=policy.learningState([{strategy:'remedial',beforeMastery:55,afterMastery:48,delta:-7,accuracy:50,conceptDelta:-12,completedAt:'2026-09-10T12:00:00Z'}],{currentMastery:48});
 assert.equal(reteach.key,'reteach');assert.equal(reteach.label,'需要概念重教');assert.equal(reteach.priority,4);assert.equal(reteach.actionable,true);
 const remedial=policy.learningState([{strategy:'targeted',delta:2,accuracy:50,completedAt:'2026-09-10T12:00:00Z'},{strategy:'targeted',delta:2,accuracy:60,completedAt:'2026-09-09T12:00:00Z'}],{currentMastery:45});
 assert.equal(remedial.key,'remedial');assert.equal(remedial.label,'需要補救');assert.equal(remedial.priority,3);
});

test('daily plan injects concept reteach before ordinary review and cools effective weak practice',()=>{
 const histories={
  reteach:[{strategy:'remedial',beforeMastery:55,afterMastery:48,delta:-7,accuracy:50,conceptKey:'concept_x',conceptLabel:'概念 X',completedAt:'2026-09-10T12:00:00Z'}],
  remedial:[{strategy:'targeted',delta:2,accuracy:50,completedAt:'2026-09-10T12:00:00Z'},{strategy:'targeted',delta:2,accuracy:60,completedAt:'2026-09-09T12:00:00Z'}],
  cooled:[{strategy:'remedial',beforeMastery:45,afterMastery:55,delta:10,accuracy:100,completedAt:'2026-09-10T12:00:00Z'}]
 },knowledge={reteach:{mastery:48,misconceptions:{}},remedial:{mastery:42,misconceptions:{}},review:{mastery:65,misconceptions:{}},cooled:{mastery:55,misconceptions:{}},fresh:{mastery:0,misconceptions:{}}},learning={getKnowledge:id=>knowledge[id]||{mastery:0,misconceptions:{}},getPracticeHistory:({kpId})=>histories[kpId]||[],getMisconceptionConcepts:()=>[],getConceptMastery:()=>({mastery:0})};
 const base={targetCount:4,items:[{kpId:'review',category:'review',priority:1},{kpId:'cooled',category:'weak',priority:2},{kpId:'remedial',category:'weak',priority:2},{kpId:'fresh',category:'new',priority:3}]};
 const plan=policy.prioritizeDailyPlan(base,['reteach','remedial','review','cooled','fresh'],4,learning);
 assert.deepEqual(plan.items.map(x=>x.kpId),['reteach','remedial','review','fresh']);
 assert.equal(plan.items[0].interventionState,'reteach');assert.equal(plan.items[0].interventionActionable,true);assert.equal(plan.items[1].interventionState,'remedial');
 assert.equal(plan.items.some(x=>x.kpId==='cooled'),false);assert.equal(plan.interventionAdaptive,true);assert.deepEqual(plan.interventions.map(x=>x.state),['reteach','remedial']);
});

for(const policyFirst of [true,false])test('local and cloud plans apply practice policy without function replacement: '+(policyFirst?'policy first':'engine first'),()=>{
 const initial={knowledge:{urgent:{mastery:48,attempts:4,lastCorrect:false,misconceptions:{}},normal:{mastery:40,attempts:2,lastCorrect:false,misconceptions:{}}},practiceHistory:[{kpId:'urgent',strategy:'remedial',beforeMastery:55,afterMastery:48,delta:-7,accuracy:50,completedAt:'2026-09-10T12:00:00.000Z'}],conceptMastery:{},totalXp:0,todayXp:0,streak:0,todayDate:'2026-09-10'};
 const store=new Map([['manjingo_progress_cache',JSON.stringify(initial)]]),window={ManjingoContent:{questions:[{id:'u1',kpId:'urgent'},{id:'n1',kpId:'normal'}],getKnowledgePointIds(){return['urgent','normal']},selectQuestionsForPlan(plan,questions,limit){return(plan.items||[]).slice(0,limit).map(item=>questions.find(q=>q.kpId===item.kpId)).filter(Boolean)}}},document={readyState:'loading',addEventListener(){}},context={window,document,localStorage:{getItem:key=>store.get(key)||null,setItem:(key,value)=>store.set(key,String(value)),removeItem:key=>store.delete(key)},Date:class extends Date{constructor(...args){super(...(args.length?args:['2026-09-10T13:00:00Z']))}static now(){return new Date('2026-09-10T13:00:00Z').getTime()}},console,JSON,Math,Number,String,Object,Array,Map,Set,RegExp};
 vm.createContext(context);
 vm.runInContext(read('public/daily-plan-runtime.js'),context);
 const selector=window.ManjingoContent.selectQuestionsForPlan;
 if(policyFirst){vm.runInContext(read('public/practice-effectiveness.js'),context);assert.equal(Object.getOwnPropertyDescriptor(window,'ManjingoLocalLearning'),undefined,'policy must not install a property setter');}
 vm.runInContext(read('public/local-learning.js'),context);
 const engine=window.ManjingoLocalLearning,build=engine.buildDailyPlan,record=engine.recordPracticeSession,status=engine.getRemediationStatus;
 if(!policyFirst){const cold=engine.buildDailyPlan(['urgent','normal'],2);assert.equal(cold.interventionAdaptive,undefined);vm.runInContext(read('public/practice-effectiveness.js'),context);}
 assert.equal(engine.buildDailyPlan,build);assert.equal(engine.recordPracticeSession,record);assert.equal(engine.getRemediationStatus,status);assert.equal(window.ManjingoContent.selectQuestionsForPlan,selector);
 const local=engine.buildDailyPlan(['urgent','normal'],2);assert.equal(local.interventionAdaptive,true);assert.equal(local.items[0].kpId,'urgent');assert.equal(local.items[0].interventionState,'reteach');
 const remote={targetCount:2,items:[{kpId:'normal',category:'weak',priority:2}]},original=JSON.stringify(remote),selected=window.ManjingoDailyPlanRuntime.selectQuestionsForPlan(remote,window.ManjingoContent.questions,2);assert.equal(selected[0].kpId,'urgent');assert.equal(selected[0].interventionState,'reteach');assert.equal(JSON.stringify(remote),original,'cloud plan must not be modified in place');
});

test('local engine records strategy and concept outcomes through the direct policy API',()=>{
 const store=new Map();const context={window:{ManjingoContent:{questions:[]}},localStorage:{getItem:key=>store.get(key)||null,setItem:(key,value)=>store.set(key,String(value))},Date,console,JSON,Math,Number,String,Object,Array,Map,Set};vm.createContext(context);vm.runInContext(read('public/local-learning.js'),context);vm.runInContext(read('public/practice-effectiveness.js'),context);const practice=context.ManjingoPracticeEffectiveness,engine=context.window.ManjingoLocalLearning;
 const first=engine.recordPracticeSession({kpId:'kp_high',beforeMastery:90,afterMastery:92,correctCount:5,questionCount:5,strategy:'targeted'}),second=engine.recordPracticeSession({kpId:'kp_high',beforeMastery:92,afterMastery:94,correctCount:5,questionCount:5,strategy:'targeted'});
 assert.equal(first.strategy,'targeted');assert.equal(second.strategy,'targeted');let saved=JSON.parse(store.get('manjingo_progress_cache'));assert.equal(saved.practiceHistory[0].strategy,'targeted');assert.equal(saved.practiceHistory[1].strategy,'targeted');const status=engine.getRemediationStatus('kp_high');assert.equal(status.currentMastery,94);assert.equal(status.ceilingProtected,true);assert.equal(status.needsRemediation,false);assert.equal(status.learningState.label,'補強有效');
 const remedial=engine.recordPracticeSession({kpId:'kp_high',beforeMastery:94,afterMastery:95,correctCount:2,questionCount:2,strategy:'remedial',conceptKey:'concept_x',conceptLabel:'概念 X',conceptBeforeMastery:70,conceptAfterMastery:78,conceptDelta:8});assert.equal(remedial.strategy,'remedial');assert.equal(remedial.conceptDelta,8);saved=JSON.parse(store.get('manjingo_progress_cache'));assert.equal(saved.practiceHistory[0].conceptKey,'concept_x');assert.equal(saved.practiceHistory[0].conceptBeforeMastery,70);assert.equal(saved.practiceHistory[0].conceptAfterMastery,78);assert.equal(engine.getRemediationStatus('kp_high').sessions,0);assert.equal(engine.getRemediationStatus('kp_high').remedialEffective,true);assert.equal(engine.getRemediationStatus('kp_high').learningState.label,'補救後已穩定');assert.equal(engine.getRemediationStatus('kp_high').needsConceptReteach,false);
});
