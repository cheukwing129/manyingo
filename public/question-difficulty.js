(function(root,factory){
'use strict';
const api=factory(root);
if(typeof module==='object'&&module.exports)module.exports=api;
root.ManjingoQuestionDifficulty=api;
if(root.window&&root.window!==root)root.window.ManjingoQuestionDifficulty=api;
api.extendCatalog();
})(typeof globalThis!=='undefined'?globalThis:this,function(root){
'use strict';
const TIERS=['foundation','application','transfer'];
const LABELS={foundation:'基礎辨識',application:'語境應用',transfer:'跨篇遷移'};
function fromRoot(name){return root[name]||(root.window&&root.window[name])||null}
function clampMastery(value){const n=Number(value);return Math.max(0,Math.min(100,Number.isFinite(n)?n:0))}
function tierIndex(tier){const i=TIERS.indexOf(String(tier||''));return i>=0?i:1}
function tierOf(question){return TIERS.includes(question&&question.difficultyTier)?question.difficultyTier:'application'}
function tierForMastery(mastery,options){
 const opts=options||{},calibration=fromRoot('ManjingoDifficultyCalibration');
 if(calibration&&typeof calibration.tierForMastery==='function')return calibration.tierForMastery(mastery,opts);
 const mode=String(opts.mode||'normal');
 if(mode==='remedial')return'foundation';
 if(mode==='reteach')return'transfer';
 const value=clampMastery(mastery);
 let index=value>=75?2:value>=40?1:0;
 if(opts.lastCorrect===false)index=Math.max(0,index-1);
 return TIERS[index];
}
function recentPosition(rotation,question){
 if(!rotation||typeof rotation.recentIds!=='function'||!question)return-1;
 const ids=rotation.recentIds(question.kpId)||[];
 return ids.map(String).indexOf(String(question.id));
}
function rank(list,options){
 const source=Array.isArray(list)?list.slice():[],opts=options||{},rotation=opts.rotation||fromRoot('ManjingoQuestionRotation'),target=opts.targetTier||tierForMastery(opts.mastery,opts),targetIndex=tierIndex(target),preferred=new Set((Array.isArray(opts.preferredIds)?opts.preferredIds:[]).map(String)),hasPreferred=preferred.size&&source.some(q=>preferred.has(String(q&&q.id)));
 return source.map((q,index)=>{
   const position=recentPosition(rotation,q),seen=position>=0,preferredPenalty=hasPreferred&&!preferred.has(String(q&&q.id))?100:0,distance=Math.abs(tierIndex(tierOf(q))-targetIndex),seenPenalty=seen?3:0,recencyPenalty=seen?Math.max(0,1-position/20):0;
   return{q,index,score:preferredPenalty+distance*2+seenPenalty+recencyPenalty};
 }).sort((a,b)=>a.score-b.score||a.index-b.index).map(item=>item.q);
}
function select(list,limit,options){return rank(list,options).slice(0,Math.max(0,Number(limit)||0))}
function choose(list,options){return rank(list,options)[0]||null}
function labelFor(questionOrTier){const tier=typeof questionOrTier==='string'?questionOrTier:tierOf(questionOrTier);return LABELS[tier]||LABELS.application}
function practiceMode(kpId){
 const learning=fromRoot('ManjingoLocalLearning'),loc=root.location||(root.window&&root.window.location),search=String(loc&&loc.search||''),targeted=/(?:\?|&)mode=practice(?:&|$)/.test(search);
 if(!learning||typeof learning.getRemediationStatus!=='function')return targeted?'practice':'normal';
 let status=null;try{status=learning.getRemediationStatus(kpId)||null}catch(e){}
 if(targeted&&status&&status.needsConceptReteach)return'reteach';
 if(status&&(status.needsRemediation||status.needsConceptReteach))return'remedial';
 return targeted?'practice':'normal';
}
function contextFor(list,preferredIds){
 const source=Array.isArray(list)?list:[],first=source.find(q=>q&&q.kpId),kpId=first&&first.kpId,learning=fromRoot('ManjingoLocalLearning');
 let record={};if(kpId&&learning&&typeof learning.getKnowledge==='function'){try{record=learning.getKnowledge(kpId)||{}}catch(e){}}
 return{mastery:Number(record.mastery)||0,lastCorrect:record.lastCorrect,tierStats:record.tierStats||null,mode:practiceMode(kpId),preferredIds};
}
function adaptivePacks(){
 return['ManjingoQuestionPackAdaptive01','ManjingoQuestionPackAdaptive02','ManjingoQuestionPackAdaptive03'].map(fromRoot).filter(pack=>pack&&Array.isArray(pack.questions));
}
function extendCatalog(){
 const catalog=fromRoot('ManjingoContent'),packs=adaptivePacks();
 if(!catalog||!Array.isArray(catalog.questions)||!packs.length)return false;
 const revisions=Object.assign({},...packs.map(pack=>pack.tierRevisions&&typeof pack.tierRevisions==='object'?pack.tierRevisions:{}));
 catalog.questions.forEach(q=>{const tier=revisions[String(q&&q.id)];if(TIERS.includes(tier))q.difficultyTier=tier});
 const ids=new Set(catalog.questions.map(q=>String(q&&q.id)));
 packs.forEach(pack=>pack.questions.forEach(q=>{
   if(!q||!q.id||ids.has(String(q.id)))return;
   const concept=typeof catalog.misconceptionConcept==='function'?catalog.misconceptionConcept(q):null,enriched=concept?{...q,misconceptionKey:concept.key,misconceptionLabel:concept.label}:{...q};
   catalog.questions.push(enriched);ids.add(String(q.id));
 }));
 catalog.catalogVersion=packs.map(pack=>pack.catalogVersion).filter(Boolean).pop()||'reviewed-v2';
 return true;
}
return{TIERS,LABELS,clampMastery,tierIndex,tierOf,tierForMastery,rank,select,choose,labelFor,practiceMode,contextFor,adaptivePacks,extendCatalog};
});
