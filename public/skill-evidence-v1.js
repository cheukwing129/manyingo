(function(root,factory){
'use strict';
const api=factory();
if(typeof module==='object'&&module.exports)module.exports=api;
root.ManjingoSkillEvidenceV1=api;
if(root.window&&root.window!==root)root.window.ManjingoSkillEvidenceV1=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';

const VERSION='skill-evidence-v1';
const QUESTION_CONTRACT_VERSION='question-skill-contract-v1';
const MIN_MASTERY=90;
const MIN_ATTEMPTS=5;
const MIN_QUESTIONS=3;
const MIN_CONTEXTS=2;
const MIN_SESSIONS=2;
const PRODUCTION_SKILLS=new Set(['trans.reorder']);
const MIN_PRODUCTION_QUESTIONS=3;
const MIN_PRODUCTION_CONTEXTS=2;
const DELAY_MS=24*60*60*1000;
const MAX_IDS=64;

function unique(values){return Array.from(new Set((Array.isArray(values)?values:[]).map(String).filter(Boolean))).slice(-MAX_IDS)}
function timeValue(value){if(!value)return 0;try{if(typeof value.toDate==='function')return value.toDate().getTime();if(Number.isFinite(Number(value._seconds)))return Number(value._seconds)*1000;if(Number.isFinite(Number(value.seconds)))return Number(value.seconds)*1000;const valueTime=new Date(value).getTime();return Number.isFinite(valueTime)?valueTime:0}catch(_){return 0}}
function iso(value){const time=timeValue(value);return time?new Date(time).toISOString():null}
function contextId(question){const value=String(question&&question.sourceTextId||question&&question.textId||'');return value&&value!=='CROSS'?value:null}
function eligibleQuestion(question,skillId){return !!(question&&question.skillContractVersion===QUESTION_CONTRACT_VERSION&&Array.isArray(question.skillIds)&&question.skillIds.map(String).includes(String(skillId||''))&&question.id)}
function empty(){return{version:VERSION,eligibleAttempts:0,correctCount:0,questionIds:[],contextIds:[],sessionDates:[],firstAnsweredAt:null,lastAnsweredAt:null,delayedCorrectAt:null,productionQuestionIds:[],productionContextIds:[],productionDelayedCorrectAt:null}}
function normalize(value){const source=value&&typeof value==='object'?value:{};return{...empty(),...source,version:String(source.version||''),eligibleAttempts:Math.max(0,Number(source.eligibleAttempts)||0),correctCount:Math.max(0,Number(source.correctCount)||0),questionIds:unique(source.questionIds),contextIds:unique(source.contextIds),sessionDates:unique(source.sessionDates),firstAnsweredAt:iso(source.firstAnsweredAt),lastAnsweredAt:iso(source.lastAnsweredAt),delayedCorrectAt:iso(source.delayedCorrectAt),productionQuestionIds:unique(source.productionQuestionIds),productionContextIds:unique(source.productionContextIds),productionDelayedCorrectAt:iso(source.productionDelayedCorrectAt)}}
function update(previous,answer,question,skillId,now){
 const prior=normalize(previous),at=iso(now||new Date());
 if(!eligibleQuestion(question,skillId)||!at)return prior;
 const localDate=/^\d{4}-\d{2}-\d{2}$/.test(String(answer&&answer.localDate||''))?String(answer.localDate):at.slice(0,10),first=prior.version===VERSION&&prior.firstAnsweredAt?prior.firstAnsweredAt:at,context=contextId(question),questionIds=unique([...(prior.version===VERSION?prior.questionIds:[]),String(question.id)]),contextIds=unique([...(prior.version===VERSION?prior.contextIds:[]),...(context?[context]:[])]),sessionDates=unique([...(prior.version===VERSION?prior.sessionDates:[]),localDate]),delayed=!!(answer&&answer.isCorrect)&&timeValue(at)-timeValue(first)>=DELAY_MS&&sessionDates.length>=MIN_SESSIONS;
 const production=String(question.type||'').toLowerCase()==='reorder'&&answer&&answer.isCorrect,productionQuestionIds=unique([...(prior.version===VERSION?prior.productionQuestionIds:[]),...(production?[String(question.id)]:[])]),productionContextIds=unique([...(prior.version===VERSION?prior.productionContextIds:[]),...(production&&context?[context]:[])]),productionDelayed=production&&timeValue(at)-timeValue(first)>=DELAY_MS&&sessionDates.length>=MIN_SESSIONS;
 return{version:VERSION,eligibleAttempts:(prior.version===VERSION?prior.eligibleAttempts:0)+1,correctCount:(prior.version===VERSION?prior.correctCount:0)+(answer&&answer.isCorrect?1:0),questionIds,contextIds,sessionDates,firstAnsweredAt:first,lastAnsweredAt:at,delayedCorrectAt:prior.version===VERSION&&prior.delayedCorrectAt?prior.delayedCorrectAt:delayed?at:null,productionQuestionIds,productionContextIds,productionDelayedCorrectAt:prior.version===VERSION&&prior.productionDelayedCorrectAt?prior.productionDelayedCorrectAt:productionDelayed?at:null};
}
function assess(record){
 const source=record&&typeof record==='object'?record:{},evidence=normalize(source.evidence),requiresProduction=PRODUCTION_SKILLS.has(String(source.skillId||'')),checks={version:evidence.version===VERSION,mastery:Number(source.mastery)>=MIN_MASTERY,attempts:evidence.eligibleAttempts>=MIN_ATTEMPTS,questions:evidence.questionIds.length>=MIN_QUESTIONS,contexts:evidence.contextIds.length>=MIN_CONTEXTS,sessions:evidence.sessionDates.length>=MIN_SESSIONS,delayed:!!evidence.delayedCorrectAt,recentCorrect:source.lastCorrect===true,production:!requiresProduction||(evidence.productionQuestionIds.length>=MIN_PRODUCTION_QUESTIONS&&evidence.productionContextIds.length>=MIN_PRODUCTION_CONTEXTS&&!!evidence.productionDelayedCorrectAt)},verified=Object.values(checks).every(Boolean);
 return{version:VERSION,verified,state:verified?'verified':Number(source.mastery)>=MIN_MASTERY?'provisional':evidence.eligibleAttempts?'practicing':'unassessed',checks,evidence};
}

return{VERSION,QUESTION_CONTRACT_VERSION,MIN_MASTERY,MIN_ATTEMPTS,MIN_QUESTIONS,MIN_CONTEXTS,MIN_SESSIONS,PRODUCTION_SKILLS,MIN_PRODUCTION_QUESTIONS,MIN_PRODUCTION_CONTEXTS,DELAY_MS,unique,timeValue,contextId,eligibleQuestion,empty,normalize,update,assess};
});
