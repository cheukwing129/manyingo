(function(root,factory){
'use strict';
const api=factory(root);
if(typeof module==='object'&&module.exports)module.exports=api;
root.ManjingoDifficultyCalibration=api;
if(root.window&&root.window!==root)root.window.ManjingoDifficultyCalibration=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(root){
'use strict';
const TIERS=['foundation','application','transfer'];
const STATE_KEY='manjingo_progress_cache';
const RECENT_LIMIT=6;
const PROMOTE_ACCURACY=85;
const APPLICATION_DEMOTE_ACCURACY=50;
const TRANSFER_DEMOTE_ACCURACY=60;
function clamp(value,min,max){return Math.max(min,Math.min(max,value))}
function tierIndex(tier){const i=TIERS.indexOf(String(tier||''));return i>=0?i:1}
function validTier(tier){return TIERS.includes(String(tier||''))?String(tier):'application'}
function emptyTier(){return{attempts:0,correctCount:0,wrongCount:0,recent:[],lastCorrect:null,lastAnsweredAt:null}}
function normalizeTier(value){
 const raw=value&&typeof value==='object'?value:{};
 const recent=(Array.isArray(raw.recent)?raw.recent:[]).map(x=>x===true||x===1||x==='1').slice(0,RECENT_LIMIT);
 const attempts=Math.max(0,Number(raw.attempts)||0),correctCount=Math.max(0,Number(raw.correctCount)||0),wrongCount=Math.max(0,Number(raw.wrongCount)||0);
 return{attempts,correctCount,wrongCount,recent,lastCorrect:raw.lastCorrect===true?true:raw.lastCorrect===false?false:null,lastAnsweredAt:raw.lastAnsweredAt||null};
}
function emptyTierStats(){return Object.fromEntries(TIERS.map(tier=>[tier,emptyTier()]))}
function normalizeTierStats(stats){const raw=stats&&typeof stats==='object'?stats:{};return Object.fromEntries(TIERS.map(tier=>[tier,normalizeTier(raw[tier])]))}
function recordTierOutcome(stats,tier,isCorrect,answeredAt){
 const next=normalizeTierStats(stats),key=validTier(tier),entry={...next[key]},correct=!!isCorrect;
 entry.attempts+=1;if(correct)entry.correctCount+=1;else entry.wrongCount+=1;
 entry.recent=[correct,...entry.recent].slice(0,RECENT_LIMIT);entry.lastCorrect=correct;entry.lastAnsweredAt=answeredAt instanceof Date?answeredAt.toISOString():String(answeredAt||new Date().toISOString());next[key]=entry;return next;
}
function tierProfile(stats,tier){
 const entry=normalizeTierStats(stats)[validTier(tier)],recent=entry.recent,correctRecent=recent.filter(Boolean).length;
 let streak=0;for(const value of recent){if(!value)break;streak+=1;}
 return{attempts:entry.attempts,correctCount:entry.correctCount,wrongCount:entry.wrongCount,overallAccuracy:entry.attempts?Math.round(entry.correctCount/entry.attempts*100):null,recentAttempts:recent.length,recentAccuracy:recent.length?Math.round(correctRecent/recent.length*100):null,recentCorrectStreak:streak,lastCorrect:entry.lastCorrect,lastAnsweredAt:entry.lastAnsweredAt};
}
function masteryValue(value){const n=Number(value);return clamp(Number.isFinite(n)?n:0,0,100)}
function baseTierForMastery(mastery){const value=masteryValue(mastery);return value>=75?'transfer':value>=40?'application':'foundation'}
function calibrationDecision(mastery,options){
 const opts=options||{},mode=String(opts.mode||'normal'),baseTier=baseTierForMastery(mastery),baseIndex=tierIndex(baseTier),stats=normalizeTierStats(opts.tierStats),value=masteryValue(mastery);
 if(mode==='remedial')return{baseTier,targetTier:'foundation',reason:'remedial',stats};
 if(mode==='reteach')return{baseTier,targetTier:'transfer',reason:'reteach',stats};
 let targetIndex=baseIndex,reason='mastery';
 const baseProfile=tierProfile(stats,baseTier);
 if(baseTier==='foundation'&&value>=30&&baseProfile.recentAttempts>=4&&baseProfile.recentAccuracy>=PROMOTE_ACCURACY&&baseProfile.recentCorrectStreak>=3){targetIndex=1;reason='foundation-ready';}
 else if(baseTier==='application'&&baseProfile.recentAttempts>=4&&baseProfile.recentAccuracy<=APPLICATION_DEMOTE_ACCURACY){targetIndex=0;reason='application-struggling';}
 else if(baseTier==='application'&&value>=65&&baseProfile.recentAttempts>=4&&baseProfile.recentAccuracy>=PROMOTE_ACCURACY&&baseProfile.recentCorrectStreak>=3){targetIndex=2;reason='application-ready';}
 else if(baseTier==='transfer'&&baseProfile.recentAttempts>=4&&baseProfile.recentAccuracy<TRANSFER_DEMOTE_ACCURACY){targetIndex=1;reason='transfer-struggling';}
 if(opts.lastCorrect===false){const mistakeFloor=Math.max(0,baseIndex-1);if(targetIndex>mistakeFloor||reason==='mastery'){targetIndex=Math.min(targetIndex,mistakeFloor);reason='recent-mistake';}}
 targetIndex=clamp(targetIndex,Math.max(0,baseIndex-1),Math.min(TIERS.length-1,baseIndex+1));
 return{baseTier,targetTier:TIERS[targetIndex],reason,stats,profile:baseProfile};
}
function tierForMastery(mastery,options){return calibrationDecision(mastery,options).targetTier}
function storage(){return root.localStorage||(root.window&&root.window.localStorage)||null}
function readState(){const s=storage();if(!s)return null;try{const value=JSON.parse(s.getItem(STATE_KEY)||'{}');return value&&typeof value==='object'?value:{}}catch(e){return{}}}
function writeState(state){const s=storage();if(!s)return false;try{s.setItem(STATE_KEY,JSON.stringify(state||{}));return true}catch(e){return false}}
function catalog(){return root.ManjingoContent||(root.window&&root.window.ManjingoContent)||null}
function questionTier(kpId,questionId,explicitTier){
 if(TIERS.includes(String(explicitTier||'')))return String(explicitTier);
 const content=catalog(),question=content&&Array.isArray(content.questions)?content.questions.find(q=>String(q&&q.id)===String(questionId||'')&&String(q&&q.kpId)===String(kpId||'')):null;
 return validTier(question&&question.difficultyTier);
}
function emit(detail){const target=root.window||root,EventCtor=root.CustomEvent||(root.window&&root.window.CustomEvent);if(target&&typeof target.dispatchEvent==='function'&&typeof EventCtor==='function')target.dispatchEvent(new EventCtor('manjingo:learning-state-changed',{detail:{source:'difficulty-calibration',...(detail||{})}}));}
function recordAnswer(answer){
 if(!answer||!answer.kpId||typeof answer.isCorrect!=='boolean')return null;
 const state=readState();if(!state)return null;if(!state.knowledge||typeof state.knowledge!=='object')state.knowledge={};
 const kpId=String(answer.kpId),record=state.knowledge[kpId]&&typeof state.knowledge[kpId]==='object'?{...state.knowledge[kpId]}:{};
 const tier=questionTier(kpId,answer.questionId,answer.difficultyTier),tierStats=recordTierOutcome(record.tierStats,tier,answer.isCorrect,new Date());
 record.tierStats=tierStats;record.lastDifficultyTier=tier;state.knowledge[kpId]=record;if(!writeState(state))return null;emit({kpId,tier,isCorrect:answer.isCorrect});return{tier,tierStats};
}
return{TIERS,STATE_KEY,RECENT_LIMIT,PROMOTE_ACCURACY,APPLICATION_DEMOTE_ACCURACY,TRANSFER_DEMOTE_ACCURACY,tierIndex,validTier,emptyTier,emptyTierStats,normalizeTierStats,recordTierOutcome,tierProfile,baseTierForMastery,calibrationDecision,tierForMastery,questionTier,recordAnswer};
});
