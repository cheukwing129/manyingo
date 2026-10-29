(function(root){
'use strict';
function questionId(question){return question&&question.id!=null?String(question.id):''}
function toSet(values){if(values instanceof Set)return new Set(Array.from(values,String));return new Set((Array.isArray(values)?values:[]).map(String))}
function hash32(value){let h=2166136261>>>0;for(const ch of String(value||'')){h^=ch.charCodeAt(0);h=Math.imul(h,16777619)>>>0;}return h>>>0;}
function randomRank(seed,step){let x=(hash32(seed)+Math.imul((Number(step)||0)+1,0x9e3779b9))>>>0;x^=x>>>16;x=Math.imul(x,0x7feb352d)>>>0;x^=x>>>15;x=Math.imul(x,0x846ca68b)>>>0;x^=x>>>16;return x>>>0;}
function stableShuffle(values,seed){const result=(Array.isArray(values)?values:[]).slice();for(let i=result.length-1;i>0;i--){const j=randomRank(seed,i)%(i+1),tmp=result[i];result[i]=result[j];result[j]=tmp;}return result;}
function arrangeOptions(options,answer,desiredSlot,seed){
 const list=(Array.isArray(options)?options:[]).map(String);if(list.length<2)return list;
 const answerText=String(answer==null?'':answer),answerIndex=list.findIndex(x=>x===answerText);
 if(answerIndex<0)return stableShuffle(list,seed);
 const distractors=list.filter((_,index)=>index!==answerIndex),shuffled=stableShuffle(distractors,String(seed||'')+':distractors'),slot=((Math.floor(Number(desiredSlot)||0)%list.length)+list.length)%list.length;
 shuffled.splice(slot,0,list[answerIndex]);return shuffled;
}
function balanceChoiceQuestions(items,seed){
 const countsBySize=new Map(),previousBySize=new Map();
 return (Array.isArray(items)?items:[]).map((raw,index)=>{
   const q=raw&&typeof raw==='object'?raw:null,options=q&&Array.isArray(q.o)?q.o:null,answer=q&&q.a!=null?String(q.a):null;
   if(!q||!options||options.length<2||answer==null||!options.map(String).includes(answer))return q;
   const size=options.length,counts=countsBySize.get(size)||Array(size).fill(0),min=Math.min(...counts);
   let candidates=counts.map((count,slot)=>({count,slot})).filter(x=>x.count===min),previous=previousBySize.get(size);
   if(candidates.length>1&&previous!=null)candidates=candidates.filter(x=>x.slot!==previous);
   if(!candidates.length)candidates=counts.map((count,slot)=>({count,slot})).filter(x=>x.count===min);
   candidates.sort((a,b)=>randomRank(String(seed||'daily')+':'+questionId(q)+':'+index,a.slot)-randomRank(String(seed||'daily')+':'+questionId(q)+':'+index,b.slot)||a.slot-b.slot);
   const desired=candidates[0].slot;counts[desired]++;countsBySize.set(size,counts);previousBySize.set(size,desired);
   return{...q,o:arrangeOptions(options,answer,desired,String(seed||'daily')+':'+questionId(q))};
 });
}
function installContentChoiceBalancing(){
 const content=root&&root.ManjingoContent;if(!content||content.__balancedDailyChoices)return false;
 content.questions=balanceChoiceQuestions(content.questions,'catalog');
 if(typeof content.selectQuestionsForPlan==='function'){
   const original=content.selectQuestionsForPlan.bind(content);
   content.selectQuestionsForPlan=function(plan,sourceQuestions,limit){return balanceChoiceQuestions(original(plan,sourceQuestions,limit),'plan:'+String(limit==null?'auto':limit));};
 }
 try{Object.defineProperty(content,'__balancedDailyChoices',{value:true,enumerable:false,configurable:false});}catch(_){content.__balancedDailyChoices=true;}
 return true;
}
// The homepage calls this entry for both local and cloud plans. The policy is
// resolved at call time because adaptive study modules are loaded on demand.
function selectQuestionsForPlan(plan,sourceQuestions,limit){
 const content=root.ManjingoContent,policy=root.ManjingoPracticeEffectiveness,learning=root.ManjingoLocalLearning;
 if(!content||typeof content.selectQuestionsForPlan!=='function')return[];
 const select=(adjusted,questions,count)=>content.selectQuestionsForPlan(adjusted,questions,count);
 return policy&&typeof policy.selectQuestionsForPlan==='function'?policy.selectQuestionsForPlan(plan,sourceQuestions,limit,select,learning):select(plan,sourceQuestions,limit);
}
function sessionReservation(queue,index,completedQuestionIds,targetCount){
 const list=Array.isArray(queue)?queue:[],completed=toSet(completedQuestionIds),safeIndex=Math.max(0,Number(index)||0),current=list[safeIndex]||null,currentId=questionId(current),currentPending=!!currentId&&!completed.has(currentId),excludedIds=new Set(completed);
 if(currentPending)excludedIds.add(currentId);
 const target=Math.max(0,Number(targetCount)||0),remainingSlots=Math.max(0,target-completed.size-(currentPending?1:0));
 return{prefix:list.slice(0,Math.min(list.length,safeIndex+1,target||list.length)),current,currentPending,excludedIds,remainingSlots,target};
}
function mergeReservation(reservation,candidates){
 const r=reservation||{},seen=toSet(r.excludedIds),tail=[],limit=Math.max(0,Number(r.remainingSlots)||0),target=Math.max(0,Number(r.target)||0);
 for(const question of Array.isArray(candidates)?candidates:[]){if(tail.length>=limit)break;const id=questionId(question);if(!id||seen.has(id))continue;seen.add(id);tail.push(question)}
 const combined=[...(Array.isArray(r.prefix)?r.prefix:[]),...tail],questions=target?combined.slice(0,target):combined,remaining=r.currentPending&&r.current?[r.current,...tail]:tail.slice();
 return{questions,remaining:target?remaining.slice(0,Math.max(0,target-(questions.length-remaining.length))):remaining,tail};
}
function counts(items){const list=Array.isArray(items)?items:[];return{review:list.filter(x=>x&&x.category==='review').length,weak:list.filter(x=>x&&x.category==='weak').length,newKnowledge:list.filter(x=>x&&x.category==='new').length,total:list.length}}
function summary(items){const c=counts(items);return c.total?'剩餘安排：複習 '+c.review+' · 弱項 '+c.weak+' · 新知識 '+c.newKnowledge:'本輪已沒有剩餘題目。'}
const api={questionId,hash32,stableShuffle,arrangeOptions,balanceChoiceQuestions,installContentChoiceBalancing,selectQuestionsForPlan,sessionReservation,mergeReservation,counts,summary};
root.ManjingoDailyPlanRuntime=api;
installContentChoiceBalancing();
})(window);
