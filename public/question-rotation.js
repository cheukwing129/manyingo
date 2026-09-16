(function(root,factory){
'use strict';
const api=factory(root);
if(typeof module==='object'&&module.exports)module.exports=api;
root.ManjingoQuestionRotation=api;
if(root.window&&root.window!==root)root.window.ManjingoQuestionRotation=api;
api.balanceCatalogChoices();
const doc=root.document||(root.window&&root.window.document);
const catalog=root.ManjingoContent||(root.window&&root.window.ManjingoContent);
if(doc&&doc.readyState==='loading'&&catalog&&!root.ManjingoStartupRuntimeBundled){
 doc.write('<script src="./skill-evidence-v1.js"><\/script><script src="./skill-mastery-v1.js"><\/script><script src="./skill-results-v1.js"><\/script><script src="./skill-first-plan.js"><\/script><script src="./question-pack-adaptive-01.js"><\/script><script src="./question-pack-adaptive-02.js"><\/script><script src="./question-pack-adaptive-03.js"><\/script><script src="./difficulty-calibration.js"><\/script><script src="./question-difficulty.js"><\/script><script src="./difficulty-observability.js"><\/script><script src="./remote-sync-guard.js"><\/script>');
}
})(typeof globalThis!=='undefined'?globalThis:this,function(root){
'use strict';
const KEY='manjingo_question_rotation_v1';
const MAX_PER_KP=8;
const SENTENCE_HISTORY_KEY='__sourceSentences';
const MAX_SENTENCES=24;
let observer=null;
function store(){return root.localStorage||(root.window&&root.window.localStorage)||null}
function read(){const s=store();if(!s)return{};try{const raw=JSON.parse(s.getItem(KEY)||'{}');return raw&&typeof raw==='object'?raw:{}}catch(e){return{}}}
function write(data){const s=store();if(!s)return false;try{s.setItem(KEY,JSON.stringify(data||{}));return true}catch(e){return false}}
function idOf(question){return question&&question.id!=null?String(question.id):''}
function kpOf(question){return question&&question.kpId!=null?String(question.kpId):''}
function hash32(value){let h=2166136261>>>0;for(const ch of String(value||'')){h^=ch.charCodeAt(0);h=Math.imul(h,16777619)>>>0;}return h>>>0;}
function randomRank(seed,step){let x=(hash32(seed)+Math.imul((Number(step)||0)+1,0x9e3779b9))>>>0;x^=x>>>16;x=Math.imul(x,0x7feb352d)>>>0;x^=x>>>15;x=Math.imul(x,0x846ca68b)>>>0;x^=x>>>16;return x>>>0;}
function stableShuffle(values,seed){const result=(Array.isArray(values)?values:[]).slice();for(let i=result.length-1;i>0;i--){const j=randomRank(seed,i)%(i+1),tmp=result[i];result[i]=result[j];result[j]=tmp;}return result;}
function arrangeOptions(options,answer,desiredSlot,seed){const list=(Array.isArray(options)?options:[]).map(String);if(list.length<2)return list;const answerText=String(answer==null?'':answer),answerIndex=list.findIndex(x=>x===answerText);if(answerIndex<0)return stableShuffle(list,seed);const distractors=list.filter((_,index)=>index!==answerIndex),shuffled=stableShuffle(distractors,String(seed||'')+':distractors'),slot=((Math.floor(Number(desiredSlot)||0)%list.length)+list.length)%list.length;shuffled.splice(slot,0,list[answerIndex]);return shuffled;}
function balanceChoiceQuestions(items,seed){
 const countsBySize=new Map(),previousBySize=new Map();
 return(Array.isArray(items)?items:[]).map((raw,index)=>{
   const q=raw&&typeof raw==='object'?raw:null,options=q&&Array.isArray(q.o)?q.o:null,answer=q&&q.a!=null?String(q.a):null;
   if(!q||!options||options.length<2||answer==null||!options.map(String).includes(answer))return q;
   const size=options.length,counts=countsBySize.get(size)||Array(size).fill(0),min=Math.min(...counts);let candidates=counts.map((count,slot)=>({count,slot})).filter(x=>x.count===min),previous=previousBySize.get(size);
   if(candidates.length>1&&previous!=null)candidates=candidates.filter(x=>x.slot!==previous);if(!candidates.length)candidates=counts.map((count,slot)=>({count,slot})).filter(x=>x.count===min);
   candidates.sort((a,b)=>randomRank(String(seed||'rotation')+':'+idOf(q)+':'+index,a.slot)-randomRank(String(seed||'rotation')+':'+idOf(q)+':'+index,b.slot)||a.slot-b.slot);
   const desired=candidates[0].slot;counts[desired]++;countsBySize.set(size,counts);previousBySize.set(size,desired);return{...q,o:arrangeOptions(options,answer,desired,String(seed||'rotation')+':'+idOf(q))};
 });
}
function catalog(){return root.ManjingoContent||(root.window&&root.window.ManjingoContent)||null}
function balanceCatalogChoices(){const content=catalog();if(!content||content.__balancedCatalogChoices||!Array.isArray(content.questions))return false;content.questions=balanceChoiceQuestions(content.questions,'catalog');try{Object.defineProperty(content,'__balancedCatalogChoices',{value:true,enumerable:false,configurable:false})}catch(_){content.__balancedCatalogChoices=true}return true;}
function metadata(){return root.ManjingoQuestionMetadataV1||(root.window&&root.window.ManjingoQuestionMetadataV1)||null}
function sentenceOf(question){
 const explicit=String(question&&question.sourceSentenceId||'');
 if(explicit)return explicit;
 const api=metadata();
 if(api&&typeof api.classify==='function')return String(api.classify(question).sourceSentenceId||'');
 return'';
}
function recentIds(kpId){const data=read(),ids=data[String(kpId)];return Array.isArray(ids)?ids.map(String):[]}
function recentSentenceIds(){const data=read(),ids=data[SENTENCE_HISTORY_KEY];return Array.isArray(ids)?ids.map(String):[]}
function remember(question){
 const id=idOf(question),kpId=kpOf(question);if(!id||!kpId)return false;
 const data=read(),current=Array.isArray(data[kpId])?data[kpId].map(String):[];
 data[kpId]=[id,...current.filter(x=>x!==id)].slice(0,MAX_PER_KP);
 const sentence=sentenceOf(question);
 if(sentence){const recent=Array.isArray(data[SENTENCE_HISTORY_KEY])?data[SENTENCE_HISTORY_KEY].map(String):[];data[SENTENCE_HISTORY_KEY]=[sentence,...recent.filter(x=>x!==sentence)].slice(0,MAX_SENTENCES)}
 return write(data);
}
function rank(list){const source=Array.isArray(list)?list.slice():[];if(!source.length)return source;const byKp=new Map();source.forEach(q=>{const kpId=kpOf(q);if(!byKp.has(kpId))byKp.set(kpId,recentIds(kpId))});return source.map((q,index)=>{const ids=byKp.get(kpOf(q))||[],position=ids.indexOf(idOf(q));return{q,index,position}}).sort((a,b)=>{const aUnseen=a.position<0,bUnseen=b.position<0;if(aUnseen!==bUnseen)return aUnseen?-1:1;if(aUnseen&&bUnseen)return a.index-b.index;if(a.position!==b.position)return b.position-a.position;return a.index-b.index}).map(item=>item.q)}
function select(list,limit){return balanceChoiceQuestions(rank(list).slice(0,Math.max(0,Number(limit)||0)),'rotation-select')}
function choose(list,preferredIds){const source=Array.isArray(list)?list:[],preferred=new Set((Array.isArray(preferredIds)?preferredIds:[]).map(String)),preferredPool=preferred.size?source.filter(q=>preferred.has(idOf(q))):[];const pool=preferredPool.length?preferredPool:source;return rank(pool)[0]||null}
function clean(value){return String(value||'').replace(/\s+/g,' ').trim()}
function rememberNode(node){if(!node||!node.matches)return false;const questionNode=node.matches('.question,.lesson-question')?node:node.querySelector&&node.querySelector('.question,.lesson-question');if(!questionNode)return false;const text=clean(questionNode.textContent),content=catalog();if(!text||!content||!Array.isArray(content.questions))return false;const question=content.questions.find(q=>clean(q&&q.q)===text);return question?remember(question):false}
function install(){const doc=root.document||(root.window&&root.window.document);if(!doc)return false;rememberNode(doc);if(observer||typeof MutationObserver!=='function'&&!root.MutationObserver)return true;const Observer=root.MutationObserver||(root.window&&root.window.MutationObserver);if(typeof Observer!=='function'||!doc.body)return true;observer=new Observer(records=>records.forEach(record=>record.addedNodes&&record.addedNodes.forEach(rememberNode)));observer.observe(doc.body,{childList:true,subtree:true});return true}
function clear(){const s=store();if(!s)return false;try{s.removeItem(KEY);return true}catch(e){return false}}
const api={KEY,MAX_PER_KP,SENTENCE_HISTORY_KEY,MAX_SENTENCES,idOf,kpOf,hash32,stableShuffle,arrangeOptions,balanceChoiceQuestions,balanceCatalogChoices,sentenceOf,recentIds,recentSentenceIds,remember,rank,select,choose,rememberNode,install,clear};
const doc=root.document||(root.window&&root.window.document);if(doc){if(doc.readyState==='loading')doc.addEventListener('DOMContentLoaded',install);else install()}
return api;
});
