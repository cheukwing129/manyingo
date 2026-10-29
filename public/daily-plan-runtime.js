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
function balanceCatalogChoices(){
 const content=root&&root.ManjingoContent;if(!content||content.__balancedDailyChoices)return false;
 content.questions=balanceChoiceQuestions(content.questions,'catalog');
 try{Object.defineProperty(content,'__balancedDailyChoices',{value:true,enumerable:false,configurable:false});}catch(_){content.__balancedDailyChoices=true;}
 return true;
}
// The homepage calls this entry for both local and cloud plans. The policy is
// resolved at call time because adaptive study modules are loaded on demand.
function selectQuestionsForPlan(plan,sourceQuestions,limit){
 const content=root.ManjingoContent,policy=root.ManjingoPracticeEffectiveness,learning=root.ManjingoLocalLearning;
 if(!content||typeof content.selectQuestionsForPlan!=='function')return[];
 const select=(adjusted,questions,count)=>content.selectQuestionsForPlan(adjusted,questions,count);
 const selected=policy&&typeof policy.selectQuestionsForPlan==='function'?policy.selectQuestionsForPlan(plan,sourceQuestions,limit,select,learning):select(plan,sourceQuestions,limit);
 return limitReviews(selected,sourceQuestions,limit);
}
// Review, weak-point work and exact/concept retries share the same 50% budget.
function isReview(question){return !!question&&(question.category==='review'||question.category==='weak'||question.conceptReview===true||question.misconceptionReview===true)}
function limitReviews(selected,sourceQuestions,limit,options){
 const max=Math.max(0,Math.floor(Number(limit)||0));if(!max)return[];
 const prefix=options&&Array.isArray(options.prefix)?options.prefix:[],priorReviews=prefix.filter(isReview).length,priorFresh=prefix.length-priorReviews;
 const learning=root.ManjingoLocalLearning,skills=root.ManjingoSkillFirstPlan,metadata=root.ManjingoQuestionMetadataV1,rotation=root.ManjingoQuestionRotation;
 const recent=new Map(),seenIds=new Set(rotation&&typeof rotation.seenIds==='function'?rotation.seenIds():[]),seenSentences=new Set(rotation&&typeof rotation.recentSentenceIds==='function'?rotation.recentSentenceIds():[]);
 function seen(q){if(seenIds.has(questionId(q))||rotation&&typeof rotation.sentenceOf==='function'&&seenSentences.has(rotation.sentenceOf(q)))return true;const kp=String(q.kpId||'');if(!recent.has(kp))recent.set(kp,new Set(rotation&&typeof rotation.recentIds==='function'?rotation.recentIds(kp):[]));return recent.get(kp).has(questionId(q))}
 const items=[],ids=new Set();
 for(const q of Array.isArray(selected)?selected:[]){const id=questionId(q);if(!id||ids.has(id))continue;ids.add(id);items.push(seen(q)?{...q,category:'review'}:q)}
 const fresh=items.filter(q=>!isReview(q)),reviews=items.filter(isReview);
 const source=metadata&&typeof metadata.annotateAll==='function'?metadata.annotateAll(sourceQuestions||[]):sourceQuestions||[];
 const skillStates=new Map();
 function freshSkill(q){
  for(const id of q.skillIds||[]){if(!skillStates.has(id))skillStates.set(id,skills&&typeof skills.skillState==='function'?skills.skillState([],learning,id):'new');if(skillStates.get(id)==='new')return id}
  return null;
 }
 const candidates=[],records=new Map();
 for(const q of source){if(!questionId(q)||ids.has(questionId(q))||seen(q)||q.normalCore===false)continue;const skillId=freshSkill(q);if(!records.has(q.kpId))records.set(q.kpId,learning&&typeof learning.getKnowledge==='function'?learning.getKnowledge(q.kpId):null);const record=records.get(q.kpId),newMaterial=!skillId&&!!(record&&(Number(record.attempts)>0||record.lastAnsweredAt)||(q.skillIds||[]).length);ids.add(questionId(q));candidates.push({...q,skillId:skillId||q.skillId||(q.skillIds||[])[0],category:'new',newMaterial,conceptReview:false,misconceptionReview:false})}
 candidates.sort((a,b)=>Number(a.newMaterial)-Number(b.newMaterial));
 const ranked=rotation&&typeof rotation.rank==='function'?rotation.rank(candidates):candidates;
 // Keep genuinely new material in reserve even when an upstream plan contains only reviews.
 for(const q of ranked){if(fresh.length>=max)break;fresh.push(q);ids.add(questionId(q))}
 const reviewCount=Math.max(0,Math.min(reviews.length,Math.floor((prefix.length+max)/2)-priorReviews,priorFresh+fresh.length-priorReviews)),newCount=Math.min(fresh.length,max-reviewCount);
 const allowedReviews=new Set(reviews.slice(0,reviewCount).map(questionId)),allowedFresh=new Set(fresh.slice(0,newCount).map(questionId));
 const ordered=[...items,...fresh.filter(q=>!items.some(item=>questionId(item)===questionId(q)))];
 return balanceChoiceQuestions(ordered.filter(q=>isReview(q)?allowedReviews.has(questionId(q)):allowedFresh.has(questionId(q))).slice(0,max),'daily-half');
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
const api={questionId,hash32,stableShuffle,arrangeOptions,balanceChoiceQuestions,balanceCatalogChoices,isReview,limitReviews,selectQuestionsForPlan,sessionReservation,mergeReservation,counts,summary};
root.ManjingoDailyPlanRuntime=api;
balanceCatalogChoices();
})(window);
