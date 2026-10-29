(function(root,factory){
'use strict';
const api=factory(root);
if(typeof module==='object'&&module.exports)module.exports=api;
root.ManjingoMascotRuntime=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(root){
'use strict';
const RECOMMENDED_SIZES=Object.freeze([32,48,64,96,160]);
const COMPACT_ASSET='./mascot/v2/compact.svg';
const COMPLETION_ASSET='./mascot/v2/complete.svg';
const STATE_LIST=Object.freeze([
 Object.freeze({"id":"neutral","label":"一般","asset":"./mascot/v2/neutral.svg","intent":"首頁、一般歡迎、空狀態、品牌展示","motion":"static","artStatus":"production","productionPriority":0}),
 Object.freeze({"id":"happy","label":"開心","asset":"./mascot/v2/happy.svg","intent":"答對、完成小步驟","motion":"short-bounce","artStatus":"production","productionPriority":1}),
 Object.freeze({"id":"celebrate","label":"慶祝","asset":"./mascot/v2/celebrate.svg","intent":"全對、完成一課、解鎖重要內容","motion":"single-celebration","artStatus":"production","productionPriority":5}),
 Object.freeze({"id":"encouraging","label":"難過","asset":"./mascot/v2/sad.svg","intent":"答錯時清楚表達失落，配合支持式文字與解說","motion":"gentle-lift","artStatus":"production","productionPriority":2}),
 Object.freeze({"id":"thinking","label":"思考","asset":"./mascot/v2/thinking.svg","intent":"提示、概念理解、重新教學","motion":"static-or-fade","artStatus":"production","productionPriority":3}),
 Object.freeze({"id":"determined","label":"堅定","asset":"./mascot/v2/complete.svg","intent":"連續學習、streak、每日目標","motion":"static-or-short-lift","artStatus":"production","productionPriority":4})
]);
const STATES=Object.freeze(Object.fromEntries(STATE_LIST.map(item=>[item.id,item])));
const THINKING_TOKENS=Object.freeze(['📖','🧠','🔎']);
let observer=null;
function normalizeState(name){return Object.prototype.hasOwnProperty.call(STATES,String(name||''))?String(name):'neutral'}
function descriptor(name){return STATES[normalizeState(name)]}
function asset(name,options){const opts=options||{},size=Number(opts.size)||0;if((opts.compact===true||size>0&&size<=32)&&['happy','celebrate'].includes(normalizeState(name)))return COMPACT_ASSET;return descriptor(name).asset}
function stateClass(name){return'mascot-state-'+normalizeState(name)}
function list(){return STATE_LIST.slice()}
function isCanonical(name){return normalizeState(name)===String(name||'')}
function isProductionArt(name){const status=descriptor(name).artStatus;return status==='production'||status==='baseline-approved'}
function productionQueue(){return STATE_LIST.filter(item=>!isProductionArt(item.id)).slice().sort((a,b)=>Number(a.productionPriority||99)-Number(b.productionPriority||99))}
function semanticThinkingIcon(node){if(!node||!node.classList)return false;const text=String(node.textContent||'').trim();if(!THINKING_TOKENS.includes(text))return false;node.classList.add('mascot-thinking');if(node.dataset)node.dataset.mascotState='thinking';return true}
function scanSemantic(rootNode){if(typeof document==='undefined'||!rootNode)return 0;const nodes=[];if(rootNode.matches&&rootNode.matches('#lessonApp .lesson-step>.lesson-icon'))nodes.push(rootNode);if(rootNode.querySelectorAll)rootNode.querySelectorAll('#lessonApp .lesson-step>.lesson-icon').forEach(node=>nodes.push(node));let marked=0;nodes.forEach(node=>{if(semanticThinkingIcon(node))marked+=1});return marked}
function installSemanticStates(){if(typeof document==='undefined'||!document.documentElement)return false;scanSemantic(document);if(observer||typeof MutationObserver!=='function'||!document.body)return true;observer=new MutationObserver(records=>records.forEach(record=>{if(record.target)scanSemantic(record.target);if(record.addedNodes)record.addedNodes.forEach(scanSemantic)}));observer.observe(document.body,{childList:true,subtree:true,characterData:true});api.observer=observer;return true}
const api={version:2,name:'小墨靈 / Little Ink Spirit',recommendedSizes:RECOMMENDED_SIZES,compactAsset:COMPACT_ASSET,completionAsset:COMPLETION_ASSET,states:STATES,stateList:STATE_LIST,normalizeState,descriptor,asset,stateClass,list,isCanonical,isProductionArt,productionQueue,semanticThinkingIcon,scanSemantic,installSemanticStates,observer:null};
if(typeof document!=='undefined'){if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',installSemanticStates);else installSemanticStates()}
return api;
});
