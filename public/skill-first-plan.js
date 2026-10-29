(function(root,factory){
'use strict';
let curriculum=root&&root.ManjingoCurriculumV1,metadata=root&&root.ManjingoQuestionMetadataV1,diversity=root&&root.ManjingoQuestionDiversityV1,skillMastery=root&&root.ManjingoSkillMasteryV1;
if(typeof module==='object'&&module.exports){
 curriculum=require('./curriculum-v1.js');
 metadata=require('./question-metadata-v1.js');
 diversity=require('./question-diversity-v1.js');
 skillMastery=require('./skill-mastery-v1.js');
 module.exports=factory(root,curriculum,metadata,diversity,skillMastery);
 return;
}
const api=factory(root,curriculum,metadata,diversity,skillMastery);
root.ManjingoSkillFirstPlan=api;
if(root.window&&root.window!==root)root.window.ManjingoSkillFirstPlan=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(root,curriculum,metadata,diversity,skillMastery){
'use strict';

const VERSION='skill-first-plan-v2';
const CATEGORY_ORDER={review:0,weak:1,new:2,stable:3};

function runtimeRoot(){return root&&root.window||root}
function rotation(){const r=runtimeRoot();return r&&r.ManjingoQuestionRotation||null}
function learning(){const r=runtimeRoot();return r&&r.ManjingoLocalLearning||null}
function skillMasteryApi(){const r=runtimeRoot();return r&&r.ManjingoSkillMasteryV1||skillMastery||null}
function idOf(q){return String(q&&q.id||'')}
function kpOf(q){return String(q&&q.kpId||'')}
function unique(values){return Array.from(new Set((values||[]).map(String).filter(Boolean)))}
function annotateAll(questions){const source=Array.isArray(questions)?questions:[];return metadata&&typeof metadata.annotateAll==='function'?metadata.annotateAll(source):source.map(q=>({...q,normalCore:true,skillIds:Array.isArray(q&&q.skillIds)?q.skillIds.map(String):[]}));}
function coreQuestions(questions){return annotateAll(questions).filter(q=>q&&q.normalCore&&Array.isArray(q.skillIds)&&q.skillIds.length);}
function poolsFor(questions){
 const pools=new Map();
 for(const q of coreQuestions(questions))for(const skillId of unique(q.skillIds)){if(!pools.has(skillId))pools.set(skillId,[]);pools.get(skillId).push(q)}
 return pools;
}
function kpSkillsFor(pools){
 const map=new Map();
 for(const[skillId,questions]of pools)for(const q of questions){const kpId=kpOf(q);if(!kpId)continue;if(!map.has(kpId))map.set(kpId,[]);if(!map.get(kpId).includes(skillId))map.get(kpId).push(skillId)}
 return map;
}
function kpIdsForSkill(pools,skillId){return unique((pools.get(String(skillId))||[]).map(kpOf))}
function orderedSkillIds(pools){
 const available=new Set(Array.from(pools.keys())),result=[],listed=new Set();
 const skills=curriculum&&Array.isArray(curriculum.skills)?curriculum.skills:[];
 const domains=curriculum&&Array.isArray(curriculum.domains)?curriculum.domains.map(x=>String(x.id)):[];
 const stages=Array.from(new Set(skills.filter(x=>available.has(String(x.id))).map(x=>Number(x.stage)||99))).sort((a,b)=>a-b);
 for(const stage of stages){
  const queues=new Map();
  for(const domain of domains)queues.set(domain,skills.filter(x=>available.has(String(x.id))&&(Number(x.stage)||99)===stage&&String(x.domain)===domain).map(x=>String(x.id)));
  let pending=true;
  while(pending){pending=false;for(const domain of domains){const queue=queues.get(domain)||[];if(queue.length){pending=true;const id=queue.shift();if(!listed.has(id)){listed.add(id);result.push(id)}}}}
 }
 for(const id of available)if(!listed.has(id)){listed.add(id);result.push(id)}
 return result;
}
function attempted(record){return !!(record&&(Number(record.attempts)>0||Number(record.correctCount)>0||Number(record.wrongCount)>0||record.lastAnsweredAt))}
function recordDue(record,engine){if(!attempted(record))return false;if(engine&&typeof engine.isDue==='function')return !!engine.isDue(record);const value=record&&record.nextReviewAt;return !value||new Date(value).getTime()<=Date.now()}
function skillState(kpIds,engine,skillId,api){
 const masteryApi=api||skillMasteryApi();
 if(masteryApi&&typeof masteryApi.getSkillMastery==='function'&&skillId){const skillRecord=masteryApi.getSkillMastery(skillId,{engine,kpIds});if(attempted(skillRecord)){if(recordDue(skillRecord,engine))return'review';if(Number(skillRecord.mastery||0)<60||skillRecord.lastCorrect===false)return'weak';return'stable'}}
 if(!engine||typeof engine.getKnowledge!=='function')return'new';
 const records=kpIds.map(id=>engine.getKnowledge(id)).filter(attempted);
 if(!records.length)return'new';
 if(records.some(r=>recordDue(r,engine)))return'review';
 if(records.some(r=>Number(r.mastery||0)<60||r.lastCorrect===false))return'weak';
 return'stable';
}
function preferredQuestionIds(item){return unique([...(Array.isArray(item&&item.conceptQuestionIds)?item.conceptQuestionIds:[]),...(Array.isArray(item&&item.misconceptionQuestionIds)?item.misconceptionQuestionIds:[])]);}
function skillRank(ordered){const map=new Map();ordered.forEach((id,index)=>map.set(id,index));return id=>map.has(id)?map.get(id):Number.MAX_SAFE_INTEGER}
function migratedSkills(kpId){
 const id=String(kpId||'');
 const rule=curriculum&&(typeof curriculum.migrationFor==='function'?curriculum.migrationFor(id):curriculum.migration&&curriculum.migration[id]);
 return unique(rule&&rule.targetSkillIds);
}
function chooseSkillForItem(item,kpSkills,questionsById,used,ordered){
 const explicit=String(item&&item.skillId||'');
 if(explicit&&poolsHasSkill(kpSkills,questionsById,explicit)&&!used.has(explicit))return explicit;
 const rank=skillRank(ordered),kpId=String(item&&item.kpId||''),preferred=preferredQuestionIds(item),preferredSkills=[];
 for(const id of preferred){const q=questionsById.get(String(id));if(!q||!q.normalCore)continue;for(const skillId of unique(q.skillIds))if(!preferredSkills.includes(skillId))preferredSkills.push(skillId)}
 for(const tier of [preferredSkills,migratedSkills(kpId),kpSkills.get(kpId)||[]]){
  const candidates=unique(tier).filter(id=>!used.has(id));
  candidates.sort((a,b)=>rank(a)-rank(b));
  if(candidates.length)return candidates[0];
 }
 return null;
}
function poolsHasSkill(kpSkills,questionsById,skillId){for(const ids of kpSkills.values())if(ids.includes(String(skillId)))return true;for(const q of questionsById.values())if(Array.isArray(q&&q.skillIds)&&q.skillIds.map(String).includes(String(skillId)))return true;return false}
function normalizedCategory(itemCategory,state){
 const category=String(itemCategory||'new');
 if(state==='review'||state==='weak')return state;
 if(state==='stable')return category==='review'||category==='weak'?category:null;
 return category==='review'||category==='weak'?category:'new';
}
function makeIntent(item,skillId,pools,engine,masteryApi){
 const kpIds=kpIdsForSkill(pools,skillId),state=skillState(kpIds,engine,skillId,masteryApi),category=normalizedCategory(item&&item.category,state);
 if(!category)return null;
 return{...(item||{}),skillId:String(skillId),kpIds,kpId:String(item&&item.kpId||kpIds[0]||''),category,priority:item&&item.priority!=null?item.priority:(category==='review'?1:category==='weak'?2:3),skillState:state};
}
function adaptPlan(plan,questions,limit,options){
 const source=Array.isArray(questions)?questions:[],max=Math.max(0,Number(limit)||Number(plan&&plan.targetCount)||10),pools=poolsFor(source),kpSkills=kpSkillsFor(pools),ordered=orderedSkillIds(pools),annotated=coreQuestions(source),questionsById=new Map(annotated.map(q=>[idOf(q),q])),engine=options&&options.learning||learning(),masteryApi=options&&options.skillMastery||skillMasteryApi(),items=Array.isArray(plan&&plan.items)?plan.items:[],used=new Set(),intents=[];
 for(const item of items){
  if(intents.length>=max)break;
  const skillId=chooseSkillForItem(item,kpSkills,questionsById,used,ordered);if(!skillId)continue;
  const intent=makeIntent(item,skillId,pools,engine,masteryApi);if(!intent)continue;
  used.add(skillId);intents.push(intent);
 }
 const fill=[];
 for(const skillId of ordered){
  if(used.has(skillId))continue;
  const kpIds=kpIdsForSkill(pools,skillId),state=skillState(kpIds,engine,skillId,masteryApi),category=state==='stable'?'stable':state;
  fill.push({skillId,kpIds,state,category,order:ordered.indexOf(skillId)});
 }
 fill.sort((a,b)=>(CATEGORY_ORDER[a.category]??9)-(CATEGORY_ORDER[b.category]??9)||a.order-b.order);
 for(const row of fill){
  if(intents.length>=max)break;
  const category=row.category==='stable'?'review':row.category,intent={skillId:row.skillId,kpIds:row.kpIds,kpId:row.kpIds[0]||'',category,priority:category==='review'?1:category==='weak'?2:3,skillState:row.state};
  used.add(row.skillId);intents.push(intent);
 }
 return{...(plan||{}),targetCount:intents.length,items:intents,skillFirst:true,skills:intents.map(x=>x.skillId),review:intents.filter(x=>x.category==='review').map(x=>x.kpId),weak:intents.filter(x=>x.category==='weak').map(x=>x.kpId),newKnowledgePoints:intents.filter(x=>x.category==='new').map(x=>x.kpId),reviewSkills:intents.filter(x=>x.category==='review').map(x=>x.skillId),weakSkills:intents.filter(x=>x.category==='weak').map(x=>x.skillId),newSkills:intents.filter(x=>x.category==='new').map(x=>x.skillId),totalRecommended:intents.length};
}
function candidateForIntent(intent,pools,usedIds,queue,options){
 const rot=options&&options.rotation||rotation(),div=options&&options.diversity||diversity,avoidSentenceIds=options&&options.avoidSentenceIds||[],available=(pools.get(String(intent.skillId))||[]).filter(q=>!usedIds.has(idOf(q)));if(!available.length)return null;
 const preferred=preferredQuestionIds(intent),preferredSet=new Set(preferred),preferredPool=preferred.length?available.filter(q=>preferredSet.has(idOf(q))):[],pool=preferredPool.length?preferredPool:available;
 let ranked=rot&&typeof rot.rank==='function'?rot.rank(pool):pool.slice(),candidate=div&&typeof div.choose==='function'?div.choose(ranked,queue,{avoidSentenceIds}):ranked[0]||null;
 if(!candidate&&preferredPool.length){ranked=rot&&typeof rot.rank==='function'?rot.rank(available):available.slice();candidate=div&&typeof div.choose==='function'?div.choose(ranked,queue,{avoidSentenceIds}):ranked[0]||null}
 return candidate||available[0]||null;
}
function selectQuestionsForPlan(plan,sourceQuestions,limit,options){
 const source=Array.isArray(sourceQuestions)?sourceQuestions:[],max=Math.max(0,Number(limit)||Number(plan&&plan.targetCount)||10),pools=poolsFor(source),adapted=adaptPlan(plan,source,max,options),rot=options&&options.rotation||rotation(),avoidSentenceIds=rot&&typeof rot.recentSentenceIds==='function'?rot.recentSentenceIds():[],queue=[],usedIds=new Set();
 for(const intent of adapted.items){
  if(queue.length>=max)break;
  const candidate=candidateForIntent(intent,pools,usedIds,queue,{...(options||{}),rotation:rot,avoidSentenceIds});if(!candidate)continue;
  usedIds.add(idOf(candidate));const conceptPreferred=Array.isArray(intent.conceptQuestionIds)?intent.conceptQuestionIds.map(String):[],misconceptionPreferred=Array.isArray(intent.misconceptionQuestionIds)?intent.misconceptionQuestionIds.map(String):[];
  queue.push({...candidate,skillId:intent.skillId,category:intent.category||'new',priority:intent.priority??3,conceptReview:conceptPreferred.includes(idOf(candidate)),conceptKey:intent.conceptKey||candidate.misconceptionKey||null,conceptLabel:intent.conceptLabel||candidate.misconceptionLabel||null,conceptMastery:intent.conceptMastery??null,misconceptionReview:misconceptionPreferred.includes(idOf(candidate))});
 }
 if(queue.length<max){
  const remaining=coreQuestions(source).filter(q=>!usedIds.has(idOf(q))),ordered=rot&&typeof rot.rank==='function'?rot.rank(remaining):remaining;
  for(const candidate of ordered){if(queue.length>=max)break;const div=options&&options.diversity||diversity;if(div&&typeof div.choose==='function'){const chosen=div.choose(ordered.filter(q=>!usedIds.has(idOf(q))),queue,{avoidSentenceIds});if(!chosen)break;usedIds.add(idOf(chosen));queue.push({...chosen,skillId:String(chosen.skillIds&&chosen.skillIds[0]||''),category:'review',priority:3});continue}usedIds.add(idOf(candidate));queue.push({...candidate,skillId:String(candidate.skillIds&&candidate.skillIds[0]||''),category:'review',priority:3})}
 }
 return queue;
}

return{VERSION,coreQuestions,poolsFor,kpSkillsFor,kpIdsForSkill,orderedSkillIds,skillState,adaptPlan,selectQuestionsForPlan};
});