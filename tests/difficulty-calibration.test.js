const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const root=path.join(__dirname,'..');
const source=file=>fs.readFileSync(path.join(root,file),'utf8');
const calibration=require('../public/difficulty-calibration.js');
const difficulty=require('../public/question-difficulty.js');

function outcomes(tier,values){let stats=calibration.emptyTierStats();for(const value of values)stats=calibration.recordTierOutcome(stats,tier,value,'2026-09-11T00:00:00.000Z');return stats;}

test('tier telemetry keeps bounded recent outcomes and lifetime counters',()=>{
 const stats=outcomes('foundation',[true,true,false,true,true,true,false,true]);
 const entry=stats.foundation,profile=calibration.tierProfile(stats,'foundation');
 assert.equal(entry.attempts,8);
 assert.equal(entry.correctCount,6);
 assert.equal(entry.wrongCount,2);
 assert.equal(entry.recent.length,6);
 assert.deepEqual(entry.recent,[true,false,true,true,true,false]);
 assert.equal(profile.recentAttempts,6);
 assert.equal(profile.recentAccuracy,67);
 assert.equal(profile.recentCorrectStreak,1);
});

test('calibration never changes a mastery tier without enough recent evidence',()=>{
 const sparse=outcomes('foundation',[true,true,true]);
 assert.equal(calibration.tierForMastery(34,{tierStats:sparse}),'foundation');
 const sparseApplication=outcomes('application',[true,true,true]);
 assert.equal(calibration.tierForMastery(68,{tierStats:sparseApplication}),'application');
});

test('strong near-threshold performance can promote exactly one tier early',()=>{
 const foundation=outcomes('foundation',[true,true,true,true]);
 const first=calibration.calibrationDecision(34,{tierStats:foundation});
 assert.equal(first.baseTier,'foundation');
 assert.equal(first.targetTier,'application');
 assert.equal(first.reason,'foundation-ready');
 const application=outcomes('application',[true,true,true,true]);
 const second=calibration.calibrationDecision(68,{tierStats:application});
 assert.equal(second.baseTier,'application');
 assert.equal(second.targetTier,'transfer');
 assert.equal(second.reason,'application-ready');
});

test('sustained struggle demotes one tier while intervention overrides remain absolute',()=>{
 const weakApplication=outcomes('application',[false,false,true,false]);
 assert.equal(calibration.calibrationDecision(55,{tierStats:weakApplication}).targetTier,'foundation');
 const weakTransfer=outcomes('transfer',[false,true,false,false]);
 assert.equal(calibration.calibrationDecision(82,{tierStats:weakTransfer}).targetTier,'application');
 assert.equal(calibration.tierForMastery(95,{tierStats:weakTransfer,mode:'remedial'}),'foundation');
 assert.equal(calibration.tierForMastery(5,{tierStats:weakTransfer,mode:'reteach'}),'transfer');
});

test('recent mistake cannot compound a calibration demotion by more than one mastery tier',()=>{
 const weakTransfer=outcomes('transfer',[false,true,false,false]);
 const decision=calibration.calibrationDecision(82,{tierStats:weakTransfer,lastCorrect:false});
 assert.equal(decision.baseTier,'transfer');
 assert.equal(decision.targetTier,'application');
});

test('question difficulty delegates to calibration data when available',()=>{
 globalThis.ManjingoDifficultyCalibration=calibration;
 const stats=outcomes('application',[true,true,true,true]);
 assert.equal(difficulty.tierForMastery(68,{tierStats:stats}),'transfer');
 delete globalThis.ManjingoDifficultyCalibration;
});

test('browser telemetry records the reviewed question tier into learner state',()=>{
 const memory=new Map([['manjingo_progress_cache',JSON.stringify({knowledge:{kp1:{mastery:34}}})]]);
 const localStorage={getItem:key=>memory.get(key)||null,setItem:(key,value)=>memory.set(key,String(value))};
 const context={window:{localStorage,ManjingoContent:{questions:[{id:'q1',kpId:'kp1',difficultyTier:'foundation'}]}},Map,Set,Array,Object,Number,String,Math,Date,JSON};
 vm.createContext(context);vm.runInContext(source('public/difficulty-calibration.js'),context);
 const result=context.window.ManjingoDifficultyCalibration.recordAnswer({kpId:'kp1',questionId:'q1',isCorrect:true});
 assert.equal(result.tier,'foundation');
 const state=JSON.parse(memory.get('manjingo_progress_cache'));
 assert.equal(state.knowledge.kp1.lastDifficultyTier,'foundation');
 assert.equal(state.knowledge.kp1.tierStats.foundation.attempts,1);
 assert.equal(state.knowledge.kp1.tierStats.foundation.correctCount,1);
});

test('runtime loads telemetry before difficulty selection and records cloud telemetry only after confirmed delivery',()=>{
 const rotation=source('public/question-rotation.js'),firebase=source('public/firebase-config.js');
 const calibrationPos=rotation.indexOf('difficulty-calibration.js'),difficultyPos=rotation.indexOf('question-difficulty.js');
 assert.ok(calibrationPos>=0&&difficultyPos>calibrationPos,'calibration must load before difficulty selector');
 assert.match(firebase,/function recordDifficultyOutcome\(answer, result\)/);
 assert.match(firebase,/result\.duplicate/);
 assert.match(firebase,/calibration\.recordAnswer\(\{ \.\.\.answer, isCorrect:result\.isCorrect===true \}\)/);
 const submitStart=firebase.indexOf('export async function submitAnswer');
 const queued=firebase.indexOf('box.enqueue(payload,currentUserId)',submitStart);
 const delivered=firebase.indexOf('const result = await sendAnswerOnce(payload)',submitStart);
 const recorded=firebase.indexOf('recordDifficultyOutcome(payload, result)',submitStart);
 assert.ok(queued>submitStart&&delivered>queued&&recorded>delivered,'cloud telemetry must follow durable queueing and confirmed delivery');
 const flushStart=firebase.indexOf('export async function flushAnswerOutbox');
 const flushEnd=firebase.indexOf('function installAnswerOutboxRetry',flushStart);
 assert.ok(flushStart>=0&&flushEnd>flushStart);
 assert.doesNotMatch(firebase.slice(flushStart,flushEnd),/recordDifficultyOutcome/,'background replay must not double-count calibration after local fallback');
});
