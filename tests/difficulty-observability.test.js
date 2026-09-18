const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const root=path.join(__dirname,'..');
const source=file=>fs.readFileSync(path.join(root,file),'utf8');
const accountSync=require('../public/account-sync.js');

function browserContext(initialState){
 const memory=new Map([['manjingo_progress_cache',JSON.stringify(initialState||{knowledge:{}})]]);
 const localStorage={getItem:key=>memory.get(key)||null,setItem:(key,value)=>memory.set(key,String(value))};
 const window={localStorage,setTimeout,clearTimeout};
 const context={window,localStorage,console,Map,Set,Array,Object,Number,String,Math,Date,JSON,setTimeout,clearTimeout};
 vm.createContext(context);
 vm.runInContext(source('public/difficulty-calibration.js'),context);
 vm.runInContext(source('public/question-difficulty.js'),context);
 vm.runInContext(source('public/difficulty-observability.js'),context);
 return{context,memory,observability:context.window.ManjingoDifficultyObservability,calibration:context.window.ManjingoDifficultyCalibration};
}
function outcomes(calibration,tier,values){let stats=calibration.emptyTierStats();for(const value of values)stats=calibration.recordTierOutcome(stats,tier,value,'2026-09-11T00:00:00.000Z');return stats;}

test('observability explains calibration and actual selection separately',()=>{
 const env=browserContext({knowledge:{kp1:{mastery:68}}});
 const stats=outcomes(env.calibration,'application',[true,true,true,true]);
 env.context.window.ManjingoLocalLearning={getKnowledge:()=>({mastery:68,lastCorrect:true,tierStats:stats}),getRemediationStatus:()=>({})};
 const candidate={id:'q-transfer',kpId:'kp1',difficultyTier:'transfer'};
 const decision=env.observability.decisionFor([candidate],[],candidate);
 assert.equal(decision.baseTier,'application');
 assert.equal(decision.targetTier,'transfer');
 assert.equal(decision.selectedTier,'transfer');
 assert.equal(decision.reason,'application-ready');
 assert.equal(decision.selectionReason,'target-tier');
 assert.match(decision.reasonLabel,/挑戰跨篇遷移/);
 assert.equal(decision.profile.recentAttempts,4);
 assert.equal(decision.profile.recentAccuracy,100);
});

test('misconception targeting is visible even when selected tier differs from target',()=>{
 const env=browserContext({knowledge:{kp1:{mastery:82}}});
 env.context.window.ManjingoLocalLearning={getKnowledge:()=>({mastery:82,lastCorrect:true,tierStats:env.calibration.emptyTierStats()}),getRemediationStatus:()=>({})};
 const candidate={id:'q-foundation',kpId:'kp1',difficultyTier:'foundation'};
 const decision=env.observability.decisionFor([candidate],['q-foundation'],candidate);
 assert.equal(decision.targetTier,'transfer');
 assert.equal(decision.selectedTier,'foundation');
 assert.equal(decision.selectionReason,'misconception-target');
 assert.match(decision.selectionLabel,/容易混淆/);
});

test('student summary turns internal decisions into concise learning guidance',()=>{
 const env=browserContext({knowledge:{}});
 const summary=env.observability.studentSummary({mastery:68,baseTier:'application',targetTier:'transfer',selectedTier:'transfer',reason:'application-ready',reasonLabel:'legacy engineering copy',selectionReason:'target-tier',selectionLabel:'legacy selection copy',profile:{recentAttempts:4,recentAccuracy:100,recentCorrectStreak:4}});
 assert.equal(summary.tier,'跨篇遷移');
 assert.match(summary.reason,/語境應用近期表現穩定/);
 assert.doesNotMatch(summary.reason,/legacy/);
 assert.match(summary.evidence,/掌握度 68%/);
 assert.match(summary.evidence,/近期同層 4 題 100%/);
 assert.match(summary.adjustment,/語境應用調整至跨篇遷移/);
 const targeted=env.observability.studentSummary({mastery:82,baseTier:'transfer',targetTier:'transfer',selectedTier:'foundation',reason:'mastery',reasonLabel:'legacy engineering copy',selectionReason:'misconception-target',selectionLabel:'legacy selection copy',profile:{recentAttempts:0,recentAccuracy:null,recentCorrectStreak:0}});
 assert.match(targeted.reason,/容易混淆/);
 assert.doesNotMatch(targeted.reason,/legacy/);
 assert.match(targeted.adjustment,/本題實際使用基礎辨識/);
});

test('observed choices persist bounded deduplicated decision history inside the KP record',()=>{
 const env=browserContext({knowledge:{kp1:{mastery:40}}});
 const base={kpId:'kp1',questionId:'q1',mastery:40,mode:'normal',lastCorrect:true,baseTier:'application',targetTier:'application',selectedTier:'application',reason:'mastery',reasonLabel:'依你目前的掌握度安排',selectionReason:'target-tier',selectionLabel:'選用目前適合你的難度',profile:{recentAttempts:0,recentAccuracy:null,recentCorrectStreak:0,overallAccuracy:null}};
 env.observability.persistDecision({...base,observedAt:'2026-09-11T00:00:00.000Z'});
 env.observability.persistDecision({...base,observedAt:'2026-09-11T00:00:05.000Z'});
 for(let i=0;i<15;i++)env.observability.persistDecision({...base,questionId:'q'+(i+2),observedAt:new Date(Date.UTC(2026,8,11,0,1,i)).toISOString()});
 const state=JSON.parse(env.memory.get('manjingo_progress_cache'));
 const obs=state.knowledge.kp1.difficultyObservability;
 assert.equal(obs.totalDecisions,16,'the duplicate within 10 seconds must not count twice');
 assert.equal(obs.recent.length,12);
 assert.equal(obs.reasonCounts.mastery,16);
 assert.equal(obs.selectionCounts['target-tier'],16);
 assert.equal(obs.lastDecision.questionId,'q16');
});

test('cross-device merge treats a newer difficulty observation as newer state when attempts tie',()=>{
 const local={attempts:2,lastAnsweredAt:'2026-09-11T00:00:00.000Z',difficultyObservability:{lastDecision:{observedAt:'2026-09-11T00:10:00.000Z'}}};
 const remote={attempts:2,lastAnsweredAt:'2026-09-11T00:05:00.000Z'};
 assert.equal(accountSync.newerRecord(local,remote),local);
 assert.equal(accountSync.recordTime(local),new Date('2026-09-11T00:10:00.000Z').getTime());
});

test('observability re-wraps a replaced rotation chooser without duplicating UI listeners',()=>{
 const memory=new Map([['manjingo_progress_cache',JSON.stringify({knowledge:{kp1:{mastery:50}}})]]);
 const localStorage={getItem:key=>memory.get(key)||null,setItem:(key,value)=>memory.set(key,String(value))};
 let listenerCount=0,firstCalls=0,secondCalls=0;
 const rotation={choose(list){firstCalls+=1;return list[0]||null}};
 const window={ManjingoQuestionRotation:rotation,localStorage,setTimeout,clearTimeout,addEventListener(name){if(name==='manjingo:difficulty-observed')listenerCount+=1},dispatchEvent(){}};
 const context={window,localStorage,console,Map,Set,Array,Object,Number,String,Math,Date,JSON,setTimeout,clearTimeout};
 vm.createContext(context);
 vm.runInContext(source('public/difficulty-observability.js'),context);
 const api=context.window.ManjingoDifficultyObservability,firstWrapper=rotation.choose;
 assert.equal(firstWrapper.__difficultyObservabilityWrapper,true);
 assert.equal(listenerCount,1);
 firstWrapper([{id:'q1',kpId:'kp1',difficultyTier:'application'}],[]);
 assert.equal(firstCalls,1);
 rotation.choose=function(list){secondCalls+=1;return list[0]||null};
 assert.equal(api.install(),true,'reinstall should wrap the replacement chooser');
 assert.notEqual(rotation.choose,firstWrapper);
 assert.equal(rotation.choose.__difficultyObservabilityWrapper,true);
 rotation.choose([{id:'q2',kpId:'kp1',difficultyTier:'application'}],[]);
 assert.equal(secondCalls,1);
 assert.equal(listenerCount,1,'UI listener must remain single-install');
 assert.equal(api.install(),false,'already wrapped chooser should not be wrapped again');
 assert.equal(listenerCount,1);
});

test('browser runtime integrates difficulty explanations inside learning results',()=>{
 const rotation=source('public/question-rotation.js'),observability=source('public/difficulty-observability.js');
 const difficultyPos=rotation.indexOf('question-difficulty.js'),observabilityPos=rotation.indexOf('difficulty-observability.js');
 assert.ok(difficultyPos>=0&&observabilityPos>difficultyPos,'observability must wrap the calibrated difficulty selector');
 assert.match(observability,/ManjingoAccountSync/);
 assert.match(observability,/sync\.schedule\(\)/);
 assert.match(observability,/manjingo:difficulty-observed/);
 assert.match(observability,/為甚麼系統安排這個難度？/);
 assert.match(observability,/近期同層/);
 assert.match(observability,/dashboard\.querySelector&&dashboard\.querySelector\('\.dashboard-hero'\)/);
 assert.match(observability,/查看另外/);
 assert.match(observability,/difficultyObservability/);
});
